ALTER TABLE "auth"."enrollments" ALTER COLUMN "service_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."transactions" ALTER COLUMN "service_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auth"."wallets" ALTER COLUMN "service_id" DROP NOT NULL;