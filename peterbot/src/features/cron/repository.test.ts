import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { NewSchedule } from "./schema";

// Import repository functions
import {
  createSchedule,
  getAllSchedules,
  getScheduleById,
  getDueSchedules,
  toggleSchedule,
  updateScheduleRunTime,
  deleteSchedule,
} from "./repository";

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
      retry_count INTEGER NOT NULL DEFAULT 0
    )
  `);

  return db;
}

beforeEach(() => {
  testDb = createTestDb();
});

describe("Cron Repository", () => {
  describe("createSchedule()", () => {
    test("creates a schedule with all required fields", async () => {
      const input: NewSchedule = {
        description: "Daily morning report",
        naturalSchedule: "every day at 9am",
        parsedCron: "0 9 * * *",
        prompt: "Generate a daily summary",
        nextRunAt: new Date("2026-02-19T09:00:00Z"),
      };

      const schedule = await createSchedule(testDb, input);

      expect(schedule.id).toBeString();
      expect(schedule.description).toBe("Daily morning report");
      expect(schedule.naturalSchedule).toBe("every day at 9am");
      expect(schedule.parsedCron).toBe("0 9 * * *");
      expect(schedule.prompt).toBe("Generate a daily summary");
      expect(schedule.enabled).toBe(true);
      expect(schedule.nextRunAt).toBeInstanceOf(Date);
      expect(schedule.createdAt).toBeInstanceOf(Date);
      expect(schedule.updatedAt).toBeInstanceOf(Date);
    });

    test("creates a disabled schedule when enabled is false", async () => {
      const input: NewSchedule = {
        description: "Weekly backup",
        naturalSchedule: "every Sunday at midnight",
        parsedCron: "0 0 * * 0",
        prompt: "Run backup",
        enabled: false,
        nextRunAt: new Date("2026-02-22T00:00:00Z"),
      };

      const schedule = await createSchedule(testDb, input);

      expect(schedule.enabled).toBe(false);
    });
  });

  describe("getAllSchedules()", () => {
    test("returns all schedules ordered by createdAt desc", async () => {
      await createSchedule(testDb, {
        description: "First schedule",
        naturalSchedule: "daily",
        parsedCron: "0 0 * * *",
        prompt: "Task 1",
        nextRunAt: new Date(),
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createSchedule(testDb, {
        description: "Second schedule",
        naturalSchedule: "weekly",
        parsedCron: "0 0 * * 1",
        prompt: "Task 2",
        nextRunAt: new Date(),
      });

      const results = await getAllSchedules(testDb);

      expect(results).toHaveLength(2);
      expect(results[0].description).toBe("Second schedule");
      expect(results[1].description).toBe("First schedule");
    });

    test("returns empty array when no schedules exist", async () => {
      const results = await getAllSchedules(testDb);
      expect(results).toHaveLength(0);
    });
  });

  describe("getScheduleById()", () => {
    test("returns the correct schedule by ID", async () => {
      const created = await createSchedule(testDb, {
        description: "Test schedule",
        naturalSchedule: "hourly",
        parsedCron: "0 * * * *",
        prompt: "Hourly task",
        nextRunAt: new Date(),
      });

      const fetched = await getScheduleById(testDb, created.id);

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.description).toBe("Test schedule");
    });

    test("returns undefined for non-existent ID", async () => {
      const fetched = await getScheduleById(testDb, "non-existent-uuid");
      expect(fetched).toBeUndefined();
    });
  });

  describe("getDueSchedules()", () => {
    test("returns only enabled schedules with nextRunAt <= now", async () => {
      const now = new Date("2026-02-18T12:00:00Z");

      // Create a due enabled schedule
      await createSchedule(testDb, {
        description: "Due enabled",
        naturalSchedule: "daily",
        parsedCron: "0 9 * * *",
        prompt: "Task 1",
        enabled: true,
        nextRunAt: new Date("2026-02-18T10:00:00Z"), // Before now
      });

      // Create a due but disabled schedule
      await createSchedule(testDb, {
        description: "Due disabled",
        naturalSchedule: "daily",
        parsedCron: "0 9 * * *",
        prompt: "Task 2",
        enabled: false,
        nextRunAt: new Date("2026-02-18T10:00:00Z"), // Before now
      });

      // Create an enabled schedule not due yet
      await createSchedule(testDb, {
        description: "Not due",
        naturalSchedule: "daily",
        parsedCron: "0 9 * * *",
        prompt: "Task 3",
        enabled: true,
        nextRunAt: new Date("2026-02-18T14:00:00Z"), // After now
      });

      const results = await getDueSchedules(testDb, now);

      expect(results).toHaveLength(1);
      expect(results[0].description).toBe("Due enabled");
    });
  });

  describe("toggleSchedule()", () => {
    test("enables a disabled schedule", async () => {
      const schedule = await createSchedule(testDb, {
        description: "Toggle test",
        naturalSchedule: "daily",
        parsedCron: "0 0 * * *",
        prompt: "Task",
        enabled: false,
        nextRunAt: new Date(),
      });
      const originalUpdatedAt = schedule.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await toggleSchedule(testDb, schedule.id, true);

      const updated = await getScheduleById(testDb, schedule.id);
      expect(updated!.enabled).toBe(true);
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      );
    });

    test("disables an enabled schedule", async () => {
      const schedule = await createSchedule(testDb, {
        description: "Toggle test",
        naturalSchedule: "daily",
        parsedCron: "0 0 * * *",
        prompt: "Task",
        enabled: true,
        nextRunAt: new Date(),
      });

      await toggleSchedule(testDb, schedule.id, false);

      const updated = await getScheduleById(testDb, schedule.id);
      expect(updated!.enabled).toBe(false);
    });
  });

  describe("updateScheduleRunTime()", () => {
    test("updates lastRunAt and nextRunAt", async () => {
      const schedule = await createSchedule(testDb, {
        description: "Run time test",
        naturalSchedule: "daily",
        parsedCron: "0 0 * * *",
        prompt: "Task",
        nextRunAt: new Date("2026-02-18T00:00:00Z"),
      });

      const newNextRunAt = new Date("2026-02-19T00:00:00Z");
      await updateScheduleRunTime(testDb, schedule.id, newNextRunAt);

      const updated = await getScheduleById(testDb, schedule.id);
      expect(updated!.lastRunAt).toBeInstanceOf(Date);
      expect(updated!.nextRunAt).toEqual(newNextRunAt);
    });
  });

  describe("deleteSchedule()", () => {
    test("deletes the schedule by ID", async () => {
      const schedule = await createSchedule(testDb, {
        description: "To be deleted",
        naturalSchedule: "daily",
        parsedCron: "0 0 * * *",
        prompt: "Task",
        nextRunAt: new Date(),
      });

      await deleteSchedule(testDb, schedule.id);

      const fetched = await getScheduleById(testDb, schedule.id);
      expect(fetched).toBeUndefined();
    });
  });
});
