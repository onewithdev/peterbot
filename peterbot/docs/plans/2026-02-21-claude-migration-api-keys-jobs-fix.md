# Design: Claude Migration + Settings-Based API Keys + Jobs Module Fixes

**Date:** 2026-02-21  
**Status:** Draft  
**Related:** Jobs module monitoring, history, schedules, solutions

---

## 1. Executive Summary

This design addresses three interconnected issues:

1. **AI Provider Migration:** Switch chat implementation to use Claude (Anthropic) as the primary AI provider via Vercel AI SDK, with Google Gemini as a fallback option only.

2. **Settings-Based API Keys:** Move all API keys from environment variables to encrypted database storage with a web UI for management. Support multiple keys per provider with individual validation and visual status indicators.

3. **Jobs Module Fixes:** Fix broken job monitoring, history, and result delivery. Ensure completed jobs properly notify both Telegram and web chat interfaces.

---

## 2. Goals

### 2.1 Primary Goals

- [G1] Use Claude (Anthropic) as the primary AI provider for all chat interactions
- [G2] Store API keys in database with AES-256 encryption, editable via web settings
- [G3] Support multiple API keys per provider with priority ordering
- [G4] Validate API keys before saving with real-time test buttons
- [G5] Fix job result delivery to web chat (currently only sends to Telegram)
- [G6] Add real-time job status updates in the web dashboard

### 2.2 Non-Goals

- Multi-user support (still single-user auth)
- Provider usage analytics/statistics
- Automatic key rotation
- Key sharing between instances

---

## 3. Architecture

### 3.1 High-Level Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Input    │────▶│  Agent Engine   │────▶│  AI Provider    │
│  (Telegram/Web) │     │                 │     │  (Claude/Gemini)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   Job Queue     │
                        │   (if async)    │
                        └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  Worker Process │────▶│  Save to Chat   │
                        │                 │     │  + Notify UI    │
                        └─────────────────┘     └─────────────────┘
```

### 3.2 API Key Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Settings UI                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Anthropic (Primary)                                      │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │  │
│  │  │ sk-...AbCd 🟢│ │sk-...XyZz 🟢│ │+ Add Key    │         │  │
│  │  │ [Test][×]   │ │ [Test][×]   │ │             │         │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Google (Fallback)                                        │  │
│  │  ┌─────────────┐ ┌─────────────┐                         │  │
│  │  │ AIza...123 🟡│ │+ Add Key    │                         │  │
│  │  │ [Test][×]   │ │             │                         │  │
│  │  └─────────────┘ └─────────────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Database       │
                    │  (Encrypted)    │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  AI Client      │
                    │  (Vercel SDK)   │
                    └─────────────────┘
```

**Key Pill Visual States:**
- 🟢 **Green:** Valid (test passed)
- 🔴 **Red:** Invalid (test failed)
- 🟡 **Yellow:** Untested (not yet validated)
- ⚫ **Gray:** Disabled (manually disabled)

---

## 4. Database Schema

### 4.1 API Keys Table

```typescript
// src/features/settings/schema.ts
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  provider: text("provider", { 
    enum: ["anthropic", "google", "zai", "moonshot"] 
  }).notNull(),
  key: text("key").notNull(),              // AES-256-GCM encrypted
  name: text("name"),                       // User-defined label
  isValid: integer("is_valid", { mode: "boolean" }).notNull().default(false),
  lastError: text("last_error"),           // Last validation error
  validatedAt: integer("validated_at", { mode: "timestamp_ms" }),
  priority: integer("priority").notNull().default(0), // 0 = highest
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  idxProvider: index("idx_api_keys_provider").on(table.provider),
  idxPriority: index("idx_api_keys_priority").on(table.priority),
  idxEnabled: index("idx_api_keys_enabled").on(table.isEnabled),
}));
```

### 4.2 Provider Settings Table

```typescript
// src/features/settings/provider-schema.ts
export const providerSettings = sqliteTable("provider_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Keys:
// - "primary_provider": "anthropic" | "google" | "zai" | "moonshot"
// - "fallback_chain": JSON array ["google", "zai", "moonshot"]
// - "model_anthropic": "claude-sonnet-4-5-20250929"
// - "model_google": "gemini-2.5-flash"
```

---

## 5. Components

