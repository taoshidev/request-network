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
  rnConsumerApiUrl: varchar("rnConsumerApiUrl"),
  rnConsumerRequestKey: varchar("rnConsumerRequestKey", { length: 255 }),
  rnValidatorApiKey: varchar("rnValidatorApiKey", { length: 255 }),
  rnValidatorHotkey: varchar("rnValidatorHotkey", { length: 255 }),
  rnValidatorMeta: jsonb("rnValidatorMeta"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`),
  updatedAt: timestamp("updatedAt").default(sql`now()`),
  deletedAt: timestamp("deletedAt"),
});

export const keys = authSchema.table("keys", {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey()
    .notNull(),
  serviceId: uuid("serviceId")
    .references(() => services.id)
    .notNull(),
  key: varchar("key").unique().notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").default(sql`now()`),
  updatedAt: timestamp("updatedAt").default(sql`now()`),
  deletedAt: timestamp("deletedAt"),
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
