import { InlineKeyboard } from "grammy";

/**
 * Context types for button generation
 */
export type ButtonContext = "task_completed" | "schedule_created" | "start";

/**
 * Configuration for a single button
 */
export interface ButtonConfig {
  label: string;
  callbackData: string;
}

/**
 * Data payload for task_completed context
 */
export interface TaskCompletedData {
  jobIdPrefix: string;
}

/**
 * Encode action and optional job ID prefix into callback data string.
 * Format: "action" or "action:jobIdPrefix"
 * Total length is kept ≤ 64 bytes (Telegram limit).
 *
 * @param action - The action identifier
 * @param jobIdPrefix - Optional job ID prefix to include
 * @returns Encoded callback data string
 */
export function encodeCallbackData(
  action: string,
  jobIdPrefix?: string
): string {
  if (jobIdPrefix) {
    const encoded = `${action}:${jobIdPrefix}`;
    // Telegram callback_data limit is 64 bytes
    if (encoded.length > 64) {
      throw new Error("Callback data exceeds 64 byte limit");
    }
    return encoded;
  }
  return action;
}

/**
 * Parse callback data string into action and optional job ID prefix.
 * Splits on the first ":" only.
 *
 * @param data - The callback data string
 * @returns Object with action and optional jobIdPrefix
 */
export function parseCallbackData(data: string): {
  action: string;
  jobIdPrefix?: string;
} {
  const colonIndex = data.indexOf(":");
  if (colonIndex === -1) {
    return { action: data };
  }
  return {
    action: data.slice(0, colonIndex),
    jobIdPrefix: data.slice(colonIndex + 1),
  };
}

/**
 * Check if a callback is expired based on message timestamp.
 * Callbacks expire after 5 minutes (300 seconds).
 *
 * @param messageDateSeconds - Unix timestamp of the message in seconds
 * @returns true if callback is expired (> 5 min old)
 */
export function isCallbackExpired(messageDateSeconds: number): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return nowSeconds - messageDateSeconds > 300;
}

/**
 * Get button configurations for a given context.
 *
 * @param context - The button context type
 * @param data - Optional data payload (required for task_completed context)
 * @returns Array of button configurations
 */
export function getButtonsForContext(
  context: ButtonContext,
  data?: TaskCompletedData
): ButtonConfig[] {
  switch (context) {
    case "task_completed":
      if (!data?.jobIdPrefix) {
        throw new Error("jobIdPrefix is required for task_completed context");
      }
      return [
        {
          label: "📅 Schedule this",
          callbackData: encodeCallbackData("schedule", data.jobIdPrefix),
        },
        {
          label: "💾 Save solution",
          callbackData: encodeCallbackData("save", data.jobIdPrefix),
        },
        {
          label: "❔ Help",
          callbackData: encodeCallbackData("help"),
        },
      ];

    case "schedule_created":
      return [
        {
          label: "📅 View all schedules",
          callbackData: encodeCallbackData("schedules"),
        },
        {
          label: "❔ Help",
          callbackData: encodeCallbackData("help"),
        },
      ];

    case "start":
      return [
        {
          label: "📅 View schedules",
          callbackData: encodeCallbackData("schedules"),
        },
        {
          label: "📚 View solutions",
          callbackData: encodeCallbackData("solutions"),
        },
        {
          label: "❔ Help",
          callbackData: encodeCallbackData("help"),
        },
      ];

    default:
      // Exhaustive check - should not reach here with valid ButtonContext
      throw new Error(`Unknown button context: ${context}`);
  }
}

/**
 * Build an InlineKeyboard from button configurations.
 *
 * @param buttons - Array of button configurations
 * @returns Grammy InlineKeyboard instance
 */
export function buildInlineKeyboard(buttons: ButtonConfig[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const button of buttons) {
    keyboard.text(button.label, button.callbackData);
  }
  return keyboard;
}
