# Integration Dashboard Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform integrations from OAuth-initiation to dashboard-sync model where users connect apps in Composio and Peterbot syncs/displays status.

**Architecture:** Remove OAuth flow endpoints and state management. Add sync endpoint that fetches connected accounts from Composio API. Update UI to show sync button, instructions modal, and categorized provider list with required/optional indicators.

**Tech Stack:** Hono (backend), React + TanStack Query (frontend), Composio SDK, SQLite (via Drizzle ORM)

---

## Prerequisites

- Composio API key configured in `.env`
- Backend server can start and connect to database
- Frontend dev server can start

---

## Phase 1: Backend Core - Remove OAuth, Add Sync

### Task 1: Update Service Layer - Remove OAuth Functions

**Files:**
- Modify: `src/features/integrations/service.ts`

**Step 1: Remove OAuth state management**

Delete lines 8-46 (PendingState interface, pendingStates Map, generateStateToken, validateAndConsumeState functions).

**Step 2: Remove getOAuthUrl function**

Delete lines 65-134 (OAuthUrlResult type and getOAuthUrl function).

**Step 3: Remove validateAndConsumeState from exports**

This function is no longer exported (already deleted in step 1).

**Step 4: Verify service.ts compiles**

Run: `cd /home/mors/projects/antidote/peterbot && bun run dev`
Expected: Server starts without errors

**Step 5: Commit**

```bash
git add src/features/integrations/service.ts
git commit -m "refactor(integrations): remove OAuth state management and getOAuthUrl"
```

---

### Task 2: Add Sync Function to Service Layer

**Files:**
- Modify: `src/features/integrations/service.ts`

**Step 1: Add TOOLKIT_TO_PROVIDER mapping after imports**

```typescript
/**
 * Toolkit slug to Peterbot provider ID mapping.
 * Maps Composio toolkit slugs to our internal provider identifiers.
 */
const TOOLKIT_TO_PROVIDER: Record<string, string> = {
  gmail: "gmail",
  googledocs: "googledocs",
  googlesheets: "googlesheets",
  google_drive: "google_drive",
  googlecalendar: "googlecalendar",
  github: "github",
  notion: "notion",
  linear: "linear",
};
```

**Step 2: Add SyncResult type before isConfigured function**

```typescript
export type SyncResult =
  | {
      added: string[];
      removed: string[];
      unchanged: string[];
    }
  | { error: "not_configured" | "sdk_error"; message: string };
```

**Step 3: Add syncFromComposio function after getClient function**

```typescript
/**
 * Sync connected accounts from Composio to local DB.
 * Fetches all connected accounts for the entity and updates local state.
 */
export async function syncFromComposio(): Promise<SyncResult> {
  if (!isConfigured()) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  const client = getClient();
  if (!client) {
    return {
      error: "not_configured",
      message: "Composio API key is not configured",
    };
  }

  try {
    // Fetch all connected accounts for this user
    const accounts = await client.connectedAccounts.list({
      userIds: ["peterbot-user"],
      statuses: ["ACTIVE"],
    });

    const added: string[] = [];
    const unchanged: string[] = [];
    const currentProviders = new Set<string>();

    // Process each connected account
    if (accounts.items) {
      for (const account of accounts.items) {
        const toolkitSlug = account.toolkit?.slug;
        if (!toolkitSlug) continue;

        // Map toolkit slug to provider ID
        const provider = TOOLKIT_TO_PROVIDER[toolkitSlug];
        if (!provider) {
          console.warn(`[sync] Unknown toolkit slug: ${toolkitSlug}`);
          continue;
        }

        currentProviders.add(provider);

        // Get account email from params
        const accountEmail =
          (account.params?.email as string | undefined) ||
          (account.params?.login as string | undefined) ||
          null;

        // Check if already exists in DB
        const existing = await getConnectedApp(undefined, provider);

        // Upsert to DB
        await upsertConnection(undefined, {
          provider,
          composioEntityId: "peterbot-user",
          accountEmail,
          enabled: true,
        });

        if (existing) {
          unchanged.push(provider);
        } else {
          added.push(provider);
        }
      }
    }

    // Find providers that were removed from Composio but still in DB
    const dbApps = await getConnectedApps();
    const removed: string[] = [];

    for (const dbApp of dbApps) {
      if (!currentProviders.has(dbApp.provider)) {
        await removeConnection(undefined, dbApp.provider);
        removed.push(dbApp.provider);
      }
    }

    return { added, removed, unchanged };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: "sdk_error",
      message: `Failed to sync from Composio: ${message}`,
    };
  }
}
```

