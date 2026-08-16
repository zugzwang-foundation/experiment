import { MarketThumb } from "@/components/discovery/MarketThumb";

/**
 * HTML-FINISH · MARKET DETAIL row 2 — the market's media panel: `.mmedia`
 * (`d5:949`), the first child of the market arm's `.hleft`, standing to the LEFT
 * of the question stack in exactly the slot the post arm gives `.hpimg`.
 *
 * ⛔ THE MOCKUP'S CAPTION IS NOT SHIPPED. `.mmedia .cap` reads "MARKET MEDIA —
 * IMG / VIDEO", which is the mockup DESCRIBING its own placeholder, not product
 * copy. Rendering it would put a build-time note in front of every participant —
 * `PD-3-09` / `OD-6` verbatim, the ruling that deleted the deferred-work box
 * from `MarketHeader`. ⛔ No copy is authored to replace it either: the panel
 * renders the market's actual media or it renders nothing.
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
	// Nothing to show ⇒ no panel, never an empty box (PD-3-09).
	if (imageUrl === null && videoUrl === null) {
		return null;
	}

	const frame =
		"aspect-[16/9] w-1/3 shrink-0 overflow-hidden rounded-[var(--imgr)]";
	// The `IMG` glyph box — byte-carried from `discovery/MarketCard.tsx`'s
	// fallback, which is the shipped, design-ratified null placeholder for a
	// market image. Nothing new is invented for the missing-media arm.
	const fallback = (
		<div
			aria-hidden="true"
			className={`${frame} flex items-center justify-center bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4`}
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
			className={`${frame} object-cover`}
			fallback={fallback}
		/>
	);

	if (videoUrl === null) {
		return <div data-testid="market-media-panel">{media}</div>;
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
			className="relative block w-1/3 shrink-0"
		>
			<div className="w-full [&>*]:w-full">{media}</div>
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
