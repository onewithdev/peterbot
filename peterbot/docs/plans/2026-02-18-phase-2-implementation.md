# Phase 2 Implementation Plan — Proactive

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Date:** 2026-02-18  
**Scope:** Slices 5-7 (Cron + Proactive Messaging, Session Auto-Compaction, Solution Memory)  
**Philosophy:** Elephant Carpaccio — thin vertical slices, each deployable end-to-end  

---

## Keystone Principles Applied

### Law of the Breach: Vertical Slices
Each slice touches **all layers**: Database → Repository → Service → API → UI. No horizontal building.

### Law of the Clone: Copy the Pattern
Follow the exact structure of existing features (`src/features/jobs/`):
```
src/features/{slice}/
├── schema.ts        # Drizzle table definition
├── repository.ts    # Database queries
├── service.ts       # Business logic
└── *.test.ts        # Unit tests
```

### Elephant Carpaccio: Thin, Complete Slices
Each slice is completable in 2-4 hours. Ship each slice before starting the next.

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│  SLICE 5: Cron + Proactive Messaging                            │
│  ├─ Task 1: Database Schema (schedules table)                   │
│  ├─ Task 2: Repository Layer (CRUD operations)                  │
│  ├─ Task 3: Natural Language Parser                             │
│  ├─ Task 4: Scheduler Service (cron loop)                       │
│  ├─ Task 5: API Routes (dashboard endpoints)                    │
│  ├─ Task 6: Telegram Commands                                   │
│  └─ Task 7: Dashboard UI (schedule management)                  │
├─────────────────────────────────────────────────────────────────┤
│  SLICE 6: Session Auto-Compaction                               │
│  ├─ Task 8: Database Schema (sessions table)                    │
│  ├─ Task 9: Repository Layer                                    │
│  ├─ Task 10: Compaction Service (message counting)              │
│  ├─ Task 11: Summary Generation                                 │
│  ├─ Task 12: Integration with Worker                            │
│  └─ Task 13: Dashboard UI (session viewer)                      │
├─────────────────────────────────────────────────────────────────┤
│  SLICE 7: Solution Memory                                       │
│  ├─ Task 14: Database Schema (solutions table)                  │
│  ├─ Task 15: Repository Layer                                   │
│  ├─ Task 16: Keyword Extraction Service                         │
│  ├─ Task 17: Similarity Matching Algorithm                      │
│  ├─ Task 18: Auto-Tagging with AI                               │
│  ├─ Task 19: Telegram Commands (/solutions)                     │
│  ├─ Task 20: Proactive Suggestion Logic                         │
│  └─ Task 21: Dashboard UI (Solution Playbook)                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Flight Checklist

Before starting Task 1:
- [ ] Phase 1 is complete and stable
- [ ] `bun test` passes (all existing tests green)
- [ ] `bun run tracer` passes (God Script)
- [ ] Dashboard loads without errors
- [ ] All Phase 1 features work (soul, memory, blocklist)

---

## SLICE 5: Cron + Proactive Messaging

### Task 1: Database Schema (30 min)

**Purpose:** Create the `schedules` table for recurring tasks.

**Files:**
- Modify: `src/features/cron/schema.ts` (create)
- Modify: `src/db/schema.ts` (export)

**Step 1: Create schema file**

File: `src/features/cron/schema.ts`

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Scheduled Tasks (Slice 5)
 * 
 * Stores recurring tasks that create jobs automatically.
 * Natural language schedules are parsed to cron expressions.
 */
