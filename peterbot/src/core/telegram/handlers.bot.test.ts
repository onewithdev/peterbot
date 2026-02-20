import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Bot } from "grammy";
import type { Update } from "grammy/types";

// Module mocks must be declared BEFORE any imports that transitively load handlers

// Mock config FIRST (before handlers imports it)
mock.module("../../shared/config.js", () => ({
  config: {
    telegramBotToken: "fake-token-for-testing",
    telegramChatId: "12345",
    openaiApiKey: "fake-api-key",
    port: 3000,
    sqliteDbPath: ":memory:",
    model: "test-model",
    googleApiKey: "fake-google-key",
    e2bApiKey: "fake-e2b-key",
    dashboardPassword: "fake-password",
  },
  requireEnv: (key: string) => process.env[key] || "",
  getOptionalEnv: (_key: string, defaultValue: string) => defaultValue,
}));

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

mock.module("../../features/jobs/schedules/repository", () => ({
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

mock.module("../../features/jobs/solutions/repository", () => ({
  getAllSolutions: mockGetAllSolutions,
  createSolution: mockCreateSolution,
}));

// Mock solutions similarity
const mockFindSimilarSolutions = mock(async (_db: unknown, _text: string) => []);
const mockExtractKeywords = mock((_text: string) => []);
const mockCalculateSimilarity = mock((_text1: string, _text2: string) => 0);

mock.module("../../features/jobs/solutions/similarity", () => ({
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

// Mock solutions service
mock.module("../../features/jobs/solutions/service", () => ({
  autoTagSolution: mock(async () => ({
    title: "Test Solution",
    description: "Test description",
    tags: ["test"],
  })),
  buildKeywords: mock(() => "test keywords"),
}));

// Mock chat repository
const mockSaveMessage = mock(async () => ({
  id: "msg-1234-e29b-41d4-a716-446655440000",
  chatId: "12345",
  direction: "out",
  content: "Test message",
  sender: "bot",
  jobId: null,
  createdAt: new Date(),
}));

mock.module("../../features/chat/repository.js", () => ({
  saveMessage: mockSaveMessage,
  getMessages: mock(async () => []),
  getMessagesSince: mock(async () => []),
  getMessagesBefore: mock(async () => []),
}));

// Mock skills repository
mock.module("../../features/skills/repository.js", () => ({
  getEnabledSkills: mock(async () => []),
  getSkillByName: mock(async () => undefined),
  createSkill: mock(async (input: unknown) => ({
    id: "skill-1234-e29b-41d4-a716-446655440000",
    name: (input as { name: string }).name,
    description: "Test skill",
    systemPrompt: "Test system prompt",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateSkill: mock(async () => ({
    id: "skill-1234-e29b-41d4-a716-446655440000",
    name: "test-skill",
    description: "Test skill",
    systemPrompt: "Test system prompt",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  deleteSkill: mock(async () => undefined),
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

    if (method === "editMessageText") {
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

describe("bot-level harness tests", () => {
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
    
    // Clear all mock call counts
    mockCreateJob.mockClear();
    mockGetJobsByChatId.mockClear();
    mockGetJobById.mockClear();
    mockGetAllSchedules.mockClear();
    mockGenerateText.mockClear();
    mockSaveMessage.mockClear();
  });

  describe("/start command", () => {
    test("should send welcome message with peterbot branding", async () => {
      await bot.handleUpdate(makeMessageUpdate("/start"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      expect(sendMessageCalls[0].payload).toMatchObject({
        chat_id: 12345,
        parse_mode: "Markdown",
      });

      // Verify the welcome message content
      const text = (sendMessageCalls[0].payload as any).text;
      expect(text).toContain("peterbot");
      expect(text).toContain("👋 Hi!");
      expect(text).toContain("Send me a task");
      expect(text).toContain("/status");
    });

    test("should save user message and bot response to chat", async () => {
      await bot.handleUpdate(makeMessageUpdate("/start"));

      // Should save both user message and bot response
      expect(mockSaveMessage).toHaveBeenCalledTimes(2);
      
      // First call should be user message
      expect(mockSaveMessage).toHaveBeenNthCalledWith(1, undefined, {
        chatId: "12345",
        direction: "in",
        content: "/start",
        sender: "user",
      });
      
      // Second call should be bot response
      expect(mockSaveMessage).toHaveBeenNthCalledWith(2, undefined, expect.objectContaining({
        chatId: "12345",
        direction: "out",
        sender: "bot",
      }));
    });

    test("should include inline keyboard with quick actions", async () => {
      await bot.handleUpdate(makeMessageUpdate("/start"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.reply_markup).toBeDefined();
      expect(payload.reply_markup.inline_keyboard).toBeDefined();
      expect(Array.isArray(payload.reply_markup.inline_keyboard)).toBe(true);
    });
  });

  describe("callback_query actions", () => {
    test("should process callback_query with help action and answer it", async () => {
      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("help", now));

      const calls = getApiCalls();
      
      // Should answer the callback query
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);
      expect((answerCalls[0].payload as any).callback_query_id).toBeDefined();

      // Should send help message as a new message
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(1);
      
      const sendPayload = sendMessageCalls[0].payload as any;
      expect(sendPayload.chat_id).toBe(12345);
      expect(sendPayload.parse_mode).toBe("Markdown");
      expect(sendPayload.text).toContain("📖");
      expect(sendPayload.text).toContain("peterbot Commands");
    });

    test("should process callback_query with schedules action", async () => {
      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("schedules", now));

      const calls = getApiCalls();
      
      // Should answer the callback query
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);

      // Should send schedules list as a new message
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(1);
      
      const sendPayload = sendMessageCalls[0].payload as any;
      expect(sendPayload.text).toContain("No schedules yet");
    });

    test("should ignore expired callbacks (older than 5 minutes)", async () => {
      const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
      await bot.handleUpdate(makeCallbackUpdate("help", fiveMinutesAgo));

      const calls = getApiCalls();
      
      // Should answer the callback query with expiration warning
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);
      expect((answerCalls[0].payload as any).text).toContain("expired");

      // But should NOT send a new message (callback expired)
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(0);
    });

    test("should process callback_query with solutions action", async () => {
      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("solutions", now));

      const calls = getApiCalls();
      
      // Should answer the callback query
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);

      // Should send solutions list as a new message
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(1);
      
      const sendPayload = sendMessageCalls[0].payload as any;
      expect(sendPayload.text).toContain("No solutions yet");
    });

    test("should process schedule callback (fresh) and prompt for timing", async () => {
      // Mock a completed job for the callback to find
      mockGetJobsByChatId.mockResolvedValueOnce([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "completed",
          input: "Analyze Q4 sales data",
          chatId: "12345",
          output: "Q4 analysis results",
          delivered: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("schedule:550e8400", now));

      const calls = getApiCalls();
      
      // Should answer the callback query
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);

      // Should send message asking for schedule timing
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(1);
      
      const sendPayload = sendMessageCalls[0].payload as any;
      expect(sendPayload.text).toBe("When should I run this?");
    });

    test("should process save callback and create solution", async () => {
      // Mock a completed job for the callback to find
      mockGetJobsByChatId.mockResolvedValueOnce([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "completed",
          input: "Analyze Q4 sales data",
          chatId: "12345",
          output: "Q4 analysis results",
          delivered: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("save:550e8400", now));

      const calls = getApiCalls();
      
      // Should answer the callback query
      const answerCalls = calls.filter(
        (call) => call.method === "answerCallbackQuery"
      );
      expect(answerCalls.length).toBe(1);

      // Should create a solution
      expect(mockCreateSolution).toHaveBeenCalled();

      // Should send confirmation message
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );
      expect(sendMessageCalls.length).toBe(1);
      
      const sendPayload = sendMessageCalls[0].payload as any;
      expect(sendPayload.text).toContain("Solution saved");
    });

    test("should expire pending schedule state after 5 minutes", async () => {
      // First, trigger a schedule callback to set pending state
      mockGetJobsByChatId.mockResolvedValueOnce([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "completed",
          input: "Analyze Q4 sales data",
          chatId: "12345",
          output: "Q4 analysis results",
          delivered: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const now = Math.floor(Date.now() / 1000);
      await bot.handleUpdate(makeCallbackUpdate("schedule:550e8400", now));

      // Clear calls from the callback
      clearApiCalls();
      mockGetJobsByChatId.mockClear();
      mockCreateJob.mockClear();

      // Mock createJob for the normal flow (use a message with task keywords)
      mockCreateJob.mockResolvedValueOnce({
        id: "770e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "pending",
        input: "Research artificial intelligence after expiry",
        chatId: "12345",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Simulate time passing (6 minutes) and send a task message
      // The pending state should be expired, so message should be treated normally
      const futureDate = new Date(Date.now() + 6 * 60 * 1000);
      const originalNow = Date.now;
      Date.now = () => futureDate.getTime();

      try {
        await bot.handleUpdate(makeMessageUpdate("Research artificial intelligence after expiry"));

        const calls = getApiCalls();
        const sendMessageCalls = calls.filter(
          (call) => call.method === "sendMessage"
        );

        // Should create a job (normal flow) instead of trying to parse as schedule
        expect(mockCreateJob).toHaveBeenCalledWith({}, {
          type: "task",
          input: "Research artificial intelligence after expiry",
          chatId: "12345",
          skillSystemPrompt: null,
        });

        // Should send the acknowledgment for a new job
        expect(sendMessageCalls.length).toBe(1);
        const sendPayload = sendMessageCalls[0].payload as any;
        expect(sendPayload.text).toContain("Got it");
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe("/help command", () => {
    test("should send help message with commands", async () => {
      await bot.handleUpdate(makeMessageUpdate("/help"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.chat_id).toBe(12345);
      expect(payload.parse_mode).toBe("Markdown");
      
      // Verify help content
      expect(payload.text).toContain("📖");
      expect(payload.text).toContain("peterbot Commands");
      expect(payload.text).toContain("/start");
      expect(payload.text).toContain("/help");
      expect(payload.text).toContain("/status");
      expect(payload.text).toContain("/retry");
      expect(payload.text).toContain("/get");
      expect(payload.text).toContain("/schedule");
      expect(payload.text).toContain("/solutions");
    });
  });

  describe("/status command", () => {
    test("should fetch jobs and send status message", async () => {
      mockGetJobsByChatId.mockResolvedValueOnce([
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "pending",
          input: "Test job",
          chatId: "12345",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      await bot.handleUpdate(makeMessageUpdate("/status"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      expect(mockGetJobsByChatId).toHaveBeenCalledWith({}, "12345");
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.text).toContain("⏳ Pending");
      expect(payload.text).toContain("550e8400");
    });

    test("should show empty status when no jobs", async () => {
      mockGetJobsByChatId.mockResolvedValueOnce([]);

      await bot.handleUpdate(makeMessageUpdate("/status"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.text).toContain("No jobs found");
    });
  });

  describe("message handler", () => {
    test("should create job for task messages", async () => {
      mockCreateJob.mockResolvedValueOnce({
        id: "770e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "pending",
        input: "Research artificial intelligence",
        chatId: "12345",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await bot.handleUpdate(makeMessageUpdate("Research artificial intelligence"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      expect(mockCreateJob).toHaveBeenCalledWith({}, {
        type: "task",
        input: "Research artificial intelligence",
        chatId: "12345",
        skillSystemPrompt: null,
      });
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.text).toContain("Got it");
      expect(payload.text).toContain("770e8400"); // Short job ID
      expect(payload.parse_mode).toBe("Markdown");
    });

    test("should save user message and bot ack for task messages", async () => {
      mockCreateJob.mockResolvedValueOnce({
        id: "770e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "pending",
        input: "Research artificial intelligence",
        chatId: "12345",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await bot.handleUpdate(makeMessageUpdate("Research artificial intelligence"));

      // Should save user message and bot acknowledgment
      expect(mockSaveMessage).toHaveBeenCalledTimes(2);
      
      // First call should be user message
      expect(mockSaveMessage).toHaveBeenNthCalledWith(1, undefined, {
        chatId: "12345",
        direction: "in",
        content: "Research artificial intelligence",
        sender: "user",
      });
      
      // Second call should be bot acknowledgment with jobId
      expect(mockSaveMessage).toHaveBeenNthCalledWith(2, undefined, expect.objectContaining({
        chatId: "12345",
        direction: "out",
        sender: "bot",
        jobId: "770e8400-e29b-41d4-a716-446655440002",
      }));
    });

    test("should handle quick messages with AI response", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Hello! How can I help you today?",
      });

      await bot.handleUpdate(makeMessageUpdate("Hello!"));

      const calls = getApiCalls();
      const sendMessageCalls = calls.filter(
        (call) => call.method === "sendMessage"
      );

      expect(sendMessageCalls.length).toBe(1);
      expect(mockGenerateText).toHaveBeenCalled();
      
      const payload = sendMessageCalls[0].payload as any;
      expect(payload.text).toBe("Hello! How can I help you today?");
    });

    test("should save user message and bot response for quick messages", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Hello! How can I help you today?",
      });

      await bot.handleUpdate(makeMessageUpdate("Hello!"));

      // Should save user message and bot response
      expect(mockSaveMessage).toHaveBeenCalledTimes(2);
      
      // First call should be user message
      expect(mockSaveMessage).toHaveBeenNthCalledWith(1, undefined, {
        chatId: "12345",
        direction: "in",
        content: "Hello!",
        sender: "user",
      });
      
      // Second call should be bot response (no jobId for quick messages)
      expect(mockSaveMessage).toHaveBeenNthCalledWith(2, undefined, expect.objectContaining({
        chatId: "12345",
        direction: "out",
        content: "Hello! How can I help you today?",
        sender: "bot",
      }));
    });
  });

  describe("utility functions", () => {
    test("makeCallbackUpdate creates valid update structure", () => {
      const now = Math.floor(Date.now() / 1000);
      const update = makeCallbackUpdate("test_action", now);

      expect(update.callback_query).toBeDefined();
      expect(update.callback_query?.data).toBe("test_action");
      expect(update.callback_query?.message?.date).toBe(now);
    });

    test("makeMessageUpdate creates valid update structure for text", () => {
      const update = makeMessageUpdate("Hello bot");

      expect(update.message).toBeDefined();
      expect(update.message?.text).toBe("Hello bot");
      expect(update.message?.chat.id).toBe(12345);
      expect(update.message?.entities).toBeUndefined(); // No entities for plain text
    });

    test("makeMessageUpdate includes entities for commands", () => {
      const update = makeMessageUpdate("/start");

      expect(update.message).toBeDefined();
      expect(update.message?.text).toBe("/start");
      expect(update.message?.entities).toBeDefined();
      expect(update.message?.entities?.[0].type).toBe("bot_command");
      expect(update.message?.entities?.[0].offset).toBe(0);
      expect(update.message?.entities?.[0].length).toBe(6);
    });

    test("makeMessageUpdate includes entities for commands with arguments", () => {
      const update = makeMessageUpdate("/retry abc123");

      expect(update.message).toBeDefined();
      expect(update.message?.text).toBe("/retry abc123");
      expect(update.message?.entities).toBeDefined();
      expect(update.message?.entities?.[0].type).toBe("bot_command");
      expect(update.message?.entities?.[0].length).toBe(6); // "/retry" length
    });
  });
});
