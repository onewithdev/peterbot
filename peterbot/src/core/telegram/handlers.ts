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
    await ctx.reply(
      `👋 Hi! I'm peterbot.

Send me a task and I'll work on it in the background.
Use /status to see what I'm working on.`,
      { parse_mode: "Markdown" }
    );
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

  // Main message handler
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.chat.id.toString();

    // Skip if message starts with '/' (already handled by commands)
    if (text.startsWith("/")) {
      return;
    }

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
}
