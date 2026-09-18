import { captureException } from "@sentry/nextjs";

import {
	getResolutionBlocks,
	type ResolutionBlockEntry,
} from "./resolution-block-data";
import { getResolutionBlockGlyphs } from "./resolution-block-glyphs";
import type { DebateMarketHeader } from "./types";

/**
 * RESO-1 · R-7 / R-8 / R-12 — the resolution block row: FOUR evenly-placed
 * blocks, rendered from one hardcoded label fixture, geometry unchanged
 * across RESO-1→4 and BLOCK-1.
 *
 * ⚠⚠ THE FILE AND THE EXPORT KEEP THE NAME `ResolverCards`, AND THAT IS A
 * DECISION RATHER THAN AN OVERSIGHT. The name is now narrow — the resolver is
 * one block of four — and a rename would read better here. It would also make
 * `AGENTS.md` §3's component list and `docs/parked.md`'s
 * `HTML-FINISH-MD-PLACEHOLDERS` docket entry stale, in a task explicitly fenced
 * against editing prescriptive docs. Renaming and leaving two documents pointing
 * at a file that no longer exists is worse than a narrow name, so the name stays
 * and the mismatch is FLAGGED in the RESO-1 report for whoever holds the doc
 * lane. If that rename happens, this paragraph is what it should delete.
 *
 * ⚠⚠ ROUND 2 · R2's REVERSAL STILL STANDS AND IS NOT RE-LITIGATED HERE. This
 * component used to `return null` on the OD-2 ruling that empty card chrome
 * reproduces `PD-3-09` / `OD-6`; the founder ruling of 2026-08-16 reversed that
 * and required VISIBLE PLACEHOLDER CHROME. RESO-1 changed the COUNT and the
 * SHAPE of that chrome — two horizontal cards became four vertical blocks.
 *
 * ⛔⛔ BLOCK-1 IS THE FIRST COMMIT WHERE THIS SECTION'S OWN CLAIM STOPS BEING
 * TRUE, AND IT IS CORRECTED HERE RATHER THAN LEFT STANDING (CLAUDE.md §8 O-5).
 * Through RESO-1→4 this read: "the CHROME and the LABELS land and the values
 * do not" — `markets` carries no resolver name, logo, source or X handle, and
 * RESO-1 shipped no migration, so every value stayed an empty placeholder bar.
 * ⇒ BLOCK-1 fills the VALUE and SUBVALUE lines for real, for all six live
 * markets, WITHOUT a migration — the six markets' resolution data is frozen
 * at pre-registration and never changes during the live window, so it ships
 * as a static, per-slug map (`resolution-block-data.ts`) keyed on
 * `market.slug`, not a new column. `markets` is still 11 columns; nothing
 * about the schema claim above was wrong, only the "and RESO-1 ships no
 * migration, so the values don't land" INFERENCE, which assumed a column was
 * the only route in. A logo asset is still absent — the glyph square stays a
 * plain decorative placeholder, unchanged by this task.
 * ⛔ WHAT DID NOT CHANGE: nothing here PORTS d5's demo copy or invents market
 * content. The six strings are the operator-ratified resolver register, one
 * static map entry per market, reviewed the same way any other pre-registered
 * market fact is — the CLAUDE.md §3 refusal this paragraph used to cite was
 * always about INVENTING content, not about a legitimate operator-supplied
 * value reaching the page through a route other than a DB column.
 *
 * ⚠⚠ REVIEW-SURFACE ONLY, AND THE DOCKET'S "FOUR" IS NOT THIS ROW'S FOUR — the
 * coincidence must not be read as agreement. `docs/parked.md`'s
 * `HTML-FINISH-MD-PLACEHOLDERS` is titled "four visible placeholders ship on
 * `/m/[slug]`" and counts placeholder KINDS across the whole surface:
 * market-media, post-image, resolver-card, x-official-card. After RESO-1 the
 * inventory was market-media + post-image + these FOUR resolution blocks — SIX
 * placeholders of THREE kinds; BLOCK-1 removes the resolution blocks from that
 * count entirely (they carry real values now), leaving FIVE placeholders of TWO
 * kinds. The docket text is deliberately NOT edited here (this task is fenced
 * against prescriptive doc edits); the corrected inventory is FLAGGED in the
 * run report so the operator's pre-promote strip list is right.
 */

