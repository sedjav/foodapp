import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { verifyPassword } from "./auth.js";
import { hashPassword } from "./auth.js";
import { sql } from "kysely";
import type { Db } from "./db/client.js";
import type { UserRole, EventState } from "./db/types.js";
import { randomUUID } from "node:crypto";
import { computeEventCharges } from "./cost-engine.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; role: UserRole };
    user: { sub: string; role: UserRole };
  }
}

const requireAuth = async (_app: FastifyInstance, req: FastifyRequest) => {
  await req.jwtVerify();
  return req.user as { sub: string; role: UserRole };
};

const requireAdmin = async (app: FastifyInstance, req: FastifyRequest) => {
  const user = await requireAuth(app, req);
  if (user.role !== "ADMIN") {
    const err: any = new Error("Forbidden");
    err.statusCode = 403;
    throw err;
  }
  return user;
};

const parseTagsJson = (tagsJson: unknown): string[] => {
  if (typeof tagsJson !== "string" || !tagsJson.trim()) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim());
  } catch {
    return [];
  }
};

export const registerRoutes = (app: FastifyInstance, db: Db) => {
  app.post("/api/v1/auth/login", async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as { email?: string; password?: string };
    if (!body?.email || !body?.password) {
      return reply.status(400).send({ message: "email and password are required" });
    }

    const user = await db
      .selectFrom("users")
      .select(["id", "email", "display_name", "password_hash", "role"])
      .where("email", "=", body.email)
      .executeTakeFirst();

    if (!user) return reply.status(401).send({ message: "invalid credentials" });

    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) return reply.status(401).send({ message: "invalid credentials" });

    const token = await reply.jwtSign({ sub: user.id, role: user.role }, { expiresIn: "30d" });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role
      }
    };
  });

  app.get("/api/v1/me", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);

    const user = await db
      .selectFrom("users")
      .select(["id", "email", "display_name", "role", "created_at"])
      .where("id", "=", auth.sub)
      .executeTakeFirst();

    if (!user) return reply.status(404).send({ message: "not found" });

    return {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      createdAt: user.created_at
    };
  });

  app.get("/api/v1/wallet", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const w = await db
      .selectFrom("wallets")
      .select(["user_id", "balance_irr"])
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();

    if (!w) return reply.status(404).send({ message: "not found" });
    return { userId: (w as any).user_id, balanceIrr: (w as any).balance_irr };
  });

  app.get("/api/v1/wallet/transactions", async (req: FastifyRequest) => {
    const auth = await requireAuth(app, req);
    return db
      .selectFrom("wallet_transactions")
      .leftJoin("events", "events.id", "wallet_transactions.event_id")
      .select([
        "wallet_transactions.id as id",
        "wallet_transactions.type as type",
        "wallet_transactions.amount_irr as amount_irr",
        "wallet_transactions.event_id as event_id",
        "events.name as event_name",
        "wallet_transactions.created_at as created_at"
      ])
      .where("wallet_transactions.user_id", "=", auth.sub)
      .orderBy("wallet_transactions.created_at", "desc")
      .limit(50)
      .execute();
  });

  app.get("/api/v1/payor/charges", async (req: FastifyRequest) => {
    const auth = await requireAuth(app, req);
    return db
      .selectFrom("event_charges")
      .innerJoin("events", "events.id", "event_charges.event_id")
      .select([
        "event_charges.event_id as event_id",
        "events.name as event_name",
        "events.state as event_state",
        "event_charges.total_irr as total_irr",
        "event_charges.finalized_at_utc as finalized_at_utc"
      ])
      .where("event_charges.payor_user_id", "=", auth.sub)
      .orderBy("event_charges.finalized_at_utc", "desc")
      .execute();
  });

  app.get("/api/v1/payor/payment-links", async (req: FastifyRequest) => {
    const auth = await requireAuth(app, req);
    return db
      .selectFrom("payment_links")
      .innerJoin("events", "events.id", "payment_links.event_id")
      .select([
        "payment_links.id as id",
        "payment_links.event_id as event_id",
        "events.name as event_name",
        "payment_links.payor_user_id as payor_user_id",
        "payment_links.token as token",
        "payment_links.locked_amount_irr as locked_amount_irr",
        "payment_links.status as status",
        "payment_links.created_at as created_at"
      ])
      .where("payment_links.payor_user_id", "=", auth.sub)
      .orderBy("payment_links.created_at", "desc")
      .execute();
  });

  app.post("/api/v1/payor/charges/:eventId/payment-link", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };

    const existing = await db
      .selectFrom("payment_links")
      .select(["id", "token", "status"])
      .where("event_id", "=", eventId)
      .where("payor_user_id", "=", auth.sub)
      .where("status", "=", "OPEN" as any)
      .executeTakeFirst();
    if (existing) return reply.send({ id: (existing as any).id, token: (existing as any).token });

    const charge = await db
      .selectFrom("event_charges")
      .select(["total_irr"])
      .where("event_id", "=", eventId)
      .where("payor_user_id", "=", auth.sub)
      .executeTakeFirst();
    if (!charge) return reply.status(404).send({ message: "charge not found" });

    const now = new Date().toISOString();
    const id = randomUUID();
    const token = randomUUID();
    await db
      .insertInto("payment_links")
      .values({
        id,
        event_id: eventId,
        payor_user_id: auth.sub,
        token,
        locked_amount_irr: (charge as any).total_irr,
        status: "OPEN" as any,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id, token });
  });

  app.post("/api/v1/payment-links/:token/pay-with-wallet", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { token } = req.params as { token: string };

    const result = await db.transaction().execute(async (trx) => {
      const link = await trx
        .selectFrom("payment_links")
        .select(["id", "event_id", "payor_user_id", "locked_amount_irr", "status"])
        .where("token", "=", token)
        .executeTakeFirst();

      if (!link) return { status: 404 as const, body: { message: "not found" } };
      if ((link as any).payor_user_id !== auth.sub) return { status: 403 as const, body: { message: "Forbidden" } };
      if ((link as any).status !== "OPEN") return { status: 400 as const, body: { message: "link is not open" } };

      const amount = (link as any).locked_amount_irr;
      if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
        return { status: 400 as const, body: { message: "invalid amount" } };
      }

      const now = new Date().toISOString();

      const walletUpdate = await trx
        .updateTable("wallets")
        .set({
          balance_irr: sql`balance_irr - ${amount}` as any
        })
        .where("user_id", "=", auth.sub)
        .where("balance_irr", ">=", amount)
        .executeTakeFirst();

      const updatedWalletRows = Number((walletUpdate as any)?.numUpdatedRows ?? 0);
      if (updatedWalletRows < 1) {
        return { status: 400 as const, body: { message: "insufficient balance" } };
      }

      await trx
        .insertInto("wallet_transactions")
        .values({
          id: randomUUID(),
          user_id: auth.sub,
          type: "EVENT_CHARGE" as any,
          amount_irr: -amount,
          event_id: (link as any).event_id,
          created_at: now
        })
        .execute();

      const linkUpdate = await trx
        .updateTable("payment_links")
        .set({ status: "PAID" as any })
        .where("id", "=", (link as any).id)
        .where("status", "=", "OPEN" as any)
        .executeTakeFirst();

      const updatedLinkRows = Number((linkUpdate as any)?.numUpdatedRows ?? 0);
      if (updatedLinkRows < 1) {
        return { status: 400 as const, body: { message: "link is not open" } };
      }

      const wallet = await trx
        .selectFrom("wallets")
        .select(["balance_irr"])
        .where("user_id", "=", auth.sub)
        .executeTakeFirst();

      return { status: 200 as const, body: { ok: true, newBalanceIrr: (wallet as any)?.balance_irr ?? 0 } };
    });

    if (result.status !== 200) return reply.status(result.status).send(result.body);
    return reply.send(result.body);
  });

  app.post("/api/v1/payment-links/:token/void", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { token } = req.params as { token: string };

    const link = await db
      .selectFrom("payment_links")
      .select(["id", "payor_user_id", "status"])
      .where("token", "=", token)
      .executeTakeFirst();

    if (!link) return reply.status(404).send({ message: "not found" });
    if ((link as any).payor_user_id !== auth.sub) return reply.status(403).send({ message: "Forbidden" });
    if ((link as any).status === "PAID") return reply.status(400).send({ message: "link is already paid" });
    if ((link as any).status === "VOID") return reply.status(400).send({ message: "link is already void" });
    if ((link as any).status !== "OPEN") return reply.status(400).send({ message: "link is not open" });

    await db.updateTable("payment_links").set({ status: "VOID" as any }).where("id", "=", (link as any).id).execute();
    return reply.send({ ok: true });
  });

  app.get("/api/v1/payment-links/:token", async (req: FastifyRequest, reply: FastifyReply) => {
    const { token } = req.params as { token: string };

    const link = await db
      .selectFrom("payment_links")
      .innerJoin("events", "events.id", "payment_links.event_id")
      .select([
        "payment_links.event_id as event_id",
        "events.name as event_name",
        "payment_links.status as status",
        "payment_links.locked_amount_irr as locked_amount_irr"
      ])
      .where("payment_links.token", "=", token)
      .executeTakeFirst();

    if (!link) return reply.status(404).send({ message: "not found" });
    return link;
  });

  app.get("/api/v1/events", async (req: FastifyRequest) => {
    const auth = await requireAuth(app, req);
    return db
      .selectFrom("event_guests")
      .innerJoin("events", "events.id", "event_guests.event_id")
      .select(["events.id", "events.name", "events.starts_at_utc", "events.cutoff_at_utc", "events.state"])
      .where("event_guests.user_id", "=", auth.sub)
      .orderBy("events.starts_at_utc", "desc")
      .execute();
  });

  app.get("/api/v1/events/:eventId", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };

    const canSee = await db
      .selectFrom("event_guests")
      .select(["event_id"])
      .where("event_id", "=", eventId)
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();

    if (!canSee) return reply.status(403).send({ message: "Forbidden" });

    const ev = await db
      .selectFrom("events")
      .select(["id", "name", "starts_at_utc", "cutoff_at_utc", "state"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    if (!ev) return reply.status(404).send({ message: "not found" });
    return ev;
  });

  app.get("/api/v1/events/:eventId/menu-items", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };

    const canSee = await db
      .selectFrom("event_guests")
      .select(["event_id"])
      .where("event_id", "=", eventId)
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();

    if (!canSee) return reply.status(403).send({ message: "Forbidden" });

    const rows = await db
      .selectFrom("menu_items")
      .innerJoin("menus", "menus.id", "menu_items.menu_id")
      .leftJoin("menu_item_categories", "menu_item_categories.id", "menu_items.category_id")
      .select([
        "menu_items.id as id",
        "menu_items.menu_id as menu_id",
        "menus.name as menu_name",
        "menu_items.name as name",
        "menu_items.price_irr as price_irr",
        "menu_items.tags_json as tags_json",
        "menu_item_categories.name_en as category_name_en",
        "menu_item_categories.name_fa as category_name_fa"
      ])
      .where("menus.event_id", "=", eventId)
      .where("menu_items.is_active", "=", 1 as any)
      .orderBy("menus.sort_order", "asc")
      .orderBy("menu_items.created_at", "desc")
      .execute();

    return (rows as any[]).map((r) => ({
      ...r,
      tags: parseTagsJson((r as any).tags_json)
    }));
  });

  app.get("/api/v1/events/:eventId/managed-participants", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };

    const canSee = await db
      .selectFrom("event_guests")
      .select(["event_id"])
      .where("event_id", "=", eventId)
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();
    if (!canSee) return reply.status(403).send({ message: "Forbidden" });

    return db
      .selectFrom("event_participants")
      .innerJoin("participants", "participants.id", "event_participants.participant_id")
      .select([
        "event_participants.participant_id as participant_id",
        "participants.display_name as display_name",
        "event_participants.attendance_status as attendance_status"
      ])
      .where("event_participants.event_id", "=", eventId)
      .where("event_participants.managing_user_id", "=", auth.sub)
      .orderBy("participants.display_name", "asc")
      .execute();
  });

  app.patch("/api/v1/events/:eventId/participants/:participantId/attendance", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId, participantId } = req.params as { eventId: string; participantId: string };
    const body = req.body as { attendance?: string };

    const validStatuses = ["ATTENDING", "TENTATIVE", "DECLINED"];
    if (!body?.attendance || !validStatuses.includes(body.attendance)) {
      return reply.status(400).send({ message: "attendance must be ATTENDING, TENTATIVE, or DECLINED" });
    }

    const ep = await db
      .selectFrom("event_participants")
      .select(["participant_id", "managing_user_id"])
      .where("event_id", "=", eventId)
      .where("participant_id", "=", participantId)
      .executeTakeFirst();

    if (!ep) return reply.status(404).send({ message: "not found" });
    if ((ep as any).managing_user_id !== auth.sub) {
      return reply.status(403).send({ message: "Forbidden" });
    }

    await db
      .updateTable("event_participants")
      .set({ attendance_status: body.attendance as any })
      .where("event_id", "=", eventId)
      .where("participant_id", "=", participantId)
      .execute();

    return reply.send({ ok: true });
  });

  app.get("/api/v1/events/:eventId/selections", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };

    const canSee = await db
      .selectFrom("event_guests")
      .select(["event_id"])
      .where("event_id", "=", eventId)
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();
    if (!canSee) return reply.status(403).send({ message: "Forbidden" });

    const managedParticipantIds = await db
      .selectFrom("event_participants")
      .select(["participant_id"])
      .where("event_id", "=", eventId)
      .where("managing_user_id", "=", auth.sub)
      .execute();
    const managedSet = new Set((managedParticipantIds as any[]).map((r) => r.participant_id));

    if (managedSet.size === 0) {
      return [];
    }

    const selectionIdsWithManagedAlloc = await db
      .selectFrom("selection_allocations")
      .innerJoin("selections", "selections.id", "selection_allocations.selection_id")
      .select(["selection_allocations.selection_id as selection_id"])
      .where("selections.event_id", "=", eventId)
      .where("selection_allocations.participant_id", "in", [...managedSet] as any)
      .execute();

    const relevantSelectionIds = [...new Set((selectionIdsWithManagedAlloc as any[]).map((r) => r.selection_id))];
    if (relevantSelectionIds.length === 0) {
      return [];
    }

    const selections = await db
      .selectFrom("selections")
      .innerJoin("menu_items", "menu_items.id", "selections.menu_item_id")
      .innerJoin("menus", "menus.id", "menu_items.menu_id")
      .select([
        "selections.id as id",
        "selections.event_id as event_id",
        "selections.menu_item_id as menu_item_id",
        "selections.quantity as quantity",
        "selections.created_at as created_at",
        "menu_items.name as item_name",
        "menu_items.price_irr as item_price_irr",
        "menus.name as menu_name"
      ])
      .where("selections.id", "in", relevantSelectionIds as any)
      .orderBy("selections.created_at", "desc")
      .execute();

    const selectionIds = selections.map((s: any) => s.id);
    const allocations = selectionIds.length
      ? await db
          .selectFrom("selection_allocations")
          .innerJoin("participants", "participants.id", "selection_allocations.participant_id")
          .select([
            "selection_allocations.selection_id as selection_id",
            "selection_allocations.participant_id as participant_id",
            "participants.display_name as display_name"
          ])
          .where("selection_id", "in", selectionIds as any)
          .execute()
      : [];

    const allocBySelection = new Map<string, any[]>();
    for (const a of allocations as any[]) {
      const arr = allocBySelection.get(a.selection_id) ?? [];
      arr.push(a);
      allocBySelection.set(a.selection_id, arr);
    }

    return (selections as any[]).map((s) => ({
      ...s,
      allocations: allocBySelection.get(s.id) ?? []
    }));
  });

  app.post("/api/v1/events/:eventId/selections", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { menuItemId?: string; quantity?: number; participantIds?: string[] };

    const canSee = await db
      .selectFrom("event_guests")
      .select(["event_id"])
      .where("event_id", "=", eventId)
      .where("user_id", "=", auth.sub)
      .executeTakeFirst();
    if (!canSee) return reply.status(403).send({ message: "Forbidden" });

    const ev = await db.selectFrom("events").select(["state", "cutoff_at_utc"]).where("id", "=", eventId).executeTakeFirst();
    if (!ev) return reply.status(404).send({ message: "not found" });
    if ((ev as any).state !== "OPEN") return reply.status(400).send({ message: "event is not open" });
    if (Date.now() >= Date.parse((ev as any).cutoff_at_utc)) return reply.status(400).send({ message: "cutoff passed" });

    const menuItemId = body?.menuItemId;
    const quantity = body?.quantity;
    const participantIds = body?.participantIds ?? [];

    if (!menuItemId || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return reply.status(400).send({ message: "menuItemId and integer quantity>=1 are required" });
    }
    if (!Array.isArray(participantIds) || participantIds.length < 1) {
      return reply.status(400).send({ message: "participantIds must be a non-empty array" });
    }

    const menuItemOk = await db
      .selectFrom("menu_items")
      .innerJoin("menus", "menus.id", "menu_items.menu_id")
      .select(["menu_items.id as id"])
      .where("menu_items.id", "=", menuItemId)
      .where("menus.event_id", "=", eventId)
      .executeTakeFirst();

    if (!menuItemOk) return reply.status(400).send({ message: "invalid menuItemId" });

    const manageable = await db
      .selectFrom("event_participants")
      .select(["participant_id"])
      .where("event_id", "=", eventId)
      .where("managing_user_id", "=", auth.sub)
      .where("participant_id", "in", participantIds as any)
      .execute();

    const manageableSet = new Set((manageable as any[]).map((r) => r.participant_id));
    for (const pid of participantIds) {
      if (!manageableSet.has(pid)) return reply.status(403).send({ message: "cannot manage one or more participants" });
    }

    const now = new Date().toISOString();
    const selectionId = randomUUID();

    await db
      .insertInto("selections")
      .values({
        id: selectionId,
        event_id: eventId,
        menu_item_id: menuItemId,
        quantity,
        created_by_user_id: auth.sub,
        note: null,
        created_at: now
      })
      .execute();

    for (const pid of participantIds) {
      await db
        .insertInto("selection_allocations")
        .values({
          id: randomUUID(),
          selection_id: selectionId,
          participant_id: pid,
          share_type: "EQUAL" as any,
          share_weight: null,
          created_at: now
        })
        .execute();
    }

    return reply.status(201).send({ id: selectionId });
  });

  app.patch("/api/v1/selections/:selectionId", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { selectionId } = req.params as { selectionId: string };
    const body = req.body as { quantity?: number; participantIds?: string[] };

    const quantity = body?.quantity;
    const participantIds = body?.participantIds ?? [];

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return reply.status(400).send({ message: "integer quantity>=1 is required" });
    }
    if (!Array.isArray(participantIds) || participantIds.length < 1) {
      return reply.status(400).send({ message: "participantIds must be a non-empty array" });
    }

    const sel = await db
      .selectFrom("selections")
      .select(["id", "event_id", "created_by_user_id"])
      .where("id", "=", selectionId)
      .executeTakeFirst();

    if (!sel) return reply.status(404).send({ message: "not found" });
    if ((sel as any).created_by_user_id !== auth.sub) return reply.status(403).send({ message: "Forbidden" });

    const ev = await db
      .selectFrom("events")
      .select(["state", "cutoff_at_utc"])
      .where("id", "=", (sel as any).event_id)
      .executeTakeFirst();
    if (!ev) return reply.status(404).send({ message: "not found" });
    if ((ev as any).state !== "OPEN") return reply.status(400).send({ message: "event is not open" });
    if (Date.now() >= Date.parse((ev as any).cutoff_at_utc)) return reply.status(400).send({ message: "cutoff passed" });

    const manageable = await db
      .selectFrom("event_participants")
      .select(["participant_id"])
      .where("event_id", "=", (sel as any).event_id)
      .where("managing_user_id", "=", auth.sub)
      .where("participant_id", "in", participantIds as any)
      .execute();

    const manageableSet = new Set((manageable as any[]).map((r) => r.participant_id));
    for (const pid of participantIds) {
      if (!manageableSet.has(pid)) return reply.status(403).send({ message: "cannot manage one or more participants" });
    }

    const now = new Date().toISOString();

    await db.transaction().execute(async (trx) => {
      await trx.updateTable("selections").set({ quantity }).where("id", "=", selectionId).execute();

      await trx.deleteFrom("selection_allocations").where("selection_id", "=", selectionId).execute();

      for (const pid of participantIds) {
        await trx
          .insertInto("selection_allocations")
          .values({
            id: randomUUID(),
            selection_id: selectionId,
            participant_id: pid,
            share_type: "EQUAL" as any,
            share_weight: null,
            created_at: now
          })
          .execute();
      }
    });

    return reply.send({ ok: true });
  });

  app.delete("/api/v1/selections/:selectionId", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireAuth(app, req);
    const { selectionId } = req.params as { selectionId: string };

    const sel = await db
      .selectFrom("selections")
      .select(["id", "event_id", "created_by_user_id"])
      .where("id", "=", selectionId)
      .executeTakeFirst();

    if (!sel) return reply.status(404).send({ message: "not found" });
    if ((sel as any).created_by_user_id !== auth.sub) return reply.status(403).send({ message: "Forbidden" });

    const ev = await db.selectFrom("events").select(["state", "cutoff_at_utc"]).where("id", "=", (sel as any).event_id).executeTakeFirst();
    if (!ev) return reply.status(404).send({ message: "not found" });
    if ((ev as any).state !== "OPEN") return reply.status(400).send({ message: "event is not open" });
    if (Date.now() >= Date.parse((ev as any).cutoff_at_utc)) return reply.status(400).send({ message: "cutoff passed" });

    await db.deleteFrom("selections").where("id", "=", selectionId).execute();
    return reply.send({ ok: true });
  });

  app.get("/api/v1/admin/users", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);

    const users = await db
      .selectFrom("users")
      .select(["id", "email", "display_name", "role", "created_at"])
      .orderBy("created_at", "desc")
      .execute();

    return users.map((u: any) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      createdAt: u.created_at
    }));
  });

  app.post("/api/v1/admin/users", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);

    const body = req.body as {
      email?: string;
      displayName?: string;
      password?: string;
      role?: UserRole;
    };

    const email = body?.email?.trim();
    const displayName = body?.displayName?.trim();
    const password = body?.password;
    const role: UserRole = body?.role ?? "USER";

    if (!email || !displayName || !password) {
      return reply.status(400).send({ message: "email, displayName, and password are required" });
    }

    if (role !== "ADMIN" && role !== "USER") {
      return reply.status(400).send({ message: "invalid role" });
    }

    const existing = await db.selectFrom("users").select(["id"]).where("email", "=", email).executeTakeFirst();
    if (existing) {
      return reply.status(409).send({ message: "email already exists" });
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const passwordHash = await hashPassword(password);

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

    return reply.status(201).send({
      id,
      email,
      displayName,
      role,
      createdAt: now
    });
  });

  app.post("/api/v1/admin/users/:userId/wallet-topup", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { userId } = req.params as { userId: string };
    const body = req.body as { amountIrr?: number };

    const amountIrr = body?.amountIrr;
    if (typeof amountIrr !== "number" || !Number.isInteger(amountIrr) || amountIrr <= 0) {
      return reply.status(400).send({ message: "amountIrr must be a positive integer" });
    }

    const now = new Date().toISOString();

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable("wallets")
        .set({
          balance_irr: sql`balance_irr + ${amountIrr}` as any
        })
        .where("user_id", "=", userId)
        .execute();

      await trx
        .insertInto("wallet_transactions")
        .values({
          id: randomUUID(),
          user_id: userId,
          type: "TOPUP" as any,
          amount_irr: amountIrr,
          event_id: null,
          created_at: now
        })
        .execute();
    });

    return reply.send({ ok: true });
  });

  app.get("/api/v1/admin/event-templates", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    return db
      .selectFrom("event_templates")
      .select(["id", "name", "description", "default_location_text", "created_at"])
      .orderBy("created_at", "desc")
      .execute();
  });

  app.get("/api/v1/admin/event-templates/:templateId/guests", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { templateId } = req.params as { templateId: string };
    return db.selectFrom("event_template_guests").selectAll().where("template_id", "=", templateId).execute();
  });

  app.post("/api/v1/admin/event-templates/:templateId/guests", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { templateId } = req.params as { templateId: string };
    const body = req.body as { userId?: string };
    if (!body?.userId) return reply.status(400).send({ message: "userId is required" });

    const now = new Date().toISOString();
    await db
      .insertInto("event_template_guests")
      .values({
        template_id: templateId,
        user_id: body.userId,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ ok: true });
  });

  app.delete(
    "/api/v1/admin/event-templates/:templateId/guests/:userId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { templateId, userId } = req.params as { templateId: string; userId: string };
      await db.deleteFrom("event_template_guests").where("template_id", "=", templateId).where("user_id", "=", userId).execute();
      return reply.send({ ok: true });
    }
  );

  app.get("/api/v1/admin/event-templates/:templateId/participants", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { templateId } = req.params as { templateId: string };
    return db.selectFrom("event_template_participants").selectAll().where("template_id", "=", templateId).execute();
  });

  app.post(
    "/api/v1/admin/event-templates/:templateId/participants",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { templateId } = req.params as { templateId: string };
      const body = req.body as {
        participantId?: string;
        managingUserId?: string;
        defaultAttendanceStatus?: string;
      };

      if (!body?.participantId || !body?.defaultAttendanceStatus) {
        return reply.status(400).send({ message: "participantId and defaultAttendanceStatus are required" });
      }

      const participant = await db
        .selectFrom("participants")
        .select(["owner_user_id"])
        .where("id", "=", body.participantId)
        .executeTakeFirst();

      if (!participant) {
        return reply.status(400).send({ message: "invalid participantId" });
      }

      const managingUserId = body.managingUserId ?? (participant as any).owner_user_id;

      const now = new Date().toISOString();
      await db
        .insertInto("event_template_participants")
        .values({
          template_id: templateId,
          participant_id: body.participantId,
          managing_user_id: managingUserId,
          default_attendance_status: body.defaultAttendanceStatus as any,
          created_at: now
        })
        .execute();

      return reply.status(201).send({ ok: true });
    }
  );

  app.delete(
    "/api/v1/admin/event-templates/:templateId/participants/:participantId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { templateId, participantId } = req.params as { templateId: string; participantId: string };
      await db
        .deleteFrom("event_template_participants")
        .where("template_id", "=", templateId)
        .where("participant_id", "=", participantId)
        .execute();
      return reply.send({ ok: true });
    }
  );

  app.post("/api/v1/admin/event-templates", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const body = req.body as { name?: string; description?: string | null; defaultLocationText?: string | null };
    const name = body?.name?.trim();
    if (!name) return reply.status(400).send({ message: "name is required" });

    const now = new Date().toISOString();
    const id = randomUUID();

    await db
      .insertInto("event_templates")
      .values({
        id,
        name,
        description: body?.description ?? null,
        default_location_text: body?.defaultLocationText ?? null,
        created_at: now
      })
      .execute();

    return reply.status(201).send({
      id,
      name,
      description: body?.description ?? null,
      default_location_text: body?.defaultLocationText ?? null,
      created_at: now
    });
  });

  app.get("/api/v1/admin/events", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    return db
      .selectFrom("events")
      .select([
        "id",
        "template_id",
        "name",
        "description",
        "location_text",
        "location_user_id",
        "host_user_id",
        "starts_at_utc",
        "cutoff_at_utc",
        "state",
        "visibility_mode",
        "payor_exemption_enabled",
        "created_at"
      ])
      .orderBy("starts_at_utc", "desc")
      .execute();
  });

  app.get("/api/v1/admin/events/:eventId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    const ev = await db
      .selectFrom("events")
      .selectAll()
      .where("id", "=", eventId)
      .executeTakeFirst();

    if (!ev) return reply.status(404).send({ message: "not found" });
    return ev;
  });

  app.get("/api/v1/admin/events/:eventId/guests", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("event_guests").selectAll().where("event_id", "=", eventId).execute();
  });

  app.get("/api/v1/admin/events/:eventId/hosts", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("event_hosts").selectAll().where("event_id", "=", eventId).execute();
  });

  app.post("/api/v1/admin/events/:eventId/hosts", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { userId?: string };
    if (!body?.userId) return reply.status(400).send({ message: "userId is required" });

    const now = new Date().toISOString();
    await db
      .insertInto("event_hosts")
      .values({
        event_id: eventId,
        user_id: body.userId,
        created_at: now
      })
      .execute();

    await db
      .insertInto("event_guests")
      .values({
        event_id: eventId,
        user_id: body.userId,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ ok: true });
  });

  app.delete("/api/v1/admin/events/:eventId/hosts/:userId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId, userId } = req.params as { eventId: string; userId: string };

    const hosts = await db.selectFrom("event_hosts").select(["user_id"]).where("event_id", "=", eventId).execute();
    const hostUserIds = hosts.map((h: any) => h.user_id);
    if (hostUserIds.length <= 1) {
      return reply.status(400).send({ message: "event must have at least one host" });
    }

    await db.deleteFrom("event_hosts").where("event_id", "=", eventId).where("user_id", "=", userId).execute();

    const ev = await db.selectFrom("events").select(["host_user_id"]).where("id", "=", eventId).executeTakeFirst();
    if (ev && (ev as any).host_user_id === userId) {
      const nextHost = hostUserIds.find((id) => id !== userId);
      if (nextHost) {
        await db.updateTable("events").set({ host_user_id: nextHost } as any).where("id", "=", eventId).execute();
      }
    }

    return reply.send({ ok: true });
  });

  app.get("/api/v1/admin/events/:eventId/participants", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("event_participants").selectAll().where("event_id", "=", eventId).execute();
  });

  app.get("/api/v1/admin/events/:eventId/shared-costs", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("shared_costs").selectAll().where("event_id", "=", eventId).orderBy("created_at", "desc").execute();
  });

  app.post("/api/v1/admin/events/:eventId/shared-costs", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { name?: string; amountIrr?: number; splitMethod?: "EQUAL_ALL_ATTENDING" };

    const name = body?.name?.trim();
    const amountIrr = body?.amountIrr;
    if (!name || typeof amountIrr !== "number" || !Number.isInteger(amountIrr) || amountIrr < 0) {
      return reply.status(400).send({ message: "name and integer amountIrr>=0 are required" });
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    await db
      .insertInto("shared_costs")
      .values({
        id,
        event_id: eventId,
        name,
        amount_irr: amountIrr,
        split_method: (body?.splitMethod ?? "EQUAL_ALL_ATTENDING") as any,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id });
  });

  app.delete("/api/v1/admin/events/:eventId/shared-costs/:sharedCostId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId, sharedCostId } = req.params as { eventId: string; sharedCostId: string };
    await db.deleteFrom("shared_costs").where("event_id", "=", eventId).where("id", "=", sharedCostId).execute();
    return reply.send({ ok: true });
  });

  app.post("/api/v1/admin/events/:eventId/participants", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { participantId?: string; managingUserId?: string; attendanceStatus?: string };
    if (!body?.participantId || !body?.attendanceStatus) {
      return reply.status(400).send({ message: "participantId and attendanceStatus are required" });
    }

    const participant = await db
      .selectFrom("participants")
      .select(["owner_user_id"])
      .where("id", "=", body.participantId)
      .executeTakeFirst();

    if (!participant) {
      return reply.status(400).send({ message: "invalid participantId" });
    }

    const managingUserId = body.managingUserId ?? (participant as any).owner_user_id;

    const now = new Date().toISOString();
    await db
      .insertInto("event_participants")
      .values({
        event_id: eventId,
        participant_id: body.participantId,
        managing_user_id: managingUserId,
        attendance_status: body.attendanceStatus as any,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ ok: true });
  });

  app.patch(
    "/api/v1/admin/events/:eventId/participants/:participantId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };
      const body = req.body as { attendanceStatus?: string };
      if (!body?.attendanceStatus) return reply.status(400).send({ message: "attendanceStatus is required" });

      await db
        .updateTable("event_participants")
        .set({
          attendance_status: body.attendanceStatus as any
        })
        .where("event_id", "=", eventId)
        .where("participant_id", "=", participantId)
        .execute();

      return reply.send({ ok: true });
    }
  );

  app.delete(
    "/api/v1/admin/events/:eventId/participants/:participantId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };
      await db.deleteFrom("event_participants").where("event_id", "=", eventId).where("participant_id", "=", participantId).execute();
      await db.deleteFrom("event_payor_overrides").where("event_id", "=", eventId).where("participant_id", "=", participantId).execute();
      return reply.send({ ok: true });
    }
  );

  app.get("/api/v1/admin/events/:eventId/payor-overrides", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("event_payor_overrides").selectAll().where("event_id", "=", eventId).execute();
  });

  app.delete(
    "/api/v1/admin/events/:eventId/payor-overrides/:participantId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };
      await db.deleteFrom("event_payor_overrides").where("event_id", "=", eventId).where("participant_id", "=", participantId).execute();
      return reply.send({ ok: true });
    }
  );

  app.post("/api/v1/admin/events", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const body = req.body as {
      templateId?: string | null;
      name?: string;
      description?: string | null;
      locationText?: string;
      locationUserId?: string | null;
      hostUserId?: string;
      hostUserIds?: string[];
      startsAtUtc?: string;
      cutoffAtUtc?: string;
      visibilityMode?: "OPEN" | "PRIVATE_PAYOR";
      payorExemptionEnabled?: boolean;
    };

    const name = body?.name?.trim();
    let locationText = body?.locationText?.trim();

    const locationUserId = body?.locationUserId ?? null;

    const hostUserIds = Array.isArray(body?.hostUserIds)
      ? body.hostUserIds.filter((x) => typeof x === "string" && x)
      : [];

    if (hostUserIds.length === 0 && body?.hostUserId) hostUserIds.push(body.hostUserId);

    const primaryHostUserId = hostUserIds[0];

    const startsAtUtc = body?.startsAtUtc;
    const cutoffAtUtc = body?.cutoffAtUtc;
    const visibilityMode = body?.visibilityMode ?? "OPEN";

    if (!locationText && locationUserId) {
      const u = await db.selectFrom("users").select(["display_name"]).where("id", "=", locationUserId).executeTakeFirst();
      if (u && (u as any).display_name) locationText = (u as any).display_name;
    }

    if (!name || !locationText || !primaryHostUserId || !startsAtUtc || !cutoffAtUtc) {
      return reply
        .status(400)
        .send({ message: "name, locationText (or locationUserId), hostUserId(s), startsAtUtc, cutoffAtUtc are required" });
    }

    const now = new Date().toISOString();
    const id = randomUUID();

    await db
      .insertInto("events")
      .values({
        id,
        template_id: body?.templateId ?? null,
        name,
        description: body?.description ?? null,
        location_text: locationText,
        location_user_id: locationUserId,
        host_user_id: primaryHostUserId,
        starts_at_utc: startsAtUtc,
        cutoff_at_utc: cutoffAtUtc,
        state: "DRAFT",
        visibility_mode: visibilityMode,
        payor_exemption_enabled: body?.payorExemptionEnabled === false ? 0 : 1,
        created_at: now
      })
      .execute();

    const guestUserIds = new Set<string>();
    for (const h of hostUserIds) guestUserIds.add(h);

    for (const h of hostUserIds) {
      await db
        .insertInto("event_hosts")
        .values({
          event_id: id,
          user_id: h,
          created_at: now
        })
        .execute();
    }

    if (body?.templateId) {
      const templateGuests = await db
        .selectFrom("event_template_guests")
        .select(["user_id"])
        .where("template_id", "=", body.templateId)
        .execute();
      for (const g of templateGuests) guestUserIds.add((g as any).user_id);
    }

    for (const userId of guestUserIds) {
      await db
        .insertInto("event_guests")
        .values({
          event_id: id,
          user_id: userId,
          created_at: now
        })
        .execute();
    }

    if (body?.templateId) {
      const templateParticipants = await db
        .selectFrom("event_template_participants")
        .select(["participant_id", "managing_user_id", "default_attendance_status"])
        .where("template_id", "=", body.templateId)
        .execute();

      for (const tp of templateParticipants as any[]) {
        await db
          .insertInto("event_participants")
          .values({
            event_id: id,
            participant_id: tp.participant_id,
            managing_user_id: tp.managing_user_id,
            attendance_status: tp.default_attendance_status,
            created_at: now
          })
          .execute();
      }
    }

    return reply.status(201).send({ id });
  });

  app.patch("/api/v1/admin/events/:eventId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as {
      locationText?: string;
      locationUserId?: string | null;
      payorExemptionEnabled?: boolean;
    };

    let locationText = body?.locationText?.trim();
    const locationUserId = body?.locationUserId ?? null;

    if (!locationText && locationUserId) {
      const u = await db.selectFrom("users").select(["display_name"]).where("id", "=", locationUserId).executeTakeFirst();
      if (u && (u as any).display_name) locationText = (u as any).display_name;
    }

    const update: any = {};
    if (typeof locationText === "string" && locationText) update.location_text = locationText;
    if (body?.locationUserId !== undefined) update.location_user_id = locationUserId;
    if (body?.payorExemptionEnabled !== undefined) update.payor_exemption_enabled = body.payorExemptionEnabled ? 1 : 0;

    if (Object.keys(update).length === 0) {
      return reply.status(400).send({ message: "no fields to update" });
    }

    await db.updateTable("events").set(update).where("id", "=", eventId).execute();
    return reply.send({ ok: true });
  });

  app.get("/api/v1/admin/menu-item-categories", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    return db
      .selectFrom("menu_item_categories")
      .select(["id", "code", "name_en", "name_fa", "sort_order", "is_active", "created_at"])
      .orderBy("sort_order", "asc")
      .orderBy("created_at", "desc")
      .execute();
  });

  app.post("/api/v1/admin/menu-item-categories", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const body = req.body as { code?: string; nameEn?: string; nameFa?: string; sortOrder?: number };
    const code = body?.code?.trim();
    const nameEn = body?.nameEn?.trim();
    const nameFa = body?.nameFa?.trim();
    if (!code || !nameEn || !nameFa) {
      return reply.status(400).send({ message: "code, nameEn, nameFa are required" });
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    await db
      .insertInto("menu_item_categories")
      .values({
        id,
        code,
        name_en: nameEn,
        name_fa: nameFa,
        sort_order: Number.isFinite(body?.sortOrder) ? (body!.sortOrder as number) : 0,
        is_active: 1,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id });
  });

  app.post("/api/v1/admin/events/:eventId/guests", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { userId?: string };
    if (!body?.userId) return reply.status(400).send({ message: "userId is required" });

    const now = new Date().toISOString();
    await db
      .insertInto("event_guests")
      .values({
        event_id: eventId,
        user_id: body.userId,
        created_at: now
      })
      .execute();
    return reply.status(201).send({ ok: true });
  });

  app.delete("/api/v1/admin/events/:eventId/guests/:userId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId, userId } = req.params as { eventId: string; userId: string };
    await db.deleteFrom("event_guests").where("event_id", "=", eventId).where("user_id", "=", userId).execute();
    return reply.send({ ok: true });
  });

  app.get("/api/v1/admin/events/:eventId/menus", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    return db.selectFrom("menus").selectAll().where("event_id", "=", eventId).orderBy("sort_order", "asc").execute();
  });

  app.get("/api/v1/admin/events/:eventId/menu-items", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    const rows = await db
      .selectFrom("menu_items")
      .innerJoin("menus", "menus.id", "menu_items.menu_id")
      .leftJoin("menu_item_categories", "menu_item_categories.id", "menu_items.category_id")
      .select([
        "menu_items.id as id",
        "menu_items.menu_id as menu_id",
        "menus.name as menu_name",
        "menu_items.name as name",
        "menu_items.price_irr as price_irr",
        "menu_items.category_id as category_id",
        "menu_items.tags_json as tags_json",
        "menu_item_categories.name_en as category_name_en",
        "menu_item_categories.name_fa as category_name_fa"
      ])
      .where("menus.event_id", "=", eventId)
      .where("menu_items.is_active", "=", 1 as any)
      .orderBy("menus.sort_order", "asc")
      .orderBy("menu_items.created_at", "desc")
      .execute();

    return (rows as any[]).map((r) => ({
      ...r,
      tags: parseTagsJson((r as any).tags_json)
    }));
  });

  app.get("/api/v1/admin/events/:eventId/selections", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    const selections = await db
      .selectFrom("selections")
      .innerJoin("menu_items", "menu_items.id", "selections.menu_item_id")
      .innerJoin("menus", "menus.id", "menu_items.menu_id")
      .leftJoin("menu_item_categories", "menu_item_categories.id", "menu_items.category_id")
      .select([
        "selections.id as id",
        "selections.event_id as event_id",
        "selections.menu_item_id as menu_item_id",
        "selections.quantity as quantity",
        "selections.created_by_user_id as created_by_user_id",
        "selections.note as note",
        "selections.created_at as created_at",
        "menu_items.name as item_name",
        "menu_items.price_irr as item_price_irr",
        "menus.name as menu_name",
        "menu_item_categories.name_en as category_name_en",
        "menu_item_categories.name_fa as category_name_fa"
      ])
      .where("selections.event_id", "=", eventId)
      .orderBy("selections.created_at", "desc")
      .execute();

    const selectionIds = selections.map((s: any) => s.id);
    const allocations = selectionIds.length
      ? await db
          .selectFrom("selection_allocations")
          .select(["id", "selection_id", "participant_id", "share_type", "share_weight", "created_at"])
          .where("selection_id", "in", selectionIds as any)
          .execute()
      : [];

    const allocBySelection = new Map<string, any[]>();
    for (const a of allocations as any[]) {
      const arr = allocBySelection.get(a.selection_id) ?? [];
      arr.push(a);
      allocBySelection.set(a.selection_id, arr);
    }

    return (selections as any[]).map((s) => ({
      ...s,
      allocations: allocBySelection.get(s.id) ?? []
    }));
  });

  app.post("/api/v1/admin/events/:eventId/selections", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    const auth = await requireAuth(app, req);

    const body = req.body as {
      menuItemId?: string;
      quantity?: number;
      participantIds?: string[];
      note?: string | null;
    };

    const menuItemId = body?.menuItemId;
    const quantity = body?.quantity;
    const participantIds = body?.participantIds ?? [];

    if (!menuItemId || typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      return reply.status(400).send({ message: "menuItemId and integer quantity>=1 are required" });
    }

    if (!Array.isArray(participantIds) || participantIds.length < 1) {
      return reply.status(400).send({ message: "participantIds must be a non-empty array" });
    }

    const now = new Date().toISOString();
    const selectionId = randomUUID();

    await db
      .insertInto("selections")
      .values({
        id: selectionId,
        event_id: eventId,
        menu_item_id: menuItemId,
        quantity,
        created_by_user_id: auth.sub,
        note: body?.note ?? null,
        created_at: now
      })
      .execute();

    for (const pid of participantIds) {
      await db
        .insertInto("selection_allocations")
        .values({
          id: randomUUID(),
          selection_id: selectionId,
          participant_id: pid,
          share_type: "EQUAL" as any,
          share_weight: null,
          created_at: now
        })
        .execute();
    }

    return reply.status(201).send({ id: selectionId });
  });

  app.delete("/api/v1/admin/selections/:selectionId", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { selectionId } = req.params as { selectionId: string };
    await db.deleteFrom("selections").where("id", "=", selectionId).execute();
    return reply.send({ ok: true });
  });

  app.post("/api/v1/admin/events/:eventId/menus", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { name?: string; sortOrder?: number };
    const name = body?.name?.trim();
    if (!name) return reply.status(400).send({ message: "name is required" });

    const id = randomUUID();
    const now = new Date().toISOString();
    await db
      .insertInto("menus")
      .values({
        id,
        event_id: eventId,
        name,
        sort_order: Number.isFinite(body?.sortOrder) ? (body!.sortOrder as number) : 0,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id });
  });

  app.get("/api/v1/admin/menus/:menuId/items", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { menuId } = req.params as { menuId: string };
    const items = await db.selectFrom("menu_items").selectAll().where("menu_id", "=", menuId).orderBy("created_at", "desc").execute();
    return (items as any[]).map((it) => ({
      ...it,
      tags: parseTagsJson((it as any).tags_json)
    }));
  });

  app.post("/api/v1/admin/menus/:menuId/items", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { menuId } = req.params as { menuId: string };
    const body = req.body as { name?: string; priceIrr?: number; categoryId?: string | null; tags?: string[] };
    const name = body?.name?.trim();
    const priceIrr = body?.priceIrr;
    if (!name || typeof priceIrr !== "number" || !Number.isInteger(priceIrr)) {
      return reply.status(400).send({ message: "name and integer priceIrr are required" });
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const categoryId = body?.categoryId ?? "uncategorized";
    await db
      .insertInto("menu_items")
      .values({
        id,
        menu_id: menuId,
        name,
        price_irr: priceIrr,
        category_id: categoryId,
        category: null,
        tags_json: body?.tags ? JSON.stringify(body.tags) : null,
        is_active: 1,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id });
  });

  app.get("/api/v1/admin/participants", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    return db.selectFrom("participants").selectAll().orderBy("created_at", "desc").execute();
  });

  app.post("/api/v1/admin/participants", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const body = req.body as { ownerUserId?: string; displayName?: string };
    const ownerUserId = body?.ownerUserId;
    const displayName = body?.displayName?.trim();
    if (!ownerUserId || !displayName) return reply.status(400).send({ message: "ownerUserId and displayName are required" });

    const id = randomUUID();
    const now = new Date().toISOString();
    await db
      .insertInto("participants")
      .values({
        id,
        owner_user_id: ownerUserId,
        display_name: displayName,
        created_at: now
      })
      .execute();

    return reply.status(201).send({ id });
  });

  app.put("/api/v1/admin/participants/:participantId/default-payor", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { participantId } = req.params as { participantId: string };
    const body = req.body as { payorUserId?: string };
    if (!body?.payorUserId) return reply.status(400).send({ message: "payorUserId is required" });

    const now = new Date().toISOString();
    await db.deleteFrom("participant_default_payors").where("participant_id", "=", participantId).execute();
    await db
      .insertInto("participant_default_payors")
      .values({
        participant_id: participantId,
        payor_user_id: body.payorUserId,
        created_at: now
      })
      .execute();
    return reply.send({ ok: true });
  });

  app.put(
    "/api/v1/admin/events/:eventId/payor-overrides/:participantId",
    async (req: FastifyRequest, reply: FastifyReply) => {
      await requireAdmin(app, req);
      const { eventId, participantId } = req.params as { eventId: string; participantId: string };
      const body = req.body as { payorUserId?: string };
      if (!body?.payorUserId) return reply.status(400).send({ message: "payorUserId is required" });

      const now = new Date().toISOString();
      await db.deleteFrom("event_payor_overrides").where("event_id", "=", eventId).where("participant_id", "=", participantId).execute();
      await db
        .insertInto("event_payor_overrides")
        .values({
          event_id: eventId,
          participant_id: participantId,
          payor_user_id: body.payorUserId,
          created_at: now
        })
        .execute();
      return reply.send({ ok: true });
    }
  );

  app.get("/api/v1/admin/events/:eventId/charges-preview", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    const result = await computeEventCharges(db, eventId);
    return result;
  });

  app.post("/api/v1/admin/events/:eventId/transition", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { targetState?: EventState };

    const targetState = body?.targetState;
    if (!targetState) {
      return reply.status(400).send({ message: "targetState is required" });
    }

    const event = await db
      .selectFrom("events")
      .select(["id", "state"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    if (!event) {
      return reply.status(404).send({ message: "event not found" });
    }

    const currentState = (event as any).state as EventState;

    const validTransitions: Record<EventState, EventState[]> = {
      DRAFT: ["OPEN"],
      OPEN: ["LOCKED"],
      LOCKED: ["COMPLETED"],
      COMPLETED: []
    };

    if (!validTransitions[currentState].includes(targetState)) {
      return reply.status(400).send({
        message: `Invalid transition from ${currentState} to ${targetState}`
      });
    }

    if (targetState === "LOCKED") {
      const { payorSummaries } = await computeEventCharges(db, eventId);

      await db.deleteFrom("event_charges").where("event_id", "=", eventId).execute();

      const now = new Date().toISOString();
      for (const ps of payorSummaries) {
        await db
          .insertInto("event_charges")
          .values({
            event_id: eventId,
            payor_user_id: ps.payorUserId,
            total_irr: ps.totalIrr,
            finalized_at_utc: now
          })
          .execute();
      }
    }

    await db
      .updateTable("events")
      .set({ state: targetState })
      .where("id", "=", eventId)
      .execute();

    return reply.send({ ok: true, newState: targetState });
  });

  app.post("/api/v1/admin/events/:eventId/state", async (req: FastifyRequest, reply: FastifyReply) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };
    const body = req.body as { targetState?: EventState };

    const targetState = body?.targetState;
    if (!targetState) {
      return reply.status(400).send({ message: "targetState is required" });
    }

    const event = await db
      .selectFrom("events")
      .select(["id", "state"])
      .where("id", "=", eventId)
      .executeTakeFirst();

    if (!event) {
      return reply.status(404).send({ message: "event not found" });
    }

    if (targetState === "DRAFT" || targetState === "OPEN") {
      const paid = await db
        .selectFrom("payment_links")
        .select(["id"])
        .where("event_id", "=", eventId)
        .where("status", "=", "PAID" as any)
        .executeTakeFirst();

      if (paid) {
        return reply.status(400).send({ message: "cannot reset event state because paid payment links exist" });
      }

      await db.deleteFrom("event_charges").where("event_id", "=", eventId).execute();
      await db.deleteFrom("payment_links").where("event_id", "=", eventId).execute();
    }

    if (targetState === "LOCKED" || targetState === "COMPLETED") {
      const { payorSummaries } = await computeEventCharges(db, eventId);

      await db.deleteFrom("event_charges").where("event_id", "=", eventId).execute();

      const now = new Date().toISOString();
      for (const ps of payorSummaries) {
        await db
          .insertInto("event_charges")
          .values({
            event_id: eventId,
            payor_user_id: ps.payorUserId,
            total_irr: ps.totalIrr,
            finalized_at_utc: now
          })
          .execute();
      }
    }

    await db.updateTable("events").set({ state: targetState }).where("id", "=", eventId).execute();
    return reply.send({ ok: true, newState: targetState });
  });

  app.get("/api/v1/admin/events/:eventId/charges", async (req: FastifyRequest) => {
    await requireAdmin(app, req);
    const { eventId } = req.params as { eventId: string };

    return db
      .selectFrom("event_charges")
      .innerJoin("users", "users.id", "event_charges.payor_user_id")
      .select([
        "event_charges.event_id as event_id",
        "event_charges.payor_user_id as payor_user_id",
        "users.email as payor_email",
        "users.display_name as payor_name",
        "event_charges.total_irr as total_irr",
        "event_charges.finalized_at_utc as finalized_at_utc"
      ])
      .where("event_charges.event_id", "=", eventId)
      .execute();
  });
};
