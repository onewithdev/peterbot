import { eq, and, gt, lt, asc, desc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { chatMessages } from "./schema.js";
import type { ChatMessage, NewChatMessage } from "./schema.js";

export async function saveMessage(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: Omit<NewChatMessage, "id" | "createdAt">
): Promise<ChatMessage> {
  const result = await db.insert(chatMessages).values(input).returning();
  return result[0];
}

export async function getMessages(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const results = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  // Return in chronological (asc) order
  return results.reverse();
}

export async function getMessagesSince(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string,
  since: Date,
  limit = 50
): Promise<ChatMessage[]> {
  const results = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.chatId, chatId), gt(chatMessages.createdAt, since)))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
  return results;
}

export async function getMessagesBefore(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string,
  before: Date,
  limit = 50
): Promise<ChatMessage[]> {
  const results = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.chatId, chatId), lt(chatMessages.createdAt, before)))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  // Return in chronological (asc) order
  return results.reverse();
}
