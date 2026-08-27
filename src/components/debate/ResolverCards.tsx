import type { DebateMarketHeader } from "./types";

/**
 * RESO-1 · R-7 / R-8 / R-12 — the resolution block row: FOUR evenly-placed
 * blocks, rendered from one hardcoded fixture, carrying no data and no
 * affordance.
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
 * and required VISIBLE PLACEHOLDER CHROME. RESO-1 changes the COUNT and the
 * SHAPE of that chrome — two horizontal cards become four vertical blocks — and
 * changes nothing about whether it renders.
 *
 * ⛔⛔ THE DATA FIELDS ARE STILL EMPTY, AND THIS IS THE HALF THAT HAS NEVER
 * REVERSED THROUGH THREE RULINGS. `markets` carries `id · slug · title ·
 * description · status · resolution_deadline · resolved_at ·
 * resolution_outcome · media_video_url · created_by · created_at` and NOTHING
 * ELSE — no resolver name, no logo, no source, no X handle — and RESO-1 ships no
 * migration. So the CHROME and the LABELS land and the values do not. A future
 * commit that "finishes" these by porting d5's demo copy ("Brihanmumbai
 * Municipal Corporation", "Monthly operational bulletins", "BMC", "@mybmc")
 * would be inventing MARKET CONTENT, which CLAUDE.md §3 refuses outright; so
 * would writing a settlement date into `Closes`, because settlement dates are
 * Hrishikesh's. Those four strings are pinned as absent by
 * `resolver-cards.test.tsx`.
 *
 * ⛔ THE FOUR LABELS ARE PROVISIONAL AND ARE NOT CANON. The RESO-1 brief says so
 * in terms: "The fixture strings at R-7 are PROVISIONAL and are not copy-register
 * entries. Do not add them to any register." They exist so the geometry has
 * something label-shaped in it to be measured against; the content pass replaces
 * them. ⇒ Do not cite this array as a source for copy anywhere.
 *
 * ⚠⚠ REVIEW-SURFACE ONLY, AND THE DOCKET'S "FOUR" IS NOT THIS ROW'S FOUR — the
 * coincidence must not be read as agreement. `docs/parked.md`'s
 * `HTML-FINISH-MD-PLACEHOLDERS` is titled "four visible placeholders ship on
 * `/m/[slug]`" and counts placeholder KINDS across the whole surface:
 * market-media, post-image, resolver-card, x-official-card. After RESO-1 the true
 * inventory is market-media + post-image + these FOUR resolution blocks — SIX
 * placeholders of THREE kinds. The docket text is therefore stale and is
 * deliberately NOT edited here (RESO-1 is fenced against prescriptive doc edits);
 * the corrected inventory is FLAGGED in the run report so the operator's
 * pre-promote strip list is right.
 * ⇒ THE DOCKET'S INSTRUCTION IS UNCHANGED and now covers six things rather than
 * four: strip or gate every placeholder on this surface before the DP.2
 * production promote. The `PD-3-09` objection was never WRONG about what these
 * are — a build-time note about unbuilt work — it is outranked for the review
 * surface and must not survive to a real participant.
 */

/**
 * ⛔ ONE FIXTURE OBJECT, as R-7 requires, and it holds LABELS ONLY.
 *
 * There is deliberately no `value` field. R-7 asks each block for "a label line,
 * a value line", and the value line ships as an EMPTY placeholder bar — the same
 * treatment the two-card version used — because every candidate value is either
 * a column that does not exist (`Resolver`, `Context`) or market content this
 * repo refuses to invent (`Closes` is a settlement date, CLAUDE.md §3). Adding
 * the field with empty strings in it would suggest the values are merely
 * missing, when in fact three of the four are foreclosed.
 */
const BLOCKS = [
	{ key: "resolution", label: "Resolution" },
	{ key: "resolver", label: "Resolver" },
	{ key: "closes", label: "Closes" },
	{ key: "context", label: "Context" },
] as const;

