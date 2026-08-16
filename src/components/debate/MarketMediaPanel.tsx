import { MarketThumb } from "@/components/discovery/MarketThumb";

/**
 * HTML-FINISH · MARKET DETAIL row 2 — the market's media panel: `.mmedia`
 * (`d5:949`), the first child of the market arm's `.hleft`, standing to the LEFT
 * of the question stack in exactly the slot the post arm gives `.hpimg`.
 *
 * ⚠⚠ THE MOCKUP'S CAPTION IS NOW SHIPPED, AND THE RULING ABOVE IT IS REVERSED.
 * This block used to read: "⛔ THE MOCKUP'S CAPTION IS NOT SHIPPED. `.mmedia
 * .cap` reads 'MARKET MEDIA — IMG / VIDEO', which is the mockup DESCRIBING its
 * own placeholder, not product copy. Rendering it would put a build-time note in
 * front of every participant — `PD-3-09` / `OD-6` verbatim … the panel renders
 * the market's actual media or it renders nothing."
 *
 * ⇒ HTML-FINISH · MARKET DETAIL round 2 · R2 REVERSES IT (founder-ruled
 * 2026-08-16, the OD-2 reversal). Visible placeholder chrome is REQUIRED. The
 * caption is BYTE-CARRIED from `d5:953` — hexdumped, em dash U+2014 at bytes
 * `e2 80 94` — never authored, and no substitute copy is invented.
 *
 * ⚠⚠ AND IT MUST NOT REACH REAL PARTICIPANTS. The `PD-3-09` / `OD-6` objection
 * was not wrong about what this IS — it is a build-time note about unbuilt work
 * — it is now outranked for the review surface. Docketed at `docs/parked.md`
 * (`HTML-FINISH-MD-PLACEHOLDERS`): **strip or gate all four placeholders before
 * the DP.2 production promote.**
 *
 * ⚠ GEOMETRY DIVERGES FROM d5, AND THE REASON IS THIS ROUTE'S HEIGHT CHAIN.
 * `.mmedia` is `flex:0 0 auto;aspect-ratio:16/9;height:100%;width:auto`, which
 * needs a DEFINITE height on the headzone to resolve a width. `/m/[slug]`
 * deliberately has no such height — it is not the profile, it carries no
 * one-screen ruling, and `tests/unit/design/debate-height-chain.test.ts` forbids
 * adding one. So the panel takes its width as a FRACTION and derives its height
 * from the aspect, which is deterministic at every viewport instead of
 * depending on a bound that does not exist. `shrink-0` is the surviving half of
 * `flex:0 0 auto`.
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
	 * ⚠⚠ MEASURED DEFECT, FIXED HERE: THE PANEL WAS 19.4px WIDE ON STAGING.
	 * `frame` used to carry `w-1/3` and was applied to the `MarketThumb` /
	 * fallback CHILD, while the wrapper `<div data-testid="market-media-panel">`
	 * carried no sizing at all. The wrapper is a flex item of `.hleft`, so it
	 * shrank to its content — and its content was a percentage OF THAT WRAPPER.
	 * A percentage width resolving against a box that is itself sized by its
	 * content collapses, and the panel rendered as a 19.4 × 202 sliver: present
	 * in the DOM, invisible on the page. Measured on live staging at `5349ae9`
	 * (`getBoundingClientRect` → `{w: 19.4, h: 202.1}`), which is the same defect
	 * class as the 324×578 PFP.
	 *
	 * ⇒ THE FRAME IS NOW ON THE OUTER ELEMENT IN ALL THREE BRANCHES, and the
	 * media inside fills it (`size-full`). The wrapper is the thing `.hleft`
	 * measures, so the wrapper is the thing that has to declare a width.
	 */
	const frame =
		"aspect-[16/9] w-1/3 shrink-0 overflow-hidden rounded-[var(--imgr)]";

	// ✅ R2 — NOTHING TO SHOW NOW DRAWS THE MOCKUP'S PLACEHOLDER, where it used to
	// `return null`. `.mmedia`'s empty state is a centred column: the `.playmark`
	// ring over the byte-carried `.cap` (`d5:949-954`).
	// ⛔ TOPOLOGY AND LABEL ONLY. d5's `44px` ring, `1.5px` border, `8.5px`
	// caption and `.18em` tracking are VALUES and are not taken; the ring is a
	// Tailwind scale step and the caption reuses the glyph-box recipe already
	// shipped one function below (byte-carried from `discovery/MarketCard.tsx`),
	// so this introduces no new type size at all.
	if (imageUrl === null && videoUrl === null) {
		return (
			<div
				data-testid="market-media-placeholder"
				className={`${frame} flex flex-col items-center justify-center gap-2.5 bg-n1 [border:var(--hairline)]`}
			>
				{/* `.playmark` — the ring is `currentColor`-stroked so it binds to the
				    text ramp rather than carrying a hex (Ruling A / H-HEX). */}
				<span className="flex size-11 items-center justify-center rounded-full text-n4 [border:var(--hairline)]">
					<svg aria-hidden="true" viewBox="0 0 12 14" width="14" height="14">
						<polygon
							points="1,1 11,7 1,13"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.4"
						/>
					</svg>
				</span>
				{/* ⛔ BYTE-CARRIED FROM `d5:953`, hexdumped: em dash U+2014 (e2 80 94),
				    spaced slashes, all caps. Not authored, not paraphrased. */}
				<span className="font-mono text-[8.5px] tracking-[0.16em] text-n4">
					MARKET MEDIA — IMG / VIDEO
				</span>
			</div>
		);
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
