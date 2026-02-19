import { describe, test, expect, mock } from "bun:test";
import { Bot } from "grammy";

describe("debug test", () => {
  test("debug", async () => {
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
      console.log("API call:", method, (payload as any)?.text?.slice(0, 50));
      apiCalls.push({ method, payload });
      return { ok: true, result: { message_id: 1, chat: { id: 12345, type: "private" }, date: 123, text: "" } } as any;
    });
    
    bot.command("test", async (ctx) => {
      console.log("DEBUG: /test command handler invoked");
      await ctx.reply("Test response");
    });
    
    console.log("Testing /test command with entities...");
    await bot.handleUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        from: { id: 12345, is_bot: false, first_name: "Test" },
        chat: { id: 12345, type: "private" },
        date: 123,
        text: "/test",
        entities: [{ type: "bot_command", offset: 0, length: 5 }],
      },
    });
    
    console.log("API calls after /test:", apiCalls.length);
  });
});