export function ResolverCards({
	market,
}: {
	/**
	 * Accepted so the slot's data dependency is DECLARED at the boundary rather
	 * than discovered later. Nothing on `DebateMarketHeader` can populate a block
	 * today — that is the point, and the type is what will make it a compile-time
	 * question the day a column exists.
	 */
	market: DebateMarketHeader;
}) {
	// Deliberately unread until the schema carries resolver data (F-6 / OD-2).
	void market;
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
			// price bar leave in the band. That is why removing a row of criterion
			// text makes these taller with no number changing anywhere.
			// ⛔ A LITERAL HEIGHT WAS THE OBVIOUS ALTERNATIVE AND IT IS WRONG: the
			// freed height is not a constant. It moved once already at RESO-1 (the
			// criterion block measured 63.25px for a two-line clamp) and it moves
			// again with the band, which is a viewport FRACTION (`basis-[24.2dvh]`),
			// not a fixed 188px. A tuned literal is correct at exactly one viewport.
			// ⛔⛔ `min-h-[97px]` IS A CONTENT FLOOR AND IT REPLACES A `min-h-0` THAT
			// SILENTLY DISABLED THE WHOLE SCROLL BACKSTOP. Caught by `@code-reviewer`;
			// the arithmetic is worth keeping because the failure was invisible.
			// With `min-h-0`, this row's flex base is `0%` and its hypothetical main
			// size is 0 — so the STACK's content minimum was only its fixed children
			// (h1 26.04 + merged row 20 + bar 15 + 3×5 gaps = 76px). `scrollHeight`
			// could then never exceed `clientHeight` above a ~314px viewport, which
			// makes the stack's `overflow-y-auto` DEAD CODE: every shortfall was
			// absorbed by this row shrinking, and each block clipped its own content
			// with no scrollbar anywhere to reach it. The band's 13.51px spill would
			// have gone to zero BY CLIPPING rather than by fitting — which the height
			// chain's own guard calls out in terms: "a fixed height does not make
			// content fit — it CLIPS it, and clipping to hit a number is a failure,
			// not a pass."
			// ⚠ 97 IS MEASURED, NOT ESTIMATED. A block's intrinsic content on the
			// deployed preview at `5b48120`: padding 18 + square 44 + gap 8 + text
			// group 26.25 (label 14.25 + gap 1 + value 11) = **96.25px**, rounded up
			// to the next whole pixel. At the floor nothing clips; below it the STACK
			// scrolls, which is where the overflow was always supposed to go.
			// ⇒ CONSEQUENCE, STATED: below a viewport height of about 715px the
			// header stack scrolls instead of compressing. That is the ruled
			// behaviour for this surface — the page never scrolls, regions do.
			// ⚠ THE HEIGHT-CHAIN GUARD CANNOT SEE ANY OF THIS: it scans `headzone`,
			// `-left`, `-right`, `arena` and `column-scroll`, and this row is not a
			// chain node. That is why the reasoning lives here.
			// ⚠ `flex-1` still does the growing above the floor; grid items stretch by
			// default, so equal height across the four is a property of the grid and
			// not something each block declares.
			className="grid min-h-[97px] flex-1 grid-cols-4 gap-2"
		>
			{BLOCKS.map((b) => (
				<ResolutionBlock key={b.key} blockKey={b.key} label={b.label} />
			))}
		</div>
	);
}

/**
 * One block — a 1:1 placeholder, a label line, an empty value line.
 *
 * ⚠⚠ VERTICAL, WHERE THE TWO-CARD VERSION WAS HORIZONTAL. That card was a row
 * (`flex items-center`) with a 30px glyph beside its text, and it measured
 * 56.3px. R-8 requires the height to INCREASE and the blocks to absorb what R-1
 * and R-2 freed; a row absorbs height only by inflating its glyph, while a
 * column absorbs it in the gaps between three stacked elements, which is what
 * "block" rather than "card" describes.
 *
 * ⛔ THE 1:1 PLACEHOLDER IS EMPTY, AND THE BYTE-CARRIED `LOGO` GLYPH IS
 * DELIBERATELY NOT REUSED HERE. The two-card version put d5's `LOGO` (`d5:988`)
 * and `X` (`:996`) inside the square, which was right when the two slots WERE a
 * logo and an X mark. Four blocks are not: `Closes` takes a date and `Context`
 * takes neither, so stamping `LOGO` on all four would assert a treatment for
 * three slots that nobody has ruled. R-7 asks for a "logo/icon placeholder" and
 * an empty square is exactly that — it claims the space without claiming what
 * goes in it.
 *
 * ⛔⛔ R-12 — NON-INTERACTIVE, BY CONSTRUCTION AND NOT BY OMISSION. A `<div>`,
 * no `href`, no `onClick`, no `cursor-pointer`, and no hover affordance. The
 * blocks must not LOOK clickable either, because nothing happens if they are
 * clicked: hyperlinking is deferred by founder ruling and the X posts these
 * would target do not exist yet (the Zugzwang X account has not been created).
 * A hover underline or a pointer cursor here would promise a destination that
 * cannot be built.
 *
 * ⚠ TOKENS AND SHIPPED RECIPES ONLY — no new hex, type size or radius enters,
 * which `tokens-monochrome.test.ts` enforces on an 11-token census. The square
 * reuses the `bg-n1` + hairline + `--imgr` recipe already shipping in
 * `MarketMediaPanel` (byte-carried from `discovery/MarketCard.tsx`); the label
 * reuses the `.overline` recipe this surface shipped for its own RESOLUTION
 * label before R-1 removed it, so the recipe outlives the element it was minted
 * for; the value bar reuses the two-card version's own `bg-n1` + `--r-dot`.
 */
