/**
 * File Utilities for Dashboard Configuration
 *
 * Provides read/write operations for configuration files with:
 * - Atomic writes (write to temp, then rename)
 * - Automatic directory creation
 * - UTF-8 encoding
 * - Graceful handling of missing files
 *
 * ## Supported Files
 *
 * - soul.md - Personality configuration
 * - memory.md - User memory/facts
 * - config/blocklist.json - Command blocklist
 */

import { mkdir, readFile, writeFile, stat, access, rename, unlink } from "fs/promises";
import { dirname, join } from "path";

/**
 * Configuration file paths (relative to project root).
 */
export const CONFIG_PATHS = {
  soul: "soul.md",
  memory: "memory.md",
  blocklist: "config/blocklist.json",
} as const;

export type ConfigFileType = keyof typeof CONFIG_PATHS;

/**
 * Error class for file operation failures.
 */
export class FileOperationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: "read" | "write"
  ) {
    super(message);
    this.name = "FileOperationError";
  }
}

// For testing: allow overriding the project root
let _testProjectRoot: string | null = null;

/**
 * Set a custom project root for testing.
 * @internal
 */
export function _setTestProjectRoot(root: string | null): void {
  _testProjectRoot = root;
}

/**
 * Get the current project root directory.
 */
function getProjectRoot(): string {
  return _testProjectRoot ?? process.cwd();
}

/**
 * Resolve a configuration file path to absolute path.
 *
 * @param type - Configuration file type
 * @returns Absolute file path
 */
function resolvePath(type: ConfigFileType): string {
  return join(getProjectRoot(), CONFIG_PATHS[type]);
}

/**
 * Ensure a directory exists, creating it recursively if needed.
 *
 * @param filePath - File path to ensure directory for
 */
async function ensureDir(filePath: string): Promise<void> {
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
}

/**
 * Check if a file exists.
 *
 * @param filePath - Absolute file path
 * @returns True if file exists, false otherwise
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a configuration file.
 *
 * Returns null if the file doesn't exist (graceful handling).
 * Throws FileOperationError on read failures.
 *
 * @param type - Configuration file type
 * @returns File content as string, or null if file doesn't exist
 * @throws FileOperationError on read failure
 *
 * ## Usage
 *
 * ```typescript
 * const soulContent = await readConfigFile("soul");
 * if (soulContent !== null) {
 *   console.log("Soul config:", soulContent);
 * }
 * ```
 */
export async function readConfigFile(
  type: ConfigFileType
): Promise<string | null> {
  const filePath = resolvePath(type);

  // Return null if file doesn't exist (graceful)
  if (!(await fileExists(filePath))) {
    return null;
  }

  try {
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new FileOperationError(
      `Failed to read ${CONFIG_PATHS[type]}: ${message}`,
      filePath,
      "read"
    );
  }
}

/**
 * Read configuration file with fallback default.
 *
 * Returns default content if file doesn't exist.
 *
 * @param type - Configuration file type
 * @param defaultContent - Default content to return if file missing
 * @returns File content or default
 */
export async function readConfigFileWithDefault(
  type: ConfigFileType,
  defaultContent: string
): Promise<string> {
  const content = await readConfigFile(type);
  return content ?? defaultContent;
}

/**
 * Write a configuration file atomically.
 *
 * Uses atomic write pattern: write to temp file, then rename.
 * This ensures readers never see partial writes.
 * Creates parent directories if needed.
 *
 * @param type - Configuration file type
 * @param content - Content to write
 * @throws FileOperationError on write failure
 *
 * ## Usage
 *
 * ```typescript
 * await writeConfigFile("soul", "# New personality\nBe helpful.");
 * ```
 */
export async function writeConfigFile(
  type: ConfigFileType,
  content: string
): Promise<void> {
  const filePath = resolvePath(type);

  // Ensure parent directory exists
  await ensureDir(filePath);

  // Atomic write: write to temp file, then rename
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    await writeFile(tempPath, content, "utf-8");
    await rename(tempPath, filePath);
  } catch (error) {
    // Try to clean up temp file on error
    try {
      await unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new FileOperationError(
      `Failed to write ${CONFIG_PATHS[type]}: ${message}`,
      filePath,
      "write"
    );
  }
}

/**
 * Get file metadata (last modified time, size).
 *
 * @param type - Configuration file type
 * @returns File stats or null values if file doesn't exist
 */
