import { CronExpressionParser } from "cron-parser";
import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "../../ai/client.js";

/**
 * Calculate the next run time for a given cron expression.
 *
 * @param cron - The cron expression (5-field format)
 * @param from - Optional starting date (defaults to now)
 * @returns The next scheduled run date
 */
export function calculateNextRun(cron: string, from?: Date): Date {
  return CronExpressionParser.parse(cron, { currentDate: from ?? new Date() }).next().toDate();
}

/**
 * Parse natural language schedule into a cron expression.
 *
 * Uses the AI model to convert natural language like "every Monday at 9am"
 * into a valid 5-field cron expression.
 *
 * @param input - Natural language schedule description
 * @returns Object with cron expression, description, and confidence score
 */
export async function parseNaturalSchedule(
  input: string
): Promise<{ cron: string; description: string; confidence: number }> {
  const result = await generateObject({
    model: getModel(),
    schema: z.object({
      cron: z.string().describe("A valid 5-field cron expression (minute hour day month weekday)"),
      description: z.string().describe("A human-readable description of the schedule"),
      confidence: z.number().min(0).max(1).describe("Confidence score for the parsing"),
    }),
    system:
      "You are a cron expression parser. Convert natural language schedule descriptions into valid 5-field cron expressions. " +
      "The cron format is: minute(0-59) hour(0-23) day(1-31) month(1-12) weekday(0-7, where 0 and 7 are Sunday). " +
      "Examples: '0 9 * * 1' = Every Monday at 9:00 AM, '0 0 * * *' = Daily at midnight, '*/15 * * * *' = Every 15 minutes. " +
      "If the input is ambiguous, make a reasonable interpretation and set the confidence score accordingly.",
    prompt: `Parse this schedule description into a cron expression: "${input}"`,
  });

  return result.object;
}
