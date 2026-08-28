"use client";

import { useEffect, useRef } from "react";

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
 * CSS animation; the compositor turns them. The sixteen figures underneath are
 * a fixed drawing computed once (`./ring.tsx`), so a frame costs a transform on
 * two layers rather than a re-layout of several hundred nodes.
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

/** Reads the rotation a CSS animation currently has an element at. */
function currentRotationDeg(el: Element | null): number {
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

/** Wraps a angle into (−180, 180]. */
function wrapSigned(deg: number): number {
	const m = (((deg + 180) % 360) + 360) % 360;
	return m - 180;
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

		const engage = () => {
			const rect = root.getBoundingClientRect();
			frame = {
				// The composition's centre is the viewBox centre, so this is exact
				// whatever `preserveAspectRatio` does with letterboxing.
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

			/**
			 * The two rings are misaligned by the same amount at EVERY pair — the
			 * counter-rotation shifts all eight equally — so bringing one pair
			 * together brings all eight. Each ring travels half the distance, which
			 * is what makes the gesture read as the rings meeting rather than as one
			 * of them chasing the other.
			 */
			const misalign = wrapSigned(frame.outerPhase - frame.innerPhase);
			const settledAt = frame.innerPhase + misalign / 2;

			// Then both rings turn together by the same small extra amount, so the
			// pair nearest the pointer ends up under it. At most half a step.
			const nearest =
				Math.round((pointerDeg - PHASE_DEG - settledAt) / STEP_DEG) * STEP_DEG;
			const toPointer = wrapSigned(
				pointerDeg - (PHASE_DEG + settledAt + nearest),
			);

			innerNudgeRef.current?.style.setProperty(
				"--warli-nudge",
				`${(misalign / 2 + toPointer).toFixed(3)}deg`,
			);
			outerNudgeRef.current?.style.setProperty(
				"--warli-nudge",
				`${(-misalign / 2 + toPointer).toFixed(3)}deg`,
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
		return () => {
			root.removeEventListener("pointerenter", engage);
			root.removeEventListener("pointermove", move);
			root.removeEventListener("pointerleave", release);
		};
	}, []);

	return (
		<svg
			ref={rootRef}
			className={`warli-root${className === undefined ? "" : ` ${className}`}`}
			viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
			role="img"
			aria-label={label}
			fill="none"
			stroke="currentColor"
			data-warli-hero=""
		>
			<title>{label}</title>
			{/* A `<style>` tag is exactly where someone reaches for
			    `dangerouslySetInnerHTML`, because the safe form is not obviously
			    available. It is: a plain text child works, React escapes it, and
			    `CSS` is a module-level constant with no interpolation, so no value
			    from anywhere else can reach a stylesheet. */}
			<style>{WARLI_CSS}</style>

			<g transform={`translate(${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2})`}>
				<g ref={innerSpinRef} className="warli-spin" data-warli-spin="inner">
					<g ref={innerNudgeRef} className="warli-nudge">
						<Ring
							name="inner"
							centre={CENTRE}
							radius={R_INNER}
							figures={INNER_FIGURES}
							density="dense"
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
						/>
					</g>
				</g>
			</g>
		</svg>
	);
}
