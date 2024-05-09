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
  numeric,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { bytea } from "./types";

export const authSchema = pgSchema("auth");
export const roleTypeEnum = pgEnum("type", ["consumer", "validator"]);
export const transactionTypeEnum = pgEnum("transactionType", [
  "deposit",
  "withdrawal",
]);

export const services = authSchema.table(
  "services",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    type: roleTypeEnum("type").notNull(),
    name: varchar("name"),
    validatorWalletAddress: varchar("validator_wallet_address"),
    consumerWalletAddress: varchar("consumer_wallet_address"),
    validatorId: varchar("validator_id"),
    endpointId: varchar("endpoint_id"),
    subscriptionId: varchar("subscription_id"),
    consumerKeyId: varchar("consumer_key_id", { length: 255 }),
    consumerApiUrl: varchar("consumer_api_url"),
    currencyType: varchar("currency_type"),
    price: varchar("price"),
    hotkey: varchar("hotkey", { length: 255 }),
    meta: jsonb("meta"),
    enabled: boolean("enabled").default(false).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").default(sql`now()`),
    updatedAt: timestamp("updated_at").default(sql`now()`),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    serviceValidatorIdx: index("service_validator_idx").on(table.validatorId),
    serviceConsumerIdx: index("service_consumer_idx").on(
      table.consumerWalletAddress
    ),
  })
);

export const transactions = authSchema.table(
  "transactions",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    serviceId: uuid("service_id")
      .references(() => services.id, {
        onDelete: "set null",
      })
      .notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    walletAddress: varchar("wallet_address"),
    transactionHash: varchar("transaction_hash").unique().notNull(),
    fromAddress: varchar("from_address").notNull(),
    toAddress: varchar("to_address").notNull(),
    amount: numeric("amount", { precision: 18, scale: 6 }),
    blockNumber: integer("block_number").notNull(),
    confirmed: boolean("confirmed").default(false).notNull(),
    tokenAddress: varchar("token_address"),
    meta: jsonb("meta"),
    active: boolean("active").default(false).notNull(),
    createdAt: timestamp("created_at").default(sql`now()`),
    updatedAt: timestamp("updated_at").default(sql`now()`),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    transactionHashIdx: uniqueIndex("transaction_hash_idx").on(
      table.transactionHash
    ),
    transactionBlockIdx: index("transaction_block_idx").on(table.blockNumber),
  })
);

export const serviceTransactionRelations = relations(services, ({ many }) => ({
  transactions: many(transactions),
}));

export const transactionServiceRelations = relations(
  transactions,
  ({ one }) => ({
    services: one(services, {
      fields: [transactions.serviceId],
      references: [services.id],
    }),
  })
);

export const wallets = authSchema.table(
  "wallets",
  {
    id: uuid("id")
      .default(sql`gen_random_uuid()`)
      .primaryKey()
      .notNull(),
    serviceId: uuid("service_id")
      .references(() => services.id, {
        onDelete: "set null",
      })
      .notNull(),
    publicKey: varchar("public_key").unique().notNull(),
    privateKey: bytea("private_key"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").default(sql`now()`),
    updatedAt: timestamp("updated_at").default(sql`now()`),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    walletPublicKeyIdx: uniqueIndex("wallet_public_key_idx").on(
      table.publicKey
    ),
  })
);

export const serviceWalletsRelations = relations(services, ({ many }) => ({
  wallets: many(wallets),
}));

export const walletServiceRelations = relations(wallets, ({ one }) => ({
  services: one(services, {
    fields: [wallets.serviceId],
    references: [services.id],
  }),
}));
