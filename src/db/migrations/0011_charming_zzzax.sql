DO $$ BEGIN
 CREATE TYPE "transactionType" AS ENUM('deposit', 'withdrawal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"transaction_type" "transactionType" NOT NULL,
	"wallet_address" varchar,
	"transaction_hash" varchar NOT NULL,
	"from_address" varchar NOT NULL,
	"to_address" varchar NOT NULL,
	"amount" numeric(100, 20),
	"block_number" integer NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"token_address" varchar,
	"meta" jsonb,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "transactions_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transaction_hash_idx" ON "auth"."transactions" ("transaction_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_block_idx" ON "auth"."transactions" ("block_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_validator_idx" ON "auth"."services" ("validator_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_consumer_idx" ON "auth"."services" ("consumer_wallet_address");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_public_key_idx" ON "auth"."wallets" ("public_key");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."transactions" ADD CONSTRAINT "transactions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