/**
 * ⛔ ONE FIXTURE OBJECT, as R-7 requires, and it holds LABELS ONLY — unchanged
 * by BLOCK-1. The per-block VALUES live in the separate, per-slug
 * `resolution-block-data.ts` map, keyed by `market.slug`; this array only
 * ever supplies the four constant label strings and their DOM order.
 */
const BLOCKS = [
	{ key: "resolution", label: "Resolution" },
	{ key: "resolver", label: "Resolver" },
	{ key: "closes", label: "Closes on" },
	// ⚠ RESO-2 · CHANGE 5 — `Context` is RETIRED and `Flavour` takes the slot.
	// Still PROVISIONAL as a LABEL, still not a copy-register entry: the RESO-1
	// brief says so in terms, and the same fence applies to these four as to the
	// four they replace. (The per-market FLAVOUR *values* BLOCK-1 fills in ARE
	// ratified register content — only the column header "Flavour" is
	// provisional.)
	{ key: "flavour", label: "Flavour" },
] as const;

export function ResolverCards({
	market,
}: {
	/**
	 * BLOCK-1 reads `market.slug` to look up this market's four resolution
	 * values from the static map. Everything else on `DebateMarketHeader`
	 * stays unread here — this component still renders no market content
	 * beyond what the per-slug map explicitly supplies.
	 */
	market: DebateMarketHeader;
}) {
	// ⛔⛔ CAUGHT HERE, NOT LEFT TO PROPAGATE — a joint @code-reviewer /
	// @security-auditor finding on the first cut of this file, which let
	// `getResolutionBlocks`'s throw reach `MarketHeader` → `DebateView`
	// uncaught. `getResolutionBlocks` ITSELF still throws (unchanged,
	// `resolution-block-data.test.ts`'s G1 still exercises that directly) —
	// the failure mode that changed is what a CALLER does with it. Before this
	// fix, a market slug with no map entry (a seventh market admin-created
	// during the live window, or any drift between what's served and this
	// task's static map) took the WHOLE `/m/[slug]` route down via the nearest
	// error boundary — unauthenticated, GET-triggerable, repeatably, no
	// participant action required. That is a bigger blast radius than "one
	// row degrades", which is the failure this task's guard (G1) actually
	// exists to prevent. ⇒ Capture once to Sentry (so it is still LOUD to an
	// operator, never a silent regression to the empty bar RF-1 removed) and
	// render nothing for this market's resolution row — the rest of the page,
	// including the market's own bet/comment surface, stays fully functional.
	// ⚠ BLOCK-5b — THE GLYPH LOOKUP RIDES THE SAME `try`, ON PURPOSE. It mirrors
	// `getResolutionBlocks`' contract (throws for a slug outside the six), so
	// the degradation above covers both without a second failure mode, and the
	// error the participant's Sentry event carries is still the FIRST thing that
	// went wrong rather than a downstream symptom of it.
	let blockData: ReturnType<typeof getResolutionBlocks> | null = null;
	let glyphs: ReturnType<typeof getResolutionBlockGlyphs> | null = null;
	try {
		blockData = getResolutionBlocks(market.slug);
		glyphs = getResolutionBlockGlyphs(market.slug, blockData.flavour.line1);
	} catch (error) {
		captureException(error);
		return null;
	}
	return (
		<div
			data-testid="resolver-cards"
			// ⚠⚠ `grid-cols-4` UNCONDITIONALLY, not `grid-cols-2 lg:grid-cols-4`.
			// R-7 says four evenly placed across the column and G-3 says one row;
			// a breakpoint that folds them into 2×2 stops satisfying both at exactly
			// the widths where the founder is not looking. Below `lg` the headzone
			// stacks (`HeadZone`'s `lg:flex-row`) and this column becomes FULL-WIDTH,
			// so four across is wider there than it is at 1440, not narrower — the
			// usual reason for folding a grid does not apply.
			//
			// ⛔⛔ BLOCK-4 §2 — `flex-1` AND `mt-4` ARE BOTH GONE, AND R-8 IS
			// REVERSED RATHER THAN RE-TUNED. This block read: "`flex-1` IS WHAT
			// MAKES R-8 TRUE. The blocks absorb the height freed by R-1 and R-2 by
			// GROWING INTO IT rather than by carrying a tuned pixel height." That
			// was accurate and it is now the defect. Because this row was the only
			// `flex-1` child of a band fixed at `basis-[24.2dvh]`, its rendered
			// height was PURE LEFTOVER and had no relationship to its contents —
			// MEASURED on the deployed BLOCK-3 build at `7155cf1`: **122.76px at
			// 1440×900, 92.99px at 1440×777, 166.32px at 1920×1080**, for a block
			// whose content is one label over one line of text. R-8 was written
			// when these blocks were empty placeholder chrome and growing was the
			// point; with real single-line values in them, growing is just a
			// 70px-tall box around 53px of nothing.
			// ⇒ THE ROW IS NOW CONTENT-SIZED. No `flex-1`, so its flex base is
			// `auto` and its height is its tallest block. The band's leftover is no
			// longer absorbed here and shows as empty ground below the row —
			// 39.76px at 1440×900, 9.99px at 1440×777, 83.32px at 1920×1080,
			// founder-ruled at BLOCK-4 §2 in preference to spending it on gaps that
			// would then be a computed number rather than a scale step.
			// ⛔⛔ `min-h-[54px]` IS RE-DERIVED, AND IT IS NOW THE THING THAT
			// RENDERS RATHER THAN A FLOOR NOTHING REACHES. Every `line2` in
			// `resolution-block-data.ts` is `null` (BLOCK-4 §1), so the worst case
			// is a ONE-line block at the `fontSize` ceiling: padding `py-1.5` (12) +
			// hairline border (2) + label (14.25) + text-stack `gap-1` (4) + value
			// (21 = `leading-[1.5]` × 14px) = **53.25px**, browser-measured on a
			// clone free to size itself, not computed. 36px of glyph never binds —
			// the 39.25px text stack already clears it. 53.25 rounds up to 54.
			// ⚠ THE LABEL'S 14.25px IS MEASURED NOW, NOT ESTIMATED. The superseded
			// version of this note called it "~12, unset leading, AGENTS.md §8's
			// ~1.2 default" and added 2px of slack against that guess; the computed
			// `line-height` is exactly 14.25px (9.5 × 1.5, inherited), so the guess
			// was low by 2.25px and the slack was covering a real error rather than
			// rounding. Corrected in place.
			// ⚠ AND THE FLOOR IS WHAT MAKES §2's UNIFORMITY EXACT. A block's
			// natural height tracks its OWN `fontSize` — 53.25px at 14, 51.75 at
			// 13, 50.25 at 12 — so content alone would give the markets three
			// different row heights. The grid's default `align-items: stretch`
			// levels the four blocks within a market to the tallest, and this floor,
			// sitting 0.75px ABOVE even the 14px case, levels the markets to
			// each other: **54px on every block, every market, every viewport.**
			// ⚠ THE OLD NUMBERS, AND WHY THEY DO NOT TRANSFER: 84px was RESO-2's
			// (48px glyph, `py-2`); 78px was BLOCK-3's (36px glyph, `py-1.5`, but
			// sized for a TWO-line worst case that no longer exists). Both are
			// superseded by content, not merely re-labelled.
			// ⛔⛔ THE SCROLL BACKSTOP SURVIVES, BY A DIFFERENT MECHANISM, AND THE
			// OLD REASONING FOR IT NO LONGER APPLIES. It used to read: with
			// `min-h-0` this row's flex base is `0%`, its hypothetical main size is
			// 0, so `scrollHeight` could never exceed `clientHeight` and the stack's
			// `overflow-y-auto` was DEAD CODE. True while this row was `flex-1`;
			// meaningless now that it is not. Without `flex-1` the row's automatic
			// minimum size IS its content, so it cannot be squeezed at all — the
			// stack overflows and scrolls the moment the band is shorter than
			// 178.04px of fixed content and gaps (below roughly 736px of viewport
			// height at the BLOCK-4 recipe). The backstop is stronger than before,
			// not weaker: nothing in this row can now absorb a shortfall by
			// clipping itself in silence.
			// ⚠ THE HEIGHT-CHAIN GUARD CANNOT SEE ANY OF THIS: `debate-height-chain.test.ts`
			// scans `headzone`, `-left`, `-right`, `arena` and `column-scroll`, and
			// this row is not a chain node — which is why the reasoning lives here.
			className="grid min-h-[54px] grid-cols-4 gap-2"
		>
			{BLOCKS.map((b) => (
				<ResolutionBlock
					key={b.key}
					blockKey={b.key}
					label={b.label}
					entry={blockData[b.key]}
					glyph={glyphs[b.key]}
				/>
			))}
		</div>
	);
}

