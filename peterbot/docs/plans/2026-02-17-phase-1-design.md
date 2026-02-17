# Phase 1 Design — Personal & Safe

**Date:** 2026-02-17  
**Scope:** Slices 1-4 (Soul.md, Web Dashboard, Two-Layer Memory, Command Blocklist)  
**Status:** Ready for implementation

---

## Overview

Phase 1 transforms peterbot from a basic task queue into a **personalized, configurable AI assistant**. The dashboard becomes the admin control center — you chat in Telegram, you configure in the browser.

**Philosophy:** Config-first, not chat-first. The dashboard is for *managing* peterbot, not replacing Telegram.

---

## Architecture

### New Files

```
peterbot/
├── soul.md                    # Personality definition (Slice 1)
├── memory.md                  # Permanent facts about you (Slice 3)
├── config/
│   └── blocklist.json         # Dangerous command patterns (Slice 4)
└── skills/                    # Directory for .skill.md files (Slice 8 prep)
    └── .gitkeep
```

### New Database Tables

None. Reuses existing `jobs` table for Layer 2 memory (history).

### Dashboard Routes (`/admin/*`)

| Route | Purpose |
|-------|---------|
| `/admin` | Overview: status, recent jobs, quick actions |
| `/admin/soul` | Edit `soul.md` with live preview |
| `/admin/memory` | Edit `MEMORY.md`, browse job history |
| `/admin/monitor` | Real-time job logs, execution viewer |
| `/admin/skills` | Upload/manage `.skill.md` files (placeholder) |
| `/admin/config` | Blocklist editor, placeholders for future settings |

---

## Slice 1: Soul.md

### Purpose
Give peterbot a consistent personality — tone, values, communication style.

### Implementation

**File:** `soul.md` (created at project root)

**Content example:**
```markdown
# Peterbot Personality

## Tone
Professional but approachable. Efficient yet warm. Like a capable 
colleague who's genuinely helpful.

## Communication Style
- Be concise but thorough
- Use bullet points for complex information
- Ask clarifying questions when tasks are ambiguous
- Celebrate successes, acknowledge failures directly

## Values
- Accuracy over speed
- Transparency about limitations
- Respect user's time
```

**Integration:**
- Worker reads `soul.md` at startup
- Content prepended to system prompt for every job
- If file missing, uses default personality

**Dashboard UI (`/admin/soul`):**
- Split-pane editor (left: markdown, right: preview)
- Shows how peterbot currently "sounds"
- Save → updates immediately for next job

---

## Slice 2: Web Dashboard

### Purpose
Admin control panel for configuration, monitoring, and debugging.

### Layout

**Persistent Sidebar (desktop):**
```
┌─────────────────────────────────────────────┐
│  🧠 peterbot        │  [Content Area]       │
│                     │                       │
│  📊 Overview        │                       │
│  🎭 Soul            │                       │
│  🧠 Memory          │                       │
│  📺 Monitor         │                       │
│  ⚡ Skills          │                       │
│  ⚙️ Config          │                       │
│                     │                       │
│  ─────────────────  │                       │
│  🖥️ Dev Console     │  [launch modal]       │
│                     │                       │
└─────────────────────────────────────────────┘
```

### Routes

#### `/admin` (Overview)
- System status: Bot connected? Worker running? Last job time?
- Quick stats: Jobs today, pending, failed
- Recent activity feed (last 5 jobs)
- One-click actions: "Pause worker", "Clear completed"

#### `/admin/monitor` (Real-Time Monitoring)

