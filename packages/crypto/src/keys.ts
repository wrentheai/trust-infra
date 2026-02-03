import * as ed25519 from '@noble/ed25519';
import { createHash } from 'node:crypto';

/**
 * Generate a new Ed25519 keypair for an agent
 */
export async function generateKeypair(): Promise<{
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}> {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKeyAsync(privateKey);

  return { privateKey, publicKey };
}

/**
 * Derive agent_id from public key using SHA-256
 * Returns 64 hex characters (deterministic)
 */
export function deriveAgentId(publicKey: Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(publicKey);
  return hash.digest('hex');
}

/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

/**
 * Convert hex string to byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(Buffer.from(hex, 'hex'));
}

/**
 * Generate a complete agent identity (keypair + agent_id)
 */
export async function generateAgentIdentity(): Promise<{
  agentId: string;
  privateKey: string; // hex encoded
  publicKey: string;  // hex encoded
}> {
  const { privateKey, publicKey } = await generateKeypair();
  const agentId = deriveAgentId(publicKey);

  return {
    agentId,
    privateKey: bytesToHex(privateKey),
    publicKey: bytesToHex(publicKey),
  };
}

/**
 * Compute SHA-256 hash of data
 */
export function sha256(data: string | Uint8Array): string {
  const hash = createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}
