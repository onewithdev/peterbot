# Phase 2 Design — Proactive

**Date:** 2026-02-18  
**Scope:** Slices 5-7 (Cron + Proactive Messaging, Session Auto-Compaction, Solution Memory)  
**Status:** Ready for implementation  

---

## Overview

Phase 2 transforms peterbot from a **reactive** assistant (waits for you to ask) into a **proactive** assistant (wakes up on its own, suggests helpful things). It also makes peterbot smarter about managing long conversations and learning from past successes.

**Key Philosophy:** peterbot should feel like it has a memory and initiative, not just a query engine.

---

## Architecture

### New Database Tables

```sql
-- Slice 5: Scheduled Tasks
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,           -- "Monday morning briefing"
  natural_schedule TEXT NOT NULL,      -- "every monday 9am"
  parsed_cron TEXT NOT NULL,           -- "0 9 * * 1" (internal)
  prompt TEXT NOT NULL,                -- What to execute
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at INTEGER,                 -- Timestamp
  next_run_at INTEGER NOT NULL,        -- Pre-calculated
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Slice 6: Conversation Sessions (for compaction tracking)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,                -- Links to parent job
  message_count INTEGER NOT NULL DEFAULT 0,
  summary TEXT,                        -- Auto-generated summary
  summary_generated_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Slice 7: Solution Memory
CREATE TABLE solutions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE,         -- Links to original job
  title TEXT NOT NULL,                 -- Auto or user-provided
  description TEXT,                    -- What this solution does
  tags TEXT,                           -- JSON array of keywords
  keywords TEXT,                       -- Space-separated for search
  is_saved INTEGER NOT NULL DEFAULT 0, -- Explicitly saved by user
  similarity_hash TEXT,                -- For quick matching
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
```

### New Files

```
peterbot/
├── src/features/
│   ├── cron/                    # Slice 5
│   │   ├── schema.ts
│   │   ├── repository.ts
│   │   ├── service.ts           # Schedule parsing, next-run calc
│   │   ├── natural-parser.ts    # "every monday 9am" → cron
│   │   └── cron.test.ts
│   │
│   ├── compaction/              # Slice 6
│   │   ├── schema.ts
│   │   ├── repository.ts
│   │   ├── service.ts           # Message counting, summarization
│   │   └── compaction.test.ts
│   │
│   └── solutions/               # Slice 7
│       ├── schema.ts
│       ├── repository.ts
│       ├── service.ts           # Keyword extraction, similarity
│       ├── similarity.ts        # Matching algorithm
│       └── solutions.test.ts
│
├── src/worker/
│   └── scheduler.ts             # Slice 5: Cron runner loop
│
└── src/core/dashboard/
    └── routes.ts                # Add schedule/solution endpoints
```

---

## Slice 5: Cron + Proactive Messaging

### Purpose
peterbot wakes itself up and messages you without being asked. Schedule recurring briefings, reminders, or periodic tasks.

### User Experience

**Via Telegram (Quick Add):**
```
You: /schedule every monday 9am "send me a tech news briefing"
peterbot: ✅ Schedule created! ID: sch_abc123
        Next run: Monday, Feb 23 at 9:00 AM
        
You: /schedules
peterbot: 📅 Your schedules:
        • sch_abc123: "Monday morning briefing" (every monday 9am)
          Next: in 2 days
        • sch_def456: "Daily standup prep" (every weekday 8:30am)
          Next: tomorrow
          
You: /schedule delete sch_abc123
peterbot: ✅ Schedule deleted
```

**Via Dashboard (Management):**
```
┌─────────────────────────────────────────────────────────┐
│  📅 Scheduled Tasks                                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [+ New Schedule]                                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🟢 Monday Tech Briefing                         │   │
│  │    Every Monday at 9:00 AM                      │   │
│  │    "Send me tech news briefing"                 │   │
│  │    Next: Monday, Feb 23                         │   │
│  │    [Edit] [Disable] [Delete] [Run Now]          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🟢 Daily Standup Prep                           │   │
│  │    Every weekday at 8:30 AM                     │   │
│  │    "Summarize yesterday's completed jobs"       │   │
│  │    Next: Tomorrow, 8:30 AM                      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Natural Language → Cron

Uses Vercel AI SDK with a structured output schema to parse natural language:

```typescript
// Input: "every monday 9am"
// Output: { cron: "0 9 * * 1", description: "Every Monday at 9:00 AM" }

// Input: "every weekday at 8:30am"
// Output: { cron: "30 8 * * 1-5", description: "Every weekday at 8:30 AM" }

// Input: "first day of every month"
// Output: { cron: "0 0 1 * *", description: "First day of every month at midnight" }

// Input: "every 3 hours starting at 9am"
// Output: { cron: "0 9-21/3 * * *", description: "Every 3 hours from 9 AM to 9 PM" }
```

**Fallback:** If AI parsing fails, user sees: *"I didn't understand that schedule. Try something like 'every Monday at 9am' or use the dashboard to enter a cron expression."*

### Scheduler Loop

```typescript
// New file: src/worker/scheduler.ts

