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
import { checkBlocklist } from "../worker/worker.js";
import {
  executeAction,
  getConnectedApp,
} from "../features/integrations/service.js";

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

    // Check blocklist before execution
    const blockCheck = checkBlocklist(code);
    if (blockCheck.blocked) {
      console.log(`[AI Tool] Code blocked by blocklist: ${blockCheck.reason}`);
      return `Code execution blocked: ${blockCheck.reason}\n\nBlocked pattern detected in code.`;
    }

    // Execute the code in the sandbox
    const result = await runInSandbox(code);

    return result;
  },
});

/**
 * Tool for executing actions on connected external apps via Composio.
 *
 * This tool allows Claude to interact with connected integrations like
 * Gmail, GitHub, Google Drive, Notion, Google Calendar, and Linear.
 * Actions are executed on behalf of the user through OAuth connections.
 */
const executeComposioAction = tool({
  description:
    "Execute an action on a connected external app (Gmail, GitHub, Google Drive, Notion, " +
    "Google Calendar, Linear) via Composio. Use this to send emails, create issues, " +
    "manage calendar events, access files, and interact with external services.",
  parameters: z.object({
    provider: z
      .string()
      .describe("The app name (e.g., 'gmail', 'github', 'google-drive', 'notion', 'google-calendar', 'linear')"),
    action: z
      .string()
      .describe("The Composio action identifier (e.g., 'GMAIL_SEND_EMAIL', 'GITHUB_CREATE_ISSUE')"),
    params: z
      .record(z.unknown())
      .describe("Action parameters as a key-value object"),
    reasoning: z
      .string()
      .describe("Brief explanation of why this action is needed and what it will accomplish"),
  }),
  execute: async ({ provider, action, params, reasoning }) => {
    // Log the reasoning for observability
    console.log(`[AI Tool] executeComposioAction invoked: ${reasoning}`);

    // Check if app is connected
    const app = await getConnectedApp(undefined, provider);
    
    if (!app) {
      const providerDisplay = provider.charAt(0).toUpperCase() + provider.slice(1);
      return `I'd need ${providerDisplay} connected to do that. Go to the Integrations page in your dashboard to connect it.`;
    }

    // Check if enabled
    if (!app.enabled) {
      const providerDisplay = provider.charAt(0).toUpperCase() + provider.slice(1);
      return `${providerDisplay} is connected but currently disabled. Enable it in the Integrations page to use it.`;
    }

    // Execute the action
    const result = await executeAction(provider, action, params);

    if ("error" in result) {
      return `Failed to execute ${action}: ${result.message}`;
    }

    return result.data;
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
  executeComposioAction,
};
