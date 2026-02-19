# Peterbot Repairs Design Document

**Date:** 2026-02-19  
**Author:** User + Kimi  
**Status:** Draft - Pending Review

---

## Overview

This document outlines the design for repairing several issues in peterbot and implementing UI restructuring as requested by the user.

## Issues to Address

### 1. Telegram Inline Options Not Appearing
**Problem:** Users don't see inline keyboard buttons (Schedule, Save, Help) after task completion in Telegram.

**Current Behavior:**
- Worker sends `reply_markup: keyboard` with `sendMessage`
- No `parse_mode` specified alongside keyboard
- Buttons may not be rendering or may have layout issues

**Root Cause Analysis:**
- Possible conflict between keyboard and parse_mode
- InlineKeyboard may need explicit row() calls for proper layout
- Worker may not be delivering results in certain scenarios

**Proposed Fix:**
```typescript
// In worker.ts deliverResult()
await bot.api.sendMessage(job.chatId, fullMessage, {
  reply_markup: keyboard,
  parse_mode: undefined, // Ensure no parse_mode conflict
});
```

**Layout Improvement:**
Buttons should be arranged horizontally:
```
[📅 Schedule this] [💾 Save solution] [❔ Help]
```

---

### 2. soul.md Reset Protection
**Problem:** `soul.md` gets reset to "test" unexpectedly.

**Current Behavior:**
- File content becomes just the word "test"
- Not the default content defined in `DEFAULT_CONFIG_CONTENT`
- Happens intermittently, possibly during test runs

**Root Cause Analysis:**
- Tests use `_setTestProjectRoot()` for isolation
- Possible race condition or improper cleanup
- Direct file writes somewhere writing "test"

**Proposed Fix:**
1. Add file content validation before writes
2. Create backup before overwriting
3. Add audit logging for file modifications
4. Ensure test isolation is bulletproof

```typescript
// Add to files.ts
export async function writeConfigFileSafe(
  type: ConfigFileType,
  content: string,
  options: { backup?: boolean; validate?: boolean } = {}
): Promise<void> {
  // Validate content isn't just "test" or suspiciously short
  if (options.validate && content.trim().length < 10) {
    throw new Error(`Suspicious content for ${type}: content too short`);
  }
  
  // Create backup if file exists
  if (options.backup) {
    await createBackup(type);
  }
  
  await writeConfigFile(type, content);
}
```

---

### 3. Documents Storage: Google Drive with Subfolders
**Problem:** Documents are currently stored only in SQLite. User wants them organized in Google Drive.

**Current Behavior:**
- Documents cached locally in SQLite
- Google Drive only used for fetching via Composio
- No folder structure

**Proposed Design:**

#### Folder Structure in Google Drive:
```
peterbot/                          # Root folder
├── documents/                     # Saved documents
│   ├── web/                       # Web-saved documents
│   └── uploads/                   # Local file uploads
├── exports/                       # Job outputs exported to Drive
└── backups/                       # System backups
```

#### API Changes:
```typescript
// New document storage interface
interface DocumentStorageConfig {
  provider: 'google_drive' | 'local';
  folderPath: string;
  syncMode: 'primary' | 'backup' | 'sync';
}

// Document metadata in SQLite
interface DocumentReference {
  id: string;
  name: string;
  localPath: string | null;        // Local cache path
  driveFileId: string | null;      // Google Drive file ID
  driveFolderPath: string;         // Full path in Drive
  source: string;                  // Original source URL/path
  type: 'web' | 'upload' | 'drive';
  // ... other fields
}
```

#### Flow: Save Web Document
1. Fetch content from URL
2. Save to local SQLite (existing)
3. Upload to Google Drive: `peterbot/documents/web/{sanitized_name}.md`
4. Store Drive file ID in document record

#### Flow: Upload Local File
1. Accept file upload via dashboard
2. Save to local storage: `storage/uploads/`
3. Upload to Google Drive: `peterbot/documents/uploads/{filename}`
4. Create document record with both paths

