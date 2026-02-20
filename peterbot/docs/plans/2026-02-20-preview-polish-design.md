# Preview Polish — Button Swap & Typography Design

**Date:** 2026-02-20
**Scope:** Soul tab and Memory tab in the settings page

## Changes

### 1. Button Order Swap

In both `soul-tab.tsx` and `memory-tab.tsx`, swap the header action buttons so the Edit/Preview toggle comes first and Save comes second:

**Before:** `[ 💾 Save ]  [ ✏️/👁️ Toggle ]`
**After:** `[ ✏️/👁️ Toggle ]  [ 💾 Save ]`

### 2. Preview Styling — @tailwindcss/typography

**Problem:** `prose` classes in the preview wrapper do nothing because `@tailwindcss/typography` is not installed. Markdown renders as unstyled HTML.

**Fix:**
- Install: `bun add @tailwindcss/typography`
- Add to `web/src/index.css`: `@plugin "@tailwindcss/typography"`
- Existing wrapper classes (`prose prose-sm dark:prose-invert max-w-none`) activate automatically
- Optionally change `prose-sm` to `prose-base` for slightly larger body text

**Result:** Clean, GitHub-style markdown rendering with proper heading hierarchy, spacing, code blocks, blockquotes, and lists. Respects dark mode via `dark:prose-invert`.

## Files Affected

- `web/src/index.css` — add `@plugin "@tailwindcss/typography"`
- `web/package.json` + `web/bun.lock` — new dependency
- `web/src/components/settings/soul-tab.tsx` — swap button order
- `web/src/components/settings/memory-tab.tsx` — swap button order

## Out of Scope

- Custom typography overrides or theme tokens
- Changing the markdown library
