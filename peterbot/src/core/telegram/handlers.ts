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
  getScheduleById,
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
 * Grouped by category: Core, Scheduling, and Solutions.
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
  | { type: "schedule"; jobId: string; input: string };

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
    const buttons = getButtonsForContext("start");
    const keyboard = buildInlineKeyboard(buttons);
    await ctx.reply(
      `👋 Hi! I'm peterbot.

Send me a task and I'll work on it in the background.
Use /status to see what I'm working on.`,
      { parse_mode: "Markdown", reply_markup: keyboard }
    );
  });

  // Command: /help
  bot.command("help", async (ctx) => {
    await ctx.reply(formatHelpMessage(), { parse_mode: "Markdown" });
  });

  // Command: /status
  bot.command("status", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const allJobs = await getJobsByChatId(db, chatId);
    await ctx.reply(formatStatusReply(allJobs));
  });

  // Command: /retry [jobId]
  bot.command("retry", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";
    const parts = text.split(" ");

    if (parts.length < 2) {
      await ctx.reply(
        "Please provide a job ID. Usage: `/retry [jobId]`",
        { parse_mode: "Markdown" }
      );
      return;
    }

    let jobId = parts[1].trim();

    // Validate job ID format (8 chars or full UUID)
    if (jobId.length !== 8 && jobId.length !== 36) {
      await ctx.reply(
        "Invalid job ID format. Use the first 8 characters or the full ID.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // If 8 chars, find matching job by prefix
    if (jobId.length === 8) {
      const jobs = await getJobsByChatId(db, chatId);
      const matchingJob = jobs.find((j) => j.id.startsWith(jobId));

      if (!matchingJob) {
        await ctx.reply(
          `Job \`${jobId}\` not found.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      jobId = matchingJob.id;
    }

    // Get full job
    const job = await getJobById(db, jobId);

    if (!job) {
      await ctx.reply(
        `Job \`${jobId.slice(0, 8)}\` not found.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (job.status !== "failed") {
      await ctx.reply(
        `Job \`${jobId.slice(0, 8)}\` is not failed (status: ${job.status}). Only failed jobs can be retried.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Create new job with same input
    const newJob = await createJob(db, {
      type: "task",
      input: job.input,
      chatId,
    });

    await ctx.reply(formatAckReply(newJob.id), { parse_mode: "Markdown" });
  });

  // Command: /get [jobId]
  bot.command("get", async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const text = ctx.message?.text || "";
    const parts = text.split(" ");

    if (parts.length < 2) {
      await ctx.reply(
        "Please provide a job ID. Usage: `/get [jobId]`",
        { parse_mode: "Markdown" }
      );
      return;
    }

    let jobId = parts[1].trim();

    // Validate job ID format (8 chars or full UUID)
    if (jobId.length !== 8 && jobId.length !== 36) {
      await ctx.reply(
        "Invalid job ID format. Use the first 8 characters or the full ID.",
        { parse_mode: "Markdown" }
      );
      return;
    }

    // If 8 chars, find matching job by prefix
    if (jobId.length === 8) {
      const jobs = await getJobsByChatId(db, chatId);
      const matchingJob = jobs.find((j) => j.id.startsWith(jobId));

      if (!matchingJob) {
        await ctx.reply(
          `Job \`${jobId}\` not found.`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      jobId = matchingJob.id;
    }

    // Get full job
    const job = await getJobById(db, jobId);

    if (!job) {
      await ctx.reply(
        `Job \`${jobId.slice(0, 8)}\` not found.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (job.status !== "completed") {
      await ctx.reply(
        `Job \`${jobId.slice(0, 8)}\` is not completed yet (status: ${job.status}).`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Truncate if > 4000 chars for Telegram limit
    let output = job.output || "No output available.";
    if (output.length > 4000) {
      output = output.slice(0, 4000) + "\n\n... (truncated)";
    }

    await ctx.reply(output);
  });

  // Command: /schedule
  bot.command("schedule", async (ctx) => {
    const text = ctx.message?.text || "";
    const chatId = ctx.chat.id.toString();

    // Get the text after "/schedule "
    const args = text.slice("/schedule ".length).trim();

    if (!args) {
      await ctx.reply(
        `Usage:\n` +
          `/schedule every monday 9am "send me a briefing"\n\n` +
          `To delete: /schedule delete <id>`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    // Check for delete subcommand
    if (args.toLowerCase().startsWith("delete ")) {
      const idPrefix = args.slice(7).trim();

      if (idPrefix.length !== 8) {
        await ctx.reply(
          "Please provide the first 8 characters of the schedule ID.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      // Find schedule by prefix
      const schedules = await getAllSchedules(db);
      const schedule = schedules.find((s) => s.id.startsWith(idPrefix));

      if (!schedule) {
        await ctx.reply("❌ Schedule not found.", { parse_mode: "Markdown" });
        return;
      }

      await deleteSchedule(db, schedule.id);
      await ctx.reply(`✅ Schedule \`${idPrefix}\` deleted.`, {
        parse_mode: "Markdown",
      });
      return;
    }

    // Parse "when" "what" format using regex
    const match = args.match(/^(.+?)\s+"([^"]+)"\s*$/);

    if (!match) {
      await ctx.reply(
        `Usage: /schedule <when> "<what>"\n\n` +
          `Examples:\n` +
          `/schedule every monday 9am "send me a briefing"\n` +
          `/schedule every weekday at 8:30am "check emails"\n` +
          `/schedule every day at midnight "daily summary"`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    const [, when, what] = match;

    try {
      // Parse the natural language schedule
      const parsed = await parseNaturalSchedule(when);

      if (parsed.confidence < 0.5) {
        await ctx.reply(
          `❌ Could not understand the schedule.\n\n` +
            `Try formats like:\n` +
            `• every Monday at 9am\n` +
            `• every weekday at 8:30am\n` +
            `• every day at midnight`,
          { parse_mode: "Markdown" }
        );
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

      await ctx.reply(formatScheduleCreated(schedule, parsed.description), {
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error("Error creating schedule:", error);
      await ctx.reply(
        "Sorry, I encountered an error while creating the schedule. Please try again.",
        { parse_mode: "Markdown" }
      );
    }
  });

  // Command: /schedules
  bot.command("schedules", async (ctx) => {
    const schedules = await getAllSchedules(db);
    await ctx.reply(formatSchedulesList(schedules), { parse_mode: "Markdown" });
  });

  // Command: /solutions
  bot.command("solutions", async (ctx) => {
    const solutions = await getAllSolutions(db);
    await ctx.reply(formatSolutionsList(solutions), { parse_mode: "Markdown" });
  });

  // Main message handler
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();

    // Skip if message starts with '/' (already handled by commands)
    if (text.startsWith("/")) {
      return;
    }

    // Check for pending action
    const pending = pendingActions.get(chatId);

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
              await ctx.reply(formatSolutionSaved(tagged.title, tagged.tags), {
                parse_mode: "Markdown",
              });
            } catch (error) {
              console.error("Error saving solution:", error);
              pendingActions.delete(chatId);
              await ctx.reply(
                "Sorry, I encountered an error while saving the solution. Please try again.",
                { parse_mode: "Markdown" }
              );
            }
            return;
          }
        }

        // Invalid selection, re-send the list
        await ctx.reply(formatSaveList(pending.jobs), { parse_mode: "Markdown" });
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
            await ctx.reply(
              `❌ Could not understand the schedule.\n\n` +
                `Try formats like:\n` +
                `• every Monday at 9am\n` +
                `• every weekday at 8:30am\n` +
                `• every day at midnight\n\n` +
                `Or reply "cancel" to abort.`,
              { parse_mode: "Markdown" }
            );
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

          await ctx.reply(formatScheduleCreated(schedule, parsed.description), {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          });
          return;
        } catch (error) {
          console.error("Error creating schedule:", error);
          pendingActions.delete(chatId);
          await ctx.reply(
            "Sorry, I encountered an error while creating the schedule. Please try again.",
            { parse_mode: "Markdown" }
          );
          return;
        }
      }
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
      await ctx.reply(formatSuggestionMessage(topMatch), { parse_mode: "Markdown" });
      return;
    }

    // Normal flow: intent detection
    const intent = detectIntent(text);

    if (intent === "quick") {
      // Quick response: instant AI reply
      try {
        await ctx.replyWithChatAction("typing");

        const { text: response } = await generateText({
          model: getModel(),
          system:
            "You are peterbot, a helpful personal AI assistant. Answer concisely and directly.",
          prompt: text,
        });

        await ctx.reply(formatQuickReply(response));
      } catch (error) {
        console.error("Error generating quick reply:", error);
        await ctx.reply(
          "Sorry, I encountered an error while processing your request. Please try again."
        );
      }
    } else {
      // Task: create a background job
      const job = await createJob(db, {
        type: "task",
        input: text,
        chatId,
      });

      await ctx.reply(formatAckReply(job.id), { parse_mode: "Markdown" });
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
        text: "This button has expired. Please use commands instead.",
        show_alert: true,
      });
      return;
    }

    const data = ctx.callbackQuery.data;
    const { action, jobIdPrefix } = parseCallbackData(data);

    switch (action) {
      case "help": {
        await ctx.answerCallbackQuery();
        await ctx.reply(formatHelpMessage(), { parse_mode: "Markdown" });
        break;
      }

      case "schedules": {
        await ctx.answerCallbackQuery();
        const schedules = await getAllSchedules(db);
        await ctx.reply(formatSchedulesList(schedules), { parse_mode: "Markdown" });
        break;
      }

      case "solutions": {
        await ctx.answerCallbackQuery();
        const solutions = await getAllSolutions(db);
        await ctx.reply(formatSolutionsList(solutions), { parse_mode: "Markdown" });
        break;
      }

      case "save": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          await ctx.reply("Error: No job ID provided.", { parse_mode: "Markdown" });
          return;
        }

        // Get completed jobs for this chat
        const allJobs = await getJobsByChatId(db, chatId);
        const job = allJobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          await ctx.reply(`Job \`${jobIdPrefix}\` not found.`, { parse_mode: "Markdown" });
          return;
        }

        if (job.status !== "completed") {
          await ctx.reply(
            `Job \`${jobIdPrefix}\` is not completed yet (status: ${job.status}).`,
            { parse_mode: "Markdown" }
          );
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

          await ctx.reply(formatSolutionSaved(tagged.title, tagged.tags), {
            parse_mode: "Markdown",
          });
        } catch (error) {
          console.error("Error saving solution:", error);
          await ctx.reply(
            "Sorry, I encountered an error while saving the solution. Please try again.",
            { parse_mode: "Markdown" }
          );
        }
        break;
      }

      case "schedule": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          await ctx.reply("Error: No job ID provided.", { parse_mode: "Markdown" });
          return;
        }

        // Get the job to use its input as the schedule prompt
        const allJobs = await getJobsByChatId(db, chatId);
        const job = allJobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          await ctx.reply(`Job \`${jobIdPrefix}\` not found.`, { parse_mode: "Markdown" });
          return;
        }

        // Store pending schedule action with job input
        pendingActions.set(chatId, {
          type: "schedule",
          jobId: job.id,
          input: job.input,
        });

        await ctx.reply(
          `📅 *Schedule this task*\n\n` +
            `Job: \`${jobIdPrefix}\`\n` +
            `Task: ${job.input.slice(0, 50)}${job.input.length > 50 ? "..." : ""}\n\n` +
            `Please reply with when to run this (e.g., "every monday 9am", "daily at 8am"):`,
          { parse_mode: "Markdown" }
        );
        break;
      }

      case "retry": {
        await ctx.answerCallbackQuery();
        if (!jobIdPrefix) {
          await ctx.reply("Error: No job ID provided.", { parse_mode: "Markdown" });
          return;
        }

        const jobs = await getJobsByChatId(db, chatId);
        const job = jobs.find((j) => j.id.startsWith(jobIdPrefix));

        if (!job) {
          await ctx.reply(`Job \`${jobIdPrefix}\` not found.`, { parse_mode: "Markdown" });
          return;
        }

        if (job.status !== "failed") {
          await ctx.reply(
            `Job \`${jobIdPrefix}\` is not failed (status: ${job.status}). Only failed jobs can be retried.`,
            { parse_mode: "Markdown" }
          );
          return;
        }

        // Create new job with same input
        const newJob = await createJob(db, {
          type: "task",
          input: job.input,
          chatId,
        });

        await ctx.reply(formatAckReply(newJob.id), { parse_mode: "Markdown" });
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