---

### 4. Local File Upload for Documents
**Problem:** Currently can only save URLs. User wants to upload local files.

**UI Changes:**
- Add "Upload File" button to Documents page
- Drag-and-drop support
- File type validation (txt, md, pdf, doc, docx)

**API Changes:**
```typescript
// New endpoint
POST /api/documents/upload
Content-Type: multipart/form-data

Body:
- file: File (binary)
- name: string (optional, defaults to filename)
- folder: string (optional, defaults to "uploads")
```

**Storage:**
- Local: `storage/uploads/{filename}`
- Drive: `peterbot/documents/uploads/{filename}`

---

### 5. UI Restructure: Config → Settings (Tabbed)
**Current:** Single Config page showing only Blocklist

**New Design:** Settings page with tabs:

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                    [Save btn] │
├─────────────────────────────────────────────────────────┤
│  [Overview] [Soul] [Memory] [Blocklist]                  │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Tab Content:                                           │
│  • Overview: System health, version, stats              │
│  • Soul: Personality editor (from current Soul page)    │
│  • Memory: Memory editor (from current Memory page)     │
│  • Blocklist: Command restrictions (from current Config)│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Route Changes:**
- `/config` → `/settings`
- Remove `/soul` and `/memory` as separate routes
- Consolidate into `/settings/:tab`

**Data Structure:**
```typescript
interface SettingsTab {
  id: string;
  label: string;
  icon: IconComponent;
  component: ReactComponent;
}

const settingsTabs: SettingsTab[] = [
  { id: 'overview', label: 'Overview', icon: Activity, component: OverviewTab },
  { id: 'soul', label: 'Soul', icon: Sparkles, component: SoulTab },
  { id: 'memory', label: 'Memory', icon: Brain, component: MemoryTab },
  { id: 'blocklist', label: 'Blocklist', icon: Shield, component: BlocklistTab },
];
```

---

### 6. UI Restructure: Monitor → Jobs (Tabbed)
**Current:** Monitor page shows job list only

**New Design:** Jobs page with tabs:

```
┌─────────────────────────────────────────────────────────┐
│  Jobs                                                   │
├─────────────────────────────────────────────────────────┤
│  [Job Monitor] [Job History]                            │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Job Monitor Tab:                                       │
│  • Current jobs (pending, running)                      │
│  • Recent completed jobs                                │
│  • Cancel action for pending/running                    │
│                                                         │
│  Job History Tab:                                       │
│  • Paginated list of all completed/failed jobs          │
│  • Search/filter by date, status, content               │
│  • Export to CSV                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Route Changes:**
- `/monitor` → `/jobs`
- Move job history OUT of Memory page
- Consolidate into `/jobs/:tab`

**Job History Migration:**
- Currently in Memory page as "Recent Sessions"
- Move to Jobs/Job History tab
- Keep in database (compaction_sessions table)
- Rename "Sessions" to "Job History" for clarity

---

### 7. Navigation Reorder: Chat at Top
**Current Sidebar Order:**
1. Overview
2. Soul
3. Memory
4. Monitor
5. Schedules
6. Sessions
7. Solutions
8. Chat ←
9. Skills
10. Integrations
11. Config
12. About
13. Dev Console

**New Sidebar Order:**
1. **Chat** ← Moved to top
2. Overview
3. Jobs (was Monitor)
4. Schedules
5. Sessions
6. Solutions
7. Skills
8. Integrations
9. Settings (was Config)
10. About
11. Dev Console

---

### 8. Data Model Updates

#### Job History (formerly Sessions)
```typescript
// Keep existing schema, just rename UI labels
// Table: compaction_sessions → job_history (optional rename)
// Or keep table name, change UI only

interface JobHistoryItem {
  id: string;
  chatId: string;
  messageCount: number;
  jobIds: string[];        // Related jobs
  summary: string | null;
  createdAt: Date;
}
```

#### Document with Drive Integration
```typescript
interface Document {
  id: string;
  name: string;
  
