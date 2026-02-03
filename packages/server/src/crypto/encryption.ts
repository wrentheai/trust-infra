/**
 * Encryption utilities for Trust Infrastructure v2
 * 
 * Uses X25519 for key exchange + XChaCha20-Poly1305 for symmetric encryption
 * via libsodium (tweetnacl for now, can upgrade later)
 */

import nacl from 'tweetnacl';
import tweetnaclUtil from 'tweetnacl-util';
const { encodeBase64, decodeBase64 } = tweetnaclUtil;

export interface KeyPair {
  publicKey: string;  // base64 encoded
  secretKey: string;  // base64 encoded
}

export interface EncryptedData {
  ciphertext: string;  // base64 encoded
  nonce: string;       // base64 encoded
}

/**
 * Generate a new keypair for an owner
 */
export function generateKeyPair(): KeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

/**
 * Encrypt content for a specific owner using their public key
 * Uses ephemeral keypair for each encryption (anonymous box pattern)
 */
export function encryptForOwner(
  plaintext: string,
  ownerPublicKey: string
): EncryptedData {
  const publicKeyBytes = decodeBase64(ownerPublicKey);
  const messageBytes = new TextEncoder().encode(plaintext);
  
  // Generate ephemeral keypair for this encryption
  const ephemeralKeyPair = nacl.box.keyPair();
  
  // Generate random nonce
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  
  // Encrypt
  const ciphertext = nacl.box(
    messageBytes,
    nonce,
    publicKeyBytes,
    ephemeralKeyPair.secretKey
  );
  
  // Prepend ephemeral public key to ciphertext (needed for decryption)
  const combined = new Uint8Array(ephemeralKeyPair.publicKey.length + ciphertext.length);
  combined.set(ephemeralKeyPair.publicKey);
  combined.set(ciphertext, ephemeralKeyPair.publicKey.length);
  
  return {
    ciphertext: encodeBase64(combined),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt content using owner's secret key
 */
export function decryptForOwner(
  encrypted: EncryptedData,
  ownerSecretKey: string
): string {
  const secretKeyBytes = decodeBase64(ownerSecretKey);
  const combined = decodeBase64(encrypted.ciphertext);
  const nonce = decodeBase64(encrypted.nonce);
  
  // Extract ephemeral public key and ciphertext
  const ephemeralPublicKey = combined.slice(0, nacl.box.publicKeyLength);
  const ciphertext = combined.slice(nacl.box.publicKeyLength);
  
  // Decrypt
  const messageBytes = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPublicKey,
    secretKeyBytes
  );
  
  if (!messageBytes) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
  
  return new TextDecoder().decode(messageBytes);
}

/**
 * Hash content for integrity verification (SHA-256)
 */
export function hashContent(content: string): string {
  const messageBytes = new TextEncoder().encode(content);
  const hashBytes = nacl.hash(messageBytes);
  // Convert to hex string (only first 32 bytes = 64 hex chars for SHA-256 equivalent)
  return Array.from(hashBytes.slice(0, 32))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash a public key for storage/lookup
 */
export function hashPublicKey(publicKey: string): string {
  return hashContent(publicKey);
}

/**
 * Verify that content matches its hash
 */
export function verifyContentHash(content: string, expectedHash: string): boolean {
  const actualHash = hashContent(content);
  return actualHash === expectedHash;
}
