import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  uuid,
  varchar,
  pgSchema,
  timestamp,
  boolean,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

import { bytea } from "./custom-type.js";

export const authSchema = pgSchema("auth");
export const roleTypeEnum = pgEnum("type", ["consumer", "validator"]);

export const services = authSchema.table("services", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey()
    .notNull(),
  type: roleTypeEnum("type").notNull(),
  name: varchar("name"),
  consumerKeyId: varchar("consumer_key_id", { length: 255 }),
  consumerApiUrl: varchar("consumer_api_url"),
  hotkey: varchar("hotkey", { length: 255 }),
  meta: jsonb("meta"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  deletedAt: timestamp("deleted_at"),
});

export const wallets = authSchema.table("wallets", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey()
    .notNull(),
  serviceId: uuid("service_id")
    .references(() => services.id)
    .notNull(),
  publicKey: varchar("public_key").unique().notNull(),
  privateKey: bytea("private_key"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  deletedAt: timestamp("deleted_at"),
});

export const serviceWalletsRelations = relations(services, ({ many }) => ({
  wallets: many(wallets),
}));

export const walletServiceRelations = relations(wallets, ({ one }) => ({
  services: one(services, {
    fields: [wallets.serviceId],
    references: [services.id],
  }),
}));
