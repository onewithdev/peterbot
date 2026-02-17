# The Keystone Methodology
## A Vibe Coding / AI-Assisted Development Framework

---

> **What is Vibe Coding?**  
> Vibe coding is the practice of using AI assistants to write, refactor, and debug code through natural language conversation. Instead of typing every character, you describe intent and review AI-generated output. The Keystone Methodology provides the structure that makes vibe coding actually work at scale.

---

# Introduction: The Philosophy

The Keystone Methodology is built on a simple truth: **AI coding assistants are incredibly fast at generating code, but dangerously good at generating the wrong code.** Without guardrails, you'll end up with a codebase that looks functional but collapses under its own weight—a beautiful facade hiding rotting foundations.

This methodology treats AI as a force multiplier, not a replacement for architectural thinking. It gives you a repeatable framework for building full-stack applications that are:

- **Vertically complete** from day one (database to UI)
- **Iteratively expandable** without rewrites
- **Production-deployable** at any checkpoint
- **Team-scalable** with clear conventions

The name comes from architecture: a keystone is the central stone in an arch that locks all others in place. Your first feature—the Keystone Feature—establishes patterns that every subsequent feature follows.

---

# The Locked Tech Stack

Before writing a single line of code, you lock your technology choices. This isn't about using the "best" tools—it's about eliminating decision fatigue and ensuring AI assistants can generate consistent, compatible code.

| Layer | Tool | Purpose |
|-------|------|---------|
| **Runtime** | Bun | Fast JavaScript/TypeScript execution |
| **Backend** | Hono | Lightweight, type-safe API framework |
| **Database** | SQLite (bun:sqlite) + Drizzle | Zero-config, file-based SQL |
| **Frontend** | Vite + React | Fast dev server, modern React patterns |
| **Routing** | TanStack Router | Type-safe, file-based routing |
| **State** | TanStack Query | Server state management with caching |
| **UI** | shadcn/ui | Copy-paste component library |
| **Auth** | Better-Auth | Modern auth with multiple providers |

## Why This Stack?

**Bun** gives you a single runtime for everything—no juggling Node versions or separate TypeScript compilation. It's fast enough that your dev feedback loop stays tight. Use `bun <file>` not `node`, `bun test` not `jest`, `bunx` not `npx`.

**SQLite via bun:sqlite** means zero configuration. No Docker, no services to start, no connection strings. Just a file (`./data/db.sqlite`) that you can backup, copy, or reset instantly. Upgrade to PostgreSQL later when you need it.

**Hono** is deliberately minimal. It has just enough features to build APIs without the bloat that makes AI-generated code unpredictable. The RPC client gives you end-to-end type safety without the complexity of tRPC.

**Drizzle ORM** generates TypeScript types from your schema. This means AI assistants get autocomplete for your database structure, reducing hallucinated column names and incorrect queries.

**TanStack Router** with file-based routing means your URL structure is visible in your filesystem. AI assistants can see the entire route tree at a glance.

**shadcn/ui** components are copied into your codebase, not installed as dependencies. This means AI can read, modify, and extend them—critical for customization.

**Better-Auth** handles sessions, cookies, OAuth flows, password resets—so you can focus on your application logic. But you don't need it on Day 1.

---

# The 3 Core Laws

## Law of the Breach: Punch Through All Layers

> **"The first feature must touch database, API, and UI in a single vertical slice."**

Most developers build horizontally: first the entire database schema, then all the API endpoints, then the UI. This is a trap. You don't discover integration issues until week three, and refactoring three layers is exponentially harder than refactoring one.

The Breach demands you build **one complete feature** first. A user can create, read, update, and delete something. The database has a table. The API has endpoints. The UI has pages. Everything is wired together and working.

This vertical slice becomes your proof of concept, your integration test, and your pattern template all at once.

---

## Law of the Shell: Build the Container First

> **"Establish routing, layout, and navigation before adding features."**

Users don't experience your database schema—they experience flows. The App Shell is the frame that holds every feature: the navigation sidebar, the layout grid, the route structure, the global state providers.

Build this shell with placeholder content. Create every route your app will need, even if the pages just say "Coming Soon." Wire up the navigation so you can click through the entire user journey.

This shell becomes your development map. When you add a feature, you know exactly where it lives. When AI generates code, it has clear boundaries to work within.

---

## Law of the Clone: Copy the Pattern

> **"Every feature after the first follows the established pattern exactly."**

Once your Keystone Feature is complete, you have a working template: how to define a schema, how to structure API routes, how to build UI pages, how to handle errors. Don't reinvent this for each feature—clone it.

This isn't lazy. It's consistency. When every feature follows the same structure:

- AI assistants generate predictable code
- Code reviews become pattern matching
- Bugs have fewer places to hide
- New team members onboard faster

The Clone law turns development into assembly: identify the pattern, apply the pattern, verify the result.

---

## Law of the Ejection: Start Simple, Eject to Complex

> **"Begin with the simplest implementation that proves the concept. Defer complexity to ejection."**

Developers often over-engineer from day one: URL-based routing for multi-tenancy, complex state machines, enterprise patterns. This kills momentum and makes the Tracer Bullet unwieldy.

The Ejection law says: **prove it works simply first, then add complexity.**

### Examples of Simple → Complex Ejection

| Feature | Simple (Phase 1-4) | Complex (Phase 5/Ejection) |
|---------|-------------------|---------------------------|
| **Auth** | Mock auth with hardcoded user | Better-Auth with real sessions |
| **Database** | SQLite file (`./data/db.sqlite`) | PostgreSQL with connection pooling |
| **Multi-tenancy** | State-based active org (React Context + localStorage) | URL-based routing (`/orgs/:slug`) |
| **API Keys** | Simple string comparison | HMAC-signed, rate-limited keys |
| **Billing** | None (free tier only) | Stripe subscriptions with webhooks |

### Why This Matters

**Demo-friendly:** Simple implementations are easier to show non-technical stakeholders. A state-based org switcher is immediately understandable; complex URL routing requires explanation.

**Fast iteration:** You can build and validate the core concept in hours, not days.

**Clean ejection:** Each simple implementation has a clear upgrade path. State-based orgs can become URL-based without breaking changes. SQLite can migrate to PostgreSQL.

**YAGNI enforcement:** You often discover you don't need the complex version. Many apps never need URL-based multi-tenancy.

### The Ejection Decision Tree

```
Building Feature X?
    │
    ├── Is it required for the Tracer Bullet to prove the concept?
    │   ├── YES → Build it (keep it simple)
    │   └── NO  → Defer to ejection
    │
    └── Can I demo this to a non-technical stakeholder?
        ├── YES → Good, proceed
        └── NO  → Simplify further
```

### When to Eject

Ejection happens when:
1. The Tracer Bullet is complete and working
2. You have real users or clear requirements
3. The simple implementation hits a real limitation

**Don't eject prematurely.** Build momentum with working code first.

---

# Part I: The Breach (Tracer Bullet)

The Breach is about proving your stack works by building a complete feature in three phases. Each phase validates a different assumption and leaves you with working code.

---

## The Tracer Bullet: Your Pathfinding Shot

### What It Is

The Tracer Bullet is the foundational concept of the Keystone Methodology. Unlike a prototype (which is disposable) or an MVP (which is a product), a Tracer Bullet is **production-quality code that traverses every layer of your application**—from database schema to API endpoints to UI components—in a single, working vertical slice.

The metaphor comes from military ballistics: tracer rounds contain a pyrotechnic compound that leaves a visible trail, allowing shooters to see exactly where their bullets are going. In software, your Tracer Bullet leaves a visible path through your architecture that all subsequent features will follow.

### The Philosophy

Most development approaches fail because they build horizontally:
1. Design the entire database schema first
2. Build all API endpoints second
3. Create all UI components third
4. Hope everything connects at the end

This is architectural roulette. Integration issues hide until the final weeks, refactoring costs compound exponentially, and you discover fundamental flaws when it's too late to fix them easily.

The Tracer Bullet approach builds vertically:
1. **One complete feature** touches every layer
2. **Working code** proves the architecture
3. **Visible pattern** guides all future features
4. **Production-ready** from day one

### Tracer Bullet vs. Prototype vs. MVP

Understanding the distinction is critical:

| Aspect | Prototype | Tracer Bullet | MVP |
|--------|-----------|---------------|-----|
| **Purpose** | Explore ideas | Prove architecture | Validate market |
| **Lifespan** | Disposable | Permanent foundation | Evolves to product |
| **Quality** | Hacky, quick | Production-grade | User-facing polish |
| **Scope** | One screen/component | One complete feature | Multiple features |
| **When to Use** | Early concepting | Starting development | Launching to users |

**The Key Insight:** Your Tracer Bullet becomes the skeleton of your application. It stays. It grows. It defines patterns. Don't treat it as throwaway code.

### Why the Tracer Bullet Matters

