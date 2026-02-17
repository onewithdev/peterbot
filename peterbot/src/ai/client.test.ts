import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { getModel } from "./client";

describe("AI Client", () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env to known state before each test
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.MODEL;
  });

  // Restore original env after all tests
  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("getModel()", () => {
    test("throws if ANTHROPIC_API_KEY is missing", () => {
      expect(() => getModel()).toThrow("ANTHROPIC_API_KEY is required");
    });

    test("throws with helpful message when key is missing", () => {
      expect(() => getModel()).toThrow(/Set it in your \.env file/);
    });

    test("uses default model when MODEL env is not set", () => {
      process.env.ANTHROPIC_API_KEY = "test-api-key";
      
      // Should not throw - model object is returned
      const model = getModel();
      expect(model).toBeDefined();
      expect(model.modelId).toBe("claude-sonnet-4-5-20250929");
    });

    test("uses custom model when MODEL env is set", () => {
      process.env.ANTHROPIC_API_KEY = "test-api-key";
      process.env.MODEL = "claude-opus-4";
      
      // Should not throw - model object is returned
      const model = getModel();
      expect(model).toBeDefined();
      expect(model.modelId).toBe("claude-opus-4");
    });

    test("handles empty string API key as missing", () => {
      process.env.ANTHROPIC_API_KEY = "";
      
      expect(() => getModel()).toThrow("ANTHROPIC_API_KEY is required");
    });
  });
});
