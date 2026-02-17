# Framework Comparison Visual Guide — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a single self-contained `index.html` file that lets non-technical users visually compare 8 AI assistant frameworks, filter by features, and generate a downloadable custom framework PRD.

**Architecture:** Pure vanilla HTML/CSS/JS in one file. Framework data lives in a JS object. All sections (Hero, Gallery, Compare, Builder) are rendered from that data. No dependencies, no build step, no API calls.

**Tech Stack:** HTML5, CSS custom properties, vanilla ES6 JS, inline SVG, Blob API for file download.

---

## Reference

Design doc: `docs/plans/2026-02-17-framework-comparison-design.md`

Output file: `index.html` at repo root (`/home/mors/projects/antidote/index.html`)

Browser test command: `open /home/mors/projects/antidote/index.html` (macOS) or `xdg-open /home/mors/projects/antidote/index.html` (Linux)

---

### Task 1: HTML skeleton + CSS foundation

**Files:**
- Create: `index.html`

**Step 1: Create the file with base structure**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Claw Family — AI Framework Guide</title>
  <style>
    :root {
      --oc: #2563EB;   /* OpenClaw blue */
      --zc: #0EA5E9;   /* ZeroClaw cyan */
      --nc: #F59E0B;   /* NanoClaw amber */
      --nb: #EAB308;   /* NanoBot yellow */
      --pc: #14B8A6;   /* PicoClaw teal */
      --ic: #EA580C;   /* IronClaw rust */
      --tc: #9333EA;   /* TinyClaw purple */
      --az: #16A34A;   /* AgentZero green */
      --bg: #0F0F13;
      --surface: #1A1A24;
      --border: #2A2A3A;
      --text: #E8E8F0;
      --muted: #888899;
      --radius: 12px;
      --gap: 24px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
    }
    /* Sticky nav */
    nav {
      position: sticky; top: 0; z-index: 100;
      background: rgba(15,15,19,0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      display: flex; align-items: center; gap: 32px;
      padding: 0 32px; height: 56px;
    }
    nav .logo { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.5px; }
    nav a {
      color: var(--muted); text-decoration: none;
      font-size: 0.9rem; transition: color 0.2s;
    }
    nav a:hover { color: var(--text); }
    section { padding: 80px 32px; max-width: 1280px; margin: 0 auto; }
    h2 { font-size: 2rem; font-weight: 800; margin-bottom: 8px; }
    .section-sub { color: var(--muted); margin-bottom: 48px; }
  </style>
</head>
<body>
  <nav>
    <span class="logo">🦀 The Claw Family</span>
    <a href="#gallery">Frameworks</a>
    <a href="#compare">Compare</a>
    <a href="#builder">Builder</a>
  </nav>
  <div id="hero"></div>
  <section id="gallery">
    <h2>Frameworks</h2>
    <p class="section-sub">Click any card to expand details.</p>
    <div id="gallery-grid"></div>
  </section>
  <section id="compare">
    <h2>Side-by-Side Comparison</h2>
    <p class="section-sub">Filter by feature to find your match.</p>
    <div id="compare-filters"></div>
    <div id="compare-table"></div>
  </section>
  <section id="builder">
    <h2>Blueprint Builder</h2>
    <p class="section-sub">Pick your requirements. Get a custom framework recommendation + downloadable PRD.</p>
    <div id="builder-wizard"></div>
  </section>
  <script>
    // Data + logic injected in later tasks
  </script>
</body>
</html>
```

**Step 2: Open in browser and verify**

```bash
xdg-open /home/mors/projects/antidote/index.html
```

Expected: Dark page loads, sticky nav shows, three empty sections visible.

**Step 3: Commit**

```bash
cd /home/mors/projects/antidote
git init
git add index.html
git commit -m "feat: html skeleton with nav and css foundation"
```

---

### Task 2: Framework data layer

**Files:**
- Modify: `index.html` — replace `// Data + logic injected in later tasks` with the data object

**Step 1: Add the FRAMEWORKS data object inside the `<script>` tag**

```js
const FRAMEWORKS = [
  {
    id: 'openclaw',
    name: 'OpenClaw',
    lang: 'TypeScript',
    color: '#2563EB',
    ram: '>1GB',
    ramScore: 10,        // 1-10 where 10=most RAM
    startup: '>500ms',
    startupScore: 10,    // 1-10 where 10=slowest
    tagline: 'The feature powerhouse. Every channel, every bell, every whistle.',
    special: 'Live Canvas A2UI — agents render real-time visual UIs directly in chat. Voice I/O via ElevenLabs. Companion macOS/iOS apps.',
    connect: 'CLI wizard → ~/.openclaw/settings · WebSocket gateway ws://127.0.0.1:18789',
    channels: ['WhatsApp','Telegram','Slack','Discord','Signal','iMessage','Teams','Matrix','Google Chat','QQ','DingTalk','LINE'],
    features: {
      multiAgent: true,
      container: false,
      wasmSandbox: false,
      mcp: false,
      voice: true,
      webUI: true,
      scheduledTasks: true,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: false,
      openSource: true,
      multiPlatform: true,
    },
    abilities: ['Live Canvas UI','Voice I/O','12+ Channels','Skills Platform','Session Routing'],
    configExample: `# ~/.openclaw/settings\ngateway_port: 18789\nagent_runtime: pi\nchannels: [whatsapp, telegram, slack]`,
    repoUrl: 'https://github.com/openclaw/openclaw',
  },
  {
    id: 'zeroclaw',
    name: 'ZeroClaw',
    lang: 'Rust',
    color: '#0EA5E9',
    ram: '<5MB',
    ramScore: 1,
    startup: '<10ms',
    startupScore: 1,
    tagline: 'Runs on a $10 board. <5MB RAM. 22+ LLM providers.',
    special: 'Full-stack search engine built-in (SQLite FTS5 + vector). Trait-based pluggability — swap every component. Gateway pairing + allowlists.',
    connect: 'zeroclaw onboard → ~/.zeroclaw/config.toml',
    channels: ['Telegram','Discord','Slack','iMessage','Matrix','WhatsApp','Webhook','CLI'],
    features: {
      multiAgent: false,
      container: false,
      wasmSandbox: false,
      mcp: false,
      voice: false,
      webUI: false,
      scheduledTasks: true,
      edgeHardware: true,
      lowRAM: true,
      fastBoot: true,
      openSource: true,
      multiPlatform: true,
    },
    abilities: ['<5MB RAM','22+ LLM Providers','Built-in Vector Search','Edge Hardware','Heartbeat Tasks'],
    configExample: `# ~/.zeroclaw/config.toml\n[provider]\nname = "anthropic"\nmodel = "claude-opus-4-6"\n\n[channels]\ntelegram = { token = "..." }`,
    repoUrl: 'https://github.com/openagen/zeroclaw',
  },
  {
    id: 'nanoclaw',
    name: 'NanoClaw',
    lang: 'TypeScript',
    color: '#F59E0B',
    ram: '~50MB',
    ramScore: 4,
    startup: '~1s',
    startupScore: 3,
    tagline: 'The codebase you can actually read in 8 minutes.',
    special: 'Per-group container isolation — each WhatsApp group runs its own Linux container with its own CLAUDE.md. First personal assistant with Agent Swarms via Claude Agent SDK.',
    connect: 'No config files. Tell Claude Code what you want → it edits the code.',
    channels: ['WhatsApp'],
    features: {
      multiAgent: true,
      container: true,
      wasmSandbox: false,
      mcp: false,
      voice: false,
      webUI: false,
      scheduledTasks: true,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: true,
      openSource: true,
      multiPlatform: false,
    },
    abilities: ['Container Isolation','Agent Swarms','~1-2K Lines','Per-Group Memory','Skill-Based Extensibility'],
    configExample: `# No config file — configuration IS the code.\n# Tell Claude Code:\n"Change the trigger word to @Bob"\n"Add a /weather command"`,
    repoUrl: 'https://github.com/gavrielc/nanoclaw',
  },
  {
    id: 'nanobot',
    name: 'NanoBot',
    lang: 'Python',
    color: '#EAB308',
    ram: '~100MB',
    ramScore: 5,
    startup: '~5s',
    startupScore: 5,
    tagline: '99% smaller than OpenClaw. 9 chat platforms. MCP built-in.',
    special: 'Provider Registry pattern — add any LLM in 2 steps. LiteLLM integration for 100+ providers. MCP stdio + HTTP for external tool servers.',
    connect: 'nanobot setup → ~/.nanobot/config.json',
    channels: ['Telegram','Discord','WhatsApp','Feishu','Mochat','DingTalk','Slack','Email','QQ'],
    features: {
      multiAgent: false,
      container: false,
      wasmSandbox: false,
      mcp: true,
      voice: false,
      webUI: false,
      scheduledTasks: true,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: false,
      openSource: true,
      multiPlatform: true,
    },
    abilities: ['9 Chat Platforms','MCP Integration','100+ LLM Providers','Cron Scheduling','Docker-First'],
    configExample: `# ~/.nanobot/config.json\n{\n  "provider": "anthropic",\n  "model": "claude-opus-4-6",\n  "channels": { "telegram": { "token": "..." } },\n  "mcp": { "servers": [...] }\n}`,
    repoUrl: 'https://github.com/HKUDS/nanobot',
  },
  {
    id: 'picoclaw',
    name: 'PicoClaw',
    lang: 'Go',
    color: '#14B8A6',
    ram: '<10MB',
    ramScore: 2,
    startup: '<1s',
    startupScore: 2,
    tagline: 'Go binary. Boots in 1s on a $10 RISC-V board.',
    special: 'AI-bootstrapped: 95% agent-generated code. Targets LicheeRV-Nano ($9.99), NanoKVM ($30), MaixCAM ($50). Single self-contained binary for ARM/x86/RISC-V.',
    connect: 'picoclaw setup → ~/.picoclaw/config.json (same format as NanoBot)',
    channels: ['Telegram','Discord','QQ','DingTalk','LINE'],
    features: {
      multiAgent: false,
      container: false,
      wasmSandbox: false,
      mcp: false,
      voice: false,
      webUI: false,
      scheduledTasks: true,
      edgeHardware: true,
      lowRAM: true,
      fastBoot: true,
      openSource: true,
      multiPlatform: false,
    },
    abilities: ['<10MB RAM','RISC-V Support','Single Binary','AI-Generated Code','1s Boot'],
    configExample: `# ~/.picoclaw/config.json\n{\n  "provider": "anthropic",\n  "model": "claude-opus-4-6",\n  "channels": { "telegram": { "token": "..." } }\n}`,
    repoUrl: 'https://github.com/sipeed/picoclaw',
  },
  {
    id: 'ironclaw',
    name: 'IronClaw',
    lang: 'Rust',
    color: '#EA580C',
    ram: '~100MB',
    ramScore: 5,
    startup: '<1s',
    startupScore: 2,
    tagline: 'Security-first. WASM sandbox. Secrets never leave the host.',
    special: 'WASM tools with capability-based permissions and leak detection. Credential injection at host boundary — no secrets in containers. Prompt injection detection + policy engine.',
    connect: 'ironclaw onboard → ~/.ironclaw/settings.toml · NEAR AI OAuth',
    channels: ['Telegram','Discord','Slack','Webhook'],
    features: {
      multiAgent: false,
      container: true,
      wasmSandbox: true,
      mcp: true,
      voice: false,
      webUI: true,
      scheduledTasks: true,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: true,
      openSource: true,
      multiPlatform: false,
    },
    abilities: ['WASM Sandbox','Credential Injection','Prompt Injection Defense','PostgreSQL','Dynamic Tool Building'],
    configExample: `# ~/.ironclaw/settings.toml\n[security]\nprompt_injection = "strict"\ncredential_scope = "host_only"\n\n[database]\ntype = "postgres"\nurl = "postgres://..."`,
    repoUrl: 'https://github.com/nearai/ironclaw',
  },
  {
    id: 'tinyclaw',
    name: 'TinyClaw',
    lang: 'TypeScript',
    color: '#9333EA',
    ram: '~80MB',
    ramScore: 4,
    startup: '<1s',
    startupScore: 2,
    tagline: 'Multi-agent teams. No message queues. File-based IPC.',
    special: 'Run a coder + writer + researcher agent simultaneously. Live TUI dashboard shows chain execution in real-time. File-based atomic queue routing — no Kafka/RabbitMQ needed.',
    connect: 'tinyclaw start → .tinyclaw/settings.json · per-agent workspace dirs',
    channels: ['Discord','WhatsApp','Telegram'],
    features: {
      multiAgent: true,
      container: false,
      wasmSandbox: false,
      mcp: false,
      voice: false,
      webUI: false,
      scheduledTasks: false,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: true,
      openSource: true,
      multiPlatform: false,
    },
    abilities: ['Multi-Agent Teams','Live TUI Dashboard','File-Based IPC','Sender Pairing','Team Chain Execution'],
    configExample: `# .tinyclaw/settings.json\n{\n  "agents": [\n    { "name": "coder", "trigger": "@coder" },\n    { "name": "writer", "trigger": "@writer" }\n  ]\n}`,
    repoUrl: 'https://github.com/jlia0/tinyclaw',
  },
  {
    id: 'agentzero',
    name: 'Agent Zero',
    lang: 'Python',
    color: '#16A34A',
    ram: '~200MB',
    ramScore: 7,
    startup: '~2s',
    startupScore: 4,
    tagline: 'The computer is the tool. No pre-programmed tasks.',
    special: 'Agent uses shell + browser + code execution to accomplish ANY goal. Multi-agent hierarchy — delegates to subordinates. SOUL.md + IDENTITY.md define personality. Fully customizable via markdown prompts.',
    connect: 'python agent.py → Web UI at http://localhost:5000',
    channels: ['CLI','Web UI','Webhook'],
    features: {
      multiAgent: true,
      container: true,
      wasmSandbox: false,
      mcp: true,
      voice: false,
      webUI: true,
      scheduledTasks: true,
      edgeHardware: false,
      lowRAM: false,
      fastBoot: false,
      openSource: true,
      multiPlatform: false,
    },
    abilities: ['Computer as Tool','Multi-Agent Hierarchy','SOUL.md Personality','MCP Server+Client','Git-Based Projects'],
    configExample: `# SOUL.md — defines agent personality\nYou are a helpful assistant...\n\n# IDENTITY.md — sets agent identity\nYour name is Zero...`,
    repoUrl: 'https://github.com/agent0ai/agent-zero',
  },
];

