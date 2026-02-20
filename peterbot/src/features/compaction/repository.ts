import { eq, desc, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { chatState, sessions, config } from "./schema.js";
import type { ChatState, Session, Config, NewSession } from "./schema.js";

export async function getOrCreateChatState(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string
): Promise<ChatState> {
  await db
    .insert(chatState)
    .values({
      chatId,
      messageCount: 0,
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  const result = await db
    .select()
    .from(chatState)
    .where(eq(chatState.chatId, chatId))
    .limit(1);

  return result[0];
}

export async function incrementMessageCount(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string
): Promise<ChatState> {
  const result = await db
    .update(chatState)
    .set({
      messageCount: sql`${chatState.messageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(chatState.chatId, chatId))
    .returning();

  return result[0];
}

export async function resetMessageCount(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string
): Promise<void> {
  await db
    .update(chatState)
    .set({
      messageCount: 0,
      updatedAt: new Date(),
    })
    .where(eq(chatState.chatId, chatId));
}

export async function updateLatestSummary(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string,
  summary: string
): Promise<void> {
  await db
    .update(chatState)
    .set({
      latestSummary: summary,
      updatedAt: new Date(),
    })
    .where(eq(chatState.chatId, chatId));
}

export async function saveSession(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  session: NewSession
): Promise<Session> {
  const result = await db.insert(sessions).values(session).returning();
  return result[0];
}

export async function getAllSessions(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Session[]> {
  return db.select().from(sessions).orderBy(desc(sessions.createdAt));
}

export async function getConfig(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  key: string
): Promise<Config | undefined> {
  const result = await db
    .select()
    .from(config)
    .where(eq(config.key, key))
    .limit(1);

  return result[0];
}

export async function setConfig(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  key: string,
  value: string
): Promise<void> {
  await db
    .insert(config)
    .values({
      key,
      value,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: config.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    });
}

export async function seedDefaultConfig(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<void> {
  await db
    .insert(config)
    .values({
      key: "compaction_threshold",
      value: "20",
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(config)
    .values({
      key: "agent.enabled",
      value: process.env.USE_AGENT_ENGINE ?? "false",
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(config)
    .values({
      key: "agent.model",
      value: process.env.AGENT_MODEL ?? "gemini",
      updatedAt: new Date(),
    })
    .onConflictDoNothing();
}
