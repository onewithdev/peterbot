import { Bot } from "grammy";
import { generateText } from "ai";
import { detectIntent } from "./intent";
import { db } from "../../db";
import {
  createJob,
  getJobsByChatId,
  getJobById,
} from "../../features/jobs/repository";
import {
  getAllSchedules,
  createSchedule,
  deleteSchedule,
} from "../../features/cron/repository";
import {
  parseNaturalSchedule,
  calculateNextRun,
} from "../../features/cron/natural-parser";
import { formatJobsForStatus } from "../../features/jobs/service";
import { getModel } from "../../ai/client";
import { config } from "../../shared/config.js";
import type { Job } from "../../features/jobs/schema";
import type { Schedule } from "../../features/cron/schema";
import { findSimilarSolutions } from "../../features/solutions/similarity";
import { autoTagSolution, buildKeywords } from "../../features/solutions/service";
import { createSolution, getAllSolutions } from "../../features/solutions/repository";
import type { Solution } from "../../features/solutions/schema";
import {
  getButtonsForContext,
  buildInlineKeyboard,
  parseCallbackData,
  isCallbackExpired,
} from "./buttons.js";
import { saveMessage } from "../../features/chat/repository.js";
import { getEnabledSkills } from "../../features/skills/repository.js";
import type { Skill } from "../../features/skills/schema.js";
import {
  addDocument,
  refreshDocumentByName,
} from "../../features/documents/service.js";
import {
  getCapabilities,
  getChangelog,
  getEnabledSkillCapabilities,
  formatCapabilitiesSummary,
  formatChangelogForTelegram,
  formatSkillsCapabilityList,
  isCapabilitiesQuery,
} from "../../features/capabilities/service.js";

/**
 * Safely save a message to the database without throwing.
 * Logs errors but never blocks bot replies.
 */
async function safeSaveMessage(
  message: Parameters<typeof saveMessage>[1]
): Promise<void> {
  try {
    await saveMessage(undefined, message);
  } catch (error) {
    console.error("Failed to save message:", error);
  }
}

/**
 * Format an acknowledgment reply for a newly created task job.
 *
 * @param jobId - The full job ID
 * @returns Formatted acknowledgment message with short ID and status hint
 */
export function formatAckReply(jobId: string): string {
  const shortId = jobId.slice(0, 8);
  return `Got it ✓ I'm on it.\n\nJob ID: \`${shortId}\`\nSend /status to check progress.`;
}

/**
 * Format a quick reply response (passthrough).
 *
 * @param text - The response text from AI
 * @returns The text as-is
 */
export function formatQuickReply(text: string): string {
  return text;
}

/**
 * Format a status reply with job listings.
 *
 * Delegates to the service layer's formatJobsForStatus function.
 *
 * @param jobs - Array of jobs to format
 * @returns Formatted status message
 */
export function formatStatusReply(jobs: Job[]): string {
  return formatJobsForStatus(jobs);
}

/**
 * Format a schedule created confirmation message.
 *
 * @param schedule - The created schedule
 * @param parsedDescription - Human-readable description from AI parsing
 * @returns Formatted confirmation message
 */
export function formatScheduleCreated(
  schedule: Schedule,
  parsedDescription: string
): string {
  const shortId = schedule.id.slice(0, 8);
  const nextRun = new Date(schedule.nextRunAt).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    `✅ *Schedule created!*\n\n` +
    `*ID:* \`${shortId}\`\n` +
    `*When:* ${parsedDescription}\n` +
    `*What:* ${schedule.prompt}\n` +
    `*Next run:* ${nextRun}\n\n` +
    `Manage all schedules: /schedules`
  );
}

/**
 * Format the help message with all available commands.
 * Grouped by category: Core, Scheduling, Solutions, and Self-Awareness.
 *
 * @returns Formatted help message in Markdown
 */
export function formatHelpMessage(): string {
  return (
    `*📖 peterbot Commands*\n\n` +
    `*Core Commands*\n` +
    `\`/start\` — Welcome message\n` +
    `\`/help\` — Show this help\n` +
    `\`/status\` — List all your tasks\n` +
    `\`/retry [jobId]\` — Retry a failed job\n` +
    `\`/get [jobId]\` — Get completed job output\n\n` +
    `*Scheduling*\n` +
    `\`/schedule <when> "<what>"\` — Create recurring task\n` +
    `  Example: \`/schedule every monday 9am "send briefing"\`\n` +
    `\`/schedules\` — List all schedules\n\n` +
    `*Solutions*\n` +
    `\`/solutions\` — List saved solutions\n` +
    `Reply "save this solution" to a completed job\n\n` +
    `*Self-Awareness*\n` +
    `\`/whatcanido\` — Show my capabilities\n` +
    `\`/skills\` — List active skills\n` +
    `\`/changelog\` — Show version history\n\n` +
    `Send any task without \`/\` to get started!`
  );
}

/**
 * Format a list of schedules.
 *
 * @param schedules - Array of schedules to format
 * @returns Formatted schedules list message
 */
export function formatSchedulesList(schedules: Schedule[]): string {
  if (schedules.length === 0) {
    return (
      `📅 *Your schedules*\n\n` +
      `No schedules yet.\n\n` +
      `Create one with:\n` +
      `/schedule every monday 9am "send me a briefing"`
    );
  }

  const lines = schedules.map((s) => {
    const shortId = s.id.slice(0, 8);
    const status = s.enabled ? "🟢" : "⚫";
    return `${status} \`${shortId}\` ${s.description}`;
  });

  return (
    `📅 *Your schedules (${schedules.length}):*\n\n` +
    lines.join("\n") +
    `\n\n_Create a new schedule: /schedule_`
  );
}

