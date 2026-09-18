// LIQ-1-RESTORE — the CONTENT markets, read from the committed snapshot.
// NEVER import this from src/**. It is an operational artifact under tests/.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS READS A SNAPSHOT AND NOT A FIXTURE TABLE
//
// `fixtures.ts` beside this file is a LITERAL table: fifteen `sp-m*` markets
// whose copy exists to exercise shapes, invented for that job and free to
// change. The content markets are the opposite. Their questions, criteria
// and settlement dates are the FOUNDER'S — CLAUDE.md §3 makes inventing them a
// refusal trigger — and they were authored directly against staging, which
// means the repository never held them as source. The 2026-09-07 staging reset
// truncated `markets`, and the only verbatim copy left anywhere is
// `docs/data/staging-markets-snapshot.json`: a read-only, machine-fidelity
// capture committed for exactly this event ("the artifact that makes a future
// rebuild survivable", its own header).
//
// So this module TRANSCRIBES NOTHING. It reads that file and hands the values
// to `createMarket` / `openMarket` unchanged. A second copy of the copy would
// be a place for the founder's words to drift, and drift in market copy is a
// resolution dispute.
//
// ⚠ THE SNAPSHOT IS NOT A RESTORE PATH. Nothing here INSERTs a snapshot row.
// The snapshot supplies CONTENT; the engine supplies MECHANISM. Reading
// `pools.yes_reserves` out of it and writing it back would reproduce a market's
// state without the `market.opened` event that ADR-0047 §E makes load-bearing
// for settle and void — which is the shape `scripts/lots-1-staging-wipe.ts`
// exists to avoid, and why its own preserved markets get their genesis row
// re-inserted verbatim rather than assumed.
//
// ── THE MARKET IDS ARE REUSED, DELIBERATELY ────────────────────────────────
// `createMarket` takes a caller-supplied UUIDv7 PK (MEDIA.1 / Q3) and validates
// every media key against `^m/<thatMarketId>/<uuid>\.<ext>$`. All sixteen R2
// objects survived the reset under the ORIGINAL ids (LIQ-1-RESTORE A2, measured
// 2026-09-07: 16/16 present in `zugzwang-market-media`) — twelve of them now,
// MKT-ROSTER-1 having taken two markets and their four objects. Minting fresh
// ids would orphan every one and require a re-upload of bytes nobody has.
// Reusing them makes the images reachable with no key rewrite — and the ids are free,
// because the rows they named are gone.
// ═══════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The committed capture. The single source for every market's content. */
export const CONTENT_MARKET_SOURCE_PATH = fileURLToPath(
	new URL("../../docs/data/staging-markets-snapshot.json", import.meta.url),
);

/** How many markets the snapshot must hold. A short read is a broken read. */
export const CONTENT_MARKET_COUNT = 6;

/** One image in a market's at-create manifest — `MarketMediaInput`'s shape. */
export interface ContentMarketMedia {
	readonly mediaId: string;
	readonly key: string;
	readonly displayOrder: number;
	readonly isDefault: boolean;
}

/** One market, in the exact shape `createMarket` takes. */
export interface ContentMarketSpec {
	readonly marketId: string;
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	readonly resolutionDeadline: Date;
	readonly media: readonly ContentMarketMedia[];
	readonly mediaVideoUrl: string | null;
}

