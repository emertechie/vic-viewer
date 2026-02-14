import * as fs from "node:fs";
import * as path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export type AppDatabase = {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
};

export function createDatabase(databasePath: string): AppDatabase {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const orm = drizzle(sqlite, { schema });
  return { sqlite, orm };
}
