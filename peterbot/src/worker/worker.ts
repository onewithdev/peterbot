/**
 * Background Worker Module
 *
 * This module implements the background job processor that polls the database
 * for pending jobs, processes them using the AI layer, and delivers results
 * via Telegram. It follows a polling loop pattern with sequential job processing.
 *
 * ## Architecture
 *
 * 1. **Polling Loop**: Infinite loop that checks for pending jobs every 5 seconds
 * 2. **Job Processing**: Sequential processing of jobs with status transitions
 * 3. **AI Integration**: Conditional tool availability based on task heuristics
 * 4. **Delivery**: Automatic result delivery via Telegram Bot API
 *
 * ## Job Lifecycle
 *
 * ```
 * pending → running → completed → delivered
 *                   └→ failed
 * ```
 *
 * ## Usage
 *
 * Start the worker:
 * ```bash
 * bun run src/worker/worker.ts
 * ```
 */

import { generateText } from "ai";
import { Bot } from "grammy";
import { readFileSync } from "fs";
import { join } from "path";
import { getModel } from "../ai/client.js";
import { peterbotTools } from "../ai/tools.js";
import {
  getPendingJobs,
  markJobRunning,
  markJobCompleted,
  markJobFailed,
  markJobDelivered,
  incrementJobRetryCount,
} from "../features/jobs/repository.js";
import type { Job } from "../features/jobs/schema.js";
import { config } from "../shared/config.js";
import { db } from "../db/index.js";
import { readConfigFile } from "../core/dashboard/files.js";

// Force early validation of required config (throws if missing)
config.googleApiKey;
config.e2bApiKey;

/**
 * Polling interval in milliseconds.
 * The worker checks for pending jobs every 5 seconds.
 */
const POLL_INTERVAL_MS = 5000;

/**
 * Telegram bot token from centralized config.
 * Throws immediately at startup if not configured.
 */
const TELEGRAM_BOT_TOKEN = config.telegramBotToken;

/**
 * Build the system prompt for the AI model.
 *
 * Defines peterbot's role, capabilities, and response format.
 * Includes soul.md and memory.md content if available.
 * Includes current date context for time-aware responses.
 *
 * @returns System prompt string for the AI model
 */
export async function buildSystemPrompt(): Promise<string> {
  const today = new Date().toDateString();

  // Read configuration files
  let soulContent: string | null = null;
  let memoryContent: string | null = null;

  try {
    soulContent = await readConfigFile("soul");
  } catch (error) {
    console.warn("[Worker] Failed to read soul.md:", error instanceof Error ? error.message : String(error));
  }

  try {
    memoryContent = await readConfigFile("memory");
  } catch (error) {
    console.warn("[Worker] Failed to read memory.md:", error instanceof Error ? error.message : String(error));
  }

  const sections: string[] = [
    "You are peterbot, a helpful AI assistant integrated with Telegram.",
    "",
    "Your capabilities include:",
    "- Answering questions and explaining concepts",
    "- Writing and analyzing code",
    "- Performing data analysis and calculations",
    "- Creating visualizations and charts",
    "- Web scraping and API interactions",
    "- File processing and generation",
    "",
    "When given computational tasks (data analysis, calculations, file creation, etc.),",
    "use the runCode tool to execute Python code in a secure sandbox environment.",
  ];

  // Add soul content if available
  if (soulContent) {
    sections.push("", "=== PERSONALITY ===", "", soulContent);
  }

  // Add memory content if available
  if (memoryContent) {
    sections.push("", "=== USER MEMORY ===", "", memoryContent);
  }

  // Add current date
  sections.push(
    "",
    `Current date: ${today}`,
    "",
    "Format your responses using Markdown for better readability when appropriate.",
    "Be concise but thorough in your responses."
  );

  return sections.join("\n");
}

/**
 * Keywords that indicate a task likely needs code execution.
 */
const E2B_KEYWORDS = [
  "csv",
  "chart",
  "graph",
  "plot",
  "script",
  "code",
  "calculate",
  "scrape",
  "download",
  "data",
  "analysis",
  "analyze",
  "analyse",
  "spreadsheet",
  "excel",
  "json",
  "api call",
  "fetch",
];

/**
 * Determine if a task likely needs E2B code execution.
 *
 * Uses keyword heuristics to decide whether to attach the runCode tool.
 * This optimizes API costs by only enabling tool calling when needed.
 *
 * @param input - The user's task input
 * @returns true if the task likely needs code execution
 */
