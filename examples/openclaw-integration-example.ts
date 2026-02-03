#!/usr/bin/env tsx

/**
 * OpenClaw Integration Example
 *
 * This shows how to integrate OpenClaw with Trust Infrastructure
 *
 * Run: npx tsx examples/openclaw-integration-example.ts
 */

import { TrustClient } from '../packages/client/src/index.js';
import { generateAgentIdentity } from '../packages/crypto/src/index.js';
import { randomUUID } from 'crypto';

// Simulated OpenClaw Agent
class OpenClawAgent {
  private trustClient: TrustClient;
  private agentName: string;

  constructor(trustClient: TrustClient, name: string) {
    this.trustClient = trustClient;
    this.agentName = name;
  }

  /**
   * Simulate processing a user message
   */
  async processMessage(userInput: string): Promise<string> {
    const sessionId = randomUUID();
    console.log(`\n🤖 ${this.agentName} processing: "${userInput}"`);
    console.log(`   Session ID: ${sessionId}\n`);

    try {
      // 1. Log input received
      console.log('📥 Logging input...');
      await this.trustClient.logInput(userInput, sessionId);

      // 2. Decide on action (simulated)
      const decision = this.decideAction(userInput);
      console.log(`🧠 Decision: ${decision.action}`);
      await this.trustClient.logDecision(
        decision.action,
        decision.reasoning,
        sessionId
      );

      // 3. Execute tool (simulated)
      if (decision.tool) {
        console.log(`🔧 Calling tool: ${decision.tool}`);
        await this.trustClient.logToolCall(
          decision.tool,
          decision.args,
          sessionId
        );

        // Simulate tool execution
        await new Promise(resolve => setTimeout(resolve, 100));
        const toolResult = this.executeTool(decision.tool, decision.args);

        await this.trustClient.logToolResult(
          decision.tool,
          toolResult.success ? 'success' : 'failure',
          toolResult.data,
          sessionId
        );
      }

      // 4. Generate response
      const response = this.generateResponse(decision);
      console.log(`💬 Response: ${response}`);

      // 5. Log response
      await this.trustClient.logResponse({
        summary: response,
        riskLevel: decision.riskLevel,
        expectedOutcome: decision.expectedOutcome,
        correlationId: sessionId,
      });

      console.log('✅ All events logged successfully\n');
      return response;

    } catch (error) {
      // Log errors to trust infrastructure
      await this.trustClient.appendEvent({
        eventType: 'error_occurred',
        payload: {
          error: error instanceof Error ? error.message : String(error),
        },
        correlationId: sessionId,
      });

      throw error;
    }
  }

  private decideAction(input: string): any {
    // Simple decision logic (simulated)
    if (input.toLowerCase().includes('tweet') || input.toLowerCase().includes('post')) {
      return {
        action: 'Post to X/Twitter',
        reasoning: 'User wants to share content on social media',
        tool: 'x.post',
        args: { content: input.replace(/tweet|post/gi, '').trim() },
        riskLevel: 'medium' as const,
        expectedOutcome: 'Content posted successfully to X',
      };
    } else if (input.toLowerCase().includes('send') && input.toLowerCase().includes('token')) {
      return {
        action: 'Send tokens',
        reasoning: 'User wants to transfer tokens',
        tool: 'wallet.send',
        args: { amount: 10, to: '0x...' },
        riskLevel: 'high' as const,
        expectedOutcome: 'Tokens transferred to recipient',
      };
    } else {
      return {
        action: 'Respond to query',
        reasoning: 'General information request',
        tool: null,
        args: {},
        riskLevel: 'low' as const,
        expectedOutcome: 'Provide helpful information',
      };
    }
  }

