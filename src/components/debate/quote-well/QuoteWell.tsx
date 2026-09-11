import {
	GEIST_QUOTE_INK,
	GEIST_QUOTE_TOP,
	GEIST_QUOTE_TOP_CLOSE,
	QUOTE_CANVAS,
	QUOTE_TYPE,
	quoteMarkSize,
	quoteTitleSize,
} from "./size";

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
 * `title`. ⛔ That does NOT make it server-only in practice: `PostCard` is
 * `"use client"`, so this renders on both passes — which is safe precisely
 * because it is pure, and would not be if it read a clock or a viewport.
 *
 * ⚠ THE UPPERCASE IS CSS. The DOM carries `post.title` verbatim in its stored
 * case, so the export, a copy-paste and a screen reader all get what the author
 * wrote; only the paint is capitalised. Canon clause 4 calls it a display
 * transform for that reason.
 *
 * ⛔ THE MARKS' LAYOUT BOXES ARE THEIR INK, AND THAT IS THE ONE PIECE OF
 * MACHINERY HERE. A `“` at `line-height: 1` occupies a full em of layout for
 * 0.311 em of ink (measured — `size.ts`), so laying the column out on line boxes
 * would reserve 137 px of the 224 px content height at the size ceiling and pay
 * for whitespace with title size. Each mark therefore gets `height` = its ink
 * and `position: relative; top` = minus the measured distance from its line-box
 * top to its ink top — a PAINT shift with no flow effect, so the column's
 * arithmetic is `2 × ink + 2 × gap + title`, which is exactly what
 * `quoteTitleSize` computes. Change one without the other and the budget starts
 * describing a render that does not exist.
 *
 * ⚠ THE TWO MARKS USE DIFFERENT OFFSETS BECAUSE THEY SIT AT DIFFERENT HEIGHTS —
 * `“` 0.129 em, `”` 0.145 em. See `size.ts`; it is 2.2 px at the mark ceiling,
 * on the one axis this box clips.
 *
 * ⛔ NO `-webkit-line-clamp`. It was specified as an optional belt and it is
 * MEASURED OUT: `text-wrap: balance` stops applying the moment the clamp
 * clamps, while `getComputedStyle` keeps reporting `balance`. The well's own
 * `overflow: hidden` is the backstop. Full reasoning at `quoteMaxLines`.
 */
export function QuoteWell({
	title,
	as: Heading = "h3",
}: {
	title: string;
	/**
	 * The heading element the plain title row used, so the document outline does
	 * not change when a post happens to carry no image. `PostCard` renders `h3`.
	 */
	as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}) {
	const size = quoteTitleSize(title.length);
	const mark = quoteMarkSize(size);
	const inkHeight = GEIST_QUOTE_INK * mark;

	/** Same for both marks bar the offset — see the docblock. */
	const markStyle = (top: number) => ({
		fontSize: `${mark}px`,
		lineHeight: 1,
		height: `${inkHeight}px`,
		top: `${-top * mark}px`,
	});

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
			// the ratified 56px ceiling, which is a canon clause 4 violation with no
			// visible symptom. `.qstack`'s own `max-w` is belt, and reads cosmetic
			// enough to be deleted by someone tidying; this one is next to the
			// constant it enforces. Found by `@code-reviewer`.
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
					className="qwell box-border flex h-full w-full flex-col items-center overflow-hidden rounded-[var(--imgr)] border border-n2 bg-n1"
					// ⚠ `pad` IS THE TOTAL INSET, so the 1px border is inside it — 23 + 1.
					// `size.ts` records why: 24px of padding within a border makes the
					// content 495 × 222 and every budget optimistic by 2px on a box that
					// clips. The dimensions come off the constants rather than being
					// restated, so the arithmetic and the render cannot drift apart.
					style={{
						padding: `${QUOTE_CANVAS.pad - 1}px`,
						gap: `${QUOTE_TYPE.gap}px`,
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
						// never wrong, the overflow BEHAVIOUR was.
						justifyContent: "safe center",
					}}
				>
					<span
						data-testid="quote-well-mark"
						aria-hidden="true"
						className="qmark relative block shrink-0 font-sans font-bold text-n4"
						style={markStyle(GEIST_QUOTE_TOP)}
					>
						{"“"}
					</span>
					<Heading
						data-testid="quote-well-title"
						className="qtitle m-0 text-center font-sans font-bold text-ink uppercase [overflow-wrap:anywhere] [text-wrap:balance]"
						style={{
							fontSize: `${size}px`,
							lineHeight: QUOTE_TYPE.lineHeight,
							letterSpacing: `${QUOTE_TYPE.tracking}em`,
						}}
					>
						{title}
					</Heading>
					<span
						data-testid="quote-well-mark"
						aria-hidden="true"
						className="qmark relative block shrink-0 font-sans font-bold text-n4"
						style={markStyle(GEIST_QUOTE_TOP_CLOSE)}
					>
						{"”"}
					</span>
				</div>
			</foreignObject>
		</svg>
	);
}
