#!/usr/bin/env tsx

/**
 * Register Wren as a trust-verified agent
 */

import { generateAgentIdentity } from '../packages/crypto/src/index.js';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🪶 Registering Wren with Trust Infrastructure\n');

  const identityPath = join(process.env.HOME!, '.openclaw/wren-trust-identity.json');
  
  let identity: { agentId: string; publicKey: string; privateKey: string };
  
  // Check if identity already exists
  if (existsSync(identityPath)) {
    console.log('📂 Loading existing identity...');
    identity = JSON.parse(readFileSync(identityPath, 'utf8'));
    console.log('✅ Loaded existing identity');
  } else {
    // Generate new identity
    console.log('🔑 Generating new identity...');
    identity = await generateAgentIdentity();
    
    // Save identity
    writeFileSync(identityPath, JSON.stringify(identity, null, 2));
    console.log('💾 Identity saved to:', identityPath);
  }
  
  console.log('   Agent ID:', identity.agentId);
  console.log('   Public Key:', identity.publicKey.slice(0, 32) + '...\n');

  // Register agent
  console.log('🔐 Registering with trust service...');
  const registerResponse = await fetch('http://localhost:3000/api/agents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': 'dev-service-key-change-in-production',
    },
    body: JSON.stringify({
      publicKey: identity.publicKey,
      name: 'Wren',
      owner: 'wrentheai@proton.me',
      metadata: {
        version: '1.0.0',
        description: 'AI agent running on OpenClaw. Born 2026-01-24.',
        twitter: '@WrenTheAI',
        blog: 'https://klabianco.github.io/wren-blog/',
      },
    }),
  });

  if (!registerResponse.ok) {
    const error = await registerResponse.json();
    if (error.message?.includes('already exists')) {
      console.log('ℹ️  Agent already registered (this is fine)\n');
    } else {
      console.error('❌ Registration failed:', error.message);
      process.exit(1);
    }
  } else {
    const agent = await registerResponse.json();
    console.log('✅ Agent registered successfully');
    console.log('   Status:', agent.status);
    console.log('   Created:', agent.createdAt, '\n');
  }

  // Get reputation
  console.log('⭐ Checking initial reputation...');
  const repResponse = await fetch(`http://localhost:3000/api/reputation/${identity.agentId}`);
  if (repResponse.ok) {
    const rep = await repResponse.json();
    console.log('   Overall Score:', rep.overallScore);
    console.log('   Total Actions:', rep.totalActions);
  }

  console.log('\n🎉 Wren is now a trust-verified agent!');
  console.log('\nIdentity stored at:', identityPath);
  console.log('Agent ID:', identity.agentId);
}

main().catch(console.error);
