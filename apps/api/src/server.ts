import "./env.js";

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import { ensureInitialAdmin } from "./auth.js";
import { applyMigrations } from "./db/applyMigrations.js";
import { createDb } from "./db/client.js";
import { registerRoutes } from "./routes.js";

const buildApp = () => {
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    origin: true
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is required");
  }

  app.register(jwt, {
    secret: jwtSecret
  });

  app.get("/api/v1/health", async () => {
    return { ok: true };
  });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const db = createDb(databaseUrl);

  (app as any).db = db;

  app.addHook("onClose", async () => {
    await db.destroy();
  });

  registerRoutes(app, db);

  return app;
};

const start = async () => {
  const app = buildApp();

  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await applyMigrations((app as any).db);
    await ensureInitialAdmin((app as any).db);

    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
