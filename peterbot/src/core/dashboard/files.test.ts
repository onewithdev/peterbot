/**
 * Tests for File Utilities
 *
 * @module src/core/dashboard/files.test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, access } from "fs/promises";
import { join } from "path";
import {
  readConfigFile,
  writeConfigFile,
  getConfigFileStats,
  validateBlocklist,
  DEFAULT_CONFIG_CONTENT,
  FileOperationError,
  _setTestProjectRoot,
  type ConfigFileType,
} from "./files.js";

// Test directory for file operations
const TEST_BASE_DIR = join(process.cwd(), "test-temp");

// Helper to create unique test directory
async function createTestDir(): Promise<string> {
  const testDir = join(TEST_BASE_DIR, `test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

describe("readConfigFile", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    _setTestProjectRoot(testDir);
  });

  afterEach(async () => {
    _setTestProjectRoot(null);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return null for non-existent file", async () => {
    const content = await readConfigFile("soul");
    expect(content).toBeNull();
  });

  it("should read existing file content", async () => {
    const testContent = "# Test Soul Configuration\nBe helpful.";
    await writeConfigFile("soul", testContent);

    const content = await readConfigFile("soul");
    expect(content).toBe(testContent);
  });

  it("should read memory.md file", async () => {
    const testContent = "# Memory\n- User likes coffee";
    await writeConfigFile("memory", testContent);

    const content = await readConfigFile("memory");
    expect(content).toBe(testContent);
  });

  it("should read blocklist.json file", async () => {
    const testContent = JSON.stringify({ test: true });
    await writeConfigFile("blocklist", testContent);

    const content = await readConfigFile("blocklist");
    expect(content).toBe(testContent);
  });
});

describe("writeConfigFile", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    _setTestProjectRoot(testDir);
  });

  afterEach(async () => {
    _setTestProjectRoot(null);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should create file with content", async () => {
    const testContent = "# New Config";
    await writeConfigFile("soul", testContent);

    const content = await readConfigFile("soul");
    expect(content).toBe(testContent);
  });

  it("should overwrite existing file", async () => {
    await writeConfigFile("soul", "Original content");
    const newContent = "Updated content";
    await writeConfigFile("soul", newContent);

    const content = await readConfigFile("soul");
    expect(content).toBe(newContent);
  });

  it("should create parent directory if needed", async () => {
    const testContent = "{}";
    await writeConfigFile("blocklist", testContent);

    // Verify config directory was created
    const configDir = join(testDir, "config");
    const dirExists = await access(configDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);

    const content = await readConfigFile("blocklist");
    expect(content).toBe(testContent);
  });

  it("should handle empty content", async () => {
    await writeConfigFile("soul", "");

    const content = await readConfigFile("soul");
    expect(content).toBe("");
  });

  it("should handle unicode content", async () => {
    const testContent = "# 你好世界 🎉 émojis";
    await writeConfigFile("soul", testContent);

    const content = await readConfigFile("soul");
    expect(content).toBe(testContent);
  });
});

describe("getConfigFileStats", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    _setTestProjectRoot(testDir);
  });

  afterEach(async () => {
    _setTestProjectRoot(null);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should return null lastModified for non-existent file", async () => {
    const stats = await getConfigFileStats("soul");
    expect(stats.lastModified).toBeNull();
    expect(stats.size).toBe(0);
  });

  it("should return stats for existing file", async () => {
    const testContent = "Test content";
    await writeConfigFile("soul", testContent);

    const stats = await getConfigFileStats("soul");
    expect(stats.lastModified).toBeInstanceOf(Date);
    expect(stats.size).toBe(testContent.length);
  });

  it("should update stats after modification", async () => {
    await writeConfigFile("soul", "Original");
    const stats1 = await getConfigFileStats("soul");

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 50));

    await writeConfigFile("soul", "Modified content here");
    const stats2 = await getConfigFileStats("soul");

    expect(stats2.size).toBeGreaterThan(stats1.size);
    expect(stats2.lastModified!.getTime()).toBeGreaterThanOrEqual(
      stats1.lastModified!.getTime()
    );
  });
});

describe("validateBlocklist", () => {
  it("should validate correct blocklist structure", () => {
    const validBlocklist = JSON.stringify({
      strict: {
        patterns: ["rm -rf", "sudo"],
        action: "block",
        message: "Blocked!",
      },
      warn: {
        patterns: ["pip install"],
        action: "warn",
        message: "Warning!",
      },
    });

    const result = validateBlocklist(validBlocklist);
    expect(result.strict.patterns).toEqual(["rm -rf", "sudo"]);
    expect(result.warn.patterns).toEqual(["pip install"]);
  });

  it("should throw for invalid JSON", () => {
    expect(() => validateBlocklist("not valid json")).toThrow("Invalid JSON");
  });

  it("should throw for non-object JSON", () => {
    expect(() => validateBlocklist("[]")).toThrow("Invalid structure");
    expect(() => validateBlocklist('"string"')).toThrow("Invalid structure");
  });

  it("should throw for missing strict block", () => {
    const invalid = JSON.stringify({
      warn: { patterns: [], action: "warn", message: "" },
    });
    expect(() => validateBlocklist(invalid)).toThrow("missing 'strict'");
  });

  it("should throw for missing warn block", () => {
    const invalid = JSON.stringify({
      strict: { patterns: [], action: "block", message: "" },
    });
    expect(() => validateBlocklist(invalid)).toThrow("missing 'warn'");
  });

  it("should handle empty patterns array", () => {
    const validBlocklist = JSON.stringify({
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

    const result = validateBlocklist(validBlocklist);
    expect(result.strict.patterns).toEqual([]);
    expect(result.warn.patterns).toEqual([]);
  });
});

describe("DEFAULT_CONFIG_CONTENT", () => {
  it("should have default soul content", () => {
    expect(DEFAULT_CONFIG_CONTENT.soul).toContain("Peterbot Personality");
    expect(DEFAULT_CONFIG_CONTENT.soul).toContain("Tone");
  });

  it("should have default memory content", () => {
    expect(DEFAULT_CONFIG_CONTENT.memory).toContain("Permanent Memory");
  });

  it("should have valid JSON blocklist", () => {
    const parsed = JSON.parse(DEFAULT_CONFIG_CONTENT.blocklist);
    expect(parsed.strict).toBeDefined();
    expect(parsed.warn).toBeDefined();
    expect(Array.isArray(parsed.strict.patterns)).toBe(true);
    expect(Array.isArray(parsed.warn.patterns)).toBe(true);
  });

  it("should have blocklist with regex patterns", () => {
    const parsed = JSON.parse(DEFAULT_CONFIG_CONTENT.blocklist);
    // Should have some dangerous patterns
    expect(parsed.strict.patterns.length).toBeGreaterThan(0);
    // Verify patterns are valid regex (should not throw)
    for (const pattern of parsed.strict.patterns) {
      expect(() => new RegExp(pattern)).not.toThrow();
    }
  });
});

describe("FileOperationError", () => {
  it("should create error with correct properties", () => {
    const error = new FileOperationError("Test error", "/path/to/file", "read");
    expect(error.message).toBe("Test error");
    expect(error.path).toBe("/path/to/file");
    expect(error.operation).toBe("read");
    expect(error.name).toBe("FileOperationError");
  });
});

describe("Concurrent file operations", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await createTestDir();
    _setTestProjectRoot(testDir);
  });

  afterEach(async () => {
    _setTestProjectRoot(null);
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should handle multiple reads of same file", async () => {
    await writeConfigFile("soul", "Test content");

    const [read1, read2, read3] = await Promise.all([
      readConfigFile("soul"),
      readConfigFile("soul"),
      readConfigFile("soul"),
    ]);

    expect(read1).toBe("Test content");
    expect(read2).toBe("Test content");
    expect(read3).toBe("Test content");
  });

  it("should handle sequential writes gracefully", async () => {
    // Write different content sequentially to avoid race conditions
    await writeConfigFile("soul", "Content A");
    await writeConfigFile("soul", "Content B");
    await writeConfigFile("soul", "Content C");

    // File should exist with last written content
    const content = await readConfigFile("soul");
    expect(content).toBe("Content C");
  });
});
