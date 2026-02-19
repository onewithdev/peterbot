# Chat Sync Fix Design

**Date:** 2026-02-19  
**Topic:** Fix Telegram ↔ Dashboard bidirectional chat synchronization  
**Status:** Design Ready for Implementation

---

## Problem Statement

The chat synchronization between Telegram and Dashboard is **asymmetric**:
- ✅ **Dashboard → Telegram**: Works correctly (messages appear in both places)
- ❌ **Telegram → Dashboard**: Messages are saved to database but may not appear in dashboard

### Root Causes Identified

1. **Test Data Pollution**: Integration tests write to production database with wrong `chatId`
2. **Timestamp Edge Case**: `getMessagesSince()` uses strict `>` (gt) comparison, potentially missing same-millisecond messages
3. **Missing Observability**: No logging to trace message flow for debugging

---

## Solution Architecture

### Fix #1: Test Database Isolation

**Problem:**  
`src/core/dashboard/routes.test.ts` sets `TELEGRAM_CHAT_ID=test_chat_123` and writes to the production database because repository functions default to `defaultDb` when no `db` parameter is provided.

**Solution:**  
Refactor tests to use dependency injection with in-memory SQLite database.

**Files to Modify:**
- `src/core/dashboard/routes.test.ts` - Inject test database
- `src/features/chat/repository.test.ts` - Verify isolation pattern

**Implementation Pattern:**
```typescript
// Before (pollutes production DB):
process.env.TELEGRAM_CHAT_ID = "test_chat_123";
await saveMessage(undefined, { ... }); // Uses defaultDb (production!)

// After (uses isolated test DB):
const testDb = createTestDb(); // In-memory SQLite
await saveMessage(testDb, { ... }); // Uses test database
```

---

### Fix #2: Inclusive Timestamp Comparison

**Problem:**  
`getMessagesSince()` in `src/features/chat/repository.ts` uses `gt()` (strictly greater than):

```typescript
.where(and(eq(chatMessages.chatId, chatId), gt(chatMessages.createdAt, since)))
```

If the frontend's `lastMessageTimestamp` equals a message's `createdAt`, that message is excluded.

**Solution:**  
Change to `gte()` (greater than or equal):

```typescript
.where(and(eq(chatMessages.chatId, chatId), gte(chatMessages.createdAt, since)))
```

**Files to Modify:**
- `src/features/chat/repository.ts` - Change `gt` to `gte` in `getMessagesSince()`

**Trade-off:**  
This may return the last message the frontend already has, but the frontend already deduplicates by ID:

```typescript
// web/src/hooks/use-chat.ts
const existingIds = new Set(currentData.messages.map(m => m.id))
const newMessages = data.messages.filter(m => !existingIds.has(m.id))
```

---

### Fix #3: Add Observability Logging

**Problem:**  
No visibility into message flow when debugging sync issues.

**Solution:**  
Add structured logging at key points:

1. **Repository Layer** - Log message saves/queries
2. **API Layer** - Log request/response counts
3. **Frontend Hook** - Log polling activity

**Files to Modify:**
- `src/features/chat/repository.ts` - Add debug logging
- `src/core/dashboard/chat-routes.ts` - Add request logging
- `web/src/hooks/use-chat.ts` - Add polling debug logs

---

## Data Flow Verification

### Current Flow (Broken)

```
Telegram Message
  ↓
[handlers.ts] saveMessage() → DB (chatId: "5276153706")
  ↓
Dashboard polls /api/chat/messages?since=<timestamp>
  ↓
[chat-routes.ts] getMessagesSince(chatId, since)
  ↓
DB Query: WHERE createdAt > since  ← MAY MISS MESSAGES
  ↓
Frontend: No new messages shown ❌
```

### Fixed Flow

