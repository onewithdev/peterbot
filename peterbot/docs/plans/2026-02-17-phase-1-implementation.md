# Phase 1 Implementation Plan — Personal & Safe

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Phase 1 admin dashboard (Soul.md, Web Dashboard, Two-Layer Memory, Command Blocklist) as a cohesive vertical slice on top of the existing peterbot Tracer Bullet.

**Architecture:** Single-page admin dashboard using Hono + HTMX/Alpine.js (no React build step). Reuses existing SQLite database. File-based configuration for soul.md and memory.md.

**Tech Stack:** Bun · Hono · SQLite (existing) · Drizzle (existing) · HTMX · Alpine.js

---

## Keystone Context

peterbot already has a working Tracer Bullet:
- ✅ Database layer (jobs table, Drizzle ORM)
- ✅ Worker (background job processor)
- ✅ Telegram bot (primary UI)
- ✅ E2B integration

Phase 1 adds a **Web Dashboard** as an admin control panel — not replacing Telegram, but complementing it with configuration and monitoring capabilities.

**Key Decision:** Use HTMX + Alpine.js instead of React to avoid a build step and keep the stack simple. The dashboard is an admin tool, not a complex SPA.

---

## Implementation Order (Elephant Carpaccio)

Following Keystone's Law of the Shell: Build the container first, then the features.

1. **App Shell** — Layout, navigation, routing, empty pages
2. **Slice 4: Blocklist** — Simplest feature, adds immediate safety value
3. **Slice 1: Soul.md** — File-based, establishes pattern
4. **Slice 3: Memory** — Integrates with existing jobs table
5. **Slice 2: Monitor** — Most complex, builds on all previous work

---

## Task 1: App Shell — Dashboard Foundation

**Purpose:** Establish the dashboard structure that all features will use.

**Files:**
- Create: `src/dashboard/server.ts`
- Create: `src/dashboard/layout.ts`
- Create: `src/dashboard/routes/index.ts`
- Create: `src/dashboard/routes/soul.ts` (placeholder)
- Create: `src/dashboard/routes/memory.ts` (placeholder)
- Create: `src/dashboard/routes/monitor.ts` (placeholder)
- Create: `src/dashboard/routes/config.ts` (placeholder)
- Create: `src/dashboard/static/styles.css`
- Modify: `src/core/server.ts` (mount dashboard)

**Step 1: Create dashboard server file**

File: `src/dashboard/server.ts`

```typescript
/**
 * Dashboard Server
 * 
 * Hono app for the admin dashboard.
 * Mounted at /admin in the main server.
 * Uses HTMX for dynamic updates, Alpine.js for reactivity.
 */

import { Hono } from "hono";
import { serveStatic } from "hono/bun";

// Import route modules
import indexRoutes from "./routes/index.js";
import soulRoutes from "./routes/soul.js";
import memoryRoutes from "./routes/memory.js";
import monitorRoutes from "./routes/monitor.js";
import configRoutes from "./routes/config.js";

const app = new Hono();

// Static assets
app.use("/static/*", serveStatic({ root: "./src/dashboard" }));

// Mount routes
app.route("/", indexRoutes);
app.route("/soul", soulRoutes);
app.route("/memory", memoryRoutes);
app.route("/monitor", monitorRoutes);
app.route("/config", configRoutes);

export default app;
```

**Step 2: Create layout helper**

File: `src/dashboard/layout.ts`

```typescript
/**
 * Dashboard Layout
 * 
 * Shared HTML layout wrapper for all dashboard pages.
 * Includes sidebar navigation and HTMX/Alpine.js setup.
 */

export interface LayoutOptions {
  title: string;
  activeRoute?: string;
  body: string;
}

const navigation = [
  { path: "/admin", label: "📊 Overview", id: "index" },
  { path: "/admin/soul", label: "🎭 Soul", id: "soul" },
  { path: "/admin/memory", label: "🧠 Memory", id: "memory" },
  { path: "/admin/monitor", label: "📺 Monitor", id: "monitor" },
  { path: "/admin/config", label: "⚙️ Config", id: "config" },
];

export function renderLayout(options: LayoutOptions): string {
  const { title, activeRoute = "index", body } = options;

  const navItems = navigation
    .map((item) => {
      const isActive = item.id === activeRoute;
      const className = isActive
        ? "bg-blue-100 text-blue-800 border-r-4 border-blue-500"
        : "text-gray-600 hover:bg-gray-100";
      return `
        <a href="${item.path}" 
           class="block px-4 py-3 ${className} transition-colors">
          ${item.label}
        </a>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | peterbot Admin</title>
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.x.x/dist/tailwind.min.css" rel="stylesheet">
  <style>
    [x-cloak] { display: none !important; }
    .htmx-indicator { opacity: 0; transition: opacity 200ms; }
    .htmx-request .htmx-indicator { opacity: 1; }
    .htmx-request.htmx-indicator { opacity: 1; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="flex min-h-screen">
    <!-- Sidebar -->
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div class="p-4 border-b border-gray-200">
        <h1 class="text-xl font-bold text-gray-800">🧠 peterbot</h1>
        <p class="text-sm text-gray-500">Admin Dashboard</p>
      </div>
      <nav class="flex-1 py-4">
        ${navItems}
      </nav>
      <div class="p-4 border-t border-gray-200">
        <a href="/admin/console" 
           class="block w-full text-center px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700 transition-colors"
           onclick="alert('Dev Console coming in Task 5'); return false;">
          🖥️ Dev Console
        </a>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 p-8 overflow-auto">
      ${body}
    </main>
  </div>
</body>
</html>
  `;
}
```

**Step 3: Create index route (Overview page)**

File: `src/dashboard/routes/index.ts`

```typescript
/**
 * Dashboard Overview Route
 * 
 * Main landing page showing system status and quick stats.
 */

import { Hono } from "hono";
import { renderLayout } from "../layout.js";
import { db } from "../../db/index.js";
import { jobs } from "../../features/jobs/schema.js";
import { eq, sql } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  // Get quick stats from database
  const totalJobs = await db.select({ count: sql<number>`count(*)` }).from(jobs);
  const pendingJobs = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "pending"));
  const runningJobs = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "running"));
  const completedJobs = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "completed"));
  const failedJobs = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "failed"));

  const body = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold mb-8">Dashboard Overview</h2>
      
      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="text-3xl font-bold text-blue-600">${totalJobs[0]?.count || 0}</div>
          <div class="text-gray-600">Total Jobs</div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="text-3xl font-bold text-yellow-600">${pendingJobs[0]?.count || 0}</div>
          <div class="text-gray-600">Pending</div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="text-3xl font-bold text-green-600">${completedJobs[0]?.count || 0}</div>
          <div class="text-gray-600">Completed</div>
        </div>
        <div class="bg-white p-6 rounded-lg shadow">
          <div class="text-3xl font-bold text-red-600">${failedJobs[0]?.count || 0}</div>
          <div class="text-gray-600">Failed</div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white rounded-lg shadow">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold">Recent Activity</h3>
        </div>
        <div class="p-6">
          <p class="text-gray-500">Recent jobs list coming in Task 5 (Monitor)</p>
        </div>
      </div>
    </div>
  `;

  return c.html(renderLayout({ title: "Overview", activeRoute: "index", body }));
});

