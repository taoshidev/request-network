ALTER TABLE "auth"."wallets" DROP CONSTRAINT "wallets_service_id_services_id_fk";
--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "validator_wallet_address" varchar;--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "consumer_wallet_address" varchar;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."wallets" ADD CONSTRAINT "wallets_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
