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
  writeConfigFileSafe,
  getConfigFileStats,
  validateBlocklist,
  DEFAULT_CONFIG_CONTENT,
} from "./files.js";
import {
  getJobsByChatId,
  getJobById,
  markJobFailed,
} from "../../features/jobs/repository.js";
import {
  getAllSchedules,
  createSchedule,
  deleteSchedule,
  toggleSchedule,
  getScheduleById,
} from "../../features/cron/repository.js";
import {
  getAllSessions,
  getConfig,
  setConfig,
} from "../../features/compaction/repository.js";
import {
  getAllSolutions,
  deleteSolution,
  getSolutionById,
} from "../../features/solutions/repository.js";
import {
  getAllSkills,
  toggleSkill,
  getSkillById,
} from "../../features/skills/repository.js";
import { scanSkillsOnce } from "../../features/skills/loader.js";
import { chatRoutes } from "./chat-routes.js";
import { integrationsRoutes } from "./integrations-routes.js";
import { documentsRoutes } from "./documents-routes.js";
import {
  getCapabilities,
  getChangelog,
  getChangelogRaw,
} from "../../features/capabilities/service.js";
import {
  parseNaturalSchedule,
  calculateNextRun,
} from "../../features/cron/natural-parser.js";
import { config } from "../../shared/config.js";
import { executeInSession, resetSession } from "./console.js";

/**
 * Job ID parameter schema for routes with :id.
 */
const JobIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Schedule ID parameter schema for routes with :id.
 */
const ScheduleIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Config key parameter schema for routes with :key.
 */
const ConfigKeyParamSchema = z.object({
  key: z.string().min(1),
});

/**
 * Solution ID parameter schema for routes with :id.
 */
const SolutionIdParamSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Skill ID parameter schema for routes with :id.
 */
