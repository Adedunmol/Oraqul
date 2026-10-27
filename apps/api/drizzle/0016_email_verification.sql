ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_codes" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "email_codes" DROP COLUMN "password_hash";--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = "created_at";--> statement-breakpoint
DELETE FROM "email_codes" WHERE "purpose" = 'signup';
