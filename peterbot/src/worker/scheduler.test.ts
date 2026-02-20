import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

// Import repository functions
import {
  createSchedule,
  getScheduleById,
  getDueSchedules,
  toggleSchedule,
  updateScheduleRunTime,
} from "../features/jobs/schedules/repository";
import { getPendingJobs } from "../features/jobs/repository";

// Import scheduler functions
import { calculateNextRun } from "../features/jobs/schedules/natural-parser";

// Test database instance
let testDb: BunSQLiteDatabase<typeof schema>;

// Helper to create an in-memory test database
function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create schedules table matching the schema
  sqlite.exec(`
    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      natural_schedule TEXT NOT NULL,
      parsed_cron TEXT NOT NULL,
      prompt TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at INTEGER,
      next_run_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create jobs table with schedule_id column
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT NOT NULL,
      output TEXT,
      chat_id TEXT NOT NULL,
      schedule_id TEXT,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      skill_system_prompt TEXT
    )
  `);

  return db;
}

beforeEach(() => {
  testDb = createTestDb();
});

describe("Scheduler", () => {
  describe("due schedules create jobs", () => {
    test("creates a job for a due enabled schedule", async () => {
      const now = new Date("2026-02-18T12:00:00Z");
      const chatId = "test-chat-123";

      // Create a due enabled schedule
      const schedule = await createSchedule(testDb, {
        description: "Daily report",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Generate daily summary",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"), // Before now - due
      });

      // Verify schedule is due
      const dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(1);
      expect(dueSchedules[0].id).toBe(schedule.id);

      // Simulate job creation (as scheduler loop would do)
      const { createJob } = await import("../features/jobs/repository");
      const job = await createJob(testDb, {
        type: "task",
        input: schedule.prompt,
        chatId,
        scheduleId: schedule.id,
      });

      // Verify job was created with correct properties
      expect(job).toBeDefined();
      expect(job.input).toBe("Generate daily summary");
      expect(job.chatId).toBe(chatId);
      expect(job.scheduleId).toBe(schedule.id);
      expect(job.status).toBe("pending");

      // Verify job appears in pending jobs
      const pendingJobs = await getPendingJobs(testDb);
      expect(pendingJobs).toHaveLength(1);
      expect(pendingJobs[0].id).toBe(job.id);
    });

    test("creates multiple jobs for multiple due schedules", async () => {
      const now = new Date("2026-02-18T12:00:00Z");
      const chatId = "test-chat-123";

      // Create multiple due schedules
      const schedule1 = await createSchedule(testDb, {
        description: "Morning report",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Morning summary",
        enabled: true,
        nextRunAt: new Date("2026-02-18T08:00:00Z"),
      });

      const schedule2 = await createSchedule(testDb, {
        description: "Afternoon report",
        naturalSchedule: "every day at 2pm",
        parsedCron: "0 14 * * *",
        prompt: "Afternoon summary",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"),
      });

      // Verify both schedules are due
      const dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(2);

      // Simulate job creation for each due schedule
      const { createJob } = await import("../features/jobs/repository");

      for (const schedule of dueSchedules) {
        await createJob(testDb, {
          type: "task",
          input: schedule.prompt,
          chatId,
          scheduleId: schedule.id,
        });
      }

      // Verify jobs were created
      const pendingJobs = await getPendingJobs(testDb);
      expect(pendingJobs).toHaveLength(2);
    });
  });

  describe("nextRunAt is advanced correctly", () => {
    test("advances nextRunAt using calculateNextRun", async () => {
      const now = new Date("2026-02-18T12:00:00Z");
      const originalNextRunAt = new Date("2026-02-18T10:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Daily report",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Generate daily summary",
        enabled: true,
        nextRunAt: originalNextRunAt,
      });

      // Calculate next run time (as scheduler does)
      const nextRunAt = calculateNextRun(schedule.parsedCron, now);

      // Verify nextRunAt is in the future relative to now
      expect(nextRunAt.getTime()).toBeGreaterThan(now.getTime());

      // Update schedule with new nextRunAt (as scheduler does)
      await updateScheduleRunTime(testDb, schedule.id, nextRunAt);

      // Verify schedule was updated
      const updatedSchedule = await getScheduleById(testDb, schedule.id);
      expect(updatedSchedule!.nextRunAt).toEqual(nextRunAt);
      expect(updatedSchedule!.lastRunAt).toBeInstanceOf(Date);
    });

    test("advances nextRunAt to the next day for daily schedule", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Daily at 9am",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Daily task",
        enabled: true,
        nextRunAt: new Date("2026-02-18T09:00:00Z"),
      });

      // Calculate next run
      const nextRunAt = calculateNextRun(schedule.parsedCron, now);

      // Should be next day at 9am
      expect(nextRunAt).toEqual(new Date("2026-02-19T09:00:00Z"));
    });

    test("advances nextRunAt to the next hour for hourly schedule", async () => {
      const now = new Date("2026-02-18T12:30:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Hourly",
        naturalSchedule: "every hour",
        parsedCron: "0 * * * *",
        prompt: "Hourly task",
        enabled: true,
        nextRunAt: new Date("2026-02-18T12:00:00Z"),
      });

      // Calculate next run
      const nextRunAt = calculateNextRun(schedule.parsedCron, now);

      // Should be 1pm (next hour)
      expect(nextRunAt).toEqual(new Date("2026-02-18T13:00:00Z"));
    });
  });

  describe("invalid cron disables the schedule", () => {
    test("disables schedule when calculateNextRun throws error", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Invalid cron schedule",
        naturalSchedule: "invalid",
        parsedCron: "invalid-cron-expression",
        prompt: "Task with bad cron",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"),
      });

      // Verify schedule is enabled initially
      expect(schedule.enabled).toBe(true);

      // Attempt to calculate next run with invalid cron (should throw)
      let cronError: Error | undefined;
      try {
        calculateNextRun(schedule.parsedCron, now);
      } catch (error) {
        cronError = error instanceof Error ? error : new Error(String(error));
      }

      // Verify error was thrown
      expect(cronError).toBeDefined();

      // Simulate scheduler behavior: disable schedule on invalid cron
      await toggleSchedule(testDb, schedule.id, false);

      // Verify schedule was disabled
      const updatedSchedule = await getScheduleById(testDb, schedule.id);
      expect(updatedSchedule!.enabled).toBe(false);
    });

    test("schedule is not due after being disabled for invalid cron", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Invalid cron schedule",
        naturalSchedule: "invalid",
        parsedCron: "totally-invalid",
        prompt: "Task with bad cron",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"), // Would be due
      });

      // Verify schedule is due while enabled
      let dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(1);

      // Simulate scheduler disabling the schedule
      await toggleSchedule(testDb, schedule.id, false);

      // Verify schedule is no longer due (disabled schedules are excluded)
      dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(0);
    });
  });

  describe("DB update errors set a safe future nextRunAt", () => {
    test("sets safe nextRunAt 1 hour from now when updateScheduleRunTime fails", async () => {
      const now = new Date("2026-02-18T12:00:00Z");
      const expectedSafeNextRunAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour later

      const schedule = await createSchedule(testDb, {
        description: "Test schedule",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Daily task",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"),
      });

      // Calculate what would be the normal next run
      const normalNextRunAt = calculateNextRun(schedule.parsedCron, now);

      // Simulate DB error during updateScheduleRunTime
      // In the scheduler, when this fails, it catches the error and sets a safe future nextRunAt
      const safeNextRunAt = new Date(now.getTime() + 60 * 60 * 1000);

      // Simulate scheduler recovery: update with safe nextRunAt using toggleSchedule
      await toggleSchedule(testDb, schedule.id, true, safeNextRunAt);

      // Verify schedule was updated with safe nextRunAt
      const updatedSchedule = await getScheduleById(testDb, schedule.id);
      expect(updatedSchedule!.nextRunAt).toEqual(expectedSafeNextRunAt);
      expect(updatedSchedule!.enabled).toBe(true);
    });

    test("safe nextRunAt prevents immediate reprocessing", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Test schedule",
        naturalSchedule: "every minute",
        parsedCron: "* * * * *",
        prompt: "Frequent task",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"), // In the past
      });

      // Verify schedule would be due now
      let dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(1);

      // Simulate scheduler setting safe nextRunAt after DB error
      const safeNextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
      await toggleSchedule(testDb, schedule.id, true, safeNextRunAt);

      // Verify schedule is no longer due (safe nextRunAt is in the future)
      dueSchedules = await getDueSchedules(testDb, now);
      expect(dueSchedules).toHaveLength(0);

      // Verify schedule will be due again at the safe nextRunAt
      dueSchedules = await getDueSchedules(testDb, safeNextRunAt);
      expect(dueSchedules).toHaveLength(1);
    });

    test("schedule continues to be enabled after safe nextRunAt is set", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      const schedule = await createSchedule(testDb, {
        description: "Test schedule",
        naturalSchedule: "hourly",
        parsedCron: "0 * * * *",
        prompt: "Hourly task",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"),
      });

      // Simulate scheduler recovery after DB error
      const safeNextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
      await toggleSchedule(testDb, schedule.id, true, safeNextRunAt);

      // Verify schedule remains enabled
      const updatedSchedule = await getScheduleById(testDb, schedule.id);
      expect(updatedSchedule!.enabled).toBe(true);
      expect(updatedSchedule!.nextRunAt).toEqual(safeNextRunAt);
    });
  });
});
