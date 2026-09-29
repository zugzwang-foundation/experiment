import { quoteFill } from "./palette";
import { QUOTE_CANVAS, QUOTE_POSTER, quotePosterSize } from "./size";

/**
 * QUOTE-1 C — THE TITLE-AS-QUOTATION WELL (design-canon `C-QUOTE-1`, SPEC.1
 * 2.0.2, founder-ruled 2026-09-11).
 *
 * An imageless top-level post has an empty attachment cell and a title sitting
 * above it in plain text. This makes the title the picture: the same string, in
 * the same heading element, rendered into the slot the attachment would have
 * taken. QUOTE-1 A stripped d5's mockup `POST IMAGE` box out of that cell; this
 * is the permanent thing that stands there instead.
 *
 * ⚠⚠ IT IS A PICTURE, WHICH IS WHY IT IS AN `<svg>` AND NOT A `<div>`. The cell
 * is a flex absorber of unknown height (`PostCard`'s `.argimg`), and an
 * attachment in it scales to fit — `max-width: 100%; max-height: 100%`, ratio
 * preserved. A fixed-size HTML box cannot do that: it would either overflow a
 * short viewport or need every internal dimension re-expressed in percentages,
 * at which point the type size stops being a function of the title and starts
 * being a function of the window. An `<svg>` with a `viewBox` scales its whole
 * coordinate system, so the well is authored ONCE at 545 × 272 and the browser
 * fits it exactly as it fits the real attachment beside it. `foreignObject`
 * carries the HTML because the title must stay real text in a real heading — a
 * `<text>` element cannot wrap, and an image of a title is not a title.
 *
 * ⚠ NO `"use client"`, AND NO STATE, EFFECT OR HANDLER. A pure function of
 * `title` and `postId`. ⛔ That does NOT make it server-only in practice:
 * `PostCard` is `"use client"`, so this renders on both passes — which is safe
 * precisely because it is pure, and would not be if it read a clock or a
 * viewport.
 *
 * ⚠ THE UPPERCASE IS CSS. The DOM carries `post.title` verbatim in its stored
 * case, so the export, a copy-paste and a screen reader all get what the author
 * wrote; only the paint is capitalised. Canon clause 4 calls it a display
 * transform for that reason.
 *
 * ⛔⛔ UIR-9 — POSTER TYPE, AND THE MARKS IN LINE. The title is Geist 800,
 * uppercase, −0.01em tracking, 1.05 leading, and `“` / `”` sit directly
 * against its first and last words at the title's own size and weight
 * (`QuotedTitle`). This replaces QUOTE-1's column — a mark row, the title, a
 * mark row, the marks at 2.5× the title with each one's box cut down to its ink
 * by negative margins. That machinery, and the WebKit `foreignObject` paint bug
 * it had been rebuilt to route around (MOBILE-2c R-3), went with the rows: an
 * inline glyph has no offset to mis-paint. The size is `quotePosterSize`, whose
 * budget is the title's lines alone; `size.ts` says why the old ramp stays for
 * the export.
 *
 * ⛔ UIR-9 — AND IT IS DRAWN ON ITS POST'S OWN FILL. The ground is one of the
 * sixteen in `palette.ts`, picked from the post's id, the border a 1px
 * `rgb(255 255 255 / 0.07)`, and the marks take the fill's tint; the title
 * stays in ink. Every surface that draws this post's picture picks the same
 * entry, so a post keeps its colour from Discovery into its market.
 *
 * ⛔ NO `-webkit-line-clamp`. It was specified as an optional belt and it is
 * MEASURED OUT: `text-wrap: balance` stops applying the moment the clamp
 * clamps, while `getComputedStyle` keeps reporting `balance`. The well's own
 * `overflow: hidden` is the backstop. Full reasoning at `quoteMaxLines`.
 */