const FEATURES = [
  { key: 'multiAgent',      label: 'Multi-Agent',       icon: '🤝' },
  { key: 'container',       label: 'Container Isolation',icon: '📦' },
  { key: 'wasmSandbox',     label: 'WASM Sandbox',       icon: '🔒' },
  { key: 'mcp',             label: 'MCP Support',        icon: '🔌' },
  { key: 'voice',           label: 'Voice I/O',          icon: '🎙️' },
  { key: 'webUI',           label: 'Web UI',             icon: '🌐' },
  { key: 'scheduledTasks',  label: 'Scheduled Tasks',    icon: '⏰' },
  { key: 'edgeHardware',    label: 'Edge Hardware',      icon: '🔧' },
  { key: 'lowRAM',          label: 'Low RAM (<10MB)',     icon: '💾' },
  { key: 'fastBoot',        label: 'Fast Boot (<1s)',     icon: '⚡' },
  { key: 'openSource',      label: 'Open Source',        icon: '🔓' },
  { key: 'multiPlatform',   label: 'Multi-Platform',     icon: '📱' },
];
```

**Step 2: Verify data loads without errors**

Open browser console (F12) after refreshing `index.html`. Run:
```js
console.log(FRAMEWORKS.length) // expect: 8
console.log(FRAMEWORKS.map(f => f.name))
```
Expected: 8 framework names printed.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add framework data layer with feature matrix"
```