> **Why This Matters**  
> The Tracer Bullet is the single most important concept in this methodology. Get it right, and every feature that follows is assembly. Get it wrong, and you're building on quicksand. The 2-3 days spent on a proper Tracer Bullet saves 2-3 weeks of refactoring later.

**Risk Reduction:** If your stack has integration issues—Drizzle relations that don't query correctly, Hono routes that don't type-check with the RPC client, TanStack Query hooks that cache incorrectly—you discover them on a 200-line feature, not a 2000-line application.

**Pattern Establishment:** The Tracer Bullet creates the template. Every subsequent feature copies its structure: how to define schemas, how to structure routes, how to build components, how to handle errors. This consistency is what makes AI-assisted development scalable.

**Momentum Maintenance:** A working Tracer Bullet is proof you can ship. It's a psychological anchor that keeps you moving forward. When you hit the inevitable rough patches, you have working code to reference.

**Hiring Preparation:** When you inevitably need to hire developers, the Tracer Bullet is your documentation. A new engineer can read one complete feature and understand your entire architecture.

### Characteristics of a Good Tracer Bullet

Not every feature makes a good Tracer Bullet. The ideal candidate has these properties:

**1. Touches All Layers**
- Database: At least one table with relations
- API: Full CRUD operations (Create, Read, Update, Delete)
- UI: List view, detail view, and form
- Auth: User context (even if mocked)

**2. Represents Core Domain Logic**
- If building a loan system: loans are your Tracer Bullet
- If building a project tool: projects are your Tracer Bullet
- If building an e-commerce site: products are your Tracer Bullet

**3. Has Business Rules**
- Validation logic (e.g., "loan amount must be positive")
- State transitions (e.g., "draft → submitted → approved")
- Ownership checks (e.g., "users can only edit their own loans")

**4. Is Complex Enough to Be Representative**
- Single table with no relations? Too simple.
- Five tables with complex joins? Too complex.
- Two tables with a foreign key relationship? Just right.

### Example: Project Container Tracer Bullet

**Bad Tracer Bullet Choice:** "User Profile"
- Just one table (users)
- No relations
- No interesting business logic
- Doesn't test the stack

**Good Tracer Bullet Choice:** "Project Creation & Management"
- Two tables: `users` and `projects`
- Foreign key relationship
- Business rules: name validation, ownership
- Full CRUD: create project, view list, view detail, update name
- Tests everything: schema, relations, API, UI, forms

### The Tracer Bullet Process

Building a Tracer Bullet follows five distinct phases:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Phase 1       │ →  │   Phase 2       │ →  │   Phase 3       │
│   God Script    │    │   API Split     │    │   The Mock      │
│   (Database)    │    │   (Backend)     │    │   (Frontend)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
      Day 1                  Day 2                  Day 3

┌─────────────────┐    ┌─────────────────┐
│   Phase 4       │ →  │   Phase 5       │
│   App Shell     │    │   The Lock      │
│   (Routing)     │    │   (Real Auth)   │
└─────────────────┘    └─────────────────┘
      Day 4                  Day 5
```

**Phase 1: God Script** — Prove your schema and business logic work without any server complexity.

**Phase 2: API Split** — Separate your logic into a proper Hono API with RPC client.

**Phase 3: The Mock** — Build the complete UI with mock authentication. Focus on data flow and components without auth complexity.

**Phase 4: App Shell** — Create the navigation, layout, and routing structure.

**Phase 5: The Lock** — Integrate Better-Auth for real authentication, replacing the mock.

Each phase produces working code. Each phase validates assumptions. Each phase builds on the previous.

### Common Pitfalls

⚠️ **Pitfall: Choosing the wrong feature**
Don't pick something too simple (user profiles) or too complex (multi-step workflows with side effects). Your Tracer Bullet should be representative but manageable.

⚠️ **Pitfall: Skipping phases**
The phases exist for a reason. Jumping from schema to UI without the API phase means you haven't proven your client-server communication works.

⚠️ **Pitfall: Over-engineering**
Your Tracer Bullet doesn't need every feature. It needs to be complete, not comprehensive. One CRUD feature with good patterns is better than three half-finished features.

⚠️ **Pitfall: Treating it as disposable**
The Tracer Bullet is not a prototype. It's production code that establishes patterns. Write it as if the next 20 features will copy it—because they will.

⚠️ **Pitfall: Not verifying at each phase**
Each phase should produce verifiable, working code. If you can't run `bun run scripts/tracer.ts` and see success, don't move to Phase 2. If you can't `curl` your API and get JSON, don't move to Phase 3.

### AI Prompt Template

```
I need to build a Tracer Bullet for my application.

**Domain:** [Describe your application domain]
**Core Entity:** [What's the main thing users work with?]
**Business Rules:** [List 2-3 key rules]

Create a Tracer Bullet plan:
1. Identify the best feature to use as Tracer Bullet
2. List the database tables needed (with relations)
3. Define the API endpoints required
4. Describe the UI pages/components needed
5. Identify business logic to validate

The Tracer Bullet should:
- Touch all layers (DB, API, UI)
- Be completable in 2-3 days
- Establish patterns for future features
- Include at least one foreign key relationship
```

### Tracer Bullet Verification Checklist

Before moving from the Tracer Bullet to feature expansion, verify:

- [ ] Database schema is correct with proper relations
- [ ] Business logic works as expected
- [ ] API endpoints return correct data
- [ ] RPC client has full type safety
- [ ] UI components render correctly
- [ ] Data fetching works end-to-end
- [ ] Error handling is consistent
- [ ] Code patterns are clear and cloneable

**The Ultimate Test:** Can you explain how to add a new feature by saying "just copy the Tracer Bullet pattern and change the table name"? If yes, your Tracer Bullet is successful.

---

---

## Phase 1: God Script

### What It Is

A single TypeScript file that proves your database schema and business logic work—without any API or UI complexity. Think of it as a command-line prototype that exercises your entire data layer.

### The Goal

Validate that:
- Your Drizzle schema is correct
- Relationships work as expected
- Business logic functions properly
- Database operations succeed

### Implementation

Create `scripts/tracer.ts`:

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DAY 1: THE TRACER BULLET - "THE PROJECT CONTAINER"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Keystone Law: Do NOT start with Auth. Do NOT start with Stripe.
 * Do NOT start with a Landing Page.
 *
 * Your Tracer Bullet is simply: Creating and Listing a "Project".
 *
 * This script proves:
 *   ✓ Database connection works (SQLite - zero config!)
 *   ✓ Schema is valid
 *   ✓ You can write and read from the DB
 *
 * Run: bun run scripts/tracer.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { db, projects } from "../src/db";

async function tracerBullet() {
  console.log("🎯 Tracer Bullet: Testing Project Container...\n");

  try {
    // STEP 1: Create a Project
    console.log("📝 Creating project...");

    const inserted = await db
      .insert(projects)
      .values({
        name: "My First SaaS",
        userId: "tracer-user-id",
      })
      .returning();

    const newProject = inserted[0];
    if (!newProject) {
      throw new Error("Failed to create project - no rows returned");
    }

    console.log("✅ Project created:");
    console.log(`   ID:   ${newProject.id}`);
    console.log(`   Name: ${newProject.name}`);
    console.log(`   Created At: ${newProject.createdAt}\n`);

    // STEP 2: List All Projects
    console.log("📋 Listing all projects...");

    const allProjects = await db.select().from(projects);

    console.log(`✅ Found ${allProjects.length} project(s):\n`);
    for (const project of allProjects) {
      console.log(`   • ${project.name} (${project.id})`);
    }

    // SUCCESS
    console.log("\n═══════════════════════════════════════════════════════════════════════════════");
    console.log("🎉 TRACER BULLET SUCCESS!");
    console.log("   Your SQLite database works. Your schema is valid.");
    console.log("   You're ready for Phase 2: The API.");
    console.log("═══════════════════════════════════════════════════════════════════════════════");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ TRACER BULLET FAILED!\n");

    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);

      // Helpful hints for common errors
      if (error.message.includes("does not exist")) {
        console.error("\n💡 HINT: The 'projects' table doesn't exist yet.");
        console.error("   Run: bun run db:push");
      }
    }

    console.error("");
    process.exit(1);
  }
}

// Run the tracer bullet
tracerBullet();
```

### Database Schema

```typescript
// src/db/schema.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * The Project Container - Root of the SaaS
 * Every piece of data belongs to a Project
 * 
 * SQLite Schema Notes:
 * - Using text for UUIDs (SQLite doesn't have native UUID type)
 * - Using integer for timestamps (Unix epoch in milliseconds)
 * - $defaultFn generates values in application code
 */
export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name", { length: 255 }).notNull(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Type inference for TypeScript
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

### Database Connection

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

/**
 * SQLite Database Connection
 * File-based, zero-config database for local development
 * Using Bun's built-in sqlite driver
 */
const DB_PATH = process.env.SQLITE_DB_PATH || "./data/db.sqlite";

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrency
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });

// Export schema for convenience
export * from "./schema";
```

### Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SQLITE_DB_PATH || "./data/db.sqlite",
  },
});
```

### Running the Script

```bash
# First, push the schema to create tables
bun run db:push

