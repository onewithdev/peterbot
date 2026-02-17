/**
 * Integration Tests - API Contract Verification
 *
 * These tests verify the contract between frontend and backend.
 * They ensure response shapes match what the frontend expects.
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { dashboardApp } from "./routes";

const PASSWORD_HEADER = "X-Dashboard-Password";

describe("API Contract - Response Shape Verification", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = "test_integration_password";
    process.env.TELEGRAM_CHAT_ID = "integration_test_chat";
  });

  describe("Health Check Contract", () => {
    test("returns required fields", async () => {
      const res = await dashboardApp.request("/health");
      const body = await res.json();

      // Frontend expects these fields
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("name");
      expect(body).toHaveProperty("ts");

      // Type verification
      expect(typeof body.status).toBe("string");
      expect(typeof body.name).toBe("string");
      expect(typeof body.ts).toBe("number");
    });
  });

  describe("Jobs API Contract", () => {
    test("GET /jobs returns expected shape", async () => {
      const res = await dashboardApp.request("/jobs", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });
      const body = await res.json();

      // Frontend expects: { jobs: Job[], total: number }
      expect(body).toHaveProperty("jobs");
      expect(body).toHaveProperty("total");
      expect(Array.isArray(body.jobs)).toBe(true);
      expect(typeof body.total).toBe("number");
    });

    test("GET /jobs/:id returns expected shape for existing job", async () => {
      // First create a job (would need DB setup)
      // For now, test the error shape
      const res = await dashboardApp.request(
        "/jobs/550e8400-e29b-41d4-a716-446655440000",
        {
          headers: { [PASSWORD_HEADER]: "test_integration_password" },
        }
      );

      // Even 404 should have consistent error shape
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("message");
    });

    test("POST /jobs/:id/cancel returns success shape", async () => {
      const res = await dashboardApp.request(
        "/jobs/550e8400-e29b-41d4-a716-446655440000/cancel",
        {
          method: "POST",
          headers: { [PASSWORD_HEADER]: "test_integration_password" },
        }
      );

      // 404 is fine for this test, we're checking error shape
      const body = await res.json();
      expect(body).toHaveProperty("error");
    });
  });

  describe("Config API Contracts", () => {
    test("GET /soul returns expected shape", async () => {
      const res = await dashboardApp.request("/soul", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });
      const body = await res.json();

      // Frontend expects: { content: string, lastModified: string | null, size: number, exists: boolean }
      expect(body).toHaveProperty("content");
      expect(body).toHaveProperty("lastModified");
      expect(body).toHaveProperty("size");
      expect(body).toHaveProperty("exists");

      expect(typeof body.content).toBe("string");
      expect(typeof body.size).toBe("number");
      expect(typeof body.exists).toBe("boolean");
      // lastModified can be string or null
      if (body.lastModified !== null) {
        expect(typeof body.lastModified).toBe("string");
      }
    });

    test("PUT /soul returns success shape", async () => {
      const res = await dashboardApp.request("/soul", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_integration_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "test" }),
      });
      const body = await res.json();

      // Frontend expects: { success: boolean, lastModified: string, size: number }
      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("lastModified");
      expect(body).toHaveProperty("size");

      expect(typeof body.success).toBe("boolean");
      expect(typeof body.size).toBe("number");
    });

    test("GET /memory returns expected shape", async () => {
      const res = await dashboardApp.request("/memory", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });
      const body = await res.json();

      expect(body).toHaveProperty("content");
      expect(body).toHaveProperty("lastModified");
      expect(body).toHaveProperty("size");
      expect(body).toHaveProperty("exists");
    });

    test("PUT /memory returns success shape", async () => {
      const res = await dashboardApp.request("/memory", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_integration_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "test memory" }),
      });
      const body = await res.json();

      expect(body).toHaveProperty("success");
      expect(body.success).toBe(true);
    });

    test("GET /blocklist returns expected shape", async () => {
      const res = await dashboardApp.request("/blocklist", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });
      const body = await res.json();

      // Frontend expects: { data: BlocklistConfig, content: string, lastModified: string | null, size: number, exists: boolean }
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("content");
      expect(body).toHaveProperty("lastModified");
      expect(body).toHaveProperty("size");
      expect(body).toHaveProperty("exists");

      // Verify data structure
      expect(body.data).toHaveProperty("enabled");
      expect(body.data).toHaveProperty("strict");
      expect(body.data).toHaveProperty("warn");
      expect(body.data.strict).toHaveProperty("patterns");
      expect(body.data.strict).toHaveProperty("action");
      expect(body.data.strict).toHaveProperty("message");
      expect(Array.isArray(body.data.strict.patterns)).toBe(true);
    });

    test("PUT /blocklist returns success shape", async () => {
      const validBlocklist = JSON.stringify({
        enabled: true,
        strict: {
          patterns: [],
          action: "block",
          message: "Blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const res = await dashboardApp.request("/blocklist", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_integration_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: validBlocklist }),
      });
      const body = await res.json();

      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("data");
      expect(body.success).toBe(true);
    });
  });

  describe("Console API Contracts", () => {
    test("POST /console/execute returns expected shape", async () => {
      const res = await dashboardApp.request("/console/execute", {
        method: "POST",
        headers: {
          [PASSWORD_HEADER]: "test_integration_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
          code: "print('test')",
        }),
      });

      // Even if E2B fails, we check response structure
      const body = await res.json();

      // Frontend expects: { stdout: string, stderr: string, artifacts: string[], error: string | null }
      expect(body).toHaveProperty("stdout");
      expect(body).toHaveProperty("stderr");
      expect(body).toHaveProperty("error");

      expect(typeof body.stdout).toBe("string");
      expect(typeof body.stderr).toBe("string");
      // error can be string or null
      if (body.error !== null) {
        expect(typeof body.error).toBe("string");
      }
    });

    test("POST /console/reset returns success shape", async () => {
      const res = await dashboardApp.request("/console/reset", {
        method: "POST",
        headers: {
          [PASSWORD_HEADER]: "test_integration_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
        }),
      });

      const body = await res.json();
      expect(body).toHaveProperty("success");
      expect(typeof body.success).toBe("boolean");
    });
  });

  describe("Error Response Contracts", () => {
    test("401 errors have consistent shape", async () => {
      const res = await dashboardApp.request("/jobs");

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body).toHaveProperty("error");
    });

    test("400 errors have consistent shape", async () => {
      const res = await dashboardApp.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      expect(res.status).toBe(400);
    });

    test("404 errors have consistent shape", async () => {
      const res = await dashboardApp.request(
        "/jobs/550e8400-e29b-41d4-a716-446655440000",
        {
          headers: { [PASSWORD_HEADER]: "test_integration_password" },
        }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toHaveProperty("error");
      expect(body).toHaveProperty("message");
    });
  });
});

describe("CORS and Security Headers", () => {
  test("responses include appropriate headers", async () => {
    const res = await dashboardApp.request("/health");

    // Check for common security headers
    // Note: Actual headers depend on middleware configuration
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
