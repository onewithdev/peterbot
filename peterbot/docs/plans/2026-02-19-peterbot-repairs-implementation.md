# Peterbot Repairs Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs (soul.md reset, Telegram buttons) and restructure UI (Settings/Jobs tabs, Chat reorder, Documents upload)

**Architecture:** Thin vertical slices - each task delivers working, tested code. Start with foundation (file utilities), then user-visible fixes (buttons, navigation), then UI restructuring, finally new features (upload, Drive folders).

**Tech Stack:** TypeScript, React, Hono, Grammy, SQLite, Google Drive API, Vitest/Bun test

---

## Prerequisites

Before starting:
1. Ensure you're in a dedicated worktree: `git worktree list`
2. Run tests to establish baseline: `bun test` (should pass)
3. Start dev servers: Terminal 1: `bun run dev`, Terminal 2: `bun run web:dev`

---

## Phase 1: Foundation - File Utilities Protection

### Task 1: Add Config File Backup and Validation

**Context:** `soul.md` is being reset to "test". We need to add protection at the file utility level.

**Files:**
- Modify: `src/core/dashboard/files.ts`
- Test: `src/core/dashboard/files.test.ts`

**Step 1: Write failing test for suspicious content validation**

```typescript
// In files.test.ts, add new describe block
describe("writeConfigFile validation", () => {
  test("rejects content that is just 'test'", async () => {
    await expect(writeConfigFileSafe("soul", "test")).rejects.toThrow("Suspicious content");
  });
  
  test("rejects content that is too short (< 10 chars)", async () => {
    await expect(writeConfigFileSafe("soul", "hi")).rejects.toThrow("too short");
  });
  
  test("accepts valid content", async () => {
    const testDir = join(process.cwd(), "test-config-validation");
    await mkdir(testDir, { recursive: true });
    _setTestProjectRoot(testDir);
    
    const content = "# Valid Soul Content\n\nThis is a personality.";
    await writeConfigFileSafe("soul", content);
    
    const read = await readConfigFile("soul");
    expect(read).toBe(content);
    
    _setTestProjectRoot(null);
    await rm(testDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/dashboard/files.test.ts -t "writeConfigFile validation"
```
Expected: FAIL - "writeConfigFileSafe is not defined"

**Step 3: Implement writeConfigFileSafe with validation**

```typescript
// In files.ts, after writeConfigFile function

/**
 * Suspicious content patterns that might indicate accidental writes.
 */
const SUSPICIOUS_PATTERNS = [
  /^test$/i,           // Just the word "test"
  /^hello$/i,          // Just "hello"
  /^temp$/i,           // Just "temp"
  /.{0,9}$/,           // Less than 10 chars (caught separately)
];

/**
 * Validate content before writing to prevent accidental overwrites.
 */
function validateConfigContent(type: ConfigFileType, content: string): void {
  // Check for suspiciously short content
  if (content.trim().length < 10) {
    throw new FileOperationError(
      `Suspicious content for ${type}: content too short (${content.trim().length} chars). ` +
      `This might be an accidental write. Content: "${content.trim()}"`,
      CONFIG_PATHS[type],
      "write"
    );
  }
  
  // Check for exact suspicious patterns
  const trimmed = content.trim();
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(trimmed) && pattern.source.startsWith("^"))) {
    throw new FileOperationError(
      `Suspicious content for ${type}: content matches pattern "${trimmed}". ` +
      `This might be an accidental write.`,
      CONFIG_PATHS[type],
      "write"
    );
  }
}

/**
 * Write config file with validation and optional backup.
 */
export async function writeConfigFileSafe(
  type: ConfigFileType,
  content: string,
  options: { validate?: boolean } = { validate: true }
): Promise<void> {
  if (options.validate) {
    validateConfigContent(type, content);
  }
  await writeConfigFile(type, content);
}
```

**Step 4: Run test to verify it passes**

```bash
bun test src/core/dashboard/files.test.ts -t "writeConfigFile validation"
```
Expected: PASS

**Step 5: Update routes.ts to use safe writes**

