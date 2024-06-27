CREATE TABLE IF NOT EXISTS "auth"."paypal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid,
	"paypal_customer_id" varchar NOT NULL,
	"paypal_subscription_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"exp_month" integer NOT NULL,
	"exp_year" integer NOT NULL,
	"last_four" integer,
	"first_payment" timestamp,
	"paid" boolean DEFAULT true NOT NULL,
	"current_period_end" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now(),
	"updated_at" timestamp (6) with time zone DEFAULT now(),
	"deleted_at" timestamp (6) with time zone,
	CONSTRAINT "paypal_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "auth"."enrollments" RENAME TO "stripe";--> statement-breakpoint
ALTER TABLE "auth"."stripe" DROP CONSTRAINT "enrollments_id_unique";--> statement-breakpoint
ALTER TABLE "auth"."stripe" DROP CONSTRAINT "enrollments_service_id_services_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."stripe" ADD CONSTRAINT "stripe_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."paypal" ADD CONSTRAINT "paypal_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."stripe" ADD CONSTRAINT "stripe_id_unique" UNIQUE("id");