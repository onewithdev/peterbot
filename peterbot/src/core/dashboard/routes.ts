/**
 * Dashboard API Routes - Hono RPC
 *
 * Type-safe API routes for the web dashboard using Hono RPC.
 * All protected routes require X-Dashboard-Password header.
 *
 * ## Type Export Pattern
 *
 * ```typescript
 * // Frontend usage
 * import { hc } from "hono/client";
 * import type { DashboardAPI } from "../core/dashboard/routes";
 *
 * const api = hc<DashboardAPI>("http://localhost:3000");
 * ```
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { passwordAuth } from "./auth.js";
import {
  readConfigFile,
  writeConfigFile,
  getConfigFileStats,
  validateBlocklist,
  DEFAULT_CONFIG_CONTENT,
  type ConfigFileType,
} from "./files.js";
import {
  getJobsByChatId,
  getJobById,
  markJobFailed,
} from "../../features/jobs/repository.js";
import { config } from "../../shared/config.js";

/**
 * Job ID parameter schema for routes with :id.
 */
const JobIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Main dashboard API app with all routes.
 */
const app = new Hono()
  // ==========================================================================
  // Health Check (Public)
  // ==========================================================================
  .get("/health", (c) => {
    return c.json({
      status: "ok",
      name: "peterbot",
      ts: Date.now(),
    });
  })

  // ==========================================================================
  // Authentication (Public)
  // ==========================================================================
  .post(
    "/auth/verify",
    zValidator(
      "json",
      z.object({
        password: z.string(),
      })
    ),
    async (c) => {
      const { password } = c.req.valid("json");
      const isValid = password === config.dashboardPassword;
      return c.json({ valid: isValid });
    }
  )

  // ==========================================================================
  // Jobs API (Protected)
  // ==========================================================================

  /**
   * GET /api/jobs
   * List all jobs for the configured chat ID.
   */
  .get("/jobs", passwordAuth, async (c) => {
    const jobs = await getJobsByChatId(config.telegramChatId);
    return c.json({
      jobs,
      total: jobs.length,
    });
  })

  /**
   * GET /api/jobs/:id
   * Get detailed information about a specific job.
   */
  .get("/jobs/:id", passwordAuth, zValidator("param", JobIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const job = await getJobById(id);

    if (!job) {
      return c.json(
        {
          error: "Not Found",
          message: `Job ${id} not found`,
        },
        404
      );
    }

    return c.json({ job });
  })

  /**
   * POST /api/jobs/:id/cancel
   * Cancel a running or pending job by marking it as failed.
   */
  .post(
    "/jobs/:id/cancel",
    passwordAuth,
    zValidator("param", JobIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const job = await getJobById(id);

      if (!job) {
        return c.json(
          {
            error: "Not Found",
            message: `Job ${id} not found`,
          },
          404
        );
      }

      // Only cancel pending or running jobs
      if (job.status !== "pending" && job.status !== "running") {
        return c.json(
          {
            error: "Bad Request",
            message: `Cannot cancel job with status '${job.status}'`,
          },
          400
        );
      }

      await markJobFailed(id, "Cancelled by user");

      return c.json({
        success: true,
        message: "Job cancelled",
      });
    }
  )

  // ==========================================================================
  // Soul Configuration (Protected)
  // ==========================================================================

  /**
   * GET /api/soul
   * Read soul.md personality configuration.
   */
  .get("/soul", passwordAuth, async (c) => {
    const [content, stats] = await Promise.all([
      readConfigFile("soul"),
      getConfigFileStats("soul"),
    ]);

    return c.json({
      content: content ?? "",
      lastModified: stats.lastModified?.toISOString() ?? null,
      size: stats.size,
      exists: content !== null,
    });
  })

  /**
   * PUT /api/soul
   * Update soul.md personality configuration.
   */
  .put(
    "/soul",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        content: z.string(),
      })
    ),
    async (c) => {
      const { content } = c.req.valid("json");
      await writeConfigFile("soul", content);

      const stats = await getConfigFileStats("soul");

      return c.json({
        success: true,
        lastModified: stats.lastModified?.toISOString() ?? null,
        size: stats.size,
      });
    }
  )

  // ==========================================================================
  // Memory Configuration (Protected)
  // ==========================================================================

  /**
   * GET /api/memory
   * Read memory.md user memory/facts.
   */
  .get("/memory", passwordAuth, async (c) => {
    const [content, stats] = await Promise.all([
      readConfigFile("memory"),
      getConfigFileStats("memory"),
    ]);

    return c.json({
      content: content ?? "",
      lastModified: stats.lastModified?.toISOString() ?? null,
      size: stats.size,
      exists: content !== null,
    });
  })

  /**
   * PUT /api/memory
   * Update memory.md user memory/facts.
   */
  .put(
    "/memory",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        content: z.string(),
      })
    ),
    async (c) => {
      const { content } = c.req.valid("json");
      await writeConfigFile("memory", content);

      const stats = await getConfigFileStats("memory");

      return c.json({
        success: true,
        lastModified: stats.lastModified?.toISOString() ?? null,
        size: stats.size,
      });
    }
  )

  // ==========================================================================
  // Blocklist Configuration (Protected)
  // ==========================================================================

  /**
   * GET /api/blocklist
   * Read blocklist.json command restrictions.
   */
  .get("/blocklist", passwordAuth, async (c) => {
    const [content, stats] = await Promise.all([
      readConfigFile("blocklist"),
      getConfigFileStats("blocklist"),
    ]);

    // Parse JSON if exists, otherwise return default structure
    let parsed: unknown;
    if (content) {
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = null;
      }
    }

    // Return default structure if no file or invalid JSON
    if (!parsed) {
      parsed = JSON.parse(DEFAULT_CONFIG_CONTENT.blocklist);
    }

    return c.json({
      data: parsed as {
        enabled: boolean;
        strict: { patterns: string[]; action: string; message: string };
        warn: { patterns: string[]; action: string; message: string };
      },
      content: content ?? DEFAULT_CONFIG_CONTENT.blocklist,
      lastModified: stats.lastModified?.toISOString() ?? null,
      size: stats.size,
      exists: content !== null,
    });
  })

  /**
   * PUT /api/blocklist
   * Update blocklist.json command restrictions.
   */
  .put(
    "/blocklist",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        content: z.string(),
      })
    ),
    async (c) => {
      const { content } = c.req.valid("json");

      // Validate JSON structure before saving
      try {
        validateBlocklist(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json(
          {
            error: "Validation Error",
            message,
          },
          400
        );
      }

      await writeConfigFile("blocklist", content);

      const stats = await getConfigFileStats("blocklist");
      const parsed = JSON.parse(content);

      return c.json({
        success: true,
        data: parsed,
        lastModified: stats.lastModified?.toISOString() ?? null,
        size: stats.size,
      });
    }
  );

// ============================================================================
// Exports
// ============================================================================

/**
 * Type export for Hono RPC client.
 * Use this type to get full type safety on all API calls.
 *
 * @example
 * ```typescript
 * import { hc } from "hono/client";
 * import type { DashboardAPI } from "../core/dashboard/routes";
 *
 * const api = hc<DashboardAPI>("http://localhost:3000");
 * const response = await api.api.jobs.$get();
 * ```
 */
export type DashboardAPI = typeof app;

/**
 * Export the app for mounting in the main server.
 */
export { app as dashboardApp };
