CREATE TABLE "campaign_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"row_id" text,
	"territory" text,
	"channel" text NOT NULL,
	"title" text NOT NULL,
	"asset" text,
	"starts_on" text,
	"ends_on" text,
	"week" integer,
	"guide" jsonb,
	"finding_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"edited" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"angles" jsonb NOT NULL,
	"measure" text NOT NULL,
	"conventions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_tests_action_unique" UNIQUE("action_id")
);
--> statement-breakpoint
ALTER TABLE "campaign_actions" ADD CONSTRAINT "campaign_actions_output_id_outputs_id_fk" FOREIGN KEY ("output_id") REFERENCES "public"."outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_actions" ADD CONSTRAINT "campaign_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_tests" ADD CONSTRAINT "campaign_tests_action_id_campaign_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."campaign_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaign_actions_output_idx" ON "campaign_actions" USING btree ("output_id","position");