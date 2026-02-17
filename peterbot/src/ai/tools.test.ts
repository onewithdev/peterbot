import { describe, test, expect } from "bun:test";
import { peterbotTools } from "./tools";

describe("AI Tools", () => {
  describe("runCode tool", () => {
    test("is exported in peterbotTools", () => {
      expect(peterbotTools.runCode).toBeDefined();
    });

    test("has required description", () => {
      expect(peterbotTools.runCode.description).toBeString();
      expect(peterbotTools.runCode.description.length).toBeGreaterThan(0);
    });

    test("has parameters schema", () => {
      expect(peterbotTools.runCode.parameters).toBeDefined();
    });

    test("accepts valid parameters", () => {
      const validInput = {
        code: "print('hello')",
        reasoning: "Testing basic print functionality",
      };

      const result = peterbotTools.runCode.parameters.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test("rejects missing code parameter", () => {
      const invalidInput = {
        reasoning: "Missing the actual code",
      };

      const result = peterbotTools.runCode.parameters.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    test("rejects missing reasoning parameter", () => {
      const invalidInput = {
        code: "print('hello')",
      };

      const result = peterbotTools.runCode.parameters.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    test("accepts empty code string (schema allows it)", () => {
      // Note: Schema uses z.string() without .min(1), so empty strings are valid
      // The AI will handle empty code gracefully in execution
      const input = {
        code: "",
        reasoning: "Empty code test",
      };

      const result = peterbotTools.runCode.parameters.safeParse(input);
      expect(result.success).toBe(true);
    });

    test("accepts empty reasoning string (schema allows it)", () => {
      // Note: Schema uses z.string() without .min(1)
      const input = {
        code: "print('hello')",
        reasoning: "",
      };

      const result = peterbotTools.runCode.parameters.safeParse(input);
      expect(result.success).toBe(true);
    });

    test("accepts multi-line code", () => {
      const validInput = {
        code: `
import pandas as pd
import matplotlib.pyplot as plt

# Create sample data
data = {'x': [1, 2, 3], 'y': [4, 5, 6]}
df = pd.DataFrame(data)

# Save plot
plt.plot(df['x'], df['y'])
plt.savefig('chart.png')
        `.trim(),
        reasoning: "Creating a data visualization with pandas and matplotlib",
      };

      const result = peterbotTools.runCode.parameters.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    test("has execute function", () => {
      expect(peterbotTools.runCode.execute).toBeFunction();
    });
  });

  describe("peterbotTools export", () => {
    test("contains only expected tools", () => {
      const toolNames = Object.keys(peterbotTools);
      expect(toolNames).toContain("runCode");
      expect(toolNames).toHaveLength(1);
    });
  });
});
