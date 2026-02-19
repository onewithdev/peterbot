import { eq, desc, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { skills } from "./schema.js";
import type { Skill, NewSkill } from "./schema.js";

/**
 * Get a skill by its ID.
 */
export async function getSkillById(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<Skill | undefined> {
  const result = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  return result[0];
}

/**
 * Get all skills ordered by name.
 */
export async function getAllSkills(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Skill[]> {
  return db.select().from(skills).orderBy(skills.name);
}

/**
 * Get all enabled and valid skills.
 */
export async function getEnabledSkills(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(and(eq(skills.enabled, true), eq(skills.valid, true)))
    .orderBy(skills.name);
}

/**
 * Get a skill by its file path.
 */
export async function getSkillByFilePath(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  filePath: string
): Promise<Skill | undefined> {
  const result = await db
    .select()
    .from(skills)
    .where(eq(skills.filePath, filePath))
    .limit(1);
  return result[0];
}

/**
 * Upsert a skill by file path.
 * Inserts if not exists, updates if exists.
 */
export async function upsertSkill(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: NewSkill
): Promise<Skill> {
  const now = new Date();

  // Check if skill exists by file path
  const existing = await getSkillByFilePath(db, input.filePath);

  if (existing) {
    // Update existing skill
    const result = await db
      .update(skills)
      .set({
        name: input.name,
        description: input.description,
        triggerPattern: input.triggerPattern,
        tools: input.tools,
        category: input.category,
        systemPrompt: input.systemPrompt,
        content: input.content,
        enabled: input.enabled ?? existing.enabled,
        valid: true,
        loadError: null,
        updatedAt: now,
      })
      .where(eq(skills.filePath, input.filePath))
      .returning();

    return result[0];
  } else {
    // Insert new skill
    const result = await db
      .insert(skills)
      .values({
        ...input,
        valid: true,
        loadError: null,
        updatedAt: now,
      })
      .returning();

    return result[0];
  }
}

/**
 * Delete a skill by its file path.
 * Used when a skill file is removed from disk.
 */
export async function deleteSkillByFilePath(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  filePath: string
): Promise<void> {
  await db.delete(skills).where(eq(skills.filePath, filePath));
}

/**
 * Toggle a skill's enabled state.
 */
export async function toggleSkill(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  enabled: boolean
): Promise<void> {
  await db
    .update(skills)
    .set({
      enabled,
      updatedAt: new Date(),
    })
    .where(eq(skills.id, id));
}

/**
 * Mark a skill as invalid due to a parse error.
 */
export async function markSkillInvalid(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  filePath: string,
  error: string
): Promise<void> {
  const existing = await getSkillByFilePath(db, filePath);

  if (existing) {
    await db
      .update(skills)
      .set({
        valid: false,
        loadError: error,
        enabled: false,
        updatedAt: new Date(),
      })
      .where(eq(skills.filePath, filePath));
  } else {
    // Create a placeholder skill with error state
    await db.insert(skills).values({
      name: `invalid-${Date.now()}`,
      triggerPattern: "",
      systemPrompt: "",
      content: "",
      filePath,
      enabled: false,
      valid: false,
      loadError: error,
      updatedAt: new Date(),
    });
  }
}
