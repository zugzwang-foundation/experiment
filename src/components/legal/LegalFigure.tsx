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
 * ══ THE HOUSE STYLE, MEASURED OFF `src/components/onboarding/figures.tsx` ══
 *
 * These were first drawn as thin, low-contrast, fill-less line art at a 48-unit
 * box. That was wrong, and it was wrong by not looking: the product already has
 * an infographic language and this page ignored it. Redrawn to it, and every
 * number below is counted from that file rather than invented here.
 *
 *   · **Box.** `viewBox="0 0 220 120"` — all five deck figures use it, and so do
 *     all sixteen here. `font-sans` sits on the `<svg>`, not on each `<text>`,
 *     because `font-family` inherits through SVG.
 *   · **Mass, not outline.** Fills carry the meaning: `var(--color-ink)` for a
 *     solid mark (10 uses there), `var(--color-n0)` for a shape that is
 *     outlined but opaque (8), `fill="none"` only where a stroke is the whole
 *     point (4).
 *   · **Stroke.** 2 is the primary weight (14 uses), 1.5 for leaders and
 *     secondary rules (4), 3–3.5 reserved for emphasis.
 *   · **Colour is near-ink and always a token.** `--color-ink` strokes (12),
 *     `--color-n4` for secondary (5), `--color-n5`/`--color-n3` below that.
 *     ZERO literal hex in that file, and zero here.
 *   · **Type is part of the drawing.** `textAnchor="middle"`, `fontWeight="800"`
 *     (8 of 9 uses), uppercase for labels, `--color-n0` knocked out of a filled
 *     ink shape and `--color-n5`/`n6` for captions. The scale runs 10–27.
 *   · **Corners.** `rx` 2 for a chip, 6 for a card, half-height for a pill.
 *
 * ⚠ TYPE IS SIZED FOR THE SMALLEST RENDERING, not the largest. At `md` the
 * figure is 110px wide against a 220-unit box — a 0.5 scale — so a caption set
 * at the deck's own 10–11 would land at 5px. Captions here are 13–15 and
 * primary labels 18–22, which put the smallest legible text at ~6.5px at `md`,
 * ~12px at `lg` and ~18px at `xl`. Stated because it is a real cost of drawing
 * into a 143px gutter, not a thing that came out right by luck.
 *
 * ⛔ THE NEUTRAL RAMP ONLY — NO POLE TOKENS, INCLUDING IN THE ONE FIGURE THAT
 * WAS PERMITTED THEM. `--color-yes` / `--color-no` encode BET SIDE (INV-3) and
 * `paths-converging` is the only figure here about a market resolving, so it
 * could have used them. It does not, for a measured reason: `--color-yes` is
 * `#181818`, which is EXACTLY `--color-ground`, so a YES panel filled with the
 * YES token would be invisible on this page. The deck's own `SideFigure` hits
 * the same wall and solves it the same way — it renders YES as filled
 * `--color-ink` and NO as `--color-n0` with an ink stroke. That is the house's
 * real YES/NO encoding on a dark ground, and it is what this figure uses.
 */

/** Every figure is drawn in this box, so sizing is a class and never a prop. */
const VIEW_BOX = "0 0 220 120";

/**
 * The registry. Keys are named for what is drawn, not for the section that uses
 * one — `envelope-open` is placed twice, and a key called `terms-12` could not
 * have been.
 *
 * ⚠ Two names now describe the drawing less exactly than they did, and they are
 * KEPT rather than renamed: `coin-struck` is now a `Đ = 0` equation (the
 * equation states the section's claim; a strike through the coin only muddied
 * it), and `paths-converging` is positions resolving into one outcome panel.
 * Renaming a registry key is a rename at every call site and in the tests, for
 * no gain a reader of this file cannot get from the docblock beside the entry.
 */
