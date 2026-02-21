/**
 * AI Client Configuration Module
 *
 * This module provides a single point of configuration for the AI provider.
 * It implements the BYOK (Bring Your Own Key) pattern, allowing users to
 * use their own API keys for AI providers.
 *
 * ## Provider Ejection Pattern
 *
 * This file delegates to the provider factory which implements DB-first
 * provider resolution. The factory handles:
 * - Reading provider configuration from the database
 * - Decrypting API keys from the api_keys table
 * - Implementing fallback chain logic
 * - Environment variable fallback
 *
 * ## Migration Note
 *
 * The synchronous getModel() function is now async to support database lookups.
 * All callers must await this function.
 */

import type { LanguageModel } from "ai";
import { getModel as factoryGetModel } from "./provider-factory.js";

/**
 * Get the configured AI model instance.
 *
 * Delegates to the provider factory for DB-first provider resolution.
 * The factory implements the following resolution order:
 * 1. Use provider.primary from config (default: anthropic)
 * 2. Query api_keys table for valid encrypted keys
 * 3. Walk provider.fallback_chain from config
 * 4. Fall back to environment variables
 * 5. Throw descriptive error if no key available
 *
 * @returns Promise resolving to the configured AI model
 * @throws Error if no API key is available for any provider
 */
export async function getModel(): Promise<LanguageModel> {
  return factoryGetModel();
}
