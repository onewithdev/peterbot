# Feature Implementation Design

**Date:** 2026-02-19  
**Features:** Documentation & /help, Chat Module, Inline Buttons, Regression Testing

---

## Feature #1: Documentation & /help Command

### Architecture

**New Files:**
- `docs/commands.md` - All Telegram commands with usage examples
- `docs/features.md` - Feature descriptions and workflows  
- `docs/api.md` - Dashboard API reference

**Modified Files:**
- `src/core/telegram/handlers.ts` - Add `/help` command handler

### Data Flow

```
User: /help
  ↓
Bot: Formatted help message (Markdown)
     ├─ Quick commands list
     ├─ Common workflows
     └─ "Full docs in: docs/commands.md"
```

### Implementation Details

**Command Categories in /help:**
1. **Core Commands** - `/start`, `/status`, `/retry`, `/get`
2. **Scheduling** - `/schedule`, `/schedules`
3. **Solutions** - `/solutions`, "save this solution"
4. **Help** - `/help` (self-referential)

**docs/commands.md Structure:**
```markdown
# Command Reference

## /start
Introduction and quick start guide.

## /status
View all jobs (pending, running, completed, failed).
Usage: `/status`

## /schedule <when> "<what>"
Create a recurring schedule.
Usage: `/schedule every Monday 9am "send me a briefing"`

...
```

---

## Feature #2: Chat Module (2-Way Telegram Sync)

### Architecture

**New Database Schema** (`src/features/chat/schema.ts`):
```typescript
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text("chat_id").notNull(),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  content: text("content").notNull(),
  sender: text("sender", { enum: ["user", "bot"] }).notNull(),
  jobId: text("job_id"), // Optional: link to related job
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

**New Files:**
- `src/features/chat/schema.ts` - Database schema
- `src/features/chat/repository.ts` - CRUD operations
- `src/core/dashboard/chat-routes.ts` - API endpoints
- `web/src/routes/chat.tsx` - Chat UI page
- `web/src/hooks/use-chat.ts` - Polling hook

**Modified Files:**
- `web/src/components/sidebar.tsx` - Add Chat nav item
- `src/core/dashboard/routes.ts` - Mount chat routes
- `src/core/telegram/handlers.ts` - Save incoming/outgoing messages
- `src/worker/worker.ts` - Save bot responses

### API Endpoints

```
GET  /api/chat/messages?since=<timestamp>&limit=50
     → Returns messages newer than timestamp, max 50

POST /api/chat/send
     Body: { content: string }
     → Creates job or quick response, returns message
```

### Data Flow

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Telegram User  │────▶│  Bot Handler │────▶│  chat_messages  │
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                       │
                                                       │ poll
                                                       ▼
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Telegram User  │◀────│   Bot API    │◀────│   Web Chat UI   │
└─────────────────┘     └──────────────┘     └─────────────────┘
                              │                      │
                              └──── POST /send ──────┘
```

### Polling Strategy

- **Interval:** 5 seconds
- **Optimization:** Returns only messages with `created_at > since` param
- **Payload:** Minimal (id, content, sender, direction, timestamp)
- **Expected latency:** <100ms for API response

### Web UI Design

- WhatsApp-like interface
- Messages grouped by date
- "User" messages right-aligned (blue)
- "Bot" messages left-aligned (gray)
- Input box at bottom with send button
- Auto-scroll to newest message

---

## Feature #3: Context-Aware Inline Buttons

### Architecture

**New Files:**
- `src/core/telegram/buttons.ts` - Button configurations & helpers

**Modified Files:**
- `src/core/telegram/handlers.ts` - Add callback query handlers
- `src/worker/worker.ts` - Include buttons in result delivery

### Button Configurations

| Context | Button 1 | Button 2 | Button 3 | Button 4 |
|---------|----------|----------|----------|----------|
| **After task completion** | Schedule this | Save solution | Run again | New task |
| **After quick reply** | Follow up | Save helpful | Background task | Help |
| **When idle/no context** | Quick question | Background task | View schedules | Help |
| **After schedule created** | View all | New schedule | Back | Help |

### Implementation Details

