// Key generation and utilities
export {
  generateKeypair,
  generateAgentIdentity,
  deriveAgentId,
  sha256,
  bytesToHex,
  hexToBytes,
} from './keys.js';

// Canonical JSON
export { toCanonicalJSON, prepareForSigning } from './canonical.js';

// Signing
export {
  signEvent,
  signEventInChain,
  linkToPrevious,
  type UnsignedEvent,
  type SignedEvent,
} from './signing.js';

// Verification
export {
  verifyEvent,
  verifyEventChain,
  verifyChainLinkage,
  type VerificationResult,
  type ChainVerificationResult,
} from './verification.js';

// Encrypted keystores
export {
  encryptKeystore,
  decryptKeystore,
  type EncryptedKeystore,
} from './keystore.js';
