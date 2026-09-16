import type { JSX } from "react";

/**
 * The eight-letter chessboard row — `Z U G Z W A N G`, alternating fills in
 * chessboard parity with the text inverting per cell, inside a single outer
 * hairline and no internal borders.
 *
 * ⛔ EXTRACTED, NOT DUPLICATED (O1-DECK-R2 §4). This markup used to live inline
 * inside `BrandCluster`, and the onboarding deck's first card needs the same
 * mark in place of a text title (SPEC.1 §21.9). A second copy would have let
 * the header and the card drift apart on the next retune, which is the one
 * thing the spec sentence promises cannot happen — so there is exactly one
 * component and both sites render it.
 *
 * ⛔ IT RENDERS THE LETTERS AND NOTHING ELSE. No countdown, no link, no
 * `aria-label`, no `tabIndex`. `BrandCluster` keeps its own link, its 48px mark
 * and `CountdownDigits`; the card supplies its own visually hidden heading. The
 * cluster is ONE link target to `/`, and an extraction that shipped its own
 * anchor would have quietly made it two.
 *
 * ⚠ THE SCALES ARE WRITTEN OUT, NOT COMPUTED. Tailwind cannot generate a class
 * from a runtime value, and an inline `style` width would have swapped a `rem`
 * utility for a `px` literal on the header — a change to the rendered width of
 * the brand, which the D-2 centring ruling is measured against. Keeping
 * `header` character-for-character the classes that shipped is what makes the
 * ≤0.5px re-measure a formality rather than a hope.
 *
 * `card` is 32px/21px: 21px is the size of the title string the wordmark
 * replaces, and 32 preserves the header's own 20:13 cell-to-letter ratio
 * (20/13 = 1.538; 21 × 1.538 ≈ 32). Neither number is invented — there is no
 * ratified type ramp to take a step on (design-language §2.2 leaves
 * `type.scale.*` blank), so both are derived from values already in the tree.
 *
 * ⛔ `phone` IS THE ONE SCALE WHOSE CELL IS NOT SQUARE, AND THAT IS INHERITED
 * RATHER THAN CHOSEN. It is 13×17 because `CountdownDigits`' `phone` row is
 * 13×17, and the two rows have to share a column width or they stop being one
 * chessboard rect — the `-mt-px` that collapses their borders assumes it. The
 * 13 was dimensioned for MONOSPACE DIGITS, which are narrower than `W`, so the
 * letters sit tighter here than they do at any other scale: measured in a real
 * browser, `W` is 9.86px in a 13px cell (0.758 of it) against the `header`
 * scale's 13.49px in 20px (0.674). Nothing clips — 1.57px each side — but the
 * crowding is a consequence of the digits' metric, not a judgement about type.
 *
 * ⛔ AND IT CANNOT BE BOUGHT BACK BY WIDENING THE CELL. Matching `header`'s
 * breathing wants ~14.6px cells, and 14 is already past the ceiling: at 320
 * signed out the header row lands EXACTLY on its content-box edge with the
 * 13px cell, and one pixel more deletes the 48px mark outright (it is the only
 * item in that row without `shrink-0`) and then starts eating the 24px gutter.
 * The full sweep is in the PR that shipped this scale. ⇒ 13 is a ceiling, not
 * a preference; a later eye that wants roomier letters has to spend something
 * else in the row first.
 *
 * ⚠ `phone` STATES ITS LEADING AND THE OTHER TWO DO NOT — the arbitrary
 * `text-[Npx]` form does NOT reset the line-height paired with whatever step
 * was in scope (AGENTS.md §8), so `text-[9.5px]` alone would inherit a leading
 * from an ancestor and move the letters off the baseline the approved render
 * was measured at. `header` and `card` are left character-for-character as they
 * shipped; adding a leading to them would be a change to the desktop brand.
 */
const LETTERS = ["Z", "U", "G", "Z", "W", "A", "N", "G"] as const;

const SCALE = {
	/** The global header — the shipped values, unchanged. */
	header: { cell: "size-5", text: "text-[13px]" },
	/** Onboarding deck card 1, in place of the text title. */
	card: { cell: "size-8", text: "text-[21px]" },
	/** The phone tier's brand block — row 1 above `CountdownDigits`' `phone`. */
	phone: { cell: "h-[17px] w-[13px]", text: "text-[9.5px] leading-none" },
} as const;

export type WordmarkScale = keyof typeof SCALE;

export function Wordmark({ scale }: { scale: WordmarkScale }): JSX.Element {
	const { cell, text } = SCALE[scale];
	return (
		<span aria-hidden="true" className="flex [border:var(--hairline)]">
			{LETTERS.map((letter, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 8-letter row — positional cells.
					key={i}
					className={
						i % 2 === 0
							? `flex ${cell} items-center justify-center bg-n0 font-sans ${text} font-extrabold text-ink`
							: `flex ${cell} items-center justify-center bg-ink font-sans ${text} font-extrabold text-n0`
					}
				>
					{letter}
				</span>
			))}
		</span>
	);
}
