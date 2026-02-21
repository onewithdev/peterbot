# Autonomous Agent Integration - Peterbot Module Design

**Date:** 2026-02-21
**Status:** Draft
**Scope:** Integrate autonomous agent orchestrator as a peterbot feature module

---

## Overview

Integrate the autonomous agent orchestrator directly into peterbot as a feature module (`src/features/autonomous/`). Leverages existing infrastructure (job system, database, E2B, Telegram/Web interfaces) while adding multi-stage workflow capabilities with human-in-the-loop gates.

**Key Principle:** XState runs *inside* the job system, not alongside it. Jobs are the "wake up" mechanism; XState is the "what to do" logic.

---

## Architecture

### Module Structure

```
src/
├── features/
│   └── autonomous/
│       ├── schema.ts           # Drizzle tables: autonomous_runs, autonomous_events
│       ├── repository.ts       # DB operations (runs, events, clarifications)
│       ├── engine.ts           # XState workflow engine + job handler
│       ├── router.ts           # Model routing (planner/implementer/validator)
│       ├── git-storage.ts      # GitHub integration (will move to shared/)
│       ├── artifact-store.ts   # Mermaid parsing, constraint extraction
│       ├── types.ts            # Shared TypeScript types
│       └── index.ts            # Public API exports
│
├── shared/
│   └── git-storage.ts          # Extracted GitStorage service
│
├── core/
│   ├── dashboard/
│   │   ├── routes.ts           # Existing routes
│   │   └── autonomous-routes.ts # NEW: /api/autonomous/* endpoints
│   │
│   └── telegram/
│       ├── handlers.ts         # Existing handlers
│       └── autonomous-handlers.ts # NEW: /autonomous, /approve, /clarify
│
└── worker/
    ├── worker.ts               # Existing worker loop
    └── autonomous-processor.ts # NEW: processAutonomousRun handler
```

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Peterbot (Railway)                              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────────┐   │
│  │  Telegram    │  │  Web Dashboard│  │  VSCode Extension (future)       │   │
│  │  Bot         │  │  (existing)   │  │  (HTTP API)                      │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────────┘   │
│         │                 │                         │                       │
│         └─────────────────┼─────────────────────────┘                       │
│                           │ HTTP/WebSocket                                  │
│                           ▼                                                 │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      Express Server                                │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │  Existing Routes  │  /api/chat  │  /api/jobs  │  /api/files │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────────────────┐  │    │
│  │  │  New Routes: /api/autonomous/*                               │  │    │
│  │  │  POST   /runs              - Create autonomous run           │  │    │
│  │  │  GET    /runs/:id          - Get run status                  │  │    │
│  │  │  POST   /runs/:id/approve  - Approve stage                   │  │    │
│  │  │  POST   /runs/:id/reject   - Reject and retry                │  │    │
│  │  │  POST   /runs/:id/clarify  - Answer clarification            │  │    │
│  │  │  GET    /runs/:id/artifacts - List artifacts                 │  │    │
│  │  └──────────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Feature: Autonomous Module                      │    │
│  │                                                                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐    │    │
│  │  │  Repository │  │   Engine    │  │      GitStorage         │    │    │
│  │  │  (SQLite)   │  │  (XState)   │  │   (GitHub API)          │    │    │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘    │    │
│  │         │                │                      │                  │    │
│  │         │   Event Sourcing Persistence          │                  │    │
│  │         │                │                      │                  │    │
│  │         └────────────────┴──────────────────────┘                  │    │
│  │                          │                                         │    │
│  │                          ▼                                         │    │
│  │  ┌─────────────────────────────────────────────────────────────┐  │    │
│  │  │  GitHub Repository (external)                              │  │    │
│  │  │  .autonomous/                                              │  │    │
│  │  │  ├── specs/          ← Mermaid plans                       │  │    │
│  │  │  ├── runs/{id}/      ← Run context, clarifications        │  │    │
│  │  │  └── memory.md       ← Project memory                      │  │    │
│  │  └─────────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼ Polls for pending jobs
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Worker Process                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Existing Handlers:  task  │  quick                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  New Handler: processAutonomousRun                                  │    │
│  │                                                                     │    │
│  │  1. Load events from DB → Reconstruct XState                        │    │
│  │  2. Execute until:                                                  │    │
│  │     a) Completed → Mark job done                                    │    │
│  │     b) Failed → Mark job failed                                     │    │
│  │     c) Hit pause gate → Save state, EXIT (job ends)                 │    │
│  │  3. On exit: Job status = 'paused', run status = 'awaiting_*'       │    │
│  │  4. Human responds via API → New job queued → Resume from step 1    │    │
│  │                                                                     │    │
│  │  Stages:                                                            │    │
│  │  planning → approval_gate → implementing → validation → done        │    │
│  │              ↑                                          │           │    │
│  │              └──────── clarification_loop ──────────────┘           │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Agent Stages (Model Router)                                        │    │
│  │                                                                     │    │
│  │  Planner (DeepSeek) → Mermaid spec                                │    │
│  │       ↓                                                           │    │
│  │  Implementer (Claude) → Code in E2B sandbox                       │    │
│  │       ↓                                                           │    │
│  │  Validator (GPT-4o) → Check against constraints                   │    │
│  │       ↓                                                           │    │
│  │  GitStorage → Commit to branch                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Database Schema (Drizzle)

```typescript
// src/features/autonomous/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { jobs } from "../jobs/schema.js";

// Main autonomous run table - linked to jobs system
export const autonomousRuns = sqliteTable("autonomous_runs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").references(() => jobs.id).unique(),
  chatId: text("chat_id").notNull(),  // Links to Telegram/web chat
  
  // Git context
  repoUrl: text("repo_url").notNull(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  branchName: text("branch_name").notNull(),
  baseCommit: text("base_commit"),
  headCommit: text("head_commit"),
  
  // Configuration (JSON blob)
  config: text("config").notNull(),
  
  // User request
  originalRequest: text("original_request").notNull(),
  
  // XState state machine state
  status: text("status", {
    enum: [
      "pending",      // Created but not started
      "running",      // Actively processing
      "awaiting_approval",       // Paused for human approval
      "awaiting_clarification",  // Paused for clarification
      "completed",
      "failed",
      "cancelled"
    ]
  }).notNull().default("pending"),
  
  currentStage: text("current_stage", {
    enum: ["planning", "approval", "implementation", "validation"]
  }),
  
  // Counters
  clarificationCount: integer("clarification_count").notNull().default(0),
  retryCount: integer("retry_count").notNull().default(0),
  
  // Event sourcing
  lastEventSequence: integer("last_event_sequence").notNull().default(0),
  
  // Timestamps
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  pausedAt: integer("paused_at", { mode: "timestamp_ms" }),
  resumedAt: integer("resumed_at", { mode: "timestamp_ms" }),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
});

// Event sourcing table - complete history for replay
export const autonomousEvents = sqliteTable("autonomous_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => autonomousRuns.id, { onDelete: "cascade" }),
  
  // Event type
  type: text("type").notNull(),
  // Event payload (JSON)
  payload: text("payload").notNull(),
  
  // Ordering
  sequence: integer("sequence").notNull(),
  
  // Timestamp
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Clarification requests - separate table for easy querying
export const clarificationRequests = sqliteTable("clarification_requests", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  runId: text("run_id")
    .notNull()
    .references(() => autonomousRuns.id, { onDelete: "cascade" }),
  
  stage: text("stage").notNull(),
  question: text("question").notNull(),
  context: text("context").notNull(),
  options: text("options"), // JSON array for multiple choice
  responseType: text("response_type", {
    enum: ["text", "single_choice", "multiple_choice", "file_upload"]
  }).notNull(),
  
  // State
  status: text("status", {
    enum: ["pending", "answered", "ignored"]
  }).notNull().default("pending"),
  response: text("response"),
  answeredAt: integer("answered_at", { mode: "timestamp_ms" }),
  
  // Metadata
  attemptNumber: integer("attempt_number").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Relations
export const autonomousRunsRelations = relations(autonomousRuns, ({ one, many }) => ({
  job: one(jobs, {
    fields: [autonomousRuns.jobId],
    references: [jobs.id],
  }),
  events: many(autonomousEvents),
  clarifications: many(clarificationRequests),
}));

export type AutonomousRun = typeof autonomousRuns.$inferSelect;
export type NewAutonomousRun = typeof autonomousRuns.$inferInsert;
export type AutonomousEvent = typeof autonomousEvents.$inferSelect;
export type ClarificationRequest = typeof clarificationRequests.$inferSelect;
```

### Event Types (Event Sourcing)

```typescript
// src/features/autonomous/types.ts

type AutonomousEventType =
  // Lifecycle
  | "RUN_STARTED"
  | "RUN_RESUMED"
  | "RUN_COMPLETED"
  | "RUN_FAILED"
  | "RUN_CANCELLED"
  
  // Stage transitions
  | "STAGE_STARTED"      // { stage: "planning" | "implementation" | "validation" }
  | "STAGE_COMPLETED"    // { stage, result }
  | "STAGE_FAILED"       // { stage, error }
  
  // Human-in-the-loop
  | "APPROVAL_REQUESTED" // { stage, artifactId }
  | "APPROVAL_GRANTED"   // { approvedBy, notes }
  | "APPROVAL_REJECTED"  // { rejectedBy, feedback }
  | "CLARIFICATION_REQUESTED" // { questionId, question, context }
  | "CLARIFICATION_ANSWERED"  // { questionId, response }
  | "CLARIFICATION_IGNORED"   // { questionId }
  
  // Artifacts
  | "ARTIFACT_CREATED"   // { type: "spec" | "code", gitPath, commitSha }
  | "ARTIFACT_APPROVED"  // { artifactId, approvedBy }
  
  // State transitions (XState internal)
  | "STATE_TRANSITION"   // { from: string, to: string, context }
  
  // Git operations
  | "BRANCH_CREATED"
  | "CODE_COMMITTED"     // { commitSha, files }
  | "PR_CREATED"
  | "BRANCH_MERGED";
```

---

## Components

### 1. AutonomousEngine (XState + Job Handler)

**File:** `src/features/autonomous/engine.ts`

```typescript
import { createMachine, interpret, type StateMachine } from 'xstate';
import { db } from '../../db/index.js';
import * as repository from './repository.js';
import { GitStorage } from '../../shared/git-storage.js';
import { ModelRouter } from './router.js';
import type { AutonomousRun, RunConfig } from './types.js';

// XState machine definition
const createAutonomousMachine = (run: AutonomousRun) => createMachine({
  id: 'autonomousRun',
  initial: run.status === 'pending' ? 'planning' : run.currentStage || 'planning',
  context: {
    runId: run.id,
    config: JSON.parse(run.config) as RunConfig,
    originalRequest: run.originalRequest,
    clarificationCount: 0,
    artifacts: [],
  },
  states: {
    planning: {
      entry: ['logStageStart'],
      invoke: {
        src: 'executePlanner',
        onDone: {
          target: 'planApproval',
          actions: ['savePlanArtifact', 'emitEvent']
        },
        onError: { target: 'failed' }
      }
    },
    
    planApproval: {
      entry: ['checkTrustMode'],
      on: {
        '': [
          { target: 'implementation', cond: 'isAutoApproved' },
          { target: 'awaitingApproval', actions: ['pauseForApproval'] }
        ]
      }
    },
    
    awaitingApproval: {
      on: {
        APPROVE: 'implementation',
        REJECT: 'planning',
        CLARIFY: 'awaitingClarification'
      }
    },
    
    awaitingClarification: {
      on: {
        CLARIFICATION_ANSWERED: [
          { target: 'planning', cond: 'isPlanClarification' },
          { target: 'implementation', cond: 'isImplClarification' }
        ]
      }
    },
    
    implementation: {
      entry: ['logStageStart'],
      invoke: {
        src: 'executeImplementer',
        onDone: {
          target: 'validation',
          actions: ['commitCode', 'emitEvent']
        },
        onError: [
          { target: 'awaitingClarification', cond: 'canRequestClarification' },
          { target: 'failed' }
        ]
      }
    },
    
    validation: {
      entry: ['logStageStart'],
      invoke: {
        src: 'executeValidator',
        onDone: [
          { target: 'completed', cond: 'validationPassed' },
          { target: 'implementation', cond: 'shouldAutoRetry' },
          { target: 'awaitingApproval', cond: 'needsHumanDecision' }
        ],
        onError: { target: 'failed' }
      }
    },
    
    completed: {
      type: 'final',
      entry: ['finalizeRun', 'notifyUser']
    },
    
    failed: {
      type: 'final',
      entry: ['failRun', 'notifyUser']
    }
  }
}, {
  // Service implementations
  services: {
    executePlanner: async (context) => {
      const router = new ModelRouter(context.config.modelRouting);
      const plan = await router.executePlanner({
        request: context.originalRequest,
        memory: await loadProjectMemory(context.runId),
      });
      return plan;
    },
    
    executeImplementer: async (context) => {
      const router = new ModelRouter(context.config.modelRouting);
      const code = await router.executeImplementer({
        request: context.originalRequest,
        plan: context.artifacts.find(a => a.type === 'plan'),
      });
      return code;
    },
    
    executeValidator: async (context) => {
      const router = new ModelRouter(context.config.modelRouting);
      const result = await router.executeValidator({
        code: context.artifacts.find(a => a.type === 'code'),
        plan: context.artifacts.find(a => a.type === 'plan'),
      });
      return result;
    }
  },
  
  // Actions
  actions: {
    logStageStart: (context, event, { state }) => {
      repository.appendEvent(db, context.runId, {
        type: 'STAGE_STARTED',
        payload: { stage: state.value }
      });
    },
    
    pauseForApproval: (context) => {
      repository.updateRunStatus(db, context.runId, 'awaiting_approval');
      // Job will exit here
    },
    
    savePlanArtifact: (context, event) => {
      // Commit to Git
      const git = new GitStorage();
      git.commitSpec(context.runId, event.data.mermaid);
    },
    
    commitCode: async (context, event) => {
      const git = new GitStorage();
      await git.commitCodeFromE2B(context.runId, event.data.files);
    },
    
    finalizeRun: (context) => {
      repository.updateRunStatus(db, context.runId, 'completed');
      // Also update linked job
    }
  },
  
  // Guards
  guards: {
    isAutoApproved: (context) => context.config.trustMode.planning === 'auto',
    canRequestClarification: (context) => 
      context.clarificationCount < context.config.maxClarifications,
    validationPassed: (context, event) => event.data.passed,
  }
});

// Main job handler - called by worker
export async function processAutonomousRun(runId: string): Promise<void> {
  const run = await repository.getAutonomousRun(db, runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  
  // Load all events for replay
  const events = await repository.getEvents(db, runId);
  
  // Create and configure machine
  const machine = createAutonomousMachine(run);
  const service = interpret(machine);
  
  // Persist every transition
  service.onTransition((state) => {
    repository.appendEvent(db, runId, {
      type: 'STATE_TRANSITION',
      payload: {
        state: state.value,
        context: state.context
      }
    });
    
    // Check for pause points
    if (state.matches('awaitingApproval') || state.matches('awaitingClarification')) {
      service.stop();
      // Exit - job ends, will be re-queued on human response
      return;
    }
  });
  
  // Replay existing events to restore state (if resuming)
  if (events.length > 0) {
    const lastState = replayEvents(machine, events);
    service.start(lastState);
  } else {
    service.start();
  }
  
  // Wait for completion or pause
  return new Promise((resolve) => {
    service.onDone(() => {
      service.stop();
      resolve();
    });
  });
}

// Replay events to reconstruct state
function replayEvents(machine: StateMachine<any, any>, events: AutonomousEvent[]) {
  let state = machine.initialState;
  
  for (const event of events) {
    if (event.type === 'STATE_TRANSITION') {
      // Continue from persisted state
      state = machine.resolveState({
        value: event.payload.state,
        context: event.payload.context,
        history: undefined,
      });
    }
  }
  
  return state;
}
```

### 2. Repository Layer

**File:** `src/features/autonomous/repository.ts`

```typescript
import { eq, desc, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { autonomousRuns, autonomousEvents, clarificationRequests } from "./schema.js";
import type { AutonomousEvent } from "./types.js";

// Run operations
export async function createAutonomousRun(
  db: BunSQLiteDatabase,
  data: NewAutonomousRun
): Promise<AutonomousRun> {
  const [run] = await db.insert(autonomousRuns).values(data).returning();
  return run;
}

export async function getAutonomousRun(
  db: BunSQLiteDatabase,
  id: string
): Promise<AutonomousRun | undefined> {
  const [run] = await db
    .select()
    .from(autonomousRuns)
    .where(eq(autonomousRuns.id, id));
  return run;
}

export async function updateRunStatus(
  db: BunSQLiteDatabase,
  id: string,
  status: AutonomousRun['status'],
  updates?: Partial<AutonomousRun>
): Promise<void> {
  await db
    .update(autonomousRuns)
    .set({
      status,
      ...updates,
      pausedAt: status === 'awaiting_approval' || status === 'awaiting_clarification' 
        ? new Date() 
        : undefined,
      resumedAt: status === 'running' ? new Date() : undefined,
      completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
    })
    .where(eq(autonomousRuns.id, id));
}

// Event sourcing
export async function appendEvent(
  db: BunSQLiteDatabase,
  runId: string,
  event: Omit<AutonomousEvent, 'id' | 'runId' | 'sequence' | 'createdAt'>
): Promise<void> {
  // Get next sequence number
  const [lastEvent] = await db
    .select({ sequence: autonomousEvents.sequence })
    .from(autonomousEvents)
    .where(eq(autonomousEvents.runId, runId))
    .orderBy(desc(autonomousEvents.sequence))
    .limit(1);
  
  const sequence = (lastEvent?.sequence ?? -1) + 1;
  
  await db.insert(autonomousEvents).values({
    runId,
    type: event.type,
    payload: JSON.stringify(event.payload),
    sequence,
  });
  
  // Update run's last sequence
  await db
    .update(autonomousRuns)
    .set({ lastEventSequence: sequence })
    .where(eq(autonomousRuns.id, runId));
}

export async function getEvents(
  db: BunSQLiteDatabase,
  runId: string
): Promise<AutonomousEvent[]> {
  return db
    .select()
    .from(autonomousEvents)
    .where(eq(autonomousEvents.runId, runId))
    .orderBy(autonomousEvents.sequence);
}

// Clarifications
export async function createClarificationRequest(
  db: BunSQLiteDatabase,
  data: Omit<ClarificationRequest, 'id' | 'createdAt'>
): Promise<ClarificationRequest> {
  const [request] = await db
    .insert(clarificationRequests)
    .values(data)
    .returning();
  return request;
}

export async function answerClarification(
  db: BunSQLiteDatabase,
  id: string,
  response: string
): Promise<void> {
  await db
    .update(clarificationRequests)
    .set({
      status: 'answered',
      response,
      answeredAt: new Date(),
    })
    .where(eq(clarificationRequests.id, id));
}

export async function getPendingClarifications(
  db: BunSQLiteDatabase,
  runId: string
): Promise<ClarificationRequest[]> {
  return db
    .select()
    .from(clarificationRequests)
    .where(
      and(
        eq(clarificationRequests.runId, runId),
        eq(clarificationRequests.status, 'pending')
      )
    );
}
```

### 3. API Routes

**File:** `src/core/dashboard/autonomous-routes.ts`

```typescript
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/index.js";
import * as repository from "../../features/autonomous/repository.js";
import { processAutonomousRun } from "../../features/autonomous/engine.js";
import { createJob } from "../../features/jobs/repository.js";

export const autonomousRoutes = Router();

// Create a new autonomous run
autonomousRoutes.post("/runs", async (req, res) => {
  const schema = z.object({
    chatId: z.string(),
    request: z.string(),
    repoUrl: z.string().url(),
    config: z.object({
      trustMode: z.object({
        planning: z.enum(["auto", "manual"]),
        implementation: z.enum(["auto", "manual"]),
        fixes: z.enum(["auto", "manual"]),
      }),
      maxClarifications: z.number().default(3),
      modelRouting: z.object({
        planner: z.string(),
        implementer: z.string(),
        validator: z.string(),
      }),
    }),
  });
  
  const data = schema.parse(req.body);
  
  // Parse repo URL
  const urlMatch = data.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!urlMatch) {
    return res.status(400).json({ error: "Invalid GitHub URL" });
  }
  
  // Create the run
  const run = await repository.createAutonomousRun(db, {
    chatId: data.chatId,
    repoUrl: data.repoUrl,
    repoOwner: urlMatch[1],
    repoName: urlMatch[2].replace(/\.git$/, ""),
    branchName: `autonomous/${crypto.randomUUID().slice(0, 8)}`,
    originalRequest: data.request,
    config: JSON.stringify(data.config),
  });
  
  // Create linked job
  const job = await createJob(db, {
    type: "autonomous_run",
    input: JSON.stringify({ runId: run.id }),
    chatId: data.chatId,
    status: "pending",
  });
  
  // Link job to run
  await db
    .update(autonomousRuns)
    .set({ jobId: job.id })
    .where(eq(autonomousRuns.id, run.id));
  
  res.status(201).json({
    runId: run.id,
    jobId: job.id,
    branchName: run.branchName,
    status: run.status,
  });
});

// Get run status
autonomousRoutes.get("/runs/:id", async (req, res) => {
  const run = await repository.getAutonomousRun(db, req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  
  const events = await repository.getEvents(db, run.id);
  const clarifications = await repository.getPendingClarifications(db, run.id);
  
  res.json({
    ...run,
    events: events.slice(-10), // Last 10 events
    pendingClarifications: clarifications,
  });
});

// Approve a stage
autonomousRoutes.post("/runs/:id/approve", async (req, res) => {
  const schema = z.object({
    notes: z.string().optional(),
  });
  const { notes } = schema.parse(req.body);
  
  const run = await repository.getAutonomousRun(db, req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  if (run.status !== "awaiting_approval") {
    return res.status(400).json({ error: "Run not awaiting approval" });
  }
  
  // Record approval event
  await repository.appendEvent(db, run.id, {
    type: "APPROVAL_GRANTED",
    payload: { notes, approvedAt: new Date().toISOString() },
  });
  
  // Update status and queue for resume
  await repository.updateRunStatus(db, run.id, "running", {
    resumedAt: new Date(),
  });
  
  // Create new job to resume
  await createJob(db, {
    type: "autonomous_run",
    input: JSON.stringify({ runId: run.id, resume: true }),
    chatId: run.chatId,
    status: "pending",
  });
  
  res.json({ status: "resumed" });
});

// Reject and retry
autonomousRoutes.post("/runs/:id/reject", async (req, res) => {
  const schema = z.object({
    feedback: z.string(),
  });
  const { feedback } = schema.parse(req.body);
  
  const run = await repository.getAutonomousRun(db, req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  
  await repository.appendEvent(db, run.id, {
    type: "APPROVAL_REJECTED",
    payload: { feedback },
  });
  
  // Go back to planning
  await repository.updateRunStatus(db, run.id, "running");
  
  await createJob(db, {
    type: "autonomous_run",
    input: JSON.stringify({ runId: run.id, resume: true }),
    chatId: run.chatId,
    status: "pending",
  });
  
  res.json({ status: "retrying" });
});

// Answer clarification
autonomousRoutes.post("/runs/:id/clarify", async (req, res) => {
  const schema = z.object({
    questionId: z.string(),
    answer: z.string(),
  });
  const { questionId, answer } = schema.parse(req.body);
  
  await repository.answerClarification(db, questionId, answer);
  
  const run = await repository.getAutonomousRun(db, req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  
  await repository.appendEvent(db, run.id, {
    type: "CLARIFICATION_ANSWERED",
    payload: { questionId, answer },
  });
  
  await repository.updateRunStatus(db, run.id, "running");
  
  await createJob(db, {
    type: "autonomous_run",
    input: JSON.stringify({ runId: run.id, resume: true }),
    chatId: run.chatId,
    status: "pending",
  });
  
  res.json({ status: "resumed" });
});
```

### 4. Telegram Handlers

**File:** `src/core/telegram/autonomous-handlers.ts`

```typescript
import { Composer } from "telegraf";
import { db } from "../../db/index.js";
import * as repository from "../../features/autonomous/repository.js";
import { createJob } from "../../features/jobs/repository.js";
import { getConfig } from "../../shared/config.js";

const composer = new Composer();

// Start autonomous run
composer.command("autonomous", async (ctx) => {
  const request = ctx.message.text.slice(11).trim(); // Remove "/autonomous "
  
  if (!request) {
    return ctx.reply("Usage: /autonomous <your request>\nExample: /autonomous Create a login page with OAuth");
  }
  
  const chatId = String(ctx.chat.id);
  
  // Get default config from project settings
  const defaultConfig = {
    trustMode: { planning: "manual", implementation: "auto", fixes: "auto" },
    maxClarifications: 3,
    modelRouting: {
      planner: "deepseek-reasoner",
      implementer: "claude-3-5-sonnet-20241022",
      validator: "gpt-4o-mini",
    },
  };
  
  // Get repo URL from config (or ask user)
  const repoConfig = await getConfig(db, `repo.${chatId}`);
  if (!repoConfig) {
    return ctx.reply(
      "No repository configured. Use /setrepo <github-url> first."
    );
  }
  
  // Create run (reuses same logic as API)
  // ...
  
  await ctx.reply(
    `🚀 Started autonomous run\n` +
    `Request: ${request}\n` +
    `Branch: ${run.branchName}\n` +
    `I'll notify you when I need approval or have questions.`
  );
});

// List pending approvals
composer.command("approvals", async (ctx) => {
  const chatId = String(ctx.chat.id);
  
  const pending = await db
    .select()
    .from(autonomousRuns)
    .where(
      and(
        eq(autonomousRuns.chatId, chatId),
        eq(autonomousRuns.status, "awaiting_approval")
      )
    );
  
  if (pending.length === 0) {
    return ctx.reply("No pending approvals.");
  }
  
  const buttons = pending.map(run => ({
    text: `Review: ${run.originalRequest.slice(0, 30)}...`,
    callback_data: `review:${run.id}`,
  }));
  
  await ctx.reply(
    `⏳ ${pending.length} pending approval(s):`,
    {
      reply_markup: {
        inline_keyboard: buttons.map(b => [b]),
      },
    }
  );
});

// Handle review callback
composer.action(/review:(.+)/, async (ctx) => {
  const runId = ctx.match[1];
  const run = await repository.getAutonomousRun(db, runId);
  
  if (!run) return ctx.answerCbQuery("Run not found");
  
  await ctx.reply(
    `📋 Autonomous Run Review\n\n` +
    `Request: ${run.originalRequest}\n` +
    `Stage: ${run.currentStage}\n` +
    `Branch: ${run.branchName}\n\n` +
    `View the plan at: https://github.com/${run.repoOwner}/${run.repoName}/blob/${run.branchName}/.autonomous/specs/\n\n` +
    `Approve with /approve ${run.id.slice(0, 8)}\n` +
    `Reject with /reject ${run.id.slice(0, 8)} <feedback>`,
  );
  
  await ctx.answerCbQuery();
});

// Approve command
composer.command("approve", async (ctx) => {
  const args = ctx.message.text.split(" ");
  const shortId = args[1];
  
  // Find run by short ID prefix
  const [run] = await db
    .select()
    .from(autonomousRuns)
    .where(
      and(
        eq(autonomousRuns.chatId, String(ctx.chat.id)),
        like(autonomousRuns.id, `${shortId}%`)
      )
    )
    .limit(1);
  
  if (!run) return ctx.reply("Run not found.");
  
  // Reuse API logic
  await repository.appendEvent(db, run.id, {
    type: "APPROVAL_GRANTED",
    payload: { approvedAt: new Date().toISOString() },
  });
  
  await repository.updateRunStatus(db, run.id, "running");
  
  await createJob(db, {
    type: "autonomous_run",
    input: JSON.stringify({ runId: run.id, resume: true }),
    chatId: run.chatId,
    status: "pending",
  });
  
  await ctx.reply("✅ Approved! Continuing...");
});

// Quick status check
composer.command("autostatus", async (ctx) => {
  const chatId = String(ctx.chat.id);
  
  const runs = await db
    .select()
    .from(autonomousRuns)
    .where(eq(autonomousRuns.chatId, chatId))
    .orderBy(desc(autonomousRuns.createdAt))
    .limit(5);
  
  const statusLines = runs.map(run => {
    const emoji = {
      completed: "✅",
      failed: "❌",
      running: "🔄",
      awaiting_approval: "⏳",
      awaiting_clarification: "❓",
    }[run.status] || "⏸️";
    
    return `${emoji} ${run.originalRequest.slice(0, 40)}... (${run.status})`;
  });
  
  await ctx.reply("Recent autonomous runs:\n\n" + statusLines.join("\n"));
});

export default composer;
```

### 5. Worker Integration

**File:** `src/worker/autonomous-processor.ts`

```typescript
import { db } from "../db/index.js";
import * as repository from "../features/autonomous/repository.js";
import { processAutonomousRun } from "../features/autonomous/engine.js";
import { updateJobStatus } from "../features/jobs/repository.js";
import type { Job } from "../features/jobs/schema.js";

export async function handleAutonomousJob(job: Job): Promise<void> {
  const input = JSON.parse(job.input);
  const { runId } = input;
  
  console.log(`[Autonomous] Processing run ${runId}`);
  
  try {
    // Update run status to running
    await repository.updateRunStatus(db, runId, "running", {
      startedAt: input.resume ? undefined : new Date(),
    });
    
    // Run the workflow (blocks until done or paused)
    await processAutonomousRun(runId);
    
    // Check final status
    const run = await repository.getAutonomousRun(db, runId);
    
    if (run?.status === "awaiting_approval" || run?.status === "awaiting_clarification") {
      // Paused for human - job ends here, don't mark complete
      console.log(`[Autonomous] Run ${runId} paused for human`);
      await updateJobStatus(db, job.id, "paused");
    } else if (run?.status === "completed") {
      console.log(`[Autonomous] Run ${runId} completed`);
      await updateJobStatus(db, job.id, "completed");
    } else if (run?.status === "failed") {
      console.log(`[Autonomous] Run ${runId} failed`);
      await updateJobStatus(db, job.id, "failed");
    }
  } catch (error) {
    console.error(`[Autonomous] Error processing run ${runId}:`, error);
    await repository.updateRunStatus(db, runId, "failed");
    await updateJobStatus(db, job.id, "failed");
    throw error;
  }
}
```

**Integration with existing worker:**

```typescript
// src/worker/worker.ts
import { handleAutonomousJob } from "./autonomous-processor.js";

const handlers: Record<string, (job: Job) => Promise<void>> = {
  task: processTaskJob,
  quick: processQuickJob,
  autonomous_run: handleAutonomousJob, // ← New
};

async function processJob(job: Job) {
  const handler = handlers[job.type];
  if (!handler) {
    throw new Error(`Unknown job type: ${job.type}`);
  }
  
  await handler(job);
}
```

---

## Migration Strategy

### Phase 1: Schema Migration

```sql
-- Run during deployment
CREATE TABLE autonomous_runs (...);
CREATE TABLE autonomous_events (...);
CREATE TABLE clarification_requests (...);

-- Add 'autonomous_run' to job types if using enum
-- Or just insert with type 'autonomous_run'
```

### Phase 2: Deploy Feature

1. Deploy new code with feature flag `ENABLE_AUTONOMOUS=false`
2. Enable in staging, test end-to-end
3. Enable in production: `ENABLE_AUTONOMOUS=true`

### Phase 3: Add to Interfaces

1. Telegram commands: `/autonomous`, `/approve`, `/approvals`
2. Web dashboard: Autonomous runs page
3. VSCode extension: Future work

---

## Success Criteria

- [ ] Autonomous runs created via API/Telegram
- [ ] XState workflow executes through all stages
- [ ] Pause at approval gates, resume via API
- [ ] Clarification loop works (ask → answer → continue)
- [ ] Code commits to GitHub branch on completion
- [ ] Artifacts stored in `.autonomous/`
- [ ] Event sourcing replay works (can resume after restart)
- [ ] Multiple concurrent runs supported
- [ ] Chat history accessible as context
- [ ] Run status visible in Telegram/Web
- [ ] All tests pass

---

## Open Questions

1. **Git credentials**: Use user's GitHub token or shared bot token?
2. **Chat context**: How much history to load into planner context?
3. **E2B sandbox sharing**: New sandbox per run or reuse?
4. **Rate limiting**: Per-user concurrent run limits?
5. **Notifications**: Real-time WebSocket or polling for web dashboard?
