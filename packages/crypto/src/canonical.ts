import { canonicalize } from 'json-canonicalize';

/**
 * Convert object to RFC 8785 canonical JSON string
 * Ensures deterministic serialization for signing and hashing
 */
export function toCanonicalJSON(obj: any): string {
  return canonicalize(obj);
}

/**
 * Prepare event for signing by removing hash and signature fields
 */
export function prepareForSigning(event: any): any {
  const { hash, signature, ...rest } = event;
  return rest;
}