/** Box styling shared by every block regardless of interactivity.
 * ⚠⚠ BLOCK-3 §2 — `py-2` → `py-1.5` (8px → 6px per side, −4px total vertical).
 * `px-[11px]` is DELIBERATELY UNCHANGED: it is one of the three dimensions
 * (with the glyph width and the glyph-to-text gap) that set the value/subvalue
 * text COLUMN width BLOCK-3 §3's `fontSize` measurements were taken against —
 * moving it would invalidate every measured size in `resolution-block-data.ts`
 * without a re-measurement pass. Only the vertical padding (which §3 never
 * touched) is in scope here. `rounded-(--r)` and the hairline are unchanged
 * from RESO-4. */
const BLOCK_BOX = "rounded-(--r) px-[11px] py-1.5 [border:var(--hairline)]";

/** The flex arrangement of a block's contents (glyph + text stack) —
 * unchanged from RESO-3 · CHANGE 7, just factored out so the same classes
 * apply whether the block renders as a `<div>` or, for RESOLVER, as an `<a>`
 * (RF-3a: one anchor wraps the block's whole contents, never just the value
 * text — see the `ResolutionBlock` docblock below). */
const BLOCK_INNER = "flex min-h-0 min-w-0 items-center gap-2.5";

/**
 * BLOCK-3 §3 — one literal Tailwind class per size in
 * `ResolutionBlockEntry["fontSize"]`. This has to be a lookup over literal
 * strings, not `text-[${entry.fontSize}px]` built at render time: Tailwind's
 * scanner only emits CSS for class names that appear literally somewhere in
 * source, so an interpolated class compiles to nothing. `leading-[1.5]` is a
 * bare unitless multiplier and already scales with whichever size lands, so
 * it needs no matching lookup.
 */
