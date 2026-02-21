# Autonomous Agent Orchestrator Design

**Date:** 2026-02-21
**Status:** Draft
**Purpose:** Multi-stage agent workflows with human-in-the-loop approval gates and clarification loops

---

## Overview

Build an autonomous agent orchestration system that runs multi-stage workflows (Planning → Implementation → Validation) with configurable human-in-the-loop gates. Workflows can pause for hours or days awaiting human clarification or approval, then resume exactly where they left off.

**Core Concept:** Trust-based autonomy tiers. Users configure which stages require approval and how many clarifications the AI can request before escalating to human review.

---

## Goals

1. **Multi-stage agent workflows** - Planner → Implementer → Validator with handoffs
2. **Human-in-the-loop gates** - Configurable approval points and clarification loops
3. **Durable execution** - Workflows survive restarts, can pause for days
4. **Parallel runs** - Multiple autonomous workflows executing concurrently
5. **Artifact-based validation** - Mermaid diagrams as structured specs, validated against output
6. **Trust modes** - Per-run toggles for auto/manual approval at each stage
7. **Model flexibility** - Route different stages to different models (cheap for planning, capable for coding)

## Non-Goals

- Real-time collaborative editing (multiple humans on same workflow)
- Automatic code deployment (build artifacts only, deployment is manual)
- Self-improving agents (no agent-modifies-own-prompts)
- Mobile app (VSCode extension + web dashboard only)

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VSCode Extension                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  Run List    │  │   Artifact   │  │   Clarification/Approval     │  │
│  │  Dashboard   │  │   Viewer     │  │   Panel                      │  │
│  │              │  │  (Mermaid)   │  │                              │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┬───────────────┘  │
└─────────┼─────────────────┼────────────────────────┼──────────────────┘
          │                 │                        │
          └─────────────────┼────────────────────────┘
                            │ HTTP/WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Orchestrator Service (Railway)                     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    XState Workflow Engine                        │   │
│  │  ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐          │   │
│  │  │PLANNING│───→│APPROVAL│───→│IMPLEMENT│───→│VALIDATE│          │   │
│  │  └───┬────┘    │ GATE   │    └────┬────┘    └───┬────┘          │   │
│  │      │         └───┬────┘         │             │               │   │
│  │      │             │              │             │               │   │
│  │      └─────────────┴──────────────┴─────────────┘               │   │
│  │                   │                                             │   │
│  │                   ▼                                             │   │
│  │         ┌──────────────────┐                                   │   │
│  │         │ CLARIFICATION    │◄─────────────────────────────┐    │   │
│  │         │ (pause/resume)   │                              │    │   │
│  │         └──────────────────┘                              │    │   │
│  │                                                           │    │   │
│  └───────────────────────────────────────────────────────────┼────┘   │
│                                                              │         │
│  ┌───────────────────────────────────────────────────────────┼────┐    │
│  │              SQLite Persistence Layer                      │    │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │    │    │
│  │  │  Workflows   │  │  Clarifications│  │   Events     │─────┘    │    │
│  │  │    Table     │  │    Table       │  │   (Event     │          │    │
│  │  │              │  │                │  │   Sourcing)  │          │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Agent Workers                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │   │
│  │  │   Planner   │  │ Implementer │  │  Validator  │              │   │
│  │  │  (DeepSeek) │  │  (Claude)   │  │  (GPT-4o)   │              │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────┐                                  │
│                    │   E2B Sandbox   │  (Temporary compute only)        │
│                    │   (Code exec)   │                                  │
│                    └────────┬────────┘                                  │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                               │
│                                                                         │
│  ┌─────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │  src/       │  │  .autonomous/                                    │  │
│  │  (generated │  │  ├─ specs/        ← Mermaid plans               │  │
│  │   code)     │  │  ├─ runs/{id}/   ← Run context, clarifications  │  │
│  └─────────────┘  │  └─ memory.md     ← Project context              │  │
│                   └─────────────────────────────────────────────────┘  │
│                                                                         │
│  Branches: main, autonomous/{run-id}-1, autonomous/{run-id}-2, ...     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Layers

| Layer | Components | Responsibility |
|-------|------------|----------------|
| **Interface** | VSCode Extension, Web Dashboard, Telegram | Trigger runs, view artifacts, respond to clarifications |
| **Orchestrator** | XState Machine, Event Store | Workflow state management, durable execution |
| **Persistence** | SQLite (Railway) | Active workflow state, clarifications, events |
| **Storage** | GitHub Repository | Code, artifacts, specs, project memory (source of truth) |
| **Compute** | E2B Sandbox | Temporary code execution environment |
| **Agents** | Planner, Implementer, Validator | Execute stages with model-specific routing |
| **Integration** | Model Router, File System | Call appropriate models, read/write code |

---

## Storage Strategy: Git-First

