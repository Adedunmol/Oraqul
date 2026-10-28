CREATE TABLE "team_rule_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"rule_version" integer NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"scope" text DEFAULT 'team' NOT NULL,
	"project_id" uuid,
	"kind" text NOT NULL,
	"field" text NOT NULL,
	"operator" text NOT NULL,
	"value" jsonb NOT NULL,
	"enforcement" text NOT NULL,
	"source_text" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"rejection_reason" text,
	"created_by" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_rule_overrides" ADD CONSTRAINT "team_rule_overrides_rule_id_team_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."team_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rule_overrides" ADD CONSTRAINT "team_rule_overrides_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rule_overrides" ADD CONSTRAINT "team_rule_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rules" ADD CONSTRAINT "team_rules_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rules" ADD CONSTRAINT "team_rules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rules" ADD CONSTRAINT "team_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rules" ADD CONSTRAINT "team_rules_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_rules" ADD CONSTRAINT "team_rules_supersedes_id_team_rules_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."team_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_rule_overrides_rule_idx" ON "team_rule_overrides" USING btree ("rule_id");--> statement-breakpoint
CREATE INDEX "team_rules_team_status_idx" ON "team_rules" USING btree ("team_id","status");