export function shouldUseE2B(input: string): boolean {
  const lowerInput = input.toLowerCase();
  return E2B_KEYWORDS.some((keyword) => lowerInput.includes(keyword));
}

/**
 * Telegram message character limit.
 * Telegram supports messages up to 4096 characters.
 */
const TELEGRAM_MESSAGE_LIMIT = 4096;

/**
 * Maximum number of retries for delivery failures.
 */
const MAX_DELIVERY_RETRIES = 3;

/**
 * Truncate text to fit within Telegram's message limit.
 *
 * Reserves space for the header and appends a truncation notice when needed.
 *
 * @param text - The text to truncate
 * @param header - The header text that will be prepended
 * @returns Truncated text with notice if needed
 */
function truncateForTelegram(text: string, header: string): string {
  const totalLength = header.length + text.length;

  if (totalLength <= TELEGRAM_MESSAGE_LIMIT) {
    return text;
  }

  const truncationNotice = "\n\n[Message truncated due to length]";
  const maxTextLength = TELEGRAM_MESSAGE_LIMIT - header.length - truncationNotice.length;

  return text.slice(0, maxTextLength) + truncationNotice;
}

/**
 * Deliver a completed job result to the user via Telegram.
 *
 * Sends a success message with the result and marks the job as delivered.
 * Handles message length limits and delivery errors.
 *
 * @param job - The completed job
 * @param result - The result text to deliver
 */
