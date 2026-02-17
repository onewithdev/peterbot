# peterbot Tracer Bullet — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete peterbot tracer bullet — Telegram message in, background job via E2B + Claude, artifact delivered back to Telegram. Every layer touched, `bun test` green.

**Architecture:** Four layers working together: grammy (Telegram channel) → Drizzle/SQLite (job queue) → Bun Worker (orchestrator) → E2B + Vercel AI SDK (executor). Core server receives messages and handles delivery; Worker polls for jobs and processes them independently.

**Tech Stack:** Bun · grammy · Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) · Drizzle ORM · bun:sqlite · @e2b/code-interpreter · Hono · Railway

**Working directory:** `/home/mors/projects/antidote/peterbot/` — all paths below are relative to this.

---

## Pre-Flight: API Keys

Before any code, collect these. Keep this list handy.

| Key | How to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Open Telegram → search `@BotFather` → `/newbot` → follow prompts → copy token |
| `TELEGRAM_CHAT_ID` | Send any message to your new bot → visit `https://api.telegram.org/bot<TOKEN>/getUpdates` → find `"chat":{"id":XXXXXX}` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys → Create Key |
| `E2B_API_KEY` | e2b.dev → Sign up → Dashboard → API Keys |

---

## Task 1: Create project scaffold

**Files to create:**
- `peterbot/` (new directory inside `/home/mors/projects/antidote/`)
- `package.json`
- `.gitignore`
- `.env.example`
- `railway.toml`
- All empty directories

**Step 1: Create the project directory**

```bash
mkdir -p /home/mors/projects/antidote/peterbot
cd /home/mors/projects/antidote/peterbot
```

**Step 2: Create `package.json`**

```json
{
  "name": "peterbot",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun run src/core/server.ts",
    "worker": "bun run src/worker/worker.ts",
    "start": "bun run src/core/server.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "db:push": "bunx drizzle-kit push",
    "db:studio": "bunx drizzle-kit studio",
    "tracer": "bun run scripts/tracer.ts"
  },
  "dependencies": {
    "@ai-sdk/anthropic": "^1.1.0",
    "@e2b/code-interpreter": "^1.0.5",
    "ai": "^4.3.0",
    "drizzle-orm": "^0.38.3",
    "grammy": "^1.31.0",
    "hono": "^4.6.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "drizzle-kit": "^0.30.2"
  }
}
```

**Step 3: Create `.gitignore`**

```
node_modules/
data/
storage/
.env
*.db
*.db-shm
*.db-wal
```

**Step 4: Create `.env.example`**

```
# AI — BYOK (Bring Your Own Key)
# Swap ANTHROPIC_API_KEY for OPENAI_API_KEY etc. — see src/ai/client.ts
ANTHROPIC_API_KEY=sk-ant-...

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-...
TELEGRAM_CHAT_ID=123456789        # Your personal chat ID — only you can talk to peterbot

# E2B (cloud code sandbox)
E2B_API_KEY=e2b_...

# Database path (optional — defaults to ./data/jobs.db)
# SQLITE_DB_PATH=./data/jobs.db

# Server port (Railway sets this automatically)
PORT=3000
```

**Step 5: Create `railway.toml`**

```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "bun run src/core/server.ts"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

**Step 6: Create `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH || './data/jobs.db',
  },
});
```

**Step 7: Create all empty directories**

```bash
mkdir -p data storage/uploads storage/outputs
mkdir -p src/core/telegram src/core/dashboard
mkdir -p src/worker
mkdir -p src/features/jobs
mkdir -p src/db src/ai src/shared
mkdir -p scripts/tests docs
```

**Step 8: Install dependencies**

```bash
bun install
```

Expected output: `bun install v1.x` with packages listed, no errors.

**Step 9: Commit**

```bash
git add .
git commit -m "feat: scaffold peterbot project structure"
```

---

## Task 2: Database layer

**Files:**
- Create: `src/features/jobs/schema.ts`
- Create: `src/db/index.ts`
- Create: `src/db/schema.ts`

**Step 1: Create `src/features/jobs/schema.ts`**

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const jobs = sqliteTable('jobs', {
  // Primary key — UUID generated automatically
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // 'task' = background job, 'quick' = instant reply (no queue)
  type: text('type', { enum: ['task', 'quick'] }).notNull(),

  // Job lifecycle: pending → running → completed | failed
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed'],
  })
    .notNull()
    .default('pending'),

  // What the user asked for
  input: text('input').notNull(),

  // The result (text or file path prefix "[FILE:./storage/outputs/...]")
  output: text('output'),

  // Telegram chat ID — where to deliver the result
  chatId: text('chat_id').notNull(),

  // Whether the result has been sent back to the user
  delivered: integer('delivered', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
```

**Step 2: Create `src/db/index.ts`**

```typescript
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import * as schema from './schema';

const DB_PATH = process.env.SQLITE_DB_PATH || './data/jobs.db';

// Ensure data/ directory exists before opening the database
mkdirSync('./data', { recursive: true });

const sqlite = new Database(DB_PATH);

// WAL mode = better performance for concurrent reads/writes
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

// Re-export everything so callers can do: import { db, jobs } from '@/db'
export * from './schema';
```