```typescript
// In src/core/dashboard/routes.ts
// Change line 256: await writeConfigFile("soul", content);
// To: await writeConfigFileSafe("soul", content);

// Change line 305: await writeConfigFile("memory", content);
// To: await writeConfigFileSafe("memory", content);
```

**Step 6: Run all dashboard tests**

```bash
bun test src/core/dashboard/
```
Expected: All PASS

**Step 7: Commit**

```bash
git add src/core/dashboard/files.ts src/core/dashboard/files.test.ts src/core/dashboard/routes.ts
git commit -m "feat: add config file validation to prevent accidental overwrites

- Add writeConfigFileSafe() with content validation
- Reject suspiciously short content (< 10 chars)
- Reject exact matches of 'test', 'hello', 'temp'
- Update soul and memory endpoints to use safe writes
- Protects against soul.md reset bug"
```

---

## Phase 2: User-Visible Fixes

### Task 2: Fix Telegram Inline Keyboard Layout

**Context:** Buttons are stacking vertically instead of horizontally. The InlineKeyboard needs explicit row management.

**Files:**
- Modify: `src/core/telegram/buttons.ts`
- Test: `src/core/telegram/buttons.test.ts`

**Step 1: Write failing test for horizontal layout**

```typescript
// In buttons.test.ts, update existing test

test("creates InlineKeyboard with buttons in single row", () => {
  const buttons = [
    { label: "Button 1", callbackData: "action1" },
    { label: "Button 2", callbackData: "action2" },
    { label: "Button 3", callbackData: "action3" },
  ];

  const keyboard = buildInlineKeyboard(buttons);

  // Should be 1 row with 3 buttons, not 3 rows
  expect(keyboard.inline_keyboard).toHaveLength(1);
  expect(keyboard.inline_keyboard[0]).toHaveLength(3);
  expect(keyboard.inline_keyboard[0][0].text).toBe("Button 1");
  expect(keyboard.inline_keyboard[0][1].text).toBe("Button 2");
  expect(keyboard.inline_keyboard[0][2].text).toBe("Button 3");
});
```

**Step 2: Run test to verify it fails**

```bash
bun test src/core/telegram/buttons.test.ts -t "creates InlineKeyboard with buttons in single row"
```
Expected: FAIL - Currently creates multiple rows

**Step 3: Fix buildInlineKeyboard to use single row**

```typescript
// In buttons.ts, replace buildInlineKeyboard function

/**
 * Build an InlineKeyboard from button configurations.
 * Places all buttons in a single horizontal row.
 *
 * @param buttons - Array of button configurations
 * @returns Grammy InlineKeyboard instance
 */
export function buildInlineKeyboard(buttons: ButtonConfig[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  
  // Add all buttons to a single row for horizontal layout
  for (const button of buttons) {
    keyboard.text(button.label, button.callbackData);
  }
  
  return keyboard;
}
```

Wait - that's the current implementation. Let me check the Grammy API...

Actually, looking at Grammy docs, `keyboard.text()` adds to current row. The issue might be that we need to call `keyboard.row()` to start a new row. Without calling row(), they should be in the same row.

Let me check if there's an issue with how the keyboard is being sent in the worker:

**Step 3: Check worker delivery**

```typescript
// In worker.ts, verify the keyboard is being sent correctly
// Line 311-314 should be:

await bot.api.sendMessage(job.chatId, fullMessage, {
  reply_markup: keyboard,
});
```

The code looks correct. The issue might be Telegram client rendering. Let me add explicit row handling:

**Step 4: Update buildInlineKeyboard with explicit row handling**

```typescript
// In buttons.ts

export function buildInlineKeyboard(buttons: ButtonConfig[]): InlineKeyboard {
  // Use the static method to create with inline_keyboard property
  const inlineKeyboard = buttons.map(button => ({
    text: button.label,
    callback_data: button.callbackData,
  }));
  
  // Create keyboard with all buttons in first row
  return new InlineKeyboard([inlineKeyboard]);
}
```

**Step 5: Run test to verify layout**

