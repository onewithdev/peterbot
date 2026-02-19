import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, mock } from "bun:test";

// Store original env
const originalEnv = { ...process.env };

// Mock the jobs repository
const mockGetJobsByChatId = mock(async () => []);
const mockGetJobById = mock(async () => undefined);
const mockMarkJobFailed = mock(async () => {});

mock.module("../../features/jobs/repository", () => ({
  getJobsByChatId: mockGetJobsByChatId,
  getJobById: mockGetJobById,
  markJobFailed: mockMarkJobFailed,
}));

// Mock the cron repository
mock.module("../../features/cron/repository", () => ({
  getAllSchedules: mock(async () => []),
  createSchedule: mock(async (input: unknown) => ({ id: "sched_123", ...input })),
  deleteSchedule: mock(async () => {}),
  toggleSchedule: mock(async () => {}),
  getScheduleById: mock(async () => undefined),
}));

// Mock the compaction repository
mock.module("../../features/compaction/repository", () => ({
  getAllSessions: mock(async () => []),
  getConfig: mock(async () => undefined),
  setConfig: mock(async () => {}),
}));

// Mock the solutions repository
mock.module("../../features/solutions/repository", () => ({
  getAllSolutions: mock(async () => []),
  deleteSolution: mock(async () => {}),
  getSolutionById: mock(async () => undefined),
}));

describe("Dashboard API - Health & Auth", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = "test_dashboard_password";
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("GET /health", () => {
    test("returns ok status", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/health");
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.name).toBe("peterbot");
      expect(body.ts).toBeNumber();
    });
  });

  describe("POST /auth/verify", () => {
    test("returns valid: true for correct password", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "test_dashboard_password" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
    });

    test("returns valid: false for wrong password", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: "wrong_password" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(false);
    });
  });
});

const PASSWORD_HEADER = "X-Dashboard-Password";

describe("Dashboard API - Jobs", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = "test_dashboard_password";
    process.env.TELEGRAM_CHAT_ID = "test_chat_123";
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockGetJobsByChatId.mockClear();
    mockGetJobById.mockClear();
    mockMarkJobFailed.mockClear();
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("GET /jobs", () => {
    test("requires password header", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/jobs");
      expect(res.status).toBe(401);
    });

    test("returns jobs array with total count", async () => {
      mockGetJobsByChatId.mockResolvedValue([
        {
          id: "550e8400-e29b-41d4-a716-446655440001",
          type: "task",
          status: "pending",
          input: "Test job",
          chatId: "test_chat_123",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/jobs", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.jobs)).toBe(true);
      expect(typeof body.total).toBe("number");
    });
  });

  describe("GET /jobs/:id", () => {
    test("returns 404 for non-existent job", async () => {
      mockGetJobById.mockResolvedValue(undefined);

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request(
        "/jobs/550e8400-e29b-41d4-a716-446655440000",
        {
          headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
        }
      );

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Not Found");
    });

    test("returns 400 for invalid UUID", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/jobs/not-a-uuid", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /jobs/:id/cancel", () => {
    test("returns 404 for non-existent job", async () => {
      mockGetJobById.mockResolvedValue(undefined);

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request(
        "/jobs/550e8400-e29b-41d4-a716-446655440000/cancel",
        {
          method: "POST",
          headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
        }
      );

      expect(res.status).toBe(404);
    });

    test("returns 400 for invalid UUID", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/jobs/not-a-uuid/cancel", {
        method: "POST",
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(400);
    });
  });
});

const repoMocks = {
  getMessages: async () => [],
  getMessagesSince: async () => [],
  getMessagesBefore: async () => [],
  saveMessage: async () => ({ id: "msg_123", createdAt: new Date() }),
};

describe("Dashboard API - Chat", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = "test_dashboard_password";
    process.env.TELEGRAM_CHAT_ID = "test_chat_123";

    // Mock the chat repository module
    mock.module("../../features/chat/repository.js", () => repoMocks);
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
    mock.restore();
  });

  describe("GET /chat/messages", () => {
    test("returns 401 without auth header", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/messages");
      expect(res.status).toBe(401);
    });

    test("with valid auth returns messages array", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/messages", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.messages)).toBe(true);
    });

    test("passes since param through", async () => {
      const since = Date.now() - 3600000; // 1 hour ago

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request(`/chat/messages?since=${since}`, {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.messages)).toBe(true);
    });

    test("passes before param through", async () => {
      const before = Date.now();

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request(`/chat/messages?before=${before}`, {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.messages)).toBe(true);
    });
  });

  describe("POST /chat/send", () => {
    test("returns 401 without auth header", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Hello" }),
      });
      expect(res.status).toBe(401);
    });

    test("with valid auth returns { messageId, createdAt }", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/send", {
        method: "POST",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "Hello from dashboard" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messageId).toBeString();
      expect(typeof body.createdAt).toBe("number");
    });

    test("with missing content returns 400", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/send", {
        method: "POST",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    test("with empty content returns 400", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/chat/send", {
        method: "POST",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "" }),
      });

      expect(res.status).toBe(400);
    });
  });
});

