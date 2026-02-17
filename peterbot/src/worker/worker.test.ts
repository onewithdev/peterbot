import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { buildSystemPrompt, shouldUseE2B, checkBlocklist } from "./worker";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

// Test directory for blocklist tests
const TEST_CONFIG_DIR = join(process.cwd(), "test-temp", "config");
const TEST_BLOCKLIST_PATH = join(TEST_CONFIG_DIR, "blocklist.json");

// Helper to write test blocklist
async function writeTestBlocklist(content: object): Promise<void> {
  await mkdir(TEST_CONFIG_DIR, { recursive: true });
  await writeFile(TEST_BLOCKLIST_PATH, JSON.stringify(content, null, 2));
}

// Helper to clean up test blocklist
async function cleanupTestBlocklist(): Promise<void> {
  try {
    await rm(TEST_CONFIG_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe("Worker", () => {
  describe("buildSystemPrompt()", () => {
    test("returns a non-empty string containing 'peterbot'", async () => {
      const prompt = await buildSystemPrompt();
      expect(typeof prompt).toBe("string");
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt.toLowerCase()).toContain("peterbot");
    });

    test("includes current date context", async () => {
      const prompt = await buildSystemPrompt();
      const today = new Date().toDateString();
      expect(prompt).toContain(today);
    });

    test("contains instructions for code execution", async () => {
      const prompt = await buildSystemPrompt();
      expect(prompt.toLowerCase()).toContain("runCode".toLowerCase());
    });

    test("mentions Markdown formatting", async () => {
      const prompt = await buildSystemPrompt();
      expect(prompt.toLowerCase()).toContain("markdown");
    });
  });

  describe("shouldUseE2B()", () => {
    test("detects code-execution keywords - csv", () => {
      expect(shouldUseE2B("Please analyze this CSV file")).toBe(true);
    });

    test("detects code-execution keywords - chart", () => {
      expect(shouldUseE2B("Create a chart of the data")).toBe(true);
    });

    test("detects code-execution keywords - graph", () => {
      expect(shouldUseE2B("Plot a graph of sales")).toBe(true);
    });

    test("detects code-execution keywords - plot", () => {
      expect(shouldUseE2B("Plot the temperature over time")).toBe(true);
    });

    test("detects code-execution keywords - script", () => {
      expect(shouldUseE2B("Write a Python script to parse JSON")).toBe(true);
    });

    test("detects code-execution keywords - code", () => {
      expect(shouldUseE2B("Generate code for sorting")).toBe(true);
    });

    test("detects code-execution keywords - calculate", () => {
      expect(shouldUseE2B("Calculate the average")).toBe(true);
    });

    test("detects code-execution keywords - scrape", () => {
      expect(shouldUseE2B("Scrape the website")).toBe(true);
    });

    test("detects code-execution keywords - download", () => {
      expect(shouldUseE2B("Download the file from API")).toBe(true);
    });

    test("detects code-execution keywords - data", () => {
      expect(shouldUseE2B("Process this data")).toBe(true);
    });

    test("detects code-execution keywords - analysis", () => {
      expect(shouldUseE2B("Do an analysis of the dataset")).toBe(true);
    });

    test("detects code-execution keywords - analyze", () => {
      expect(shouldUseE2B("Analyze the results")).toBe(true);
    });

    test("detects code-execution keywords - analyse (British spelling)", () => {
      expect(shouldUseE2B("Analyse the survey results")).toBe(true);
    });

    test("detects code-execution keywords - spreadsheet", () => {
      expect(shouldUseE2B("Create a spreadsheet")).toBe(true);
    });

    test("detects code-execution keywords - excel", () => {
      expect(shouldUseE2B("Generate an Excel report")).toBe(true);
    });

    test("detects code-execution keywords - json", () => {
      expect(shouldUseE2B("Parse this JSON")).toBe(true);
    });

    test("detects code-execution keywords - api call", () => {
      expect(shouldUseE2B("Make an API call")).toBe(true);
    });

    test("detects code-execution keywords - fetch", () => {
      expect(shouldUseE2B("Fetch data from the server")).toBe(true);
    });

    test("returns false for text-only tasks - summary", () => {
      expect(shouldUseE2B("Give me a summary of this article")).toBe(false);
    });

    test("returns false for text-only tasks - research", () => {
      expect(shouldUseE2B("Research the history of Rome")).toBe(false);
    });

    test("returns false for text-only tasks - explain", () => {
      expect(shouldUseE2B("Explain quantum physics")).toBe(false);
    });

    test("returns false for simple questions", () => {
      expect(shouldUseE2B("What is the capital of France?")).toBe(false);
    });

    test("is case-insensitive", () => {
      expect(shouldUseE2B("ANALYZE THE DATA")).toBe(true);
      expect(shouldUseE2B("calculate the SUM")).toBe(true);
      expect(shouldUseE2B("CSV File")).toBe(true);
    });

    test("handles empty string", () => {
      expect(shouldUseE2B("")).toBe(false);
    });

    test("handles multiple keywords", () => {
      expect(shouldUseE2B("Download the CSV and analyze the data")).toBe(true);
    });
  });

  describe("checkBlocklist()", () => {
    const originalCwd = process.cwd;

    beforeEach(async () => {
      // Mock process.cwd to return test directory
      process.cwd = () => join(TEST_CONFIG_DIR, "..");
      await cleanupTestBlocklist();
    });

    afterEach(async () => {
      process.cwd = originalCwd;
      await cleanupTestBlocklist();
    });

    test("returns blocked: false when no blocklist file exists", () => {
      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(false);
    });

    test("blocks code matching strict patterns", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "This command is blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("This command is blocked!");
    });

    test("allows code not matching any patterns", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "This command is blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("echo hello");
      expect(result.blocked).toBe(false);
    });

    test("returns blocked: false when enabled is false", async () => {
      await writeTestBlocklist({
        enabled: false,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "This command is blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(false);
    });

    test("returns warn: true when matching warn patterns", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: [],
          action: "block",
          message: "Blocked!",
        },
        warn: {
          patterns: ["pip\\s+install"],
          action: "warn",
          message: "This may take a while!",
        },
      });

      const result = checkBlocklist("pip install requests");
      expect(result.blocked).toBe(false);
      expect(result.warn).toBe(true);
      expect(result.warnMessage).toBe("This may take a while!");
    });

    test("strict patterns take precedence over warn patterns", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "Blocked!",
        },
        warn: {
          patterns: ["rm"],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe("Blocked!");
      // Should not check warn patterns if blocked
      expect(result.warn).toBeUndefined();
    });

    test("handles invalid regex patterns gracefully", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: ["[invalid", "rm\\s+-rf"],
          action: "block",
          message: "Blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(true);
    });

    test("handles invalid JSON gracefully", async () => {
      await mkdir(TEST_CONFIG_DIR, { recursive: true });
      await writeFile(TEST_BLOCKLIST_PATH, "not valid json");

      const result = checkBlocklist("rm -rf /");
      expect(result.blocked).toBe(false);
    });

    test("is case-insensitive", async () => {
      await writeTestBlocklist({
        enabled: true,
        strict: {
          patterns: ["rm\\s+-rf"],
          action: "block",
          message: "Blocked!",
        },
        warn: {
          patterns: [],
          action: "warn",
          message: "Warning!",
        },
      });

      const result = checkBlocklist("RM -RF /");
      expect(result.blocked).toBe(true);
    });
  });
});
