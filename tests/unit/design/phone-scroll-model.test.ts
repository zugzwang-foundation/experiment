import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2d — THE PHONE TIER'S SCROLL MODEL, PINNED AS A **PAIR** RATHER THAN AS
 * TOKENS.
 *
 * ⛔⛔ THE RULE, IN ONE SENTENCE: a pane may declare `overscroll-behavior` only
 * while the tier root declares a DEFINITE HEIGHT, and the tier root's definite
 * height is only safe while the track row carries `min-h-0`. Three tokens in two
 * files, and every one of them is correct in one state and a defect in the
 * other. Pinning any one of them alone pins the wrong thing.
 *
 * ⚠ WHY IT IS A PAIR AND NOT A LIST. The defect this file exists to prevent was
 * shipped as a perfectly reasonable declaration:
 * `overflow-y-auto overscroll-contain` on a pane that was MEANT to be a
 * scroller. It never became one, because `min-h-[calc(100dvh-60px-2px)]` on
 * `<main>` is a MINIMUM — nothing bounded the chain from above, every box grew
 * to its content, and `scrollHeight === clientHeight` on the pane forever. A
 * containment declaration on a box that never scrolls is not inert: Chromium
 * will not chain a pan out of a non-overflowing `overflow:auto` box that
 * declares `contain`, so the pane's rectangle becomes a dead region while the
 * chrome around it keeps scrolling the page. Measured, both polarities, in
 * `~/Downloads/zz_MOBILE-2c-ANDROID_probe_2026-09-12T1435.md` §7.2.
 *
 * ⇒ So the token is not wrong and the bound is not wrong. **The COMBINATION is
 * wrong**, and a guard that names one half passes on whichever half moves first.
 *
 * ⚠ THIS FILE IS A SOURCE SCAN BECAUSE jsdom PERFORMS NO LAYOUT (AGENTS.md §9).
 * `scrollHeight > clientHeight` is a layout fact and jsdom answers `0 > 0` for
 * every element on the page. The behavioural half of this claim is measured in a
 * real browser and lives in the run report; what can be held in the repository
 * is the source relationship, and that is what this file holds.
 *
 * ⚠ EVERY CLASS TOKEN IS ASSEMBLED AT RUNTIME. Tailwind v4's source detection
 * scans `tests/`, so a class-shaped literal here becomes a real emitted utility
 * whose only origin is a test file (AGENTS.md §8, the measured
 * `max-mobile:opacity-0` case).
 */
const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const TRACK = "src/components/debate/phone/PhoneFeedTrack.tsx";
const VIEW = "src/components/debate/phone/PhoneDebateView.tsx";

const V = "max-mobile";
const S = ":";
/** `phone("h-full")` — the variant-prefixed token, built at runtime. */
const phone = (u: string) => V + S + u;

/**
 * ⛔ COMMENTS STRIPPED BEFORE EVERY SCAN, line count preserved. On this file it
 * is load-bearing twice over: `PhoneFeedTrack`'s pane carries a twenty-line
 * docblock whose subject is the words `overscroll-contain` and `min-h`, and this
 * very test file's header contains both. Six recorded instances in this
 * repository of a textual guard matching the comment that explains the absence.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The text between `src[at]` and its matching close, exclusive of both. */
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

/**
 * The class tokens of the `className` nearest AFTER `anchor`.
 *
 * ⛔ THE ANCHOR IS A `data-*` ATTRIBUTE, NEVER A LINE AND NEVER A CHARACTER
 * WINDOW (`O-8`: a `slice(at, at + N)` is a line number wearing a different
 * unit, and prose is what moves). The enclosing backtick of a template-literal
 * `className` is stripped, because the first token would otherwise arrive as
 * `` `w-full `` and a `not.toContain` arm would pass against the very token it
 * rejects when someone puts it at the head of the string.
 */
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

/** Every `overscroll-*` / `[overscroll-behavior…]` token in a class list. */
const overscrollTokens = (tokens: string[]) =>
	tokens.filter(
		(t) => /(^|:)overscroll-/.test(t) || t.includes("overscroll-behavior"),
	);

