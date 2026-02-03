# Trust Infrastructure v1 - Project Overview

## What is This?

Trust Infrastructure is a **cryptographic trust system** for AI agents. It provides:

1. **Tamper-proof audit trails** - Every agent action is cryptographically signed and linked in a hash chain
2. **Verifiable behavior** - Anyone can verify an agent's event chain to ensure no tampering
3. **Reputation tracking** - Automatic scoring based on outcomes and user feedback
4. **Fine-grained permissions** - Capability tokens with scoped access and expiration

## Why Does This Matter?

As AI agents become more autonomous, we need ways to:
- **Trust but verify** - Agents can prove what they did
- **Hold agents accountable** - Immutable record of all actions
- **Grant limited permissions** - Scoped capabilities, not full access
- **Track reliability** - Reputation scores gate autonomy levels

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      AI Agent (OpenClaw)                     │
│                  Uses @trust-infra/client                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ REST API (HTTPS)
                         │ Ed25519 signatures
                         ↓
┌─────────────────────────────────────────────────────────────┐
│               Trust Infrastructure Service                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Fastify Server                                     │   │
│  │  • Signature verification                           │   │
│  │  • Hash chain validation                            │   │
│  │  • Rate limiting                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Services (Business Logic)                          │   │
│  │  • AgentService                                     │   │
│  │  • EventService                                     │   │
│  │  • CapabilityService                                │   │
│  │  • ReputationService                                │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Repositories (Data Access)                         │   │
│  │  • Drizzle ORM                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  • Append-only events table (triggers prevent updates)      │
│  • Hash chain integrity                                     │
│  • JSONB for flexible metadata                              │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Agent Registration

```typescript
// Generate Ed25519 keypair
const identity = await generateAgentIdentity();

// Register with trust service
const agent = await registerAgent({
  publicKey: identity.publicKey,
  name: "MyAgent",
});

// agent_id = sha256(public_key) - deterministic
```

### 2. Event Logging

Every agent action becomes a signed event:

```typescript
const client = new TrustClient({ agentId, privateKey, publicKey });

// Log input
await client.logInput("User asked about weather");

// Log decision
await client.logDecision("Call weather API", "User needs current data");

// Log tool call
await client.logToolCall("weather-api", { city: "SF" });

// Log result
await client.logToolResult("weather-api", "success", { temp: 72 });

// Log response
await client.logResponse({
  summary: "Provided weather info",
  riskLevel: "low"
});
```

### 3. Cryptographic Signing

Each event is:
1. **Hashed**: SHA-256 of canonical JSON
2. **Signed**: Ed25519 signature with private key
3. **Linked**: `prev_hash` points to previous event
4. **Verified**: Server checks signature before accepting

```
Event 1: hash=abc..., prev_hash=null, signature=XYZ...
         ↓
Event 2: hash=def..., prev_hash=abc..., signature=UVW...
         ↓
Event 3: hash=ghi..., prev_hash=def..., signature=RST...
```

### 4. Chain Verification

Anyone can verify the chain:

```bash
curl -X POST http://localhost:3000/api/events/verify-chain \
  -H "Content-Type: application/json" \
  -d '{"agentId":"550e8400-..."}'

# Returns:
{
  "valid": true,
  "totalEvents": 1234,
  "errors": []
}
```

### 5. Capabilities

Grant scoped permissions:

```typescript
// Mint capability
const capability = await mintCapability({
  agentId: "550e8400-...",
  scope: {
    "tool:web.read": true,
    "tool:wallet.send": {
      "max_value": 100,
      "max_per_hour": 5
    }
  },
  expiresAt: new Date("2026-03-01")
});

// Check permission before tool use
const permission = await checkPermission(agentId, "tool:wallet.send");
if (!permission.allowed) {
  throw new Error("Not authorized");
}
```

### 6. Reputation

Track reliability over time:

```typescript
// Record outcome
await recordOutcome({
  agentId: "550e8400-...",
  eventId: 12345,
  outcomeType: "success", // or failure, user_corrected, harmful
  reporter: "user"
});

// Check reputation
const reputation = await getReputation(agentId);
// {
//   overallScore: 72.5,
//   successRate: 0.867,
//   totalActions: 150
// }

// Auto-downgrade if score too low
if (reputation.overallScore < 20) {
  await revokeAllCapabilities(agentId);
}
```

## Key Components

### @trust-infra/crypto

Core cryptographic primitives:
- Ed25519 key generation
- Event signing and verification
- Hash chain building
- Canonical JSON (RFC 8785)
- Encrypted keystores

### @trust-infra/client

TypeScript SDK for agents:
- `TrustClient` class
- Auto-signing of events
- Chain management
- Helper methods (`logInput()`, `logResponse()`, etc.)

### @trust-infra/server

REST API service:
- Agent registration
- Event ledger
- Capability management
- Reputation tracking
- Public verification

## File Count

- **38 TypeScript files** (excluding tests)
- **3 test files** with comprehensive coverage
- **1 SQL migration** with complete schema
- **5 documentation files** (README, API, SETUP, QUICKSTART, guides)
- **1 example** script
- **1 setup** script