```bash
bun test src/core/telegram/buttons.test.ts -t "creates InlineKeyboard with buttons in single row"
```
Expected: PASS

**Step 6: Run all button tests**

```bash
bun test src/core/telegram/buttons.test.ts
```
Expected: All PASS

**Step 7: Commit**

```bash
git add src/core/telegram/buttons.ts src/core/telegram/buttons.test.ts
git commit -m "fix: telegram inline keyboard horizontal layout

- Build InlineKeyboard with explicit array structure
- Ensures all buttons appear in single horizontal row
- Fixes: [📅 Schedule] [💾 Save] [❔ Help] instead of stacked"
```

---

### Task 3: Move Chat to Top of Navigation

**Context:** Simple UI change - reorder sidebar navigation items.

**Files:**
- Modify: `web/src/components/sidebar.tsx`

**Step 1: Update navItems order**

```typescript
// In sidebar.tsx, change navItems array

const navItems: NavItem[] = [
  { label: "Chat", path: "/chat", icon: MessageSquare },  // MOVED TO TOP
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Soul", path: "/soul", icon: Sparkles },
  { label: "Memory", path: "/memory", icon: Brain },
  { label: "Monitor", path: "/monitor", icon: Activity },
  // ... rest unchanged
];
```

**Step 2: Verify in browser**

1. Open http://localhost:5173
2. Login
3. Check sidebar - Chat should be first item

**Step 3: Commit**

```bash
git add web/src/components/sidebar.tsx
git commit -m "ui: move Chat to top of navigation sidebar"
```

---

## Phase 3: UI Restructuring

### Task 4: Create Settings Page with Tabs

**Context:** Consolidate Config, Soul, Memory into tabbed Settings page.

**Files:**
- Create: `web/src/routes/settings.tsx`
- Create: `web/src/components/settings/`
- Delete: `web/src/routes/soul.tsx` (content moves to tab)
- Delete: `web/src/routes/memory.tsx` (content moves to tab)
- Modify: `web/src/components/sidebar.tsx` (update links)

**Step 1: Create SettingsOverviewTab component**

```typescript
// Create: web/src/components/settings/overview-tab.tsx

import { Activity, GitBranch, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OverviewTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-muted-foreground">System health and status</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Online</div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Version</CardTitle>
            <GitBranch className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1.0.0</div>
            <p className="text-xs text-muted-foreground">Latest stable</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">SQLite</div>
            <p className="text-xs text-muted-foreground">Local storage active</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

**Step 2: Create SettingsSoulTab component**

```typescript
// Create: web/src/components/settings/soul-tab.tsx

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface SoulData {
  content: string;
  lastModified: string | null;
  size: number;
}