const FIGURES = {
	/** Terms §1 — the window the experiment runs in, with its two dates. */
	"hourglass-dates": (
		<>
			<text
				x="110"
				y="17"
				textAnchor="middle"
				fontSize="15"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				15 SEP
			</text>
			<line
				x1="80"
				y1="28"
				x2="140"
				y2="28"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<line
				x1="80"
				y1="94"
				x2="140"
				y2="94"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<path
				d="M86 28 L134 28 L110 61 L134 94 L86 94 L110 61 Z"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			{/* The sand: mass in both chambers, mid-run. */}
			<path d="M93 34 L127 34 L110 57 Z" fill="var(--color-ink)" />
			<path d="M96 94 L124 94 L110 76 Z" fill="var(--color-ink)" />
			<line
				x1="110"
				y1="62"
				x2="110"
				y2="74"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
			<text
				x="110"
				y="112"
				textAnchor="middle"
				fontSize="15"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				5 NOV
			</text>
		</>
	),

	/** Terms §2 — eligibility: the threshold you cross, and its condition. */
	"threshold-crossed": (
		<>
			<rect
				x="80"
				y="30"
				width="60"
				height="52"
				rx="6"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="110"
				y="66"
				textAnchor="middle"
				fontSize="24"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				18+
			</text>
			<line
				x1="46"
				y1="94"
				x2="174"
				y2="94"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<polygon points="46,46 46,72 68,59" fill="var(--color-n4)" />
		</>
	),

	/** Terms §3 — the assigned identity: picture, pseudonym, and it is locked. */
	"tile-circle": (
		<>
			{/* ⚠ 96 WIDE, NOT 80. Measured: `RedOwl006` at fontSize 14 weight 800
			    has a bbox of 83 units, so an 80-unit tile let the pseudonym hang
			    off both edges — visible in the 1440 screenshot before this was
			    caught. The tile is sized to its content rather than the type
			    shrunk to the tile, because the pseudonym is the thing this figure
			    is about. */}
			<rect
				x="62"
				y="14"
				width="96"
				height="70"
				rx="8"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle cx="110" cy="40" r="15" fill="var(--color-ink)" />
			<text
				x="110"
				y="72"
				textAnchor="middle"
				fontSize="14"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				RedOwl006
			</text>
			{/* The padlock idiom, lifted from the deck's `SideFigure`. */}
			<g transform="translate(99,90)">
				<rect
					x="0"
					y="9"
					width="22"
					height="17"
					rx="2"
					fill="var(--color-ink)"
				/>
				<path
					d="M4 9 V6 a7 7 0 0 1 14 0 V9"
					fill="none"
					stroke="var(--color-ink)"
					strokeWidth="2"
				/>
			</g>
		</>
	),

	/** Terms §4 — Dharma has no value, stated as the equation it is. */
	"coin-struck": (
		<>
			<circle
				cx="66"
				cy="60"
				r="26"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="66"
				y="71"
				textAnchor="middle"
				fontSize="30"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				Đ
			</text>
			<text
				x="118"
				y="71"
				textAnchor="middle"
				fontSize="26"
				fontWeight="800"
				fill="var(--color-n5)"
			>
				=
			</text>
			<text
				x="160"
				y="73"
				textAnchor="middle"
				fontSize="34"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				0
			</text>
		</>
	),

	/**
	 * Terms §5 — open positions resolving to one outcome. The two-panel YES/NO
	 * treatment is the deck's `SideFigure`, ink-filled and n0, for the reason
	 * the docblock above gives.
	 */
	"paths-converging": (
		<>
			<g fill="var(--color-n0)" stroke="var(--color-n4)" strokeWidth="1.5">
				<rect x="20" y="30" width="34" height="16" rx="8" />
				<rect x="20" y="52" width="34" height="16" rx="8" />
				<rect x="20" y="74" width="34" height="16" rx="8" />
			</g>
			<line
				x1="62"
				y1="60"
				x2="98"
				y2="60"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<polygon points="98,52 114,60 98,68" fill="var(--color-n4)" />
			<rect x="126" y="44" width="36" height="32" fill="var(--color-ink)" />
			<rect x="162" y="44" width="36" height="32" fill="var(--color-n0)" />
			<rect
				x="126"
				y="44"
				width="72"
				height="32"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="144"
				y="65"
				textAnchor="middle"
				fontSize="13"
				fontWeight="800"
				fill="var(--color-n0)"
			>
				YES
			</text>
			<text
				x="180"
				y="65"
				textAnchor="middle"
				fontSize="13"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				NO
			</text>
		</>
	),

	/**
	 * Terms §6 — acceptable use: a wall with a real gap. The gap is EMPTY. A
	 * dashed segment was drawn across it first and cut — a dashed line is still
	 * a line, and the wall has to be missing something for the gap to read.
	 */
	"boundary-gap": (
		<>
			<g fill="var(--color-ink)">
				<rect x="26" y="40" width="26" height="40" rx="2" />
				<rect x="58" y="40" width="26" height="40" rx="2" />
				<rect x="90" y="40" width="26" height="40" rx="2" />
				<rect x="154" y="40" width="26" height="40" rx="2" />
				<rect x="186" y="40" width="26" height="40" rx="2" />
			</g>
			<line
				x1="22"
				y1="88"
				x2="216"
				y2="88"
				stroke="var(--color-n4)"
				strokeWidth="1.5"
			/>
		</>
	),

	/** Terms §7 — moderation: a filter, and one thing caught in it. */
	"sieve-caught": (
		<>
			<path
				d="M52 24 H168 L124 74 V104 H96 V74 Z"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle cx="110" cy="42" r="13" fill="var(--color-ink)" />
			<circle cx="110" cy="114" r="4" fill="var(--color-n4)" />
		</>
	),

	/** Terms §8 — your content, published outward under an open licence. */
	"page-arrows-out": (
		<>
			<rect
				x="74"
				y="14"
				width="72"
				height="62"
				rx="6"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<g stroke="var(--color-n3)" strokeWidth="3">
				<line x1="86" y1="32" x2="134" y2="32" />
				<line x1="86" y1="44" x2="124" y2="44" />
				<line x1="86" y1="56" x2="134" y2="56" />
			</g>
			<line
				x1="66"
				y1="45"
				x2="40"
				y2="45"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<polygon points="40,37 24,45 40,53" fill="var(--color-n4)" />
			<line
				x1="154"
				y1="45"
				x2="180"
				y2="45"
				stroke="var(--color-n4)"
				strokeWidth="2"
			/>
			<polygon points="180,37 196,45 180,53" fill="var(--color-n4)" />
			<text
				x="110"
				y="104"
				textAnchor="middle"
				fontSize="16"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				CC BY 4.0
			</text>
		</>
	),

	/** Terms §9 — disclaimers: the tag the Service is handed over on. */
	"tag-thread": (
		<>
			<path
				d="M58 60 L86 26 H172 V94 H86 Z"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle
				cx="84"
				cy="60"
				r="6"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<text
				x="132"
				y="70"
				textAnchor="middle"
				fontSize="22"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				AS IS
			</text>
		</>
	),

	/**
	 * Terms §10 — liability: shelter, and the one it is over.
	 *
	 * ⚠ THE CANOPY IS A 46-RADIUS SEMICIRCLE, NOT A 70. Measured: the first
	 * draft spanned x40→x180 as a semicircle, which puts its apex at
	 * `62 − 70 = −8` — eight units ABOVE the viewBox, clipped on every render.
	 * A `getBBox()` sweep over all sixteen figures caught it; nothing in the
	 * page's own layout would have, because an SVG clips silently.
	 */
	umbrella: (
		<>
			<path d="M64 64 A46 46 0 0 1 156 64 Z" fill="var(--color-ink)" />
			<line
				x1="110"
				y1="64"
				x2="110"
				y2="100"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<path
				d="M110 100 a9 9 0 0 0 18 0"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle cx="80" cy="82" r="9" fill="var(--color-n5)" />
			<rect
				x="70"
				y="95"
				width="20"
				height="22"
				rx="10"
				fill="var(--color-n5)"
			/>
		</>
	),

	/** Terms §11 — open source: the tree, and the licence it is under. */
	"branching-graph": (
		<>
			<line
				x1="36"
				y1="52"
				x2="86"
				y2="52"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<g stroke="var(--color-n4)" strokeWidth="2" fill="none">
				<path d="M86 52 L136 22" />
				<path d="M86 52 H136" />
				<path d="M86 52 L136 82" />
			</g>
			<g fill="var(--color-ink)">
				<circle cx="36" cy="52" r="8" />
				<circle cx="140" cy="22" r="8" />
				<circle cx="140" cy="52" r="8" />
				<circle cx="140" cy="82" r="8" />
			</g>
			<text
				x="110"
				y="112"
				textAnchor="middle"
				fontSize="16"
				fontWeight="800"
				fill="var(--color-n6)"
			>
				AGPL-3.0
			</text>
		</>
	),

	/** Terms §12 and Privacy §5 — contact. Drawn once, placed twice. */
	"envelope-open": (
		<>
			<rect
				x="84"
				y="18"
				width="52"
				height="40"
				rx="2"
				fill="var(--color-ink)"
			/>
			<rect
				x="56"
				y="46"
				width="108"
				height="58"
				rx="4"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<path
				d="M56 48 L110 12 L164 48"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
		</>
	),

	/** Privacy §1 — the four things collected, named. */
	"four-boxes": (
		<>
			<g fill="var(--color-n0)" stroke="var(--color-ink)" strokeWidth="2">
				<rect x="18" y="24" width="88" height="30" rx="6" />
				<rect x="114" y="24" width="88" height="30" rx="6" />
				<rect x="18" y="66" width="88" height="30" rx="6" />
				<rect x="114" y="66" width="88" height="30" rx="6" />
			</g>
			<g
				textAnchor="middle"
				fontSize="15"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				<text x="62" y="44">
					EMAIL
				</text>
				<text x="158" y="44">
					GOOGLE
				</text>
				<text x="62" y="86">
					IP · UA
				</text>
				<text x="158" y="86">
					ACTIVITY
				</text>
			</g>
		</>
	),

	/** Privacy §2 — the hub, and the processors it hands work to. */
	"hub-spokes": (
		<>
			<g stroke="var(--color-n4)" strokeWidth="1.5">
				<line x1="132" y1="60" x2="150" y2="60" />
				<line x1="126" y1="74" x2="139" y2="87" />
				<line x1="110" y1="82" x2="110" y2="100" />
				<line x1="94" y1="74" x2="81" y2="87" />
				<line x1="88" y1="60" x2="70" y2="60" />
				<line x1="94" y1="46" x2="81" y2="33" />
				<line x1="110" y1="38" x2="110" y2="20" />
				<line x1="126" y1="46" x2="139" y2="33" />
			</g>
			<g fill="var(--color-n5)">
				<circle cx="158" cy="60" r="7" />
				<circle cx="145" cy="93" r="7" />
				<circle cx="110" cy="108" r="7" />
				<circle cx="75" cy="93" r="7" />
				<circle cx="62" cy="60" r="7" />
				<circle cx="75" cy="27" r="7" />
				<circle cx="110" cy="12" r="7" />
				<circle cx="145" cy="27" r="7" />
			</g>
			<circle cx="110" cy="60" r="22" fill="var(--color-ink)" />
			<text
				x="110"
				y="69"
				textAnchor="middle"
				fontSize="22"
				fontWeight="800"
				fill="var(--color-n0)"
			>
				Z
			</text>
		</>
	),

	/** Privacy §3 — cookies: one session token, and nothing else. */
	"token-alone": (
		<>
			<rect
				x="52"
				y="42"
				width="116"
				height="36"
				rx="18"
				fill="var(--color-n0)"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<circle cx="74" cy="60" r="8" fill="var(--color-ink)" />
			<text
				x="122"
				y="67"
				textAnchor="middle"
				fontSize="16"
				fontWeight="800"
				fill="var(--color-ink)"
			>
				SESSION
			</text>
		</>
	),

	/** Privacy §4 — the hourglass run out, and the record that persists. */
	"hourglass-run-out": (
		<>
			<line
				x1="84"
				y1="12"
				x2="136"
				y2="12"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<line
				x1="84"
				y1="76"
				x2="136"
				y2="76"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			<path
				d="M89 12 L131 12 L110 44 L131 76 L89 76 L110 44 Z"
				fill="none"
				stroke="var(--color-ink)"
				strokeWidth="2"
			/>
			{/* Top chamber empty; everything has fallen through. */}
			<path d="M95 76 L125 76 L110 53 Z" fill="var(--color-ink)" />
			<rect
				x="34"
				y="90"
				width="152"
				height="26"
				rx="4"
				fill="var(--color-ink)"
			/>
			<text
				x="110"
				y="108"
				textAnchor="middle"
				fontSize="15"
				fontWeight="800"
				fill="var(--color-n0)"
			>
				RECORD
			</text>
		</>
	),
} as const;