const VALUE_TEXT_SIZE: Record<ResolutionBlockEntry["fontSize"], string> = {
	11: "text-[11px]",
	12: "text-[12px]",
	13: "text-[13px]",
	14: "text-[14px]",
};

/**
 * BLOCK-1 · RF-3a — the shipped whole-element link/focus-visible recipe,
 * ORIGINALLY reused byte-for-byte from `GitHubStarsView`'s `GITHUB_TAB`
 * (`src/components/shell/GitHubStars.tsx:62`), itself the same pairing
 * `HeaderNav.tsx` and `ui/button.tsx` use: `outline-none` paired with
 * `focus-visible:shadow-(--state-focus-ring)`, plus the repo's standard
 * hover/active pair.
 *
 * ⚠⚠ BLOCK-3 §2 — THE FOCUS RING NO LONGER MATCHES THAT RECIPE, AND THE
 * DIVERGENCE IS THE FIX. `--state-focus-ring` (`0 0 0 2px rgb(255 255 255 /
 * 0.32)`) is a non-inset `box-shadow`: zero blur, a 2px spread, which paints
 * OUTSIDE the element's own border-box. That is invisible where every other
 * consumer of the token sits (header controls, buttons, inputs, none of them
 * inside a clipping ancestor) but this block lives inside
 * `headzone-stack` (`MarketHeader.tsx`), which carries `overflow-y-auto` — and
 * per the CSS overflow spec, setting ONE axis to anything but `visible` while
 * leaving the other at its `visible` default computes THAT axis to `auto` too,
 * so the stack clips on both X and Y. A ring painted 2px outside the block's
 * own box, at the row that sits flush against the stack's inner edges, was
 * measured clipped — confirmed by tabbing to a RESOLVER block and reading the
 * rendered ring against the stack's own bounding box.
 * ⇒ THE FIX: `focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]` — an INSET
 * shadow of the same 2px spread, reusing the existing `--ring` colour token
 * this component's OWN hover state already borrows for its border
 * (`hover:[border:1px_solid_var(--ring)]`, unchanged below), so hover and
 * focus-visible read as the same colour on this block, just two different
 * mechanisms. An inset shadow draws INSIDE the border-box by construction —
 * it has no dependency on any ancestor's `overflow` value, today or after a
 * future layout change, which is what "reserve its space inside the block's
 * own box" means as a fix rather than as a description of the symptom. No new
 * hex or token: `--ring` and the 2px spread both already ship on this exact
 * component.
 */