# Run the tracer
bun run scripts/tracer.ts
```

> **Why This Matters**  
> The God Script catches schema errors immediately, before you've built APIs that depend on them. It's 10x faster to fix a Drizzle relationship issue in a 50-line script than in a full-stack feature. This script also becomes your documentation: new developers can read it to understand your data model.

### No Cloud, No Env Philosophy

The beauty of this stack: **you need zero environment setup to start developing.**

- **SQLite**: Just a file (`./data/db.sqlite`) — no Docker, no `brew services start postgresql`
- **Bun**: Single binary, includes TypeScript, test runner, bundler
- **Mock Auth**: No OAuth setup, no secrets to configure

**Start developing in 30 seconds:**
```bash
git clone <repo>
cd <repo>
bun install
bun run db:push
bun run tracer      # Verify DB works
bun run api:dev     # Start API
```

Environment variables are only needed when you eject to production. Until then, everything has sensible defaults.

### Common Pitfalls

⚠️ **Pitfall: Forgetting to run db:push**
Always push schema changes before running the tracer: `bun run db:push`

⚠️ **Pitfall: Testing with a real database**
Always use SQLite file or `:memory:` for testing. You don't want test data polluting shared databases.

⚠️ **Pitfall: Skipping relation tests**
Many schema issues only appear when querying across relationships. Always test `with: { relatedTable: true }` queries.

⚠️ **Pitfall: Not testing edge cases**
Include tests for unique constraints, foreign key violations, and nullable fields. These become validation rules later.

### AI Prompt Template

```
Create a God Script for a [FEATURE_NAME] feature.

Schema requirements:
- [Table] with fields: [list fields]
- [Related table] with foreign key to [table]
- Business rule: [describe constraint or logic]

The script should:
1. Create test records
2. Query with relations
3. Validate business logic
4. Print clear pass/fail results

Run with: bun run scripts/tracer.ts
```

---

## Phase 1.5: Testing Strategy (Optional but Recommended)

### Introduction

Testing is optional in the early phases of the Keystone Methodology, but it becomes critical as your codebase grows. While the God Script validates your database logic through exploration, automated tests formalize those validations and protect against regressions.

Think of testing as a **clone pattern**: once you establish the three-layer testing structure for your Keystone Feature, every subsequent feature gets the same three test files. This consistency means AI assistants can generate tests predictably, and you can verify features are working without manual clicking through the UI.

### The Three-Layer Testing Pattern

#### Layer 1: Validator Tests (`src/features/{name}/validators.test.ts`)

Test your Zod schemas in isolation. These are fast, focused tests that ensure data validation rules work correctly:

- **Required fields:** Ensure missing required fields fail validation
- **Optional fields:** Verify optional fields don't cause failures when absent
- **Length limits:** Test min/max length constraints
- **Format validation:** Check email formats, URL patterns, slug formats
- **Edge cases:** Empty strings, null values, boundary lengths

Use `safeParse()` to check both success and failure cases without throwing exceptions.

**Example:** Testing `createOrganizationSchema` verifies name requirements (not empty, max length), slug validation (lowercase, alphanumeric, hyphens), and logoUrl format (valid URL when provided).

#### Layer 2: API Tests (`src/features/{name}/api.test.ts`)

Test your Hono endpoints end-to-end with Better-Auth integration. These tests verify the complete request/response cycle:

- **Authentication (401):** Verify endpoints reject requests without a valid session
- **Validation (400):** Ensure bad inputs return proper validation errors
- **Authorization (403/404):** Confirm users can only access their own resources
- **Success cases (200/201):** Verify correct responses for valid requests

Use the `createTestUser()` helper to generate authenticated sessions, and `withAuth()` to attach session cookies to requests.

**Example:** Testing `/api/organizations` endpoints covers creating organizations (POST), listing them (GET), updating (PATCH), and deleting (DELETE) with various authentication and authorization scenarios.

#### Layer 3: Database Tests (`scripts/tests/{name}.test.ts`)

Test your Drizzle ORM schema and queries directly. These tests validate the data layer independently of the API:

- **CRUD operations:** Create, read, update, delete work correctly
- **Foreign key constraints:** Relationships enforce referential integrity
- **Unique constraints:** Duplicate keys are rejected appropriately
- **Cascade deletes:** Related records are cleaned up properly
- **Org-scoped queries:** Multi-tenant queries filter correctly

Use `beforeEach()` with `cleanDatabase()` for test isolation, or create fresh `createTestDb()` instances per test.

**Example:** Testing organizations verifies that creating an organization also creates the owner membership, slug uniqueness is enforced, deleting an organization cascades to memberships, and queries properly scope by organization.

### Test Infrastructure

#### Setup File (`test/setup.ts`)

The test infrastructure provides essential utilities:

- **`createTestDb()`** - Creates an in-memory SQLite database with WAL mode and foreign keys enabled. Returns `{ db, sqlite }` for Drizzle operations.
- **`cleanDatabase()`** - Deletes all data in dependency order (respects foreign keys). Use in `beforeEach()` to ensure test isolation.

Each test file should create its own database instance for complete isolation, or use `cleanDatabase()` between tests.

#### Auth Helpers (`test/auth-helpers.ts`)

Authentication utilities for API tests:

- **`createTestUser(app, email?, name?)`** - Creates a user via the signup endpoint, returns `{ sessionCookie, email, name }`
- **`withAuth(sessionCookie)`** - Returns headers object with Cookie header for authenticated requests
- **`createTestUsers(app, count)`** - Creates multiple test users with unique emails for multi-user scenarios

### Running Tests

```bash
# Run all tests once
bun test

# Run tests in watch mode (re-run on file changes)
bun run test:watch

# Run specific test file
bun test src/features/organizations/validators.test.ts

# Run tests matching pattern
bun test --test-name-pattern "creates organization"
```

### The Testing Clone Pattern

When adding a new feature, create three test files following the established pattern:

1. Copy `src/features/organizations/validators.test.ts` → `src/features/{name}/validators.test.ts`
2. Copy `src/features/organizations/api.test.ts` → `src/features/{name}/api.test.ts`
3. Copy `scripts/tests/organizations.test.ts` → `scripts/tests/{name}.test.ts`
4. Find/replace "organization" with your feature name
5. Update test cases to match your schema and business logic

This cloning approach ensures consistency across your test suite. The structure, naming conventions, and testing patterns remain identical—only the specific test data and assertions change.

### Pitfalls

- **Forgetting to clean database:** Always use `beforeEach()` with `cleanDatabase()` or create fresh `createTestDb()` instances. Leftover data causes flaky tests that pass/fail randomly.

- **Sharing database instances:** Each test should have isolated data. Don't share database connections between tests unless you're certain about cleanup.

- **Not testing auth:** API tests must verify both authenticated and unauthenticated scenarios. The happy path is only half the story.

- **Skipping edge cases:** Test boundary conditions—empty strings, max length values, null fields, duplicate keys. These are where bugs hide.

- **Manual testing only:** God Scripts are great for exploration, but automated tests catch regressions. Don't rely solely on clicking through the UI.

- **Testing implementation details:** Test behavior (API responses, database state) not internals (function names, private methods). Refactoring shouldn't break tests.

### AI Prompt Template

```
Add comprehensive tests for the {feature} feature following the Keystone testing pattern:

1. Validator tests in src/features/{feature}/validators.test.ts
   - Test all Zod schemas (create, update, param schemas)
   - Cover required fields, optional fields, validation rules, edge cases

2. API tests in src/features/{feature}/api.test.ts
   - Test all endpoints (GET, POST, PATCH, DELETE)
   - Cover auth (401), validation (400), authorization (403/404), success (200/201)
   - Use createTestUser() and withAuth() helpers

3. Database tests in scripts/tests/{feature}.test.ts
   - Test CRUD operations, constraints, cascade deletes, scoped queries
   - Use beforeEach() with cleanDatabase()

Follow the pattern from organizations tests exactly. All tests must pass with `bun test`.
```

---

## Phase 2: API Split

### What It Is

Separating your business logic from the God Script into a proper Hono API with RPC client. This gives you type-safe API calls from frontend to backend.

### The Goal

- Move database operations into API routes
- Create RPC client for type-safe frontend calls
- Establish error handling patterns
- Add input validation

### Project Structure

```
src/
├── api/
│   ├── index.ts          # Composes all routes, exports AppType
│   ├── app.ts            # Hono app with middleware
│   └── types.ts          # Central type exports
├── features/
│   └── projects/
│       ├── api.ts        # Feature routes (no auth yet!)
│       ├── validators.ts # Zod schemas
│       ├── hooks.ts      # TanStack Query hooks
│       └── components/   # UI components
├── db/
│   ├── index.ts          # Database connection
│   └── schema.ts         # Drizzle schema
├── lib/
│   └── rpc.ts            # RPC client
└── server.ts             # Server entry point
```

### The Hybrid Pattern: Feature-Based Organization

Keystone uses a **hybrid architecture** that balances two needs:

1. **Folder-Constrained Features** (Vertical Slices)
   - A feature = DB schema + API + UI + Hooks
   - Co-location: Everything related lives together
   - Law of the Clone: Copy folder → Rename → Done

2. **Hono RPC Type Safety**
   - Requires a SINGLE `AppType` exported from one file
   - All routes must be composed into one Hono app
   - Frontend derives types from `hc<AppType>`

**The Solution:**

```
Features define routes    │  API root composes & types
                          │
