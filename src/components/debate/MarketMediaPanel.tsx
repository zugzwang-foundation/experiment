import { MarketThumb } from "@/components/discovery/MarketThumb";

/**
 * HTML-FINISH · MARKET DETAIL row 2 — the market's media panel: `.mmedia`
 * (`d5:949`), the first child of the market arm's `.hleft`, standing to the LEFT
 * of the question stack in exactly the slot the post arm gives `.hpimg`.
 *
 * ⛔⛔ THE MOCKUP'S CAPTION IS NOT SHIPPED — AGAIN, AND THIS TIME AS AN EXIT
 * RATHER THAN A RULING. The history is worth keeping in one place because the
 * position has now moved twice:
 *
 *   1. Originally: "⛔ THE MOCKUP'S CAPTION IS NOT SHIPPED. `.mmedia .cap` reads
 *      'MARKET MEDIA — IMG / VIDEO', which is the mockup DESCRIBING its own
 *      placeholder, not product copy. Rendering it would put a build-time note in
 *      front of every participant — `PD-3-09` / `OD-6` verbatim … the panel
 *      renders the market's actual media or it renders nothing."
 *   2. HTML-FINISH · MARKET DETAIL round 2 · R2 REVERSED that (founder-ruled
 *      2026-08-16, the OD-2 reversal): visible placeholder chrome was REQUIRED on
 *      the review surface, byte-carried from `d5:953`, and the same ruling
 *      docketed it at `docs/parked.md` (`HTML-FINISH-MD-PLACEHOLDERS`) to be
 *      stripped or gated before the DP.2 production promote.
 *   3. QUOTE-1 A (founder-ruled 2026-09-11) takes that docket's **STRIP** exit for
 *      this kind. The empty arm returns `null` again.
 *
 * ⚠ R2 IS NOT BEING CALLED WRONG, AND THAT DISTINCTION IS THE WHOLE POINT OF
 * WRITING IT OUT. R2 was scoped to the REVIEW surface and it did its job there;
 * what has changed is that the surface is about to stop being a review surface.
 * The docket exit was always one of "strip or gate", so taking it is R2 running to
 * completion rather than being reversed — which is why the guard below is
 * INVERTED rather than deleted: a re-mount still reddens.
 *
 * ✅ GEOMETRY IS NOW d5's EXACTLY, AND THE DIVERGENCE THAT USED TO LIVE HERE IS
 * DISCHARGED. This block read: "`.mmedia` is `flex:0 0 auto;aspect-ratio:16/9;
 * height:100%;width:auto`, which needs a DEFINITE height on the headzone to
 * resolve a width. `/m/[slug]` deliberately has no such height — it is not the
 * profile, it carries no one-screen ruling, and the height-chain guard forbids
 * adding one. So the panel takes its width as a FRACTION."
 *
 * ⇒ The founder's 2026-08-17 parity ruling gives this route exactly that
 * definite height, so `height:100%;width:auto` resolves and the panel is
 * height-driven off the band, like the mockup's. MEASURED at a pinned 1800×971:
 * d5's panel is 334 × 188 (18.6% × 19.4%); `w-1/3` gave 343 × 195 — close by
 * luck at one viewport and wrong by construction, because a WIDTH fraction plus
 * an aspect determines the HEIGHT, which then has nothing to do with the band it
 * sits in. `shrink-0` is the `flex:0 0` half.
 *
 * ⚠ `aspect-[16/9]` is a SHAPE declaration, not one of the four value classes
 * the task forbids taking from the mockup (colour, radius, px, type size,
 * duration), and the utility is already on `main` — `MarketPriceChartCard`
 * renders `aspect-[2/1]`. ⚠ It CROPS (`object-cover`), and that is correct HERE
 * and wrong one component over: market media is admin-curated promotional media
 * (ADR-0026), whereas a post's attachment is the author's own and is bound by
 * T2 / canon §107's "shown whole · any orientation". Two images, two rules,
 * deliberately.
 *
 * ⚠ `MarketThumb` is IMPORTED, never edited — it owns the `null · error ·
 * loaded` state machine and requires each consumer to bring its own geometry and
 * its own fallback, so a fourth consumer is its designed extension point.
 * Re-implementing that machine here would be a second implementation of a
 * shipped defect fix. The reverse import already exists on `main`
 * (`discovery/MarketCard.tsx` imports the debate `PriceBar`).
 */
