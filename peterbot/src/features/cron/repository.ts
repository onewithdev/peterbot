import { eq, lte, and, desc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db";
import * as schema from "../../db/schema";
import { schedules, type Schedule, type NewSchedule } from "./schema";

export async function createSchedule(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: NewSchedule
): Promise<Schedule> {
  const result = await db.insert(schedules).values(input).returning();
  return result[0];
}

export async function getAllSchedules(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Schedule[]> {
  return await db
    .select()
    .from(schedules)
    .orderBy(desc(schedules.createdAt));
}

export async function getScheduleById(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<Schedule | undefined> {
  const result = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id))
    .limit(1);
  return result[0];
}

export async function getDueSchedules(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  now: Date
): Promise<Schedule[]> {
  return await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)));
}

export async function updateSchedule(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  patch: Partial<NewSchedule>
): Promise<void> {
  await db
    .update(schedules)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id));
}

export async function deleteSchedule(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db.delete(schedules).where(eq(schedules.id, id));
}

export async function toggleSchedule(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  enabled: boolean,
  nextRunAt?: Date
): Promise<void> {
  const updateData: { enabled: boolean; nextRunAt?: Date; updatedAt: Date } = {
    enabled,
    updatedAt: new Date(),
  };

  if (nextRunAt !== undefined) {
    updateData.nextRunAt = nextRunAt;
  }

  await db.update(schedules).set(updateData).where(eq(schedules.id, id));
}

export async function updateScheduleRunTime(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  nextRunAt: Date
): Promise<void> {
  await db
    .update(schedules)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id));
}
