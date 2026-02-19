# Phase 3: Extensible - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make peterbot extensible through skills, Composio integrations, document knowledge base, dark mode, and self-awareness

**Architecture:** Build vertical slices (keystone manual core) - each feature has DB → API → UI in sequence. Skills system is the foundation that other features build upon. Elephant carpaccio approach: thin, testable increments.

**Tech Stack:** Bun, SQLite (Drizzle), React (TanStack Router), Tailwind CSS, Grammy (Telegram)

---

## Prerequisites

**Working directory:** `/home/mors/projects/antidote/peterbot` (project root)

**Verify base system works:**
```bash
bun test
```
Expected: All existing tests pass

**Database reset for development:**
```bash
rm -f data/jobs.db && bun run db:push
```

---

## Part 1: Skills System (Foundation)

The skills system is the **keystone** - everything else builds on this pattern. Skills are drop-in `.skill.md` files that extend bot capabilities.

### Task 1: Create Skills Database Schema

**Files:**
- Create: `src/features/skills/schema.ts`
- Modify: `src/db/schema.ts` (add export)

**Step 1: Write the schema**

Create `src/features/skills/schema.ts`:
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  triggerPattern: text("trigger_pattern").notNull(),
  tools: text("tools").notNull(), // JSON array
  category: text("category").notNull().default("general"),
  systemPrompt: text("system_prompt").notNull(),
  content: text("content").notNull(), // Full skill content
  filePath: text("file_path").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const insertSkillSchema = createInsertSchema(skills, {
  tools: z.array(z.string()),
});

export const selectSkillSchema = createSelectSchema(skills, {
  tools: z.array(z.string()),
});

export type Skill = z.infer<typeof selectSkillSchema>;
export type NewSkill = z.infer<typeof insertSkillSchema>;
```

**Step 2: Export from central schema**

Modify `src/db/schema.ts` - add line after chat export:
```typescript
// Skills feature
export * from "../features/skills/schema";
```

**Step 3: Run migration**

```bash
bun run db:push
```
Expected: "Created table: skills" or similar confirmation

**Step 4: Commit**
```bash
git add src/features/skills/schema.ts src/db/schema.ts
git commit -m "feat(skills): add database schema for skills"
```

---

### Task 2: Create SkillLoader Service

**Files:**
- Create: `src/features/skills/loader.ts`
- Create: `src/features/skills/parser.ts`
- Create: `src/features/skills/repository.ts`

**Step 1: Create skill parser for .skill.md files**

Create `src/features/skills/parser.ts`:
```typescript
import { z } from "zod";
import type { NewSkill } from "./schema";

const frontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  trigger: z.string().min(1),
  tools: z.array(z.string()).default([]),
  category: z.string().default("general"),
});

export type ParsedSkill = Omit<NewSkill, "id" | "createdAt" | "updatedAt">;

export function parseSkillFile(content: string, filePath: string): ParsedSkill {
  // Extract frontmatter between --- markers
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    throw new Error(`No frontmatter found in ${filePath}`);
  }

  const frontmatterRaw = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Parse simple YAML-like frontmatter
  const meta: Record<string, unknown> = {};
  for (const line of frontmatterRaw.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Handle quoted strings
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse arrays (e.g., tools: ["generateText"])
      if (value.startsWith("[") && value.endsWith("]")) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          // Keep as string if parsing fails
        }
      }
      
      meta[key] = value;
    }
  }

  const parsed = frontmatterSchema.parse(meta);

  // Extract system prompt from body (section after "## System Prompt Addition")
  const systemPromptMatch = body.match(/## System Prompt Addition\n+([\s\S]*?)(?=\n## |$)/);
  const systemPrompt = systemPromptMatch 
    ? systemPromptMatch[1].trim() 
    : "";

  return {
    name: parsed.name,
    description: parsed.description,
    triggerPattern: parsed.trigger,
    tools: parsed.tools,
    category: parsed.category,
    systemPrompt,
    content: body,
    filePath,
    enabled: true,
  };
}
```

**Step 2: Create repository**

Create `src/features/skills/repository.ts`:
```typescript
import type { DB } from "../../db";
import { skills, type Skill, type NewSkill } from "./schema";
import { eq, like } from "drizzle-orm";

export async function getAllSkills(db: DB): Promise<Skill[]> {
  return db.select().from(skills).orderBy(skills.name);
}

export async function getSkillByName(db: DB, name: string): Promise<Skill | undefined> {
  const results = await db.select().from(skills).where(eq(skills.name, name)).limit(1);
  return results[0];
}

export async function getEnabledSkills(db: DB): Promise<Skill[]> {
  return db.select().from(skills).where(eq(skills.enabled, true));
}

export async function createSkill(db: DB, data: NewSkill): Promise<Skill> {
  const now = new Date();
  const id = crypto.randomUUID();
  
  await db.insert(skills).values({
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
  });

  return (await getSkillByName(db, data.name))!;
}

export async function updateSkill(db: DB, id: string, data: Partial<NewSkill>): Promise<void> {
  await db.update(skills)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(skills.id, id));
}

export async function deleteSkill(db: DB, id: string): Promise<void> {
  await db.delete(skills).where(eq(skills.id, id));
}

export async function toggleSkill(db: DB, id: string, enabled: boolean): Promise<void> {
  await db.update(skills)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(skills.id, id));
}
```

**Step 3: Create loader service**

Create `src/features/skills/loader.ts`:
```typescript
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { DB } from "../../db";
import { parseSkillFile } from "./parser";
import { createSkill, getSkillByName, updateSkill } from "./repository";

const SKILLS_DIR = "./skills";

export async function loadSkillsFromDisk(db: DB): Promise<number> {
  let loaded = 0;
  
  try {
    const files = await readdir(SKILLS_DIR);
    const skillFiles = files.filter(f => f.endsWith(".skill.md"));

    for (const file of skillFiles) {
      const filePath = join(SKILLS_DIR, file);
      
      try {
        const content = await readFile(filePath, "utf-8");
        const parsed = parseSkillFile(content, filePath);

        // Check if skill already exists
        const existing = await getSkillByName(db, parsed.name);
        
        if (existing) {
          // Update if content changed
          if (existing.content !== parsed.content || 
              existing.systemPrompt !== parsed.systemPrompt) {
            await updateSkill(db, existing.id, {
              ...parsed,
              enabled: existing.enabled, // Preserve enabled state
            });
          }
        } else {
          // Create new skill
          await createSkill(db, parsed);
          loaded++;
        }
      } catch (error) {
        console.error(`Failed to load skill from ${file}:`, error);
      }
    }
  } catch (error) {
    // Skills directory doesn't exist yet
    console.log("Skills directory not found, creating...");
    await Bun.write(join(SKILLS_DIR, ".gitkeep"), "");
  }

  return loaded;
}

