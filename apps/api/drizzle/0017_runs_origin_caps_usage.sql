CREATE TABLE "qloo_usage" (
	"month" text PRIMARY KEY NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "via" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "run_cap" integer;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runs_user_idx" ON "runs" USING btree ("user_id","created_at");