export function SoulTab() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery<SoulData>({
    queryKey: ["soul"],
    queryFn: async () => {
      const response = await api.soul.$get();
      return response.json();
    },
  });

  useEffect(() => {
    if (data && !isDirty) {
      setContent(data.content);
    }
  }, [data, isDirty]);

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const response = await api.soul.$put({ json: { content: newContent } });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["soul"] });
      setIsDirty(false);
      toast.success("Soul configuration saved");
    },
    onError: () => {
      toast.error("Failed to save soul configuration");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  const handleReset = () => {
    if (data) {
      setContent(data.content);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Soul
          </h2>
          <p className="text-muted-foreground">
            Edit the bot's personality and behavior
          </p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isDirty || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Define the bot's personality here..."
          />
          {data?.lastModified && (
            <p className="text-xs text-muted-foreground mt-2">
              Last modified: {new Date(data.lastModified).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Create SettingsMemoryTab component**

```typescript
// Create: web/src/components/settings/memory-tab.tsx

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Save, Brain, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface MemoryData {
  content: string;
  lastModified: string | null;
  size: number;
}

export function MemoryTab() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data, isLoading } = useQuery<MemoryData>({
    queryKey: ["memory"],
    queryFn: async () => {
      const response = await api.memory.$get();
      return response.json();
    },
  });

  useEffect(() => {
    if (data && !isDirty) {
      setContent(data.content);
    }
  }, [data, isDirty]);

  const saveMutation = useMutation({
    mutationFn: async (newContent: string) => {
      const response = await api.memory.$put({ json: { content: newContent } });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memory"] });
      setIsDirty(false);
      toast.success("Memory saved");
    },
    onError: () => {
      toast.error("Failed to save memory");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(content);
  };

  const handleReset = () => {
    if (data) {
      setContent(data.content);
      setIsDirty(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Memory
          </h2>
          <p className="text-muted-foreground">
            Permanent facts and context about you
          </p>
        </div>
        <div className="flex gap-2">
          {isDirty && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!isDirty || saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Add facts about yourself here..."
          />
          {data?.lastModified && (
            <p className="text-xs text-muted-foreground mt-2">
              Last modified: {new Date(data.lastModified).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 4: Create SettingsBlocklistTab component**

```typescript
// Create: web/src/components/settings/blocklist-tab.tsx

// Copy content from existing config.tsx, adapt to tab format
// Export as BlocklistTab
```

**Step 5: Create main Settings page**

```typescript
// Create: web/src/routes/settings.tsx

import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Sparkles, Brain, Shield } from "lucide-react";
import { OverviewTab } from "@/components/settings/overview-tab";
import { SoulTab } from "@/components/settings/soul-tab";
import { MemoryTab } from "@/components/settings/memory-tab";
import { BlocklistTab } from "@/components/settings/blocklist-tab";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "soul", label: "Soul", icon: Sparkles },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "blocklist", label: "Blocklist", icon: Shield },
];

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure peterbot behavior and personality
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="soul" className="space-y-4">
          <SoulTab />
        </TabsContent>

        <TabsContent value="memory" className="space-y-4">
          <MemoryTab />
        </TabsContent>

        <TabsContent value="blocklist" className="space-y-4">
          <BlocklistTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 6: Update sidebar navigation**

```typescript
// In sidebar.tsx, replace Soul, Memory, Config with Settings

const navItems: NavItem[] = [
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Overview", path: "/", icon: LayoutDashboard },
  // REMOVE: Soul, Memory, Config
  // ADD: Settings
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "Monitor", path: "/monitor", icon: Activity },
  // ... rest
];
```

**Step 7: Update route tree**

```typescript
// In web/src/routeTree.gen.ts (auto-generated)
// Add import for settings route
// Or run: cd web && bun run dev (regenerates routes)
```

**Step 8: Add redirects for old routes**

```typescript
// Create: web/src/routes/soul.tsx (redirect only)

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/soul")({
  component: () => <Navigate to="/settings" search={{ tab: "soul" }} />,
});

// Similarly for memory.tsx and config.tsx
```

**Step 9: Run tests**

```bash
cd web && bun run build
```
Expected: Build succeeds

**Step 10: Verify in browser**

1. Navigate to /settings
2. Check all 4 tabs work
3. Verify old /soul redirects to /settings
4. Verify sidebar shows "Settings" not "Config"

**Step 11: Commit**

```bash
git add web/src/routes/settings.tsx web/src/components/settings/ web/src/components/sidebar.tsx
git commit -m "feat: consolidate Config, Soul, Memory into tabbed Settings page

- Create Settings page with 4 tabs: Overview, Soul, Memory, Blocklist
- Extract Soul and Memory into reusable tab components
- Add redirects from /soul, /memory, /config to /settings
- Update sidebar navigation"
```

---

### Task 5: Create Jobs Page with Tabs (Monitor + History)

**Context:** Rename Monitor to Jobs, add Job History tab, move history out of Memory.

**Files:**
- Create: `web/src/routes/jobs.tsx`
- Create: `web/src/components/jobs/`
- Modify: `web/src/components/sidebar.tsx` (Monitor → Jobs)
- Modify: `web/src/routes/memory.tsx` (remove history section)

**Step 1: Create JobMonitorTab component**

```typescript
// Create: web/src/components/jobs/monitor-tab.tsx

// Adapt from existing monitor.tsx
// Show pending, running, recent completed jobs
// Include cancel functionality
```

**Step 2: Create JobHistoryTab component**

```typescript
// Create: web/src/components/jobs/history-tab.tsx

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

interface CompactedSession {
  id: string;
  chatId: string;
  messageCount: number;
  summary: string | null;
  createdAt: string;
}

export function HistoryTab() {
  const [page, setPage] = useState(1);
  
  const { data, isLoading } = useQuery({
    queryKey: ["sessions", page],
    queryFn: async () => {
      const response = await api.sessions.$get();
      return response.json();
    },
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  const sessions: CompactedSession[] = data?.sessions || [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Job History</h2>
        <p className="text-muted-foreground">
          Past conversation sessions and summaries
        </p>
      </div>

      <div className="space-y-4">
        {sessions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No history yet. Complete some tasks to see summaries here.
            </CardContent>
          </Card>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {new Date(session.createdAt).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {session.messageCount} messages
                </p>
                {session.summary && (
                  <p className="mt-2 text-sm">{session.summary}</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create main Jobs page**

```typescript
// Create: web/src/routes/jobs.tsx

import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, History } from "lucide-react";
import { MonitorTab } from "@/components/jobs/monitor-tab";
import { HistoryTab } from "@/components/jobs/history-tab";

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
});

function JobsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Monitor and manage background tasks
        </p>
      </div>

      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Job Monitor
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Job History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-4">
          <MonitorTab />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 4: Update sidebar navigation**

```typescript
// In sidebar.tsx

const navItems: NavItem[] = [
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "Jobs", path: "/jobs", icon: Activity },  // CHANGED: Monitor → Jobs
  // ... rest
];
```

**Step 5: Add redirect from /monitor to /jobs**

```typescript
// Create: web/src/routes/monitor.tsx (redirect)

import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/monitor")({
  component: () => <Navigate to="/jobs" />,
});
```

**Step 6: Remove Sessions from sidebar (now in Jobs)**

```typescript
// In sidebar.tsx, remove Sessions item
// Sessions page content moved to Jobs/History tab
```

**Step 7: Run build and verify**

```bash
cd web && bun run build
```
Expected: Build succeeds

**Step 8: Commit**

```bash
git add web/src/routes/jobs.tsx web/src/components/jobs/ web/src/components/sidebar.tsx
git commit -m "feat: restructure Monitor into tabbed Jobs page

- Rename Monitor to Jobs
- Create 2 tabs: Job Monitor, Job History
- Move Sessions/History content into Jobs tab
- Add redirect from /monitor to /jobs
- Remove Sessions from sidebar (consolidated into Jobs)"
```

---

## Phase 4: New Features

### Task 6: Add Local File Upload for Documents

**Context:** Currently can only save URLs. Need local file upload.

**Files:**
- Modify: `src/core/dashboard/documents-routes.ts` (add upload endpoint)
- Create: `web/src/components/documents/file-upload.tsx`
- Modify: `web/src/routes/documents.tsx` (add upload UI)

**Step 1: Write test for upload endpoint**

```typescript
// In documents-routes.test.ts (create if needed)

describe("POST /upload", () => {
  test("accepts file upload and creates document", async () => {
    // Test multipart upload
  });
  
  test("rejects files over size limit", async () => {
    // Test 413 response
  });
});
```

**Step 2: Implement upload endpoint**

```typescript
// In documents-routes.ts

import { writeFile } from "fs/promises";
import { mkdir } from "fs/promises";
import { join } from "path";

// Add to documentsRoutes

.post("/upload", passwordAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  const name = (body.name as string) || file.name;
  
  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }
  
  // Validate file size (10MB limit)
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return c.json({ error: "File too large (max 10MB)" }, 413);
  }
  
  // Validate file type
  const allowedTypes = [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: "Invalid file type" }, 400);
  }
  
  try {
    // Ensure uploads directory exists
    const uploadDir = join(process.cwd(), "storage", "uploads");
    await mkdir(uploadDir, { recursive: true });
    
    // Save file locally
    const filename = `${Date.now()}-${file.name}`;
    const filepath = join(uploadDir, filename);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(arrayBuffer));
    
    // Create document record
    const document = await createDocument(undefined, {
      name,
      source: `local:${filepath}`,
      type: "upload",
      content: null,
      contentTruncated: false,
      cachedAt: null,
      lastFetchAttemptAt: null,
      lastFetchError: null,
      summary: null,
      tags: null,
    });
    
    return c.json({ document }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ error: "Upload failed", message }, 500);
  }
});
```

