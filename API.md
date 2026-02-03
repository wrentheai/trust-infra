# Trust Infrastructure API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

### Service Key Authentication

Used for administrative operations (registering agents, minting capabilities, recording outcomes).

**Header:**
```
X-Service-Key: your-service-api-key
```

### Agent Signature Authentication

Used for agent operations (appending events).

**Headers:**
```
X-Agent-Id: agent-uuid
X-Timestamp: unix-timestamp-seconds
X-Signature: ed25519-signature-hex
```

**Signature Payload:**
```
METHOD:PATH:BODY:TIMESTAMP
```

**Example:**
```
POST:/api/events:{"agentId":"123","eventType":"input_received",...}:1704067200
```

## Agents

### Register Agent

Register a new agent with Ed25519 public key.

**Endpoint:** `POST /api/agents`
**Auth:** Service Key

**Request Body:**
```json
{
  "publicKey": "a1b2c3d4e5f6...", // 64 hex chars
  "name": "MyAgent",
  "owner": "user@example.com",
  "metadata": {
    "version": "1.0.0",
    "description": "My autonomous agent"
  }
}
```

**Response:** `201 Created`
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "a1b2c3d4e5f6...",
  "name": "MyAgent",
  "owner": "user@example.com",
  "status": "active",
  "metadata": {...},
  "createdAt": "2026-02-03T10:00:00Z",
  "revokedAt": null
}
```

### List Agents

List all registered agents with optional filtering.

**Endpoint:** `GET /api/agents`
**Auth:** None

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `revoked`)
- `owner` (optional): Filter by owner

**Response:** `200 OK`
```json
{
  "agents": [...],
  "count": 10
}
```

### Get Agent

Get details for a specific agent.

**Endpoint:** `GET /api/agents/:id`
**Auth:** None

**Response:** `200 OK`
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "a1b2c3d4e5f6...",
  "name": "MyAgent",
  "status": "active",
  ...
}
```

### Revoke Agent

Revoke an agent's access.

**Endpoint:** `POST /api/agents/:id/revoke`
**Auth:** Service Key

**Request Body:**
```json
{
  "reason": "Security policy violation"
}
```

**Response:** `200 OK`
```json
{
  "agentId": "...",
  "status": "revoked",
  "revokedAt": "2026-02-03T10:30:00Z",
  ...
}
```

## Events

### Append Event

Append a new event to the ledger (requires valid signature and hash chain).

**Endpoint:** `POST /api/events`
**Auth:** Agent Signature

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "response_emitted",
  "timestamp": "2026-02-03T10:00:00Z",
  "payload": {
    "summary": "Posted tweet",
    "risk_level": "low"
  },
  "correlationId": "session-uuid",
  "hash": "abc123def456...",
  "signature": "ed25519-signature-hex"
}
```

**Event Types:**
- `input_received`
- `decision_made`
- `tool_call_requested`
- `tool_call_result`
- `response_emitted`
- `memory_created`
- `memory_updated`
- `capability_granted`
- `capability_revoked`
- `policy_violation`
- `error_occurred`
- `system_event`

**Response:** `201 Created`
```json
{
  "id": 12345,
  "agentId": "...",
  "eventType": "response_emitted",
  "timestamp": "2026-02-03T10:00:00Z",
  "prevHash": "previous-hash",
  "hash": "abc123def456...",
  "payload": {...},
  "signature": "...",
  "correlationId": "session-uuid"
}
```

### Query Events

Query events with filtering and pagination.

**Endpoint:** `GET /api/events`
**Auth:** None

**Query Parameters:**
- `agentId` (optional): Filter by agent
- `eventType` (optional): Filter by event type
- `correlationId` (optional): Filter by correlation ID
- `since` (optional): Filter by timestamp (ISO 8601)
- `until` (optional): Filter by timestamp (ISO 8601)
- `limit` (optional): Max results (default: 100)
- `offset` (optional): Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "events": [...],
  "count": 50,
  "total": 1234
}
```

### Get Last Event Hash

Get the last event hash for an agent (used for chain building).

**Endpoint:** `GET /api/events/last-hash/:agentId`
**Auth:** None

**Response:** `200 OK`
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "lastHash": "abc123def456..." // null if no events
}
```

### Verify Event Chain

Verify the integrity of an agent's event chain.

**Endpoint:** `POST /api/events/verify-chain`
**Auth:** None

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "errors": [],
  "totalEvents": 1234,
  "firstInvalidEvent": null
}
```

If invalid:
```json
{
  "valid": false,
  "errors": [
    "Event 42: Hash mismatch",
    "Event 43: prev_hash mismatch"
  ],
  "totalEvents": 1234,
  "firstInvalidEvent": 42
}
```

### Get Event

Get a specific event by ID.

**Endpoint:** `GET /api/events/:id`
**Auth:** None

**Response:** `200 OK`
```json
{
  "id": 12345,
  "agentId": "...",
  "eventType": "response_emitted",
  ...
}
```

## Capabilities

### Mint Capability

Create a new capability token with scoped permissions.

