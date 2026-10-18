ALTER TABLE "receipts" ALTER COLUMN "output_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "run_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "thread_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN "source" text NOT NULL;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_run_idx" ON "receipts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "receipts_output_idx" ON "receipts" USING btree ("output_id");