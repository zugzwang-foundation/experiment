// MKT-ROSTER-1 · ONE-TIME — the six PRODUCTION content markets, read from
// `docs/data/prod-markets-snapshot.json`.
//
// ⛔⛔ THE PRODUCTION SNAPSHOT IS A DIFFERENT FILE FROM STAGING'S, AND THAT IS
// THE SINGLE MOST IMPORTANT FACT IN THIS LANE. Production was built fresh on
// 2026-09-14, not restored from staging: the same eight slugs carry DIFFERENT
// primary keys, seven carry DIFFERENT descriptions, and one carries a different
// title. Measured 2026-09-18, both environments, per-field md5.
//
// ⇒ Seeding production from `staging-markets-snapshot.json` would silently
// replace the founder's production copy with staging's on five of the six
// survivors, and re-mint ids that would orphan all twelve surviving R2 objects.
// This module therefore reads production's OWN capture and nothing else. The
// path is the only line here worth checking twice.
//
// ⚠ It TRANSCRIBES NOTHING, for the same reason its staging twin does not: the
// market copy is the founder's (CLAUDE.md §3 makes inventing it a refusal
// trigger), and a second copy of a copy is a place for it to drift.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PRODUCTION_PROJECT_REF } from "./_lib/prod-target";

/** The committed production capture. The single source for all six markets. */
export const PROD_MARKET_SOURCE_PATH = fileURLToPath(
	new URL("../../docs/data/prod-markets-snapshot.json", import.meta.url),
);

/** How many markets the snapshot must hold. A short read is a broken read. */
export const PROD_MARKET_COUNT = 6;

/**
 * How many `market_media` rows it must hold, for the SAME reason.
 *
 * ⚠ `@security-auditor`, LOW — the short-read argument was made for markets and
 * not for media, and it applies identically: the per-market filter silently drops
 * a row it cannot match, so a snapshot that had lost one image would restore a
 * market with a single picture and report success. `media.length === 0` and
 * exactly-one-default do not catch it, because one image satisfies both.
 */
export const PROD_MARKET_MEDIA_COUNT = 12;

export interface ProdMarketMedia {
	readonly mediaId: string;
	readonly key: string;
	readonly displayOrder: number;
	readonly isDefault: boolean;
}

export interface ProdMarketSpec {
	readonly marketId: string;
	readonly slug: string;
	readonly title: string;
	readonly description: string;
	readonly resolutionDeadline: Date;
	readonly media: readonly ProdMarketMedia[];
	readonly mediaVideoUrl: string | null;
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
			`${PROD_MARKET_SOURCE_PATH}: ${where}.${field} is not a non-empty string`,
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
			`${PROD_MARKET_SOURCE_PATH}: media key ${JSON.stringify(key)} is not under ${prefix}`,
		);
	}
	const file = key.slice(prefix.length);
	const dot = file.lastIndexOf(".");
	if (dot <= 0) {
		throw new Error(
			`${PROD_MARKET_SOURCE_PATH}: media key ${JSON.stringify(key)} has no extension`,
		);
	}
	return file.slice(0, dot);
}

/**
 * REFUSES rather than returns a short list: a snapshot that has lost a market
 * would otherwise seed five and report success, and the missing one would only
 * surface as a 404 on a slug somebody had already shared.
 */
export function loadProdContentMarkets(): readonly ProdMarketSpec[] {
	const parsed: unknown = JSON.parse(
		readFileSync(PROD_MARKET_SOURCE_PATH, "utf8"),
	);
	if (!isRecord(parsed))
		throw new Error(`${PROD_MARKET_SOURCE_PATH}: not a JSON object`);
	const marketRows = parsed.markets;
	const mediaRows = parsed.market_media;
	if (!Array.isArray(marketRows) || !Array.isArray(mediaRows)) {
		throw new Error(
			`${PROD_MARKET_SOURCE_PATH}: "markets" and "market_media" must both be arrays`,
		);
	}
	if (marketRows.length !== PROD_MARKET_COUNT) {
		throw new Error(
			`${PROD_MARKET_SOURCE_PATH}: expected ${PROD_MARKET_COUNT} markets, found ${marketRows.length}`,
		);
	}
	if (mediaRows.length !== PROD_MARKET_MEDIA_COUNT) {
		throw new Error(
			`${PROD_MARKET_SOURCE_PATH}: expected ${PROD_MARKET_MEDIA_COUNT} market_media rows, found ${mediaRows.length}`,
		);
	}

	// ⛔⛔ THE SOURCE MUST BE PRODUCTION'S OWN CAPTURE, AND THIS LINE IS THE ONLY
	// THING THAT ENFORCES IT. A `cp` of the staging snapshot into this path would
	// seed production with staging's copy and staging's ids — replacing the
	// founder's production text and orphaning all twelve R2 objects — and every
	// other assertion in this module would pass.
	//
	// ⚠ IN PARTICULAR `PROD_MARKET_COUNT` WOULD NOT CATCH IT. Both snapshots now
	// hold SIX markets (measured 2026-09-18), so the count is identical across the
	// two files. An earlier version of this comment reasoned from the id prefixes
	// instead — production's begin `01a0a0b`, staging's `01a01181` — which is true
	// and is NOT what the code below checks. `@security-auditor` flagged the
	// mismatch, because the next editor reasons from the comment. The check is the
	// capture's recorded `source.user`, and it is load-bearing.
	const source = parsed.source;
	const sourceUser =
		isRecord(source) && typeof source.user === "string" ? source.user : "";
	if (!sourceUser.includes(PRODUCTION_PROJECT_REF)) {
		throw new Error(
			`${PROD_MARKET_SOURCE_PATH}: source.user is ${JSON.stringify(sourceUser)} — this capture is not ` +
				"from the production project. Seeding production from another environment's snapshot would " +
				"replace the founder's copy and orphan every R2 object; refusing.",
		);
	}

	return marketRows.map((raw, i) => {
		if (!isRecord(raw))
			throw new Error(
				`${PROD_MARKET_SOURCE_PATH}: markets[${i}] is not an object`,
			);
		const where = `markets[${i}]`;
		const marketId = str(raw, "id", where);
		const deadlineIso = str(raw, "resolution_deadline", where);
		const resolutionDeadline = new Date(deadlineIso);
		if (Number.isNaN(resolutionDeadline.getTime())) {
			throw new Error(
				`${PROD_MARKET_SOURCE_PATH}: ${where}.resolution_deadline is not a date`,
			);
		}
		const video = raw.media_video_url;
		if (video !== null && video !== undefined && typeof video !== "string") {
			throw new Error(
				`${PROD_MARKET_SOURCE_PATH}: ${where}.media_video_url must be a string or null`,
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
						`${PROD_MARKET_SOURCE_PATH}: market_media.display_order for ${key} is not an integer`,
					);
				}
				return {
					mediaId: mediaIdFromKey(key, marketId),
					key,
					displayOrder: order,
					isDefault: m.is_default === true,
				} satisfies ProdMarketMedia;
			})
			.sort((a, b) => a.displayOrder - b.displayOrder);

		// Refuse at LOAD, before anything is written, so a malformed snapshot
		// cannot leave production half-seeded.
		if (media.length === 0) {
			throw new Error(
				`${PROD_MARKET_SOURCE_PATH}: ${where} (${str(raw, "slug", where)}) has no market_media rows`,
			);
		}
		if (media.filter((m) => m.isDefault).length !== 1) {
			throw new Error(
				`${PROD_MARKET_SOURCE_PATH}: ${where} (${str(raw, "slug", where)}) must have exactly one default image`,
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
		} satisfies ProdMarketSpec;
	});
}
