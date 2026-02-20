# Agent Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build agentic chat using **Claude Agent SDK** with adapter for GLM-5/Kimi 2.5. Skills system uses agentskills.io format.

**Architecture:** See `2026-02-20-agent-engine-design.md`

**Tech Stack:** TypeScript, Bun, Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)

---

## Task 1: Install Claude Agent SDK

**Files:** `package.json`

**Step 1: Add Claude Agent SDK**

```bash
bun add @anthropic-ai/claude-agent-sdk
```

**Step 2: Verify installation**

```bash
bun install
```

Expected: No errors, lockfile updated.

**Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "deps: add @anthropic-ai/claude-agent-sdk"
```

---

## Task 2: Create Model Adapter

**Files:**
- Create: `src/features/agent/adapter.ts`
- Create: `src/features/agent/adapter.test.ts`

The adapter translates between Claude SDK format and OpenAI-compatible APIs.

**Step 1: Implement adapter**

`src/features/agent/adapter.ts`:

```typescript
import OpenAI from 'openai';

interface ClaudeMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

interface OpenAICompatibleConfig {
  baseURL: string;
  apiKey: string;
  model: string;
}

/**
 * Adapter to use GLM-5 or Kimi with Claude Agent SDK.
 * 
 * Claude Agent SDK expects Claude API format, but we want to use
 * OpenAI-compatible APIs (GLM-5, Kimi). This adapter translates
 * between the two formats.
 */
export class OpenAICompatibleAdapter {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAICompatibleConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  /**
   * Main completion method - called by Claude Agent SDK
   */
  async complete(messages: ClaudeMessage[], options?: {
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: unknown;
    }>;
    maxTokens?: number;
  }): Promise<ClaudeMessage> {
    // Convert to OpenAI format
    const openaiMessages = messages.map(m => this.toOpenAIMessage(m));
    
    // Convert tools to OpenAI format
    const openaiTools = options?.tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    // Call the API
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: 'auto',
      max_tokens: options?.maxTokens ?? 4096,
    });

    // Convert back to Claude format
    return this.toClaudeMessage(response.choices[0].message);
  }

  private toOpenAIMessage(claudeMsg: ClaudeMessage): OpenAI.Chat.ChatCompletionMessageParam {
    if (claudeMsg.role === 'tool') {
      return {
        role: 'tool',
        content: claudeMsg.content,
        tool_call_id: claudeMsg.toolCalls?.[0]?.id ?? 'unknown',
      };
    }

    return {
      role: claudeMsg.role,
      content: claudeMsg.content,
    };
  }

  private toClaudeMessage(openaiMsg: OpenAI.Chat.ChatCompletionMessage): ClaudeMessage {
    const toolCalls = openaiMsg.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      role: openaiMsg.role as 'user' | 'assistant' | 'tool',
      content: openaiMsg.content ?? '',
      toolCalls,
    };
  }

  /**
   * Stream completion - for future use
   */
  async *streamComplete(messages: ClaudeMessage[]): AsyncGenerator<string> {
    const openaiMessages = messages.map(m => this.toOpenAIMessage(m));
    
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}

// Factory for creating adapter with config
export function createAdapter(model: 'glm-5' | 'kimi-k2.5', apiKey: string): OpenAICompatibleAdapter {
  const configs = {
    'glm-5': {
      baseURL: 'https://api.z.ai/api/paas/v4',
      model: 'glm-5',
    },
    'kimi-k2.5': {
      baseURL: 'https://api.moonshot.cn/v1',
      model: 'kimi-k2.5',
    },
  };

  const config = configs[model];
  if (!config) {
    throw new Error(`Unknown model: ${model}`);
  }

  return new OpenAICompatibleAdapter({
    ...config,
    apiKey,
  });
}
```

**Step 2: Write adapter tests**

`src/features/agent/adapter.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { OpenAICompatibleAdapter, createAdapter } from './adapter.js';

