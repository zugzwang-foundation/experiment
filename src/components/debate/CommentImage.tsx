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
	className,
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
	 * `max-h-[40vh]`, so the image is bounded by THE VIEWPORT rather than by a
	 * 160px constant — see the measurement note below for why not by the card.
	 *
	 * ⛔ STILL BOTH-AXES-BOUNDED, so T2 / canon §107 ("shown whole · any
	 * orientation") is untouched: `max-h-[40vh]` + `max-w-full` with no fixed
	 * dimension preserves the intrinsic aspect and never upscales a small image.
	 * d5's own `height:100%` WOULD upscale, and that half is deliberately not
	 * taken — it is the one part of `.media` that fights the promise to the author.
	 *
	 * ⚠⚠ THE BOUND IS THE CELL AGAIN, AND THE `40vh` STOPGAP IS DISCHARGED. This
	 * read: "d5's card is `flex:1 1 auto` inside a `height:100vh;overflow:hidden`
	 * screen, so 'the card's leftover height' is a real quantity there. THIS ROUTE
	 * HAS NO SUCH QUANTITY … so the arena is sized BY its content, and a
	 * `height:100%` image inside it is circular. ⇒ The bound is a FRACTION OF THE
	 * VIEWPORT." That was the correct call against a content-height page, and it
	 * measured ~266 × 244 where d5 has 476 × 436.
	 *
	 * ⇒ The founder's 2026-08-17 parity ruling makes the page a fixed-height grid,
	 * so "the card's leftover height" IS a real quantity here now and `max-h-full`
	 * resolves against it. The image goes back to being height-driven off the card
	 * exactly as `.media{height:100%;width:auto;max-width:100%;max-height:100%}`
	 * (`d5:649`) has it — which is also the only way it can hit d5's measured 44.9%
	 * of viewport height, since a viewport fraction and a card fraction are only
	 * ever equal by coincidence.
	 *
	 * ⚠ DEFAULT `false` KEEPS THE FOCUS-HEADER ARM BYTE-IDENTICAL. `.hpimg`
	 * (`d5:787`) is a fixed side slot, not a growing cell, and `PostFocusHeader`
	 * renders it inside its own `shrink-0` wrapper.
	 */
	fill?: boolean;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpen(url)}
			aria-label="Open attached image"
			// ⚠ `h-full` PASSES THE CELL'S HEIGHT DOWN to the `<img>`, whose
			// `max-h-full` is a PERCENTAGE and resolves to `none` unless every
			// ancestor between it and the definite height carries one. The
			// `.argimg` cell in `PostCard` is the flex item that has it.
			// ⚠ MOBILE-2k · F-2 — `max-mobile:w-full` MAKES THE BOX THE CARD'S CONTENT
			// WIDTH, so the image is centred IN the card rather than the box
			// shrink-wrapping the image. Visually the two are identical while the box is
			// transparent and borderless — which it is — but the box is what a later
			// aspect-ratio reservation would have to size, and a shrink-to-fit box cannot
			// be reserved. Stated here so the width is the card's by declaration rather
			// than by coincidence.
			className={
				fill
					? "flex h-full max-w-full items-center justify-center max-mobile:w-full"
					: "block w-fit"
			}
		>
			{/* P3.1 — `loading="lazy"` + `decoding="async"` below: a native
			    lazy-load hint, same rationale as MarketThumb's — the presigned-URL
			    constraint (next comment) rules out next/image, not a plain
			    attribute. Defers the fetch for an off-screen comment image until
			    it nears the viewport. */}
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
			{/* ⛔⛔ MOBILE-2k · F-2 — BELOW 640 THE ATTACHMENT IS CAPPED AT 60% OF THE
			    VISUAL VIEWPORT, ON THE CARD'S OWN GROUND, WITH NO EDGE. Three tokens,
			    all `max-mobile:`-scoped and all gated on `fill`, and each closes a
			    different half-measure.

			    ⚠ THE CAP IS THE ROUND'S SUBSTANCE, because `max-h-full` DOES NOTHING
			    HERE. It is a percentage, and a percentage max-height resolves to
			    `none` unless an ancestor carries a DEFINITE height — which is exactly
			    what the cell's own docblock in `PostCard` says. On the DESKTOP the
			    founder's 2026-08-17 fixed-height grid supplies one and the bound
			    bites. On the PHONE the feed pane is a column of content-sized cards
			    inside a scroller, so `flex-1` resolves to content, `max-h-full`
			    resolves to `none`, and a portrait attachment renders at its INTRINSIC
			    height — bounded on width alone, pushing the argument and the footer a
			    whole screen down. `60dvh` is a definite length and is the first bound
			    this arm has actually had below 640.

			    ⚠ `dvh`, NOT `vh` — the same choice the tier root makes and for the
			    same reason: `vh` is the LARGE viewport, so with a browser toolbar
			    showing a `60vh` box exceeds 60% of what the reader can see. `dvh`
			    tracks the viewport that is actually there, which is what "60% of the
			    visual viewport" names.

			    ⛔ `max-mobile:[border:none]` RATHER THAN `border-none`, AND THE
			    SPELLING IS THE MECHANISM. The base token is the arbitrary property
			    `[border:var(--hairline)]`; Tailwind orders a variant AFTER its
			    unprefixed peer within the same utility kind, so an arbitrary property
			    is what reliably overrides an arbitrary property. `border-none` sets
			    `border-style` — a different declaration whose position relative to a
			    `border` shorthand is not a thing to assume. Measured in the compiled
			    sheet and in `getComputedStyle`, not inferred.

			    ⚠ THE RADIUS BECOMES THE CARD'S `--r` (8px) AND LEAVES THE RATIFIED
			    `--imgr` (6px) BEHIND — founder-ruled for this round. `--imgr` is
			    ratified for images (values-log §3 item 2) and still governs
			    everywhere else, desktop included; the phone feed is the one place the
			    picture is edge-to-edge inside its card with no border between them, so
			    a 6px corner inside an 8px corner reads as a misregistration rather
			    than as two radii. Recorded as a divergence from a ratified token, not
			    as a correction of one.

			    ⛔ NO ASPECT-RATIO RESERVATION, AND IT IS NOT AN OMISSION. The read
			    model carries no dimensions to reserve with: `DebatePost.imageUrl` is a
			    `string | null` and nothing else, `load-debate-view.ts` mints it from
			    `image_uploads`, and that table carries `content_type` and `byte_size`
			    and NO width or height (`0006`, and the schema at HEAD). A reservation
			    would have to invent a ratio, and an invented ratio is a layout shift
			    with extra steps. So the feed does jump as an image decodes, and that
			    is owed work with a name rather than a thing quietly not done. */}
			{/* biome-ignore lint/performance/noImgElement: a short-TTL presigned R2
			    GET URL (D9), not a static asset — next/image optimization would
			    proxy a 3600s-expiring URL; plain <img> is the plan's choice (§4). */}
			<img
				src={url}
				alt="Argument attachment"
				className={`max-w-full object-contain rounded-[var(--imgr)] [border:var(--hairline)] ${
					fill
						? "max-mobile:max-h-[60dvh] max-mobile:rounded-(--r) max-mobile:[border:none] "
						: ""
				}${className ?? (fill ? "max-h-full" : "max-h-[var(--imgmax)]")}`}
				loading="lazy"
				decoding="async"
			/>
		</button>
	);
}