**Button Structure:**
```typescript
interface ButtonConfig {
  text: string;
  callbackData: string; // JSON-encoded action
}

// Example callback data:
// { action: "schedule", jobId: "abc123" }
// { action: "save", jobId: "abc123" }
// { action: "retry", jobId: "abc123" }
// { action: "help" }
```

**Context Detection Logic:**
```typescript
function detectButtonContext(
  lastMessage: ChatMessage,
  recentJobs: Job[]
): ButtonContext {
  if (recentJobs.length > 0 && recentJobs[0].status === "completed") {
    return "task_completed";
  }
  if (lastMessage.sender === "bot" && lastMessage.jobId === null) {
    return "quick_reply";
  }
  return "idle";
}
```

**Callback Handlers:**
- `schedule` → Trigger `/schedule` flow with job input pre-filled
- `save` → Trigger solution save flow
- `retry` → Retry the same job input
- `help` → Show help message
- `new_task` → Prompt for new task
- `view_schedules` → Show /schedules
- `follow_up` → Prompt for follow-up question

### Override Behavior

- Buttons appear below each relevant bot message
- User typing any message → buttons remain but become inactive
- New bot message → old buttons are "stale" (show expiration notice if clicked)
- Callback expires after 5 minutes (Telegram limitation)

---

## Feature #4: Regression Testing

### Tests to Add (Post-Implementation)

#### Scheduler Tests (`src/worker/scheduler.test.ts`)

```typescript
describe("schedulerLoop", () => {
  test("fires due schedules and creates jobs", async () => {
    // Create schedule with nextRunAt in the past
    // Run scheduler iteration
    // Verify job was created
  });

  test("calculates next run time correctly", async () => {
    // Verify calculateNextRun updates schedule
  });

  test("disables schedule with invalid cron", async () => {
    // Inject bad cron expression
    // Verify schedule is disabled after error
  });

  test("handles update errors gracefully", async () => {
    // Simulate DB error during update
    // Verify safe nextRunAt is set
  });
});
```

#### Chat Module Tests

**Repository tests** (`src/features/chat/repository.test.ts`):
```typescript
describe("Chat Repository", () => {
  test("saveMessage stores message correctly");
  test("getMessagesSince returns only newer messages");
  test("getMessages respects limit parameter");
  test("messages ordered by createdAt asc");
});
```

**API tests** (add to `src/core/dashboard/routes.test.ts`):
```typescript
describe("Chat API", () => {
  test("GET /api/chat/messages requires auth");
  test("GET /api/chat/messages returns messages since timestamp");
  test("POST /api/chat/send requires auth");
  test("POST /api/chat/send creates quick response for simple query");
  test("POST /api/chat/send creates job for complex task");
});
```

#### Inline Button Tests (add to `src/core/telegram/handlers.test.ts`):

```typescript
describe("Inline Buttons", () => {
  test("callback query handler routes to correct action");
  test("schedule button triggers schedule flow");
  test("save button triggers solution save");
  test("expired callback shows expiration message");
  test("context detection returns correct buttons for completed job");
  test("context detection returns correct buttons for quick reply");
});
```

### Existing Tests to Maintain

All 306 passing tests remain. The 2 skipped AI-dependent tests are kept for manual/integration testing.

---

## Implementation Order

1. **Feature #1: Documentation & /help**
   - Foundation - establishes patterns
   - Low risk, immediate value

2. **Feature #3: Context-Aware Inline Buttons**
   - Immediate UX improvement
   - Builds on existing handler patterns
   - Enables better discovery of features

3. **Feature #2: Chat Module**
   - Most complex feature
   - Builds on patterns from #3 (callbacks, context)
   - Requires DB migration

4. **Feature #4: Regression Tests**
   - Final validation
   - Tests for gaps identified during implementation

---

## Migration Plan

**Database Migration:**
```sql
-- Run as part of Feature #2
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
  content TEXT NOT NULL,
  sender TEXT NOT NULL CHECK(sender IN ('user', 'bot')),
  job_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
```

---

## Open Questions / Decisions

1. **Chat History:** How far back to load? (Recommendation: last 100 messages, load more on scroll)
2. **Message Content:** Store full bot responses (could be large)? (Recommendation: yes, truncate in UI if needed)
3. **Button Expiration:** 5 minutes hardcoded or configurable? (Recommendation: 5 min is fine)

---

*Design validated and ready for implementation.*
