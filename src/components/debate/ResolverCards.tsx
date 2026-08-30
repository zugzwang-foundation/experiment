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
	{ key: "closes", label: "Closes on" },
	// ⚠ RESO-2 · CHANGE 5 — `Context` is RETIRED and `Flavour` takes the slot.
	// Still PROVISIONAL, still not a copy-register entry: the brief says so in
	// terms, and the same fence applies to these four as to the four they replace.
	{ key: "flavour", label: "Flavour" },
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
			// ⚠ THE FLOOR IS MEASURED, NOT ESTIMATED, AND RESO-2 MOVED IT. It was 97,
			// from a block whose intrinsic content was padding 18 + square 44 + gap 8
			// + text group 26.25 = 96.25px. CHANGE 4 takes the square to 30px and the
			// padding to 8px, so intrinsic becomes 16 + 14.25 + 6 + 30 + 6 + 11 =
			// **83.25px** → floor 84. At the floor nothing clips; below it the STACK
			// scrolls, which is where the overflow was always supposed to go.
			// ⚠⚠ `mt-4` IS THE ONLY THING THAT ACTUALLY SHORTENS THE BLOCK, and that
			// is worth stating because the two CHANGE-4 asks look independent and are
			// not. This row is `flex-1` inside a band of fixed height, so its height
			// is WHAT IS LEFT OVER — shrinking the square makes the block emptier,
			// never shorter. Taking 16px above the row does both at once: it is the
			// separation the bar group was owed, and it is 16px the row no longer
			// has. Measured 111.99 → 95.99.
			// ⇒ CONSEQUENCE, STATED: below a viewport height of about 715px the
			// header stack scrolls instead of compressing. That is the ruled
			// behaviour for this surface — the page never scrolls, regions do.
			// ⚠ THE HEIGHT-CHAIN GUARD CANNOT SEE ANY OF THIS: it scans `headzone`,
			// `-left`, `-right`, `arena` and `column-scroll`, and this row is not a
			// chain node. That is why the reasoning lives here.
			// ⚠ `flex-1` still does the growing above the floor; grid items stretch by
			// default, so equal height across the four is a property of the grid and
			// not something each block declares.
			className="mt-4 grid min-h-[84px] flex-1 grid-cols-4 gap-2"
		>
			{BLOCKS.map((b) => (
				<ResolutionBlock key={b.key} blockKey={b.key} label={b.label} />
			))}
		</div>
	);
}

