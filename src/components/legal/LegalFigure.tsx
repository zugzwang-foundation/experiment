import type { ReactElement } from "react";

/**
 * The `/legal` margin figures — ONE component and ONE registry, for seventeen
 * placements across two documents.
 *
 * ⛔ WHY A REGISTRY AND NOT SEVENTEEN INLINE SVGs. This repo already carries
 * the same brand mark hand-rolled in more than one place, and that drift is
 * docketed rather than fixed; seventeen inline blocks on a single page would
 * reproduce it at five times the scale, and the second time somebody wants the
 * envelope to change they would have to find both of them. The envelope is in
 * fact drawn ONCE and placed TWICE — Terms §12 and Privacy §5 both name
 * `envelope-open` — which is the registry earning its keep on day one rather
 * than in principle.
 *
 * ⚠ EVERY FIGURE IS DECORATION, and the markup says so three ways: `aria-hidden`
 * (a screen reader never meets it), `pointer-events-none` (it never takes a
 * click meant for the text), and a position that puts it OUTSIDE the text
 * column by construction. `right-full` / `left-full` anchor the figure's near
 * edge to the wrapper's edge, so "does not overlap the measure" is a fact about
 * the box model rather than a margin somebody tuned and hopes holds.
 *
 * ⚠ IT DOES NOT RENDER BELOW `md`. There is no margin to draw in at 320 or 390
 * — the text column already fills the viewport there — and that width has a
 * pre-existing horizontal-overflow problem this page is not going to add to.
 * `hidden md:block` is the whole mechanism.
 *
 * ⚠ COLOUR ARRIVES THROUGH THE TOKEN LAYER. `text-n2` (#404040) against the
 * page's `--color-ground` (#181818) is two steps up from the ground and four
 * below the body's `text-n6` — visible as line, unable to compete with a
 * sentence. `currentColor` on every stroke means the figure inherits that one
 * decision instead of restating it seventeen times, and
 * `tests/unit/design/no-raw-hex-view-layer.test.ts` scans this file
 * automatically because it lives under `src/components`.
 *
 * ⚠ NO FILLS, ANYWHERE. Line art at this contrast reads by its outline; a fill
 * at `text-n2` would be a smudge at 64px and invisible at any smaller size.
 */

/** Every figure is drawn in this box, so sizing is a class and never a prop. */
const VIEW_BOX = "0 0 48 48";

/**
 * The registry. Keys are named for what is drawn, not for the section that uses
 * one — `envelope-open` is placed twice, and a key called `terms-12` could not
 * have been.
 */
