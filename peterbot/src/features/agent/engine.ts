/**
 * Agent Engine Module
 *
 * Core message processing engine for the agent-based chat system.
 * Handles conversation history, tool calling, job dispatch, and response generation.
 */

import { generateText } from "ai";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { db as defaultDb } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import { getConfig } from "../compaction/repository.js";
import { getMessages, saveMessage } from "../chat/repository.js";
import { createJob } from "../jobs/repository.js";
import { buildSystemPrompt } from "../../worker/worker.js";
import { peterbotTools } from "../../ai/tools.js";
import { getAgentModel } from "./model.js";
import { createDispatchTaskTool } from "./tools.js";

export interface ProcessMessageInput {
  message: string;
  chatId: string;
  source: "telegram" | "web";
}

export interface ProcessMessageResult {
  content: string;
  jobId?: string;
  usedFallbackModel?: string;
}

// Timeout for inline processing (30 seconds)
const INLINE_TIMEOUT_MS = 30000;

/**
 * Process a user message through the agent engine.
 *
 * This function orchestrates the complete message processing flow:
 * 1. Reads agent configuration (model selection)
 * 2. Loads conversation history
 * 3. Saves the incoming user message
 * 4. Builds the system prompt with context
 * 5. Calls the AI with available tools
 * 6. Handles timeout by dispatching as a background job
 * 7. Saves the assistant's response
 * 8. Returns the result with optional job ID if a task was dispatched
 *
 * @param input - The message input containing message text, chat ID, and source
 * @returns Promise resolving to the processing result
 */
export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult> {
  const { message, chatId, source } = input;

  // 1. Read config for agent model selection
  const modelConfig = await getConfig(defaultDb, "agent.model");
  const modelName = modelConfig?.value ?? "gemini";

  // 2. Get the AI model (with fallback handling)
  const { model, usedFallbackModel } = getAgentModel(modelName);

  // 3. Load conversation history (last 20 messages)
  const historyMessages = await getMessages(defaultDb, chatId, 20);
  const history = historyMessages.map((msg) => ({
    role: msg.direction === "in" ? ("user" as const) : ("assistant" as const),
    content: msg.content,
  }));

  // 4. Save user message (skip for web source - already saved by route)
  if (source !== "web") {
    await saveMessage(defaultDb, {
      chatId,
      direction: "in",
      content: message,
      sender: "user",
    });
  }

  // 5. Build system prompt
  const systemPrompt = await buildSystemPrompt(chatId);

  // 6. Build tools (including the dispatch_task tool with captured chatId)
  const tools = {
    runCode: peterbotTools.runCode,
    executeComposioAction: peterbotTools.executeComposioAction,
    dispatch_task: createDispatchTaskTool(chatId),
  };

  // 7. Call generateText with timeout handling
  let content: string;
  let jobId: string | undefined;

  try {
    const result = await Promise.race([
      generateText({
        model,
        system: systemPrompt,
        messages:
          source === "web"
            ? history
            : [...history, { role: "user" as const, content: message }],
        tools,
        maxSteps: 10,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("TIMEOUT")),
          INLINE_TIMEOUT_MS
        )
      ),
    ]);

    // Extract text content from result
    content = result.text;

    // Check if dispatch_task was called and extract jobId
    // The AI SDK returns toolResults at the top level of the result
    if (result.toolResults && result.toolResults.length > 0) {
      for (const toolResult of result.toolResults) {
        if (
          toolResult.toolName === "dispatch_task" &&
          toolResult.result &&
          typeof toolResult.result === "object" &&
          "jobId" in toolResult.result
        ) {
          jobId = toolResult.result.jobId as string;
          break;
        }
      }
    }
  } catch (error) {
    // Handle timeout - dispatch as background job
    if (error instanceof Error && error.message === "TIMEOUT") {
      const job = await createJob(defaultDb, {
        type: "task",
        input: message,
        chatId,
      });
      jobId = job.id;
      content = `⚙️ Too slow to run inline → started a job instead. Job #${job.id.slice(0, 8)} · Check the Job Monitor for progress.`;
    } else {
      // Re-throw other errors
      throw error;
    }
  }

  // 8. Save assistant message (skip for web source - route will save it)
  if (source !== "web") {
    await saveMessage(defaultDb, {
      chatId,
      direction: "out",
      content,
      sender: "bot",
      jobId,
    });
  }

  // 9. Return result
  return {
    content,
    jobId,
    usedFallbackModel,
  };
}
