# peterbot — Design Document

**Date:** 2026-02-17
**Status:** Approved
**Named after:** Peter Steinberger, creator of OpenClaw

---

## What is peterbot

A personal AI agent that runs 24/7 on Railway. You assign it tasks via Telegram, it works in the background — minutes or hours — and delivers completed artifacts back to you. It also monitors things proactively and sends you updates without being asked.

**Core loop:**
```
You → Telegram: "Research X and write a report"
peterbot → Telegram: "Got it ✓"
[works in background via E2B cloud sandbox]
peterbot → Telegram: "Here's your report 📎"
```

---

## Methodology

Built using the **Keystone Methodology** adapted for agent frameworks. See `docs/PHILOSOPHY.md` for the full reference.

### Tracer Bullet
The first build proves every layer of the architecture works end-to-end in a single vertical slice. No partial builds. Every layer touched on day one.

### Elephant Carpaccio
Every feature after the tracer is a thin, independently deployable slice. Each slice makes peterbot meaningfully better. You stop whenever you want — every checkpoint is a working product.

### Ejection Pattern
Start with the simplest implementation. Design it so upgrading later is a clean swap, not a rewrite. Three ejections planned:
1. Single user → Multi-user (hardcoded chat ID → user lookup)
2. Simple task detection → AI-powered intent detection (heuristic → Claude decides)
3. Flat memory → Vector search (MEMORY.md → semantic retrieval)

---

## Tracer Bullet (Day 1–3)

The complete first build. Nothing more, nothing less.

### What it does
- Receives messages via Telegram
- Detects intent: quick question (instant reply) vs background task (queued)
- Creates a job in SQLite for background tasks
- Sends immediate acknowledgment: `"Got it ✓"`
- Worker picks up the job, spins up E2B cloud sandbox
- Claude (via Vercel AI SDK) processes the task
- Delivers the artifact back via Telegram
- `status` command returns full task list (running, queued, done, failed)
- `retry` and `get [job]` commands for job management

### God Script
Before anything else: `bun run scripts/tracer.ts` proves the database schema and job queue work. Green = proceed to building.

### Required setup (4 API keys)
| Key | Where | Cost |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram | Free |
| `ANTHROPIC_API_KEY` | console.anthropic.com | Pay per use |
| `E2B_API_KEY` | e2b.dev | Free tier |
| Railway account | railway.app | ~$5/month |

---

## Feature Roadmap (Elephant Carpaccio — 18 Slices)

Each slice = one feature folder + tests + ships independently.

### Phase 1 — Personal & Safe

| # | Feature | What it adds |
|---|---|---|
| 1 | **Soul.md** | peterbot gets a personality — tone, values, communication style. One file, immediate effect on every response |
| 2 | **Web Dashboard** | Visual job status in browser. Chat from laptop. Artifact previews |
| 3 | **Two-Layer Memory** | Layer 1: `MEMORY.md` quick facts. Layer 2: searchable history log. Stops forgetting who you are |
| 4 | **Command Blocklist** | Blocks dangerous commands from ever running in E2B |

### Phase 2 — Proactive

| # | Feature | What it adds |
|---|---|---|
| 5 | **Cron + Proactive Messaging** | Scheduled tasks ("every Monday 9am, send briefing"). peterbot pings you without being asked |
| 6 | **Session Auto-Compaction** | Long conversations auto-summarized. peterbot stays fast |
| 7 | **Solution Memory** | Saves what worked. Recalls successful approaches for similar future tasks |

### Phase 3 — Extensible

| # | Feature | What it adds |
|---|---|---|
| 8 | **Skills System** | Drop a `.skill.md` file into `/skills`, peterbot gains a new capability. No coding required |
| 9 | **Document Knowledge Base** | Upload PDFs, spreadsheets, docs. peterbot searches and references them |
| 10 | **Composio** | One-click OAuth to Gmail, GitHub, Notion, Slack, and 1000+ others |

### Phase 4 — Powerful

| # | Feature | What it adds |
|---|---|---|
| 11 | **Agent Workers** | Parallel sub-agents via Vercel AI SDK. "Research 5 topics simultaneously" |
| 12 | **Browser Automation** | Controls a real browser. Fills forms, scrapes data, takes screenshots |
| 13 | **Email Integration** | Read and reply to email. Powered by Composio (already installed at Slice 10) |
| 14 | **Image Generation** | Generate images via Claude or OpenAI. Delivered to Telegram |

### Phase 5 — Enterprise

| # | Feature | What it adds |
|---|---|---|
| 15 | **MCP Protocol** | Universal tool connections — the USB port of AI integrations |
| 16 | **Google Workspace** | Full Gmail, Calendar, Docs, Sheets integration |
| 17 | **GitHub Integration** | Manage issues, review PRs, trigger CI from chat |
| 18 | **Project Workspace Isolation** | Separate memory and instructions per client or project |

---

## Technical Stack

### Core dependencies (tracer only — 8 total)

