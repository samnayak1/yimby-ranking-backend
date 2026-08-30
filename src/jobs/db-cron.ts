import { CronJob } from "cron";
import { backupDatabase } from "./backup-database";
import { logger } from "../utils/logger";

export const backupJob = new CronJob(
  "0 2 * * *", // every day at 2AM UTC
  async () => {
    const startedAt = Date.now();
    logger.info("Running scheduled backup");

    try {
      await backupDatabase();
      logger.info({ durationMs: Date.now() - startedAt }, "Scheduled backup complete");
    } catch (err) {

      logger.error({ err, durationMs: Date.now() - startedAt }, "Scheduled backup FAILED");
    }
  },
  null,
  false, 
  "UTC"
);