export const schedules = sqliteTable("schedules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  description: text("description").notNull(),
  naturalSchedule: text("natural_schedule").notNull(), // "every monday 9am"
  parsedCron: text("parsed_cron").notNull(),           // "0 9 * * 1"
  prompt: text("prompt").notNull(),                    // What to execute
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
  nextRunAt: integer("next_run_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
```

**Step 2: Export from central schema**

File: `src/db/schema.ts`

```typescript
// Central schema composer - single source of truth for Drizzle

// Jobs feature (Phase 1)
export * from "../features/jobs/schema";

// Phase 2 - Slice 5: Cron
export * from "../features/cron/schema";

// Future slices:
// export * from "../features/compaction/schema";  // Slice 6
// export * from "../features/solutions/schema";   // Slice 7
```

**Step 3: Push schema**

```bash
bun run db:push
```

**Step 4: Verify**

```bash
bun run scripts/tracer.ts
```

Expected: Pass (schema loads without errors)

---

### Task 2: Repository Layer (45 min)

**Purpose:** Database operations for schedules.

**Files:**
- Create: `src/features/cron/repository.ts`
- Create: `src/features/cron/repository.test.ts`

**Step 1: Create repository**

File: `src/features/cron/repository.ts`

```typescript
import { eq, lte, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { schedules, type NewSchedule, type Schedule } from "./schema.js";

/**
 * Create a new schedule
 */
export async function createSchedule(
  db: BunSQLiteDatabase,
  data: NewSchedule
): Promise<Schedule> {
  const [schedule] = await db
    .insert(schedules)
    .values({
      ...data,
      updatedAt: new Date(),
    })
    .returning();
  
  return schedule;
}

/**
 * Get all schedules
 */
export async function getAllSchedules(
  db: BunSQLiteDatabase
): Promise<Schedule[]> {
  return db.select().from(schedules).orderBy(schedules.createdAt);
}

/**
 * Get enabled schedules due to run now
 */
export async function getDueSchedules(
  db: BunSQLiteDatabase,
  now: Date = new Date()
): Promise<Schedule[]> {
  return db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.enabled, true),
        lte(schedules.nextRunAt, now)
      )
    );
}

/**
 * Get a single schedule by ID
 */
export async function getScheduleById(
  db: BunSQLiteDatabase,
  id: string
): Promise<Schedule | undefined> {
  const [schedule] = await db
    .select()
    .from(schedules)
    .where(eq(schedules.id, id));
  
  return schedule;
}

/**
 * Update a schedule
 */
export async function updateSchedule(
  db: BunSQLiteDatabase,
  id: string,
  data: Partial<NewSchedule>
): Promise<Schedule | undefined> {
  const [schedule] = await db
    .update(schedules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id))
    .returning();
  
  return schedule;
}

/**
 * Delete a schedule
 */
export async function deleteSchedule(
  db: BunSQLiteDatabase,
  id: string
): Promise<boolean> {
  const result = await db
    .delete(schedules)
    .where(eq(schedules.id, id));
  
  return result.changes > 0;
}

/**
 * Update last run and calculate next run time
 */
export async function updateScheduleRunTime(
  db: BunSQLiteDatabase,
  id: string,
  nextRunAt: Date
): Promise<void> {
  await db
    .update(schedules)
    .set({
      lastRunAt: new Date(),
      nextRunAt,
      updatedAt: new Date(),
    })
    .where(eq(schedules.id, id));
}

/**
 * Toggle schedule enabled state
 */
