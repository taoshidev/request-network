ALTER TABLE "auth"."paypal" ALTER COLUMN "paypal_customer_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."paypal" ALTER COLUMN "paypal_plan_id" DROP NOT NULL;