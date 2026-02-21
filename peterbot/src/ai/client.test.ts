import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { getModel } from "./client";
import * as providerFactory from "./provider-factory.js";

describe("AI Client", () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env to known state before each test
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.MODEL;
  });

  describe("getModel()", () => {
    test("returns a model from the factory when API key is available", async () => {
      // Mock the factory to return a fake model
      const mockModel = { modelId: "claude-sonnet-4-5-20250929" };
      const factorySpy = spyOn(providerFactory, "getModel").mockResolvedValue(
        mockModel as any
      );

      const model = await getModel();

      expect(model).toBeDefined();
      expect(model.modelId).toBe("claude-sonnet-4-5-20250929");
      expect(factorySpy).toHaveBeenCalled();

      factorySpy.mockRestore();
    });

    test("throws error when no API key is configured", async () => {
      // Mock the factory to throw an error (no keys available)
      const factorySpy = spyOn(providerFactory, "getModel").mockRejectedValue(
        new Error(
          "No valid API key found for any AI provider. " +
            "Tried providers: anthropic, google, zai, moonshot. " +
            "Please either:\n" +
            "1. Add an API key via the Settings UI (dashboard), or\n" +
            "2. Set one of these environment variables: ANTHROPIC_API_KEY, GOOGLE_API_KEY, ZAI_API_KEY, MOONSHOT_API_KEY"
        )
      );

      await expect(getModel()).rejects.toThrow(/No valid API key found/);

      factorySpy.mockRestore();
    });

    test("supports Anthropic provider via factory", async () => {
      // Seed a fake Anthropic key environment variable and mock factory
      process.env.ANTHROPIC_API_KEY = "test-anthropic-key";

      const mockModel = { modelId: "claude-sonnet-4-5-20250929" };
      const factorySpy = spyOn(providerFactory, "getModel").mockResolvedValue(
        mockModel as any
      );

      const model = await getModel();

      expect(model).toBeDefined();
      expect(factorySpy).toHaveBeenCalled();

      factorySpy.mockRestore();
    });

    test("supports Google provider via factory fallback", async () => {
      // Mock factory to simulate Google fallback
      const mockModel = { modelId: "gemini-2.5-flash" };
      const factorySpy = spyOn(providerFactory, "getModel").mockResolvedValue(
        mockModel as any
      );

      const model = await getModel();

      expect(model).toBeDefined();
      expect(model.modelId).toBe("gemini-2.5-flash");

      factorySpy.mockRestore();
    });

    test("delegates to provider factory for DB-first resolution", async () => {
      // Mock the factory to verify it's being called
      const mockModel = { modelId: "test-model" };
      const factorySpy = spyOn(providerFactory, "getModel").mockResolvedValue(
        mockModel as any
      );

      await getModel();

      // Verify the factory was called
      expect(factorySpy).toHaveBeenCalledTimes(1);

      factorySpy.mockRestore();
    });
  });
});