features/projects/api.ts ─┼──► api/index.ts
features/teams/api.ts    ─┤    (exports AppType)
features/tasks/api.ts    ─┘
                               Each feature is self-contained
                               Central composition point for types
```

### Server Implementation

```typescript
// src/server.ts
import { Hono } from "hono";
import api from "./api";

// Create the main app
const app = new Hono();

// Mount API at /api prefix
app.route("/api", api);

// Export for Bun
export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};

// Also export app for testing
export { app };
```

```typescript
// src/api/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import projectsApi from "@/features/projects/api";

/**
 * API Root - The Single Source of Truth for AppType
 *
 * Philosophy:
 *   - Features are self-contained (see features/projects/)
 *   - Routes are mounted here using .route()
 *   - One place to see all API endpoints
 *
 * To add a new feature:
 *   1. Create features/{name}/api.ts (copy from features/projects/)
 *   2. Import and mount: .route('/{name}', {name}Api)
 *   3. Done - types flow automatically
 */

const app = new Hono()
  // Global middleware
  .use("*", logger())
  .use("*", cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }))

  // Health check
  .get("/health", (c) => c.json({ status: "ok" }))

  // Feature routes (no auth middleware yet - Phase 3 uses mock auth)
  .route("/projects", projectsApi);
// Add new features here following Law of the Clone:
// .route('/teams', teamsApi)
// .route('/tasks', tasksApi)

export default app;
```

### Feature API Route (No Auth Yet)

```typescript
// src/features/projects/api.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  createProjectSchema,
  updateProjectSchema,
} from "./validators";

/**
 * Projects API Routes - Phase 2: No Auth Yet
 * 
 * During the Tracer Bullet, we focus on proving the API works.
 * Auth comes in Phase 5 (The Lock).
 * For now, we use a hardcoded userId to simulate ownership.
 */

const MOCK_USER_ID = "mock-user-123";

const app = new Hono()
  // GET /projects - List all projects
  .get("/", async (c) => {
    const allProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, MOCK_USER_ID));
    return c.json(allProjects);
  })

  // GET /projects/:id - Get single project
  .get("/:id", async (c) => {
    const id = c.req.param("id");

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(project);
  })

  // POST /projects - Create project
  .post("/", zValidator("json", createProjectSchema), async (c) => {
    const data = c.req.valid("json");

    const [project] = await db
      .insert(projects)
      .values({
        name: data.name,
        userId: MOCK_USER_ID,
      })
      .returning();

    return c.json(project, 201);
  })

  // PATCH /projects/:id - Update project
  .patch("/:id", zValidator("json", updateProjectSchema), async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }

    const [project] = await db
      .update(projects)
      .set({ name: data.name })
      .where(eq(projects.id, id))
      .returning();

    return c.json(project);
  })

  // DELETE /projects/:id - Delete project
  .delete("/:id", async (c) => {
    const id = c.req.param("id");

    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Project not found" }, 404);
    }

    await db.delete(projects).where(eq(projects.id, id));

    return c.json({ success: true });
  });

export default app;
```

### Validators (Zod Schemas)

```typescript
// src/features/projects/validators.ts
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectIdParamSchema = z.object({
  id: z.string().uuid(),
});

// Types inferred from schemas
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
```

### RPC Client Setup

```typescript
// src/lib/rpc.ts
import { hc } from "hono/client";
import type { AppType } from "@/api/types";

/**
 * RPC Client - Type-safe API client using Hono RPC
 *
 * Usage:
 *   const res = await rpc.projects.$get()
 *   const projects = await res.json()
 *
 * The client automatically knows:
 *   - Available routes (/projects, /projects/:id)
 *   - HTTP methods (GET, POST, PATCH, DELETE)
 *   - Request/response types (from Zod validators)
 */

const API_BASE_URL = 
  typeof window !== "undefined"
    ? "/api" // Browser: relative URL
    : process.env.API_URL || "http://localhost:3000/api"; // Server: absolute URL

// Client for Phase 2 (no auth cookies yet)
export const rpc = hc<AppType>(API_BASE_URL);

