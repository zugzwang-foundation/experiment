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
