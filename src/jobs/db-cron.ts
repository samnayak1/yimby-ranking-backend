

import { CronJob } from "cron";
import { backupDatabase } from "./backup-database";


export const backupJob = new CronJob(
  "0 2 * * *", // every day at 2AM UTC
  async () => {
    console.log("Running scheduled backup...");
    await backupDatabase();
  },
  null,
  false, // don't start automatically
  "UTC"
);