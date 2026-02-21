/**
 * Provider Factory Module
 *
 * DB-first AI provider factory - single resolution point for all AI model instances.
 * Implements a resolution chain: preferred param → config.primary → fallback chain → env vars.
 *
 * ## Resolution Logic
 *
 * 1. Use preferred provider if specified
 * 2. Read provider.primary from config (default: anthropic)
 * 3. Query api_keys for valid keys for that provider
 * 4. Walk provider.fallback_chain if no valid key found
 * 5. Fall back to environment variables as last resort
 * 6. Throw descriptive error if no key available
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { zai } from "zhipu-ai-provider";
import { eq, and, asc } from "drizzle-orm";
import type { LanguageModel } from "ai";
import { db } from "../db/index.js";
import { apiKeys } from "../features/settings/schema.js";
import { getConfig } from "../features/compaction/repository.js";
import { decrypt } from "../shared/encryption.js";

/**
 * Supported AI provider identifiers.
 */
export type Provider = "anthropic" | "google" | "zai" | "moonshot";

/**
 * Default model IDs for each provider.
 */
const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  google: "gemini-2.5-flash",
  zai: "glm-5",
  moonshot: "moonshot-v1-8k",
};

/**
 * Environment variable names for each provider.
 */
const ENV_VAR_NAMES: Record<Provider, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
};

/**
 * Create a model instance for a specific provider with the given API key.
 *
 * @param provider - The provider identifier
 * @param apiKey - The decrypted API key
 * @returns The configured LanguageModel instance
 */
async function createModelForProvider(
  provider: Provider,
  apiKey: string
): Promise<LanguageModel> {
  // Get model ID from config or use default
  const modelConfig = await getConfig(db, `provider.model.${provider}`);
  const modelId = modelConfig?.value ?? DEFAULT_MODELS[provider];

  switch (provider) {
    case "anthropic": {
      const providerInstance = createAnthropic({ apiKey });
      return providerInstance(modelId);
    }

    case "google": {
      const providerInstance = createGoogleGenerativeAI({ apiKey });
      return providerInstance(modelId);
    }

    case "zai": {
      // z.ai uses a different pattern - it returns a model directly
      return zai(modelId, { apiKey, userId: "peterbot-user" });
    }

    case "moonshot": {
      const providerInstance = createOpenAI({
        baseURL: "https://api.moonshot.cn/v1",
        apiKey,
      });
      return providerInstance(modelId);
    }

    default: {
      // This should never happen due to TypeScript type checking
      throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

/**
 * Query the database for a valid API key for the given provider.
 *
 * @param provider - The provider to query for
 * @returns The encrypted key record or undefined if not found
 */
async function queryDatabaseKey(
  provider: Provider
): Promise<{ encryptedKey: string; iv: string } | undefined> {
  const results = await db
    .select({
      encryptedKey: apiKeys.encryptedKey,
      iv: apiKeys.iv,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.provider, provider), eq(apiKeys.isValid, true)))
    .orderBy(asc(apiKeys.createdAt))
    .limit(1);

  return results[0];
}

/**
 * Try to get an API key from environment variables.
 *
 * @param provider - The provider to get key for
 * @returns The API key or undefined if not set
 */
function getEnvKey(provider: Provider): string | undefined {
  const envVar = ENV_VAR_NAMES[provider];
  const key = process.env[envVar];
  return key && key.trim() !== "" ? key : undefined;
}

/**
 * Get the primary provider from config or use default.
 *
 * @returns The primary provider identifier
 */
async function getPrimaryProvider(): Promise<Provider> {
  const config = await getConfig(db, "provider.primary");
  const provider = config?.value ?? "anthropic";

  // Validate the provider is supported
  if (["anthropic", "google", "zai", "moonshot"].includes(provider)) {
    return provider as Provider;
  }

  return "anthropic";
}

/**
 * Get the fallback chain from config.
 *
 * @returns Array of provider identifiers to try as fallbacks
 */
async function getFallbackChain(): Promise<Provider[]> {
  const config = await getConfig(db, "provider.fallback_chain");

  if (!config?.value) {
    return ["google", "zai", "moonshot"];
  }

  try {
    const chain = JSON.parse(config.value) as string[];
    return chain.filter((p): p is Provider =>
      ["anthropic", "google", "zai", "moonshot"].includes(p)
    );
  } catch {
    return ["google", "zai", "moonshot"];
  }
}

/**
 * Get a configured AI model instance.
 *
 * Resolution order:
 * 1. Use preferred provider if specified
 * 2. Read provider.primary from config (default: anthropic)
 * 3. Query api_keys for valid keys for that provider
 * 4. Walk provider.fallback_chain if no valid key found
 * 5. Fall back to environment variables as last resort
 * 6. Throw descriptive error if no key available
 *
 * @param preferred - Optional preferred provider to use
 * @returns Promise resolving to the configured LanguageModel
 * @throws Error if no valid API key is available
 */
export async function getModel(preferred?: string): Promise<LanguageModel> {
  // Determine the primary provider to try
  const primaryProvider = preferred
    ? (preferred as Provider)
    : await getPrimaryProvider();

  // Build the resolution order: primary + fallback chain (excluding primary if present)
  const fallbackChain = await getFallbackChain();
  const resolutionOrder: Provider[] = [primaryProvider];

  for (const provider of fallbackChain) {
    if (!resolutionOrder.includes(provider)) {
      resolutionOrder.push(provider);
    }
  }

  // Try each provider in order
  for (const provider of resolutionOrder) {
    // 1. Try database key
    const dbKey = await queryDatabaseKey(provider);
    if (dbKey) {
      try {
        const plainKey = decrypt(dbKey.encryptedKey, dbKey.iv);
        return await createModelForProvider(provider, plainKey);
      } catch (error) {
        console.warn(
          `[ProviderFactory] Failed to decrypt key for ${provider}:`,
          error instanceof Error ? error.message : String(error)
        );
        // Continue to next provider
      }
    }

    // 2. Try environment variable
    const envKey = getEnvKey(provider);
    if (envKey) {
      return await createModelForProvider(provider, envKey);
    }
  }

  // No valid key found - throw descriptive error
  const triedProviders = resolutionOrder.join(", ");
  const envVarList = Object.values(ENV_VAR_NAMES).join(", ");

  throw new Error(
    `No valid API key found for any AI provider. ` +
      `Tried providers: ${triedProviders}. ` +
      `Please either:\n` +
      `1. Add an API key via the Settings UI (dashboard), or\n` +
      `2. Set one of these environment variables: ${envVarList}\n` +
      `Get keys at:\n` +
      `  - Anthropic: https://console.anthropic.com\n` +
      `  - Google: https://aistudio.google.com/app/apikey\n` +
      `  - Z.ai: https://z.ai\n` +
      `  - Moonshot: https://platform.moonshot.cn`
  );
}
