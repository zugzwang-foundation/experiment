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
}: {
	url: string;
	onOpen: (url: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpen(url)}
			aria-label="Open attached image"
			className="block w-fit"
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
				className="max-h-[var(--imgmax)] max-w-full rounded-[var(--imgr)] [border:var(--hairline)]"
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
export function PostImagePlaceholder() {
	return (
		<div
			data-testid="post-image-placeholder"
			className="flex aspect-[16/9] w-full max-w-[var(--imgmax)] items-center justify-center rounded-[var(--imgr)] bg-n1 px-2 text-center font-mono text-[8.5px] tracking-[0.16em] text-n4 [border:var(--hairline)]"
		>
			POST IMAGE · 640:586
		</div>
	);
}