export async function syncSkills(db: DB): Promise<{ loaded: number; total: number }> {
  const loaded = await loadSkillsFromDisk(db);
  const { count } = await import("drizzle-orm");
  const [{ value }] = await db.select({ value: count() }).from(
    await import("./schema").then(m => m.skills)
  );
  return { loaded, total: value };
}
```

**Step 4: Write test for parser**

Create `src/features/skills/parser.test.ts`:
```typescript
import { describe, it, expect } from "bun:test";
import { parseSkillFile } from "./parser";

describe("parseSkillFile", () => {
  it("parses valid skill file with frontmatter", () => {
    const content = `---
name: brainstorm
description: "Structured brainstorming for creative work"
trigger: "brainstorm|ideate|think about"
tools: ["generateText"]
category: "creative"
---

# Brainstorm Skill

## When to Use

When exploring ideas.

## System Prompt Addition

You are a creative brainstorming partner.
`;

    const result = parseSkillFile(content, "/skills/brainstorm.skill.md");

    expect(result.name).toBe("brainstorm");
    expect(result.description).toBe("Structured brainstorming for creative work");
    expect(result.triggerPattern).toBe("brainstorm|ideate|think about");
    expect(result.tools).toEqual(["generateText"]);
    expect(result.category).toBe("creative");
    expect(result.systemPrompt).toBe("You are a creative brainstorming partner.");
  });

  it("throws on missing frontmatter", () => {
    expect(() => parseSkillFile("No frontmatter here", "/test.md")).toThrow();
  });
});
```

**Step 5: Run tests**

```bash
bun test src/features/skills/parser.test.ts
```
Expected: PASS (2 tests)

**Step 6: Commit**
```bash
git add src/features/skills/
git commit -m "feat(skills): add loader, parser, and repository"
```

---

### Task 3: Create Skills API Routes

**Files:**
- Create: `src/core/dashboard/skills-routes.ts`
- Modify: `src/core/server.ts` (mount routes)

**Step 1: Create skills API routes**

Create `src/core/dashboard/skills-routes.ts`:
```typescript
import { Hono } from "hono";
import { db } from "../../db";
import { getAllSkills, toggleSkill, syncSkills } from "../../features/skills/loader";
import { getSkillByName, getEnabledSkills } from "../../features/skills/repository";

const app = new Hono();

// GET /api/skills - List all skills
app.get("/", async (c) => {
  const skills = await getAllSkills(db);
  return c.json({ skills });
});

// GET /api/skills/enabled - List enabled skills (for bot)
app.get("/enabled", async (c) => {
  const skills = await getEnabledSkills(db);
  return c.json({ skills });
});

// GET /api/skills/:name - Get single skill
app.get("/:name", async (c) => {
  const name = c.req.param("name");
  const skill = await getSkillByName(db, name);
  
  if (!skill) {
    return c.json({ error: "Skill not found" }, 404);
  }
  
  return c.json({ skill });
});

// POST /api/skills/:name/toggle - Enable/disable skill
app.post("/:name/toggle", async (c) => {
  const name = c.req.param("name");
  const { enabled } = await c.req.json();
  
  const skill = await getSkillByName(db, name);
  if (!skill) {
    return c.json({ error: "Skill not found" }, 404);
  }
  
  await toggleSkill(db, skill.id, enabled);
  return c.json({ success: true, enabled });
});

// POST /api/skills/sync - Reload skills from disk
app.post("/sync", async (c) => {
  const result = await syncSkills(db);
  return c.json({ success: true, ...result });
});

export default app;
```

**Step 2: Mount routes in server**

Modify `src/core/server.ts` - find where other routes are mounted and add:
```typescript
import skillsRoutes from "./dashboard/skills-routes";

// ... in route mounting section ...
app.route("/api/skills", skillsRoutes);
```

**Step 3: Test API manually**

```bash
# Start dev server in background
bun run dev &
sleep 3

# Test skills endpoint
curl -s http://localhost:3000/api/skills | head -c 200
```
Expected: `{"skills":[]}` (empty array initially)

**Step 4: Commit**
```bash
git add src/core/dashboard/skills-routes.ts src/core/server.ts
git commit -m "feat(skills): add API routes for skill management"
```

---

### Task 4: Add Skill Activation to Intent Detection

**Files:**
- Modify: `src/core/telegram/intent.ts` (add skill detection)
- Modify: `src/core/telegram/handlers.ts` (use skills in replies)

**Step 1: Add skill intent detection**

Modify `src/core/telegram/intent.ts` - add new function:
```typescript
import type { Skill } from "../../features/skills/schema";

export interface IntentResult {
  type: "quick" | "task" | "skill";
  skill?: Skill;
}

export function detectIntentWithSkills(
  text: string, 
  skills: Skill[]
): IntentResult {
  // Check for explicit skill activation
  const lowerText = text.toLowerCase();
  
  for (const skill of skills) {
    if (!skill.enabled) continue;
    
    // Check for explicit "use X skill" pattern
    const explicitPattern = new RegExp(`use\\s+${skill.name}\\s+skill`);
    if (explicitPattern.test(lowerText)) {
      return { type: "skill", skill };
    }
    
    // Check trigger pattern
    const triggerRegex = new RegExp(skill.triggerPattern, "i");
    if (triggerRegex.test(text)) {
      return { type: "skill", skill };
    }
  }
  
  // Fall back to regular intent detection
  return { type: detectIntent(text) };
}
```

Update the import and modify `detectIntent` to return `IntentResult` type consistently, or keep backward compatibility by having `detectIntentWithSkills` as a separate function.

**Step 2: Update handlers to use skills**

Modify `src/core/telegram/handlers.ts` - add skill imports and update message handler:
```typescript
import { getEnabledSkills } from "../../features/skills/repository";
import { detectIntentWithSkills } from "./intent";

// In the message handler, replace intent detection:
const enabledSkills = await getEnabledSkills(db);
const intent = detectIntentWithSkills(text, enabledSkills);

