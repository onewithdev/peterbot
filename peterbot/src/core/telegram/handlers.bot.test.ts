// Set env vars BEFORE any imports to ensure config module picks them up
process.env.TELEGRAM_BOT_TOKEN = "fake-token-for-testing";
process.env.TELEGRAM_CHAT_ID = "12345";
process.env.GOOGLE_API_KEY = "fake-google-key";
process.env.E2B_API_KEY = "fake-e2b-key";
process.env.DASHBOARD_PASSWORD = "fake-password";

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Bot } from "grammy";
import type { Update } from "grammy/types";

// Module mocks must be declared BEFORE any imports that transitively load handlers

// Mock repository functions
const mockCreateJob = mock(async (input: {
  type: string;
  input: string;
  chatId: string;
}) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: input.type,
  status: "pending",
  input: input.input,
  chatId: input.chatId,
  delivered: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

const mockGetJobsByChatId = mock(async (_chatId: string) => []);

const mockGetJobById = mock(async (_id: string) => undefined);

mock.module("../../features/jobs/repository", () => ({
  createJob: mockCreateJob,
  getJobsByChatId: mockGetJobsByChatId,
  getJobById: mockGetJobById,
}));

// Mock cron repository
const mockGetAllSchedules = mock(async () => []);
const mockCreateSchedule = mock(async (_input: unknown) => ({
  id: "sched-1234-e29b-41d4-a716-446655440000",
  description: "Every Monday at 9am",
  naturalSchedule: "every monday 9am",
  parsedCron: "0 9 * * 1",
  prompt: "send briefing",
  enabled: true,
  nextRunAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}));
const mockDeleteSchedule = mock(async (_id: string) => undefined);
const mockGetScheduleById = mock(async (_id: string) => undefined);

mock.module("../../features/cron/repository", () => ({
  getAllSchedules: mockGetAllSchedules,
  createSchedule: mockCreateSchedule,
  deleteSchedule: mockDeleteSchedule,
  getScheduleById: mockGetScheduleById,
}));

// Mock solutions repository
const mockGetAllSolutions = mock(async () => []);
const mockCreateSolution = mock(async (_input: unknown) => ({
  id: "sol-1234-e29b-41d4-a716-446655440000",
  jobId: "550e8400-e29b-41d4-a716-446655440000",
  title: "Test Solution",
  description: "Test description",
  tags: "[]",
  keywords: "",
  createdAt: new Date(),
  updatedAt: new Date(),
}));

mock.module("../../features/solutions/repository", () => ({
  getAllSolutions: mockGetAllSolutions,
  createSolution: mockCreateSolution,
}));

// Mock solutions similarity
const mockFindSimilarSolutions = mock(async (_db: unknown, _text: string) => []);
const mockExtractKeywords = mock((_text: string) => []);
const mockCalculateSimilarity = mock((_text1: string, _text2: string) => 0);

mock.module("../../features/solutions/similarity", () => ({
  findSimilarSolutions: mockFindSimilarSolutions,
  extractKeywords: mockExtractKeywords,
  calculateSimilarity: mockCalculateSimilarity,
}));

// Mock AI module
const mockGenerateText = mock(async () => ({
  text: "This is a quick AI response",
}));

const mockGenerateObject = mock(async () => ({
  object: {},
}));

mock.module("ai", () => ({
  generateText: mockGenerateText,
  generateObject: mockGenerateObject,
}));

// Mock AI client
mock.module("../../ai/client", () => ({
  getModel: mock(() => ({})),
}));

// Mock the db
mock.module("../../db", () => ({
  db: {},
}));

// Import setupHandlers dynamically after mocks are set up
// We use type-only import for the type, then dynamic import for the actual function
import type { setupHandlers as SetupHandlersType } from "./handlers";

/**
 * Create a test bot with API interceptor for capturing API calls.
 */
async function createTestBot() {
  const { setupHandlers } = await import("./handlers");

  const bot = new Bot("fake-token-for-testing", {
    botInfo: {
      id: 1,
      is_bot: true,
      first_name: "TestBot",
      username: "testbot",
      can_join_groups: false,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
    },
  });

  const apiCalls: Array<{ method: string; payload: unknown }> = [];

  // Wire the API interceptor
  bot.api.config.use((prev, method, payload, signal) => {
    apiCalls.push({ method, payload });

    // Return appropriate mock responses based on method
    if (method === "sendMessage") {
      return {
        ok: true,
        result: {
          message_id: 1,
          chat: { id: 12345, type: "private" as const },
          date: Math.floor(Date.now() / 1000),
          text: "",
        },
      } as any;
    }

    if (method === "answerCallbackQuery") {
      return { ok: true, result: true } as any;
    }

    // Default response for other methods
    return { ok: true, result: true } as any;
  });

  // Setup handlers
  setupHandlers(bot);

  return {
    bot,
    getApiCalls: () => apiCalls,
    clearApiCalls: () => {
      apiCalls.length = 0;
    },
  };
}

/**
 * Create a Grammy-compatible message update.
 * For commands, entities array must be provided for grammy to recognize them.
 */
function makeMessageUpdate(text: string, chatId = 12345): Update {
  const now = Math.floor(Date.now() / 1000);
  const isCommand = text.startsWith("/");
  
  return {
    update_id: Math.floor(Math.random() * 1000000),
    message: {
      message_id: Math.floor(Math.random() * 1000000),
      from: {
        id: chatId,
        is_bot: false,
        first_name: "TestUser",
      },
      chat: {
        id: chatId,
        type: "private",
      },
      date: now,
      text,
      ...(isCommand && {
        entities: [{
          type: "bot_command" as const,
          offset: 0,
          length: text.split(" ")[0].length,
        }],
      }),
    },
  };
}

/**
 * Create a Grammy-compatible callback query update.
 */
function makeCallbackUpdate(
  data: string,
  messageDate: number,
  chatId = 12345
): Update {
  return {
    update_id: Math.floor(Math.random() * 1000000),
    callback_query: {
      id: `callback_${Math.floor(Math.random() * 1000000)}`,
      from: {
        id: chatId,
        is_bot: false,
        first_name: "TestUser",
      },
      message: {
        message_id: Math.floor(Math.random() * 1000000),
        from: {
          id: 1,
          is_bot: true,
          first_name: "TestBot",
          username: "testbot",
        },
        chat: {
          id: chatId,
          type: "private",
        },
        date: messageDate,
        text: "Test message",
      },
      chat_instance: "test_chat_instance",
      data,
    },
  };
}

describe("bot-level harness smoke test", () => {
  // Use a lazy initialization pattern since we need async setup
  let bot: Bot;
  let getApiCalls: () => Array<{ method: string; payload: unknown }>;
  let clearApiCalls: () => void;

  beforeEach(async () => {
    const testBot = await createTestBot();
    bot = testBot.bot;
    getApiCalls = testBot.getApiCalls;
    clearApiCalls = testBot.clearApiCalls;
    clearApiCalls();
  });

  test("dispatch /start via handleUpdate and verify sendMessage with peterbot", async () => {
    await bot.handleUpdate(makeMessageUpdate("/start"));

    const calls = getApiCalls();
    const sendMessageCalls = calls.filter(
      (call) => call.method === "sendMessage"
    );

    expect(sendMessageCalls.length).toBeGreaterThanOrEqual(1);
    expect(sendMessageCalls[0].payload).toMatchObject({
      chat_id: 12345,
    });

    // Check that the text contains "peterbot"
    const text = (sendMessageCalls[0].payload as any).text;
    expect(text).toContain("peterbot");
  });

  test("dispatch /help command", async () => {
    await bot.handleUpdate(makeMessageUpdate("/help"));

    const calls = getApiCalls();
    const sendMessageCalls = calls.filter(
      (call) => call.method === "sendMessage"
    );

    expect(sendMessageCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("dispatch /status command", async () => {
    await bot.handleUpdate(makeMessageUpdate("/status"));

    const calls = getApiCalls();
    const sendMessageCalls = calls.filter(
      (call) => call.method === "sendMessage"
    );

    expect(sendMessageCalls.length).toBeGreaterThanOrEqual(1);
  });

  test("makeCallbackUpdate creates valid update structure", () => {
    const now = Math.floor(Date.now() / 1000);
    const update = makeCallbackUpdate("test_action", now);

    expect(update.callback_query).toBeDefined();
    expect(update.callback_query?.data).toBe("test_action");
    expect(update.callback_query?.message?.date).toBe(now);
  });

  test("makeMessageUpdate creates valid update structure", () => {
    const update = makeMessageUpdate("Hello bot");

    expect(update.message).toBeDefined();
    expect(update.message?.text).toBe("Hello bot");
    expect(update.message?.chat.id).toBe(12345);
  });
});