const LINK_AFFORDANCE =
	"outline-none [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]";

/**
 * One block — a 1:1 placeholder on the LEFT, and a label plus up to two real
 * value lines stacked to its right.
 *
 * ⛔⛔ R-12 — NON-INTERACTIVE FOR THREE OF FOUR BLOCKS, AND THAT HALF HAS NOT
 * REVERSED. Through RESO-1→4 this read "NON-INTERACTIVE, BY CONSTRUCTION AND
 * NOT BY OMISSION... hyperlinking is deferred by founder ruling and the X
 * posts these would target do not exist yet." BLOCK-1 · RF-3a/RF-2 reverses
 * that for the RESOLVER block ONLY: RESOLVER's authoritative source (an X
 * account, or the institution's own site/data page) exists and is linkable
 * TODAY, for all six markets. RESOLUTION, CLOSES and FLAVOUR carry
 * `href: null` — RESOLUTION because the X post it will eventually link to
 * (U-3) is not published yet, CLOSES and FLAVOUR because they're facts, not
 * references, and stay `null` permanently. A block with `href: null` renders
 * exactly as before: a plain, non-focusable `<div>`, no `cursor-pointer`, no
 * hover affordance — looking clickable would promise a destination that
 * isn't there (G8).
 * ⇒ THE RESOLVER LINK IS THE WHOLE BLOCK, NOT THE VALUE TEXT ALONE (RF-3a):
 * one `<a>` wraps the glyph and the full text stack, `target="_blank"
 * rel="noopener noreferrer"`, so the accessible name reads as the label plus
 * the value text ("Resolver @vishy64theking") with no separate `aria-label`
 * needed —
 * the glyph stays `aria-hidden`, contributing nothing to it. The seam for
 * wiring RESOLUTION's href later (once Zugzwang's own resolution posts
 * publish, per U-3) is exactly this same mechanism: one value per market in
 * the map, zero changes here — this component never special-cases a block by
 * its `blockKey`, only by whether `entry.href` is `null`.
 *
 * ⚠ TOKENS AND SHIPPED RECIPES ONLY — no new hex or radius enters, which
 * `tokens-monochrome.test.ts` enforces on an 11-token census. The square
 * reuses the `bg-n1` + hairline + `--imgr` recipe already shipping in
 * `MarketMediaPanel`; the label reuses the `.overline` recipe, unchanged and
 * still fixed at `text-[9.5px] text-n4` — v1.1 re-ranks the VALUE against the
 * label, never the label itself.
 * ⚠⚠ BLOCK-3 §3 — VALUE/SUBVALUE LEFT THE ONE SHARED FIXED RECIPE. Through
 * BLOCK-1/2 both lines carried one hardcoded class string
 * (`text-[11px] leading-[1.5] text-muted-foreground`, borrowed from
 * `ResolutionCriterion.tsx` / `CriterionDisclosure.tsx`). MKT-SLATE v1.1
 * moves the size to `VALUE_TEXT_SIZE[entry.fontSize]` — one of four literal
 * classes, chosen per block from that block's own measured `fontSize` (see
 * `resolution-block-data.ts`'s docblock on that field for the fit
 * methodology) — and the colour to `text-ink` (the founder's instruction:
 * "Values move from `text-muted-foreground` to full ink"). `leading-[1.5]`
 * stays a bare unitless multiplier, so it scales with whichever literal size
 * lands without a second lookup. `truncate` still applies to both lines
 * (mirroring the label's own `truncate` + the text stack's `min-w-0`).
 * ⚠ THE JUSTIFICATION THAT USED TO FOLLOW THAT SENTENCE IS FALSE AND IS
 * CORRECTED HERE. It read: "the one entry whose value does not fit even at the
 * `fontSize` floor (`@thomasfbloom`, `math-erdos-contribution-response`) leans
 * on exactly this truncation to degrade." That was true of BLOCK-3's FIRST
 * fitting pass, against a 79px column; BLOCK-3's own second pass widened the
 * column to 91px and moved that entry to 12px with room to spare, and updated
 * `resolution-block-data.ts` while leaving this copy of the claim behind.
 * ⇒ NOTHING IN THE SHIPPED MAP TRUNCATES. Re-measured at BLOCK-4 §4 across all
 * twenty values at 1440×900: the tightest is that same `@thomasfbloom` at 12px,
 * and it clears the column by 0.37px. `truncate` is therefore a pure BACKSTOP —
 * it ships unconditionally on every value and subvalue, so a future map entry
 * with a longer string degrades to an ellipsis instead of overflowing the
 * block.
 * ⛔⛔ D-50 — THE CLAUSE THAT USED TO END THAT SENTENCE ("and so the 11px floor
 * never has to be broken by a fifth, smaller size") IS NOW HALF WRONG AND IS
 * REPLACED RATHER THAN LEFT (§8 O-5). The floor still does not have to be
 * BROKEN — but it is now OCCUPIED: `@vishy64theking` fits at 11 and at no size
 * above it. ⚠ That entry is still not a truncating one — 3.57px of headroom —
 * so "nothing in the shipped map truncates" holds, and the backstop stays a
 * backstop. ⚠ The slug named above is `math-erdos-solved-on-zugzwang` since
 * D-50; the OLD name is left inside the quotation because the quotation is of
 * a sentence that was written when that was the slug, and editing a quote to
 * agree with the present makes it evidence of nothing.
 * A guard that asserts nothing currently truncates and a class that handles it
 * if something ever does are both correct at once; only the claim that
 * something DOES truncate today was wrong.
 */
