import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

import type { Db } from "./db/client.js";
import type { UserRole } from "./db/types.js";

export const hashPassword = async (password: string) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

export const ensureInitialAdmin = async (db: Db) => {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const displayName = process.env.INITIAL_ADMIN_DISPLAY_NAME ?? "Admin";

  if (!email || !password) return;

  const existing = await db.selectFrom("users").select(["id"]).where("email", "=", email).executeTakeFirst();
  if (existing) return;

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const id = randomUUID();
  const role: UserRole = "ADMIN";

  await db
    .insertInto("users")
    .values({
      id,
      email,
      display_name: displayName,
      password_hash: passwordHash,
      role,
      created_at: now
    })
    .execute();

  await db
    .insertInto("wallets")
    .values({
      user_id: id,
      balance_irr: 0,
      created_at: now
    })
    .execute();
};
