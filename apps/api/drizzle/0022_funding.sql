CREATE TABLE "funding_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"territory" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'found' NOT NULL,
	"next_follow_up_on" text,
	"note" text DEFAULT '' NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "funding_items_plan_name_unique" UNIQUE("plan_id","kind","name","territory")
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "facts" jsonb;--> statement-breakpoint
ALTER TABLE "funding_items" ADD CONSTRAINT "funding_items_plan_id_outputs_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_items" ADD CONSTRAINT "funding_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funding_items" ADD CONSTRAINT "funding_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funding_items_plan_idx" ON "funding_items" USING btree ("plan_id","status");