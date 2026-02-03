import * as ed25519 from '@noble/ed25519';
import { sha256, hexToBytes } from './keys.js';
import { toCanonicalJSON, prepareForSigning } from './canonical.js';
import type { SignedEvent } from './signing.js';

export interface VerificationResult {
  valid: boolean;
  errors: string[];
}

export interface ChainVerificationResult extends VerificationResult {
  firstInvalidEvent?: number;
  totalEvents: number;
}

/**
 * Verify a single signed event
 *
 * Checks:
 * 1. Hash matches sha256(canonical_json)
 * 2. Ed25519 signature verifies against public key
 */
export async function verifyEvent(
  event: SignedEvent,
  publicKeyHex: string
): Promise<VerificationResult> {
  const errors: string[] = [];

  try {
    // Reconstruct canonical JSON (exclude hash and signature)
    const unsignedEvent = prepareForSigning(event);
    const canonicalJSON = toCanonicalJSON(unsignedEvent);

    // Verify hash
    const computedHash = sha256(canonicalJSON);
    if (computedHash !== event.hash) {
      errors.push(`Hash mismatch: expected ${event.hash}, got ${computedHash}`);
    }

    // Verify signature
    const publicKey = hexToBytes(publicKeyHex);
    const messageBytes = new TextEncoder().encode(canonicalJSON);
    const signatureBytes = hexToBytes(event.signature);

    const signatureValid = await ed25519.verifyAsync(
      signatureBytes,
      messageBytes,
      publicKey
    );

    if (!signatureValid) {
      errors.push('Invalid Ed25519 signature');
    }
  } catch (error) {
    errors.push(`Verification error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify a chain of events
 *
 * Checks:
 * 1. Each event's signature is valid
 * 2. Each event's prev_hash matches previous event's hash
 * 3. First event has prev_hash = null
 */
export async function verifyEventChain(
  events: SignedEvent[],
  publicKeyHex: string
): Promise<ChainVerificationResult> {
  const errors: string[] = [];
  let firstInvalidEvent: number | undefined;

  if (events.length === 0) {
    return {
      valid: true,
      errors: [],
      totalEvents: 0,
    };
  }

  // Verify first event has no previous
  if (events[0].prev_hash !== null) {
    errors.push('First event must have prev_hash = null');
    firstInvalidEvent = 0;
  }

  // Verify each event
  for (let i = 0; i < events.length; i++) {
    const event = events[i];

    // Verify signature and hash
    const result = await verifyEvent(event, publicKeyHex);
    if (!result.valid) {
      errors.push(`Event ${i}: ${result.errors.join(', ')}`);
      if (firstInvalidEvent === undefined) {
        firstInvalidEvent = i;
      }
    }

    // Verify chain linkage (except first event)
    if (i > 0) {
      const previousHash = events[i - 1].hash;
      if (event.prev_hash !== previousHash) {
        errors.push(
          `Event ${i}: prev_hash mismatch (expected ${previousHash}, got ${event.prev_hash})`
        );
        if (firstInvalidEvent === undefined) {
          firstInvalidEvent = i;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    firstInvalidEvent,
    totalEvents: events.length,
  };
}

/**
 * Quick verification of hash chain linkage only (no signature checks)
 * Useful for fast integrity checks
 */
export function verifyChainLinkage(events: SignedEvent[]): VerificationResult {
  const errors: string[] = [];

  if (events.length === 0) {
    return { valid: true, errors: [] };
  }

  if (events[0].prev_hash !== null) {
    errors.push('First event must have prev_hash = null');
  }

  for (let i = 1; i < events.length; i++) {
    const previousHash = events[i - 1].hash;
    if (events[i].prev_hash !== previousHash) {
      errors.push(
        `Event ${i}: chain broken (expected prev_hash ${previousHash}, got ${events[i].prev_hash})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
