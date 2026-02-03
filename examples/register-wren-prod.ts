#!/usr/bin/env tsx

/**
 * Register Wren on production Trust Infrastructure (Fly.io)
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const TRUST_API = 'https://trust-infra.fly.dev';

async function main() {
  console.log('🪶 Registering Wren on Production Trust Infrastructure\n');

  const identityPath = join(process.env.HOME!, '.openclaw/wren-trust-identity.json');
  
  // Load existing identity (we keep the same keys)
  if (!existsSync(identityPath)) {
    console.error('❌ No identity found. Run register-wren.ts first to generate keys.');
    process.exit(1);
  }
  
  const identity = JSON.parse(readFileSync(identityPath, 'utf8'));
  console.log('   Agent ID:', identity.agentId);
  console.log('   Public Key:', identity.publicKey.slice(0, 32) + '...\n');

  // Register agent on production (use the production service key)
  console.log('🔐 Registering with production trust service...');
  
  // Get service key from fly secrets (we'll use a hardcoded one for now since we set it)
  const serviceKey = process.env.SERVICE_API_KEY || 'trust-prod-' + 'will-be-set';
  
  const response = await fetch(`${TRUST_API}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': serviceKey,
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

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Registration failed:', error.message || JSON.stringify(error));
    process.exit(1);
  }

  const agent = await response.json();
  console.log('✅ Agent registered on production!');
  console.log('   Status:', agent.status);
  console.log('   Created:', agent.createdAt);

  // Update identity file with production URL
  const updatedIdentity = {
    ...identity,
    trustServiceUrl: TRUST_API,
  };
  writeFileSync(identityPath, JSON.stringify(updatedIdentity, null, 2));
  console.log('\n💾 Updated identity with production URL');
  
  console.log('\n🎉 Wren is now registered on production!');
  console.log('API:', TRUST_API);
}

main().catch(console.error);