**Step 4: Import getConnectedApps and removeConnection in service.ts**

Add to existing imports from "./repository.js":
```typescript
import {
  getConnectedApp,
  getConnectedApps,  // ADD THIS
  upsertConnection,
  removeConnection,  // ADD THIS
} from "./repository.js";
```

**Step 5: Add getConnectedApps and removeConnection to re-exports at bottom**

Add to the bottom re-export block:
```typescript
export {
  getConnectedApps,  // ADD THIS
  getConnectedApp,
  upsertConnection,
  toggleConnectionEnabled,
  removeConnection,  // ADD THIS
} from "./repository.js";
```

**Step 6: Verify service.ts compiles**

Run: `cd /home/mors/projects/antidote/peterbot && bun run dev`
Expected: Server starts without errors

**Step 7: Commit**

```bash
git add src/features/integrations/service.ts
git commit -m "feat(integrations): add syncFromComposio function"
```

---

### Task 3: Update Routes - Remove OAuth Endpoints

**Files:**
- Modify: `src/core/dashboard/integrations-routes.ts`

**Step 1: Update imports**

Change from:
```typescript
import {
  isConfigured,
  getOAuthUrl,
  validateAndConsumeState,
  checkConnection,
  revokeConnection,
} from "../../features/integrations/service.js";
```

To:
```typescript
import {
  isConfigured,
  syncFromComposio,
  revokeConnection,
} from "../../features/integrations/service.js";
```

Also remove `upsertConnection` from repository imports (no longer needed in this file).

**Step 2: Remove OAuth endpoints**

Delete the entire `POST /:provider/connect` endpoint (lines 74-110).
Delete the entire `GET /callback` endpoint (lines 112-160).

**Step 3: Verify routes compile**

Run: `cd /home/mors/projects/antidote/peterbot && bun run dev`
Expected: Server starts without errors

**Step 4: Commit**

```bash
git add src/core/dashboard/integrations-routes.ts
git commit -m "refactor(integrations): remove OAuth connect and callback endpoints"
```

---

### Task 4: Update Routes - Add Sync Endpoint and Provider Metadata

**Files:**
- Modify: `src/core/dashboard/integrations-routes.ts`

**Step 1: Add ProviderDefinition interface after imports**

```typescript
/**
 * Provider definition with metadata.
 */
interface ProviderDefinition {
  provider: string;
  label: string;
  icon: string;
  required: boolean;
  category: string;
  description: string;
}
```

**Step 2: Replace KNOWN_PROVIDERS array**

Replace the entire `KNOWN_PROVIDERS` array (lines 26-36) with:

```typescript
/**
 * Known providers with their display info and requirements.
 */
const KNOWN_PROVIDERS: ProviderDefinition[] = [
  // REQUIRED
  {
    provider: "gmail",
    label: "Gmail",
    icon: "mail",
    required: true,
    category: "Required",
    description: "Required for email processing and notifications",
  },

  // DOCUMENTS
  {
    provider: "googledocs",
    label: "Google Docs",
    icon: "file-text",
    required: false,
    category: "Documents",
    description: "Needed to read, create, and edit Google Documents",
  },
  {
    provider: "googlesheets",
    label: "Google Sheets",
    icon: "table",
    required: false,
    category: "Documents",
    description: "Needed for spreadsheet data processing",
  },
  {
    provider: "google_drive",
    label: "Google Drive",
    icon: "folder",
    required: false,
    category: "Documents",
    description: "Required for file storage and retrieval",
  },
  {
    provider: "googlecalendar",
    label: "Google Calendar",
    icon: "calendar",
    required: false,
    category: "Scheduling",
    description: "Needed for scheduling and calendar events",
  },

  // DEVELOPMENT
  {
    provider: "github",
    label: "GitHub",
    icon: "github",
    required: false,
    category: "Development",
    description: "Required for code repository management",
  },

  // PRODUCTIVITY
  {
    provider: "notion",
    label: "Notion",
    icon: "file-text",
    required: false,
    category: "Productivity",
    description: "Needed for Notion page and database access",
  },
  {
    provider: "linear",
    label: "Linear",
    icon: "check-square",
    required: false,
    category: "Productivity",
    description: "Needed for issue tracking and project management",
  },
];
```

**Step 3: Update GET / endpoint to include new fields**

In the providers mapping (around line 59), change:
```typescript
const providers = KNOWN_PROVIDERS.map((known) => {
  const app = dbAppsMap.get(known.provider);
  return {
    ...known,
    connected: !!app,
    app: app || null,
  };
});
```

