import {
	type FlavourName,
	isKnownMarketSlug,
	type KnownMarketSlug,
} from "./resolution-block-data";

/**
 * BLOCK-5b — the per-block glyph asset map.
 *
 * ⚠⚠ THESE ARE STATIC ASSETS KEYED TO A TAXONOMY, NOT PER-MARKET MEDIA, AND
 * THE DISTINCTION DECIDES WHERE THEY LIVE. `market_media` is the R2 path for
 * operator-uploaded market imagery: the sign route mints an opaque
 * `m/<marketId>/<mediaId>.<ext>` key (ADR-0026), the object is per-market by
 * construction, and its MIME allowlist and 8 MiB cap exist to bound an upload
 * a human performs. None of that describes a glyph. These ten are
 * build-time constants, shared across markets — `response-on-x.png` serves
 * four of the six — and a taxonomy entry has no market to be keyed by at
 * all. They ship from `public/`, whose precedent is
 * `public/brand/zugzwang-mark.svg`.
 *
 * ⛔⛔ THE ASSETS ARE TRANSPARENT PNGs AND `bg-n1` IS LOAD-BEARING BECAUSE OF
 * IT. The sources arrived as opaque marks on a baked plate whose colour was
 * measured, per file, at `#232323`–`#2E2E2E` — an eleven-level spread
 * straddling the `#2A2A2A` the span itself paints, which rendered as a visible
 * square inside the block's own frame on eight of the thirteen assets that
 * then shipped. Rather than repaint thirteen plates to match a token (and
 * re-acquire the same drift the moment that token moves), the plate was keyed
 * out: the mark is flat `#FAFAFA` carried entirely by an alpha channel, and
 * the span's `bg-n1` behind it IS the plate. The seam cannot come back,
 * because there is no second copy of the colour to disagree with.
 * ⇒ `ResolverCards.tsx` must keep `bg-n1` on the glyph span. It is not a
 * loading fallback any more; removing it renders the mark on whatever happens
 * to be behind.
 *
 * ⚠ Every asset is 512×512 with its ink normalised to 70% of the canvas by
 * HEIGHT, centred on the ink bounding box — the convention measured off the
 * Discovery thumbnails at BLOCK-5a. By height, never width or area: a wide
 * mark and a narrow one read at the same optical size only if their heights
 * agree, and normalising by width or area is what makes an hourglass tower
 * over a megaphone. Widths therefore vary (208–504px) and that is correct.
 * `tests/unit/debate/resolution-block-glyphs.test.ts` pins the 70% and the
 * achromacy against the shipped bytes.
 */

/** The public path every entry below is resolved against. */
const GLYPH_DIR = "/brand/blocks";

/**
 * RESOLUTION and RESOLVER take the SAME asset on every market — after BLOCK-4
 * their values coincide (RESOLUTION names the thing read, RESOLVER who
 * publishes it, and for all six markets that is one source with one mark).
 * One map, consulted twice, rather than two identical maps that could drift.
 */
const MARKET_GLYPHS: Record<KnownMarketSlug, string> = {
	"chess-fide-tiebreak-response": "response-on-x.png",
	"bitcoin-price-50k": "coinmarketcap.png",
	"math-erdos-contribution-response": "response-on-x.png",
	"claude-bundle-response": "response-on-x.png",
	"yc-paper-club-response": "response-on-x.png",
	"github-zugzwang-repo-stars": "github.png",
};

/**
 * FLAVOUR keys off the flavour STRING, never the market slug — see
 * `FlavourName`'s own note. `Record<FlavourName, string>` is what makes a
 * seventh flavour a `tsc` error instead of a missing glyph.
 */
const FLAVOUR_GLYPHS: Record<FlavourName, string> = {
	Petition: "petition.png",
	Sentiment: "sentiment.png",
	Innovation: "innovation.png",
	Feedback: "feedback.png",
	Showcase: "showcase.png",
	Callout: "callout.png",
};

/** CLOSES ON is one date treatment for all six — one asset, no map. */
const CLOSES_GLYPH = "closes-on.png";

/** The four block keys, mirroring `ResolverCards`' own `BLOCKS` fixture. */
export type ResolutionBlockKey =
	| "resolution"
	| "resolver"
	| "closes"
	| "flavour";

/**
 * Resolve all four glyph paths for one market.
 *
 * ⛔ THROWS ON AN UNKNOWN SLUG, DELIBERATELY, AND IS CALLED INSIDE
 * `ResolverCards`' EXISTING `try`. It mirrors `getResolutionBlocks`' contract
 * exactly so the caller needs no second failure mode: the same catch captures
 * once to Sentry and degrades that one row. There is no `null`-glyph fallback
 * and that is the point — a missing entry rendering the empty span again would
 * be indistinguishable from the state this task exists to replace, so nobody
 * would notice it had regressed.
 */
export function getResolutionBlockGlyphs(
	slug: string,
	flavour: FlavourName,
): Record<ResolutionBlockKey, string> {
	if (!isKnownMarketSlug(slug)) {
		throw new Error(
			`ResolverCards: no resolution-block glyph for market slug "${slug}". ` +
				"BLOCK-5b ships a static, per-slug glyph map for exactly the six " +
				"known markets — add an entry to MARKET_GLYPHS before this market " +
				"can render its resolution row.",
		);
	}
	const marketGlyph = MARKET_GLYPHS[slug];
	return {
		resolution: `${GLYPH_DIR}/${marketGlyph}`,
		resolver: `${GLYPH_DIR}/${marketGlyph}`,
		closes: `${GLYPH_DIR}/${CLOSES_GLYPH}`,
		flavour: `${GLYPH_DIR}/${FLAVOUR_GLYPHS[flavour]}`,
	};
}

/**
 * Every distinct asset filename the two maps and the CLOSES constant can
 * reach. Exported for the guard, which asserts each exists on disk, is
 * achromatic, and carries the ink normalisation — the maps are the source of
 * truth for what must ship, so the test derives its inventory from them rather
 * than re-typing a list that could fall out of step.
 */
export const ALL_GLYPH_FILES: readonly string[] = [
	...new Set([
		...Object.values(MARKET_GLYPHS),
		...Object.values(FLAVOUR_GLYPHS),
		CLOSES_GLYPH,
	]),
].sort();
