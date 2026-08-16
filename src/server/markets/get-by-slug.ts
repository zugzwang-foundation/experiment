import "server-only";

import { and, eq, ne } from "drizzle-orm";

import type { DbClient, DbTransaction } from "@/db";
import { markets } from "@/db/schema";

import type { MarketStatus } from "./transitions";

/**
 * The public read-projection of a market addressed by its slug — the DTO every
 * participant `(public)/` surface renders against. Mapped in the server layer,
 * never a raw drizzle row exposed past the boundary (AGENTS.md §6). SIX
 * columns: the public-read shape SHELL/UI.0's `/m/[slug]` scaffold needs (the
 * pool / position / debate fields arrive with the surfaces that need them).
 *
 * HTML-FINISH · MARKET DETAIL row 2 — `mediaVideoUrl` is the sixth, added so
 * the header can surface the admin-set outbound video (ADR-0026: a link that
 * opens in a NEW TAB; never an embedded player, never a stored asset).
 * ⚠ COSTS ZERO STATEMENTS: it is one more column on the row this query already
 * reads, not another round-trip. The task's whole read budget is +1 per render
 * and it is spent elsewhere (the `market_media` default-image read), so this
 * field had to be free or not happen.
 */
export type MarketSummary = {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	status: MarketStatus;
	/** ADR-0026 — the outbound video URL, or `null`. Opens in a new tab. */
	mediaVideoUrl: string | null;
};

/**
 * Resolve a market by its public slug for participant surfaces (SHELL/UI.0).
 *
 * Read-only; uses the existing `markets.slug` UNIQUE (no new index, no
 * migration). EXCLUDES `Draft` in the query (OQ-2): a `Draft` slug resolves to
 * `null` so the route renders `notFound()` for participants, while admin still
 * reaches Drafts via the `(admin)` route. Returns the DTO, or `null` when no
 * non-Draft market carries the slug.
 */
export async function getMarketBySlug(
	client: DbClient | DbTransaction,
	slug: string,
): Promise<MarketSummary | null> {
	const rows = await client
		.select({
			id: markets.id,
			slug: markets.slug,
			title: markets.title,
			description: markets.description,
			status: markets.status,
			mediaVideoUrl: markets.mediaVideoUrl,
		})
		.from(markets)
		.where(and(eq(markets.slug, slug), ne(markets.status, "Draft")))
		.limit(1);

	return rows[0] ?? null;
}