All persistent data lives in **GitHub repositories**. The orchestrator's SQLite database only tracks **active workflow state** for durability and event sourcing. If the database is lost, all history can be reconstructed from Git.

### Why Git-First?

1. **Source of truth** - Git commits are immutable and auditable
2. **Full history** - Check out any commit to see code + artifacts together
3. **Branch per feature** - Each autonomous run creates a branch, enabling PR review workflows
4. **Team collaboration** - Standard Git workflows for sharing and reviewing
5. **Offline capable** - Clone repo, see full project context without orchestrator

### Repository Structure

```
github.com/user/my-project/
├── src/                          # Generated code (committed by orchestrator)
├── .autonomous/                  # Autonomous run metadata
│   ├── specs/                    # Mermaid plans from planning stage
│   │   ├── 001-login-flow.md
│   │   ├── 002-oauth-integration.md
│   │   └── 003-dashboard-v2.md
│   ├── runs/                     # Per-run context and artifacts
│   │   ├── run-abc123/
│   │   │   ├── context.json      # Full run config, clarifications, decisions
│   │   │   ├── validation-report.md
│   │   │   └── events.jsonl      # Event sourcing log (optional)
│   │   └── run-def456/
│   └── memory.md                 # Project-level accumulated context
├── README.md
└── package.json
```

### `.autonomous/memory.md` Format

Project-level memory that persists across runs:

```markdown
---
project: E-commerce Dashboard
createdAt: 2026-02-21
lastUpdated: 2026-02-25
techStack:
  - Next.js 14
  - Prisma
  - PostgreSQL
  - Stripe
  - Supabase Auth
patterns:
  - Use React Server Components for data fetching
  - All forms use react-hook-form + zod
  - Stripe webhooks handled in /api/webhooks/stripe
  - Soft deletes on all tables (deletedAt column)
---

## Past Decisions

### 2026-02-21: Auth System (run: abc123-def456)
- Chose Supabase Auth over Clerk (cost consideration)
- Implemented email+password (not magic links per clarification)

### 2026-02-25: Database Schema (run: xyz789-abc012)
- Added deletedAt to all tables for soft deletes
- Used Prisma for type-safe queries
```

### `.autonomous/runs/{id}/context.json` Format

Complete record of a single autonomous run:

```json
{
  "runId": "abc123-def456",
  "originalRequest": "Create login flow with OAuth",
  "createdAt": "2026-02-21T10:00:00Z",
  "completedAt": "2026-02-21T10:45:00Z",
  "config": {
    "trustMode": {
      "planning": "manual",
      "implementation": "auto",
      "fixes": "auto"
    },
    "maxClarifications": 3,
    "modelRouting": {
      "planner": "deepseek-reasoner",
      "implementer": "claude-3-5-sonnet-20241022",
      "validator": "gpt-4o-mini"
    }
  },
  "clarifications": [
    {
      "question": "Which OAuth provider?",
      "context": "The spec mentions OAuth but doesn't specify provider",
      "response": "Use Supabase Auth with Google and GitHub",
      "answeredAt": "2026-02-21T10:15:00Z"
    }
  ],
  "artifacts": [
    {
      "type": "mermaid_diagram",
      "path": ".autonomous/specs/001-login-flow.md",
      "approvedAt": "2026-02-21T10:20:00Z"
    },
    {
      "type": "code",
      "commitSha": "a1b2c3d",
      "filesChanged": ["src/app/login/page.tsx", "src/lib/auth.ts"]
    }
  ],
  "decisions": [
    {
      "topic": "Auth provider",
      "choice": "Supabase Auth",
      "rationale": "Cost vs Clerk, team familiarity"
    }
  ]
}
```

### Branch Strategy

Each autonomous run creates a dedicated branch:

```
main
├── autonomous/abc123-login-flow
├── autonomous/def456-oauth-integration
├── autonomous/ghi789-dashboard-v2
└── autonomous/jkl012-fix-nav-bug
```

**On completion:**
- **Trust mode auto-merge**: Fast-forward merge to main if all gates auto-approved
- **Manual review**: Leave as open PR for human review
- **Failed/cancelled**: Keep branch for inspection, clean up after 30 days

### E2B Role

E2B sandboxes are **temporary compute only**:

1. **Implementation stage**: Code written to E2B sandbox
2. **Validation stage**: Tests run in E2B sandbox
3. **Completion**: Code committed to Git, E2B sandbox destroyed
4. **Recovery**: If E2B is lost, code is in Git, context is in `.autonomous/`

---

## Data Model

### Workflow Run

