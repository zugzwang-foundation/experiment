CREATE TYPE "public"."side" AS ENUM('YES', 'NO');--> statement-breakpoint
CREATE TYPE "public"."mod_verdict" AS ENUM('pass', 'track_a', 'track_b');--> statement-breakpoint
CREATE TYPE "public"."ff_direction" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TYPE "public"."dharma_entry_type" AS ENUM('bet_stake', 'bet_payout', 'daily_allowance', 'pool_seed', 'pool_unwind', 'correction_reverse', 'correction_apply', 'void_refund', 'uncollectable');--> statement-breakpoint
CREATE TYPE "public"."payout_type" AS ENUM('bet_payout', 'correction_reverse', 'correction_apply', 'void_refund');--> statement-breakpoint
CREATE TYPE "public"."resolution_event_kind" AS ENUM('resolve', 'correct', 'void');--> statement-breakpoint
CREATE TYPE "public"."image_terminal_state" AS ENUM('committed', 'blocked', 'orphan');--> statement-breakpoint
CREATE TYPE "public"."market_outcome" AS ENUM('YES', 'NO', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."market_status" AS ENUM('Draft', 'Open', 'Closed', 'Resolving', 'Resolved', 'Voided', 'Frozen');--> statement-breakpoint
CREATE TABLE "admin_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mod_actions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"target_user_id" uuid,
	"target_comment_id" uuid,
	"target_bet_id" uuid,
	"verdict" "mod_verdict" NOT NULL,
	"categories" jsonb NOT NULL,
	"image_r2_key" text,
	"actor_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"session_id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"pseudonym" text NOT NULL,
	"google_id" text,
	"pfp_filename" text,
	"tos_accepted_at" timestamp with time zone,
	"tos_version_hash" text,
	"privacy_version_hash" text,
	"tos_acceptance_ip" text,
	"tos_acceptance_user_agent" text,
	"last_allowance_accrued_at" timestamp with time zone,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_pseudonym_unique" UNIQUE("pseudonym")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"stake" numeric(38, 18) NOT NULL,
	"share_quantity" numeric(38, 18) NOT NULL,
	"price_at_bet" numeric(38, 18) NOT NULL,
	"comment_id" uuid NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"side" "side" NOT NULL,
	"quantity" numeric(38, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"image_uploads_id" uuid,
	"side_at_post_time" "side" NOT NULL,
	"stake_at_post_time" numeric(38, 18) NOT NULL,
	"bet_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendly_fire_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"voter_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"direction" "ff_direction" NOT NULL,
	"cleared_at" timestamp with time zone,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dharma_ledger" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"bet_id" uuid,
	"entry_type" "dharma_entry_type" NOT NULL,
	"amount" numeric(38, 18) NOT NULL,
	"balance_after" numeric(38, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dharma_ledger_balance_non_negative" CHECK ("dharma_ledger"."balance_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payout_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"bet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"resolution_event_id" uuid NOT NULL,
	"payout_type" "payout_type" NOT NULL,
	"amount" numeric(38, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolution_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"market_id" uuid NOT NULL,
	"event_kind" "resolution_event_kind" NOT NULL,
	"outcome" "market_outcome" NOT NULL,
	"corrects_event_id" uuid,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_pool" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"colour" text NOT NULL,
	"animal" text NOT NULL,
	"number" smallint NOT NULL,
	"pseudonym" text NOT NULL,
	"pfp_filename" text NOT NULL,
	"assigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_pool_pseudonym_unique" UNIQUE("pseudonym")
);
--> statement-breakpoint
CREATE TABLE "image_uploads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"r2_object_key" text NOT NULL,
	"terminal_state" "image_terminal_state",
	"terminal_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "markets" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "market_status" DEFAULT 'Draft' NOT NULL,
	"resolution_deadline" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_outcome" "market_outcome",
	"created_by" text DEFAULT 'admin-singleton' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "markets_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"market_id" uuid NOT NULL,
	"yes_reserves" numeric(38, 18) NOT NULL,
	"no_reserves" numeric(38, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pools_market_id_unique" UNIQUE("market_id")
);
--> statement-breakpoint
CREATE TABLE "system_state" (
	"id" text PRIMARY KEY NOT NULL,
	"frozen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mod_actions" ADD CONSTRAINT "mod_actions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD CONSTRAINT "mod_actions_target_comment_id_comments_id_fk" FOREIGN KEY ("target_comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mod_actions" ADD CONSTRAINT "mod_actions_target_bet_id_bets_id_fk" FOREIGN KEY ("target_bet_id") REFERENCES "public"."bets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bets" ADD CONSTRAINT "bets_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_image_uploads_id_image_uploads_id_fk" FOREIGN KEY ("image_uploads_id") REFERENCES "public"."image_uploads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendly_fire_events" ADD CONSTRAINT "friendly_fire_events_voter_id_users_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendly_fire_events" ADD CONSTRAINT "friendly_fire_events_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dharma_ledger" ADD CONSTRAINT "dharma_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dharma_ledger" ADD CONSTRAINT "dharma_ledger_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_events" ADD CONSTRAINT "payout_events_resolution_event_id_resolution_events_id_fk" FOREIGN KEY ("resolution_event_id") REFERENCES "public"."resolution_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_events" ADD CONSTRAINT "resolution_events_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolution_events" ADD CONSTRAINT "resolution_events_corrects_event_id_resolution_events_id_fk" FOREIGN KEY ("corrects_event_id") REFERENCES "public"."resolution_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_uploads" ADD CONSTRAINT "image_uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pools" ADD CONSTRAINT "pools_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_events_event_type_idx" ON "admin_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "admin_events_created_at_idx" ON "admin_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "mod_actions_target_user_idx" ON "mod_actions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "mod_actions_target_comment_idx" ON "mod_actions" USING btree ("target_comment_id");--> statement-breakpoint
CREATE INDEX "mod_actions_target_bet_idx" ON "mod_actions" USING btree ("target_bet_id");--> statement-breakpoint
CREATE INDEX "mod_actions_verdict_idx" ON "mod_actions" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "mod_actions_created_at_idx" ON "mod_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_events_user_id_idx" ON "user_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_events_event_type_idx" ON "user_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "user_events_created_at_idx" ON "user_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_google_id_idx" ON "users" USING btree ("google_id") WHERE "users"."google_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "users_banned_at_idx" ON "users" USING btree ("banned_at") WHERE "users"."banned_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "bets_user_id_idx" ON "bets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bets_market_id_idx" ON "bets" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "bets_user_market_idx" ON "bets" USING btree ("user_id","market_id");--> statement-breakpoint
CREATE INDEX "bets_comment_id_idx" ON "bets" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "bets_created_at_idx" ON "bets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bets_idempotency_key_idx" ON "bets" USING btree ("idempotency_key") WHERE "bets"."idempotency_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "positions_user_market_side_idx" ON "positions" USING btree ("user_id","market_id","side");--> statement-breakpoint
CREATE INDEX "positions_user_market_idx" ON "positions" USING btree ("user_id","market_id");--> statement-breakpoint
CREATE INDEX "positions_user_id_idx" ON "positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_market_id_idx" ON "comments" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_market_created_idx" ON "comments" USING btree ("market_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_ranking_idx" ON "comments" USING btree ("parent_comment_id","side_at_post_time");--> statement-breakpoint
CREATE INDEX "comments_image_uploads_idx" ON "comments" USING btree ("image_uploads_id");--> statement-breakpoint
CREATE UNIQUE INDEX "friendly_fire_unique_idx" ON "friendly_fire_events" USING btree ("voter_id","comment_id");--> statement-breakpoint
CREATE INDEX "friendly_fire_ranking_idx" ON "friendly_fire_events" USING btree ("comment_id","frozen_at","cleared_at");--> statement-breakpoint
CREATE INDEX "friendly_fire_voter_idx" ON "friendly_fire_events" USING btree ("voter_id");--> statement-breakpoint
CREATE INDEX "dharma_ledger_user_id_idx" ON "dharma_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dharma_ledger_user_created_idx" ON "dharma_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "dharma_ledger_bet_id_idx" ON "dharma_ledger" USING btree ("bet_id") WHERE "dharma_ledger"."bet_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payout_events_bet_idx" ON "payout_events" USING btree ("bet_id");--> statement-breakpoint
CREATE INDEX "payout_events_user_idx" ON "payout_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payout_events_market_idx" ON "payout_events" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "payout_events_resolution_idx" ON "payout_events" USING btree ("resolution_event_id");--> statement-breakpoint
CREATE INDEX "resolution_events_market_idx" ON "resolution_events" USING btree ("market_id");--> statement-breakpoint
CREATE INDEX "resolution_events_corrects_idx" ON "resolution_events" USING btree ("corrects_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_pool_tuple_idx" ON "identity_pool" USING btree ("colour","animal","number");--> statement-breakpoint
CREATE INDEX "identity_pool_fifo_idx" ON "identity_pool" USING btree ("created_at") WHERE "identity_pool"."assigned_at" IS NULL;--> statement-breakpoint
CREATE INDEX "image_uploads_user_id_idx" ON "image_uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "image_uploads_terminal_state_idx" ON "image_uploads" USING btree ("terminal_state");--> statement-breakpoint
CREATE INDEX "image_uploads_created_at_idx" ON "image_uploads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "markets_status_idx" ON "markets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "markets_resolution_deadline_idx" ON "markets" USING btree ("resolution_deadline");