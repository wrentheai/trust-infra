# Trust Infrastructure v1

Cryptographic trust infrastructure for AI agents providing:
- **Append-only audit trails** with Ed25519 signatures and hash chains
- **Capability-based permissions** with scoped, expiring tokens
- **Memory provenance tracking** with confidence scores
- **Reputation system** based on outcomes and user corrections

## Features

- 🔒 **Cryptographically Signed Events**: Every agent action is signed with Ed25519
- ⛓️ **Hash Chain Integrity**: Events are linked in a tamper-evident chain
- 🔐 **Capability Tokens**: Fine-grained, expiring permissions
- 📊 **Reputation Tracking**: Automatic scoring based on outcomes
- 🚫 **Immutable Ledger**: Database-enforced append-only events
- 🔍 **Public Verification**: Anyone can audit event chains
- 🚀 **High Performance**: Built on Fastify with PostgreSQL

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Docker (optional)

### Installation

```bash
# Clone the repository
cd trust-infra

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL (via Docker)
docker-compose up -d postgres

# Run migrations
npm run migrate

# Start development server
npm run dev:server
```

The server will start at `http://localhost:3000`.

### Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f trust-service

# Stop services
docker-compose down
```

## Project Structure

```
trust-infra/
├── packages/
│   ├── crypto/          # Core cryptographic library
│   ├── client/          # TypeScript SDK
│   └── server/          # REST API service
├── migrations/          # Database migrations
├── docker-compose.yml   # Docker setup
└── README.md
```

## Usage

### 1. Register an Agent

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "X-Service-Key: dev-service-key-change-in-production" \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "a1b2c3...",
    "name": "MyAgent",
    "owner": "user@example.com"
  }'
```

### 2. Use the Client SDK

```typescript
import { TrustClient } from '@trust-infra/client';
import { generateAgentIdentity } from '@trust-infra/crypto';

// Generate agent identity
const identity = await generateAgentIdentity();

// Create client
const client = new TrustClient({
  baseUrl: 'http://localhost:3000',
  agentId: identity.agentId,
  privateKey: identity.privateKey,
  publicKey: identity.publicKey,
});

// Initialize (fetch last event hash)
await client.init();

// Log events
const sessionId = crypto.randomUUID();

await client.logInput('User asked about weather', sessionId);
await client.logDecision('Fetch weather data', 'User needs current conditions', sessionId);
await client.logToolCall('weather-api', { city: 'SF' }, sessionId);
await client.logToolResult('weather-api', 'success', { temp: 72 }, sessionId);
await client.logResponse({
  summary: 'Provided weather information',
  riskLevel: 'low',
  correlationId: sessionId,
});

// Verify chain integrity
const verification = await client.verifyChain();
console.log('Chain valid:', verification.valid);

// Check reputation
const reputation = await client.getReputation();
console.log('Overall score:', reputation.overallScore);
```

## API Documentation

### Authentication

**Service Key** (for admin operations):
```
X-Service-Key: your-service-key
```

**Agent Signature** (for agent operations):
```
X-Agent-Id: agent-uuid
X-Timestamp: unix-timestamp
X-Signature: ed25519-signature
```

### Endpoints

#### Agents

- `POST /api/agents` - Register agent (service key)
- `GET /api/agents` - List agents
- `GET /api/agents/:id` - Get agent details
- `POST /api/agents/:id/revoke` - Revoke agent (service key)

#### Events

- `POST /api/events` - Append event (agent signature)
- `GET /api/events` - Query events
- `GET /api/events/last-hash/:agentId` - Get last event hash
- `POST /api/events/verify-chain` - Verify chain integrity

#### Capabilities

- `POST /api/capabilities` - Mint capability (service key)
- `GET /api/capabilities` - List capabilities
- `POST /api/capabilities/validate` - Validate token
- `POST /api/capabilities/:id/revoke` - Revoke capability (service key)

#### Reputation

- `GET /api/reputation/:agentId` - Get reputation
- `GET /api/reputation` - List all reputations
- `POST /api/outcomes` - Record outcome (service key)

See [API.md](./API.md) for complete documentation.

## Security

### Key Management

**NEVER** commit private keys to version control. Use encrypted keystores:

```typescript
import { encryptKeystore, decryptKeystore } from '@trust-infra/crypto';

// Encrypt private key
const keystore = await encryptKeystore(
  privateKey,
  agentId,
  'strong-password'
);

// Save keystore.json (safe to commit)
fs.writeFileSync('agent.keystore', JSON.stringify(keystore));

// Later, decrypt
const privateKey = await decryptKeystore(keystore, 'strong-password');
```

### Signature Verification

All agent operations require Ed25519 signatures:

1. Build payload: `METHOD:PATH:BODY:TIMESTAMP`
2. Sign with private key
3. Include in `X-Signature` header
4. Server verifies before processing

### Hash Chain Integrity

Events are linked via SHA-256 hashes:

```
Event 1: prev_hash=null, hash=abc123...
Event 2: prev_hash=abc123..., hash=def456...
Event 3: prev_hash=def456..., hash=ghi789...
```

Tampering breaks the chain and is immediately detectable.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests for specific package
npm test -w @trust-infra/crypto
```

## Configuration

Environment variables (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://trust:password@localhost:5432/trust_infra

# Server
PORT=3000
NODE_ENV=production

# Auth
SERVICE_API_KEY=your-secret-key
SIGNATURE_TIMESTAMP_WINDOW=300

# Rate Limiting
RATE_LIMIT_MAX=100
```

## Database Schema

Key tables:

- **agents**: Registered agents with public keys
- **events**: Append-only audit trail (update/delete triggers prevent modification)
- **capabilities**: Permission tokens
- **memories**: Agent memories with provenance
- **outcomes**: Outcome records for reputation
- **reputation**: Aggregate reputation scores

See [migrations/0001_initial_schema.sql](./migrations/0001_initial_schema.sql) for complete schema.

## Architecture

```
┌─────────────────────┐
│   Client (Agent)    │
│   Uses @trust-infra │
│   /client SDK       │
└──────────┬──────────┘
           │ HTTPS/REST
           ↓
┌─────────────────────┐
│   Fastify Server    │
│  ├─ Auth Middleware │
│  ├─ API Routes      │
│  ├─ Services        │
│  ├─ Repositories    │
│  └─ Drizzle ORM     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   PostgreSQL 16     │
│  ├─ Append-only     │
│  │   enforcement    │
│  └─ Hash chain      │
│     validation      │
└─────────────────────┘
```

## Performance

Benchmarks on modest hardware (M1 Mac, local PostgreSQL):

- Event append: ~50ms (includes signature verification)
- Chain verification (1000 events): ~200ms
- Query events: ~10ms
- Signature generation: ~2ms

## Roadmap

### v1.1
- [ ] Policy engine for runtime enforcement
- [ ] Circuit breakers for repeated violations
- [ ] Memory supersession support

### v1.2
- [ ] WebSocket support for real-time events
- [ ] IPFS/Arweave integration for archival
- [ ] Public verification dashboard

### v2.0
- [ ] Multi-agent coordination
- [ ] Zero-knowledge proofs for privacy
- [ ] Decentralized deployment

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Issues: https://github.com/your-org/trust-infra/issues
- Docs: https://docs.trust-infra.dev
- Discord: https://discord.gg/trust-infra

---

Built with ❤️ for trustworthy AI agents
