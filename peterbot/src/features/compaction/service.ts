import { generateText } from "ai";
import { eq, desc, and } from "drizzle-orm";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../../db/schema.js";
import { getModel } from "../../ai/client.js";
import {
  getOrCreateChatState,
  incrementMessageCount,
  resetMessageCount,
  updateLatestSummary,
  saveSession,
  getConfig,
} from "./repository.js";
import type { Job } from "../../features/jobs/schema.js";
import { jobs } from "../../features/jobs/schema.js";

export async function generateCompactionSummary(
  completedJobs: Job[]
): Promise<string> {
  const jobDetails = completedJobs
    .map(
      (job, index) =>
        `Job ${index + 1}:\nInput: ${job.input}\nOutput: ${job.output || "(no output)"}`
    )
    .join("\n\n");

  const prompt = `You are summarizing a conversation history for future context. Review the following completed jobs (inputs and outputs) and produce a concise paragraph (3-5 sentences) that captures:
- The key tasks or questions addressed
- The approaches or solutions used
- Important outcomes or decisions made

This summary will be used as context for future interactions in this conversation, so focus on information that would be relevant for continuing the discussion.

${jobDetails}

Provide a concise summary:`;

  const result = await generateText({
    model: getModel(),
    prompt,
  });

  return result.text;
}

export async function checkAndCompact(
  db: BunSQLiteDatabase<typeof schema>,
  chatId: string,
  triggerJobId: string
): Promise<void> {
  try {
    // Step 1: Ensure chat state exists
    await getOrCreateChatState(db, chatId);

    // Step 2: Increment message count and get new count
    const updatedState = await incrementMessageCount(db, chatId);
    const newCount = updatedState.messageCount;

    // Step 3: Read threshold
    const thresholdConfig = await getConfig(db, "compaction_threshold");
    const threshold = thresholdConfig
      ? parseInt(thresholdConfig.value, 10)
      : 20;

    // Step 4: Check if threshold is reached
    if (newCount < threshold) {
      return;
    }

    // Step 5: Fetch last N completed jobs for this chat
    const completedJobs = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.chatId, chatId), eq(jobs.status, "completed")))
      .orderBy(desc(jobs.createdAt))
      .limit(threshold);

    // Step 6: If no completed jobs, return early
    if (completedJobs.length === 0) {
      return;
    }

    // Step 7: Generate summary
    const summary = await generateCompactionSummary(completedJobs);

    // Step 8: Save session
    await saveSession(db, {
      chatId,
      triggerJobId,
      messageCount: newCount,
      summary,
      createdAt: new Date(),
    });

    // Step 9: Update latest summary
    await updateLatestSummary(db, chatId, summary);

    // Step 10: Reset message count
    await resetMessageCount(db, chatId);

    // Step 11: Log success
    console.log(`[Compaction] Compacted ${newCount} messages for chat ${chatId}`);
  } catch (error) {
    console.error(`[Compaction] Error during compaction for chat ${chatId}:`, error);
    // Do not rethrow - compaction failure should never break job delivery
  }
}
