import fs from "fs";
import path from "path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3Config";
import { createDbProvider } from "../repos/client";
const provider = createDbProvider();



const DB_PATH = path.resolve("db/database.sqlite");
const BACKUP_DIR = path.resolve("backups");

export async function backupDatabase(): Promise<void> {
  try {
    // Flush WAL into the main database
    provider.getDatabaseProvider().pragma("wal_checkpoint(FULL)");

    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/:/g, "-")
      .replace(/\..+/, "");

    const filename = `database-${timestamp}.sqlite`;
    const backupPath = path.join(BACKUP_DIR, filename);

    // Copy the SQLite file
    fs.copyFileSync(DB_PATH, backupPath);

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `sqlite/${filename}`,
        Body: fs.createReadStream(backupPath),
        ContentType: "application/x-sqlite3",
      })
    );

    // Remove local backup
    fs.unlinkSync(backupPath);

    console.log(`✅ Database backed up to S3: ${filename}`);
  } catch (err) {
    console.error("❌ Database backup failed:", err);
    throw err;
  }
}