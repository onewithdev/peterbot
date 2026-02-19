# Peterbot Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add documentation with /help command, inline buttons for better UX, 2-way Telegram chat sync in dashboard, and comprehensive regression tests.

**Architecture:** Progressive enhancement starting with simple documentation, then inline buttons (building on existing handler patterns), then chat module (most complex, requires DB + API + UI), ending with tests for coverage gaps.

**Tech Stack:** TypeScript, Bun, Grammy (Telegram), Hono (API), Drizzle ORM, SQLite, React + TanStack Router/Query, Tailwind

---

## Elephant Carpaccio Slicing

Each task is a thin vertical slice (2-5 min). We deliver working value at every step.

---

## Phase 1: Documentation & /help Command

### Task 1: Create docs/commands.md

**Files:**
- Create: `docs/commands.md`

**Step 1: Write the documentation file**

Create `docs/commands.md`:
```markdown
# Peterbot Command Reference

## Core Commands

### /start
Shows welcome message and basic usage.

Usage: `/start`

### /status
View all your jobs (pending, running, completed, failed).

Usage: `/status`

### /retry [jobId]
Retry a failed job.

Usage: `/retry abc12345`

### /get [jobId]
Retrieve the result of a completed job.

Usage: `/get abc12345`

## Scheduling Commands

### /schedule <when> "<what>"
Create a recurring schedule.

Usage:
- `/schedule every Monday 9am "send me a briefing"`
- `/schedule every day at 8am "good morning message"`
- `/schedule every weekday at 6pm "daily summary"`

### /schedules
List all your schedules.

Usage: `/schedules`

To delete a schedule: `/schedule delete <id>` (use first 8 chars of ID)

## Solution Commands

### /solutions
List all saved solutions.

Usage: `/solutions`

### "save this solution"
Reply to a completed job with "save this solution" to save it for future reference.

## Message Types

**Quick Questions** - Answered instantly (no job created):
- "What is 2 + 2?"
- "Explain quantum computing"

**Background Tasks** - Queued and processed asynchronously:
- "Analyze this CSV and create a chart"
- "Scrape data from example.com"
```

**Step 2: Commit**

```bash
git add docs/commands.md
git commit -m "docs: add command reference documentation"
```

---

### Task 2: Create docs/features.md

**Files:**
- Create: `docs/features.md`

**Step 1: Write the documentation file**

Create `docs/features.md`:
```markdown
# Peterbot Features

## Background Job Processing
Send complex tasks and they'll be processed in the background. You'll get a job ID to track progress.

## Scheduling
Create recurring schedules that automatically create jobs at specified times.

## Solutions
Save successful job outputs as reusable solutions. The bot will suggest them for similar future tasks.

## Web Dashboard
Access the dashboard at the configured port to:
- Monitor jobs
- Edit bot personality (Soul)
- Manage system memory
- Configure blocklist patterns
- View and manage schedules
- Execute code in sandbox

## Conversation History
The bot maintains conversation context using summaries for better continuity.
```

**Step 2: Commit**

```bash
git add docs/features.md
git commit -m "docs: add features overview documentation"
```

---

### Task 3: Add /help command handler

**Files:**
- Modify: `src/core/telegram/handlers.ts:219-227` (after /start command)

**Step 1: Write the failing test**

Add to `src/core/telegram/handlers.test.ts` after the /start tests:
```typescript
describe("/help command", () => {
  test("sends help message with command list", async () => {
    const bot = createMockBot();
    setupHandlers(bot);

    const ctx = createMockContext({ text: "/help", chatId: CHAT_ID });
    await bot.triggerCommand("help", ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("📖 *Command Reference*"),
      expect.objectContaining({ parse_mode: "Markdown" })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/telegram/handlers.test.ts -t "/help"
```
Expected: FAIL - command not recognized

**Step 3: Implement /help command**

Add after `/start` command in `src/core/telegram/handlers.ts` (~line 227):
```typescript
// Command: /help
bot.command("help", async (ctx) => {
  await ctx.reply(
    `📖 *Command Reference*

*Core Commands:*
/start - Welcome message
/status - View your jobs
/retry [jobId] - Retry failed job
/get [jobId] - Get job result

*Scheduling:*
/schedule <when> "<what>" - Create schedule
/schedules - List schedules

*Solutions:*
/solutions - List saved solutions
Reply "save this solution" to save a job

Send me any message and I'll help you out!`,
    { parse_mode: "Markdown" }
  );
});
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/telegram/handlers.test.ts -t "/help"
```
Expected: PASS

**Step 5: Run all handler tests**

```bash
bun test src/core/telegram/handlers.test.ts
```
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/core/telegram/handlers.ts src/core/telegram/handlers.test.ts
git commit -m "feat: add /help command"
```

