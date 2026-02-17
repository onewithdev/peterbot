/**
 * AI Client Configuration Module
 *
 * This module provides a single point of configuration for the AI provider.
 * It implements the BYOK (Bring Your Own Key) pattern, allowing users to
 * use their own API keys for AI providers.
 *
 * ## Provider Ejection Pattern
 *
 * This file is the only place you need to modify when switching AI providers.
 * To swap providers (e.g., from Anthropic to OpenAI):
 *
 * 1. Install the new provider SDK: `npm install @ai-sdk/openai`
 * 2. Replace the import below: `import { createOpenAI } from '@ai-sdk/openai'`
 * 3. Update the `getModel()` function to use the new provider's model
 * 4. Set the appropriate API key environment variable
 *
 * The rest of your application code remains unchanged.
 */

import { createAnthropic } from "@ai-sdk/anthropic";

/**
 * Default model to use when no MODEL environment variable is set.
 * Using Claude Sonnet 4.5 for optimal balance of speed and capability.
 */
const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";

/**
 * Initialize the Anthropic client with API key from environment variables.
 * The client is created once and reused across the application.
 */
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Get the configured AI model instance.
 *
 * @returns The configured AI model ready for text generation
 * @throws Error if ANTHROPIC_API_KEY is not set
 */
export function getModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. Set it in your .env file or environment variables."
    );
  }

  const modelName = process.env.MODEL || DEFAULT_MODEL;

  return anthropic(modelName);
}