```typescript
interface WorkflowRun {
  id: string;                    // UUID
  projectId: string;             // Associated project/context
  userId: string;                // Who triggered it
  
  // Configuration
  config: {
    trustMode: {
      planning: 'auto' | 'manual';
      implementation: 'auto' | 'manual';
      fixes: 'auto' | 'manual';
    };
    maxClarifications: number;
    maxConcurrency: number;      // For this specific run
    modelRouting: {
      planner: string;           // 'deepseek-reasoner', 'claude-3-opus'
      implementer: string;
      validator: string;
    };
  };
  
  // State
  status: 'running' | 'awaiting_approval' | 'awaiting_clarification' | 
          'completed' | 'failed' | 'cancelled';
  currentStage: 'planning' | 'implementation' | 'validation' | null;
  
  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  pausedAt?: Date;               // When waiting for human
  resumedAt?: Date;
  completedAt?: Date;
  
  // Context
  originalRequest: string;       // User's initial prompt
  clarificationCount: number;
  
  // Relations
  artifacts: Artifact[];
  events: WorkflowEvent[];
}
```

### Artifact (Stored in Git)

```typescript
interface Artifact {
  id: string;
  workflowRunId: string;
  stage: 'planning' | 'implementation' | 'validation';
  type: 'mermaid_diagram' | 'spec' | 'code' | 'validation_report';
  
  // Git storage
  gitPath: string;               // Path in .autonomous/ directory
  commitSha?: string;            // Git commit when stored
  
  // Content (loaded from Git on demand)
  content: string;               // Raw content (Mermaid, code, etc.)
  parsedConstraints?: {          // Extracted from Mermaid
    requiredRoutes: string[];
    requiredComponents: string[];
    dataEntities: string[];
    validationRules: ValidationRule[];
  };
  
  // Metadata
  createdAt: Date;
  version: number;               // For iteration tracking
  
  // Approval tracking (also stored in Git via context.json)
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
}
```

### Workflow Event (Event Sourcing)

```typescript
interface WorkflowEvent {
  id: string;
  workflowRunId: string;
  type: WorkflowEventType;
  payload: Record<string, unknown>;
  timestamp: Date;
  sequence: number;              // For ordering/replay
}

type WorkflowEventType =
  | 'RUN_STARTED'
  | 'STAGE_STARTED'
  | 'STAGE_COMPLETED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'CLARIFICATION_REQUESTED'
  | 'CLARIFICATION_ANSWERED'
  | 'ARTIFACT_CREATED'
  | 'IMPLEMENTATION_SUCCEEDED'
  | 'IMPLEMENTATION_FAILED'
  | 'VALIDATION_PASSED'
  | 'VALIDATION_FAILED'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED'
  | 'RUN_CANCELLED';
```

### Clarification Context

```typescript
interface ClarificationRequest {
  id: string;
  workflowRunId: string;
  stage: string;                 // Which stage is asking
  
  // Question details
  question: string;
  context: string;               // Why is it asking? What was ambiguous?
  options?: string[];            // Multiple choice if applicable
  responseType: 'text' | 'single_choice' | 'multiple_choice' | 'file_upload';
  
  // State
  status: 'pending' | 'answered' | 'ignored';
  response?: string;
  answeredAt?: Date;
  
  // Metadata
  attemptNumber: number;
  createdAt: Date;
}
```

### Database Schema

```sql
-- workflow_runs table
CREATE TABLE workflow_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  config TEXT NOT NULL,        -- JSON
  status TEXT NOT NULL,
  current_stage TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  paused_at INTEGER,
  resumed_at INTEGER,
  completed_at INTEGER,
  original_request TEXT NOT NULL,
  clarification_count INTEGER DEFAULT 0
);

CREATE INDEX workflow_runs_user_id_idx ON workflow_runs(user_id);
CREATE INDEX workflow_runs_status_idx ON workflow_runs(status);
CREATE INDEX workflow_runs_project_id_idx ON workflow_runs(project_id);

-- Note: Artifacts are stored in Git (.autonomous/ directory)
-- SQLite only tracks active workflow state for durability

-- workflow_events table (event sourcing)
CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,       -- JSON
  timestamp INTEGER NOT NULL,
  sequence INTEGER NOT NULL
);

CREATE INDEX workflow_events_workflow_run_id_idx ON workflow_events(workflow_run_id);
CREATE UNIQUE INDEX workflow_events_sequence_idx ON workflow_events(workflow_run_id, sequence);

-- clarification_requests table
CREATE TABLE clarification_requests (
  id TEXT PRIMARY KEY,
  workflow_run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  question TEXT NOT NULL,
  context TEXT NOT NULL,
  options TEXT,                -- JSON array
  response_type TEXT NOT NULL,
  status TEXT NOT NULL,
  response TEXT,
  answered_at INTEGER,
  attempt_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX clarification_requests_workflow_run_id_idx ON clarification_requests(workflow_run_id);
CREATE INDEX clarification_requests_status_idx ON clarification_requests(status);
```

---

## Components

### 1. WorkflowEngine (XState-based)

**File:** `src/orchestrator/engine.ts`

Main state machine orchestrating the workflow lifecycle.