// ============================================================================
// Pending Action State Machine
// ============================================================================

type PendingAction =
  | { type: "suggestion"; originalInput: string; solution: Solution }
  | { type: "save"; jobs: Job[] }
  | { type: "schedule"; jobId: string; input: string }
  | { type: "schedule_from_button"; jobInput: string; expiresAt: number }
  | { type: "save_url"; url: string; name: string; expiresAt: number };

const pendingActions = new Map<string, PendingAction>();

// ============================================================================
// Solution Format Helpers
// ============================================================================

function formatSuggestionMessage(solution: Solution): string {
  const tags = solution.tags ? (JSON.parse(solution.tags) as string[]) : [];
  const tagStr = tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : "";

  return (
    `💡 *Similar solution found!*\n\n` +
    `*${solution.title}*\n` +
    (tagStr ? `${tagStr}\n\n` : "\n") +
    `${solution.description || "No description available."}\n\n` +
    `Reply *yes* to use this approach, or *no* to proceed normally.`
  );
}

function formatSaveList(jobs: Job[]): string {
  const lines = jobs.map((job, idx) => {
    const shortId = job.id.slice(0, 8);
    const input = job.input.length > 40 ? job.input.slice(0, 40) + "..." : job.input;
    return `${idx + 1}. \`${shortId}\` ${input}`;
  });

  return (
    `💾 *Which job to save as a solution?*\n\n` +
    lines.join("\n") +
    `\n\nReply with a number (1–3).`
  );
}

function formatSolutionSaved(title: string, tags: string[]): string {
  const tagStr = tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : "";
  return (
    `✅ *Solution saved!*\n\n` +
    `*${title}*\n` +
    (tagStr ? `${tagStr}\n\n` : "\n") +
    `View all solutions: /solutions`
  );
}

function formatSolutionsList(solutions: Solution[]): string {
  if (solutions.length === 0) {
    return (
      `📚 *Your solutions*\n\n` +
      `No solutions yet.\n\n` +
      `To save a solution, reply to a completed job with:\n` +
      `"save this solution"`
    );
  }

  const lines = solutions.map((s) => {
    const tags = s.tags ? (JSON.parse(s.tags) as string[]) : [];
    const tagStr = tags.length > 0 ? tags.map((t) => `#${t}`).join(" ") : "";
    return `• *${s.title}* ${tagStr}`;
  });

  return `📚 *Your solutions (${solutions.length}):*\n\n` + lines.join("\n");
}

/**
 * Find a matching skill for the given text.
 *
 * @param skills - Array of enabled skills
 * @param text - The text to match against
 * @returns The matched skill's system prompt, or null if no match
 */
function findMatchingSkill(skills: Skill[], text: string): string | null {
  for (const skill of skills) {
    try {
      const regex = new RegExp(skill.triggerPattern, "i");
      if (regex.test(text)) {
        return skill.systemPrompt;
      }
    } catch {
      // Invalid regex, skip this skill
      continue;
    }
  }
  return null;
}

/**
 * Check if text is a "remember this" command.
 * Patterns: "remember this: <url>" or "remember this <url>"
 */
