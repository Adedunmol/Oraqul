ALTER TABLE "threads" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "summarized_through" integer DEFAULT 0 NOT NULL;