import * as ed25519 from '@noble/ed25519';
import { sha256, hexToBytes, bytesToHex } from './keys.js';
import { toCanonicalJSON, prepareForSigning } from './canonical.js';

export interface UnsignedEvent {
  agent_id: string;
  event_type: string;
  timestamp: string;
  prev_hash: string | null;
  payload: any;
  correlation_id?: string;
}

export interface SignedEvent extends UnsignedEvent {
  hash: string;
  signature: string;
}

/**
 * Sign an event with Ed25519 private key
 *
 * Process:
 * 1. Build unsigned event (exclude hash and signature)
 * 2. Canonical JSON serialization (RFC 8785)
 * 3. Compute hash = sha256(canonical_json)
 * 4. Sign canonical JSON with Ed25519 private key
 * 5. Assemble signed event with hash and signature
 */
export async function signEvent(
  event: UnsignedEvent,
  privateKeyHex: string
): Promise<SignedEvent> {
  // Prepare event for signing (no hash or signature fields)
  const unsignedEvent = prepareForSigning(event);

  // Canonical JSON serialization
  const canonicalJSON = toCanonicalJSON(unsignedEvent);

  // Compute hash
  const hash = sha256(canonicalJSON);

  // Sign the canonical JSON
  const privateKey = hexToBytes(privateKeyHex);
  const messageBytes = new TextEncoder().encode(canonicalJSON);
  const signatureBytes = await ed25519.signAsync(messageBytes, privateKey);
  const signature = bytesToHex(signatureBytes);

  // Return signed event
  return {
    ...event,
    hash,
    signature,
  };
}

/**
 * Create a hash chain by linking to previous event
 */
export function linkToPrevious(
  event: Omit<UnsignedEvent, 'prev_hash'>,
  previousHash: string | null
): UnsignedEvent {
  return {
    ...event,
    prev_hash: previousHash,
  };
}

/**
 * Helper to sign a new event in a chain
 */
export async function signEventInChain(
  event: Omit<UnsignedEvent, 'prev_hash'>,
  previousHash: string | null,
  privateKeyHex: string
): Promise<SignedEvent> {
  const linkedEvent = linkToPrevious(event, previousHash);
  return signEvent(linkedEvent, privateKeyHex);
}
