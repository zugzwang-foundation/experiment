/**
 * BLOCK-1 — the static, per-slug resolution-block map.
 *
 * Every value is frozen at pre-registration and never changes during the live
 * window (15 Sep – 5 Nov 2026), so it ships as an in-code map rather than a
 * new `markets` column — there is no home for it in the 11-column table and
 * this task does not add one (code freeze 10 Sep; a migration authored
 * unattended applies before anyone reviews it).
 *
 * ⚠⚠ TWO DIFFERENT GUARANTEES, AND NEITHER ALONE IS "fail the build" LITERALLY.
 * `market.slug` is DB-sourced `string` — no TypeScript mechanism can prove an
 * arbitrary runtime string is a member of an 8-element literal union, so a
 * strict compile-time guarantee against LIVE DATA is not achievable here
 * without an unjustified `as` cast. What IS achievable, and what this file
 * provides:
 *   1. `RESOLUTION_BLOCKS` is typed `Record<KnownMarketSlug, ResolutionBlockSet>`
 *      — omitting one of the eight known slugs from the object literal below
 *      is a `tsc` error. `just verify` genuinely fails the build for that case.
 *   2. `getResolutionBlocks` throws for any slug outside the eight — never a
 *      silent empty bar, which is exactly the state this task exists to
 *      remove. ⚠ THIS FUNCTION'S OWN THROW IS UNCHANGED, but its CALLER
 *      (`ResolverCards`) no longer lets it propagate to `m/[slug]/error.tsx`
 *      — a joint @code-reviewer/@security-auditor finding on the first cut
 *      of this task was that doing so took the WHOLE route down,
 *      unauthenticated-GET-triggerable, for a failure that only needs one
 *      row to degrade. `ResolverCards` now catches it, captures once to
 *      Sentry (still loud — the RF-1 guarantee this rule exists for), and
 *      renders nothing for that market's resolution row. See that
 *      component's own docblock for the full reasoning; this function's
 *      contract (throw on an unknown slug) is what every test against it
 *      still exercises directly.
 * Given the code freeze, these eight markets are the only ones this
 * deployment will ever have — the distinction between "fails at tsc time" and
 * "fails loud at render time for a slug that cannot occur" is not a practical
 * gap, only a naming one.
 *
 * RESOLUTION names the resolving SURFACE, independently of RESOLVER — it is
 * not a mirror of it, and only coincides with RESOLVER's own text by
 * accident where the institution's brand name and its resolving surface
 * happen to be the same string. For five markets that surface is X
 * (Zugzwang's own eventual resolution post, U-3), so RESOLUTION reads "X".
 * For the other three the surface is the institution's own site (a
 * festival's report, a price index, a code host's own count):
 * `oktoberfest-munich-beer-volume` reads the literal domain
 * "oktoberfest.de" (BLOCK-2 correction — see below), `bitcoin-price-50k`
 * reads "CoinMarketCap" (genuinely equal to RESOLVER's own text on this one
 * row), and `github-zugzwang-repo-stars` reads "GitHub", not "Zugzwang"
 * (RESOLUTION and RESOLVER differ there too). So of the three institutional
 * rows, exactly ONE (bitcoin) has RESOLUTION textually equal to RESOLVER —
 * which is why "mirror" was never the right word for the rule, only an
 * artifact of two rows that happened to coincide before this correction.
 * Values are verbatim from the ratified register, not a typo normalized to
 * "X" across the board.
 * ⚠⚠ BLOCK-2 · founder-ruled correction to `oktoberfest-munich-beer-volume`.
 * BLOCK-1 shipped the brand name "Oktoberfest" here (@code-reviewer HIGH
 * flagged it as possibly diverging from AMEND-1 item 15, which ratifies
 * RESOLUTION as "X / oktoberfest.de / CoinMarketCap / GitHub" — the LITERAL
 * surface, not a brand name); shipped verbatim-as-instructed and flagged for
 * confirmation rather than silently changed, per BLOCK-1's own doctrine.
 * BLOCK-2 confirms the founder ruling: the literal domain. The brand name
 * had been picked for column-fit before BLOCK-1's own S4 measured how this
 * surface's `truncate` recipe actually degrades (gracefully — full text
 * stays in the DOM, ellipsis only, BLOCK-2 run report), so there was no fit
 * reason left to prefer it once that was known.
 * RESOLUTION's `href` is `null` on all eight today (U-3's eventual target —
 * Zugzwang's own X post per market — doesn't exist yet); the seam for wiring
 * it later is one value per market, right here, with zero component changes.
 */

export type ResolutionBlockEntry = {
	line1: string;
	line2: string | null;
	href: string | null;
};

export type ResolutionBlockSet = {
	resolution: ResolutionBlockEntry;
	resolver: ResolutionBlockEntry;
	closes: ResolutionBlockEntry;
	flavour: ResolutionBlockEntry;
};

const KNOWN_SLUGS = [
	"mumbai-bmc-pink-october-disclosure",
	"oktoberfest-munich-beer-volume",
	"chess-fide-tiebreak-response",
	"bitcoin-price-50k",
	"math-erdos-contribution-response",
	"claude-bundle-response",
	"yc-paper-club-response",
	"github-zugzwang-repo-stars",
] as const;

export type KnownMarketSlug = (typeof KNOWN_SLUGS)[number];

const CLOSES_DEFAULT: ResolutionBlockEntry = {
	line1: "5 Nov 2026",
	line2: "23:45Z",
	href: null,
};