export default app;
```

**Step 4: Create placeholder routes**

File: `src/dashboard/routes/soul.ts`

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";

const app = new Hono();

app.get("/", (c) => {
  const body = `
    <div class="max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">🎭 Soul</h2>
      <p class="text-gray-600 mb-8">Configure peterbot's personality and communication style.</p>
      
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p class="text-yellow-800">🚧 Coming in Task 3: Soul.md editor</p>
      </div>
    </div>
  `;
  return c.html(renderLayout({ title: "Soul", activeRoute: "soul", body }));
});

export default app;
```

File: `src/dashboard/routes/memory.ts`

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";

const app = new Hono();

app.get("/", (c) => {
  const body = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">🧠 Memory</h2>
      <p class="text-gray-600 mb-8">Manage what peterbot remembers about you.</p>
      
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p class="text-yellow-800">🚧 Coming in Task 4: Two-layer memory editor</p>
      </div>
    </div>
  `;
  return c.html(renderLayout({ title: "Memory", activeRoute: "memory", body }));
});

export default app;
```

File: `src/dashboard/routes/monitor.ts`

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";

const app = new Hono();

app.get("/", (c) => {
  const body = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">📺 Monitor</h2>
      <p class="text-gray-600 mb-8">Real-time job monitoring and live logs.</p>
      
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p class="text-yellow-800">🚧 Coming in Task 5: Live monitor with auto-refresh</p>
      </div>
    </div>
  `;
  return c.html(renderLayout({ title: "Monitor", activeRoute: "monitor", body }));
});

export default app;
```

File: `src/dashboard/routes/config.ts`

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";

const app = new Hono();

app.get("/", (c) => {
  const body = `
    <div class="max-w-4xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">⚙️ Configuration</h2>
      <p class="text-gray-600 mb-8">Manage blocklist and system settings.</p>
      
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <p class="text-yellow-800">🚧 Coming in Task 2: Blocklist configuration</p>
      </div>
    </div>
  `;
  return c.html(renderLayout({ title: "Config", activeRoute: "config", body }));
});

export default app;
```

**Step 5: Mount dashboard in main server**

File: `src/core/server.ts` — modify to add dashboard route

Add import at top:
```typescript
import dashboardApp from "../dashboard/server.js";
```

Add route mounting before the default export:
```typescript
// Mount admin dashboard
app.route("/admin", dashboardApp);
```

**Step 6: Run and verify**

```bash
bun run dev
```

Visit:
- http://localhost:3000/admin — should show Overview with stats
- http://localhost:3000/admin/soul — should show placeholder
- http://localhost:3000/admin/memory — should show placeholder
- http://localhost:3000/admin/monitor — should show placeholder
- http://localhost:3000/admin/config — should show placeholder

**Step 7: Commit**

```bash
git add src/dashboard/
git commit -m "feat: add dashboard app shell with navigation"
```

---

## Task 2: Slice 4 — Command Blocklist

**Purpose:** Add pattern-based protection against dangerous commands.

**Files:**
- Create: `config/blocklist.json`
- Create: `src/features/blocklist/validators.ts`
- Create: `src/features/blocklist/service.ts`
- Create: `src/features/blocklist/service.test.ts`
- Modify: `src/worker/e2b.ts` (integrate blocklist check)
- Modify: `src/dashboard/routes/config.ts` (add UI)

**Step 1: Create blocklist config file**

File: `config/blocklist.json`

```json
{
  "strict": {
    "patterns": [
      "rm\\s+-rf\\s+/",
      "sudo\\s+",
      "mkfs\\.",
      ">\\s*/dev/sd",
      "dd\\s+if=.*of=/dev",
      ":\\s*\\{\\s*:\\s*\\}\\s*;\\s*while",
      "fork\\s*\\(\\)"
    ],
    "action": "block",
    "message": "This command is blocked in background tasks for safety."
  },
  "warn": {
    "patterns": [
      "pip\\s+install",
      "apt-get",
      "curl\\s+.*\\|\\s*sh",
      "wget\\s+.*\\|\\s*sh"
    ],
    "action": "warn",
    "message": "This command may have side effects. Review before running."
  },
  "description": "Command blocklist for E2B sandbox execution"
}
```

**Step 2: Create validators**

File: `src/features/blocklist/validators.ts`

```typescript
import { z } from "zod";

export const blocklistEntrySchema = z.object({
  patterns: z.array(z.string()),
  action: z.enum(["block", "warn"]),
  message: z.string(),
});

export const blocklistConfigSchema = z.object({
  strict: blocklistEntrySchema,
  warn: blocklistEntrySchema,
  description: z.string().optional(),
});

export type BlocklistConfig = z.infer<typeof blocklistConfigSchema>;
export type BlocklistEntry = z.infer<typeof blocklistEntrySchema>;
```

**Step 3: Create blocklist service**

File: `src/features/blocklist/service.ts`

```typescript
import { readFileSync } from "fs";
import type { BlocklistConfig, BlocklistEntry } from "./validators.js";

export interface CheckResult {
  allowed: boolean;
  action: "allow" | "block" | "warn";
  message?: string;
  matchedPattern?: string;
}

const CONFIG_PATH = "./config/blocklist.json";

function loadConfig(): BlocklistConfig {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content) as BlocklistConfig;
  } catch {
    // Return safe defaults if config missing
    return {
      strict: {
        patterns: ["rm -rf /", "sudo ", "mkfs"],
        action: "block",
        message: "Command blocked for safety.",
      },
      warn: {
        patterns: [],
        action: "warn",
        message: "Command may have side effects.",
      },
    };
  }
}

function checkAgainstEntry(code: string, entry: BlocklistEntry): CheckResult | null {
  for (const pattern of entry.patterns) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(code)) {
      return {
        allowed: entry.action !== "block",
        action: entry.action,
        message: entry.message,
        matchedPattern: pattern,
      };
    }
  }
  return null;
}

