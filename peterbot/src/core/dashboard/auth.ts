/**
 * Authentication Middleware for Dashboard API
 *
 * Simple password-based authentication using X-Dashboard-Password header.
 * Designed for single-user Phase 1 - no sessions, no JWT, just password validation.
 *
 * ## Usage
 *
 * ```typescript
 * import { passwordAuth } from "./auth.js";
 *
 * const app = new Hono()
 *   .get("/protected", passwordAuth, (c) => c.json({ message: "Secret data" }));
 * ```
 */

import type { MiddlewareHandler } from "hono";
import { config } from "../../shared/config.js";

/**
 * HTTP header name for the dashboard password.
 * Frontend must send: X-Dashboard-Password: <password>
 */
export const PASSWORD_HEADER = "X-Dashboard-Password";

/**
 * Password authentication middleware.
 *
 * Validates the X-Dashboard-Password header against DASHBOARD_PASSWORD env var.
 * Returns 401 Unauthorized if password is missing or invalid.
 *
 * @param c - Hono context
 * @param next - Next middleware function
 * @returns 401 response if unauthorized, otherwise continues to next handler
 */
export const passwordAuth: MiddlewareHandler = async (c, next) => {
  const password = c.req.header(PASSWORD_HEADER);

  // Password is required
  if (!password) {
    return c.json(
      {
        error: "Unauthorized",
        message: `Missing ${PASSWORD_HEADER} header`,
      },
      401
    );
  }

  // Validate against DASHBOARD_PASSWORD
  if (password !== config.dashboardPassword) {
    return c.json(
      {
        error: "Unauthorized",
        message: "Invalid password",
      },
      401
    );
  }

  // Password is valid, continue to the handler
  await next();
};

/**
 * Optional password auth middleware.
 *
 * Same as passwordAuth but allows requests without password.
 * Useful for public health checks or mixed routes.
 *
 * Sets c.get("authenticated") to true if password is valid.
 *
 * @param c - Hono context
 * @param next - Next middleware function
 */
export const optionalPasswordAuth: MiddlewareHandler = async (c, next) => {
  const password = c.req.header(PASSWORD_HEADER);

  if (password && password === config.dashboardPassword) {
    c.set("authenticated", true);
  } else {
    c.set("authenticated", false);
  }

  await next();
};

// Type declaration for Hono context variables
declare module "hono" {
  interface ContextVariableMap {
    authenticated: boolean;
  }
}
