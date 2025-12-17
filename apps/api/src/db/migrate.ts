import "../env.js";

import { applyMigrations } from "./applyMigrations.js";
import { createDb } from "./client.js";

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const db = createDb(databaseUrl);

  try {
    await applyMigrations(db);
  } finally {
    await db.destroy();
  }
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
