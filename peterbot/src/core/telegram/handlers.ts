import { Bot } from "grammy";
import { generateText } from "ai";
import { detectIntent } from "./intent";
import { db } from "../../db";
import {
  createJob,
  getJobsByChatId,
  getJobById,
} from "../../features/jobs/repository";
import { formatJobsForStatus } from "../../features/jobs/service";
import { getModel } from "../../ai/client";
import type { Job } from "../../features/jobs/schema";

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
 * Setup all bot handlers and middleware.
 *
 * @param bot - The Grammy Bot instance
 */
export function setupHandlers(bot: Bot): void {
  // Ejection point 1: remove this check when adding multi-user support
  const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

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
