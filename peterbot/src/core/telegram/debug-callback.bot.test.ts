import { describe, test, expect, mock } from "bun:test";
import { Bot } from "grammy";

mock.module("../../shared/config.js", () => ({
  config: {
    telegramBotToken: "fake-token-for-testing",
    telegramChatId: undefined,  // Allow all
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

mock.module("../../features/jobs/repository", () => ({
  createJob: mock(async () => ({ id: "test-id" })),
  getJobsByChatId: mock(async () => []),
  getJobById: mock(async () => undefined),
}));

mock.module("../../features/cron/repository", () => ({
  getAllSchedules: mock(async () => []),
  createSchedule: mock(async () => ({ id: "sched-id" })),
  deleteSchedule: mock(async () => {}),
  getScheduleById: mock(async () => undefined),
}));

mock.module("../../features/solutions/repository", () => ({
  getAllSolutions: mock(async () => []),
  createSolution: mock(async () => ({ id: "sol-id" })),
}));

mock.module("../../features/solutions/similarity", () => ({
  findSimilarSolutions: mock(async () => []),
  extractKeywords: mock(() => []),
  calculateSimilarity: mock(() => 0),
}));

mock.module("ai", () => ({
  generateText: mock(async () => ({ text: "AI response" })),
  generateObject: mock(async () => ({ object: {} })),
}));

mock.module("../../ai/client", () => ({
  getModel: mock(() => ({})),
}));

mock.module("../../db", () => ({
  db: {},
}));

mock.module("../../features/solutions/service", () => ({
  autoTagSolution: mock(async () => ({ title: "Test", description: "Desc", tags: [] })),
  buildKeywords: mock(() => "keywords"),
}));

describe("debug callback", () => {
  test("debug", async () => {
    const { setupHandlers } = await import("./handlers.ts");
    
    const bot = new Bot("fake-token", {
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
    
    bot.api.config.use((prev, method, payload, signal) => {
      console.log("API call:", method, JSON.stringify(payload).slice(0, 200));
      apiCalls.push({ method, payload });
      
      if (method === "sendMessage") {
        return { ok: true, result: { message_id: 1, chat: { id: 12345, type: "private" }, date: 123, text: "" } } as any;
      }
      if (method === "answerCallbackQuery") {
        return { ok: true, result: true } as any;
      }
      return { ok: true, result: true } as any;
    });
    
    setupHandlers(bot);
    
    const now = Math.floor(Date.now() / 1000);
    
    console.log("\n=== Testing callback query ===");
    await bot.handleUpdate({
      update_id: 1,
      callback_query: {
        id: "callback_123",
        from: { id: 12345, is_bot: false, first_name: "Test" },
        message: {
          message_id: 1,
          from: { id: 1, is_bot: true, first_name: "TestBot", username: "testbot" },
          chat: { id: 12345, type: "private" },
          date: now,
          text: "Test message",
        },
        chat_instance: "test_chat_instance",
        data: "help",
      },
    });
    
    console.log("\nTotal API calls:", apiCalls.length);
    for (const call of apiCalls) {
      console.log(" -", call.method);
    }
  });
});