**Step 3: Create `src/db/schema.ts`**

This file is the single source of truth — it imports and re-exports all feature schemas. Add one line per slice as the project grows.

```typescript
// Central schema composer — import all feature schemas here.
// When you add a new slice, add its schema export below.

export * from '../features/jobs/schema';
// export * from '../features/memory/schema';   // Slice 3
// export * from '../features/cron/schema';      // Slice 5
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add database layer and jobs schema"
```

---

## Task 3: God Script — prove the database works

**Files:**
- Create: `scripts/tracer.ts`

**Step 1: Create `scripts/tracer.ts`**

```typescript
/**
 * ═══════════════════════════════════════════════════════════
 * PETERBOT TRACER BULLET — GOD SCRIPT
 * ═══════════════════════════════════════════════════════════
 *
 * This script proves the database layer works before building
 * anything else. Run it after every schema change.
 *
 * Run: bun run scripts/tracer.ts
 * ═══════════════════════════════════════════════════════════
 */

import { db, jobs } from '../src/db';
import { eq } from 'drizzle-orm';

async function tracerBullet() {
  console.log('🎯 peterbot God Script\n');

  try {
    // ── Step 1: Create a job ───────────────────────────────
    console.log('📝 Creating test job...');
    const [job] = await db
      .insert(jobs)
      .values({
        type: 'task',
        status: 'pending',
        input: 'God Script test: prove the DB works',
        chatId: 'test-chat-123',
      })
      .returning();

    if (!job) throw new Error('Insert returned no rows');
    console.log(`✅ Created: ${job.id}`);

    // ── Step 2: Read it back ───────────────────────────────
    console.log('\n📋 Reading all jobs...');
    const allJobs = await db.select().from(jobs);
    console.log(`✅ Found ${allJobs.length} job(s)`);

    // ── Step 3: Update status ──────────────────────────────
    console.log('\n✏️  Updating job to running...');
    await db
      .update(jobs)
      .set({ status: 'running', updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    await db
      .update(jobs)
      .set({ status: 'completed', output: 'Hello from the tracer!', updatedAt: new Date() })
      .where(eq(jobs.id, job.id));

    const [updated] = await db.select().from(jobs).where(eq(jobs.id, job.id));
    console.log(`✅ Status: ${updated?.status}, Output: ${updated?.output}`);

    // ── Step 4: Clean up ───────────────────────────────────
    await db.delete(jobs).where(eq(jobs.id, job.id));
    console.log('\n🧹 Test job deleted');

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🎉 GOD SCRIPT PASSED — database layer works.');
    console.log('   You are ready for Task 4.');
    console.log('═══════════════════════════════════════════════════════════');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ GOD SCRIPT FAILED\n');
    console.error(err instanceof Error ? err.message : err);
    if (err instanceof Error && err.message.includes('no such table')) {
      console.error('\n💡 HINT: Run `bun run db:push` first to create the tables.');
    }
    process.exit(1);
  }
}

tracerBullet();
```

**Step 2: Push schema to create the database tables**

```bash
bun run db:push
```

Expected output:
```
[✓] Changes applied
```

**Step 3: Run the God Script**

```bash
bun run tracer
```

Expected output:
```
🎯 peterbot God Script

📝 Creating test job...
✅ Created: <some-uuid>

📋 Reading all jobs...
✅ Found 1 job(s)

✏️  Updating job to running...
✅ Status: completed, Output: Hello from the tracer!

🧹 Test job deleted

═══════════════════════════════════════════════════════════
🎉 GOD SCRIPT PASSED — database layer works.
   You are ready for Task 4.
═══════════════════════════════════════════════════════════
```

If it fails, do NOT proceed. Fix the error first.

**Step 4: Commit**

```bash
git add scripts/tracer.ts
git commit -m "feat: add god script — database layer verified"
```

---

## Task 4: Jobs feature (repository + validators + service)

**Files:**
- Create: `src/features/jobs/repository.ts`
- Create: `src/features/jobs/validators.ts`
- Create: `src/features/jobs/service.ts`

**Step 1: Create `src/features/jobs/repository.ts`**

All database operations for jobs live here. Nothing else touches the DB directly.