function extractRememberThisUrl(text: string): string | null {
  const patterns = [
    /remember this:\s*(.+)/i,
    /remember this\s+(.+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Check if text is a "refresh" command.
 * Pattern: "refresh <doc name>"
 */
function extractRefreshDocName(text: string): string | null {
  const match = text.match(/^refresh\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Extract URL from text if present.
 * Returns the first URL found, or null if no URL detected.
 */
function extractUrl(text: string): string | null {
  // Match URLs starting with http:// or https://
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i;
  const match = text.match(urlPattern);
  return match?.[0] ?? null;
}

/**
 * Generate a document name from a URL.
 * Uses the domain or last path segment, cleaned up for readability.
 */
function generateNameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    let name = pathParts[pathParts.length - 1] || urlObj.hostname || "Saved Document";
    // Remove file extensions and clean up
    name = name.replace(/\.(html?|md|txt|pdf)$/i, "").replace(/[_-]/g, " ");
    // Capitalize first letter
    name = name.charAt(0).toUpperCase() + name.slice(1);
    return name;
  } catch {
    // Invalid URL, use as-is (truncated)
    return url.slice(0, 50);
  }
}

/**
 * Setup all bot handlers and middleware.
 *
 * @param bot - The Grammy Bot instance
 */
export function setupHandlers(bot: Bot): void {
  // Ejection point 1: remove this check when adding multi-user support
  const authorizedChatId = config.telegramChatId;

  // Auth guard middleware
  bot.use(async (ctx, next) => {
    if (!authorizedChatId) {
      // If no authorized chat ID is set, allow all (for development)
      await next();
      return;
    }

    const chatId = ctx.chat?.id?.toString();
    if (chatId !== authorizedChatId) {
      await ctx.reply("Sorry, I only work for my owner.");
      return;
    }

    await next();
  });

  // Command: /start
  bot.command("start", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/start",
      sender: "user",
    }).catch(() => {});

    const buttons = getButtonsForContext("start");
    const keyboard = buildInlineKeyboard(buttons);
    const response = `👋 Hi! I'm peterbot.

Send me a task and I'll work on it in the background.
Use /status to see what I'm working on.`;

    await ctx.reply(response, { parse_mode: "Markdown", reply_markup: keyboard });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /help
  bot.command("help", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/help",
      sender: "user",
    }).catch(() => {});

    const response = formatHelpMessage();
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /status
  bot.command("status", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/status",
      sender: "user",
    }).catch(() => {});

    const allJobs = await getJobsByChatId(db, chatId);
    const response = formatStatusReply(allJobs);
    await ctx.reply(response);

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /retry [jobId]
  bot.command("retry", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: text,
      sender: "user",
    }).catch(() => {});

    const parts = text.split(" ");

    if (parts.length < 2) {
      const response = "Please provide a job ID. Usage: `/retry [jobId]`";
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    let jobId = parts[1].trim();

    // Validate job ID format (8 chars or full UUID)
    if (jobId.length !== 8 && jobId.length !== 36) {
      const response = "Invalid job ID format. Use the first 8 characters or the full ID.";
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // If 8 chars, find matching job by prefix
    if (jobId.length === 8) {
      const jobs = await getJobsByChatId(db, chatId);
      const matchingJob = jobs.find((j) => j.id.startsWith(jobId));

      if (!matchingJob) {
        const response = `Job \`${jobId}\` not found.`;
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      jobId = matchingJob.id;
    }

    // Get full job
    const job = await getJobById(db, jobId);

    if (!job) {
      const response = `Job \`${jobId.slice(0, 8)}\` not found.`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    if (job.status !== "failed") {
      const response = `Job \`${jobId.slice(0, 8)}\` is not failed (status: ${job.status}). Only failed jobs can be retried.`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // Create new job with same input
    const newJob = await createJob(db, {
      type: "task",
      input: job.input,
      chatId,
    });

    const response = formatAckReply(newJob.id);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
      jobId: newJob.id,
    }).catch(() => {});
  });

  // Command: /get [jobId]
  bot.command("get", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: text,
      sender: "user",
    }).catch(() => {});

    const parts = text.split(" ");

    if (parts.length < 2) {
      const response = "Please provide a job ID. Usage: `/get [jobId]`";
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response
      await saveMessage(undefined, {
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      });
      return;
    }

    let jobId = parts[1].trim();

    // Validate job ID format (8 chars or full UUID)
    if (jobId.length !== 8 && jobId.length !== 36) {
      const response = "Invalid job ID format. Use the first 8 characters or the full ID.";
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // If 8 chars, find matching job by prefix
    if (jobId.length === 8) {
      const jobs = await getJobsByChatId(db, chatId);
      const matchingJob = jobs.find((j) => j.id.startsWith(jobId));

      if (!matchingJob) {
        const response = `Job \`${jobId}\` not found.`;
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      jobId = matchingJob.id;
    }

    // Get full job
    const job = await getJobById(db, jobId);

    if (!job) {
      const response = `Job \`${jobId.slice(0, 8)}\` not found.`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    if (job.status !== "completed") {
      const response = `Job \`${jobId.slice(0, 8)}\` is not completed yet (status: ${job.status}).`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // Truncate if > 4000 chars for Telegram limit
    let output = job.output || "No output available.";
    if (output.length > 4000) {
      output = output.slice(0, 4000) + "\n\n... (truncated)";
    }

    await ctx.reply(output);

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: output,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /schedule
  bot.command("schedule", async (ctx) => {
    const text = ctx.message?.text || "";
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: text,
      sender: "user",
    }).catch(() => {});

    // Get the text after "/schedule "
    const args = text.slice("/schedule ".length).trim();

    if (!args) {
      const response = `Usage:\n` +
        `/schedule every monday 9am "send me a briefing"\n\n` +
        `To delete: /schedule delete <id>`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // Check for delete subcommand
    if (args.toLowerCase().startsWith("delete ")) {
      const idPrefix = args.slice(7).trim();

      if (idPrefix.length !== 8) {
        const response = "Please provide the first 8 characters of the schedule ID.";
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      // Find schedule by prefix
      const schedules = await getAllSchedules(db);
      const schedule = schedules.find((s) => s.id.startsWith(idPrefix));

      if (!schedule) {
        const response = "❌ Schedule not found.";
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      await deleteSchedule(db, schedule.id);
      const deleteResponse = `✅ Schedule \`${idPrefix}\` deleted.`;
      await ctx.reply(deleteResponse, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: deleteResponse,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // Parse "when" "what" format using regex
    const match = args.match(/^(.+?)\s+"([^"]+)"\s*$/);

    if (!match) {
      const response = `Usage: /schedule <when> "<what>"\n\n` +
        `Examples:\n` +
        `/schedule every monday 9am "send me a briefing"\n` +
        `/schedule every weekday at 8:30am "check emails"\n` +
        `/schedule every day at midnight "daily summary"`;
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    const [, when, what] = match;

    try {
      // Parse the natural language schedule
      const parsed = await parseNaturalSchedule(when);

      if (parsed.confidence < 0.5) {
        const response = `❌ Could not understand the schedule.\n\n` +
          `Try formats like:\n` +
          `• every Monday at 9am\n` +
          `• every weekday at 8:30am\n` +
          `• every day at midnight`;
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      // Calculate next run time
      const nextRunAt = calculateNextRun(parsed.cron);

      // Create the schedule
      const schedule = await createSchedule(db, {
        description: parsed.description,
        naturalSchedule: when,
        parsedCron: parsed.cron,
        prompt: what,
        enabled: true,
        nextRunAt,
      });

      const buttons = getButtonsForContext("schedule_created");
      const keyboard = buildInlineKeyboard(buttons);
      const response = formatScheduleCreated(schedule, parsed.description);

      await ctx.reply(response, {
        parse_mode: "Markdown",
        reply_markup: keyboard,
      });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
    } catch (error) {
      console.error("Error creating schedule:", error);
      const errorResponse = "Sorry, I encountered an error while creating the schedule. Please try again.";
      await ctx.reply(errorResponse, { parse_mode: "Markdown" });

      // Save bot error response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: errorResponse,
        sender: "bot",
      }).catch(() => {});
    }
  });

  // Command: /schedules
  bot.command("schedules", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/schedules",
      sender: "user",
    }).catch(() => {});

    const schedules = await getAllSchedules(db);
    const response = formatSchedulesList(schedules);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /solutions
  bot.command("solutions", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/solutions",
      sender: "user",
    }).catch(() => {});

    const solutions = await getAllSolutions(db);
    const response = formatSolutionsList(solutions);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /skills
  bot.command("skills", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/skills",
      sender: "user",
    }).catch(() => {});

    const enabledSkills = await getEnabledSkillCapabilities(db);
    const response = formatSkillsCapabilityList(enabledSkills);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /whatcanido - Show capabilities summary
  bot.command("whatcanido", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/whatcanido",
      sender: "user",
    }).catch(() => {});

    const capabilities = await getCapabilities(db);
    const response = formatCapabilitiesSummary(capabilities);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Command: /changelog - Show full changelog
  bot.command("changelog", async (ctx) => {
    const chatId = ctx.chat.id.toString();

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: "/changelog",
      sender: "user",
    }).catch(() => {});

    const changelog = await getChangelog();
    const response = formatChangelogForTelegram(changelog);
    await ctx.reply(response, { parse_mode: "Markdown" });

    // Save bot response (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "out",
      content: response,
      sender: "bot",
    }).catch(() => {});
  });

  // Main message handler
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();

    // Skip if message starts with '/' (already handled by commands)
    if (text.startsWith("/")) {
      return;
    }

    // Save user message (fire-and-forget, errors logged only)
    safeSaveMessage({
      chatId,
      direction: "in",
      content: text,
      sender: "user",
    }).catch(() => {});

    // Check for pending action
    const pending = pendingActions.get(chatId);

    // URL detection: if URL present and no pending action, offer to save
    if (!pending) {
      const detectedUrl = extractUrl(text);
      if (detectedUrl) {
        const docName = generateNameFromUrl(detectedUrl);
        
        // Store pending action with 5-minute expiry
        pendingActions.set(chatId, {
          type: "save_url",
          url: detectedUrl,
          name: docName,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });

        const promptMessage = 
          `🔗 *URL detected!*\n\n` +
          `Would you like me to save this document?\n\n` +
          `"${docName}"`;
        
        // Build inline keyboard with Yes/No buttons
        const keyboard = {
          inline_keyboard: [
            [
              { text: "✅ Yes", callback_data: "save_url:yes" },
              { text: "❌ No", callback_data: "save_url:no" },
            ],
          ],
        };

        await ctx.reply(promptMessage, { parse_mode: "Markdown", reply_markup: keyboard });

        // Save bot response
        safeSaveMessage({
          chatId,
          direction: "out",
          content: promptMessage,
          sender: "bot",
        }).catch(() => {});
        return;
      }
    }

    // Check for natural language capabilities query
    if (isCapabilitiesQuery(text)) {
      const capabilities = await getCapabilities(db);
      const response = formatCapabilitiesSummary(capabilities);
      await ctx.reply(response, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: response,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    if (pending) {
      if (pending.type === "save") {
        // Handle save selection
        const selection = text.trim();
        if (["1", "2", "3"].includes(selection)) {
          const index = parseInt(selection, 10) - 1;
          const job = pending.jobs[index];

          if (job) {
            try {
              const tagged = await autoTagSolution(job.input, job.output || "");
              const keywords = buildKeywords(job.input + " " + (job.output || ""));

              await createSolution(db, {
                jobId: job.id,
                title: tagged.title,
                description: tagged.description,
                tags: JSON.stringify(tagged.tags),
                keywords,
              });

              pendingActions.delete(chatId);
              const successResponse = formatSolutionSaved(tagged.title, tagged.tags);
              await ctx.reply(successResponse, {
                parse_mode: "Markdown",
              });

              // Save bot response (fire-and-forget, errors logged only)
              safeSaveMessage({
                chatId,
                direction: "out",
                content: successResponse,
                sender: "bot",
                jobId: job.id,
              }).catch(() => {});
            } catch (error) {
              console.error("Error saving solution:", error);
              pendingActions.delete(chatId);
              const errorResponse = "Sorry, I encountered an error while saving the solution. Please try again.";
              await ctx.reply(errorResponse, { parse_mode: "Markdown" });

              // Save bot error response (fire-and-forget, errors logged only)
              safeSaveMessage({
                chatId,
                direction: "out",
                content: errorResponse,
                sender: "bot",
              }).catch(() => {});
            }
            return;
          }
        }

        // Invalid selection, re-send the list
        const listResponse = formatSaveList(pending.jobs);
        await ctx.reply(listResponse, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: listResponse,
          sender: "bot",
        }).catch(() => {});
        return;
      }

      if (pending.type === "suggestion") {
        // Handle suggestion response
        const normalized = text.toLowerCase().trim();
        const yesKeywords = ["yes", "y", "yeah"];
        const noKeywords = ["no", "n", "nope"];

        if (yesKeywords.includes(normalized)) {
          // User wants to use the suggested approach
          const solution = pending.solution;
          const enhancedInput =
            `[PAST APPROACH]\n` +
            `Title: ${solution.title}\n` +
            `${solution.description}\n\n` +
            pending.originalInput;

          pendingActions.delete(chatId);

          const job = await createJob(db, {
            type: "task",
            input: enhancedInput,
            chatId,
          });

          await ctx.reply(formatAckReply(job.id), { parse_mode: "Markdown" });
          return;
        }

        if (noKeywords.includes(normalized)) {
          // User wants to proceed normally
          pendingActions.delete(chatId);

          const job = await createJob(db, {
            type: "task",
            input: pending.originalInput,
            chatId,
          });

          await ctx.reply(formatAckReply(job.id), { parse_mode: "Markdown" });
          return;
        }

        // Other message - clear pending and fall through to normal flow
        pendingActions.delete(chatId);
        // Continue to normal flow below
      }

      if (pending.type === "schedule") {
        // Handle schedule timing input
        const when = text.trim();

        try {
          // Parse the natural language schedule
          const parsed = await parseNaturalSchedule(when);

          if (parsed.confidence < 0.5) {
            const parseErrorResponse =
              `❌ Could not understand the schedule.\n\n` +
              `Try formats like:\n` +
              `• every Monday at 9am\n` +
              `• every weekday at 8:30am\n` +
              `• every day at midnight\n\n` +
              `Or reply "cancel" to abort.`;
            await ctx.reply(parseErrorResponse, { parse_mode: "Markdown" });

            // Save bot response (fire-and-forget, errors logged only)
            safeSaveMessage({
              chatId,
              direction: "out",
              content: parseErrorResponse,
              sender: "bot",
            }).catch(() => {});
            return;
          }

          // Calculate next run time
          const nextRunAt = calculateNextRun(parsed.cron);

          // Create the schedule
          const schedule = await createSchedule(db, {
            description: parsed.description,
            naturalSchedule: when,
            parsedCron: parsed.cron,
            prompt: pending.input,
            enabled: true,
            nextRunAt,
          });

          pendingActions.delete(chatId);

          const buttons = getButtonsForContext("schedule_created");
          const keyboard = buildInlineKeyboard(buttons);
          const successResponse = formatScheduleCreated(schedule, parsed.description);

          await ctx.reply(successResponse, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: successResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        } catch (error) {
          console.error("Error creating schedule:", error);
          pendingActions.delete(chatId);
          const errorResponse = "Sorry, I encountered an error while creating the schedule. Please try again.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });

          // Save bot error response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: errorResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }
      }

      if (pending.type === "schedule_from_button") {
        // Check if the pending schedule action has expired (5-minute window)
        if (Date.now() > pending.expiresAt) {
          // Expired - clear pending and treat message normally
          pendingActions.delete(chatId);
          // Continue to normal flow below (do not return)
        } else {
          // Valid - handle schedule timing input
          const when = text.trim();

          try {
            // Parse the natural language schedule
            const parsed = await parseNaturalSchedule(when);

            if (parsed.confidence < 0.5) {
              const parseErrorResponse =
                `❌ Could not understand the schedule.\n\n` +
                `Try formats like:\n` +
                `• every Monday at 9am\n` +
                `• every weekday at 8:30am\n` +
                `• every day at midnight\n\n` +
                `Or reply "cancel" to abort.`;
              await ctx.reply(parseErrorResponse, { parse_mode: "Markdown" });

              // Save bot response (fire-and-forget, errors logged only)
              safeSaveMessage({
                chatId,
                direction: "out",
                content: parseErrorResponse,
                sender: "bot",
              }).catch(() => {});
              return;
            }

            // Calculate next run time
            const nextRunAt = calculateNextRun(parsed.cron);

            // Create the schedule using the job input from the pending action
            const schedule = await createSchedule(db, {
              description: parsed.description,
              naturalSchedule: when,
              parsedCron: parsed.cron,
              prompt: pending.jobInput,
              enabled: true,
              nextRunAt,
            });

            pendingActions.delete(chatId);

            const buttons = getButtonsForContext("schedule_created");
            const keyboard = buildInlineKeyboard(buttons);
            const successResponse = formatScheduleCreated(schedule, parsed.description);

            await ctx.reply(successResponse, {
              parse_mode: "Markdown",
              reply_markup: keyboard,
            });

            // Save bot response (fire-and-forget, errors logged only)
            safeSaveMessage({
              chatId,
              direction: "out",
              content: successResponse,
              sender: "bot",
            }).catch(() => {});
            return;
          } catch (error) {
            console.error("Error creating schedule:", error);
            pendingActions.delete(chatId);
            const errorResponse = "Sorry, I encountered an error while creating the schedule. Please try again.";
            await ctx.reply(errorResponse, { parse_mode: "Markdown" });

            // Save bot error response (fire-and-forget, errors logged only)
            safeSaveMessage({
              chatId,
              direction: "out",
              content: errorResponse,
              sender: "bot",
            }).catch(() => {});
            return;
          }
        }
      }

      if (pending.type === "save_url") {
        // Check if the pending save_url action has expired (5-minute window)
        if (Date.now() > pending.expiresAt) {
          // Expired - clear pending and treat message normally
          pendingActions.delete(chatId);
          // Continue to normal flow below (do not return)
        } else {
          // Handle text response (yes/no)
          const normalized = text.toLowerCase().trim();
          const yesKeywords = ["yes", "y", "yeah", "sure", "ok", "okay"];
          const noKeywords = ["no", "n", "nope", "cancel"];

          if (yesKeywords.includes(normalized)) {
            // User confirmed - save the document
            try {
              const result = await addDocument(db, { name: pending.name, source: pending.url });

              let response: string;
              if (result.fetchSuccess) {
                response = `✅ I've saved the document "${result.document.name}".`;
                if (result.document.contentTruncated) {
                  response += "\n\n⚠️ Note: The content was large and has been truncated.";
                }
                response += "\n\nI'll reference it when relevant.";
              } else {
                response = `⚠️ I've saved the reference to "${result.document.name}" but couldn't fetch the content.`;
                if (result.fetchError) {
                  response += `\n\nError: ${result.fetchError}`;
                }
                response += "\n\nYou can try refreshing it later with: `refresh " + result.document.name + "`";
              }

              pendingActions.delete(chatId);
              await ctx.reply(response, { parse_mode: "Markdown" });

              // Save bot response
              safeSaveMessage({
                chatId,
                direction: "out",
                content: response,
                sender: "bot",
              }).catch(() => {});
              return;
            } catch (error) {
              console.error("Error saving document:", error);
              pendingActions.delete(chatId);
              const errorResponse = "Sorry, I encountered an error while saving the document. Please try again.";
              await ctx.reply(errorResponse, { parse_mode: "Markdown" });

              safeSaveMessage({
                chatId,
                direction: "out",
                content: errorResponse,
                sender: "bot",
              }).catch(() => {});
              return;
            }
          }

          if (noKeywords.includes(normalized)) {
            // User declined - clear pending and continue
            pendingActions.delete(chatId);
            const declineResponse = "Okay, I won't save that URL.";
            await ctx.reply(declineResponse);

            safeSaveMessage({
              chatId,
              direction: "out",
              content: declineResponse,
              sender: "bot",
            }).catch(() => {});
            return;
          }

          // Other message - clear pending and fall through to normal flow
          pendingActions.delete(chatId);
          // Continue to normal flow below
        }
      }
    }

    // Check for "remember this" intent
    const rememberUrl = extractRememberThisUrl(text);
    if (rememberUrl) {
      try {
        // Generate a name from the URL (domain or last path segment)
        let name = "Saved Document";
        try {
          const url = new URL(rememberUrl);
          const pathParts = url.pathname.split("/").filter(Boolean);
          name = pathParts[pathParts.length - 1] || url.hostname || "Saved Document";
          // Remove file extensions and clean up
          name = name.replace(/\.(html?|md|txt|pdf)$/i, "").replace(/[_-]/g, " ");
          // Capitalize first letter
          name = name.charAt(0).toUpperCase() + name.slice(1);
        } catch {
          // Invalid URL, use as-is
          name = rememberUrl.slice(0, 50);
        }

        const result = await addDocument(db, { name, source: rememberUrl });

        let response: string;
        if (result.fetchSuccess) {
          response = `✅ I've saved the document "${result.document.name}".`;
          if (result.document.contentTruncated) {
            response += "\n\n⚠️ Note: The content was large and has been truncated.";
          }
          response += "\n\nI'll reference it when relevant.";
        } else {
          response = `⚠️ I've saved the reference to "${result.document.name}" but couldn't fetch the content.`;
          if (result.fetchError) {
            response += `\n\nError: ${result.fetchError}`;
          }
          response += "\n\nYou can try refreshing it later with: `refresh " + result.document.name + "`";
        }

        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
      } catch (error) {
        console.error("Error saving document:", error);
        const errorResponse = "Sorry, I encountered an error while saving the document. Please try again.";
        await ctx.reply(errorResponse, { parse_mode: "Markdown" });

        safeSaveMessage({
          chatId,
          direction: "out",
          content: errorResponse,
          sender: "bot",
        }).catch(() => {});
      }
      return;
    }

    // Check for "refresh" command
    const refreshDocName = extractRefreshDocName(text);
    if (refreshDocName) {
      try {
        const result = await refreshDocumentByName(db, refreshDocName);

        let response: string;
        if (!result.document) {
          response = `❌ I couldn't find a document named "${refreshDocName}".`;
        } else if (result.success) {
          response = `✅ I've refreshed "${result.document.name}".`;
          if (result.document.contentTruncated) {
            response += "\n\n⚠️ Note: The content was large and has been truncated.";
          }
        } else {
          response = `❌ I couldn't refresh "${result.document.name}".`;
          if (result.error) {
            response += `\n\nError: ${result.error}`;
          }
        }

        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
      } catch (error) {
        console.error("Error refreshing document:", error);
        const errorResponse = "Sorry, I encountered an error while refreshing the document. Please try again.";
        await ctx.reply(errorResponse, { parse_mode: "Markdown" });

        safeSaveMessage({
          chatId,
          direction: "out",
          content: errorResponse,
          sender: "bot",
        }).catch(() => {});
      }
      return;
    }

    // Check for save intent
    const saveIntentKeywords = ["save this solution", "save solution", "save this"];
    const lowerText = text.toLowerCase();
    if (saveIntentKeywords.some((k) => lowerText.includes(k))) {
      // Get completed jobs for this chat
      const allJobs = await getJobsByChatId(db, chatId);
      const completedJobs = allJobs.filter((j) => j.status === "completed").slice(0, 3);

      if (completedJobs.length === 0) {
        await ctx.reply(
          "No completed jobs found to save. Complete a job first, then try saving.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      pendingActions.set(chatId, { type: "save", jobs: completedJobs });
      await ctx.reply(formatSaveList(completedJobs), { parse_mode: "Markdown" });
      return;
    }

    // Check for similar solutions
    const similarSolutions = await findSimilarSolutions(db, text);
    if (similarSolutions.length > 0) {
      const topMatch = similarSolutions[0];
      pendingActions.set(chatId, {
        type: "suggestion",
        originalInput: text,
        solution: topMatch,
      });
      const suggestionResponse = formatSuggestionMessage(topMatch);
      await ctx.reply(suggestionResponse, { parse_mode: "Markdown" });

      // Save bot response (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: suggestionResponse,
        sender: "bot",
      }).catch(() => {});
      return;
    }

    // Check for skill trigger matches
    const enabledSkills = await getEnabledSkills(db);
    const matchedSkillPrompt = findMatchingSkill(enabledSkills, text);

    // Normal flow: intent detection
    const intent = detectIntent(text);

    if (intent === "quick") {
      // Quick response: instant AI reply
      try {
        await ctx.replyWithChatAction("typing");

        // Build system prompt with skill context if matched
        let systemPrompt =
          "You are peterbot, a helpful personal AI assistant. Answer concisely and directly.";
        if (matchedSkillPrompt) {
          systemPrompt += "\n\n=== ACTIVE SKILL ===\n" + matchedSkillPrompt;
        }

        const { text: response } = await generateText({
          model: getModel(),
          system: systemPrompt,
          prompt: text,
        });

        const replyText = formatQuickReply(response);
        await ctx.reply(replyText);

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: replyText,
          sender: "bot",
        }).catch(() => {});
      } catch (error) {
        console.error("Error generating quick reply:", error);
        const errorMsg = "Sorry, I encountered an error while processing your request. Please try again.";
        await ctx.reply(errorMsg);

        // Save bot error response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: errorMsg,
          sender: "bot",
        }).catch(() => {});
      }
    } else {
      // Task: create a background job
      const job = await createJob(db, {
        type: "task",
        input: text,
        chatId,
        skillSystemPrompt: matchedSkillPrompt,
      });

      const ackReply = formatAckReply(job.id);
      await ctx.reply(ackReply, { parse_mode: "Markdown" });

      // Save bot acknowledgment (fire-and-forget, errors logged only)
      safeSaveMessage({
        chatId,
        direction: "out",
        content: ackReply,
        sender: "bot",
        jobId: job.id,
      }).catch(() => {});
    }
  });

  // Callback query handler for inline keyboard buttons
  bot.on("callback_query:data", async (ctx) => {
    const chatId = ctx.chat?.id?.toString();
    if (!chatId) return;

    // Check if callback is expired (5-minute window)
    const messageDate = ctx.callbackQuery.message?.date;
    if (messageDate && isCallbackExpired(messageDate)) {
      await ctx.answerCallbackQuery({
        text: "⏰ This action has expired. Send a new message to get fresh options.",
        show_alert: true,
      });
      return;
    }

    const data = ctx.callbackQuery.data;
    const { action, jobIdPrefix } = parseCallbackData(data);

    switch (action) {
      case "help": {
        await ctx.answerCallbackQuery();
        const response = formatHelpMessage();
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        break;
      }

      case "schedules": {
        await ctx.answerCallbackQuery();
        const schedules = await getAllSchedules(db);
        const response = formatSchedulesList(schedules);
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        break;
      }

      case "solutions": {
        await ctx.answerCallbackQuery();
        const solutions = await getAllSolutions(db);
        const response = formatSolutionsList(solutions);
        await ctx.reply(response, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: response,
          sender: "bot",
        }).catch(() => {});
        break;
      }

      case "save": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          const errorResponse = "Error: No job ID provided.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: errorResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        // Get completed jobs for this chat
        const allJobs = await getJobsByChatId(db, chatId);
        const job = allJobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          const notFoundResponse = `Job \`${jobIdPrefix}\` not found.`;
          await ctx.reply(notFoundResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: notFoundResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        if (job.status !== "completed") {
          const notCompletedResponse = `Job \`${jobIdPrefix}\` is not completed yet (status: ${job.status}).`;
          await ctx.reply(notCompletedResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: notCompletedResponse,
            sender: "bot",
            jobId: job.id,
          }).catch(() => {});
          return;
        }

        try {
          const tagged = await autoTagSolution(job.input, job.output || "");
          const keywords = buildKeywords(job.input + " " + (job.output || ""));

          await createSolution(db, {
            jobId: job.id,
            title: tagged.title,
            description: tagged.description,
            tags: JSON.stringify(tagged.tags),
            keywords,
          });

          const successResponse = formatSolutionSaved(tagged.title, tagged.tags);
          await ctx.reply(successResponse, {
            parse_mode: "Markdown",
          });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: successResponse,
            sender: "bot",
            jobId: job.id,
          }).catch(() => {});
        } catch (error) {
          console.error("Error saving solution:", error);
          const errorResponse = "Sorry, I encountered an error while saving the solution. Please try again.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });

          // Save bot error response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: errorResponse,
            sender: "bot",
          }).catch(() => {});
        }
        break;
      }

      case "schedule": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          const errorResponse = "Error: No job ID provided.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: errorResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        // Get the job to use its input as the schedule prompt
        const allJobs = await getJobsByChatId(db, chatId);
        const job = allJobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          const notFoundResponse = `Job \`${jobIdPrefix}\` not found.`;
          await ctx.reply(notFoundResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: notFoundResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        // Store pending schedule action with job input and 5-minute expiry
        pendingActions.set(chatId, {
          type: "schedule_from_button",
          jobInput: job.input,
          expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes from now
        });

        const promptResponse = "When should I run this?";
        await ctx.reply(promptResponse, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: promptResponse,
          sender: "bot",
          jobId: job.id,
        }).catch(() => {});
        break;
      }

      case "retry": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          const errorResponse = "Error: No job ID provided.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: errorResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        const jobs = await getJobsByChatId(db, chatId);
        const job = jobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          const notFoundResponse = `Job \`${jobIdPrefix}\` not found.`;
          await ctx.reply(notFoundResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: notFoundResponse,
            sender: "bot",
          }).catch(() => {});
          return;
        }

        if (job.status !== "failed") {
          const notFailedResponse = `Job \`${jobIdPrefix}\` is not failed (status: ${job.status}). Only failed jobs can be retried.`;
          await ctx.reply(notFailedResponse, { parse_mode: "Markdown" });

          // Save bot response (fire-and-forget, errors logged only)
          safeSaveMessage({
            chatId,
            direction: "out",
            content: notFailedResponse,
            sender: "bot",
            jobId: job.id,
          }).catch(() => {});
          return;
        }

        // Create new job with same input
        const newJob = await createJob(db, {
          type: "task",
          input: job.input,
          chatId,
        });

        const ackResponse = formatAckReply(newJob.id);
        await ctx.reply(ackResponse, { parse_mode: "Markdown" });

        // Save bot response (fire-and-forget, errors logged only)
        safeSaveMessage({
          chatId,
          direction: "out",
          content: ackResponse,
          sender: "bot",
          jobId: newJob.id,
        }).catch(() => {});
        break;
      }

      case "save_url": {
        await ctx.answerCallbackQuery();
        const pending = pendingActions.get(chatId);

        // Check if there's a pending save_url action
        if (!pending || pending.type !== "save_url") {
          const errorResponse = "⏰ This action has expired. Send the URL again to get fresh options.";
          await ctx.reply(errorResponse, { parse_mode: "Markdown" });
          return;
        }

        // Check if expired
        if (Date.now() > pending.expiresAt) {
          pendingActions.delete(chatId);
          const expiredResponse = "⏰ This action has expired. Send the URL again to get fresh options.";
          await ctx.reply(expiredResponse, { parse_mode: "Markdown" });
          return;
        }

        if (jobIdPrefix === "yes") {
          // User confirmed - save the document
          try {
            const result = await addDocument(db, { name: pending.name, source: pending.url });

            let response: string;
            if (result.fetchSuccess) {
              response = `✅ I've saved the document "${result.document.name}".`;
              if (result.document.contentTruncated) {
                response += "\n\n⚠️ Note: The content was large and has been truncated.";
              }
              response += "\n\nI'll reference it when relevant.";
            } else {
              response = `⚠️ I've saved the reference to "${result.document.name}" but couldn't fetch the content.`;
              if (result.fetchError) {
                response += `\n\nError: ${result.fetchError}`;
              }
              response += "\n\nYou can try refreshing it later with: `refresh " + result.document.name + "`";
            }

            pendingActions.delete(chatId);
            await ctx.reply(response, { parse_mode: "Markdown" });

            // Save bot response
            safeSaveMessage({
              chatId,
              direction: "out",
              content: response,
              sender: "bot",
            }).catch(() => {});
          } catch (error) {
            console.error("Error saving document:", error);
            pendingActions.delete(chatId);
            const errorResponse = "Sorry, I encountered an error while saving the document. Please try again.";
            await ctx.reply(errorResponse, { parse_mode: "Markdown" });

            safeSaveMessage({
              chatId,
              direction: "out",
              content: errorResponse,
              sender: "bot",
            }).catch(() => {});
          }
        } else if (jobIdPrefix === "no") {
          // User declined
          pendingActions.delete(chatId);
          const declineResponse = "Okay, I won't save that URL.";
          await ctx.reply(declineResponse);

          safeSaveMessage({
            chatId,
            direction: "out",
            content: declineResponse,
            sender: "bot",
          }).catch(() => {});
        }
        break;
      }

      default: {
        await ctx.answerCallbackQuery({
          text: "Unknown action.",
          show_alert: true,
        });
      }
    }
  });
}