export async function toggleSchedule(
  db: BunSQLiteDatabase,
  id: string,
  enabled: boolean
): Promise<Schedule | undefined> {
  return updateSchedule(db, id, { enabled });
}
```

**Step 2: Write tests**

File: `src/features/cron/repository.test.ts`

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema";
import {
  createSchedule,
  getAllSchedules,
  getDueSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  updateScheduleRunTime,
} from "./repository.js";
import { schedules } from "./schema.js";

describe("cron repository", () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    db = drizzle(sqlite, { schema });
    
    // Create tables
    sqlite.exec(`
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

  test("createSchedule inserts and returns schedule", async () => {
    const schedule = await createSchedule(db, {
      description: "Monday briefing",
      naturalSchedule: "every monday 9am",
      parsedCron: "0 9 * * 1",
      prompt: "Send tech news briefing",
      nextRunAt: new Date("2026-02-23T09:00:00Z"),
    });

    expect(schedule.description).toBe("Monday briefing");
    expect(schedule.parsedCron).toBe("0 9 * * 1");
    expect(schedule.enabled).toBe(true);
  });

  test("getAllSchedules returns all schedules ordered by createdAt", async () => {
    await createSchedule(db, {
      description: "First",
      naturalSchedule: "daily",
      parsedCron: "0 0 * * *",
      prompt: "Daily check",
      nextRunAt: new Date(),
    });
    
    await createSchedule(db, {
      description: "Second",
      naturalSchedule: "weekly",
      parsedCron: "0 0 * * 0",
      prompt: "Weekly check",
      nextRunAt: new Date(),
    });

    const all = await getAllSchedules(db);
    expect(all).toHaveLength(2);
    expect(all[0].description).toBe("First");
    expect(all[1].description).toBe("Second");
  });

  test("getDueSchedules returns only enabled schedules past nextRunAt", async () => {
    const now = new Date("2026-02-18T10:00:00Z");
    
    // Due schedule
    await createSchedule(db, {
      description: "Due",
      naturalSchedule: "daily",
      parsedCron: "0 9 * * *",
      prompt: "Check",
      nextRunAt: new Date("2026-02-18T09:00:00Z"), // Past
      enabled: true,
    });
    
    // Not due (future)
    await createSchedule(db, {
      description: "Future",
      naturalSchedule: "daily",
      parsedCron: "0 9 * * *",
      prompt: "Check",
      nextRunAt: new Date("2026-02-19T09:00:00Z"),
      enabled: true,
    });
    
    // Disabled
    await createSchedule(db, {
      description: "Disabled",
      naturalSchedule: "daily",
      parsedCron: "0 9 * * *",
      prompt: "Check",
      nextRunAt: new Date("2026-02-18T08:00:00Z"), // Past
      enabled: false,
    });

    const due = await getDueSchedules(db, now);
    expect(due).toHaveLength(1);
    expect(due[0].description).toBe("Due");
  });

  test("updateSchedule modifies schedule", async () => {
    const created = await createSchedule(db, {
      description: "Original",
      naturalSchedule: "daily",
      parsedCron: "0 0 * * *",
      prompt: "Check",
      nextRunAt: new Date(),
    });

    const updated = await updateSchedule(db, created.id, {
      description: "Updated",
    });

    expect(updated?.description).toBe("Updated");
  });

  test("deleteSchedule removes schedule", async () => {
    const created = await createSchedule(db, {
      description: "To delete",
      naturalSchedule: "daily",
      parsedCron: "0 0 * * *",
      prompt: "Check",
      nextRunAt: new Date(),
    });

    const deleted = await deleteSchedule(db, created.id);
    expect(deleted).toBe(true);

    const found = await getScheduleById(db, created.id);
    expect(found).toBeUndefined();
  });

  test("toggleSchedule enables/disables", async () => {
    const created = await createSchedule(db, {
      description: "Toggle me",
      naturalSchedule: "daily",
      parsedCron: "0 0 * * *",
      prompt: "Check",
      nextRunAt: new Date(),
      enabled: true,
    });

    const disabled = await toggleSchedule(db, created.id, false);
    expect(disabled?.enabled).toBe(false);

    const enabled = await toggleSchedule(db, created.id, true);
    expect(enabled?.enabled).toBe(true);
  });
});
```

**Step 3: Run tests**

```bash
bun test src/features/cron/repository.test.ts
```

Expected: All tests pass

---

### Task 3: Natural Language Parser (60 min)

**Purpose:** Convert "every monday 9am" → cron expression using AI.

**Files:**
- Create: `src/features/cron/natural-parser.ts`
- Create: `src/features/cron/natural-parser.test.ts`

**Step 1: Create parser service**

File: `src/features/cron/natural-parser.ts`

```typescript
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../../ai/client.js";