---

### Task 3: Hero section

**Files:**
- Modify: `index.html` — add hero CSS to `<style>`, add hero JS to render `#hero`

**Step 1: Add hero CSS**

Add inside `<style>`:
```css
#hero {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  text-align: center;
  position: relative; overflow: hidden;
  padding: 80px 32px;
}
#hero-canvas {
  position: absolute; inset: 0;
  opacity: 0.4; pointer-events: none;
}
.hero-title {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 900;
  letter-spacing: -2px;
  background: linear-gradient(135deg, #fff 0%, #aaa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  position: relative; z-index: 1;
}
.hero-sub {
  color: var(--muted); font-size: 1.2rem;
  max-width: 560px; margin: 16px auto 48px;
  position: relative; z-index: 1;
}
.hero-badges {
  display: flex; flex-wrap: wrap; gap: 12px;
  justify-content: center;
  position: relative; z-index: 1;
}
.hero-badge {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 9999px;
  font-size: 0.85rem; font-weight: 700;
  text-decoration: none; color: #fff;
  transition: transform 0.2s, opacity 0.2s;
  border: 2px solid transparent;
}
.hero-badge:hover { transform: translateY(-2px); opacity: 0.9; }
```

**Step 2: Add hero render function in `<script>` after the data**

```js
function renderHero() {
  const el = document.getElementById('hero');
  // Animated canvas background
  const canvas = document.createElement('canvas');
  canvas.id = 'hero-canvas';
  el.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const resize = () => { canvas.width = el.offsetWidth; canvas.height = el.offsetHeight; };
  resize();
  window.addEventListener('resize', resize);

  const dots = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    color: FRAMEWORKS[Math.floor(Math.random() * FRAMEWORKS.length)].color,
  }));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
      if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.fill();
    });
    // Draw lines between nearby dots
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.strokeStyle = dots[i].color + Math.floor((1 - dist/120) * 40).toString(16).padStart(2,'0');
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  animate();

  // Hero text
  const content = document.createElement('div');
  content.innerHTML = `
    <h1 class="hero-title">The Claw Family</h1>
    <p class="hero-sub">A non-technical guide to choosing, comparing, and combining AI assistant frameworks. Eight projects. One page.</p>
    <div class="hero-badges">
      ${FRAMEWORKS.map(f => `<a class="hero-badge" href="#${f.id}" style="background:${f.color}22;border-color:${f.color}44;color:${f.color}">${f.name}</a>`).join('')}
    </div>
  `;
  el.appendChild(content);
}
renderHero();
```

