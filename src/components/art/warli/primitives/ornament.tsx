import {
	HIP_HALF,
	SHOULDER_HALF,
	TORSO_LOWER_HEIGHT,
	TORSO_UPPER_HEIGHT,
} from "./figure-parts";
import { Dab, Disc, Run, Shape } from "./stroke";
import { type PrimitiveSpec, WEIGHT_DENSE } from "./types";
import { hash01 } from "./wobble";

/**
 * Ornament — the only place a figure is allowed to become an individual.
 *
 * ⚠ THE SKELETON MAY NOT MOVE, AND THAT IS THE WHOLE CONSTRAINT THIS FILE
 * EXISTS UNDER. The ring engine chains figures by their hand anchors, and every
 * figure reaches the same distance in body space — a guard asserts it. So the
 * obvious way to make fifty people look like fifty people, by varying their
 * builds, is closed. Character has to arrive as marks laid ON a body that is
 * identical underneath.
 *
 * That constraint is doing more than keeping a test green. A ring of identical
 * bodies distinguished only by their surface IS the argument the piece is
 * making: everybody here is the same shape, and what divides them is what they
 * carry and how they are dressed. Varying the skeletons would say the opposite —
 * that the positions are different KINDS of person — while looking like a
 * styling improvement.
 *
 * ⚠ ORNAMENT IS RESERVED OUT, NOT DRAWN ON. On a solid body the mark is the
 * UNPAINTED part: a ground-coloured rule across an ink-filled skirt, exactly as
 * a resist or a scraped line works on a real wall. Drawing a second ink stroke
 * over an ink shape would be invisible; drawing it in a lighter grey would
 * reintroduce a value scale the brand does not have. Ground is the only other
 * colour available, and it is the historically correct one.
 *
 * The ground colour arrives through `.warli-reserve`, a class the hero's own
 * stylesheet defines as `color: var(--color-ground)`. Nothing here names a
 * colour — the marks are all `currentColor`, as every primitive in this layer
 * is, and the class flips what that resolves to.
 */

/** Four skirt treatments, on the lower triangle. */
export type SkirtPattern = "plain" | "bands" | "chevron" | "hem-dots";

/** Four chest treatments, on the upper triangle. */
export type TorsoPattern = "plain" | "rules" | "cross" | "collar";

/** Four things that can sit on a head. */
export type Headdress = "none" | "topknot" | "plume" | "band";

/** Whether the figure wears rings at wrist and ankle. */
export type Bangles = "none" | "rings";

export type OrnamentSet = {
	readonly skirt: SkirtPattern;
	readonly torso: TorsoPattern;
	readonly headdress: Headdress;
	readonly bangles: Bangles;
};

const SKIRTS: readonly SkirtPattern[] = [
	"plain",
	"bands",
	"chevron",
	"hem-dots",
];
const TORSOS: readonly TorsoPattern[] = ["plain", "rules", "cross", "collar"];
const HEADS: readonly Headdress[] = ["none", "topknot", "plume", "band"];
const BANGLES: readonly Bangles[] = ["none", "rings"];

export const ORNAMENT_COMBINATIONS =
	SKIRTS.length * TORSOS.length * HEADS.length * BANGLES.length;

/**
 * The four dials, chosen from one seed.
 *
 * ⚠ EACH DIAL IS HASHED WITH ITS OWN SALT rather than read off successive bits
 * of one number. Sharing a source across four dials correlates them: every
 * figure with a topknot also ends up with a chevron skirt, and fifty people
 * collapse into four repeated costumes. The salts cost nothing and are the
 * difference between 128 combinations and 4.
 */
export function ornamentFor(seed: number): OrnamentSet {
	const at = <T,>(items: readonly T[], salt: number): T => {
		const item = items[Math.floor(hash01(seed * 31 + salt) * items.length)];
		if (item === undefined) {
			throw new Error("WARLI: ornament list is empty");
		}
		return item;
	};
	return {
		skirt: at(SKIRTS, 1013),
		torso: at(TORSOS, 2027),
		headdress: at(HEADS, 3041),
		bangles: at(BANGLES, 4051),
	};
}

export const ORNAMENT: PrimitiveSpec = {
	id: "warli-ornament",
	box: { x: -9, y: -15, width: 18, height: 26 },
	origin: { x: 0, y: 0 },
};

/** Half-width of the lower triangle `t` units below the waist. */
const skirtHalf = (t: number) => (HIP_HALF * t) / TORSO_LOWER_HEIGHT;

/** Half-width of the upper triangle `t` units above the waist. */
const chestHalf = (t: number) => (SHOULDER_HALF * t) / TORSO_UPPER_HEIGHT;

/**
 * The marks that go INSIDE the two triangles, drawn about the waist at `(0, 0)`.
 *
 * `reserved` decides whether this renders in ground (cut out of a solid body) or
 * in ink (laid on an open one). Both are correct; which one applies is a
 * property of the body underneath, so the caller decides and the ornament does
 * not have to know.
 */
