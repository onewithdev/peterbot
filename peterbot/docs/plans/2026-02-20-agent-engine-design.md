# Agent Engine Design - Phase 1: Chat Foundation

## Overview

Build agentic chat using **Claude Agent SDK** with an adapter layer for GLM-5/Kimi 2.5 compatibility. This is **Phase 1** - focusing on chat functionality only. Skills system comes in Phase 2.

## Goals

1. **Agentic conversations** - Multi-turn chat with automatic tool execution via Claude Agent SDK
2. **Model flexibility** - Use GLM-5 (z.ai) or Kimi 2.5 (Moonshot) via OpenAI-compatible adapter
3. **Unified experience** - Same conversation visible across Telegram and Web dashboard
4. **Foundation for skills** - Architecture supports adding skills in Phase 2

## Non-Goals (Phase 2)

- Skills system (agentskills.io format)
- Progressive disclosure of skills
- Skill selection based on intent
- Script execution from skills

## Architecture

### System Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Telegram      │     │  AgentEngine    │     │   GLM-5 /       │
│   Bot           │────▶│  (Claude SDK)   │────▶│   Kimi 2.5      │
│                 │◀────│                 │◀────│   (via adapter) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        ▲                       │
        │                       │
        │               ┌───────┴───────┐
        │               │  OpenAI-      │
        │               │  Compatible   │
        │               │  Adapter      │
        │               └───────────────┘
        │
┌─────────────────┐
│   Web Dashboard │
│   Chat API      │
└─────────────────┘
```

### Component Layers

| Layer | Components | Responsibility |
|-------|------------|----------------|
| **Interface** | Telegram handlers, Web API routes | Receive/send messages |
| **Engine** | AgentEngine, Claude SDK | Orchestrate agent loop, tool execution |
| **Adapter** | OpenAICompatibleAdapter | Translate Claude ↔ OpenAI formats |
| **Provider** | GLM-5 or Kimi 2.5 API | Language model |
| **Storage** | ChatRepository, SQLite | Persist conversations |

## The Adapter Pattern

Claude Agent SDK is designed for Claude API. To use GLM-5/Kimi, we create an adapter:

```typescript
// Claude SDK expects this format internally
interface ClaudeRequest {
  messages: Array<{ role: 'user' | 'assistant' | 'tool'; content: string; }>;
  tools?: Tool[];
}

// GLM-5/Kimi use OpenAI format
interface OpenAIRequest {
  model: string;
  messages: Array<{ role: string; content: string; }>;
  tools?: OpenAITool[];
}

// Adapter translates between them
class OpenAICompatibleAdapter {
  async complete(claudeRequest: ClaudeRequest): Promise<ClaudeResponse> {
    // 1. Convert to OpenAI format
    const openaiRequest = this.toOpenAI(claudeRequest);
    
    // 2. Call GLM-5 or Kimi
    const openaiResponse = await this.client.chat.completions.create(openaiRequest);
    
    // 3. Convert back to Claude format
    return this.toClaude(openaiResponse);
  }
}
```

## Data Model

### Chat Session

```typescript
interface ChatSession {
  id: string;                    // UUID
  userId: string;                // Telegram chat ID or web user ID
  title: string | null;          // Auto-generated from first message
  model: 'glm-5' | 'kimi-k2.5';  // Which model is used
  activeChannels: ('telegram' | 'web')[];  // Where user is active
  createdAt: Date;
  updatedAt: Date;
}
```

### Chat Message

```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  toolResults?: Array<{
    toolCallId: string;
    result: unknown;
  }>;
  source: 'telegram' | 'web';    // Where message originated
  createdAt: Date;
}
```

### Database Schema

```sql
-- chat_sessions table
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  model TEXT NOT NULL,  -- 'glm-5' or 'kimi-k2.5'
  active_channels TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX chat_sessions_user_id_idx ON chat_sessions(user_id);

