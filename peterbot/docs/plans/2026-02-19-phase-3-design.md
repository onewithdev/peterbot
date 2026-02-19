# Phase 3 Design: Extensible

**Date:** 2026-02-19  
**Status:** Draft  
**Previous:** Phase 1 (Personal & Safe), Phase 2 (Proactive) — Complete

---

## Overview

Phase 3 makes peterbot truly extensible through external integrations, drop-in skills, and self-documenting capabilities. The bot becomes **self-aware**—it can check its own changelog and skills when asked "what can you do?"

**Four Features:**
1. **Dark Mode** — Dashboard theming with persistence
2. **Composio Integration** — 1000+ app connections (Google Drive, Gmail, GitHub, etc.)
3. **Skills System** — Drop-in `.skill.md` files compatible with the superpowers library (brainstorm, writing-plans, executing-plans)
4. **Document Knowledge Base** — Reference important documents (extends memory module)

**Key Principle:** The bot must be self-aware—it knows its capabilities and can reference them.

---

## Feature 8: Dark Mode

### What It Does
Toggle between light/dark themes in the dashboard, with preference persisted across sessions.

### Implementation

**Strategy:** Tailwind `dark:` class strategy with CSS variables

**Components:**
- `web/src/components/theme-toggle.tsx` — Button in sidebar
- `web/src/hooks/use-theme.ts` — Theme state management
- `web/src/index.css` — Dark variants using CSS variables

**Storage:** `localStorage` with key `peterbot-theme`, defaulting to system preference (`prefers-color-scheme`)

**Files to Modify:**
- All existing components need `dark:` variants
- Sidebar, cards, inputs, buttons prioritized

---

## Feature 9: Composio Integration

### What It Does
One-click OAuth to 1000+ apps. This single integration unlocks:
- **Files:** Google Drive, Dropbox, OneDrive
- **Email:** Gmail, Outlook (Phase 4 feature, now free)
- **GitHub:** Issues, PRs, repos (Phase 4 feature, now free)
- **Calendar:** Google Calendar (Phase 5 feature, now free)
- **CRM:** HubSpot, Salesforce
- **Project Management:** Notion, Linear, Jira

### Why Composio vs Native

| Approach | Setup | Maintenance | Coverage | Cost |
|----------|-------|-------------|----------|------|
| Composio | 1 integration | They maintain | 1000+ apps | $ (free tier) |
| Native APIs | Per-app OAuth | We maintain | Selected only | Free tiers |

**Decision:** Composio for breadth, native only for critical high-volume integrations later.

### Architecture

```
User Request → Intent Detection → Skill/Tool Router → Composio Connector → Target App
                                                    ↓
                                              Encrypted Token Store
```

### Database Schema

```typescript
// connected_apps table
{
  id: string;                    // UUID
  provider: string;              // "gmail", "github", "notion", etc.
  accountEmail: string;          // User's account identifier
  accessToken: string;           // Encrypted
  refreshToken: string;          // Encrypted
  expiresAt: Date;               // Token expiry
  scopes: string[];              // Granted permissions
  createdAt: Date;
  lastUsedAt: Date;
}
```

### API Endpoints

- `GET /api/integrations` — List available integrations
- `GET /api/integrations/connected` — List user's connected apps
- `POST /api/integrations/:provider/connect` — Initiate OAuth
- `POST /api/integrations/:provider/disconnect` — Revoke access
- `POST /api/integrations/:provider/execute` — Execute action

### Natural Language Interface

Users can say:
- "Send an email to john@example.com about the meeting"
- "Create a Google Doc with my project notes"
- "Check my GitHub notifications"

The bot maps these to Composio actions using intent detection.

### Security

- Tokens encrypted at rest using `DASHBOARD_PASSWORD` as key
- Short-lived access tokens, automatic refresh
- No token logging (only metadata)

---

## Feature 10: Skills System (Superpowers Compatible)

### What It Does
Drop `.skill.md` files into `/skills/` folder. Bot gains new capabilities. Compatible with the superpowers library (`brainstorm`, `writing-plans`, `executing-plans`).

### Clarification: Superpowers Library

The skills system is designed to work with the existing superpowers library located at:
```
~/.config/agents/skills/
├── brainstorming/SKILL.md
├── writing-plans/SKILL.md
├── executing-plans/SKILL.md
├── dispatching-parallel-agents/SKILL.md
└── ...
```

Skills can be:
1. **Copied** from superpowers library into `/skills/`
2. **Referencing** superpowers (symlink or import)
3. **Custom** skills written for peterbot specifically

### Skill File Format