```typescript
class WorkflowEngine {
  constructor(config: {
    storage: WorkflowStorage;
    gitStorage: GitStorage;
    agentRouter: AgentRouter;
  });

  // Start a new autonomous run
  async startRun(input: {
    projectId: string;
    userId: string;
    request: string;
    config: RunConfig;
  }): Promise<WorkflowRun>;

  // Resume a paused workflow (human responded)
  async resumeRun(runId: string, response: ResumeInput): Promise<void>;

  // Cancel a running workflow
  async cancelRun(runId: string): Promise<void>;

  // Get current state (for UI)
  async getRunState(runId: string): Promise<RunState>;

  // Internal: Execute stage with appropriate agent
  private async executeStage(run: WorkflowRun, stage: Stage): Promise<StageResult>;

  // Internal: Handle human-in-the-loop gates
  private async handleApprovalGate(run: WorkflowRun, artifact: Artifact): Promise<ApprovalResult>;
  private async handleClarification(run: WorkflowRun, request: ClarificationRequest): Promise<void>;
}
```

**State Machine Definition:**

```typescript
const workflowMachine = createMachine({
  id: 'autonomousWorkflow',
  initial: 'planning',
  states: {
    planning: {
      entry: ['logStageStart'],
      invoke: {
        src: 'executePlanner',
        onDone: {
          target: 'planApproval',
          actions: ['saveArtifact', 'emitEvent']
        },
        onError: { target: 'failed' }
      }
    },
    
    planApproval: {
      entry: ['checkTrustMode'],
      on: {
        '': [
          { target: 'implementation', cond: 'isAutoApproved' },
          { target: 'awaitingPlanApproval' }
        ]
      }
    },
    
    awaitingPlanApproval: {
      entry: ['pauseWorkflow', 'notifyUser'],
      on: {
        APPROVE: 'implementation',
        REJECT: 'planning',           // Back to revise
        CLARIFY: 'awaitingClarification'
      }
    },
    
    awaitingClarification: {
      entry: ['pauseForClarification'],
      on: {
        CLARIFICATION_ANSWERED: [
          { target: 'planning', cond: 'isPlanClarification' },
          { target: 'implementation', cond: 'isImplClarification' }
        ],
        CLARIFICATION_IGNORED: 'planning'  // Treat as rejection
      }
    },
    
    implementation: {
      entry: ['logStageStart'],
      invoke: {
        src: 'executeImplementer',
        onDone: {
          target: 'validation',
          actions: ['saveArtifact']
        },
        onError: [
          { target: 'awaitingClarification', cond: 'needsClarification' },
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
          { target: 'implementation', cond: 'shouldRetry' },
          { target: 'awaitingFixApproval', cond: 'needsHumanDecision' }
        ],
        onError: { target: 'failed' }
      }
    },
    
    awaitingFixApproval: {
      entry: ['pauseWorkflow', 'presentOptions'],
      on: {
        RETRY: 'implementation',
        ACCEPT_ANYWAY: 'completed',
        CANCEL: 'failed'
      }
    },
    
    completed: {
      type: 'final',
      entry: ['emitCompletedEvent', 'notifyUser']
    },
    
    failed: {
      type: 'final',
      entry: ['emitFailedEvent', 'notifyUser']
    },
    
    cancelled: {
      type: 'final',
      entry: ['cleanup', 'notifyUser']
    }
  }
});
```

### 2. AgentRouter

**File:** `src/orchestrator/agent-router.ts`

Routes different workflow stages to appropriate models.

```typescript
class AgentRouter {
  constructor(config: {
    providers: Map<string, ModelProvider>;
    defaultRouting: ModelRoutingConfig;
  });

  async executePlanner(prompt: string, context: Context): Promise<PlanResult>;
  async executeImplementer(prompt: string, artifacts: Artifact[]): Promise<ImplementationResult>;
  async executeValidator(code: string, spec: Artifact): Promise<ValidationResult>;

  // Generic execution with model selection
  private async execute(
    stage: string,
    prompt: string,
    model: string,
    options?: ExecutionOptions
  ): Promise<AgentResponse>;
}
```

**Default Model Routing:**

| Stage | Default Model | Rationale |
|-------|---------------|-----------|
| Planning | DeepSeek-R1 | Cheap, good at structured output |
| Implementation | Claude 3.5 Sonnet | Best coding performance |
| Validation | GPT-4o-mini | Fast, cheap verification |

### 3. GitStorage

**File:** `src/orchestrator/git-storage.ts`

Manages Git operations for committing code and artifacts. All persistent data flows through Git.

