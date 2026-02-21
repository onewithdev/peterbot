import { eq, gt, asc } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db";
import * as schema from "../../db/schema";
import { jobEvents, type JobEvent, type NewJobEvent } from "./schema";

/**
 * Insert a job event record.
 *
 * @param db - Database instance
 * @param jobId - The job ID this event belongs to
 * @param event - Event type (job_started, job_completed, job_failed)
 * @param payload - Optional JSON-serializable payload data
 */
export async function insertJobEvent(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  jobId: string,
  event: "job_started" | "job_completed" | "job_failed",
  payload?: Record<string, unknown>
): Promise<JobEvent> {
  const result = await db
    .insert(jobEvents)
    .values({
      jobId,
      event,
      payload: payload ? JSON.stringify(payload) : null,
    })
    .returning();

  return result[0];
}

/**
 * Get all job events since a specific event ID.
 * Used for polling/streaming event updates.
 *
 * @param db - Database instance
 * @param lastId - The last event ID the client has seen
 * @returns Array of events with ID greater than lastId
 */
export async function getEventsSince(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  lastId: number
): Promise<JobEvent[]> {
  return await db
    .select()
    .from(jobEvents)
    .where(gt(jobEvents.id, lastId))
    .orderBy(asc(jobEvents.id));
}
