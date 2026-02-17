import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import { createJobSchema, jobIdSchema } from "./validators";
import { formatJobsForStatus, formatAge, formatJob } from "./service";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Job } from "./schema";

// Import repository functions - we'll test these directly
import {
  createJob,
  getJobById,
  getJobsByChatId,
  getPendingJobs,
  getUndeliveredJobs,
  markJobRunning,
  markJobCompleted,
  markJobFailed,
  markJobDelivered,
} from "./repository";

// Test database instance
let testDb: BunSQLiteDatabase<typeof schema>;

// Helper to create an in-memory test database
function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create jobs table matching the schema
  sqlite.exec(`
    CREATE TABLE jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT NOT NULL,
      output TEXT,
      chat_id TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  return db;
}

// Mock the db module to use our test database
beforeEach(() => {
  testDb = createTestDb();
  // Override the db export for each test
  // We use a dynamic import pattern to allow mocking
});

describe("Jobs Repository", () => {
  describe("createJob()", () => {
    test("applies default values correctly", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job input",
        chatId: "chat-123",
      });

      expect(job.id).toBeString();
      expect(job.type).toBe("task");
      expect(job.status).toBe("pending");
      expect(job.input).toBe("Test job input");
      expect(job.output).toBeNull();
      expect(job.chatId).toBe("chat-123");
      expect(job.delivered).toBe(false);
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    test("creates job with 'quick' type", async () => {
      const job = await createJob(testDb, {
        type: "quick",
        input: "Quick question",
        chatId: "chat-456",
      });

      expect(job.type).toBe("quick");
      expect(job.status).toBe("pending");
    });
  });

  describe("getJobById()", () => {
    test("returns correct job", async () => {
      const inserted = await createJob(testDb, {
        type: "quick",
        input: "Quick test",
        chatId: "chat-456",
      });

      const fetched = await getJobById(testDb, inserted.id);

      expect(fetched).toBeDefined();
      expect(fetched!.id).toBe(inserted.id);
      expect(fetched!.input).toBe("Quick test");
      expect(fetched!.type).toBe("quick");
    });

    test("returns undefined for non-existent ID", async () => {
      const fetched = await getJobById(testDb, "non-existent-uuid");
      expect(fetched).toBeUndefined();
    });
  });

  describe("getJobsByChatId()", () => {
    test("filters by chatId and orders by newest first", async () => {
      const chatId = "chat-789";

      // Insert multiple jobs for the same chat
      await createJob(testDb, { chatId, input: "First", type: "task" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createJob(testDb, { chatId, input: "Second", type: "task" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await createJob(testDb, { chatId, input: "Third", type: "task" });
      await createJob(testDb, { chatId: "other-chat", input: "Other", type: "task" });

      const results = await getJobsByChatId(testDb, chatId);

      expect(results).toHaveLength(3);
      expect(results[0].input).toBe("Third");
      expect(results[1].input).toBe("Second");
      expect(results[2].input).toBe("First");
    });

    test("limits results to 20", async () => {
      const chatId = "chat-limit";

      // Insert 25 jobs
      for (let i = 0; i < 25; i++) {
        await createJob(testDb, { chatId, input: `Job ${i}`, type: "task" });
      }

      const results = await getJobsByChatId(testDb, chatId);

      expect(results).toHaveLength(20);
    });
  });

  describe("getPendingJobs()", () => {
    test("filters only pending status", async () => {
      const pending1 = await createJob(testDb, {
        status: "pending",
        input: "Pending 1",
        type: "task",
        chatId: "chat-1",
      } as any);

      const running = await createJob(testDb, {
        type: "task",
        input: "Running 1",
        chatId: "chat-2",
      });
      await markJobRunning(testDb, running.id);

      const pending2 = await createJob(testDb, {
        status: "pending",
        input: "Pending 2",
        type: "task",
        chatId: "chat-3",
      } as any);

      const completed = await createJob(testDb, {
        type: "task",
        input: "Completed 1",
        chatId: "chat-4",
      });
      await markJobCompleted(testDb, completed.id, "Done");

      const results = await getPendingJobs(testDb);

      expect(results).toHaveLength(2);
      expect(results.every((j) => j.status === "pending")).toBe(true);
    });

    test("respects limit parameter", async () => {
      for (let i = 0; i < 10; i++) {
        await createJob(testDb, {
          status: "pending",
          input: `Job ${i}`,
          type: "task",
          chatId: `chat-${i}`,
        } as any);
      }

      const results = await getPendingJobs(testDb, 5);

      expect(results).toHaveLength(5);
    });
  });

  describe("getUndeliveredJobs()", () => {
    test("filters completed jobs where delivered is false", async () => {
      const undelivered = await createJob(testDb, {
        type: "task",
        input: "Completed undelivered",
        chatId: "chat-1",
      });
      await markJobCompleted(testDb, undelivered.id, "Result");

      const delivered = await createJob(testDb, {
        type: "task",
        input: "Completed delivered",
        chatId: "chat-2",
      });
      await markJobCompleted(testDb, delivered.id, "Result");
      await markJobDelivered(testDb, delivered.id);

      const running = await createJob(testDb, {
        type: "task",
        input: "Running",
        chatId: "chat-3",
      });
      await markJobRunning(testDb, running.id);

      const failed = await createJob(testDb, {
        type: "task",
        input: "Failed",
        chatId: "chat-4",
      });
      await markJobFailed(testDb, failed.id, "Error");

      const results = await getUndeliveredJobs(testDb);

      expect(results).toHaveLength(1);
      expect(results[0].input).toBe("Completed undelivered");
      expect(results[0].delivered).toBe(false);
    });
  });

  describe("markJobRunning()", () => {
    test("updates status to running and timestamp", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job",
        chatId: "chat-123",
      });
      const originalUpdatedAt = job.updatedAt;

      await new Promise((resolve) => setTimeout(resolve, 10));
      await markJobRunning(testDb, job.id);

      const updated = await getJobById(testDb, job.id);
      expect(updated!.status).toBe("running");
      expect(updated!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });

  describe("markJobCompleted()", () => {
    test("sets status to completed and stores output", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job",
        chatId: "chat-123",
      });
      await markJobRunning(testDb, job.id);

      await markJobCompleted(testDb, job.id, "Task completed successfully");

      const updated = await getJobById(testDb, job.id);
      expect(updated!.status).toBe("completed");
      expect(updated!.output).toBe("Task completed successfully");
    });
  });

  describe("markJobFailed()", () => {
    test("sets status to failed and stores error", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job",
        chatId: "chat-123",
      });
      await markJobRunning(testDb, job.id);

      await markJobFailed(testDb, job.id, "Error: Something went wrong");

      const updated = await getJobById(testDb, job.id);
      expect(updated!.status).toBe("failed");
      expect(updated!.output).toBe("Error: Something went wrong");
    });
  });

  describe("markJobDelivered()", () => {
    test("sets delivered to true", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job",
        chatId: "chat-123",
      });
      await markJobCompleted(testDb, job.id, "Result");

      await markJobDelivered(testDb, job.id);

      const updated = await getJobById(testDb, job.id);
      expect(updated!.delivered).toBe(true);
    });

    test("completed jobs with delivered: true are excluded from undelivered query", async () => {
      const undelivered = await createJob(testDb, {
        type: "task",
        input: "Undelivered",
        chatId: "chat-1",
      });
      await markJobCompleted(testDb, undelivered.id, "Result");

      const delivered = await createJob(testDb, {
        type: "task",
        input: "Delivered",
        chatId: "chat-2",
      });
      await markJobCompleted(testDb, delivered.id, "Result");
      await markJobDelivered(testDb, delivered.id);

      const results = await getUndeliveredJobs(testDb);

      expect(results).toHaveLength(1);
      expect(results[0].input).toBe("Undelivered");
    });
  });

  describe("Edge Cases", () => {
    test("updatedAt changes on every update operation", async () => {
      const job = await createJob(testDb, {
        type: "task",
        input: "Test job",
        chatId: "chat-123",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      await markJobRunning(testDb, job.id);

      const afterFirstUpdate = await getJobById(testDb, job.id);
      const firstUpdateTime = afterFirstUpdate!.updatedAt.getTime();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await markJobCompleted(testDb, job.id, "Done");

      const afterSecondUpdate = await getJobById(testDb, job.id);
      const secondUpdateTime = afterSecondUpdate!.updatedAt.getTime();

      expect(secondUpdateTime).toBeGreaterThan(firstUpdateTime);
    });

    test("multiple jobs with different statuses are filtered correctly", async () => {
      const chatId = "multi-status-chat";

      const pending = await createJob(testDb, {
        type: "task",
        input: "Pending",
        chatId,
      });

      const running = await createJob(testDb, {
        type: "task",
        input: "Running",
        chatId,
      });
      await markJobRunning(testDb, running.id);

      const completed = await createJob(testDb, {
        type: "task",
        input: "Completed",
        chatId,
      });
      await markJobCompleted(testDb, completed.id, "Done");

      const failed = await createJob(testDb, {
        type: "task",
        input: "Failed",
        chatId,
      });
      await markJobFailed(testDb, failed.id, "Error");

      const allJobs = await getJobsByChatId(testDb, chatId);
      expect(allJobs).toHaveLength(4);

      const pendingJobs = allJobs.filter((j) => j.status === "pending");
      const runningJobs = allJobs.filter((j) => j.status === "running");
      const completedJobs = allJobs.filter((j) => j.status === "completed");
      const failedJobs = allJobs.filter((j) => j.status === "failed");

      expect(pendingJobs).toHaveLength(1);
      expect(runningJobs).toHaveLength(1);
      expect(completedJobs).toHaveLength(1);
      expect(failedJobs).toHaveLength(1);
    });
  });
});

describe("Validators", () => {
  describe("createJobSchema", () => {
    test("accepts valid 'task' type input", () => {
      const result = createJobSchema.safeParse({
        type: "task",
        input: "Do something important",
        chatId: "chat-123",
      });
      expect(result.success).toBe(true);
    });

    test("accepts valid 'quick' type input", () => {
      const result = createJobSchema.safeParse({
        type: "quick",
        input: "Quick question",
        chatId: "chat-456",
      });
      expect(result.success).toBe(true);
    });

    test("rejects invalid type", () => {
      const result = createJobSchema.safeParse({
        type: "invalid",
        input: "Some input",
        chatId: "chat-123",
      });
      expect(result.success).toBe(false);
    });

    test("rejects empty input string", () => {
      const result = createJobSchema.safeParse({
        type: "task",
        input: "",
        chatId: "chat-123",
      });
      expect(result.success).toBe(false);
    });

    test("rejects oversized input", () => {
      const result = createJobSchema.safeParse({
        type: "task",
        input: "a".repeat(10001),
        chatId: "chat-123",
      });
      expect(result.success).toBe(false);
    });

    test("rejects missing fields", () => {
      const result = createJobSchema.safeParse({
        type: "task",
      });
      expect(result.success).toBe(false);
    });

    test("rejects empty chatId", () => {
      const result = createJobSchema.safeParse({
        type: "task",
        input: "Valid input",
        chatId: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("jobIdSchema", () => {
    test("accepts valid UUID", () => {
      const result = jobIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
      expect(result.success).toBe(true);
    });

    test("rejects invalid UUID format", () => {
      const result = jobIdSchema.safeParse("not-a-uuid");
      expect(result.success).toBe(false);
    });

    test("rejects empty string", () => {
      const result = jobIdSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    test("rejects UUID with wrong length", () => {
      const result = jobIdSchema.safeParse("550e8400-e29b-41d4-a716");
      expect(result.success).toBe(false);
    });
  });
});

describe("Service Formatting", () => {
  describe("formatJobsForStatus", () => {
    test("returns helpful message for empty job array", () => {
      const message = formatJobsForStatus([]);
      expect(message).toContain("No jobs found");
      expect(message).toContain("📭");
    });

    test("groups jobs by status", () => {
      const now = new Date();
      const testJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "running",
          input: "Running job",
          output: null,
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          type: "task",
          status: "pending",
          input: "Pending job",
          output: null,
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440003",
          type: "task",
          status: "completed",
          input: "Completed job",
          output: "Result",
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440004",
          type: "task",
          status: "failed",
          input: "Failed job",
          output: "Error message",
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const message = formatJobsForStatus(testJobs);

      expect(message).toContain("Running (1)");
      expect(message).toContain("Pending (1)");
      expect(message).toContain("Completed (1)");
      expect(message).toContain("Failed (1)");
      expect(message).toContain("🔄");
      expect(message).toContain("⏳");
      expect(message).toContain("✅");
      expect(message).toContain("❌");
    });

    test("includes action hints for completed jobs", () => {
      const now = new Date();
      const testJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "completed",
          input: "Completed job",
          output: "Result",
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const message = formatJobsForStatus(testJobs);

      expect(message).toContain("get 550e8400");
    });

    test("includes action hints for failed jobs", () => {
      const now = new Date();
      const testJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "failed",
          input: "Failed job",
          output: "Error",
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const message = formatJobsForStatus(testJobs);

      expect(message).toContain("retry 550e8400");
    });

    test("truncates job preview at 60 characters", () => {
      const now = new Date();
      const longInput = "a".repeat(100);
      const testJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "pending",
          input: longInput,
          output: null,
          chatId: "chat-1",
          delivered: false,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const message = formatJobsForStatus(testJobs);

      expect(message).toContain("a".repeat(60) + "...");
      expect(message).not.toContain("a".repeat(61));
    });
  });

  describe("formatAge", () => {
    test("returns 'just now' for recent jobs", () => {
      const now = new Date();
      expect(formatAge(now)).toBe("just now");
    });

    test("returns minutes ago for jobs < 1 hour", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(formatAge(fiveMinutesAgo)).toBe("5min ago");
    });

    test("returns hours ago for jobs < 1 day", () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      expect(formatAge(threeHoursAgo)).toBe("3h ago");
    });

    test("returns days ago for older jobs", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(formatAge(twoDaysAgo)).toBe("2d ago");
    });
  });

  describe("formatJob", () => {
    test("formats pending job correctly", () => {
      const now = new Date();
      const job: Job = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "pending",
        input: "Test job",
        output: null,
        chatId: "chat-1",
        delivered: false,
        createdAt: now,
        updatedAt: now,
      };

      const formatted = formatJob(job);

      expect(formatted).toContain("⏳");
      expect(formatted).toContain("550e8400");
      expect(formatted).toContain("Test job");
    });

    test("formats running job correctly", () => {
      const now = new Date();
      const job: Job = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "running",
        input: "Test job",
        output: null,
        chatId: "chat-1",
        delivered: false,
        createdAt: now,
        updatedAt: now,
      };

      const formatted = formatJob(job);

      expect(formatted).toContain("🔄");
    });

    test("formats completed job with action hint", () => {
      const now = new Date();
      const job: Job = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "completed",
        input: "Test job",
        output: "Result",
        chatId: "chat-1",
        delivered: false,
        createdAt: now,
        updatedAt: now,
      };

      const formatted = formatJob(job);

      expect(formatted).toContain("✅");
      expect(formatted).toContain("get 550e8400");
    });

    test("formats failed job with retry hint", () => {
      const now = new Date();
      const job: Job = {
        id: "550e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "failed",
        input: "Test job",
        output: "Error message",
        chatId: "chat-1",
        delivered: false,
        createdAt: now,
        updatedAt: now,
      };

      const formatted = formatJob(job);

      expect(formatted).toContain("❌");
      expect(formatted).toContain("retry 550e8400");
    });
  });
});