```typescript
class GitStorage {
  constructor(config: {
    repoUrl: string;
    authToken: string;
    baseBranch: string;
  });

  // Initialize repository clone/access
  async init(): Promise<void>;

  // Create branch for new autonomous run
  async createRunBranch(runId: string, baseSha?: string): Promise<string>;

  // Commit artifacts and code from E2B sandbox
  async commitRunArtifacts(
    runId: string,
    sandbox: E2BSandbox,
    metadata: RunMetadata
  ): Promise<GitCommitResult>;

  // Commit spec (Mermaid diagram) during planning stage
  async commitSpec(
    runId: string,
    specContent: string,
    specNumber: number
  ): Promise<void>;

  // Commit run context after completion
  async commitRunContext(runId: string, context: RunContext): Promise<void>;

  // Update project memory
  async updateMemory(update: MemoryUpdate): Promise<void>;

  // Load project memory for context
  async loadMemory(): Promise<ProjectMemory>;

  // Push branch to remote
  async pushBranch(branchName: string): Promise<void>;

  // Create pull request (if configured)
  async createPullRequest(run: WorkflowRun): Promise<PRResult | null>;

  // Merge branch (for auto-merge scenarios)
  async mergeBranch(branchName: string, strategy: 'merge' | 'squash'): Promise<void>;

  // Get file content from specific commit
  async getFileAtCommit(path: string, commitSha: string): Promise<string>;

  // List files changed in run
  async getChangedFiles(runId: string): Promise<string[]>;
}

interface RunMetadata {
  originalRequest: string;
  modelRouting: ModelRoutingConfig;
  clarifications: ClarificationRecord[];
  approvedAt?: Date;
}

interface GitCommitResult {
  commitSha: string;
  branchName: string;
  filesChanged: string[];
}
```

**Git Operations Flow:**

```typescript
// During planning stage
const branchName = await gitStorage.createRunBranch(run.id, 'main');
await gitStorage.commitSpec(run.id, mermaidContent, specNumber);

// During implementation stage (after E2B execution)
await gitStorage.commitRunArtifacts(run.id, e2bSandbox, {
  originalRequest: run.originalRequest,
  modelRouting: run.config.modelRouting,
  clarifications: run.clarifications
});

// On completion
await gitStorage.commitRunContext(run.id, buildRunContext(run));
await gitStorage.pushBranch(branchName);

if (run.config.createPR) {
  await gitStorage.createPullRequest(run);
} else if (shouldAutoMerge(run)) {
  await gitStorage.mergeBranch(branchName, 'squash');
}
```

### 4. ArtifactStore

**File:** `src/orchestrator/artifacts.ts`

Processes artifacts (parsing Mermaid, building prompts). Actual storage is delegated to GitStorage.

```typescript
class ArtifactStore {
  constructor(config: {
    gitStorage: GitStorage;
  });

  // Process and store planning artifact (Mermaid diagram)
  async createPlanningArtifact(
    runId: string,
    mermaidSource: string
  ): Promise<Artifact>;

  // Load artifact for agent context
  async loadArtifact(runId: string, type: string): Promise<Artifact>;

  // Parse Mermaid into structured constraints
  async parseMermaid(mermaidSource: string): Promise<ParsedConstraints>;

  // Inject artifact into agent context
  async buildSystemPrompt(artifact: Artifact, task: string): Promise<string>;

  // Validate implementation against spec
  async validateAgainstSpec(code: string, spec: Artifact): Promise<ValidationResult>;
}

interface ParsedConstraints {
  requiredRoutes: string[];          // Extracted from flowchart nodes
  requiredComponents: string[];      // Extracted from component diagrams
  dataEntities: string[];            // Extracted from ER diagrams
  validationRules: ValidationRule[]; // Derived from diagram structure
}
```

**Mermaid Parsing Example:**

```typescript
// Input Mermaid
const userFlow = `
flowchart TD
  A[Login Page] --> B{Authenticated?}
  B -->|Yes| C[Dashboard]
  B -->|No| D[Error Page]
`;

// Parsed constraints
{
  requiredRoutes: ['Login Page', 'Dashboard', 'Error Page'],
  requiredComponents: ['AuthenticationCheck'],
  validationRules: [
    { type: 'route_exists', route: 'Login Page' },
    { type: 'conditional_branch', from: 'Authenticated?', to: ['Dashboard', 'Error Page'] }
  ]
}
```

### 5. WorkflowStorage (Active State Only)

**File:** `src/orchestrator/storage.ts`

SQLite storage for **active workflow state only**. Historical data lives in Git. If this database is lost, all completed run history can be reconstructed from `.autonomous/` in the Git repo.

