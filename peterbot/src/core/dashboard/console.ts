/**
 * Console Service - Persistent Sandbox Session Manager
 *
 * This module provides persistent E2B sandbox sessions for the Dev Console.
 * Unlike the ephemeral sandbox in worker/e2b.ts, these sessions persist across
 * code executions, maintaining state between commands.
 *
 * ## Session Lifecycle
 *
 * 1. Session created on first executeInSession() call with a sessionId
 * 2. Session persists for 5 minutes of inactivity (lastUsed timestamp)
 * 3. Cleanup interval runs every 60 seconds to kill expired sessions
 * 4. Sessions can be manually reset via resetSession()
 *
 * ## Usage
 *
 * ```typescript
 * const { stdout, stderr, error } = await executeInSession(sessionId, code);
 * await resetSession(sessionId); // Kill and remove session
 * ```
 */

import { Sandbox } from "@e2b/code-interpreter";

/**
 * Session timeout in milliseconds (5 minutes of inactivity).
 */
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Cleanup interval in milliseconds (60 seconds).
 */
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Sandbox timeout setting in milliseconds (5 minutes).
 */
const SANDBOX_TIMEOUT_MS = 300_000;

/**
 * A persistent sandbox session with metadata.
 */
interface Session {
  /** The E2B sandbox instance */
  sandbox: Sandbox;
  /** When the session was created */
  createdAt: Date;
  /** When the session was last used */
  lastUsed: Date;
}

/**
 * Module-level session storage keyed by sessionId.
 */
const sessions = new Map<string, Session>();

/**
 * Cleanup interval that removes expired sessions.
 * Runs every 60 seconds and kills sandboxes that haven't been used for 5 minutes.
 */
setInterval(() => {
  const now = Date.now();
  const expiredSessions: string[] = [];

  // Find expired sessions
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastUsed.getTime() > SESSION_TIMEOUT_MS) {
      expiredSessions.push(sessionId);
    }
  }

  // Kill and remove expired sessions
  for (const sessionId of expiredSessions) {
    const session = sessions.get(sessionId);
    if (session) {
      console.log(`[Console] Cleaning up expired session: ${sessionId}`);
      session.sandbox
        .kill()
        .catch((err) => {
          console.error(`[Console] Failed to kill session ${sessionId}:`, err);
        });
      sessions.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Execute code in a persistent sandbox session.
 *
 * If the session doesn't exist, a new sandbox is created.
 * The sandbox persists after execution for subsequent commands.
 *
 * @param sessionId - Unique identifier for the session
 * @param code - Python code to execute
 * @returns Object containing stdout, stderr, and any error
 */
export async function executeInSession(
  sessionId: string,
  code: string
): Promise<{ stdout: string; stderr: string; error: string | null }> {
  try {
    // Look up existing session or create new one
    let session = sessions.get(sessionId);

    if (!session) {
      console.log(`[Console] Creating new session: ${sessionId}`);
      const sandbox = await Sandbox.create({
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });

      session = {
        sandbox,
        createdAt: new Date(),
        lastUsed: new Date(),
      };

      sessions.set(sessionId, session);
    }

    // Update last used timestamp
    session.lastUsed = new Date();

    // Execute the code
    console.log(`[Console] Executing code in session ${sessionId}`);
    const execution = await session.sandbox.runCode(code);

    // Collect output
    const stdout = execution.logs.stdout.join("\n");
    const stderr = execution.logs.stderr.join("\n");

    // Capture Python errors (NameError, etc.) from execution.error
    const pythonError = execution.error
      ? `${execution.error.name}: ${execution.error.value}`
      : null;

    console.log(
      `[Console] Execution complete. stdout: ${stdout.length} chars, stderr: ${stderr.length} chars, error: ${pythonError ?? "none"}`
    );

    return { stdout, stderr: stderr || pythonError || "", error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Console] Execution failed in session ${sessionId}:`, message);
    return { stdout: "", stderr: "", error: message };
  }
}

/**
 * Get the status of a session.
 *
 * Returns whether the session exists and when it was created/last used.
 *
 * @param sessionId - Unique identifier for the session
 * @returns Object containing exists flag and optional timestamps
 */
export function getSessionStatus(sessionId: string): { exists: boolean; createdAt?: Date; lastUsed?: Date } {
  const session = sessions.get(sessionId);
  if (session) {
    return {
      exists: true,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
    };
  }
  return { exists: false };
}

/**
 * Reset (kill) a persistent sandbox session.
 *
 * Removes the session from memory and kills the underlying sandbox.
 * A new sandbox will be created on the next executeInSession() call.
 *
 * @param sessionId - Unique identifier for the session to reset
 */
export async function resetSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);

  if (session) {
    console.log(`[Console] Resetting session: ${sessionId}`);

    // Kill the sandbox
    try {
      await session.sandbox.kill();
      console.log(`[Console] Session killed: ${sessionId}`);
    } catch (error) {
      console.error(`[Console] Failed to kill session ${sessionId}:`, error);
    }

    // Remove from map
    sessions.delete(sessionId);
  }
}