const SCHEDULER_INTERVAL_MS = 60000; // Check every minute

async function schedulerLoop() {
  while (true) {
    const now = new Date();
    const dueSchedules = await getDueSchedules(db, now);
    
    for (const schedule of dueSchedules) {
      // Create a job from the schedule
      await createJobFromSchedule(db, schedule);
      
      // Update next run time
      await updateNextRunTime(db, schedule.id, calculateNextRun(schedule.parsed_cron));
      
      console.log(`[Scheduler] Created job for schedule ${schedule.id}`);
    }
    
    await Bun.sleep(SCHEDULER_INTERVAL_MS);
  }
}
```

### Dashboard Integration

New endpoints:
- `GET /api/schedules` - List all schedules
- `POST /api/schedules` - Create new schedule (validates natural language)
- `PUT /api/schedules/:id` - Update schedule
- `DELETE /api/schedules/:id` - Delete schedule
- `POST /api/schedules/:id/run` - Trigger immediate run
- `POST /api/schedules/:id/toggle` - Enable/disable

---

## Slice 6: Session Auto-Compaction

### Purpose
Long conversations slow down responses and eat context window. Auto-summarization keeps peterbot fast while preserving key information.

### Threshold
**20 messages per job** (tunable via config). When a job hits 20 exchanges, it's compacted.

### User Experience

**Telegram:**
```
peterbot: 📋 This conversation is getting long. Let me summarize what we've done so far...

        **Summary:**
        • Analyzed Q4 sales CSV (found 15% revenue growth)
        • Created 3 visualizations: trend chart, category breakdown, forecast
        • Generated PowerPoint with executive summary
        
        Continuing from here. What would you like to refine?
        
You: [continue with new request]
```

**Dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│  💾 Session Compaction                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Threshold: [20] messages    [Update]                   │
│                                                         │
│  Recent Sessions:                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Job #abc123 - Q4 Sales Analysis                 │   │
│  │ Messages: 20 → 2 (summarized)                   │   │
│  │ Summary: Analyzed Q4 sales data, created        │   │
│  │          visualizations and PowerPoint          │   │
│  │ [View Full History] [View Summary]              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Message tracking happens in job processing
async function processJob(job: Job) {
  // ... existing processing ...
  
  // Track message count
  const session = await getOrCreateSession(db, job.id);
  const newCount = await incrementMessageCount(db, session.id);
  
  // Check threshold
  if (newCount >= COMPACTION_THRESHOLD) {
    const summary = await generateSummary(job.id);
    await saveSummary(db, session.id, summary);
    await resetMessageCount(db, session.id); // Start fresh
    
    // Notify user
    await notifyCompaction(job.chatId, summary);
  }
}

async function generateSummary(jobId: string): Promise<string> {
  // Fetch conversation history
  const history = await getJobHistory(db, jobId);
  
  // Use AI to summarize
  const result = await generateText({
    model: getModel(),
    system: "Summarize this conversation concisely. List key actions and outcomes.",
    prompt: history.map(h => `User: ${h.input}\nBot: ${h.output}`).join('\n\n'),
  });
  
  return result.text;
}
```

### Ejection Point: Token-Based

Replace message count with token counting when you need finer control:

```typescript
// Future implementation
const TOKEN_THRESHOLD = 4000; // ~50% of 8k context

async function checkCompaction(jobId: string) {
  const tokens = await countTokens(jobId); // Using tiktoken
  if (tokens > TOKEN_THRESHOLD) {
    await compactSession(jobId);
  }
}
```

---

## Slice 7: Solution Memory

### Purpose
Stop solving the same problems twice. peterbot remembers what worked and proactively suggests past solutions for similar new problems.

### User Experience

**Proactive Suggestion (Automatic):**
```
You: scrape product prices from amazon

peterbot: 💡 This looks similar to job #abc123 from 2 weeks ago:
        "Scrape product prices from competitor sites"
        
        That solution used: Python + BeautifulSoup + pandas
        Output: CSV with pricing comparison
        
        [View Solution] [Use This Approach] [Ignore]
        
You: Use this approach

peterbot: ✅ Using the same approach. I'll adapt it for Amazon.
        [proceeds with adapted solution]
```

**Explicit Save:**
```
peterbot: ✅ Task complete! [job #abc123]
        
        Your CSV with pricing data is ready.
        
You: save this solution

peterbot: ✅ Solution saved! 
        Title: "Web scraping with BeautifulSoup"
        Tags: scraping, python, csv, pricing
        
        View all saved solutions: /solutions
```

**Browse Solutions (Telegram):**
```
You: /solutions

peterbot: 📚 Your Solution Playbook (3 saved):
        
        1. Web scraping with BeautifulSoup
           Tags: scraping, python, csv
           [Use] [Details]
           
        2. PDF report generation
           Tags: pdf, reporting, automation
           [Use] [Details]
           
        3. API data pipeline
           Tags: api, json, data-pipeline
           [Use] [Details]
```

