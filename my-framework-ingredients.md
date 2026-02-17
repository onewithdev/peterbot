# My Custom AI Framework - Ingredient List

> **Purpose**: This document defines the selected features, skills, and architectural patterns
> for building a custom AI agent framework. Each item includes a description of what it does,
> which reference frameworks implement it, and enough context for Claude Code to understand
> the implementation requirements.
>
> **Reference repos**: Located at `/Users/marwankashef/Desktop/YouTube/OpenClaw Antidote/`
> **Full analysis**: See `FRAMEWORK-DEEP-DIVE.md` in the same directory.

---

**Total selected items: 32**

## Identity & Personality

### 1. Soul.md Personality File

**What it does**: Define your AI's personality, values, and communication style in a simple text file. Like writing a character sheet.

**Reference implementations**: OpenClaw, NanoBot, ZeroClaw, PicoClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`

---

## Security & Safety

### 1. Command Blocklist

**What it does**: Automatically blocks commands that could damage your system (delete everything, format disks, reboot, etc.)

**Reference implementations**: PicoClaw, NanoBot, ZeroClaw

**Where to find reference code**:
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`

---

## Communication Channels

### 1. Telegram Bot

**What it does**: Easiest setup - just one token. Rich media support, inline buttons, file sharing. Great for teams.

**Reference implementations**: OpenClaw, NanoBot, PicoClaw, ZeroClaw, IronClaw, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory

---

### 2. Email Integration

**What it does**: AI reads your email and can reply. Filters spam, summarizes newsletters, drafts responses.

**Reference implementations**: NanoBot, ZeroClaw

**Where to find reference code**:
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`

---

### 3. Web Dashboard

**What it does**: Chat with your AI through a web browser. See real-time status, memory, job progress. No app install needed.

**Reference implementations**: OpenClaw, IronClaw, Agent Zero

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 4. WhatsApp Integration

**What it does**: Talk to your AI through WhatsApp. Send messages, images, voice notes. Most natural for daily business use.

**Reference implementations**: OpenClaw, NanoClaw, NanoBot, PicoClaw, ZeroClaw, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory

---

## Memory & Knowledge

### 1. Two-Layer Memory

**What it does**: Layer 1: Quick facts (MEMORY.md). Layer 2: Searchable history log. Simple but effective.

**Reference implementations**: NanoBot, PicoClaw

**Where to find reference code**:
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`

---

### 2. Document Knowledge Base

**What it does**: Upload PDFs, spreadsheets, documents. AI can search and analyze them. Your company's knowledge at its fingertips.

**Reference implementations**: Agent Zero, OpenClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 3. Session Auto-Compaction

**What it does**: When conversations get too long, automatically summarizes old parts to keep the AI fast while preserving key info.

**Reference implementations**: NanoClaw, IronClaw

**Where to find reference code**:
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 4. Solution Memory

**What it does**: AI automatically saves successful solutions. Next time it faces a similar problem, it recalls what worked before.

**Reference implementations**: Agent Zero

**Where to find reference code**:
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

## Automation & Scheduling

### 1. Cron Scheduling

**What it does**: Run tasks on a schedule: "every Monday 9am, send me a briefing." Works like a reliable alarm clock for your AI.

**Reference implementations**: OpenClaw, NanoClaw, NanoBot, PicoClaw, ZeroClaw, TinyClaw, IronClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory

---

### 2. Heartbeat System

**What it does**: AI wakes up every 30 minutes to check if anything needs attention. Proactive, not just reactive.

**Reference implementations**: OpenClaw, PicoClaw, NanoBot, IronClaw, ZeroClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 3. Browser Automation

**What it does**: AI controls a web browser: fills forms, clicks buttons, scrapes data, takes screenshots. Automates web-based work.

**Reference implementations**: OpenClaw, NanoClaw, Agent Zero, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 4. Background Sub-Agents

**What it does**: Spawn helper AI workers for long tasks. Main agent stays responsive while workers handle heavy lifting in background.

**Reference implementations**: PicoClaw, NanoBot, Agent Zero, TinyClaw

**Where to find reference code**:
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 5. Agent Team Collaboration

**What it does**: Multiple specialized agents (@coder, @reviewer, @writer) pass work to each other automatically. Like a small AI company.

**Reference implementations**: TinyClaw, NanoClaw, Agent Zero

**Where to find reference code**:
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

## Integrations & Protocols

### 1. MCP Protocol

**What it does**: Universal standard for connecting AI to external tools. One protocol, thousands of integrations. The "USB" of AI tools.

**Reference implementations**: OpenClaw, NanoBot, IronClaw, Agent Zero

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 2. Skills System

**What it does**: Install new capabilities like apps on a phone. "Install weather skill" or "install GitHub skill." No coding needed.

**Reference implementations**: OpenClaw, PicoClaw, NanoClaw, Agent Zero, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 3. Plugin SDK

