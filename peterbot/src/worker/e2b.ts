/**
 * E2B Sandbox Execution Module
 *
 * This module provides a client for executing Python code in ephemeral
 * cloud sandboxes via E2B (https://e2b.dev). It handles sandbox lifecycle,
 * code execution, output collection, and artifact downloading.
 *
 * ## Sandbox Lifecycle
 *
 * 1. Create ephemeral sandbox with 5-minute timeout
 * 2. Execute Python code
 * 3. Collect stdout, stderr, and any generated files
 * 4. Download files from /home/user/ to local storage
 * 5. Kill sandbox (automatic cleanup)
 *
 * The sandbox is ephemeral and auto-destroys after 5 minutes of inactivity,
 * ensuring no resource leaks even if cleanup fails.
 */

import { Sandbox } from "@e2b/code-interpreter";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { config } from "../shared/config.js";

/**
 * Result of a sandbox execution.
 */
export interface SandboxResult {
  /** Standard output from code execution */
  stdout: string;
  /** Standard error from code execution */
  stderr: string;
  /** Local file paths to downloaded artifacts */
  artifacts: string[];
  /** Error message if execution failed, null on success */
  error: string | null;
}

/**
 * Output directory for downloaded sandbox artifacts.
 */
const OUTPUT_DIR = "./storage/outputs";

/**
 * Sandbox timeout in milliseconds (5 minutes).
 */
const SANDBOX_TIMEOUT_MS = 300_000;

/**
 * Directory in the sandbox to scan for artifacts.
 */
const SANDBOX_USER_DIR = "/home/user";



/**
 * Execute Python code in an ephemeral E2B sandbox.
 *
 * @param code - The Python code to execute
 * @returns SandboxResult containing stdout, stderr, artifacts, and any error
 */
export async function runInSandbox(code: string): Promise<SandboxResult> {
  let sandbox: Sandbox | undefined;

  try {
    // Verify API key is configured (throws descriptive error if missing)
    const apiKey = config.e2bApiKey;

    // Create ephemeral sandbox with timeout
    sandbox = await Sandbox.create({
      apiKey,
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    console.log("[E2B] Sandbox created, executing code...");

    // Execute the Python code
    const execution = await sandbox.runCode(code);

    // Collect stdout and stderr from logs
    const stdout = execution.logs.stdout.join("\n");
    const stderr = execution.logs.stderr.join("\n");

    console.log(
      `[E2B] Execution complete. stdout: ${stdout.length} chars, stderr: ${stderr.length} chars`
    );

    // Download any files created in the sandbox
    const artifacts: string[] = [];

    // Ensure output directory exists
    mkdirSync(OUTPUT_DIR, { recursive: true });

    // List files in the user directory and download them
    try {
      const entries = await sandbox.files.list(SANDBOX_USER_DIR);

      for (const entry of entries) {
        // Only download files, not directories
        if (entry.type === "file") {
          const filename = entry.name;
          const remotePath = `${SANDBOX_USER_DIR}/${filename}`;
          const timestampedFilename = `${Date.now()}-${filename}`;
          const localPath = join(OUTPUT_DIR, timestampedFilename);

          try {
            // Download the file from the sandbox as bytes
            const fileContent = await sandbox.files.read(remotePath, {
              format: "bytes",
            });

            // Save to local storage
            await writeFile(localPath, fileContent);
            artifacts.push(localPath);

            console.log(`[E2B] Downloaded artifact: ${localPath}`);
          } catch (fileError) {
            console.error(
              `[E2B] Failed to download ${remotePath}:`,
              fileError
            );
          }
        }
      }
    } catch (listError) {
      console.error("[E2B] Failed to list sandbox files:", listError);
    }

    return {
      stdout,
      stderr,
      artifacts,
      error: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error("[E2B] Execution failed:", errorMessage);

    return {
      stdout: "",
      stderr: "",
      artifacts: [],
      error: errorMessage,
    };
  } finally {
    // Always kill the sandbox to ensure cleanup
    if (sandbox) {
      try {
        await sandbox.kill();
        console.log("[E2B] Sandbox killed");
      } catch (killError) {
        console.error("[E2B] Failed to kill sandbox:", killError);
      }
    }
  }
}
