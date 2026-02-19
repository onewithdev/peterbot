import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { passwordAuth } from "./auth.js";
import {
  getConnectedApps,
  upsertConnection,
  toggleConnectionEnabled,
  removeConnection,
} from "../../features/integrations/repository.js";
import {
  isConfigured,
  getOAuthUrl,
  validateAndConsumeState,
  checkConnection,
  revokeConnection,
} from "../../features/integrations/service.js";

/**
 * Provider parameter schema for routes with :provider.
 */
const ProviderParamSchema = z.object({
  provider: z.string().min(1),
});

/**
 * Known providers with their display info.
 */
const KNOWN_PROVIDERS = [
  { provider: "gmail", label: "Gmail", icon: "mail" },
  { provider: "github", label: "GitHub", icon: "github" },
  { provider: "google-drive", label: "Google Drive", icon: "folder" },
  { provider: "notion", label: "Notion", icon: "file-text" },
  { provider: "google-calendar", label: "Google Calendar", icon: "calendar" },
  { provider: "linear", label: "Linear", icon: "check-square" },
];

/**
 * Integrations routes for dashboard API.
 *
 * Provides endpoints for managing external app integrations via Composio.
 */
export const integrationsRoutes = new Hono()
  // ==========================================================================
  // GET / - List all integrations
  // ==========================================================================
  .get("/", passwordAuth, async (c) => {
    if (!isConfigured()) {
      return c.json({
        configured: false,
        providers: [],
      });
    }

    const dbApps = await getConnectedApps();
    const dbAppsMap = new Map(dbApps.map((app) => [app.provider, app]));

    // Merge with known providers list
    const providers = KNOWN_PROVIDERS.map((known) => {
      const app = dbAppsMap.get(known.provider);
      return {
        ...known,
        connected: !!app,
        app: app || null,
      };
    });

    return c.json({
      configured: true,
      providers,
    });
  })

  // ==========================================================================
  // POST /:provider/connect - Initiate OAuth flow
  // ==========================================================================
  .post(
    "/:provider/connect",
    passwordAuth,
    zValidator("param", ProviderParamSchema),
    async (c) => {
      const { provider } = c.req.valid("param");

      const result = await getOAuthUrl(provider);

      if ("error" in result) {
        if (result.error === "not_configured") {
          return c.json(
            {
              error: "Service Unavailable",
              message: result.message,
            },
            503
          );
        }
        return c.json(
          {
            error: "Internal Server Error",
            message: result.message,
          },
          500
        );
      }

      return c.json({
        redirectUrl: result.redirectUrl,
        state: result.state,
      });
    }
  )

  // ==========================================================================
  // GET /callback - OAuth callback (public, no auth required)
  // ==========================================================================
  .get(
    "/callback",
    zValidator(
      "query",
      z.object({
        state: z.string(),
        provider: z.string(),
      })
    ),
    async (c) => {
      const { state, provider } = c.req.valid("query");

      // Validate state token
      const validatedProvider = validateAndConsumeState(state);
      if (!validatedProvider) {
        return c.redirect("/integrations?error=invalid_state");
      }

      // Verify provider matches
      if (validatedProvider !== provider) {
        return c.redirect("/integrations?error=invalid_state");
      }

      // Check connection status from Composio
      const connectionResult = await checkConnection(provider);

      if ("error" in connectionResult) {
        return c.redirect(`/integrations?error=connection_failed`);
      }

      // Verify connection is actually connected
      if (connectionResult.connected !== true) {
        return c.redirect(`/integrations?error=connection_failed`);
      }

      // Upsert connection in DB
      await upsertConnection(undefined, {
        provider,
        composioEntityId: "peterbot-user",
        accountEmail: connectionResult.accountEmail,
        enabled: true,
      });

      return c.redirect(`/integrations?connected=${provider}`);
    }
  )

  // ==========================================================================
  // PATCH /:provider/toggle - Enable/disable integration
  // ==========================================================================
  .patch(
    "/:provider/toggle",
    passwordAuth,
    zValidator("param", ProviderParamSchema),
    zValidator(
      "json",
      z.object({
        enabled: z.boolean(),
      })
    ),
    async (c) => {
      const { provider } = c.req.valid("param");
      const { enabled } = c.req.valid("json");

      await toggleConnectionEnabled(undefined, provider, enabled);

      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // DELETE /:provider - Revoke integration
  // ==========================================================================
  .delete(
    "/:provider",
    passwordAuth,
    zValidator("param", ProviderParamSchema),
    async (c) => {
      const { provider } = c.req.valid("param");

      // Revoke from Composio
      const result = await revokeConnection(provider);

      if ("error" in result && result.error === "sdk_error") {
        return c.json(
          {
            error: "Internal Server Error",
            message: result.message,
          },
          500
        );
      }

      // Remove from DB
      await removeConnection(undefined, provider);

      return c.json({ success: true });
    }
  );