```
┌─────────────────────────────────────────────────────────┐
│  🔴 Worker: RUNNING    │  Last poll: 2s ago             │
│  📋 Queue: 1 pending   │  ⏸️ Pause  🔄 Force Poll       │
├─────────────────────────────────────────────────────────┤
│  ACTIVE JOB [abc123]                    [⏹️ Cancel]     │
│  ─────────────────────────────────────────────────────  │
│  Status: 🔄 running (45s elapsed)                       │
│  Input: "Scrape HN and summarize top AI posts"          │
│                                                         │
│  [Live Logs]                               [Raw JSON]   │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 12:34:05 ▶ Starting job abc123                 │    │
│  │ 12:34:06 ▶ Tools enabled: runCode              │    │
│  │ 12:34:07 ▶ [tool:runCode] Fetching HN API...   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Generated Files:                                       │
│  📄 hn_summary_2025-02-17.md  [Download] [View]         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Refresh behavior:**
- Default: Auto-refresh every 15 seconds
- Smart pause: Stops when tab hidden or no active jobs for 60s
- Manual refresh button always available
- Zero token cost — just reads SQLite

**Features:**
- Cancel button: Sets job to `failed` with reason "Cancelled by user"
- File preview: View text inline, images in modal
- Log streaming: Worker writes to DB, dashboard polls and appends

#### Dev Console (Modal/Full-screen)

Direct E2B access for testing/debugging:

```
┌─────────────────────────────────────────────────────────┐
│  🖥️ Dev Console                    [✕] [Pop Out ↗]      │
│  ─────────────────────────────────────────────────────  │
│  ⚠️  Direct E2B access — commands run immediately       │
│                                                         │
│  > import pandas as pd                                  │
│  > df = pd.read_csv('data.csv')                         │
│  > df.describe()                                        │
│  [Run]                                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │          count       mean        std    min      │    │
│  │ age       100.0  34.560000  12.345678   18.0    │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  📎 Files in sandbox: [data.csv] [Download] [Delete]    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Dev Console vs Background Jobs:**

| | Background Jobs | Dev Console |
|--|----------------|-------------|
| **Queue** | Yes (pending → running) | No (instant) |
| **Blocklist** | Strict | Permissive (warns only) |
| **Persistence** | Saved to jobs table | Ephemeral (console only) |
| **Trigger** | Telegram message | You typing in dashboard |

---

## Slice 3: Two-Layer Memory

### Purpose
Stop peterbot from forgetting who you are and what you've discussed.

### Architecture

**Layer 1: Permanent Facts (`memory.md`)**
- You edit directly (or via dashboard text editor)
- Worker loads and prepends to system prompt
- Format: Your choice (markdown, key-value, whatever)

**Layer 2: Conversation History (jobs table)**
- Every job already stores: input, output, timestamp, status
- Repository queries by date range, text search
- Dashboard browser with search/filter

**No new dependencies.** Uses existing file system + SQLite.

### Dashboard UI (`/admin/memory`)

**Split View:**

```
┌─────────────────────────┬─────────────────────────────┐
│  📝 MEMORY.md Editor    │  📜 Conversation History    │
│                         │                             │
│  [text editor]          │  [search bar]               │
│                         │  [date filter ▼]            │
│  Key facts peterbot     │  ─────────────────────      │
│  should remember:       │                             │
│                         │  ⏳ [abc123] 2h ago         │
│  - company = Acme Inc   │  "Analyze Q3 sales..."      │
│  - timezone = PST       │                             │
│  - prefers_brief = true │  ✅ [def456] 5h ago         │
│                         │  "Research competitors..."  │
│  [Save Changes]         │                             │
│                         │  [Load More]                │
│                         │                             │
└─────────────────────────┴─────────────────────────────┘
```

**History features:**
- Search across `input` and `output` columns
- Date filters: Today, This week, This month, All time
- Click to expand full conversation
- "Reference this" button (copies job ID for future context features)

**Ejection Point:** When history gets unwieldy:
- Add embeddings column to jobs table (SQLite supports this)
- Semantic search: "What did I ask about Python?"
- Auto-summarization of old conversations

---

## Slice 4: Command Blocklist

### Purpose
Prevent AI from accidentally running dangerous commands.

### Architecture

**Two execution contexts:**