async function deliverResult(job: Job, result: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[Worker] No TELEGRAM_BOT_TOKEN, skipping delivery for job ${job.id.slice(0, 8)}`);
    return;
  }

  const bot = new Bot(TELEGRAM_BOT_TOKEN);
  const shortId = job.id.slice(0, 8);
  const header = `✅ Task complete! [${shortId}]\n\n`;

  // Truncate result to fit within Telegram's message limit
  const truncatedResult = truncateForTelegram(result, header);

  try {
    await bot.api.sendMessage(job.chatId, header + truncatedResult);

    await markJobDelivered(db, job.id);
    console.log(`[Worker] Delivered result for job ${shortId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Failed to deliver result for job ${shortId}:`, errorMessage);

    // Handle delivery failure: schedule retry or mark as failed
    if (job.retryCount < MAX_DELIVERY_RETRIES) {
      await incrementJobRetryCount(db, job.id);
      console.log(`[Worker] Scheduled retry ${job.retryCount + 1}/${MAX_DELIVERY_RETRIES} for job ${shortId}`);
    } else {
      await markJobFailed(db, job.id, `Delivery failed after ${MAX_DELIVERY_RETRIES} retries: ${errorMessage}`);
      console.error(`[Worker] Job ${shortId} marked as failed after max delivery retries`);
    }
  }
}

/**
 * Notify the user of a job failure via Telegram.
 *
 * Sends an error message with retry instructions.
 *
 * @param job - The failed job
 * @param error - The error message
 */
async function notifyFailure(job: Job, error: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.log(`[Worker] No TELEGRAM_BOT_TOKEN, skipping failure notification for job ${job.id.slice(0, 8)}`);
    await markJobDelivered(db, job.id);
    return;
  }

  try {
    const bot = new Bot(TELEGRAM_BOT_TOKEN);
    const shortId = job.id.slice(0, 8);

    await bot.api.sendMessage(
      job.chatId,
      `❌ Task failed [${shortId}]\n\nError: ${error}\n\nReply "retry ${shortId}" to try again.`
    );

    await markJobDelivered(db, job.id);
    console.log(`[Worker] Sent failure notification for job ${shortId}`);
  } catch (notifyError) {
    const errorMessage = notifyError instanceof Error ? notifyError.message : String(notifyError);
    console.error(`[Worker] Failed to send failure notification for job ${job.id.slice(0, 8)}:`, errorMessage);
  }
}

/**
 * Check if code matches any blocklist patterns.
 *
 * Reads the blocklist configuration and tests the code against
 * strict patterns. Returns block status and reason if blocked.
 * Also checks warn patterns and returns warn status/message if matched.
 *
 * @param code - The code to check
 * @returns Object with blocked status, optional reason, warn status, and warn message
 */
export function checkBlocklist(code: string): {
  blocked: boolean;
  reason?: string;
  warn?: boolean;
  warnMessage?: string;
} {
  try {
    // Read blocklist file synchronously for use in tool handler
    const blocklistPath = join(process.cwd(), "config/blocklist.json");

    let content: string;
    try {
      content = readFileSync(blocklistPath, "utf-8");
    } catch {
      // File doesn't exist, allow execution
      return { blocked: false };
    }

    let parsed: {
      enabled?: boolean;
      strict?: { patterns: string[]; message: string };
      warn?: { patterns: string[]; message: string };
    };
    try {
      parsed = JSON.parse(content);
    } catch {
      // Invalid JSON, log warning and allow execution
      console.warn("[Worker] Invalid blocklist JSON, allowing execution");
      return { blocked: false };
    }

    // Check if blocklist is disabled
    if (parsed.enabled === false) {
      return { blocked: false };
    }

    // Check strict patterns
    const strictPatterns = parsed.strict?.patterns ?? [];
    const strictMessage = parsed.strict?.message ?? "This command is blocked for safety.";

    for (const pattern of strictPatterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(code)) {
          return {
            blocked: true,
            reason: strictMessage,
          };
        }
      } catch {
        // Invalid regex pattern, skip it
        console.warn(`[Worker] Invalid blocklist pattern: ${pattern}`);
      }
    }

    // Check warn patterns
    const warnPatterns = parsed.warn?.patterns ?? [];
    const warnMessage = parsed.warn?.message ?? "This command may have side effects.";

    for (const pattern of warnPatterns) {
      try {
        const regex = new RegExp(pattern, "i");
        if (regex.test(code)) {
          return {
            blocked: false,
            warn: true,
            warnMessage,
          };
        }
      } catch {
        // Invalid regex pattern, skip it
        console.warn(`[Worker] Invalid blocklist warn pattern: ${pattern}`);
      }
    }

    return { blocked: false };
  } catch (error) {
    // Any error, log warning and allow execution (fail open)
    console.warn("[Worker] Blocklist check failed:", error instanceof Error ? error.message : String(error));
    return { blocked: false };
  }
}

/**
 * Process a single job through the AI pipeline.
 *
 * Handles the complete job lifecycle:
 * 1. Marks job as running
 * 2. Determines if tools are needed
 * 3. Calls AI with appropriate configuration
 * 4. Marks job as completed or failed
 * 5. Delivers result or notifies of failure
 *
 * @param job - The job to process
 */
async function processJob(job: Job): Promise<void> {
  const shortId = job.id.slice(0, 8);
  const inputPreview = job.input.length > 50 ? `${job.input.slice(0, 50)}...` : job.input;

  console.log(`[Worker] Processing job ${shortId}: "${inputPreview}"`);

  await markJobRunning(db, job.id);

  try {
    // Build system prompt (now async to read config files)
    const systemPrompt = await buildSystemPrompt();

    // Determine if this task needs code execution tools
    const tools = shouldUseE2B(job.input) ? peterbotTools : undefined;

    if (tools) {
      console.log(`[Worker] Job ${shortId} requires code execution, enabling tools`);
    }

    // Call the AI model
    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      prompt: job.input,
      tools,
      maxSteps: 10,
    });

    const output = result.text;

    // Mark job as completed
    await markJobCompleted(db, job.id, output);
    console.log(`[Worker] Job ${shortId} completed`);

    // Deliver the result
    await deliverResult(job, output);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark job as failed
    await markJobFailed(db, job.id, errorMessage);
    console.error(`[Worker] Job ${shortId} failed:`, errorMessage);

    // Notify user of failure
    await notifyFailure(job, errorMessage);
  }
}

/**
 * Main polling loop for the worker.
 *
 * Continuously polls for pending jobs and processes them sequentially.
 * Errors in the poll loop are caught and logged without exiting.
 */
async function pollLoop(): Promise<void> {
  console.log(`[Worker] Starting background worker (poll interval: ${POLL_INTERVAL_MS}ms)`);

  while (true) {
    try {
      // Fetch pending jobs
      const jobs = await getPendingJobs(db);

      if (jobs.length > 0) {
        console.log(`[Worker] Found ${jobs.length} pending job(s)`);
      }

      // Process each job sequentially
      for (const job of jobs) {
        await processJob(job);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[Worker] Error in poll loop:", errorMessage);
    }

    // Sleep before next poll
    await Bun.sleep(POLL_INTERVAL_MS);
  }
}

// Start the worker if this file is run directly
if (import.meta.main) {
  pollLoop().catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Worker] Fatal error:", errorMessage);
    process.exit(1);
  });
}
