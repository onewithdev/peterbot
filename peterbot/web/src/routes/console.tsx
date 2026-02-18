/**
 * Dev Console Page - Full-screen Interactive Terminal
 *
 * A full-screen terminal interface for direct E2B sandbox access.
 * Features persistent sessions, command history, and execution control.
 *
 * ## Session Management
 *
 * - Session ID stored in localStorage for persistence across page reloads
 * - Sessions auto-expire after 5 minutes of inactivity (server-side)
 * - Manual reset creates a new session and kills the old one
 *
 * ## Usage
 *
 * Open via the sidebar Dev Console link (opens in new tab).
 * Type Python commands and press Enter to execute.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal, type TerminalHandle } from "@/components/terminal";
import { api } from "@/lib/api";
import { Loader2, X, Trash2, XCircle } from "lucide-react";

export const Route = createFileRoute("/console")({
  component: ConsolePage,
});

/**
 * ConsolePage component - Full-screen terminal with E2B sandbox access.
 */
function ConsolePage() {
  // Session ID from localStorage or newly generated
  const [sessionId, setSessionId] = useState<string>(() => {
    const stored = localStorage.getItem("console-session-id");
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem("console-session-id", newId);
    return newId;
  });

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);

  // Command history for up/down navigation
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  // Refs
  const terminalRef = useRef<TerminalHandle>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Write welcome message on mount
  useEffect(() => {
    const welcomeLines = [
      "",
      "╔══════════════════════════════════════════════════════════════╗",
      "║           🖥️  Welcome to peterbot Dev Console                ║",
      "╚══════════════════════════════════════════════════════════════╝",
      "",
      "Direct access to E2B sandbox. Type Python commands and press Enter.",
      "Session ID: " + sessionId.slice(0, 8) + "...",
      "",
      "> ",
    ];

    // Delay slightly to ensure terminal is ready
    const timer = setTimeout(() => {
      welcomeLines.forEach((line) => {
        terminalRef.current?.writeln(line);
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [sessionId]);

  /**
   * Handle a command from the terminal.
   */
  const handleCommand = useCallback(
    async (cmd: string) => {
      // Add to command history
      setCommandHistory((prev) => {
        // Avoid duplicates at the end
        if (prev.length > 0 && prev[prev.length - 1] === cmd) {
          return prev;
        }
        return [...prev, cmd];
      });

      setIsExecuting(true);

      // Create abort controller with 30 second timeout
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 30000);

      try {
        const response = await api.console.execute.$post(
          {
            json: { sessionId, code: cmd },
          },
          { init: { signal: abortControllerRef.current.signal } }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            "error" in errorData && typeof errorData.error === "string"
              ? errorData.error
              : "Unknown error";
          terminalRef.current?.write(
            `\r\n\x1b[91mError: ${errorMsg}\x1b[0m\r\n\r\n> `
          );
          return;
        }

        const result = await response.json();

        // Check for backend error
        if (result.error && typeof result.error === "string" && result.error.length > 0) {
          terminalRef.current?.write(
            `\r\n\x1b[91mError: ${result.error}\x1b[0m\r\n\r\n> `
          );
          return;
        }

        // Write stdout (green)
        if (result.stdout) {
          const lines = result.stdout.split("\n");
          lines.forEach((line) => {
            terminalRef.current?.writeln(`\x1b[92m${line}\x1b[0m`);
          });
        }

        // Write stderr (red/yellow)
        if (result.stderr) {
          const lines = result.stderr.split("\n");
          lines.forEach((line) => {
            terminalRef.current?.writeln(`\x1b[93m${line}\x1b[0m`);
          });
        }

        // Write prompt
        terminalRef.current?.write("\r\n> ");
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error) {
          if (error.name === "AbortError") {
            terminalRef.current?.write(
              "\r\n\x1b[93mExecution cancelled (timeout)\x1b[0m\r\n\r\n> "
            );
          } else {
            terminalRef.current?.write(
              `\r\n\x1b[91mError: ${error.message}\x1b[0m\r\n\r\n> `
            );
          }
        } else {
          terminalRef.current?.write(
            "\r\n\x1b[91mUnknown error occurred\x1b[0m\r\n\r\n> "
          );
        }
      } finally {
        setIsExecuting(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId]
  );

  /**
   * Clear the terminal and show a fresh prompt.
   */
  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
    terminalRef.current?.write(
      "\x1b[96mTerminal cleared.\x1b[0m\r\n\r\n> "
    );
  }, []);

  /**
   * Cancel the current execution.
   */
  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  /**
   * Reset the session - kill the sandbox and create a new session ID.
   */
  const handleReset = useCallback(async () => {
    setIsExecuting(true);

    try {
      await api.console.reset.$post({
        json: { sessionId },
      });

      // Generate new session ID
      const newId = crypto.randomUUID();
      localStorage.setItem("console-session-id", newId);
      setSessionId(newId);

      // Clear and show reset message
      terminalRef.current?.clear();
      terminalRef.current?.writeln("");
      terminalRef.current?.writeln(
        "\x1b[96mSession reset. New session started.\x1b[0m"
      );
      terminalRef.current?.writeln(`Session ID: ${newId.slice(0, 8)}...`);
      terminalRef.current?.writeln("");
      terminalRef.current?.write("> ");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reset session";
      terminalRef.current?.write(
        `\r\n\x1b[91mError: ${message}\x1b[0m\r\n\r\n> `
      );
    } finally {
      setIsExecuting(false);
    }
  }, [sessionId]);

  return (
    <div className="h-screen flex flex-col bg-[#1a202c] text-[#e2e8f0]">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-gray-700 bg-[#1a202c]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">🖥️ Dev Console</span>
          <span className="text-sm text-gray-400 ml-4">
            Session: {sessionId.slice(0, 8)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            title="Clear terminal"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </button>
          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
            title="Reset session (kill sandbox)"
          >
            <span className="h-4 w-4 flex items-center justify-center">↻</span>
            Reset
          </button>
          <button
            onClick={() => window.close()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
            title="Close console"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        </div>
      </header>

      {/* Warning Banner */}
      <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
        <p className="text-sm text-yellow-400 flex items-center gap-2">
          <span className="text-yellow-500">⚠️</span>
          Direct E2B sandbox access — blocklist restrictions do not apply here.
          Be careful with destructive commands.
        </p>
      </div>

      {/* Terminal */}
      <div className="flex-1 overflow-hidden p-2">
        <div className="h-full w-full rounded-lg border border-gray-700 bg-[#1a202c] overflow-hidden">
          <Terminal
            ref={terminalRef}
            onCommand={handleCommand}
            commandHistory={commandHistory}
            disabled={isExecuting}
          />
        </div>
      </div>

      {/* Executing Indicator */}
      {isExecuting && (
        <div className="h-10 flex items-center justify-between px-4 border-t border-gray-700 bg-[#1a202c]">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
            <span>Executing...</span>
          </div>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
          >
            <XCircle className="h-4 w-4" />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
