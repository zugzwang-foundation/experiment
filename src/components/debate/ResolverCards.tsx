import { captureException } from "@sentry/nextjs";

import {
	getResolutionBlocks,
	type ResolutionBlockEntry,
} from "./resolution-block-data";
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
 * ⇒ BLOCK-1 fills the VALUE and SUBVALUE lines for real, for all eight live
 * markets, WITHOUT a migration — the eight markets' resolution data is frozen
 * at pre-registration and never changes during the live window, so it ships
 * as a static, per-slug map (`resolution-block-data.ts`) keyed on
 * `market.slug`, not a new column. `markets` is still 11 columns; nothing
 * about the schema claim above was wrong, only the "and RESO-1 ships no
 * migration, so the values don't land" INFERENCE, which assumed a column was
 * the only route in. A logo asset is still absent — the glyph square stays a
 * plain decorative placeholder, unchanged by this task.
 * ⛔ WHAT DID NOT CHANGE: nothing here PORTS d5's demo copy or invents market
 * content. The eight strings are the operator-ratified resolver register, one
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
	// fix, a market slug with no map entry (a ninth market admin-created
	// during the live window, or any drift between what's served and this
	// task's static map) took the WHOLE `/m/[slug]` route down via the nearest
	// error boundary — unauthenticated, GET-triggerable, repeatably, no
	// participant action required. That is a bigger blast radius than "one
	// row degrades", which is the failure this task's guard (G1) actually
	// exists to prevent. ⇒ Capture once to Sentry (so it is still LOUD to an
	// operator, never a silent regression to the empty bar RF-1 removed) and
	// render nothing for this market's resolution row — the rest of the page,
	// including the market's own bet/comment surface, stays fully functional.
	let blockData: ReturnType<typeof getResolutionBlocks> | null = null;
	try {
		blockData = getResolutionBlocks(market.slug);
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
			// ⚠ `flex-1` IS WHAT MAKES R-8 TRUE. The blocks "absorb the height freed
			// by R-1 and R-2" by GROWING INTO IT rather than by carrying a tuned
			// pixel height: the row takes whatever the question, the meta row and the
			// price bar leave in the band.
			// ⛔⛔ `min-h-[78px]` IS A CONTENT FLOOR, RE-DERIVED AT BLOCK-3 §2 against
			// the recipe THIS task leaves behind (padding `py-1.5` → 12px, hairline
			// border → 2px, glyph 36px, text-stack `gap-1` → 4px). The worst case is
			// a two-line block at the `fontSize` ceiling — `label(~12, unset leading,
			// AGENTS.md §8's ~1.2 default) + gap(4) + value(21, leading-[1.5]×14) +
			// gap(4) + subvalue(21)` ≈ 62px of stack, which already exceeds the 36px
			// glyph, so the glyph never binds for this case. 12 + 2 + 62 = 76,
			// rounded up 2px for the label's approximate (not exact) line-height —
			// `leading-[1.5]` is an exact multiplier for the value/subvalue lines,
			// but the label carries no explicit `leading-*` class, so its real line
			// box needs a browser to pin exactly; this floor errs high rather than
			// risk clipping on that one approximation.
			// ⚠ THE OLD 84px NUMBER WAS RESO-2's, computed against a 48px glyph and
			// `py-2` padding — both superseded here, not merely re-labelled: the
			// square dropped 48→36 (this task, "reduce block height") and the
			// padding 16px→12px total, which is where the bulk of the 84→78
			// reduction comes from, not from any change to the text itself. Real
			// text still sits ABOVE this floor at every size the value line can take
			// (BLOCK-3 §3 — `leading-[1.5]` over an 11–14px range, ≈16.5–21px line
			// box per line), which the floor's own `flex-1`-above-a-floor mechanism
			// absorbs rather than clips (jsdom performs no layout, so this is a
			// browser-measured claim, not a jsdom one).
			// ⛔⛔ THE FLOOR REPLACES A `min-h-0` THAT SILENTLY DISABLED THE WHOLE
			// SCROLL BACKSTOP — restored here after @code-reviewer caught it cut
			// during BLOCK-1's docblock pass; the claim was never falsified, only
			// trimmed by mistake. With `min-h-0` this row's flex base is `0%`, so
			// its hypothetical main size is 0 and the STACK's content minimum is
			// only its fixed children (~76px). `scrollHeight` could then never
			// exceed `clientHeight` above a realistic viewport, making the stack's
			// `overflow-y-auto` DEAD CODE: every shortfall was absorbed by this row
			// shrinking, and each block clipped its own content with no scrollbar
			// anywhere to reach it.
			// ⚠ `mt-4` AND THE SIBLINGS' OWN SIZE ARE WHAT ACTUALLY SHORTEN THE
			// BLOCK. This row is `flex-1` inside a band of fixed height, so its
			// rendered height is WHAT IS LEFT OVER after every fixed sibling in
			// `headzone-stack` — shrinking the square or the padding makes the
			// block's CONTENT emptier within whatever height it's given, never
			// shorter on its own; what actually shortens the row is either this
			// `mt-4` or a fixed sibling claiming more of the band (BLOCK-3 §2 grows
			// two of them on purpose — the `detail` `PriceBar` and the attrs text —
			// specifically to leave less flex-1 leftover for this row; see
			// `MarketHeader.tsx`'s own budget docblock for the current, measured
			// split). The RESO-2-era numbers that used to sit here (111.99 →
			// 95.99px) predate BLOCK-1 and BLOCK-3 both and no longer describe
			// this recipe — removed rather than corrected in place, since nothing
			// in the current recipe corresponds to that measurement anymore.
			// ⚠ THE HEIGHT-CHAIN GUARD CANNOT SEE ANY OF THIS: `debate-height-chain.test.ts`
			// scans `headzone`, `-left`, `-right`, `arena` and `column-scroll`, and
			// this row is not a chain node — which is why the reasoning lives here.
			className="mt-4 grid min-h-[78px] flex-1 grid-cols-4 gap-2"
		>
			{BLOCKS.map((b) => (
				<ResolutionBlock
					key={b.key}
					blockKey={b.key}
					label={b.label}
					entry={blockData[b.key]}
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
 * TODAY, for all eight markets. RESOLUTION, CLOSES and FLAVOUR carry
 * `href: null` — RESOLUTION because the X post it will eventually link to
 * (U-3) is not published yet, CLOSES and FLAVOUR because they're facts, not
 * references, and stay `null` permanently. A block with `href: null` renders
 * exactly as before: a plain, non-focusable `<div>`, no `cursor-pointer`, no
 * hover affordance — looking clickable would promise a destination that
 * isn't there (G8).
 * ⇒ THE RESOLVER LINK IS THE WHOLE BLOCK, NOT THE VALUE TEXT ALONE (RF-3a):
 * one `<a>` wraps the glyph and the full text stack, `target="_blank"
 * rel="noopener noreferrer"`, so the accessible name reads as the label plus
 * the value text ("Resolver @mybmc") with no separate `aria-label` needed —
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
 * (mirroring the label's own `truncate` + the text stack's `min-w-0`): the
 * one entry whose value does not fit even at the `fontSize` floor
 * (`@thomasfbloom`, `math-erdos-contribution-response`) leans on exactly this
 * truncation to degrade, rather than a fifth, smaller size the floor forbids.
 */
function ResolutionBlock({
	blockKey,
	label,
	entry,
}: {
	/** ⚠ THE FIXTURE'S OWN KEY UNION, not `string`. The guards query these blocks
	 * by `data-testid="resolution-block-<key>"`, so a typo here would silently
	 * drift four testids away from four assertions; typed this way it is a
	 * compile error instead (@code-reviewer LOW, accepted). */
	blockKey: (typeof BLOCKS)[number]["key"];
	label: string;
	/** BLOCK-1 — this block's resolved line1/line2/href from the per-slug map. */
	entry: ResolutionBlockEntry;
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
			    `items-center` to look intentional rather than starved. `shrink-0` so a
			    narrow block squeezes the TEXT, never the square. Still `aria-hidden` —
			    decorative, and (BLOCK-1) that is also what keeps it out of the RESOLVER
			    anchor's accessible name; there is no `<img>` here to carry an `alt=""`,
			    so `aria-hidden` is the equivalent that actually applies to a `<span>`. */}
			<span
				aria-hidden="true"
				data-testid={`resolution-block-glyph-${blockKey}`}
				className="aspect-square w-[36px] shrink-0 rounded-[var(--imgr)] bg-n1 [border:var(--hairline)]"
			/>
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
				    `entry.line2` is non-null — no empty span, no zero-height bar, for
				    the five map entries whose second line is genuinely absent. */}
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
