import { Dab, Disc, Run, Shape } from "./stroke";
import { type PrimitiveProps, type PrimitiveSpec, WEIGHT_SPARE } from "./types";

/**
 * The animals.
 *
 * ⚠ THEY ARE ALL THE SAME ANIMAL, AND THAT IS THE GRAMMAR. A body bar, legs
 * dropped from it, a neck, a head, and then ONE distinguishing feature — horns,
 * a curled tail, a comb, a fan. That is how this tradition draws a bestiary, and
 * it is also the only way a bestiary at this scale can work: an animal here is
 * about twenty units across, so anything that depends on proportion or posture
 * to be legible will not be. What reads at twenty units is a silhouette with one
 * thing sticking out of it.
 *
 * ⚠ WHICH MEANS THE DISTINGUISHING FEATURE IS THE WHOLE DESIGN. If two animals
 * share their feature they are the same animal wearing different names, and at
 * a hundred placed instances that is the difference between a populated wall and
 * visible wallpaper. Repetition is this task's most likely aesthetic failure,
 * and the defence is not more animals — it is that each one is unmistakable in
 * outline from across the room.
 *
 * All of them stand on their baseline at local `(0, 0)` and grow upward in `−y`,
 * the same convention as a figure, so the scene engine places a tiger and a
 * scholar with the same call. `Fish` is the exception and says so.
 */

/** The shared quadruped: a body bar carried on four legs. */
function Quadruped({
	x1,
	x2,
	y,
	legs,
	seed,
	weight,
}: {
	readonly x1: number;
	readonly x2: number;
	readonly y: number;
	readonly legs: readonly number[];
	readonly seed: number;
	readonly weight: number;
}) {
	return (
		<>
			<Run x1={x1} y1={y} x2={x2} y2={y} seed={seed} weight={weight} />
			{legs.map((x) => (
				<Run key={x} x1={x} y1={y} x2={x} y2={0} seed={seed} weight={weight} />
			))}
		</>
	);
}

export const BULLOCK: PrimitiveSpec = {
	id: "warli-bullock",
	box: { x: -14, y: -22, width: 28, height: 22 },
	origin: { x: 0, y: 0 },
};

/** A draught bullock: heavy body, shoulder hump, and a pair of forward horns. */
export function Bullock({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={BULLOCK.id} transform={transform} className={className}>
			<Quadruped
				x1={-11}
				x2={8}
				y={-12}
				legs={[-9.5, -6, 4, 7]}
				seed={seed}
				weight={weight}
			/>
			{/* the hump — the one thing that says bullock rather than horse */}
			<Shape
				points={[
					{ x: 1, y: -12 },
					{ x: 4.5, y: -17 },
					{ x: 8, y: -12 },
				]}
				seed={seed + 2}
				weight={weight}
				close={false}
			/>
			<Run x1={8} y1={-12} x2={12} y2={-17} seed={seed} weight={weight} />
			<Dab cx={12.5} cy={-18.5} r={2.3} />
			<Run x1={11} y1={-20} x2={9} y2={-22} seed={seed} weight={weight} />
			<Run x1={14} y1={-20} x2={14} y2={-22} seed={seed} weight={weight} />
			<Run x1={-11} y1={-12} x2={-14} y2={-4} seed={seed} weight={weight} />
		</g>
	);
}

export const DOG: PrimitiveSpec = {
	id: "warli-dog",
	box: { x: -10, y: -15, width: 20, height: 15 },
	origin: { x: 0, y: 0 },
};

/** A village dog: small, with an upright tail and two pricked ears. */
export function Dog({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={DOG.id} transform={transform} className={className}>
			<Quadruped
				x1={-7}
				x2={5}
				y={-8}
				legs={[-6, -3.5, 2.5, 4.5]}
				seed={seed}
				weight={weight}
			/>
			<Run x1={5} y1={-8} x2={7.5} y2={-12} seed={seed} weight={weight} />
			<Dab cx={8} cy={-13} r={1.8} />
			<Run x1={7} y1={-14.2} x2={6} y2={-15} seed={seed} weight={weight} />
			<Run x1={9} y1={-14.2} x2={9.6} y2={-15} seed={seed} weight={weight} />
			{/* the tail up, which is the whole difference from a small deer */}
			<Run x1={-7} y1={-8} x2={-9.5} y2={-14} seed={seed} weight={weight} />
		</g>
	);
}

export const HORSE: PrimitiveSpec = {
	id: "warli-horse",
	box: { x: -14, y: -24, width: 28, height: 24 },
	origin: { x: 0, y: 0 },
};

