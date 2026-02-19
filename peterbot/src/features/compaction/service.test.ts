import {
  describe,
  test,
  expect,
  beforeEach,
  mock,
} from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { Job } from "../jobs/schema";

// Track mock calls
const mockGenerateTextCalls: { prompt: string }[] = [];

// Mock the ai module
mock.module("ai", () => ({
  generateText: mock(async ({ prompt }: { prompt: string }) => {
    mockGenerateTextCalls.push({ prompt });
    return { text: `Mocked summary for: ${prompt.slice(0, 50)}...` };
  }),
}));

// Import service functions after mocking
import {
  generateCompactionSummary,
  checkAndCompact,
} from "./service";

// Import repository functions
import {
  getOrCreateChatState,
  incrementMessageCount,
  getAllSessions,
  setConfig,
} from "./repository";

// Test database instance
let testDb: BunSQLiteDatabase<typeof schema>;

// Helper to create an in-memory test database
function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create chat_state table
  sqlite.exec(`
    CREATE TABLE chat_state (
      chat_id TEXT PRIMARY KEY,
      message_count INTEGER NOT NULL DEFAULT 0,
      latest_summary TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create sessions table
  sqlite.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      trigger_job_id TEXT,
      message_count INTEGER NOT NULL,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create config table
  sqlite.exec(`
    CREATE TABLE config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create jobs table for querying completed jobs
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

// Helper to insert a completed job
async function insertCompletedJob(
  db: BunSQLiteDatabase<typeof schema>,
  chatId: string,
  input: string,
  output: string
): Promise<Job> {
  const now = Date.now();
  const id = crypto.randomUUID();
  const sqlite = (db as any).$client as Database;
  
  sqlite.exec(`
    INSERT INTO jobs (id, type, status, input, output, chat_id, delivered, created_at, updated_at, retry_count)
    VALUES ('${id}', 'task', 'completed', '${input.replace(/'/g, "''")}', '${output.replace(/'/g, "''")}', '${chatId}', 0, ${now}, ${now}, 0)
  `);

  return {
    id,
    type: "task",
    status: "completed",
    input,
    output,
    chatId,
    delivered: false,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
}

beforeEach(() => {
  testDb = createTestDb();
  mockGenerateTextCalls.length = 0; // Clear mock calls
});

describe("Compaction Service", () => {
  describe("generateCompactionSummary()", () => {
    test("returns a summary string from generateText", async () => {
      const jobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "completed",
          input: "What is the weather?",
          output: "It's sunny today.",
          chatId: "chat-123",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const summary = await generateCompactionSummary(jobs);

      expect(summary).toBeString();
      expect(summary).toContain("Mocked summary");
    });

    test("passes job inputs and outputs to generateText prompt", async () => {
      const jobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "completed",
          input: "First question",
          output: "First answer",
          chatId: "chat-123",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "550e8400-e29b-41d4-a716-446655440002",
          type: "task",
          status: "completed",
          input: "Second question",
          output: "Second answer",
          chatId: "chat-123",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      await generateCompactionSummary(jobs);

      // The prompt should contain job inputs and outputs
      expect(mockGenerateTextCalls.length).toBeGreaterThan(0);
      const prompt = mockGenerateTextCalls[0].prompt;
      expect(prompt).toContain("First question");
      expect(prompt).toContain("First answer");
      expect(prompt).toContain("Second question");
      expect(prompt).toContain("Second answer");
    });
  });

  describe("checkAndCompact() - below threshold", () => {
    test("does not save session when message count is below threshold", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set up initial state with message_count = 18
      await getOrCreateChatState(testDb, chatId);
      // Increment to reach 18
      for (let i = 0; i < 18; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Call checkAndCompact
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify no session was saved
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(0);

      // Verify latest_summary remains null
      const state = await getOrCreateChatState(testDb, chatId);
      expect(state.latestSummary).toBeNull();
    });
  });

  describe("checkAndCompact() - threshold reached", () => {
    test("saves session and resets count when threshold is reached", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Insert completed jobs
      for (let i = 0; i < 20; i++) {
        await insertCompletedJob(testDb, chatId, `Job ${i} input`, `Job ${i} output`);
      }

      // Increment message count to 19, so next increment hits 20
      for (let i = 0; i < 19; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Call checkAndCompact - this should trigger compaction
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify session was saved
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].chatId).toBe(chatId);
      expect(sessions[0].triggerJobId).toBe(triggerJobId);
      expect(sessions[0].messageCount).toBe(20);
      expect(sessions[0].summary).toContain("Mocked summary");

      // Verify latest_summary was updated
      const state = await getOrCreateChatState(testDb, chatId);
      expect(state.latestSummary).toContain("Mocked summary");

      // Verify message_count was reset
      expect(state.messageCount).toBe(0);
    });

    test("handles jobs without output gracefully", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Insert a job without output
      const sqlite = (testDb as any).$client as Database;
      const now = Date.now();
      const id = crypto.randomUUID();
      sqlite.exec(`
        INSERT INTO jobs (id, type, status, input, output, chat_id, delivered, created_at, updated_at, retry_count)
        VALUES ('${id}', 'task', 'completed', 'Input without output', NULL, '${chatId}', 0, ${now}, ${now}, 0)
      `);

      // Set message count to trigger threshold
      for (let i = 0; i < 20; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Should not throw
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify session was saved
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(1);
    });
  });

  describe("checkAndCompact() - custom threshold", () => {
    test("uses custom threshold from config", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set custom threshold of 5
      await setConfig(testDb, "compaction_threshold", "5");

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Insert completed jobs
      for (let i = 0; i < 5; i++) {
        await insertCompletedJob(testDb, chatId, `Job ${i}`, `Output ${i}`);
      }

      // Increment message count to 4, so next increment hits 5
      for (let i = 0; i < 4; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Call checkAndCompact - this should trigger compaction at count 5
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify session was saved with custom threshold
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].messageCount).toBe(5);
    });

    test("does not compact when below custom threshold", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set custom threshold of 10
      await setConfig(testDb, "compaction_threshold", "10");

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Insert completed jobs
      for (let i = 0; i < 10; i++) {
        await insertCompletedJob(testDb, chatId, `Job ${i}`, `Output ${i}`);
      }

      // Increment message count to 8 (below threshold of 10)
      for (let i = 0; i < 8; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Call checkAndCompact - this should NOT trigger compaction
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify no session was saved
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(0);
    });
  });

  describe("checkAndCompact() - error handling", () => {
    test("does not throw when compaction fails", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Set message count to trigger threshold
      for (let i = 0; i < 20; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Should not throw even without any completed jobs
      await expect(checkAndCompact(testDb, chatId, triggerJobId)).resolves.toBeUndefined();
    });
  });

  describe("checkAndCompact() - no completed jobs", () => {
    test("returns early when no completed jobs exist", async () => {
      const chatId = "chat-123";
      const triggerJobId = "job-456";

      // Set up initial state
      await getOrCreateChatState(testDb, chatId);

      // Set message count to trigger threshold but no completed jobs
      for (let i = 0; i < 20; i++) {
        await incrementMessageCount(testDb, chatId);
      }

      // Call checkAndCompact - should return early without error
      await checkAndCompact(testDb, chatId, triggerJobId);

      // Verify no session was saved
      const sessions = await getAllSessions(testDb);
      expect(sessions).toHaveLength(0);
    });
  });
});
