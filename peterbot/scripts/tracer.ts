/**
 * God Script - Database Verification
 * 
 * This script verifies the database layer works correctly before
 * any feature development proceeds. It tests create, read, update, delete operations.
 */

import { db } from "../src/db";
import {
  createJob,
  getJobById,
  markJobRunning,
  markJobCompleted,
  markJobFailed,
} from "../src/features/jobs/repository";
import { eq } from "drizzle-orm";
import { jobs } from "../src/features/jobs/schema";

const TEST_CHAT_ID = "test-chat-123";
const TEST_INPUT = "God Script test: prove the DB works";

function logSection(title: string): void {
  console.log(`\n┌${"─".repeat(title.length + 2)}┐`);
  console.log(`│ ${title} │`);
  console.log(`└${"─".repeat(title.length + 2)}┘`);
}

function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

function logError(message: string): void {
  console.log(`❌ ${message}`);
}

function logInfo(message: string): void {
  console.log(`📝 ${message}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTracer(): Promise<void> {
  console.log("🎯 GOD SCRIPT: Database Layer Verification");
  console.log("═══════════════════════════════════════════");

  let testJobId: string | undefined;

  try {
    // ─────────────────────────────────────────
    // Step 1: Create Test Job
    // ─────────────────────────────────────────
    logSection("CREATE TEST JOB");
    logInfo("Inserting test job into database...");

    const newJob = await createJob(db, {
      type: "task",
      input: TEST_INPUT,
      chatId: TEST_CHAT_ID,
    });

    testJobId = newJob.id;
    logSuccess(`Created job with ID: ${testJobId}`);
    logInfo(`Type: ${newJob.type}, Status: ${newJob.status}`);

    // ─────────────────────────────────────────
    // Step 2: Read Verification
    // ─────────────────────────────────────────
    await sleep(100);
    logSection("READ VERIFICATION");
    logInfo("Querying test job by ID...");

    const fetchedJob = await getJobById(db, testJobId);
    if (!fetchedJob) {
      throw new Error(`Test job with ID ${testJobId} not found`);
    }
    if (fetchedJob.id !== testJobId) {
      throw new Error(`Expected job ID ${testJobId}, found ${fetchedJob.id}`);
    }
    logSuccess("Read verification passed - test job found by ID");

    // ─────────────────────────────────────────
    // Step 3: Update Verification
    // ─────────────────────────────────────────
    logSection("UPDATE VERIFICATION");

    // Mark as running
    logInfo("Updating status to 'running'...");
    await markJobRunning(db, testJobId);
    let job = await getJobById(db, testJobId);
    if (job?.status !== "running") {
      throw new Error("Failed to update status to 'running'");
    }
    logSuccess("Status updated to 'running'");

    // Mark as completed
    logInfo("Updating status to 'completed'...");
    await markJobCompleted(db, testJobId, "Hello from the tracer!");
    job = await getJobById(db, testJobId);
    if (job?.status !== "completed") {
      throw new Error("Failed to update status to 'completed'");
    }
    if (job?.output !== "Hello from the tracer!") {
      throw new Error("Failed to update output");
    }
    logSuccess("Status updated to 'completed'");
    logInfo(`Output: "${job.output}"`);

    // ─────────────────────────────────────────
    // Step 4: Delete Cleanup
    // ─────────────────────────────────────────
    logSection("CLEANUP");
    logInfo("Deleting test job...");

    await db.delete(jobs).where(eq(jobs.id, testJobId));

    // Verify deletion by ensuring the test id is gone
    const afterDelete = await getJobById(db, testJobId);
    if (afterDelete) {
      throw new Error("Failed to delete test job - it still exists");
    }
    logSuccess("Test job deleted successfully");

    // ─────────────────────────────────────────
    // Success
    // ─────────────────────────────────────────
    console.log("\n" + "═".repeat(50));
    console.log("🎉 GOD SCRIPT PASSED");
    console.log("═".repeat(50));
    console.log("Database layer works correctly.");
    console.log("You are ready for Task 4.\n");

    process.exit(0);
  } catch (error) {
    console.log("\n" + "═".repeat(50));
    logError("GOD SCRIPT FAILED");
    console.log("═".repeat(50));

    if (error instanceof Error) {
      logError(error.message);

      // Detect common issues
      if (error.message.includes("no such table")) {
        console.log("\n💡 Suggestion: Run 'bun run db:push' to create tables");
      }
      if (error.message.includes("unable to open database")) {
        console.log("\n💡 Suggestion: Ensure the 'data/' directory exists and is writable");
      }
    } else {
      logError(String(error));
    }

    // Cleanup on failure
    if (testJobId) {
      try {
        await db.delete(jobs).where(eq(jobs.id, testJobId));
        console.log("\n🧹 Cleaned up test job after failure");
      } catch {
        // Ignore cleanup errors
      }
    }

    process.exit(1);
  }
}

// Run the tracer
runTracer();