/**
 * Does this class list declare a DEFINITE height below 640px? `h-*` and
 * `max-h-*` bound; `min-h-*` does not, which is the entire subject of this file.
 *
 * ⚠ `flex-1` DISQUALIFIES A `h-*` ON A COLUMN FLEX ITEM. `flex: 1 1 0%` sets
 * `flex-basis: 0%`, and in a column container the basis IS the main size — it
 * beats `height`, and a percentage basis against an indefinite parent resolves
 * to `auto`, i.e. content. `(public)/layout.tsx`'s own docblock records this
 * being tried and measured: Chromium kept growing to content, WebKit resolved
 * `<main>` to ZERO HEIGHT and painted a blank market page. So a definite height
 * must be paired with a `flex-none`, or carry no `flex-1` at all.
 */
function declaresDefiniteHeightBelow640(tokens: string[]): boolean {
	const hasHeight = tokens.some((t) =>
		new RegExp(`^${V}${S}(h|max-h)-`).test(t),
	);
	if (!hasHeight) return false;
	const grows = tokens.includes(phone("flex-1"));
	const pinned = tokens.includes(phone("flex-none"));
	return !grows || pinned;
}

describe("phone scroll model — the guard reaches real source", () => {
	it("phone-scroll::guard-is-alive", () => {
		// ⛔ EVERY PAIRING BELOW IS AN IMPLICATION, AND AN IMPLICATION IS
		// VACUOUSLY TRUE WHEN ITS ANTECEDENT CANNOT BE READ. A mistyped path, a
		// renamed `data-testid`, an anchor that no longer matches — each makes the
		// whole file pass while measuring nothing. So the two class lists are
		// extracted here and asserted non-trivial before any rule runs.
		const pane = classTokensAfter(code(read(TRACK)), "data-pane={pane.key}");
		const root = classTokensAfter(
			code(read(VIEW)),
			'data-testid="phone-debate-view"',
		);
		expect(pane.length, "the pane's class list was read").toBeGreaterThan(3);
		expect(root.length, "the tier root's class list was read").toBeGreaterThan(
			3,
		);
		// ...and the reads landed on the elements they name.
		expect(pane).toContain("overflow-y-auto");
		expect(root).toContain("hidden");
	});
});

