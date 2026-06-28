import Database from 'better-sqlite3';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import * as schema from '../models/index';
import path from 'path';
import fs from 'fs';



export type DrizzleDb = ReturnType<typeof drizzleSQLite<typeof schema>>;

export interface DbProvider {

  getDb(): DrizzleDb;


  close(): void;
}

//TODO: put in env
const DEFAULT_PATH = process.env.DB_PATH
  ?? path.join(__dirname, '../../db/database.sqlite');

export class SQLiteProvider implements DbProvider {
  private readonly db: DrizzleDb;
  private readonly sqlite: Database.Database;

  constructor(dbPath: string = DEFAULT_PATH) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.sqlite = new Database(dbPath);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzleSQLite(this.sqlite, { schema });
  }

  getDb(): DrizzleDb {
    return this.db;
  }

  close(): void {
    this.sqlite.close();
  }
}

//factory that returns sqllite.
export function createDbProvider(): DbProvider {
   return new SQLiteProvider();
}