To:
```typescript
const providers = KNOWN_PROVIDERS.map((known) => {
  const app = dbAppsMap.get(known.provider);
  return {
    ...known,
    connected: !!app,
    enabled: app?.enabled ?? true,
    app: app || null,
  };
});
```

**Step 4: Add POST /sync endpoint after GET / endpoint**

```typescript
  // ==========================================================================
  // POST /sync - Sync connected accounts from Composio
  // ==========================================================================
  .post("/sync", passwordAuth, async (c) => {
    const result = await syncFromComposio();

    if ("error" in result) {
      if (result.error === "not_configured") {
        return c.json(
          {
            error: "Service Unavailable",
            message: result.message,
          },
          503
        );
      }
      return c.json(
        {
          error: "Internal Server Error",
          message: result.message,
        },
        500
      );
    }

    return c.json({
      success: true,
      added: result.added,
      removed: result.removed,
      unchanged: result.unchanged,
    });
  })
```

**Step 5: Verify routes compile and test sync endpoint**

Run: `cd /home/mors/projects/antidote/peterbot && bun run dev`
Expected: Server starts without errors

Test sync (in another terminal):
```bash
curl -X POST http://localhost:3000/api/integrations/sync \
  -H "Authorization: Bearer peterbot123"
```
Expected: JSON response with added/removed/unchanged arrays

**Step 6: Commit**

```bash
git add src/core/dashboard/integrations-routes.ts
git commit -m "feat(integrations): add sync endpoint and provider metadata"
```

---

## Phase 2: Frontend - Update Types and UI

### Task 5: Update TypeScript Types

**Files:**
- Modify: `web/src/types/integration.ts`

**Step 1: Add new fields to ApiProvider interface**

Change from:
```typescript
export interface ApiProvider {
  provider: string;
  label: string;
  icon: string;
  connected: boolean;
  app: ApiConnectedApp | null;
}
```

To:
```typescript
export interface ApiProvider {
  provider: string;
  label: string;
  icon: string;
  required: boolean;
  category: string;
  description: string;
  connected: boolean;
  enabled: boolean;
  app: ApiConnectedApp | null;
}
```

**Step 2: Commit**

```bash
git add web/src/types/integration.ts
git commit -m "feat(integrations): add required, category, description, enabled to ApiProvider"
```

---

### Task 6: Update Frontend - Remove OAuth UI, Add Sync UI

**Files:**
- Modify: `web/src/routes/integrations.tsx`

**Step 1: Update imports**

Change from:
```typescript
import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
```

To:
```typescript
import { createFileRoute } from "@tanstack/react-router";
```

Add imports:
```typescript
import { Badge } from "@/components/ui/badge";
```

Add icons:
```typescript
import {
  Link2,
  Mail,
  Github,
  Folder,
  FileText,
  Calendar,
  CheckSquare,
  AlertCircle,
  ChevronDown,
  RefreshCw,
  Table,
  HelpCircle,
  ExternalLink,
  Star,
} from "lucide-react";
```

**Step 2: Add table icon to iconMap**

```typescript
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  mail: Mail,
  github: Github,
  folder: Folder,
  "file-text": FileText,
  calendar: Calendar,
  "check-square": CheckSquare,
  table: Table,  // ADD THIS
};
```

**Step 3: Add InstructionsDialog component before IntegrationsPage**

```typescript
// Instructions modal component
function InstructionsDialog({
  provider,
  open,
  onOpenChange,
}: {
  provider: ApiProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Connect {provider.label}
          </DialogTitle>
          <DialogDescription>{provider.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <p className="text-sm font-medium">Steps to connect:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>
                Go to{" "}
                <a
                  href="https://app.composio.dev/accounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Composio Dashboard
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Click "Add Account"</li>
              <li>
                Search for and select <strong>{provider.label}</strong>
              </li>
              <li>Complete the OAuth flow</li>
              <li>Return here and click "Sync from Composio"</li>
            </ol>
          </div>

          {provider.required && (
            <div className="flex items-start gap-2 text-amber-600 text-sm">
              <Star className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                This integration is <strong>required</strong> for some Peterbot
                features to work properly.
              </span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Update IntegrationsPage function signature and state**

Remove:
```typescript
const navigate = useNavigate({ from: "/integrations" });
const search = useSearch({ from: "/integrations" }) as {
  connected?: string;
  error?: string;
};
```

Add:
```typescript
const [instructionsProvider, setInstructionsProvider] =
  useState<ApiProvider | null>(null);
