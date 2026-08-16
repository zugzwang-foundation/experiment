/**
 * A comment's attached image (F-COMMENT-3 / D9) — rendered from a server-minted
 * presigned R2 GET URL (`signRead`, 3600s). Bounded on HEIGHT by `--imgmax`
 * (the T2 axis, POLISH.3 PR 2) and on width by 100%, `--imgr` radius, hairline
 * border (the SHELL/UI.0 tokens). Click opens the read-only
 * lightbox via `onOpen` (the only wired image affordance — C1). A removed
 * comment never reaches here: its URL is withheld server-side (§6).
 */
export function CommentImage({
	url,
	onOpen,
	fill = false,
}: {
	url: string;
	onOpen: (url: string) => void;
	/**
	 * ⚠⚠ THE `.argimg` ARM — d5's post-CARD image slot (`d5:648-651`), and the
	 * fix for the founder's measured "post image renders ~¼ size, left-aligned".
	 *
	 * d5 gives a card's attachment the card's whole leftover height and CENTRES
	 * it: `.argimg{flex:1 1 auto;min-height:0;display:flex;align-items:center;
	 * justify-content:center}` wrapping `.media{height:100%;width:auto;
	 * max-width:100%;max-height:100%}`. Measured in the mockup at 1800: the image
	 * is 479 × 439 in an 833 × 598 card — 73% of the card's HEIGHT.
	 * Measured on staging at `5349ae9`: 160 × 90, flush left, because the shipped
	 * render was `block w-fit` around `max-h-[var(--imgmax)]` — a 160px cap.
	 *
	 * ⇒ `fill` swaps the `w-fit` box for a centred flex cell and the 160px cap for
	 * `max-h-full`, so the image is bounded by THE CARD rather than by a constant.
	 *
	 * ⛔ STILL BOTH-AXES-BOUNDED, so T2 / canon §107 ("shown whole · any
	 * orientation") is untouched: `max-h-full` + `max-w-full` with no fixed
	 * dimension preserves the intrinsic aspect and never upscales a small image.
	 * d5's own `height:100%` WOULD upscale, and that half is deliberately not
	 * taken — it is the one part of `.media` that fights the promise to the author.
	 *
	 * ⚠ DEFAULT `false` KEEPS THE FOCUS-HEADER ARM BYTE-IDENTICAL. `.hpimg`
	 * (`d5:787`) is a fixed side slot, not a growing cell, and `PostFocusHeader`
	 * renders it inside its own `shrink-0` wrapper.
	 */
	fill?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpen(url)}
			aria-label="Open attached image"
			// ⚠ `h-full`, not `flex-1`: the `.argimg` CELL is the flex item (its
			// wrapper in `PostCard` carries `flex-1 min-h-0`), and the `<img>`'s
			// `max-h-full` below is a PERCENTAGE — it resolves to `none` unless
			// every ancestor between it and the definite height passes that height
			// down. `h-full` is that pass-through.
			className={
				fill
					? "flex h-full max-w-full items-center justify-center"
					: "block w-fit"
			}
		>
			{/* biome-ignore lint/performance/noImgElement: a short-TTL presigned R2
			    GET URL (D9), not a static asset — next/image optimization would
			    proxy a 3600s-expiring URL; plain <img> is the plan's choice (§4). */}
			{/* T2 (§17 H-T2, RULED 2026-08-13) — ASPECT-RESPECTING WITHIN A MAX BOX.
			    BOTH axes are BOUNDS, never fixed sizes: `--imgmax` on HEIGHT and
			    100% on WIDTH. With two max-* bounds and no fixed dimension the
			    intrinsic aspect is preserved by the UA, which is why the ruling
			    says "no fixed box ⇒ the `object-fit` question does not arise" —
			    `object-fit` would only be needed if one axis were pinned.

			    ⚠ NOTE THE AXIS CHANGE — it is the row's whole substance. The build
			    bound `max-w-[var(--imgmax)]`, capping WIDTH at 160px; this caps
			    HEIGHT instead, so a landscape image is no longer squeezed into a
			    160px-wide sliver and "shown whole · any orientation" (the promise
			    to the author, canon §107) holds in both orientations.

			    ⚠ `max-w-full`, NOT `w-full` — and NOT for the reason first written
			    here. A `width:100%` would NOT break the aspect: for a replaced element
			    CSS 2.1 §10.4's `h > max-h` rule recomputes the used width as
			    `max-h × (intrinsic w / intrinsic h)`, so the ratio survives. The real
			    reasons are (i) `max-w-full` never UPSCALES a sub-160px image past its
			    intrinsic size, which a stretch would, and (ii) a percentage width
			    inside the `block w-fit` parent below resolves against a box that is
			    itself sized by this image. The parent stays `w-fit` and shrinks around
			    the height-bounded image. (Corrected post-review: the call was right and
			    its stated cause was not — `O-3`.) */}
			<img
				src={url}
				alt="Argument attachment"
				className={`max-w-full rounded-[var(--imgr)] [border:var(--hairline)] ${
					fill ? "max-h-full" : "max-h-[var(--imgmax)]"
				}`}
			/>
		</button>
	);
}

