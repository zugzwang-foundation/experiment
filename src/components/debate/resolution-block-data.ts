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
 * ⚠⚠ BLOCK-3 · MKT-SLATE CONTENT-BLOCK MANIFEST v1.1 (founder-ratified
 * 2026-09-01) REDEFINES RESOLUTION, SUPERSEDING v1.0 AND AMEND-1 ITEM 15 —
 * READ THIS BEFORE READING ANY VALUE BELOW. Through BLOCK-1/BLOCK-2,
 * RESOLUTION named "the surface the answer is read from" (a place). v1.1
 * redefines it as "the thing that is read to settle the market" (a
 * document, a post, an act of publication) — related to the old
 * definition, not identical to it, and every value below reflects the NEW
 * one. For the five markets resolved by watching a named X account,
 * RESOLUTION now reads "Response on X" — the THING read is a response
 * post, found on the platform X, where BLOCK-1/2 read bare "X" (the
 * platform alone, under the old surface-only definition).
 * `bitcoin-price-50k` keeps "CoinMarketCap" (a published data series IS the
 * thing read, not merely a site — the old and new definitions happen to
 * coincide there) and `github-zugzwang-repo-stars` keeps "GitHub" (the star
 * count itself is the thing read).
 * ⚠ RESOLVER is a DIFFERENT question — who or what publishes the thing —
 * and v1.1 does not touch it. It stays "who resolves", independent of
 * RESOLUTION's "what is read" — never a mirror of it.
 * RESOLUTION's `href` is `null` on all eight today (U-3's eventual target —
 * Zugzwang's own X post per market — doesn't exist yet); the seam for wiring
 * it later is one value per market, right here, with zero component changes.
 *
 * ⛔⛔ BLOCK-4 — EVERY `line2` IN THIS MAP IS NOW `null`, ON ALL EIGHT MARKETS
 * AND ALL FOUR BLOCKS. Founder-ruled: no block renders a second line. Four
 * paragraphs above this one used to describe two-line values as live content
 * and are corrected in place rather than left standing beside data that
 * contradicts them (§8 O-5) — the superseded shapes were
 * `oktoberfest-munich-beer-volume`'s RESOLUTION ("oktoberfest.de" / "report")
 * and RESOLVER ("Oktoberfest" / "management"), `github-zugzwang-repo-stars`'s
 * RESOLVER ("Zugzwang" / "repo", now the single word "GitHub"), and CLOSES's
 * time line on all eight ("23:45Z", and "21:59Z" for oktoberfest).
 * ⚠⚠ THE DROPPED LINES ARE NOT THE SAME KIND OF LOSS, AND THAT IS WORTH
 * SAYING ONCE. "report", "management" and "repo" were REFINEMENTS — they
 * narrowed a value that reads correctly without them. The CLOSES times were
 * INFORMATION: "5 Nov 2026" no longer says WHEN on that day trading stops.
 * That is a deliberate founder ruling, not an oversight, and the exact
 * instant survives in `markets.resolution_deadline` (which this map is
 * pinned against, test `CLOSES-matches-the-LIVE-resolution_deadline`) and in
 * the market's own criterion text.
 * ⛔ THE `line2` FIELD ITSELF STAYS, and its nullability is now the whole
 * point of it: it is the seam RESOLUTION's own href/second line will use when
 * Zugzwang's stimulus posts publish (U-3). Nothing in the shipped map
 * exercises the two-line render path any more, so that path is held open by
 * a SYNTHETIC fixture instead — `resolver-cards.test.tsx`'s
 * "a-SYNTHETIC-two-line-entry-still-renders-BOTH-lines". Delete that test and
 * the branch rots untested; the branch is not dead code, it is unused code
 * with a scheduled consumer.
 */

