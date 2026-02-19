# Integration Dashboard Sync Design

**Date:** 2026-02-19  
**Status:** Approved  
**Goal:** Transform integrations from OAuth-initiation to dashboard-sync model

## Overview

Change the integration architecture so users connect apps directly in the Composio dashboard, and Peterbot simply syncs and displays connection status. This simplifies the codebase and provides a better user experience.

## Architecture Changes

### Backend (`src/features/integrations/`)

#### 1. Remove OAuth Flow
- **Remove** `getOAuthUrl()` function from `service.ts`
- **Remove** `POST /:provider/connect` endpoint
- **Remove** `GET /callback` endpoint
- **Remove** OAuth state management (`generateStateToken`, `validateAndConsumeState`)

#### 2. Add Sync Functionality

**New function: `syncFromComposio()`**
```typescript
// Lists all connected accounts from Composio
// Maps toolkit slugs to Peterbot provider IDs
// Updates local DB with connection status
// Returns sync summary: { added: [], removed: [], unchanged: [] }
```

**New endpoint: `POST /sync`**
- Calls `syncFromComposio()`
- Returns sync results

**Toolkit to Provider Mapping:**
```typescript
const TOOLKIT_TO_PROVIDER: Record<string, string> = {
  "gmail": "gmail",
  "googledocs": "googledocs",
  "googlesheets": "googlesheets",
  "google_drive": "google_drive",
  "googlecalendar": "googlecalendar",
  "github": "github",
  "notion": "notion",
  "linear": "linear",
};
```

#### 3. Keep Existing Endpoints
- `GET /` - List integrations with connection status
- `PATCH /:provider/toggle` - Enable/disable locally
- `DELETE /:provider` - Revoke connection (still useful)

### Frontend (`web/src/routes/integrations.tsx`)

#### 1. Remove OAuth UI
- Remove `connectMutation`
- Remove "Connect" buttons
- Remove OAuth callback handling

#### 2. Add Sync UI

**New mutation: `syncMutation`**
- Calls `POST /api/integrations/sync`
- Shows toast with results
- Refreshes provider list

**New button: "Sync from Composio"**
- Prominent placement at top of page
- Loading state during sync
- Success/error toasts

#### 3. Update Provider Cards

**Status Display:**
- 🟢 **Connected** (enabled)
- 🟡 **Connected** (disabled locally)
- 🔴 **Not Connected**

**Actions:**
- **Connected:** Show "Revoke" button + enable/disable toggle
- **Not Connected:** Show "How to Connect" button (opens instructions modal)

#### 4. Add Instructions Modal

**Per-provider instructions:**
- Link to Composio dashboard: https://app.composio.dev/accounts
- Step-by-step guide
- Why this provider is needed (description)

## Provider Definitions

```typescript
const KNOWN_PROVIDERS = [
  // REQUIRED
  { 
    provider: "gmail", 
    label: "Gmail", 
    icon: "mail",
    required: true,
    category: "Required",
    description: "Required for email processing and notifications"
  },
  
  // DOCUMENTS
  { 
    provider: "googledocs", 
    label: "Google Docs", 
    icon: "file-text",
    required: false,
    category: "Documents",
    description: "Needed to read, create, and edit Google Documents"
  },
  { 
    provider: "googlesheets", 
    label: "Google Sheets", 
    icon: "table",
    required: false,
    category: "Documents",
    description: "Needed for spreadsheet data processing"
  },
  { 
    provider: "google_drive", 
    label: "Google Drive", 
    icon: "folder",
    required: false,
    category: "Documents",
    description: "Required for file storage and retrieval"
  },
  { 
    provider: "googlecalendar", 
    label: "Google Calendar", 
    icon: "calendar",
    required: false,
    category: "Scheduling",
    description: "Needed for scheduling and calendar events"
  },
  
  // DEVELOPMENT
  { 
    provider: "github", 
    label: "GitHub", 
    icon: "github",
    required: false,
    category: "Development",
    description: "Required for code repository management"
  },
];
```

## Data Flow

### Sync Process

```
User clicks "Sync from Composio"
         ↓
POST /api/integrations/sync
         ↓
client.connectedAccounts.list({ 
  userIds: ["peterbot-user"] 
})
         ↓
For each connected account:
  - Get toolkit slug (e.g., "gmail")
  - Map to provider ID (e.g., "gmail")
  - Upsert to DB with accountEmail
         ↓
Mark providers not in Composio as disconnected
         ↓
Return { added: 3, removed: 1, unchanged: 2 }
         ↓
UI toast: "Synced: 3 added, 1 removed, 2 unchanged"
```

### Error Handling

| Scenario | Response |
|----------|----------|
| Composio API error | 500 with error message |
| No connected accounts | 200 with empty arrays |
| Unknown toolkit | Log warning, skip entry |
| Duplicate accounts | Use most recent connection |

## UI Changes Summary

### Before
- "Connect" button triggers OAuth flow
- OAuth callback handling
- Complex state management

### After
- "Sync from Composio" button fetches existing connections
- "How to Connect" button shows instructions modal
- Simple list of connection statuses
- Grouped by category (Required, Documents, Scheduling, Development)

## Files to Modify

1. `src/features/integrations/service.ts` - Replace OAuth with sync
2. `src/core/dashboard/integrations-routes.ts` - Update endpoints
3. `web/src/routes/integrations.tsx` - New UI
4. `web/src/types/integration.ts` - Update types if needed

## Benefits

1. **Simpler code** - No OAuth state management
2. **Better UX** - Users manage connections in Composio's purpose-built UI
3. **More reliable** - No OAuth flow to break
4. **Clearer status** - Sync shows exact state from Composio