const parseResultSchema = z.object({
  cron: z.string().regex(/^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/),
  description: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ParseResult = z.infer<typeof parseResultSchema>;

/**
 * Parse natural language schedule into cron expression
 * 
 * Examples:
 * - "every monday 9am" → "0 9 * * 1"
 * - "every weekday at 8:30am" → "30 8 * * 1-5"
 * - "first day of every month" → "0 0 1 * *"
 * - "every 3 hours" → "0 */3 * * *"
 */
export async function parseNaturalSchedule(
  input: string
): Promise<ParseResult> {
  const result = await generateObject({
    model: getModel(),
    schema: parseResultSchema,
    system: `You are a cron expression parser. Convert natural language schedules into valid cron expressions.

Rules:
- Output standard 5-part cron: minute hour day month weekday
- Use 24-hour time format
- Days: 0=Sunday, 1=Monday, ..., 6=Saturday
- Months: 1-12
- Use ranges (1-5) and steps (*/3) where appropriate
- Confidence: "high" for clear schedules, "medium" for ambiguous, "low" for unclear

Examples:
- "every monday 9am" → cron: "0 9 * * 1", description: "Every Monday at 9:00 AM"
- "daily at 8am" → cron: "0 8 * * *", description: "Daily at 8:00 AM"
- "every 30 minutes" → cron: "*/30 * * * *", description: "Every 30 minutes"`,
    prompt: `Parse this schedule: "${input}"`,
  });

  return result.object;
}

/**
 * Calculate next run time from cron expression
 * Uses node-cron parser
 */
export function calculateNextRun(cronExpression: string, from: Date = new Date()): Date {
  // We'll implement this in Task 4 using node-cron
  // For now, placeholder that adds 1 hour
  const next = new Date(from);
  next.setHours(next.getHours() + 1);
  return next;
}

/**
 * Validate if a string looks like a natural language schedule
 */
export function looksLikeSchedule(input: string): boolean {
  const scheduleKeywords = [
    "every",
    "daily",
    "weekly",
    "monthly",
    "hourly",
    "at",
    "on",
    "am",
    "pm",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
    "day",
    "week",
    "month",
  ];
  
  const lower = input.toLowerCase();
  return scheduleKeywords.some(kw => lower.includes(kw));
}
```

**Step 2: Write tests**

File: `src/features/cron/natural-parser.test.ts`

```typescript
import { describe, test, expect } from "bun:test";
import { parseNaturalSchedule, looksLikeSchedule } from "./natural-parser.js";

describe("natural-parser", () => {
  describe("parseNaturalSchedule", () => {
    test("parses daily schedule", async () => {
      const result = await parseNaturalSchedule("every day at 9am");
      
      expect(result.cron).toBe("0 9 * * *");
      expect(result.confidence).toBe("high");
      expect(result.description).toContain("9:00");
    });

    test("parses weekly schedule", async () => {
      const result = await parseNaturalSchedule("every monday at 10:30am");
      
      expect(result.cron).toBe("30 10 * * 1");
      expect(result.description.toLowerCase()).toContain("monday");
    });

    test("parses hourly schedule", async () => {
      const result = await parseNaturalSchedule("every 2 hours");
      
      expect(result.cron).toBe("0 */2 * * *");
    });
  });

  describe("looksLikeSchedule", () => {
    test("returns true for schedule-like input", () => {
      expect(looksLikeSchedule("every monday")).toBe(true);
      expect(looksLikeSchedule("daily at 9am")).toBe(true);
      expect(looksLikeSchedule("once a week")).toBe(true);
    });

    test("returns false for non-schedule input", () => {
      expect(looksLikeSchedule("hello world")).toBe(false);
      expect(looksLikeSchedule("12345")).toBe(false);
      expect(looksLikeSchedule("what is the weather")).toBe(false);
    });
  });
});
```

**Step 3: Run tests**

```bash
bun test src/features/cron/natural-parser.test.ts
```

Note: These tests make actual AI calls. If you want to mock, skip for now and verify manually.

---

### Task 4: Scheduler Service (45 min)

**Purpose:** Cron loop that checks for due schedules and creates jobs.

**Files:**
- Create: `src/worker/scheduler.ts`
- Modify: `src/worker/worker.ts` (start scheduler)

**Step 1: Install dependency**

```bash
cd /home/mors/projects/antidote/peterbot && bun add node-cron
bun add -d @types/node-cron
```

**Step 2: Create scheduler service**

File: `src/worker/scheduler.ts`

```typescript
/**
 * Scheduler Loop
 * 
 * Runs continuously, checking for due schedules every minute.
 * When a schedule is due, creates a job and updates next run time.
 */

import { schedule as cronSchedule } from "node-cron";
import { getDueSchedules, updateScheduleRunTime } from "../features/cron/repository.js";
import { createJob } from "../features/jobs/repository.js";
import { db } from "../db/index.js";
import { config } from "../shared/config.js";

const SCHEDULER_INTERVAL_MS = 60000; // 1 minute

/**
 * Calculate next run time from cron expression
 */
export function getNextRunTime(cronExpression: string, from: Date = new Date()): Date {
  // Use node-cron to get next scheduled date
  const task = cronSchedule(cronExpression, () => {}, { scheduled: false });
  
  // node-cron doesn't expose next run directly, so we simulate
  // For production, consider using cron-parser library
  const next = new Date(from);
  
  // Simple heuristic: add time based on cron parts
  const parts = cronExpression.split(" ");
  if (parts[0].startsWith("*/")) {
    // Minute interval
    const interval = parseInt(parts[0].replace("*/", ""));
    next.setMinutes(next.getMinutes() + interval);
  } else if (parts[1] === "*" && parts[0] !== "*") {
    // Specific minute, any hour
    next.setHours(next.getHours() + 1);
  } else {
    // Default: add 1 day
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Process a single due schedule - create job and update timestamp
 */
async function processSchedule(schedule: { id: string; prompt: string; parsedCron: string }): Promise<void> {
  console.log(`[Scheduler] Processing schedule ${schedule.id.slice(0, 8)}`);
  
  try {
    // Create a job from the schedule
    const job = await createJob(db, {
      type: "task",
      input: schedule.prompt,
      chatId: config.telegramChatId,
    });
    
    console.log(`[Scheduler] Created job ${job.id.slice(0, 8)} from schedule ${schedule.id.slice(0, 8)}`);
    
    // Calculate and update next run time
    const nextRunAt = getNextRunTime(schedule.parsedCron);
    await updateScheduleRunTime(db, schedule.id, nextRunAt);
    
    console.log(`[Scheduler] Next run for ${schedule.id.slice(0, 8)}: ${nextRunAt.toISOString()}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Scheduler] Failed to process schedule ${schedule.id.slice(0, 8)}:`, message);
  }
}

/**
 * Main scheduler loop
 */
export async function schedulerLoop(): Promise<void> {
  console.log(`[Scheduler] Starting scheduler loop (interval: ${SCHEDULER_INTERVAL_MS}ms)`);
  
  while (true) {
    try {
      const now = new Date();
      const dueSchedules = await getDueSchedules(db, now);
      
      if (dueSchedules.length > 0) {
        console.log(`[Scheduler] Found ${dueSchedules.length} due schedule(s)`);
        
        for (const schedule of dueSchedules) {
          await processSchedule(schedule);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[Scheduler] Error in scheduler loop:", message);
    }
    
    await Bun.sleep(SCHEDULER_INTERVAL_MS);
  }
}

/**
 * Start the scheduler (non-blocking)
 */
export function startScheduler(): void {
  schedulerLoop().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Scheduler] Fatal error:", message);
    process.exit(1);
  });
}
```

**Step 3: Start scheduler from worker**

File: `src/worker/worker.ts`

Add at the end (before the `if (import.meta.main)` block):

```typescript
import { startScheduler } from "./scheduler.js";

// Start scheduler in background
startScheduler();
```

Actually, better approach - start both in parallel. Modify the bottom of worker.ts:

```typescript
// Start the worker and scheduler if this file is run directly
if (import.meta.main) {
  // Start both worker and scheduler
  Promise.all([
    pollLoop(),
    schedulerLoop(),
  ]).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Worker/Scheduler] Fatal error:", errorMessage);
    process.exit(1);
  });
}
```

Wait, these are both infinite loops. We need to run them in parallel without Promise.all blocking:

```typescript
// Start the worker and scheduler if this file is run directly
if (import.meta.main) {
  // Start worker loop (doesn't await - it's infinite)
  pollLoop().catch((error) => {
    console.error("[Worker] Fatal error:", error);
    process.exit(1);
  });
  
  // Start scheduler loop (doesn't await - it's infinite)
  schedulerLoop().catch((error) => {
    console.error("[Scheduler] Fatal error:", error);
    process.exit(1);
  });
  
  console.log("[Main] Worker and Scheduler started");
}
```

**Step 4: Run and verify**

```bash
bun run dev
```

Watch logs for: `[Scheduler] Starting scheduler loop`

---

### Task 5: API Routes (45 min)

**Purpose:** Dashboard endpoints for schedule management.

**Files:**
- Modify: `src/core/dashboard/routes.ts` (add schedule endpoints)

**Step 1: Add schedule routes**

Append to `src/core/dashboard/routes.ts`:

```typescript
// Schedule routes (Slice 5)
import { z } from "zod";
import {
  getAllSchedules,
  createSchedule,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
} from "../../features/cron/repository.js";
import { parseNaturalSchedule, looksLikeSchedule } from "../../features/cron/natural-parser.js";