export function MarketMediaPanel({
	imageUrl,
	videoUrl,
	title,
}: {
	imageUrl: string | null;
	/** ADR-0026 — the admin-set outbound video; opens in a NEW TAB, never inline. */
	videoUrl: string | null;
	/** The market question — the panel's own accessible context, never rendered. */
	title: string;
}) {
	/**
	 * ⚠⚠ MEASURED DEFECT, FIXED HERE (HISTORICAL — READ BEFORE TOUCHING THIS
	 * AGAIN): THE PANEL WAS 19.4px WIDE ON STAGING. `frame` used to carry
	 * `w-1/3` and was applied to the `MarketThumb` / fallback CHILD, while the
	 * wrapper `<div data-testid="market-media-panel">` carried no sizing at
	 * all. The wrapper is a flex item of `.hleft`, so it shrank to its
	 * content — and its content was a percentage OF THAT WRAPPER. A
	 * percentage width resolving against a box that is itself sized by its
	 * content collapses, and the panel rendered as a 19.4 × 202 sliver:
	 * present in the DOM, invisible on the page. Measured on live staging at
	 * `5349ae9` (`getBoundingClientRect` → `{w: 19.4, h: 202.1}`), which is
	 * the same defect class as the 324×578 PFP.
	 *
	 * ⇒ THE FRAME IS NOW ON THE OUTER ELEMENT IN ALL THREE BRANCHES, and the
	 * media inside fills it (`size-full`). The wrapper is the thing `.hleft`
	 * measures, so the wrapper is the thing that has to declare a width.
	 *
	 * ⛔⛔ BLOCK-3 — `h-full w-auto` REPLACED WITH `w-1/3`, AND THIS IS NOT THE
	 * SAME "PERCENTAGE WIDTH" MISTAKE THE PARAGRAPH ABOVE WARNS AGAINST. That
	 * defect was a percentage resolving against a box sized BY ITS OWN
	 * CONTENT (circular). This wrapper's containing block
	 * (`MarketHeader.tsx`'s `<div className="flex min-h-0 flex-1 ...">`) is
	 * NOT content-sized — it is `flex-1` inside `headzone-left`, which is
	 * itself sized by the definite-height `headzone` band's own width. No
	 * circularity.
	 * ⚠ WHAT ACTUALLY CHANGED, AND WHY. `h-full w-auto` + `aspect-[16/9]`
	 * derives WIDTH from the band's HEIGHT — measured to make the row and
	 * every block inside it a function of viewport HEIGHT, not width: the
	 * text column was 80.4px at 1440×777 but 67.2px at 1440×900 (a TALLER
	 * viewport left LESS room, since a taller band makes a 16:9 panel
	 * proportionally WIDER), and at 390×844 the height-derived width
	 * (363.1px) exceeded the ENTIRE row's available width (334px) — the
	 * panel alone didn't fit inside its own row, so the text column
	 * collapsed to 0 and the page overflowed by 364px. `w-1/3` makes the
	 * panel's width a fraction of the ROW instead — constant across every
	 * viewport HEIGHT, and it degrades gracefully (not to zero) at any
	 * viewport WIDTH, because the row itself always divides by the same
	 * ratio regardless of how narrow it is. `aspect-[16/9]` still holds
	 * exactly — height is now DERIVED FROM width, never the reverse, so the
	 * ratio is never violated. See BLOCK-3's run report for the measured
	 * before/after at all four viewports this was checked against.
	 * ⚠⚠ `self-start`, NOT `items-start` ON THE ROW — measured, not assumed.
	 * An earlier version of this fix put `items-start` on the shared row in
	 * `MarketHeader.tsx`, which un-stretches BOTH the panel and its sibling
	 * `headzone-stack` — and `headzone-stack` needs `align-items:stretch` to
	 * grow into whatever height the band leaves over (R-8's mechanism).
	 * Measured with the row-level fix: `headzone-stack` read an IDENTICAL
	 * 176px at both a 217.8px band and a 188px band — the difference was
	 * going nowhere. `self-start` opts out ONLY the panel, which is the one
	 * child whose height no longer needs the row's stretch (it derives its
	 * own from `w-1/3` + `aspect-[16/9]` now) — `headzone-stack` keeps the
	 * row's default stretch untouched.
	 */
	// MOBILE-1 Phase A — `max-mobile:w-full`. `w-1/3 shrink-0` is correct
	// beside the text stack and wrong beneath it: `MarketHeader`'s row stacks
	// below 640px (see its own comment and the measurement that forced it), and
	// a third-width 16:9 letterbox floating above full-width text is not a
	// reflow, it is the same defect one axis over. Full width keeps the 16:9
	// ratio and the panel's own frame untouched. >=640px is byte-identical.
	const frame =
		"aspect-[16/9] w-1/3 shrink-0 self-start overflow-hidden rounded-[var(--imgr)] max-mobile:w-full";

	// ⛔ QUOTE-1 A — NOTHING TO SHOW DRAWS NOTHING. R2's centred `.playmark` ring
	// over the byte-carried `MARKET MEDIA — IMG / VIDEO` caption (`d5:949-954`) is
	// the docket's kind 1, and the founder's 2026-09-11 ruling takes its STRIP
	// exit. This is the pre-R2 behaviour restored, not a new one.
	// ⚠ THE ARM SURVIVES AS AN ARM rather than collapsing into the fallback below,
	// and that is deliberate: "no media at all" and "media the presign could not
	// mint" are different facts about the market, and the second one still owes the
	// reader the shipped `IMG` glyph box because a video may still be reachable
	// beside it. Merging them would make a missing row indistinguishable from a
	// failed read.
	if (imageUrl === null && videoUrl === null) {
		return null;
	}
	// The `IMG` glyph box — byte-carried from `discovery/MarketCard.tsx`'s
	// fallback, which is the shipped, design-ratified null placeholder for a
	// market image. Nothing new is invented for the missing-media arm.
	// ⚠ It fills the FRAME now rather than re-declaring it: the frame is the
	// wrapper's, so a second `w-1/3` here would be the percentage-of-itself that
	// collapsed the panel in the first place.
	const fallback = (
		<div
			aria-hidden="true"
			className="flex size-full items-center justify-center bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
		>
			IMG
		</div>
	);

	const media = (
		<MarketThumb
			src={imageUrl}
			// Decorative: the market question sits directly beside this panel and
			// is the accessible content. `discovery/MarketCard.tsx` makes the same
			// call at the same pairing, and its `alt=""` is byte-carried here.
			alt=""
			className="size-full object-cover"
			fallback={fallback}
		/>
	);

	if (videoUrl === null) {
		return (
			<div data-testid="market-media-panel" className={frame}>
				{media}
			</div>
		);
	}

	return (
		<a
			data-testid="market-media-panel"
			href={videoUrl}
			target="_blank"
			rel="noopener noreferrer"
			// The visible glyph is a play mark; this states its meaning in words.
			// The plan's one permitted new-string category (§1) — an `aria-label`
			// on a control whose glyph carries the same meaning.
			aria-label="Play video"
			className={`relative block ${frame}`}
		>
			{media}
			{/* `.playmark` (`d5:951`) — the outbound-video affordance, centred over
			    the media. Stroked with `currentColor` so it binds to the text
			    ramp rather than carrying a hex (Ruling A / H-HEX). */}
			<span className="pointer-events-none absolute inset-0 flex items-center justify-center text-ink">
				{/* Decorative — the anchor above carries the accessible name, so the
				    glyph must not announce a second one. `aria-hidden` lives on the
				    `<svg>` itself rather than a wrapper: that is what Biome's
				    `a11y/noSvgWithoutTitle` reads, and a wrapper-only hide passes
				    review while failing the gate. */}
				<svg aria-hidden="true" viewBox="0 0 12 14" width="22" height="26">
					<polygon
						points="1,1 11,7 1,13"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.4"
					/>
				</svg>
			</span>
			<span className="sr-only">{title}</span>
		</a>
	);
}