### 5.1 Backend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Encryption Service | `src/shared/encryption.ts` | AES-256-GCM encrypt/decrypt |
| API Key Repository | `src/features/settings/repository.ts` | CRUD for API keys |
| Provider Settings Repository | `src/features/settings/provider-repository.ts` | Provider config CRUD |
| Provider Validation | `src/ai/validation.ts` | Test keys against providers |
| AI Provider Factory | `src/ai/provider-factory.ts` | Get active provider with fallback |
| AI Client | `src/ai/client.ts` | Main entry for AI calls |
| Settings API Routes | `src/core/dashboard/settings-routes.ts` | HTTP endpoints |
| WebSocket Handler | `src/core/websocket.ts` | Real-time job/chat updates |

### 5.2 Frontend Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Providers Settings Tab | `web/src/components/settings/providers-tab.tsx` | Main settings page |
| API Key Input | `web/src/components/settings/api-key-input.tsx` | Multi-key input with pills |
| Key Pill | `web/src/components/settings/key-pill.tsx` | Individual key display |
| Provider Card | `web/src/components/settings/provider-card.tsx` | Per-provider section |
| Job Monitor (Fixed) | `web/src/components/jobs/job-monitor-tab.tsx` | Real-time job updates |

---

## 6. API Endpoints

### 6.1 Settings API

```typescript
// GET /api/settings/keys
// Returns masked keys only
{
  keys: [
    { id: "uuid", provider: "anthropic", name: "Production", 
      maskedKey: "sk-ant-...AbCd", isValid: true, priority: 0 },
    { id: "uuid", provider: "anthropic", name: "Backup", 
      maskedKey: "sk-ant-...XyZz", isValid: true, priority: 1 }
  ]
}

// POST /api/settings/keys
// Accepts comma-separated keys, creates multiple
{ provider: "anthropic", keys: "sk-ant-xxx,sk-ant-yyy", names?: "Prod,Backup" }

// POST /api/settings/keys/:id/test
// Tests a specific key against the provider
{ valid: true } | { valid: false, error: "Invalid API key" }

// PATCH /api/settings/keys/:id
{ name?: "New Name", priority?: 2, isEnabled?: false }

// DELETE /api/settings/keys/:id
{ success: true }

// PUT /api/settings/keys/reorder
// Update priority order for multiple keys
{ keys: [{ id: "uuid", priority: 0 }, { id: "uuid2", priority: 1 }] }

// GET /api/settings/providers
{
  primary: "anthropic",
  fallbackChain: ["google", "zai", "moonshot"],
  models: {
    anthropic: "claude-sonnet-4-5-20250929",
    google: "gemini-2.5-flash"
  }
}

// PUT /api/settings/providers
{ primary: "anthropic", fallbackChain: ["google"] }
```

---

## 7. AI Provider Priority

### 7.1 Default Configuration

```yaml
Primary Provider: anthropic
  Model: claude-sonnet-4-5-20250929
  
Fallback Chain:
  1. google (gemini-2.5-flash)
  2. zai (glm-5) - if ZAI_API_KEY configured
  3. moonshot (moonshot-v1-8k) - if MOONSHOT_API_KEY configured
```

### 7.2 Key Selection Algorithm

```typescript
async function getActiveProvider(preferred?: string) {
  const provider = preferred || settings.primary;
  
  // Get all enabled, valid keys for provider, ordered by priority
  const keys = await getValidKeys(provider);
  
  for (const key of keys) {
    try {
      const model = createModel(provider, decrypt(key.key));
      return { provider, model, keyId: key.id };
    } catch (e) {
      // Mark key invalid, continue to next
      await markKeyInvalid(key.id, e.message);
    }
  }
  
  // No valid keys for preferred provider, try fallback chain
  for (const fallback of settings.fallbackChain) {
    const fallbackKeys = await getValidKeys(fallback);
    if (fallbackKeys.length > 0) {
      const model = createModel(fallback, decrypt(fallbackKeys[0].key));
      return { 
        provider: fallback, 
        model, 
        keyId: fallbackKeys[0].id,
        usedFallback: true,
        fallbackFrom: provider
      };
    }
  }
  
  // Ultimate fallback: env vars (backward compatibility)
  return getEnvFallbackProvider();
}
```

---

## 8. Jobs Module Fixes

### 8.1 Current Issues

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Job results not in web chat | `deliverResult()` saves to chat as best-effort, doesn't wait for success | Users don't see job results in dashboard |
| No real-time job updates | Job monitor polls every 15s, no push updates | Delayed visibility of job status changes |
| Skill context lost on timeout | Timeout dispatch doesn't pass `skillSystemPrompt` | Retried jobs lose skill context |
| Schedule info not in API | Jobs API doesn't join with schedules table | Can't see which schedule created a job |
| Failed deliveries silent | Delivery failures mark job delivered anyway | Lost job results |

### 8.2 Fixes