**What it does**: A developer kit for building new channels, tools, and memory backends. Create custom integrations for your specific business.

**Reference implementations**: OpenClaw, IronClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

## Built-in Skills & Ready-Made Tools

### 1. Google Workspace Suite

**What it does**: Full Google Workspace integration: send emails, manage calendar, read/write docs, create spreadsheets, build presentations.

**Reference implementations**: OpenClaw, IronClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 2. GitHub Integration Skill

**What it does**: Full GitHub workflow: manage issues, review pull requests, trigger CI runs, query the API. Code management from chat.

**Reference implementations**: OpenClaw, NanoBot, PicoClaw, IronClaw, ZeroClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 3. Gmail Skill

**What it does**: Read, send, and manage Gmail. Works as a tool (on-demand) or as a channel (email triggers the AI).

**Reference implementations**: NanoClaw, IronClaw

**Where to find reference code**:
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 4. Proactive User Messaging

**What it does**: AI sends messages to you without waiting for your prompt. Alerts, reminders, status updates pushed to your chat.

**Reference implementations**: TinyClaw, Agent Zero

**Where to find reference code**:
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 5. Image Generation

**What it does**: Generate images via OpenAI API or Google Gemini. Supports inpainting, masking, and batch generation.

**Reference implementations**: OpenClaw, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory

---

### 6. Coding Agent Orchestration

**What it does**: Run Codex CLI, Claude Code, or other coding agents programmatically. AI manages AI coders.

**Reference implementations**: OpenClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories

---

### 7. Composio 1000+ App Integration

**What it does**: One-click OAuth access to 1000+ apps: Gmail, Notion, GitHub, Slack, and more via Composio.

**Reference implementations**: ZeroClaw

**Where to find reference code**:
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory

---

### 8. Pre-built Agent Profiles

**What it does**: Switch your AI's persona instantly. Developer mode for coding, Researcher mode for analysis, and more.

**Reference implementations**: Agent Zero

**Where to find reference code**:
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 9. 1Password Integration

**What it does**: Securely retrieve credentials and secrets from your 1Password vault via CLI.

**Reference implementations**: OpenClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories

---

### 10. Skill Creator Tool

**What it does**: Framework for building and packaging new skills with scripts, references, and assets. Extend your AI's abilities.

**Reference implementations**: OpenClaw, NanoBot, PicoClaw, TinyClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- NanoBot (`./nanobot/`): Python, check `nanobot/skills/` and `nanobot/agent/tools/`
- PicoClaw (`./picoclaw/`): Go, check `workspace/skills/` and `pkg/tools/`
- TinyClaw (`./tinyclaw/`): TS/Bash, check `.agents/skills/` directory

---

## Architecture Patterns

### 1. Trait-Based Modularity

**What it does**: Every component is defined by a contract. Swap implementations without touching other code. The cleanest extensibility pattern.

**Reference implementations**: ZeroClaw, IronClaw

**Where to find reference code**:
- ZeroClaw (`./zeroclaw/`): Rust trait-based, check `src/tools/` directory
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 2. Computer as Tool

**What it does**: Instead of pre-built integrations, AI writes code on-the-fly to accomplish tasks. Infinitely flexible, no maintenance needed.

**Reference implementations**: Agent Zero

**Where to find reference code**:
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

### 3. Gateway WebSocket Hub

**What it does**: Central server that all channels connect to via real-time WebSockets. The "control tower" pattern.

**Reference implementations**: OpenClaw, IronClaw

**Where to find reference code**:
- OpenClaw (`./openclaw/`): TypeScript, check `skills/` and `extensions/` directories
- IronClaw (`./ironclaw/`): Rust + WASM, check `src/tools/builtin/` and `tools-src/`

---

### 4. Project Workspace Isolation

**What it does**: Separate workspaces per client/project. Each has its own memory, secrets, and instructions. No data mixing.

**Reference implementations**: Agent Zero, NanoClaw

**Where to find reference code**:
- NanoClaw (`./nanoclaw/`): TypeScript 5.2K lines, check `.claude/skills/` and `container/skills/`
- Agent Zero (`./agent-zero/`): Python, check `python/tools/` and `python/extensions/`

---

## Implementation Notes for Claude Code

When building this framework, follow these principles:

1. **Start with the reference code** - Each item above lists which repos implement it. Read those implementations first.
2. **Prefer simplicity** - If NanoClaw (5.2K lines) and OpenClaw (large) both implement a feature, start with NanoClaw's approach.
3. **Keep it modular** - Use ZeroClaw/IronClaw's trait-based pattern so components can be swapped later.
4. **Security by default** - Apply sandboxing, command blocklists, and pairing codes from the start.
5. **Full deep-dive reference** - See `FRAMEWORK-DEEP-DIVE.md` for complete architectural analysis of all 9 repos.

---

*Generated from the AI Agent Framework Grocery Store comparison tool.*