```typescript
import { db, jobs } from '../../db';
import { eq, desc } from 'drizzle-orm';
import type { NewJob, Job } from './schema';

/** Create a new pending job */
export async function createJob(input: Omit<NewJob, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<Job> {
  const [job] = await db.insert(jobs).values(input).returning();
  if (!job) throw new Error('Failed to create job');
  return job;
}

/** Get a single job by ID */
export async function getJobById(id: string): Promise<Job | null> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return job ?? null;
}

/** Get all jobs for a chat ID, newest first */
export async function getJobsByChatId(chatId: string): Promise<Job[]> {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.chatId, chatId))
    .orderBy(desc(jobs.createdAt))
    .limit(20);
}

/** Get all pending jobs (for the worker to pick up) */
export async function getPendingJobs(): Promise<Job[]> {
  return db.select().from(jobs).where(eq(jobs.status, 'pending')).limit(5);
}

/** Get completed jobs not yet delivered to Telegram */
export async function getUndeliveredJobs(): Promise<Job[]> {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'completed'))
    // SQLite: delivered = 0 means false
    .all()
    .then((rows) => rows.filter((j) => !j.delivered));
}

/** Mark a job as running */
export async function markRunning(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'running', updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

/** Mark a job as completed with output */
export async function markCompleted(id: string, output: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'completed', output, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

/** Mark a job as failed with error message */
export async function markFailed(id: string, error: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: 'failed', output: error, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

/** Mark a job as delivered (result sent to Telegram) */
export async function markDelivered(id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ delivered: true, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}
```

**Step 2: Create `src/features/jobs/validators.ts`**

```typescript
import { z } from 'zod';

export const createJobSchema = z.object({
  type: z.enum(['task', 'quick']),
  input: z.string().min(1).max(10000),
  chatId: z.string().min(1),
});

export const jobIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
```

**Step 3: Create `src/features/jobs/service.ts`**

Business logic for formatting the status command output.

```typescript
import type { Job } from './schema';

/** Format a job's age as a human-readable string */
function formatAge(createdAt: Date): string {
  const minutes = Math.round((Date.now() - createdAt.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/** Format a single job for display in Telegram */
function formatJob(job: Job): string {
  const icons: Record<Job['status'], string> = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
  };
  const icon = icons[job.status];
  const age = formatAge(job.createdAt);
  const preview = job.input.slice(0, 60) + (job.input.length > 60 ? '...' : '');
  const shortId = job.id.slice(0, 8);

  let line = `${icon} [${shortId}] ${age} — "${preview}"`;

  if (job.status === 'completed' && !job.delivered) {
    line += '\n   Reply "get ' + shortId + '" to retrieve';
  }
  if (job.status === 'failed') {
    line += '\n   Reply "retry ' + shortId + '" to try again';
  }

  return line;
}

/** Format all jobs for the /status command */
export function formatStatusMessage(jobs: Job[]): string {
  if (jobs.length === 0) {
    return '📋 No tasks yet.\n\nSend me something to work on!';
  }

  const running = jobs.filter((j) => j.status === 'running');
  const pending = jobs.filter((j) => j.status === 'pending');
  const completed = jobs.filter((j) => j.status === 'completed' && !j.delivered);
  const failed = jobs.filter((j) => j.status === 'failed');

  const sections: string[] = ['📋 Your tasks:\n'];

  if (running.length) sections.push(running.map(formatJob).join('\n'));
  if (pending.length) sections.push(pending.map(formatJob).join('\n'));
  if (completed.length) sections.push(completed.map(formatJob).join('\n'));
  if (failed.length) sections.push(failed.map(formatJob).join('\n'));

  return sections.join('\n');
}
```

**Step 4: Commit**

```bash
git add src/features/jobs/
git commit -m "feat: add jobs feature (repository, validators, service)"
```

---

## Task 5: Jobs tests — green checkpoint #1

**Files:**
- Create: `scripts/tests/jobs.test.ts`

**Step 1: Create `scripts/tests/jobs.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { jobs } from '../../src/features/jobs/schema';
import { eq } from 'drizzle-orm';

// Create a fresh in-memory DB for each test — never touches your real jobs.db
function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  // Create the jobs table inline for isolation
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      input TEXT NOT NULL,
      output TEXT,
      chat_id TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  return drizzle(sqlite, { schema: { jobs } });
}

describe('jobs schema and CRUD', () => {
  test('creates a job with default pending status', async () => {
    const db = createTestDb();
    const now = Date.now();

    const [job] = await db
      .insert(jobs)
      .values({
        type: 'task',
        input: 'test task',
        chatId: 'chat-123',
      })
      .returning();

    expect(job).toBeDefined();
    expect(job!.status).toBe('pending');
    expect(job!.delivered).toBe(false);
    expect(job!.output).toBeNull();
    expect(job!.createdAt.getTime()).toBeGreaterThanOrEqual(now);
  });

  test('updates job status to running then completed', async () => {
    const db = createTestDb();

    const [job] = await db
      .insert(jobs)
      .values({ type: 'task', input: 'test', chatId: 'chat-123' })
      .returning();

    await db
      .update(jobs)
      .set({ status: 'running' })
      .where(eq(jobs.id, job!.id));

    await db
      .update(jobs)
      .set({ status: 'completed', output: 'done!', delivered: false })
      .where(eq(jobs.id, job!.id));

    const [updated] = await db.select().from(jobs).where(eq(jobs.id, job!.id));
    expect(updated!.status).toBe('completed');
    expect(updated!.output).toBe('done!');
  });

  test('marks job as delivered', async () => {
    const db = createTestDb();

    const [job] = await db
      .insert(jobs)
      .values({ type: 'task', input: 'test', chatId: 'chat-123', status: 'completed' })
      .returning();

    await db
      .update(jobs)
      .set({ delivered: true })
      .where(eq(jobs.id, job!.id));

    const [updated] = await db.select().from(jobs).where(eq(jobs.id, job!.id));
    expect(updated!.delivered).toBe(true);
  });

  test('filters pending jobs correctly', async () => {
    const db = createTestDb();

    await db.insert(jobs).values([
      { type: 'task', input: 'job 1', chatId: 'chat-123', status: 'pending' },
      { type: 'task', input: 'job 2', chatId: 'chat-123', status: 'running' },
      { type: 'task', input: 'job 3', chatId: 'chat-123', status: 'completed' },
    ]);

    const pending = await db.select().from(jobs).where(eq(jobs.status, 'pending'));
    expect(pending).toHaveLength(1);
    expect(pending[0]!.input).toBe('job 1');
  });
});
```