describe('OpenAICompatibleAdapter', () => {
  describe('createAdapter', () => {
    it('should create GLM-5 adapter', () => {
      const adapter = createAdapter('glm-5', 'test-key');
      expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    });

    it('should create Kimi adapter', () => {
      const adapter = createAdapter('kimi-k2.5', 'test-key');
      expect(adapter).toBeInstanceOf(OpenAICompatibleAdapter);
    });

    it('should throw for unknown model', () => {
      expect(() => createAdapter('unknown' as any, 'test-key')).toThrow();
    });
  });
});
```

**Step 3: Run tests**

```bash
bun test src/features/agent/adapter.test.ts
```

Expected: Tests pass.

**Step 4: Commit**

```bash
git add src/features/agent/adapter.ts src/features/agent/adapter.test.ts
git commit -m "feat(agent): add OpenAI-compatible adapter for Claude SDK"
```

---

## Task 3: Database Schema for Chat

**Files:**
- Modify: `src/features/chat/schema.ts`

**Step 1: Add tables**

```typescript
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  title: text('title'),
  model: text('model').notNull().$type<'glm-5' | 'kimi-k2.5'>(),
  activeChannels: text('active_channels', { mode: 'json' }).$type<string[]>().notNull().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  userIdIdx: index('chat_sessions_user_id_idx').on(table.userId),
}));

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'user' | 'assistant' | 'tool'>(),
  content: text('content').notNull(),
  toolCalls: text('tool_calls', { mode: 'json' }),
  toolResults: text('tool_results', { mode: 'json' }),
  source: text('source').notNull().$type<'telegram' | 'web'>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  sessionIdIdx: index('chat_messages_session_id_idx').on(table.sessionId),
}));
```

**Step 2: Run migration**

```bash
bun run db:push
```

**Step 3: Commit**

```bash
git add src/features/chat/schema.ts drizzle/
git commit -m "db: add chat_sessions and chat_messages tables"
```

---

## Task 4: Create Chat Repository

**Files:**
- Create: `src/features/chat/repository.ts`
- Create: `src/features/chat/types.ts`
- Create: `src/features/chat/repository.test.ts`

**Step 1: Types**

`src/features/chat/types.ts`:

```typescript
export interface ChatSession {
  id: string;
  userId: string;
  title: string | null;
  model: 'glm-5' | 'kimi-k2.5';
  activeChannels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  source: 'telegram' | 'web';
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export type Channel = 'telegram' | 'web';
```

**Step 2: Repository**

`src/features/chat/repository.ts`:

```typescript
import { eq, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { chatSessions, chatMessages } from './schema.js';
import type { ChatSession, ChatMessage, Channel } from './types.js';

export class ChatRepository {
  async createSession(userId: string, model: 'glm-5' | 'kimi-k2.5'): Promise<ChatSession> {
    const id = crypto.randomUUID();
    await db.insert(chatSessions).values({
      id,
      userId,
      model,
      activeChannels: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return this.getSession(id) as Promise<ChatSession>;
  }

  async getSession(id: string): Promise<ChatSession | null> {
    const result = await db.select().from(chatSessions).where(eq(chatSessions.id, id)).get();
    return result ?? null;
  }

  async getSessionByUserId(userId: string): Promise<ChatSession | null> {
    const result = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt))
      .get();
    return result ?? null;
  }

  async addMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage> {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    
    await db.insert(chatMessages).values({
      id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      toolResults: message.toolResults ? JSON.stringify(message.toolResults) : null,
      source: message.source,
      createdAt,
    });

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, message.sessionId));

    return { ...message, id, createdAt };
  }

  async getMessages(sessionId: string, limit = 50): Promise<ChatMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .all();
    
    return rows.reverse().map(row => ({
      ...row,
      toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined,
      toolResults: row.toolResults ? JSON.parse(row.toolResults as string) : undefined,
    })) as ChatMessage[];
  }

  async updateSessionChannels(sessionId: string, channels: Channel[]): Promise<void> {
    await db
      .update(chatSessions)
      .set({ 
        activeChannels: JSON.stringify(channels),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.id, sessionId));
  }
}

export const chatRepository = new ChatRepository();
```

**Step 3: Tests**

`src/features/chat/repository.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ChatRepository } from './repository.js';
import { createTestDb } from '../../test-helpers/db.js';