#### Fix 1: Reliable Message Saving

**Before:**
```typescript
// worker.ts
try {
  await saveMessage(...);  // Fire-and-forget
} catch (e) {
  console.error(...);
}
await markJobDelivered(job.id);  // Always marks delivered
```

**After:**
```typescript
// worker.ts
// Save message FIRST, only mark delivered if successful
const message = await saveMessage({
  chatId: job.chatId,
  direction: "out",
  content: result,
  sender: "bot",
  jobId: job.id,
});

if (message) {
  await markJobDelivered(job.id);
  broadcastToWebSocket({ type: "job_completed", jobId: job.id, message });
} else {
  // Don't mark delivered - will retry
  await incrementJobRetryCount(job.id);
}
```

#### Fix 2: Add WebSocket for Real-Time Updates

**New: `src/core/websocket.ts`**
```typescript
// Simple WebSocket server for real-time updates
// Broadcast events: job_started, job_completed, job_failed, new_message
```

**Frontend: `web/src/hooks/use-websocket.ts`**
```typescript
// Subscribe to job updates, refresh query cache on events
```

#### Fix 3: Preserve Skill Context on Timeout

**File: `src/features/agent/tools.ts`**
```typescript
// Capture active skill when creating job
export function createDispatchTaskTool(chatId: string, skillSystemPrompt?: string) {
  return tool({
    execute: async ({ input }) => {
      const job = await createJob(defaultDb, {
        type: "task",
        input,
        chatId,
        skillSystemPrompt,  // Pass skill context
      });
      return { jobId: job.id, shortId: job.id.slice(0, 8) };
    },
  });
}
```

#### Fix 4: Include Schedule Info in Jobs API

**File: `src/core/dashboard/routes.ts`**
```typescript
.get("/jobs", passwordAuth, async (c) => {
  const jobs = await getJobsByChatIdWithScheduleInfo(undefined, config.telegramChatId);
  // Join with schedules table to include schedule description
  return c.json({ jobs });
});
```

---

## 9. Security Considerations

### 9.1 Encryption

- **Algorithm:** AES-256-GCM
- **Key Source:** `ENCRYPTION_KEY` environment variable (32+ chars)
- **Storage:** Encrypted at rest in SQLite
- **Memory:** Decrypted only when needed, never logged

### 9.2 Access Control

- API key endpoints require dashboard password
- Never return full keys to frontend (only masked)
- Keys are write-only (create/delete), never readable

### 9.3 Audit Trail

- Log key creation/deletion (not the key itself)
- Log validation attempts (success/failure)
- Track which key was used for each AI call (for debugging)

---

## 10. Implementation Phases

### Phase 1: Foundation (Database + Encryption)
- [ ] Create `api_keys` table schema
- [ ] Create `provider_settings` table schema
- [ ] Implement encryption service
- [ ] Create repository layer
- [ ] Database migration

### Phase 2: Backend API
- [ ] Create settings API routes
- [ ] Implement provider validation service
- [ ] Build provider factory with multi-key support

### Phase 3: Frontend Settings UI
- [ ] Create providers settings tab
- [ ] Build API key input with pill components
- [ ] Implement test/save flows

### Phase 4: AI Client Migration
- [ ] Refactor `src/ai/client.ts` to use database keys
- [ ] Update `src/features/agent/model.ts` defaults
- [ ] Update agent tools to pass skill context

### Phase 5: Jobs Module Fixes
- [ ] Fix `deliverResult()` message saving
- [ ] Add WebSocket for real-time updates
- [ ] Add schedule info to jobs API
- [ ] Update job monitor to use WebSocket

### Phase 6: Testing & Deployment
- [ ] Test all provider validations
- [ ] Test key fallback chain
- [ ] Test job delivery to web chat
- [ ] Migration guide for env-based keys

---

## 11. Open Questions

1. **Should we auto-test keys periodically?** (e.g., daily health check)
2. **Should we support key expiration dates?** (e.g., rotate every 90 days)
3. **Should failed keys auto-disable?** (after N consecutive failures)

---

## 12. Appendix

### 12.1 Provider Test Methods

| Provider | Test Method |
|----------|-------------|
| Anthropic | List models API (cheap, fast) |
| Google | Generate minimal text (1 token) |
| Z.ai | List models or minimal generation |
| Moonshot | List models API |

### 12.2 Model Defaults

| Provider | Default Model |
|----------|---------------|
| anthropic | claude-sonnet-4-5-20250929 |
| google | gemini-2.5-flash |
| zai | glm-5 |
| moonshot | moonshot-v1-8k |

---

*End of Design Document*