```
Telegram Message
  ↓
[handlers.ts] saveMessage() → DB (chatId: "5276153706")
  ↓
Dashboard polls /api/chat/messages?since=<timestamp>
  ↓
[chat-routes.ts] getMessagesSince(chatId, since)
  ↓
DB Query: WHERE createdAt >= since  ← INCLUSIVE, RELIABLE
  ↓
Frontend: Messages appear ✓
  ↓
Dedupe by ID (already implemented)
```

---

## Implementation Plan

### Phase 1: Fix Test Isolation

**Tasks:**
1. Create `createTestDb()` helper in test utilities
2. Refactor `routes.test.ts` to inject test database
3. Verify no test data pollutes production DB

**Verification:**
```bash
# Before running tests, note message count
bun run /tmp/check-all-messages.ts

# Run tests
bun test src/core/dashboard/routes.test.ts

# Verify no new test messages in production DB
bun run /tmp/check-all-messages.ts
```

---

### Phase 2: Fix Timestamp Comparison

**Tasks:**
1. Change `gt` to `gte` in `getMessagesSince()`
2. Update repository tests to verify inclusive behavior
3. Test edge case: messages created in same millisecond

**Code Change:**
```typescript
// src/features/chat/repository.ts
import { eq, and, gt, gte, lt, asc, desc } from "drizzle-orm"; // Add gte

export async function getMessagesSince(
  db: BunSQLiteDatabase<typeof schema> = defaultDb,
  chatId: string,
  since: Date,
  limit = 50
): Promise<ChatMessage[]> {
  const results = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.chatId, chatId), gte(chatMessages.createdAt, since))) // Changed: gt → gte
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
  return results;
}
```

---

### Phase 3: Add Logging

**Tasks:**
1. Add debug logging to repository functions
2. Add request logging to chat routes
3. Add polling debug logs to frontend hook

**Example Logging:**
```typescript
// Repository
console.log(`[chat:repository] getMessagesSince: chatId=${chatId}, since=${since}, returned=${results.length}`);

// API Routes  
console.log(`[chat:api] GET /messages?since=${since} → ${messages.length} messages`);

// Frontend
console.log(`[chat:poll] since=${lastMessageTimestamp}, received=${data.messages.length} new`);
```

---

## Testing Strategy

### Unit Tests

1. **Repository Tests** - Verify `gte` behavior
   - Test that `getMessagesSince` includes messages at exact timestamp
   - Test that deduplication works with overlapping results

2. **Test Isolation** - Verify no production DB pollution
   - Run all tests
   - Verify production database unchanged

### Integration Test

1. **End-to-End Sync Test**
   - Send message via Telegram (simulated)
   - Verify appears in dashboard within polling interval
   - Send message via dashboard
   - Verify appears in Telegram

### Manual Verification

1. Open dashboard chat page
2. Send message from Telegram
3. Verify appears in dashboard within 5 seconds
4. Send message from dashboard
5. Verify appears in Telegram

---

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/chat/repository.ts` | Modify | Change `gt` → `gte` in `getMessagesSince()` |
| `src/features/chat/repository.ts` | Add | Debug logging |
| `src/core/dashboard/chat-routes.ts` | Add | Request logging |
| `src/core/dashboard/routes.test.ts` | Modify | Use test database injection |
| `src/features/chat/repository.test.ts` | Modify | Update for `gte` behavior |
| `web/src/hooks/use-chat.ts` | Add | Polling debug logs |

---

## Success Criteria

- [ ] Test data no longer pollutes production database
- [ ] Telegram messages reliably appear in dashboard within 5 seconds
- [ ] Dashboard messages reliably appear in Telegram immediately
- [ ] All existing tests pass
- [ ] New tests verify inclusive timestamp behavior

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Changing `gt` → `gte` may cause duplicates | Frontend already deduplicates by ID |
| Test refactoring may break existing tests | Run full test suite after changes |
| Logging may be noisy | Use `[chat:...]` prefix for easy filtering |

---

## Related Issues

- Database shows split chat history between `"5276153706"` (real) and `"test_chat_123"` (test pollution)
- `getMessagesSince` uses strict `>` comparison which can miss edge-case messages
