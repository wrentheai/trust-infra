import { describe, it, expect } from 'vitest';
import { generateAgentIdentity } from './keys.js';
import { signEventInChain } from './signing.js';
import { verifyEventChain, verifyChainLinkage } from './verification.js';

describe('Chain Verification', () => {
  it('should verify a valid event chain', async () => {
    const identity = await generateAgentIdentity();

    // Build a chain of 5 events
    const events = [];
    let prevHash: string | null = null;

    for (let i = 0; i < 5; i++) {
      const event = await signEventInChain(
        {
          agent_id: identity.agentId,
          event_type: 'system_event',
          timestamp: new Date().toISOString(),
          payload: { index: i },
        },
        prevHash,
        identity.privateKey
      );

      events.push(event);
      prevHash = event.hash;
    }

    // Verify the chain
    const result = await verifyEventChain(events, identity.publicKey);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.totalEvents).toBe(5);
    expect(result.firstInvalidEvent).toBeUndefined();
  });

  it('should detect broken chain linkage', async () => {
    const identity = await generateAgentIdentity();

    const event1 = await signEventInChain(
      {
        agent_id: identity.agentId,
        event_type: 'input_received',
        timestamp: new Date().toISOString(),
        payload: { data: 'event1' },
      },
      null,
      identity.privateKey
    );

    const event2 = await signEventInChain(
      {
        agent_id: identity.agentId,
        event_type: 'decision_made',
        timestamp: new Date().toISOString(),
        payload: { data: 'event2' },
      },
      event1.hash,
      identity.privateKey
    );

    // Break the chain by changing prev_hash
    const event3 = await signEventInChain(
      {
        agent_id: identity.agentId,
        event_type: 'response_emitted',
        timestamp: new Date().toISOString(),
        payload: { data: 'event3' },
      },
      'wrong-hash-intentionally-broken',
      identity.privateKey
    );

    const result = await verifyEventChain([event1, event2, event3], identity.publicKey);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.firstInvalidEvent).toBe(2);
  });

  it('should quickly verify chain linkage without signatures', () => {
    const events = [
      {
        agent_id: 'test',
        event_type: 'input_received' as const,
        timestamp: new Date().toISOString(),
        prev_hash: null,
        hash: 'hash1',
        payload: {},
        signature: 'sig1',
      },
      {
        agent_id: 'test',
        event_type: 'decision_made' as const,
        timestamp: new Date().toISOString(),
        prev_hash: 'hash1',
        hash: 'hash2',
        payload: {},
        signature: 'sig2',
      },
      {
        agent_id: 'test',
        event_type: 'response_emitted' as const,
        timestamp: new Date().toISOString(),
        prev_hash: 'hash2',
        hash: 'hash3',
        payload: {},
        signature: 'sig3',
      },
    ];

    const result = verifyChainLinkage(events);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect broken linkage quickly', () => {
    const events = [
      {
        agent_id: 'test',
        event_type: 'input_received' as const,
        timestamp: new Date().toISOString(),
        prev_hash: null,
        hash: 'hash1',
        payload: {},
        signature: 'sig1',
      },
      {
        agent_id: 'test',
        event_type: 'decision_made' as const,
        timestamp: new Date().toISOString(),
        prev_hash: 'hash1',
        hash: 'hash2',
        payload: {},
        signature: 'sig2',
      },
      {
        agent_id: 'test',
        event_type: 'response_emitted' as const,
        timestamp: new Date().toISOString(),
        prev_hash: 'wrong-hash', // Broken!
        hash: 'hash3',
        payload: {},
        signature: 'sig3',
      },
    ];

    const result = verifyChainLinkage(events);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
