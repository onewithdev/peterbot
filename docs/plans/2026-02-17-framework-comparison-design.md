# Framework Comparison & Visual Guide — Design Document

**Date:** 2026-02-17
**Status:** Approved

---

## Goal

A single, self-contained HTML file that helps non-technical users understand and choose between 8 AI assistant frameworks (plus one resource list). No server, no build step, works offline.

---

## Frameworks Covered

| ID | Name | Language | RAM | Core Philosophy |
|----|------|----------|-----|-----------------|
| 1 | OpenClaw | TypeScript | >1GB | Everything integrated — feature powerhouse |
| 2 | ZeroClaw | Rust | <5MB | Zero overhead — runs on $10 hardware |
| 3 | NanoClaw | TypeScript | ~50MB | Code you can own — 1–2K lines |
| 4 | NanoBot | Python | ~100MB | Minimal, readable — research-friendly |
| 5 | PicoClaw | Go | <10MB | AI-bootstrapped simplicity for edge/IoT |
| 6 | IronClaw | Rust | ~100MB | Defense in depth — WASM sandbox, secrets |
| 7 | TinyClaw | TypeScript | ~80MB | Multi-agent teams without message queues |
| 8 | Agent Zero | Python | ~200MB | Computer as a tool — open-ended automation |
| 9 | Awesome-OpenClaw | — | — | Community resource index |

---

## Color Identity (per framework)

- **OpenClaw** — deep electric blue `#2563EB`
- **ZeroClaw** — steel silver/cyan `#0EA5E9`
- **NanoClaw** — warm amber `#F59E0B`
- **NanoBot** — Python yellow `#EAB308`
- **PicoClaw** — Go teal `#14B8A6`
- **IronClaw** — rust orange `#EA580C`
- **TinyClaw** — vivid purple `#9333EA`
- **Agent Zero** — deep green `#16A34A`

---

## Page Structure

```
[Sticky Nav] → Hero | Gallery | Compare | Builder
```

### 1. Hero Section
- Full-width header with animated SVG network/particle effect (pure CSS + JS)
- Title: "The Claw Family"
- Subtitle: non-technical one-liner explaining this is a shopping guide
- 8 colored badge chips for quick-jump to each framework

### 2. Framework Gallery
8 cards in a responsive CSS grid (2-col desktop, 1-col mobile). Each card:
- Bold color header bar with framework name + language badge
- **Inline SVG architecture diagram**: channels → agent core → memory/tools → output
  - Each layer drawn as labeled boxes with arrows
  - Color-coded to the framework's identity color
- **Ability pills**: 3–5 tags like `WASM Sandbox`, `Multi-Agent`, `Edge Hardware`, `MCP`, `Voice`, etc.
- **Stats bar**: RAM and startup time as mini progress meters (visual, not just text)
- **"What makes it special"** callout: 1–2 sentence unique value proposition
- **"How to connect"** snippet: shows example config key or setup command

### 3. Compare Table
- Full-width table, rows = frameworks, columns = features
- Feature columns: Language | RAM | Channels | Multi-Agent | Memory | Security | MCP | Hardware | Container
- Cells: colored icon (✓ full / ~ partial / — none)
- Filter bar above table: click a feature pill to filter rows to only frameworks that have it
- Highlight row on hover

### 4. Blueprint Builder
Step-by-step wizard (3 steps):

**Step 1 — Must-Have Features**
Checkbox grid: Voice, Multi-Agent Teams, Container Isolation, Edge/IoT Hardware, Security Sandbox, MCP Support, Web UI, Scheduled Tasks, Multiple Chat Platforms, Open Source, Low RAM, Fast Boot

**Step 2 — Constraints**
Radio options per constraint:
- Preferred language: TypeScript / Python / Rust / Go / Any
- Hardware: Normal laptop/server / Edge (Raspberry Pi) / Extreme edge ($10 board)
- Security needs: Personal use / Production / Enterprise

**Step 3 — Results**
- **Closest match card**: ranked list of frameworks by match score, with gap analysis (what you asked for vs. what it provides)
- **Sample config snippet**: code block with example config.toml or config.json for the top match
- **Download PRD button**: generates and downloads a Markdown file containing:
  - Your selected requirements as a structured spec
  - Architecture recommendations (which components to borrow from which frameworks)
  - Feature inventory table
  - Setup/integration guidance

---

## Technical Approach

- **Pure vanilla HTML + CSS + JS** — zero dependencies, zero npm, zero build step
- **Inline SVG** for all architecture diagrams (no external images)
- **CSS custom properties** for theming per framework
- **Client-side JS** for:
  - Tab/section navigation
  - Compare table filtering
  - Builder wizard state
  - PRD Markdown generation + `Blob` download
- **No API calls** — fully offline-capable
- File size target: under 200KB

---

## PRD Generator Output Format

When the user clicks "Download My Blueprint", a `.md` file is created client-side:

```markdown
# My Custom AI Assistant Blueprint

## Requirements
- [x] Multi-Agent Teams
- [x] Container Isolation
- ...

## Closest Framework Match
**TinyClaw** (82% match) — gaps: no WASM sandbox, no voice

## Recommended Architecture
Borrow from:
- TinyClaw: multi-agent queue system
- IronClaw: WASM sandbox layer
- NanoBot: MCP integration pattern

## Sample Config
\`\`\`json
{ "provider": "anthropic", "agents": [...] }
\`\`\`

## Next Steps
1. Clone TinyClaw as your base
2. Add IronClaw's sandbox module
3. ...
```

---

## Success Criteria

- Non-technical user can open the file in a browser and immediately understand what each framework does
- Comparison table answers "which frameworks support X" in one click
- Blueprint builder produces a meaningful, downloadable PRD in under 60 seconds of interaction
- Page is visually distinctive — bold colors, clear diagrams, not generic

---

## Out of Scope

- No actual framework installation or CLI integration
- No live AI generation (no API calls)
- No backend or server component
- Awesome-OpenClaw treated as a resource card, not a framework in the builder
