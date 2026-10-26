ALTER TABLE "campaign_tests" ADD COLUMN "results" jsonb;--> statement-breakpoint
ALTER TABLE "outcomes" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "outputs" ADD COLUMN "refresh" jsonb;