---

## Phase 2: Context-Aware Inline Buttons

### Task 4: Create button configuration module

**Files:**
- Create: `src/core/telegram/buttons.ts`
- Create: `src/core/telegram/buttons.test.ts`

**Step 1: Write the failing test**

Create `src/core/telegram/buttons.test.ts`:
```typescript
import { describe, test, expect } from "bun:test";
import { getButtonsForContext, ButtonContext } from "./buttons.js";

describe("getButtonsForContext", () => {
  test("returns idle context buttons when no context provided", () => {
    const buttons = getButtonsForContext("idle");
    
    expect(buttons).toHaveLength(4);
    expect(buttons[0].text).toBe("❓ Quick question");
    expect(buttons[1].text).toBe("📋 Background task");
    expect(buttons[2].text).toBe("📅 View schedules");
    expect(buttons[3].text).toBe("❔ Help");
  });

  test("returns task_completed context buttons", () => {
    const buttons = getButtonsForContext("task_completed", { jobId: "abc123" });
    
    expect(buttons).toHaveLength(4);
    expect(buttons[0].text).toBe("📅 Schedule this");
    expect(buttons[0].callbackData).toContain("abc123");
  });

  test("returns quick_reply context buttons", () => {
    const buttons = getButtonsForContext("quick_reply");
    
    expect(buttons).toHaveLength(4);
    expect(buttons[0].text).toBe("💬 Follow up");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/telegram/buttons.test.ts
```
Expected: FAIL - module not found

**Step 3: Implement button module**

Create `src/core/telegram/buttons.ts`:
```typescript
import { InlineKeyboard } from "grammy";

export type ButtonContext = "idle" | "task_completed" | "quick_reply" | "schedule_created";

export interface ButtonConfig {
  text: string;
  callbackData: string;
}

interface ContextData {
  jobId?: string;
  scheduleId?: string;
}

export function getButtonsForContext(
  context: ButtonContext,
  data?: ContextData
): ButtonConfig[] {
  switch (context) {
    case "task_completed":
      return [
        { text: "📅 Schedule this", callbackData: JSON.stringify({ action: "schedule", jobId: data?.jobId }) },
        { text: "💾 Save solution", callbackData: JSON.stringify({ action: "save", jobId: data?.jobId }) },
        { text: "🔄 Run again", callbackData: JSON.stringify({ action: "retry", jobId: data?.jobId }) },
        { text: "🆕 New task", callbackData: JSON.stringify({ action: "new_task" }) },
      ];
    
    case "quick_reply":
      return [
        { text: "💬 Follow up", callbackData: JSON.stringify({ action: "follow_up" }) },
        { text: "⭐ Save helpful", callbackData: JSON.stringify({ action: "save_helpful" }) },
        { text: "📋 Background task", callbackData: JSON.stringify({ action: "background_task" }) },
        { text: "❔ Help", callbackData: JSON.stringify({ action: "help" }) },
      ];
    
    case "schedule_created":
      return [
        { text: "📋 View all", callbackData: JSON.stringify({ action: "view_schedules" }) },
        { text: "➕ New schedule", callbackData: JSON.stringify({ action: "new_schedule" }) },
        { text: "🔙 Back", callbackData: JSON.stringify({ action: "back" }) },
        { text: "❔ Help", callbackData: JSON.stringify({ action: "help" }) },
      ];
    
    case "idle":
    default:
      return [
        { text: "❓ Quick question", callbackData: JSON.stringify({ action: "quick_question" }) },
        { text: "📋 Background task", callbackData: JSON.stringify({ action: "background_task" }) },
        { text: "📅 View schedules", callbackData: JSON.stringify({ action: "view_schedules" }) },
        { text: "❔ Help", callbackData: JSON.stringify({ action: "help" }) },
      ];
  }
}

export function buildInlineKeyboard(buttons: ButtonConfig[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Add buttons in 2x2 grid
  for (let i = 0; i < buttons.length; i += 2) {
    const row = buttons.slice(i, i + 2);
    keyboard.row(
      ...row.map(b => ({
        text: b.text,
        callback_data: b.callbackData,
      }))
    );
  }
  
  return keyboard;
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/telegram/buttons.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/telegram/buttons.ts src/core/telegram/buttons.test.ts
git commit -m "feat: add button configuration module"
```

---

### Task 5: Add idle buttons to /start command

