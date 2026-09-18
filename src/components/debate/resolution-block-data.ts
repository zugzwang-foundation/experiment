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
 * arbitrary runtime string is a member of a 6-element literal union, so a
 * strict compile-time guarantee against LIVE DATA is not achievable here
 * without an unjustified `as` cast. What IS achievable, and what this file
 * provides:
 *   1. `RESOLUTION_BLOCKS` is typed `Record<KnownMarketSlug, ResolutionBlockSet>`
 *      — omitting one of the six known slugs from the object literal below
 *      is a `tsc` error. `just verify` genuinely fails the build for that case.
 *   2. `getResolutionBlocks` throws for any slug outside the six — never a
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
 * Given the code freeze, these six markets are the only ones this
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
 * one. For the four markets resolved by watching a named X account,
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
 * RESOLUTION's `href` is `null` on all six today (U-3's eventual target —
 * Zugzwang's own X post per market — doesn't exist yet); the seam for wiring
 * it later is one value per market, right here, with zero component changes.
 *
 * ⛔⛔ BLOCK-4 — EVERY `line2` IN THIS MAP IS NOW `null`, ON EVERY MARKET AND
 * ALL FOUR BLOCKS. Founder-ruled: no block renders a second line. Four
 * paragraphs above this one used to describe two-line values as live content
 * and are corrected in place rather than left standing beside data that
 * contradicts them (§8 O-5) — the superseded shapes were
 * `github-zugzwang-repo-stars`'s RESOLVER ("Zugzwang" / "repo", now the single
 * word "GitHub") and CLOSES's time line on every market ("23:45Z").
 * ⚠⚠ THE DROPPED LINES ARE NOT THE SAME KIND OF LOSS, AND THAT IS WORTH
 * SAYING ONCE. "repo" was a REFINEMENT — it narrowed a value that reads
 * correctly without it. The CLOSES times were
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
	 * 11px floor and still truncating — `math-erdos-solved-on-zugzwang`'s
	 * `@thomasfbloom` — now fits cleanly at 12px.
	 * ⛔⛔ D-50 — "No entry in this map is at the 11px floor as shipped" WAS
	 * TRUE WHEN BLOCK-4 WROTE IT AND IS NOW FALSE, so it is corrected here
	 * rather than contradicted by the data below (§8 O-5). `@vishy64theking`
	 * SITS ON THE FLOOR: fifteen characters need 95.01px at 12 against a
	 * 90.664px column, and 11 is the only size that fits. ⚠ It FITS — 3.57px
	 * of headroom — so `truncate` is still a pure backstop and nothing in the
	 * shipped map ellipsizes. ⚠ A FLOOR ENTRY AND A TIGHT ENTRY ARE DIFFERENT
	 * PROPERTIES: the tightest value here is still `@thomasfbloom` at 0.36px,
	 * at 12px, one step ABOVE the floor. The floor and the `truncate` backstop
	 * stay in the type and the render path regardless, because the content is
	 * frozen but the column is not guaranteed to stay exactly 91px forever. Full
	 * per-block, per-market table in BLOCK-3's run report.
	 *
	 * ⚠⚠ BLOCK-4 RE-MEASURED ALL TWENTY VALUES THEN IN THIS MAP AGAINST THE
	 * SINGLE-LINE LAYOUT AND NOT ONE SIZE MOVED. That is a reportable NEGATIVE
	 * result, not a skipped step: the brief expected several values to size
	 * UP, and the measurement says they cannot, because §2 shrinks the block's
	 * HEIGHT and the fit is a function of its WIDTH. The three dimensions that
	 * set this column — `px-[11px]`, the 36px glyph, the `gap-2.5` between
	 * them — are all untouched by BLOCK-4, so the column is still 90.672px,
	 * and BLOCK-3 had already fitted every value to exactly that. Dropping
	 * `line2` cannot free width either: the shared size was always the largest
	 * that fits BOTH lines, and on every two-line entry the BINDING line was
	 * `line1` ("5 Nov 2026" over "23:45Z"), so removing the shorter line
	 * relaxes nothing.
	 * ⚠ Measured sub-pixel on the deployed staging build at 1440×900, real
	 * Geist 400, `getBoundingClientRect().width` at `width:max-content` against
	 * the 90.672px column (the integer `scrollWidth <= clientWidth` test agrees
	 * exactly, and was run first).
	 * ⚠⚠ D-50 RE-MEASURED THE FOUR STRINGS IT INTRODUCES, on production's
	 * deployed build (canary asserted in the same call as the geometry) against
	 * a re-read column of 90.664–90.672px. Headroom at the shipped size,
	 * tightest first: `@thomasfbloom` 0.36px @12 · `@ClaudeDevs` 1.31 @14 ·
	 * `@FIDE_chess`→`@vishy64theking` 3.57 @11 · `Y Combinator` 4.14 @14 ·
	 * `CoinMarketCap` 4.87 @12 · `YC decision` 16.70 @14; every other value
	 * clears 14px by 14px or more. ⚠ `Response on X` is 2.80 @13 and still
	 * binds on THREE markets rather than four — YCP left that set.
	 * ⛔ THE FOUR BLOCK-4 FIGURES WERE REPRODUCED FIRST AS A POSITIVE CONTROL
	 * and all four agreed (2.77 / 0.37→0.36 / 2.80 / 4.71→4.70, the last two
	 * decimals being rounding), which is what makes the six above measurements
	 * rather than estimates. A probe that cannot reproduce a known figure is
	 * not measuring the thing it claims to.
	 * ⚠ `@thomasfbloom` is STILL the tightest string in the map, and the margin
	 * has narrowed rather than gone: 0.36px at 12px against `@ClaudeDevs`'s
	 * 1.31px at 14. MKT-ROSTER-1 removed two markets and neither was the
	 * binding case, so nothing was re-measured then; D-50 changes four values
	 * and therefore did.
	 */
	fontSize: 11 | 12 | 13 | 14;
};

