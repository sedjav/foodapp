import { Kysely, PostgresDialect, SqliteDialect } from "kysely";
import { Pool } from "pg";
import Database from "better-sqlite3";

import type { DatabaseSchema } from "./types.js";

const isSqliteUrl = (url: string) => url.startsWith("file:") || url.endsWith(".db") || url.includes(":memory:");

export const createDb = (databaseUrl: string) => {
  if (isSqliteUrl(databaseUrl)) {
    const filePath = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
    const sqlite = new Database(filePath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");

    return new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({
        database: sqlite
      })
    });
  }

  const pool = new Pool({
    connectionString: databaseUrl
  });

  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool
    })
  });
};

export type Db = ReturnType<typeof createDb>;