if (intent.type === "skill" && intent.skill) {
  // Skill-specific handling
  const skill = intent.skill;
  
  await ctx.replyWithChatAction("typing");
  
  const { text: response } = await generateText({
    model: getModel(),
    system: `You are peterbot. ${skill.systemPrompt}`,
    prompt: text,
  });
  
  await ctx.reply(response);
  
  // Save messages...
  return;
}

// Rest of existing quick/task handling...
```

**Step 3: Create sample skill file**

Create `skills/brainstorm.skill.md`:
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
Always ask clarifying questions before generating ideas.

## Example Interactions

User: "I want to start a side business"
→ Clarify: time available, budget, skills, interests
→ Generate: service business, product business, content business, etc.
```

**Step 4: Test skill loading**

```bash
# Sync skills
curl -X POST http://localhost:3000/api/skills/sync

# Verify skill loaded
curl -s http://localhost:3000/api/skills | jq '.skills | length'
```
Expected: `1` (brainstorm skill loaded)

**Step 5: Commit**
```bash
git add src/core/telegram/intent.ts src/core/telegram/handlers.ts skills/brainstorm.skill.md
git commit -m "feat(skills): integrate skills with intent detection and bot"
```

---

### Task 5: Add Bot Commands for Skills

**Files:**
- Modify: `src/core/telegram/handlers.ts`

**Step 1: Add /skills command**

Add to `setupHandlers` in handlers.ts:
```typescript
// Command: /skills
bot.command("skills", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  safeSaveMessage({
    chatId,
    direction: "in",
    content: "/skills",
    sender: "user",
  }).catch(() => {});

  const skills = await getEnabledSkills(db);
  
  if (skills.length === 0) {
    const response = "📚 *Skills*\n\nNo skills loaded yet.";
    await ctx.reply(response, { parse_mode: "Markdown" });
    return;
  }
  
  const lines = skills.map(s => {
    const triggers = s.triggerPattern.replace(/\|/g, ", ");
    return `• *${s.name}* — ${s.description}\n  Triggers: _${triggers}_`;
  });
  
  const response = `📚 *Available Skills (${skills.length})*\n\n${lines.join("\n\n")}`;
  await ctx.reply(response, { parse_mode: "Markdown" });
  
  safeSaveMessage({
    chatId,
    direction: "out",
    content: response,
    sender: "bot",
  }).catch(() => {});
});
```

**Step 2: Update help message**

Modify `formatHelpMessage` to include skills:
```typescript
export function formatHelpMessage(): string {
  return (
    `*📖 peterbot Commands*\n\n` +
    `*Core Commands*\n` +
    `\`/start\` — Welcome message\n` +
    `\`/help\` — Show this help\n` +
    `\`/status\` — List all your tasks\n` +
    `\`/retry [jobId]\` — Retry a failed job\n` +
    `\`/get [jobId]\` — Get completed job output\n\n` +
    `*Scheduling*\n` +
    `\`/schedule <when> "<what>"\` — Create recurring task\n` +
    `\`/schedules\` — List all schedules\n\n` +
    `*Solutions*\n` +
    `\`/solutions\` — List saved solutions\n` +
    `Reply "save this solution" to a completed job\n\n` +
    `*Skills*\n` +
    `\`/skills\` — List available skills\n` +
    `Mention skill triggers to activate them\n\n` +
    `Send any task without \`/\` to get started!`
  );
}
```

**Step 3: Commit**
```bash
git add src/core/telegram/handlers.ts
git commit -m "feat(skills): add /skills command and update help"
```

---

### Task 6: Create Skills Dashboard Page

**Files:**
- Create: `web/src/routes/skills.tsx`
- Modify: `web/src/components/sidebar.tsx` (add nav item)

**Step 1: Create skills page**

Create `web/src/routes/skills.tsx`:
```typescript
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/skills")({
  component: SkillsPage,
});

interface Skill {
  id: string;
  name: string;
  description: string;
  triggerPattern: string;
  tools: string[];
  category: string;
  enabled: boolean;
}

