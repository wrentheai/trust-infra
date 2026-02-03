import { scrypt, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export interface EncryptedKeystore {
  version: string;
  crypto: {
    cipher: string;
    ciphertext: string;
    kdf: string;
    kdfparams: {
      salt: string;
      n: number;
      r: number;
      p: number;
      dklen: number;
    };
    mac: string;
  };
  id: string;
  agent_id: string;
}

/**
 * Encrypt a private key with a password using scrypt + AES-256-GCM
 */
export async function encryptKeystore(
  privateKeyHex: string,
  agentId: string,
  password: string
): Promise<EncryptedKeystore> {
  const salt = randomBytes(32);
  const iv = randomBytes(16);

  // Derive key using scrypt
  const derivedKey = (await scryptAsync(password, salt, 32)) as Buffer;

  // Encrypt private key with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyHex, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Combine ciphertext + auth tag + iv
  const combined = Buffer.concat([ciphertext, authTag, iv]);

  // Compute MAC for integrity check
  const mac = require('node:crypto')
    .createHash('sha256')
    .update(Buffer.concat([derivedKey.subarray(16, 32), combined]))
    .digest('hex');

  return {
    version: '1',
    crypto: {
      cipher: 'aes-256-gcm',
      ciphertext: combined.toString('hex'),
      kdf: 'scrypt',
      kdfparams: {
        salt: salt.toString('hex'),
        n: 262144,
        r: 8,
        p: 1,
        dklen: 32,
      },
      mac,
    },
    id: randomBytes(16).toString('hex'),
    agent_id: agentId,
  };
}

/**
 * Decrypt an encrypted keystore with password
 */
export async function decryptKeystore(
  keystore: EncryptedKeystore,
  password: string
): Promise<string> {
  if (keystore.version !== '1') {
    throw new Error(`Unsupported keystore version: ${keystore.version}`);
  }

  const { crypto } = keystore;

  // Derive key using scrypt
  const salt = Buffer.from(crypto.kdfparams.salt, 'hex');
  const derivedKey = (await scryptAsync(password, salt, crypto.kdfparams.dklen)) as Buffer;

  // Verify MAC
  const combined = Buffer.from(crypto.ciphertext, 'hex');
  const computedMac = require('node:crypto')
    .createHash('sha256')
    .update(Buffer.concat([derivedKey.subarray(16, 32), combined]))
    .digest('hex');

  if (computedMac !== crypto.mac) {
    throw new Error('Invalid password or corrupted keystore (MAC mismatch)');
  }

  // Extract components
  const iv = combined.subarray(combined.length - 16);
  const authTag = combined.subarray(combined.length - 32, combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 32);

  // Decrypt
  const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);

  const privateKeyHex = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  return privateKeyHex;
}
