CREATE TYPE "public"."mod_reason" AS ENUM('track_a_autoban', 'track_b_blocked', 'sexual_minors_text_blocked', 'content_removed', 'user_banned');--> statement-breakpoint
ALTER TABLE "mod_actions" ALTER COLUMN "verdict" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD COLUMN "target_market_id" uuid;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD COLUMN "reason" "mod_reason" NOT NULL;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD COLUMN "blocked_text" text;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD CONSTRAINT "mod_actions_target_market_id_markets_id_fk" FOREIGN KEY ("target_market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mod_actions_target_market_idx" ON "mod_actions" USING btree ("target_market_id");--> statement-breakpoint
CREATE INDEX "mod_actions_reason_idx" ON "mod_actions" USING btree ("reason");