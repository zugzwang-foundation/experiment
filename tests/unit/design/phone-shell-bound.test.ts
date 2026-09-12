import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2d — THE HOLES THE PAIRING GUARD LEAVES, CLOSED.
 *
 * ⛔⛔ WHY A SECOND FILE RATHER THAN MORE ROWS IN THE FIRST.
 * `phone-scroll-model.test.ts` pins the pairing *containment ⇔ a bounded root*,
 * and it pins it through the PANE. MOBILE-2d then moved the vertical scroller
 * OFF the pane and onto an ancestor — which is the right topology and is the
 * night's finding — but it also emptied the pairing's consequent: the pane now
 * carries no containment in EITHER state, so the unbounded branch's
 * `expect(overscrollTokens(pane)).toEqual([])` is satisfied unconditionally.
 *
 * Measured by mutation against the whole of `tests/unit/design/` (26 files, 203
 * tests) on 2026-09-13 — every one of these is GREEN today:
 *
 *   · delete the tier root's `h-[calc(100dvh…)]`      → the shell is unbounded
 *     again and the scroll region still declares containment, which is the
 *     2026-09-12 dead region one element over from where it was found;
 *   · delete the root's `overflow-hidden`;
 *   · delete the root's `flex-none`, or swap it for `flex-1` — the exact
 *     MOBILE-2b basis trap the root's own docblock says is "not optional" and
 *     that painted a blank market page on WebKit;
 *   · write the height as `[height:calc(100vh…)]` instead of `h-[…]` — the
 *     recogniser only knows the `h-`/`max-h-` spelling, so the whole dvh rule
 *     goes vacuous and the bet bar goes under the browser toolbar;
 *   · swap the region's `overflow-y-auto` for `overflow-y-hidden` — still an
 *     `overflow-y-*` token, so the "must be the vertical scroller" row passes
 *     while the tier has no vertical scroller at all;
 *   · swap the region's containment for `overscroll-y-auto` (no containment) or
 *     `overscroll-x-contain` (the wrong axis) — both still count as
 *     "an overscroll token";
 *   · put an `overflow-y-auto` on the pane's CONTENT wrapper, which is authored
 *     in `PhoneDebateView.tsx` and therefore invisible to a scan that reads
 *     `PhoneFeedTrack.tsx` alone.
 *
 * ⚠ SOURCE SCAN, because jsdom performs no layout (AGENTS.md §9) — the
 * behavioural half is the browser measurement in the run report.
 * ⚠ EVERY VARIANT-PREFIXED CLASS TOKEN IS ASSEMBLED AT RUNTIME. Tailwind v4's
 * source detection scans `tests/`, so a class-shaped literal here becomes a real
 * emitted utility whose only origin is a test file (AGENTS.md §8).
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const PHONE_DIR = "src/components/debate/phone";
const VIEW = `${PHONE_DIR}/PhoneDebateView.tsx`;
const TRACK = `${PHONE_DIR}/PhoneFeedTrack.tsx`;
const SHEET = `${PHONE_DIR}/PhoneSheet.tsx`;

const V = "max-mobile";
const S = ":";
const phone = (u: string) => V + S + u;

/** Comments stripped before every scan, line count preserved (`O-8` family). */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function balanced(src: string, at: number): string {
	const open = src[at] ?? "";
	const close = open === "(" ? ")" : open === "{" ? "}" : "]";
	let depth = 0;
	let quote: string | null = null;
	let i = at;
	for (; i < src.length; i++) {
		const ch = src[i] ?? "";
		if (quote !== null) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'" || ch === "`") {
			quote = ch;
			continue;
		}
		if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) break;
		}
	}
	return src.slice(at + 1, i);
}

