import type { Kysely } from "kysely";

import type { DatabaseSchema } from "./types.js";

export type Migration = {
  id: string;
  up: (db: Kysely<DatabaseSchema>) => Promise<void>;
};

export const migrations: Migration[] = [
  {
    id: "001_create_users_wallets",
    up: async (db) => {
      await db.schema
        .createTable("schema_migrations")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .execute();

      await db.schema
        .createTable("users")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("email", "text", (col: any) => col.notNull().unique())
        .addColumn("display_name", "text", (col: any) => col.notNull())
        .addColumn("password_hash", "text", (col: any) => col.notNull())
        .addColumn("role", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .execute();

      await db.schema
        .createTable("wallets")
        .ifNotExists()
        .addColumn("user_id", "text", (col: any) => col.primaryKey())
        .addColumn("balance_irr", "integer", (col: any) => col.notNull().defaultTo(0))
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("wallets_user_id_fk", ["user_id"], "users", ["id"], (cb: any) => cb.onDelete("cascade"))
        .execute();

    }
  },
  {
    id: "002_create_participants_events_menus",
    up: async (db) => {
      await db.schema
        .createTable("participants")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("owner_user_id", "text", (col: any) => col.notNull())
        .addColumn("display_name", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("participants_owner_user_id_fk", ["owner_user_id"], "users", ["id"], (cb: any) =>
          cb.onDelete("cascade")
        )
        .execute();

      await db.schema
        .createTable("participant_default_payors")
        .ifNotExists()
        .addColumn("participant_id", "text", (col: any) => col.primaryKey())
        .addColumn("payor_user_id", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint(
          "participant_default_payors_participant_id_fk",
          ["participant_id"],
          "participants",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "participant_default_payors_payor_user_id_fk",
          ["payor_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("event_templates")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("name", "text", (col: any) => col.notNull())
        .addColumn("description", "text")
        .addColumn("default_location_text", "text")
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .execute();

      await db.schema
        .createTable("events")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("template_id", "text")
        .addColumn("name", "text", (col: any) => col.notNull())
        .addColumn("description", "text")
        .addColumn("location_text", "text", (col: any) => col.notNull())
        .addColumn("host_user_id", "text", (col: any) => col.notNull())
        .addColumn("starts_at_utc", "text", (col: any) => col.notNull())
        .addColumn("cutoff_at_utc", "text", (col: any) => col.notNull())
        .addColumn("state", "text", (col: any) => col.notNull())
        .addColumn("visibility_mode", "text", (col: any) => col.notNull())
        .addColumn("payor_exemption_enabled", "integer", (col: any) => col.notNull().defaultTo(0))
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("events_template_id_fk", ["template_id"], "event_templates", ["id"], (cb: any) =>
          cb.onDelete("set null")
        )
        .addForeignKeyConstraint("events_host_user_id_fk", ["host_user_id"], "users", ["id"], (cb: any) =>
          cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("event_guests")
        .ifNotExists()
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("user_id", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_guests_pk", ["event_id", "user_id"])
        .addForeignKeyConstraint("event_guests_event_id_fk", ["event_id"], "events", ["id"], (cb: any) =>
          cb.onDelete("cascade")
        )
        .addForeignKeyConstraint("event_guests_user_id_fk", ["user_id"], "users", ["id"], (cb: any) =>
          cb.onDelete("cascade")
        )
        .execute();

      await db.schema
        .createTable("event_participants")
        .ifNotExists()
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("participant_id", "text", (col: any) => col.notNull())
        .addColumn("managing_user_id", "text", (col: any) => col.notNull())
        .addColumn("attendance_status", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_participants_pk", ["event_id", "participant_id"])
        .addForeignKeyConstraint(
          "event_participants_event_id_fk",
          ["event_id"],
          "events",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_participants_participant_id_fk",
          ["participant_id"],
          "participants",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_participants_managing_user_id_fk",
          ["managing_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("event_payor_overrides")
        .ifNotExists()
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("participant_id", "text", (col: any) => col.notNull())
        .addColumn("payor_user_id", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_payor_overrides_pk", ["event_id", "participant_id"])
        .addForeignKeyConstraint(
          "event_payor_overrides_event_participant_fk",
          ["event_id", "participant_id"],
          "event_participants",
          ["event_id", "participant_id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_payor_overrides_payor_user_id_fk",
          ["payor_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("menus")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("name", "text", (col: any) => col.notNull())
        .addColumn("sort_order", "integer", (col: any) => col.notNull().defaultTo(0))
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("menus_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .execute();

      await db.schema
        .createTable("menu_items")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("menu_id", "text", (col: any) => col.notNull())
        .addColumn("name", "text", (col: any) => col.notNull())
        .addColumn("price_irr", "integer", (col: any) => col.notNull())
        .addColumn("category", "text")
        .addColumn("tags_json", "text")
        .addColumn("is_active", "integer", (col: any) => col.notNull().defaultTo(1))
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("menu_items_menu_id_fk", ["menu_id"], "menus", ["id"], (cb: any) => cb.onDelete("cascade"))
        .execute();
    }
  },
  {
    id: "003_create_selections_shared_costs_payments",
    up: async (db) => {
      await db.schema
        .createTable("shared_costs")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("name", "text", (col: any) => col.notNull())
        .addColumn("amount_irr", "integer", (col: any) => col.notNull())
        .addColumn("split_method", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("shared_costs_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .execute();

      await db.schema
        .createTable("selections")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("menu_item_id", "text", (col: any) => col.notNull())
        .addColumn("quantity", "integer", (col: any) => col.notNull())
        .addColumn("created_by_user_id", "text", (col: any) => col.notNull())
        .addColumn("note", "text")
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("selections_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .addForeignKeyConstraint(
          "selections_menu_item_id_fk",
          ["menu_item_id"],
          "menu_items",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .addForeignKeyConstraint(
          "selections_created_by_user_id_fk",
          ["created_by_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("selection_allocations")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("selection_id", "text", (col: any) => col.notNull())
        .addColumn("participant_id", "text", (col: any) => col.notNull())
        .addColumn("share_type", "text", (col: any) => col.notNull())
        .addColumn("share_weight", "integer")
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint(
          "selection_allocations_selection_id_fk",
          ["selection_id"],
          "selections",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "selection_allocations_participant_id_fk",
          ["participant_id"],
          "participants",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .execute();

      await db.schema
        .createTable("event_charges")
        .ifNotExists()
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("payor_user_id", "text", (col: any) => col.notNull())
        .addColumn("total_irr", "integer", (col: any) => col.notNull())
        .addColumn("finalized_at_utc", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_charges_pk", ["event_id", "payor_user_id"])
        .addForeignKeyConstraint("event_charges_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .addForeignKeyConstraint(
          "event_charges_payor_user_id_fk",
          ["payor_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();

      await db.schema
        .createTable("payment_links")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("payor_user_id", "text", (col: any) => col.notNull())
        .addColumn("token", "text", (col: any) => col.notNull().unique())
        .addColumn("locked_amount_irr", "integer")
        .addColumn("status", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("payment_links_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .addForeignKeyConstraint(
          "payment_links_payor_user_id_fk",
          ["payor_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .execute();

      await db.schema
        .createTable("wallet_transactions")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("user_id", "text", (col: any) => col.notNull())
        .addColumn("type", "text", (col: any) => col.notNull())
        .addColumn("amount_irr", "integer", (col: any) => col.notNull())
        .addColumn("event_id", "text")
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addForeignKeyConstraint("wallet_transactions_user_id_fk", ["user_id"], "users", ["id"], (cb: any) => cb.onDelete("cascade"))
        .addForeignKeyConstraint("wallet_transactions_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("set null"))
        .execute();
    }
  },
  {
    id: "004_create_template_rosters",
    up: async (db) => {
      await db.schema
        .createTable("event_template_guests")
        .ifNotExists()
        .addColumn("template_id", "text", (col: any) => col.notNull())
        .addColumn("user_id", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_template_guests_pk", ["template_id", "user_id"])
        .addForeignKeyConstraint(
          "event_template_guests_template_id_fk",
          ["template_id"],
          "event_templates",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_template_guests_user_id_fk",
          ["user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .execute();

      await db.schema
        .createTable("event_template_participants")
        .ifNotExists()
        .addColumn("template_id", "text", (col: any) => col.notNull())
        .addColumn("participant_id", "text", (col: any) => col.notNull())
        .addColumn("managing_user_id", "text", (col: any) => col.notNull())
        .addColumn("default_attendance_status", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_template_participants_pk", ["template_id", "participant_id"])
        .addForeignKeyConstraint(
          "event_template_participants_template_id_fk",
          ["template_id"],
          "event_templates",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_template_participants_participant_id_fk",
          ["participant_id"],
          "participants",
          ["id"],
          (cb: any) => cb.onDelete("cascade")
        )
        .addForeignKeyConstraint(
          "event_template_participants_managing_user_id_fk",
          ["managing_user_id"],
          "users",
          ["id"],
          (cb: any) => cb.onDelete("restrict")
        )
        .execute();
    }
  },
  {
    id: "005_menu_item_categories",
    up: async (db) => {
      await db.schema
        .createTable("menu_item_categories")
        .ifNotExists()
        .addColumn("id", "text", (col: any) => col.primaryKey())
        .addColumn("code", "text", (col: any) => col.notNull().unique())
        .addColumn("name_en", "text", (col: any) => col.notNull())
        .addColumn("name_fa", "text", (col: any) => col.notNull())
        .addColumn("sort_order", "integer", (col: any) => col.notNull().defaultTo(0))
        .addColumn("is_active", "integer", (col: any) => col.notNull().defaultTo(1))
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .execute();

      await db.schema.alterTable("menu_items").addColumn("category_id", "text").execute();

      const now = new Date().toISOString();
      await db
        .insertInto("menu_item_categories")
        .values({
          id: "uncategorized",
          code: "uncategorized",
          name_en: "Uncategorized",
          name_fa: "بدون دسته‌بندی",
          sort_order: 0,
          is_active: 1,
          created_at: now
        })
        .execute();

      await db
        .updateTable("menu_items")
        .set({
          category_id: "uncategorized"
        } as any)
        .where("category_id", "is", null)
        .execute();
    }
  },
  {
    id: "006_event_hosts_and_location_user",
    up: async (db) => {
      await db.schema
        .createTable("event_hosts")
        .ifNotExists()
        .addColumn("event_id", "text", (col: any) => col.notNull())
        .addColumn("user_id", "text", (col: any) => col.notNull())
        .addColumn("created_at", "text", (col: any) => col.notNull())
        .addPrimaryKeyConstraint("event_hosts_pk", ["event_id", "user_id"])
        .addForeignKeyConstraint("event_hosts_event_id_fk", ["event_id"], "events", ["id"], (cb: any) => cb.onDelete("cascade"))
        .addForeignKeyConstraint("event_hosts_user_id_fk", ["user_id"], "users", ["id"], (cb: any) => cb.onDelete("restrict"))
        .execute();

      await db.schema.alterTable("events").addColumn("location_user_id", "text").execute();

      const now = new Date().toISOString();
      const events = await db.selectFrom("events").select(["id", "host_user_id"]).execute();
      for (const ev of events as any[]) {
        await db
          .insertInto("event_hosts")
          .values({
            event_id: ev.id,
            user_id: ev.host_user_id,
            created_at: now
          })
          .execute();
      }
    }
  }
];
