-- Trust Infrastructure Initial Schema
-- PostgreSQL 16+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agent status enum
CREATE TYPE agent_status AS ENUM ('active', 'revoked');

-- Event types enum
CREATE TYPE event_type AS ENUM (
  'input_received',
  'decision_made',
  'tool_call_requested',
  'tool_call_result',
  'response_emitted',
  'memory_created',
  'memory_updated',
  'capability_granted',
  'capability_revoked',
  'policy_violation',
  'error_occurred',
  'system_event'
);

-- Capability status enum
CREATE TYPE capability_status AS ENUM ('active', 'expired', 'revoked');

-- Memory kind enum
CREATE TYPE memory_kind AS ENUM (
  'fact',
  'belief',
  'preference',
  'goal',
  'pattern',
  'relationship'
);

-- Outcome types enum
CREATE TYPE outcome_type AS ENUM (
  'success',
  'partial_success',
  'failure',
  'user_corrected',
  'harmful'
);

-- ============================================================
-- AGENTS TABLE
-- ============================================================
CREATE TABLE agents (
  agent_id CHAR(64) PRIMARY KEY, -- SHA-256 hash of public key
  public_key TEXT NOT NULL UNIQUE,
  name VARCHAR(255),
  owner VARCHAR(255),
  status agent_status NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_agent_id CHECK (length(agent_id) = 64),
  CONSTRAINT valid_public_key CHECK (length(public_key) = 64),
  CONSTRAINT revoked_at_only_when_revoked CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL) OR
    (status != 'revoked' AND revoked_at IS NULL)
  )
);

CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_owner ON agents(owner);

-- ============================================================
-- EVENTS TABLE (Append-only ledger)
-- ============================================================
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  agent_id CHAR(64) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prev_hash CHAR(64), -- SHA-256 of previous event (null for first event)
  hash CHAR(64) NOT NULL UNIQUE, -- SHA-256 of this event
  payload JSONB NOT NULL DEFAULT '{}',
  signature TEXT NOT NULL, -- Ed25519 signature
  correlation_id UUID, -- Group related events

  -- Constraints
  CONSTRAINT valid_hash CHECK (length(hash) = 64),
  CONSTRAINT valid_prev_hash CHECK (prev_hash IS NULL OR length(prev_hash) = 64)
);

-- Indexes for querying
CREATE INDEX idx_events_agent_id ON events(agent_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_correlation_id ON events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX idx_events_hash ON events(hash);
CREATE INDEX idx_events_prev_hash ON events(prev_hash) WHERE prev_hash IS NOT NULL;

-- Composite index for agent chain verification
CREATE INDEX idx_events_agent_chain ON events(agent_id, timestamp ASC);

-- ============================================================
-- APPEND-ONLY ENFORCEMENT (Critical for immutability)
-- ============================================================

-- Prevent updates to events
CREATE OR REPLACE FUNCTION prevent_event_updates()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Events table is append-only. Updates are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_event_updates
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_event_updates();

-- Prevent deletes from events (except CASCADE from agent deletion)
CREATE OR REPLACE FUNCTION prevent_event_deletes()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow deletes only if triggered by CASCADE from agents table
  IF (TG_OP = 'DELETE') THEN
    -- This will be called for CASCADE deletes, we allow those
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Direct deletion from events table is not allowed.';
END;
$$ LANGUAGE plpgsql;

-- Note: We don't create a DELETE trigger because CASCADE deletes are necessary
-- when an agent is removed. Instead, rely on application-level access control.

-- ============================================================
-- CAPABILITIES TABLE
-- ============================================================
CREATE TABLE capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id CHAR(64) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  scope JSONB NOT NULL, -- e.g., {"tool:web.read": true, "tool:wallet.send": {"max_value": 100}}
  issued_by VARCHAR(255) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status capability_status NOT NULL DEFAULT 'active',
  token_hash CHAR(64) NOT NULL UNIQUE, -- SHA-256 of bearer token
  revoked_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT valid_expiration CHECK (expires_at > issued_at),
  CONSTRAINT expired_or_active CHECK (
    (status = 'expired' AND expires_at < NOW()) OR
    (status = 'revoked' AND revoked_at IS NOT NULL) OR
    (status = 'active')
  )
);

CREATE INDEX idx_capabilities_agent_id ON capabilities(agent_id);
CREATE INDEX idx_capabilities_status ON capabilities(status);
CREATE INDEX idx_capabilities_token_hash ON capabilities(token_hash);
CREATE INDEX idx_capabilities_expires_at ON capabilities(expires_at);

-- ============================================================
-- MEMORIES TABLE
-- ============================================================
CREATE TABLE memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id CHAR(64) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  kind memory_kind NOT NULL,
  content TEXT NOT NULL,
  content_hash CHAR(64) NOT NULL, -- SHA-256 for deduplication
  source_events UUID[] DEFAULT '{}', -- Array of event IDs that produced this memory
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.0, -- 0.00 to 1.00
  active BOOLEAN NOT NULL DEFAULT true,
  superseded_by UUID REFERENCES memories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_confidence CHECK (confidence >= 0 AND confidence <= 1),
  CONSTRAINT not_self_superseding CHECK (superseded_by IS NULL OR superseded_by != id)
);