**Step 3: Verify in browser**

Refresh `index.html`. Expected:
- Animated colored dots with connecting lines fill the background
- Title "The Claw Family" visible with gradient text
- 8 colored badge chips for each framework

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: hero section with animated network canvas"
```

---

### Task 4: Framework gallery cards

**Files:**
- Modify: `index.html` — add gallery CSS + `renderGallery()` function

**Step 1: Add gallery CSS**

```css
#gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--gap);
}
.fw-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}
.fw-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.4);
}
.fw-card-header {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
}
.fw-name { font-size: 1.4rem; font-weight: 800; }
.fw-lang-badge {
  padding: 3px 10px; border-radius: 9999px;
  font-size: 0.75rem; font-weight: 700;
  background: var(--border); color: var(--muted);
}
.fw-card-body { padding: 20px 24px; }
.fw-tagline { color: var(--muted); font-size: 0.9rem; margin-bottom: 16px; }
.fw-diagram { margin: 16px 0; }
.fw-special {
  background: var(--bg); border-radius: 8px;
  padding: 12px 14px; font-size: 0.85rem;
  border-left: 3px solid;
  margin-bottom: 16px;
}
.fw-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.fw-pill {
  padding: 4px 12px; border-radius: 9999px;
  font-size: 0.78rem; font-weight: 600;
  background: var(--bg); border: 1px solid var(--border);
  color: var(--muted);
}
.fw-stats { display: flex; gap: 16px; }
.fw-stat { flex: 1; }
.fw-stat-label { font-size: 0.72rem; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
.fw-stat-bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
.fw-stat-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
.fw-connect {
  margin-top: 16px; padding: 12px 14px;
  background: var(--bg); border-radius: 8px;
  font-family: monospace; font-size: 0.78rem;
  color: var(--muted); white-space: pre-wrap;
  display: none;
}
.fw-card.expanded .fw-connect { display: block; }
.fw-card.expanded .fw-expand-hint { display: none; }
.fw-expand-hint { font-size: 0.78rem; color: var(--muted); margin-top: 12px; text-align: center; }
```

**Step 2: Add `renderGallery()` in `<script>`**

```js
function makeDiagram(fw) {
  const c = fw.color;
  const channels = fw.channels.slice(0, 3).join(' · ') + (fw.channels.length > 3 ? ` +${fw.channels.length - 3}` : '');
  return `<svg class="fw-diagram" viewBox="0 0 300 80" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    <!-- Channels box -->
    <rect x="2" y="20" width="72" height="40" rx="6" fill="${c}22" stroke="${c}" stroke-width="1.5"/>
    <text x="38" y="37" text-anchor="middle" fill="${c}" font-size="9" font-weight="700">CHANNELS</text>
    <text x="38" y="50" text-anchor="middle" fill="${c}99" font-size="7">${channels}</text>
    <!-- Arrow 1 -->
    <line x1="74" y1="40" x2="96" y2="40" stroke="${c}" stroke-width="1.5" marker-end="url(#arr-${fw.id})"/>
    <!-- Agent box -->
    <rect x="98" y="20" width="72" height="40" rx="6" fill="${c}22" stroke="${c}" stroke-width="1.5"/>
    <text x="134" y="37" text-anchor="middle" fill="${c}" font-size="9" font-weight="700">AGENT</text>
    <text x="134" y="50" text-anchor="middle" fill="${c}99" font-size="7">${fw.lang}</text>
    <!-- Arrow 2 -->
    <line x1="170" y1="40" x2="192" y2="40" stroke="${c}" stroke-width="1.5" marker-end="url(#arr-${fw.id})"/>
    <!-- Memory/Tools box -->
    <rect x="194" y="20" width="72" height="40" rx="6" fill="${c}22" stroke="${c}" stroke-width="1.5"/>
    <text x="230" y="37" text-anchor="middle" fill="${c}" font-size="9" font-weight="700">MEMORY</text>
    <text x="230" y="50" text-anchor="middle" fill="${c}99" font-size="7">+ TOOLS</text>
    <!-- Arrowhead marker -->
    <defs>
      <marker id="arr-${fw.id}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="${c}"/>
      </marker>
    </defs>
  </svg>`;
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = FRAMEWORKS.map(fw => `
    <div class="fw-card" id="${fw.id}" onclick="this.classList.toggle('expanded')">
      <div class="fw-card-header" style="border-top: 4px solid ${fw.color}">
        <span class="fw-name" style="color:${fw.color}">${fw.name}</span>
        <span class="fw-lang-badge">${fw.lang}</span>
      </div>
      <div class="fw-card-body">
        <p class="fw-tagline">${fw.tagline}</p>
        ${makeDiagram(fw)}
        <div class="fw-special" style="border-color:${fw.color};color:var(--text)">
          ✨ ${fw.special}
        </div>
        <div class="fw-pills">
          ${fw.abilities.map(a => `<span class="fw-pill" style="border-color:${fw.color}44;color:${fw.color}">${a}</span>`).join('')}
        </div>
        <div class="fw-stats">
          <div class="fw-stat">
            <div class="fw-stat-label">RAM Usage</div>
            <div class="fw-stat-bar">
              <div class="fw-stat-fill" style="width:${fw.ramScore*10}%;background:${fw.color}"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:3px">${fw.ram}</div>
          </div>
          <div class="fw-stat">
            <div class="fw-stat-label">Startup Time</div>
            <div class="fw-stat-bar">
              <div class="fw-stat-fill" style="width:${fw.startupScore*10}%;background:${fw.color}"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:3px">${fw.startup}</div>
          </div>
        </div>
        <div class="fw-connect">🔧 How to connect:\n${fw.configExample}</div>
        <p class="fw-expand-hint">Click to see config ↓</p>
      </div>
    </div>
  `).join('');
}
renderGallery();
```

**Step 3: Verify in browser**

Expected:
- 8 colored cards in a grid
- Each has a top color bar, language badge, tagline, SVG diagram, ability pills, RAM/startup bars
- Clicking a card reveals the config example

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: framework gallery cards with inline SVG diagrams"
```

---

### Task 5: Comparison table with filtering

**Files:**
- Modify: `index.html` — add compare CSS + `renderCompare()` function

**Step 1: Add compare CSS**

```css
#compare-filters { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
.filter-pill {
  padding: 6px 14px; border-radius: 9999px; cursor: pointer;
  font-size: 0.82rem; font-weight: 600; border: 1.5px solid var(--border);
  color: var(--muted); background: var(--surface); transition: all 0.15s;
}
.filter-pill.active { border-color: #fff; color: #fff; background: var(--border); }
.compare-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); }
th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
tr:hover td { background: var(--surface); }
tr.hidden { display: none; }
.cell-yes { color: #4ade80; font-size: 1.1rem; }
.cell-no { color: #475569; font-size: 1.1rem; }
.fw-name-cell { font-weight: 700; display: flex; align-items: center; gap: 8px; }
.fw-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
```

**Step 2: Add `renderCompare()` in `<script>`**

```js
let activeFilters = new Set();

function renderCompare() {
  // Filter chips
  const filtersEl = document.getElementById('compare-filters');
  filtersEl.innerHTML = `<span style="font-size:0.85rem;color:var(--muted);align-self:center">Filter by feature:</span>` +
    FEATURES.map(f => `
      <button class="filter-pill" data-key="${f.key}" onclick="toggleFilter('${f.key}')">
        ${f.icon} ${f.label}
      </button>
    `).join('');

  // Table
  const tableEl = document.getElementById('compare-table');
  tableEl.innerHTML = `<div class="compare-wrap">
    <table id="compare-tbl">
      <thead>
        <tr>
          <th>Framework</th>
          <th>Language</th>
          <th>RAM</th>
          <th>Channels</th>
          ${FEATURES.map(f => `<th title="${f.label}">${f.icon}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${FRAMEWORKS.map(fw => `
          <tr data-id="${fw.id}" data-features="${FEATURES.filter(f => fw.features[f.key]).map(f => f.key).join(',')}">
            <td><span class="fw-name-cell">
              <span class="fw-dot" style="background:${fw.color}"></span>
              <a href="#${fw.id}" style="color:${fw.color};text-decoration:none;font-weight:700">${fw.name}</a>
            </span></td>
            <td style="color:var(--muted);font-size:0.85rem">${fw.lang}</td>
            <td style="font-size:0.85rem">${fw.ram}</td>
            <td style="font-size:0.78rem;color:var(--muted)">${fw.channels.slice(0,3).join(', ')}${fw.channels.length>3?` +${fw.channels.length-3}`:''}</td>
            ${FEATURES.map(f => `<td class="${fw.features[f.key] ? 'cell-yes' : 'cell-no'}">${fw.features[f.key] ? '✓' : '—'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function toggleFilter(key) {
  if (activeFilters.has(key)) activeFilters.delete(key);
  else activeFilters.add(key);

  // Update pill styles
  document.querySelectorAll('.filter-pill').forEach(p => {
    p.classList.toggle('active', activeFilters.has(p.dataset.key));
  });

  // Filter rows
  document.querySelectorAll('#compare-tbl tbody tr').forEach(row => {
    if (activeFilters.size === 0) { row.classList.remove('hidden'); return; }
    const rowFeatures = row.dataset.features.split(',');
    const matches = [...activeFilters].every(f => rowFeatures.includes(f));
    row.classList.toggle('hidden', !matches);
  });
}
renderCompare();
```

**Step 3: Verify in browser**

Expected:
- Full comparison table with all 8 frameworks
- Feature icons as column headers with tooltips
- Click "Multi-Agent" filter → only TinyClaw, NanoClaw, AgentZero rows remain
- Click again to deactivate

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: filterable comparison table"
```

---

### Task 6: Blueprint Builder — wizard UI

**Files:**
- Modify: `index.html` — add builder CSS + wizard HTML rendered by `renderBuilder()`

**Step 1: Add builder CSS**

```css
.wizard-steps { display: flex; gap: 12px; margin-bottom: 40px; }
.wizard-step {
  padding: 8px 20px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600;
  background: var(--surface); border: 1.5px solid var(--border); color: var(--muted);
}
.wizard-step.active { border-color: #fff; color: #fff; }
.wizard-step.done { border-color: #4ade8055; color: #4ade80; }
.wizard-panel { display: none; }
.wizard-panel.active { display: block; }
.checkbox-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px; margin-bottom: 32px;
}
.check-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: 8px;
  background: var(--surface); border: 1.5px solid var(--border);
  cursor: pointer; transition: border-color 0.15s;
}
.check-item:hover { border-color: #555; }
.check-item.checked { border-color: #fff; }
.check-item input { accent-color: #fff; width: 16px; height: 16px; flex-shrink: 0; }
.check-item label { cursor: pointer; font-size: 0.88rem; }
.radio-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
.radio-item {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 16px; border-radius: 8px;
  background: var(--surface); border: 1.5px solid var(--border);
  cursor: pointer; transition: border-color 0.15s;
}
.radio-item.checked { border-color: #fff; }
.radio-item input { accent-color: #fff; }
.wizard-btn {
  padding: 12px 28px; border-radius: 8px; border: none;
  font-size: 1rem; font-weight: 700; cursor: pointer;
  background: #fff; color: #000; transition: opacity 0.2s;
  margin-top: 8px;
}
.wizard-btn:hover { opacity: 0.85; }
.wizard-btn.secondary {
  background: var(--surface); color: var(--text);
  border: 1.5px solid var(--border); margin-right: 12px;
}
.constraint-group { margin-bottom: 28px; }
.constraint-label { font-weight: 700; margin-bottom: 12px; font-size: 0.95rem; }
```

**Step 2: Add builder state + `renderBuilder()` in `<script>`**

```js
const builderState = {
  features: new Set(),
  lang: 'any',
  hardware: 'normal',
  security: 'personal',
  step: 1,
};

function renderBuilder() {
  const el = document.getElementById('builder-wizard');
  el.innerHTML = `
    <div class="wizard-steps">
      <div class="wizard-step ${builderState.step===1?'active':builderState.step>1?'done':''}" id="ws1">1. Features</div>
      <div class="wizard-step ${builderState.step===2?'active':builderState.step>2?'done':''}" id="ws2">2. Constraints</div>
      <div class="wizard-step ${builderState.step===3?'active':''}" id="ws3">3. Your Blueprint</div>
    </div>

    <!-- Step 1 -->
    <div class="wizard-panel ${builderState.step===1?'active':''}" id="wp1">
      <h3 style="margin-bottom:16px">What features do you need?</h3>
      <div class="checkbox-grid">
        ${FEATURES.map(f => `
          <div class="check-item ${builderState.features.has(f.key)?'checked':''}" onclick="toggleFeature('${f.key}',this)">
            <input type="checkbox" id="cf-${f.key}" ${builderState.features.has(f.key)?'checked':''}>
            <label for="cf-${f.key}">${f.icon} ${f.label}</label>
          </div>
        `).join('')}
      </div>
      <button class="wizard-btn" onclick="goStep(2)">Next: Set Constraints →</button>
    </div>

    <!-- Step 2 -->
    <div class="wizard-panel ${builderState.step===2?'active':''}" id="wp2">
      <h3 style="margin-bottom:24px">What are your constraints?</h3>
      <div class="constraint-group">
        <div class="constraint-label">Preferred language</div>
        <div class="radio-group">
          ${[['any','No preference'],['TypeScript','TypeScript'],['Python','Python'],['Rust','Rust'],['Go','Go']].map(([v,l]) => `
            <div class="radio-item ${builderState.lang===v?'checked':''}" onclick="setConstraint('lang','${v}',this)">
              <input type="radio" name="lang" value="${v}" ${builderState.lang===v?'checked':''}> ${l}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="constraint-group">
        <div class="constraint-label">Hardware target</div>
        <div class="radio-group">
          ${[['normal','Normal laptop or server'],['edge','Edge device (Raspberry Pi)'],['extreme','Extreme edge ($10 board)']].map(([v,l]) => `
            <div class="radio-item ${builderState.hardware===v?'checked':''}" onclick="setConstraint('hardware','${v}',this)">
              <input type="radio" name="hw" value="${v}" ${builderState.hardware===v?'checked':''}> ${l}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="constraint-group">
        <div class="constraint-label">Security needs</div>
        <div class="radio-group">
          ${[['personal','Personal use'],['production','Production deployment'],['enterprise','Enterprise / strict sandbox']].map(([v,l]) => `
            <div class="radio-item ${builderState.security===v?'checked':''}" onclick="setConstraint('security','${v}',this)">
              <input type="radio" name="sec" value="${v}" ${builderState.security===v?'checked':''}> ${l}
            </div>
          `).join('')}
        </div>
      </div>
      <button class="wizard-btn secondary" onclick="goStep(1)">← Back</button>
      <button class="wizard-btn" onclick="goStep(3)">Generate Blueprint →</button>
    </div>

    <!-- Step 3 rendered by renderResults() -->
    <div class="wizard-panel ${builderState.step===3?'active':''}" id="wp3">
      ${builderState.step===3 ? renderResults() : ''}
    </div>
  `;
}

function toggleFeature(key, el) {
  if (builderState.features.has(key)) builderState.features.delete(key);
  else builderState.features.add(key);
  el.classList.toggle('checked');
  el.querySelector('input').checked = builderState.features.has(key);
}

function setConstraint(field, value, el) {
  builderState[field] = value;
  el.closest('.radio-group').querySelectorAll('.radio-item').forEach(r => r.classList.remove('checked'));
  el.classList.add('checked');
}

function goStep(n) {
  builderState.step = n;
  renderBuilder();
}
renderBuilder();
```

**Step 3: Verify in browser**

Expected:
- Three-step wizard header with step indicators
- Step 1: checkbox grid of all 12 features, toggleable
- Step 2: radio groups for language, hardware, security
- Clicking "Next" advances, "Back" retreats

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: blueprint builder wizard steps 1 and 2"
```

---

### Task 7: Blueprint Builder — results + PRD download

**Files:**
- Modify: `index.html` — add results CSS + `renderResults()` + `downloadPRD()` functions

**Step 1: Add results CSS**

```css
.results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin-bottom: 32px; }
@media (max-width: 700px) { .results-grid { grid-template-columns: 1fr; } }
.match-card {
  border-radius: var(--radius); padding: 20px;
  border: 2px solid var(--border); background: var(--surface);
}
.match-rank { font-size: 0.78rem; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.match-score-bar { height: 8px; border-radius: 4px; background: var(--border); margin: 8px 0; }
.match-score-fill { height: 100%; border-radius: 4px; }
.gap-list { margin-top: 12px; }
.gap-item { font-size: 0.82rem; padding: 4px 0; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; }
.gap-yes { color: #4ade80; }
.gap-no { color: #f87171; }
.config-snippet {
  background: var(--bg); border-radius: 8px; padding: 16px;
  font-family: monospace; font-size: 0.82rem; white-space: pre-wrap;
  border: 1px solid var(--border); overflow-x: auto;
}
.download-btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 28px; border-radius: 10px;
  background: linear-gradient(135deg, #7c3aed, #2563eb);
  color: #fff; font-size: 1rem; font-weight: 700;
  border: none; cursor: pointer; transition: opacity 0.2s;
  margin-top: 16px;
}
.download-btn:hover { opacity: 0.85; }
```

**Step 2: Add `scoreFramework()` + `renderResults()` + `downloadPRD()` in `<script>`**

```js
function scoreFramework(fw) {
  let score = 0;
  let total = builderState.features.size;
  if (total === 0) total = 1; // avoid division by zero

  // Feature match score
  let featureMatches = 0;
  builderState.features.forEach(key => {
    if (fw.features[key]) featureMatches++;
  });
  score += (featureMatches / total) * 60;

  // Language constraint
  if (builderState.lang === 'any' || fw.lang === builderState.lang) score += 20;

  // Hardware constraint
  if (builderState.hardware === 'extreme' && fw.features.lowRAM) score += 20;
  else if (builderState.hardware === 'edge' && (fw.features.lowRAM || fw.features.fastBoot)) score += 20;
  else if (builderState.hardware === 'normal') score += 20;

  // Security constraint
  if (builderState.security === 'enterprise' && fw.features.wasmSandbox) score += 10;
  else if (builderState.security === 'production' && (fw.features.container || fw.features.wasmSandbox)) score += 10;
  else if (builderState.security === 'personal') score += 10;

  return { fw, score: Math.round(score), featureMatches };
}

function renderResults() {
  const ranked = FRAMEWORKS.map(scoreFramework).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const second = ranked[1];

  const gapRows = FEATURES
    .filter(f => builderState.features.has(f.key))
    .map(f => `
      <div class="gap-item">
        <span>${f.icon} ${f.label}</span>
        <span class="${top.fw.features[f.key] ? 'gap-yes' : 'gap-no'}">${top.fw.features[f.key] ? '✓ Included' : '✗ Missing'}</span>
      </div>
    `).join('') || '<div style="color:var(--muted);font-size:0.85rem">No features selected — showing overall best match.</div>';

  return `
    <h3 style="margin-bottom:24px">Your Blueprint</h3>
    <div class="results-grid">
      <div class="match-card" style="border-color:${top.fw.color}">
        <div class="match-rank">Best Match</div>
        <div style="font-size:1.3rem;font-weight:800;color:${top.fw.color}">${top.fw.name}</div>
        <div style="font-size:0.85rem;color:var(--muted);margin-top:4px">${top.fw.tagline}</div>
        <div class="match-score-bar"><div class="match-score-fill" style="width:${top.score}%;background:${top.fw.color}"></div></div>
        <div style="font-size:0.82rem;color:var(--muted)">${top.score}% match</div>
        <div class="gap-list">${gapRows}</div>
      </div>
      <div>
        <div style="margin-bottom:16px">
          <div style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Runner-Up</div>
          <div style="font-weight:700;color:${second.fw.color}">${second.fw.name}</div>
          <div class="match-score-bar" style="margin-top:6px"><div class="match-score-fill" style="width:${second.score}%;background:${second.fw.color}"></div></div>
          <div style="font-size:0.82rem;color:var(--muted)">${second.score}% match</div>
        </div>
        <div style="font-size:0.85rem;font-weight:700;margin-bottom:8px">Sample Config:</div>
        <div class="config-snippet">${top.fw.configExample}</div>
      </div>
    </div>
    <button class="wizard-btn secondary" onclick="goStep(2)">← Adjust Constraints</button>
    <button class="download-btn" onclick="downloadPRD()">📄 Download My Blueprint PRD</button>
  `;
}

function downloadPRD() {
  const ranked = FRAMEWORKS.map(scoreFramework).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  const featureList = FEATURES
    .map(f => `- [${builderState.features.has(f.key) ? 'x' : ' '}] ${f.icon} ${f.label}`)
    .join('\n');
  const gapAnalysis = FEATURES
    .filter(f => builderState.features.has(f.key))
    .map(f => `| ${f.icon} ${f.label} | ${top.fw.features[f.key] ? '✅ Included' : '⚠️ Missing'} |`)
    .join('\n') || '| No features selected | — |';
  const topMatches = ranked.slice(0, 3).map((r, i) => `${i+1}. **${r.fw.name}** (${r.score}% match) — ${r.fw.tagline}`).join('\n');
  const borrowFrom = ranked
    .filter(r => r.fw.id !== top.fw.id)
    .slice(0, 3)
    .filter(r => {
      return FEATURES.some(f => builderState.features.has(f.key) && r.fw.features[f.key] && !top.fw.features[f.key]);
    })
    .map(r => {
      const missing = FEATURES.filter(f => builderState.features.has(f.key) && r.fw.features[f.key] && !top.fw.features[f.key]);
      return `- **${r.fw.name}** (${r.fw.lang}): ${missing.map(f => f.label).join(', ')}`;
    }).join('\n') || '- No additional borrowing needed — top match covers all features.';

  const hardwareMap = { normal: 'Normal laptop/server', edge: 'Edge device (Raspberry Pi)', extreme: 'Extreme edge ($10 board)' };
  const secMap = { personal: 'Personal use', production: 'Production deployment', enterprise: 'Enterprise / strict sandbox' };
  const langMap = { any: 'No preference', TypeScript: 'TypeScript', Python: 'Python', Rust: 'Rust', Go: 'Go' };

  const md = `# My Custom AI Assistant Blueprint
> Generated by The Claw Family Framework Guide — ${new Date().toLocaleDateString()}

---

## My Requirements

### Must-Have Features
${featureList}

### Constraints
- **Language preference:** ${langMap[builderState.lang]}
- **Hardware target:** ${hardwareMap[builderState.hardware]}
- **Security needs:** ${secMap[builderState.security]}

---

## Recommended Frameworks

${topMatches}

---

## Top Match: ${top.fw.name}

**Score:** ${top.score}% match
**Language:** ${top.fw.lang}
**RAM:** ${top.fw.ram} | **Startup:** ${top.fw.startup}
**Core philosophy:** ${top.fw.tagline}

### What it does for you:
${top.fw.special}

### Feature Gap Analysis

| Feature | Status |
|---------|--------|
${gapAnalysis}

### How to Get Started

\`\`\`
# Get the code
git clone ${top.fw.repoUrl}

# Configure it
${top.fw.configExample}
\`\`\`

---

## Filling the Gaps

If ${top.fw.name} is missing features you need, consider borrowing patterns from:

${borrowFrom}

---

## Recommended Architecture

Start with **${top.fw.name}** as your base. It gives you:
${top.fw.abilities.map(a => `- ${a}`).join('\n')}

${ranked[1].fw.id !== top.fw.id ? `
### Consider integrating from ${ranked[1].fw.name}:
${ranked[1].fw.abilities.slice(0,3).map(a => `- ${a}`).join('\n')}
` : ''}

---

## Next Steps

1. Clone ${top.fw.name}: \`git clone ${top.fw.repoUrl}\`
2. Run the setup wizard to configure your channels and LLM provider
3. Review the README and adjust configuration to your needs
4. Browse **Awesome-OpenClaw** (https://github.com/rohitg00/awesome-openclaw) for community extensions and integrations

---

*Generated by [The Claw Family Guide](https://github.com/openclaw/openclaw)*
`;

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'my-ai-framework-blueprint.md';
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 3: Verify in browser**

Expected:
- After completing wizard steps 1+2 and clicking "Generate Blueprint":
  - Ranked best-match card with score bar and gap analysis
  - Runner-up card with config snippet
  - "Download My Blueprint PRD" button downloads a `.md` file
  - Markdown file contains: requirements, gap analysis, config snippet, recommended architecture, next steps

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: blueprint builder results with PRD download"
```

---

### Task 8: Final polish — responsive, scroll animations, footer

**Files:**
- Modify: `index.html` — add polish CSS + animation JS + footer

**Step 1: Add polish CSS**

```css
/* Responsive */
@media (max-width: 640px) {
  nav { gap: 16px; padding: 0 16px; }
  section { padding: 48px 16px; }
  .hero-title { font-size: 2.2rem; }
}
/* Fade-in on scroll */
.fade-in { opacity: 0; transform: translateY(24px); transition: opacity 0.5s, transform 0.5s; }
.fade-in.visible { opacity: 1; transform: none; }
/* Footer */
footer {
  text-align: center; padding: 48px 32px;
  border-top: 1px solid var(--border);
  color: var(--muted); font-size: 0.85rem;
}
footer a { color: var(--muted); }
```

**Step 2: Add scroll animation + footer in `<script>` after all render calls**

```js
// Scroll fade-in
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1 });
document.querySelectorAll('.fw-card, .match-card').forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// Footer
document.body.insertAdjacentHTML('beforeend', `
  <footer>
    <p>The Claw Family — AI Framework Comparison Guide</p>
    <p style="margin-top:8px">
      <a href="https://github.com/openclaw/openclaw">OpenClaw</a> ·
      <a href="https://github.com/openagen/zeroclaw">ZeroClaw</a> ·
      <a href="https://github.com/gavrielc/nanoclaw">NanoClaw</a> ·
      <a href="https://github.com/HKUDS/nanobot">NanoBot</a> ·
      <a href="https://github.com/sipeed/picoclaw">PicoClaw</a> ·
      <a href="https://github.com/nearai/ironclaw">IronClaw</a> ·
      <a href="https://github.com/jlia0/tinyclaw">TinyClaw</a> ·
      <a href="https://github.com/agent0ai/agent-zero">Agent Zero</a>
    </p>
  </footer>
`);
```

**Step 3: Final browser verify — full walkthrough**

1. Open `index.html` — animated hero loads, all 8 badge chips visible
2. Scroll to Gallery — 8 colored cards with SVG diagrams, ability pills, stat bars
3. Click a card — config example expands
4. Scroll to Compare — full table visible, click a feature filter, rows hide correctly
5. Scroll to Builder — complete wizard flow:
   - Step 1: check 3-4 features
   - Step 2: pick language/hardware/security
   - Step 3: results appear with match scores, config, gap table
   - Download — `.md` file downloads with proper content
6. Resize to mobile width — layout stacks correctly

**Step 4: Final commit**

```bash
git add index.html
git commit -m "feat: polish, scroll animations, footer, responsive layout"
```

---

## Summary

8 tasks → 1 self-contained `index.html` (~600–800 lines) with:
- Animated hero (canvas network)
- 8 framework cards (SVG diagrams, ability pills, stat bars, expandable config)
- Filterable comparison table
- 3-step Blueprint Builder with match scoring + downloadable Markdown PRD