```markdown
---
name: brainstorm
description: "Structured brainstorming for creative work"
trigger: "brainstorm|ideate|think about|help me explore"
tools: ["generateText"]
category: "creative"
---

# Brainstorm Skill

## When to Use

When the user wants to explore ideas, generate options, or think through possibilities.

## Process

1. Ask 2-3 clarifying questions about constraints/goals
2. Generate 5-7 diverse ideas across different angles
3. For each idea, provide: concept, pros, cons, effort level
4. Ask user which direction to explore deeper

## System Prompt Addition

You are a creative brainstorming partner. Be expansive, not critical. 
Generate quantity first, quality emerges from combinations.
Never say "that's a bad idea" — instead, find the kernel of value.

## Example Interactions

User: "I want to start a side business"
→ Clarify: time available, budget, skills, interests
→ Generate: service business, product business, content business, etc.

User: "Brainstorm features for my app"
→ Clarify: user pain points, competitor gaps, technical constraints
→ Generate: feature ideas grouped by impact/effort
```

### Skill Loader Implementation

**On startup:**
1. Scan `/skills/` directory for `.skill.md` files
2. Parse frontmatter (YAML) and body (markdown)
3. Validate required fields: `name`, `description`, `trigger`
4. Load into memory: `Map<skillName, SkillConfig>`
5. Sync to database for persistence/reference

**Database Schema:**

```typescript
// skills table
{
  id: string;                    // UUID
  name: string;                  // Unique identifier
  description: string;           // Human-readable
  triggerPattern: string;        // Regex for activation
  tools: string[];               // Required tools
  category: string;              // Grouping
  systemPrompt: string;          // Injected into AI context
  content: string;               // Full skill content
  filePath: string;              // Source file location
  enabled: boolean;              // Can disable without deleting
  createdAt: Date;
  updatedAt: Date;
}
```

### Skill Activation

**Two modes:**

1. **Explicit:** User says "use brainstorm skill" or "activate writing-plans"
2. **Implicit:** Intent detection matches skill trigger pattern

**Skill Context Injection:**

When a skill is active, its `systemPrompt` section is prepended to the AI context:

```
[Base system prompt]

[Active skill system prompt]

[User message]
```

### Skills to Include (from Superpowers)

| Skill | Purpose | Trigger Pattern |
|-------|---------|-----------------|
| `brainstorming` | Creative ideation | `brainstorm\|ideate\|think about` |
| `writing-plans` | Create implementation plans | `write a plan\|create a plan\|plan this` |
| `executing-plans` | Execute plans step-by-step | `execute plan\|run plan\|implement this` |
| `systematic-debugging` | Debug issues methodically | `debug\|fix this\|why is this broken` |
| `test-driven-development` | TDD guidance | `write tests\|tdd\|test first` |

### Dashboard Integration

Skills page (`/skills`) shows:
- List of loaded skills with enable/disable toggle
- Skill details: description, trigger, tools required
- "Test skill" button to try it out
- Import from superpowers library (copy or reference)

---

## Feature 11: Document Knowledge Base

### What It Does
Reference important documents. Extends the memory module, not a standalone RAG system.

### Simplified Approach

Instead of full vector search, this is **document reference tracking:**

1. **Manual references** — User says "remember this document" 
2. **Auto-extraction** — Bot extracts doc references from conversations
3. **Smart retrieval** — Bot knows which docs are relevant to queries
4. **Composio fetch** — If doc is in Google Drive, fetch via Composio

### Use Cases

```
User: "What did we decide about pricing?"
Bot: [checks memory → finds reference to /docs/pricing-notes.pdf]
     "Based on the Jan 15 meeting notes, you decided on tiered 
      pricing. Should I fetch the full document from Google Drive?"

User: "Remember this: https://docs.example.com/api"
Bot: [saves to document_references]
     "Got it. I'll reference the API documentation when relevant."

User: "How do I use the auth endpoint?"
Bot: [sees API docs in references, answers from context]
     "According to the API docs you saved, the auth endpoint..."
```

### Database Schema

```typescript
// document_references table
{
  id: string;                    // UUID
  name: string;                  // Display name
  source: string;                // URL, file path, or "google_drive:file_id"
  type: "web" | "pdf" | "doc" | "sheet" | "note";
  summary: string;               // AI-generated summary
  tags: string[];                // User or AI-assigned tags
  content?: string;              // Cached content (if fetched)
  cachedAt?: Date;               // When content was last fetched
  lastAccessed: Date;            // For LRU cleanup
  memoryImportance: number;      // 1-10, how important to remember
  createdAt: Date;
}
```

### Integration with Memory Module

Documents are part of the broader memory system:
- `memory.md` can reference important docs by ID
- Compaction service considers document references
- Solution memory can link to related documents

### No Full RAG (Yet)

**Decision:** Skip vector embeddings for Phase 3.

**Rationale:**
- Composio can fetch docs on-demand
- Claude has large context window (200k tokens)
- Can paste full document content when relevant
- Full RAG (Pinecone, etc.) is Phase 5 if needed

**Future:** If documents exceed context window or become numerous, add vector search.

---

## Feature 12: Self-Awareness & Changelog

### What It Does
Bot knows its own capabilities and can reference the changelog when asked.

### Changelog File

**Location:** `docs/changelog.md`

