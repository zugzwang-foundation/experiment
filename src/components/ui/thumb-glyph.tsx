import type { Side } from "@/components/debate/types";

/**
 * **The thumb glyph.** Ratified by canon §3 item 13, which pins it BY COMPONENT
 * NAME AND PROPS and lands in the SAME COMMIT as this file (CLAUDE.md §5.12).
 *
 * ⚠ THIS IS A LIFT, NOT A MINT. The whole implementation existed as a
 * module-local `ThumbGlyph` in `debate/composer/SlotHeader.tsx` with exactly one
 * call site, and is carried here BYTE-FOR-BYTE: the path literal, the
 * `0 0 14 14` viewBox, `aria-hidden`, the rotation on the `<svg>` rather than
 * the `<path>`, and the single conditional spread. ⛔ THE ONLY CHANGE IS
 * `width="16" height="16"` becoming `width={size} height={size}` — the slot
 * header's re-point must render byte-identically, which is what `size`'s
 * default of 16 buys and what its own suite proves.
 *
 * SIZE DOES NOT INHERIT. The values-log scopes 16 to the slot header BY NAME;
 * the profile positions table's thumb is 12px in its own mockup. Neither value
 * is the other's default, so the caller states it.
 *
 * ⛔ THE MOCKUP DOES NOT GOVERN THE NO ARM. Its `THDN` is
 * `fill="none" stroke="currentColor"` — STROKED. The values-log supersedes it
 * and the shipped form is the ratified one: FILLED `--color-no` via `fill-no`,
 * `stroke="none"`, rotated 180°. "Match the mockup" regresses this.
 *
 * ⚠ A NAMED EXCEPTION TO THE `ui/` MARKER CONVENTION: this leaf carries NO
 * `data-*` marker of its own. Conventions 1, 2, 4, 6 and 8 apply unchanged. The
 * marker convention exists so a consumer's render test can key on a STATE
 * BLOCK; a glyph inside a composed header is not one and has no assertion of
 * its own to serve — and an added attribute would break the byte-identical
 * re-point above. The obligation outranks the convention, and the convention's
 * purpose is not engaged.
 */

/** The locked d5 thumb glyph (14×14 viewBox; slot-header size 16). */
const THUMB_PATH =
	"M1.6 6.4h2.1v5.4H1.6z M3.7 11.2V6.9l2.3-4.1c.9 0 1.5.7 1.3 1.6L6.9 6h3.5c.8 0 1.4.7 1.2 1.5l-.8 2.9c-.2.8-.8 1.4-1.6 1.4H3.7z";

/** Thumb-up stroked currentColor; thumb-down FILLED `--color-no`, rotated 180° (values-log §1 item 3). */
export function ThumbGlyph({ side, size = 16 }: { side: Side; size?: number }) {
	return (
		<svg
			viewBox="0 0 14 14"
			width={size}
			height={size}
			aria-hidden="true"
			className={side === "NO" ? "rotate-180" : undefined}
		>
			<path
				d={THUMB_PATH}
				{...(side === "YES"
					? {
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.1,
							strokeLinejoin: "round" as const,
						}
					: { className: "fill-no", stroke: "none" })}
			/>
		</svg>
	);
}