/** A horse: an arched neck, a mane of ticks, and a falling tail. */
export function Horse({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={HORSE.id} transform={transform} className={className}>
			<Quadruped
				x1={-10}
				x2={7}
				y={-13}
				legs={[-9, -6, 4, 6.5]}
				seed={seed}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: 7, y: -13 },
					{ x: 10.5, y: -18 },
					{ x: 11, y: -22 },
				]}
				seed={seed + 3}
				weight={weight}
				close={false}
			/>
			<Dab cx={11.5} cy={-23} r={2} />
			{[-15, -18, -21].map((y) => (
				<Run
					key={y}
					x1={8.5}
					y1={y}
					x2={6}
					y2={y - 1.6}
					seed={seed + y}
					weight={weight * 0.8}
				/>
			))}
			<Run x1={-10} y1={-13} x2={-13.5} y2={-5} seed={seed} weight={weight} />
		</g>
	);
}

export const TIGER: PrimitiveSpec = {
	id: "warli-tiger",
	box: { x: -18, y: -18, width: 36, height: 18 },
	origin: { x: 0, y: 0 },
};

/**
 * A tiger: long and low, striped, with a tail longer than its body is tall.
 *
 * ⚠ THE STRIPES CROSS THE BODY BAR RATHER THAN STANDING ON IT. Drawn upward
 * from the back — which is the obvious way, and what the first version did —
 * four vertical ticks above a horizontal bar read as BRISTLES, and the whole
 * animal came out as a caterpillar. Caught by looking at the plate. Crossing the
 * bar puts the stripe on the body instead of on top of it, which is both what a
 * stripe is and the only reading that survives at twenty units wide.
 */
export function Tiger({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={TIGER.id} transform={transform} className={className}>
			<Quadruped
				x1={-13}
				x2={10}
				y={-9}
				legs={[-11, -8, 6, 9]}
				seed={seed}
				weight={weight}
			/>
			{[-6, -2, 2].map((x) => (
				<Run
					key={x}
					x1={x - 1}
					y1={-12}
					x2={x + 1}
					y2={-6}
					seed={seed + x}
					weight={weight * 0.8}
				/>
			))}
			<Run x1={10} y1={-9} x2={13} y2={-12} seed={seed} weight={weight} />
			<Dab cx={14} cy={-13} r={2.2} />
			<Shape
				points={[
					{ x: -13, y: -9 },
					{ x: -16.5, y: -13 },
					{ x: -13.5, y: -17 },
				]}
				seed={seed + 5}
				weight={weight}
				close={false}
			/>
		</g>
	);
}

export const MONKEY: PrimitiveSpec = {
	id: "warli-monkey",
	box: { x: -12, y: -20, width: 24, height: 20 },
	origin: { x: 0, y: 0 },
};

/**
 * A monkey: a low quadruped with a round head and a tail curled high over it.
 *
 * ⚠ REBUILT AFTER THE PLATE SHOWED IT BROKEN. The first version tried to draw a
 * CROUCH — a short diagonal back with four limbs hung off it at angles — and on
 * the plate it came out as two disconnected sticks beside a floating circle. The
 * lesson is the one this file's docblock already states and the first attempt
 * ignored: at twenty units, posture does not read. Only a silhouette with one
 * thing sticking out of it does.
 *
 * So the monkey is now the same quadruped as everything else, and the entire
 * identification is carried by two marks that nothing else in the bestiary has:
 * a tail curled UP and OVER the back, and a head that is a circle rather than a
 * dab. It is a smaller idea than a crouch and it is the one that works.
 */
export function Monkey({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={MONKEY.id} transform={transform} className={className}>
			<Quadruped
				x1={-7}
				x2={4}
				y={-10}
				legs={[-6, -3, 1, 3.5]}
				seed={seed}
				weight={weight}
			/>
			<Run x1={4} y1={-10} x2={7} y2={-14} seed={seed} weight={weight} />
			<Disc cx={8.4} cy={-16} r={2.9} seed={seed} weight={weight} />
			<Dab cx={7.4} cy={-16.4} r={0.7} />
			{/* the curl — one gesture, and it is the entire identification */}
			<Shape
				points={[
					{ x: -7, y: -10 },
					{ x: -11, y: -13 },
					{ x: -10.5, y: -17 },
					{ x: -6, y: -19 },
					{ x: -3, y: -16.5 },
				]}
				seed={seed + 7}
				weight={weight}
				close={false}
			/>
		</g>
	);
}

export const SCORPION: PrimitiveSpec = {
	id: "warli-scorpion",
	box: { x: -14, y: -14, width: 28, height: 14 },
	origin: { x: 0, y: 0 },
};

