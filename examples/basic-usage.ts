#!/usr/bin/env tsx

/**
 * Basic usage example for Trust Infrastructure
 *
 * Run: npx tsx examples/basic-usage.ts
 */

import { generateAgentIdentity } from '../packages/crypto/src/index.js';
import { TrustClient } from '../packages/client/src/index.js';

async function main() {
  console.log('🚀 Trust Infrastructure Basic Usage Example\n');

  // 1. Generate agent identity
  console.log('📝 Generating agent identity...');
  const identity = await generateAgentIdentity();
  console.log('✅ Agent ID:', identity.agentId);
  console.log('   Public Key:', identity.publicKey.slice(0, 16) + '...');
  console.log('   Private Key:', identity.privateKey.slice(0, 16) + '... (keep secret!)\n');

  // 2. Register agent (requires service API key)
  console.log('🔐 Registering agent with trust service...');
  const registerResponse = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': 'dev-service-key-change-in-production',
    },
    body: JSON.stringify({
      publicKey: identity.publicKey,
      name: 'ExampleAgent',
      owner: 'example@demo.com',
      metadata: {
        version: '1.0.0',
        description: 'Example agent for demonstration',
      },
    }),
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.json();
    console.error('❌ Registration failed:', error.message);
    process.exit(1);
  }

  const agent = await registerResponse.json();
  console.log('✅ Agent registered successfully');
  console.log('   Status:', agent.status);
  console.log('   Created:', agent.createdAt, '\n');

  // 3. Create trust client
  console.log('🔧 Creating trust client...');
  const client = new TrustClient({
    baseUrl: 'http://localhost:3000',
    agentId: identity.agentId,
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
  });

  await client.init();
  console.log('✅ Client initialized\n');

  // 4. Log a series of events (simulating an agent session)
  console.log('📊 Logging events...');
  const sessionId = crypto.randomUUID();

  // Input received
  const event1 = await client.logInput('User asked: What is the weather in SF?', sessionId);
  console.log('✅ Logged input_received (event', event1.id + ')');

  // Decision made
  const event2 = await client.logDecision(
    'Fetch weather data from API',
    'User needs current weather information for San Francisco',
    sessionId
  );
  console.log('✅ Logged decision_made (event', event2.id + ')');

  // Tool call requested
  const event3 = await client.logToolCall(
    'weather-api',
    { city: 'San Francisco', units: 'imperial' },
    sessionId
  );
  console.log('✅ Logged tool_call_requested (event', event3.id + ')');

  // Tool call result
  const event4 = await client.logToolResult(
    'weather-api',
    'success',
    { temperature: 72, condition: 'Sunny', humidity: 65 },
    sessionId
  );
  console.log('✅ Logged tool_call_result (event', event4.id + ')');

  // Response emitted
  const event5 = await client.logResponse({
    summary: 'Provided weather information for San Francisco',
    contentRef: 'response/2026-02-03/session-' + sessionId,
    inputsUsed: ['weather-api', 'user-input'],
    riskLevel: 'low',
    expectedOutcome: 'User receives accurate weather information',
    correlationId: sessionId,
  });
  console.log('✅ Logged response_emitted (event', event5.id + ')\n');

  // 5. Query events
  console.log('🔍 Querying events...');
  const events = await client.queryEvents({
    agentId: identity.agentId,
    correlationId: sessionId,
  });
  console.log('✅ Found', events.length, 'events for session:', sessionId, '\n');

  // 6. Verify chain integrity
  console.log('🔐 Verifying event chain...');
  const verification = await client.verifyChain();
  if (verification.valid) {
    console.log('✅ Chain is valid!');
    console.log('   Total events:', verification.totalEvents);
    console.log('   All signatures verified ✓');
    console.log('   Hash chain intact ✓\n');
  } else {
    console.log('❌ Chain verification failed!');
    console.log('   Errors:', verification.errors);
    console.log('   First invalid event:', verification.firstInvalidEvent, '\n');
  }

  // 7. Check reputation
  console.log('⭐ Checking reputation...');
  const reputation = await client.getReputation();
  console.log('✅ Reputation retrieved');
  console.log('   Overall Score:', reputation.overallScore);
  console.log('   Total Actions:', reputation.totalActions);
  console.log('   Success Rate:', (Number(reputation.successRate) * 100).toFixed(1) + '%\n');

  // 8. Record an outcome
  console.log('📝 Recording outcome...');
  const outcomeResponse = await fetch('http://localhost:3000/api/outcomes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': 'dev-service-key-change-in-production',
    },
    body: JSON.stringify({
      agentId: identity.agentId,
      eventId: event5.id,
      outcomeType: 'success',
      reporter: 'user',
      impactScore: 0.5,
      details: 'User confirmed weather information was accurate',
    }),
  });

  if (outcomeResponse.ok) {
    const outcomeData = await outcomeResponse.json();
    console.log('✅ Outcome recorded');
    console.log('   Updated Score:', outcomeData.reputation.overallScore, '\n');
  }

  console.log('🎉 Example completed successfully!');
  console.log('\nNext steps:');
  console.log('- View events in the database');
  console.log('- Try the verification endpoint: POST /api/events/verify-chain');
  console.log('- Explore capabilities and policies');
  console.log('- Integrate with your agent system\n');
}

main().catch(console.error);
