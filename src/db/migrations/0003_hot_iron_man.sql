ALTER TABLE "auth"."keys" RENAME COLUMN "serviceId" TO "service_id";--> statement-breakpoint
ALTER TABLE "auth"."keys" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "auth"."keys" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "auth"."keys" RENAME COLUMN "deletedAt" TO "deleted_at";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "rnConsumerApiUrl" TO "consumer_api_url";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "rnValidatorHotkey" TO "hotkey";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "rnValidatorMeta" TO "meta";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "auth"."services" RENAME COLUMN "deletedAt" TO "deleted_at";--> statement-breakpoint
ALTER TABLE "auth"."keys" DROP CONSTRAINT "keys_serviceId_services_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth"."keys" ADD CONSTRAINT "keys_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "auth"."services"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "auth"."services" DROP COLUMN IF EXISTS "rnConsumerRequestKey";--> statement-breakpoint
ALTER TABLE "auth"."services" DROP COLUMN IF EXISTS "rnValidatorApiKey";