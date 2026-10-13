CREATE TABLE "login_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "login_failures_email_ip_idx" ON "login_failures" USING btree ("email","ip","created_at");--> statement-breakpoint
CREATE INDEX "login_failures_ip_idx" ON "login_failures" USING btree ("ip","created_at");