const SkillIdParamSchema = z.object({
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
    const jobs = await getJobsByChatId(undefined, config.telegramChatId);
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
    const job = await getJobById(undefined, id);

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
      const job = await getJobById(undefined, id);

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

      await markJobFailed(undefined, id, "Cancelled by user");

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
      await writeConfigFileSafe("soul", content);

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
      await writeConfigFileSafe("memory", content);

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
  )

  // ==========================================================================
  // Console API (Protected)
  // ==========================================================================

  /**
   * POST /api/console/execute
   * Execute Python code in a persistent sandbox session.
   */
  .post(
    "/console/execute",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        sessionId: z.string().uuid(),
        code: z.string().min(1),
      })
    ),
    async (c) => {
      try {
        const { sessionId, code } = c.req.valid("json");
        const result = await executeInSession(sessionId, code);
        return c.json(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json({ error: "Internal Server Error", message }, 500);
      }
    }
  )

  /**
   * POST /api/console/reset
   * Reset (kill) a persistent sandbox session.
   */
  .post(
    "/console/reset",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        sessionId: z.string().uuid(),
      })
    ),
    async (c) => {
      const { sessionId } = c.req.valid("json");
      await resetSession(sessionId);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // Schedules API (Protected)
  // ==========================================================================

  /**
   * GET /api/schedules
   * List all schedules.
   */
  .get("/schedules", passwordAuth, async (c) => {
    const schedules = await getAllSchedules(undefined);
    return c.json({
      schedules,
      total: schedules.length,
    });
  })

  /**
   * POST /api/schedules
   * Create a new schedule from natural language.
   */
  .post(
    "/schedules",
    passwordAuth,
    zValidator(
      "json",
      z.object({
        description: z.string(),
        naturalSchedule: z.string(),
        prompt: z.string(),
      })
    ),
    async (c) => {
      const { description, naturalSchedule, prompt } = c.req.valid("json");

      // Parse natural language schedule
      const parsed = await parseNaturalSchedule(naturalSchedule);

      // Check confidence
      if (parsed.confidence < 0.5) {
        return c.json(
          {
            error: "Bad Request",
            message:
              "Could not parse schedule. Please try a clearer format like:",
            examples: [
              "every Monday at 9am",
              "every weekday at 8:30am",
              "every day at midnight",
            ],
          },
          400
        );
      }

      // Calculate next run time
      let nextRunAt: Date;
      try {
        nextRunAt = calculateNextRun(parsed.cron);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return c.json(
          {
            error: "Bad Request",
            message: `Invalid cron expression: ${message}`,
          },
          400
        );
      }

      // Create the schedule
      const schedule = await createSchedule(undefined, {
        description,
        naturalSchedule,
        parsedCron: parsed.cron,
        prompt,
        enabled: true,
        nextRunAt,
      });

      return c.json({ schedule });
    }
  )

  /**
   * DELETE /api/schedules/:id
   * Delete a schedule.
   */
  .delete(
    "/schedules/:id",
    passwordAuth,
    zValidator("param", ScheduleIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      // Check if schedule exists
      const schedule = await getScheduleById(undefined, id);
      if (!schedule) {
        return c.json(
          {
            error: "Not Found",
            message: `Schedule ${id} not found`,
          },
          404
        );
      }

      await deleteSchedule(undefined, id);
      return c.json({ success: true });
    }
  )

  /**
   * POST /api/schedules/:id/toggle
   * Enable or disable a schedule.
   */
  .post(
    "/schedules/:id/toggle",
    passwordAuth,
    zValidator("param", ScheduleIdParamSchema),
    zValidator(
      "json",
      z.object({
        enabled: z.boolean(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { enabled } = c.req.valid("json");

      // Check if schedule exists
      const schedule = await getScheduleById(undefined, id);
      if (!schedule) {
        return c.json(
          {
            error: "Not Found",
            message: `Schedule ${id} not found`,
          },
          404
        );
      }

      // When enabling, calculate a fresh nextRunAt to avoid replaying stale schedules
      let nextRunAt: Date | undefined;
      if (enabled) {
        const parsedCron = schedule.parsedCron;
        nextRunAt = calculateNextRun(parsedCron, new Date());
      }

      await toggleSchedule(undefined, id, enabled, nextRunAt);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // Sessions API (Protected)
  // ==========================================================================

  /**
   * GET /api/sessions
   * List all compacted sessions.
   */
  .get("/sessions", passwordAuth, async (c) => {
    const sessions = await getAllSessions(undefined);
    return c.json({
      sessions,
      total: sessions.length,
    });
  })

  // ==========================================================================
  // Config API (Protected)
  // ==========================================================================

  /**
   * GET /api/config/:key
   * Get a config value by key.
   */
  .get(
    "/config/:key",
    passwordAuth,
    zValidator("param", ConfigKeyParamSchema),
    async (c) => {
      const { key } = c.req.valid("param");
      const config = await getConfig(undefined, key);

      if (!config) {
        return c.json(
          {
            error: "Not Found",
            message: `Config ${key} not found`,
          },
          404
        );
      }

      return c.json({ key: config.key, value: config.value });
    }
  )

  /**
   * PUT /api/config/:key
   * Set a config value by key.
   */
  .put(
    "/config/:key",
    passwordAuth,
    zValidator("param", ConfigKeyParamSchema),
    zValidator(
      "json",
      z.object({
        value: z.string(),
      })
    ),
    async (c) => {
      const { key } = c.req.valid("param");
      const { value } = c.req.valid("json");

      await setConfig(undefined, key, value);

      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // Solutions API (Protected)
  // ==========================================================================

  /**
   * GET /api/solutions
   * List all solutions.
   */
  .get("/solutions", passwordAuth, async (c) => {
    const solutions = await getAllSolutions(undefined);
    return c.json({
      solutions,
      total: solutions.length,
    });
  })

  /**
   * DELETE /api/solutions/:id
   * Delete a solution.
   */
  .delete(
    "/solutions/:id",
    passwordAuth,
    zValidator("param", SolutionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");

      // Check if solution exists
      const solution = await getSolutionById(undefined, id);
      if (!solution) {
        return c.json(
          {
            error: "Not Found",
            message: `Solution ${id} not found`,
          },
          404
        );
      }

      await deleteSolution(undefined, id);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // Skills API (Protected)
  // ==========================================================================

  /**
   * GET /api/skills
   * List all skills.
   */
  .get("/skills", passwordAuth, async (c) => {
    const skills = await getAllSkills(undefined);
    return c.json({
      skills,
      total: skills.length,
    });
  })

  /**
   * POST /api/skills/sync
   * Trigger a manual sync of skills from disk.
   */
  .post("/skills/sync", passwordAuth, async (c) => {
    const result = await scanSkillsOnce(undefined);
    return c.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
    });
  })

  /**
   * PATCH /api/skills/:id/toggle
   * Enable or disable a skill.
   */
  .patch(
    "/skills/:id/toggle",
    passwordAuth,
    zValidator("param", SkillIdParamSchema),
    zValidator(
      "json",
      z.object({
        enabled: z.boolean(),
      })
    ),
    async (c) => {
      const { id } = c.req.valid("param");
      const { enabled } = c.req.valid("json");

      // Check if skill exists
      const skill = await getSkillById(undefined, id);
      if (!skill) {
        return c.json(
          {
            error: "Not Found",
            message: `Skill ${id} not found`,
          },
          404
        );
      }

      await toggleSkill(undefined, id, enabled);
      return c.json({ success: true });
    }
  )

  // ==========================================================================
  // Chat API (Protected)
  // ==========================================================================

  .route("/chat", chatRoutes)

  // ==========================================================================
  // Integrations API (Protected)
  // ==========================================================================

  .route("/integrations", integrationsRoutes)

  // ==========================================================================
  // Documents API (Protected)
  // ==========================================================================

  .route("/documents", documentsRoutes)

  // ==========================================================================
  // Capabilities API (Protected)
  // ==========================================================================

  /**
   * GET /api/capabilities
   * Get full capabilities summary including skills, apps, and changelog.
   */
  .get("/capabilities", passwordAuth, async (c) => {
    const capabilities = await getCapabilities();
    return c.json({ capabilities });
  })

  /**
   * GET /api/changelog
   * Get the full changelog as structured data.
   */
  .get("/changelog", passwordAuth, async (c) => {
    const changelog = await getChangelog();
    return c.json({ changelog });
  })

  /**
   * GET /api/changelog/raw
   * Get the raw markdown content of the changelog.
   */
  .get("/changelog/raw", passwordAuth, async (c) => {
    const content = await getChangelogRaw();
    return c.json({ content });
  });

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