function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function fetchSkills() {
    try {
      const res = await fetch("/api/skills");
      const data = await res.json();
      setSkills(data.skills);
    } catch (error) {
      console.error("Failed to fetch skills:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSkill(name: string, enabled: boolean) {
    try {
      await fetch(`/api/skills/${name}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await fetchSkills();
    } catch (error) {
      console.error("Failed to toggle skill:", error);
    }
  }

  async function syncSkills() {
    setSyncing(true);
    try {
      await fetch("/api/skills/sync", { method: "POST" });
      await fetchSkills();
    } catch (error) {
      console.error("Failed to sync skills:", error);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    fetchSkills();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Skills</h1>
          <p className="text-muted-foreground">
            Drop .skill.md files into /skills/ to add capabilities
          </p>
        </div>
        <Button onClick={syncSkills} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync from Disk
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {skills.map((skill) => (
          <Card key={skill.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{skill.name}</CardTitle>
                </div>
                <Switch
                  checked={skill.enabled}
                  onCheckedChange={(checked) => toggleSkill(skill.name, checked)}
                />
              </div>
              <CardDescription>{skill.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  <span className="capitalize">{skill.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Triggers:</span>{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {skill.triggerPattern}
                  </code>
                </div>
                {skill.tools.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">Tools:</span>{" "}
                    {skill.tools.join(", ")}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {skills.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No skills loaded</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              Create .skill.md files in the /skills/ directory and click Sync to load them.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Add nav item to sidebar**

Modify `web/src/components/sidebar.tsx`:
```typescript
import { Zap } from "lucide-react";

const navItems: NavItem[] = [
  { label: "Overview", path: "/", icon: LayoutDashboard },
  { label: "Soul", path: "/soul", icon: Sparkles },
  { label: "Memory", path: "/memory", icon: Brain },
  { label: "Monitor", path: "/monitor", icon: Activity },
  { label: "Schedules", path: "/schedules", icon: Clock },
  { label: "Sessions", path: "/sessions", icon: Archive },
  { label: "Solutions", path: "/solutions", icon: BookOpen },
  { label: "Skills", path: "/skills", icon: Zap },  // ADD THIS
  { label: "Chat", path: "/chat", icon: MessageSquare },
  { label: "Config", path: "/config", icon: Settings },
  { label: "Dev Console", path: "/console", icon: Terminal, external: true },
];
```

**Step 3: Test dashboard**

Visit `http://localhost:5173/skills` - should show brainstorm skill with toggle.

**Step 4: Commit**
```bash
git add web/src/routes/skills.tsx web/src/components/sidebar.tsx
git commit -m "feat(skills): add skills dashboard page"
```

---

## Part 2: Composio Integration

External app connections via Composio for 1000+ app integrations.

### Task 7: Create Connected Apps Schema

**Files:**
- Create: `src/features/integrations/schema.ts`
- Modify: `src/db/schema.ts`

**Step 1: Create schema**

Create `src/features/integrations/schema.ts`:
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const connectedApps = sqliteTable("connected_apps", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(), // "gmail", "github", "notion", etc.
  accountEmail: text("account_email"), // User's account identifier
  accessToken: text("access_token").notNull(), // Encrypted
  refreshToken: text("refresh_token"), // Encrypted
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  scopes: text("scopes").notNull(), // JSON array
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

export const insertConnectedAppSchema = createInsertSchema(connectedApps, {
  scopes: z.array(z.string()),
});

export const selectConnectedAppSchema = createSelectSchema(connectedApps, {
  scopes: z.array(z.string()),
});

export type ConnectedApp = z.infer<typeof selectConnectedAppSchema>;
export type NewConnectedApp = z.infer<typeof insertConnectedAppSchema>;
```

**Step 2: Export from schema.ts**

```typescript
// Integrations feature
export * from "../features/integrations/schema";
```

**Step 3: Run migration**

```bash
bun run db:push
```

**Step 4: Commit**
```bash
git add src/features/integrations/schema.ts src/db/schema.ts
git commit -m "feat(integrations): add connected_apps schema"
```

---

### Task 8: Create Token Encryption Utilities

**Files:**
- Create: `src/shared/crypto.ts`
- Create: `src/shared/crypto.test.ts`

**Step 1: Create encryption module**

Create `src/shared/crypto.ts`:
```typescript
import { config } from "./config";

const ALGORITHM = "AES-GCM";

async function getKey(): Promise<CryptoKey> {
  const password = config.dashboardPassword;
  if (!password) {
    throw new Error("DASHBOARD_PASSWORD required for encryption");
  }
  
  // Derive key from password
  const encoder = new TextEncoder();
  const keyData = encoder.encode(password.padEnd(32, "0").slice(0, 32));
  
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encrypt(text: string): Promise<string> {
  const key = await getKey();
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  // Combine IV + ciphertext and base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(encryptedBase64: string): Promise<string> {
  const key = await getKey();
  
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}
```

**Step 2: Write test**

Create `src/shared/crypto.test.ts`:
```typescript
import { describe, it, expect } from "bun:test";
import { encrypt, decrypt } from "./crypto";

describe("crypto", () => {
  it("encrypts and decrypts text", async () => {
    const original = "secret-token-123";
    const encrypted = await encrypt(original);
    const decrypted = await decrypt(encrypted);
    
    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });
});
```

**Step 3: Run test**

```bash
bun test src/shared/crypto.test.ts
```
Expected: PASS

**Step 4: Commit**
```bash
git add src/shared/crypto.ts src/shared/crypto.test.ts
git commit -m "feat(crypto): add token encryption utilities"
```

---

### Task 9: Create Composio Connector Service

**Files:**
- Create: `src/features/integrations/composio.ts`
- Create: `src/features/integrations/repository.ts`

**Step 1: Create repository**

Create `src/features/integrations/repository.ts`:
```typescript
import { eq } from "drizzle-orm";
import type { DB } from "../../db";
import { connectedApps, type ConnectedApp, type NewConnectedApp } from "./schema";
import { encrypt, decrypt } from "../../shared/crypto";

export async function getAllConnectedApps(db: DB): Promise<ConnectedApp[]> {
  return db.select().from(connectedApps);
}

export async function getConnectedAppByProvider(
  db: DB, 
  provider: string
): Promise<ConnectedApp | undefined> {
  const results = await db
    .select()
    .from(connectedApps)
    .where(eq(connectedApps.provider, provider))
    .limit(1);
  return results[0];
}

export async function createConnectedApp(
  db: DB, 
  data: Omit<NewConnectedApp, "accessToken" | "refreshToken"> & { 
    accessToken: string; 
    refreshToken?: string;
  }
): Promise<ConnectedApp> {
  const now = new Date();
  const id = crypto.randomUUID();
  
  // Encrypt tokens
  const encryptedAccess = await encrypt(data.accessToken);
  const encryptedRefresh = data.refreshToken 
    ? await encrypt(data.refreshToken)
    : null;
  
  await db.insert(connectedApps).values({
    ...data,
    id,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    createdAt: now,
  });
  
  return (await getConnectedAppByProvider(db, data.provider))!;
}

export async function deleteConnectedApp(db: DB, id: string): Promise<void> {
  await db.delete(connectedApps).where(eq(connectedApps.id, id));
}

export async function getDecryptedToken(
  db: DB, 
  provider: string
): Promise<string | null> {
  const app = await getConnectedAppByProvider(db, provider);
  if (!app) return null;
  
  try {
    return await decrypt(app.accessToken);
  } catch {
    return null;
  }
}
```

**Step 2: Create Composio service stub**

Create `src/features/integrations/composio.ts`:
```typescript
// Composio integration stub
// Full implementation requires @composio/sdk

export interface ComposioConfig {
  apiKey: string;
}

export function getComposioConfig(): ComposioConfig | null {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return null;
  return { apiKey };
}

export async function initiateOAuth(provider: string): Promise<{ url: string; state: string }> {
  const config = getComposioConfig();
  if (!config) {
    throw new Error("Composio not configured");
  }
  
  // This would use actual Composio SDK
  // For now, return mock URL
  return {
    url: `https://app.composio.dev/apps/${provider}/connect`,
    state: crypto.randomUUID(),
  };
}

export async function handleCallback(
  provider: string, 
  code: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date }> {
  // Mock implementation - would call Composio API
  return {
    accessToken: `mock-${provider}-token-${Date.now()}`,
    refreshToken: `mock-${provider}-refresh`,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  };
}

export const SUPPORTED_PROVIDERS = [
  { id: "gmail", name: "Gmail", icon: "📧", description: "Send and read emails" },
  { id: "github", name: "GitHub", icon: "🐙", description: "Issues, PRs, repositories" },
  { id: "notion", name: "Notion", icon: "📝", description: "Pages and databases" },
  { id: "googledrive", name: "Google Drive", icon: "📁", description: "Files and folders" },
  { id: "slack", name: "Slack", icon: "💬", description: "Messages and channels" },
];
```

**Step 3: Commit**
```bash
git add src/features/integrations/
git commit -m "feat(integrations): add Composio connector and repository"
```

---

### Task 10: Create Composio API Routes

**Files:**
- Create: `src/core/dashboard/integration-routes.ts`
- Modify: `src/core/server.ts`

**Step 1: Create routes**

Create `src/core/dashboard/integration-routes.ts`:
```typescript
import { Hono } from "hono";
import { db } from "../../db";
import { getAllConnectedApps, createConnectedApp, deleteConnectedApp } from "../../features/integrations/repository";
import { SUPPORTED_PROVIDERS, initiateOAuth, handleCallback } from "../../features/integrations/composio";

const app = new Hono();

// GET /api/integrations - List available and connected
app.get("/", async (c) => {
  const connected = await getAllConnectedApps(db);
  
  const providers = SUPPORTED_PROVIDERS.map(p => {
    const conn = connected.find(c => c.provider === p.id);
    return {
      ...p,
      connected: !!conn,
      accountEmail: conn?.accountEmail,
    };
  });
  
  return c.json({ providers });
});

// POST /api/integrations/:provider/connect - Initiate OAuth
app.post("/:provider/connect", async (c) => {
  const provider = c.req.param("provider");
  
  try {
    const { url, state } = await initiateOAuth(provider);
    return c.json({ url, state });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /api/integrations/:provider/callback - OAuth callback
app.post("/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  const { code, accountEmail } = await c.req.json();
  
  try {
    const tokens = await handleCallback(provider, code);
    
    await createConnectedApp(db, {
      provider,
      accountEmail: accountEmail || null,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt || null,
      scopes: ["read", "write"],
    });
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

// POST /api/integrations/:provider/disconnect
app.post("/:provider/disconnect", async (c) => {
  const provider = c.req.param("provider");
  const connected = await getAllConnectedApps(db);
  const app = connected.find(a => a.provider === provider);
  
  if (app) {
    await deleteConnectedApp(db, app.id);
  }
  
  return c.json({ success: true });
});

export default app;
```

**Step 2: Mount routes**

Modify `src/core/server.ts`:
```typescript
import integrationRoutes from "./dashboard/integration-routes";

app.route("/api/integrations", integrationRoutes);
```

**Step 3: Test**

```bash
curl -s http://localhost:3000/api/integrations | jq '.providers | length'
```
Expected: `5` (supported providers)

**Step 4: Commit**
```bash
git add src/core/dashboard/integration-routes.ts src/core/server.ts
git commit -m "feat(integrations): add Composio API routes"
```

---

### Task 11: Create Integrations Dashboard UI

**Files:**
- Create: `web/src/routes/integrations.tsx`
- Modify: `web/src/components/sidebar.tsx`

**Step 1: Create integrations page**

Create `web/src/routes/integrations.tsx`:
```typescript
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Link2, LinkBreak } from "lucide-react";

export const Route = createFileRoute("/integrations")({
  component: IntegrationsPage,
});

interface Provider {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  accountEmail?: string;
}

function IntegrationsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchProviders() {
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json();
      setProviders(data.providers);
    } catch (error) {
      console.error("Failed to fetch providers:", error);
    } finally {
      setLoading(false);
    }
  }

  async function connect(providerId: string) {
    try {
      const res = await fetch(`/api/integrations/${providerId}/connect`, {
        method: "POST",
      });
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (error) {
      console.error("Failed to initiate connection:", error);
    }
  }

  async function disconnect(providerId: string) {
    try {
      await fetch(`/api/integrations/${providerId}/disconnect`, {
        method: "POST",
      });
      await fetchProviders();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  }

  useEffect(() => {
    fetchProviders();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const connected = providers.filter(p => p.connected);
  const available = providers.filter(p => !p.connected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect apps to extend peterbot capabilities
        </p>
      </div>

      {connected.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Connected</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {connected.map((provider) => (
              <Card key={provider.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{provider.name}</CardTitle>
                      {provider.accountEmail && (
                        <CardDescription>{provider.accountEmail}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect(provider.id)}
                  >
                    <LinkBreak className="mr-2 h-4 w-4" />
                    Disconnect
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Available</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {available.map((provider) => (
            <Card key={provider.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    <CardDescription>{provider.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  onClick={() => connect(provider.id)}
                >
                  <Link2 className="mr-2 h-4 w-4" />
                  Connect
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add nav item**

Modify `web/src/components/sidebar.tsx`:
```typescript
import { Link2 } from "lucide-react";

const navItems: NavItem[] = [
  // ... existing items ...
  { label: "Integrations", path: "/integrations", icon: Link2 },  // ADD
  { label: "Config", path: "/config", icon: Settings },
  // ...
];
```

**Step 3: Commit**
```bash
git add web/src/routes/integrations.tsx web/src/components/sidebar.tsx
git commit -m "feat(integrations): add integrations dashboard UI"
```

---

## Part 3: Document Knowledge Base

Simple document reference tracking (not full RAG yet).

### Task 12: Create Document References Schema

**Files:**
- Create: `src/features/documents/schema.ts`
- Modify: `src/db/schema.ts`

**Step 1: Create schema**

Create `src/features/documents/schema.ts`:
```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const documentReferences = sqliteTable("document_references", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  source: text("source").notNull(), // URL, file path, or "google_drive:file_id"
  type: text("type").notNull().$type<"web" | "pdf" | "doc" | "sheet" | "note">(),
  summary: text("summary"),
  tags: text("tags").notNull(), // JSON array
  content: text("content"), // Cached content
  cachedAt: integer("cached_at", { mode: "timestamp" }),
  lastAccessed: integer("last_accessed", { mode: "timestamp" }),
  memoryImportance: integer("memory_importance").notNull().default(5), // 1-10
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const insertDocumentSchema = createInsertSchema(documentReferences, {
  tags: z.array(z.string()),
});

export const selectDocumentSchema = createSelectSchema(documentReferences, {
  tags: z.array(z.string()),
});

export type DocumentReference = z.infer<typeof selectDocumentSchema>;
export type NewDocument = z.infer<typeof insertDocumentSchema>;
```

**Step 2: Export from schema.ts**

```typescript
// Documents feature
export * from "../features/documents/schema";
```

**Step 3: Run migration**

```bash
bun run db:push
```

**Step 4: Commit**
```bash
git add src/features/documents/schema.ts src/db/schema.ts
git commit -m "feat(documents): add document_references schema"
```

---

### Task 13: Create Document KB Service

**Files:**
- Create: `src/features/documents/repository.ts`
- Create: `src/features/documents/service.ts`

**Step 1: Create repository**

Create `src/features/documents/repository.ts`:
```typescript
import { eq, like, desc } from "drizzle-orm";
import type { DB } from "../../db";
import { documentReferences, type DocumentReference, type NewDocument } from "./schema";

export async function getAllDocuments(db: DB): Promise<DocumentReference[]> {
  return db.select().from(documentReferences).orderBy(desc(documentReferences.createdAt));
}

export async function getDocumentById(db: DB, id: string): Promise<DocumentReference | undefined> {
  const results = await db
    .select()
    .from(documentReferences)
    .where(eq(documentReferences.id, id))
    .limit(1);
  return results[0];
}

export async function searchDocuments(
  db: DB, 
  query: string
): Promise<DocumentReference[]> {
  return db
    .select()
    .from(documentReferences)
    .where(like(documentReferences.name, `%${query}%`))
    .orderBy(desc(documentReferences.memoryImportance));
}

export async function createDocument(
  db: DB, 
  data: Omit<NewDocument, "id" | "createdAt">
): Promise<DocumentReference> {
  const now = new Date();
  const id = crypto.randomUUID();
  
  await db.insert(documentReferences).values({
    ...data,
    id,
    createdAt: now,
  });
  
  return (await getDocumentById(db, id))!;
}

export async function updateDocument(
  db: DB, 
  id: string, 
  data: Partial<NewDocument>
): Promise<void> {
  await db
    .update(documentReferences)
    .set(data)
    .where(eq(documentReferences.id, id));
}

export async function deleteDocument(db: DB, id: string): Promise<void> {
  await db.delete(documentReferences).where(eq(documentReferences.id, id));
}

export async function touchDocument(db: DB, id: string): Promise<void> {
  await db
    .update(documentReferences)
    .set({ lastAccessed: new Date() })
    .where(eq(documentReferences.id, id));
}
```

**Step 2: Create service**

Create `src/features/documents/service.ts`:
```typescript
import type { DB } from "../../db";
import { getAllDocuments, searchDocuments, createDocument, deleteDocument } from "./repository";

export async function listDocuments(db: DB) {
  return getAllDocuments(db);
}

export async function findDocumentsByTags(db: DB, tags: string[]) {
  const docs = await getAllDocuments(db);
  return docs.filter(d => tags.some(t => d.tags.includes(t)));
}

export async function addDocument(
  db: DB,
  data: {
    name: string;
    source: string;
    type: "web" | "pdf" | "doc" | "sheet" | "note";
    summary?: string;
    tags?: string[];
  }
) {
  return createDocument(db, {
    ...data,
    tags: data.tags || [],
    memoryImportance: 5,
  });
}

export async function removeDocument(db: DB, id: string) {
  return deleteDocument(db, id);
}
```

**Step 3: Commit**
```bash
git add src/features/documents/
git commit -m "feat(documents): add repository and service"
```

---

### Task 14: Create Document KB API Routes

**Files:**
- Create: `src/core/dashboard/documents-routes.ts`
- Modify: `src/core/server.ts`

**Step 1: Create routes**

Create `src/core/dashboard/documents-routes.ts`:
```typescript
import { Hono } from "hono";
import { db } from "../../db";
import { getAllDocuments, createDocument, deleteDocument, getDocumentById } from "../../features/documents/repository";

const app = new Hono();

// GET /api/documents - List all documents
app.get("/", async (c) => {
  const docs = await getAllDocuments(db);
  return c.json({ documents: docs });
});

// GET /api/documents/:id - Get single document
app.get("/:id", async (c) => {
  const id = c.req.param("id");
  const doc = await getDocumentById(db, id);
  
  if (!doc) {
    return c.json({ error: "Document not found" }, 404);
  }
  
  return c.json({ document: doc });
});

// POST /api/documents - Create document
app.post("/", async (c) => {
  const body = await c.req.json();
  
  try {
    const doc = await createDocument(db, {
      name: body.name,
      source: body.source,
      type: body.type,
      summary: body.summary,
      tags: body.tags || [],
      memoryImportance: body.memoryImportance || 5,
    });
    
    return c.json({ document: doc }, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 400);
  }
});

// DELETE /api/documents/:id - Delete document
app.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await deleteDocument(db, id);
  return c.json({ success: true });
});

export default app;
```

**Step 2: Mount routes**

Modify `src/core/server.ts`:
```typescript
import documentsRoutes from "./dashboard/documents-routes";

app.route("/api/documents", documentsRoutes);
```

**Step 3: Commit**
```bash
git add src/core/dashboard/documents-routes.ts src/core/server.ts
git commit -m "feat(documents): add document API routes"
```

---

### Task 15: Create Documents Dashboard UI

**Files:**
- Create: `web/src/routes/documents.tsx`
- Modify: `web/src/components/sidebar.tsx`

**Step 1: Create documents page**

Create `web/src/routes/documents.tsx`:
```typescript
import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, FileText, Plus, Trash2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/documents")({
  component: DocumentsPage,
});

interface Document {
  id: string;
  name: string;
  source: string;
  type: "web" | "pdf" | "doc" | "sheet" | "note";
  summary?: string;
  tags: string[];
  memoryImportance: number;
  createdAt: string;
}

function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDoc, setNewDoc] = useState({
    name: "",
    source: "",
    type: "web" as const,
    summary: "",
    tags: "",
  });

  async function fetchDocuments() {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents);
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setLoading(false);
    }
  }

  async function addDocument() {
    try {
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newDoc,
          tags: newDoc.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });
      setNewDoc({ name: "", source: "", type: "web", summary: "", tags: "" });
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to add document:", error);
    }
  }

  async function deleteDocument(id: string) {
    try {
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground">
            Reference important documents and URLs
          </p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Document Reference</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Name"
                value={newDoc.name}
                onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
              />
              <Input
                placeholder="URL or source"
                value={newDoc.source}
                onChange={(e) => setNewDoc({ ...newDoc, source: e.target.value })}
              />
              <Input
                placeholder="Summary (optional)"
                value={newDoc.summary}
                onChange={(e) => setNewDoc({ ...newDoc, summary: e.target.value })}
              />
              <Input
                placeholder="Tags (comma separated)"
                value={newDoc.tags}
                onChange={(e) => setNewDoc({ ...newDoc, tags: e.target.value })}
              />
              <Button onClick={addDocument} className="w-full">
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {documents.map((doc) => (
          <Card key={doc.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">{doc.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <span className="uppercase text-xs">{doc.type}</span>
                      {doc.tags.length > 0 && (
                        <>
                          <span>•</span>
                          {doc.tags.map(t => `#${t}`).join(" ")}
                        </>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={doc.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteDocument(doc.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {doc.summary && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{doc.summary}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {documents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No documents yet</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              Add URLs, file references, or notes for the bot to remember.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Add nav item**

Modify `web/src/components/sidebar.tsx`:
```typescript
import { FileText } from "lucide-react";

const navItems: NavItem[] = [
  // ... existing items ...
  { label: "Documents", path: "/documents", icon: FileText },  // ADD
  { label: "Integrations", path: "/integrations", icon: Link2 },
  // ...
];
```

**Step 3: Commit**
```bash
git add web/src/routes/documents.tsx web/src/components/sidebar.tsx
git commit -m "feat(documents): add documents dashboard UI"
```

---

## Part 4: Dark Mode

### Task 16: Create useTheme Hook and Theme Toggle

**Files:**
- Create: `web/src/hooks/use-theme.ts`
- Create: `web/src/components/theme-toggle.tsx`

**Step 1: Create useTheme hook**

Create `web/src/hooks/use-theme.ts`:
```typescript
import { useState, useEffect } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "peterbot-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme) || "system";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}
```

**Step 2: Create theme toggle component**

Create `web/src/components/theme-toggle.tsx`:
```typescript
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 3: Add to sidebar**

Modify `web/src/components/sidebar.tsx`:
```typescript
import { ThemeToggle } from "./theme-toggle";

// In the footer section, before logout:
<div className="border-t p-4 space-y-2">
  <div className="flex items-center justify-between">
    <span className="text-sm text-sidebar-foreground">Theme</span>
    <ThemeToggle />
  </div>
  <button onClick={handleLogout} ...>...</button>
</div>
```

**Step 4: Commit**
```bash
git add web/src/hooks/use-theme.ts web/src/components/theme-toggle.tsx web/src/components/sidebar.tsx
git commit -m "feat(theme): add dark mode toggle with persistence"
```

---

### Task 17: Add Dark Mode Classes to Components

**Files:**
- Modify: `web/src/index.css` (already has .dark class)
- Modify: `web/src/components/job-card.tsx`
- Modify: `web/src/routes/*.tsx` pages

**Step 1: Verify index.css has dark variants**

The `web/src/index.css` already has `.dark` class defined (lines 81-113). Confirm it exists.

**Step 2: Update job-card component**

Modify `web/src/components/job-card.tsx` - add dark mode classes:
```typescript
// Card should already work via CSS variables, but verify:
<Card className="...">
  // No changes needed - CSS variables handle it
```

**Step 3: Test dark mode**

Visit `http://localhost:5173`, click theme toggle, verify dark mode works.

**Step 4: Commit**
```bash
git commit -m "feat(theme): verify dark mode styling across components"
```

---

## Part 5: Self-Awareness & Changelog

### Task 18: Create Changelog and Capabilities API

**Files:**
- Create: `docs/changelog.md`
- Create: `src/features/capabilities/service.ts`
- Create: `src/core/dashboard/capabilities-routes.ts`

**Step 1: Create changelog**

Create `docs/changelog.md`:
```markdown
# Changelog

## 2026-02-19 — Phase 3 Complete
### Features
- Added Skills System - drop-in .skill.md files for extensibility
- Added Composio Integration - connect 1000+ apps
- Added Document Knowledge Base - reference important documents
- Added Dark Mode - toggle between light/dark themes
- Added self-awareness - bot knows its capabilities

## 2026-02-19 — Phase 2 Complete
### Features
- Added 2-way chat sync between Telegram and dashboard
- Added inline buttons for quick actions
- Added /help command with full reference
- Added chat history and sessions

## 2026-02-17 — Phase 1 Complete
### Features
- Core bot with background job processing
- Web dashboard with auth
- Memory system (soul.md + memory.md)
- Command blocklist for security
```

**Step 2: Create capabilities service**

Create `src/features/capabilities/service.ts`:
```typescript
import type { DB } from "../../db";
import { getEnabledSkills } from "../skills/repository";
import { getAllConnectedApps } from "../integrations/repository";

export interface Capabilities {
  version: string;
  phasesCompleted: string[];
  currentPhase: string;
  features: Record<string, string[]>;
  skills: Array<{ name: string; description: string; enabled: boolean }>;
  integrations: Array<{ provider: string; connected: boolean; account?: string }>;
  recentChanges: Array<{ date: string; feature: string }>;
}

export async function getCapabilities(db: DB): Promise<Capabilities> {
  const [skills, integrations] = await Promise.all([
    getEnabledSkills(db),
    getAllConnectedApps(db),
  ]);

  return {
    version: "0.3.0",
    phasesCompleted: ["1", "2"],
    currentPhase: "3",
    features: {
      core: ["/start", "/help", "/status", "/retry", "/get"],
      scheduling: ["/schedule", "/schedules", "/schedule delete"],
      solutions: ["/solutions", "save this solution"],
      chat: ["2-way sync", "message history"],
      dashboard: ["dark mode", "job monitor", "console"],
      skills: ["/skills", "skill triggers"],
      integrations: ["Composio apps"],
      documents: ["document references"],
    },
    skills: skills.map(s => ({
      name: s.name,
      description: s.description,
      enabled: s.enabled,
    })),
    integrations: [
      { id: "gmail", name: "Gmail", connected: integrations.some(i => i.provider === "gmail") },
      { id: "github", name: "GitHub", connected: integrations.some(i => i.provider === "github") },
      { id: "notion", name: "Notion", connected: integrations.some(i => i.provider === "notion") },
    ],
    recentChanges: [
      { date: "2026-02-19", feature: "Skills System" },
      { date: "2026-02-19", feature: "Composio Integration" },
      { date: "2026-02-19", feature: "Dark Mode" },
    ],
  };
}

export function formatCapabilities(capabilities: Capabilities): string {
  const lines = [
    "📋 Here's what I can do:\n",
    "*Core Commands:*",
    ...capabilities.features.core.map(f => `\`/${f}\``),
    "",
    "*Skills:*",
    ...capabilities.skills.map(s => `• ${s.name} — ${s.description}`),
    "",
    "*Connected Apps:*",
    ...capabilities.integrations.map(i => 
      `${i.connected ? "✅" : "❌"} ${i.name}`
    ),
  ];
  
  return lines.join("\n");
}
```

**Step 3: Create API routes**

Create `src/core/dashboard/capabilities-routes.ts`:
```typescript
import { Hono } from "hono";
import { db } from "../../db";
import { getCapabilities } from "../../features/capabilities/service";
import { readFile } from "fs/promises";

const app = new Hono();

// GET /api/capabilities
app.get("/", async (c) => {
  const capabilities = await getCapabilities(db);
  return c.json(capabilities);
});

// GET /api/changelog
app.get("/changelog", async (c) => {
  try {
    const content = await readFile("./docs/changelog.md", "utf-8");
    return c.json({ content });
  } catch {
    return c.json({ content: "# Changelog\n\nNo entries yet." });
  }
});

export default app;
```

**Step 4: Mount routes**

Modify `src/core/server.ts`:
```typescript
import capabilitiesRoutes from "./dashboard/capabilities-routes";

app.route("/api/capabilities", capabilitiesRoutes);
```

**Step 5: Test**

```bash
curl -s http://localhost:3000/api/capabilities | jq '.version'
```
Expected: `"0.3.0"`

**Step 6: Commit**
```bash
git add docs/changelog.md src/features/capabilities/ src/core/dashboard/capabilities-routes.ts src/core/server.ts
git commit -m "feat(capabilities): add self-awareness and changelog API"
```

---

### Task 19: Add Bot Commands for Self-Awareness

**Files:**
- Modify: `src/core/telegram/handlers.ts`

**Step 1: Add /changelog command**

Add to handlers:
```typescript
// Command: /changelog
bot.command("changelog", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  safeSaveMessage({
    chatId,
    direction: "in",
    content: "/changelog",
    sender: "user",
  }).catch(() => {});

  try {
    const content = await Bun.file("./docs/changelog.md").text();
    // Truncate if too long
    const recent = content.split("##").slice(0, 3).join("##");
    await ctx.reply(recent || "No changelog available.", { parse_mode: "Markdown" });
  } catch {
    await ctx.reply("Changelog not available.");
  }
});
```

**Step 2: Add /whatcanido command and natural language handler**

Add to handlers:
```typescript
import { getCapabilities, formatCapabilities } from "../../features/capabilities/service";

// Command: /whatcanido
bot.command("whatcanido", async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  safeSaveMessage({
    chatId,
    direction: "in",
    content: "/whatcanido",
    sender: "user",
  }).catch(() => {});

  const caps = await getCapabilities(db);
  const response = formatCapabilities(caps);
  
  await ctx.reply(response, { parse_mode: "Markdown" });
  
  safeSaveMessage({
    chatId,
    direction: "out",
    content: response,
    sender: "bot",
  }).catch(() => {});
});

// Natural language: "what can you do?"
bot.hears(/what can you do|what do you know|capabilities/i, async (ctx) => {
  const chatId = ctx.chat.id.toString();
  
  safeSaveMessage({
    chatId,
    direction: "in",
    content: ctx.message.text,
    sender: "user",
  }).catch(() => {});

  const caps = await getCapabilities(db);
  const response = formatCapabilities(caps);
  
  await ctx.reply(response, { parse_mode: "Markdown" });
  
  safeSaveMessage({
    chatId,
    direction: "out",
    content: response,
    sender: "bot",
  }).catch(() => {});
});
```

**Step 3: Update help message**

Add to help:
```typescript
`*Other*\n` +
`\`/changelog\` — Recent updates\n` +
`\`/whatcanido\` — What I can do\n\n` +
```

**Step 4: Commit**
```bash
git add src/core/telegram/handlers.ts
git commit -m "feat(bot): add /changelog and /whatcanido commands"
```

---

## Part 6: Final Integration

### Task 20: Final Integration and Verification

**Step 1: Run all tests**

```bash
bun test
```
Expected: All tests pass

**Step 2: Build frontend**

```bash
bun run build
```
Expected: Build succeeds

**Step 3: Run smoke tests**

```bash
# Check all API endpoints work
curl -s http://localhost:3000/api/skills
curl -s http://localhost:3000/api/integrations
curl -s http://localhost:3000/api/documents
curl -s http://localhost:3000/api/capabilities
```

**Step 4: Verify dashboard pages**
- `/skills` - Shows brainstorm skill
- `/integrations` - Shows available providers
- `/documents` - Shows empty state with add button
- Dark mode toggle works

**Step 5: Final commit**
```bash
git add .
git commit -m "feat(phase-3): complete extensible features - skills, composio, docs, dark mode, self-awareness"
```

---

## Success Criteria Checklist

- [ ] Dashboard has working dark mode toggle
- [ ] Can sync skills from `/skills/` directory
- [ ] `/skills` command lists available skills
- [ ] Skill activation works via trigger patterns
- [ ] Composio integration API endpoints work
- [ ] Document references can be created/deleted
- [ ] `/changelog` command shows recent changes
- [ ] `/whatcanido` returns accurate capabilities
- [ ] All tests pass
- [ ] Build succeeds

---

## Reference Skills to Add

After implementation, add these to `/skills/`:

### writing-plans.skill.md
```markdown
---
name: writing-plans
description: "Create implementation plans for multi-step tasks"
trigger: "write a plan|create a plan|plan this|make a plan"
tools: ["generateText"]
category: "development"
---

# Writing Plans Skill

## When to Use

When the user wants to implement something complex that needs a structured plan.

## System Prompt Addition

You are an expert implementation planner. Break tasks into small, actionable steps.
Each step should be completable in 2-5 minutes. Always include exact file paths.
Use TDD approach: write test, run to verify failure, implement, run to verify pass.
Format plans as bite-sized tasks with clear verification steps.
```

### systematic-debugging.skill.md
```markdown
---
name: systematic-debugging
description: "Debug issues methodically"
trigger: "debug|fix this|why is this broken|what's wrong"
tools: ["generateText"]
category: "development"
---

# Systematic Debugging Skill

## When to Use

When something is broken and needs methodical investigation.

## System Prompt Addition

You are a systematic debugger. Follow this process:
1. Observe the error/symptom precisely
2. Form a hypothesis about the cause
3. Design the simplest test to validate/invalidate hypothesis
4. Run the test
5. If confirmed, fix. If not, go to step 2 with new hypothesis.
Never skip steps. Never assume without testing.
```

---

*Plan complete. Ready for implementation.*