**Format:**
```markdown
# Changelog

## 2026-02-19 — Phase 2 Complete
### Features
- Added 2-way chat sync between Telegram and dashboard
- Added inline buttons for quick actions
- Added /help command with full reference
- Added changelog integration

### Improvements
- Faster job processing
- Better error messages

---

## 2026-02-17 — Phase 1 Complete
### Features
- Core bot with background job processing
- Web dashboard with auth
- Memory system (soul.md + memory.md)
- Command blocklist for security
```

### Capabilities API

**`GET /api/capabilities`** returns:
```json
{
  "version": "0.3.0",
  "phasesCompleted": ["1", "2"],
  "currentPhase": "3",
  "features": {
    "core": ["/start", "/help", "/status", "/retry", "/get"],
    "scheduling": ["/schedule", "/schedules", "/schedule delete"],
    "solutions": ["/solutions", "save this solution"],
    "chat": ["2-way sync", "message history"],
    "dashboard": ["dark mode", "job monitor", "console"]
  },
  "skills": [
    {"name": "brainstorm", "description": "...", "enabled": true},
    {"name": "writing-plans", "description": "...", "enabled": true}
  ],
  "integrations": [
    {"provider": "gmail", "connected": true, "account": "..."},
    {"provider": "github", "connected": false}
  ],
  "recentChanges": [
    {"date": "2026-02-19", "feature": "Chat sync"},
    {"date": "2026-02-17", "feature": "Core bot"}
  ]
}
```

### Bot Response to "What Can You Do?"

```
📋 Here's what I can do:

**Core Commands:**
/start — Welcome message
/help — Show commands
/status — List your jobs
/retry [id] — Retry failed job
/get [id] — Get job result

**Scheduling:**
/schedule <when> "<what>" — Create schedule
/schedules — List schedules

**Solutions:**
/solutions — List saved solutions
Reply "save this solution" to save a job

**Skills** (drop-in capabilities):
• brainstorm — Structured ideation (try: "brainstorm ideas for...")
• writing-plans — Create implementation plans
• executing-plans — Execute plans step-by-step

**Connected Apps:**
✅ Gmail (user@example.com)
✅ Google Drive
❌ GitHub (not connected — say "connect github")

**Recent Updates:**
• Chat sync between Telegram and dashboard
• Inline buttons for quick actions
• /help command

Type /changelog for full history.
```

### Commands

- `/help` — Static command reference
- `/changelog` — Full changelog
- `/skills` — List available skills
- `/whatcanido` or "what can you do?" — Dynamic capabilities

### Implementation

**Bot side:**
```typescript
// In handlers.ts
bot.hears(/what can you do|capabilities|what do you know/i, async (ctx) => {
  const capabilities = await fetchCapabilities();
  await ctx.reply(formatCapabilities(capabilities));
});
```

**Frontend:**
- Capabilities used for skills page
- Changelog displayed in about/help section

---

## Updated Roadmap

| Phase | Feature | Priority | Notes |
|-------|---------|----------|-------|
| **8** | **Dark Mode** | P1 | Quick UX win |
| **9** | **Composio Integration** | P1 | Unlocks 1000+ apps, replaces file storage need |
| **10** | **Skills System** | P1 | Superpowers compatible |
| **11** | **Document Knowledge Base** | P2 | Extends memory, no RAG yet |
| **12** | **Self-Awareness/Changelog** | P2 | Bot knows its capabilities |

**Eliminated from original roadmap:**
- UploadThing (use Google Drive via Composio)
- Standalone file section
- Full RAG system (deferred to Phase 5 if needed)

**Merged into Composio:**
- Gmail/Email integration (was Phase 4 #13)
- GitHub integration partial (was Phase 4 #17)
- Google Calendar (was Phase 5 #16)

---

## Technical Dependencies

| Feature | New Dependencies |
|---------|------------------|
| Dark Mode | None (Tailwind built-in) |
| Composio | `@composio-core/sdk` |
| Skills | `yaml` (frontmatter parsing), `glob` (file scanning) |
| Document KB | None (uses Composio for fetch) |
| Self-Awareness | None |

---

## Testing Strategy

| Feature | Test Coverage |
|---------|---------------|
| Dark Mode | Visual regression, toggle state persistence |
| Composio | Mock connector, token encryption tests |
| Skills | Parse all skill files, trigger matching, context injection |
| Document KB | CRUD operations, Composio fetch mocking |
| Self-Awareness | API response format, bot response formatting |

---

## Success Criteria

- [ ] Dashboard has working dark mode toggle
- [ ] Can connect Google Drive via Composio and access files
- [ ] Can drop `brainstorm.skill.md` into `/skills/` and bot responds to "brainstorm"
- [ ] Bot can reference saved documents in conversations
- [ ] "What can you do?" returns accurate, up-to-date capabilities
- [ ] All tests pass

---

## Open Questions

1. **Composio free tier limits:** 100 actions/month. Do we need usage tracking/warnings?
2. **Skills auto-discovery:** Should bot auto-detect new skills in `/skills/` without restart?
3. **Document caching:** How long to cache fetched Google Drive content?
4. **Changelog automation:** Should changelog be auto-generated from git commits or manual?

---

*Design complete. Ready for implementation planning.*
