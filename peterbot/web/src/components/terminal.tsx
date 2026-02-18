/**
 * Terminal Component - xterm.js Wrapper
 *
 * A React component that wraps xterm.js terminal emulator and exposes
 * an imperative handle for parent components to write/clear/focus.
 *
 * Features:
 * - Full terminal emulator with custom dark theme
 * - Command history navigation (Up/Down arrows)
 * - Resize observer for auto-fit
 * - Imperative handle for external control
 */

import "xterm/css/xterm.css";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";

/**
 * Imperative handle interface exposed via ref.
 */
export interface TerminalHandle {
  /** Write text to the terminal (no newline) */
  write(text: string): void;
  /** Write text to the terminal with newline */
  writeln(text: string): void;
  /** Clear the terminal screen */
  clear(): void;
  /** Focus the terminal input */
  focus(): void;
}

/**
 * Props for the Terminal component.
 */
interface TerminalProps {
  /** Callback when user submits a command (presses Enter) */
  onCommand: (cmd: string) => void;
  /** Array of previous commands for history navigation */
  commandHistory: string[];
  /** Whether the terminal input should be disabled */
  disabled?: boolean;
}

/**
 * Terminal component wrapping xterm.js.
 *
 * Renders a full-featured terminal emulator that captures user input
 * and provides command history navigation.
 */
export const Terminal = forwardRef<TerminalHandle, TerminalProps>(
  ({ onCommand, commandHistory, disabled = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<XTerm | null>(null);
    const inputBufferRef = useRef("");
    const historyIndexRef = useRef(-1);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);

    // Expose imperative handle
    useImperativeHandle(ref, () => ({
      write: (text: string) => {
        terminalRef.current?.write(text);
      },
      writeln: (text: string) => {
        terminalRef.current?.writeln(text);
      },
      clear: () => {
        inputBufferRef.current = "";
        historyIndexRef.current = -1;
        terminalRef.current?.clear();
      },
      focus: () => {
        terminalRef.current?.focus();
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      // Create terminal instance with dark theme
      const terminal = new XTerm({
        theme: {
          background: "#1a202c",
          foreground: "#e2e8f0",
          cursor: "#48bb78",
          selectionBackground: "#2d3748",
          black: "#1a202c",
          red: "#f56565",
          green: "#48bb78",
          yellow: "#ecc94b",
          blue: "#4299e1",
          magenta: "#ed64a6",
          cyan: "#38b2ac",
          white: "#e2e8f0",
          brightBlack: "#4a5568",
          brightRed: "#fc8181",
          brightGreen: "#68d391",
          brightYellow: "#f6e05e",
          brightBlue: "#63b3ed",
          brightMagenta: "#f687b3",
          brightCyan: "#4fd1c5",
          brightWhite: "#f7fafc",
        },
        fontFamily: "Monaco, Courier New, monospace",
        fontSize: 14,
        cursorBlink: true,
        cursorStyle: "block",
      });

      // Create and load fit addon
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Open terminal in container
      terminal.open(containerRef.current);
      fitAddon.fit();

      // Setup resize observer
      resizeObserverRef.current = new ResizeObserver(() => {
        fitAddon.fit();
      });
      resizeObserverRef.current.observe(containerRef.current);

      // Store terminal reference
      terminalRef.current = terminal;

      // Handle key events
      terminal.onKey(({ key, domEvent }) => {
        if (disabled) return;

        const printable =
          !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

        switch (domEvent.key) {
          case "Enter": {
            const cmd = inputBufferRef.current.trim();
            if (cmd) {
              terminal.writeln("");
              onCommand(cmd);
              inputBufferRef.current = "";
              historyIndexRef.current = -1;
            } else {
              terminal.write("\r\n> ");
            }
            break;
          }

          case "Backspace": {
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              terminal.write("\b \b");
            }
            break;
          }

          case "ArrowUp": {
            domEvent.preventDefault();
            if (commandHistory.length === 0) return;

            const newIndex =
              historyIndexRef.current === -1
                ? commandHistory.length - 1
                : Math.max(0, historyIndexRef.current - 1);

            historyIndexRef.current = newIndex;
            const cmd = commandHistory[newIndex];

            // Clear current line and show command from history
            terminal.write("\r\x1b[K> " + cmd);
            inputBufferRef.current = cmd;
            break;
          }

          case "ArrowDown": {
            domEvent.preventDefault();
            if (
              commandHistory.length === 0 ||
              historyIndexRef.current === -1
            ) {
              return;
            }

            const newIndex = historyIndexRef.current + 1;

            if (newIndex >= commandHistory.length) {
              // Back to empty prompt
              historyIndexRef.current = -1;
              terminal.write("\r\x1b[K> ");
              inputBufferRef.current = "";
            } else {
              historyIndexRef.current = newIndex;
              const cmd = commandHistory[newIndex];
              terminal.write("\r\x1b[K> " + cmd);
              inputBufferRef.current = cmd;
            }
            break;
          }

          default: {
            if (printable && key.length === 1) {
              inputBufferRef.current += key;
              terminal.write(key);
            }
            break;
          }
        }
      });

      // Cleanup on unmount
      return () => {
        resizeObserverRef.current?.disconnect();
        terminal.dispose();
        terminalRef.current = null;
      };
    }, [onCommand, commandHistory, disabled]);

    return (
      <div
        ref={containerRef}
        style={{ height: "100%", width: "100%" }}
        className="overflow-hidden"
      />
    );
  }
);

Terminal.displayName = "Terminal";