  private executeTool(tool: string, args: any): any {
    // Simulate tool execution
    return {
      success: true,
      data: {
        tool,
        args,
        result: `${tool} executed successfully`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private generateResponse(decision: any): string {
    if (decision.tool === 'x.post') {
      return `Posted to X: "${decision.args.content}"`;
    } else if (decision.tool === 'wallet.send') {
      return `Sent ${decision.args.amount} tokens to ${decision.args.to}`;
    } else {
      return 'Here is the information you requested...';
    }
  }
}

// Main integration example
async function main() {
  console.log('🎯 OpenClaw + Trust Infrastructure Integration Example\n');
  console.log('=' .repeat(60));

  // Step 1: Generate agent identity
  console.log('\n📝 Step 1: Generate Agent Identity');
  const identity = await generateAgentIdentity();
  console.log('✅ Agent ID:', identity.agentId);
  console.log('✅ Public Key:', identity.publicKey.slice(0, 16) + '...');

  // Step 2: Register agent
  console.log('\n🔐 Step 2: Register Agent with Trust Service');
  const registerResponse = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': 'dev-service-key-change-in-production',
    },
    body: JSON.stringify({
      publicKey: identity.publicKey,
      name: 'OpenClaw Demo Agent',
      owner: 'demo@openclaw.ai',
      metadata: {
        version: '1.0.0',
        framework: 'OpenClaw',
        capabilities: ['x.post', 'wallet.send', 'memory.read'],
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
  console.log('   Name:', agent.name);
  console.log('   Status:', agent.status);

  // Step 3: Create trust client
  console.log('\n🔧 Step 3: Initialize Trust Client');
  const trustClient = new TrustClient({
    baseUrl: 'http://localhost:3000',
    agentId: identity.agentId,
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
  });

  await trustClient.init();
  console.log('✅ Trust client initialized');

  // Step 4: Create OpenClaw agent with trust
  console.log('\n🤖 Step 4: Create OpenClaw Agent');
  const openClawAgent = new OpenClawAgent(trustClient, 'OpenClaw Demo');
  console.log('✅ OpenClaw agent created');

  // Step 5: Process messages with trust logging
  console.log('\n' + '='.repeat(60));
  console.log('📊 Step 5: Process Messages with Trust Logging');
  console.log('='.repeat(60));

  // Example 1: General query
  await openClawAgent.processMessage('What is the weather like today?');

  // Example 2: Social media post
  await openClawAgent.processMessage('Post a tweet about AI agents');

  // Example 3: Token transfer
  await openClawAgent.processMessage('Send tokens to Alice');

  // Step 6: Check reputation
  console.log('\n' + '='.repeat(60));
  console.log('⭐ Step 6: Check Agent Reputation');
  console.log('='.repeat(60) + '\n');

  const reputation = await trustClient.getReputation();
  console.log('Overall Score:', reputation.overallScore);
  console.log('Total Actions:', reputation.totalActions);
  console.log('Success Rate:', (Number(reputation.successRate) * 100).toFixed(1) + '%');

  // Step 7: Query recent events
  console.log('\n' + '='.repeat(60));
  console.log('📋 Step 7: Review Event History');
  console.log('='.repeat(60) + '\n');

  const events = await trustClient.queryEvents({
    agentId: identity.agentId,
    limit: 10,
  });

  console.log(`Found ${events.length} events:\n`);
  events.forEach((event, i) => {
    console.log(`${i + 1}. ${event.eventType.padEnd(25)} | ${event.timestamp}`);
  });

  // Step 8: Verify chain integrity
  console.log('\n' + '='.repeat(60));
  console.log('🔐 Step 8: Verify Chain Integrity');
  console.log('='.repeat(60) + '\n');

  const verification = await trustClient.verifyChain();
  console.log('Chain Valid:', verification.valid ? '✅ YES' : '❌ NO');
  console.log('Total Events:', verification.totalEvents);

  if (!verification.valid && verification.errors.length > 0) {
    console.log('\n⚠️  Verification Issues (may need debugging):');
    verification.errors.slice(0, 3).forEach(error => {
      console.log('  -', error);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Integration Complete!');
  console.log('='.repeat(60) + '\n');

  console.log('Your OpenClaw agent is now:');
  console.log('✅ Registered with Trust Infrastructure');
  console.log('✅ Logging all actions cryptographically');
  console.log('✅ Building reputation through outcomes');
  console.log('✅ Ready for production deployment');

  console.log('\n📚 Next Steps:');
  console.log('1. Review OPENCLAW_INTEGRATION.md for full integration guide');
  console.log('2. Add capability checks before sensitive operations');
  console.log('3. Set up outcome recording for reputation');
  console.log('4. Monitor agent behavior via the Trust API');
  console.log('5. Deploy to production with HTTPS');

  console.log('\n🔗 Useful Commands:');
  console.log('View all events:', `curl http://localhost:3000/api/events?agentId=${identity.agentId}`);
  console.log('Check reputation:', `curl http://localhost:3000/api/reputation/${identity.agentId}`);
  console.log('Verify chain:   ', `curl -X POST http://localhost:3000/api/events/verify-chain -H "Content-Type: application/json" -d '{"agentId":"${identity.agentId}"}'`);

  console.log('\n✨ Happy building trustworthy AI agents! ✨\n');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
