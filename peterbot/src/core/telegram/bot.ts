import { Bot } from "grammy";
import { setupHandlers } from "./handlers";

/**
 * Bot singleton instance.
 *
 * This module implements the singleton pattern for the Telegram bot,
 * ensuring only one bot instance exists throughout the application lifecycle.
 */

/** Module-level bot instance (null until initialized) */
let bot: Bot | null = null;

/**
 * Get the bot singleton instance.
 *
 * Creates the bot on first call, reuses existing instance on subsequent calls.
 *
 * @returns The configured Bot instance with all handlers registered
 * @throws Error if TELEGRAM_BOT_TOKEN is not set in environment
 *
 * @example
 * ```typescript
 * const bot = getBot();
 * await bot.start();
 * ```
 */
export function getBot(): Bot {
  if (bot === null) {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not set in .env");
    }

    bot = new Bot(token);
    setupHandlers(bot);
  }

  return bot;
}
