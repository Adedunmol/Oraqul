ALTER TABLE "outputs" ADD COLUMN "report" jsonb;--> statement-breakpoint
-- The third start mode was renamed from rescue to fix.
UPDATE "projects" SET "mode" = 'fix' WHERE "mode" = 'rescue';--> statement-breakpoint
UPDATE "outputs" SET "kind" = 'fix' WHERE "kind" = 'rescue';--> statement-breakpoint
UPDATE "runs" SET "job" = 'fix' WHERE "job" = 'rescue';