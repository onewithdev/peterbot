/**
 * Manual Worker Testing Script
 *
 * This script creates a test job and runs the worker for a short duration
 * to verify the complete job lifecycle: pending → running → completed → delivered
 *
 * Usage:
 * ```bash
 * bun run scripts/test-worker.ts
 * ```
 */

import { createJob, getJobById } from "../src/features/jobs/repository.js";
import type { NewJob } from "../src/features/jobs/schema.js";

// Test job data
const testJob: NewJob = {
  type: "task",
  input: "What is 2 + 2?",
  chatId: "123456789", // Dummy chat ID
};

async function runTest(): Promise<void> {
  console.log("[Test Worker] Starting manual worker test...\n");

  // Verify required environment variables
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log("[Test Worker] Note: TELEGRAM_BOT_TOKEN not set, delivery will be skipped");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("[Test Worker] Error: ANTHROPIC_API_KEY is required for this test");
    process.exit(1);
  }

  try {
    // Create a test job
    console.log("[Test Worker] Creating test job...");
    const job = await createJob(testJob);
    console.log(`[Test Worker] Created job with ID: ${job.id}`);
    console.log(`[Test Worker] Initial status: ${job.status}`);

    // Verify job was created with pending status
    const createdJob = await getJobById(job.id);
    if (!createdJob) {
      throw new Error("Failed to retrieve created job");
    }
    console.log(`[Test Worker] Verified job exists with status: ${createdJob.status}\n`);

    console.log("[Test Worker] Now you can manually run the worker:");
    console.log(`  bun run src/worker/worker.ts`);
    console.log("\n[Test Worker] The worker should:");
    console.log("  1. Pick up the pending job within 5 seconds");
    console.log("  2. Mark it as 'running'");
    console.log("  3. Process it with the AI");
    console.log("  4. Mark it as 'completed' with the answer");
    console.log("  5. Deliver the result via Telegram (if token is set)");
    console.log("  6. Mark it as 'delivered'\n");

    console.log("[Test Worker] Waiting 10 seconds for worker to process...");
    await Bun.sleep(10000);

    // Check final status
    const finalJob = await getJobById(job.id);
    if (!finalJob) {
      throw new Error("Failed to retrieve final job state");
    }

    console.log("\n[Test Worker] Final job state:");
    console.log(`  ID: ${finalJob.id}`);
    console.log(`  Status: ${finalJob.status}`);
    console.log(`  Delivered: ${finalJob.delivered}`);
    console.log(`  Output: ${finalJob.output ? finalJob.output.slice(0, 100) + "..." : "(none)"}`);

    if (finalJob.status === "completed" && finalJob.delivered) {
      console.log("\n✅ Test passed! Job lifecycle completed successfully.");
    } else if (finalJob.status === "running") {
      console.log("\n⏳ Job is still running. The AI might be taking longer than expected.");
    } else if (finalJob.status === "failed") {
      console.log("\n❌ Job failed. Check the worker logs for errors.");
    } else if (finalJob.status === "pending") {
      console.log("\n⏳ Job is still pending. Make sure the worker is running.");
    }

    console.log("\n[Test Worker] Cleaning up test data...");
    // Note: In a real scenario, you might want to delete the test job
    // For now, we leave it in the database for inspection
    console.log("[Test Worker] Test job left in database for inspection:");
    console.log(`  ID: ${finalJob.id}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Test Worker] Test failed:", errorMessage);
    process.exit(1);
  }
}

runTest();
