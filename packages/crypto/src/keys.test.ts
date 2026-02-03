import { describe, it, expect } from 'vitest';
import { generateKeypair, deriveAgentId, generateAgentIdentity, sha256 } from './keys.js';

describe('Key Generation', () => {
  it('should generate a valid Ed25519 keypair', async () => {
    const { privateKey, publicKey } = await generateKeypair();

    expect(privateKey).toBeInstanceOf(Uint8Array);
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(privateKey.length).toBe(32);
    expect(publicKey.length).toBe(32);
  });

  it('should derive deterministic agent_id from public key', async () => {
    const { publicKey } = await generateKeypair();

    const agentId1 = deriveAgentId(publicKey);
    const agentId2 = deriveAgentId(publicKey);

    expect(agentId1).toBe(agentId2);
    expect(agentId1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate different agent_ids for different public keys', async () => {
    const { publicKey: pk1 } = await generateKeypair();
    const { publicKey: pk2 } = await generateKeypair();

    const agentId1 = deriveAgentId(pk1);
    const agentId2 = deriveAgentId(pk2);

    expect(agentId1).not.toBe(agentId2);
  });

  it('should generate complete agent identity', async () => {
    const identity = await generateAgentIdentity();

    expect(identity.agentId).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.privateKey).toMatch(/^[0-9a-f]{64}$/);
    expect(identity.publicKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should compute SHA-256 hash correctly', () => {
    const hash = sha256('hello world');

    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
