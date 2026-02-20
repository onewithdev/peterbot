import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema";
import {
  getDueSchedules,
  updateScheduleRunTime,
  getScheduleById,
  toggleSchedule,
} from "../features/jobs/schedules/repository.js";
import { createJob } from "../features/jobs/repository.js";
import { calculateNextRun } from "../features/jobs/schedules/natural-parser.js";

/**
 * Scheduler polling interval in milliseconds.
 * The scheduler checks for due schedules every 60 seconds.
 */
const SCHEDULER_INTERVAL_MS = 60_000;

/**
 * Run the scheduler loop indefinitely.
 *
 * Polls for due schedules and creates jobs for them.
 * This function never resolves - it runs until the process exits.
 *
 * @param db - Database instance
 * @param chatId - Telegram chat ID to send scheduled job results to
 */
export async function schedulerLoop(
  db: BunSQLiteDatabase<typeof schema>,
  chatId: string
): Promise<void> {
  console.log("[Scheduler] Starting...");

  while (true) {
    try {
      const now = new Date();
      const dueSchedules = await getDueSchedules(db, now);

      for (const schedule of dueSchedules) {
        try {
          // Create a job for this schedule
          await createJob(db, {
            type: "task",
            input: schedule.prompt,
            chatId,
            scheduleId: schedule.id,
          });

          console.log(
            `[Scheduler] Fired schedule ${schedule.id.slice(0, 8)}: "${schedule.description}"`
          );

          // Calculate the next run time
          let nextRunAt: Date;
          try {
            nextRunAt = calculateNextRun(schedule.parsedCron, now);
          } catch (cronError) {
            const cronErrorMessage =
              cronError instanceof Error ? cronError.message : String(cronError);
            console.error(
              `[Scheduler] Invalid cron for schedule ${schedule.id.slice(0, 8)} (${schedule.parsedCron}):`,
              cronErrorMessage
            );
            // Disable the schedule to avoid reprocessing the bad record
            await toggleSchedule(db, schedule.id, false);
            console.error(
              `[Scheduler] Disabled schedule ${schedule.id.slice(0, 8)} due to invalid cron expression`
            );
            continue;
          }

          try {
            await updateScheduleRunTime(db, schedule.id, nextRunAt);
          } catch (updateError) {
            const updateErrorMessage =
              updateError instanceof Error ? updateError.message : String(updateError);
            console.error(
              `[Scheduler] Error updating schedule ${schedule.id.slice(0, 8)}:`,
              updateErrorMessage
            );
            // Set a safe future nextRunAt (1 hour from now) to avoid reprocessing
            const safeNextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
            try {
              await toggleSchedule(db, schedule.id, true, safeNextRunAt);
            } catch (toggleError) {
              console.error(
                `[Scheduler] Failed to set safe nextRunAt for schedule ${schedule.id.slice(0, 8)}:`
              );
            }
            continue;
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Scheduler] Error processing schedule ${schedule.id.slice(0, 8)}:`,
            errorMessage
          );
        }
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[Scheduler] Error in scheduler loop:", errorMessage);
    }

    // Sleep before next check
    await Bun.sleep(SCHEDULER_INTERVAL_MS);
  }
}

// Re-export for use in worker
export { getScheduleById };
