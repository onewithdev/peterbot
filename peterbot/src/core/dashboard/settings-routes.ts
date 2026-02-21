import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { passwordAuth } from "./auth.js";
import {
  createApiKey,
  getAllApiKeys,
  getApiKeyById,
  deleteApiKey,
  markApiKeyValid,
  markApiKeyInvalid,
} from "../../features/settings/repository.js";
import { getConfig, setConfig } from "../../features/compaction/repository.js";
import { validateKey } from "../../ai/validation.js";
import { decrypt } from "../../shared/encryption.js";

/**
 * Provider enum values.
 */
const PROVIDERS = ["anthropic", "google", "zai", "moonshot"] as const;

/**
 * Zod schema for adding a new API key.
 */
const AddKeySchema = z.object({
  provider: z.enum(PROVIDERS),
  key: z.string().min(1),
  label: z.string().optional(),
});

/**
 * Zod schema for key ID parameter.
 */
const KeyIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Zod schema for updating provider configuration.
 */
const UpdateProvidersSchema = z.object({
  primary: z.enum(PROVIDERS),
  fallback_chain: z.array(z.enum(PROVIDERS)),
});

/**
 * Type for provider keys grouped by provider.
 */
type Provider = (typeof PROVIDERS)[number];
type MaskedKey = {
  id: string;
  provider: Provider;
  maskedKey: string;
  label: string | null;
  isValid: boolean;
  lastError: string | null;
  validatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Settings routes for dashboard API.
 *
 * Provides endpoints for managing API keys and provider configuration.
 */
export const settingsRoutes = new Hono()
  // ==========================================================================
  // GET /keys - List all API keys grouped by provider
  // ==========================================================================
  .get("/keys", passwordAuth, async (c) => {
    const keys = await getAllApiKeys(undefined);

    // Group keys by provider
    const grouped = keys.reduce<Record<Provider, MaskedKey[]>>((acc, key) => {
      if (!acc[key.provider]) {
        acc[key.provider] = [];
      }
      acc[key.provider].push(key as MaskedKey);
      return acc;
    }, { anthropic: [], google: [], zai: [], moonshot: [] });

    return c.json({ keys: grouped });
  })

  // ==========================================================================
  // POST /keys - Add a new API key
  // ==========================================================================
  .post("/keys", passwordAuth, zValidator("json", AddKeySchema), async (c) => {
    const { provider, key, label } = c.req.valid("json");

    const maskedRow = await createApiKey(undefined, {
      provider,
      plainKey: key,
      label,
    });

    return c.json({ key: maskedRow });
  })

  // ==========================================================================
  // POST /keys/:id/test - Test an API key
  // ==========================================================================
  .post(
    "/keys/:id/test",
    passwordAuth,
    zValidator("param", KeyIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      const apiKey = await getApiKeyById(undefined, id);
      if (!apiKey) {
        return c.json(
          {
            error: "Not Found",
            message: `API key ${id} not found`,
          },
          404
        );
      }

      try {
        const plainKey = decrypt(apiKey.encryptedKey, apiKey.iv);
        const result = await validateKey(apiKey.provider, plainKey);

        if (result.valid) {
          await markApiKeyValid(undefined, id);
        } else {
          await markApiKeyInvalid(undefined, id, result.error ?? "Validation failed");
        }

        return c.json(result);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        await markApiKeyInvalid(undefined, id, errorMessage);
        return c.json({ valid: false, error: errorMessage });
      }
    }
  )

  // ==========================================================================
  // DELETE /keys/:id - Delete an API key
  // ==========================================================================
  .delete(
    "/keys/:id",
    passwordAuth,
    zValidator("param", KeyIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      const apiKey = await getApiKeyById(undefined, id);
      if (!apiKey) {
        return c.json(
          {
            error: "Not Found",
            message: `API key ${id} not found`,
          },
          404
        );
      }

      await deleteApiKey(undefined, id);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // GET /providers - Get provider configuration
  // ==========================================================================
  .get("/providers", passwordAuth, async (c) => {
    const [primary, fallbackChain, anthropicModel, googleModel] =
      await Promise.all([
        getConfig(undefined, "provider.primary"),
        getConfig(undefined, "provider.fallback_chain"),
        getConfig(undefined, "provider.model.anthropic"),
        getConfig(undefined, "provider.model.google"),
      ]);

    // Parse fallback chain from JSON string
    let fallbackChainParsed: Provider[] = [];
    if (fallbackChain?.value) {
      try {
        fallbackChainParsed = JSON.parse(fallbackChain.value) as Provider[];
      } catch {
        fallbackChainParsed = [];
      }
    }

    return c.json({
      primary: (primary?.value as Provider) ?? "anthropic",
      fallback_chain: fallbackChainParsed,
      models: {
        anthropic: anthropicModel?.value ?? null,
        google: googleModel?.value ?? null,
      },
    });
  })

  // ==========================================================================
  // PUT /providers - Update provider configuration
  // ==========================================================================
  .put(
    "/providers",
    passwordAuth,
    zValidator("json", UpdateProvidersSchema),
    async (c) => {
      const { primary, fallback_chain } = c.req.valid("json");

      // Guardrail: Check if primary has at least one valid key if changing
      const currentPrimary = await getConfig(undefined, "provider.primary");
      if (currentPrimary?.value !== primary) {
        const allKeys = await getAllApiKeys(undefined);
        const hasValidKey = allKeys.some(
          (key) => key.provider === primary && key.isValid
        );

        if (!hasValidKey) {
          return c.json(
            {
              error: "Bad Request",
              message: `No valid API key found for provider "${primary}". Please add and validate a key first.`,
            },
            400
          );
        }

        // Automatic fallback chain reordering:
        // - Remove new primary from chain
        // - Insert old primary as first fallback if not already present
        const oldPrimary = currentPrimary?.value as Provider | undefined;
        let newFallbackChain = fallback_chain.filter((p) => p !== primary);

        if (oldPrimary && oldPrimary !== primary && !newFallbackChain.includes(oldPrimary)) {
          newFallbackChain = [oldPrimary, ...newFallbackChain];
        }

        await setConfig(
          undefined,
          "provider.fallback_chain",
          JSON.stringify(newFallbackChain)
        );
      } else {
        // No primary change, just update the fallback chain as-is
        await setConfig(
          undefined,
          "provider.fallback_chain",
          JSON.stringify(fallback_chain)
        );
      }

      // Always update primary
      await setConfig(undefined, "provider.primary", primary);

      return c.json({ success: true });
    }
  );