**Files:**
- Modify: `src/core/telegram/handlers.ts:219-227`

**Step 1: Import button helpers**

Add import at top of `src/core/telegram/handlers.ts`:
```typescript
import { getButtonsForContext, buildInlineKeyboard } from "./buttons.js";
```

**Step 2: Update /start command to include buttons**

Replace the /start command handler:
```typescript
// Command: /start
bot.command("start", async (ctx) => {
  const buttons = getButtonsForContext("idle");
  const keyboard = buildInlineKeyboard(buttons);
  
  await ctx.reply(
    `👋 Hi! I'm peterbot.

Send me a task and I'll work on it in the background.
Use /status to see what I'm working on.

What would you like to do?`,
    { 
      parse_mode: "Markdown",
      reply_markup: keyboard,
    }
  );
});
```

**Step 3: Manual test**

Restart the bot and send `/start`. You should see 4 inline buttons.

**Step 4: Update test**

Update `/start` test in `handlers.test.ts` to expect reply_markup:
```typescript
test("replies with welcome message and buttons", async () => {
  const bot = createMockBot();
  setupHandlers(bot);

  const ctx = createMockContext({ text: "/start", chatId: CHAT_ID });
  await bot.triggerCommand("start", ctx);

  expect(ctx.reply).toHaveBeenCalledWith(
    expect.stringContaining("Hi! I'm peterbot"),
    expect.objectContaining({ 
      parse_mode: "Markdown",
      reply_markup: expect.any(Object),
    })
  );
});
```

**Step 5: Run tests**

```bash
bun test src/core/telegram/handlers.test.ts -t "/start"
```
Expected: PASS

**Step 6: Commit**

```bash
git add src/core/telegram/handlers.ts src/core/telegram/handlers.test.ts
git commit -m "feat: add idle buttons to /start command"
```

---

### Task 6: Add callback query handler skeleton

**Files:**
- Modify: `src/core/telegram/handlers.ts:659` (after message handler)

**Step 1: Add callback query handler**

Add after the main message handler (before closing brace of setupHandlers):
```typescript
// Callback query handler for inline buttons
bot.on("callback_query:data", async (ctx) => {
  const chatId = ctx.chat?.id?.toString();
  if (!chatId) return;

  try {
    const data = JSON.parse(ctx.callbackQuery.data);
    
    // Answer the callback to remove loading state
    await ctx.answerCallbackQuery();

    switch (data.action) {
      case "help":
        await ctx.reply(
          `📖 *Command Reference*

*Core Commands:*
/start - Welcome message
/status - View your jobs
/retry [jobId] - Retry failed job
/get [jobId] - Get job result

*Scheduling:*
/schedule <when> "<what>" - Create schedule
/schedules - List schedules

*Solutions:*
/solutions - List saved solutions
Reply "save this solution" to save a job`,
          { parse_mode: "Markdown" }
        );
        break;

      case "view_schedules":
        const schedules = await getAllSchedules(db);
        await ctx.reply(formatSchedulesList(schedules), { parse_mode: "Markdown" });
        break;

      case "quick_question":
        await ctx.reply("What's your question? I'll answer right away!");
        break;

      case "background_task":
        await ctx.reply("What task should I work on in the background?");
        break;

      case "new_task":
        await ctx.reply("What would you like me to do?");
        break;

      case "follow_up":
        await ctx.reply("What's your follow-up question?");
        break;

      default:
        await ctx.reply("⚠️ This button has expired. Type your request instead!");
    }
  } catch (error) {
    console.error("[Bot] Error handling callback query:", error);
    await ctx.reply("⚠️ Something went wrong. Please type your request.");
  }
});
```

**Step 2: Add test for callback handler**

Add to `handlers.test.ts`:
```typescript
describe("callback query handler", () => {
  test("help button sends help message", async () => {
    const bot = createMockBot();
    setupHandlers(bot);

    const ctx = createMockContext({ 
      callbackQuery: { data: JSON.stringify({ action: "help" }) },
      chatId: CHAT_ID 
    });
    await bot.triggerCallbackQuery(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Command Reference"),
      expect.objectContaining({ parse_mode: "Markdown" })
    );
  });

  test("expired callback shows expiration message", async () => {
    const bot = createMockBot();
    setupHandlers(bot);

    const ctx = createMockContext({ 
      callbackQuery: { data: JSON.stringify({ action: "unknown" }) },
      chatId: CHAT_ID 
    });
    await bot.triggerCallbackQuery(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("expired")
    );
  });
});
```

**Step 3: Run tests**

