import { eq, and, asc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db";
import * as schema from "../../db/schema";
import { apiKeys, type ApiKey, type NewApiKey } from "./schema";
import { encrypt, maskKey } from "../../shared/encryption.js";

/**
 * Safe API key fields for display (excludes encrypted data).
 */
type SafeApiKey = Omit<ApiKey, "encryptedKey" | "iv">;

/**
 * Create a new API key entry.
 * Encrypts the key and stores it with a masked display version.
 * Returns only safe fields (no encrypted data).
 */
export async function createApiKey(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  {
    provider,
    plainKey,
    label,
  }: {
    provider: "anthropic" | "google" | "zai" | "moonshot";
    plainKey: string;
    label?: string;
  }
): Promise<SafeApiKey> {
  const { ciphertext, iv } = encrypt(plainKey);
  const maskedKey = maskKey(plainKey);

  const result = await db
    .insert(apiKeys)
    .values({
      provider,
      encryptedKey: ciphertext,
      iv,
      maskedKey,
      label,
      isValid: false,
    })
    .returning({
      id: apiKeys.id,
      provider: apiKeys.provider,
      maskedKey: apiKeys.maskedKey,
      label: apiKeys.label,
      isValid: apiKeys.isValid,
      lastError: apiKeys.lastError,
      validatedAt: apiKeys.validatedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    });

  return result[0];
}

/**
 * Get all API keys for a specific provider.
 * Returns only safe fields (no encrypted data).
 */
export async function getApiKeysByProvider(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  provider: "anthropic" | "google" | "zai" | "moonshot"
): Promise<SafeApiKey[]> {
  return await db
    .select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      maskedKey: apiKeys.maskedKey,
      label: apiKeys.label,
      isValid: apiKeys.isValid,
      lastError: apiKeys.lastError,
      validatedAt: apiKeys.validatedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.provider, provider))
    .orderBy(asc(apiKeys.createdAt));
}

/**
 * Get all API keys.
 * Returns only safe fields (no encrypted data).
 */
export async function getAllApiKeys(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<SafeApiKey[]> {
  return await db
    .select({
      id: apiKeys.id,
      provider: apiKeys.provider,
      maskedKey: apiKeys.maskedKey,
      label: apiKeys.label,
      isValid: apiKeys.isValid,
      lastError: apiKeys.lastError,
      validatedAt: apiKeys.validatedAt,
      createdAt: apiKeys.createdAt,
      updatedAt: apiKeys.updatedAt,
    })
    .from(apiKeys)
    .orderBy(asc(apiKeys.provider), asc(apiKeys.createdAt));
}

/**
 * Get a single API key by ID.
 * Returns the full row including encrypted fields (for decrypt/test/delete).
 */
export async function getApiKeyById(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<ApiKey | undefined> {
  const result = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, id))
    .limit(1);
  return result[0];
}

/**
 * Delete an API key by ID.
 */
export async function deleteApiKey(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db.delete(apiKeys).where(eq(apiKeys.id, id));
}

/**
 * Mark an API key as valid.
 */
export async function markApiKeyValid(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  const now = new Date();
  await db
    .update(apiKeys)
    .set({
      isValid: true,
      lastError: null,
      validatedAt: now,
      updatedAt: now,
    })
    .where(eq(apiKeys.id, id));
}

/**
 * Mark an API key as invalid with an error message.
 */
export async function markApiKeyInvalid(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  error: string
): Promise<void> {
  const now = new Date();
  await db
    .update(apiKeys)
    .set({
      isValid: false,
      lastError: error,
      validatedAt: now,
      updatedAt: now,
    })
    .where(eq(apiKeys.id, id));
}