**Dashboard Playbook:**
```
┌─────────────────────────────────────────────────────────┐
│  📚 Solution Playbook                                   │
├─────────────────────────────────────────────────────────┤
│  [Search solutions...]                                  │
│                                                         │
│  Tags: [scraping] [python] [csv] [pdf] [api] [+ more]  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ ⭐ Web Scraping with BeautifulSoup              │   │
│  │    Tags: scraping, python, csv, pricing        │   │
│  │    Used 3 times • Last: 2 days ago             │   │
│  │    "Scrapes product prices and outputs CSV"    │   │
│  │    [View] [Edit] [Delete] [Use for New Job]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ PDF Report Generation                           │   │
│  │    Tags: pdf, reporting, python                │   │
│  │    Used 1 time • Last: 1 week ago              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Similarity Algorithm (Keyword Overlap)

```typescript
function calculateSimilarity(jobA: string, jobB: string): number {
  // Extract keywords (nouns, verbs, important terms)
  const keywordsA = extractKeywords(jobA);
  const keywordsB = extractKeywords(jobB);
  
  // Jaccard similarity: intersection / union
  const intersection = keywordsA.filter(k => keywordsB.includes(k));
  const union = [...new Set([...keywordsA, ...keywordsB])];
  
  return intersection.length / union.length;
}

function extractKeywords(text: string): string[] {
  // Simple approach: lowercase, split, filter common words
  const stopwords = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'from', 'in', 'on', 'with']);
  
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopwords.has(word));
}

// Usage: Find similar solutions
async function findSimilarSolutions(input: string): Promise<Solution[]> {
  const inputKeywords = extractKeywords(input);
  const allSolutions = await getAllSolutions(db);
  
  const scored = allSolutions.map(solution => ({
    solution,
    score: calculateKeywordOverlap(inputKeywords, solution.keywords.split(' '))
  }));
  
  // Return top 3 matches above threshold
  return scored
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.solution);
}
```

### Ejection Point: Embeddings

Upgrade to semantic similarity using vector embeddings:

```typescript
// Future implementation
async function findSimilarSolutions(input: string): Promise<Solution[]> {
  const inputEmbedding = await generateEmbedding(input);
  
  // Query vector database
  const similar = await db.query.solutions
    .orderBy(sql`embedding <-> ${inputEmbedding}`)
    .limit(3);
    
  return similar;
}
```

### Auto-Tagging

When a solution is created, AI automatically generates tags:

```typescript
async function autoTagSolution(jobInput: string, jobOutput: string): Promise<string[]> {
  const result = await generateObject({
    model: getModel(),
    schema: z.object({
      tags: z.array(z.string()).max(5),
      title: z.string(),
      description: z.string()
    }),
    system: "Analyze this completed task and generate tags, title, and description for future reference.",
    prompt: `Input: ${jobInput}\n\nOutput: ${jobOutput.slice(0, 500)}...`
  });
  
  return result.object;
}
```

---

## Technical Notes

### Dependencies

| Slice | New Dependency | Purpose |
|-------|---------------|---------|
| 5 | `node-cron` | Cron expression parsing and validation |
| 6 | None | Uses existing AI SDK |
| 7 | None | Uses existing AI SDK |

### Performance Considerations

1. **Scheduler loop** runs every minute (configurable)
   - Lightweight: just queries `schedules` table for `next_run_at <= now`
   - Creates job, updates timestamp, done

2. **Solution similarity** computed on-demand
   - Only when new job starts
   - Cached for 5 minutes per session

3. **Session compaction** triggers at threshold
   - One-time cost when hitting 20 messages
   - Summary stored, counter reset

### Testing Strategy

Each slice needs:
1. **Unit tests:** Schedule parsing, keyword extraction, similarity scoring
2. **Integration tests:** Full flow (create schedule → wait → job created)
3. **Manual smoke test:** Verify proactive messages, suggestions appear

---

## Implementation Order

1. **Slice 5 (Cron)** — Most user-facing impact, builds on existing job system
2. **Slice 6 (Compaction)** — Standalone, improves existing behavior
3. **Slice 7 (Solutions)** — Depends on job history, most complex

---

## Success Criteria

- [ ] User can create schedules via Telegram using natural language
- [ ] User can manage schedules in dashboard
- [ ] Scheduled jobs execute automatically at correct times
- [ ] Conversations auto-summarize after 20 messages
- [ ] peterbot proactively suggests similar past solutions
- [ ] User can save/bookmark solutions explicitly
- [ ] Dashboard shows Solution Playbook with tags
- [ ] All tests pass (`bun test`)

---

## Ejection Points

| # | Simple Start | Upgrade To |
|---|--------------|------------|
| 6 | Message count threshold (20) | Token-based threshold |
| 7 | Keyword overlap similarity | Vector embedding similarity |
| 5 | AI natural language parsing | Hybrid: presets + cron expressions |