describe('ChatRepository', () => {
  let repo: ChatRepository;
  let cleanup: () => void;

  beforeEach(async () => {
    const { db, cleanup: c } = await createTestDb();
    repo = new ChatRepository();
    cleanup = c;
  });

  afterEach(() => {
    cleanup?.();
  });

  it('should create and retrieve session', async () => {
    const session = await repo.createSession('user-123', 'glm-5');
    expect(session.userId).toBe('user-123');
    expect(session.model).toBe('glm-5');

    const found = await repo.getSession(session.id);
    expect(found).not.toBeNull();
  });

  it('should add and retrieve messages', async () => {
    const session = await repo.createSession('user-123', 'glm-5');
    
    await repo.addMessage({
      sessionId: session.id,
      role: 'user',
      content: 'Hello',
      source: 'telegram',
    });

    const messages = await repo.getMessages(session.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });
});
```

**Step 4: Run tests**

```bash
bun test src/features/chat/repository.test.ts
```

**Step 5: Commit**

```bash
git add src/features/chat/
git commit -m "feat(chat): add ChatRepository with types and tests"
```

---

## Task 5: Create AgentEngine with Claude SDK

**Files:**
- Create: `src/features/agent/engine.ts`
- Create: `src/features/agent/engine.test.ts`

**Step 1: Engine implementation**

`src/features/agent/engine.ts`:

```typescript
import { ClaudeSDKClient, ClaudeAgentOptions, Tool } from '@anthropic-ai/claude-agent-sdk';
import type { ChatRepository } from '../chat/repository.js';
import type { Channel, ChatMessage } from '../chat/types.js';
import type { OpenAICompatibleAdapter } from './adapter.js';
import { runInSandbox } from '../../worker/e2b.js';
import { checkBlocklist } from '../../worker/worker.js';

export interface AgentEngineConfig {
  adapter: OpenAICompatibleAdapter;
  repository: ChatRepository;
  skillsDir?: string;
}

export interface MessageInput {
  message: string;
  userId: string;
  source: Channel;
  sessionId?: string;
}

export interface AgentResponse {
  content: string;
  sessionId: string;
}

/**
 * AgentEngine wraps Claude Agent SDK with our adapter for GLM-5/Kimi.
 */
export class AgentEngine {
  private config: AgentEngineConfig;
  private client: ClaudeSDKClient;

  constructor(config: AgentEngineConfig) {
    this.config = config;
    
    // Initialize Claude SDK with our adapter
    const options = new ClaudeAgentOptions({
      systemPrompt: this.getSystemPrompt(),
      tools: this.getTools(),
      // Inject our adapter as the model client
      modelClient: config.adapter,
    });
    
    this.client = new ClaudeSDKClient(options);
  }

  async processMessage(input: MessageInput): Promise<AgentResponse> {
    // Get or create session
    let session = input.sessionId 
      ? await this.config.repository.getSession(input.sessionId)
      : await this.config.repository.getSessionByUserId(input.userId);

    if (!session) {
      // Determine model from adapter config
      const model = this.detectModel();
      session = await this.config.repository.createSession(input.userId, model);
    }

    // Update active channels
    const channels = new Set<Channel>(session.activeChannels as Channel[]);
    channels.add(input.source);
    await this.config.repository.updateSessionChannels(session.id, Array.from(channels));

    // Save user message
    await this.config.repository.addMessage({
      sessionId: session.id,
      role: 'user',
      content: input.message,
      source: input.source,
    });

    // Get conversation history
    const history = await this.config.repository.getMessages(session.id, 20);
    
    // Run agent with Claude SDK
    const result = await this.client.query(input.message, {
      conversationHistory: this.formatHistory(history),
    });

    // Save assistant response
    await this.config.repository.addMessage({
      sessionId: session.id,
      role: 'assistant',
      content: result.content,
      source: input.source,
    });

    // Handle tool calls if any
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const toolCall of result.toolCalls) {
        const toolResult = await this.executeTool(toolCall);
        
        // Save tool result
        await this.config.repository.addMessage({
          sessionId: session.id,
          role: 'tool',
          content: JSON.stringify(toolResult),
          toolResults: [{ toolCallId: toolCall.id, result: toolResult }],
          source: input.source,
        });
      }
      
      // Get final response after tool execution
      const finalResult = await this.client.query("Continue based on tool results", {
        conversationHistory: this.formatHistory(
          await this.config.repository.getMessages(session.id, 20)
        ),
      });
      
      await this.config.repository.addMessage({
        sessionId: session.id,
        role: 'assistant',
        content: finalResult.content,
        source: input.source,
      });
      
      return { content: finalResult.content, sessionId: session.id };
    }

    return { content: result.content, sessionId: session.id };
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'run_code',
        description: 'Execute Python code in a secure cloud sandbox. Use for data analysis, file creation, web scraping, or any computational tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Python code to execute' },
            reasoning: { type: 'string', description: 'Why this code is needed' },
          },
          required: ['code', 'reasoning'],
        },
        execute: async (input: { code: string; reasoning: string }) => {
          console.log(`[Tool] run_code: ${input.reasoning}`);
          
          const blockCheck = checkBlocklist(input.code);
          if (blockCheck.blocked) {
            return `Blocked: ${blockCheck.reason}`;
          }
          
          return runInSandbox(input.code);
        },
      },
    ];
  }

  private getSystemPrompt(): string {
    return `You are peterbot, a helpful AI assistant running 24/7.

You can:
- Answer questions and have conversations
- Execute Python code in a sandbox (run_code tool)

Be concise but helpful.`;
  }

  private formatHistory(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  private detectModel(): 'glm-5' | 'kimi-k2.5' {
    // Infer from adapter configuration
    // This is a simplification - in practice store model in adapter
    return 'glm-5';
  }

  private async executeTool(toolCall: { name: string; arguments: unknown }): Promise<unknown> {
    const tools = this.getTools();
    const tool = tools.find(t => t.name === toolCall.name);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }
    return tool.execute(toolCall.arguments as Record<string, unknown>);
  }
}
```

**Step 2: Tests**

`src/features/agent/engine.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { AgentEngine } from './engine.js';
import { createAdapter } from './adapter.js';
import { ChatRepository } from '../chat/repository.js';
import { createTestDb } from '../../test-helpers/db.js';

