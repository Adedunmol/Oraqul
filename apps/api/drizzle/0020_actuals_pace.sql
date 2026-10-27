CREATE TABLE "actuals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"signal_key" text NOT NULL,
	"on_date" text NOT NULL,
	"value" real NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actuals_day_unique" UNIQUE("output_id","on_date","city","channel")
);
--> statement-breakpoint
CREATE TABLE "pace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"output_id" uuid NOT NULL,
	"target" real,
	"unit" text NOT NULL,
	"kind" text NOT NULL,
	"entry" text NOT NULL,
	"curve" jsonb NOT NULL,
	"curve_from" text NOT NULL,
	"rules_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pace_settings_output_id_unique" UNIQUE("output_id")
);
--> statement-breakpoint
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_output_id_outputs_id_fk" FOREIGN KEY ("output_id") REFERENCES "public"."outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actuals" ADD CONSTRAINT "actuals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pace_settings" ADD CONSTRAINT "pace_settings_output_id_outputs_id_fk" FOREIGN KEY ("output_id") REFERENCES "public"."outputs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actuals_output_idx" ON "actuals" USING btree ("output_id","on_date");