-- chat_messages table
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'user', 'assistant', 'tool'
  content TEXT NOT NULL,
  tool_calls TEXT,     -- JSON
  tool_results TEXT,   -- JSON
  source TEXT NOT NULL, -- 'telegram' or 'web'
  created_at INTEGER NOT NULL
);

CREATE INDEX chat_messages_session_id_idx ON chat_messages(session_id);
```

## Components

### 1. OpenAICompatibleAdapter

**File:** `src/features/agent/adapter.ts`

Translates between Claude SDK format and OpenAI-compatible APIs.

**Interface:**
```typescript
class OpenAICompatibleAdapter {
  constructor(config: {
    baseURL: string;    // 'https://api.z.ai/api/paas/v4' or 'https://api.moonshot.cn/v1'
    apiKey: string;
    model: string;      // 'glm-5' or 'kimi-k2.5'
  });
  
  // Main method - called by AgentEngine
  async complete(messages: ClaudeMessage[], options?: {
    tools?: Tool[];
    maxTokens?: number;
  }): Promise<ClaudeMessage>;
  
  // Factory helper
  static create(model: 'glm-5' | 'kimi-k2.5', apiKey: string): OpenAICompatibleAdapter;
}
```

**Responsibilities:**
- Convert Claude message format to OpenAI format
- Convert OpenAI tool format to/from Claude format
- Handle API calls to GLM-5 or Kimi endpoints
- Parse streaming responses (future)

### 2. AgentEngine

**File:** `src/features/agent/engine.ts`

Main orchestrator using Claude Agent SDK.

**Interface:**
```typescript
class AgentEngine {
  constructor(config: {
    adapter: OpenAICompatibleAdapter;
    repository: ChatRepository;
  });

  // Process a user message
  async processMessage(input: {
    message: string;
    userId: string;
    source: 'telegram' | 'web';
    sessionId?: string;  // Optional - continue existing session
  }): Promise<{
    content: string;
    sessionId: string;
  }>;
  