export function QuoteWell({
	title,
	postId,
	as: Heading = "h3",
	boxed = true,
}: {
	title: string;
	/**
	 * UIR-9 — the post's id, which picks its fill (`quoteFill`). The same id the
	 * post carries everywhere, so every surface picks the same entry.
	 */
	postId: string;
	/**
	 * FEED-3 — `false` takes the well's box away (fill, border, radius) for a
	 * mount that draws the box itself: Discovery's hero, whose image slot is the
	 * card, painted with this post's fill. The quotation itself is unchanged.
	 * ⚠ UIR-9 — FEED-3 unboxed the desktop post card's well too (`PostCard`
	 * `inColumn`); that card boxes it again, because the fill IS the picture and
	 * a picture keeps its edge in the column the way an attachment does.
	 * ⚠ The padding absorbs the removed 1px border, so the content box — the one
	 * `size.ts` budgets against — is the same 495 × 222 either way.
	 */
	boxed?: boolean;
	/**
	 * The heading element the plain title row used, so the document outline does
	 * not change when a post happens to carry no image. `PostCard` renders `h3`.
	 */
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}) {
	const size = quotePosterSize(title.length);
	const { fill, mark } = quoteFill(postId);

	return (
		<svg
			data-testid="quote-well"
			viewBox={`0 0 ${QUOTE_CANVAS.w} ${QUOTE_CANVAS.h}`}
			width={QUOTE_CANVAS.w}
			height={QUOTE_CANVAS.h}
			// The frame is decoration; the heading inside it is the content. A
			// presentational role removes THIS element from the accessibility tree
			// without removing its children, so the title is announced as the
			// heading it is and the picture around it is announced as nothing.
			role="presentation"
			className="block h-auto max-h-full w-auto max-w-full"
			// ⛔ THE 545px CEILING IS A PROPERTY OF THE CANVAS AND BELONGS HERE.
			// `w-auto` resolves to 100% of the flex parent, so the `width`/`height`
			// ATTRIBUTES above supply the ratio and NOT a cap — measured: 532px
			// inside a 532px parent, i.e. the attribute never bound. Without this
			// the well scales PAST 545 on a wide column and paints the title above
			// its 60px ceiling (UIR-9; 56px before it), which is a canon clause 4
			// violation with no visible symptom. `.qstack`'s own `max-w` is belt,
			// and reads cosmetic enough to be deleted by someone tidying; this one
			// is next to the constant it enforces. Found by `@code-reviewer`.
			style={{ maxWidth: `${QUOTE_CANVAS.w}px` }}
		>
			<foreignObject x="0" y="0" width={QUOTE_CANVAS.w} height={QUOTE_CANVAS.h}>
				{/* ⚠ NO EXPLICIT `xmlns`, AND IT IS NOT AN OMISSION. React's DOM
				    renderer switches back to the XHTML namespace for `foreignObject`'s
				    children on its own, so the attribute would be redundant — and it does
				    not typecheck on a `<div>`, which leaves only an `as` cast to force it,
				    i.e. silencing a type error to restate something already true
				    (AGENTS.md §4/§11). Asserted rather than assumed:
				    `quote-well.test.tsx` reads the rendered node's `namespaceURI`. */}
				<div
					// UIR-9 — `border-white/7` is the 1px `rgb(255 255 255 / 0.07)`; the
					// fill is inline because it is per post.
					className={`qwell box-border flex h-full w-full flex-col items-center overflow-hidden${
						boxed ? " rounded-[var(--imgr)] border border-white/7" : ""
					}`}
					// ⚠ `pad` IS THE TOTAL INSET, so the 1px border is inside it — 23 + 1.
					// `size.ts` records why: 24px of padding within a border makes the
					// content 495 × 222 and every budget optimistic by 2px on a box that
					// clips. The dimensions come off the constants rather than being
					// restated, so the arithmetic and the render cannot drift apart.
					style={{
						backgroundColor: boxed ? fill : undefined,
						padding: `${boxed ? QUOTE_CANVAS.pad - 1 : QUOTE_CANVAS.pad}px`,
						// ⛔⛔ `safe center`, NOT `center`, AND THE KEYWORD IS WHAT MAKES THE
						// RATIFIED DEGRADATION THE RIGHT SHAPE. Canon clause 6 says a title
						// the estimate cannot fit "clips inside the canvas at the last full
						// line". Plain `center` splits the overflow across BOTH ends, so the
						// first thing lost is the OPENING QUOTATION MARK — measured with a
						// pathological 125-glyph title (estimate 5 lines, real 7–8): the top
						// mark's ink lands at y ≈ −17 in a canvas whose top is 0 and is
						// sliced off, while the closing mark renders whole. `safe` centres
						// while it fits and falls back to start-alignment when it does not,
						// which is the clause. Found by `@code-reviewer`; the arithmetic was
						// never wrong, the overflow BEHAVIOUR was. (UIR-9: the opening mark
						// rides the first line now, so the first line is what `safe` keeps.)
						justifyContent: "safe center",
					}}
				>
					<Heading
						data-testid="quote-well-title"
						className="qtitle m-0 text-center font-sans font-extrabold text-ink uppercase [overflow-wrap:anywhere] [text-wrap:balance]"
						style={{
							fontSize: `${size}px`,
							lineHeight: QUOTE_POSTER.lineHeight,
							letterSpacing: `${QUOTE_POSTER.tracking}em`,
						}}
					>
						<QuotedTitle title={title} mark={mark} />
					</Heading>
				</div>
			</foreignObject>
		</svg>
	);
}

/**
 * UIR-9 — the title with `“` directly before its first word and `”` directly
 * after its last, no space between. Each mark shares a `nowrap` span with its
 * word, so no line break can leave a mark alone on a line; the words between
 * keep the title's own spacing and wrap as before. The marks inherit the
 * heading's size and weight, take `mark` — the fill's tint — as their colour,
 * and are hidden from assistive technology, so the heading's name is still the
 * author's words alone.
 */
function QuotedTitle({ title, mark }: { title: string; mark: string }) {
	const text = title.trim();
	const first = text.search(/\s/);
	const glyph = (char: string) => (
		<span
			data-testid="quote-well-mark"
			aria-hidden="true"
			style={{ color: mark }}
		>
			{char}
		</span>
	);
	if (first === -1) {
		return (
			<span className="whitespace-nowrap">
				{glyph("“")}
				{text}
				{glyph("”")}
			</span>
		);
	}
	// The whitespace before the last word — equal to `first` for two words.
	const last = text.search(/\s\S*$/);
	return (
		<>
			<span className="whitespace-nowrap">
				{glyph("“")}
				{text.slice(0, first)}
			</span>
			{text.slice(first, last + 1)}
			<span className="whitespace-nowrap">
				{text.slice(last + 1)}
				{glyph("”")}
			</span>
		</>
	);
}