/**
 * BLOCK-5b — the FLAVOUR taxonomy, promoted from a bare `string` to a closed
 * union.
 *
 * ⚠⚠ FLAVOUR IS A TAXONOMY THAT HAPPENS TO MAP 1:1 TO SIX MARKETS TODAY, AND
 * THE TYPE IS WHAT KEEPS THOSE TWO FACTS APART. Every other block keys off
 * `market.slug`; FLAVOUR keys off the STRING, so two markets that later share a
 * flavour share its glyph with no second entry anywhere. Widening this back to
 * `string` would silently re-admit that duplication and, worse, make
 * `FLAVOUR_GLYPHS`'s `Record<FlavourName, …>` exhaustiveness check vacuous —
 * the whole point of which is that adding a seventh flavour must fail `tsc`
 * rather than fall through to a missing glyph.
 * ⛔ THE ORDER HERE IS THE `RESOLUTION_BLOCKS` ORDER, not alphabetical, so the
 * two literals read side by side.
 */
const FLAVOUR_NAMES = [
	"Petition",
	"Sentiment",
	"Innovation",
	"Feedback",
	"Showcase",
	"Callout",
] as const;

export type FlavourName = (typeof FLAVOUR_NAMES)[number];

/**
 * A FLAVOUR block is an ordinary entry whose `line1` is narrowed to the closed
 * taxonomy above. Narrowing the FIELD rather than introducing a parallel
 * `flavourKey` is deliberate: the string a participant reads and the key the
 * glyph map is looked up by are the SAME value, so they cannot drift.
 */
export type FlavourBlockEntry = ResolutionBlockEntry & { line1: FlavourName };

export type ResolutionBlockSet = {
	resolution: ResolutionBlockEntry;
	resolver: ResolutionBlockEntry;
	closes: ResolutionBlockEntry;
	flavour: FlavourBlockEntry;
};