/**
 * ⚠⚠ THE ONLY EXCEPTION, AND IT IS LOAD-BEARING. `oktoberfest-munich-beer-volume`
 * trades closes 2026-10-04T21:59:00Z (23:59 Munich, the festival's last day);
 * it SETTLES on 5 Nov with the seven others because the resolving report
 * publishes after the festival ends. A block reading "5 Nov 2026" here would
 * tell a participant they can still trade for another month — G3 pins this.
 */
const OKTOBERFEST_CLOSES: ResolutionBlockEntry = {
	line1: "4 Oct 2026",
	line2: "21:59Z",
	href: null,
};

export const RESOLUTION_BLOCKS: Record<KnownMarketSlug, ResolutionBlockSet> = {
	"mumbai-bmc-pink-october-disclosure": {
		resolution: { line1: "X", line2: null, href: null },
		resolver: {
			line1: "@mybmc",
			line2: null,
			href: "https://x.com/mybmc",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "pressure", line2: null, href: null },
	},
	"oktoberfest-munich-beer-volume": {
		// ⚠⚠ BLOCK-2 · founder-ruled correction. AMEND-1 item 15 (§0)
		// ratified RESOLUTION as the literal resolving SURFACE — "X /
		// oktoberfest.de / CoinMarketCap / GitHub" — and this row shipped
		// the brand name "Oktoberfest" at BLOCK-1 instead, picked for
		// column-fit before BLOCK-1's own S4 measured how this surface's
		// `truncate` recipe actually degrades. It degrades gracefully (full
		// text stays in the DOM, ellipsis only — see BLOCK-2's run report),
		// so there's no fit reason left to prefer the brand name over the
		// ruled literal. RESOLVER keeps "Oktoberfest" — that field was never
		// in question, only RESOLUTION was.
		resolution: { line1: "oktoberfest.de", line2: null, href: null },
		resolver: {
			line1: "Oktoberfest",
			line2: null,
			href: "https://www.oktoberfest.de/en",
		},
		closes: OKTOBERFEST_CLOSES,
		flavour: { line1: "consumption", line2: null, href: null },
	},
	"chess-fide-tiebreak-response": {
		resolution: { line1: "X", line2: null, href: null },
		resolver: {
			line1: "@FIDE_chess",
			line2: null,
			href: "https://x.com/FIDE_chess",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "petition", line2: null, href: null },
	},
	"bitcoin-price-50k": {
		resolution: { line1: "CoinMarketCap", line2: null, href: null },
		resolver: {
			line1: "CoinMarketCap",
			// ⚠ CoinMarketCap's LIVE TICKER is excluded by name in BTC-01's B2 —
			// the href below is the historical-data page, and "Low" names the
			// specific published field (the daily low) the criterion reads,
			// not a live price.
			line2: "Low",
			href: "https://coinmarketcap.com/currencies/bitcoin/historical-data/",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "barrier", line2: null, href: null },
	},
	"math-erdos-contribution-response": {
		resolution: { line1: "X", line2: null, href: null },
		resolver: {
			line1: "@thomasfbloom",
			line2: null,
			href: "https://x.com/thomasfbloom",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "innovation", line2: null, href: null },
	},
	"claude-bundle-response": {
		resolution: { line1: "X", line2: null, href: null },
		// ⚠ FOUNDER-RULED, BLOCK-2. The live criterion qualifies three accounts
		// (@AnthropicAI, @claudeai, @ClaudeDevs) — @security-auditor flagged
		// that showing only one here could read as excluding the other two.
		// Ruled: this chip stays a single named pointer, not an exhaustive
		// citation of the criterion (the full three-account list is in the
		// market's own description, untouched by this map). Not an oversight
		// — do not "complete" this to a `+2` marker or a second account.
		resolver: {
			line1: "@claudeai",
			line2: null,
			href: "https://x.com/claudeai",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "suggestion", line2: null, href: null },
	},
	"yc-paper-club-response": {
		resolution: { line1: "X", line2: null, href: null },
		resolver: {
			line1: "@ycombinator",
			line2: null,
			href: "https://x.com/ycombinator",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "showcase", line2: null, href: null },
	},
	"github-zugzwang-repo-stars": {
		resolution: { line1: "GitHub", line2: null, href: null },
		resolver: {
			// ⚠⚠ TEXT AND HREF DELIBERATELY DIVERGE. "Zugzwang" / "repo" is the
			// short display pair; the href is the full repo URL. The URL does
			// not fit this column at any shipped viewport (231.80px against a
			// 67.20px column, ~3.45x) — the text is short by design, the link
			// is complete. Do not "fix" the text back to the URL (G5).
			line1: "Zugzwang",
			line2: "repo",
			// Cross-checked byte-identical against the existing
			// `GITHUB_REPO_URL` export in `@/server/github/star-count` —
			// hardcoded rather than imported, to keep this presentation-layer
			// data file free of any `src/server/` coupling.
			href: "https://github.com/zugzwang-foundation/experiment",
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "callout", line2: null, href: null },
	},
};

export function isKnownMarketSlug(slug: string): slug is KnownMarketSlug {
	return Object.hasOwn(RESOLUTION_BLOCKS, slug);
}

export function getResolutionBlocks(slug: string): ResolutionBlockSet {
	if (!isKnownMarketSlug(slug)) {
		throw new Error(
			`ResolverCards: no resolution-block data for market slug "${slug}". ` +
				"BLOCK-1 ships a static, per-slug map for exactly the eight known " +
				"markets — add an entry to RESOLUTION_BLOCKS before this market can " +
				"render its resolution row.",
		);
	}
	return RESOLUTION_BLOCKS[slug];
}
