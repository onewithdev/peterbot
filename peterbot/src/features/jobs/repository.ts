import { eq, and, desc, sql } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db";
import * as schema from "../../db/schema";
import { jobs, type Job, type NewJob } from "./schema";
import { schedules } from "./schedules/schema";

/**
 * Job with schedule description (enriched for API responses).
 */
export type JobWithSchedule = Job & { scheduleDescription: string | null };

export async function createJob(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  input: NewJob
): Promise<Job> {
  const result = await db
    .insert(jobs)
    .values({
      type: input.type,
      input: input.input,
      chatId: input.chatId,
      scheduleId: input.scheduleId,
      skillSystemPrompt: input.skillSystemPrompt,
    })
    .returning();

  return result[0];
}

export async function getJobById(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<Job | undefined> {
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function getJobsByChatId(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string
): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(eq(jobs.chatId, chatId))
    .orderBy(desc(jobs.createdAt))
    .limit(20);
}

/**
 * Get jobs with their associated schedule description.
 * Used for the dashboard API to show schedule context.
 */
export async function getJobsWithSchedule(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string
): Promise<JobWithSchedule[]> {
  const result = await db
    .select({
      job: jobs,
      scheduleDescription: schedules.description,
    })
    .from(jobs)
    .leftJoin(schedules, eq(jobs.scheduleId, schedules.id))
    .where(eq(jobs.chatId, chatId))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  return result.map((row) => ({
    ...row.job,
    scheduleDescription: row.scheduleDescription ?? null,
  }));
}

export async function getPendingJobs(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  limit = 5
): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export async function getUndeliveredJobs(
  db: BunSQLiteDatabase<typeof schema> = defaultDb
): Promise<Job[]> {
  return await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "completed"), eq(jobs.delivered, false)))
    .orderBy(desc(jobs.createdAt));
}

export async function markJobRunning(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "running",
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markJobCompleted(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  output: string
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "completed",
      output,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markJobFailed(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string,
  error: string
): Promise<void> {
  await db
    .update(jobs)
    .set({
      status: "failed",
      output: error,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function markJobDelivered(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db
    .update(jobs)
    .set({
      delivered: true,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}

export async function incrementJobRetryCount(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  id: string
): Promise<void> {
  await db
    .update(jobs)
    .set({
      retryCount: sql`${jobs.retryCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id));
}
