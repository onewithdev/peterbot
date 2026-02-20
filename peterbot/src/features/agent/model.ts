/**
 * Agent Model Factory
 *
 * Provides model instances for different AI providers based on configuration.
 * Supports Gemini (Google), GLM-5 (Zhipu/Z.ai), and Kimi K2.5 (Moonshot).
 * Implements fallback logic when provider credentials are not configured.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { zai } from "zhipu-ai-provider";
import type { LanguageModel } from "ai";

export interface AgentModelResult {
  model: LanguageModel;
  usedFallbackModel?: string;
}

/**
 * Get an AI model instance based on the requested agent name.
 *
 * Supports:
 * - 'gemini': Google Gemini via @ai-sdk/google (default fallback)
 * - 'glm-5': Zhipu GLM models via zhipu-ai-provider (z.ai)
 * - 'kimi-k2.5': Moonshot models via @ai-sdk/openai
 *
 * Falls back to Gemini if the requested provider is not configured.
 *
 * @param name - The agent model name ('gemini', 'glm-5', 'kimi-k2.5')
 * @returns Object containing the model instance and optional fallback notice
 */
export function getAgentModel(name: string): AgentModelResult {
  switch (name) {
    case "gemini": {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        throw new Error(
          "GOOGLE_API_KEY is required for Gemini. " +
            "Set it in your .env file. " +
            "Get a key at: https://aistudio.google.com/app/apikey"
        );
      }
      const provider = createGoogleGenerativeAI({ apiKey });
      return { model: provider("gemini-2.5-flash") };
    }

    case "glm-5": {
      const apiKey = process.env.ZAI_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        // Fallback to Gemini
        const googleApiKey = process.env.GOOGLE_API_KEY;
        if (!googleApiKey || googleApiKey.trim() === "") {
          throw new Error(
            "Neither ZAI_API_KEY nor GOOGLE_API_KEY is configured. " +
              "At least one provider key is required."
          );
        }
        const provider = createGoogleGenerativeAI({ apiKey: googleApiKey });
        return {
          model: provider("gemini-2.5-flash"),
          usedFallbackModel: "GLM-5 not configured → used Gemini",
        };
      }
      // Use z.ai provider with GLM-5 model
      return { model: zai("glm-5", { userId: "peterbot-user" }) };
    }

    case "kimi-k2.5": {
      const apiKey = process.env.MOONSHOT_API_KEY;
      if (!apiKey || apiKey.trim() === "") {
        // Fallback to Gemini
        const googleApiKey = process.env.GOOGLE_API_KEY;
        if (!googleApiKey || googleApiKey.trim() === "") {
          throw new Error(
            "Neither MOONSHOT_API_KEY nor GOOGLE_API_KEY is configured. " +
              "At least one provider key is required."
          );
        }
        const provider = createGoogleGenerativeAI({ apiKey: googleApiKey });
        return {
          model: provider("gemini-2.5-flash"),
          usedFallbackModel: "Kimi K2.5 not configured → used Gemini",
        };
      }
      // Use Moonshot API via OpenAI-compatible interface
      const provider = createOpenAI({
        baseURL: "https://api.moonshot.cn/v1",
        apiKey,
      });
      return { model: provider("moonshot-v1-8k") };
    }

    default: {
      // Unknown model name - fall back to Gemini silently
      const googleApiKey = process.env.GOOGLE_API_KEY;
      if (!googleApiKey || googleApiKey.trim() === "") {
        throw new Error(
          "GOOGLE_API_KEY is required for fallback. " +
            "Set it in your .env file."
        );
      }
      const provider = createGoogleGenerativeAI({ apiKey: googleApiKey });
      return { model: provider("gemini-2.5-flash") };
    }
  }
}
