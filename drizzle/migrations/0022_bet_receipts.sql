CREATE TABLE "bet_receipts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"idempotency_key" text NOT NULL,
	"body_fingerprint" text NOT NULL,
	"user_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"flow" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bet_receipts_flow_check" CHECK ("bet_receipts"."flow" IN ('place', 'sell'))
);
--> statement-breakpoint
ALTER TABLE "bet_receipts" ADD CONSTRAINT "bet_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bet_receipts" ADD CONSTRAINT "bet_receipts_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bet_receipts_idempotency_key_uq" ON "bet_receipts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "bet_receipts_user_id_idx" ON "bet_receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bet_receipts_market_id_idx" ON "bet_receipts" USING btree ("market_id");--> statement-breakpoint
-- AUDIT-FIX-B3 (ADR-0031) — Bucket-A append-only guards on bet_receipts.
-- The durable idempotency receipt is immutable post-INSERT (Bucket A): reuse the
-- shared 0003 row-level functions (enforce_bucket_a_no_update / _no_delete) + the
-- 0021 statement-level enforce_bucket_a_no_truncate — NO new functions. Appended
-- to the SAME generated migration (single-file rationale, plan STEP 4) so a
-- Bucket-A table never exists unguarded, even between migrations. Trigger SQL is
-- invisible to the drizzle snapshot (the 0003 precedent); no pg_cron content, so
-- the CI *pg_cron*.sql strip is unaffected.
CREATE TRIGGER bucket_a_no_update BEFORE UPDATE ON bet_receipts FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_update();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_delete BEFORE DELETE ON bet_receipts FOR EACH ROW EXECUTE FUNCTION enforce_bucket_a_no_delete();--> statement-breakpoint
CREATE TRIGGER bucket_a_no_truncate BEFORE TRUNCATE ON bet_receipts FOR EACH STATEMENT EXECUTE FUNCTION enforce_bucket_a_no_truncate();