function ResolutionBlock({
	blockKey,
	label,
	entry,
	glyph,
}: {
	/** ⚠ THE FIXTURE'S OWN KEY UNION, not `string`. The guards query these blocks
	 * by `data-testid="resolution-block-<key>"`, so a typo here would silently
	 * drift four testids away from four assertions; typed this way it is a
	 * compile error instead (@code-reviewer LOW, accepted). */
	blockKey: (typeof BLOCKS)[number]["key"];
	label: string;
	/** BLOCK-1 — this block's resolved line1/line2/href from the per-slug map. */
	entry: ResolutionBlockEntry;
	/** BLOCK-5b — this block's glyph asset path, already resolved against
	 * `/brand/blocks` by `getResolutionBlockGlyphs`. Required, never optional:
	 * an optional path would let a missing map entry render the empty span
	 * again, which is exactly the state this task replaces and which nobody
	 * would notice had come back (CLAUDE.md §8 O-1 — structural beats
	 * procedural). */
	glyph: string;
}) {
	const content = (
		<>
			{/* ⛔⛔ THE SQUARE IS BY DECLARATION, NEVER DERIVED — `aspect-square` plus
			    EXACTLY ONE length, never `self-stretch` beside it; see RESO-4's history
			    for why deriving the width from the row's height once clipped every
			    label. That mechanism is unchanged; the LENGTH is not.
			    ⚠⚠ BLOCK-3 §2 — 48px (RESO-4) → 36px. Part of "reduce block height":
			    for every block whose text stack is ONE line (label + one value line,
			    ≤ ~39px tall at the tallest measured `fontSize`), the square was the
			    height driver, not the text — shrinking it lowers those blocks' natural
			    content height directly. Two-line blocks (label + value + subvalue,
			    ≤ ~64px) were already text-bound before this change and stay text-bound
			    after it; 36px still clears the label alone (14.25px) with room for
			    `items-center` to look intentional rather than starved.
			    ⚠⚠ BLOCK-3 §2 · A SECOND FIX, FOUND BY MEASURING §1's ROW WIDTH AGAINST
			    REAL §3 CONTENT RATHER THAN AGAINST EMPTY PLACEHOLDER BARS — `hidden
			    sm:block` IS NEW. `grid-cols-4` (R-7, unconditional) divides whatever
			    width `headzone-stack` gets, and below `lg` that width is `2/3` of the
			    reading column (`MarketMediaPanel.tsx`'s `w-1/3`) — 206.67px at
			    1440-pinned 390-WIDE measurement (the iframe measures the actual
			    viewport, not a literal 390 in a 1440 shell), 45.67px per block. A
			    36px glyph plus `px-[11px]` padding (22px) is 58px — MORE than the
			    45.67px block has BEFORE the text gets anything — and `shrink-0`
			    (kept, see below) forces the square to take its 36px regardless,
			    driving the text stack's available width to exactly 0. MEASURED: every
			    value and every label read `scrollWidth > clientWidth` — not merely
			    truncated, invisible, at 390×844. `hidden sm:block` removes the square
			    below the 640px breakpoint where this stops being survivable, giving
			    the text stack the block's FULL content width instead of block-minus-58.
			    ⚠ THE CLAIM ONE PARAGRAPH UP — "shrink-0 so a narrow block squeezes the
			    TEXT, never the square" — is now true only AT OR ABOVE `sm`; below it,
			    the square is the thing that gives, which is the correction this
			    paragraph exists to make rather than leave standing next to code that
			    contradicts it. Still `aria-hidden` — decorative, and (BLOCK-1) that is
			    also what keeps it out of the RESOLVER anchor's accessible name; there
			    is no `<img>` here to carry an `alt=""`, so `aria-hidden` is the
			    equivalent that actually applies to a `<span>`. */}
			<span
				aria-hidden="true"
				data-testid={`resolution-block-glyph-${blockKey}`}
				className="hidden aspect-square w-[36px] shrink-0 overflow-hidden rounded-[var(--imgr)] bg-n1 [border:var(--hairline)] sm:block"
			>
				{/* ⛔⛔ BLOCK-5b — `bg-n1` ON THE SPAN ABOVE IS NOW LOAD-BEARING, NOT A
				    FALLBACK. The asset is a TRANSPARENT png — flat `#FAFAFA` ink carried
				    entirely by an alpha channel — so the span's own background IS the
				    plate the mark composites onto. Delete `bg-n1` and the mark renders on
				    whatever happens to sit behind the block. The sources shipped with a
				    baked plate instead, measured per file at `#232323`–`#2E2E2E` against
				    the `#2A2A2A` this span paints, and eight of the thirteen that then
				    shipped read as a
				    visible square inside the block's own frame; keying the plate out is
				    what dissolved that rather than papering over it, and it is why there
				    is no second copy of the colour left to drift.
				    ⚠⚠ `overflow-hidden` IS THE RADIUS FIX AND IT IS ON THE SPAN, NOT THE
				    IMAGE. The span is `rounded-[var(--imgr)]` (6px) and `border-box` with
				    a 1px hairline, so its padding box is 34x34 with a 5px inner radius. A
				    square-cornered child would poke through all four corners. Clipping at
				    the parent is correct where a matching `rounded-` on the child is only
				    approximately correct: the child would need `calc(6px - 1px)` to agree,
				    and would silently disagree again the moment the border or `--imgr`
				    moves. Verified against the paint, not the class list.
				    ⚠ `object-contain`, not `cover`. Asset and box are both square today so
				    the two are identical — `contain` is chosen for the case where they
				    are not, because cropping a MARK loses meaning while letterboxing it
				    only loses size.
				    ⚠ DECORATIVE TWICE OVER, DELIBERATELY. `aria-hidden` stays on the span
				    (BLOCK-1 put it there so the glyph contributes nothing to the RESOLVER
				    anchor's accessible name, which reads "Resolver @vishy64theking"
				    off the label and value beside it) AND the image carries `alt=""`. The span's
				    attribute is what actually removes it from the tree today; `alt=""` is
				    the per-element declaration that keeps it decorative if the span's ever
				    goes. Neither is redundant with the other — one is a subtree removal,
				    the other is this element's own contract.
				    ⚠ `hidden sm:block` on the span is UNTOUCHED, so nothing here renders
				    below 640px — the image is inside a `display:none` parent and is never
				    laid out or fetched. Desktop only, as before. */}
				{/* biome-ignore lint/performance/noImgElement: a build-time-constant 512px static glyph rendered at 36px — it must stay crisp at 3x DPR (108px), which the optimizer's fixed-size 1x/2x srcset would not deliver, and per-request optimization buys nothing for an immutable asset already sized and losslessly compressed at build time. */}
				<img
					src={glyph}
					alt=""
					data-testid={`resolution-block-glyph-img-${blockKey}`}
					className="h-full w-full object-contain"
				/>
			</span>
			{/* The right-hand stack, centred as a GROUP against the square rather than
			    each line centring itself.
			    ⚠ `min-w-0` IS LOAD-BEARING: without it this flex item's automatic
			    minimum size is its CONTENT, so a long label or value would refuse to
			    shrink and would push the square out of the block instead of truncating.
			    ⛔ RESO-2 · CHANGE 5 IS PRESERVED, NOT REDONE — the label is still the
			    first thing read. */}
			<span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
				<span
					data-testid={`resolution-block-label-${blockKey}`}
					className="truncate text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase"
				>
					{label}
				</span>
				{/* ⛔⛔ REAL CONTENT NOW, AND THAT IS BLOCK-1'S WHOLE POINT. Through
				    RESO-1→4 both lines were empty, `aria-hidden` placeholder bars —
				    "an empty announced row is noise while the label beside it already
				    names the slot." Neither claim holds once there's a value to
				    announce: `aria-hidden` is DROPPED (this is now real, readable
				    content, not noise), and the subvalue line renders only when
				    `entry.line2` is non-null — no empty span, no zero-height bar.
				    ⚠⚠ BLOCK-4 §1 — THAT CONDITION IS NOW FALSE FOR EVERY SHIPPED
				    ENTRY, NOT FIVE OF THEM. This read "for the five map entries whose
				    second line is genuinely absent"; `line2` is `null` on all
				    twenty-four (six markets × four blocks), so this branch never runs
				    against production data and the count is retired rather than
				    re-typed.
				    ⛔ IT IS NOT DEAD CODE, AND DELETING IT WOULD COST A FUTURE TASK
				    THE SEAM. `resolution-block-data.ts` keeps `line2` nullable
				    precisely so RESOLUTION can gain a second line when Zugzwang's own
				    stimulus posts publish (U-3), with zero changes in this file. What
				    holds the branch honest meanwhile is a SYNTHETIC fixture rather
				    than a real market — `resolver-cards.test.tsx`'s
				    "a-SYNTHETIC-two-line-entry-still-renders-BOTH-lines" mocks the map
				    with a two-line entry and asserts both spans render. That test is
				    the only thing standing between this branch and rot. */}
				<span
					data-testid={`resolution-block-value-${blockKey}`}
					className={`block w-full truncate leading-[1.5] text-ink ${VALUE_TEXT_SIZE[entry.fontSize]}`}
				>
					{entry.line1}
				</span>
				{entry.line2 !== null && (
					<span
						data-testid={`resolution-block-subvalue-${blockKey}`}
						className={`block w-full truncate leading-[1.5] text-ink ${VALUE_TEXT_SIZE[entry.fontSize]}`}
					>
						{entry.line2}
					</span>
				)}
			</span>
		</>
	);

	if (entry.href !== null) {
		return (
			<a
				href={entry.href}
				target="_blank"
				rel="noopener noreferrer"
				data-testid={`resolution-block-${blockKey}`}
				className={`${BLOCK_BOX} ${BLOCK_INNER} ${LINK_AFFORDANCE}`}
			>
				{content}
			</a>
		);
	}

	return (
		<div
			data-testid={`resolution-block-${blockKey}`}
			className={`${BLOCK_BOX} ${BLOCK_INNER}`}
		>
			{content}
		</div>
	);
}