  private getTools(): Tool[];
  private getSystemPrompt(): string;
}
```

**Message Flow:**
1. Receive message from Telegram or Web
2. Get or create chat session for user
3. Save user message to database
4. Load conversation history (last 20 messages)
5. Call Claude Agent SDK with adapter
6. Agent SDK handles tool calling loop
7. Save assistant response to database
8. Return response to caller

**Tools Available:**
- `run_code` - Execute Python in E2B sandbox
- `execute_integration_action` - Call Composio integrations

### 3. ChatRepository

**File:** `src/features/chat/repository.ts`

Data access layer for chat sessions and messages.

**Interface:**
```typescript
class ChatRepository {
  async createSession(userId: string, model: 'glm-5' | 'kimi-k2.5'): Promise<ChatSession>;
  async getSession(id: string): Promise<ChatSession | null>;
  async getSessionByUserId(userId: string): Promise<ChatSession | null>;
  async addMessage(message: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<ChatMessage>;
  async getMessages(sessionId: string, limit?: number): Promise<ChatMessage[]>;
  async updateSessionChannels(sessionId: string, channels: ('telegram' | 'web')[]): Promise<void>;
}
```

### 4. Telegram Integration

**File:** `src/core/telegram/handlers.ts` (modified)

Handler function for Telegram messages:

```typescript
async function handleAgentMessage(ctx: Context) {
  const response = await agentEngine.processMessage({
    message: ctx.message.text,
    source: 'telegram',
    userId: String(ctx.chat.id),
  });
  
  await ctx.reply(response.content);
}
```

### 5. Web Dashboard API

**File:** `src/core/dashboard/chat-routes.ts`

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message, get response |
| GET | `/api/chat/sessions` | List user's chat sessions |
| GET | `/api/chat/:sessionId/messages` | Get messages for session |

## Message Flow

### User Sends Message (Telegram)

```
User → Telegram → Bot Handler → AgentEngine.processMessage()
  │
  ▼
AgentEngine
  ├── Get/create session
  ├── Save user message
  ├── Load history
  ├── Call Claude SDK
  │   └── Adapter → GLM-5/Kimi API
  ├── Handle tool calls (if any)
  ├── Save assistant response
  └── Return response
  │
  ▼
Bot Handler → Telegram → User
```

### Tool Execution Flow

```
AgentEngine → Claude SDK → Adapter → GLM-5/Kimi
  │
  │  Model requests tool call
  ▼
Execute tool (run_code, etc.)
  │
  │  Tool result
  ▼
AgentEngine → Claude SDK → Adapter → GLM-5/Kimi
  │
  │  Final response
  ▼
Return to user
```

## Configuration

### Environment Variables

```bash
# Model selection
AGENT_MODEL=glm-5              # or 'kimi-k2.5'

# API keys (only need one based on AGENT_MODEL)
ZAI_API_KEY=your_zai_key_here
MOONSHOT_API_KEY=your_moonshot_key_here

# Feature flag
USE_AGENT_ENGINE=false         # Set to 'true' to enable

# Optional
AGENT_MAX_TURNS=10             # Max agent loop iterations
```

### Model Endpoints

| Model | Base URL | Documentation |
|-------|----------|---------------|
| GLM-5 | `https://api.z.ai/api/paas/v4` | z.ai docs |
| Kimi 2.5 | `https://api.moonshot.cn/v1` | Moonshot docs |

Both use OpenAI-compatible API format.

## Error Handling

### Adapter Errors
- API key invalid → 401 Unauthorized → Return "API key error" to user
- Model unavailable → 503 → Return "Model temporarily unavailable"
- Rate limited → 429 → Retry with backoff

### Agent Loop Errors
- Max turns exceeded → Stop loop, return partial response
- Tool execution fails → Return error to model, let it handle
- Timeout → Return "Request timed out"

### Database Errors
- Connection lost → Log error, return "Database error"
- Constraint violation → Log error, continue (shouldn't happen)

## Testing Strategy

### Unit Tests
- Adapter conversion functions
- ChatRepository CRUD operations
- AgentEngine message processing (mocked adapter)

### Integration Tests
- Full flow: message → adapter → mock API → response
- Tool execution flow
- Session persistence

### Manual Tests
- Telegram end-to-end
- Web dashboard end-to-end
- Multi-channel (Telegram + Web same session)

## Migration Path

1. **Deploy Phase 1** - AgentEngine alongside existing code
2. **Feature flag** - `USE_AGENT_ENGINE=true` enables new path
3. **Test thoroughly** - Both Telegram and Web
4. **Remove old code** - Once stable
5. **Phase 2** - Add skills system

## Phase 2 Preview

After Phase 1 is stable, add:

```
skills/                          # agentskills.io format
├── web-scraping/
│   ├── SKILL.md                 # YAML frontmatter + instructions
│   ├── scripts/
│   └── references/
└── ...
```

**SkillsLoader** will:
1. Scan `skills/` folder
2. Parse SKILL.md metadata
3. Select relevant skills based on user message
4. Inject instructions into agent context

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude SDK incompatible with GLM-5/Kimi | Medium | High | Adapter handles translation; fallback to direct API if needed |
| Tool format differences | Medium | Medium | Test tool calling thoroughly; adjust adapter |
| Performance (extra translation layer) | Low | Low | Adapter is lightweight; monitor latency |
| Claude SDK updates break adapter | Medium | Medium | Pin SDK version; update adapter as needed |

## Success Criteria

- [ ] Messages processed through AgentEngine
- [ ] Tool calls work (run_code, Composio)
- [ ] Conversations persist across sessions
- [ ] Same conversation visible in Telegram and Web
- [ ] Can switch between GLM-5 and Kimi via env var
- [ ] All existing tests pass
- [ ] New tests for chat repository and adapter