```bash
bun test src/core/telegram/handlers.test.ts -t "callback query"
```
Expected: PASS (may need to adjust mock helpers)

**Step 4: Commit**

```bash
git add src/core/telegram/handlers.ts src/core/telegram/handlers.test.ts
git commit -m "feat: add callback query handler for inline buttons"
```

---

### Task 7: Add context-aware buttons to job completion

**Files:**
- Modify: `src/worker/worker.ts:236-275` (deliverResult function)

**Step 1: Import button helpers in worker**

Add to imports in `src/worker/worker.ts`:
```typescript
import { getButtonsForContext, buildInlineKeyboard } from "../core/telegram/buttons.js";
```

**Step 2: Update deliverResult to include buttons for completed tasks**

Update the deliverResult function to add buttons when job is from a schedule:
```typescript
async function deliverResult(job: Job, result: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[Worker] No TELEGRAM_BOT_TOKEN, skipping delivery for job ${job.id.slice(0, 8)}`);
    return;
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);
  const shortId = job.id.slice(0, 8);
  let header = `✅ Task complete! [${shortId}]\n\n`;

  // Check if this job was created by a schedule
  if (job.scheduleId) {
    const schedule = await getScheduleById(db, job.scheduleId);
    if (schedule) {
      header = `📅 Scheduled: "${schedule.description}"\n\n`;
    }
  }

  // Truncate result to fit within Telegram's message limit
  const truncatedResult = truncateForTelegram(result, header);

  // Get buttons based on context
  const buttons = getButtonsForContext("task_completed", { jobId: job.id });
  const keyboard = buildInlineKeyboard(buttons);

  try {
    await bot.api.sendMessage(job.chatId, header + truncatedResult, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    await markJobDelivered(db, job.id);
    console.log(`[Worker] Delivered result for job ${shortId}`);
  } catch (error) {
    // ... rest of existing error handling
  }
}
```

**Step 3: Commit**

```bash
git add src/worker/worker.ts
git commit -m "feat: add action buttons to job completion messages"
```

---

### Task 8: Add retry and schedule actions to callback handler

**Files:**
- Modify: `src/core/telegram/handlers.ts` (callback query handler)

**Step 1: Add retry and schedule actions**

Add new cases to the switch statement in callback query handler:
```typescript
case "retry": {
  if (!data.jobId) {
    await ctx.reply("❌ Cannot retry: job ID not found.");
    break;
  }
  
  const job = await getJobById(db, data.jobId);
  if (!job) {
    await ctx.reply("❌ Job not found.");
    break;
  }
  
  // Create new job with same input
  const newJob = await createJob(db, {
    type: "task",
    input: job.input,
    chatId,
  });
  
  await ctx.reply(formatAckReply(newJob.id), { parse_mode: "Markdown" });
  break;
}

case "schedule": {
  if (!data.jobId) {
    await ctx.reply("❌ Cannot schedule: job ID not found.");
    break;
  }
  
  const job = await getJobById(db, data.jobId);
  if (!job) {
    await ctx.reply("❌ Job not found.");
    break;
  }
  
  await ctx.reply(
    `📅 Schedule this task:\n\n` +
    `*Original task:* ${job.input.slice(0, 100)}${job.input.length > 100 ? "..." : ""}\n\n` +
    `Use: /schedule <when> "${job.input.slice(0, 200)}"`,
    { parse_mode: "Markdown" }
  );
  break;
}

case "save": {
  if (!data.jobId) {
    await ctx.reply("❌ Cannot save: job ID not found.");
    break;
  }
  
  const job = await getJobById(db, data.jobId);
  if (!job || job.status !== "completed") {
    await ctx.reply("❌ Cannot save: job not found or not completed.");
    break;
  }
  
  // Trigger save flow
  pendingActions.set(chatId, { type: "save", jobs: [job] });
  await ctx.reply(formatSaveList([job]), { parse_mode: "Markdown" });
  break;
}
```

**Step 2: Run tests**

```bash
bun test src/core/telegram/handlers.test.ts
```
Expected: All pass

**Step 3: Commit**

```bash
git add src/core/telegram/handlers.ts
git commit -m "feat: add retry and schedule actions to inline buttons"
```

---

## Phase 3: Chat Module (2-Way Telegram Sync)

### Task 9: Create chat message schema

**Files:**
- Create: `src/features/chat/schema.ts`

**Step 1: Create the schema file**

Create `src/features/chat/schema.ts`:
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text("chat_id").notNull(),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  content: text("content").notNull(),
  sender: text("sender", { enum: ["user", "bot"] }).notNull(),
  jobId: text("job_id"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
```

