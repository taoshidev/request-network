ALTER TABLE "auth"."paypal" ALTER COLUMN "paypal_subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."paypal" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."paypal" ALTER COLUMN "exp_month" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."paypal" ALTER COLUMN "exp_year" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."paypal" ADD COLUMN "paypal_plan_id" varchar NOT NULL;