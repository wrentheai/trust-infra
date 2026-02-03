#!/usr/bin/env tsx

import { TrustClient } from '../packages/client/src/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

async function logMemory() {
  const identity = JSON.parse(readFileSync(join(process.env.HOME!, '.openclaw/wren-trust-identity.json'), 'utf8'));
  
  const client = new TrustClient({
    baseUrl: 'https://trust-api.whalescope.app',
    agentId: identity.agentId,
    privateKey: identity.privateKey,
    publicKey: identity.publicKey,
  });
  
  await client.init();
  
  // Log the memory event
  const event = await client.appendEvent({
    eventType: 'memory_created',
    payload: {
      kind: 'fact',
      subject: 'Kevin',
      content: "Kevin's Tesla is blue",
      source_type: 'user',
      source_ref: 'signal:1770140316287',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
    },
    correlationId: crypto.randomUUID(),
  });
  
  console.log('✅ Memory logged to trust ledger!');
  console.log('Event ID:', event.id);
  console.log('Hash:', event.hash?.slice(0, 32) + '...');
  console.log('Timestamp:', event.timestamp);
}

logMemory().catch(console.error);