**Step 2: Run tests**

```bash
bun test scripts/tests/jobs.test.ts
```

Expected output:
```
bun test v1.x

scripts/tests/jobs.test.ts:
✓ creates a job with default pending status
✓ updates job status to running then completed
✓ marks job as delivered
✓ filters pending jobs correctly

4 pass, 0 fail
```

If any tests fail, fix them before continuing.

**Step 3: Commit**

```bash
git add scripts/tests/jobs.test.ts
git commit -m "test: add jobs database tests — green checkpoint #1"
```

---

## Task 6: AI client (Vercel AI SDK — BYOK)

**Files:**
- Create: `src/ai/client.ts`
- Create: `src/ai/tools.ts`

**Step 1: Create `src/ai/client.ts`**

This is the only file you touch if you want to swap AI providers.

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';

/**
 * AI Client — Bring Your Own Key
 *
 * To switch models, change the model string in getModel().
 * To switch providers (e.g. OpenAI), install @ai-sdk/openai and
 * replace createAnthropic with createOpenAI here.
 */

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Returns the AI model to use.
 * Default: Claude Sonnet (fast + capable).
 * Override via MODEL env var: MODEL=claude-opus-4-5-20250929
 */
export function getModel() {
  const modelId = process.env.MODEL || 'claude-sonnet-4-5-20250929';
  return anthropic(modelId);
}
```

**Step 2: Create `src/ai/tools.ts`**

Tools are capabilities Claude can invoke during a task. The `runCode` tool connects to E2B.

```typescript
import { z } from 'zod';
import { tool } from 'ai';
import { runInSandbox } from '../worker/e2b';

/**
 * Tools available to Claude during task processing.
 * Add new tools here as peterbot's capabilities grow.
 */
export const peterbotTools = {
  /**
   * Run Python code in the E2B cloud sandbox.
   * Claude uses this for data analysis, file creation, web requests, etc.
   */
  runCode: tool({
    description:
      'Execute Python code in a secure cloud sandbox. Use this for data analysis, creating files, web scraping, calculations, or any task requiring code execution. Returns stdout, stderr, and paths to any generated files.',
    parameters: z.object({
      code: z.string().describe('The Python code to execute'),
      reasoning: z
        .string()
        .describe('Brief explanation of why this code is needed for the task'),
    }),
    execute: async ({ code, reasoning }) => {
      console.log(`[tool:runCode] ${reasoning}`);
      return runInSandbox(code);
    },
  }),
};
```

**Step 3: Commit**

```bash
git add src/ai/
git commit -m "feat: add AI client with BYOK configuration"
```

---

## Task 7: E2B sandbox client

**Files:**
- Create: `src/worker/e2b.ts`

**Step 1: Create `src/worker/e2b.ts`**

```typescript
import { Sandbox } from '@e2b/code-interpreter';
import { mkdirSync } from 'fs';

export interface SandboxResult {
  stdout: string;
  stderr: string;
  artifacts: string[];   // local paths to downloaded files
  error: string | null;
}

/**
 * Run Python code in an E2B cloud sandbox.
 * The sandbox is ephemeral — it spins up, runs, and is destroyed.
 * Any files saved to /home/user/ in the sandbox are downloaded
 * to ./storage/outputs/ locally.
 */
export async function runInSandbox(code: string): Promise<SandboxResult> {
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
    // Sandbox auto-destroys after 5 minutes of inactivity
    timeoutMs: 300_000,
  });

  try {
    const execution = await sandbox.runCode(code);

    const stdout = execution.logs.stdout.join('\n');
    const stderr = execution.logs.stderr.join('\n');
    const artifacts: string[] = [];

    // Download any files the code created in /home/user/
    if (execution.results) {
      mkdirSync('./storage/outputs', { recursive: true });

      for (const result of execution.results) {
        if (result.isFile && result.path) {
          const filename = result.path.split('/').pop() ?? 'output';
          const localPath = `./storage/outputs/${Date.now()}-${filename}`;

          const fileContent = await sandbox.files.read(result.path);
          await Bun.write(localPath, fileContent);
          artifacts.push(localPath);
        }
      }
    }

    return {
      stdout,
      stderr,
      artifacts,
      error: null,
    };
  } catch (err) {
    return {
      stdout: '',
      stderr: '',
      artifacts: [],
      error: err instanceof Error ? err.message : 'Sandbox execution failed',
    };
  } finally {
    // Always kill the sandbox when done
    await sandbox.kill();
  }
}
```

**Step 2: Commit**

```bash
git add src/worker/e2b.ts
git commit -m "feat: add E2B sandbox client"
```

---

## Task 8: Intent detection — green checkpoint #2

**Files:**
- Create: `src/core/telegram/intent.ts`
- Create: `src/core/telegram/intent.test.ts`

**Step 1: Write the failing test first**

Create `src/core/telegram/intent.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { detectIntent } from './intent';