// GET /api/schedules - List all schedules
dashboardApp.get("/schedules", async (c) => {
  const password = c.req.header("X-Dashboard-Password");
  if (!verifyPassword(password)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const schedules = await getAllSchedules(db);
  return c.json({ schedules });
});

// POST /api/schedules - Create new schedule
dashboardApp.post("/schedules", async (c) => {
  const password = c.req.header("X-Dashboard-Password");
  if (!verifyPassword(password)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  
  // Validate input
  const schema = z.object({
    description: z.string().min(1),
    naturalSchedule: z.string().min(1),
    prompt: z.string().min(1),
  });
  
  const result = schema.safeParse(body);
  if (!result.success) {
    return c.json({ error: "Validation Error", details: result.error }, 400);
  }

  // Parse natural language to cron
  try {
    const parsed = await parseNaturalSchedule(result.data.naturalSchedule);
    
    if (parsed.confidence === "low") {
      return c.json({ 
        error: "Could not understand schedule",
        suggestion: "Try something like 'every Monday at 9am' or 'daily at 8:30am'"
      }, 400);
    }

    // Create schedule
    const schedule = await createSchedule(db, {
      description: result.data.description,
      naturalSchedule: result.data.naturalSchedule,
      parsedCron: parsed.cron,
      prompt: result.data.prompt,
      nextRunAt: new Date(), // Will be updated by scheduler
    });

    return c.json({ 
      success: true, 
      schedule,
      parsed: {
        cron: parsed.cron,
        description: parsed.description,
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Failed to parse schedule", message }, 400);
  }
});

// DELETE /api/schedules/:id
dashboardApp.delete("/schedules/:id", async (c) => {
  const password = c.req.header("X-Dashboard-Password");
  if (!verifyPassword(password)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const deleted = await deleteSchedule(db, id);
  
  if (!deleted) {
    return c.json({ error: "Not Found" }, 404);
  }
  
  return c.json({ success: true });
});

// POST /api/schedules/:id/toggle
dashboardApp.post("/schedules/:id/toggle", async (c) => {
  const password = c.req.header("X-Dashboard-Password");
  if (!verifyPassword(password)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  const body = await c.req.json();
  const enabled = body.enabled;
  
  if (typeof enabled !== "boolean") {
    return c.json({ error: "Bad Request" }, 400);
  }
  
  const schedule = await toggleSchedule(db, id, enabled);
  
  if (!schedule) {
    return c.json({ error: "Not Found" }, 404);
  }
  
  return c.json({ success: true, schedule });
});
```

**Step 2: Run and test**

```bash
bun run dev
```

Test with curl:
```bash
curl -X POST http://localhost:3000/api/schedules \
  -H "Content-Type: application/json" \
  -H "X-Dashboard-Password: your_password" \
  -d '{"description":"Test","naturalSchedule":"every day at 9am","prompt":"Say hello"}'
```

---

### Task 6: Telegram Commands (45 min)

**Purpose:** Allow users to create/manage schedules via Telegram.

**Files:**
- Modify: `src/core/telegram/handlers.ts` (add schedule commands)

**Step 1: Add command handlers**

Add to `src/core/telegram/handlers.ts`:

```typescript
import { createSchedule, getAllSchedules, deleteSchedule, getScheduleById } from "../../features/cron/repository.js";
import { parseNaturalSchedule, looksLikeSchedule } from "../../features/cron/natural-parser.js";
import { db } from "../../db/index.js";

// In the command handlers setup:

bot.command("schedule", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  
  if (args.length === 0) {
    await ctx.reply(
      "📅 Schedule commands:\n\n" +
      "/schedule <when> \"<what>\"\n" +
      "Examples:\n" +
      '• /schedule every monday 9am "send tech briefing"\n' +
      '• /schedule daily at 8am "morning summary"\n\n' +
      "/schedules - List your schedules\n" +
      "/schedule delete <id> - Remove a schedule"
    );
    return;
  }
  
  // Check for delete subcommand
  if (args[0] === "delete") {
    const scheduleId = args[1];
    if (!scheduleId) {
      await ctx.reply("❌ Usage: /schedule delete <id>");
      return;
    }
    
    const deleted = await deleteSchedule(db, scheduleId);
    if (deleted) {
      await ctx.reply("✅ Schedule deleted");
    } else {
      await ctx.reply("❌ Schedule not found");
    }
    return;
  }
  
  // Parse schedule creation
  // Format: /schedule every monday 9am "send tech briefing"
  const text = args.join(" ");
  const match = text.match(/(.+?)\s+"(.+)"$/);
  
  if (!match) {
    await ctx.reply(
      "❌ Invalid format. Use:\n" +
      '/schedule <when> "<what>"\n\n' +
      'Example: /schedule every monday 9am "send tech briefing"'
    );
    return;
  }
  
  const [, when, what] = match;
  
  try {
    const parsed = await parseNaturalSchedule(when.trim());
    
    if (parsed.confidence === "low") {
      await ctx.reply(
        "❓ I didn't understand that schedule.\n\n" +
        "Try something like:\n" +
        '• "every Monday at 9am"\n' +
        '• "daily at 8:30am"\n' +
        '• "every weekday at 9am"'
      );
      return;
    }
    
    const schedule = await createSchedule(db, {
      description: what.slice(0, 50),
      naturalSchedule: when.trim(),
      parsedCron: parsed.cron,
      prompt: what,
      nextRunAt: new Date(), // Will be updated
    });
    
    const shortId = schedule.id.slice(0, 8);
    
    await ctx.reply(
      `✅ Schedule created!\n\n` +
      `ID: ${shortId}\n` +
      `When: ${parsed.description}\n` +
      `What: ${what}\n\n` +
      `Next run: Soon (scheduler will calculate)`
    );
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.reply(`❌ Failed to create schedule: ${message}`);
  }
});

bot.command("schedules", async (ctx) => {
  const schedules = await getAllSchedules(db);
  
  if (schedules.length === 0) {
    await ctx.reply("📅 No schedules yet.\n\nCreate one with:\n/schedule every monday 9am \"your task\"");
    return;
  }
  
  const lines = schedules.map(s => {
    const shortId = s.id.slice(0, 8);
    const status = s.enabled ? "🟢" : "⚫";
    return `${status} ${shortId}: ${s.description}\n   ${s.naturalSchedule}`;
  });
  
  await ctx.reply(
    `📅 Your schedules (${schedules.length}):\n\n` +
    lines.join("\n\n") +
    "\n\nDelete: /schedule delete <id>"
  );
});
```

**Step 2: Test via Telegram**

Send to your bot:
- `/schedule`
- `/schedule every day at 9am "send me a joke"`
- `/schedules`

---

### Task 7: Dashboard UI (60 min)

**Purpose:** Web interface for managing schedules.

**Files:**
- Create: `web/src/routes/schedules.tsx`
- Modify: `web/src/routes/__root.tsx` (add nav)

**Step 1: Create schedule page**

File: `web/src/routes/schedules.tsx`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Schedule {
  id: string;
  description: string;
  naturalSchedule: string;
  parsedCron: string;
  prompt: string;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
}

function SchedulesPage() {
  const queryClient = useQueryClient();
  const [newSchedule, setNewSchedule] = useState({
    description: "",
    naturalSchedule: "",
    prompt: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: async () => {
      const res = await api.schedules.$get();
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newSchedule) => {
      const res = await api.schedules.$post({ json: data });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setNewSchedule({ description: "", naturalSchedule: "", prompt: "" });
      toast.success("Schedule created");
    },
    onError: (error) => {
      toast.error("Failed to create: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.schedules[":id"].$delete({ param: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await api.schedules[":id"].toggle.$post({
        param: { id },
        json: { enabled },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
  });

  if (isLoading) return <div>Loading...</div>;

  const schedules: Schedule[] = data?.schedules || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Clock className="w-6 h-6" />
        Scheduled Tasks
      </h2>

      {/* New Schedule Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Morning briefing"
                value={newSchedule.description}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="when">When (natural language)</Label>
              <Input
                id="when"
                placeholder="every monday 9am"
                value={newSchedule.naturalSchedule}
                onChange={(e) =>
                  setNewSchedule({ ...newSchedule, naturalSchedule: e.target.value })
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">What to do</Label>
            <Input
              id="prompt"
              placeholder="Send me a tech news briefing"
              value={newSchedule.prompt}
              onChange={(e) =>
                setNewSchedule({ ...newSchedule, prompt: e.target.value })
              }
            />
          </div>
          <Button
            onClick={() => createMutation.mutate(newSchedule)}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? "Creating..." : "Create Schedule"}
          </Button>
        </CardContent>
      </Card>

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No schedules yet. Create one above.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{schedule.description}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          schedule.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {schedule.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {schedule.naturalSchedule} ({schedule.parsedCron})
                    </p>
                    <p className="text-sm">{schedule.prompt}</p>
                    <p className="text-xs text-muted-foreground">
                      Next run: {new Date(schedule.nextRunAt).toLocaleString()}
                      {schedule.lastRunAt &&
                        ` • Last run: ${new Date(schedule.lastRunAt).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: schedule.id, enabled: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(schedule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default SchedulesPage;
```

**Step 2: Add route**

File: `web/src/routeTree.gen.ts` (regenerate or add manually)

Or use TanStack Router file-based routing by creating:
File: `web/src/routes/schedules.tsx` (already done above)

Run:
```bash
cd web && bun run dev
```

**Step 3: Add navigation**

File: `web/src/components/nav.tsx` or modify sidebar:

```typescript
// Add to navigation items
{ 
  name: "Schedules", 
  href: "/schedules", 
  icon: Clock 
}
```

---

## SLICE 5 COMPLETE ✅

**Verification:**
- [ ] Schema pushed to database
- [ ] Repository tests pass
- [ ] Natural language parsing works
- [ ] Scheduler loop runs and creates jobs
- [ ] Dashboard shows schedules
- [ ] Telegram commands work

---

## SLICE 6: Session Auto-Compaction

(Following same Elephant Carpaccio pattern - tasks 8-13)

[Continued in next section...]

---

## Notes

- Each task is completable in 30-60 minutes
- Each task produces working, testable code
- Each slice is deployable independently
- Following the Clone Rule: copy the jobs/ pattern exactly
- Tests are required before moving to next task