```

**Step 5: Remove OAuth callback handling useEffect**

Delete the entire useEffect that handles `search.connected` and `search.error`.

**Step 6: Replace connectMutation with syncMutation**

Delete `connectMutation` completely.

Add `syncMutation`:
```typescript
// Sync mutation
const syncMutation = useMutation({
  mutationFn: async () => {
    const response = await api.integrations.sync.$post();
    const result = await response.json();
    if (!response.ok) {
      throw new Error("Failed to sync");
    }
    return result as {
      success: true;
      added: string[];
      removed: string[];
      unchanged: string[];
    };
  },
  onSuccess: (result) => {
    queryClient.invalidateQueries({ queryKey: ["integrations"] });
    const total = result.added.length + result.removed.length + result.unchanged.length;
    if (total === 0) {
      toast.info("No connected accounts found in Composio");
    } else {
      toast.success(
        `Synced: ${result.added.length} added, ${result.removed.length} removed, ${result.unchanged.length} unchanged`
      );
    }
  },
  onError: (error: Error) => {
    toast.error(error.message || "Failed to sync from Composio");
  },
});
```

**Step 7: Add provider grouping logic after providers definition**

```typescript
// Group providers by category
const groupedProviders = providers.reduce(
  (acc, provider) => {
    const category = provider.category || "Other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(provider);
    return acc;
  },
  {} as Record<string, ApiProvider[]>
);
```

**Step 8: Add handler functions**

Replace `handleConnect` with `handleSync`:
```typescript
const handleSync = () => {
  syncMutation.mutate();
};
```

Remove `handleConnect` function.

**Step 9: Add getStatusBadge helper function**

```typescript
const getStatusBadge = (provider: ApiProvider) => {
  if (!provider.connected) {
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Not Connected
      </Badge>
    );
  }
  if (!provider.enabled) {
    return (
      <Badge
        variant="outline"
        className="text-amber-600 border-amber-600 bg-amber-50"
      >
        Disabled
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-green-700 border-green-700 bg-green-50"
    >
      Connected
    </Badge>
  );
};
```

**Step 10: Update header JSX - Add sync button**

Change header section from:
```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
      <Link2 className="h-8 w-8" />
      Integrations
    </h1>
    <p className="text-muted-foreground">
      Connect external apps via Composio OAuth
    </p>
  </div>
