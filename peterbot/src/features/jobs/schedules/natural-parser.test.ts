import { describe, test, expect } from "bun:test";
import { calculateNextRun } from "./natural-parser";

describe("Natural Parser", () => {
  describe("calculateNextRun()", () => {
    test("returns a Monday at 09:00 for '0 9 * * 1'", () => {
      // Start from a known date (Wednesday, Feb 18, 2026)
      const from = new Date("2026-02-18T12:00:00Z");
      const result = calculateNextRun("0 9 * * 1", from);

      // Should be the next Monday (Feb 23, 2026) at 09:00
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    test("returns next occurrence strictly after 'from' date", () => {
      const from = new Date("2026-02-18T09:00:00Z");
      const result = calculateNextRun("0 9 * * *", from);

      // Should be the next day at 09:00, not the same time
      expect(result.getTime()).toBeGreaterThan(from.getTime());
      const expectedNextDay = new Date("2026-02-19T09:00:00Z");
      expect(result).toEqual(expectedNextDay);
    });

    test("calculates next run for hourly cron", () => {
      const from = new Date("2026-02-18T12:30:00Z");
      const result = calculateNextRun("0 * * * *", from);

      // Should be the next hour (13:00)
      expect(result.getHours()).toBe(13);
      expect(result.getMinutes()).toBe(0);
    });

    test("calculates next run for every 15 minutes", () => {
      const from = new Date("2026-02-18T12:10:00Z");
      const result = calculateNextRun("*/15 * * * *", from);

      // Should be 12:15
      expect(result.getHours()).toBe(12);
      expect(result.getMinutes()).toBe(15);
    });

    test("uses current time when 'from' is not provided", () => {
      const before = new Date();
      const result = calculateNextRun("0 0 * * *"); // Daily at midnight
      const after = new Date();

      // Result should be after the call started
      expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());

      // Result should be at midnight
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });
  });

  describe("parseNaturalSchedule()", () => {
    test.skip("returns object with expected shape when AI is available", async () => {
      // This test is skipped because it requires actual AI access
      // Run manually with: bun test src/features/jobs/schedules/natural-parser.test.ts --testNamePattern="parseNaturalSchedule"
      const { parseNaturalSchedule } = await import("./natural-parser");
      const result = await parseNaturalSchedule("every Monday at 9am");

      expect(result).toHaveProperty("cron");
      expect(result).toHaveProperty("description");
      expect(result).toHaveProperty("confidence");
      expect(typeof result.cron).toBe("string");
      expect(typeof result.description).toBe("string");
      expect(typeof result.confidence).toBe("number");
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test.skip("parses 'every Monday at 9am' correctly", async () => {
      // This test is skipped because it requires actual AI access
      const { parseNaturalSchedule } = await import("./natural-parser");
      const result = await parseNaturalSchedule("every Monday at 9am");

      expect(result.cron).toBe("0 9 * * 1");
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });
});
