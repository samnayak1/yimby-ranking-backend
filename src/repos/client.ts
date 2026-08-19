import Database from 'better-sqlite3';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../models/index';
import path from 'path';
import fs from 'fs';



export type DrizzleDb = ReturnType<typeof drizzleSQLite<typeof schema>>;

export interface DbProvider {

  getDb(): DrizzleDb;

  getDatabaseProvider(): Database.Database;


  close(): void;
}


const DEFAULT_PATH = path.join(__dirname, '../../db/database.sqlite');
const MIGRATIONS_DIR = path.join(__dirname, '../../drizzle');

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

  getDatabaseProvider(): Database.Database {
    return this.sqlite;
  }



  close(): void {
    this.sqlite.close();
  }
}

//factory that returns sqllite.
export function createDbProvider(): DbProvider {
   return new SQLiteProvider();
}

// The production database lives on an empty named volume, so the schema has to
// be brought up to date before the server starts serving.
export function runMigrations(provider: DbProvider): void {
  migrate(provider.getDb(), { migrationsFolder: MIGRATIONS_DIR });
}