```typescript
class WorkflowStorage {
  // Run CRUD
  async createRun(run: NewWorkflowRun): Promise<WorkflowRun>;
  async getRun(id: string): Promise<WorkflowRun | null>;
  async updateRun(id: string, updates: Partial<WorkflowRun>): Promise<void>;
  
  // Event sourcing
  async appendEvent(event: WorkflowEvent): Promise<void>;
  async getEvents(runId: string): Promise<WorkflowEvent[]>;
  async replayEvents(runId: string): Promise<WorkflowRun>;  // Reconstruct state
  
  // Clarifications
  async createClarification(request: ClarificationRequest): Promise<void>;
  async answerClarification(id: string, response: string): Promise<void>;
  async getPendingClarifications(runId: string): Promise<ClarificationRequest[]>;
  
  // Concurrency management
  async getActiveRuns(userId: string): Promise<WorkflowRun[]>;
  async canStartRun(userId: string, maxConcurrency: number): Promise<boolean>;
}
```

### 6. VSCode Extension Integration

**File:** `extension/src/autonomous/*`

VSCode extension panels for managing autonomous runs.

```typescript
// Run tree view in sidebar
class AutonomousRunProvider implements vscode.TreeDataProvider<RunItem> {
  getChildren(element?: RunItem): RunItem[];
  refresh(): void;
}

// Webview panel for artifact viewing
class ArtifactViewer {
  showArtifact(artifact: Artifact): void;
  renderMermaid(mermaidSource: string): string;  // Returns HTML with rendered diagram
}

// Clarification/Approval panel
class HumanInTheLoopPanel {
  showApprovalRequest(run: WorkflowRun, artifact: Artifact): void;
  showClarificationRequest(request: ClarificationRequest): void;
  
  onApprove: Event<{ runId: string; notes?: string }>;
  onReject: Event<{ runId: string; feedback?: string }>;
  onClarify: Event<{ runId: string; question: string }>;
}
```

---

## Message Flows

### Flow 1: New Autonomous Run (Full Auto Mode)

```
User → VSCode: "Create login flow with OAuth" (project: my-app)
  │
  ▼
Extension → POST /api/runs
  │
  ▼
Orchestrator:
  ├── Create run in SQLite (status: running)
  ├── GitStorage: Create branch autonomous/{run-id}
  └── WorkflowEngine: Start state machine
  │
  ├──▶ Planner (DeepSeek)
  │     Input: "Create login flow with OAuth" + .autonomous/memory.md context
  │     Output: Mermaid diagram + constraints
  │
  ├──▶ Check trust mode: planning = auto ✓
  │
  ├──▶ GitStorage: Commit spec to .autonomous/specs/001-login-flow.md
  │
  ├──▶ Implementer (Claude)
  │     Input: Prompt + Mermaid constraints
  │     Output: Code files → written to E2B sandbox
  │
  ├──▶ Validator (GPT-4o-mini)
  │     Input: Code + constraints
  │     Output: "All constraints satisfied"
  │
  ├──▶ GitStorage:
  │     ├── Commit code from E2B sandbox to src/
  │     ├── Commit run context to .autonomous/runs/{id}/context.json
  │     └── Push branch to GitHub
  │
  ├──▶ Check trust mode: auto-merge = true
  │     GitStorage: Merge branch to main (squash)
  │
  ▼
Status: completed
Extension ← Webhook/WS: Run complete + commit SHA
User: Reviews merged code in main branch
```

### Flow 2: Run with Plan Approval Gate

```
...
  │
  ├──▶ Planner: Generates Mermaid diagram
  │
  ├──▶ GitStorage: Commit spec to branch (not pushed yet)
  │     (So user can review the exact spec that will be implemented)
  │
  ├──▶ Check trust mode: planning = manual
  │     State: awaiting_plan_approval
  │     Persist pause, notify user
  │
User ← Extension notification: "Review plan"
  │
User → Extension: Opens artifact viewer (loads from Git branch)
  │
User → Clicks "Approve"
  │
  ▼
Extension → POST /api/runs/:id/approve
  │
  ▼
Orchestrator:
  ├── Resume workflow
  ├── GitStorage: Push branch (now public)
  └── Continue...
  │
  ├──▶ Implementer: Continues...
```

### Flow 3: Clarification Loop

```
...
  │
  ├──▶ Implementer encounters ambiguity
  │     Response: "CLARIFY: {question, context}"
  │
  ├──▶ WorkflowEngine: Check clarification count
  │     If < max: Transition to awaiting_clarification
  │     Else: Escalate to human approval
  │
User ← Extension: "Need clarification" panel
  │     Shows: Question, context, input field
  │
User → Types: "Use Supabase Auth"
  │
  ▼
Extension → POST /api/clarifications/:id/answer
  │
  ▼
Orchestrator: Resume implementation with answer in context
  │
  ├──▶ Implementer (with clarification)
  │     Input: Original prompt + "Note: Use Supabase Auth" + Mermaid
  │     Output: Code using Supabase
```

### Flow 4: Parallel Runs