**Step 3: Create FileUpload component**

```typescript
// Create: web/src/components/documents/file-upload.tsx

import { useState, useCallback } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FileUploadProps {
  onUpload: (file: File, name: string) => Promise<void>;
}

export function FileUpload({ onUpload }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
      setName(file.name.replace(/\.[^/.]+$/, ""));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setName(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) return;
    
    setIsUploading(true);
    try {
      await onUpload(selectedFile, name.trim());
      setSelectedFile(null);
      setName("");
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  if (selectedFile) {
    return (
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-blue-500" />
          <div className="flex-1">
            <p className="font-medium">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectedFile(null);
              setName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
          className="w-full px-3 py-2 border rounded-md"
        />
        
        <Button
          onClick={handleUpload}
          disabled={isUploading || !name.trim()}
          className="w-full"
        >
          {isUploading ? "Uploading..." : "Upload Document"}
        </Button>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      }`}
    >
      <Upload className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
      <p className="text-sm text-muted-foreground mb-2">
        Drag and drop a file here, or{" "}
        <label className="text-primary cursor-pointer hover:underline">
          browse
          <input
            type="file"
            className="hidden"
            accept=".txt,.md,.pdf,.doc,.docx"
            onChange={handleFileSelect}
          />
        </label>
      </p>
      <p className="text-xs text-muted-foreground">
        Supported: TXT, MD, PDF, DOC, DOCX (max 10MB)
      </p>
    </div>
  );
}
```

**Step 4: Integrate into Documents page**

```typescript
// In documents.tsx, add FileUpload component

import { FileUpload } from "@/components/documents/file-upload";

// Add upload handler
const uploadMutation = useMutation({
  mutationFn: async ({ file, name }: { file: File; name: string }) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", name);
    
    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
      headers: {
        "X-Dashboard-Password": getStoredPassword() || "",
      },
    });
    
    if (!response.ok) throw new Error("Upload failed");
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  },
});

// Add to UI
<div className="space-y-6">
  <Card>
    <CardHeader>
      <CardTitle>Upload Document</CardTitle>
    </CardHeader>
    <CardContent>
      <FileUpload
        onUpload={(file, name) => uploadMutation.mutateAsync({ file, name })}
      />
    </CardContent>
  </Card>
  
  {/* Existing document list */}
</div>
```

**Step 5: Create storage directory**

```bash
mkdir -p storage/uploads
echo "storage/uploads/" >> .gitignore
```

**Step 6: Run tests**

```bash
bun test src/core/dashboard/documents-routes.test.ts
```
Expected: PASS

**Step 7: Verify in browser**

1. Navigate to Documents page
2. Test drag-and-drop upload
3. Test file picker upload
4. Verify document appears in list

**Step 8: Commit**

```bash
git add src/core/dashboard/documents-routes.ts web/src/components/documents/ web/src/routes/documents.tsx storage/
git commit -m "feat: add local file upload for documents

- New /api/documents/upload endpoint (multipart/form-data)
- FileUpload component with drag-and-drop support
- 10MB size limit, type validation
- Files stored in storage/uploads/
- Integrated into Documents page UI"
```

---

### Task 7: Implement Google Drive Folder Structure

**Context:** Documents should be organized in Google Drive under peterbot/ folder.

**Files:**
- Modify: `src/features/documents/service.ts`
- Create: `src/features/documents/drive-sync.ts`
- Modify: `src/features/documents/schema.ts` (add drive fields)

**Step 1: Add drive fields to document schema**

```typescript
// In schema.ts, update documents table

