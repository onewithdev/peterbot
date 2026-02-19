import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { passwordAuth } from "./auth.js";
import {
  getConnectedApps,
  toggleConnectionEnabled,
} from "../../features/integrations/repository.js";
import {
  isConfigured,
  syncFromComposio,
  getLastSyncedAt,
} from "../../features/integrations/service.js";

/**
 * Provider parameter schema for routes with :provider.
 */
const ProviderParamSchema = z.object({
  provider: z.string().min(1),
});

/**
 * Provider definition with metadata.
 */
interface ProviderDefinition {
  provider: string;
  label: string;
  icon: string;
  required: boolean;
  category: string;
  description: string;
}

/**
 * Known providers with their display info and requirements.
 */
const KNOWN_PROVIDERS: ProviderDefinition[] = [
  // REQUIRED
  {
    provider: "gmail",
    label: "Gmail",
    icon: "mail",
    required: true,
    category: "Required",
    description: "Required for email processing and notifications",
  },

  // DOCUMENTS
  {
    provider: "googledocs",
    label: "Google Docs",
    icon: "file-text",
    required: false,
    category: "Documents",
    description: "Needed to read, create, and edit Google Documents",
  },
  {
    provider: "googlesheets",
    label: "Google Sheets",
    icon: "table",
    required: false,
    category: "Documents",
    description: "Needed for spreadsheet data processing",
  },
  {
    provider: "google_drive",
    label: "Google Drive",
    icon: "folder",
    required: false,
    category: "Documents",
    description: "Required for file storage and retrieval",
  },
  {
    provider: "googlecalendar",
    label: "Google Calendar",
    icon: "calendar",
    required: false,
    category: "Scheduling",
    description: "Needed for scheduling and calendar events",
  },

  // DEVELOPMENT
  {
    provider: "github",
    label: "GitHub",
    icon: "github",
    required: false,
    category: "Development",
    description: "Required for code repository management",
  },

  // PRODUCTIVITY
  {
    provider: "notion",
    label: "Notion",
    icon: "file-text",
    required: false,
    category: "Productivity",
    description: "Needed for Notion page and database access",
  },
  {
    provider: "linear",
    label: "Linear",
    icon: "check-square",
    required: false,
    category: "Productivity",
    description: "Needed for issue tracking and project management",
  },
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
        lastSyncedAt: getLastSyncedAt()?.toISOString() ?? null,
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
        enabled: app?.enabled ?? true,
        app: app || null,
      };
    });

    return c.json({
      configured: true,
      lastSyncedAt: getLastSyncedAt()?.toISOString() ?? null,
      providers,
    });
  })

  // ==========================================================================
  // POST /sync - Sync connected accounts from Composio
  // ==========================================================================
  .post("/sync", passwordAuth, async (c) => {
    const result = await syncFromComposio();

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
      success: true,
      added: result.added,
      removed: result.removed,
      unchanged: result.unchanged,
    });
  })

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


