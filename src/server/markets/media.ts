import "server-only";

import {
	DefaultMediaRequiredError,
	MarketVideoUrlInvalidError,
	MediaRequiredError,
} from "./errors";

// MEDIA.1 (ADR-0026 / ADR-0027) — pure, IO-free admin market-media input
// validation. The §15 "markets always have media" rule is a service-required
// VALIDATION here (≥1 image + exactly one is_default), NOT moderation —
// market-media is operator-curated trusted content (ADR-0027). The DB partial
// unique index `market_media_one_default_per_market_uq` is the exactly-one
// storage backstop; `validateMediaManifest` is the service guard that rejects
// the 0-default and ≥2-default cases the index can't (and the empty case).

/** One image in the at-create media manifest. `key` is the R2 object key the
 * client minted via `/admin/markets/media/sign` (`m/<marketId>/...`). */
export interface MarketMediaInput {
	mediaId: string;
	key: string;
	displayOrder: number;
	isDefault: boolean;
}

/**
 * True iff `id` is a canonical lowercase UUID whose version nibble is `7`
 * (UUIDv7, ADR-0016). The client pre-generates the market PK and the media ids
 * client-side and supplies them across a trust boundary (Q3); both the sign
 * route and `createMarket` gate on this. Mirrors `insertEvent`'s `id[14] === '7'`
 * version check, with a full canonical-form regex so a malformed/non-hex value
 * is rejected, not just the version position.
 */
const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(id: string): boolean {
	return UUID_RE.test(id);
}

/**
 * Service guard for the §15 media invariant. Throws `MediaRequiredError` if the
 * manifest is empty; throws `DefaultMediaRequiredError` unless EXACTLY one entry
 * is flagged `isDefault` (the 0-default and ≥2-default cases). Returns void on a
 * valid manifest.
 */
export function validateMediaManifest(
	media: readonly MarketMediaInput[],
): void {
	if (media.length === 0) {
		throw new MediaRequiredError(
			"a market requires at least one media image (§15 service invariant)",
		);
	}
	const defaultCount = media.filter((m) => m.isDefault).length;
	if (defaultCount !== 1) {
		throw new DefaultMediaRequiredError(
			`exactly one media image must be the default (got ${defaultCount})`,
		);
	}
}

/** Accepted YouTube hosts for the outbound explainer link (ADR-0026 #6). */
const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"youtu.be",
]);

/**
 * Normalize the optional outbound video URL. `null` / `undefined` / empty /
 * whitespace-only → `null` (video is optional). A well-formed `https:` URL whose
 * host is a YouTube host → returned verbatim. Anything else (non-https,
 * non-YouTube host, unparseable) → `MarketVideoUrlInvalidError`. ADR-0026 #6:
 * the video is hosted on YouTube and reached by outbound link only.
 */
export function normalizeMediaVideoUrl(
	raw: string | null | undefined,
): string | null {
	if (raw == null) return null;
	const trimmed = raw.trim();
	if (trimmed === "") return null;

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new MarketVideoUrlInvalidError(
			`invalid video URL ${JSON.stringify(raw)} (must be a YouTube URL)`,
		);
	}
	if (parsed.protocol !== "https:" || !YOUTUBE_HOSTS.has(parsed.hostname)) {
		throw new MarketVideoUrlInvalidError(
			`invalid video URL ${JSON.stringify(raw)} (must be an https YouTube URL)`,
		);
	}
	return trimmed;
}