**Endpoint:** `POST /api/capabilities`
**Auth:** Service Key

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "scope": {
    "tool:web.read": true,
    "tool:wallet.send": {
      "max_value": 100,
      "max_per_hour": 5
    }
  },
  "issuedBy": "admin@example.com",
  "expiresAt": "2026-03-03T10:00:00Z"
}
```

**Response:** `201 Created`
```json
{
  "capability": {
    "id": "capability-uuid",
    "agentId": "...",
    "scope": {...},
    "issuedBy": "admin@example.com",
    "issuedAt": "2026-02-03T10:00:00Z",
    "expiresAt": "2026-03-03T10:00:00Z",
    "status": "active",
    "tokenHash": "sha256-hash"
  },
  "token": "64-hex-char-bearer-token"
}
```

**Note:** The `token` is ONLY returned on creation. Store it securely.

### Validate Capability Token

Check if a capability token is valid.

**Endpoint:** `POST /api/capabilities/validate`
**Auth:** None

**Request Body:**
```json
{
  "token": "64-hex-char-bearer-token"
}
```

**Response:** `200 OK`
```json
{
  "valid": true,
  "capability": {
    "id": "capability-uuid",
    "agentId": "...",
    "scope": {...},
    "status": "active",
    "expiresAt": "2026-03-03T10:00:00Z"
  }
}
```

If invalid:
```json
{
  "valid": false,
  "reason": "Token expired"
}
```

### Check Permission

Check if an agent has permission for a specific action.

**Endpoint:** `POST /api/capabilities/check-permission`
**Auth:** None

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "action": "tool:wallet.send"
}
```

**Response:** `200 OK`
```json
{
  "allowed": true,
  "scope": {
    "max_value": 100,
    "max_per_hour": 5
  }
}
```

If not allowed:
```json
{
  "allowed": false,
  "reason": "No capability grants permission for: tool:wallet.send"
}
```

### List Capabilities

List capabilities for an agent.

**Endpoint:** `GET /api/capabilities`
**Auth:** None

**Query Parameters:**
- `agentId` (required): Agent UUID
- `activeOnly` (optional): Filter active only (`true`/`false`, default: `false`)

**Response:** `200 OK`
```json
{
  "capabilities": [...],
  "count": 3
}
```

### Revoke Capability

Revoke a capability token.

**Endpoint:** `POST /api/capabilities/:id/revoke`
**Auth:** Service Key

**Response:** `200 OK`
```json
{
  "id": "capability-uuid",
  "status": "revoked",
  "revokedAt": "2026-02-03T10:30:00Z",
  ...
}
```

## Reputation

### Get Reputation

Get reputation score for an agent.

**Endpoint:** `GET /api/reputation/:agentId`
**Auth:** None

**Response:** `200 OK`
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "overallScore": 72.5,
  "totalActions": 150,
  "successRate": 0.8667,
  "failureRate": 0.1333,
  "harmfulActions": 0,
  "userCorrections": 5,
  "breakdown": {
    "tool_reliability": 0.92,
    "memory_accuracy": 0.88
  },
  "lastUpdated": "2026-02-03T10:00:00Z"
}
```

### List All Reputations

Get all agent reputations sorted by score.

**Endpoint:** `GET /api/reputation`
**Auth:** None

**Response:** `200 OK`
```json
{
  "reputations": [...],
  "count": 25
}
```

### Record Outcome

Record an outcome for an event (updates reputation).

**Endpoint:** `POST /api/outcomes`
**Auth:** Service Key

**Request Body:**
```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "eventId": 12345,
  "outcomeType": "success",
  "reporter": "user",
  "impactScore": 0.5,
  "details": "User confirmed action was correct"
}
```

**Outcome Types:**
- `success`: +0.5 to score
- `partial_success`: +0.2 to score
- `failure`: -0.3 to score
- `user_corrected`: -0.5 to score
- `harmful`: -2.0 to score

**Response:** `201 Created`
```json
{
  "reputation": {
    "agentId": "...",
    "overallScore": 73.0,
    ...
  },
  "message": "Outcome recorded and reputation updated"
}
```

### Update Domain Score

Update a domain-specific reputation score.

**Endpoint:** `POST /api/reputation/:agentId/domain`
**Auth:** Service Key

**Request Body:**
```json
{
  "domain": "tool_reliability",
  "score": 0.95
}
```

**Response:** `200 OK`
```json
{
  "agentId": "...",
  "breakdown": {
    "tool_reliability": 0.95,
    "memory_accuracy": 0.88
  },
  ...
}
```

### Check Downgrade Status

Check if an agent should be downgraded based on reputation.

**Endpoint:** `GET /api/reputation/:agentId/should-downgrade`
**Auth:** None

**Response:** `200 OK`
```json
{
  "shouldDowngrade": false
}
```

If downgrade recommended:
```json
{
  "shouldDowngrade": true,
  "reason": "Overall score too low: 18.5"
}
```

## Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "error": "Validation error",
  "message": "Invalid public key format"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing service API key"
}
```

**404 Not Found:**
```json
{
  "error": "Agent not found",
  "message": "Agent 550e8400-... does not exist"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Try again in 45s",
  "retryAfter": 45
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred"
}
```

## Rate Limits

- Default: 100 requests per minute per IP/agent
- Configurable via environment variables
- Headers included in responses:
  - `X-RateLimit-Limit`: Max requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Max results per page (default: 100, max: 1000)
- `offset`: Number of results to skip (default: 0)

**Response:**
```json
{
  "items": [...],
  "count": 100,
  "total": 1234,
  "limit": 100,
  "offset": 200
}
```

## WebSocket (Future)

Real-time event streaming will be available in v1.2:

```javascript
const ws = new WebSocket('ws://localhost:3000/events/stream');
ws.send(JSON.stringify({ agentId: '...' }));
ws.onmessage = (event) => console.log(event.data);
```

---

For SDK usage examples, see [README.md](./README.md).
