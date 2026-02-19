# peterbot Features

Overview of peterbot's capabilities and features.

---

## Background Jobs

peterbot runs tasks asynchronously using E2B cloud sandboxes. When you send a complex request:

1. **Job Creation** — Your task is queued with a unique job ID
2. **Processing** — The worker picks up the job and spins up a secure sandbox
3. **Execution** — Claude processes the task with access to code execution tools
4. **Delivery** — Results are sent back to you via Telegram

**Job States:**
- ⏳ **Pending** — Waiting to be processed
- 🔄 **Running** — Currently being executed
- ✅ **Completed** — Finished successfully
- ❌ **Failed** — Encountered an error (can retry with `/retry`)

---

## Scheduling

Automate recurring tasks with natural language scheduling:

- Create schedules with phrases like "every Monday 9am"
- Manage schedules with `/schedules`
- Automatic next-run calculation
- Enabled/disabled status tracking

**Use Cases:**
- Weekly briefings every Monday morning
- Daily summaries at midnight
- Regular check-ins on weekdays

---

## Solutions

Save and reuse successful approaches:

- Save completed jobs as solutions
- Automatic title and tag generation
- Searchable knowledge base of past solutions
- Solutions are suggested for similar future tasks

**Workflow:**
1. Complete a task successfully
2. Reply "save this solution" to the result
3. Select the job to save
4. Solution is auto-tagged and stored
5. Future similar tasks trigger solution suggestions

---

## Web Dashboard

Access peterbot through a web interface:

- View job status visually
- See conversation history
- Two-way chat (messages sync with Telegram)
- Monitor schedules and solutions

**Features:**
- Chat interface with message history
- Real-time message polling (5-second refresh)
- Optimistic UI for sent messages
- Date-grouped message display

---

## Conversation History

All interactions are logged and searchable:

- Complete message history in dashboard
- Messages grouped by date (Today, Yesterday, specific dates)
- User messages (blue, right-aligned) and bot messages (gray, left-aligned)
- Job associations tracked in message metadata

---

## Intent Detection

peterbot automatically categorizes your messages:

| Type | Characteristics | Response |
|------|----------------|----------|
| **Quick** | Short (< 100 chars), informational | Instant AI reply |
| **Task** | Long or contains task keywords | Background job |

**Task Keywords:** research, write, analyze, create, build, find, summarize, compile, report, draft, generate, make, prepare, search, compare, list, collect, gather, extract, translate

---

## Inline Buttons

Contextual action buttons appear in specific scenarios:

| Context | Buttons Available |
|---------|-------------------|
| Task completion | 📅 Schedule this · 💾 Save solution · ❔ Help |
| Schedule created | 📅 View all schedules · ❔ Help |
| Bot start (/start) | 📅 View schedules · 📚 View solutions · ❔ Help |

**Button Expiry:** Buttons expire after 5 minutes for security.

---

## Security Features

- Single-user authorization (configurable)
- Secure cloud sandbox execution (E2B)
- No code runs on the host machine
- Button action expiration (5-minute window)

---

## Technical Stack

- **Runtime:** Bun
- **Telegram:** Grammy
- **AI:** Vercel AI SDK with Claude
- **Database:** SQLite with Drizzle ORM
- **Sandbox:** E2B Code Interpreter
- **Web:** Hono + React dashboard
