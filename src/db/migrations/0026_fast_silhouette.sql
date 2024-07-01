DO $$ BEGIN
 CREATE TYPE "paymentService" AS ENUM('stripe', 'paypal');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."services" ADD COLUMN "paymentService" "paymentService";