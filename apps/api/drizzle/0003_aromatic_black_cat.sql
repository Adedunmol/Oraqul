CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_team_email_pending_idx" ON "invites" USING btree ("team_id","email") WHERE "invites"."accepted_at" is null;--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "teams" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_team_user_unique" UNIQUE("team_id","user_id");--> statement-breakpoint
-- Accounts created before teams existed get the personal team new accounts get on sign in.
DO $$
DECLARE
	account record;
	new_team uuid;
BEGIN
	FOR account IN
		SELECT id, name FROM "users"
		WHERE NOT EXISTS (SELECT 1 FROM "memberships" WHERE "memberships"."user_id" = "users"."id")
	LOOP
		INSERT INTO "teams" ("name") VALUES (account.name || '''s team') RETURNING id INTO new_team;
		INSERT INTO "memberships" ("team_id", "user_id", "role") VALUES (new_team, account.id, 'owner');
	END LOOP;
END $$;
