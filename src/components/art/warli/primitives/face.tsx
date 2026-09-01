import { Dab, Disc, Run, Shape } from "./stroke";
import { type PrimitiveSpec, WEIGHT_DENSE } from "./types";

/**
 * The eight faces — and they are the only faces in the piece.
 *
 * ⚠ THAT SCARCITY IS THE MECHANISM, NOT A BUDGET. Fifty figures share one
 * skeleton and one blank head; eight of them look back at you. Being the only
 * ones with a face is what makes the inner ring read as the positions that are
 * SPEAKING, without a label, a colour or a size cue doing the work. Give the
 * crowd faces too and the piece instantly becomes a picture of fifty individuals
 * arguing, which is a smaller and much more ordinary idea than a handful of
 * named positions surrounded by a world that is getting on with its work.
 *
 * ⚠ AND A FACE HERE IS FOUR MARKS. Two eyes, one nose stroke, one mouth stroke.
 * Not modelled, not shaded, no expression beyond the angle of a line. The
 * temptation at this scale is to make the scholar LOOK scholarly, and that is
 * the exact moment the drawing stops being in this idiom and becomes a cartoon
 * of it. What varies between the eight is which of four mouths and which of two
 * brows, and that is enough to tell them apart without any of them acquiring a
 * personality the piece has not earned.
 *
 * ⚠ A FACED HEAD IS NEVER SOLID. The dense register fills heads with ink; a face
 * inside one would be invisible. So faced figures take an open head and carry
 * their weight in the body instead — which is why `Body` treats `faced` and
 * `density` as separate dials rather than deriving one from the other.
 */

export const FACE: PrimitiveSpec = {
	id: "warli-face",
	box: { x: -4, y: -4, width: 8, height: 8 },
	origin: { x: 0, y: 0 },
};

/** How the mouth is set. The only thing here with anything like a mood. */
export type Mouth = "line" | "open" | "set" | "parted";

/** Whether the figure carries brow ticks above the eyes. */
export type Brow = "plain" | "ticks";

export type FaceSet = { readonly mouth: Mouth; readonly brow: Brow };

const MOUTHS: readonly Mouth[] = ["line", "open", "set", "parted"];
const BROWS: readonly Brow[] = ["plain", "ticks"];

/**
 * The eight distinct faces, in the order the inner ring consumes them.
 *
 * ⚠ ENUMERATED RATHER THAN HASHED, unlike ornament. There are exactly eight
 * faced figures and exactly eight combinations, so a hash would be a worse way
 * to reach the same set: it could collide, leaving two of the eight identical
 * and one combination unused, and nothing would report it. A cycle over the
 * product is total by construction.
 */
export const FACE_SETS: readonly FaceSet[] = BROWS.flatMap((brow) =>
	MOUTHS.map((mouth) => ({ mouth, brow })),
);

/**
 * One face, drawn about the head's CENTRE, sized to the head it sits in.
 *
 * Every coordinate is a fraction of `radius` rather than an absolute, because
 * the faced figures are drawn at 1.2× and a face laid out in fixed units would
 * sit in the wrong part of a head that changed size — the classic way a scaled
 * figure ends up with its eyes on its forehead.
 */
export function Face({
	set,
	radius,
	seed = 0,
	weight = WEIGHT_DENSE,
}: {
	readonly set: FaceSet;
	readonly radius: number;
	readonly seed?: number;
	readonly weight?: number;
}) {
	const r = radius;
	const eyeX = r * 0.38;
	const eyeY = -r * 0.22;
	return (
		<g data-warli-id={FACE.id} data-warli-face={`${set.brow}/${set.mouth}`}>
			<Dab cx={-eyeX} cy={eyeY} r={r * 0.13} />
			<Dab cx={eyeX} cy={eyeY} r={r * 0.13} />

			{set.brow === "ticks" ? (
				<>
					<Run
						x1={-eyeX - r * 0.2}
						y1={eyeY - r * 0.3}
						x2={-eyeX + r * 0.16}
						y2={eyeY - r * 0.36}
						seed={seed + 11}
						weight={weight * 0.8}
					/>
					<Run
						x1={eyeX - r * 0.16}
						y1={eyeY - r * 0.36}
						x2={eyeX + r * 0.2}
						y2={eyeY - r * 0.3}
						seed={seed + 13}
						weight={weight * 0.8}
					/>
				</>
			) : null}

			{/* The nose: one stroke down the middle. It is what stops two dots and a
			    line reading as a socket rather than a face. */}
			<Run
				x1={0}
				y1={eyeY + r * 0.1}
				x2={0}
				y2={r * 0.24}
				seed={seed + 17}
				weight={weight * 0.85}
			/>

			{set.mouth === "line" ? (
				<Run
					x1={-r * 0.28}
					y1={r * 0.52}
					x2={r * 0.28}
					y2={r * 0.52}
					seed={seed + 19}
					weight={weight}
				/>
			) : null}
			{set.mouth === "open" ? (
				<Disc
					cx={0}
					cy={r * 0.52}
					r={r * 0.15}
					seed={seed + 23}
					weight={weight * 0.85}
				/>
			) : null}
			{set.mouth === "set" ? (
				// Corners down. The nearest thing to an expression in the whole piece,
				// and it is three points, not a curve.
				<Shape
					points={[
						{ x: -r * 0.3, y: r * 0.46 },
						{ x: 0, y: r * 0.56 },
						{ x: r * 0.3, y: r * 0.46 },
					]}
					seed={seed + 29}
					weight={weight}
					close={false}
				/>
			) : null}
			{set.mouth === "parted" ? (
				<>
					<Run
						x1={-r * 0.28}
						y1={r * 0.44}
						x2={r * 0.28}
						y2={r * 0.44}
						seed={seed + 31}
						weight={weight}
					/>
					<Run
						x1={-r * 0.2}
						y1={r * 0.64}
						x2={r * 0.2}
						y2={r * 0.64}
						seed={seed + 37}
						weight={weight}
					/>
				</>
			) : null}
		</g>
	);
}
