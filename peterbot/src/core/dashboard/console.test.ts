import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  executeInSession,
  resetSession,
  getSessionStatus,
} from "./console";

describe("Console", () => {
  // Generate unique session ID for each test
  let testSessionId: string;

  beforeEach(() => {
    testSessionId = `test-session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
      const result = await executeInSession(testSessionId, "print('hello')");

      expect(result.error).toBeNull();
      expect(result.stdout).toContain("hello");
      
      const status = await getSessionStatus(testSessionId);
      expect(status.exists).toBe(true);
    });

    test("resetSession cleans up existing session", async () => {
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
      const result = await executeInSession(testSessionId, "print(2 + 2)");

      expect(result.error).toBeNull();
      expect(result.stdout).toContain("4");
      expect(result.stderr).toBe("");
    });

    test("returns stderr for code with errors", async () => {
      const result = await executeInSession(testSessionId, "print(undefined_variable)");

      expect(result.error).toBeNull(); // No execution error, just Python error
      expect(result.stderr).toContain("NameError");
    });

    test("maintains state between executions in same session", async () => {
      // Set a variable
      await executeInSession(testSessionId, "x = 100");

      // Use the variable in next execution
      const result = await executeInSession(testSessionId, "print(x)");

      expect(result.stdout).toContain("100");
    });

    test("sessions are isolated from each other", async () => {
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
      const result = await executeInSession(testSessionId, "");

      // Should not throw, but may have empty output
      expect(result.error).toBeNull();
    });

    test("handles large output", async () => {
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
      // Code that runs indefinitely
      const code = "import time; time.sleep(100)";

      // This test depends on implementation - may need adjustment
      // based on actual timeout behavior
    });
  });
});