CREATE INDEX idx_memories_agent_id ON memories(agent_id);
CREATE INDEX idx_memories_kind ON memories(kind);
CREATE INDEX idx_memories_active ON memories(active) WHERE active = true;
CREATE INDEX idx_memories_content_hash ON memories(content_hash);
CREATE INDEX idx_memories_confidence ON memories(confidence DESC);

-- ============================================================
-- OUTCOMES TABLE
-- ============================================================
CREATE TABLE outcomes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id CHAR(64) NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  outcome_type outcome_type NOT NULL,
  reporter VARCHAR(255) NOT NULL, -- 'user', 'agent', 'system'
  impact_score NUMERIC(3,2) NOT NULL, -- -1.00 to 1.00
  details TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_impact_score CHECK (impact_score >= -1 AND impact_score <= 1)
);

CREATE INDEX idx_outcomes_agent_id ON outcomes(agent_id);
CREATE INDEX idx_outcomes_event_id ON outcomes(event_id);
CREATE INDEX idx_outcomes_outcome_type ON outcomes(outcome_type);
CREATE INDEX idx_outcomes_timestamp ON outcomes(timestamp DESC);

-- ============================================================
-- REPUTATION TABLE
-- ============================================================
CREATE TABLE reputation (
  agent_id CHAR(64) PRIMARY KEY REFERENCES agents(agent_id) ON DELETE CASCADE,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 50.0, -- 0.00 to 100.00
  total_actions INTEGER NOT NULL DEFAULT 0,
  success_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0, -- 0.0000 to 1.0000
  failure_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0,
  harmful_actions INTEGER NOT NULL DEFAULT 0,
  user_corrections INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB DEFAULT '{}', -- Per-domain scores: {"tool_reliability": 0.95, "memory_accuracy": 0.88}
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_overall_score CHECK (overall_score >= 0 AND overall_score <= 100),
  CONSTRAINT valid_success_rate CHECK (success_rate >= 0 AND success_rate <= 1),
  CONSTRAINT valid_failure_rate CHECK (failure_rate >= 0 AND failure_rate <= 1),
  CONSTRAINT valid_counts CHECK (
    total_actions >= 0 AND
    harmful_actions >= 0 AND
    user_corrections >= 0
  )
);

CREATE INDEX idx_reputation_overall_score ON reputation(overall_score DESC);
CREATE INDEX idx_reputation_last_updated ON reputation(last_updated DESC);

-- ============================================================
-- POLICIES TABLE
-- ============================================================
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  applies_to TEXT[] NOT NULL, -- e.g., ['tool:wallet.send', 'tool:x.post']
  rules JSONB NOT NULL, -- Policy rules definition
  violations_config JSONB NOT NULL DEFAULT '{"action": "block", "log": true}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_policies_active ON policies(active) WHERE active = true;
CREATE INDEX idx_policies_policy_id ON policies(policy_id);

-- ============================================================
-- AUTOMATIC REPUTATION INITIALIZATION
-- ============================================================

-- Trigger to initialize reputation when agent is created
CREATE OR REPLACE FUNCTION init_agent_reputation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO reputation (agent_id, overall_score, total_actions)
  VALUES (NEW.agent_id, 50.0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_reputation_init
  AFTER INSERT ON agents
  FOR EACH ROW
  EXECUTE FUNCTION init_agent_reputation();

-- ============================================================
-- VIEWS FOR CONVENIENCE
-- ============================================================

-- Active agents with reputation
CREATE VIEW active_agents_with_reputation AS
SELECT
  a.agent_id,
  a.public_key,
  a.name,
  a.owner,
  a.created_at,
  r.overall_score,
  r.total_actions,
  r.success_rate,
  r.failure_rate
FROM agents a
LEFT JOIN reputation r ON a.agent_id = r.agent_id
WHERE a.status = 'active';

-- Recent events with agent info
CREATE VIEW recent_events AS
SELECT
  e.id,
  e.agent_id,
  a.name as agent_name,
  e.event_type,
  e.timestamp,
  e.payload,
  e.correlation_id
FROM events e
JOIN agents a ON e.agent_id = a.agent_id
ORDER BY e.timestamp DESC
LIMIT 1000;

-- Active capabilities
CREATE VIEW active_capabilities AS
SELECT
  c.id,
  c.agent_id,
  a.name as agent_name,
  c.scope,
  c.issued_by,
  c.issued_at,
  c.expires_at
FROM capabilities c
JOIN agents a ON c.agent_id = a.agent_id
WHERE c.status = 'active' AND c.expires_at > NOW();

-- ============================================================
-- GRANT PERMISSIONS (adjust as needed for your user)
-- ============================================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO trust;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO trust;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO trust;
