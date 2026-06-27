import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './../models/index';
import path from 'path';
import fs from 'fs';

export type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

const DB_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../../db/database.sqlite');

export function createClient(dbPath: string = DB_PATH): DrizzleDb {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  return drizzle(sqlite, { schema });
}