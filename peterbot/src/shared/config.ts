/**
 * Shared Configuration Module
 *
 * Centralized environment variable validation and configuration.
 * Provides type-safe access to required and optional configuration values.
 *
 * ## Usage
 *
 * ```typescript
 * import { config, requireEnv } from "../shared/config.js";
 *
 * // Use the pre-validated config object
 * const apiKey = config.anthropicApiKey;
 *
 * // Or validate individual variables
 * const customKey = requireEnv("CUSTOM_KEY");
 * ```
 */

/**
 * Require an environment variable to be set.
 *
 * Throws a descriptive error if the variable is missing,
 * referencing the .env.example file for guidance.
 *
 * @param key - The environment variable name
 * @returns The environment variable value
 * @throws Error if the variable is not set
 */
export function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
        `Please set it in your .env file.\n` +
        `See .env.example for reference.`
    );
  }

  return value;
}

/**
 * Parse a numeric environment variable.
 *
 * Returns the default value if the variable is not set or invalid.
 *
 * @param key - The environment variable name
 * @param defaultValue - The default value to use
 * @returns The parsed number or default value
 */
function parseNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];

  if (!value) {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    console.warn(`[config] Invalid number for ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * Get an optional environment variable with a default value.
 *
 * @param key - The environment variable name
 * @param defaultValue - The default value to use if not set
 * @returns The environment variable value or default
 */
export function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Application configuration object.
 *
 * All properties are validated at startup to fail fast
 * if required configuration is missing.
 */
export const config = {
  /**
   * Server port number.
   * Defaults to 3000 if not specified.
   */
  port: parseNumberEnv("PORT", 3000),

  /**
   * Telegram Bot Token from @BotFather.
   * Required for bot functionality.
   */
  get telegramBotToken(): string {
    return requireEnv("TELEGRAM_BOT_TOKEN");
  },

  /**
   * Authorized Telegram Chat ID.
   * Used for single-user auth guard.
   * Required for bot functionality.
   */
  get telegramChatId(): string {
    return requireEnv("TELEGRAM_CHAT_ID");
  },

  /**
   * Google AI API Key (for Gemini).
   * Required for AI functionality.
   */
  get googleApiKey(): string {
    return requireEnv("GOOGLE_API_KEY");
  },

  /**
   * E2B Sandbox API Key.
   * Required for code execution in sandbox.
   */
  get e2bApiKey(): string {
    return requireEnv("E2B_API_KEY");
  },

  /**
   * SQLite database file path.
   * Defaults to ./data/jobs.db
   */
  sqliteDbPath: getOptionalEnv("SQLITE_DB_PATH", "./data/jobs.db"),

  /**
   * AI Model identifier.
   * Defaults to claude-sonnet-4-5-20250929
   */
  get model(): string {
    return getOptionalEnv("MODEL", "claude-sonnet-4-5-20250929");
  },

  /**
   * Dashboard password for web UI authentication.
   * Required for accessing protected dashboard routes.
   */
  get dashboardPassword(): string {
    return requireEnv("DASHBOARD_PASSWORD");
  },
} as const;
