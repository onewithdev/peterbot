/**
 * Agent Model Factory
 *
 * Provides model instances for different AI providers based on configuration.
 * Supports Claude (Anthropic), Gemini (Google), GLM-5 (Zhipu/Z.ai), and Kimi K2.5 (Moonshot).
 *
 * ## Resolution Strategy
 *
 * This module delegates to the provider factory which implements:
 * - DB-first provider resolution from api_keys table
 * - Fallback chain walking
 * - Environment variable fallback
 *
 * Model name mapping:
 * - "claude" → anthropic provider
 * - "gemini" → google provider
 * - "glm-5" → zai provider
 * - "kimi-k2.5" → moonshot provider
 * - default → uses provider.primary from config
 */

import type { LanguageModel } from "ai";
import { getModel } from "../../ai/provider-factory.js";

export interface AgentModelResult {
  model: LanguageModel;
  usedFallbackModel?: string;
}

/**
 * Get an AI model instance based on the requested agent name.
 *
 * Supports:
 * - 'claude': Anthropic Claude via @ai-sdk/anthropic
 * - 'gemini': Google Gemini via @ai-sdk/google
 * - 'glm-5': Zhipu GLM models via zhipu-ai-provider (z.ai)
 * - 'kimi-k2.5': Moonshot models via @ai-sdk/openai
 *
 * Falls back to the provider chain configured in the database if the
 * requested provider is not configured.
 *
 * @param name - The agent model name ('claude', 'gemini', 'glm-5', 'kimi-k2.5')
 * @returns Promise resolving to the model instance
 * @throws Error if no API key is available for any provider
 */
export async function getAgentModel(name: string): Promise<AgentModelResult> {
  switch (name) {
    case "claude": {
      // Request anthropic provider specifically
      const model = await getModel("anthropic");
      return { model };
    }

    case "gemini": {
      // Request google provider specifically
      const model = await getModel("google");
      return { model };
    }

    case "glm-5": {
      // Request zai provider specifically
      const model = await getModel("zai");
      return { model };
    }

    case "kimi-k2.5": {
      // Request moonshot provider specifically
      const model = await getModel("moonshot");
      return { model };
    }

    default: {
      // Unknown model name - use factory default (provider.primary from config)
      const model = await getModel();
      return { model };
    }
  }
}