export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  
  // Storage locations
  localPath: text("local_path"),           // Local file path
  driveFileId: text("drive_file_id"),      // Google Drive file ID
  driveFolderPath: text("drive_folder_path").default("documents"), // Path in Drive
  
  // Source
  source: text("source").notNull(),        // URL, local:path, or drive:fileId
  type: text("type").notNull(),           // web, upload, drive
  
  // Content
  content: text("content"),
  contentTruncated: integer("content_truncated", { mode: "boolean" }).default(false),
  
  // Metadata
  fileType: text("file_type"),            // mime type
  fileSize: integer("file_size"),         // bytes
  
  // Existing fields...
  summary: text("summary"),
  cachedAt: integer("cached_at", { mode: "timestamp" }),
  lastFetchAttemptAt: integer("last_fetch_attempt_at", { mode: "timestamp" }),
  lastFetchError: text("last_fetch_error"),
  tags: text("tags"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 2: Create Drive sync utility**

```typescript
// Create: src/features/documents/drive-sync.ts

import { executeAction } from "../integrations/service.js";

const DRIVE_ROOT_FOLDER = "peterbot";

/**
 * Ensure the peterbot folder structure exists in Google Drive.
 * Returns the root folder ID.
 */
export async function ensureDriveFolderStructure(): Promise<{
  rootId: string;
  documentsId: string;
  webId: string;
  uploadsId: string;
}> {
  // Create or get peterbot root folder
  const rootResult = await executeAction("google_drive", "GOOGLEDRIVE_CREATE_FOLDER", {
    name: DRIVE_ROOT_FOLDER,
    parent_folder: "root",
  });
  
  if ("error" in rootResult) {
    throw new Error(`Failed to create root folder: ${rootResult.message}`);
  }
  
  const rootId = (rootResult.data as { id: string }).id;
  
  // Create subfolders
  const folders = ["documents", "documents/web", "documents/uploads", "exports", "backups"];
  const ids: Record<string, string> = { root: rootId };
  
  for (const folderPath of folders) {
    const parts = folderPath.split("/");
    const parentPath = parts.slice(0, -1).join("/") || "root";
    const parentId = ids[parentPath] || rootId;
    
    const result = await executeAction("google_drive", "GOOGLEDRIVE_CREATE_FOLDER", {
      name: parts[parts.length - 1],
      parent_folder: parentId,
    });
    
    if ("error" in result) {
      console.warn(`Failed to create folder ${folderPath}:`, result.message);
    } else {
      ids[folderPath] = (result.data as { id: string }).id;
    }
  }
  
  return {
    rootId,
    documentsId: ids["documents"] || rootId,
    webId: ids["documents/web"] || rootId,
    uploadsId: ids["documents/uploads"] || rootId,
  };
}

/**
 * Upload document content to Google Drive in the appropriate folder.
 */
export async function uploadToDrive(
  name: string,
  content: string,
  folderPath: string,
  mimeType: string = "text/markdown"
): Promise<{ fileId: string; webViewLink: string }> {
  // Ensure folder structure
  const folders = await ensureDriveFolderStructure();
  
  // Determine parent folder ID
  const folderId = folderPath.startsWith("documents/web") 
    ? folders.webId 
    : folderPath.startsWith("documents/uploads")
    ? folders.uploadsId
    : folders.documentsId;
  
  // Upload file
  const result = await executeAction("google_drive", "GOOGLEDRIVE_UPLOAD_FILE", {
    name: `${name}.md`,
    content,
    mime_type: mimeType,
    parent_folder: folderId,
  });
  
  if ("error" in result) {
    throw new Error(`Failed to upload to Drive: ${result.message}`);
  }
  
  const data = result.data as { id: string; webViewLink: string };
  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
  };
}
```

**Step 3: Update addDocument to sync to Drive**

```typescript
// In service.ts, modify addDocument

export async function addDocument(
  db: BunSQLiteDatabase<typeof schema> | undefined,
  data: {
    name: string;
    source: string;
  }
): Promise<{ document: DocumentReference; fetchSuccess: boolean; fetchError: string | null }> {
  const { type, identifier } = parseSource(data.source);
  
  // Determine folder path based on type
  const folderPath = type === "upload" ? "documents/uploads" : "documents/web";
  
  // Create document reference
  const document = await createDocument(db, {
    name: data.name,
    source: type === "doc" ? `google_drive:${identifier}` : identifier,
    type,
    driveFolderPath: folderPath,
    // ... other fields
  });
  
  // Try to fetch and cache content
  const fetchResult = await fetchAndCache(db, document);
  
  // If fetch succeeded, sync to Drive
  if (fetchResult.success && document.content) {
    try {
      const driveResult = await uploadToDrive(
        data.name,
        document.content,
        folderPath
      );
      
      // Update document with Drive file ID
      await updateDocumentDriveInfo(db, document.id, {
        driveFileId: driveResult.fileId,
      });
      
      document.driveFileId = driveResult.fileId;
    } catch (error) {
      console.warn("[Documents] Failed to sync to Drive:", error);
      // Don't fail - document is still saved locally
    }
  }
  
  // Return updated document
  const updatedDoc = await getDocumentById(db, document.id);
  
  return {
    document: updatedDoc ?? document,
    fetchSuccess: fetchResult.success,
    fetchError: fetchResult.error,
  };
}
```

**Step 4: Run tests**

```bash
bun test src/features/documents/
```
Expected: PASS (mock Drive API calls)

**Step 5: Update documentation**

```markdown
# In docs/documents.md or similar

## Google Drive Integration

Documents are automatically synced to your Google Drive under the `peterbot/` folder:

```
peterbot/
├── documents/
│   ├── web/          # Documents saved from URLs
│   └── uploads/      # Documents uploaded from local files
├── exports/          # Job outputs (future feature)
└── backups/          # System backups (future feature)
```

### Requirements
- Google Drive connection via Composio
- `GOOGLEDRIVE_UPLOAD_FILE` action permission

### Sync Behavior
- Documents are synced after successful fetch/upload
- Local SQLite remains primary source
- Drive serves as backup and organization tool
```

**Step 6: Commit**

```bash
git add src/features/documents/
git commit -m "feat: sync documents to Google Drive folder structure

- Create peterbot/documents/web/ and peterbot/documents/uploads/ folders
- Auto-upload documents to appropriate subfolder after fetch
- Store Drive file IDs in document records
- Graceful fallback if Drive sync fails"
```

---

## Phase 5: Final Integration

### Task 8: Final Testing and Documentation

**Step 1: Run full test suite**

```bash
bun test
```
Expected: All PASS

**Step 2: Build frontend**

```bash
cd web && bun run build
```
Expected: No errors

**Step 3: Update README**

```markdown
## Settings Page

Configure peterbot from the Settings page:
- **Overview** - System health and status
- **Soul** - Edit bot personality
- **Memory** - Manage permanent facts
- **Blocklist** - Security settings

## Jobs Page

Monitor and manage tasks:
- **Job Monitor** - Current and recent jobs
- **Job History** - Past conversation summaries
```

**Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: update README with Settings and Jobs page documentation"
```

---

## Summary of Changes

| Area | Changes |
|------|---------|
| **Security** | Config file validation prevents accidental overwrites |
| **Telegram** | Fixed inline keyboard horizontal layout |
| **Navigation** | Chat moved to top, Monitor→Jobs, Config→Settings |
| **Settings** | New tabbed page consolidating Soul, Memory, Blocklist |
| **Jobs** | New tabbed page with Monitor and History tabs |
| **Documents** | Local file upload, Google Drive folder sync |

---

## Rollback Instructions

If issues arise:

1. Revert UI changes:
   ```bash
   git revert HEAD~7..HEAD
   ```

2. Keep file protection:
   ```bash
   git cherry-pick <commit-with-file-protection>
   ```

3. Or restore from backup:
   ```bash
   git checkout main -- web/src/routes/
   ```

---

*End of Implementation Plan*