/** The class tokens of the `className` nearest AFTER `anchor` (a `data-*`). */
function classTokensAfter(src: string, anchor: string): string[] {
	const at = src.indexOf(anchor);
	if (at === -1) throw new Error(`no anchor \`${anchor}\``);
	const braced = src.indexOf("className={", at);
	const quoted = src.indexOf('className="', at);
	const useBraced =
		braced !== -1 && (quoted === -1 || braced < quoted) ? braced : -1;
	const raw =
		useBraced !== -1
			? balanced(src, useBraced + "className=".length)
			: (() => {
					if (quoted === -1)
						throw new Error(`no className after \`${anchor}\``);
					const from = quoted + 'className="'.length;
					return src.slice(from, src.indexOf('"', from));
				})();
	return raw
		.split(/\s+/)
		.map((t) => t.replace(/^[`'"]+|[`'"]+$/g, ""))
		.filter(Boolean);
}

const rootTokens = () =>
	classTokensAfter(code(read(VIEW)), 'data-testid="phone-debate-view"');
const regionTokens = () =>
	classTokensAfter(code(read(VIEW)), 'data-testid="phone-scroll-region"');

/* ────────────────────────────────────────────────────────────────────────────
 * Recognisers. Each is exercised by a synthetic control in `the-recognisers`
 * below, because every rule in this file is an implication and an implication
 * whose antecedent cannot be READ is vacuously true.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Every phone-scoped HEIGHT declaration in a class list — **in both spellings**.
 * Tailwind will accept `h-[calc(…)]` and the arbitrary-property
 * `[height:calc(…)]` interchangeably and they compile to the same rule; a
 * recogniser that knows only the first turns every rule keyed on it into a
 * no-op the moment somebody reaches for the second.
 */
function phoneHeightTokens(tokens: string[]): string[] {
	const named = new RegExp(`^${V}${S}(h|max-h)-`);
	const arbitrary = /\[(max-)?height:/;
	return tokens.filter(
		(t) => t.startsWith(V + S) && (named.test(t) || arbitrary.test(t)),
	);
}

/** A viewport-height unit, including the NAMED `screen` spelling of `100vh`. */
const VIEWPORT_HEIGHT = /(^|[^a-z])(screen|[dsl]?vh)\b|-(screen)$/;

/**
 * Does this token bound the block axis with a unit that tracks the REAL window?
 * `vh` and `lvh` are the LARGE viewport: with a mobile toolbar showing they
 * exceed the window, and under `overflow: hidden` with no document scroll, past
 * the bottom means unreachable. `screen` is Tailwind's name for `100vh`.
 */
const SAFE_VIEWPORT_UNIT = /[ds]vh/;
const UNSAFE_VIEWPORT_UNIT = /(^|[^ds])vh|-screen\b|:screen\b/;

/**
 * Containment on the BLOCK axis — the only axis this rule is about. The track's
 * `overscroll-x-contain` is a correct, permanent declaration on a box that
 * genuinely scrolls horizontally in either model, so it must not be swept in.
 */
function blockAxisContainment(tokens: string[]): string[] {
	return tokens.filter((t) => {
		if (/(^|:)overscroll-(y-)?(contain|none)$/.test(t)) return true;
		if (!t.includes("overscroll-behavior")) return false;
		if (t.includes("overscroll-behavior-x")) return false;
		return !/:\s*auto/.test(t);
	});
}

/** Any `overscroll-*` token at all, block axis or not. */
const anyContainment = (tokens: string[]) =>
	tokens.filter(
		(t) => /(^|:)overscroll-/.test(t) || t.includes("overscroll-behavior"),
	);

/** A token that makes a box a VERTICAL SCROLLER — not merely one that names the axis. */
const SCROLLS_VERTICALLY = /(^|:)overflow(-y)?-(auto|scroll)$/;

/**
 * ⛔ THE BOUND, AS THE THREE TOKENS IT ACTUALLY IS. The tier root's own docblock
 * names them and says why each is load-bearing; this is that sentence made
 * mechanical. `flex-none` is in the set because `flex: 1 1 0%` sets
 * `flex-basis: 0%`, in a COLUMN container the basis IS the main size, and a
 * percentage basis against an indefinite parent resolves to content — measured
 * on `<main>` at MOBILE-2b, where Chromium ignored the height and WebKit painted
 * a blank market page.
 */
function boundIsComplete(tokens: string[]): {
	bounded: boolean;
	missing: string[];
} {
	const heights = phoneHeightTokens(tokens);
	if (heights.length === 0) return { bounded: false, missing: [] };
	const missing: string[] = [];
	if (!tokens.includes(phone("overflow-hidden")))
		missing.push(phone("overflow-hidden"));
	if (!tokens.includes(phone("flex-none"))) missing.push(phone("flex-none"));
	return { bounded: true, missing };
}

describe("phone shell — the guard reaches real source", () => {
	it("phone-shell::guard-is-alive", () => {
		const root = rootTokens();
		const region = regionTokens();
		expect(root.length, "the tier root's class list was read").toBeGreaterThan(
			3,
		);
		expect(
			region.length,
			"the scroll region's class list was read",
		).toBeGreaterThan(2);
		expect(root).toContain("hidden");
		expect(root).toContain(phone("flex"));
		expect(region).toContain("flex-1");
	});

	/**
	 * ⛔ EVERY RECOGNISER, PROVED TO FIRE ON THE SHAPE IT REJECTS AND TO STAY
	 * SILENT ON THE ONE IT ALLOWS. Without this block a recogniser broken in any
	 * of six ways reports a clean scan, which is the exact defect this file was
	 * written to close one layer up.
	 */
	it("phone-shell::the-recognisers-fire", () => {
		const H = "h-";
		const MH = "max-h-";
		const calcDvh = "[calc(100dvh-60px-2px)]";
		const calcVh = "[calc(100vh-60px-2px)]";
		const arbVh = "[height" + S + "calc(100vh-60px-2px)]";
		const arbDvh = "[max-height" + S + "calc(100dvh)]";

		// both height spellings are seen, and only when phone-scoped
		expect(phoneHeightTokens([phone(H + calcDvh)])).toHaveLength(1);
		expect(phoneHeightTokens([phone(MH + calcDvh)])).toHaveLength(1);
		expect(phoneHeightTokens([phone(arbVh)])).toHaveLength(1);
		expect(phoneHeightTokens([phone(arbDvh)])).toHaveLength(1);
		expect(
			phoneHeightTokens([H + calcDvh]),
			"unprefixed is NOT a phone bound",
		).toHaveLength(0);
		expect(
			phoneHeightTokens(["hidden", "w-full", phone("flex-col")]),
		).toHaveLength(0);

		// the unit rule, on every spelling that has ever been reached for
		expect(SAFE_VIEWPORT_UNIT.test(phone(H + calcDvh))).toBe(true);
		expect(SAFE_VIEWPORT_UNIT.test(phone(H + "[100svh]"))).toBe(true);
		expect(SAFE_VIEWPORT_UNIT.test(phone(H + calcVh))).toBe(false);
		expect(SAFE_VIEWPORT_UNIT.test(phone(H + "screen"))).toBe(false);
		expect(UNSAFE_VIEWPORT_UNIT.test(phone(H + calcVh))).toBe(true);
		expect(UNSAFE_VIEWPORT_UNIT.test(phone(H + "[100lvh]"))).toBe(true);
		expect(UNSAFE_VIEWPORT_UNIT.test(phone(H + "screen"))).toBe(true);
		expect(UNSAFE_VIEWPORT_UNIT.test(phone(H + calcDvh))).toBe(false);
		expect(VIEWPORT_HEIGHT.test(H + "screen")).toBe(true);
		expect(VIEWPORT_HEIGHT.test(H + "full")).toBe(false);

		// block-axis containment, and the track's x-axis declaration excluded
		expect(blockAxisContainment(["overscroll-y-contain"])).toHaveLength(1);
		expect(blockAxisContainment(["overscroll-contain"])).toHaveLength(1);
		expect(
			blockAxisContainment(["overscroll-x-contain"]),
			"the horizontal track's own containment is not this rule's subject",
		).toHaveLength(0);
		expect(
			blockAxisContainment(["overscroll-y-auto"]),
			"`auto` is the ABSENCE of containment wearing the token's name",
		).toHaveLength(0);
		expect(anyContainment(["overscroll-x-contain"])).toHaveLength(1);

		// a scroller, not merely a box that names the axis
		expect(SCROLLS_VERTICALLY.test("overflow-y-auto")).toBe(true);
		expect(SCROLLS_VERTICALLY.test("overflow-y-scroll")).toBe(true);
		expect(SCROLLS_VERTICALLY.test("overflow-auto")).toBe(true);
		expect(
			SCROLLS_VERTICALLY.test("overflow-y-hidden"),
			"a hidden box clips; it does not scroll, and the reader cannot reach " +
				"the bottom of the feed",
		).toBe(false);

		// the bound is a SET
		const full = [
			phone("h-" + calcDvh),
			phone("flex-none"),
			phone("overflow-hidden"),
		];
		expect(boundIsComplete(full)).toEqual({ bounded: true, missing: [] });
		expect(boundIsComplete(["hidden"]).bounded).toBe(false);
		expect(
			boundIsComplete(full.filter((t) => t !== phone("flex-none"))).missing,
		).toEqual([phone("flex-none")]);
	});
});

describe("phone shell — the bound is a set, and the set moves together", () => {
	/**
	 * ⛔⛔ A HEIGHT ALONE IS NOT A BOUND. Deleting `flex-none` or
	 * `overflow-hidden` leaves the height token sitting there looking like the
	 * shell is bounded while the chain above or below it is free again — and both
	 * deletions are GREEN under the whole design suite today.
	 */
	it("phone-shell::a-bounded-root-carries-the-whole-bound", () => {
		const { bounded, missing } = boundIsComplete(rootTokens());
		expect(
			bounded,
			"the tier root must declare a definite height below 640px",
		).toBe(true);
		expect(
			missing,
			"a definite height is only a bound alongside `flex-none` (a column " +
				"flex-basis of 0% BEATS height, and resolves to content against an " +
				"indefinite parent — WebKit painted a blank market page on exactly " +
				"this at MOBILE-2b) and `overflow-hidden` (without it the content " +
				"paints past the box and the document is the scroller again)",
		).toEqual([]);
	});

	/**
	 * ⛔ AND IT IS `dvh`, WHICHEVER WAY IT IS SPELLED. The existing dvh rule reads
	 * heights through an `^max-mobile:(h|max-h)-` regex, so rewriting the same
	 * declaration as the arbitrary property `[height:calc(100vh…)]` makes the rule
	 * find nothing and pass — with the bet bar under the browser toolbar and, with
	 * `overflow: hidden` and no document scroll, unreachable.
	 */
	it("phone-shell::every-phone-height-is-sized-in-dvh-or-svh", () => {
		const heights = phoneHeightTokens(rootTokens());
		expect(
			heights.length,
			"at least one phone height was found",
		).toBeGreaterThan(0);
		for (const h of heights) {
			expect(
				SAFE_VIEWPORT_UNIT.test(h),
				`${h}: a bounded phone shell is sized in dvh or svh`,
			).toBe(true);
			expect(
				UNSAFE_VIEWPORT_UNIT.test(h),
				`${h}: vh and lvh are the LARGE viewport, and h-screen is 100vh`,
			).toBe(false);
		}
	});

	/**
	 * ⛔ NO UNPREFIXED VIEWPORT HEIGHT, INCLUDING THE NAMED ONES. The existing row
	 * matches the literal text `vh`, so `h-screen` — which IS `100vh` — walks
	 * straight past it onto an element the desktop shares the page with.
	 */
	it("phone-shell::the-tier-root-carries-no-unprefixed-viewport-height", () => {
		const bare = rootTokens().filter(
			(t) =>
				!t.startsWith(V + S) &&
				/(^|:)(h|min-h|max-h)-/.test(t) &&
				VIEWPORT_HEIGHT.test(t),
		);
		expect(
			bare,
			"an unprefixed viewport height on the tier root is a desktop change — " +
				"`hidden` is a DISPLAY rule and does not make a sizing token inert",
		).toEqual([]);
		// POSITIVE CONTROL — the recogniser fires on both spellings.
		const control = [
			"hidden",
			"h-" + "screen",
			"h-" + "[calc(100dvh)]",
			"w-full",
		];
		expect(
			control.filter(
				(t) =>
					!t.startsWith(V + S) &&
					/(^|:)(h|min-h|max-h)-/.test(t) &&
					VIEWPORT_HEIGHT.test(t),
			),
		).toHaveLength(2);
	});
});

describe("phone shell — containment and the bound are one fact", () => {
	/**
	 * ⛔⛔ THE PAIRING, AS A BICONDITIONAL, ACROSS THE WHOLE TIER — WHICH IS THE
	 * PART THAT WENT VACUOUS WHEN THE SCROLLER MOVED.
	 *
	 * MOBILE-2d's opening defect was `overscroll-contain` on a box that could
	 * never scroll, because nothing bounded the chain: Chromium will not chain a
	 * pan out of a non-overflowing `overflow:auto` box that declares containment,
	 * so the box's rectangle becomes a dead region while the chrome around it
	 * keeps scrolling the page. That defect is a property of the COMBINATION, and
	 * it does not care which element holds the token — moving the scroller from
	 * the pane to an ancestor moved the token with it and left the old guard
	 * checking an element that now has nothing to check.
	 *
	 * ⇒ Stated in both directions at once: the tier declares block-axis
	 * containment IF AND ONLY IF the tier root is bounded. Neither half can go
	 * vacuous, because each is the other's antecedent.
	 */
	it("phone-shell::block-axis-containment-exists-iff-the-root-is-bounded", () => {
		const { bounded } = boundIsComplete(rootTokens());
		const declared = [code(read(VIEW)), code(read(TRACK))].flatMap((src) =>
			[...src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].flatMap((m) =>
				blockAxisContainment((m[1] ?? m[2] ?? "").split(/\s+/).filter(Boolean)),
			),
		);
		expect(
			declared.length > 0,
			bounded
				? "the shell is bounded, so something in it really scrolls vertically " +
						"and must contain its own overscroll, or a pan reaching the end of " +
						"the feed chains out to whatever is behind the shell"
				: "nothing bounds the chain, so every box grows to its content and " +
						"never scrolls — and block-axis containment on a box that never " +
						"scrolls has exactly one reachable effect, which is the dead region " +
						"of the 2026-09-12 Android report (probe §7.2)",
		).toBe(bounded);
		// POSITIVE CONTROL — the className harvester reads real lists.
		expect(
			[...code(read(TRACK)).matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
				.length,
		).toBeGreaterThanOrEqual(2);
	});

	/**
	 * ⛔ AND THE SCROLL REGION REALLY SCROLLS, AND REALLY CONTAINS. Both of the
	 * existing rows are satisfied by a token that merely NAMES the right thing:
	 * `overflow-y-hidden` starts with `overflow-y-`, and `overscroll-y-auto` and
	 * `overscroll-x-contain` both match `(^|:)overscroll-`. One leaves the tier
	 * with no vertical scroller at all — the feed simply ends at the fold — and
	 * the other two leave the reader's over-pan chaining out of the shell.
	 */
	it("phone-shell::the-scroll-region-scrolls-and-contains-on-the-block-axis", () => {
		const region = regionTokens();
		expect(
			region.filter((t) => SCROLLS_VERTICALLY.test(t)),
			"the scroll region must be a real vertical SCROLLER — `overflow-y-hidden` " +
				"clips, and a clipped feed has no way to reach its own bottom",
		).toHaveLength(1);
		expect(
			blockAxisContainment(region),
			"and it must contain its own overscroll on the axis it scrolls: `auto` " +
				"is no containment, and an x-axis declaration is a token on an axis " +
				"this box does not move in",
		).toHaveLength(1);
		expect(region, "the 1fr row of a bounded column").toContain("min-h-0");
	});
});

describe("phone shell — exactly two vertical scrollers, and they are named", () => {
	/**
	 * ⛔⛔ COUNTED, NOT NAMED — BECAUSE AN UNNAMED ELEMENT IS THE WHOLE HOLE.
	 *
	 * The existing topology rule scans `PhoneFeedTrack.tsx` for
	 * `overflow-y-(auto|scroll)`, which catches a nested scroller authored THERE.
	 * But the pane's CONTENT is authored in `PhoneDebateView.tsx` — `feedPane()`
	 * and `threadPane()` each return a wrapper div — so putting the scroller on
	 * that wrapper produces exactly the nested topology the night measured at
	 * 25/40, in a file the scan does not read, with no `data-testid` to name it.
	 * Measured: GREEN under the whole design suite.
	 *
	 * ⇒ So the rule is a RECONCILIATION. Every vertical-scroller token in the
	 * phone tree must be attributable to one of the two elements that are allowed
	 * to be one; a count that exceeds the attributed set means a scroller exists
	 * on an element nobody named, which is precisely how it would arrive.
	 */
	it("phone-shell::every-vertical-scroller-in-the-tree-is-one-of-the-two-ratified-ones", () => {
		const RATIFIED: [string, string][] = [
			// the tier's one vertical scroller — the ANCESTOR of the snap track
			[VIEW, "phone-scroll-region"],
			// the sheet's own body, which is a separate modal scroller and is what
			// keeps `PLACE Đ BET` reachable with a keyboard up (2c CR-HIGH-6)
			[SHEET, "phone-sheet-body"],
		];
		for (const [file, testid] of RATIFIED) {
			expect(
				classTokensAfter(code(read(file)), `data-testid="${testid}"`).filter(
					(t) => SCROLLS_VERTICALLY.test(t),
				),
				`${testid} is a ratified vertical scroller and must still be one`,
			).toHaveLength(1);
		}

		const files = readdirSync(join(ROOT, PHONE_DIR)).filter(
			(n) => n.endsWith(".ts") || n.endsWith(".tsx"),
		);
		const found: string[] = [];
		for (const name of files) {
			const src = code(read(`${PHONE_DIR}/${name}`));
			for (const m of src.matchAll(/overflow(-y)?-(auto|scroll)/g)) {
				found.push(`${PHONE_DIR}/${name}: ${m[0]}`);
			}
		}
		expect(
			found.length,
			"a vertical scroller exists in the phone tree that is not one of the " +
				`two ratified ones (${RATIFIED.map(([, t]) => t).join(", ")}). The ` +
				"vertical scroller is the snap track's ANCESTOR and there is exactly " +
				"one of it — nesting a second inside the track is the shape measured " +
				"at 25 of 40 sideways swipes dead:\n  " +
				found.join("\n  "),
		).toBe(RATIFIED.length);

		// POSITIVE CONTROLS — the corpus is non-empty and the recogniser fires.
		// ⚠ EIGHT, NOT NINE. `scroll-lock.ts` briefly lived under `phone/` and was
		// moved to `debate/` because the desktop path imports it — see
		// `phone-scroll-model.test.ts`'s `LOCK`. The floor is a liveness control,
		// so it tracks `ls src/components/debate/phone/ | wc -l` rather than a
		// remembered number.
		expect(files.length).toBeGreaterThanOrEqual(8);
		expect([
			...`x overflow-y-${"auto"} y`.matchAll(/overflow(-y)?-(auto|scroll)/g),
		]).toHaveLength(1);
		// ...and the track's HORIZONTAL scroller is deliberately not swept in.
		expect([
			...`overflow-x-${"auto"}`.matchAll(/overflow(-y)?-(auto|scroll)/g),
		]).toHaveLength(0);
	});
});