| Context | Blocklist | Use Case |
|---------|-----------|----------|
| **Background Jobs** (Telegram tasks) | **Strict** — blocks dangerous patterns | Safety first |
| **Dev Console** (Dashboard) | **Permissive** — warns but allows | You're in control |

**Config file:** `config/blocklist.json`

```json
{
  "strict": {
    "patterns": [
      "rm -rf",
      "sudo .*",
      "mkfs.*",
      "> /dev/sd"
    ],
    "action": "block",
    "message": "This command is blocked in background tasks for safety."
  },
  "warn": {
    "patterns": [
      "pip install",
      "apt-get"
    ],
    "action": "warn",
    "message": "This may take a while or require permissions."
  }
}
```

### Dashboard UI (`/admin/config`)

```
┌─────────────────────────────────────────────────────────┐
│  ⚙️ Configuration                                       │
│                                                         │
│  ── Blocklist ───────────────────────────────────────   │
│                                                         │
│  Background Job Protection:  [Enabled ✓]                │
│                                                         │
│  Blocked patterns:                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ rm -rf /                                        │ ✕   │
│  │ sudo .*                                         │ ✕   │
│  │ mkfs.*                                          │ ✕   │
│  │ > /dev/sd[a-z]                                  │ ✕   │
│  └─────────────────────────────────────────────────┘    │
│  [+ Add pattern]                                        │
│                                                         │
│  ── Future Settings (placeholders) ─────────────────    │
│                                                         │
│  [  ] Model Selection        [Claude Sonnet ▼] 🔒       │
│  [  ] API Key Management                     🔒         │
│  [  ] Notification Preferences               🔒         │
│  [  ] Custom Tools                           🔒         │
│                                                         │
│  🔒 = Coming in future slices                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Slice 8 Prep: Skills Directory

**Placeholder UI only** — no backend logic yet.

```
┌─────────────────────────────────────────────────────────┐
│  Skills (Coming in Slice 8)                             │
│                                                         │
│  📁 /skills/                                            │
│                                                         │
│  [Drop .skill.md files here]  or  [Browse...]           │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  Current Skills: 0                                      │
│                                                         │
│  💡 Skills let you add capabilities without code.       │
│     Example: drop a "write-emails.skill.md" with        │
│     instructions, and peterbot learns email writing.    │
│                                                         │
│  [View Example Skill]  [Read Docs →]                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Current functionality:**
- File upload zone (accepts `.md` files)
- Lists files in `/skills/` directory
- Saves files, doesn't use them yet

**Future (Slice 8):** Worker reads all `.skill.md` files and includes in system prompt as tool definitions.

---

## Technical Notes

### Dependencies

**No new dependencies for Phase 1.** Uses existing stack:
- Hono (already installed) for dashboard routes
- SQLite/Drizzle (already installed) for data
- File system for markdown files

### Security

- Dev console is permissive but requires dashboard access (no auth yet — single-user assumption)
- Blocklist only applies to worker-processed jobs
- All AI code execution still happens in E2B sandbox (unchanged)

### Testing Strategy

Each slice needs:
1. **Unit tests:** Dashboard API routes, blocklist matching logic
2. **Integration tests:** File changes reflect in next job, history appears in dashboard
3. **Manual smoke test:** Verify dashboard loads, edits save, monitor refreshes

---

## Implementation Order

1. **Slice 1 (Soul.md)** — simplest, establishes pattern
2. **Slice 4 (Blocklist)** — adds safety before expanding capabilities
3. **Slice 2 (Dashboard)** — builds UI framework for remaining slices
4. **Slice 3 (Memory)** — uses dashboard framework, completes Phase 1

---

## Success Criteria

- [ ] `soul.md` edits change peterbot's tone immediately
- [ ] Dashboard loads at `/admin` with all navigation working
- [ ] Monitor shows live job status with 15s refresh
- [ ] Dev console runs code directly without queue
- [ ] `memory.md` content appears in job context
- [ ] Job history searchable in dashboard
- [ ] Dangerous commands blocked in background jobs
- [ ] All tests pass (`bun test`)