export type ResolutionBlockEntry = {
	line1: string;
	line2: string | null;
	href: string | null;
	/**
	 * BLOCK-3 §3 — the value line's font size in px, PER BLOCK, sized to that
	 * block's own strings. Precomputed and baked in here rather than computed
	 * at render time, for the same reason the rest of this map is static: the
	 * content is frozen, so the size that fits it is frozen too, and
	 * recomputing on every request would be Server-Component-breaking work
	 * (real text measurement needs a DOM) for an answer that never changes.
	 * BAND 12–14, HARD FLOOR 11 — below the floor the value ellipsizes
	 * (`truncate`, `ResolverCards.tsx`) rather than shrinking further.
	 * MEASURED, not estimated, and MEASURED TWICE. §3 first fit every value at
	 * 14/13/12/11px against the column as it stood before §2: 79px at
	 * 1440×777/900, real deployed font (Geist), largest size where
	 * `scrollWidth <= clientWidth` for BOTH `line1` and `line2` when present —
	 * one shared size per block, not one per line. §2 then shrank the glyph
	 * (48px → 36px) for an unrelated reason (reducing block height) and, as a
	 * side effect, widened that column to 91px — every §3 size still fit the
	 * WIDER column (shrinking a glyph can only add room, never remove it), so
	 * nothing was BROKEN by landing §2 after §3, but several sizes were now
	 * smaller than they needed to be. Re-measured against the 91px column
	 * before shipping rather than left at the first pass's numbers: every
	 * `"Response on X"` RESOLUTION moved 11→13, most single-line RESOLVER
	 * values moved up one or two steps, and the one entry that had been AT the
	 * 11px floor and still truncating — `math-erdos-contribution-response`'s
	 * `@thomasfbloom` — now fits cleanly at 12px. No entry in this map is at
	 * the 11px floor as shipped; the floor and the `truncate` backstop stay in
	 * the type and the render path regardless, because the content is frozen
	 * but the column is not guaranteed to stay exactly 91px forever. Full
	 * per-block, per-market table in BLOCK-3's run report.
	 *
	 * ⚠⚠ BLOCK-4 RE-MEASURED ALL TWENTY VALUES AGAINST THE SINGLE-LINE LAYOUT
	 * AND NOT ONE SIZE MOVED. That is a reportable NEGATIVE result, not a
	 * skipped step: the brief expected several values to size UP, and the
	 * measurement says they cannot, because §2 shrinks the block's HEIGHT and
	 * the fit is a function of its WIDTH. The three dimensions that set this
	 * column — `px-[11px]`, the 36px glyph, the `gap-2.5` between them — are
	 * all untouched by BLOCK-4, so the column is still 90.672px, and BLOCK-3
	 * had already fitted every value to exactly that. Dropping `line2` cannot
	 * free width either: the shared size was always the largest that fits BOTH
	 * lines, and on every two-line entry the BINDING line was `line1`
	 * ("oktoberfest.de" over "report", "5 Nov 2026" over "23:45Z"), so
	 * removing the shorter line relaxes nothing.
	 * ⚠ Measured sub-pixel on the deployed staging build at 1440×900, real
	 * Geist 400, `getBoundingClientRect().width` at `width:max-content` against
	 * the 90.672px column (the integer `scrollWidth <= clientWidth` test agrees
	 * exactly, and was run first). Headroom at the shipped size, tightest
	 * first: `@thomasfbloom` 0.37px @12 · `@FIDE_chess` 2.77 @14 ·
	 * `Response on X` 2.80 @13 · `oktoberfest.de` 4.22 @13 · `@ycombinator`
	 * 4.71 @13 · `CoinMarketCap` 4.87 @12 · `Consumption` 5.44 @14; every other
	 * value clears 14px by 14px or more.
	 * ⚠ `oktoberfest.de` DOES sit one step below its neighbours (13 against the
	 * 14 its own RESOLVER "Oktoberfest" takes), which is what the brief
	 * predicted — but it is NOT the tightest string in the map, and the guess
	 * and the measurement agreeing on the conclusion while disagreeing on the
	 * reason is exactly why it was measured. `@thomasfbloom` is tightest, by an
	 * order of magnitude.
	 */
	fontSize: 11 | 12 | 13 | 14;
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

/**
 * ⚠⚠ BLOCK-4 — THE TIME LINE IS GONE AND THE DATE IS NOT, AND THE ASYMMETRY IS
 * THE WHOLE OF THIS CONSTANT'S RISK. `line2: "23:45Z"` dropped with every other
 * second line; `line1` is untouched and stays pinned to the LIVE
 * `markets.resolution_deadline` by `resolution-block-data.test.ts`. Losing the
 * date would be the G3 failure this map exists to prevent — losing the time
 * costs a participant the last quarter-hour of an eight-week window, which the
 * founder ruled acceptable against a block that reads clean. The instant itself
 * is still authoritative in the column and in the market's criterion text.
 */
const CLOSES_DEFAULT: ResolutionBlockEntry = {
	line1: "5 Nov 2026",
	line2: null,
	href: null,
	fontSize: 14,
};

/**
 * ⚠⚠ THE ONLY EXCEPTION, AND IT IS LOAD-BEARING. `oktoberfest-munich-beer-volume`
 * trades closes 2026-10-04T21:59:00Z (23:59 Munich, the festival's last day);
 * it SETTLES on 5 Nov with the seven others because the resolving report
 * publishes after the festival ends. A block reading "5 Nov 2026" here would
 * tell a participant they can still trade for another month — G3 pins this.
 * ⚠ BLOCK-4 drops `line2: "21:59Z"` in step with `CLOSES_DEFAULT`. This entry
 * exists for its DATE, which is the month-early one, so the field that carries
 * the whole exception is the one BLOCK-4 does not touch.
 */
const OKTOBERFEST_CLOSES: ResolutionBlockEntry = {
	line1: "4 Oct 2026",
	line2: null,
	href: null,
	fontSize: 14,
};

export const RESOLUTION_BLOCKS: Record<KnownMarketSlug, ResolutionBlockSet> = {
	"mumbai-bmc-pink-october-disclosure": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			line1: "@mybmc",
			line2: null,
			href: "https://x.com/mybmc",
			fontSize: 14,
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "Pressure", line2: null, href: null, fontSize: 14 },
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
		// ⚠⚠ BLOCK-3 · MKT-SLATE v1.1 GAVE BOTH FIELDS A SECOND LINE; BLOCK-4
		// TAKES BOTH BACK, AND v1.1's REDEFINITION SURVIVES THE REMOVAL. v1.1
		// redefines RESOLUTION as "the thing that is read to settle the market",
		// and BLOCK-3 spelled that out as "oktoberfest.de" / "report" (the
		// surface, then the thing) with RESOLVER matching at "Oktoberfest" /
		// "management" (who, then which part of who). Both second lines are now
		// `null`. The redefinition is unaffected: "oktoberfest.de" already names
		// a publication rather than a place in the way v1.1 means, and this is
		// the one RESOLUTION value that reads as a source you could go and open.
		// ⛔ THE DOMAIN IS THE VALUE AND ITS CASE IS DATA. `oktoberfest.de` is
		// lowercase because that is the domain; a CSS `capitalize` on this
		// column would render `Oktoberfest.de`, which is a different string and
		// arguably a different domain. That is why sentence case lives here and
		// never in a class — pinned at render level by
		// `resolver-cards.test.tsx`'s lowercase-`o` guard. hrefs unchanged.
		resolution: {
			line1: "oktoberfest.de",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			line1: "Oktoberfest",
			line2: null,
			href: "https://www.oktoberfest.de/en",
			fontSize: 14,
		},
		closes: OKTOBERFEST_CLOSES,
		flavour: { line1: "Consumption", line2: null, href: null, fontSize: 14 },
	},
	"chess-fide-tiebreak-response": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			line1: "@FIDE_chess",
			line2: null,
			href: "https://x.com/FIDE_chess",
			fontSize: 14,
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "Petition", line2: null, href: null, fontSize: 14 },
	},
	"bitcoin-price-50k": {
		resolution: {
			line1: "CoinMarketCap",
			line2: null,
			href: null,
			fontSize: 12,
		},
		resolver: {
			line1: "CoinMarketCap",
			// ⚠⚠ BLOCK-3 — `line2: "Low"` REMOVED, founder-ruled. CoinMarketCap's
			// LIVE TICKER is still excluded by name in BTC-01's B2 and the href
			// below is still the historical-data page — that distinction stands
			// on the URL alone now, not on a second display line. `line1` and
			// `href` are otherwise unchanged.
			line2: null,
			href: "https://coinmarketcap.com/currencies/bitcoin/historical-data/",
			fontSize: 12,
		},
		closes: CLOSES_DEFAULT,
		// ⚠ BLOCK-4 — FLAVOUR `Barrier` → `Sentiment`, founder-ruled. "Barrier"
		// named the $50k THRESHOLD (the mechanism BTC-01 settles against);
		// "Sentiment" names what the market is actually about. FLAVOUR has never
		// been a restatement of the criterion — the criterion is its own text —
		// so a word that reads on the market rather than on its arithmetic is
		// the register this column is for. Sentence case is in the DATA (§1).
		flavour: { line1: "Sentiment", line2: null, href: null, fontSize: 14 },
	},
	"math-erdos-contribution-response": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			// ⚠⚠ WAS THE FLOOR-HIT CASE THROUGH §3'S FIRST PASS — "@thomasfbloom"
			// did not fit the 79px column even at the 11px floor (needed ~83px),
			// and this comment used to document that as the one entry relying on
			// `truncate` to degrade rather than a fifth, smaller size. §2 shrank
			// the glyph afterward (48px → 36px, for the unrelated reason of
			// reducing block height) and widened the column to 91px as a side
			// effect — re-measured against that column before shipping, and
			// "@thomasfbloom" now fits cleanly at 12px, no truncation. `truncate`
			// stays on the class list regardless (every value carries it,
			// unconditionally — see `ResolverCards.tsx`), so nothing about the
			// render path changed; only whether this specific string needs it did.
			line1: "@thomasfbloom",
			line2: null,
			href: "https://x.com/thomasfbloom",
			fontSize: 12,
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "Innovation", line2: null, href: null, fontSize: 14 },
	},
	"claude-bundle-response": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
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
			fontSize: 14,
		},
		closes: CLOSES_DEFAULT,
		// ⚠ BLOCK-4 — FLAVOUR `Suggestion` → `Feedback`, founder-ruled. The
		// criterion resolves on ANY qualifying reply, and "Suggestion" narrows
		// that to the subset that proposes something — a market that resolves
		// YES on a flat rejection would then be sitting under a word its own
		// criterion contradicts. "Feedback" covers approval, rejection and
		// dismissal identically, which is what the criterion actually says.
		flavour: { line1: "Feedback", line2: null, href: null, fontSize: 14 },
	},
	"yc-paper-club-response": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			line1: "@ycombinator",
			line2: null,
			href: "https://x.com/ycombinator",
			fontSize: 13,
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "Showcase", line2: null, href: null, fontSize: 14 },
	},
	"github-zugzwang-repo-stars": {
		resolution: { line1: "GitHub", line2: null, href: null, fontSize: 14 },
		resolver: {
			// ⚠⚠ TEXT AND HREF DELIBERATELY DIVERGE, AND BLOCK-4 WIDENS THE GAP
			// RATHER THAN CLOSING IT. The display pair was "Zugzwang" / "repo";
			// it is now the single word "GitHub", while the href stays the full
			// repo URL. The URL does not fit this column at any shipped viewport
			// (231.80px against a 90.67px column, ~2.6x) — the text is short by
			// design, the link is complete. Do not "fix" the text back to the URL
			// (G5).
			// ⚠ THIS ROW NOW HAS THE SAME SHAPE AS `bitcoin-price-50k`'s: a
			// PLATFORM name pointing at a SPECIFIC page on it (there, the
			// historical-data page; here, one repository). Both are deliberate,
			// and in both the href is the precise half. A reader who assumes the
			// text is the destination gets github.com rather than this repo,
			// which is why G5 pins the href by its full string and asserts the
			// display text is not a URL.
			// ⚠ RESOLUTION and RESOLVER are now textually EQUAL on this market
			// ("GitHub" / "GitHub"), which through BLOCK-2/BLOCK-3 was true of
			// `bitcoin-price-50k` alone. Not a copy-paste slip: the star count IS
			// read from GitHub AND published by GitHub, so the two questions have
			// one answer here. The fields stay independent (see this file's
			// docblock) — they coincide, they do not mirror.
			line1: "GitHub",
			line2: null,
			// Cross-checked byte-identical against the existing
			// `GITHUB_REPO_URL` export in `@/server/github/star-count` —
			// hardcoded rather than imported, to keep this presentation-layer
			// data file free of any `src/server/` coupling.
			href: "https://github.com/zugzwang-foundation/experiment",
			fontSize: 14,
		},
		closes: CLOSES_DEFAULT,
		flavour: { line1: "Callout", line2: null, href: null, fontSize: 14 },
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
