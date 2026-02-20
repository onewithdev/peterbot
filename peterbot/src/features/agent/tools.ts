/**
 * Agent Tools Factory
 *
 * Creates tool instances for the agent engine.
 * Provides the dispatch_task tool for creating background jobs.
 */

import { tool } from "ai";
import { z } from "zod";
import { db as defaultDb } from "../../db/index.js";
import { createJob } from "../jobs/repository.js";

/**
 * Create a dispatch_task tool that captures the chatId in closure.
 *
 * This tool allows the AI to dispatch long-running tasks as background jobs
 * instead of executing them inline. Use for complex scripts, web scraping,
 * file generation, or any task that may take more than 10 seconds.
 *
 * @param chatId - The chat ID to associate with the dispatched job
 * @returns A Vercel AI SDK tool instance for dispatch_task
 */
export function createDispatchTaskTool(chatId: string) {
  return tool({
    description:
      "Use for complex scripts, web scraping, file generation, or any task that may take more than 10 seconds. " +
      "Prefer this over runCode for long-running work.",
    parameters: z.object({
      input: z.string().describe("The task description to dispatch for background processing"),
    }),
    execute: async ({ input }) => {
      const job = await createJob(defaultDb, {
        type: "task",
        input,
        chatId,
      });
      return {
        jobId: job.id,
        shortId: job.id.slice(0, 8),
      };
    },
  });
}