## Technology Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js 20+ | Modern, fast, great ecosystem |
| Language | TypeScript | Type safety, better DX |
| Framework | Fastify | High performance, TypeScript-first |
| Database | PostgreSQL 16 | ACID, JSONB, triggers |
| ORM | Drizzle | Lightweight, SQL control |
| Crypto | @noble/ed25519 | Pure JS, audited, fast |
| Deployment | Docker | Portable, reproducible |

## Security Model

### Threats Mitigated

1. **Event Tampering** ✓
   - Hash chain breaks if any event modified
   - Database triggers prevent updates/deletes

2. **Replay Attacks** ✓
   - Timestamp validation (5-minute window)
   - Signature includes timestamp

3. **Unauthorized Access** ✓
   - Service key for admin operations
   - Agent signatures for event submission

4. **Capability Abuse** ✓
   - Scoped permissions
   - Expiration enforcement
   - Instant revocation

5. **Low Reputation Agents** ✓
   - Automatic downgrade thresholds
   - Circuit breakers (future)

### Not Yet Mitigated

- **DDoS**: Rate limiting helps, but consider Cloudflare
- **Key Compromise**: No key rotation yet (v1.1)
- **Privacy**: Events are public (zero-knowledge in v2.0)

## Performance

Expected performance (local testing):

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Event append | ~50ms | ~20 events/sec/agent |
| Chain verify (1000 events) | ~200ms | - |
| Query events | ~10ms | ~100 queries/sec |
| Signature gen | ~2ms | ~500 signs/sec |

Bottlenecks:
- Database writes (events table)
- Signature verification (CPU-bound)

Scaling:
- Read replicas for queries
- Connection pooling (configured)
- Caching for hot agents (future)

## Integration Example

For OpenClaw or other agent systems:

```typescript
// 1. Setup (one-time)
const identity = await generateAgentIdentity();
await registerAgent(identity);
saveKeystoreToFile(identity);

// 2. Runtime (per session)
const client = new TrustClient({
  baseUrl: process.env.TRUST_SERVICE_URL,
  ...loadKeystoreFromFile(),
});

await client.init();

// 3. Wrap your agent loop
async function agentStep(input: string) {
  const sessionId = crypto.randomUUID();

  // Log input
  await client.logInput(input, sessionId);

  // Make decision
  const decision = await yourAI.decide(input);
  await client.logDecision(decision.action, decision.reasoning, sessionId);

  // Execute with capability check
  if (decision.action === "send-money") {
    const permission = await client.checkPermission("tool:wallet.send");
    if (!permission.allowed) {
      throw new Error("Not authorized");
    }
  }

  // Execute action
  await client.logToolCall(decision.tool, decision.args, sessionId);
  const result = await executeTool(decision.tool, decision.args);
  await client.logToolResult(decision.tool, result.status, result.data, sessionId);

  // Log response
  await client.logResponse({
    summary: result.summary,
    riskLevel: assessRisk(result),
    correlationId: sessionId,
  });

  return result;
}

// 4. Periodically verify integrity
setInterval(async () => {
  const verification = await client.verifyChain();
  if (!verification.valid) {
    alert("CHAIN INTEGRITY COMPROMISED!");
  }
}, 3600000); // Every hour
```

## Deployment Scenarios

### Development

```bash
npm run setup
npm run dev:server
```

### Staging/Production

```bash
# Docker (recommended)
docker-compose up -d

# Or VPS
npm ci --production
npm run build
npm run migrate
npm start
```

### Cloud

- **AWS**: EC2 + RDS PostgreSQL
- **Google Cloud**: Cloud Run + Cloud SQL
- **Azure**: App Service + Database for PostgreSQL
- **Kubernetes**: See SETUP.md for manifests

## What's Next?

### Immediate Use

1. Start the service: `npm run setup && npm run dev:server`
2. Run the example: `npx tsx examples/basic-usage.ts`
3. Integrate with your agent: Import `@trust-infra/client`

### Future Versions

**v1.1** (Next 2-3 months)
- Policy engine with runtime enforcement
- Circuit breakers for repeated violations
- Memory API endpoints
- Key rotation support

**v1.2** (Next 4-6 months)
- WebSocket real-time event streaming
- Public verification dashboard (web UI)
- IPFS/Arweave archival storage
- Prometheus/Grafana monitoring

**v2.0** (Next 8-12 months)
- Multi-agent coordination
- Zero-knowledge proofs for privacy
- Decentralized deployment (blockchain anchoring)
- Cross-chain verification

## Resources

| Document | Purpose |
|----------|---------|
| [QUICKSTART.md](./QUICKSTART.md) | 5-minute setup guide |
| [README.md](./README.md) | Main documentation |
| [API.md](./API.md) | Complete API reference |
| [SETUP.md](./SETUP.md) | Deployment guide |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Technical checklist |

## Support

- **Issues**: File on GitHub
- **Questions**: Check documentation first
- **Contributions**: PRs welcome!
- **Commercial**: Contact for enterprise support

---

**Built for trustworthy AI agents. Open source. Production-ready.** 🚀
