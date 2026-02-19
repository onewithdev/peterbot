import { eq, desc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { documentReferences, type DocumentReference, type NewDocumentReference } from "./schema.js";

/**
 * Get all document references, ordered by creation date (newest first).
 */
export async function getAllDocuments(
  db: BunSQLiteDatabase<typeof schema> | undefined
): Promise<DocumentReference[]> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  return database
    .select()
    .from(documentReferences)
    .orderBy(desc(documentReferences.createdAt));
}

/**
 * Get a document reference by ID.
 */
export async function getDocumentById(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  id: string
): Promise<DocumentReference | null> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  const results = await database
    .select()
    .from(documentReferences)
    .where(eq(documentReferences.id, id))
    .limit(1);
  return results[0] ?? null;
}

/**
 * Get a document reference by name (case-insensitive partial/substring match).
 * Returns exact match first, then case-insensitive match, then partial/substring match.
 */
export async function getDocumentByName(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  name: string
): Promise<DocumentReference | null> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  
  // Get all documents to perform flexible matching
  const allDocs = await getAllDocuments(database);
  const normalizedQuery = name.toLowerCase().trim();
  
  // Priority 1: Exact match (case-sensitive)
  const exactMatch = allDocs.find(
    (doc) => doc.name === name
  );
  if (exactMatch) {
    return exactMatch;
  }
  
  // Priority 2: Case-insensitive exact match
  const caseInsensitiveMatch = allDocs.find(
    (doc) => doc.name.toLowerCase() === normalizedQuery
  );
  if (caseInsensitiveMatch) {
    return caseInsensitiveMatch;
  }
  
  // Priority 3: Substring match (query is contained in document name)
  const substringMatch = allDocs.find(
    (doc) => doc.name.toLowerCase().includes(normalizedQuery)
  );
  if (substringMatch) {
    return substringMatch;
  }
  
  // Priority 4: Document name is contained in query (reverse substring)
  const reverseSubstringMatch = allDocs.find(
    (doc) => normalizedQuery.includes(doc.name.toLowerCase())
  );
  if (reverseSubstringMatch) {
    return reverseSubstringMatch;
  }
  
  return null;
}

/**
 * Create a new document reference.
 */
export async function createDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  data: Omit<NewDocumentReference, "id" | "createdAt">
): Promise<DocumentReference> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  const results = await database
    .insert(documentReferences)
    .values({
      ...data,
      createdAt: new Date(),
    })
    .returning();
  return results[0]!;
}

/**
 * Delete a document reference by ID.
 */
export async function deleteDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  id: string
): Promise<void> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  await database
    .delete(documentReferences)
    .where(eq(documentReferences.id, id));
}

/**
 * Update document content and related fields after a fetch.
 */
export async function updateDocumentContent(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  id: string,
  data: {
    content: string | null;
    contentTruncated: boolean;
    summary: string | null;
    cachedAt: Date | null;
    lastFetchAttemptAt: Date;
    lastFetchError: string | null;
  }
): Promise<void> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  await database
    .update(documentReferences)
    .set({
      content: data.content,
      contentTruncated: data.contentTruncated,
      summary: data.summary,
      cachedAt: data.cachedAt,
      lastFetchAttemptAt: data.lastFetchAttemptAt,
      lastFetchError: data.lastFetchError,
    })
    .where(eq(documentReferences.id, id));
}

/**
 * Update the last accessed timestamp.
 */
export async function updateLastAccessed(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  id: string
): Promise<void> {
  const database = db ?? (await import("../../db/index.js")).db as unknown as BunSQLiteDatabase<typeof schema>;
  await database
    .update(documentReferences)
    .set({ lastAccessed: new Date() })
    .where(eq(documentReferences.id, id));
}