export async function getConfigFileStats(type: ConfigFileType): Promise<{
  lastModified: Date | null;
  size: number;
}> {
  const filePath = resolvePath(type);

  if (!(await fileExists(filePath))) {
    return { lastModified: null, size: 0 };
  }

  try {
    const stats = await stat(filePath);
    return {
      lastModified: stats.mtime,
      size: stats.size,
    };
  } catch {
    return { lastModified: null, size: 0 };
  }
}

/**
 * Default content for configuration files.
 * Used when creating new files or resetting to defaults.
 */
export const DEFAULT_CONFIG_CONTENT: Record<ConfigFileType, string> = {
  soul: `# Peterbot Personality

## Tone
Professional but approachable. Efficient yet warm.

## Communication Style
- Be concise but thorough
- Use bullet points for complex information
- Ask clarifying questions when tasks are ambiguous

## Values
- Accuracy over speed
- Transparency about limitations
- Respect user's time
`,
  memory: `# Permanent Memory

# Add facts about the user here, one per line:
# - company = Acme Inc
# - timezone = PST
# - prefers_brief = true
`,
  blocklist: JSON.stringify(
    {
      enabled: true,
      strict: {
        patterns: [
          "rm\\s+-rf",
          "sudo\\s+.*",
          "mkfs.*",
          ">\\s*/dev/sd",
        ],
        action: "block",
        message: "This command is blocked in background tasks for safety.",
      },
      warn: {
        patterns: ["pip\\s+install", "apt-get", "npm\\s+install"],
        action: "warn",
        message: "This may take a while or require permissions.",
      },
    },
    null,
    2
  ),
};

/**
 * Suspicious content patterns that might indicate accidental writes.
 */
const SUSPICIOUS_PATTERNS = [
  /^test$/i,           // Just the word "test"
  /^hello$/i,          // Just "hello"
  /^temp$/i,           // Just "temp"
];

/**
 * Validate content before writing to prevent accidental overwrites.
 */
function validateConfigContent(type: ConfigFileType, content: string): void {
  const trimmed = content.trim();

  // Check for suspiciously short content
  if (trimmed.length < 10) {
    throw new FileOperationError(
      `Suspicious content for ${type}: content too short (${trimmed.length} chars). ` +
      `This might be an accidental write. Content: "${trimmed}"`,
      CONFIG_PATHS[type],
      "write"
    );
  }

  // Check for exact suspicious patterns
  if (SUSPICIOUS_PATTERNS.some(pattern => pattern.test(trimmed))) {
    throw new FileOperationError(
      `Suspicious content for ${type}: content matches pattern "${trimmed}". ` +
      `This might be an accidental write.`,
      CONFIG_PATHS[type],
      "write"
    );
  }
}

/**
 * Write config file with validation to prevent accidental overwrites.
 *
 * @param type - Configuration file type
 * @param content - Content to write
 * @param options - Options including validate flag
 * @throws FileOperationError on validation failure or write failure
 */
export async function writeConfigFileSafe(
  type: ConfigFileType,
  content: string,
  options: { validate?: boolean } = { validate: true }
): Promise<void> {
  if (options.validate) {
    validateConfigContent(type, content);
  }
  await writeConfigFile(type, content);
}

/**
 * Reset a configuration file to its default content.
 *
 * @param type - Configuration file type
 * @returns The default content that was written
 */
export async function resetConfigFile(type: ConfigFileType): Promise<string> {
  const content = DEFAULT_CONFIG_CONTENT[type];
  await writeConfigFile(type, content);
  return content;
}

/**
 * Validate blocklist JSON structure.
 *
 * @param content - JSON string to validate
 * @returns Parsed blocklist or throws error
 * @throws Error if invalid JSON or structure
 */
export function validateBlocklist(content: string): {
  enabled: boolean;
  strict: { patterns: string[]; action: string; message: string };
  warn: { patterns: string[]; action: string; message: string };
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Invalid JSON: blocklist must be valid JSON");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid structure: blocklist must be an object");
  }

  const obj = parsed as Record<string, unknown>;

  // Validate enabled flag (optional, defaults to true)
  if (obj.enabled !== undefined && typeof obj.enabled !== "boolean") {
    throw new Error("Invalid structure: 'enabled' must be a boolean");
  }

  // Validate strict block
  if (!obj.strict || typeof obj.strict !== "object") {
    throw new Error("Invalid structure: missing 'strict' block");
  }

  // Validate warn block
  if (!obj.warn || typeof obj.warn !== "object") {
    throw new Error("Invalid structure: missing 'warn' block");
  }

  return parsed as {
    enabled: boolean;
    strict: { patterns: string[]; action: string; message: string };
    warn: { patterns: string[]; action: string; message: string };
  };
}