/**
 * One block — a 1:1 placeholder on the LEFT, and a label plus two empty value
 * lines stacked to its right.
 *
 * ⚠⚠ HORIZONTAL AGAIN, AND THIS PARAGRAPH USED TO ARGUE THE OPPOSITE. It read:
 * "VERTICAL, WHERE THE TWO-CARD VERSION WAS HORIZONTAL … a row absorbs height
 * only by inflating its glyph, while a column absorbs it in the gaps between
 * three stacked elements". That reasoning was sound for RESO-1, whose R-8
 * required the block to ABSORB the height R-1 and R-2 had freed — a row would
 * have done it by inflating a glyph nobody had asked to inflate.
 * ⇒ RESO-2 · CHANGE 4 then removed that requirement by ruling the block SHORTER,
 * and RESO-3 · CHANGE 7 rules the inflated glyph in by name. The premise the
 * column rested on is gone, so the conclusion goes with it. The correction is
 * written HERE, into the paragraph that stated the superseded position, rather
 * than appended below it — an amendment a reader reaches after the claim reverses
 * nothing (CLAUDE.md §8, O-5).
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
			// ⛔⛔ RESO-3 · CHANGE 7 — THE BLOCK IS A ROW, WHERE RESO-1 MADE IT A
			// COLUMN, AND THAT REVERSAL IS DELIBERATE. RESO-1's docblock above argues
			// for the column: a row "absorbs height only by inflating its glyph".
			// That was correct THEN and is what the founder has now ruled for —
			// CHANGE 4 took the block's height down to a size where three stacked
			// children read as three thin strips, and the placeholder had shrunk to a
			// 30px chip that the label and value line stepped over rather than
			// belonged to. Inflating the glyph is no longer the failure mode; it is
			// the request. The image is the thing the block is built around, so it
			// sits first and the text beside it.
			// ⚠ `items-center` CENTRES BOTH CHILDREN, and at RESO-4 that includes the
			// square. It used to opt out with `self-stretch` because it was sized BY
			// the row; it now declares its own 48px and is placed within the row like
			// anything else. Corrected here rather than left to disagree with the
			// element it describes twenty lines down.
			// ⚠ `justify-between` IS GONE WITH THE COLUMN. It distributed three
			// children down an unknown height; a row has two children whose widths are
			// decided by `shrink-0` and `flex-1`, so there is nothing left to
			// distribute and keeping it would silently push the text stack right.
			// ⚠ `overflow-hidden` STAYS ABSENT for the reason RESO-2 recorded — the
			// row's content floor makes a clip unreachable, and an unreachable clip on
			// a placeholder is a trap re-armed for whoever fills these in.
			// ⛔ THE OUTER BOX IS UNTOUCHED: `px-[11px] py-2`, the `--r` radius and the
			// hairline are RESO-2 · CHANGE 4's, and block WIDTH and HEIGHT remain the
			// grid's to decide (`resolver-cards`, `mt-4 min-h-[84px] flex-1`). RESO-3
			// changes only what is INSIDE.
			className="flex min-h-0 min-w-0 items-center gap-2.5 rounded-(--r) px-[11px] py-2 [border:var(--hairline)]"
		>
			{/* ⛔⛔ THE SQUARE IS 48px BY DECLARATION, AND `self-stretch` IS GONE —
			    RESO-4, AND A REVERSAL OF THE PARAGRAPH THAT STOOD HERE. That one
			    argued for deriving the size: `self-stretch` took the block's inner
			    height and `aspect-square` derived the width from it, so the square
			    could never fall out of step with a row whose height had already been
			    hand-tuned once. The reasoning was sound and the OUTCOME was not — at
			    the shipped 162.43px block the derived square came out 77.99px, which
			    with 22px of padding and the 10px gap left the text column 50.44px
			    against labels needing 54 / 61 / 68 / 75px. ⛔ ALL FOUR CLIPPED.
			    ⇒ The flaw was not the mechanism, it was WHICH LENGTH IT DERIVED FROM.
			    Deriving the square from the block's HEIGHT let a height decision spend
			    the WIDTH budget silently — the two are independent here, because block
			    width comes from `grid-cols-4` over a row whose own width is fixed by
			    the rail reservation. A declared width is what keeps the text column a
			    thing somebody chose rather than a remainder.
			    ⚠ 48px IS CHOSEN AGAINST THE LONGEST LABEL, NOT PICKED TO LOOK RIGHT:
			    162.43 − 22 padding − 10 gap − 48 leaves 82.43px, and the longest label
			    (`Resolution`, 75px) clears it with ~7px of headroom. Shrinking the
			    square further would buy margin nobody needs; growing it past ~55px
			    starts clipping again.
			    ⚠ THE RATIO IS STILL STATED AS A RATIO. `aspect-square` + ONE length,
			    never two — two equal literals are what a later edit desynchronises.
			    Vertical centring now comes from the row's own `items-center`, which
			    this child no longer opts out of.
			    ⚠ `shrink-0` so a narrow block squeezes the TEXT, never the square. A
			    squashed 1:1 placeholder stops being 1:1 without anything reporting it,
			    which is the same failure RESO-1 guarded here for the same reason. */}
			<span
				aria-hidden="true"
				data-testid={`resolution-block-glyph-${blockKey}`}
				className="aspect-square w-[48px] shrink-0 rounded-[var(--imgr)] bg-n1 [border:var(--hairline)]"
			/>
			{/* The right-hand stack, centred as a GROUP against the square rather than
			    each line centring itself.
			    ⚠ `min-w-0` IS LOAD-BEARING: without it this flex item's automatic
			    minimum size is its CONTENT, so a long label would refuse to shrink and
			    would push the square out of the block instead of truncating. It is the
			    same chain link `debate-height-chain.test.ts` pins by name one level up.
			    ⛔ RESO-2 · CHANGE 5 IS PRESERVED, NOT REDONE — the label is still the
			    first thing read. It was the first child of a column; it is now the
			    first child of this stack, which is the same ruling expressed in the new
			    geometry. The label STRINGS and the overline recipe are untouched. */}
			<span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
				<span
					data-testid={`resolution-block-label-${blockKey}`}
					className="truncate text-[9.5px] font-extrabold tracking-[.14em] text-n4 uppercase"
				>
					{label}
				</span>
				{/* TWO value lines now, a full-width one and a shorter one beneath it.
				    ⛔ BOTH STILL EMPTY, AND THAT HALF HAS NEVER REVERSED. No column can
				    fill them and no copy is authored to stand in — see the fixture's
				    own note for why the emptiness is a refusal rather than a gap. The
				    second line is what makes the shape read as a record with a name and
				    a source beneath it rather than a label with one stray bar, which is
				    what a single line looked like once the square grew beside it.
				    ⚠ `aria-hidden` on both: an empty announced row is noise, and the
				    label above already names the slot. The unequal widths are a
				    placeholder rhythm, not data — nothing here encodes a value.
				    ⚠ `min-h` 11px → 9px so two lines plus the label clear the 79.99px
				    inner height with the `gap-1` between them; the bars are thinner
				    because there are now two, not because the recipe changed. */}
				<span
					aria-hidden="true"
					data-testid={`resolution-block-value-${blockKey}`}
					className="block min-h-[9px] w-full rounded-(--r-dot) bg-n1"
				/>
				<span
					aria-hidden="true"
					data-testid={`resolution-block-subvalue-${blockKey}`}
					className="block min-h-[9px] w-[68%] rounded-(--r-dot) bg-n1"
				/>
			</span>
		</div>
	);
}
