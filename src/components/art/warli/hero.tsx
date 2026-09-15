"use client";

import { useEffect, useRef } from "react";

import { FIELD_ASSET_HREF } from "./field-asset";
import { INNER_FIGURES, OUTER_FIGURES } from "./figures";
import { Ring } from "./ring";

/**
 * Two rings of figures turning against each other around a still centre.
 *
 * At rest every one of the eight pairs stands on a shared radius, head to head
 * across the gap. Then the rings turn opposite ways, the pairs drift apart, and
 * because the speeds are equal and opposite they come back into full
 * confrontation on a fixed period and drift apart again. Nothing resolves. That
 * is the whole argument, and it is why this is a ring rather than a row — a row
 * has ends, and an argument with ends is one somebody won.
 *
 * ⚠ NOTHING HERE ANIMATES IN JAVASCRIPT. There is no `requestAnimationFrame`,
 * no interval and no state that changes per frame. Two `<g>` elements carry a
 * CSS animation, and the sixteen figures underneath are a fixed drawing computed
 * once (`./ring.tsx`), so nothing re-lays-out per frame.
 *
 * ⚠ WHAT THIS DOCBLOCK NO LONGER CLAIMS: that the compositor promotes the two
 * groups to their own layers. That sentence was here and was never measured.
 * Blink has historically not layerised SVG sub-trees, nothing sets
 * `will-change`, and the two animated groups hold 525 and 295 elements. So the
 * honest statement is the one above — no per-frame layout — and the per-frame
 * cost is a raster of two rotated groups, which is a different and unmeasured
 * quantity. Naming a mechanism nobody measured is O-13's shape one register
 * over. The frame trace is OWED; it could not be taken in this run because
 * `requestAnimationFrame` does not fire in an automation tab.
 *
 * What WAS measured: a forced style + layout of the whole SVG costs 1.085 ms
 * (mean of 20), which bounds the worst case where none of this is composited.
 */

/** The frame. 1440 is the design width; 1000 is the smallest height that never
 *  clips the outer ring at any rotation phase. */
export const VIEW_WIDTH = 1440;
export const VIEW_HEIGHT = 1000;

/**
 * The inner radius, and the number every other number here is derived from.
 *
 * The auth column is `PageContainer` preset `auth` — `max-w-md` (448) less
 * `px-4` either side — so the card is 416 wide and about 480 tall, giving a
 * half-diagonal of √(208² + 240²) ≈ 317.6. This is that, rounded up with 12
 * units to spare, which is what lets the card CLEAR the artwork instead of
 * sitting on top of it. Shrink it and the corners of the sign-in card start
 * eating figures.
 */
export const R_INNER = 330;

/** 500 − 470 = 30 units of margin top and bottom. No clip at any phase. */
export const R_OUTER = 470;

/**
 * Where the static field is served from — `public/art/warli-field.<hash>.svg`,
 * generated from `<FieldLayer />` by `scripts/warli-field-svg.tsx`, which also
 * writes the URL into `./field-asset.ts`.
 *
 * ⚠ THE FIELD IS 86% OF THIS DRAWING'S MARKUP AND NONE OF ITS MOTION. Inline,
 * it put ~682 KB into the HTML of every auth page, on a document served
 * `max-age=0`, so every full load paid for it again — measured on prod at
 * `a7bf4d2`: `/sign-in` 822 KB raw against `/` at 68 KB. As a content-hashed
 * file it is cached `immutable` for a year (`next.config.ts`) and preloaded by
 * `(auth)/layout.tsx`, and a crawler that reads only the document never fetches
 * it at all. `tests/unit/art/field-asset.test.ts` holds the committed file
 * byte-equal to the component and its URL equal to its hash, so the drawing's
 * source of truth is still `field-layer.tsx`.
 */
export { FIELD_ASSET_HREF };

/** Half a step, so no figure sits at an exact vertical extreme at rest. */
export const PHASE_DEG = 22.5;

/** One full turn. Slow enough to read as drift rather than as motion. */
const TURN_SECONDS = 240;

const CENTRE = { x: 0, y: 0 } as const;
const STEP_DEG = 360 / INNER_FIGURES.length;

/**
 * ⚠ `@keyframes spin` IS NOT AVAILABLE. Measured against the built CSS chunk at
 * recon: the only keyframes Tailwind emits into this app are `enter`, `exit`
 * and `pulse`, and `.animate-spin` is absent because nothing in the tree uses
 * it. Reaching for `animate-spin` here would have produced rings that silently
 * never turned — green in every test, wrong on screen. So the keyframes are
 * authored locally under a `warli-` prefix.
 *
 * ⚠ NO COLOUR APPEARS IN THIS BLOCK, and none may be added. The raw-hex guard
 * scans this file like any other under `src/components`.
 *
 * The `transform-origin: 0 0` is load-bearing: CSS defaults a transform origin
 * to the element's bounding-box centre, and for a `<g>` that is wherever the
 * drawing happens to sit — so the rings would orbit their own contents instead
 * of turning about the composition's centre. The whole piece is translated so
 * that the centre IS the origin, and this line is what makes that pay off.
 */
