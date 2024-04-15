ALTER TABLE "auth"."keys" RENAME TO "wallets";--> statement-breakpoint
ALTER TABLE "auth"."wallets" RENAME COLUMN "key" TO "public_key";--> statement-breakpoint
ALTER TABLE "auth"."wallets" DROP CONSTRAINT "keys_key_unique";--> statement-breakpoint
ALTER TABLE "auth"."wallets" DROP CONSTRAINT "keys_service_id_services_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."wallets" ADD COLUMN "private_key" "bytea";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."wallets" ADD CONSTRAINT "wallets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."wallets" ADD CONSTRAINT "wallets_public_key_unique" UNIQUE("public_key");