```
User → Extension: "Explore 3 auth approaches"
  │
  ▼
Extension: Creates 3 runs with same request
  Run A: "Implement JWT auth"
  Run B: "Implement Supabase Auth"
  Run C: "Implement Clerk auth"
  │
  ▼
Orchestrator: All 3 start concurrently
  │
  ├──▶ Run A: Planning → ... → Completed
  ├──▶ Run B: Planning → Awaiting Approval → ... → Completed
  └──▶ Run C: Planning → Implementation → Awaiting Clarification → ... → Completed
  │
User: Views all 3 in sidebar, compares artifacts
```

---

## Configuration

### Environment Variables

```bash
# Orchestrator server
ORCHESTRATOR_PORT=3001
DATABASE_URL=sqlite:./data/orchestrator.db

# GitHub configuration (for Git-First storage)
GITHUB_TOKEN=ghp_...                    # Personal access token with repo scope
GITHUB_REPO_OWNER=your-username         # GitHub username or org
GITHUB_REPO_NAME=your-repo              # Repository name
GITHUB_DEFAULT_BRANCH=main              # Base branch for new runs

# Model API keys (at least one per stage)
DEEPSEEK_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
OPENAI_API_KEY=sk-...

# Default model routing
DEFAULT_PLANNER_MODEL=deepseek-reasoner
DEFAULT_IMPLEMENTER_MODEL=claude-3-5-sonnet-20241022
DEFAULT_VALIDATOR_MODEL=gpt-4o-mini

# Concurrency limits
MAX_CONCURRENT_RUNS_PER_USER=5
DEFAULT_MAX_CLARIFICATIONS=3

# Feature flags
ENABLE_AUTO_RETRY=true
ENABLE_VALIDATION_DRIFT_DETECTION=true
DEFAULT_AUTO_MERGE=false                # Auto-merge branches on completion
```

### Per-Run Configuration

```typescript
interface RunConfig {
  trustMode: {
    planning: 'auto' | 'manual';
    implementation: 'auto' | 'manual';
    fixes: 'auto' | 'manual';      // Auto-retry vs ask human
  };
  maxClarifications: number;        // Default: 3
  maxConcurrency: number;           // Limit parallel runs
  modelRouting: {
    planner: string;
    implementer: string;
    validator: string;
  };
  timeoutMinutes: {                 // Per-stage timeouts
    planning: 10;
    implementation: 60;
    validation: 5;
  };
  git: {
    createPR: boolean;              // Create PR vs just push branch
    autoMerge: boolean;             // Auto-merge on success
    baseBranch: string;             // Branch to base from (default: main)
  };
}
```

### Project Configuration (`.autonomous/config.json`)

Stored in Git, shared across all runs for a project:

```json
{
  "defaultRunConfig": {
    "trustMode": {
      "planning": "manual",
      "implementation": "auto",
      "fixes": "auto"
    },
    "maxClarifications": 3,
    "modelRouting": {
      "planner": "deepseek-reasoner",
      "implementer": "claude-3-5-sonnet-20241022",
      "validator": "gpt-4o-mini"
    }
  },
  "git": {
    "autoMerge": false,
    "requireApprovalFor": ["planning", "implementation"]
  },
  "excludePaths": [
    "node_modules/",
    ".env",
    "*.log"
  ]
}
```

---

## Error Handling

### Orchestrator-Level Errors

| Error | Handling | User Impact |
|-------|----------|-------------|
| Model API failure | Retry 3x with backoff, then pause for manual retry | Notification: "Model unavailable, click to retry" |
| State machine crash | Event sourcing replay to recover | Seamless recovery, user sees "Resuming..." |
| Database connection lost | Queue operations, reconnect and replay | Runs continue from last event |
| Stage timeout | Pause with timeout status, offer extend/cancel | Notification with options |

### Agent-Level Errors

| Error | Handling | Recovery |
|-------|----------|----------|
| Planner produces invalid Mermaid | Retry once, then pause for human fix | Clarification: "Plan parsing failed, please review" |
| Implementer needs clarification | Emit CLARIFY, transition state | Wait for human response |
| Too many clarifications | Escalate to full approval gate | Human reviews entire context |
| Validation fails (minor) | Auto-retry with feedback if trustMode.fixes = auto | Loop back to implementation |
| Validation fails (major) | Pause for human decision | Options: retry, accept anyway, cancel |

### Extension-Level Errors

| Error | Handling |
|-------|----------|
| WebSocket disconnect | Poll for updates, auto-reconnect |
| Artifact render fails | Show raw source with "Retry render" |
| Clarification panel stuck | Force refresh, re-fetch pending |

---

## Testing Strategy

### Unit Tests