/**
 * Helper to handle API responses
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({
      error: "Unknown error",
    }))) as { error?: string };
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
```

> **Why This Matters**  
> The RPC client gives you end-to-end type safety. When you change an API route, TypeScript immediately shows you every frontend call that needs updating. No more runtime errors from API mismatches.

### Common Pitfalls

⚠️ **Pitfall: Adding auth too early**
Don't add auth middleware in Phase 2. Focus on proving the API works first. Auth comes in Phase 5.

⚠️ **Pitfall: Missing validation**
Always use `zValidator` for input validation. AI assistants often generate routes without validation—explicitly require it.

⚠️ **Pitfall: Inconsistent error format**
Return errors as `{ error: string }` consistently. Your frontend error handling depends on this shape.

### Testing the API

```bash
# Start the server
bun run api:dev

# Test endpoints
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project"}'

curl http://localhost:3000/api/projects
```

### AI Prompt Template

```
Convert this God Script into Hono API routes:
[Paste God Script]

Requirements:
- Full CRUD endpoints for [resource]
- Zod validation for all inputs
- Proper error responses (404, 400, etc.)
- Return appropriate status codes
- NO auth middleware yet (we add that in Phase 5)
- Use a MOCK_USER_ID constant for userId fields

Also generate the RPC client setup code.
```

### Phase 2 Checklist

- [ ] Move database operations to API routes
- [ ] Add Zod validation for all inputs
- [ ] Create RPC client for type-safe calls
- [ ] Handle errors with proper status codes
- [ ] Optional: Add validator and API tests (see Phase 1.5)

---

## Phase 3: The Mock

### What It Is

Building the UI with mock authentication. This lets you focus purely on component structure, data fetching, and user flows without wrestling with auth complexity.

### The Goal

- Create complete UI pages for your Keystone Feature
- Establish component patterns
- Define data fetching patterns with TanStack Query
- Build forms with validation
- **All without real auth** (that's Phase 5)

### Mock Auth Setup

```typescript
// src/lib/auth.ts
// Mock auth for development - swaps to real auth in Phase 5

export interface User {
  id: string;
  email: string;
  name: string;
}

export const mockUser: User = {
  id: "mock-user-123",
  email: "dev@example.com",
  name: "Dev User",
};

export const mockAuth = {
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  signup: async () => {},
};

// Hook for components - returns mock data
export function useAuth() {
  return mockAuth;
}
```

### TanStack Router Setup

```typescript
// vite.config.ts
import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
```

```typescript
// src/main.tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider, createRouter } from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import "./index.css"

import { routeTree } from "./routeTree.gen"
import { queryClient } from "@/lib/query-client"

const router = createRouter({ routeTree })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById("root")
if (!rootElement) throw new Error("Root element not found")

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
```

### Route Structure (Phase 3)

```
src/routes/
├── __root.tsx              # Root layout with nav
├── index.tsx               # Home/dashboard
├── projects/
│   ├── index.tsx           # /projects (list)
│   ├── new.tsx             # /projects/new (create)
│   └── $id.tsx             # /projects/:id (detail/edit)
└── about.tsx               # Placeholder example
```

### Data Fetching with TanStack Query

```typescript
// src/features/projects/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { rpc } from "@/lib/rpc"
import { mockUser } from "@/lib/auth"
import type { CreateProjectInput, UpdateProjectInput } from "./validators"

const PROJECTS_KEY = "projects" as const

interface ProjectResponse {
  id: string
  name: string
  createdAt: string
}

interface ApiError {
  error: string
}

export function useProjects(projectId?: string) {
  const queryClient = useQueryClient()

  // Query: Get all projects
  const projectsQuery = useQuery({
    queryKey: [PROJECTS_KEY],
    queryFn: async () => {
      const res = await rpc.projects.$get()
      if (!res.ok) throw new Error("Failed to fetch projects")
      return res.json() as Promise<ProjectResponse[]>
    },
  })

  // Query: Get single project
  const projectQuery = useQuery({
    queryKey: [PROJECTS_KEY, projectId],
    queryFn: async () => {
      if (!projectId) throw new Error("Project ID required")
      const res = await rpc.projects[":id"].$get({ param: { id: projectId } })
      if (!res.ok) {
        const errorData = (await res.json()) as ApiError
        throw new Error(errorData.error || "Failed to fetch project")
      }
      return res.json() as Promise<ProjectResponse>
    },
    enabled: !!projectId,
  })

  // Mutation: Create
  const createMutation = useMutation({
    mutationFn: async (data: CreateProjectInput) => {
      const res = await rpc.projects.$post({ json: data })
      if (!res.ok) {
        const errorData = (await res.json()) as unknown as ApiError
        throw new Error(errorData.error || "Failed to create project")
      }
      return res.json() as Promise<ProjectResponse>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
  })

  // Mutation: Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectInput }) => {
      const res = await rpc.projects[":id"].$patch({ param: { id }, json: data })
      if (!res.ok) {
        const errorData = (await res.json()) as ApiError
        throw new Error(errorData.error || "Failed to update project")
      }
      return res.json() as Promise<ProjectResponse>
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] })
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY, id] })
    },
  })

  // Mutation: Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await rpc.projects[":id"].$delete({ param: { id } })
      if (!res.ok) {
        const errorData = (await res.json()) as ApiError
        throw new Error(errorData.error || "Failed to delete project")
      }
      return res.json() as Promise<{ success: true }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PROJECTS_KEY] })
    },
  })

  return {
    projects: projectsQuery.data,
    project: projectQuery.data,
    isLoading: projectId ? projectQuery.isLoading : projectsQuery.isLoading,
    error: projectId ? projectQuery.error : projectsQuery.error,
    create: {
      mutate: createMutation.mutate,
      mutateAsync: createMutation.mutateAsync,
      isPending: createMutation.isPending,
    },
    update: {
      mutate: updateMutation.mutate,
      mutateAsync: updateMutation.mutateAsync,
      isPending: updateMutation.isPending,
    },
    remove: {
      mutate: deleteMutation.mutate,
      mutateAsync: deleteMutation.mutateAsync,
      isPending: deleteMutation.isPending,
    },
  }
}
```

### UI Component Example

```tsx
// src/features/projects/components/ProjectList.tsx
import { useProjects } from "@/features/projects/hooks";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, Edit } from "lucide-react";

export function ProjectList() {
  const { projects, isLoading, error, remove } = useProjects();

  if (isLoading) return <div>Loading projects...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!projects?.length) return <div>No projects yet.</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle>{project.name}</CardTitle>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/projects/$id" params={{ id: project.id }}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Link>
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => remove.mutate(project.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

> **Why This Matters**  
> The Mock phase proves your UI architecture works. By using mock auth, you eliminate a major variable and focus purely on data flow and component composition. The patterns you establish here—hooks for data fetching, mutation invalidation, error handling—become the template for every future feature.

### Common Pitfalls

⚠️ **Pitfall: Forgetting query invalidation**
After mutations, always invalidate related queries. Without this, your UI shows stale data.

⚠️ **Pitfall: Inline API calls**
Never call `rpc` directly from components. Always use custom hooks from the feature. This centralizes error handling and makes testing easier.

⚠️ **Pitfall: Missing loading states**
Every query needs a loading state. AI assistants often skip these—explicitly require them.

⚠️ **Pitfall: Adding real auth too early**
Don't add Better-Auth yet. Focus on the Tracer Bullet first. Auth comes in Phase 5.

### AI Prompt Template

```
Create a React component for [feature] using this pattern:

API hooks available:
- use[Feature]s() - list query
- use[Feature](id) - single item query  
- useCreate[Feature]() - create mutation
- useUpdate[Feature]() - update mutation
- useDelete[Feature]() - delete mutation

UI requirements:
- Use shadcn/ui components
- Include loading states
- Handle error states
- Include edit/delete actions
- Use TanStack Router Link for navigation
- NO auth checks (using mock auth)

Generate the [ComponentName].tsx file.
```

---

## Phase 4: App Shell

### What It Is

The complete page structure with file-based routing, navigation, layout components, and global providers. This is the frame that holds your features.

### The Goal

- Establish file-based routing structure
- Create persistent layout (sidebar/header)
- Set up global providers (QueryClient)
- Build navigation that works across all routes
- Create placeholder pages for future features

### Root Layout

```tsx
// src/routes/__root.tsx
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { mockAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const { user, isAuthenticated, logout } = mockAuth;

  return (
    <div className="min-h-screen">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-bold text-lg">
          SaaS Boilerplate
        </Link>
        
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600">{user?.name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </header>
      
      <main className="p-4">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
```

### Route Components

```tsx
// src/routes/projects/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProjectList } from "@/features/projects/components/ProjectList";

export const Route = createFileRoute("/projects/")({
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <Link to="/projects/new">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>
      <ProjectList />
    </div>
  );
}
```

> **Why This Matters**  
> The App Shell creates the user experience framework. When you add a new feature, you know exactly where it lives in the navigation, what layout it inherits, and how users reach it.

### Common Pitfalls

⚠️ **Pitfall: Skipping placeholder routes**
Create all routes your app will need, even as placeholders. This reveals navigation gaps early.

⚠️ **Pitfall: Hardcoding navigation**
Navigation should be data-driven. If you add a new feature, you shouldn't need to touch five files.

---

## Phase 5: The Lock (Real Auth)

### What It Is

Integrating Better-Auth for real authentication, replacing the mock auth from Phase 3. This protects your routes and provides user sessions.

### The Goal

- Set up Better-Auth with database adapter
- Create login/logout flows
- Protect routes requiring authentication
- Add auth middleware to API routes
- Pass user context to API requests

### Better-Auth Server Setup

```typescript
// src/lib/auth-server.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "@/db/schema";

const sqlite = new Database(process.env.SQLITE_DB_PATH || "./data/db.sqlite");
const db = drizzle(sqlite, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: schema,
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:3000",
  ],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  secret: process.env.BETTER_AUTH_SECRET || "development-secret-change-in-production",
});
```

### Better-Auth Client Setup

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "/api",
});
```

### Updated Auth Hook (Real)

```typescript
// src/lib/auth.tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authClient } from "./auth-client";
import type { User } from "better-auth";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUser(data?.user || null);
      setIsLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message || "Login failed");
    setUser(data.user);
  };

  const signup = async (email: string, password: string, name: string) => {
    const { data, error } = await authClient.signUp.email({ email, password, name });
    if (error) throw new Error(error.message || "Signup failed");
    setUser(data.user);
  };

  const logout = async () => {
    await authClient.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
```

### Update API to Add Auth

```typescript
// src/api/app.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "@/lib/auth-server";
import projectsApi from "@/features/projects/api";

const app = new Hono()
  .use("*", logger())
  .use("*", cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,  // Important: for cookies
  }))
  .get("/health", (c) => c.json({ status: "ok" }))

  // Better-Auth handler - must be before feature routes
  .on(["POST", "GET"], "/auth/*", (c) => {
    return auth.handler(c.req.raw);
  })

  // Feature routes
  .route("/projects", projectsApi);

export default app;
```

### Update Feature API with Auth Middleware

```typescript
// src/features/projects/api.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { auth } from "@/lib/auth-server";
import {
  createProjectSchema,
  updateProjectSchema,
} from "./validators";

type Variables = {
  user: { id: string; email: string; name: string };
};

const app = new Hono<{ Variables: Variables }>()
  // Auth middleware - verify session and set user
  .use("*", async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", session.user);
    await next();
  })

  // GET /projects - List all projects for current user
  .get("/", async (c) => {
    const user = c.get("user");
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, user.id));
    return c.json(userProjects);
  })

  // GET /projects/:id - Get single project (if owned by user)
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const user = c.get("user");

    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, user.id)))
      .limit(1);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(project);
  })

  // POST /projects - Create project (assigned to current user)
  .post("/", zValidator("json", createProjectSchema), async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");

    const [project] = await db
      .insert(projects)
      .values({
        name: data.name,
        userId: user.id,
      })
      .returning();

    return c.json(project, 201);
  })

  // ... rest of CRUD with user filtering

export default app;
```

### Update RPC Client for Cookies

```typescript
// src/lib/rpc.ts
import { hc } from "hono/client";
import type { AppType } from "@/api/types";

const API_BASE_URL = 
  typeof window !== "undefined" ? "/api" : "http://localhost:3000/api";

// Client with credentials to send cookies
export const rpc = hc<AppType>(API_BASE_URL, {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => {
    return fetch(input, {
      ...init,
      credentials: "include", // Important: sends session cookies
    });
  },
});
```

### Protected Route Layout

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) return <Navigate to="/login" />;
  
  return <Outlet />;
}
```

### Login Page

```tsx
// src/routes/login.tsx
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Why This Matters**  
> By isolating auth to Phase 5, you build momentum with working features first, then add the security layer. Better-Auth handles the complexity—sessions, cookies, OAuth flows, password resets—so you can focus on your application logic.

### Common Pitfalls

⚠️ **Pitfall: Forgetting credentials: include**
The RPC client must send cookies for auth to work. Always include `credentials: "include"`.

⚠️ **Pitfall: Forgetting credentials: true in CORS**
CORS must include `credentials: true` or cookies won't be sent with requests.

⚠️ **Pitfall: Auth middleware order**
Mount Better-Auth routes before feature routes, and apply auth middleware to protected feature routes.

### Phase 5 Checklist

- [ ] Better-Auth server configured
- [ ] Better-Auth client created
- [ ] Auth provider wraps the app
- [ ] Login page works
- [ ] Protected routes redirect unauthenticated users
- [ ] API routes verify sessions
- [ ] Frontend sends cookies with requests
- [ ] Logout clears session

---

## Phase 1-5 Checklist

Use this checklist before moving to Part II:

### Database & API
- [ ] God Script runs without errors
- [ ] Schema includes all Keystone Feature tables
- [ ] Relations are tested and working
- [ ] Hono API has full CRUD endpoints
- [ ] RPC client generates without type errors
- [ ] Input validation works on all endpoints
- [ ] Error responses follow consistent format
- [ ] Auth middleware protects feature routes (Phase 5)

### Frontend
- [ ] Mock auth works (Phase 3)
- [ ] Real auth works (Phase 5)
- [ ] TanStack Query hooks are created
- [ ] Query invalidation works after mutations
- [ ] List page displays data correctly
- [ ] Create form submits successfully
- [ ] Edit form updates correctly
- [ ] Delete removes item and updates UI
- [ ] Protected routes work

### Integration
- [ ] Frontend can call API successfully
- [ ] TypeScript has no errors (`bun run typecheck`)
- [ ] All routes are accessible
- [ ] User can complete full CRUD flow
- [ ] Auth flow works end-to-end

---

# Part II: The Flood

The Flood is where you build out your remaining features at speed. With the Keystone Feature complete and the Shell in place, you have a proven pattern to clone. The Flood isn't about rushing—it's about efficiency through repetition.

---

## Elephant Carpaccio: Thin Vertical Slices

### What It Is

Elephant Carpaccio is a development approach where you break features into the thinnest possible vertical slices—each slice delivering end-to-end functionality. Named after the thinly sliced Italian dish, it emphasizes small, complete increments over horizontal layers.

### The Philosophy

Traditional development builds horizontally:
1. Design entire database schema
2. Build all API endpoints
3. Create all UI components
4. Wire everything together

This approach has a fatal flaw: you don't know if anything works until the very end. Integration issues pile up, hidden until it's too late to fix them easily.

Elephant Carpaccio builds vertically:
1. **One complete feature** (database → API → UI)
2. **Another complete feature**
3. **Another complete feature**

Each slice is deployable, testable, and valuable on its own.

### Example: Project Management System

Instead of building all tables, then all APIs, then all pages:

**Slice 1: Create a Project**
- Database: `projects` table with minimal fields
- API: `POST /api/projects` endpoint
- UI: Simple form to create a project
- Result: User can create a project

**Slice 2: View My Projects**
- Database: Add query index
- API: `GET /api/projects` endpoint
- UI: List page showing user's projects
- Result: User can see their projects

**Slice 3: Project Details**
- Database: No changes
- API: `GET /api/projects/:id` endpoint
- UI: Detail page for single project
- Result: User can view project details

**Slice 4: Update Project**
- Database: No changes
- API: `PATCH /api/projects/:id` endpoint
- UI: Edit form
- Result: User can rename project

Each slice takes hours, not days. Each slice delivers user value. Each slice validates the architecture.

> **Why This Matters**  
> Thin slices reduce risk. If your architecture has a flaw, you discover it on a 100-line feature, not a 1000-line module. Slices also maintain momentum—you're always shipping something, always making progress, always getting feedback.

### Common Pitfalls

⚠️ **Pitfall: Slices that are too thick**
A slice should be completable in a single session. If it's taking days, break it down further.

⚠️ **Pitfall: Horizontal dependencies**
Don't build "foundations" first. Each slice should stand alone. If Slice 2 needs Slice 1, that's fine—but Slice 1 should be complete and working.

⚠️ **Pitfall: Perfectionism**
Slices can be minimal. A form without validation is better than no form. Add polish in subsequent iterations.

---

## The Dependency Graph

### What It Is

A visual map of which features depend on which others. This determines the order in which you build slices.

### Building the Graph

Start with your domain entities and draw relationships:

```
Users
  ↓
Projects (requires User)
  ↓
Tasks (requires User + Project)
  ↓
Comments (requires User + Task)
```

This tells you the build order:
1. Users (Keystone Feature, already done)
2. Projects (depends on Users)
3. Tasks (depends on Users + Projects)
4. Comments (depends on everything)

### More Complex Example

```
Users
├── Organizations
│   ├── Members (User + Organization)
│   └── Projects (Organization)
│       ├── Tasks (Project)
│       └── Files (Project)
├── Billing (User)
│   ├── Invoices
│   └── Payments
└── Settings (User)
```

Build order:
1. Users (Keystone)
2. Organizations
3. Members (needs both)
4. Projects
5. Tasks and Files (can be parallel)
6. Billing
7. Invoices and Payments (can be parallel)
8. Settings

### Graph Rules

1. **No circular dependencies** - If A depends on B and B depends on A, merge them
2. **Dependencies must be complete** - Don't build on partial features
3. **Parallel where possible** - Features with same dependencies can be built together
4. **Defer complex features** - Build simple features first for momentum

> **Why This Matters**  
> The dependency graph prevents the "almost done" trap where you're blocked waiting for another feature. It also reveals architectural issues early—if everything depends on everything, your coupling is too tight.

---

## Law of the Clone: Feature Cloning Protocol

### The Hybrid Pattern: Folder-Constrained Features

Once your Keystone Feature is complete, adding new features is mechanical:

```bash
# Step 1: Copy the folder
cp -r src/features/projects src/features/tasks

# Step 2: Update internal references
# In src/features/tasks/api.ts:
#   - Change 'projects' table to 'tasks' table
#   - Update route handlers

# Step 3: Mount in API root
# In src/api/app.ts:
import tasksApi from "@/features/tasks/api";

const app = new Hono()
  .route("/projects", projectsApi)
  .route("/tasks", tasksApi);    // ← Add this line

# Step 4: Export from feature index
# In src/features/tasks/index.ts:
export { default as tasksApi } from "./api";
export * from "./hooks";
export * from "./validators";

# Step 5: Done! Types flow automatically.
```

### Feature Folder Structure

```
features/{name}/
├── api.ts              # Hono route definitions
├── validators.ts       # Zod schemas for validation
├── hooks.ts            # TanStack Query hooks
├── types.ts            # TypeScript types
├── components/         # UI components
│   ├── {Name}List.tsx
│   ├── {Name}Card.tsx
│   └── {Name}Form.tsx
└── index.ts            # Public API exports
```

### Key Rules

1. **Features Are Self-Contained**
   A feature should NEVER import from another feature's internals:
   ```typescript
   // ❌ WRONG:
   import { useProjects } from "../projects/hooks";

   // ✅ CORRECT:
   import { useProjects } from "@/features/projects";
   ```

2. **Shared Code Goes to `lib/` or `db/`**
   ```typescript
   // ✅ CORRECT: Shared utilities
   import { db } from "@/db";
   import { cn } from "@/lib/utils";
   ```

3. **Validators Co-Located with Feature**
   Each feature owns its Zod schemas:
   ```typescript
   // features/projects/validators.ts
   export const createProjectSchema = z.object({
     name: z.string().min(1).max(255),
   });
   ```

4. **RPC Client Uses Central AppType**
   ```typescript
   // lib/rpc.ts
   import { hc } from "hono/client";
   import type { AppType } from "@/api";

   export const rpc = hc<AppType>("/");

   // features/projects/hooks.ts
   import { rpc } from "@/lib/rpc";

   export function useProjects() {
     return useQuery({
       queryKey: ["projects"],
       queryFn: async () => {
         const res = await rpc.projects.$get();  // Fully typed!
         return res.json();
       },
     });
   }
   ```

### Consistency Checklist

Before saying a feature is complete, verify:

- [ ] `api.ts` exports a Hono app with all CRUD routes
- [ ] `validators.ts` has Zod schemas for POST/PATCH
- [ ] `hooks.ts` has TanStack Query hooks with proper invalidation
- [ ] `components/` has UI components using shadcn/ui
- [ ] `index.ts` exports public API
- [ ] Route is mounted in `src/api/app.ts`
- [ ] Types pass: `bun run typecheck`
- [ ] API test: `curl http://localhost:3000/api/{feature}` works

> **Remember:** "Consistency > Novelty" - Law of the Clone
> Don't innovate within a feature. The innovation is the pattern itself. Every feature should look identical in structure.

---

## Factory Prompt for AI Agents

### The Master Prompt

```
Create a complete [FEATURE_NAME] feature following the Law of the Clone.

## Context
Existing schema tables:
- projects: id, name, userId, createdAt
- users: id, name, email (Better-Auth managed)

Existing API patterns:
- Routes use zValidator with Zod schemas
- Return consistent error format: { error: string }
- Auth middleware sets user context
- All queries filter by current user

Existing UI patterns:
- Components use shadcn/ui
- Hooks use TanStack Query with proper invalidation
- Toast notifications via showSuccess/showError

## Step 1: Noun (Schema)
Create Drizzle schema for [FEATURE_NAME] with:
- id: string (primary key, UUID)
- projectId: string (references projects.id)
- [other fields...]
- createdAt: timestamp

File: Add to src/db/schema.ts

## Step 2: Verb API (Backend)
Create Hono routes in features/[name]/api.ts:
- GET /api/[name] - list with filtering
- POST /api/[name] - create
- GET /api/[name]/:id - get single
- PATCH /api/[name]/:id - update
- DELETE /api/[name]/:id - delete

Include auth middleware and user filtering.

## Step 3: Validators
Create Zod schemas in features/[name]/validators.ts

## Step 4: Hooks
Create TanStack Query hooks in features/[name]/hooks.ts:
- use[Feature]s(queryParams) - list query
- use[Feature](id) - single item
- useCreate[Feature]() - create mutation
- useUpdate[Feature]() - update mutation
- useDelete[Feature]() - delete mutation

## Step 5: Components
Create components in features/[name]/components/:
- [Feature]List - display list with actions
- [Feature]Card - individual item display
- [Feature]Form - create/edit form

## Step 6: Public API
Export everything from features/[name]/index.ts

## Step 7: Mount Route
Mount in src/api/app.ts:
.route('/[name]', [name]Api)

Requirements:
- Include TypeScript types throughout
- Add proper error handling
- Include loading states
- Follow existing code patterns exactly
- Add query invalidation on mutations
```

### Using the Factory Prompt

1. **Fill in the blanks** - Replace [FEATURE_NAME], [name], field lists
2. **Provide context** - Paste relevant existing code
3. **Review output** - Check against the pattern
4. **Iterate** - If something's wrong, prompt for specific fixes

> **Why This Matters**  
> The Factory Prompt transforms AI from a code generator into a feature factory. With clear structure and context, AI assistants produce consistent, complete code that follows your patterns. Without it, you get fragmented, inconsistent output that requires heavy cleanup.

---

## Part II Checklist

### Elephant Carpaccio
- [ ] Features broken into slices under 4 hours each
- [ ] Each slice delivers end-to-end functionality
- [ ] Slices are ordered by dependency
- [ ] No slice depends on incomplete features

### Dependency Graph
- [ ] All features mapped with relationships
- [ ] Build order is clear
- [ ] No circular dependencies
- [ ] Parallel opportunities identified

### Feature Cloning
- [ ] New features follow the folder structure exactly
- [ ] Schema created and migrated
- [ ] API routes tested individually
- [ ] UI components render correctly
- [ ] Hooks connect UI to API
- [ ] Full CRUD flow verified
- [ ] Clone testing pattern for new feature (validators, API, database tests)

---

# Part III: The Ejection

The Ejection is the final phase: swapping development conveniences for production realities. SQLite becomes PostgreSQL. Local auth stays, but you add OAuth. Localhost becomes Vercel. The Ejection happens in stages—you don't need to do everything at once.

---

## Database Swap: SQLite → PostgreSQL

### When to Eject

SQLite is perfect for development: zero setup, file-based, fast. But production demands PostgreSQL for:
- Concurrent connections
- Advanced features (JSONB, full-text search)
- Managed hosting options
- Backup and replication

### The Migration Strategy

#### Step 1: Update Dependencies

```bash
# Add PostgreSQL
bun add pg
bun add -d @types/pg
```

#### Step 2: Update Schema

```typescript
// src/db/schema.ts
// Change from:
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// To:
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Update table definitions
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  userId: uuid("user_id").notNull().references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### Step 3: Update Database Connection

```typescript
// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

#### Step 4: Update drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

#### Step 5: Environment Variables

```bash
# .env
DATABASE_URL=postgresql://user:pass@localhost:5432/myapp
```

> **Why This Matters**  
> Drizzle's dialect abstraction makes database swaps straightforward. Your table definitions, queries, and relations work with minimal changes. The hard part is migration management—never skip testing migrations on a copy of production data.

### Common Pitfalls

⚠️ **Pitfall: Direct SQLite → Postgres data migration**
Don't try to migrate data directly. Export to JSON, transform if needed, then import.

⚠️ **Pitfall: Forgetting to update indexes**
PostgreSQL has different indexing options. Review and optimize indexes after migration.

⚠️ **Pitfall: Connection pool limits**
Serverless environments have connection limits. Use connection pooling (PgBouncer) or serverless PostgreSQL (Neon, Supabase).

---

## Auth Enhancement: Add OAuth

### When to Eject

Better-Auth email/password works great for development. Before production, you may want:
- OAuth providers (Google, GitHub)
- Password reset flows
- Email verification

### The Migration Strategy

#### Step 1: Configure Better-Auth for OAuth

```typescript
// src/lib/auth-server.ts
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite", // or "pg" for PostgreSQL
  }),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true, // Now required
  },
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  
  secret: process.env.BETTER_AUTH_SECRET!, // Now required in production
});
```

#### Step 2: Update Login Page

```tsx
// Add OAuth buttons to login page
<div className="grid grid-cols-2 gap-4">
  <Button 
    variant="outline" 
    onClick={() => authClient.signIn.social({ provider: "google" })}
  >
    Continue with Google
  </Button>
  <Button 
    variant="outline"
    onClick={() => authClient.signIn.social({ provider: "github" })}
  >
    Continue with GitHub
  </Button>
</div>
```

#### Step 3: Environment Setup

```bash
# .env
BETTER_AUTH_SECRET=your-production-secret-min-32-chars-long!!
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

> **Why This Matters**  
> OAuth eliminates password management headaches. Users trust it. Better-Auth handles the OAuth dance, session management, and account linking—you just configure providers and handle the UI.

---

## Deployment: Vercel + Railway/Fly

### Frontend: Vercel

Vercel is the default choice for React apps: zero-config deployments, automatic previews, edge network.

#### Step 1: Prepare for Vercel

```json
// vercel.json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Step 2: Environment Variables

In Vercel dashboard:
- `VITE_API_URL` → `https://api.yourapp.com`

#### Step 3: Deploy

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel --prod
```

### Backend: Railway

Railway offers simple, scalable hosting with automatic deployments from Git.

#### Step 1: Prepare for Railway

```json
// package.json scripts
{
  "scripts": {
    "start": "bun run src/server.ts",
    "build": "bun run drizzle-kit migrate"
  }
}
```

```dockerfile
# Dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install --production

COPY . .
RUN bun run build

EXPOSE 3000

CMD ["bun", "run", "start"]
```

#### Step 2: Create railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "bun run start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 30
  }
}
```

#### Step 3: Environment Variables

In Railway dashboard:
- `DATABASE_URL` → (auto-provisioned PostgreSQL)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

> **Why This Matters**  
> Modern deployment platforms handle the infrastructure complexity. You push code, they handle servers, SSL, scaling, and monitoring. The key is choosing platforms that work together—Vercel for frontend, Railway/Fly for backend, managed PostgreSQL for database.

### Common Pitfalls

⚠️ **Pitfall: Hardcoded localhost URLs**
Use environment variables for all URLs. Check both frontend and backend for hardcoded references.

⚠️ **Pitfall: Missing CORS configuration**
Production CORS must include your actual domain, not just localhost.

⚠️ **Pitfall: Database migrations on deploy**
Run migrations as part of deployment, but have a rollback plan. Test migrations on a staging database first.

⚠️ **Pitfall: Secrets in build output**
Ensure API keys and secrets aren't included in frontend bundles. Only prefix env vars with `VITE_` if they need to be public.

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables documented
- [ ] Database migrations tested on staging
- [ ] OAuth redirect URIs configured
- [ ] CORS origins updated for production
- [ ] No hardcoded localhost URLs
- [ ] Secrets not in frontend bundles

### Frontend (Vercel)
- [ ] `vercel.json` configured
- [ ] Build succeeds locally
- [ ] Environment variables set
- [ ] Custom domain configured (if applicable)

### Backend (Railway/Fly)
- [ ] `railway.json` or `fly.toml` configured
- [ ] Health check endpoint responds
- [ ] Database connected
- [ ] All environment variables set
- [ ] Logs are accessible

### Post-Deployment
- [ ] Frontend loads without errors
- [ ] API health check passes
- [ ] Authentication flow works
- [ ] Database operations succeed

---

# Verification Protocols

AI-generated code requires verification. These protocols catch errors before they compound into disasters.

---

## Protocol 1: "Trust No One"

### What It Is

A systematic verification process for every AI-generated code block. Never assume AI output is correct—verify everything.

### The Process

```
┌─────────────────┐
│  AI Generates   │
│     Code        │
└────────┬────────┘
         ▼
┌─────────────────┐
│  1. Read It     │
│  Understand     │
│  every line     │
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. Check Types │
│  Run TypeScript │
│  compiler       │
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. Test It     │
│  Verify it      │
│  actually works │
└────────┬────────┘
         ▼
┌─────────────────┐
│  4. Check       │
│  Patterns       │
│  Match existing │
│  conventions    │
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. Commit or   │
│  Fix            │
└─────────────────┘
```

### Step-by-Step

#### 1. Read It

Actually read the generated code. Don't skim. Look for:
- Logic errors
- Missing error handling
- Incorrect variable names
- Unnecessary complexity

#### 2. Check Types

```bash
# Run TypeScript compiler
bun run typecheck

# Check for errors
# Fix any type issues before proceeding
```

#### 3. Test It

```bash
# Run the code
# For APIs: test with curl or HTTP client
# For UI: render in browser
# For scripts: execute and verify output
```

#### 4. Check Patterns

Compare against existing code:
- File naming conventions
- Function structure
- Error handling approach
- Import patterns

#### 5. Commit or Fix

If all checks pass, commit. If not, either:
- Fix it yourself
- Prompt AI for corrections with specific feedback

### The "Trust No One" Prompt

When asking AI to verify its own work:

```
Review this code for issues:
[Paste code]

Check for:
1. Type safety - any implicit any types?
2. Error handling - are all errors caught?
3. Edge cases - what could go wrong?
4. Performance - any N+1 queries or unnecessary renders?
5. Security - any injection risks or exposed secrets?

List any issues found and suggest fixes.
```

> **Why This Matters**  
> AI assistants are confident generators of plausible code. They don't know your codebase, your constraints, or your requirements. The "Trust No One" protocol prevents small errors from becoming big problems. Five minutes of verification saves hours of debugging.

---

## Protocol 2: "Frankenstein" Check

### What It Is

A review process for detecting when AI has stitched together incompatible code patterns—like Frankenstein's monster made of mismatched parts.

### Signs of Frankenstein Code

1. **Mixed async patterns**
   ```typescript
   // Bad: mixing callbacks and async/await
   function getData() {
     return new Promise((resolve) => {
       fetchData(async (err, result) => {
         const processed = await process(result);
         resolve(processed);
       });
     });
   }
   ```

2. **Inconsistent error handling**
   ```typescript
   // Bad: different error patterns in same file
   try {
     const a = await fetchA();
   } catch (e) {
     console.error(e);
   }
   
   const b = await fetchB().catch(e => null); // Different pattern!
   ```

3. **Mismatched naming conventions**
   ```typescript
   // Bad: mixing camelCase and snake_case
   const userName = 'John';
   const user_email = 'john@example.com';
   ```

### The Frankenstein Prompt

```
Review this code for Frankenstein patterns:
[Paste code]

Check for:
1. Inconsistent async/await vs callbacks
2. Mixed error handling approaches
3. Inconsistent naming (camelCase vs snake_case)
4. Mixed import styles
5. Duplicate logic that should be shared

Standard patterns in this codebase:
- Bun-first: bun test, bunx, not npm/npx
- SQLite: bun:sqlite, not better-sqlite3
- Error format: { error: string }
- Naming: camelCase for variables, PascalCase for components

Identify any mismatches and suggest unified approaches.
```

### Frankenstein Prevention

1. **Maintain a style guide** - Document your patterns
2. **Use ESLint/Prettier** - Automated consistency
3. **Review AI output** - Check for pattern adherence
4. **Refactor early** - Fix inconsistencies when they're small

> **Why This Matters**  
> Frankenstein code works—until it doesn't. Mixed patterns create cognitive load, hide bugs, and make refactoring terrifying. A codebase with consistent patterns is maintainable. A Frankenstein codebase is a liability.

---

# Quick Reference: AI Prompting Best Practices

### Do

✅ **Provide context**
```
Current file structure:
- src/components/Button.tsx (uses variant prop)
- src/components/Card.tsx (uses className prop)

Create a new Alert component following these patterns.
```

✅ **Be specific**
```
Create a function that:
- Takes a User object with id, email, name
- Returns a greeting string: "Hello, {name}!"
- Handles missing name with fallback to email
```

✅ **Ask for explanations**
```
Generate the code, then explain:
1. Why you chose this approach
2. What alternatives you considered
3. Any trade-offs I should know about
```

✅ **Iterate**
```
The code looks good, but:
1. Add error handling for the fetch call
2. Use the existing useAuth hook instead of inline auth
3. Match the styling of the ProjectList component
```

### Don't

❌ **Be vague**
```
Create a user system.  # Too vague!
```

❌ **Accept first output**
```
[Accepts code without review]  # Dangerous!
```

❌ **Forget constraints**
```
Create a form.  # What fields? What validation? What styling?
```

❌ **Ignore errors**
```
[Sees TypeScript error, moves on]  # Fix it now!
```

---

# Bun-First Development Guide

## Core Principles

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx`
- Bun automatically loads .env, so don't use dotenv

## Bun APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes
- `bun:sqlite` for SQLite (built-in, no npm package)
- `Bun.redis` for Redis
- `Bun.sql` for Postgres
- `WebSocket` is built-in
- Prefer `Bun.file` over `node:fs`
- Use `Bun.$` for shell commands instead of `execa`

## Testing

```typescript
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

Run with: `bun test`

---

# Final Checklist: Before Shipping

### Code Quality
- [ ] TypeScript compiles without errors (`bun run typecheck`)
- [ ] No `any` types without justification
- [ ] All functions have return types
- [ ] Error handling is consistent
- [ ] No console.log statements in production code

### Testing
See Phase 1.5 for comprehensive testing strategy.
- [ ] Keystone Feature works end-to-end
- [ ] All routes are accessible
- [ ] Forms validate and submit correctly
- [ ] Error states display properly
- [ ] Loading states are implemented
- [ ] Automated tests pass (`bun test`)

### Security
- [ ] No secrets in frontend code
- [ ] API endpoints validate all inputs
- [ ] Authentication protects sensitive routes
- [ ] CORS is properly configured
- [ ] Database queries are parameterized

### Performance
- [ ] Images are optimized
- [ ] No unnecessary re-renders
- [ ] API responses are reasonable size
- [ ] Database queries use indexes
- [ ] Bundle size is acceptable

### Deployment
- [ ] Environment variables are set
- [ ] Database migrations run successfully
- [ ] Health check endpoint responds
- [ ] Error tracking is configured
- [ ] Domain and SSL are configured

---

# Conclusion

The Keystone Methodology is a framework for building production-ready applications with AI assistance. It doesn't replace engineering judgment—it amplifies it.

## The Core Principles

1. **Vertical over horizontal** - Build complete features, not complete layers
2. **Pattern over novelty** - Clone what works, don't reinvent
3. **Verify over trust** - Check everything AI generates
4. **Iterate over perfect** - Ship small slices, improve continuously
5. **No cloud, no env** - Start with zero configuration, eject only when needed

## The Workflow at a Glance

```
Week 1: The Breach
├── Day 1: God Script (SQLite, zero config)
├── Day 2: API Split (Hono + RPC, no auth)
├── Day 3: The Mock (UI + mock auth)
├── Day 4: App Shell (routing, layout)
└── Day 5: The Lock (Better-Auth integration)

Week 2: The Flood
├── Elephant Carpaccio slices
├── Clone the pattern (cp -r features/projects features/xxx)
└── Feature after feature

Final: The Ejection (when needed)
├── Database swap (SQLite → PostgreSQL)
├── OAuth providers (optional)
└── Deploy
```

## When to Use This Methodology

✅ **Good fit:**
- Full-stack web applications
- CRUD-heavy applications
- Teams with mixed experience levels
- Projects with clear domain models
- Rapid prototyping that needs to scale

❌ **Not a fit:**
- Highly specialized algorithms
- Real-time systems with complex state
- Applications requiring extreme optimization
- Projects with constantly shifting requirements

## Remember

AI is a tool, not a replacement. The Keystone Methodology gives you structure, but you still need to:

- Understand your domain
- Make architectural decisions
- Review and verify generated code
- Own the final product

The methodology makes AI-assisted development predictable. You still make it good.

---

## Resources

- **Bun:** https://bun.sh
- **Hono:** https://hono.dev
- **Drizzle ORM:** https://orm.drizzle.team
- **TanStack Router:** https://tanstack.com/router
- **TanStack Query:** https://tanstack.com/query
- **shadcn/ui:** https://ui.shadcn.com
- **Better-Auth:** https://www.better-auth.com

---

*The Keystone Methodology - Build fast. Build right. Build together.*
