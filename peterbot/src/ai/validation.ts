/**
 * API Key Validation Module
 *
 * Provides per-provider API key validation through lightweight test calls.
 * Each provider has a specific validation strategy appropriate to its API.
 */

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { zai } from "zhipu-ai-provider";

/**
 * Validation result for an API key.
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an Anthropic API key.
 *
 * Uses the models endpoint to verify key validity.
 *
 * @param plainKey - The plain text API key
 * @returns Validation result
 */
async function validateAnthropicKey(plainKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": plainKey,
        "anthropic-version": "2023-06-01",
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorText = await response.text();
    return {
      valid: false,
      error: `Anthropic API returned ${response.status}: ${errorText}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate Anthropic key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate a Google AI API key.
 *
 * Uses a minimal generateText call to verify key validity.
 *
 * @param plainKey - The plain text API key
 * @returns Validation result
 */
async function validateGoogleKey(plainKey: string): Promise<ValidationResult> {
  try {
    const provider = createGoogleGenerativeAI({ apiKey: plainKey });
    // Minimal test call with maxTokens: 1 to minimize cost
    await generateText({
      model: provider("gemini-2.5-flash"),
      prompt: "Hi",
      maxTokens: 1,
    });
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate Google key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate a Z.ai API key.
 *
 * Uses a minimal generateText call to verify key validity.
 *
 * @param plainKey - The plain text API key
 * @returns Validation result
 */
async function validateZaiKey(plainKey: string): Promise<ValidationResult> {
  try {
    const model = zai("glm-5", { apiKey: plainKey, userId: "peterbot-validation" });
    // Minimal test call with maxTokens: 1 to minimize cost
    await generateText({
      model,
      prompt: "Hi",
      maxTokens: 1,
    });
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate Z.ai key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate a Moonshot API key.
 *
 * Uses the models endpoint to verify key validity.
 *
 * @param plainKey - The plain text API key
 * @returns Validation result
 */
async function validateMoonshotKey(plainKey: string): Promise<ValidationResult> {
  try {
    const response = await fetch("https://api.moonshot.cn/v1/models", {
      headers: {
        Authorization: `Bearer ${plainKey}`,
      },
    });

    if (response.ok) {
      return { valid: true };
    }

    const errorText = await response.text();
    return {
      valid: false,
      error: `Moonshot API returned ${response.status}: ${errorText}`,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate Moonshot key: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Validate an API key for the specified provider.
 *
 * Each provider has a specific validation strategy:
 * - anthropic: GET /v1/models endpoint check
 * - google: Minimal generateText call (1 token max)
 * - zai: Minimal generateText call (1 token max)
 * - moonshot: GET /v1/models endpoint check
 *
 * @param provider - The provider identifier (anthropic, google, zai, moonshot)
 * @param plainKey - The plain text API key to validate
 * @returns Promise resolving to validation result
 */
export async function validateKey(
  provider: string,
  plainKey: string
): Promise<ValidationResult> {
  switch (provider) {
    case "anthropic":
      return validateAnthropicKey(plainKey);

    case "google":
      return validateGoogleKey(plainKey);

    case "zai":
      return validateZaiKey(plainKey);

    case "moonshot":
      return validateMoonshotKey(plainKey);

    default:
      return {
        valid: false,
        error: `Unknown provider: ${provider}. Supported providers: anthropic, google, zai, moonshot`,
      };
  }
}