  // Storage locations
  localPath: string | null;
  driveFileId: string | null;
  driveFolderPath: string;
  
  // Source info
  sourceType: 'web' | 'upload' | 'drive';
  sourceUrl: string | null;
  originalFilename: string | null;
  
  // Content
  content: string | null;
  contentTruncated: boolean;
  summary: string | null;
  
  // Metadata
  fileType: string;        // mime type or extension
  fileSize: number | null;
  
  // Timestamps
  cachedAt: Date | null;
  lastFetchAttemptAt: Date | null;
  lastFetchError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Implementation Phases

### Phase 1: Critical Fixes
1. Fix Telegram inline keyboard appearance
2. Add soul.md reset protection

### Phase 2: Document Improvements
3. Implement Google Drive folder structure
4. Add local file upload

### Phase 3: UI Restructure
5. Config → Settings (tabbed)
6. Monitor → Jobs (tabbed)
7. Move Chat to top
8. Move Job History to Jobs

---

## API Changes Summary

| Endpoint | Change |
|----------|--------|
| `GET /api/config` | Deprecate, redirect to settings |
| `GET /api/settings` | New - consolidated settings |
| `PUT /api/settings/:section` | New - update section (soul, memory, blocklist) |
| `GET /api/monitor` | Deprecate, redirect to jobs |
| `GET /api/jobs` | Existing - list all jobs |
| `GET /api/jobs/history` | New - paginated job history |
| `POST /api/documents/upload` | New - file upload endpoint |
| `GET /api/sessions` | Keep, but UI moves to Jobs page |

---

## UI Component Changes

### New Components
- `SettingsLayout` - Tabbed settings container
- `JobsLayout` - Tabbed jobs container
- `FileUpload` - Drag-and-drop file upload
- `DriveFolderTree` - Google Drive folder browser

### Modified Components
- `Sidebar` - Reorder navigation items
- `ConfigPage` → `SettingsPage` - Restructure with tabs
- `MonitorPage` → `JobsPage` - Restructure with tabs
- `MemoryPage` - Remove Job History section

### Removed Routes
- `/soul` (moved to /settings/soul)
- `/memory` (moved to /settings/memory)
- `/config` (moved to /settings)
- `/monitor` (moved to /jobs)

---

## Database Migrations

None required - existing schema supports the new features. Only UI labels and API routes change.

Optional: Rename `compaction_sessions` table to `job_history` for clarity.

---

## Configuration Changes

### New Environment Variables
```bash
# Google Drive folder structure
GOOGLE_DRIVE_ROOT_FOLDER=peterbot
GOOGLE_DRIVE_DOCUMENTS_SUBFOLDER=documents

# File upload settings
MAX_UPLOAD_SIZE=10485760  # 10MB
ALLOWED_UPLOAD_TYPES=txt,md,pdf,doc,docx

# Backup settings
ENABLE_CONFIG_BACKUPS=true
CONFIG_BACKUP_RETENTION_DAYS=30
```

---

## Testing Strategy

1. **Unit Tests**
   - Settings tab switching
   - Jobs tab switching
   - File upload validation
   - Drive folder path generation

2. **Integration Tests**
   - End-to-end file upload flow
   - Document sync to Drive
   - Settings persistence

3. **Manual Testing**
   - Telegram inline keyboard visibility
   - soul.md protection (try to write "test")
   - Navigation reordering
   - Tab persistence on refresh

---

## Rollback Plan

All changes are backward compatible:
- Database schema unchanged
- Old routes can redirect to new routes
- File storage is additive (doesn't delete existing)

If issues arise:
1. Revert UI changes (sidebar order, tabs)
2. Keep API changes with deprecated endpoints
3. soul.md backups allow restoration

---

## Open Questions

1. Should we keep `/soul` and `/memory` as redirects to `/settings`?
2. Should Job History show all jobs or only compacted sessions?
3. Should uploaded files be processed (OCR for PDFs, etc.)?
4. Should we sync documents bidirectionally with Drive?

---

*End of Design Document*