/** The snapshot's own row shapes, as parsed. Narrowed before anything uses it. */
interface SnapshotShape {
	capturedAt?: unknown;
	markets?: unknown;
	market_media?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(
	row: Record<string, unknown>,
	field: string,
	where: string,
): string {
	const v = row[field];
	if (typeof v !== "string" || v === "") {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: ${where}.${field} is not a non-empty string`,
		);
	}
	return v;
}

/**
 * The media id is the FILENAME STEM of the R2 key, not a stored column.
 *
 * `market_media` has no `media_id` — the id lives in the key the sign route
 * minted (`m/<marketId>/<mediaId>.<ext>`), which is why `createMarket` can
 * validate the two against each other. Recovering it from the key rather than
 * minting a new one is what keeps the surviving object reachable: a fresh
 * `uuidv7()` here would build a key that points at nothing.
 */
function mediaIdFromKey(key: string, marketId: string): string {
	const prefix = `m/${marketId}/`;
	if (!key.startsWith(prefix)) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: media key ${JSON.stringify(key)} is not under ${prefix}`,
		);
	}
	const file = key.slice(prefix.length);
	const dot = file.lastIndexOf(".");
	if (dot <= 0) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: media key ${JSON.stringify(key)} has no extension`,
		);
	}
	return file.slice(0, dot);
}

/**
 * Read the content markets out of the committed snapshot.
 *
 * Pure apart from the one file read, so the unit suite exercises the real
 * parse against the real bytes rather than a fixture of them.
 *
 * REFUSES rather than returns a short list: a snapshot that has lost a market
 * would otherwise seed short and report success, and the missing one would only
 * surface as a 404 on a slug somebody had already shared.
 */
export function loadContentMarkets(): readonly ContentMarketSpec[] {
	const parsed: unknown = JSON.parse(
		readFileSync(CONTENT_MARKET_SOURCE_PATH, "utf8"),
	);
	if (!isRecord(parsed)) {
		throw new Error(`${CONTENT_MARKET_SOURCE_PATH}: not a JSON object`);
	}
	const snapshot = parsed as SnapshotShape;
	const marketRows = snapshot.markets;
	const mediaRows = snapshot.market_media;
	if (!Array.isArray(marketRows) || !Array.isArray(mediaRows)) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: "markets" and "market_media" must both be arrays`,
		);
	}
	if (marketRows.length !== CONTENT_MARKET_COUNT) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: expected ${CONTENT_MARKET_COUNT} markets, found ${marketRows.length}`,
		);
	}

	const specs = marketRows.map((raw, i) => {
		if (!isRecord(raw)) {
			throw new Error(
				`${CONTENT_MARKET_SOURCE_PATH}: markets[${i}] is not an object`,
			);
		}
		const where = `markets[${i}]`;
		const marketId = str(raw, "id", where);
		const deadlineIso = str(raw, "resolution_deadline", where);
		const resolutionDeadline = new Date(deadlineIso);
		if (Number.isNaN(resolutionDeadline.getTime())) {
			throw new Error(
				`${CONTENT_MARKET_SOURCE_PATH}: ${where}.resolution_deadline ${JSON.stringify(deadlineIso)} is not a date`,
			);
		}
		const video = raw.media_video_url;
		if (video !== null && video !== undefined && typeof video !== "string") {
			throw new Error(
				`${CONTENT_MARKET_SOURCE_PATH}: ${where}.media_video_url must be a string or null`,
			);
		}

		const media = mediaRows
			.filter(
				(m): m is Record<string, unknown> =>
					isRecord(m) && m.market_id === marketId,
			)
			.map((m, j) => {
				const key = str(
					m,
					"r2_object_key",
					`market_media[${j}] for ${marketId}`,
				);
				const order = m.display_order;
				if (typeof order !== "number" || !Number.isInteger(order)) {
					throw new Error(
						`${CONTENT_MARKET_SOURCE_PATH}: market_media.display_order for ${key} is not an integer`,
					);
				}
				return {
					mediaId: mediaIdFromKey(key, marketId),
					key,
					displayOrder: order,
					isDefault: m.is_default === true,
				} satisfies ContentMarketMedia;
			})
			.sort((a, b) => a.displayOrder - b.displayOrder);

		// `createMarket` throws MediaRequiredError / DefaultMediaRequiredError on
		// these, but it throws them market-by-market halfway through a run. Refuse
		// at load, before anything is written, so a malformed snapshot cannot
		// leave staging half-seeded.
		if (media.length === 0) {
			throw new Error(
				`${CONTENT_MARKET_SOURCE_PATH}: ${where} (${str(raw, "slug", where)}) has no market_media rows`,
			);
		}
		if (media.filter((m) => m.isDefault).length !== 1) {
			throw new Error(
				`${CONTENT_MARKET_SOURCE_PATH}: ${where} (${str(raw, "slug", where)}) must have exactly one default image`,
			);
		}

		return {
			marketId,
			slug: str(raw, "slug", where),
			title: str(raw, "title", where),
			description: str(raw, "description", where),
			resolutionDeadline,
			media,
			mediaVideoUrl: typeof video === "string" ? video : null,
		} satisfies ContentMarketSpec;
	});

	const slugs = new Set(specs.map((s) => s.slug));
	if (slugs.size !== specs.length) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: duplicate slugs in the snapshot`,
		);
	}
	const ids = new Set(specs.map((s) => s.marketId));
	if (ids.size !== specs.length) {
		throw new Error(
			`${CONTENT_MARKET_SOURCE_PATH}: duplicate market ids in the snapshot`,
		);
	}
	return specs;
}

/** `capturedAt`, for the runner's receipt. Says WHICH capture was replayed. */
export function contentMarketSourceCapturedAt(): string {
	const parsed: unknown = JSON.parse(
		readFileSync(CONTENT_MARKET_SOURCE_PATH, "utf8"),
	);
	return isRecord(parsed) && typeof parsed.capturedAt === "string"
		? parsed.capturedAt
		: "(unknown)";
}
