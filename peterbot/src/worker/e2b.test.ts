import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { runInSandbox, type SandboxResult } from "./e2b";

// Store original env
const originalEnv = { ...process.env };

describe("E2B Sandbox", () => {
  beforeEach(() => {
    // Reset env
    delete process.env.E2B_API_KEY;
  });

  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("runInSandbox()", () => {
    test("returns error when E2B_API_KEY is missing", async () => {
      const result: SandboxResult = await runInSandbox("print('hello')");

      expect(result.error).toContain("E2B_API_KEY is not set");
      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(result.artifacts).toEqual([]);
    });

    test("returns helpful error message with dashboard URL", async () => {
      const result: SandboxResult = await runInSandbox("print('hello')");

      expect(result.error).toContain("https://e2b.dev/dashboard");
    });

    test("handles invalid API key gracefully", async () => {
      process.env.E2B_API_KEY = "invalid-test-key";
      
      // With an invalid key, we expect an error response
      // not a thrown exception - this tests error handling
      const result: SandboxResult = await runInSandbox("print('hello')");

      // Should return a valid result object even on failure
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("artifacts");
      expect(result).toHaveProperty("error");
      
      // With invalid key, error should be non-null
      expect(result.error).not.toBeNull();
    });

    test("returns string[] for artifacts", async () => {
      process.env.E2B_API_KEY = "test-key";
      
      const result: SandboxResult = await runInSandbox("print('hello')");

      expect(Array.isArray(result.artifacts)).toBe(true);
      result.artifacts.forEach(artifact => {
        expect(typeof artifact).toBe("string");
      });
    });

    test("returns empty arrays for stdout/stderr on missing key", async () => {
      const result: SandboxResult = await runInSandbox("print('hello')");

      expect(result.stdout).toBe("");
      expect(result.stderr).toBe("");
      expect(result.artifacts).toEqual([]);
    });

    test("handles empty code input", async () => {
      process.env.E2B_API_KEY = "test-key";
      
      const result: SandboxResult = await runInSandbox("");

      // Should not throw, return valid result
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("artifacts");
      expect(result).toHaveProperty("error");
    });

    test("handles code with special characters", async () => {
      process.env.E2B_API_KEY = "test-key";
      
      const codeWithSpecialChars = `
import json
import os
print("Hello\\nWorld")
print('Single "quotes"')
print("Double 'quotes'")
# Unicode: 你好世界 🎉
      `.trim();
      
      const result: SandboxResult = await runInSandbox(codeWithSpecialChars);

      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("artifacts");
      expect(result).toHaveProperty("error");
    });

    test("handles very long code input", async () => {
      process.env.E2B_API_KEY = "test-key";
      
      const longCode = "print('line')\n".repeat(1000);
      
      const result: SandboxResult = await runInSandbox(longCode);

      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("artifacts");
      expect(result).toHaveProperty("error");
    });
  });

  describe("SandboxResult interface", () => {
    test("result has correct structure", async () => {
      process.env.E2B_API_KEY = "test-key";
      
      const result: SandboxResult = await runInSandbox("print('test')");

      // Verify all required fields exist and are correct types
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
      expect(Array.isArray(result.artifacts)).toBe(true);
      expect(result.error === null || typeof result.error === "string").toBe(true);
    });
  });
});
