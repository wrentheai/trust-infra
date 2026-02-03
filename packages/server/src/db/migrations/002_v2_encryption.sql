-- V2 Migration: Encrypted memories with owner visibility
-- Date: 2026-02-03

-- Add owner table for key management
CREATE TABLE IF NOT EXISTS owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,  -- X25519 public key (base64)
  key_hash CHAR(64) NOT NULL,  -- Hash of public key for verification
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id)
);

-- Add encryption fields to events (for memory_created events)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ciphertext TEXT,
ADD COLUMN IF NOT EXISTS nonce TEXT;

-- Sensitivity levels for sharing decisions
CREATE TYPE sensitivity_level AS ENUM ('low', 'medium', 'high', 'secret');

-- Add sensitivity to memories
ALTER TABLE memories
ADD COLUMN IF NOT EXISTS sensitivity sensitivity_level DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS ciphertext TEXT,
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS subject TEXT;

-- Sharing policies configured by owner
CREATE TABLE IF NOT EXISTS sharing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  
  -- Default behavior
  default_sharing TEXT NOT NULL DEFAULT 'deny_all' CHECK (default_sharing IN ('allow_low', 'ask', 'deny_all')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trusted agents list
CREATE TABLE IF NOT EXISTS trusted_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES sharing_policies(id) ON DELETE CASCADE,
  trusted_agent_id UUID NOT NULL,  -- The agent being trusted
  trust_level TEXT NOT NULL DEFAULT 'limited' CHECK (trust_level IN ('full', 'limited', 'none')),
  allowed_categories TEXT[],  -- Categories this agent can access
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Category-specific sharing rules
CREATE TABLE IF NOT EXISTS category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES sharing_policies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  default_share BOOLEAN NOT NULL DEFAULT FALSE,
  require_context BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(policy_id, category)
);

-- Query audit log
CREATE TABLE IF NOT EXISTS query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_agent_id UUID NOT NULL REFERENCES agents(agent_id),
  requester_agent_id UUID NOT NULL,
  requester_signature TEXT NOT NULL,
  
  -- Query details
  query_type TEXT NOT NULL CHECK (query_type IN ('specific', 'category', 'about')),
  query_subject TEXT,
  query_category TEXT,
  query_question TEXT,
  query_context TEXT,
  
  -- Response
  response_status TEXT NOT NULL CHECK (response_status IN ('answered', 'declined', 'partial', 'unknown', 'pending')),
  response_reason TEXT,
  facts_shared UUID[],  -- IDs of facts that were shared
  
  queried_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_query_log_target ON query_log(target_agent_id);
CREATE INDEX IF NOT EXISTS idx_query_log_requester ON query_log(requester_agent_id);
CREATE INDEX IF NOT EXISTS idx_query_log_queried_at ON query_log(queried_at);
CREATE INDEX IF NOT EXISTS idx_memories_subject ON memories(subject);
CREATE INDEX IF NOT EXISTS idx_memories_sensitivity ON memories(sensitivity);
