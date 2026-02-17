import { describe, test, expect } from "bun:test";
import { detectIntent } from "./intent";

describe("detectIntent — ejection point 2 (heuristic)", () => {
  describe("quick messages", () => {
    test("short casual message (< 100 chars, no keywords) → 'quick'", () => {
      expect(detectIntent("Hello!")).toBe("quick");
      expect(detectIntent("How are you?")).toBe("quick");
      expect(detectIntent("What's the weather like?")).toBe("quick");
    });

    test("greeting messages → 'quick'", () => {
      expect(detectIntent("Hi there")).toBe("quick");
      expect(detectIntent("Good morning!")).toBe("quick");
      expect(detectIntent("Hey")).toBe("quick");
    });

    test("short questions without task keywords → 'quick'", () => {
      expect(detectIntent("What time is it?")).toBe("quick");
      expect(detectIntent("Can you help?")).toBe("quick");
    });
  });

  describe("task keywords", () => {
    test("message with 'research' keyword → 'task'", () => {
      expect(detectIntent("Please research about AI")).toBe("task");
    });

    test("message with 'write' keyword → 'task'", () => {
      expect(detectIntent("Write me a poem")).toBe("task");
    });

    test("message with 'analyze' keyword → 'task'", () => {
      expect(detectIntent("Analyze this data")).toBe("task");
    });

    test("message with 'create' keyword → 'task'", () => {
      expect(detectIntent("Create a plan")).toBe("task");
    });

    test("message with 'build' keyword → 'task'", () => {
      expect(detectIntent("Build a website")).toBe("task");
    });

    test("message with 'find' keyword → 'task'", () => {
      expect(detectIntent("Find the answer")).toBe("task");
    });

    test("message with 'summarize' keyword → 'task'", () => {
      expect(detectIntent("Summarize this article")).toBe("task");
    });

    test("message with 'compile' keyword → 'task'", () => {
      expect(detectIntent("Compile the results")).toBe("task");
    });

    test("message with 'report' keyword → 'task'", () => {
      expect(detectIntent("Generate a report")).toBe("task");
    });

    test("message with 'draft' keyword → 'task'", () => {
      expect(detectIntent("Draft an email")).toBe("task");
    });

    test("message with 'generate' keyword → 'task'", () => {
      expect(detectIntent("Generate some ideas")).toBe("task");
    });

    test("message with 'make' keyword → 'task'", () => {
      expect(detectIntent("Make a list")).toBe("task");
    });

    test("message with 'prepare' keyword → 'task'", () => {
      expect(detectIntent("Prepare the document")).toBe("task");
    });

    test("message with 'search' keyword → 'task'", () => {
      expect(detectIntent("Search for information")).toBe("task");
    });

    test("message with 'compare' keyword → 'task'", () => {
      expect(detectIntent("Compare these options")).toBe("task");
    });

    test("message with 'list' keyword → 'task'", () => {
      expect(detectIntent("List all items")).toBe("task");
    });

    test("message with 'collect' keyword → 'task'", () => {
      expect(detectIntent("Collect the data")).toBe("task");
    });

    test("message with 'gather' keyword → 'task'", () => {
      expect(detectIntent("Gather information")).toBe("task");
    });

    test("message with 'extract' keyword → 'task'", () => {
      expect(detectIntent("Extract the key points")).toBe("task");
    });

    test("message with 'translate' keyword → 'task'", () => {
      expect(detectIntent("Translate this text")).toBe("task");
    });
  });

  describe("long messages", () => {
    test("message > 100 chars without keywords → 'task'", () => {
      const longMessage =
        "This is a very long message that has more than one hundred characters and should be treated as a task";
      expect(longMessage.length).toBeGreaterThan(100);
      expect(detectIntent(longMessage)).toBe("task");
    });
  });

  describe("case insensitivity", () => {
    test("uppercase keywords are detected → 'task'", () => {
      expect(detectIntent("RESEARCH about AI")).toBe("task");
      expect(detectIntent("WRITE me a story")).toBe("task");
    });

    test("mixed case keywords are detected → 'task'", () => {
      expect(detectIntent("ReSeArCh about AI")).toBe("task");
      expect(detectIntent("WrItE a poem")).toBe("task");
    });
  });

  describe("edge cases", () => {
    test("exactly 100 chars without keywords → 'quick'", () => {
      // Generate exactly 100 characters using repetition
      const exactly100 = "a".repeat(100);
      expect(exactly100.length).toBe(100);
      expect(detectIntent(exactly100)).toBe("quick");
    });

    test("exactly 101 chars without keywords → 'task'", () => {
      // Generate exactly 101 characters using repetition
      const exactly101 = "b".repeat(101);
      expect(exactly101.length).toBe(101);
      expect(detectIntent(exactly101)).toBe("task");
    });

    test("mixed keywords and short length → 'task'", () => {
      expect(detectIntent("Quick research")).toBe("task");
    });

    test("empty string → 'quick'", () => {
      expect(detectIntent("")).toBe("quick");
    });
  });
});
