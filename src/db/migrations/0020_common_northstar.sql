DO $$ BEGIN
 CREATE TYPE "serviceStatusType" AS ENUM('new', 'on time', 'delinquent', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "service_status_type" "serviceStatusType" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "days_pass_due" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "outstanding_balance" numeric(18, 6);