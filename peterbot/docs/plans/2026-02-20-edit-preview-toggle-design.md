# Edit/Preview Toggle — Settings Page

**Date:** 2026-02-20
**Scope:** Soul tab and Memory tab in the settings page

## Problem

The Soul tab has a "Split View" button (two-column editor + preview side by side) that the user doesn't want. Memory tab has no preview at all. The desired UX is a simple Edit/Preview toggle, defaulting to Preview.

## Design

### Toggle Button

Single icon-only button in each tab's header action area:

- **Preview mode (default):** shows `Pencil` icon, tooltip "Edit" — click to switch to edit
- **Edit mode:** shows `Eye` icon, tooltip "Preview" — click to switch to preview
- Uses `Button variant="outline" size="icon"` (shadcn)

### Save Button

Replace the text "Save Changes" button with an icon-only `Save` icon button:

- `Button variant="outline" size="icon"`, tooltip "Save Changes"
- Disabled when no unsaved changes, same as before

Both buttons sit together in the header action area of each card/tab.

### Preview Mode

- Renders `editedContent` live via `ReactMarkdown` (real-time, not last-saved)
- Uses existing prose styling: `prose prose-sm dark:prose-invert max-w-none`
- Save button remains accessible in preview mode
- Memory tab gets `ReactMarkdown` added (currently edit-only)
- Soul tab: removes `isSplitView` state and all split-view layout logic; `previewContent` state removed, preview reads `editedContent` directly

### Edit Mode

- Shows `Textarea` as today (no change to editor behavior)

### Unsaved Changes Guard

When navigating away from a tab with unsaved changes:

- Uses TanStack Router's `useBlocker` hook
- Shows a custom shadcn `Dialog` with three actions:
  - **Save & Leave** — triggers save mutation, then navigates
  - **Discard & Leave** — navigates without saving
  - **Cancel** — stays on the page
- Applies to both Soul and Memory tabs
- Does not handle browser-level unload (closing the tab/window)

## Files Affected

- `web/src/components/settings/soul-tab.tsx` — remove split view, add toggle + icon-only save + blocker
- `web/src/components/settings/memory-tab.tsx` — add preview mode, toggle + icon-only save + blocker

## Out of Scope

- Blocklist, Compaction, Overview tabs (no markdown editors)
- Browser `beforeunload` event handling
- Real-time collaborative editing or conflict resolution