describe("phone scroll model — containment is paired with the bound (S-1/S-2)", () => {
	/**
	 * ⛔⛔ THE PAIRING, IN BOTH DIRECTIONS. This is one `it` on purpose: two
	 * separate rules could each be satisfied by deleting the other's subject.
	 */
	it("phone-scroll::overscroll-on-the-pane-IFF-the-tier-root-is-bounded", () => {
		const pane = classTokensAfter(code(read(TRACK)), "data-pane={pane.key}");
		const root = classTokensAfter(
			code(read(VIEW)),
			'data-testid="phone-debate-view"',
		);
		const containment = overscrollTokens(pane);
		const bounded = declaresDefiniteHeightBelow640(root);

		if (bounded) {
			expect(
				containment.length,
				"the tier root declares a definite height below 640px, so the pane " +
					"is a real scroller — it MUST declare overscroll containment, or a " +
					"pan that reaches the end of the feed chains out to whatever is " +
					"behind it",
			).toBeGreaterThan(0);
		} else {
			expect(
				containment,
				"the tier root does NOT declare a definite height below 640px, so " +
					"nothing bounds the chain, the pane grows to its content and never " +
					"scrolls — and overscroll containment on a box that never scrolls " +
					"has exactly one reachable effect, which is the dead region of the " +
					"2026-09-12 Android report (probe §7.2)",
			).toEqual([]);
		}
	});

	/**
	 * ⛔ AND THE BOUND IS ONLY SAFE WITH `min-h-0` ON THE TRACK ROW. A flex/grid
	 * child's automatic minimum size is its CONTENT — which is the exact mistake
	 * this task exists to undo, arriving one element lower down. Without
	 * `min-h-0` the track refuses to shrink below its content, the bounded root
	 * clips instead of scrolling, and the pane is once again never a scroller.
	 */
	it("phone-scroll::a-bounded-root-requires-min-h-0-on-the-track-row", () => {
		const trackSrc = code(read(TRACK));
		const root = classTokensAfter(
			code(read(VIEW)),
			'data-testid="phone-debate-view"',
		);
		const track = classTokensAfter(trackSrc, 'data-testid="phone-feed-track"');
		if (!declaresDefiniteHeightBelow640(root)) {
			expect(
				track.length,
				"unbounded: nothing to assert, but the read must still have landed",
			).toBeGreaterThan(3);
			return;
		}
		expect(
			track,
			"the track is the 1fr row of a bounded shell; without min-h-0 its " +
				"automatic minimum size is its content and the bound does nothing",
		).toContain("min-h-0");
		expect(
			track,
			"…and min-w-0 for the same reason on the inline axis, since the track " +
				"is itself a horizontal scroller full of full-width panes",
		).toContain("min-w-0");
	});

	/**
	 * The tier root's height unit. ⛔ `vh` IS THE **LARGE** VIEWPORT: with a
	 * mobile toolbar showing, `100vh` exceeds the window by the toolbar's height,
	 * so a bounded shell sized in `vh` puts its own bet bar off the bottom of the
	 * screen — and with `overflow: hidden` on the root and no document scroll,
	 * off the bottom means UNREACHABLE. `dvh` (and `svh`) track the real window.
	 */
	it("phone-scroll::the-bounded-root-is-sized-in-dvh-and-never-vh", () => {
		const root = classTokensAfter(
			code(read(VIEW)),
			'data-testid="phone-debate-view"',
		);
		if (!declaresDefiniteHeightBelow640(root)) return;
		const heights = root.filter((t) =>
			new RegExp(`^${V}${S}(h|max-h)-`).test(t),
		);
		expect(heights.length).toBeGreaterThan(0);
		/**
		 * ⛔ NO `\b` AROUND `dvh` — AND THIS ASSERTION SHIPPED WRONG ONCE, CAUGHT BY
		 * ITS OWN MUTATION RUN. `\bdvh\b` cannot match inside `100dvh`: `0` and `d`
		 * are both word characters, so there is no boundary between them, and the
		 * guard rejected the exact token it exists to require. A regex written with
		 * a boundary that cannot occur is the source-scan version of a control that
		 * cannot fire.
		 */
		for (const h of heights) {
			expect(
				/[ds]vh/.test(h),
				`${h}: a bounded phone shell must be sized in dvh or svh — vh is the ` +
					"LARGE viewport and puts the bet bar under the browser toolbar",
			).toBe(true);
			expect(
				/(^|[^ds])vh/.test(h),
				`${h}: a bare vh (or lvh) is the LARGE viewport`,
			).toBe(false);
		}
		// POSITIVE CONTROL — both arms fire on the shapes they reject, so a pass
		// above means "dvh" and not "the test never looked".
		expect(/[ds]vh/.test("h-[calc(100vh-62px)]")).toBe(false);
		expect(/(^|[^ds])vh/.test("h-[calc(100vh-62px)]")).toBe(true);
		expect(/(^|[^ds])vh/.test("h-[100lvh]")).toBe(true);
		expect(/(^|[^ds])vh/.test("h-[calc(100dvh-62px)]")).toBe(false);
	});

	/**
	 * ⛔ THE TIER ROOT'S HEIGHT IS `max-mobile:`-SCOPED, ALWAYS. A bare
	 * `h-[100dvh]` on this element would be a desktop change — the root is
	 * `hidden` above 640px, but `hidden` is a DISPLAY rule and a height token on
	 * a shared element is exactly the shape the wall forbids. Cheap to assert and
	 * it is the wall that cannot be recovered from three days before the open.
	 */
	it("phone-scroll::no-unprefixed-viewport-height-on-the-tier-root", () => {
		const root = classTokensAfter(
			code(read(VIEW)),
			'data-testid="phone-debate-view"',
		);
		const bare = root.filter(
			(t) => !t.startsWith(V + S) && /(^|:)(h|min-h|max-h)-\[?.*vh/.test(t),
		);
		expect(
			bare,
			"an unprefixed viewport-height token on the tier root is a desktop change",
		).toEqual([]);
		// POSITIVE CONTROL — the recogniser fires on the shape it rejects.
		expect(
			["hidden", `h-[calc(100dvh-62px)]`].filter(
				(t) => !t.startsWith(V + S) && /(^|:)(h|min-h|max-h)-\[?.*vh/.test(t),
			),
		).toHaveLength(1);
	});
});