import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { _setTestProjectRoot } from "./files";

const TEST_CONFIG_DIR = join(process.cwd(), "test-temp", "config-api");

describe("Dashboard API - Configuration", () => {
  beforeAll(() => {
    process.env.DASHBOARD_PASSWORD = "test_dashboard_password";
    // Set up test project root for file operations
    _setTestProjectRoot(TEST_CONFIG_DIR);
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
    _setTestProjectRoot(null);
  });

  beforeEach(async () => {
    await mkdir(TEST_CONFIG_DIR, { recursive: true });
    // Also create config subdirectory for blocklist
    await mkdir(join(TEST_CONFIG_DIR, "config"), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("GET /soul", () => {
    test("returns empty content when soul.md doesn't exist", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/soul", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe("");
      expect(body.exists).toBe(false);
      expect(body.size).toBe(0);
    });

    test("returns soul.md content when file exists", async () => {
      const soulContent = "# Peterbot Personality\n\nBe helpful and concise.";
      await writeFile(join(TEST_CONFIG_DIR, "soul.md"), soulContent);

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/soul", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.exists).toBe(true);
      expect(body.size).toBe(soulContent.length);
    });
  });

  describe("PUT /soul", () => {
    test("updates soul.md content", async () => {
      const newContent = "# Updated Personality\n\nBe extra helpful!";

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/soul", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newContent }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.size).toBe(newContent.length);
    });

    test("rejects missing content field", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/soul", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /memory", () => {
    test("returns empty content when memory.md doesn't exist", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/memory", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toBe("");
      expect(body.exists).toBe(false);
    });
  });

  describe("PUT /memory", () => {
    test("updates memory.md content", async () => {
      const newContent = "# Memory\n\nUser prefers dark mode.";

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/memory", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newContent }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("GET /blocklist", () => {
    test("returns default blocklist when file doesn't exist", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/blocklist", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeDefined();
      expect(body.data.enabled).toBe(true);
      expect(body.data.strict).toBeDefined();
      expect(body.data.warn).toBeDefined();
    });

    test("returns parsed blocklist when file exists", async () => {
      const blocklistContent = JSON.stringify({
        enabled: true,
        strict: {
          patterns: ["test-pattern"],
          action: "block",
          message: "Test blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Test warning!",
        },
      });
      await writeFile(join(TEST_CONFIG_DIR, "config", "blocklist.json"), blocklistContent);

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/blocklist", {
        headers: { [PASSWORD_HEADER]: "test_dashboard_password" },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.strict.patterns).toContain("test-pattern");
    });
  });

  describe("PUT /blocklist", () => {
    test("updates blocklist with valid JSON", async () => {
      const newContent = JSON.stringify({
        enabled: true,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "Dangerous command blocked!",
        },
        warn: {
          patterns: ["pip\\s+install"],
          action: "warn",
          message: "Installation may take time.",
        },
      });

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/blocklist", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newContent }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.enabled).toBe(true);
    });

    test("rejects invalid JSON", async () => {
      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/blocklist", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: "not valid json" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Validation Error");
    });

    test("rejects blocklist missing strict block", async () => {
      const invalidContent = JSON.stringify({
        enabled: true,
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const { dashboardApp } = await import("./routes");

      const res = await dashboardApp.request("/blocklist", {
        method: "PUT",
        headers: {
          [PASSWORD_HEADER]: "test_dashboard_password",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: invalidContent }),
      });

      expect(res.status).toBe(400);
    });
  });
});
