CREATE TABLE "pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pins_user_project_unique" UNIQUE("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "thread_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"read_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "thread_reads_user_thread_unique" UNIQUE("user_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'intake';--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "job" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "mode" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "state" jsonb;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "stop_reason" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pins" ADD CONSTRAINT "pins_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_reads" ADD CONSTRAINT "thread_reads_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_team_status_idx" ON "projects" USING btree ("team_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "runs_thread_idx" ON "runs" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "threads_project_idx" ON "threads" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_seq_unique" UNIQUE("thread_id","seq");--> statement-breakpoint
-- The job that a start mode runs is now called build, the same word as the mode.
UPDATE "outputs" SET "kind" = 'build' WHERE "kind" = 'plan';--> statement-breakpoint
UPDATE "runs" SET "job" = 'build' WHERE "job" = 'plan';--> statement-breakpoint
-- Projects saved before drafts existed already have a name and category.
UPDATE "projects" SET "status" = 'active' WHERE "status" = 'draft';