/*
 * ⛔ `PostImagePlaceholder` LIVED HERE AND IS GONE (QUOTE-1 A, founder-ruled
 * 2026-09-11). It rendered d5's `.media.rdt` box carrying the byte-carried
 * literal `POST IMAGE · 640:586` into `.argimg` (`d5:1682`) and into the
 * post-focus `.hpimg` (`d5:1491-1492`) for every card with no real attachment
 * — HTML-FINISH · MARKET DETAIL round 2 · R2, the second of the four
 * placeholders the founder ruled IN on 2026-08-16 (the OD-2 reversal), and
 * docketed in the same breath at `docs/parked.md`
 * (`HTML-FINISH-MD-PLACEHOLDERS`) to be stripped or gated before the DP.2
 * production promote. This is that docket taking its STRIP exit.
 *
 * ⚠ THE NAME IS RECORDED RATHER THAN ERASED because every mount site and every
 * render guard on this surface referred to it by name, and a reader arriving
 * from any of them needs to land somewhere that says what happened. An
 * imageless post now renders NOTHING where the attachment would be; the cell
 * that held it survives in `PostCard` and `ReplyCard`, because that cell is
 * what absorbs the card's leftover height (RPLY-1 · R6) and has nothing to do
 * with the placeholder.
 *
 * ⚠ IT IS INTERIM FOR THIS KIND, NOT FINAL. QUOTE-1 C replaces the null arm
 * with the argument title rendered as a quotation well — the kind's permanent
 * exit, and the reason the strip ships first: it is insurance before the
 * promote, and the well is the product decision behind it.
 */