**Step 2: Commit**

```bash
git add src/features/chat/schema.ts
git commit -m "feat: add chat message schema"
```

---

### Task 10: Create chat repository

**Files:**
- Create: `src/features/chat/repository.ts`
- Create: `src/features/chat/repository.test.ts`

**Step 1: Write the failing test**

Create `src/features/chat/repository.test.ts`:
```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { chatMessages } from "./schema.js";
import { 
  saveMessage, 
  getMessagesSince,
  getRecentMessages 
} from "./repository.js";

const testDb = new Database(":memory:");
const db = drizzle(testDb, { schema });

describe("Chat Repository", () => {
  beforeAll(async () => {
    // Create table
    testDb.exec(`
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
  });

  test("saveMessage stores message correctly", async () => {
    const message = await saveMessage(db, {
      chatId: "12345",
      direction: "in",
      content: "Hello bot",
      sender: "user",
    });

    expect(message.chatId).toBe("12345");
    expect(message.content).toBe("Hello bot");
    expect(message.sender).toBe("user");
    expect(message.direction).toBe("in");
  });

  test("getMessagesSince returns only newer messages", async () => {
    const since = Date.now();
    
    // Add old message
    await saveMessage(db, {
      chatId: "12345",
      direction: "in",
      content: "Old message",
      sender: "user",
      createdAt: new Date(since - 1000),
    });

    // Add new message
    await saveMessage(db, {
      chatId: "12345",
      direction: "out",
      content: "New reply",
      sender: "bot",
      createdAt: new Date(since + 1000),
    });

    const messages = await getMessagesSince(db, "12345", new Date(since));
    
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("New reply");
  });

  test("getRecentMessages respects limit", async () => {
    for (let i = 0; i < 5; i++) {
      await saveMessage(db, {
        chatId: "12345",
        direction: "in",
        content: `Message ${i}`,
        sender: "user",
      });
    }

    const messages = await getRecentMessages(db, "12345", 3);
    
    expect(messages).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/features/chat/repository.test.ts
```
Expected: FAIL - functions not defined

**Step 3: Implement repository**

Create `src/features/chat/repository.ts`:
```typescript
import { eq, desc, gt, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { chatMessages, type ChatMessage, type NewChatMessage } from "./schema.js";

export async function saveMessage(
  db: BunSQLiteDatabase<typeof schema>,
  input: NewChatMessage
): Promise<ChatMessage> {
  const result = await db.insert(chatMessages).values(input).returning();
  return result[0];
}

export async function getMessagesSince(
  db: BunSQLiteDatabase<typeof schema>,
  chatId: string,
  since: Date,
  limit: number = 50
): Promise<ChatMessage[]> {
  return await db
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.chatId, chatId),
        gt(chatMessages.createdAt, since)
      )
    )
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

export async function getRecentMessages(
  db: BunSQLiteDatabase<typeof schema>,
  chatId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  return await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/features/chat/repository.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/chat/repository.ts src/features/chat/repository.test.ts
git commit -m "feat: add chat repository with CRUD operations"
```

---

### Task 11: Add chat routes to dashboard API

**Files:**
- Create: `src/core/dashboard/chat-routes.ts`

**Step 1: Create API routes**

Create `src/core/dashboard/chat-routes.ts`:
```typescript
import { Hono } from "hono";
import { db } from "../../db/index.js";
import { getMessagesSince, saveMessage, getRecentMessages } from "../../features/chat/repository.js";
import { createJob } from "../../features/jobs/repository.js";
import { detectIntent } from "../telegram/intent.js";
import { generateText } from "ai";
import { getModel } from "../../ai/client.js";
import { config } from "../../shared/config.js";

const chatRoutes = new Hono();

// GET /api/chat/messages?since=<timestamp>&limit=<number>
chatRoutes.get("/messages", async (c) => {
  const chatId = config.telegramChatId;
  if (!chatId) {
    return c.json({ error: "No chat configured" }, 500);
  }

  const sinceParam = c.req.query("since");
  const limitParam = c.req.query("limit");
  
  const since = sinceParam ? new Date(parseInt(sinceParam)) : new Date(0);
  const limit = limitParam ? parseInt(limitParam) : 50;

  const messages = await getMessagesSince(db, chatId, since, limit);
  
  return c.json({
    messages: messages.map(m => ({
      id: m.id,
      content: m.content,
      sender: m.sender,
      direction: m.direction,
      createdAt: m.createdAt.getTime(),
      jobId: m.jobId,
    })),
  });
});

// POST /api/chat/send
chatRoutes.post("/send", async (c) => {
  const chatId = config.telegramChatId;
  if (!chatId) {
    return c.json({ error: "No chat configured" }, 500);
  }

  const body = await c.req.json();
  const { content } = body;

  if (!content || typeof content !== "string") {
    return c.json({ error: "Content is required" }, 400);
  }

  // Save user message
  const userMessage = await saveMessage(db, {
    chatId,
    direction: "in",
    content,
    sender: "user",
  });

  // Detect intent
  const intent = detectIntent(content);

  if (intent === "quick") {
    // Handle quick response inline
    try {
      const { text: response } = await generateText({
        model: getModel(),
        system: "You are peterbot, a helpful personal AI assistant.",
        prompt: content,
      });

      // Save bot response
      const botMessage = await saveMessage(db, {
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      });

      return c.json({
        messages: [
          { ...userMessage, createdAt: userMessage.createdAt.getTime() },
          { ...botMessage, createdAt: botMessage.createdAt.getTime() },
        ],
        immediate: true,
      });
    } catch (error) {
      return c.json({ error: "Failed to generate response" }, 500);
    }
  } else {
    // Create background job
    const job = await createJob(db, {
      type: "task",
      input: content,
      chatId,
    });

    // Update message with job ID
    const pendingMessage = await saveMessage(db, {
      chatId,
      direction: "out",
      content: `⏳ Task queued [${job.id.slice(0, 8)}]`,
      sender: "bot",
      jobId: job.id,
    });

    return c.json({
      messages: [
        { ...userMessage, createdAt: userMessage.createdAt.getTime() },
        { ...pendingMessage, createdAt: pendingMessage.createdAt.getTime() },
      ],
      immediate: false,
      jobId: job.id,
    });
  }
});

export default chatRoutes;
```

**Step 2: Mount routes in dashboard**

Modify `src/core/dashboard/routes.ts` to add:
```typescript
import chatRoutes from "./chat-routes.js";

// ... in routes setup
dashboardApp.route("/chat", chatRoutes);
```

**Step 3: Commit**

```bash
git add src/core/dashboard/chat-routes.ts src/core/dashboard/routes.ts
git commit -m "feat: add chat API routes"
```

---

### Task 12: Save messages from Telegram handlers

**Files:**
- Modify: `src/core/telegram/handlers.ts`

**Step 1: Import chat repository**

Add import:
```typescript
import { saveMessage } from "../../features/chat/repository.js";
```

**Step 2: Save incoming messages**

Add to main message handler (after getting chatId, ~line 494):
```typescript
// Save incoming message
await saveMessage(db, {
  chatId,
  direction: "in",
  content: text,
  sender: "user",
});
```

**Step 3: Save outgoing quick replies**

In the quick response section (~line 642), after generating response:
```typescript
await ctx.reply(formatQuickReply(response));

// Save bot response
await saveMessage(db, {
  chatId,
  direction: "out",
  content: response,
  sender: "bot",
});
```

**Step 4: Save task acknowledgment**

In the task section (~line 657), after creating job:
```typescript
await ctx.reply(formatAckReply(job.id), { parse_mode: "Markdown" });

// Save acknowledgment
await saveMessage(db, {
  chatId,
  direction: "out",
  content: `⏳ Task queued [${job.id.slice(0, 8)}]`,
  sender: "bot",
  jobId: job.id,
});
```

**Step 5: Commit**

```bash
git add src/core/telegram/handlers.ts
git commit -m "feat: save Telegram messages to chat history"
```

---

### Task 13: Save bot responses from worker

**Files:**
- Modify: `src/worker/worker.ts`

**Step 1: Import chat repository**

Add import:
```typescript
import { saveMessage } from "../features/chat/repository.js";
```

**Step 2: Save completed job responses**

Update `deliverResult` function to save the response:
```typescript
async function deliverResult(job: Job, result: string): Promise<void> {
  // ... existing code ...

  try {
    await bot.api.sendMessage(job.chatId, header + truncatedResult, {
      parse_mode: "Markdown",
      reply_markup: keyboard,
    });

    await markJobDelivered(db, job.id);
    
    // Save bot response to chat history
    await saveMessage(db, {
      chatId: job.chatId,
      direction: "out",
      content: result,
      sender: "bot",
      jobId: job.id,
    });
    
    console.log(`[Worker] Delivered result for job ${shortId}`);
  } catch (error) {
    // ... existing error handling ...
  }
}
```

**Step 3: Commit**

```bash
git add src/worker/worker.ts
git commit -m "feat: save worker responses to chat history"
```

---

### Task 14: Create React hook for chat polling

**Files:**
- Create: `web/src/hooks/use-chat.ts`

**Step 1: Create the hook**

Create `web/src/hooks/use-chat.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  direction: "in" | "out";
  createdAt: number;
  jobId?: string;
}

interface SendMessageResponse {
  messages: ChatMessage[];
  immediate: boolean;
  jobId?: string;
}

const POLL_INTERVAL = 5000; // 5 seconds

export function useChat() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["chat-messages"],
    queryFn: async () => {
      const response = await api.get("/chat/messages?limit=100");
      return response.messages as ChatMessage[];
    },
    refetchInterval: POLL_INTERVAL,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string): Promise<SendMessageResponse> => {
      const response = await api.post("/chat/send", { content });
      return response as SendMessageResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages"] });
    },
  });

  return {
    messages: data ?? [],
    isLoading,
    sendMessage,
  };
}
```

**Step 2: Commit**

```bash
git add web/src/hooks/use-chat.ts
git commit -m "feat: add chat polling hook"
```

---

### Task 15: Create Chat page UI

**Files:**
- Create: `web/src/routes/chat.tsx`

**Step 1: Create the page**

Create `web/src/routes/chat.tsx`:
```typescript
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sendMessage.isPending) return;
    
    await sendMessage.mutateAsync(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.createdAt).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {} as Record<string, typeof messages>);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <h1 className="mb-4 text-2xl font-bold">Chat</h1>
      
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No messages yet. Start a conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="mb-4 flex justify-center">
                  <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {date}
                  </span>
                </div>
                <div className="space-y-3">
                  {msgs.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          msg.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <span className="mt-1 block text-xs opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mt-4 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={sendMessage.isPending}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || sendMessage.isPending}
        >
          {sendMessage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Add route to router**

Modify `web/src/routes/__root.tsx` to add Chat to nav items (already done via sidebar, but ensure route is registered in main router file - check if there's a route tree generator).

Check `web/src/main.tsx` or route file:
```bash
grep -r "createRoute" web/src/ | head -20
```

The route should be auto-registered by TanStack Router if file-based routing is used.

**Step 3: Commit**

```bash
git add web/src/routes/chat.tsx
git commit -m "feat: add chat page UI"
```

---

### Task 16: Add Chat to sidebar navigation

**Files:**
- Modify: `web/src/components/sidebar.tsx:26-36`

**Step 1: Add Chat nav item**

Add import:
```typescript
import { MessageSquare } from "lucide-react";
```

Add to navItems array:
```typescript
const navItems: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Soul", path: "/soul", icon: Sparkles },
  // ... rest of items
];
```

**Step 2: Commit**

```bash
git add web/src/components/sidebar.tsx
git commit -m "feat: add Chat to sidebar navigation"
```

---

### Task 17: Update database schema migration

**Files:**
- Modify: `src/db/schema.ts`

**Step 1: Export chat schema from main db**

Add to `src/db/schema.ts`:
```typescript
export { chatMessages } from "../features/chat/schema.js";
```

**Step 2: Run migration**

```bash
bun run db:push
```

Expected: Table `chat_messages` created

**Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add chat_messages table to database"
```

---

## Phase 4: Regression Testing

### Task 18: Add scheduler tests

**Files:**
- Create: `src/worker/scheduler.test.ts`

**Step 1: Create test file**

Create `src/worker/scheduler.test.ts`:
```typescript
import { describe, test, expect, beforeAll } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema.js";
import { schedules } from "../features/cron/schema.js";
import { createSchedule, getDueSchedules, updateScheduleRunTime } from "../features/cron/repository.js";
import { calculateNextRun } from "../features/cron/natural-parser.js";

const testDb = new Database(":memory:");
const db = drizzle(testDb, { schema });

describe("Scheduler", () => {
  beforeAll(async () => {
    // Create tables
    testDb.exec(`
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
  });

  test("getDueSchedules returns schedules past their nextRunAt", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60000); // 1 minute ago
    const future = new Date(now.getTime() + 60000); // 1 minute from now

    await createSchedule(db, {
      description: "Past schedule",
      naturalSchedule: "every minute",
      parsedCron: "* * * * *",
      prompt: "Test prompt",
      enabled: true,
      nextRunAt: past,
    });

    await createSchedule(db, {
      description: "Future schedule",
      naturalSchedule: "every minute",
      parsedCron: "* * * * *",
      prompt: "Test prompt",
      enabled: true,
      nextRunAt: future,
    });

    const due = await getDueSchedules(db, now);
    
    expect(due).toHaveLength(1);
    expect(due[0].description).toBe("Past schedule");
  });

  test("updateScheduleRunTime updates lastRunAt and nextRunAt", async () => {
    const schedule = await createSchedule(db, {
      description: "Test",
      naturalSchedule: "every hour",
      parsedCron: "0 * * * *",
      prompt: "Test",
      enabled: true,
      nextRunAt: new Date(),
    });

    const newNextRun = new Date(Date.now() + 3600000);
    await updateScheduleRunTime(db, schedule.id, newNextRun);

    const updated = await db.select().from(schedules).where(eq(schedules.id, schedule.id));
    
    expect(updated[0].lastRunAt).toBeDefined();
    expect(updated[0].nextRunAt.getTime()).toBe(newNextRun.getTime());
  });
});
```

**Step 2: Run tests**

```bash
bun test src/worker/scheduler.test.ts
```
Expected: PASS

**Step 3: Commit**

```bash
git add src/worker/scheduler.test.ts
git commit -m "test: add scheduler repository tests"
```

---

### Task 19: Add button action tests

**Files:**
- Modify: `src/core/telegram/handlers.test.ts`

**Step 1: Add tests for button actions**

Add to existing handlers test file:
```typescript
describe("button actions", () => {
  test("retry button creates new job with same input", async () => {
    // Setup: create a completed job
    const job = await createJob(db, {
      type: "task",
      input: "Test task",
      chatId: CHAT_ID,
      status: "completed",
    });

    const bot = createMockBot();
    setupHandlers(bot);

    const ctx = createMockContext({
      callbackQuery: { data: JSON.stringify({ action: "retry", jobId: job.id }) },
      chatId: CHAT_ID,
    });

    await bot.triggerCallbackQuery(ctx);

    // Verify new job was created
    const jobs = await getJobsByChatId(db, CHAT_ID);
    expect(jobs).toHaveLength(2);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("Got it"),
      expect.any(Object)
    );
  });

  test("schedule button shows schedule command hint", async () => {
    const job = await createJob(db, {
      type: "task",
      input: "Daily report",
      chatId: CHAT_ID,
      status: "completed",
    });

    const bot = createMockBot();
    setupHandlers(bot);

    const ctx = createMockContext({
      callbackQuery: { data: JSON.stringify({ action: "schedule", jobId: job.id }) },
      chatId: CHAT_ID,
    });

    await bot.triggerCallbackQuery(ctx);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining("/schedule"),
      expect.any(Object)
    );
  });
});
```

**Step 2: Run tests**

```bash
bun test src/core/telegram/handlers.test.ts -t "button actions"
```
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/telegram/handlers.test.ts
git commit -m "test: add button action handler tests"
```

---

### Task 20: Run full test suite

**Step 1: Run all tests**

```bash
bun test
```

Expected: All tests pass (300+ tests)

**Step 2: Verify coverage**

Check that new features have tests:
- Documentation: Not unit-testable (docs only)
- Buttons: buttons.test.ts + handlers.test.ts
- Chat: repository.test.ts
- Scheduler: scheduler.test.ts

**Step 3: Final commit**

```bash
git commit --allow-empty -m "test: all tests passing for new features"
```

---

## Summary

### Features Delivered

1. **Documentation** (`docs/commands.md`, `docs/features.md`)
2. **Inline Buttons** - Context-aware buttons in Telegram
3. **Chat Module** - 2-way sync between Telegram and web dashboard
4. **Tests** - Comprehensive coverage for new features

### Files Created

```
docs/commands.md
docs/features.md
src/core/telegram/buttons.ts
src/core/telegram/buttons.test.ts
src/features/chat/schema.ts
src/features/chat/repository.ts
src/features/chat/repository.test.ts
src/core/dashboard/chat-routes.ts
web/src/hooks/use-chat.ts
web/src/routes/chat.tsx
src/worker/scheduler.test.ts
```

### Files Modified

```
src/core/telegram/handlers.ts
src/core/telegram/handlers.test.ts
src/worker/worker.ts
src/core/dashboard/routes.ts
src/db/schema.ts
web/src/components/sidebar.tsx
```

### Verification Checklist

- [ ] `/help` command works in Telegram
- [ ] `/start` shows inline buttons
- [ ] Job completion shows action buttons
- [ ] Button clicks work (help, schedules, retry, etc.)
- [ ] Chat page accessible in dashboard
- [ ] Messages sync from Telegram to web
- [ ] Can send messages from web
- [ ] All tests pass

---

*Plan complete and ready for execution.*
