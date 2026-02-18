#!/usr/bin/env bun
/**
 * Concurrent Development Server
 * 
 * Runs both backend (with Telegram bot) and Vite dev server
 * in a single command. Handles graceful shutdown on Ctrl+C.
 */

import { spawn } from "child_process";
import { exit } from "process";

const processes: ReturnType<typeof spawn>[] = [];

function cleanup() {
  console.log("\n[dev-all] Shutting down...");
  processes.forEach((p) => p.kill("SIGTERM"));
  exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Start backend (port 3000) - includes Telegram bot + worker
console.log("[dev-all] Starting backend on :3000 (with Telegram bot)...");
const backend = spawn("bun", ["run", "dev"], {
  stdio: "inherit",
  env: process.env,
});
processes.push(backend);

// Wait a moment for backend to start, then start Vite
setTimeout(() => {
  console.log("[dev-all] Starting Vite dev server on :5173...");
  const frontend = spawn("bun", ["run", "web:dev"], {
    stdio: "inherit",
    env: process.env,
  });
  processes.push(frontend);
}, 1000);

console.log("[dev-all] Both servers starting... Press Ctrl+C to stop.\n");