/** A scorpion: a segmented body, eight legs, two claws, a tail curled over. */
export function Scorpion({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SCORPION.id} transform={transform} className={className}>
			<Run x1={-6} y1={-4} x2={4} y2={-4} seed={seed} weight={weight} />
			{[-5, -2, 1, 4].map((x) => (
				<g key={x}>
					<Run
						x1={x}
						y1={-4}
						x2={x - 2}
						y2={0}
						seed={seed + x}
						weight={weight * 0.8}
					/>
					<Run
						x1={x}
						y1={-4}
						x2={x - 2}
						y2={-8}
						seed={seed + x + 1}
						weight={weight * 0.8}
					/>
				</g>
			))}
			{[-1, 1].map((s) => (
				<Shape
					key={s}
					points={[
						{ x: -6, y: -4 },
						{ x: -10, y: -4 + s * 2 },
						{ x: -13.5, y: -4 + s * 1.2 },
					]}
					seed={seed + s * 9}
					weight={weight}
					close={false}
				/>
			))}
			<Shape
				points={[
					{ x: 4, y: -4 },
					{ x: 8, y: -6 },
					{ x: 10, y: -11 },
					{ x: 7, y: -13.5 },
				]}
				seed={seed + 11}
				weight={weight}
				close={false}
			/>
			<Dab cx={6} cy={-13.8} r={1.3} />
		</g>
	);
}

export const SNAKE: PrimitiveSpec = {
	id: "warli-snake",
	box: { x: -16, y: -10, width: 32, height: 10 },
	origin: { x: 0, y: 0 },
};

/** A snake: one serpentine run and a head. No legs, so no body bar either. */
export function Snake({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={SNAKE.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -15, y: -1 },
					{ x: -9, y: -6 },
					{ x: -3, y: -1 },
					{ x: 3, y: -6 },
					{ x: 9, y: -1 },
					{ x: 13, y: -5 },
				]}
				seed={seed}
				weight={weight}
				close={false}
			/>
			<Dab cx={14.5} cy={-6} r={1.8} />
			<Run
				x1={15.5}
				y1={-7.5}
				x2={16}
				y2={-9.5}
				seed={seed}
				weight={weight * 0.7}
			/>
		</g>
	);
}

export const CRAB: PrimitiveSpec = {
	id: "warli-crab",
	box: { x: -12, y: -12, width: 24, height: 12 },
	origin: { x: 0, y: 0 },
};

/**
 * A crab: a wide flat carapace, legs splayed below it, two pincers raised.
 *
 * ⚠ REBUILT AFTER THE PLATE SHOWED IT READING AS A BOWTIE. The first version
 * used a small round body with three legs per side leaving it at shallow angles
 * and claws at a similar angle above — six near-horizontal strokes converging on
 * a four-unit circle, which at this size is two triangles meeting in the middle.
 * The body was invisible and the silhouette was an hourglass.
 *
 * The fix is that the CARAPACE has to be the biggest thing: a wide shallow shell
 * that is unmistakably one mass, with the legs dropped steeply BELOW it so they
 * read as underneath rather than as part of the outline, and the pincers lifted
 * clear above it. Width against height is what says crab.
 */
export function Crab({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={CRAB.id} transform={transform} className={className}>
			{/* the carapace — wide, shallow, and the dominant mass */}
			<Shape
				points={[
					{ x: -7.5, y: -7 },
					{ x: -4, y: -10.5 },
					{ x: 4, y: -10.5 },
					{ x: 7.5, y: -7 },
					{ x: 4.5, y: -4.5 },
					{ x: -4.5, y: -4.5 },
				]}
				seed={seed}
				weight={weight}
			/>
			{[-1, 1].map((s) => (
				<g key={s}>
					{/* legs drop STEEPLY, so they read as under the shell */}
					{[0, 1, 2].map((i) => (
						<Run
							key={i}
							x1={s * (2 + i * 2)}
							y1={-4.5}
							x2={s * (5 + i * 2.4)}
							y2={0}
							seed={seed + s * 10 + i}
							weight={weight * 0.8}
						/>
					))}
					{/* the pincer, lifted clear of the shell */}
					<Run
						x1={s * 6.6}
						y1={-8.6}
						x2={s * 10}
						y2={-12}
						seed={seed + s * 5}
						weight={weight}
					/>
					<Shape
						points={[
							{ x: s * 12.5, y: -11 },
							{ x: s * 9.6, y: -12.4 },
							{ x: s * 12, y: -14.5 },
						]}
						seed={seed + s * 3}
						weight={weight}
						close={false}
					/>
				</g>
			))}
			<Dab cx={-2.2} cy={-8.6} r={0.85} />
			<Dab cx={2.2} cy={-8.6} r={0.85} />
		</g>
	);
}