const FIGURES = {
	/** Terms §1 — the experiment's window: an hourglass between two date marks. */
	"hourglass-dates": (
		<>
			<path d="M16 9h16M16 39h16M16 9l8 15 8-15M16 39l8-15 8 15" />
			<path d="M6 20v8M42 20v8" />
		</>
	),
	/** Terms §2 — eligibility: a threshold, one side crossed. */
	"threshold-crossed": (
		<>
			<path d="M6 30h36" />
			<path d="M28 12l10 10M38 12L28 22" />
		</>
	),
	/** Terms §3 — the assigned identity: a tile with a featureless circle. */
	"tile-circle": (
		<>
			<rect x="11" y="11" width="26" height="26" rx="4" />
			<circle cx="24" cy="24" r="7" />
		</>
	),
	/** Terms §4 — Dharma has no value: a coin struck through. */
	"coin-struck": (
		<>
			<circle cx="24" cy="24" r="12" />
			<path d="M14 34L34 14" />
		</>
	),
	/** Terms §5 — resolution: two paths converging on one point. */
	"paths-converging": (
		<>
			<path d="M7 13l24 11M7 35l24-11" />
			<circle cx="34" cy="24" r="3" />
		</>
	),
	/**
	 * Terms §6 — acceptable use: a boundary with one gap. The gap is EMPTY —
	 * one continuous path that stops at y=20 and resumes at y=28. A dashed
	 * segment across it was drawn first and cut: a dashed line is still a line,
	 * and the figure has to be missing something for the gap to read as a gap.
	 */
	"boundary-gap": <path d="M36 20V12H12v24h24v-8" />,
	/** Terms §7 — moderation: a sieve, one shape caught. */
	"sieve-caught": (
		<>
			<path d="M10 21a14 14 0 0 0 28 0" />
			<circle cx="24" cy="17" r="3.5" />
			<path d="M17 30v4M24 32v4M31 30v4" />
		</>
	),
	/** Terms §8 — the licence you grant: a page with arrows leaving outward. */
	"page-arrows-out": (
		<>
			<rect x="16" y="11" width="16" height="26" rx="2" />
			<path d="M36 18h8m-3-3l3 3-3 3" />
			<path d="M12 30H4m3-3l-3 3 3 3" />
		</>
	),
	/** Terms §9 — disclaimers: a plain tag on a thread. */
	"tag-thread": (
		<>
			<path d="M17 15h14v16l-7 8-7-8z" />
			<circle cx="24" cy="21" r="2" />
			<path d="M24 15V9" />
		</>
	),
	/** Terms §10 — liability: an open umbrella, sparse ribs. */
	umbrella: (
		<>
			<path d="M9 26a15 15 0 0 1 30 0" />
			<path d="M24 11v25" />
			<path d="M24 36a4 4 0 0 0 8 0" />
			<path d="M16.5 26L24 11l7.5 15" />
		</>
	),
	/** Terms §11 — open source: a branching graph, three branches. */
	"branching-graph": (
		<>
			<path d="M8 24h12M20 24l14-11M20 24h14M20 24l14 11" />
			<circle cx="37" cy="13" r="2.5" />
			<circle cx="37" cy="24" r="2.5" />
			<circle cx="37" cy="35" r="2.5" />
		</>
	),
	/** Terms §12 and Privacy §5 — contact: an open envelope. Drawn once. */
	"envelope-open": (
		<>
			<rect x="9" y="21" width="30" height="18" rx="2" />
			<path d="M9 21l15-12 15 12" />
		</>
	),
	/** Privacy §1 — what we collect: four small labelled boxes. */
	"four-boxes": (
		<>
			<rect x="7" y="9" width="15" height="12" rx="2" />
			<rect x="26" y="9" width="15" height="12" rx="2" />
			<rect x="7" y="27" width="15" height="12" rx="2" />
			<rect x="26" y="27" width="15" height="12" rx="2" />
			<path d="M10 17h7M29 17h7M10 35h7M29 35h7" />
		</>
	),
	/** Privacy §2 — processors: a hub with eight spokes. */
	"hub-spokes": (
		<>
			<circle cx="24" cy="24" r="5" />
			<path d="M32 24h10M16 24H6M24 32v10M24 16V6" />
			<path d="M29.7 29.7l7 7M18.3 18.3l-7-7M29.7 18.3l7-7M18.3 29.7l-7 7" />
		</>
	),
	/** Privacy §3 — cookies: one small token, and nothing behind it. */
	"token-alone": (
		<>
			<circle cx="24" cy="24" r="6" />
			<circle cx="24" cy="24" r="1.5" />
		</>
	),
	/** Privacy §4 — retention: an hourglass run out, contents below. */
	"hourglass-run-out": (
		<>
			<path d="M16 9h16M16 39h16M16 9l8 15 8-15M16 39l8-15 8 15" />
			<circle cx="21" cy="35" r="1.5" />
			<circle cx="24" cy="36" r="1.5" />
			<circle cx="27" cy="35" r="1.5" />
		</>
	),
} as const;

export type LegalFigureName = keyof typeof FIGURES;

/**
 * ⛔ THE SIZE STEPS AT `lg` FOR A MEASURED REASON, not for polish. At exactly
 * `md` (768px) the container is 736px wide, the `w-fit` measure is ~500px, and
 * the gutter each side is therefore ~118px. A 96px figure plus a 32px gap is
 * 128px and would push past the viewport edge — on the one width that already
 * has a horizontal-overflow problem. 64px plus 16px fits with room to spare,
 * and the wider figure waits for the width that can hold it.
 */
const SIDE_CLASSES = {
	left: "right-full mr-4 lg:mr-8",
	right: "left-full ml-4 lg:ml-8",
} as const;

export function LegalFigure({
	name,
	side,
}: {
	name: LegalFigureName;
	side: "left" | "right";
}): ReactElement {
	return (
		<span
			aria-hidden="true"
			className={`pointer-events-none absolute top-1 hidden text-n2 md:block ${SIDE_CLASSES[side]}`}
		>
			{/* `aria-hidden` on the svg as well as the span, and NO `<title>`. A
			    title is an accessible name, and naming a decoration is how a
			    screen reader ends up reading "hourglass" in the middle of a
			    sentence about liability. The double marking is also what
			    exempts this from the svg-needs-a-title lint rule honestly,
			    rather than by adding the name it exists to withhold. */}
			<svg
				aria-hidden="true"
				viewBox={VIEW_BOX}
				fill="none"
				stroke="currentColor"
				strokeWidth={1}
				strokeLinecap="round"
				strokeLinejoin="round"
				className="size-16 lg:size-24"
			>
				{FIGURES[name]}
			</svg>
		</span>
	);
}