const KNOWN_SLUGS = [
	"chess-fide-tiebreak-response",
	"bitcoin-price-50k",
	"math-erdos-solved-on-zugzwang",
	"claude-bundle-response",
	"yc-w27-acceptance",
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

export const RESOLUTION_BLOCKS: Record<KnownMarketSlug, ResolutionBlockSet> = {
	"chess-fide-tiebreak-response": {
		resolution: {
			line1: "Response on X",
			line2: null,
			href: null,
			fontSize: 13,
		},
		resolver: {
			// ⚠⚠ D-50 — THE RESOLVER IS A PERSON NOW, NOT AN ORGANISATION, AND
			// THAT IS THE WHOLE OF v3.0's CHANGE HERE. @FIDE_chess could speak
			// for FIDE and still not resolve this market; the v3.0 criterion
			// binds to Viswanathan Anand in person, "whatever office he holds
			// or ceases to hold during the window, including after the FIDE
			// presidential election of 26 September 2026", and says in terms
			// that a post by @FIDE_chess does not count "even one that speaks
			// for him". So this chip is not a relabelled institution — do not
			// "restore" the federation account beside it.
			// ⛔⛔ THE ONLY ENTRY IN THIS MAP AT THE 11px HARD FLOOR. Fifteen
			// characters do not fit 90.664px at any size above it — 95.01px at
			// 12 — and 11 clears the column by 3.57px, so nothing truncates.
			// Measured 2026-09-18 the way every other size here was: a clone of
			// the live value span at `width:max-content`, real Geist 400, on the
			// deployed build (canary asserted), with BLOCK-4's own four
			// published headroom figures reproduced first as a positive control.
			line1: "@vishy64theking",
			line2: null,
			href: "https://x.com/vishy64theking",
			fontSize: 11,
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
	"math-erdos-solved-on-zugzwang": {
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
		// ⛔⛔ D-50 REVERSES THE PREMISE OF BLOCK-2's RULING HERE, AND THE OLD
		// TEXT IS REPLACED RATHER THAN LEFT STANDING (§8 O-5). It read: "the
		// live criterion qualifies three accounts (@AnthropicAI, @claudeai,
		// @ClaudeDevs) — @security-auditor flagged that showing only one here
		// could read as excluding the other two. Ruled: this chip stays a
		// single named pointer, not an exhaustive citation of the criterion."
		// ⚠ THE RULING'S OUTCOME SURVIVES AND ITS REASON DOES NOT. v3.0 §3
		// makes @ClaudeDevs the SOLE resolver — "Posts by @claudeai,
		// @AnthropicAI or any other account do not count" — so a single named
		// pointer is now the exhaustive citation, and the auditor's worry
		// (that one name under-reports a three-account criterion) has no
		// subject left. Still do not add a second account: there is one, and
		// naming another would now contradict the criterion rather than
		// merely abbreviate it.
		resolver: {
			line1: "@ClaudeDevs",
			line2: null,
			href: "https://x.com/ClaudeDevs",
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
	"yc-w27-acceptance": {
		// ⛔⛔ D-50 — THE FIRST MARKET ON THE ROSTER THAT IS NOT SETTLED BY
		// WATCHING AN X ACCOUNT, WHICH IS WHY BOTH VALUES MOVE TOGETHER.
		// v3.0 replaces "reply to Zugzwang's pitch" with acceptance into YC's
		// Winter 2027 batch, and the thing READ to settle it is YC's written
		// decision to the applicant (§2) — a document, not a post. So
		// RESOLUTION is "YC decision" under BLOCK-3 v1.1's definition (the
		// thing read, not the surface), and RESOLVER is the institution that
		// issues it. ⚠ The href is the APPLICATION page rather than an X
		// profile: it is the page v3.0 §3 cites by name and date for YC's own
		// timing statement ("ycombinator.com/apply, read 18 September 2026"),
		// so it is the one URL a reader can check the criterion against.
		// ⚠ `Response on X` here would now be simply false, and this is the
		// one market where the two RESOLUTION-value tests in
		// `resolution-block-data.test.ts` had to change shape rather than
		// re-key: it left the four-account-watching set and joins neither of
		// the other two, so it is pinned on its own.
		resolution: {
			line1: "YC decision",
			line2: null,
			href: null,
			fontSize: 14,
		},
		resolver: {
			line1: "Y Combinator",
			line2: null,
			href: "https://www.ycombinator.com/apply",
			fontSize: 14,
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
				"BLOCK-1 ships a static, per-slug map for exactly the six known " +
				"markets — add an entry to RESOLUTION_BLOCKS before this market can " +
				"render its resolution row.",
		);
	}
	return RESOLUTION_BLOCKS[slug];
}