export const ROOSTER: PrimitiveSpec = {
	id: "warli-rooster",
	box: { x: -12, y: -20, width: 24, height: 20 },
	origin: { x: 0, y: 0 },
};

/** A rooster: two legs, an upright body, a comb and a sickle tail. */
export function Rooster({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={ROOSTER.id} transform={transform} className={className}>
			<Run x1={-1} y1={-7} x2={-2.5} y2={0} seed={seed} weight={weight} />
			<Run x1={1.5} y1={-7} x2={2} y2={0} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -4, y: -8 },
					{ x: 3, y: -10 },
					{ x: 5, y: -14 },
					{ x: 2, y: -16 },
					{ x: -3, y: -13 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Dab cx={4.5} cy={-17} r={1.9} />
			<Run x1={4} y1={-19} x2={3} y2={-20} seed={seed} weight={weight * 0.7} />
			<Run
				x1={6}
				y1={-18.8}
				x2={6.8}
				y2={-16.5}
				seed={seed}
				weight={weight * 0.7}
			/>
			{[0, 1, 2].map((i) => (
				<Shape
					key={i}
					points={[
						{ x: -4, y: -10 },
						{ x: -9 - i * 1.4, y: -13 - i * 2 },
						{ x: -11 - i * 1.2, y: -18 - i * 0.8 },
					]}
					seed={seed + i * 13}
					weight={weight}
					close={false}
				/>
			))}
		</g>
	);
}

export const PEACOCK: PrimitiveSpec = {
	id: "warli-peacock",
	box: { x: -16, y: -26, width: 32, height: 26 },
	origin: { x: 0, y: 0 },
};

/** A peacock: the fan is the whole animal, and it is drawn as rays with eyes. */
export function Peacock({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	const rays = [-58, -38, -18, 2, 22];
	return (
		<g data-warli-id={PEACOCK.id} transform={transform} className={className}>
			<Run x1={0} y1={-6} x2={-1.5} y2={0} seed={seed} weight={weight} />
			<Run x1={2.5} y1={-6} x2={3} y2={0} seed={seed} weight={weight} />
			<Shape
				points={[
					{ x: -2, y: -7 },
					{ x: 4, y: -9 },
					{ x: 6, y: -13 },
					{ x: 3, y: -15 },
					{ x: -1, y: -12 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Dab cx={5.5} cy={-16} r={1.8} />
			<Run
				x1={5}
				y1={-18}
				x2={4.2}
				y2={-20}
				seed={seed}
				weight={weight * 0.7}
			/>
			{rays.map((deg) => {
				const rad = ((deg - 90) * Math.PI) / 180;
				const x = -3 + Math.cos(rad) * 13;
				const y = -11 + Math.sin(rad) * 13;
				return (
					<g key={deg}>
						<Run
							x1={-3}
							y1={-11}
							x2={x}
							y2={y}
							seed={seed + deg}
							weight={weight * 0.85}
						/>
						<Dab cx={x} cy={y} r={1.5} />
					</g>
				);
			})}
		</g>
	);
}

export const FISH: PrimitiveSpec = {
	id: "warli-fish",
	box: { x: -12, y: -6, width: 24, height: 12 },
	origin: { x: 0, y: 0 },
};

/**
 * A fish: two bowed runs meeting at nose and tail, plus a tail fin.
 *
 * ⚠ THE ONLY MOTIF DRAWN ABOUT ITS CENTRE rather than standing on a baseline,
 * because a fish does not stand on anything. The scene engine places it in
 * water, not on ground, and a fish whose origin was its belly would float a body
 * height above every stream it was put in.
 */
export function Fish({
	transform,
	className,
	weight = WEIGHT_SPARE,
	seed = 0,
}: PrimitiveProps) {
	return (
		<g data-warli-id={FISH.id} transform={transform} className={className}>
			<Shape
				points={[
					{ x: -5, y: 0 },
					{ x: 1, y: -4.5 },
					{ x: 8, y: 0 },
					{ x: 1, y: 4.5 },
				]}
				seed={seed}
				weight={weight}
			/>
			<Shape
				points={[
					{ x: -5, y: 0 },
					{ x: -10, y: -4 },
					{ x: -10, y: 4 },
				]}
				seed={seed + 2}
				weight={weight}
			/>
			<Dab cx={5} cy={-0.6} r={0.9} />
		</g>
	);
}
