/**
 * Tests for Authentication Middleware
 *
 * @module src/core/dashboard/auth.test
 */

import { describe, it, expect, beforeAll } from "bun:test";
import { Hono } from "hono";
import { passwordAuth, optionalPasswordAuth, PASSWORD_HEADER } from "./auth.js";

// Store original env
const originalEnv = process.env.DASHBOARD_PASSWORD;

// Set test password before all tests
beforeAll(() => {
  process.env.DASHBOARD_PASSWORD = "test_password_123";
});

describe("passwordAuth middleware", () => {
  it("should reject requests without password header", async () => {
    const app = new Hono().get("/protected", passwordAuth, (c) =>
      c.json({ message: "success" })
    );

    const res = await app.request("/protected");
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toContain("Missing");
  });

  it("should reject requests with wrong password", async () => {
    const app = new Hono().get("/protected", passwordAuth, (c) =>
      c.json({ message: "success" })
    );

    const res = await app.request("/protected", {
      headers: {
        [PASSWORD_HEADER]: "wrong_password",
      },
    });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
    expect(body.message).toBe("Invalid password");
  });

  it("should allow requests with correct password", async () => {
    const app = new Hono().get("/protected", passwordAuth, (c) =>
      c.json({ message: "success" })
    );

    const res = await app.request("/protected", {
      headers: {
        [PASSWORD_HEADER]: "test_password_123",
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.message).toBe("success");
  });

  it("should be case-sensitive for password", async () => {
    const app = new Hono().get("/protected", passwordAuth, (c) =>
      c.json({ message: "success" })
    );

    const res = await app.request("/protected", {
      headers: {
        [PASSWORD_HEADER]: "TEST_PASSWORD_123", // Wrong case
      },
    });
    expect(res.status).toBe(401);
  });
});

describe("optionalPasswordAuth middleware", () => {
  it("should allow requests without password", async () => {
    const app = new Hono().get("/optional", optionalPasswordAuth, (c) => {
      const isAuthenticated = c.get("authenticated");
      return c.json({ authenticated: isAuthenticated });
    });

    const res = await app.request("/optional");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });

  it("should mark as authenticated with correct password", async () => {
    const app = new Hono().get("/optional", optionalPasswordAuth, (c) => {
      const isAuthenticated = c.get("authenticated");
      return c.json({ authenticated: isAuthenticated });
    });

    const res = await app.request("/optional", {
      headers: {
        [PASSWORD_HEADER]: "test_password_123",
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.authenticated).toBe(true);
  });

  it("should mark as not authenticated with wrong password", async () => {
    const app = new Hono().get("/optional", optionalPasswordAuth, (c) => {
      const isAuthenticated = c.get("authenticated");
      return c.json({ authenticated: isAuthenticated });
    });

    const res = await app.request("/optional", {
      headers: {
        [PASSWORD_HEADER]: "wrong_password",
      },
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.authenticated).toBe(false);
  });
});

describe("PASSWORD_HEADER constant", () => {
  it("should have correct header name", () => {
    expect(PASSWORD_HEADER).toBe("X-Dashboard-Password");
  });
});

// Cleanup after tests
process.env.DASHBOARD_PASSWORD = originalEnv;
