# Dashboard UI Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken tabs, restructure navigation by consolidating Schedules/Solutions into Jobs, Dev Console into Settings, remove redundant Overview page, and add health status monitoring.

**Architecture:** Use TanStack Router's nested route layout pattern for tabbed interfaces. Fix CSS-based active tab styling. Add polling-based health check API. Restructure sidebar navigation to reflect consolidated menu structure.

**Tech Stack:** React, TanStack Router, TanStack Query, Tailwind CSS, Hono (backend), Radix UI Tabs

---

## Task 1: Fix Chat Auto-Scroll on New Messages

**Context:** The chat page polls for new messages every 5 seconds, but doesn't auto-scroll when they arrive. Currently only scrolls on initial load and after sending a message.

**Files:**
- Modify: `web/src/routes/chat.tsx`
- Modify: `web/src/hooks/use-chat.ts`

**Step 1: Add callback for new message detection in use-chat.ts**

Add a callback prop that fires when new messages arrive from polling:

```typescript
// In use-chat.ts, add to UseChatOptions interface:
interface UseChatOptions {
  enabled?: boolean
  onNewMessages?: (count: number) => void  // Add this
}

// In the poll effect where new messages are detected (around line 109-117):
if (newMessages.length > 0) {
  // ... existing merge code ...
  
  // Call the callback
  options.onNewMessages?.(newMessages.length)
}
```

**Step 2: Pass scroll callback from chat.tsx**

```typescript
// In chat.tsx, update the useChat call:
const { 
  messages, 
  isLoading, 
  error, 
  hasMore, 
  loadMore, 
  isLoadingMore,
  sendMessage, 
  isSending,
} = useChat({
  onNewMessages: () => {
    // Scroll to bottom when new messages arrive from polling
    setTimeout(scrollToBottom, 100)
  }
})
```

**Step 3: Test the fix**

1. Open chat page
2. Send a message from Telegram
3. Wait for poll (5 seconds)
4. Verify chat auto-scrolls to show new message

**Step 4: Commit**

```bash
git add web/src/routes/chat.tsx web/src/hooks/use-chat.ts
git commit -m "fix: auto-scroll chat when new messages arrive from polling"
```

---

## Task 2: Create Health Check API Endpoint

**Context:** Need a new API endpoint that returns the status of Telegram bot, Worker, and Composio integration. This will power the new Health Check tab in Settings.

**Files:**
- Modify: `src/core/dashboard/routes.ts`

**Step 1: Add health check endpoint**

Add this route to the Hono app in `src/core/dashboard/routes.ts` (after the existing `/health` endpoint):

```typescript
import { config } from "../../shared/config.js";
import { isConfigured as isComposioConfigured } from "../../features/integrations/service.js";

// ... existing imports ...

// Add new health check endpoint (around line 120, after public health check)
.get("/health/detailed", passwordAuth, async (c) => {
  // Check Telegram bot status (we assume it's connected if we have the token and chat ID)
  const telegramConfigured = !!(config.telegramBotToken && config.telegramChatId);
  
  // Worker status - we can check if the scheduler is running
  // For now, we assume worker is running if the server is up
  // In the future, we could check a heartbeat timestamp
  const workerRunning = true;
  
  // Composio status
  const composioConfigured = isComposioConfigured();
  
  return c.json({
    status: "ok",
    components: {
      telegram: {
        connected: telegramConfigured,
        details: telegramConfigured ? "Bot token and chat ID configured" : "Missing configuration"
      },
      worker: {
        running: workerRunning,
        details: "Worker process active"
      },
      composio: {
        connected: composioConfigured,
        details: composioConfigured ? "API key configured" : "Not configured"
      }
    },
    ts: Date.now(),
  });
})
```

**Step 2: Add import for isConfigured at top of file**

```typescript
import {
  isConfigured as isComposioConfigured,
} from "../../features/integrations/service.js";
```

**Step 3: Test the endpoint**

