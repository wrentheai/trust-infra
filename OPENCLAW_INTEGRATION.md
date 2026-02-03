# Integrating OpenClaw with Trust Infrastructure

This guide shows you how to connect your OpenClaw agent to the Trust Infrastructure system for cryptographic audit trails and reputation tracking.

## Prerequisites

- Trust Infrastructure server running (http://localhost:3000)
- OpenClaw agent project
- Node.js 20+

## Step 1: Install Trust Client SDK

In your OpenClaw project:

```bash
cd /path/to/openclaw
npm install file:../trust-infra/packages/client
npm install file:../trust-infra/packages/crypto
```

Or if you publish to npm:
```bash
npm install @trust-infra/client @trust-infra/crypto
```

## Step 2: Generate Agent Identity (One-Time Setup)

Create a script to generate and save your agent's cryptographic identity:

```typescript
// scripts/setup-trust.ts
import { generateAgentIdentity, encryptKeystore } from '@trust-infra/crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

async function setupTrustIdentity() {
  console.log('🔐 Generating OpenClaw Trust Identity...\n');

  // Generate identity
  const identity = await generateAgentIdentity();

  console.log('✅ Agent ID:', identity.agentId);
  console.log('✅ Public Key:', identity.publicKey.slice(0, 16) + '...');
  console.log('✅ Private Key:', identity.privateKey.slice(0, 16) + '... (encrypted)\n');

  // Prompt for password
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const password = await new Promise<string>((resolve) => {
    rl.question('Enter password to encrypt keystore: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });

  // Encrypt and save keystore
  const keystore = await encryptKeystore(
    identity.privateKey,
    identity.agentId,
    password
  );

  const configDir = join(process.env.HOME!, '.openclaw');
  const keystorePath = join(configDir, 'trust-keystore.json');

  writeFileSync(keystorePath, JSON.stringify(keystore, null, 2));
  console.log('\n✅ Keystore saved to:', keystorePath);

  // Save agent ID and public key (safe to commit)
  const configPath = join(configDir, 'trust-config.json');
  writeFileSync(configPath, JSON.stringify({
    agentId: identity.agentId,
    publicKey: identity.publicKey,
    trustServiceUrl: process.env.TRUST_SERVICE_URL || 'http://localhost:3000'
  }, null, 2));
  console.log('✅ Config saved to:', configPath);

  console.log('\n📋 Next steps:');
  console.log('1. Register agent with trust service (see below)');
  console.log('2. Add TRUST_KEYSTORE_PASSWORD to your environment');
  console.log('3. Add trust logging to your agent code\n');

  // Print registration curl command
  console.log('Register agent command:');
  console.log(`curl -X POST http://localhost:3000/api/agents \\
  -H "X-Service-Key: dev-service-key-change-in-production" \\
  -H "Content-Type: application/json" \\
  -d '{
    "publicKey": "${identity.publicKey}",
    "name": "OpenClaw Agent",
    "owner": "your-email@example.com",
    "metadata": {
      "version": "1.0.0",
      "environment": "development"
    }
  }'`);
}

setupTrustIdentity().catch(console.error);
```

Run it:
```bash
npx tsx scripts/setup-trust.ts
```

## Step 3: Register Agent with Trust Service

Use the curl command from step 2, or do it programmatically:

```typescript
// scripts/register-agent.ts
import { readFileSync } from 'fs';
import { join } from 'path';

