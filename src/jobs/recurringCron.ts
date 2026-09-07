import cron, { ScheduledTask } from "node-cron";
import { env } from "../config/env.js";
import { processDueRecurringTransactions } from "../services/recurringTransaction.service.js";
import { generateAllNotifications } from "../services/notification.service.js";

let cronTask: ScheduledTask | null = null;
let isProcessing = false;

/**
 * Executes recurring transaction process due job safely with in-process concurrency locking.
 */
export const runRecurringJob = async (): Promise<void> => {
  if (isProcessing) {
    console.log("[CRON] Previous recurring transaction job still running. Skipping execution.");
    return;
  }

  isProcessing = true;
  try {
    console.log("[CRON] Starting automated notification generation & recurring transaction processing...");
    // 1. Generate notification events FIRST so due recurring reminders capture nextRunAt before advancement
    await generateAllNotifications();

    // 2. Process due recurring transactions SECOND
    const summary = await processDueRecurringTransactions();
    console.log(
      `[CRON] Recurring transaction job completed. Schedules processed: ${summary.processedSchedules}, Generated: ${summary.generatedTransactions}, Skipped: ${summary.skippedDuplicates}, Deactivated: ${summary.deactivatedSchedules}`
    );
  } catch (error) {
    console.error("[CRON] Error executing recurring transaction processing job:", error);
  } finally {
    isProcessing = false;
  }
};

/**
 * Initializes in-process cron scheduler if enabled in environment config.
 */
export const startRecurringCron = (): void => {
  if (!env.CRON_RECURRING_ENABLED) {
    console.log("[CRON] Recurring transaction cron runner is disabled.");
    return;
  }

  const schedule = env.CRON_RECURRING_SCHEDULE;
  console.log(`[CRON] Scheduling recurring transaction cron runner with pattern: "${schedule}"`);

  cronTask = cron.schedule(schedule, () => {
    runRecurringJob();
  });
};

/**
 * Stops running cron task gracefully on application shutdown.
 */
export const stopRecurringCron = (): void => {
  if (cronTask) {
    console.log("[CRON] Stopping recurring transaction cron runner...");
    cronTask.stop();
    cronTask = null;
  }
};