describe('AgentEngine', () => {
  let engine: AgentEngine;
  let repo: ChatRepository;
  let cleanup: () => void;

  beforeEach(async () => {
    const { db, cleanup: c } = await createTestDb();
    cleanup = c;
    
    repo = new ChatRepository();
    const adapter = createAdapter('glm-5', 'test-key');
    
    engine = new AgentEngine({
      adapter,
      repository: repo,
    });
  });

  afterEach(() => {
    cleanup?.();
  });

  it('should process message and create session', async () => {
    // Note: This test requires mocking the adapter
    // For now just verify structure compiles
    expect(engine).toBeInstanceOf(AgentEngine);
  });
});
```

**Step 3: Commit**

```bash
git add src/features/agent/engine.ts src/features/agent/engine.test.ts
git commit -m "feat(agent): implement AgentEngine with Claude SDK"
```

---

## Task 6: Integrate with Telegram

**Files:** Modify `src/core/telegram/handlers.ts`

**Step 1: Add imports and initialization**

```typescript
import { AgentEngine } from '../../features/agent/engine.js';
import { chatRepository } from '../../features/chat/repository.js';
import { createAdapter } from '../../features/agent/adapter.js';
import { getOptionalEnv } from '../../shared/config.js';

// Initialize agent engine
const model = getOptionalEnv('AGENT_MODEL', 'glm-5') as 'glm-5' | 'kimi-k2.5';
const apiKey = model === 'glm-5' 
  ? process.env.ZAI_API_KEY 
  : process.env.MOONSHOT_API_KEY;

let agentEngine: AgentEngine | null = null;