/**
 * HTML-FINISH · MARKET DETAIL round 2 · R2 — THE POST-IMAGE PLACEHOLDER, the
 * second of the four the founder ruled in on 2026-08-16 (the OD-2 reversal).
 *
 * d5's `.media.rdt` box carrying `<span class="ph">POST IMAGE · 640:586</span>`
 * — the literal it substitutes into `.argimg` (`d5:1682`) and into the
 * post-focus `.hpimg` (`d5:1491-1492`) for every card with no real attachment.
 *
 * ⛔ THE LABEL IS BYTE-CARRIED, hexdumped from `d5:1243`: middle dot U+00B7 at
 * bytes `c2 b7`, and the literal aspect string `640:586`. ⛔ No copy is authored
 * and none is paraphrased — `640:586` is d5's own demo aspect and means nothing
 * for a real post, which is precisely why it is carried rather than replaced:
 * inventing a truer-sounding caption would be authoring product copy.
 *
 * ⛔ IT IS NOT `aria-hidden`, and it carries no `alt`-like name either — it is a
 * `<div>` with visible text, so a screen reader reads exactly what a sighted
 * reviewer sees. Hiding it would make the placeholder invisible to the one
 * audience most likely to be confused by it.
 *
 * ⚠⚠ REVIEW-SURFACE ONLY. Docketed at `docs/parked.md`
 * (`HTML-FINISH-MD-PLACEHOLDERS`): strip or gate all four before the DP.2
 * production promote. A real participant must never meet this box.
 *
 * ⚠ TOPOLOGY AND LABEL ONLY. d5's `8.5px` / `.16em` / `var(--n5)` / `640/586`
 * aspect are VALUES; the box reuses the glyph-box recipe already shipped in
 * `MarketMediaPanel` (itself byte-carried from `discovery/MarketCard.tsx`) and
 * the same `--imgr` / hairline pair `CommentImage` uses above, so no new type
 * size, colour or radius enters the build.
 */
export function PostImagePlaceholder({
	fill = false,
}: {
	/**
	 * ⚠ THE `.argimg` ARM — the same swap `CommentImage` documents above, and the
	 * other half of the founder's "~¼ size, left-aligned" measurement: the box was
	 * `aspect-[16/9] w-full max-w-[var(--imgmax)]`, so it rendered 160 × 90 flush
	 * left on staging while the mockup's fills the card and centres.
	 *
	 * ⛔ THE ASPECT BECOMES `640/586` IN THIS ARM, AND THAT IS THE LABEL'S OWN
	 * NUMBER. d5's box is `.media.rdt{aspect-ratio:640/586}` (`d5:653`) and the
	 * caption it carries literally reads `640:586` — so the shipped `16/9` box was
	 * a placeholder whose shape contradicted its own text. Not a value taken from
	 * the mockup so much as the value already printed inside the component.
	 *
	 * ⚠ `h-full w-auto` here, unlike `CommentImage`: a placeholder has no
	 * intrinsic content to distort, so d5's `height:100%` is safe on it — the
	 * upscaling objection applies only to a real attachment.
	 */
	fill?: boolean;
}) {
	return (
		<div
			data-testid="post-image-placeholder"
			className={
				fill
					? "flex aspect-[640/586] h-full max-h-full w-auto max-w-full items-center justify-center rounded-[var(--imgr)] bg-n1 px-2 text-center font-mono text-[8.5px] tracking-[0.16em] text-n4 [border:var(--hairline)]"
					: "flex aspect-[16/9] w-full max-w-[var(--imgmax)] items-center justify-center rounded-[var(--imgr)] bg-n1 px-2 text-center font-mono text-[8.5px] tracking-[0.16em] text-n4 [border:var(--hairline)]"
			}
		>
			POST IMAGE · 640:586
		</div>
	);
}