describe('detectIntent — ejection point 2 (heuristic)', () => {
  test('short casual messages are quick', () => {
    expect(detectIntent('hello')).toBe('quick');
    expect(detectIntent('what time is it in tokyo?')).toBe('quick');
    expect(detectIntent('thanks!')).toBe('quick');
  });

  test('task keywords trigger background mode', () => {
    expect(detectIntent('research the best AI frameworks')).toBe('task');
    expect(detectIntent('write a report on climate change')).toBe('task');
    expect(detectIntent('analyze this data and summarize')).toBe('task');
    expect(detectIntent('create a PDF with my weekly goals')).toBe('task');
    expect(detectIntent('find all open issues on GitHub')).toBe('task');
    expect(detectIntent('compile a list of top newsletters')).toBe('task');
    expect(detectIntent('draft an email to my team')).toBe('task');
    expect(detectIntent('build a comparison table')).toBe('task');
  });

  test('long messages over 100 chars are tasks', () => {
    const longMessage = 'a'.repeat(101);
    expect(detectIntent(longMessage)).toBe('task');
  });

  test('short messages with task keywords are still tasks', () => {
    expect(detectIntent('research X')).toBe('task');
    expect(detectIntent('write this')).toBe('task');
  });

  test('case insensitive', () => {
    expect(detectIntent('RESEARCH something')).toBe('task');
    expect(detectIntent('Write a report')).toBe('task');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/telegram/intent.test.ts
```

Expected: FAIL with "Cannot find module './intent'"

**Step 3: Create `src/core/telegram/intent.ts`**

```typescript
/**
 * Intent Detection — Ejection Point 2
 *
 * Simple heuristic to decide if a message should be a
 * background task or an instant reply.
 *
 * EJECT TO: Claude-powered intent detection when this gets
 * too many wrong answers. Replace this entire function with
 * a generateText() call that classifies the message.
 */

const TASK_KEYWORDS = [
  'research', 'write', 'analyze', 'analyse', 'create', 'build',
  'find', 'summarize', 'summarise', 'compile', 'report', 'draft',
  'generate', 'make', 'prepare', 'search', 'compare', 'list',
  'collect', 'gather', 'extract', 'translate',
];

export type Intent = 'task' | 'quick';

/**
 * Detect whether a message should be a background task or instant reply.
 *
 * Returns 'task' if:
 *   - Message is over 100 characters, OR
 *   - Message contains a task keyword
 *
 * Returns 'quick' otherwise.
 */
export function detectIntent(message: string): Intent {
  if (message.length > 100) return 'task';

  const lower = message.toLowerCase();
  if (TASK_KEYWORDS.some((kw) => lower.includes(kw))) return 'task';

  return 'quick';
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/telegram/intent.test.ts
```

Expected:
```
✓ short casual messages are quick
✓ task keywords trigger background mode
✓ long messages over 100 chars are tasks
✓ short messages with task keywords are still tasks
✓ case insensitive

5 pass, 0 fail
```

**Step 5: Commit**

```bash
git add src/core/telegram/
git commit -m "feat: add intent detection with tests — green checkpoint #2"
```

---

## Task 9: Telegram bot and message handlers

**Files:**
- Create: `src/core/telegram/bot.ts`
- Create: `src/core/telegram/handlers.ts`
- Create: `src/core/telegram/handlers.test.ts`

**Step 1: Write the failing tests first**

Create `src/core/telegram/handlers.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { formatStatusReply, formatAckReply, formatQuickReply } from './handlers';

describe('Telegram message formatters', () => {
  test('formatAckReply includes a short job ID', () => {
    const jobId = 'abc12345-dead-beef-1234-567890abcdef';
    const reply = formatAckReply(jobId);
    expect(reply).toContain('abc12345');
    expect(reply).toContain('status');
  });

  test('formatQuickReply wraps the AI response', () => {
    const reply = formatQuickReply('Paris is the capital of France.');
    expect(reply).toBe('Paris is the capital of France.');
  });

  test('formatStatusReply with no jobs', () => {
    const reply = formatStatusReply([]);
    expect(reply).toContain('No tasks');
  });

  test('formatStatusReply with a running job', () => {
    const fakeJob = {
      id: 'abc12345-dead-beef-1234-567890abcdef',
      type: 'task' as const,
      status: 'running' as const,
      input: 'Research AI frameworks',
      output: null,
      chatId: '12345',
      delivered: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
      updatedAt: new Date(),
    };
    const reply = formatStatusReply([fakeJob]);
    expect(reply).toContain('🔄');
    expect(reply).toContain('Research AI frameworks');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/telegram/handlers.test.ts
```

Expected: FAIL — formatters not defined yet.

**Step 3: Create `src/core/telegram/handlers.ts`**

```typescript
import { Bot } from 'grammy';
import { detectIntent } from './intent';
import { createJob, getJobsByChatId } from '../../features/jobs/repository';
import { formatStatusMessage } from '../../features/jobs/service';
import { generateText } from 'ai';
import { getModel } from '../../ai/client';
import type { Job } from '../../features/jobs/schema';

// ── Formatters (pure functions — easy to test) ─────────────────

export function formatAckReply(jobId: string): string {
  const shortId = jobId.slice(0, 8);
  return `Got it ✓ I'm on it.\n\nJob ID: \`${shortId}\`\nSend /status to check progress.`;
}

export function formatQuickReply(text: string): string {
  return text;
}

export function formatStatusReply(jobs: Job[]): string {
  return formatStatusMessage(jobs);
}

// ── Bot handler setup ──────────────────────────────────────────

export function setupHandlers(bot: Bot): void {
  const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

  // Guard — only respond to the authorized user
  // Ejection point 1: remove this check when adding multi-user support
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    if (authorizedChatId && chatId !== authorizedChatId) {
      await ctx.reply('Sorry, I only work for my owner.');
      return;
    }
    await next();
  });

  // /start — welcome message
  bot.command('start', async (ctx) => {
    await ctx.reply(
      '👋 Hi! I\'m peterbot.\n\n' +
      'Send me a task and I\'ll work on it in the background.\n' +
      'Use /status to see what I\'m working on.'
    );
  });

  // /status — show all jobs
  bot.command('status', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const allJobs = await getJobsByChatId(chatId);
    await ctx.reply(formatStatusReply(allJobs), { parse_mode: 'Markdown' });
  });

  // Main message handler
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();

    // Skip commands — they're handled above
    if (text.startsWith('/')) return;

    const intent = detectIntent(text);

    if (intent === 'quick') {
      // Answer immediately with Claude — no queue
      await ctx.replyWithChatAction('typing');
      try {
        const { text: response } = await generateText({
          model: getModel(),
          system:
            'You are peterbot, a helpful personal AI assistant. ' +
            'Answer concisely and directly.',
          prompt: text,
        });
        await ctx.reply(formatQuickReply(response));
      } catch (err) {
        await ctx.reply('Sorry, I hit an error. Try again.');
        console.error('[handlers] quick reply error:', err);
      }
    } else {
      // Queue as background task
      const job = await createJob({ type: 'task', input: text, chatId });
      await ctx.reply(formatAckReply(job.id), { parse_mode: 'Markdown' });
    }
  });
}
```

**Step 4: Create `src/core/telegram/bot.ts`**

```typescript
import { Bot } from 'grammy';
import { setupHandlers } from './handlers';

let bot: Bot | null = null;

/** Get or create the singleton bot instance */
export function getBot(): Bot {
  if (!bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set in .env');
    bot = new Bot(token);
    setupHandlers(bot);
  }
  return bot;
}
```

**Step 5: Run tests**

```bash
bun test src/core/telegram/handlers.test.ts
```

Expected:
```
✓ formatAckReply includes a short job ID
✓ formatQuickReply wraps the AI response
✓ formatStatusReply with no jobs
✓ formatStatusReply with a running job

4 pass, 0 fail
```

**Step 6: Commit**

```bash
git add src/core/telegram/
git commit -m "feat: add Telegram bot and message handlers with tests"
```

---

## Task 10: Background worker — green checkpoint #3

**Files:**
- Create: `src/worker/worker.ts`
- Create: `src/worker/worker.test.ts`

**Step 1: Write the failing test first**

Create `src/worker/worker.test.ts`:

```typescript
import { describe, test, expect } from 'bun:test';
import { buildSystemPrompt, shouldUseE2B } from './worker';

describe('worker helpers', () => {
  test('buildSystemPrompt returns a non-empty string', () => {
    const prompt = buildSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(10);
    expect(prompt).toContain('peterbot');
  });

  test('shouldUseE2B detects code-execution tasks', () => {
    expect(shouldUseE2B('analyze this CSV file')).toBe(true);
    expect(shouldUseE2B('generate a chart from this data')).toBe(true);
    expect(shouldUseE2B('write a Python script to scrape X')).toBe(true);
    expect(shouldUseE2B('write a summary of this article')).toBe(false);
    expect(shouldUseE2B('research AI trends')).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/worker/worker.test.ts
```

Expected: FAIL — functions not defined yet.

**Step 3: Create `src/worker/worker.ts`**

```typescript
import { generateText } from 'ai';
import { Bot } from 'grammy';
import { getModel } from '../ai/client';
import { peterbotTools } from '../ai/tools';
import {
  getPendingJobs,
  markRunning,
  markCompleted,
  markFailed,
  markDelivered,
} from '../features/jobs/repository';
import type { Job } from '../features/jobs/schema';
import { mkdirSync } from 'fs';

const POLL_INTERVAL_MS = 2000;

// ── Pure helper functions (exported for testing) ──────────────

export function buildSystemPrompt(): string {
  return `You are peterbot, a capable personal AI assistant.
Complete the user's task thoroughly and return a clear, well-formatted result.
If the task requires code execution (data analysis, file creation, web requests,
calculations), use the runCode tool.
Format your final response in Markdown when appropriate.
Today's date: ${new Date().toDateString()}.`;
}

export function shouldUseE2B(input: string): boolean {
  const codeKeywords = [
    'csv', 'chart', 'graph', 'plot', 'script', 'code', 'calculate',
    'scrape', 'download', 'data', 'analysis', 'analyze', 'analyse',
    'spreadsheet', 'excel', 'json', 'api call', 'fetch',
  ];
  const lower = input.toLowerCase();
  return codeKeywords.some((kw) => lower.includes(kw));
}

// ── Job processor ─────────────────────────────────────────────

async function processJob(job: Job): Promise<void> {
  console.log(`[worker] Processing job ${job.id.slice(0, 8)}: "${job.input.slice(0, 60)}"`);
  await markRunning(job.id);

  try {
    // Use tools only when the task likely needs code execution
    const tools = shouldUseE2B(job.input) ? peterbotTools : undefined;

    const { text } = await generateText({
      model: getModel(),
      system: buildSystemPrompt(),
      prompt: job.input,
      tools,
      maxSteps: 10, // Allow up to 10 tool calls
    });

    // Save any output files to storage/outputs/
    mkdirSync('./storage/outputs', { recursive: true });

    await markCompleted(job.id, text);
    console.log(`[worker] ✅ Completed job ${job.id.slice(0, 8)}`);

    // Deliver result to Telegram
    await deliverResult(job, text);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    await markFailed(job.id, errorMsg);
    console.error(`[worker] ❌ Failed job ${job.id.slice(0, 8)}:`, errorMsg);

    // Notify user of failure
    await notifyFailure(job, errorMsg);
  }
}

async function deliverResult(job: Job, result: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const bot = new Bot(token);
    const shortId = job.id.slice(0, 8);

    await bot.api.sendMessage(
      job.chatId,
      `✅ Task complete! [${shortId}]\n\n${result}`,
      { parse_mode: 'Markdown' }
    );

    await markDelivered(job.id);
    console.log(`[worker] 📨 Delivered job ${shortId} to chat ${job.chatId}`);
  } catch (err) {
    console.error('[worker] Failed to deliver result via Telegram:', err);
  }
}

async function notifyFailure(job: Job, error: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const bot = new Bot(token);
    const shortId = job.id.slice(0, 8);

    await bot.api.sendMessage(
      job.chatId,
      `❌ Task failed [${shortId}]\n\nError: ${error}\n\nReply "retry ${shortId}" to try again.`
    );
  } catch (err) {
    console.error('[worker] Failed to send failure notification:', err);
  }
}

// ── Main polling loop ─────────────────────────────────────────

async function pollLoop(): Promise<void> {
  console.log('[worker] 🚀 Started — polling for jobs every', POLL_INTERVAL_MS, 'ms');

  while (true) {
    try {
      const pending = await getPendingJobs();
      for (const job of pending) {
        // Process jobs sequentially — parallel processing comes in Slice 11
        await processJob(job);
      }
    } catch (err) {
      console.error('[worker] Poll loop error:', err);
    }

    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

// Start the loop when this file is run directly
pollLoop().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
```

**Step 4: Run tests**

```bash
bun test src/worker/worker.test.ts
```

Expected:
```
✓ buildSystemPrompt returns a non-empty string
✓ shouldUseE2B detects code-execution tasks

2 pass, 0 fail
```

**Step 5: Run the full test suite**

```bash
bun test
```

Expected: All tests pass. If anything fails, fix it before continuing.

**Step 6: Commit**

```bash
git add src/worker/
git commit -m "feat: add background worker with job processor — green checkpoint #3"
```

---

## Task 11: Core server + entry point

**Files:**
- Create: `src/core/server.ts`
- Create: `src/shared/config.ts`

**Step 1: Create `src/shared/config.ts`**

```typescript
/**
 * Centralized config — reads from .env and validates required values.
 * Throws clear errors at startup if anything is missing.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `Copy .env.example to .env and fill in your API keys.`
    );
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  e2bApiKey: process.env.E2B_API_KEY ?? '',
};
```

**Step 2: Create `src/core/server.ts`**

```typescript
import { Hono } from 'hono';
import { getBot } from './telegram/bot';
import { Bun } from 'bun';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', name: 'peterbot', ts: Date.now() }));

// ── Basic dashboard (Slice 2 will expand this) ───────────────
app.get('/', (c) =>
  c.html(`
    <!DOCTYPE html>
    <html>
      <head><title>peterbot</title></head>
      <body style="font-family:sans-serif;padding:2rem;">
        <h1>peterbot</h1>
        <p>Running ✅</p>
        <p>Talk to me on Telegram.</p>
        <p><small>Web dashboard coming in Slice 2.</small></p>
      </body>
    </html>
  `)
);

// ── Start Telegram bot (long-polling) ────────────────────────
async function startBot() {
  const bot = getBot();
  console.log('[core] 🤖 Starting Telegram bot...');

  // Use long-polling (works on Railway without webhook setup)
  bot.start({
    onStart: (info) => {
      console.log(`[core] ✅ Bot @${info.username} is running`);
    },
  });
}

// ── Start worker as child process ────────────────────────────
function startWorker() {
  console.log('[core] 🔧 Starting background worker...');
  const worker = Bun.spawn(['bun', 'src/worker/worker.ts'], {
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env as Record<string, string>,
  });

  // Restart worker if it crashes
  worker.exited.then((code) => {
    if (code !== 0) {
      console.error(`[core] Worker exited with code ${code}, restarting...`);
      setTimeout(startWorker, 2000);
    }
  });
}

// ── Boot sequence ─────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? '3000', 10);

console.log(`[core] 🚀 peterbot starting on port ${port}`);
startWorker();
startBot();

export default {
  port,
  fetch: app.fetch,
};
```

**Step 3: Commit**

```bash
git add src/core/server.ts src/shared/
git commit -m "feat: add core server with health check and boot sequence"
```

---

## Task 12: Local end-to-end smoke test

Before deploying to Railway, verify everything works locally.

**Step 1: Copy `.env.example` to `.env` and fill in your keys**

```bash
cp .env.example .env
```

Open `.env` and fill in all 4 values (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY, E2B_API_KEY).

**Step 2: Push the database schema**

```bash
bun run db:push
```

**Step 3: Run the God Script one more time to confirm the DB is ready**

```bash
bun run tracer
```

Expected: `🎉 GOD SCRIPT PASSED`

**Step 4: Run the full test suite**

```bash
bun test
```

Expected: All tests pass. Zero failures.

**Step 5: Start peterbot locally**

```bash
bun run dev
```

Expected output:
```
[core] 🚀 peterbot starting on port 3000
[core] 🔧 Starting background worker...
[worker] 🚀 Started — polling for jobs every 2000 ms
[core] 🤖 Starting Telegram bot...
[core] ✅ Bot @yourbot is running
```

**Step 6: Test in Telegram**

Open Telegram, find your bot, and run through this sequence:

```
You: /start
peterbot: 👋 Hi! I'm peterbot...

You: what is 2 + 2?
peterbot: 4          ← instant reply, no queue

You: research the top 3 AI frameworks and write a summary
peterbot: Got it ✓ I'm on it. Job ID: `abc12345`...

You: /status
peterbot: 📋 Your tasks:
          🔄 [abc12345] just now — "research the top 3 AI frameworks..."

[a few minutes later, automatically]
peterbot: ✅ Task complete! [abc12345]
          ...the summary...
```

If all 3 interactions work, the tracer bullet is complete.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: tracer bullet complete — full end-to-end verified locally"
```

---

## Task 13: Deploy to Railway

**Step 1: Create a GitHub repository for peterbot**

```bash
cd /home/mors/projects/antidote/peterbot
git remote add origin https://github.com/YOUR_USERNAME/peterbot.git
git push -u origin master
```

**Step 2: Connect Railway to the repo**

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select your `peterbot` repository
3. Railway will detect Bun and start building

**Step 3: Add environment variables in Railway**

In Railway dashboard → your project → Variables → Add all 4:
```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
ANTHROPIC_API_KEY=...
E2B_API_KEY=...
```

**Step 4: Verify the deploy**

Railway will show build logs. Wait for:
```
[core] ✅ Bot @yourbot is running
```

Visit the Railway URL → should show the peterbot status page.

**Step 5: Final test from Telegram**

Send a task from Telegram. If peterbot responds from Railway (not your local machine), the deployment is complete.

**Step 6: Final commit**

```bash
git add railway.toml
git commit -m "deploy: peterbot tracer bullet live on Railway"
git push
```

---

## ✅ Tracer Bullet Complete

All layers verified:
- [x] Telegram receives messages (grammy)
- [x] Intent detection routes quick vs task
- [x] Quick questions answered instantly (Vercel AI SDK + Claude)
- [x] Background tasks queued in SQLite (Drizzle)
- [x] Worker polls and processes jobs (E2B + Claude)
- [x] Results delivered back to Telegram
- [x] `/status` shows full task list
- [x] `bun test` green throughout
- [x] Live on Railway

**Next session:** Slice 1 — Soul.md personality file. Create `docs/plans/2026-02-17-peterbot-slice-1-soul.md`.
