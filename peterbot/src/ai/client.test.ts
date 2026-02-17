import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { getModel } from "./client";

describe("AI Client", () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env to known state before each test
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MODEL;
  });

  // Restore original env after all tests
  afterAll(() => {
    Object.assign(process.env, originalEnv);
  });

  describe("getModel()", () => {
    test("throws if GOOGLE_API_KEY is missing", () => {
      expect(() => getModel()).toThrow("GOOGLE_API_KEY is required");
    });

    test("throws with helpful message when key is missing", () => {
      expect(() => getModel()).toThrow(/Set it in your \.env file/);
    });

    test("uses default model when MODEL env is not set", () => {
      process.env.GOOGLE_API_KEY = "test-api-key";
      
      // Should not throw - model object is returned
      const model = getModel();
      expect(model).toBeDefined();
      expect(model.modelId).toBe("gemini-2.5-flash");
    });

    test("uses custom model when MODEL env is set", () => {
      process.env.GOOGLE_API_KEY = "test-api-key";
      process.env.MODEL = "gemini-2.0-pro";
      
      // Should not throw - model object is returned
      const model = getModel();
      expect(model).toBeDefined();
      expect(model.modelId).toBe("gemini-2.0-pro");
    });

    test("handles empty string API key as missing", () => {
      process.env.GOOGLE_API_KEY = "";
      
      expect(() => getModel()).toThrow("GOOGLE_API_KEY is required");
    });
  });
});