export function BodyOrnament({
	set,
	seed = 0,
	reserved,
	weight = WEIGHT_DENSE,
}: {
	readonly set: OrnamentSet;
	readonly seed?: number;
	readonly reserved: boolean;
	readonly weight?: number;
}) {
	return (
		<g
			data-warli-id={ORNAMENT.id}
			data-warli-ornament={`${set.torso}/${set.skirt}`}
			className={reserved ? "warli-reserve" : undefined}
		>
			{/* ---- the skirt, on the lower triangle ---- */}
			{set.skirt === "bands"
				? [4.5, 7.5].map((t) => (
						<Run
							key={t}
							x1={-skirtHalf(t)}
							y1={t}
							x2={skirtHalf(t)}
							y2={t}
							seed={seed + t}
							weight={weight}
						/>
					))
				: null}
			{set.skirt === "chevron"
				? [6, 9].map((t) => (
						<Shape
							key={t}
							points={[
								{ x: -skirtHalf(t), y: t },
								{ x: 0, y: t - 3.2 },
								{ x: skirtHalf(t), y: t },
							]}
							seed={seed + t}
							weight={weight}
							close={false}
						/>
					))
				: null}
			{set.skirt === "hem-dots"
				? [-4.4, -1.5, 1.5, 4.4].map((x) => (
						<Dab key={x} cx={x} cy={8.6} r={0.95} />
					))
				: null}

			{/* ---- the chest, on the upper triangle ---- */}
			{set.torso === "rules"
				? [-5, -9, -12.5].map((t) => (
						<Run
							key={t}
							x1={-chestHalf(-t)}
							y1={t}
							x2={chestHalf(-t)}
							y2={t}
							seed={seed + t}
							weight={weight}
						/>
					))
				: null}
			{set.torso === "cross" ? (
				<>
					<Run
						x1={-chestHalf(13)}
						y1={-13}
						x2={chestHalf(4)}
						y2={-4}
						seed={seed + 61}
						weight={weight}
					/>
					<Run
						x1={chestHalf(13)}
						y1={-13}
						x2={-chestHalf(4)}
						y2={-4}
						seed={seed + 67}
						weight={weight}
					/>
				</>
			) : null}
			{set.torso === "collar" ? (
				<>
					<Run
						x1={-chestHalf(12.5)}
						y1={-12.5}
						x2={chestHalf(12.5)}
						y2={-12.5}
						seed={seed + 71}
						weight={weight}
					/>
					<Dab cx={0} cy={-8.5} r={1.5} />
				</>
			) : null}
		</g>
	);
}

/**
 * What sits on the head, drawn about the HEAD CENTRE rather than the waist.
 *
 * ⚠ NEVER RESERVED. A headdress projects beyond the skull, so a ground-coloured
 * plume drawn over a solid head would be invisible where it matters — outside
 * the circle there is nothing to cut it out of. It is ink, always, and it is the
 * one ornament that changes a figure's silhouette rather than its surface.
 */
export function HeadOrnament({
	set,
	radius,
	seed = 0,
	weight = WEIGHT_DENSE,
}: {
	readonly set: Headdress;
	readonly radius: number;
	readonly seed?: number;
	readonly weight?: number;
}) {
	if (set === "none") {
		return null;
	}
	return (
		<g data-warli-headdress={set}>
			{set === "topknot" ? (
				<Disc cx={0} cy={-radius - 2.6} r={2.2} seed={seed} weight={weight} />
			) : null}
			{set === "plume"
				? [-32, 0, 32].map((deg) => {
						const rad = (deg * Math.PI) / 180;
						return (
							<Run
								key={deg}
								x1={Math.sin(rad) * radius * 0.7}
								y1={-Math.cos(rad) * radius * 0.7}
								x2={Math.sin(rad) * (radius + 6.5)}
								y2={-Math.cos(rad) * (radius + 6.5)}
								seed={seed + deg}
								weight={weight}
							/>
						);
					})
				: null}
			{set === "band" ? (
				<Run
					x1={-radius - 1.6}
					y1={-radius * 0.42}
					x2={radius + 1.6}
					y2={-radius * 0.42}
					seed={seed + 5}
					weight={weight * 1.5}
				/>
			) : null}
		</g>
	);
}

/**
 * Rings at wrist and ankle: two short ticks across a limb, near its far end.
 *
 * They are drawn by the BODY rather than here, because only the body knows where
 * a given figure's limbs actually end — a raised arm and a straight one put the
 * wrist in different places. This function only answers where along a run the
 * ticks go, so the rule is stated once.
 */
export function bangleAt(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	at: number,
): {
	readonly x: number;
	readonly y: number;
	readonly nx: number;
	readonly ny: number;
} {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.hypot(dx, dy) || 1;
	return {
		x: x1 + dx * at,
		y: y1 + dy * at,
		nx: -dy / len,
		ny: dx / len,
	};
}
