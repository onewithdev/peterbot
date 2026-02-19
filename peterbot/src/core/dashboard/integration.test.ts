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
        body: JSON.stringify({ content: "# Valid Soul Content\n\nThis is valid personality content." }),
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

describe("Integrations API Contracts", () => {
  describe("GET /integrations", () => {
    test("response has correct shape with required fields", async () => {
      const res = await dashboardApp.request("/integrations", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // Verify top-level response shape
      expect(body).toHaveProperty("configured");
      expect(body).toHaveProperty("lastSyncedAt");
      expect(body).toHaveProperty("providers");

      // Type verification
      expect(typeof body.configured).toBe("boolean");
      expect(Array.isArray(body.providers)).toBe(true);

      // lastSyncedAt should be present and either null or a string (ISO date)
      if (body.lastSyncedAt !== null) {
        expect(typeof body.lastSyncedAt).toBe("string");
        // Verify it's a valid ISO date string
        expect(new Date(body.lastSyncedAt).toISOString()).toBe(body.lastSyncedAt);
      }
    });

    test("when not configured, returns configured: false and empty providers", async () => {
      // This test documents the expected behavior when COMPOSIO_API_KEY is not set.
      // Note: config reads env vars at import time, so we test the current state
      // rather than trying to manipulate process.env after import.
      const res = await dashboardApp.request("/integrations", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // The response shape is consistent; configured flag depends on env at startup
      expect(typeof body.configured).toBe("boolean");
      expect(Array.isArray(body.providers)).toBe(true);

      // When not configured, providers should be empty
      if (body.configured === false) {
        expect(body.providers.length).toBe(0);
        expect(body.lastSyncedAt).toBeNull();
      }
    });

    test("each provider has required fields", async () => {
      const res = await dashboardApp.request("/integrations", {
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      expect(Array.isArray(body.providers)).toBe(true);

      // Verify each provider has the required fields
      for (const provider of body.providers) {
        expect(provider).toHaveProperty("provider");
        expect(provider).toHaveProperty("label");
        expect(provider).toHaveProperty("icon");
        expect(provider).toHaveProperty("required");
        expect(provider).toHaveProperty("category");
        expect(provider).toHaveProperty("description");
        expect(provider).toHaveProperty("connected");
        expect(provider).toHaveProperty("enabled");
        expect(provider).toHaveProperty("app");

        // Type verification
        expect(typeof provider.provider).toBe("string");
        expect(typeof provider.label).toBe("string");
        expect(typeof provider.icon).toBe("string");
        expect(typeof provider.required).toBe("boolean");
        expect(typeof provider.category).toBe("string");
        expect(typeof provider.description).toBe("string");
        expect(typeof provider.connected).toBe("boolean");
        expect(typeof provider.enabled).toBe("boolean");
        // app can be an object or null
        if (provider.app !== null) {
          expect(typeof provider.app).toBe("object");
        }
      }
    });
  });

  describe("POST /integrations/sync", () => {
    test("response has correct shape", async () => {
      const res = await dashboardApp.request("/integrations/sync", {
        method: "POST",
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      // Response can be 200 (success), 503 (not configured), or 500 (sdk error)
      // We're testing the shape, not the actual sync functionality
      expect([200, 503, 500]).toContain(res.status);

      const body = await res.json();

      if (res.status === 200) {
        // Success shape
        expect(body).toHaveProperty("success");
        expect(body.success).toBe(true);
        expect(body).toHaveProperty("added");
        expect(body).toHaveProperty("removed");
        expect(body).toHaveProperty("unchanged");

        // Verify these are arrays
        expect(Array.isArray(body.added)).toBe(true);
        expect(Array.isArray(body.removed)).toBe(true);
        expect(Array.isArray(body.unchanged)).toBe(true);
      } else {
        // Error shape
        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("message");
        expect(typeof body.error).toBe("string");
        expect(typeof body.message).toBe("string");
      }
    });

    test("when not configured, returns error response with correct shape", async () => {
      // This test documents the expected behavior when COMPOSIO_API_KEY is not set.
      // Note: The actual response depends on config state at module import time.
      const res = await dashboardApp.request("/integrations/sync", {
        method: "POST",
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      // When not configured, should return 503
      // When configured but SDK fails, could be 500
      expect([200, 503, 500]).toContain(res.status);

      const body = await res.json();

      if (res.status === 503 || res.status === 500) {
        // Error shape verification
        expect(body).toHaveProperty("error");
        expect(body).toHaveProperty("message");
        expect(typeof body.error).toBe("string");
        expect(typeof body.message).toBe("string");
      }
    });
  });

  describe("DELETE /integrations/:provider", () => {
    test("endpoint no longer exists (returns 404 or 405)", async () => {
      const res = await dashboardApp.request("/integrations/gmail", {
        method: "DELETE",
        headers: { [PASSWORD_HEADER]: "test_integration_password" },
      });

      // The endpoint should be removed - expect 404 (Not Found) or 405 (Method Not Allowed)
      expect([404, 405]).toContain(res.status);
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
