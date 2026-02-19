import { describe, test, expect } from "bun:test";
import {
  encodeCallbackData,
  parseCallbackData,
  isCallbackExpired,
  getButtonsForContext,
  buildInlineKeyboard,
  type ButtonContext,
  type TaskCompletedData,
} from "./buttons";

describe("getButtonsForContext", () => {
  test("returns exactly 3 buttons for task_completed with correct labels", () => {
    const data: TaskCompletedData = { jobIdPrefix: "a3f9b12c" };
    const buttons = getButtonsForContext("task_completed", data);

    expect(buttons).toHaveLength(3);
    expect(buttons[0].label).toBe("📅 Schedule this");
    expect(buttons[1].label).toBe("💾 Save solution");
    expect(buttons[2].label).toBe("❔ Help");
  });

  test("returns exactly 2 buttons for schedule_created", () => {
    const buttons = getButtonsForContext("schedule_created");

    expect(buttons).toHaveLength(2);
    expect(buttons[0].label).toBe("📅 View all schedules");
    expect(buttons[1].label).toBe("❔ Help");
  });

  test("returns exactly 3 buttons for start", () => {
    const buttons = getButtonsForContext("start");

    expect(buttons).toHaveLength(3);
    expect(buttons[0].label).toBe("📅 View schedules");
    expect(buttons[1].label).toBe("📚 View solutions");
    expect(buttons[2].label).toBe("❔ Help");
  });

  test("task_completed buttons encode the jobIdPrefix in callbackData for schedule and save actions", () => {
    const data: TaskCompletedData = { jobIdPrefix: "a3f9b12c" };
    const buttons = getButtonsForContext("task_completed", data);

    // First button should be schedule with prefix
    expect(buttons[0].callbackData).toBe("schedule:a3f9b12c");
    // Second button should be save with prefix
    expect(buttons[1].callbackData).toBe("save:a3f9b12c");
    // Third button should be help without prefix
    expect(buttons[2].callbackData).toBe("help");
  });

  test("throws error when jobIdPrefix is not provided for task_completed context", () => {
    expect(() => getButtonsForContext("task_completed")).toThrow(
      "jobIdPrefix is required for task_completed context"
    );
  });
});

describe("encodeCallbackData / parseCallbackData round-trip", () => {
  test("encodeCallbackData('help') returns 'help', parses back to { action: 'help' }", () => {
    const encoded = encodeCallbackData("help");
    expect(encoded).toBe("help");

    const parsed = parseCallbackData(encoded);
    expect(parsed).toEqual({ action: "help" });
    expect(parsed.jobIdPrefix).toBeUndefined();
  });

  test("encodeCallbackData('schedule', 'a3f9b12c') returns 'schedule:a3f9b12c', parses back correctly", () => {
    const encoded = encodeCallbackData("schedule", "a3f9b12c");
    expect(encoded).toBe("schedule:a3f9b12c");

    const parsed = parseCallbackData(encoded);
    expect(parsed).toEqual({ action: "schedule", jobIdPrefix: "a3f9b12c" });
  });

  test("encodeCallbackData('schedules') returns 'schedules', parses back to { action: 'schedules' }", () => {
    const encoded = encodeCallbackData("schedules");
    expect(encoded).toBe("schedules");

    const parsed = parseCallbackData(encoded);
    expect(parsed).toEqual({ action: "schedules" });
    expect(parsed.jobIdPrefix).toBeUndefined();
  });

  test("parseCallbackData handles multiple colons by splitting on first one only", () => {
    const data = "action:prefix:extra";
    const parsed = parseCallbackData(data);
    expect(parsed.action).toBe("action");
    expect(parsed.jobIdPrefix).toBe("prefix:extra");
  });

  test("encodeCallbackData throws when data exceeds 64 bytes", () => {
    const longPrefix = "a".repeat(100);
    expect(() => encodeCallbackData("schedule", longPrefix)).toThrow(
      "Callback data exceeds 64 byte limit"
    );
  });
});

describe("isCallbackExpired", () => {
  test("returns false for current time (fresh)", () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isCallbackExpired(nowSeconds)).toBe(false);
  });

  test("returns true for time 400 seconds ago (stale, >5 min)", () => {
    const staleSeconds = Math.floor(Date.now() / 1000) - 400;
    expect(isCallbackExpired(staleSeconds)).toBe(true);
  });

  test("returns false for exactly 299 seconds ago (within window)", () => {
    const recentSeconds = Math.floor(Date.now() / 1000) - 299;
    expect(isCallbackExpired(recentSeconds)).toBe(false);
  });

  test("returns true for exactly 300 seconds ago (at boundary)", () => {
    const boundarySeconds = Math.floor(Date.now() / 1000) - 300;
    // 300 seconds is NOT > 300, so it should be false (still valid)
    expect(isCallbackExpired(boundarySeconds)).toBe(false);
  });

  test("returns true for 301 seconds ago (just past boundary)", () => {
    const pastBoundarySeconds = Math.floor(Date.now() / 1000) - 301;
    expect(isCallbackExpired(pastBoundarySeconds)).toBe(true);
  });
});

describe("buildInlineKeyboard", () => {
  test("creates InlineKeyboard with correct number of buttons", () => {
    const buttons = [
      { label: "Button 1", callbackData: "action1" },
      { label: "Button 2", callbackData: "action2" },
    ];

    const keyboard = buildInlineKeyboard(buttons);

    // InlineKeyboard has an inline_keyboard property which is an array of rows
    expect(keyboard.inline_keyboard).toBeDefined();
    expect(keyboard.inline_keyboard).toHaveLength(1); // All buttons in one row
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
  });

  test("empty buttons array creates keyboard with empty row", () => {
    const keyboard = buildInlineKeyboard([]);
    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(0);
  });
});
