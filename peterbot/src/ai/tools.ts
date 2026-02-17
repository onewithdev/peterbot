/**
 * AI Tools Definition Module
 *
 * This module defines the tools that Claude can invoke during task processing.
 * Tools extend the AI's capabilities beyond text generation, allowing it to
 * execute code, interact with external systems, and perform actions.
 *
 * ## Adding New Tools
 *
 * As capabilities grow, add new tools to the `peterbotTools` object:
 *
 * ```typescript
 * export const peterbotTools = {
 *   runCode, // Existing tool
 *   newTool: tool({
 *     description: "What this tool does...",
 *     parameters: z.object({ ... }),
 *     execute: async (params) => { ... },
 *   }),
 * };
 * ```
 */

import { tool } from "ai";
import { z } from "zod";
import { runInSandbox } from "../worker/e2b.js";

/**
 * Tool for executing Python code in a secure cloud sandbox.
 *
 * This tool allows Claude to run Python code for:
 * - Data analysis and visualization
 * - File creation and manipulation
 * - Web scraping and API calls
 * - Mathematical calculations
 * - Any other computational tasks
 *
 * The code runs in an ephemeral E2B sandbox that automatically
 * cleans up after execution, ensuring security and isolation.
 */
const runCode = tool({
  description:
    "Execute Python code in a secure cloud sandbox. Use this for data analysis, " +
    "file creation, web scraping, calculations, or any computational tasks. " +
    "The sandbox is ephemeral and automatically cleaned up after execution.",
  parameters: z.object({
    code: z
      .string()
      .describe("The Python code to execute in the sandbox"),
    reasoning: z
      .string()
      .describe(
        "Brief explanation of why this code is needed and what it will accomplish. " +
          "This helps with debugging and understanding the decision-making process."
      ),
  }),
  execute: async ({ code, reasoning }) => {
    // Log the reasoning for observability
    console.log(`[AI Tool] runCode invoked: ${reasoning}`);

    // Execute the code in the sandbox
    const result = await runInSandbox(code);

    return result;
  },
});

/**
 * Exported tools object containing all available AI tools.
 *
 * Pass this to `generateText()` or `streamText()` from the AI SDK
 * to enable tool calling capabilities.
 *
 * @example
 * ```typescript
 * import { generateText } from "ai";
 * import { getModel } from "./client.js";
 * import { peterbotTools } from "./tools.js";
 *
 * const result = await generateText({
 *   model: getModel(),
 *   tools: peterbotTools,
 *   prompt: "Analyze this data and create a visualization",
 * });
 * ```
 */
export const peterbotTools = {
  runCode,
};