</div>
```

To:
```tsx
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
      <Link2 className="h-8 w-8" />
      Integrations
    </h1>
    <p className="text-muted-foreground">
      Manage connections via{" "}
      <a
        href="https://composio.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        Composio
      </a>
    </p>
  </div>
  {isConfigured && (
    <Button
      onClick={handleSync}
      disabled={syncMutation.isPending}
      className="gap-2"
    >
      <RefreshCw
        className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`}
      />
      Sync from Composio
    </Button>
  )}
</div>
```

**Step 11: Replace providers grid JSX with categorized view**

Replace the entire `Providers Grid` section (lines 222-331) with:

```tsx
{/* Providers by Category */}
{isConfigured &&
  !isLoading &&
  Object.entries(groupedProviders).map(([category, categoryProviders]) => (
    <div key={category} className="space-y-4">
      <h2 className="text-lg font-semibold text-muted-foreground">
        {category}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {categoryProviders.map((provider) => {
          const Icon = iconMap[provider.icon] || Link2;

          return (
            <Card key={provider.provider}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{provider.label}</span>
                      {provider.required && (
                        <Badge
                          variant="outline"
                          className="text-amber-600 border-amber-600 text-xs"
                        >
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          Required
                        </Badge>
                      )}
                      {getStatusBadge(provider)}
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>

                    {provider.connected && provider.app?.accountEmail && (
                      <p className="text-sm text-muted-foreground">
                        {provider.app.accountEmail}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      {provider.connected ? (
                        <>
                          <Switch
                            checked={provider.enabled}
                            onCheckedChange={(enabled) =>
                              handleToggle(provider.provider, enabled)
                            }
                            disabled={toggleMutation.isPending}
                          />
                          <span className="text-sm text-muted-foreground">
                            {provider.enabled ? "Enabled" : "Disabled"}
                          </span>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInstructionsProvider(provider)}
                          className="gap-1"
                        >
                          <HelpCircle className="h-4 w-4" />
                          How to Connect
                        </Button>
                      )}
                    </div>
                  </div>

                  {provider.connected && (
                    <Dialog
                      open={
                        confirmDialogOpen &&
                        revokingProvider === provider.provider
                      }
                      onOpenChange={(open) => {
                        setConfirmDialogOpen(open);
                        if (!open) setRevokingProvider(null);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleRevoke(provider.provider)}
                        >
                          Revoke
                          <ChevronDown className="h-3 w-3 ml-1" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            Revoke {provider.label} Access
                          </DialogTitle>
                          <DialogDescription>
                            Are you sure you want to revoke access to{" "}
                            {provider.label}? This will disconnect the
                            integration from both Composio and Peterbot.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setConfirmDialogOpen(false);
                              setRevokingProvider(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={confirmRevoke}
                            disabled={revokeMutation.isPending}
                          >
                            {revokeMutation.isPending
                              ? "Revoking..."
                              : "Revoke"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  ))}

{/* Instructions Modal */}
{instructionsProvider && (
  <InstructionsDialog
    provider={instructionsProvider}
    open={!!instructionsProvider}
    onOpenChange={() => setInstructionsProvider(null)}
  />
)}
```

**Step 12: Verify frontend compiles**

Run: `cd /home/mors/projects/antidote/peterbot/web && bun run dev`
Expected: Dev server starts without errors

**Step 13: Test full flow**

1. Open http://localhost:5173/integrations
2. Verify sync button appears
3. Click sync (should show toast with results)
4. Verify providers grouped by category
5. Click "How to Connect" on a provider - verify modal opens
6. Verify required badges appear on Gmail

**Step 14: Commit**

```bash
git add web/src/routes/integrations.tsx
git commit -m "feat(integrations): update UI for sync model with instructions modal"
```

---

## Phase 3: Verification & Documentation

### Task 7: End-to-End Test

**Step 1: Start backend**

Run: `cd /home/mors/projects/antidote/peterbot && bun run dev`
Expected: Server starts on port 3000

**Step 2: Start frontend**

Run: `cd /home/mors/projects/antidote/peterbot/web && bun run dev`
Expected: Dev server starts on port 5173

**Step 3: Test sync API directly**

```bash
curl -X POST http://localhost:3000/api/integrations/sync \
  -H "Authorization: Bearer peterbot123"
```

Expected response:
```json
{
  "success": true,
  "added": [],
  "removed": [],
  "unchanged": []
}
```

**Step 4: Test via UI**

1. Open http://localhost:5173/integrations
2. Login if needed
3. Click "Sync from Composio"
4. Verify toast appears with sync results
5. Verify providers grouped by category (Required, Documents, etc.)
6. Verify Gmail shows "Required" badge
7. Click "How to Connect" on a provider
8. Verify instructions modal opens with steps
9. Close modal
10. Test enable/disable toggle on connected provider

**Step 5: Commit**

```bash
git add -A
git commit -m "test(integrations): verify sync flow end-to-end"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `docs/features.md` (if exists, add integration section)
- Modify: `README.md` (update integration section)

**Step 1: Update README.md integration section**

Find the integrations section and update to explain the new sync workflow:

```markdown
## Integrations

Peterbot integrates with external services via [Composio](https://composio.dev).

### Connecting Integrations

1. Go to [Composio Dashboard](https://app.composio.dev/accounts)
2. Click "Add Account" and select the service you want to connect
3. Complete the OAuth flow
4. Return to Peterbot Integrations page
5. Click "Sync from Composio" to fetch your connections

### Available Integrations

**Required:**
- **Gmail** - Email processing and notifications

**Optional:**
- **Google Docs** - Read, create, and edit documents
- **Google Sheets** - Spreadsheet data processing
- **Google Drive** - File storage and retrieval
- **Google Calendar** - Scheduling and events
- **GitHub** - Code repository management
- **Notion** - Page and database access
- **Linear** - Issue tracking and project management

### Configuration

Set your Composio API key in `.env`:
```
COMPOSIO_API_KEY=your_api_key_here
```

Get your API key at [composio.dev](https://composio.dev).
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update integration documentation for sync model"
```

---

## Summary

This implementation plan transforms the integration architecture from OAuth-initiation to dashboard-sync:

### Changes Made
1. Removed OAuth state management and endpoints
2. Added `syncFromComposio()` function to fetch connections
3. Added `POST /api/integrations/sync` endpoint
4. Updated provider definitions with required/category/description
5. Updated UI with sync button and instructions modal
6. Grouped providers by category

### Testing
- API sync endpoint tested
- UI sync flow tested
- Instructions modal tested
- Enable/disable toggle tested

### Verification
- Backend compiles and runs
- Frontend compiles and runs
- End-to-end flow working
