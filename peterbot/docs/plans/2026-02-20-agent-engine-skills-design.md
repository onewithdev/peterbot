# Agent Engine Skills Design - Phase 2

## Overview

Phase 2 adds the **Skills system** to the Agent Engine built in Phase 1. Skills are file-based, modular capabilities that teach the agent how to perform specific tasks. They follow the [agentskills.io](https://agentskills.io) open specification.

## Goals

1. **File-based skills** - Skills are folders with SKILL.md files, no code changes needed to add skills
2. **Progressive disclosure** - Load only relevant skill metadata initially, full skill content when needed
3. **Automatic skill selection** - Agent determines which skills are relevant to the user's request
4. **Skill execution** - Skills can include executable scripts and reference materials
5. **Open standard compatibility** - Follow agentskills.io spec for portability

## Non-Goals

- Visual skill editor (CLI/file-based only)
- Skill marketplace integration
- Version control for skills
- Multi-agent skill delegation (sub-agents)

## Skills Architecture

### System Diagram (Phase 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AgentEngine                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Claude     │  │   Skills     │  │    Tool      │              │
│  │   SDK        │◀─│   Loader     │  │   Registry   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│         │                 │                  │                       │
│         │                 ▼                  ▼                       │
│         │          ┌──────────────┐  ┌──────────────┐               │
│         │          │   Skills     │  │   Tools      │               │
│         │          │   (loaded)   │  │  (from skills)│               │
│         │          └──────────────┘  └──────────────┘               │
│         │                                                            │
│         └────────────────────────────────────────────────────────▶   │
│                              User Query                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Skills Directory                             │
│                                                                      │
│  skills/                                                             │
│  ├── web-scraping/                                                   │
│  │   ├── SKILL.md          ← Instructions + metadata                │
│  │   ├── scripts/                                                     │
│  │   │   └── scraper.py    ← Executable helpers                      │
│  │   └── references/                                                  │
│  │       └── selectors.md  ← Additional docs                         │
│  │                                                                    │
│  ├── data-analysis/                                                  │
│  │   ├── SKILL.md                                                    │
│  │   └── scripts/                                                    │
│  │       └── chart.py                                                │
│  │                                                                    │
│  └── telegram-bot/                                                   │
│      └── SKILL.md                                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Progressive Disclosure

```
Step 1: Startup
┌──────────────────────────────────────────────────────┐
│ SkillsLoader.scan()                                  │
│                                                      │
│ Loads ONLY metadata from each SKILL.md:              │
│ • name                                               │
│ • description                                        │
│ • compatibility                                      │
│                                                      │
│ Cost: ~100 tokens per skill                          │
└──────────────────────────────────────────────────────┘
           │
           ▼
Step 2: User Query
┌──────────────────────────────────────────────────────┐
│ SkillsLoader.select(query)                           │
│                                                      │
│ Agent decides which skills are relevant:             │
│ "scrape data from website" → web-scraping skill      │
│                                                      │
│ Cost: 0 tokens (uses cached metadata)                │
└──────────────────────────────────────────────────────┘
           │
           ▼
Step 3: Skill Activation
┌──────────────────────────────────────────────────────┐
│ SkillsLoader.load(name)                              │
│                                                      │
│ Loads FULL skill:                                    │
│ • SKILL.md body (instructions)                       │
│ • Tool definitions from scripts/                     │
│                                                      │
│ Cost: ~2000-5000 tokens per loaded skill             │
└──────────────────────────────────────────────────────┘
```

## Skills Format (agentskills.io)

### Directory Structure

```
skill-name/
├── SKILL.md              # Required: metadata + instructions
├── scripts/              # Optional: executable code
│   ├── helper.py
│   └── utils.js
├── references/           # Optional: additional documentation
│   ├── REFERENCE.md
│   └── examples.md
└── assets/               # Optional: templates, images, data
    └── template.json
```

### SKILL.md Format

```markdown
---
name: web-scraping
description: |
  Extract data from websites using Python requests, BeautifulSoup, 
  and Playwright. Use when user wants to scrape data, extract 
  information from web pages, or crawl websites. Examples: 
  "get prices from Amazon", "scrape news articles", "download images".
license: MIT
compatibility: |
  Requires Python 3.8+, requests, beautifulsoup4, playwright.
  Network access required. Headless browser for JS sites.
metadata:
  author: peterbot
  version: "1.2.0"
  category: data-collection
allowed-tools: Bash(curl:*) Bash(python3:*) Read Write
---

# Web Scraping

## Overview

This skill helps you extract data from websites using various techniques.

## Quick Start

1. Analyze the target website structure
2. Determine if content is static or JavaScript-rendered
3. Choose appropriate tool (requests vs Playwright)
4. Extract data and save to desired format

## Techniques

### Static HTML

Use for simple sites without JavaScript:

```python
import requests
from bs4 import BeautifulSoup

response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'})
soup = BeautifulSoup(response.text, 'html.parser')

# Extract data
titles = [h.get_text() for h in soup.find_all('h2')]
```

### JavaScript-Rendered

Use for SPAs, React/Vue sites:

```python
from scripts.scraper import render_page

html = render_page("https://example.com")
# Now parse with BeautifulSoup
```

## Edge Cases

- **Rate limiting**: Add delays between requests
- **CAPTCHAs**: Ask user for help or try different approach
- **Dynamic content**: Use headless browser, wait for elements
- **Authentication**: Check for login requirements first

## Output Formats

Save data as:
- CSV for tabular data
- JSON for structured data  
- Markdown for text content

## Safety

- Always check robots.txt
- Respect rate limits
- Don't scrape personal data without permission
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier (lowercase, hyphens, max 64 chars) |
| `description` | Yes | What skill does + when to use it (max 1024 chars) |
| `license` | No | License name or file reference |
| `compatibility` | No | Environment requirements, dependencies |
| `metadata` | No | Arbitrary key-value pairs (author, version, etc.) |
| `allowed-tools` | No | Pre-approved tools this skill can use |

## Components

### 1. SkillsLoader

**File:** `src/features/agent/skills/loader.ts`

Parses skills directory and manages progressive disclosure.

**Interface:**
```typescript
class SkillsLoader {
  constructor(skillsDir: string);
  
  // Phase 1: Load metadata for all skills
  async loadMetadata(): Promise<SkillMetadata[]>;
  
  // Phase 2: Select relevant skills for a query
  async selectSkills(
    query: string, 
    allMetadata: SkillMetadata[]
  ): Promise<string[]>; // Returns skill names
  
  // Phase 3: Load full skill content
  async loadSkill(name: string): Promise<Skill>;
  
  // Get tools from skill's scripts/
  async loadSkillTools(name: string): Promise<Tool[]>;
  
  // Internal
  private parseSkillFile(content: string): Skill;
  private parseFrontmatter(yaml: string): SkillFrontmatter;
}

// Types
interface SkillMetadata {
  name: string;
  description: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

interface Skill extends SkillMetadata {
  instructions: string;      // Markdown body
  scripts?: Script[];        // From scripts/
  references?: Reference[];  // From references/
}
```

**Implementation Notes:**
- Cache metadata in memory after first scan
- Watch filesystem for changes (optional)
- Validate skill names match directory names
- Parse YAML frontmatter with js-yaml

### 2. SkillsRegistry

**File:** `src/features/agent/skills/registry.ts`

Maintains runtime state of loaded skills.

**Interface:**
```typescript
class SkillsRegistry {
  constructor(loader: SkillsLoader);
  
  // Initialize - called at startup
  async initialize(): Promise<void>;
  
  // Get all skill metadata (lightweight)
  getAllMetadata(): SkillMetadata[];
  
  // Get currently active skills (full content)
  getActiveSkills(): Skill[];
  
  // Activate skills for current session
  async activateSkills(skillNames: string[]): Promise<void>;
  
  // Get all tools from active skills
  getSkillTools(): Tool[];
  
  // Build system prompt with active skills
  buildSkillsPrompt(): string;
}
```

### 3. Enhanced AgentEngine

**File:** `src/features/agent/engine.ts` (modified from Phase 1)

Integrates skills into agent processing.

**Enhanced Interface:**
```typescript
class AgentEngine {
  constructor(config: {
    adapter: OpenAICompatibleAdapter;
    repository: ChatRepository;
    skillsRegistry?: SkillsRegistry;  // NEW
  });

  async processMessage(input: MessageInput): Promise<AgentResponse> {
    // Phase 1: Check if skills should be activated
    const relevantSkills = await this.selectSkills(input.message);
    await this.skillsRegistry?.activateSkills(relevantSkills);
    
    // Phase 2: Build system prompt with skills
    const systemPrompt = this.buildSystemPrompt();
    
    // Phase 3: Process with skills-aware context
    // ... rest same as Phase 1
  }
  
  private async selectSkills(message: string): Promise<string[]> {
    // Use agent to select relevant skills from metadata
    const metadata = this.skillsRegistry!.getAllMetadata();
    
    // Quick selection without full agent loop
    const selectionPrompt = `
      Available skills:
      ${metadata.map(m => `- ${m.name}: ${m.description}`).join('\n')}
      
      User query: "${message}"
      
      Which skills are relevant? Return comma-separated names or "none".
    `;
    
    const result = await this.quickComplete(selectionPrompt);
    return result.split(',').map(s => s.trim()).filter(s => s !== 'none');
  }
  
  private buildSystemPrompt(): string {
    const basePrompt = `You are peterbot...`;
    const skillsPrompt = this.skillsRegistry?.buildSkillsPrompt() ?? '';
    
    return `${basePrompt}\n\n${skillsPrompt}`;
  }
}
```

## Message Flow with Skills

### New User Message

```
User: "scrape product prices from Amazon"
  │
  ▼
AgentEngine.processMessage()
  │
  ├── Step 1: Select Skills
  │   ├── Get all skill metadata (~10 skills × 100 tokens = 1000 tokens)
  │   ├── Ask LLM: "Which skills relevant?"
  │   └── Returns: ["web-scraping"]
  │
  ├── Step 2: Activate Skills
  │   ├── Load web-scraping/SKILL.md (~3000 tokens)
  │   ├── Load web-scraping/scripts/scraper.py
  │   └── Register tools from scripts
  │
  ├── Step 3: Build Context
  │   ├── Base system prompt
  │   ├── Skill instructions: "You have web-scraping skill..."
  │   └── Available tools: base tools + skill tools
  │
  ├── Step 4: Process with Agent
  │   └── Claude SDK with adapter → GLM-5/Kimi
  │
  └── Return response to user
```

## Tools from Skills

### Script Discovery

Skills can provide tools via `scripts/` folder:

```python
# skills/web-scraping/scripts/render_page.py
"""
Render a JavaScript page and return HTML.

Usage: python render_page.py <url>
"""
import sys
from playwright.sync_api import sync_playwright

def render_page(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(url)
        html = page.content()
        browser.close()
        return html

if __name__ == "__main__":
    url = sys.argv[1]
    print(render_page(url))
```

### Tool Registration

```typescript
// Loader discovers scripts and creates tools
async loadSkillTools(skillName: string): Promise<Tool[]> {
  const skillDir = path.join(this.skillsDir, skillName);
  const scriptsDir = path.join(skillDir, 'scripts');
  
  const scripts = await fs.readdir(scriptsDir);
  
  return scripts.map(script => ({
    name: `${skillName}_${path.basename(script, '.py')}`,
    description: this.extractDescription(script),
    inputSchema: { /* JSON schema from docstring */ },
    execute: async (input) => {
      return execFile('python3', [path.join(scriptsDir, script), ...input]);
    },
  }));
}
```

## Skills Prompt Injection

When skills are active, they become part of the system prompt:

```
You are peterbot, a helpful AI assistant.

## Active Skills

You have access to the following specialized skills. Use them when appropriate:

### web-scraping
Extract data from websites using Python requests, BeautifulSoup, and Playwright. 
Use when user wants to scrape data, extract information from web pages, or crawl websites.

Key capabilities:
- Static HTML scraping with requests + BeautifulSoup
- JavaScript-rendered pages with Playwright
- Automatic rate limiting and retry logic
- Output to CSV, JSON, or Markdown

Available tools:
- web-scraping_render_page: Render JavaScript page to HTML
- web-scraping_extract_links: Extract all links from a page

Follow these instructions:
1. Analyze the target website structure
2. Determine if content is static or JavaScript-rendered
3. Choose appropriate approach
4. Extract data and save to desired format
5. Handle edge cases (rate limits, CAPTCHAs)

Edge cases:
- Rate limiting: Add delays between requests
- CAPTCHAs: Ask user for help

## General Tools

You also have access to:
- run_code: Execute Python code
- execute_integration_action: Use connected apps
```

## Configuration

### Environment Variables

```bash
# Phase 1 + Phase 2
AGENT_MODEL=glm-5
ZAI_API_KEY=...
USE_AGENT_ENGINE=true

# Phase 2 additions
SKILLS_DIR=./skills              # Path to skills folder
SKILLS_AUTO_SELECT=true          # Auto-detect relevant skills
SKILLS_MAX_ACTIVE=3              # Max skills active at once
```

### Skills Directory Location

Default: `./skills` relative to project root

Structure:
```
peterbot/
├── src/
├── skills/              # Skills directory
│   ├── web-scraping/
│   ├── data-analysis/
│   └── ...
└── ...
```

## User Commands

### List Skills

```
User: /skills
Bot: Available skills:
     • web-scraping - Extract data from websites
     • data-analysis - Analyze and visualize data
     • telegram-bot - Build Telegram bots
     
     Use /skill <name> to activate a specific skill.
```

### Activate Skill

```
User: /skill web-scraping
Bot: Activated web-scraping skill. I can now help you scrape websites.
```

### Auto-Detection

```
User: scrape product prices from Amazon
Bot: [Automatically activates web-scraping skill]
      I'll help you scrape those prices. Let me start by analyzing the page structure...
```

## Data Model Additions

### Skills Tracking

```typescript
// Track which skills are active per session
interface SessionSkills {
  sessionId: string;
  activeSkills: string[];
  activatedAt: Date;
}
```

## Testing Strategy

### Skill Loading Tests
- Parse valid SKILL.md files
- Handle missing frontmatter
- Validate skill names
- Test progressive disclosure

### Skill Selection Tests
- Mock LLM selection responses
- Test relevance scoring
- Verify max skills limit

### Integration Tests
- Full flow: query → skill selection → activation → response
- Tool execution from skills
- Multiple skills active

## Migration from Phase 1

1. **Phase 1 is running** - Chat foundation stable
2. **Create skills/ folder** - Add initial skills
3. **Deploy Phase 2** - Skills loader + registry
4. **Feature flag** - `SKILLS_AUTO_SELECT=true`
5. **Test and iterate** - Add more skills as needed

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Skill selection is slow | Medium | Medium | Cache metadata; parallelize loading |
| Token budget exceeded | Medium | High | Limit max active skills; trim instructions |
| Bad skill affects agent | Medium | Medium | Skill isolation; allow disabling |
| Skill scripts are unsafe | Low | High | Sandboxed execution; allowed-tools whitelist |
| Too many skills | Low | Low | Lazy loading; pagination in UI |

## Future Enhancements (Beyond Phase 2)

- **Skill dependencies** - Skills can depend on other skills
- **Skill parameters** - User-configurable skill settings
- **Skill versioning** - Multiple versions of same skill
- **Remote skills** - Load skills from GitHub URLs
- **Skill testing** - Built-in test cases for skills

## Success Criteria

- [ ] Skills load from file system
- [ ] Progressive disclosure works (metadata vs full content)
- [ ] Skills automatically selected based on query
- [ ] Skill tools execute correctly
- [ ] Multiple skills can be active
- [ ] User can list and manually activate skills
- [ ] Skills follow agentskills.io spec
- [ ] Skills are hot-reloadable (optional)
