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
 * 1. Install the new provider SDK: `npm install @ai-sdk/google`
 * 2. Replace the import below: `import { createGoogleGenerativeAI } from '@ai-sdk/google'`
 * 3. Update the `getModel()` function to use the new provider's model
 * 4. Set the appropriate API key environment variable
 *
 * The rest of your application code remains unchanged.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getOptionalEnv } from "../shared/config.js";

/**
 * Require the Google API key to be set.
 * Validates at call time to support dynamic configuration in tests.
 *
 * @throws Error if GOOGLE_API_KEY is not set
 * @returns The API key value
 */
function requireGoogleApiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "GOOGLE_API_KEY is required. " +
        "Set it in your .env file. " +
        "Get a key at: https://aistudio.google.com/app/apikey"
    );
  }
  return key;
}

/**
 * Get the configured AI model instance.
 *
 * Uses Google's Gemini models via the Vercel AI SDK.
 *
 * @returns The configured AI model ready for text generation
 * @throws Error if GOOGLE_API_KEY is not set
 */
export function getModel() {
  const apiKey = requireGoogleApiKey();
  const modelId = getOptionalEnv("MODEL", "gemini-2.5-flash");

  // Create Google provider with API key
  const provider = createGoogleGenerativeAI({
    apiKey,
  });

  return provider(modelId);
}
