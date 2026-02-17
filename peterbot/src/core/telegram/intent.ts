/**
 * Intent Detection Module
 *
 * This module provides heuristic-based intent detection for classifying user
 * messages as either 'quick' (instant reply) or 'task' (background processing).
 *
 * ## Ejection Point 2: AI-Powered Intent Detection
 *
 * The current implementation uses a simple heuristic based on message length
 * and keyword matching. This is fast and works well for common cases, but
 * can be replaced with AI-powered detection for more sophisticated understanding:
 *
 * To upgrade to AI-powered intent detection:
 * 1. Import `generateText` from 'ai' and `getModel` from '../../ai/client'
 * 2. Replace `detectIntent` with an async function that calls the AI
 * 3. Update the system prompt to classify intents
 * 4. Update tests to handle async behavior
 *
 * Example AI-powered implementation:
 * ```typescript
 * export async function detectIntent(message: string): Promise<Intent> {
 *   const { text } = await generateText({
 *     model: getModel(),
 *     system: "Classify the user message as either 'quick' (casual chat, greetings, simple questions) or 'task' (requests requiring research, writing, analysis, or substantial work). Reply with only the word 'quick' or 'task'.",
 *     prompt: message,
 *   });
 *   return text.trim() as Intent;
 * }
 * ```
 */

/** Valid intent types for message classification */
export type Intent = "task" | "quick";

/**
 * Keywords that indicate a message is a task requiring background processing.
 * These suggest the user wants substantial work done (research, writing, etc.)
 */
export const TASK_KEYWORDS = [
  "research",
  "write",
  "analyze",
  "create",
  "build",
  "find",
  "summarize",
  "compile",
  "report",
  "draft",
  "generate",
  "make",
  "prepare",
  "search",
  "compare",
  "list",
  "collect",
  "gather",
  "extract",
  "translate",
];

/**
 * Detect the intent of a user message.
 *
 * Uses a heuristic approach:
 * - Returns 'task' if message length > 100 chars OR contains any task keyword
 * - Returns 'quick' otherwise (short casual messages)
 *
 * @param message - The user's message text
 * @returns The detected intent: 'task' or 'quick'
 */
export function detectIntent(message: string): Intent {
  const normalizedMessage = message.toLowerCase();

  // Check for task keywords
  const hasTaskKeyword = TASK_KEYWORDS.some((keyword) =>
    normalizedMessage.includes(keyword.toLowerCase())
  );

  // Long messages are likely tasks
  const isLongMessage = message.length > 100;

  if (hasTaskKeyword || isLongMessage) {
    return "task";
  }

  return "quick";
}