async function registerAgent() {
  const configPath = join(process.env.HOME!, '.openclaw/trust-config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  const response = await fetch(`${config.trustServiceUrl}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': process.env.SERVICE_API_KEY || 'dev-service-key-change-in-production',
    },
    body: JSON.stringify({
      publicKey: config.publicKey,
      name: 'OpenClaw Agent',
      owner: process.env.USER,
      metadata: {
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Registration failed: ${error.message}`);
  }

  const agent = await response.json();
  console.log('✅ Agent registered:', agent);
}

registerAgent().catch(console.error);
```

## Step 4: Create Trust Client Wrapper

Create a singleton trust client for your OpenClaw agent:

```typescript
// src/lib/trust-client.ts
import { TrustClient } from '@trust-infra/client';
import { decryptKeystore } from '@trust-infra/crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

let trustClient: TrustClient | null = null;

export async function getTrustClient(): Promise<TrustClient> {
  if (trustClient) return trustClient;

  // Load config
  const configPath = join(process.env.HOME!, '.openclaw/trust-config.json');
  const keystorePath = join(process.env.HOME!, '.openclaw/trust-keystore.json');

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));

  // Decrypt private key
  const password = process.env.TRUST_KEYSTORE_PASSWORD;
  if (!password) {
    throw new Error('TRUST_KEYSTORE_PASSWORD not set');
  }

  const privateKey = await decryptKeystore(keystore, password);

  // Create client
  trustClient = new TrustClient({
    baseUrl: config.trustServiceUrl,
    agentId: config.agentId,
    privateKey,
    publicKey: config.publicKey,
  });

  await trustClient.init();
  console.log('✅ Trust client initialized');

  return trustClient;
}

// Helper to safely log events (don't crash on trust errors)
export async function safeLogEvent(
  fn: (client: TrustClient) => Promise<any>
): Promise<void> {
  try {
    const client = await getTrustClient();
    await fn(client);
  } catch (error) {
    console.error('Trust logging failed:', error);
    // Don't crash the agent if trust logging fails
  }
}
```

## Step 5: Add Trust Logging to OpenClaw Agent Loop

Integrate trust logging into your agent's main loop:

```typescript
// src/agent/agent-loop.ts (or similar)
import { getTrustClient, safeLogEvent } from '../lib/trust-client';
import { randomUUID } from 'crypto';

export class OpenClawAgent {
  async processMessage(userInput: string) {
    const sessionId = randomUUID();

    // 1. Log input received
    await safeLogEvent(async (trust) => {
      await trust.logInput(userInput, sessionId);
    });

    try {
      // 2. Your agent processes the input
      const decision = await this.decideAction(userInput);

      // 3. Log decision
      await safeLogEvent(async (trust) => {
        await trust.logDecision(
          decision.action,
          decision.reasoning,
          sessionId
        );
      });

      // 4. Execute action (e.g., tool call)
      await safeLogEvent(async (trust) => {
        await trust.logToolCall(
          decision.tool,
          decision.args,
          sessionId
        );
      });

      const result = await this.executeTool(decision.tool, decision.args);

      // 5. Log tool result
      await safeLogEvent(async (trust) => {
        await trust.logToolResult(
          decision.tool,
          result.success ? 'success' : 'failure',
          result.data,
          sessionId
        );
      });

      // 6. Generate response
      const response = await this.generateResponse(result);

      // 7. Log response
      await safeLogEvent(async (trust) => {
        await trust.logResponse({
          summary: response.summary,
          contentRef: response.reference,
          inputsUsed: [decision.tool, 'memory', 'llm'],
          riskLevel: this.assessRisk(decision),
          expectedOutcome: response.expectedOutcome,
          correlationId: sessionId,
        });
      });

      return response;
    } catch (error) {
      // Log errors
      await safeLogEvent(async (trust) => {
        await trust.appendEvent({
          eventType: 'error_occurred',
          payload: {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          correlationId: sessionId,
        });
      });

      throw error;
    }
  }

  private assessRisk(decision: any): 'low' | 'medium' | 'high' {
    // Your risk assessment logic
    if (decision.tool === 'wallet.send') return 'high';
    if (decision.tool === 'x.post') return 'medium';
    return 'low';
  }
}
```

## Step 6: Add Capability Checks (Optional)

Before executing sensitive actions, check capabilities:

```typescript
// src/agent/capability-checker.ts
import { getTrustClient } from '../lib/trust-client';

export async function checkCapability(action: string): Promise<boolean> {
  try {
    const client = await getTrustClient();
    const capabilities = await client.listCapabilities(true); // active only

    // Check if any capability grants this action
    for (const cap of capabilities) {
      const scope = cap.scope as Record<string, any>;
      if (scope[action] || scope[action.split(':')[0] + ':*']) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Capability check failed:', error);
    return false; // Deny on error
  }
}

// Usage in your agent
async executeSensitiveAction(action: string, args: any) {
  const allowed = await checkCapability(`tool:${action}`);

  if (!allowed) {
    throw new Error(`No capability for: tool:${action}`);
  }

  // Proceed with action
  return this.executeAction(action, args);
}
```

## Step 7: Environment Configuration

Add to your `.env`:

```bash
# Trust Infrastructure
TRUST_SERVICE_URL=http://localhost:3000
TRUST_KEYSTORE_PASSWORD=your-secure-password

# For production
# TRUST_SERVICE_URL=https://trust.yourdomain.com
# SERVICE_API_KEY=your-production-service-key
```

## Step 8: Add to Your Package.json Scripts

```json
{
  "scripts": {
    "setup-trust": "tsx scripts/setup-trust.ts",
    "register-agent": "tsx scripts/register-agent.ts",
    "verify-trust": "tsx scripts/verify-trust.ts"
  }
}
```

## Step 9: Create Verification Script

```typescript
// scripts/verify-trust.ts
import { getTrustClient } from '../src/lib/trust-client';

async function verifyTrust() {
  const client = await getTrustClient();

  console.log('🔐 Verifying Trust Infrastructure integration...\n');

  // Check agent
  const agent = await client.getAgent();
  console.log('✅ Agent:', agent.name, `(${agent.status})`);

  // Check reputation
  const reputation = await client.getReputation();
  console.log('✅ Reputation:', reputation.overallScore);
  console.log('   Total Actions:', reputation.totalActions);
  console.log('   Success Rate:', (Number(reputation.successRate) * 100).toFixed(1) + '%');

  // Verify chain
  const verification = await client.verifyChain();
  console.log('\n🔗 Chain Verification:');
  console.log('   Valid:', verification.valid);
  console.log('   Total Events:', verification.totalEvents);

  if (!verification.valid) {
    console.log('   ⚠️ Errors:', verification.errors.slice(0, 3));
  }

  // List recent events
  const events = await client.queryEvents({
    agentId: client.getLastEventHash() ? undefined : agent.agentId,
    limit: 5,
  });
  console.log('\n📊 Recent Events:', events.length);
  events.forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.eventType} at ${e.timestamp}`);
  });
}

