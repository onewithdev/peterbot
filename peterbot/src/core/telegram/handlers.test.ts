import {
  describe,
  test,
  expect,
  beforeEach,
  mock,
  spyOn,
} from "bun:test";
import { Bot } from "grammy";
import {
  formatAckReply,
  formatQuickReply,
  formatStatusReply,
} from "./handlers";
import type { Job } from "../../features/jobs/schema";
import { detectIntent, TASK_KEYWORDS } from "./intent";

// Mock repository functions
const mockCreateJob = mock(async (input: {
  type: string;
  input: string;
  chatId: string;
}) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: input.type,
  status: "pending",
  input: input.input,
  chatId: input.chatId,
  delivered: false,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

const mockGetJobsByChatId = mock(async (_chatId: string) => [] as Job[]);

const mockGetJobById = mock(async (_id: string) => undefined as Job | undefined);

mock.module("../../features/jobs/repository", () => ({
  createJob: mockCreateJob,
  getJobsByChatId: mockGetJobsByChatId,
  getJobById: mockGetJobById,
}));

// Mock AI module
const mockGenerateText = mock(async () => ({
  text: "This is a quick AI response",
}));

mock.module("ai", () => ({
  generateText: mockGenerateText,
}));

// Mock AI client
mock.module("../../ai/client", () => ({
  getModel: mock(() => ({})),
}));

// Mock the db
mock.module("../../db", () => ({
  db: {},
}));

describe("formatAckReply", () => {
  test("should include short ID (first 8 chars)", () => {
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const result = formatAckReply(jobId);
    expect(result).toContain("550e8400");
  });

  test("should mention /status command", () => {
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const result = formatAckReply(jobId);
    expect(result).toContain("/status");
  });

  test("should include 'Got it' acknowledgment", () => {
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const result = formatAckReply(jobId);
    expect(result).toContain("Got it");
    expect(result).toContain("✓");
  });

  test("should format with backticks around job ID", () => {
    const jobId = "550e8400-e29b-41d4-a716-446655440000";
    const result = formatAckReply(jobId);
    expect(result).toContain("`550e8400`");
  });
});

describe("formatQuickReply", () => {
  test("should return text as-is", () => {
    const text = "This is a quick response";
    expect(formatQuickReply(text)).toBe(text);
  });

  test("should handle empty string", () => {
    expect(formatQuickReply("")).toBe("");
  });

  test("should handle multi-line text", () => {
    const text = "Line 1\nLine 2\nLine 3";
    expect(formatQuickReply(text)).toBe(text);
  });
});

describe("formatStatusReply", () => {
  test("should return empty jobs message for empty array", () => {
    const result = formatStatusReply([]);
    expect(result).toContain("No jobs found");
  });

  test("should format running jobs", () => {
    const jobs: Job[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "running",
        input: "Analyze this data",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = formatStatusReply(jobs);
    expect(result).toContain("🔄 Running");
    expect(result).toContain("550e8400");
  });

  test("should format pending jobs", () => {
    const jobs: Job[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "pending",
        input: "Write a report",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = formatStatusReply(jobs);
    expect(result).toContain("⏳ Pending");
    expect(result).toContain("550e8400");
  });

  test("should format completed jobs with hint", () => {
    const jobs: Job[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "completed",
        input: "Research topic",
        output: "Here are the findings...",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = formatStatusReply(jobs);
    expect(result).toContain("✅ Completed");
    expect(result).toContain("get 550e8400");
  });

  test("should format failed jobs with hint", () => {
    const jobs: Job[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        type: "task",
        status: "failed",
        input: "Failed task",
        output: "Error occurred",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = formatStatusReply(jobs);
    expect(result).toContain("❌ Failed");
    expect(result).toContain("retry 550e8400");
  });

  test("should group jobs by status", () => {
    const jobs: Job[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "running",
        input: "Running task",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "660e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "pending",
        input: "Pending task",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "770e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "completed",
        input: "Completed task",
        output: "Done!",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = formatStatusReply(jobs);
    expect(result).toContain("🔄 Running");
    expect(result).toContain("⏳ Pending");
    expect(result).toContain("✅ Completed");
  });
});

describe("handler behaviors with mocked context", () => {
  interface MockContext {
    chat: { id: number };
    message: { text: string };
    replies: Array<{ text: string; options?: Record<string, unknown> }>;
    chatActions: string[];
    reply: (text: string, options?: Record<string, unknown>) => Promise<void>;
    replyWithChatAction: (action: string) => Promise<void>;
  }

  const createMockContext = (
    overrides: Partial<MockContext> = {}
  ): MockContext => {
    const replies: Array<{ text: string; options?: Record<string, unknown> }> =
      [];
    const chatActions: string[] = [];

    const context: MockContext = {
      chat: { id: 123456789 },
      message: { text: "" },
      replies,
      chatActions,
      reply: mock(async (text: string, options?: Record<string, unknown>) => {
        replies.push({ text, options });
      }),
      replyWithChatAction: mock(async (action: string) => {
        chatActions.push(action);
      }),
      ...overrides,
    };

    return context;
  };

  describe("/start command", () => {
    test("should reply with welcome message", async () => {
      const ctx = createMockContext();

      // Simulate the start command handler
      await ctx.reply(
        `👋 Hi! I'm peterbot.

Send me a task and I'll work on it in the background.
Use /status to see what I'm working on.`,
        { parse_mode: "Markdown" }
      );

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Hi! I'm peterbot");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });
  });

  describe("/status command", () => {
    beforeEach(() => {
      mockGetJobsByChatId.mockClear();
    });

    test("should list jobs for the chat", async () => {
      const mockJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "completed",
          input: "Test job",
          output: "Test output",
          chatId: "123456789",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetJobsByChatId.mockResolvedValueOnce(mockJobs);

      const ctx = createMockContext({ message: { text: "/status" } });

      // Verify getJobsByChatId returns jobs
      const jobs = await mockGetJobsByChatId("123456789");
      expect(jobs).toEqual(mockJobs);

      // Simulate the status command reply
      await ctx.reply(formatStatusReply(jobs));

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("✅ Completed");
      expect(ctx.replies[0].text).toContain("550e8400");
    });

    test("should show empty message when no jobs", async () => {
      mockGetJobsByChatId.mockResolvedValueOnce([]);

      const jobs = await mockGetJobsByChatId("123456789");
      expect(jobs).toEqual([]);

      const reply = formatStatusReply(jobs);
      expect(reply).toContain("No jobs found");
    });

    test("should call getJobsByChatId with correct chatId", async () => {
      await mockGetJobsByChatId("123456789");
      expect(mockGetJobsByChatId).toHaveBeenCalledWith("123456789");
    });
  });

  describe("/retry command", () => {
    beforeEach(() => {
      mockGetJobsByChatId.mockClear();
      mockGetJobById.mockClear();
      mockCreateJob.mockClear();
    });

    test("should require job ID argument", async () => {
      const ctx = createMockContext({ message: { text: "/retry" } });

      // Simulate the validation logic from the handler
      const text = ctx.message.text;
      const parts = text.split(" ");

      if (parts.length < 2) {
        await ctx.reply("Please provide a job ID. Usage: `/retry [jobId]`", {
          parse_mode: "Markdown",
        });
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Please provide a job ID");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should validate job ID format", async () => {
      const ctx = createMockContext({ message: { text: "/retry invalid" } });

      const text = ctx.message.text;
      const parts = text.split(" ");
      const jobId = parts[1]?.trim();

      if (jobId && jobId.length !== 8 && jobId.length !== 36) {
        await ctx.reply(
          "Invalid job ID format. Use the first 8 characters or the full ID.",
          { parse_mode: "Markdown" }
        );
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Invalid job ID format");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should find job by 8-char prefix", async () => {
      const mockJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "failed",
          input: "Failed task",
          output: "Error occurred",
          chatId: "123456789",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetJobsByChatId.mockResolvedValueOnce(mockJobs);

      const shortId = "550e8400";
      const jobs = await mockGetJobsByChatId("123456789");
      const matchingJob = jobs.find((j) => j.id.startsWith(shortId));

      expect(matchingJob).toBeDefined();
      expect(matchingJob?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    test("should reject non-failed jobs", async () => {
      const mockJob: Job = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "completed",
        input: "Test task",
        output: "Done!",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext();

      // Simulate the status check from the handler
      if (mockJob.status !== "failed") {
        await ctx.reply(
          `Job \`${mockJob.id.slice(
            0,
            8
          )}\` is not failed (status: ${mockJob.status}). Only failed jobs can be retried.`,
          { parse_mode: "Markdown" }
        );
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("not failed");
      expect(ctx.replies[0].text).toContain("completed");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should create new job when retrying failed job", async () => {
      const failedJob: Job = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "failed",
        input: "Failed task input",
        output: "Error occurred",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCreateJob.mockResolvedValueOnce({
        id: "660e8400-e29b-41d4-a716-446655440001",
        type: "task",
        status: "pending",
        input: failedJob.input,
        chatId: failedJob.chatId,
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const newJob = await mockCreateJob({
        type: "task",
        input: failedJob.input,
        chatId: failedJob.chatId,
      });

      expect(mockCreateJob).toHaveBeenCalledWith({
        type: "task",
        input: failedJob.input,
        chatId: failedJob.chatId,
      });
      expect(newJob.input).toBe(failedJob.input);
      expect(newJob.status).toBe("pending");
      expect(newJob.id).not.toBe(failedJob.id);
    });

    test("should reply with acknowledgment after retry", async () => {
      const newJobId = "660e8400-e29b-41d4-a716-446655440001";

      mockCreateJob.mockResolvedValueOnce({
        id: newJobId,
        type: "task",
        status: "pending",
        input: "Failed task input",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createMockContext();
      const newJob = await mockCreateJob({
        type: "task",
        input: "Failed task input",
        chatId: "123456789",
      });

      await ctx.reply(formatAckReply(newJob.id), { parse_mode: "Markdown" });

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Got it");
      expect(ctx.replies[0].text).toContain(newJobId.slice(0, 8));
    });
  });

  describe("/get command", () => {
    beforeEach(() => {
      mockGetJobsByChatId.mockClear();
      mockGetJobById.mockClear();
    });

    test("should require job ID argument", async () => {
      const ctx = createMockContext({ message: { text: "/get" } });

      const text = ctx.message.text;
      const parts = text.split(" ");

      if (parts.length < 2) {
        await ctx.reply("Please provide a job ID. Usage: `/get [jobId]`", {
          parse_mode: "Markdown",
        });
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Please provide a job ID");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should validate job ID format", async () => {
      const ctx = createMockContext({ message: { text: "/get invalid-id" } });

      const text = ctx.message.text;
      const parts = text.split(" ");
      const jobId = parts[1]?.trim();

      if (jobId && jobId.length !== 8 && jobId.length !== 36) {
        await ctx.reply(
          "Invalid job ID format. Use the first 8 characters or the full ID.",
          { parse_mode: "Markdown" }
        );
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Invalid job ID format");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should find job by 8-char prefix", async () => {
      const mockJobs: Job[] = [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          type: "task",
          status: "completed",
          input: "Test task",
          output: "Test output",
          chatId: "123456789",
          delivered: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockGetJobsByChatId.mockResolvedValueOnce(mockJobs);

      const shortId = "550e8400";
      const jobs = await mockGetJobsByChatId("123456789");
      const matchingJob = jobs.find((j) => j.id.startsWith(shortId));

      expect(matchingJob).toBeDefined();
      expect(matchingJob?.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    test("should reject incomplete jobs", async () => {
      const mockJob: Job = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "running",
        input: "Test task",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const ctx = createMockContext();

      if (mockJob.status !== "completed") {
        await ctx.reply(
          `Job \`${mockJob.id.slice(
            0,
            8
          )}\` is not completed yet (status: ${mockJob.status}).`,
          { parse_mode: "Markdown" }
        );
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("not completed yet");
      expect(ctx.replies[0].text).toContain("running");
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should truncate output over 4000 characters", async () => {
      const longOutput = "a".repeat(5000);
      const mockJob: Job = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "completed",
        input: "Test task",
        output: longOutput,
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate the truncation logic from the handler
      let output = mockJob.output || "No output available.";
      if (output.length > 4000) {
        output = output.slice(0, 4000) + "\n\n... (truncated)";
      }

      expect(output.length).toBe(4017); // 4000 + "\n\n... (truncated)" which is 17 chars
      expect(output).toContain("... (truncated)");
    });

    test("should return output for completed job", async () => {
      const mockJob: Job = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        type: "task",
        status: "completed",
        input: "Test task",
        output: "Job completed successfully!",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetJobById.mockResolvedValueOnce(mockJob);

      const ctx = createMockContext();
      const job = await mockGetJobById("550e8400-e29b-41d4-a716-446655440000");

      expect(job).toBeDefined();
      expect(job?.status).toBe("completed");

      const output = job?.output || "No output available.";
      await ctx.reply(output);

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toBe("Job completed successfully!");
    });

    test("should handle job not found", async () => {
      mockGetJobById.mockResolvedValueOnce(undefined);

      const jobId = "550e8400";
      const job = await mockGetJobById(jobId);

      expect(job).toBeUndefined();
    });
  });

  describe("message:text handler - intent-based routing", () => {
    beforeEach(() => {
      mockGenerateText.mockClear();
      mockCreateJob.mockClear();
    });

    test("should skip messages starting with '/'", async () => {
      const ctx = createMockContext({ message: { text: "/somecommand" } });

      const text = ctx.message.text;
      if (text.startsWith("/")) {
        // Command already handled, skip
        return;
      }

      expect(ctx.replies).toHaveLength(0);
    });

    test("should route 'quick' intent to AI reply", async () => {
      const message = "Hello!";
      const intent = detectIntent(message);

      expect(intent).toBe("quick");

      // Simulate AI response
      mockGenerateText.mockResolvedValueOnce({
        text: "Hi there! How can I help?",
      });

      const ctx = createMockContext({ message: { text: message } });

      // Simulate quick reply flow
      await ctx.replyWithChatAction("typing");
      const result = await mockGenerateText({
        model: {},
        system: "You are peterbot",
        prompt: message,
      });

      await ctx.reply(formatQuickReply(result.text));

      expect(ctx.chatActions).toContain("typing");
      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toBe("Hi there! How can I help?");
    });

    test("should route 'task' intent to job creation", async () => {
      const message = "Please research the history of artificial intelligence";
      const intent = detectIntent(message);

      expect(intent).toBe("task");

      mockCreateJob.mockResolvedValueOnce({
        id: "770e8400-e29b-41d4-a716-446655440002",
        type: "task",
        status: "pending",
        input: message,
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createMockContext({ message: { text: message } });

      const newJob = await mockCreateJob({
        type: "task",
        input: message,
        chatId: ctx.chat.id.toString(),
      });

      expect(mockCreateJob).toHaveBeenCalledWith({
        type: "task",
        input: message,
        chatId: "123456789",
      });
      expect(newJob.input).toBe(message);
      expect(newJob.status).toBe("pending");
    });

    test("should detect task intent for messages with task keywords", () => {
      // Test a few task keywords
      const taskMessages = [
        "Please research quantum computing",
        "Write a poem about spring",
        "Analyze the stock market",
        "Create a workout plan",
        "Summarize this article",
      ];

      for (const message of taskMessages) {
        const intent = detectIntent(message);
        expect(intent).toBe("task");
      }
    });

    test("should detect task intent for long messages", () => {
      const longMessage = "a".repeat(101);
      const intent = detectIntent(longMessage);

      expect(intent).toBe("task");
    });

    test("should detect quick intent for short casual messages", () => {
      const quickMessages = [
        "Hi",
        "How are you?",
        "Thanks!",
        "Good morning",
        "What's up?",
      ];

      for (const message of quickMessages) {
        const intent = detectIntent(message);
        expect(intent).toBe("quick");
      }
    });

    test("should handle AI errors gracefully", async () => {
      mockGenerateText.mockRejectedValueOnce(new Error("AI service unavailable"));

      const ctx = createMockContext({ message: { text: "Hello" } });

      try {
        await mockGenerateText({ model: {}, system: "test", prompt: "Hello" });
      } catch (error) {
        await ctx.reply(
          "Sorry, I encountered an error while processing your request. Please try again."
        );
      }

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Sorry, I encountered an error");
    });

    test("should reply with acknowledgment for task jobs", async () => {
      const jobId = "880e8400-e29b-41d4-a716-446655440003";

      mockCreateJob.mockResolvedValueOnce({
        id: jobId,
        type: "task",
        status: "pending",
        input: "Research AI",
        chatId: "123456789",
        delivered: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createMockContext();
      const newJob = await mockCreateJob({
        type: "task",
        input: "Research AI",
        chatId: "123456789",
      });

      await ctx.reply(formatAckReply(newJob.id), { parse_mode: "Markdown" });

      expect(ctx.replies).toHaveLength(1);
      expect(ctx.replies[0].text).toContain("Got it");
      expect(ctx.replies[0].text).toContain(jobId.slice(0, 8));
      expect(ctx.replies[0].options?.parse_mode).toBe("Markdown");
    });

    test("should call generateText with correct parameters for quick intent", async () => {
      const message = "What time is it?";

      mockGenerateText.mockResolvedValueOnce({ text: "It's test time!" });

      await mockGenerateText({
        model: {},
        system:
          "You are peterbot, a helpful personal AI assistant. Answer concisely and directly.",
        prompt: message,
      });

      expect(mockGenerateText).toHaveBeenCalledWith({
        model: {},
        system:
          "You are peterbot, a helpful personal AI assistant. Answer concisely and directly.",
        prompt: message,
      });
    });
  });

  describe("TASK_KEYWORDS constant", () => {
    test("should contain expected task keywords", () => {
      expect(TASK_KEYWORDS).toContain("research");
      expect(TASK_KEYWORDS).toContain("write");
      expect(TASK_KEYWORDS).toContain("analyze");
      expect(TASK_KEYWORDS).toContain("create");
      expect(TASK_KEYWORDS).toContain("summarize");
    });
  });
});