```typescript
// WorkflowEngine state transitions
describe('WorkflowEngine', () => {
  it('transitions planning → implementation on auto-approve', async () => {
    // Setup run with trustMode.planning = 'auto'
    // Execute
    // Assert state = 'implementation'
  });
  
  it('pauses at approval gate when trustMode = manual', async () => {
    // Setup run with trustMode.planning = 'manual'
    // Execute
    // Assert state = 'awaiting_plan_approval'
  });
  
  it('limits clarifications to maxClarifications', async () => {
    // Setup run with maxClarifications = 2
    // Simulate 3 clarification requests
    // Assert escalates to approval gate on 3rd
  });
});

// Artifact parsing
describe('ArtifactStore', () => {
  it('extracts routes from Mermaid flowchart', async () => {
    const mermaid = 'flowchart TD\nA[Home] --> B[About]';
    const parsed = await store.parseMermaid(mermaid);
    expect(parsed.requiredRoutes).toContain('Home');
    expect(parsed.requiredRoutes).toContain('About');
  });
});
```

### Integration Tests

```typescript
// Full workflow with mocked agents
describe('Autonomous Workflow E2E', () => {
  it('completes full auto workflow', async () => {
    const run = await engine.startRun({
      request: 'Create todo app',
      config: { trustMode: { planning: 'auto', implementation: 'auto', fixes: 'auto' } }
    });
    
    // Wait for completion
    await waitForRunComplete(run.id);
    
    const state = await engine.getRunState(run.id);
    expect(state.status).toBe('completed');
    expect(state.artifacts).toHaveLength(3); // plan, impl, validation
  });
  
  it('pauses and resumes with clarification', async () => {
    // Mock implementer to request clarification
    // Verify state = awaiting_clarification
    // Submit answer
    // Verify resumes to implementation
  });
});
```

### Manual Tests

| Scenario | Steps | Expected |
|----------|-------|----------|
| Full auto run | Create run with all auto, wait | Completes without intervention |
| Plan approval | Create run with manual planning, approve | Pauses at plan, resumes after approval |
| Clarification | Trigger ambiguous request, answer | Asks question, incorporates answer |
| Parallel runs | Start 3 runs simultaneously | All execute, sidebar shows all statuses |
| Crash recovery | Kill orchestrator mid-run, restart | Resumes from last event |
| Timeout | Set short timeout, let stage exceed | Pauses with timeout status |
| Git commit | Complete a run | Code committed to branch, artifacts in .autonomous/ |
| Git merge | Complete auto-merge run | Branch merged to main |
| Git history | Clone repo after runs | All specs, code, context visible in history |
| Recovery from Git | Delete SQLite, clone repo | All run history reconstructible |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| XState complexity becomes unmanageable | Medium | High | Start simple, add states incrementally; comprehensive state tests |
| Event sourcing overhead | Low | Medium | SQLite is fast; optimize event queries; archive old events |
| Model API costs spiral | Medium | Medium | Routing cheap models where possible; per-run cost tracking |
| Clarification loops infinite | Low | High | Hard limit on maxClarifications; escalation to human |
| Artifact parsing brittle | Medium | Medium | Defensive parsing; fallback to raw text display |
| VSCode extension state sync issues | Medium | Medium | WebSocket primary, polling fallback; optimistic UI updates |
| Concurrent runs overwhelm system | Low | Medium | Per-user concurrency limits; queue with backoff |
| Git merge conflicts | Medium | Medium | Always branch from latest main; rebase before merge; alert on conflict |
| Git repo bloat from many runs | Low | Low | Archive old run contexts; compress with git gc; store large artifacts externally |
| GitHub API rate limits | Medium | Low | Batch operations; exponential backoff; cache where possible |
| E2B sandbox lost mid-run | Low | High | Code is in Git after each stage; can restart from last commit |
| Git authentication expires | Medium | High | Refresh tokens; alert user; pause runs until resolved |

---

## Success Criteria

- [ ] Can start autonomous run from VSCode
- [ ] Run completes full workflow (plan → implement → validate)
- [ ] Manual approval gates pause and resume correctly
- [ ] Clarification loops work (ask → answer → continue)
- [ ] Multiple runs execute concurrently
- [ ] Survives orchestrator restart mid-run
- [ ] Artifacts display correctly (Mermaid renders)
- [ ] Trust modes toggle per-run
- [ ] Model routing works (different models per stage)
- [ ] Code commits to Git branch on completion
- [ ] Specs stored in `.autonomous/specs/`
- [ ] Run context stored in `.autonomous/runs/{id}/`
- [ ] Project memory updated in `.autonomous/memory.md`
- [ ] Auto-merge works (optional, based on trust mode)
- [ ] Can reconstruct history from Git if SQLite lost
- [ ] All tests pass

---

## Future Enhancements (Post-MVP)

1. **Skill Injection** - Load domain-specific skills into planner context
2. **Solution Memory** - Learn from past successful implementations
3. **Team Collaboration** - Multiple humans reviewing same workflow
4. **Custom Stages** - User-defined workflow stages beyond plan/implement/validate
5. **Batch Runs** - Queue multiple requests, process sequentially
6. **Metrics Dashboard** - Success rates, cost per run, time to completion
