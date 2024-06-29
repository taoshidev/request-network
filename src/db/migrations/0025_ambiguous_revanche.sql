CREATE TABLE IF NOT EXISTS "auth"."paypal_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validator_id" varchar NOT NULL,
	"endpoint_id" varchar NOT NULL,
	"paypal_product_id" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" varchar NOT NULL,
	"meta" jsonb,
	CONSTRAINT "paypal_products_id_unique" UNIQUE("id")
);
--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN IF NOT EXISTS "paypal_plan_id" varchar;