```bash
curl -H "X-Dashboard-Password: your-password" http://localhost:3000/api/health/detailed
```

Expected response:
```json
{
  "status": "ok",
  "components": {
    "telegram": { "connected": true, "details": "..." },
    "worker": { "running": true, "details": "..." },
    "composio": { "connected": false, "details": "..." }
  },
  "ts": 1234567890
}
```

**Step 4: Commit**

```bash
git add src/core/dashboard/routes.ts
git commit -m "feat: add detailed health check API endpoint"
```

---

## Task 3: Create Health Check Tab Component

**Context:** Create a new Health Check tab that replaces the Overview tab in Settings. Shows real-time status of Telegram, Worker, and Composio.

**Files:**
- Create: `web/src/components/settings/health-check-tab.tsx`
- Modify: `web/src/routes/settings.tsx`

**Step 1: Create health-check-tab.tsx**

```typescript
// web/src/components/settings/health-check-tab.tsx
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Cpu, Hexagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface HealthStatus {
  status: string;
  components: {
    telegram: {
      connected: boolean;
      details: string;
    };
    worker: {
      running: boolean;
      details: string;
    };
    composio: {
      connected: boolean;
      details: string;
    };
  };
  ts: number;
}

export function HealthCheckTab() {
  const { data: health, isLoading, refetch } = useQuery<HealthStatus>({
    queryKey: ["health-detailed"],
    queryFn: async () => {
      const response = await api["health"].detailed.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch health status");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Health</h2>
          <p className="text-sm text-muted-foreground">
            Real-time status of peterbot components
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Telegram Bot Status */}
        <StatusCard
          title="Telegram Bot"
          icon={Bot}
          status={health?.components.telegram.connected ?? false}
          statusLabel={health?.components.telegram.connected ? "Connected" : "Not Configured"}
          description={health?.components.telegram.details ?? "Checking..."}
          isLoading={isLoading}
        />

        {/* Worker Status */}
        <StatusCard
          title="Worker"
          icon={Cpu}
          status={health?.components.worker.running ?? false}
          statusLabel={health?.components.worker.running ? "Running" : "Stopped"}
          description={health?.components.worker.details ?? "Checking..."}
          isLoading={isLoading}
        />

        {/* Composio Status */}
        <StatusCard
          title="Composio"
          icon={Hexagon}
          status={health?.components.composio.connected ?? false}
          statusLabel={health?.components.composio.connected ? "Integrated" : "Not Configured"}
          description={health?.components.composio.details ?? "Checking..."}
          isLoading={isLoading}
        />
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Status</CardTitle>
          <CardDescription>
            System operational status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
              </div>
            ) : health?.status === "ok" ? (
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </div>
            ) : (
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </div>
            )}
            <span className="text-sm font-medium">
              {isLoading ? "Checking..." : health?.status === "ok" ? "All Systems Operational" : "Issues Detected"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatusCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  status: boolean;
  statusLabel: string;
  description: string;
  isLoading: boolean;
}

function StatusCard({ title, icon: Icon, status, statusLabel, description, isLoading }: StatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${status ? "text-green-500" : "text-gray-400"}`} />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
              </span>
            ) : status ? (
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
            )}
            <span className={`text-sm font-medium ${isLoading ? "text-yellow-600" : status ? "text-green-600" : "text-gray-500"}`}>
              {isLoading ? "Checking..." : statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{isLoading ? "..." : description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Update settings.tsx to use Health Check instead of Overview**

Replace the Overview tab with Health Check:

```typescript
// In web/src/routes/settings.tsx
import { HealthCheckTab } from "@/components/settings/health-check-tab";  // Change import

// Update tabs array:
const tabs = [
  { path: "/settings", label: "Health Check", exact: true },  // Changed from "Overview"
  { path: "/settings/soul", label: "Soul" },
  { path: "/settings/memory", label: "Memory" },
  { path: "/settings/blocklist", label: "Blocklist" },
  { path: "/settings/compaction", label: "Compaction" },
  { path: "/settings/console", label: "Dev Console" },  // Add this
];

// Update content area:
{isExactSettings ? <HealthCheckTab /> : <Outlet />}  // Changed from OverviewTab
```

**Step 3: Delete old overview-tab.tsx**

```bash
rm web/src/components/settings/overview-tab.tsx
```

**Step 4: Commit**

```bash
git add web/src/components/settings/health-check-tab.tsx web/src/routes/settings.tsx
git rm web/src/components/settings/overview-tab.tsx
git commit -m "feat: replace Overview tab with Health Check in Settings"
```

---

## Task 4: Fix Jobs Tab Navigation and Rename Monitor to Active

**Context:** The Jobs tabs aren't working properly. Need to fix the active state styling and rename "Job Monitor" to "Active".

**Files:**
- Modify: `web/src/routes/jobs.tsx`

**Step 1: Update the Jobs layout with fixed tab styling**

```typescript
// web/src/routes/jobs.tsx
import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { useState } from "react";
import { JobMonitorTab } from "@/components/jobs/job-monitor-tab";

export const Route = createFileRoute("/jobs")({
  component: JobsLayout,
});

function JobsLayout() {
  // Check if we're at the exact /jobs path (not a nested route)
  const isExactJobs = useMatch({
    from: "/jobs",
    strict: true,
  });

  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const tabs = [
    { path: "/jobs", label: "Active", exact: true },  // Changed from "Job Monitor"
    { path: "/jobs/history", label: "History" },  // Kept as "History"
    { path: "/jobs/schedules", label: "Scheduled" },  // New tab
    { path: "/jobs/solutions", label: "Solutions" },  // New tab
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
        <p className="text-muted-foreground">
          Monitor and manage background tasks
        </p>
      </div>

      {/* Tab Bar - Fixed styling */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              activeOptions={{ exact: tab.exact ?? false }}
              activeProps={{
                className: "border-primary text-foreground",
              }}
              inactiveProps={{
                className: "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              }}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div>
        {isExactJobs ? (
          <JobMonitorTab 
            lastRefresh={lastRefresh} 
            setLastRefresh={setLastRefresh} 
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}
```

**Step 2: Test tab navigation**

1. Navigate to /jobs
2. Click on "History" tab - should navigate to /jobs/history
3. "Active" should lose active styling, "History" should gain it
4. Click back to "Active" - should navigate back to /jobs

**Step 3: Commit**

```bash
git add web/src/routes/jobs.tsx
git commit -m "fix: fix Jobs tab navigation and rename Monitor to Active"
```

---

## Task 5: Fix Settings Tab Navigation

**Context:** The Settings tabs have the same styling issue as Jobs tabs. Need to apply the same fix.

**Files:**
- Modify: `web/src/routes/settings.tsx`

**Step 1: Update Settings layout with fixed tab styling**

```typescript
// web/src/routes/settings.tsx
import { createFileRoute, Link, Outlet, useMatch } from "@tanstack/react-router";
import { HealthCheckTab } from "@/components/settings/health-check-tab";

export const Route = createFileRoute("/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const isExactSettings = useMatch({
    from: "/settings",
    strict: true,
  });

  const tabs = [
    { path: "/settings", label: "Health Check", exact: true },
    { path: "/settings/soul", label: "Soul" },
    { path: "/settings/memory", label: "Memory" },
    { path: "/settings/blocklist", label: "Blocklist" },
    { path: "/settings/compaction", label: "Compaction" },
    { path: "/settings/console", label: "Dev Console" },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage peterbot&apos;s configuration and preferences
        </p>
      </div>

      {/* Tab Bar - Fixed styling */}
      <div className="border-b border-border">
        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <Link
              key={tab.path}
              to={tab.path}
              activeOptions={{ exact: tab.exact ?? false }}
              activeProps={{
                className: "border-primary text-foreground",
              }}
              inactiveProps={{
                className: "border-transparent text-muted-foreground hover:text-foreground hover:border-muted",
              }}
              className="px-4 py-2 text-sm font-medium border-b-2 transition-colors"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div>
        {isExactSettings ? <HealthCheckTab /> : <Outlet />}
      </div>
    </div>
  );
}
```

**Step 2: Test tab navigation**

1. Navigate to /settings
2. Click through each tab
3. Verify active tab styling changes correctly

**Step 3: Commit**

```bash
git add web/src/routes/settings.tsx
git commit -m "fix: fix Settings tab navigation styling"
```

---

## Task 6: Create Schedules Tab Component for Jobs

**Context:** Move the Schedules page functionality into a tab within Jobs.

**Files:**
- Create: `web/src/components/jobs/schedules-tab.tsx`
- Create: `web/src/routes/jobs/schedules.tsx`

**Step 1: Create schedules-tab.tsx (extract from existing schedules.tsx)**

Copy the content from `web/src/routes/schedules.tsx` and adapt it as a component:

```typescript
// web/src/components/jobs/schedules-tab.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Clock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SchedulesResponse, ApiSchedule } from "@/types/schedule";

export function SchedulesTab() {
  const queryClient = useQueryClient();
  
  const [description, setDescription] = useState("");
  const [naturalSchedule, setNaturalSchedule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: schedulesData, isLoading } = useQuery<SchedulesResponse>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const response = await api.schedules.$get();
      return response.json();
    },
  });

  const schedules: ApiSchedule[] = schedulesData?.schedules ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: { description: string; naturalSchedule: string; prompt: string }) => {
      const response = await api.schedules.$post({ json: data });
      const result = await response.json();
      if (!response.ok) {
        const errorResult = result as { error: string; message: string; examples?: string[] };
        throw new Error(errorResult.message || "Failed to create schedule");
      }
      return result;
    },
    onSuccess: () => {
      setDescription("");
      setNaturalSchedule("");
      setPrompt("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule created successfully");
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.schedules[":id"].$delete({ param: { id } });
      if (!response.ok) {
        throw new Error("Failed to delete schedule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      toast.success("Schedule deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete schedule");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await api.schedules[":id"].toggle.$post({
        param: { id },
        json: { enabled },
      });
      if (!response.ok) {
        throw new Error("Failed to toggle schedule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle schedule");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !naturalSchedule.trim() || !prompt.trim()) {
      setFormError("All fields are required");
      return;
    }
    createMutation.mutate({ description, naturalSchedule, prompt });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* New Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            New Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="e.g., Weekly briefing"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">When (natural language)</label>
                <Input
                  placeholder="e.g., every monday 9am"
                  value={naturalSchedule}
                  onChange={(e) => setNaturalSchedule(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">What to do</label>
              <Input
                placeholder="e.g., Send me a tech news briefing"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            {formError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Schedule"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Schedules List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">YOUR SCHEDULES ({schedules.length})</h2>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading schedules...</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No schedules yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((schedule: ApiSchedule) => (
              <Card key={schedule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{schedule.description}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          schedule.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {schedule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {schedule.naturalSchedule} · {schedule.parsedCron}
                      </p>
                      <p className="text-sm">{schedule.prompt}</p>
                      <p className="text-xs text-muted-foreground">
                        Next run: {formatDate(new Date(schedule.nextRunAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={schedule.enabled}
                        onCheckedChange={(enabled) => toggleMutation.mutate({ id: schedule.id, enabled })}
                        disabled={toggleMutation.isPending}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(schedule.id)}
                        disabled={deleteMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create the route file**

```typescript
// web/src/routes/jobs/schedules.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SchedulesTab } from "@/components/jobs/schedules-tab";

export const Route = createFileRoute("/jobs/schedules")({
  component: SchedulesTab,
});
```

**Step 3: Test**

1. Navigate to /jobs
2. Click "Scheduled" tab
3. Verify schedules list loads
4. Test creating a schedule
5. Test toggling/deleting schedules

**Step 4: Commit**

```bash
git add web/src/components/jobs/schedules-tab.tsx web/src/routes/jobs/schedules.tsx
git commit -m "feat: add Schedules tab to Jobs page"
```

---

## Task 7: Create Solutions Tab Component for Jobs

**Context:** Move the Solutions page functionality into a tab within Jobs.

**Files:**
- Create: `web/src/components/jobs/solutions-tab.tsx`
- Create: `web/src/routes/jobs/solutions.tsx`

**Step 1: Create solutions-tab.tsx (extract from existing solutions.tsx)**

```typescript
// web/src/components/jobs/solutions-tab.tsx
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { SolutionsResponse, ApiSolution } from "@/types/solution";

export function SolutionsTab() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const { data: solutionsData, isLoading } = useQuery<SolutionsResponse>({
    queryKey: ["solutions"],
    queryFn: async () => {
      const response = await api.solutions.$get();
      return response.json();
    },
  });

  const allSolutions: ApiSolution[] = solutionsData?.solutions ?? [];

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const solution of allSolutions) {
      if (solution.tags) {
        try {
          const tags = JSON.parse(solution.tags) as string[];
          for (const tag of tags) {
            tagSet.add(tag);
          }
        } catch {
          // Ignore malformed JSON
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [allSolutions]);

  const filteredSolutions = useMemo(() => {
    return allSolutions.filter((solution) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        solution.title.toLowerCase().includes(query) ||
        (solution.description?.toLowerCase() ?? "").includes(query) ||
        (solution.tags?.toLowerCase() ?? "").includes(query);

      const matchesTags =
        activeTags.length === 0 ||
        (() => {
          if (!solution.tags) return false;
          try {
            const tags = JSON.parse(solution.tags) as string[];
            return activeTags.every((tag) => tags.includes(tag));
          } catch {
            return false;
          }
        })();

      return matchesSearch && matchesTags;
    });
  }, [allSolutions, searchQuery, activeTags]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.solutions[":id"].$delete({ param: { id } });
      if (!response.ok) {
        throw new Error("Failed to delete solution");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["solutions"] });
      toast.success("Solution deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete solution");
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this solution?")) {
      deleteMutation.mutate(id);
    }
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const parseTags = (tagsJson: string | null): string[] => {
    if (!tagsJson) return [];
    try {
      return JSON.parse(tagsJson) as string[];
    } catch {
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium whitespace-nowrap">Search</span>
            <Input
              placeholder="Search by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex items-start gap-4">
              <span className="text-sm font-medium whitespace-nowrap pt-1.5">Filter by tags</span>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isActive = activeTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solutions List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">SOLUTIONS ({filteredSolutions.length})</h2>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Loading solutions...</p>
          </div>
        ) : allSolutions.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed gap-2">
            <p className="text-sm text-muted-foreground">No solutions yet</p>
            <p className="text-xs text-muted-foreground">
              To save a solution, reply to a completed job in Telegram with: &quot;save this solution&quot;
            </p>
          </div>
        ) : filteredSolutions.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">No solutions match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSolutions.map((solution: ApiSolution) => {
              const tags = parseTags(solution.tags);
              return (
                <Card key={solution.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="font-semibold truncate">{solution.title}</h3>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {solution.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {solution.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <code className="rounded bg-muted px-1.5 py-0.5">
                            {solution.jobId.slice(0, 8)}
                          </code>
                          <span>·</span>
                          <span>{formatDate(new Date(solution.createdAt))}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(solution.id)}
                        disabled={deleteMutation.isPending}
                        className="shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create the route file**

```typescript
// web/src/routes/jobs/solutions.tsx
import { createFileRoute } from "@tanstack/react-router";
import { SolutionsTab } from "@/components/jobs/solutions-tab";

export const Route = createFileRoute("/jobs/solutions")({
  component: SolutionsTab,
});
```

**Step 3: Test**

1. Navigate to /jobs
2. Click "Solutions" tab
3. Verify solutions list loads
4. Test search and tag filters
5. Test delete

**Step 4: Commit**

```bash
git add web/src/components/jobs/solutions-tab.tsx web/src/routes/jobs/solutions.tsx
git commit -m "feat: add Solutions tab to Jobs page"
```

---

## Task 8: Create Dev Console Tab Component for Settings

**Context:** Move the Dev Console page functionality into a tab within Settings. Need to adapt the full-screen console to work within the tab layout.

**Files:**
- Create: `web/src/components/settings/console-tab.tsx`
- Create: `web/src/routes/settings/console.tsx`

**Step 1: Create console-tab.tsx (adapt from existing console.tsx)**

The Dev Console is currently a full-screen page. We need to create a tab-friendly version:

```typescript
// web/src/components/settings/console-tab.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, type TerminalHandle } from "@/components/terminal";
import { api } from "@/lib/api";
import { Loader2, Trash2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ConsoleTab() {
  const [sessionId, setSessionId] = useState<string>(() => {
    const stored = localStorage.getItem("console-session-id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("console-session-id", newId);
    return newId;
  });

  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const terminalRef = useRef<TerminalHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const welcomeLines = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║           🖥️  Welcome to peterbot Dev Console                ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      "Direct access to E2B sandbox. Type Python commands and press Enter.",
      "Session ID: " + sessionId.slice(0, 8) + "...",
      "",
      "> ",
    ];

    const timer = setTimeout(() => {
      welcomeLines.forEach((line) => {
        terminalRef.current?.writeln(line);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [sessionId]);

  const handleCommand = useCallback(
    async (cmd: string) => {
      setCommandHistory((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === cmd) {
          return prev;
        }
        return [...prev, cmd];
      });

      setIsExecuting(true);

      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 30000);

      try {
        const response = await api.console.execute.$post(
          { json: { sessionId, code: cmd } },
          { init: { signal: abortControllerRef.current.signal } }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            "error" in errorData && typeof errorData.error === "string"
              ? errorData.error
              : "Unknown error";
          terminalRef.current?.write(`\r\n\x1b[91mError: ${errorMsg}\x1b[0m\r\n\r\n> `);
          return;
        }

        const result = await response.json();

        if (result.error && typeof result.error === "string" && result.error.length > 0) {
          terminalRef.current?.write(`\r\n\x1b[91mError: ${result.error}\x1b[0m\r\n\r\n> `);
          return;
        }

        if (result.stdout) {
          const lines = result.stdout.split("\n");
          lines.forEach((line: string) => {
            terminalRef.current?.writeln(`\x1b[92m${line}\x1b[0m`);
          });
        }

        if (result.stderr) {
          const lines = result.stderr.split("\n");
          lines.forEach((line: string) => {
            terminalRef.current?.writeln(`\x1b[93m${line}\x1b[0m`);
          });
        }

        terminalRef.current?.write("\r\n> ");
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            terminalRef.current?.write("\r\n\x1b[93mExecution cancelled (timeout)\x1b[0m\r\n\r\n> ");
          } else {
            terminalRef.current?.write(`\r\n\x1b[91mError: ${error.message}\x1b[0m\r\n\r\n> `);
          }
        } else {
          terminalRef.current?.write("\r\n\x1b[91mUnknown error occurred\x1b[0m\r\n\r\n> ");
        }
      } finally {
        setIsExecuting(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId]
  );

  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    terminalRef.current?.write("\x1b[96mTerminal cleared.\x1b[0m\r\n\r\n> ");
  }, []);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleReset = useCallback(async () => {
    setIsExecuting(true);

    try {
      await api.console.reset.$post({ json: { sessionId } });

      const newId = crypto.randomUUID();
      localStorage.setItem("console-session-id", newId);
      setSessionId(newId);

      terminalRef.current?.clear();
      terminalRef.current?.writeln("");
      terminalRef.current?.writeln("\x1b[96mSession reset. New session started.\x1b[0m");
      terminalRef.current?.writeln(`Session ID: ${newId.slice(0, 8)}...`);
      terminalRef.current?.writeln("");
      terminalRef.current?.write("> ");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to reset session";
      terminalRef.current?.write(`\r\n\x1b[91mError: ${message}\x1b[0m\r\n\r\n> `);
    } finally {
      setIsExecuting(false);
    }
  }, [sessionId]);

  const openFullscreen = () => {
    window.open("/console", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Session: {sessionId.slice(0, 8)}...
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isExecuting}
            className="gap-2"
          >
            ↻ Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openFullscreen}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Fullscreen
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 px-4 py-2">
        <p className="text-sm text-yellow-600 flex items-center gap-2">
          <span>⚠️</span>
          Direct E2B sandbox access — blocklist restrictions do not apply here.
        </p>
      </div>

      {/* Terminal */}
      <Card className="border-gray-700 bg-[#1a202c]">
        <CardContent className="p-0">
          <div className="h-[400px] w-full">
            <Terminal
              ref={terminalRef}
              onCommand={handleCommand}
              commandHistory={commandHistory}
              disabled={isExecuting}
            />
          </div>
        </CardContent>
      </Card>

      {/* Executing Indicator */}
      {isExecuting && (
        <div className="flex items-center justify-between px-4 py-2 border rounded-md bg-muted">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
            <span>Executing...</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="text-destructive hover:text-destructive gap-2"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create the route file**

```typescript
// web/src/routes/settings/console.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ConsoleTab } from "@/components/settings/console-tab";

export const Route = createFileRoute("/settings/console")({
  component: ConsoleTab,
});
```

**Step 3: Test**

1. Navigate to /settings
2. Click "Dev Console" tab
3. Verify terminal loads
4. Test Python commands
5. Test Clear, Reset, Fullscreen buttons

**Step 4: Commit**

```bash
git add web/src/components/settings/console-tab.tsx web/src/routes/settings/console.tsx
git commit -m "feat: add Dev Console tab to Settings page"
```

---

## Task 9: Update Sidebar Navigation

**Context:** Remove Overview, Schedules, Solutions, and Dev Console from sidebar. Update Jobs and Settings to reflect new structure.

**Files:**
- Modify: `web/src/components/sidebar.tsx`

**Step 1: Update navItems in sidebar**

```typescript
// web/src/components/sidebar.tsx
const navItems: NavItem[] = [
  { label: "Chat", path: "/chat", icon: MessageSquare },
  // Removed: Overview - redundant with Settings/Health Check
  { label: "Jobs", path: "/jobs", icon: Activity },
  // Removed: Schedules - now in Jobs tab
  // Removed: Solutions - now in Jobs tab
  { label: "Skills", path: "/skills", icon: Zap, isNew: true },
  { label: "Integrations", path: "/integrations", icon: Hexagon, isNew: true },
  { label: "Settings", path: "/settings", icon: Settings },
  { label: "About", path: "/about", icon: Info },
  // Removed: Dev Console - now in Settings tab (keep as external for fullscreen access)
  { label: "Dev Console", path: "/console", icon: Terminal, external: true },
];
```

**Step 2: Test navigation**

1. Verify sidebar shows: Chat, Jobs, Skills, Integrations, Settings, About, Dev Console
2. Verify Overview, Schedules, Solutions are removed
3. Verify Jobs and Settings links work correctly

**Step 3: Commit**

```bash
git add web/src/components/sidebar.tsx
git commit -m "refactor: consolidate navigation - move Schedules/Solutions to Jobs, Dev Console to Settings"
```

---

## Task 10: Remove/Redirect Old Routes

**Context:** The old routes (/schedules, /solutions, /) need to redirect to their new locations.

**Files:**
- Modify: `web/src/routes/index.tsx`
- Modify: `web/src/routes/schedules.tsx`
- Modify: `web/src/routes/solutions.tsx`

**Step 1: Redirect root to settings**

```typescript
// web/src/routes/index.tsx
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/settings" />,
});
```

**Step 2: Redirect /schedules to /jobs/schedules**

```typescript
// web/src/routes/schedules.tsx
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/schedules")({
  component: () => <Navigate to="/jobs/schedules" />,
});
```

**Step 3: Redirect /solutions to /jobs/solutions**

```typescript
// web/src/routes/solutions.tsx
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/solutions")({
  component: () => <Navigate to="/jobs/solutions" />,
});
```

**Step 4: Test redirects**

1. Navigate to / - should redirect to /settings
2. Navigate to /schedules - should redirect to /jobs/schedules
3. Navigate to /solutions - should redirect to /jobs/solutions

**Step 5: Commit**

```bash
git add web/src/routes/index.tsx web/src/routes/schedules.tsx web/src/routes/solutions.tsx
git commit -m "feat: add redirects for consolidated routes"
```

---

## Task 11: Regenerate Route Tree

**Context:** TanStack Router needs to regenerate the route tree after adding new route files.

**Files:**
- Auto-generated: `web/src/routeTree.gen.ts`

**Step 1: Run the route generation**

```bash
cd /home/mors/projects/antidote/peterbot/web
npm run dev  # or the appropriate command that triggers route generation
```

Or manually generate:

```bash
cd /home/mors/projects/antidote/peterbot/web
npx @tanstack/router-generator
```

**Step 2: Verify generated routes**

Check `web/src/routeTree.gen.ts` includes:
- `/jobs/schedules`
- `/jobs/solutions`
- `/settings/console`

**Step 3: Commit**

```bash
git add web/src/routeTree.gen.ts
git commit -m "chore: regenerate route tree for new routes"
```

---

## Task 12: Final Integration Test

**Context:** Test all the changes together to ensure everything works.

**Test Checklist:**

1. **Chat Auto-Scroll:**
   - Open chat
   - Send message from Telegram
   - Verify auto-scroll works

2. **Jobs Tabs:**
   - Navigate to /jobs
   - Click "Active", "History", "Scheduled", "Solutions"
   - Verify each tab loads correctly
   - Verify active tab styling works

3. **Settings Tabs:**
   - Navigate to /settings
   - Click "Health Check", "Soul", "Memory", "Blocklist", "Compaction", "Dev Console"
   - Verify each tab loads correctly
   - Verify active tab styling works

4. **Health Check:**
   - Verify Telegram, Worker, Composio status shows correctly
   - Verify refresh button works

5. **Sidebar:**
   - Verify only: Chat, Jobs, Skills, Integrations, Settings, About, Dev Console
   - Verify no: Overview, Schedules, Solutions

6. **Redirects:**
   - / → /settings
   - /schedules → /jobs/schedules
   - /solutions → /jobs/solutions

**Step 1: Run full test**

```bash
cd /home/mors/projects/antidote/peterbot
npm run test  # if tests exist
```

**Step 2: Build and verify**

```bash
cd /home/mors/projects/antidote/peterbot/web
npm run build
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete dashboard UI restructure"
```

---

## Summary

This plan implements the following changes:

1. **Bug Fixes:**
   - Chat auto-scroll on new messages
   - Jobs and Settings tab styling

2. **UI Restructure:**
   - Jobs: Active (renamed), History, Scheduled (moved), Solutions (moved)
   - Settings: Health Check (renamed from Overview), Soul, Memory, Blocklist, Compaction, Dev Console (moved)
   - Sidebar: Removed Overview, Schedules, Solutions; kept Dev Console as external link

3. **New Features:**
   - Health Check API endpoint with Telegram/Worker/Composio status
   - Health Check tab with real-time status cards
   - Redirects for old routes

**Total Tasks:** 12
**Estimated Time:** 60-90 minutes

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-02-19-dashboard-ui-restructure.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
