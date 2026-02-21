/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive data like API keys.
 * Uses Node.js built-in crypto module - no external dependencies.
 *
 * ## Usage
 *
 * ```typescript
 * import { encrypt, decrypt, maskKey } from "../shared/encryption.js";
 *
 * // Encrypt an API key
 * const { ciphertext, iv } = encrypt("sk-ant-api03-...");
 *
 * // Decrypt an API key
 * const plaintext = decrypt(ciphertext, iv);
 *
 * // Mask for display
 * const masked = maskKey("sk-ant-api03-AbCdXyZz"); // "sk-ant-...XyZz"
 * ```
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// GCM recommended IV length is 12 bytes (96 bits)
const IV_LENGTH = 12;
// GCM authentication tag length is 16 bytes (128 bits)
const AUTH_TAG_LENGTH = 16;
// Key length for AES-256 is 32 bytes
const KEY_LENGTH = 32;

/**
 * Get the encryption key from environment.
 * Throws if missing or less than 32 characters.
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key || key.trim() === "") {
    throw new Error(
      "Missing required environment variable: ENCRYPTION_KEY\n" +
        "Please set a 32+ character encryption key in your .env file.\n" +
        "See .env.example for reference."
    );
  }

  if (key.length < 32) {
    throw new Error(
      `ENCRYPTION_KEY must be at least 32 characters long (got ${key.length}).\n` +
        "Please use a strong, randomly generated key."
    );
  }

  // Derive a 32-byte key using scrypt
  return scryptSync(key, "peterbot-salt", KEY_LENGTH);
}

/**
 * Lazy-loaded encryption key.
 * Initialized on first use to allow config validation to happen first.
 */
let encryptionKey: Buffer | null = null;

function getKey(): Buffer {
  if (!encryptionKey) {
    encryptionKey = getEncryptionKey();
  }
  return encryptionKey;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 *
 * @param plaintext - The string to encrypt
 * @returns Object containing base64-encoded ciphertext (includes authTag) and IV
 */
export function encrypt(plaintext: string): { ciphertext: string; iv: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Append authentication tag to ciphertext
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]).toString("base64");

  return {
    ciphertext,
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM.
 *
 * @param ciphertext - Base64-encoded ciphertext (includes authTag)
 * @param iv - Base64-encoded initialization vector
 * @returns The decrypted plaintext string
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decrypt(ciphertext: string, iv: string): string {
  const ciphertextBuffer = Buffer.from(ciphertext, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  // Extract auth tag from end of ciphertext
  const authTag = ciphertextBuffer.subarray(-AUTH_TAG_LENGTH);
  const encryptedData = ciphertextBuffer.subarray(0, -AUTH_TAG_LENGTH);

  const decipher = createDecipheriv("aes-256-gcm", getKey(), ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Mask a sensitive key for display purposes.
 *
 * Shows the first 7 characters and last 4 characters, with "..." in between.
 * For keys shorter than 14 characters, shows only first 3 and last 1.
 *
 * @param key - The key to mask
 * @returns Masked representation like "sk-ant-...XyZz"
 */
export function maskKey(key: string): string {
  if (key.length <= 10) {
    return key.length <= 4 ? "****" : `${key.slice(0, 3)}...${key.slice(-1)}`;
  }

  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}
