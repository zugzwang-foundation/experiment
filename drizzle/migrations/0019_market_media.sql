CREATE TABLE "market_media" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"market_id" uuid NOT NULL,
	"r2_object_key" text NOT NULL,
	"display_order" integer NOT NULL,
	"is_default" boolean NOT NULL,
	"created_by" text DEFAULT 'admin-singleton' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "markets" ADD COLUMN "media_video_url" text;--> statement-breakpoint
ALTER TABLE "market_media" ADD CONSTRAINT "market_media_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."markets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "market_media_market_id_idx" ON "market_media" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "market_media_one_default_per_market_uq" ON "market_media" USING btree ("market_id") WHERE "market_media"."is_default";