export type LegalFigureName = keyof typeof FIGURES;

/**
 * ⛔ SIZED TO THE MEASURED GUTTER, not to a guess. The text column is 481.97px
 * wide, so the space between it and the viewport edge — measured against the
 * compiled build — is:
 *
 *   md   768 → 143.07px   ·   lg  1024 → 270.88px
 *   xl  1280 → 399.00px   ·   2xl 1536 → 527.13px
 *
 * The previous drawing used 64px at `md` and 96px at `lg`: a fifth of what was
 * there. These take ~77% of the gutter at `md` and ~74% at `lg`/`xl`, and the
 * gap grows with the room — 16px, 24px, 32px — so the figure never crowds the
 * text at the width where the gutter is tightest.
 *
 *   md 143.07 − 16 − 110 = 17.07px to the viewport edge
 *   lg 270.88 − 24 − 200 = 46.88px
 *   xl 399.00 − 32 − 290 = 77.00px
 *
 * ⚠ IT STOPS GROWING AT `xl`. At `2xl` the gutter is 527px and a 400px figure
 * would fit — and would be a 400px illustration beside a 482px column, which is
 * a page about the figures. 290px is where a margin figure stays a margin
 * figure.
 */
const SIZE_CLASSES = "w-[110px] lg:w-[200px] xl:w-[290px]";

const SIDE_CLASSES = {
	left: "right-full mr-4 lg:mr-6 xl:mr-8",
	right: "left-full ml-4 lg:ml-6 xl:ml-8",
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
			className={`pointer-events-none absolute top-1 hidden md:block ${SIDE_CLASSES[side]}`}
		>
			{/* `aria-hidden` on the svg as well as the span, and NO `<title>`. A
			    title is an accessible name, and naming a decoration is how a
			    screen reader ends up reading "hourglass" in the middle of a
			    sentence about liability. The double marking is also what
			    exempts this from the svg-needs-a-title lint rule honestly,
			    rather than by adding the name it exists to withhold.

			    NO `fill` / `stroke` / `strokeWidth` DEFAULTS ON THIS ELEMENT.
			    The deck's figures set every colour and weight per element, and
			    inheriting a default here would mean a figure's mass depended on
			    a value declared two hundred lines away from the shape. */}
			<svg
				aria-hidden="true"
				viewBox={VIEW_BOX}
				className={`block h-auto font-sans ${SIZE_CLASSES}`}
			>
				{FIGURES[name]}
			</svg>
		</span>
	);
}