verifyTrust().catch(console.error);
```

## Usage Examples

### Example 1: Twitter Post with Trust Logging

```typescript
async postTweet(content: string) {
  const sessionId = randomUUID();

  // Log decision
  await safeLogEvent(async (trust) => {
    await trust.logDecision(
      'Post tweet',
      `Engaging with community. Content: "${content.slice(0, 50)}..."`,
      sessionId
    );
  });

  // Check capability
  const allowed = await checkCapability('tool:x.post');
  if (!allowed) {
    throw new Error('No capability for tool:x.post');
  }

  // Log tool call
  await safeLogEvent(async (trust) => {
    await trust.logToolCall('x.post', { content }, sessionId);
  });

  // Execute
  const result = await this.twitter.post(content);

  // Log result
  await safeLogEvent(async (trust) => {
    await trust.logToolResult('x.post', 'success', { id: result.id }, sessionId);
  });

  return result;
}
```

### Example 2: Wallet Transaction with Trust

```typescript
async sendTokens(to: string, amount: number) {
  const sessionId = randomUUID();

  // Check capability
  const allowed = await checkCapability('tool:wallet.send');
  if (!allowed) {
    throw new Error('No capability for tool:wallet.send');
  }

  // Log with high risk
  await safeLogEvent(async (trust) => {
    await trust.logDecision(
      `Send ${amount} tokens to ${to}`,
      'User requested token transfer',
      sessionId
    );
  });

  await safeLogEvent(async (trust) => {
    await trust.logToolCall('wallet.send', { to, amount }, sessionId);
  });

  // Execute
  const tx = await this.wallet.send(to, amount);

  // Log result
  await safeLogEvent(async (trust) => {
    await trust.logToolResult(
      'wallet.send',
      'success',
      { txHash: tx.hash, amount, to },
      sessionId
    );

    // Log as high-risk response
    await trust.logResponse({
      summary: `Sent ${amount} tokens`,
      contentRef: `tx:${tx.hash}`,
      riskLevel: 'high',
      expectedOutcome: 'Tokens transferred successfully',
      correlationId: sessionId,
    });
  });

  return tx;
}
```

## Testing Your Integration

1. **Start the trust service**:
   ```bash
   cd trust-infra
   docker-compose up -d
   npm run dev:server
   ```

2. **Setup and register your agent**:
   ```bash
   cd openclaw
   npm run setup-trust
   npm run register-agent
   ```

3. **Run your agent** and watch the events being logged:
   ```bash
   npm run dev
   ```

4. **Verify the integration**:
   ```bash
   npm run verify-trust
   ```

5. **Check events in the trust service**:
   ```bash
   curl http://localhost:3000/api/events?agentId=YOUR_AGENT_ID
   ```

## Production Deployment

For production:

1. **Deploy trust service** to a secure server (see `SETUP.md`)
2. **Use HTTPS** for all trust service communication
3. **Rotate service keys** regularly
4. **Enable capability checks** for all sensitive operations
5. **Monitor reputation scores** and set up alerts
6. **Back up keystores** securely

## Troubleshooting

### "Trust logging failed" errors
- Check `TRUST_KEYSTORE_PASSWORD` is set
- Verify trust service is accessible
- Check network connectivity

### "No capability for: tool:x"
- Mint capabilities for your agent using service key
- Check capability expiration dates
- Verify scope matches the action

### Events not appearing
- Check agent is registered and active
- Verify signatures are valid
- Check server logs for errors

## Next Steps

1. **Add outcome recording**: Record success/failure for reputation
2. **Implement circuit breakers**: Auto-downgrade on repeated failures
3. **Add memory tracking**: Log agent memories with provenance
4. **Set up monitoring**: Track reputation scores and policy violations
5. **Create dashboards**: Visualize agent behavior and trust metrics

---

For more information, see:
- [Trust Infrastructure README](./README.md)
- [API Documentation](./API.md)
- [Complete Implementation Report](./COMPLETION_REPORT.md)
