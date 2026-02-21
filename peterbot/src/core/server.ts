/**
 * Main Server Entry Point
 *
 * This is the application entry point that orchestrates all components:
 * - Hono web server for health checks and basic dashboard
 * - Telegram bot initialization with long-polling
 * - Worker process spawning with auto-restart
 *
 * ## Boot Sequence
 *
 * 1. Read PORT from environment (default 3000)
 * 2. Start worker process (spawns src/worker/worker.ts as child)
 * 3. Start Telegram bot with long-polling
 * 4. Start HTTP server on configured port
 *
 * ## Architecture
 *
 * The server uses Bun's HTTP server capabilities with Hono for routing.
 * The worker runs as a separate child process for isolation and auto-restart.
 * The Telegram bot uses grammy's long-polling mechanism.
 */

import { Hono } from "hono";
import { getBot } from "./telegram/bot.js";
import { config } from "../shared/config.js";
import { dashboardApp } from "./dashboard/routes.js";
import { serveStatic } from "hono/bun";
import { startSkillsPoller } from "../features/skills/loader.js";
import { db } from "../db/index.js";

/**
 * Server port from centralized config.
 */
const PORT = config.port;

/**
 * Worker restart delay in milliseconds.
 * Prevents rapid restart loops.
 */
const WORKER_RESTART_DELAY_MS = 2000;

/**
 * Active worker process reference.
 * Used for monitoring and restart management.
 */
let worker: ReturnType<typeof Bun.spawn> | null = null;

/**
 * Hono web application instance.
 */
const app = new Hono();

/**
 * Mount dashboard API routes.
 * All /api/* routes are handled by the dashboard app.
 */
app.route("/api", dashboardApp);

/**
 * Serve React SPA static files in production.
 *
 * In production, the frontend is built to web/dist/ and served
 * by Hono. All non-API routes serve index.html for client-side routing.
 *
 * Development uses Vite dev server (port 5173) which proxies /api to port 3000.
 */
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  // Serve static files from web/dist
  app.use("/*", serveStatic({ root: "./web/dist" }));

  // SPA fallback: serve index.html for any non-API route
  app.get("*", async (c) => {
    const indexHtml = await Bun.file("./web/dist/index.html").text();
    return c.html(indexHtml);
  });
}

/**
 * Health check endpoint.
 *
 * Returns JSON with service status and timestamp.
 * Used by Railway and monitoring tools.
 */
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    name: "peterbot",
    ts: Date.now(),
  });
});

/**
 * Root endpoint - Basic dashboard.
 *
 * Returns HTML showing peterbot is running.
 * This will be expanded in Slice 2 with full dashboard.
 */
app.get("/", (c) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>peterbot</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      backdrop-filter: blur(10px);
    }
    h1 { margin: 0 0 1rem 0; font-size: 2.5rem; }
    p { margin: 0.5rem 0; opacity: 0.9; }
    .status { font-size: 3rem; margin: 1rem 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="status">✅</div>
    <h1>peterbot Running</h1>
    <p>Personal AI agent that runs 24/7 on Railway</p>
    <p><em>Dashboard coming in Slice 2</em></p>
  </div>
</body>
</html>
  `;
  return c.html(html);
});

/**
 * Start the Telegram bot with long-polling.
 *
 * Gets the bot singleton and starts long-polling.
 * Logs bot username on successful connection.
 */
async function startBot(): Promise<void> {
  console.log("[core] 🤖 Starting Telegram bot...");

  const bot = getBot();

  await bot.start({
    onStart: (info) => {
      console.log(`[core] ✅ Bot @${info.username} is running`);
    },
  });
}

/**
 * Start the background worker process.
 *
 * Spawns worker.ts as a child process with inherited stdio.
 * Implements auto-restart on crash with a delay to prevent rapid loops.
 */
function startWorker(): void {
  console.log("[core] 🔧 Starting background worker...");

  spawnWorker();
}

/**
 * Spawn a new worker process.
 *
 * Internal function that creates the child process and sets up
 * exit monitoring for auto-restart.
 */
function spawnWorker(): void {
  worker = Bun.spawn(["bun", "src/worker/worker.ts"], {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });

  // Monitor worker for crashes and restart if needed
  worker.exited.then((exitCode) => {
    if (exitCode !== 0) {
      console.error(`[core] Worker crashed with code ${exitCode}, restarting in ${WORKER_RESTART_DELAY_MS}ms...`);
      setTimeout(spawnWorker, WORKER_RESTART_DELAY_MS);
    } else {
      console.log("[core] Worker exited cleanly");
    }
  });
}

/**
 * Main boot sequence.
 *
 * 1. Logs startup message
 * 2. Starts worker process
 * 3. Starts Telegram bot
 *
 * Note: HTTP server is started separately via the default export
 * for Bun's HTTP server compatibility.
 */
async function boot(): Promise<void> {
  console.log(`[core] 🚀 peterbot starting on port ${PORT}`);

  // Force early validation of required config (throws if missing)
  config.telegramChatId;
  config.e2bApiKey;
  // Note: encryptionKey is NOT validated here - it's only required when
  // storing/reading encrypted DB keys. The encryption module validates
  // it lazily when encrypt/decrypt is called. This allows env-only key
  // paths to boot without ENCRYPTION_KEY.

  // Start worker first (non-blocking)
  startWorker();

  // Start skills poller (non-blocking)
  const stopSkillsPoller = startSkillsPoller(db);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log("[core] Shutting down gracefully...");
    stopSkillsPoller();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Start bot (this will block with long-polling)
  await startBot();
}

// Start the application if this file is run directly
if (import.meta.main) {
  boot().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[core] Fatal error during boot:", errorMessage);
    process.exit(1);
  });
}

/**
 * Default export for Bun's HTTP server.
 *
 * This export format allows Bun to handle the HTTP server
 * while the boot sequence handles the bot and worker.
 */
export default {
  port: config.port,
  fetch: app.fetch,
};