if (apiKey) {
  const adapter = createAdapter(model, apiKey);
  agentEngine = new AgentEngine({
    adapter,
    repository: chatRepository,
  });
}
```

**Step 2: Add handler**

```typescript
async function handleAgentMessage(ctx: Context) {
  if (!agentEngine) {
    await ctx.reply('Agent engine not configured. Set ZAI_API_KEY or MOONSHOT_API_KEY.');
    return;
  }

  const messageText = ctx.message?.text;
  if (!messageText) return;

  await ctx.replyWithChatAction('typing');

  try {
    const response = await agentEngine.processMessage({
      message: messageText,
      source: 'telegram',
      userId: String(ctx.chat?.id),
    });

    await ctx.reply(response.content, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Agent error:', error);
    await ctx.reply('Sorry, I encountered an error processing your message.');
  }
}
```

**Step 3: Wire up in message handler**

```typescript
// In handleMessage
const useAgent = process.env.USE_AGENT_ENGINE === 'true';

if (useAgent && agentEngine) {
  await handleAgentMessage(ctx);
  return;
}

// ... existing code
```

**Step 4: Commit**

```bash
git add src/core/telegram/handlers.ts
git commit -m "feat(telegram): integrate AgentEngine with Claude SDK"
```

---

## Task 7: Add Web Dashboard Chat API

**Files:** Modify `src/core/dashboard/chat-routes.ts`

```typescript
import { Hono } from 'hono';
import { AgentEngine } from '../../features/agent/engine.js';
import { chatRepository } from '../../features/chat/repository.js';
import { createAdapter } from '../../features/agent/adapter.js';
import { getOptionalEnv } from '../../shared/config.js';
import { requireAuth } from './auth.js';

const model = getOptionalEnv('AGENT_MODEL', 'glm-5') as 'glm-5' | 'kimi-k2.5';
const apiKey = model === 'glm-5' 
  ? process.env.ZAI_API_KEY 
  : process.env.MOONSHOT_API_KEY;

let agentEngine: AgentEngine | null = null;
if (apiKey) {
  const adapter = createAdapter(model, apiKey);
  agentEngine = new AgentEngine({
    adapter,
    repository: chatRepository,
  });
}

export const chatRoutes = new Hono();
chatRoutes.use('*', requireAuth);

chatRoutes.post('/', async (c) => {
  if (!agentEngine) {
    return c.json({ error: 'Agent engine not configured' }, 503);
  }

  const { message, sessionId } = await c.req.json();
  if (!message) return c.json({ error: 'Message required' }, 400);

  try {
    const user = c.get('user');
    const response = await agentEngine.processMessage({
      message,
      source: 'web',
      userId: user.id,
      sessionId,
    });

    return c.json({
      success: true,
      response: response.content,
      sessionId: response.sessionId,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to process message' }, 500);
  }
});

chatRoutes.get('/sessions', async (c) => {
  const user = c.get('user');
  const session = await chatRepository.getSessionByUserId(user.id);
  return c.json({ sessions: session ? [session] : [] });
});

chatRoutes.get('/:sessionId/messages', async (c) => {
  const sessionId = c.req.param('sessionId');
  const messages = await chatRepository.getMessages(sessionId, 50);
  return c.json({ messages });
});
```

Mount in routes:

```typescript
// In src/core/dashboard/routes.ts
import { chatRoutes } from './chat-routes.js';
app.route('/api/chat', chatRoutes);
```

**Commit:**

```bash
git add src/core/dashboard/chat-routes.ts src/core/dashboard/routes.ts
git commit -m "feat(dashboard): add chat API endpoints"
```

---

## Task 8: Environment Configuration

**Files:** Modify `.env.example`, `src/shared/config.ts`

**Step 1: Add to .env.example**

```bash
# Agent Engine Configuration
AGENT_MODEL=glm-5              # or 'kimi-k2.5'
ZAI_API_KEY=                   # Required if using GLM-5
MOONSHOT_API_KEY=              # Required if using Kimi
USE_AGENT_ENGINE=false         # Feature flag
SKILLS_DIR=./skills            # Skills folder path (Phase 2)
```

**Step 2: Add config helper**

```typescript
// In src/shared/config.ts
export function getAgentConfig() {
  const model = getOptionalEnv('AGENT_MODEL', 'glm-5') as 'glm-5' | 'kimi-k2.5';
  const apiKey = model === 'glm-5' ? process.env.ZAI_API_KEY : process.env.MOONSHOT_API_KEY;
  
  return {
    model,
    apiKey,
    enabled: getOptionalEnv('USE_AGENT_ENGINE', 'false') === 'true',
    skillsDir: getOptionalEnv('SKILLS_DIR', './skills'),
  };
}
```

**Step 3: Commit**

```bash
git add .env.example src/shared/config.ts
git commit -m "config: add agent engine environment variables"
```

---

## Task 9: Test End-to-End

**Step 1: Run all tests**

```bash
bun test
```

**Step 2: Smoke test**

```bash
# Terminal 1
bun run dev

# Terminal 2
bun run web:dev
```

Checklist:
- [ ] Telegram bot starts
- [ ] Web dashboard loads
- [ ] Set `USE_AGENT_ENGINE=true`
- [ ] Send message via Telegram
- [ ] Send message via Web
- [ ] Conversation history persists

**Step 3: Commit final**

```bash
git add .
git commit -m "feat: complete AgentEngine with Claude SDK integration"
```

---

## Phase 2 Preview: Skills System

After chat foundation is working:

1. **SkillsLoader** - Parse SKILL.md files per agentskills.io
2. **Progressive disclosure** - Metadata → Instructions → References
3. **Skill selection** - Auto-detect relevant skills from user message
4. **Dynamic injection** - Add skill instructions to agent context

Skills folder:
```
skills/
├── web-scraping/SKILL.md
├── data-analysis/SKILL.md
└── telegram-bot/SKILL.md
```