export const WARLI_CSS = `
.warli-root { color: var(--color-ink); }
.warli-reserve { color: var(--color-ground); }
.warli-spin {
	transform-origin: 0 0;
	animation: warli-turn var(--warli-turn, ${TURN_SECONDS}s) linear infinite;
}
.warli-spin--ccw { animation-name: warli-turn-ccw; }
@keyframes warli-turn { to { transform: rotate(360deg); } }
@keyframes warli-turn-ccw { to { transform: rotate(-360deg); } }
.warli-nudge {
	transform-origin: 0 0;
	transform: rotate(var(--warli-nudge, 0deg));
	transition: transform 1200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.warli-root[data-warli-engaged="true"] .warli-spin { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
	.warli-spin { animation: none; }
	.warli-nudge { transition: none; transform: none; }
}
`;

/**
 * Reads the rotation a CSS animation currently has an element at.
 *
 * ⚠ EXPORTED SO IT CAN BE TESTED. It is the bridge between CSS and `nudgeFor`:
 * the animation knows where the rings are and will not say, so this parses it
 * out of the computed matrix. Its regex, its `atan2(b, a)` extraction and its
 * three early returns could all yield garbage in a real browser while every
 * test stayed green, because a pure `nudgeFor` covers what happens AFTER the
 * phases are read, not the reading.
 */
export function currentRotationDeg(el: Element | null): number {
	if (el === null) {
		return 0;
	}
	const value = getComputedStyle(el).transform;
	if (value === "" || value === "none") {
		return 0;
	}
	const inner = value.match(/matrix\(([^)]+)\)/)?.[1];
	if (inner === undefined) {
		return 0;
	}
	const parts = inner.split(",").map((n) => Number.parseFloat(n));
	const a = parts[0];
	const b = parts[1];
	if (
		a === undefined ||
		b === undefined ||
		Number.isNaN(a) ||
		Number.isNaN(b)
	) {
		return 0;
	}
	return (Math.atan2(b, a) * 180) / Math.PI;
}

/**
 * Wraps an angle into `[−180, 180)`.
 *
 * ⚠ THE HALF-OPEN END IS THE LOWER ONE: `wrapSigned(180)` returns **−180**, not
 * 180. Measured, after this docblock claimed the opposite. It makes no
 * behavioural difference — a half-turn misalignment resolves the same either way
 * — but a range written the wrong way round is what a later off-by-one gets
 * built on.
 */
export function wrapSigned(deg: number): number {
	const m = (((deg + 180) % 360) + 360) % 360;
	return m - 180;
}

/**
 * The whole arithmetic of the pointer interaction, as a pure function.
 *
 * ⚠ IT IS EXPORTED AND SEPARATE BECAUSE IT COULD NOT OTHERWISE BE TESTED AT ALL.
 * jsdom runs no animation, so `getComputedStyle(g).transform` there is `none` and
 * both ring phases read as zero — which means `misalign` is always 0 and the
 * equal-and-opposite split, the part that actually decides where the rings go,
 * is never exercised by any test that drives the component. Pulling it out turns
 * the interesting half into something with hand-checkable inputs and outputs.
 *
 * The two moves it makes:
 *
 *   1. **Close the gap between the rings.** The counter-rotation shifts every
 *      pair by the SAME amount, so the two rings are misaligned by one angle, not
 *      eight — and closing it for one pair closes it for all eight. Each ring
 *      travels half the distance, which is what makes the gesture read as the
 *      rings meeting rather than one of them chasing the other.
 *   2. **Turn both together** by the same small extra, so the pair nearest the
 *      pointer ends up under it. At most half a step, because `nearest` snaps to
 *      the step grid first.
 */
export function nudgeFor({
	innerPhase,
	outerPhase,
	pointerDeg,
	phaseDeg = PHASE_DEG,
	stepDeg = STEP_DEG,
}: {
	readonly innerPhase: number;
	readonly outerPhase: number;
	readonly pointerDeg: number;
	readonly phaseDeg?: number;
	readonly stepDeg?: number;
}): { readonly inner: number; readonly outer: number } {
	const misalign = wrapSigned(outerPhase - innerPhase);
	const settledAt = innerPhase + misalign / 2;
	const nearest =
		Math.round((pointerDeg - phaseDeg - settledAt) / stepDeg) * stepDeg;
	const toPointer = wrapSigned(pointerDeg - (phaseDeg + settledAt + nearest));
	return {
		inner: misalign / 2 + toPointer,
		outer: -misalign / 2 + toPointer,
	};
}

