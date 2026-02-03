import { describe, it, expect } from 'vitest';
import { generateAgentIdentity } from './keys.js';
import { signEvent, signEventInChain } from './signing.js';
import { verifyEvent } from './verification.js';

describe('Event Signing', () => {
  it('should sign an event correctly', async () => {
    const identity = await generateAgentIdentity();

    const unsignedEvent = {
      agent_id: identity.agentId,
      event_type: 'input_received',
      timestamp: new Date().toISOString(),
      prev_hash: null,
      payload: { test: 'data' },
    };

    const signedEvent = await signEvent(unsignedEvent, identity.privateKey);

    expect(signedEvent.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(signedEvent.signature).toBeTruthy();
    expect(signedEvent.agent_id).toBe(identity.agentId);
  });

  it('should verify a signed event', async () => {
    const identity = await generateAgentIdentity();

    const unsignedEvent = {
      agent_id: identity.agentId,
      event_type: 'response_emitted',
      timestamp: new Date().toISOString(),
      prev_hash: null,
      payload: { summary: 'Test response' },
    };

    const signedEvent = await signEvent(unsignedEvent, identity.privateKey);
    const result = await verifyEvent(signedEvent, identity.publicKey);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail verification with wrong public key', async () => {
    const identity1 = await generateAgentIdentity();
    const identity2 = await generateAgentIdentity();

    const unsignedEvent = {
      agent_id: identity1.agentId,
      event_type: 'input_received',
      timestamp: new Date().toISOString(),
      prev_hash: null,
      payload: { test: 'data' },
    };

    const signedEvent = await signEvent(unsignedEvent, identity1.privateKey);
    const result = await verifyEvent(signedEvent, identity2.publicKey);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should sign events in a chain', async () => {
    const identity = await generateAgentIdentity();

    // First event
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

    expect(event1.prev_hash).toBeNull();

    // Second event (linked to first)
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

    expect(event2.prev_hash).toBe(event1.hash);

    // Third event (linked to second)
    const event3 = await signEventInChain(
      {
        agent_id: identity.agentId,
        event_type: 'response_emitted',
        timestamp: new Date().toISOString(),
        payload: { data: 'event3' },
      },
      event2.hash,
      identity.privateKey
    );

    expect(event3.prev_hash).toBe(event2.hash);
  });
});
