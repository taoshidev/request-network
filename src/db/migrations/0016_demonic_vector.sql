CREATE TABLE IF NOT EXISTS "auth"."enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"stripe_customer_id" varchar NOT NULL,
	"stripe_subscription_id" varchar NOT NULL,
	"email" varchar NOT NULL,
	"exp_month" integer NOT NULL,
	"exp_year" integer NOT NULL,
	"first_payment" timestamp,
	"paid" boolean DEFAULT true NOT NULL,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"deleted_at" timestamp,
	CONSTRAINT "enrollments_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "enrollments_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "enrollments_email_unique" UNIQUE("email"),
	CONSTRAINT "enrollments_exp_month_unique" UNIQUE("exp_month"),
	CONSTRAINT "enrollments_exp_year_unique" UNIQUE("exp_year")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_public_key_idx" ON "auth"."enrollments" ("email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."enrollments" ADD CONSTRAINT "enrollments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
