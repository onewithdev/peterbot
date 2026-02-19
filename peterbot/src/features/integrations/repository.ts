import { eq } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { connectedApps } from "./schema.js";
import type { ConnectedApp, NewConnectedApp } from "./schema.js";

export async function getConnectedApps(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<ConnectedApp[]> {
  return db.select().from(connectedApps).orderBy(connectedApps.provider);
}

export async function getConnectedApp(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  provider: string
): Promise<ConnectedApp | undefined> {
  const result = await db
    .select()
    .from(connectedApps)
    .where(eq(connectedApps.provider, provider))
    .limit(1);
  return result[0];
}

export async function upsertConnection(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: Omit<NewConnectedApp, "id" | "connectedAt">
): Promise<ConnectedApp> {
  const existing = await getConnectedApp(db, input.provider!);

  if (existing) {
    // Update existing - retain connectedAt and set lastUsedAt if provided
    const result = await db
      .update(connectedApps)
      .set({
        accountEmail: input.accountEmail,
        enabled: input.enabled ?? true,
        connectedAt: existing.connectedAt,
        lastUsedAt: input.lastUsedAt,
      })
      .where(eq(connectedApps.provider, input.provider!))
      .returning();
    return result[0];
  } else {
    // Insert new
    const result = await db
      .insert(connectedApps)
      .values({
        ...input,
        connectedAt: new Date(),
      })
      .returning();
    return result[0];
  }
}

export async function toggleConnectionEnabled(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  provider: string,
  enabled: boolean
): Promise<void> {
  await db
    .update(connectedApps)
    .set({ enabled })
    .where(eq(connectedApps.provider, provider));
}

export async function removeConnection(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  provider: string
): Promise<void> {
  await db.delete(connectedApps).where(eq(connectedApps.provider, provider));
}