export type WarliHeroProps = {
	readonly className?: string;
	/**
	 * The accessible name. The artwork carries no information a screen reader
	 * needs beyond what it IS, so this is one string rather than a described
	 * structure — and it is a prop because the sentence that suits a sign-in
	 * page is not the sentence that suits anywhere else.
	 */
	readonly label?: string;
};

export function WarliHero({
	className,
	label = "Two rings of figures turning in opposite directions, each facing its opposite across the gap",
}: WarliHeroProps) {
	const rootRef = useRef<SVGSVGElement | null>(null);
	const innerSpinRef = useRef<SVGGElement | null>(null);
	const outerSpinRef = useRef<SVGGElement | null>(null);
	const innerNudgeRef = useRef<SVGGElement | null>(null);
	const outerNudgeRef = useRef<SVGGElement | null>(null);

	useEffect(() => {
		const root = rootRef.current;
		if (root === null) {
			return;
		}

		/**
		 * Everything the move handler needs, captured ONCE when the pointer
		 * arrives. The constraint is that a move must not run layout, and
		 * `getBoundingClientRect` and `getComputedStyle` both do — so they are
		 * read on ENTER, which happens once, and never again while the pointer is
		 * inside. Reading the animation's phase is also the only way to align the
		 * rings at all: CSS can turn them but cannot tell anyone where they are.
		 */
		let frame: {
			centreX: number;
			centreY: number;
			innerPhase: number;
			outerPhase: number;
		} | null = null;

		/**
		 * ⚠ THE RECT AND THE PHASE HAVE DIFFERENT LIFETIMES, and treating them as
		 * one thing was a defect. The animation phase genuinely wants to be read
		 * ONCE and frozen — that is the whole point of pausing. The rect does not:
		 * it is viewport-relative, and a scroll or a resize while the pointer is
		 * still inside invalidates it without firing `pointerleave`. The pointer
		 * angle then points somewhere else and the rings align to the wrong pair.
		 *
		 * Re-reading the rect on `scroll`/`resize` costs one layout per scroll
		 * frame, not one per pointer move, so the constraint that a MOVE runs no
		 * layout is untouched.
		 */
		const readRect = () => {
			if (frame === null) {
				return;
			}
			const rect = root.getBoundingClientRect();
			// The composition's centre is the viewBox centre, so this is exact
			// whatever `preserveAspectRatio` does with letterboxing.
			frame.centreX = rect.left + rect.width / 2;
			frame.centreY = rect.top + rect.height / 2;
		};

		const engage = () => {
			const rect = root.getBoundingClientRect();
			frame = {
				centreX: rect.left + rect.width / 2,
				centreY: rect.top + rect.height / 2,
				innerPhase: currentRotationDeg(innerSpinRef.current),
				outerPhase: currentRotationDeg(outerSpinRef.current),
			};
			root.dataset.warliEngaged = "true";
		};

		const move = (event: PointerEvent) => {
			if (frame === null) {
				return;
			}
			const dx = event.clientX - frame.centreX;
			const dy = event.clientY - frame.centreY;
			// Clock convention, matching the geometry module: 0° is up, clockwise.
			const pointerDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;

			// All the arithmetic lives in `nudgeFor`, which is pure and tested
			// against hand-computed values — including the non-zero-misalign case
			// jsdom cannot produce. What is left here is reading the event and
			// writing two custom properties: no layout, nothing to get wrong.
			const nudge = nudgeFor({
				innerPhase: frame.innerPhase,
				outerPhase: frame.outerPhase,
				pointerDeg,
			});

			innerNudgeRef.current?.style.setProperty(
				"--warli-nudge",
				`${nudge.inner.toFixed(3)}deg`,
			);
			outerNudgeRef.current?.style.setProperty(
				"--warli-nudge",
				`${nudge.outer.toFixed(3)}deg`,
			);
		};

		const release = () => {
			frame = null;
			delete root.dataset.warliEngaged;
			innerNudgeRef.current?.style.setProperty("--warli-nudge", "0deg");
			outerNudgeRef.current?.style.setProperty("--warli-nudge", "0deg");
		};

		// Passive throughout: the handlers only READ the event and write two custom
		// properties. Nothing calls `preventDefault`, so the browser never has to
		// wait on them to decide whether a scroll may proceed.
		const options = { passive: true } as const;
		root.addEventListener("pointerenter", engage, options);
		root.addEventListener("pointermove", move, options);
		root.addEventListener("pointerleave", release, options);
		window.addEventListener("scroll", readRect, options);
		window.addEventListener("resize", readRect, options);
		return () => {
			root.removeEventListener("pointerenter", engage);
			root.removeEventListener("pointermove", move);
			root.removeEventListener("pointerleave", release);
			window.removeEventListener("scroll", readRect);
			window.removeEventListener("resize", readRect);
		};
	}, []);

	return (
		<svg
			ref={rootRef}
			className={`warli-root${className === undefined ? "" : ` ${className}`}`}
			viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
			preserveAspectRatio="xMidYMid slice"
			role="img"
			aria-label={label}
			fill="none"
			stroke="currentColor"
			data-warli-hero=""
			/* ⚠ A CSS BACKGROUND, NOT AN SVG `<image>`. `<image` is on the
			   security audit's sink list in `art-layer-guards.test.ts`, and a
			   decorative asset is not a reason to open it. `cover` + `center` on a
			   box whose drawing is 1440 × 1000 is the same geometry as this
			   element's `xMidYMid slice`, so the field lands on the rings'
			   frame at every viewport. The URL is a module constant; React writes
			   it through the style object, never through the `<style>` text. */
			style={{
				backgroundImage: `url(${FIELD_ASSET_HREF})`,
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
				backgroundSize: "cover",
			}}
			data-warli-field-image=""
		>
			<title>{label}</title>
			{/* A `<style>` tag is exactly where someone reaches for
			    `dangerouslySetInnerHTML`, because the safe form is not obviously
			    available. It is: a plain text child works.

			    ⚠ BUT NOT FOR THE REASON THIS COMMENT USED TO GIVE. It said "React
			    escapes it", which is FALSE for `<style>` and was measured so.
			    React's whole style-child transform is `escapeStyleTextContent`,
			    whose regex is `/(<\/|<)(s)(tyle)/gi` — it rewrites the tokens
			    `<style` and `</style`, case-insensitively, into a CSS identifier
			    escape. That blocks the raw-text parser breakout and NOTHING else.
			    Braces, `@import` and `url(…)` all pass through verbatim, so
			    interpolating a non-constant here would be arbitrary CSS injection —
			    and this is the line someone reads before deciding it is safe to.

			    What actually holds: `WARLI_CSS` is a module-level `const` whose
			    only interpolation is `${TURN_SECONDS}`, itself a numeric literal.
			    The safety is the CONSTANT INPUT, not the sink.

			    ⛔ AND DO NOT GIVE THIS ELEMENT A SECOND CHILD. React takes the
			    style text as `children[0]` only when there are fewer than two
			    children; with two or more it passes `null` and the element renders
			    EMPTY. `<style>{WARLI_CSS}{EXTRA}</style>` would ship no stylesheet
			    at all, throw nothing, and fail as rings that silently never turn —
			    the same failure this file already exists to prevent once. */}
			<style>{WARLI_CSS}</style>

			{/* ⚠ THE STATIC FIELD IS DRAWN FIRST, AND IT IS NOT INSIDE THE CENTRING
			    TRANSFORM. It works in absolute frame coordinates because it is
			    positioned against the FRAME — corners, edges, the border stack —
			    while the rings are positioned against the CENTRE. Pushing the field
			    through the same translate would have meant every scene coordinate
			    carrying a −720/−500 offset for no benefit, and the border, whose
			    whole job is to sit on the frame's own edges, would be expressed in
			    a space the frame is not in.

			    Drawn first because SVG has no z-index and this palette has no value
			    scale, so paint order is the ONLY depth cue available. The world goes
			    behind the argument.

			    ⚠ SINCE WARLI-FIELD-ASSET THE FIELD IS THIS ELEMENT'S BACKGROUND,
			    painted beneath every child, so it is still drawn first and still
			    outside every transform. See `FIELD_ASSET_HREF` for why it is a
			    file. */}

			<g transform={`translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2})`}>
				<g ref={innerSpinRef} className="warli-spin" data-warli-spin="inner">
					<g ref={innerNudgeRef} className="warli-nudge">
						<Ring
							name="inner"
							centre={CENTRE}
							radius={R_INNER}
							figures={INNER_FIGURES}
							density="solid"
							facing="outward"
							phaseDeg={PHASE_DEG}
						/>
					</g>
				</g>
				<g
					ref={outerSpinRef}
					className="warli-spin warli-spin--ccw"
					data-warli-spin="outer"
				>
					<g ref={outerNudgeRef} className="warli-nudge">
						<Ring
							name="outer"
							centre={CENTRE}
							radius={R_OUTER}
							figures={OUTER_FIGURES}
							density="spare"
							facing="inward"
							phaseDeg={PHASE_DEG}
							showField={false}
						/>
					</g>
				</g>
			</g>
		</svg>
	);
}
