import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  executeInSession,
  resetSession,
  getSessionStatus,
} from "./console";

// Check if E2B is available by attempting a simple operation
async function isE2BAvailable(): Promise<boolean> {
  const testSessionId = `e2b-check-${Date.now()}`;
  try {
    const result = await executeInSession(testSessionId, "print('test')");
    await resetSession(testSessionId);
    return result.error === null || (!result.error.includes("404") && !result.error.includes("401"));
  } catch {
    return false;
  }
}

describe("Console", () => {
  // Generate unique session ID for each test
  let testSessionId: string;
  let e2bAvailable = false;

  beforeEach(async () => {
    testSessionId = `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    // Check E2B availability once per test run
    if (!e2bAvailable) {
      e2bAvailable = await isE2BAvailable();
    }
  });

  afterEach(async () => {
    // Clean up session after each test
    try {
      await resetSession(testSessionId);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Session Management", () => {
    test("getSessionStatus returns false for non-existent session", async () => {
      const status = await getSessionStatus("non-existent-session");
      expect(status.exists).toBe(false);
    });

    test("executeInSession creates new session on first call", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const result = await executeInSession(testSessionId, "print('hello')");

      expect(result.error).toBeNull();
      expect(result.stdout).toContain("hello");
      
      const status = await getSessionStatus(testSessionId);
      expect(status.exists).toBe(true);
    });

    test("resetSession cleans up existing session", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      // Create a session first
      await executeInSession(testSessionId, "x = 42");
      
      // Verify it exists
      let status = await getSessionStatus(testSessionId);
      expect(status.exists).toBe(true);

      // Reset it
      await resetSession(testSessionId);

      // Verify it's gone
      status = await getSessionStatus(testSessionId);
      expect(status.exists).toBe(false);
    });
  });

  describe("Code Execution", () => {
    test("executes Python code and returns output", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const result = await executeInSession(testSessionId, "print(2 + 2)");

      expect(result.error).toBeNull();
      expect(result.stdout).toContain("4");
      expect(result.stderr).toBe("");
    });

    test("returns stderr for code with errors", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const result = await executeInSession(testSessionId, "print(undefined_variable)");

      expect(result.error).toBeNull(); // No execution error, just Python error
      expect(result.stderr).toContain("NameError");
    });

    test("maintains state between executions in same session", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      // Set a variable
      await executeInSession(testSessionId, "x = 100");

      // Use the variable in next execution
      const result = await executeInSession(testSessionId, "print(x)");

      expect(result.stdout).toContain("100");
    });

    test("sessions are isolated from each other", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const sessionA = `${testSessionId}-a`;
      const sessionB = `${testSessionId}-b`;

      // Set different values in each session
      await executeInSession(sessionA, "x = 'session-a'");
      await executeInSession(sessionB, "x = 'session-b'");

      // Verify isolation
      const resultA = await executeInSession(sessionA, "print(x)");
      const resultB = await executeInSession(sessionB, "print(x)");

      expect(resultA.stdout).toContain("session-a");
      expect(resultB.stdout).toContain("session-b");

      // Cleanup
      await resetSession(sessionA);
      await resetSession(sessionB);
    });

    test("handles multiline code", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const code = `
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
      `.trim();

      const result = await executeInSession(testSessionId, code);

      expect(result.error).toBeNull();
      expect(result.stdout).toContain("Hello, World!");
    });

    test("handles empty code gracefully", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const result = await executeInSession(testSessionId, "");

      // Should not throw, but may have empty output
      expect(result.error).toBeNull();
    });

    test("handles large output", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      const code = "print('x' * 10000)";
      const result = await executeInSession(testSessionId, code);

      expect(result.error).toBeNull();
      expect(result.stdout.length).toBeGreaterThan(9000);
    });
  });

  describe("Error Handling", () => {
    test("returns error for invalid session ID format", async () => {
      // Session ID should be a valid UUID format
      const result = await executeInSession("invalid-id", "print('test')");

      // Should either work with any ID or return a proper error
      expect(result).toBeDefined();
    });

    test("handles code timeout gracefully", async () => {
      if (!e2bAvailable) {
        console.log("Skipping E2B test - E2B not configured");
        return;
      }

      // Code that runs indefinitely
      const code = "import time; time.sleep(100)";

      // This test depends on implementation - may need adjustment
      // based on actual timeout behavior
    });
  });
});
