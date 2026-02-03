# Quick Start Guide

Get Trust Infrastructure up and running in 5 minutes.

## Prerequisites

- Node.js 20+
- Docker (or local PostgreSQL 16+)

## Automatic Setup

```bash
cd trust-infra

# Run automated setup script
npm run setup
```

This will:
1. ✓ Check prerequisites
2. ✓ Install dependencies
3. ✓ Create .env with secure keys
4. ✓ Start PostgreSQL (Docker)
5. ✓ Build packages
6. ✓ Run migrations

## Manual Setup

If you prefer manual setup:

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env

# 3. Start PostgreSQL
docker-compose up -d postgres

# 4. Build packages
npm run build

# 5. Run migrations
npm run migrate
```

## Start the Server

```bash
npm run dev:server
```

Server will start at `http://localhost:3000`.

## Run the Example

In a new terminal:

```bash
npx tsx examples/basic-usage.ts
```

You should see:
```
🚀 Trust Infrastructure Basic Usage Example

📝 Generating agent identity...
✅ Agent ID: abc123...
🔐 Registering agent with trust service...
✅ Agent registered successfully
📊 Logging events...
✅ Logged input_received (event 1)
✅ Logged decision_made (event 2)
...
🔐 Verifying event chain...
✅ Chain is valid!
🎉 Example completed successfully!
```

## Test the API

```bash
# Health check
curl http://localhost:3000/health

# List agents
curl http://localhost:3000/api/agents

# Verify a chain
curl -X POST http://localhost:3000/api/events/verify-chain \
  -H "Content-Type: application/json" \
  -d '{"agentId":"your-agent-id"}'
```

## Use the Client SDK

```typescript
import { TrustClient } from '@trust-infra/client';
import { generateAgentIdentity } from '@trust-infra/crypto';

// Generate identity
const identity = await generateAgentIdentity();

// Create client
const client = new TrustClient({
  baseUrl: 'http://localhost:3000',
  agentId: identity.agentId,
  privateKey: identity.privateKey,
  publicKey: identity.publicKey,
});

await client.init();

// Log events
const sessionId = crypto.randomUUID();
await client.logInput('User input', sessionId);
await client.logResponse({
  summary: 'Agent response',
  correlationId: sessionId,
});

// Verify chain
const verification = await client.verifyChain();
console.log('Valid:', verification.valid);
```

## Docker Commands

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop all services
npm run docker:down
```

## Next Steps

1. **Read the docs**: [README.md](./README.md), [API.md](./API.md)
2. **Explore examples**: Check `examples/basic-usage.ts`
3. **Run tests**: `npm test`
4. **Integrate**: Add `@trust-infra/client` to your agent

## Common Issues

### Port 3000 already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection failed
```bash
docker-compose restart postgres
npm run migrate
```

### Events not verifying
Check that the agent is registered and active:
```bash
curl http://localhost:3000/api/agents/your-agent-id
```

## Need Help?

- 📚 [Full Documentation](./README.md)
- 🔧 [Setup Guide](./SETUP.md)
- 🌐 [API Reference](./API.md)
- 📝 [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

Happy building! 🚀