/**
 * Check if code passes the blocklist for background tasks.
 * Strict patterns block execution. Warn patterns allow but warn.
 */
export function checkBackgroundTask(code: string): CheckResult {
  const config = loadConfig();

  // Check strict patterns first
  const strictResult = checkAgainstEntry(code, config.strict);
  if (strictResult) {
    return strictResult;
  }

  // Then check warn patterns
  const warnResult = checkAgainstEntry(code, config.warn);
  if (warnResult) {
    return warnResult;
  }

  return { allowed: true, action: "allow" };
}

/**
 * Check if code passes the blocklist for dev console.
 * Only strict patterns trigger warnings (no blocking).
 */
export function checkDevConsole(code: string): CheckResult {
  const config = loadConfig();

  // In dev console, strict patterns warn but don't block
  const strictResult = checkAgainstEntry(code, config.strict);
  if (strictResult) {
    return {
      allowed: true,
      action: "warn",
      message: `⚠️ ${strictResult.message}`,
      matchedPattern: strictResult.matchedPattern,
    };
  }

  return { allowed: true, action: "allow" };
}

/**
 * Get current blocklist configuration
 */
export function getBlocklistConfig(): BlocklistConfig {
  return loadConfig();
}

/**
 * Save blocklist configuration
 */
export function saveBlocklistConfig(config: BlocklistConfig): void {
  const { writeFileSync } = await import("fs");
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
```

**Step 4: Write tests**

File: `src/features/blocklist/service.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { checkBackgroundTask, checkDevConsole } from "./service.js";
import { writeFileSync, mkdirSync } from "fs";
import { rm } from "fs/promises";

const TEST_CONFIG_PATH = "./config/blocklist.json";

describe("blocklist service", () => {
  beforeEach(async () => {
    mkdirSync("./config", { recursive: true });
    // Create test config
    const testConfig = {
      strict: {
        patterns: ["rm -rf /", "sudo ", "mkfs\\."],
        action: "block",
        message: "Blocked for safety.",
      },
      warn: {
        patterns: ["pip install"],
        action: "warn",
        message: "May have side effects.",
      },
    };
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
  });

  afterEach(async () => {
    try {
      await rm(TEST_CONFIG_PATH);
    } catch {}
  });

  describe("checkBackgroundTask", () => {
    test("allows safe code", () => {
      const result = checkBackgroundTask("print('hello')");
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("allow");
    });

    test("blocks dangerous commands", () => {
      const result = checkBackgroundTask("rm -rf /");
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("block");
      expect(result.message).toBe("Blocked for safety.");
    });

    test("blocks sudo commands", () => {
      const result = checkBackgroundTask("sudo apt-get update");
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("block");
    });

    test("warns about pip install", () => {
      const result = checkBackgroundTask("pip install requests");
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("warn");
      expect(result.message).toBe("May have side effects.");
    });

    test("is case insensitive", () => {
      const result = checkBackgroundTask("SUDO apt-get update");
      expect(result.allowed).toBe(false);
      expect(result.action).toBe("block");
    });
  });

  describe("checkDevConsole", () => {
    test("allows dangerous commands with warning", () => {
      const result = checkDevConsole("rm -rf /tmp/test");
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("warn");
      expect(result.message).toContain("⚠️");
    });

    test("allows safe code without warning", () => {
      const result = checkDevConsole("print('hello')");
      expect(result.allowed).toBe(true);
      expect(result.action).toBe("allow");
    });
  });
});
```

**Step 5: Integrate with E2B service**

File: `src/worker/e2b.ts` — modify `runInSandbox` function

Add import at top:
```typescript
import { checkBackgroundTask } from "../features/blocklist/service.js";
```

Add check at beginning of `runInSandbox`:
```typescript
export async function runInSandbox(code: string, context: "background" | "dev" = "background"): Promise<SandboxResult> {
  // Check blocklist for background tasks
  if (context === "background") {
    const checkResult = checkBackgroundTask(code);
    if (!checkResult.allowed) {
      return {
        stdout: "",
        stderr: "",
        artifacts: [],
        error: `Blocklist: ${checkResult.message} (matched: ${checkResult.matchedPattern})`,
      };
    }
  }
  // ... rest of function
}
```

**Step 6: Create config UI**

File: `src/dashboard/routes/config.ts` — replace placeholder

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";
import { getBlocklistConfig, saveBlocklistConfig } from "../../features/blocklist/service.js";
import { blocklistConfigSchema } from "../../features/blocklist/validators.js";

const app = new Hono();

app.get("/", (c) => {
  const config = getBlocklistConfig();

  const body = `
    <div class="max-w-4xl mx-auto" x-data="{ saving: false, message: '' }">
      <h2 class="text-3xl font-bold mb-4">⚙️ Configuration</h2>
      <p class="text-gray-600 mb-8">Manage blocklist and system settings.</p>

      <!-- Blocklist Section -->
      <div class="bg-white rounded-lg shadow mb-8">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold">Command Blocklist</h3>
          <p class="text-sm text-gray-500">Patterns are evaluated as regular expressions (case-insensitive)</p>
        </div>
        
        <form hx-post="/admin/config/blocklist" 
              hx-target="#blocklist-message"
              @htmx:before-request="saving = true"
              @htmx:after-request="saving = false; message = 'Saved successfully!'"
              class="p-6 space-y-6">
          
          <!-- Strict Patterns -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Strict Patterns (Block in background tasks)
            </label>
            <textarea name="strictPatterns" rows="4" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm">${config.strict.patterns.join("\n")}</textarea>
            <p class="text-xs text-gray-500 mt-1">One pattern per line. These commands will be blocked in background jobs.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Block Message
            </label>
            <input type="text" name="strictMessage" value="${config.strict.message}"
                   class="w-full px-3 py-2 border border-gray-300 rounded-md">
          </div>

          <!-- Warn Patterns -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Warn Patterns (Allow with warning)
            </label>
            <textarea name="warnPatterns" rows="3" 
                      class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm">${config.warn.patterns.join("\n")}</textarea>
            <p class="text-xs text-gray-500 mt-1">One pattern per line. These commands are allowed but flagged.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Warn Message
            </label>
            <input type="text" name="warnMessage" value="${config.warn.message}"
                   class="w-full px-3 py-2 border border-gray-300 rounded-md">
          </div>

          <!-- Save Button -->
          <div class="flex items-center gap-4">
            <button type="submit" 
                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    :disabled="saving">
              <span x-show="!saving">Save Changes</span>
              <span x-show="saving">Saving...</span>
            </button>
            <span id="blocklist-message" class="text-green-600" x-text="message"></span>
          </div>
        </form>
      </div>

      <!-- Future Settings Placeholders -->
      <div class="bg-gray-50 rounded-lg border border-gray-200 p-6 opacity-60">
        <h3 class="text-lg font-semibold mb-4">Future Settings</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <span>Model Selection</span>
            <span class="text-sm text-gray-500">🔒 Coming soon</span>
          </div>
          <div class="flex items-center justify-between">
            <span>API Key Management</span>
            <span class="text-sm text-gray-500">🔒 Coming soon</span>
          </div>
          <div class="flex items-center justify-between">
            <span>Notification Preferences</span>
            <span class="text-sm text-gray-500">🔒 Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  `;

  return c.html(renderLayout({ title: "Config", activeRoute: "config", body }));
});

app.post("/blocklist", async (c) => {
  const formData = await c.req.formData();
  
  const config = {
    strict: {
      patterns: (formData.get("strictPatterns") as string).split("\n").map(p => p.trim()).filter(Boolean),
      action: "block" as const,
      message: formData.get("strictMessage") as string,
    },
    warn: {
      patterns: (formData.get("warnPatterns") as string).split("\n").map(p => p.trim()).filter(Boolean),
      action: "warn" as const,
      message: formData.get("warnMessage") as string,
    },
  };

  // Validate
  const result = blocklistConfigSchema.safeParse(config);
  if (!result.success) {
    return c.text("Invalid configuration: " + result.error.message, 400);
  }

  await saveBlocklistConfig(result.data);
  return c.text("Saved successfully!");
});

export default app;
```

**Step 7: Run tests**

```bash
bun test src/features/blocklist/service.test.ts
```

Expected: All tests pass

**Step 8: Verify manually**

1. Visit http://localhost:3000/admin/config
2. Should see blocklist configuration form
3. Try saving changes
4. Check that `config/blocklist.json` updates

**Step 9: Commit**

```bash
git add src/features/blocklist/
git add config/
git add src/dashboard/routes/config.ts
git add src/worker/e2b.ts
git commit -m "feat: add command blocklist with dashboard UI"
```

---

## Task 3: Slice 1 — Soul.md

**Purpose:** Give peterbot a configurable personality.

**Files:**
- Create: `soul.md`
- Create: `src/features/soul/service.ts`
- Create: `src/features/soul/service.test.ts`
- Modify: `src/worker/worker.ts` (integrate soul loading)
- Modify: `src/dashboard/routes/soul.ts` (add UI)

**Step 1: Create default soul.md**

File: `soul.md`

```markdown
# Peterbot Soul

## Personality
Professional but approachable. Efficient yet warm. Like a capable colleague 
who's genuinely helpful.

## Communication Style
- Be concise but thorough
- Use bullet points for complex information
- Ask clarifying questions when tasks are ambiguous
- Celebrate successes, acknowledge failures directly

## Tone Guidelines
- Professional without being stiff
- Friendly without being overly casual
- Confident but not arrogant
- Helpful and patient

## Values
- Accuracy over speed
- Transparency about limitations
- Respect for user's time
- Continuous improvement
```

**Step 2: Create soul service**

File: `src/features/soul/service.ts`

```typescript
import { readFileSync, existsSync } from "fs";

const SOUL_PATH = "./soul.md";

/**
 * Load the soul.md content.
 * Returns default if file doesn't exist.
 */
export function loadSoul(): string {
  if (!existsSync(SOUL_PATH)) {
    return getDefaultSoul();
  }
  
  try {
    return readFileSync(SOUL_PATH, "utf-8");
  } catch {
    return getDefaultSoul();
  }
}

/**
 * Save soul.md content.
 */
export function saveSoul(content: string): void {
  const { writeFileSync } = await import("fs");
  writeFileSync(SOUL_PATH, content);
}

function getDefaultSoul(): string {
  return `# Peterbot Soul

## Personality
Professional but approachable. Efficient yet warm.

## Communication Style
- Be concise but thorough
- Use bullet points for complex information
`;
}

/**
 * Build the complete system prompt including soul.
 */
export function buildSystemPrompt(): string {
  const soul = loadSoul();
  const today = new Date().toDateString();

  return `${soul}

## Capabilities
You are peterbot, a helpful AI assistant integrated with Telegram.

Your capabilities include:
- Answering questions and explaining concepts
- Writing and analyzing code
- Performing data analysis and calculations
- Creating visualizations and charts
- Web scraping and API interactions
- File processing and generation

When given computational tasks (data analysis, calculations, file creation, etc.),
use the runCode tool to execute Python code in a secure sandbox environment.

Current date: ${today}

Format your responses using Markdown for better readability when appropriate.`;
}
```

**Step 3: Write tests**

File: `src/features/soul/service.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadSoul, saveSoul, buildSystemPrompt } from "./service.js";
import { writeFileSync, rm } from "fs/promises";

const TEST_SOUL_PATH = "./soul.md";

describe("soul service", () => {
  afterEach(async () => {
    try {
      await rm(TEST_SOUL_PATH);
    } catch {}
  });

  test("returns default soul when file missing", () => {
    const soul = loadSoul();
    expect(soul).toContain("Peterbot Soul");
    expect(soul).toContain("Professional but approachable");
  });

  test("loads custom soul from file", async () => {
    const customSoul = "# Custom Soul\\n\\nI am a test bot.";
    await writeFileSync(TEST_SOUL_PATH, customSoul);
    
    const soul = loadSoul();
    expect(soul).toBe(customSoul);
  });

  test("saves soul to file", async () => {
    const content = "# Test Soul\\n\\nTest content.";
    await saveSoul(content);
    
    const loaded = loadSoul();
    expect(loaded).toBe(content);
  });

  test("buildSystemPrompt includes soul and capabilities", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Peterbot Soul");
    expect(prompt).toContain("Capabilities");
    expect(prompt).toContain("Current date:");
  });
});
```

**Step 4: Integrate with worker**

File: `src/worker/worker.ts` — modify `buildSystemPrompt` function

Replace the existing `buildSystemPrompt` function with import:

```typescript
import { buildSystemPrompt } from "../features/soul/service.js";
```

And remove the local `buildSystemPrompt` function definition.

**Step 5: Create soul UI**

File: `src/dashboard/routes/soul.ts` — replace placeholder

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";
import { loadSoul, saveSoul } from "../../features/soul/service.js";

const app = new Hono();

app.get("/", (c) => {
  const soulContent = loadSoul();

  const body = `
    <div class="max-w-4xl mx-auto" x-data="{ saving: false, preview: false }">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-3xl font-bold">🎭 Soul</h2>
          <p class="text-gray-600">Configure peterbot's personality and communication style.</p>
        </div>
        <button @click="preview = !preview" 
                class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                x-text="preview ? 'Edit' : 'Preview'">
          Preview
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Editor -->
        <div x-show="!preview" x-transition>
          <form hx-post="/admin/soul/save"
                hx-target="#save-message"
                @htmx:before-request="saving = true"
                @htmx:after-request="saving = false"
                class="bg-white rounded-lg shadow">
            <div class="p-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                soul.md
              </label>
              <textarea name="content" rows="20" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm">${soulContent.replace(/</g, "&lt;")}</textarea>
              <p class="text-xs text-gray-500 mt-2">
                Changes take effect immediately for the next job.
              </p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex items-center gap-4">
              <button type="submit" 
                      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      :disabled="saving">
                <span x-show="!saving">Save Changes</span>
                <span x-show="saving">Saving...</span>
              </button>
              <span id="save-message" class="text-green-600"></span>
            </div>
          </form>
        </div>

        <!-- Preview -->
        <div x-show="preview" x-transition class="bg-white rounded-lg shadow p-6">
          <h3 class="text-lg font-semibold mb-4">Live Preview</h3>
          <div class="prose prose-sm max-w-none">
            <pre class="whitespace-pre-wrap font-sans text-gray-800">${soulContent.replace(/</g, "&lt;")}</pre>
          </div>
        </div>

        <!-- Help Panel -->
        <div class="bg-blue-50 rounded-lg p-6">
          <h3 class="text-lg font-semibold mb-4">💡 Tips</h3>
          <ul class="space-y-2 text-sm text-blue-800">
            <li>• Use Markdown headers for sections</li>
            <li>• Keep paragraphs short and focused</li>
            <li>• Be specific about tone (e.g., "professional but warm")</li>
            <li>• Include examples of desired communication style</li>
            <li>• The soul is prepended to every AI prompt</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  return c.html(renderLayout({ title: "Soul", activeRoute: "soul", body }));
});

app.post("/save", async (c) => {
  const formData = await c.req.formData();
  const content = formData.get("content") as string;
  
  await saveSoul(content);
  return c.text("Saved! Changes take effect on next job.");
});

export default app;
```

**Step 6: Run tests**

```bash
bun test src/features/soul/service.test.ts
```

**Step 7: Verify manually**

1. Visit http://localhost:3000/admin/soul
2. Should see soul.md editor with default content
3. Edit and save
4. Verify `soul.md` file updates

**Step 8: Commit**

```bash
git add soul.md
git add src/features/soul/
git add src/dashboard/routes/soul.ts
git add src/worker/worker.ts
git commit -m "feat: add Soul.md personality configuration"
```

---

## Task 4: Slice 3 — Two-Layer Memory

**Purpose:** Stop peterbot from forgetting who you are.

**Files:**
- Create: `memory.md`
- Create: `src/features/memory/service.ts`
- Create: `src/features/memory/service.test.ts`
- Modify: `src/worker/worker.ts` (integrate memory loading)
- Modify: `src/dashboard/routes/memory.ts` (add UI)
- Modify: `src/features/jobs/repository.ts` (add search function)

**Step 1: Create default memory.md**

File: `memory.md`

```markdown
# Memory

## About Me
<!-- Add facts peterbot should remember about you -->

## Context
<!-- Add context about current projects, preferences, etc. -->

## Preferences
<!-- Add communication preferences, workflow details, etc. -->
```

**Step 2: Create memory service**

File: `src/features/memory/service.ts`

```typescript
import { readFileSync, existsSync } from "fs";
import { db } from "../../db/index.js";
import { jobs } from "../../features/jobs/schema.js";
import { eq, desc, sql } from "drizzle-orm";

const MEMORY_PATH = "./memory.md";

/**
 * Layer 1: Permanent facts from memory.md
 */
export function loadMemory(): string {
  if (!existsSync(MEMORY_PATH)) {
    return getDefaultMemory();
  }
  
  try {
    return readFileSync(MEMORY_PATH, "utf-8");
  } catch {
    return getDefaultMemory();
  }
}

export function saveMemory(content: string): void {
  const { writeFileSync } = await import("fs");
  writeFileSync(MEMORY_PATH, content);
}

function getDefaultMemory(): string {
  return `# Memory

## About Me

## Context

## Preferences
`;
}

/**
 * Layer 2: Recent job history from database
 */
export interface HistoryEntry {
  id: string;
  input: string;
  output: string | null;
  status: string;
  createdAt: Date;
}

export async function getJobHistory(options: {
  limit?: number;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
} = {}): Promise<HistoryEntry[]> {
  const { limit = 20, search, dateFrom, dateTo } = options;

  let query = db
    .select({
      id: jobs.id,
      input: jobs.input,
      output: jobs.output,
      status: jobs.status,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);

  // Apply date filters if provided
  if (dateFrom || dateTo) {
    query = query.where(sql`1=1`); // placeholder, refine with actual conditions
  }

  const results = await query;

  // Filter by search term in memory (case-insensitive)
  if (search) {
    const lowerSearch = search.toLowerCase();
    return results.filter(
      (job) =>
        job.input.toLowerCase().includes(lowerSearch) ||
        (job.output?.toLowerCase().includes(lowerSearch) ?? false)
    );
  }

  return results;
}

/**
 * Build memory context for AI prompt.
 * Combines Layer 1 (permanent) + Layer 2 (recent history summary).
 */
export async function buildMemoryContext(): Promise<string> {
  const permanentMemory = loadMemory();
  const recentJobs = await getJobHistory({ limit: 5 });

  const historySummary =
    recentJobs.length > 0
      ? `\\n## Recent Activity\\n` +
        recentJobs
          .map(
            (job) =>
              `- [${job.status}] ${job.input.slice(0, 100)}${
                job.input.length > 100 ? "..." : ""
              }`
          )
          .join("\\n")
      : "";

  return `## Memory Context\\n${permanentMemory}${historySummary}`;
}
```

**Step 3: Write tests**

File: `src/features/memory/service.test.ts`

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadMemory, saveMemory, getJobHistory, buildMemoryContext } from "./service.js";
import { writeFileSync, rm } from "fs/promises";
import { db } from "../../db/index.js";
import { jobs } from "../../features/jobs/schema.js";

const TEST_MEMORY_PATH = "./memory.md";

describe("memory service", () => {
  afterEach(async () => {
    try {
      await rm(TEST_MEMORY_PATH);
    } catch {}
  });

  test("returns default memory when file missing", () => {
    const memory = loadMemory();
    expect(memory).toContain("# Memory");
    expect(memory).toContain("About Me");
  });

  test("loads custom memory from file", async () => {
    const customMemory = "# My Memory\\n\\nI work at Acme Inc.";
    await writeFileSync(TEST_MEMORY_PATH, customMemory);
    
    const memory = loadMemory();
    expect(memory).toBe(customMemory);
  });

  test("saves memory to file", async () => {
    const content = "# Test Memory\\n\\nTest content.";
    await saveMemory(content);
    
    const loaded = loadMemory();
    expect(loaded).toBe(content);
  });
});
```

**Step 4: Integrate with worker**

File: `src/worker/worker.ts` — modify system prompt building

Add import:
```typescript
import { buildMemoryContext } from "../features/memory/service.js";
```

Modify the prompt building in `processJob` to include memory context.

**Step 5: Create memory UI**

File: `src/dashboard/routes/memory.ts` — replace placeholder

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";
import { loadMemory, saveMemory, getJobHistory } from "../../features/memory/service.js";

const app = new Hono();

app.get("/", async (c) => {
  const memoryContent = loadMemory();
  const history = await getJobHistory({ limit: 10 });

  const historyHtml = history
    .map(
      (job) => `
    <div class="border-b border-gray-200 py-4 last:border-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs px-2 py-1 rounded ${getStatusClass(job.status)}">${job.status}</span>
        <span class="text-xs text-gray-500">${job.createdAt.toLocaleString()}</span>
        <span class="text-xs font-mono text-gray-400">${job.id.slice(0, 8)}</span>
      </div>
      <p class="text-sm text-gray-800">${job.input.slice(0, 150)}${job.input.length > 150 ? "..." : ""}</p>
    </div>
  `
    )
    .join("");

  const body = `
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold mb-4">🧠 Memory</h2>
      <p class="text-gray-600 mb-8">Manage what peterbot remembers about you.</p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Layer 1: Permanent Memory -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Layer 1: Permanent Facts</h3>
          <form hx-post="/admin/memory/save"
                hx-target="#memory-save-message"
                class="bg-white rounded-lg shadow">
            <div class="p-6">
              <label class="block text-sm font-medium text-gray-700 mb-2">
                memory.md
              </label>
              <textarea name="content" rows="16" 
                        class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm">${memoryContent.replace(/</g, "&lt;")}</textarea>
              <p class="text-xs text-gray-500 mt-2">
                Permanent facts peterbot should always remember. Loaded for every job.
              </p>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 flex items-center gap-4">
              <button type="submit" 
                      class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                Save Memory
              </button>
              <span id="memory-save-message" class="text-green-600"></span>
            </div>
          </form>

          <div class="mt-6 bg-blue-50 rounded-lg p-4">
            <h4 class="font-medium text-blue-900 mb-2">💡 What to include</h4>
            <ul class="text-sm text-blue-800 space-y-1">
              <li>• Your company, role, team</li>
              <li>• Current projects and priorities</li>
              <li>• Communication preferences</li>
              <li>• Technical stack expertise</li>
            </ul>
          </div>
        </div>

        <!-- Layer 2: History -->
        <div>
          <h3 class="text-lg font-semibold mb-4">Layer 2: Conversation History</h3>
          
          <!-- Search -->
          <form hx-get="/admin/memory/search"
                hx-target="#history-list"
                class="mb-4 flex gap-2">
            <input type="text" name="q" placeholder="Search history..."
                   class="flex-1 px-3 py-2 border border-gray-300 rounded-md">
            <button type="submit" 
                    class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
              Search
            </button>
          </form>

          <!-- History List -->
          <div id="history-list" class="bg-white rounded-lg shadow max-h-96 overflow-auto">
            ${history.length > 0 ? historyHtml : '<p class="p-4 text-gray-500">No history yet.</p>'}
          </div>

          <div class="mt-4 text-sm text-gray-500">
            <p>Showing last ${history.length} jobs. Use search to find older entries.</p>
            <p class="mt-1">🔮 Ejection: Semantic search coming in future slices.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  return c.html(renderLayout({ title: "Memory", activeRoute: "memory", body }));
});

app.post("/save", async (c) => {
  const formData = await c.req.formData();
  const content = formData.get("content") as string;
  
  await saveMemory(content);
  return c.text("Saved!");
});

app.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  const history = await getJobHistory({ limit: 20, search: query });

  const html = history
    .map(
      (job) => `
    <div class="border-b border-gray-200 py-4 last:border-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs px-2 py-1 rounded ${getStatusClass(job.status)}">${job.status}</span>
        <span class="text-xs text-gray-500">${job.createdAt.toLocaleString()}</span>
      </div>
      <p class="text-sm text-gray-800">${job.input.slice(0, 150)}${job.input.length > 150 ? "..." : ""}</p>
    </div>
  `
    )
    .join("");

  return c.html(html || '<p class="p-4 text-gray-500">No results found.</p>');
});

function getStatusClass(status: string): string {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "running":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export default app;
```

**Step 6: Run tests**

```bash
bun test src/features/memory/service.test.ts
```

**Step 7: Verify manually**

1. Visit http://localhost:3000/admin/memory
2. Should see memory.md editor and history panel
3. Edit memory, save, verify file updates
4. Test search functionality

**Step 8: Commit**

```bash
git add memory.md
git add src/features/memory/
git add src/dashboard/routes/memory.ts
git commit -m "feat: add two-layer memory system"
```

---

## Task 5: Slice 2 — Real-Time Monitor

**Purpose:** Monitor jobs in real-time with live logs and controls.

**Files:**
- Create: `src/dashboard/routes/monitor.ts` (full implementation)
- Modify: `src/features/jobs/repository.ts` (add recent jobs query)

**Step 1: Add repository function**

File: `src/features/jobs/repository.ts` — add function

```typescript
export async function getRecentJobs(limit: number = 10): Promise<Job[]> {
  return db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}
```

**Step 2: Create monitor UI with HTMX polling**

File: `src/dashboard/routes/monitor.ts` — replace placeholder

```typescript
import { Hono } from "hono";
import { renderLayout } from "../layout.js";
import { getRecentJobs, getPendingJobs, markJobFailed } from "../../features/jobs/repository.js";
import type { Job } from "../../features/jobs/schema.js";

const app = new Hono();

// Main page
app.get("/", async (c) => {
  const body = `
    <div class="max-w-6xl mx-auto" 
         x-data="{ autoRefresh: true }"
         @visibilitychange.window="autoRefresh = document.visibilityState === 'visible'">
      
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-3xl font-bold">📺 Monitor</h2>
          <p class="text-gray-600">Real-time job monitoring and live logs.</p>
        </div>
        <div class="flex items-center gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" x-model="autoRefresh" class="rounded">
            <span class="text-sm text-gray-600">Auto-refresh (15s)</span>
          </label>
          <button hx-get="/admin/monitor/jobs"
                  hx-target="#jobs-container"
                  class="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
            🔄 Refresh Now
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div hx-get="/admin/monitor/stats"
           hx-trigger="load, every 15s [document.visibilityState === 'visible']"
           class="mb-6">
        <div class="animate-pulse bg-gray-200 h-16 rounded-lg"></div>
      </div>

      <!-- Jobs List -->
      <div id="jobs-container"
           hx-get="/admin/monitor/jobs"
           hx-trigger="load"
           class="space-y-4">
        <div class="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
      </div>
    </div>
  `;

  return c.html(renderLayout({ title: "Monitor", activeRoute: "monitor", body }));
});

// Stats endpoint (for HTMX polling)
app.get("/stats", async (c) => {
  const pending = await getPendingJobs();
  const running = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "running"));
  const completed = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "completed"));
  const failed = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "failed"));

  return c.html(`
    <div class="grid grid-cols-4 gap-4">
      <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
        <div class="text-2xl font-bold text-yellow-600">${pending.length}</div>
        <div class="text-sm text-yellow-800">Pending</div>
      </div>
      <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
        <div class="text-2xl font-bold text-blue-600">${running[0]?.count || 0}</div>
        <div class="text-sm text-blue-800">Running</div>
      </div>
      <div class="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
        <div class="text-2xl font-bold text-green-600">${completed[0]?.count || 0}</div>
        <div class="text-sm text-green-800">Completed</div>
      </div>
      <div class="bg-red-50 border border-red-200 p-4 rounded-lg text-center">
        <div class="text-2xl font-bold text-red-600">${failed[0]?.count || 0}</div>
        <div class="text-sm text-red-800">Failed</div>
      </div>
    </div>
  `);
});

// Jobs list endpoint (for HTMX)
app.get("/jobs", async (c) => {
  const recentJobs = await getRecentJobs(10);

  if (recentJobs.length === 0) {
    return c.html(`
      <div class="bg-white rounded-lg shadow p-8 text-center">
        <p class="text-gray-500">No jobs yet. Send a message to your bot to get started!</p>
      </div>
    `);
  }

  const jobsHtml = recentJobs.map(renderJobCard).join("");

  return c.html(`
    <div class="space-y-4">
      ${jobsHtml}
    </div>
  `);
});

// Cancel job endpoint
app.post("/jobs/:id/cancel", async (c) => {
  const id = c.req.param("id");
  await markJobFailed(id, "Cancelled by user from dashboard");
  return c.html(`<span class="text-red-600">Cancelled</span>`);
});

function renderJobCard(job: Job): string {
  const statusColors: Record<string, string> = {
    pending: "border-yellow-300 bg-yellow-50",
    running: "border-blue-300 bg-blue-50",
    completed: "border-green-300 bg-green-50",
    failed: "border-red-300 bg-red-50",
  };

  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    running: "🔄",
    completed: "✅",
    failed: "❌",
  };

  const shortId = job.id.slice(0, 8);
  const timeAgo = getTimeAgo(job.createdAt);

  return `
    <div class="border ${statusColors[job.status] || "border-gray-300"} rounded-lg p-4">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-lg">${statusEmoji[job.status]}</span>
            <span class="font-mono text-sm text-gray-600">[${shortId}]</span>
            <span class="text-sm text-gray-500">${timeAgo}</span>
            ${job.status === "running" ? '<span class="text-xs text-blue-600 animate-pulse">● live</span>' : ""}
          </div>
          <p class="text-gray-800">${job.input.slice(0, 200)}${job.input.length > 200 ? "..." : ""}</p>
          
          ${job.output ? `
            <div class="mt-3 p-3 bg-white/50 rounded text-sm text-gray-600">
              <strong>Output:</strong>
              <pre class="mt-1 whitespace-pre-wrap">${job.output.slice(0, 300).replace(/</g, "&lt;")}${job.output.length > 300 ? "..." : ""}</pre>
            </div>
          ` : ""}
        </div>
        
        ${job.status === "running" ? `
          <button hx-post="/admin/monitor/jobs/${job.id}/cancel"
                  hx-confirm="Cancel this job?"
                  hx-swap="outerHTML"
                  class="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors">
            Cancel
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default app;
```

**Step 3: Verify manually**

1. Visit http://localhost:3000/admin/monitor
2. Should see stats cards and job list
3. Stats should auto-refresh every 15s
4. Try cancelling a running job
5. Verify auto-refresh pauses when tab hidden

**Step 4: Commit**

```bash
git add src/dashboard/routes/monitor.ts
git commit -m "feat: add real-time job monitor with auto-refresh"
```

---

## Task 6: Final Verification & Cleanup

**Step 1: Run all tests**

```bash
bun test
```

Expected: All tests pass

**Step 2: Verify dashboard navigation**

Visit each route and verify:
- http://localhost:3000/admin — Overview with stats
- http://localhost:3000/admin/soul — Soul.md editor
- http://localhost:3000/admin/memory — Memory editor + history
- http://localhost:3000/admin/monitor — Live job monitor
- http://localhost:3000/admin/config — Blocklist configuration

**Step 3: Test end-to-end flow**

1. Edit `soul.md` via dashboard
2. Send message to bot via Telegram
3. Verify personality change in response
4. Check job appears in monitor
5. Verify blocklist blocks dangerous commands

**Step 4: Update package.json scripts (if needed)**

File: `package.json` — ensure scripts exist:

```json
{
  "scripts": {
    "dev": "bun run src/core/server.ts",
    "worker": "bun run src/worker/worker.ts",
    "start": "bun run src/core/server.ts",
    "test": "bun test",
    "db:push": "bunx drizzle-kit push",
    "db:studio": "bunx drizzle-kit studio"
  }
}
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete Phase 1 - Personal & Safe dashboard"
```

---

## Success Checklist

- [ ] Dashboard loads at `/admin` with navigation
- [ ] Overview shows job stats
- [ ] Soul.md editor saves and loads
- [ ] Memory shows editor + history search
- [ ] Monitor auto-refreshes every 15s
- [ ] Blocklist configuration saves/loads
- [ ] Blocklist prevents dangerous commands in background jobs
- [ ] All tests pass
- [ ] Manual end-to-end test works
