import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";

// Import repository functions
import {
  saveMessage,
  getMessages,
  getMessagesSince,
  getMessagesBefore,
} from "./repository";

// Test database instance
let testDb: BunSQLiteDatabase<typeof schema>;

// Helper to create an in-memory test database
function createTestDb(): BunSQLiteDatabase<typeof schema> {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });

  // Create chat_messages table matching the schema
  sqlite.exec(`
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      content TEXT NOT NULL,
      sender TEXT NOT NULL,
      job_id TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  return db;
}

beforeEach(() => {
  testDb = createTestDb();
});

describe("Chat Repository", () => {
  describe("saveMessage()", () => {
    test("stores all fields correctly and returns the persisted record", async () => {
      const message = await saveMessage(testDb, {
        chatId: "test_chat_123",
        direction: "out",
        content: "Hello from dashboard",
        sender: "user",
      });

      expect(message.id).toBeString();
      expect(message.chatId).toBe("test_chat_123");
      expect(message.direction).toBe("out");
      expect(message.content).toBe("Hello from dashboard");
      expect(message.sender).toBe("user");
      expect(message.createdAt).toBeInstanceOf(Date);
    });

    test("stores message with jobId when provided", async () => {
      const message = await saveMessage(testDb, {
        chatId: "test_chat_123",
        direction: "out",
        content: "Task created",
        sender: "bot",
        jobId: "job-uuid-123",
      });

      expect(message.jobId).toBe("job-uuid-123");
    });
  });

  describe("getMessages()", () => {
    test("returns the last N messages in ascending createdAt order", async () => {
      const chatId = "test_chat_123";

      // Create 3 messages with delays
      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "First message",
        sender: "user",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(testDb, {
        chatId,
        direction: "in",
        content: "Second message",
        sender: "bot",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "Third message",
        sender: "user",
      });

      const messages = await getMessages(testDb, chatId, 2);

      expect(messages).toHaveLength(2);
      // Should return in chronological order: second, third
      expect(messages[0].content).toBe("Second message");
      expect(messages[1].content).toBe("Third message");
    });

    test("returns empty array when no messages exist", async () => {
      const messages = await getMessages(testDb, "non_existent_chat", 10);
      expect(messages).toHaveLength(0);
    });

    test("only returns messages for the specified chatId", async () => {
      await saveMessage(testDb, {
        chatId: "chat_1",
        direction: "out",
        content: "Message for chat 1",
        sender: "user",
      });
      await saveMessage(testDb, {
        chatId: "chat_2",
        direction: "out",
        content: "Message for chat 2",
        sender: "user",
      });

      const messages = await getMessages(testDb, "chat_1", 10);

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("Message for chat 1");
    });
  });

  describe("getMessagesSince()", () => {
    test("returns only messages strictly after the given timestamp, ordered asc", async () => {
      const chatId = "test_chat_123";

      const beforeTime = new Date();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "Message after time",
        sender: "user",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveMessage(testDb, {
        chatId,
        direction: "in",
        content: "Second message after",
        sender: "bot",
      });

      const messages = await getMessagesSince(testDb, chatId, beforeTime, 10);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("Message after time");
      expect(messages[1].content).toBe("Second message after");
      // Verify ascending order
      expect(messages[0].createdAt.getTime()).toBeLessThan(
        messages[1].createdAt.getTime()
      );
    });

    test("returns empty array when no messages since given time", async () => {
      const chatId = "test_chat_123";

      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "Old message",
        sender: "user",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));
      const futureTime = new Date();

      const messages = await getMessagesSince(testDb, chatId, futureTime, 10);
      expect(messages).toHaveLength(0);
    });
  });

  describe("getMessagesBefore()", () => {
    test("returns messages strictly before the given timestamp, ordered asc", async () => {
      const chatId = "test_chat_123";

      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "First old message",
        sender: "user",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveMessage(testDb, {
        chatId,
        direction: "in",
        content: "Second old message",
        sender: "bot",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const cutoffTime = new Date();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "New message",
        sender: "user",
      });

      const messages = await getMessagesBefore(testDb, chatId, cutoffTime, 10);

      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe("First old message");
      expect(messages[1].content).toBe("Second old message");
      // Verify ascending order
      expect(messages[0].createdAt.getTime()).toBeLessThan(
        messages[1].createdAt.getTime()
      );
    });

    test("returns empty array when no messages before given time", async () => {
      const chatId = "test_chat_123";

      const pastTime = new Date();
      await new Promise((resolve) => setTimeout(resolve, 10));

      await saveMessage(testDb, {
        chatId,
        direction: "out",
        content: "New message",
        sender: "user",
      });

      const messages = await getMessagesBefore(testDb, chatId, pastTime, 10);
      expect(messages).toHaveLength(0);
    });
  });
});
