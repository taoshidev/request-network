import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  varchar,
  pgSchema,
  timestamp,
  boolean,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";

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

export const keys = authSchema.table("keys", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey()
    .notNull(),
  serviceId: uuid("service_id")
    .references(() => services.id)
    .notNull(),
  key: varchar("key").unique().notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
  deletedAt: timestamp("deleted_at"),
});

export const serviceKeysRelations = relations(services, ({ many }) => ({
  keys: many(keys),
}));

export const keyServiceRelations = relations(keys, ({ one }) => ({
  services: one(services, {
    fields: [keys.serviceId],
    references: [services.id],
  }),
}));
