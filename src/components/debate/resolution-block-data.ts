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
 *   2. `getResolutionBlocks` throws, loudly, for any slug outside the eight —
 *      caught by `m/[slug]/error.tsx`, never a silent empty bar. An empty bar
 *      is exactly the state this task exists to remove, so a silent fallback
 *      to it would be undetectable.
 * Given the code freeze, these eight markets are the only ones this
 * deployment will ever have — the distinction between "fails at tsc time" and
 * "fails loud at render time for a slug that cannot occur" is not a practical
 * gap, only a naming one.
 *
 * RESOLUTION names the resolving SURFACE, independently of RESOLVER — it is
 * not a mirror of it. For five markets that surface is X (Zugzwang's own
 * eventual resolution post, U-3), so RESOLUTION reads "X". For the other
 * three the surface is the institution's own site (a festival's report, a
 * price index, a code host's own count) — CoinMarketCap and Oktoberfest, and
 * for `github-zugzwang-repo-stars` that surface is "GitHub", not "Zugzwang":
 * RESOLUTION and RESOLVER genuinely differ on that row, which is why "mirror"
 * is the wrong word for the rule even though it happens to describe two of
 * the three cases. Values are verbatim from the ratified register, not a
 * typo normalized to "X" across the board (@code-reviewer HIGH — flagged
 * that RF-2's cell for `oktoberfest-munich-beer-volume` may intend the
 * literal surface "oktoberfest.de" rather than the brand name "Oktoberfest";
 * shipped as ratified-verbatim per the kickoff's explicit instruction not to
 * paraphrase, flagged for operator confirmation in the run report rather
 * than silently changed against a document this task didn't cite).
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
		resolution: { line1: "Oktoberfest", line2: null, href: null },
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
