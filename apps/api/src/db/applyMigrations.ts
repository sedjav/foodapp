import type { Kysely } from "kysely";

import { migrations } from "./migrations.js";
import type { DatabaseSchema } from "./types.js";

export const applyMigrations = async (db: Kysely<DatabaseSchema>) => {
  await db.schema
    .createTable("schema_migrations")
    .ifNotExists()
    .addColumn("id", "text", (col: any) => col.primaryKey())
    .addColumn("created_at", "text", (col: any) => col.notNull())
    .execute();

  const existing = await db.selectFrom("schema_migrations").select(["id"]).execute();
  const applied = new Set(existing.map((r: any) => r.id));

  for (const m of migrations) {
    if (applied.has(m.id)) continue;

    await m.up(db);
    await db
      .insertInto("schema_migrations")
      .values({
        id: m.id,
        created_at: new Date().toISOString()
      })
      .execute();

    console.log(`Applied migration ${m.id}`);
  }
};