function ResolutionBlock({
	blockKey,
	label,
}: {
	/** ⚠ THE FIXTURE'S OWN KEY UNION, not `string`. The guards query these blocks
	 * by `data-testid="resolution-block-<key>"`, so a typo here would silently
	 * drift four testids away from four assertions; typed this way it is a
	 * compile error instead (@code-reviewer LOW, accepted). */
	blockKey: (typeof BLOCKS)[number]["key"];
	label: string;
}) {
	return (
		<div
			data-testid={`resolution-block-${blockKey}`}
			// ⚠ `justify-between` — the block's height is whatever `flex-1` hands it,
			// which is not a number this file knows. Distributing three fixed-height
			// children across an unknown height keeps the composition legible at any
			// of them; stacking them at the top would leave a growing empty gap under
			// the value line as the band gets taller.
			// ⚠ `overflow-hidden` WAS HERE AND IS DELIBERATELY GONE, as the second half
			// of the row's content-floor fix. It was the thing that made the
			// compression SILENT: the row shrank, each block clipped its own label,
			// and nothing anywhere reported it. With the floor in place the block can
			// no longer be squeezed below its content, so the clip is unreachable —
			// and keeping an unreachable clip on a placeholder whose content is about
			// to be replaced by the content pass would just re-arm the same trap for
			// whoever fills these in. If something ever does overflow, it should be
			// VISIBLE, and the stack should scroll.
			className="flex min-h-0 min-w-0 flex-col justify-between gap-2 rounded-(--r) px-[11px] py-[9px] [border:var(--hairline)]"
		>
			{/* The 1:1 slot. `aspect-square` states the ratio R-8 asks for as a
			    RATIO rather than as two equal lengths that a later edit could
			    desynchronise, and `w-[44px]` gives it a definite size inside a
			    column whose height is not fixed. `shrink-0` so it stays square when
			    the row is compressed rather than being squashed into a rectangle —
			    which is the one way a 1:1 placeholder silently stops being 1:1. */}
			<span
				aria-hidden="true"
				data-testid={`resolution-block-glyph-${blockKey}`}
				className="aspect-square w-[44px] shrink-0 rounded-[var(--imgr)] bg-n1 [border:var(--hairline)]"
			/>
			<span className="flex min-w-0 flex-col gap-px">
				{/* The `.overline` recipe (`d5:468-469`) — 9.5px / 800 / .14em /
				    uppercase / n4, ported BY TOKEN and never by hex. The source text
				    is title case and `uppercase` does the rendering, exactly as the
				    removed RESOLUTION label did. */}
				<span
					data-testid={`resolution-block-label-${blockKey}`}
					className="truncate text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase"
				>
					{label}
				</span>
				{/* The value line, EMPTY. No column can fill it and no copy is
				    authored to stand in — see the fixture's own note for why the
				    emptiness is a refusal rather than a gap. `min-h` keeps the shape
				    without content; `aria-hidden` because an empty announced row is
				    noise to a screen reader while the label above already names the
				    slot. */}
				<span
					aria-hidden="true"
					data-testid={`resolution-block-value-${blockKey}`}
					className="block min-h-[11px] w-full rounded-(--r-dot) bg-n1"
				/>
			</span>
		</div>
	);
}