| Tool | Role |
|---|---|
| **Bun** | Runtime + test runner. One tool for everything |
| **grammy** | Telegram library. TypeScript-first, Bun-compatible |
| **Vercel AI SDK** (`ai`) | AI brain. BYOK, swap Claude for any model in one line |
| `@ai-sdk/anthropic` | Claude adapter. Swap for `@ai-sdk/openai` anytime |
| **Hono** | Web server. Powers API and web dashboard |
| **Drizzle ORM** | TypeScript types from schema. No typos, no bad queries |
| `bun:sqlite` | SQLite driver. Built into Bun, zero install |
| `@e2b/code-interpreter` | Cloud sandbox. AI code runs in cloud, not on your machine |
| **Zod** | Input validation. Bad data never reaches the database |

### Added per phase (installed only when needed)

| Phase | Dependency |
|---|---|
| Slice 5 (Cron) | `node-cron` |
| Slice 10 (Composio) | `@composio-core/sdk` |
| Slice 12 (Browser) | `playwright` |

### `.env` file

```
ANTHROPIC_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...          # Your chat ID — ejection point 1
E2B_API_KEY=...
PORT=3000
```

### Hosting
Railway. One `railway.toml`. Push to GitHub, peterbot is live. Zero server management.

---

## Directory Structure

```
peterbot/
│
├── data/                          # Runtime data (gitignored)
│   └── jobs.db
│
├── storage/                       # File cache (gitignored)
│   ├── uploads/
│   └── outputs/
│
├── skills/                        # Drop .skill.md files here (Slice 8)
│   └── example.skill.md
│
├── src/
│   ├── core/                      # Always-on interfaces
│   │   ├── server.ts              # Hono entry point
│   │   ├── telegram/              # Channel 1
│   │   │   ├── bot.ts
│   │   │   ├── handlers.ts
│   │   │   └── handlers.test.ts
│   │   └── dashboard/             # Channel 2 (Slice 2)
│   │       ├── routes.ts
│   │       └── routes.test.ts
│   │
│   ├── worker/                    # Background processor
│   │   ├── worker.ts              # SQLite polling loop
│   │   ├── worker.test.ts
│   │   └── e2b.ts                 # E2B sandbox client
│   │
│   ├── features/                  # ONE FOLDER PER SLICE
│   │   ├── jobs/                  # Tracer bullet
│   │   │   ├── schema.ts
│   │   │   ├── repository.ts
│   │   │   ├── validators.ts
│   │   │   ├── service.ts
│   │   │   └── jobs.test.ts
│   │   ├── memory/                # Slice 3
│   │   ├── blocklist/             # Slice 4
│   │   ├── cron/                  # Slice 5
│   │   ├── compaction/            # Slice 6
│   │   ├── solution-memory/       # Slice 7
│   │   ├── skills/                # Slice 8
│   │   ├── knowledge-base/        # Slice 9
│   │   ├── composio/              # Slice 10
│   │   └── ...                    # Each new slice adds here
│   │
│   ├── db/
│   │   ├── index.ts               # bun:sqlite + Drizzle connection
│   │   └── schema.ts              # Imports all feature schemas
│   │
│   └── ai/
│       ├── client.ts              # Vercel AI SDK — BYOK config
│       └── tools.ts               # Tool definitions for the agent
│
├── scripts/
│   ├── tracer.ts                  # God Script — run this first
│   └── tests/
│       └── jobs.test.ts
│
├── docs/
│   ├── PHILOSOPHY.md              # Keystone methodology for peterbot
│   ├── ARCHITECTURE.md            # System design and layer breakdown
│   ├── PATTERNS.md                # Clone rule — how to add a new slice
│   ├── ROADMAP.md                 # 18 slices and their status
│   └── plans/                    # Design session outputs
│       └── 2026-02-17-peterbot-design.md
│
├── soul.md                        # peterbot's personality (Slice 1)
├── README.md                      # Setup in 3 commands
├── .env                           # API keys (gitignored)
├── .env.example                   # Setup template
├── drizzle.config.ts
├── package.json
└── railway.toml
```

### The clone rule — adding any new slice

```
1. Create src/features/{slice-name}/
2. Add schema.ts, repository.ts, validators.ts, service.ts, *.test.ts
3. Export schema from src/db/schema.ts
4. Wire into core or worker as needed
5. bun test passes green
6. Ship
```

---

## Testing Strategy

Every slice ships with tests. `bun test` must be green before the next slice starts.

| Test type | Location | Tests |
|---|---|---|
| Unit | `src/features/{name}/*.test.ts` | Pure functions, parsers, validators |
| Integration | `src/core/**/*.test.ts` | Telegram handlers, API routes |
| Database | `scripts/tests/{name}.test.ts` | Schema, queries, constraints |
| God Script | `scripts/tracer.ts` | Proves DB works before anything else |

---

## Ejection Points

| # | Simple start | Eject when | Upgrade to |
|---|---|---|---|
| 1 | Hardcoded `TELEGRAM_CHAT_ID` | Want multi-user | User lookup table |
| 2 | Heuristic task detection (message length + keywords) | Getting wrong too often | Claude-powered intent detection |
| 3 | Flat `MEMORY.md` text file | Memory too large to read fully | Vector search (Pinecone) |

---

## What peterbot is NOT (scope boundaries)

- Not a WhatsApp bot (dropped — Telegram only for now)
- Not a multi-tenant SaaS (ejection point 1 handles this later)
- Not a coding agent for others to use (Coding Agent Orchestration dropped)
- Not a platform with community plugins (Plugin SDK dropped)
- Not dependent on any single AI provider (Vercel AI SDK handles this)
