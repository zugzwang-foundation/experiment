import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MOBILE-2k — THE EIGHT FACTS THE BEHAVIOURAL GUARDS CANNOT SEE, AND WHY EACH ONE
 * IS INVISIBLE TO THEM RATHER THAN MERELY UNTESTED.
 *
 * ⛔⛔ THIS FILE EXISTS BECAUSE A MUTATION BATTERY SAID SO. Thirty-six reversals
 * were applied to the round's own work; twenty-eight reddened and **eight did not**,
 * and every one of the eight is here. That is the whole provenance: not a hunch
 * about coverage, a measurement of it.
 *
 * They divide into three kinds, and the kind matters more than the count:
 *
 *   · **A DELIBERATELY REDUNDANT PAIR IS INVISIBLE TO BEHAVIOUR BY CONSTRUCTION.**
 *     The refetch refuses at tap time AND re-checks at fire time, and the poll is
 *     cancelled when a flag rises. Remove either half and the other still closes the
 *     reachable path — so a behavioural test passes, correctly, and the braces can
 *     be quietly removed while every row stays green. Redundancy on a money path is
 *     worth having and can only be pinned textually. (`M4`, `M4b`, `M5`, `M5b`.)
 *   · **A WINDOW THIS HARNESS DOES NOT HAVE.** `router.refresh()` is mocked, so the
 *     transition settles inside the same `act()` and `isPending` is never observably
 *     true between two statements. The stand-down that keeps the pill on screen
 *     reading `Refreshing…` therefore has no observable consequence here — it was
 *     measured in a real browser, where it moved the label from 1 frame to 46.
 *     (`M13`.)
 *   · **A WIRING FACT, WHICH IS ABOUT THE CALLER.** `busy={composerBusy}` can be
 *     replaced with `busy={false}` and every test of the pill still passes, because
 *     the pill is behaving perfectly — it is being told the wrong thing. (`M18`.)
 *   · **A SPELLING THAT IS A MECHANISM.** `max-mobile:[border:none]` and
 *     `max-mobile:border-none` are visually identical in a class list and are NOT
 *     interchangeable: the first overrides an arbitrary property with an arbitrary
 *     property, which is the ordering this round measured and relies on. (`M21b`.)
 *   · **A LATCH WHOSE STATED JOB IS UNREACHABLE.** `firedForThisTap` cannot be
 *     reddened by any single-tap test, because `tick` is one branch with one call and
 *     a `return`. The component's own docblock now says so. It is kept for the case
 *     that IS real — a poll outliving a settled refresh — and pinned here. (`M3`.)
 *
 * ⚠ A SOURCE SCAN IS THE WEAKER INSTRUMENT AND IS USED ONLY WHERE IT IS THE ONLY
 * ONE. It sees text, not behaviour, so it cannot tell a correct guard from a
 * correctly-spelled one. Everything reachable behaviourally is guarded
 * behaviourally, in the four files this one does not duplicate.
 */
const ROOT = process.cwd();
const PILL = "src/components/debate/phone/PhoneTopPill.tsx";
const VIEW = "src/components/debate/phone/PhoneDebateView.tsx";
const IMG = "src/components/debate/CommentImage.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/**
 * ⛔ COMMENTS STRIPPED BEFORE EVERY SCAN, line count preserved. Six times in this
 * repository a textual guard has matched the comment explaining the absence it was
 * written to detect — and this file is the worst possible place for a seventh,
 * because `PhoneTopPill`'s docblocks QUOTE the code they describe: the
 * `firedForThisTap` block contains the literal
 * `if (arrived || expired) { refetchOnce(); return; }`, and the `refetchOnce` block
 * names `lockedRef.current` and `busyRef.current` in prose. Every assertion below
 * would pass against a file with the code deleted and the comments left.
 */
function code(src: string): string {
	return src
		.replace(/\/\*[\s\S]*?\*\//g, (m) =>
			"\n".repeat((m.match(/\n/g) ?? []).length),
		)
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** The body of `const <name> = useCallback((…) => { … }` by brace matching. */
function callbackBody(src: string, name: string): string {
	const decl = new RegExp(`const ${name} = useCallback\\(`).exec(src);
	if (decl === null) {
		throw new Error(
			`${name}: no \`useCallback\` declaration — re-derive this row`,
		);
	}
	const open = src.indexOf("{", (decl.index ?? 0) + decl[0].length);
	if (open === -1) {
		throw new Error(`${name}: no body`);
	}
	let depth = 0;
	let quote: string | null = null;
	for (let i = open; i < src.length; i++) {
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
		if (ch === "{") depth++;
		else if (ch === "}") {
			depth--;
			if (depth === 0) return src.slice(open + 1, i);
		}
	}
	throw new Error(`${name}: unbalanced body`);
}

describe("MOBILE-2k — the scan reaches real, comment-stripped sources", () => {
	it("pill-structure::guard-is-alive", () => {
		for (const rel of [PILL, VIEW, IMG]) {
			const stripped = code(read(rel));
			expect(stripped.length, `${rel}: read`).toBeGreaterThan(500);
			expect(stripped, `${rel}: comments are gone`).not.toContain("⛔⛔");
		}
		// ...and the comment stripper really strips, on a sample with a known shape.
		const sample =
			"const a = 1;\n/* ⛔ a block\n   over two lines */\nconst b = 2; // trailing\n";
		const out = code(sample);
		expect(out).toContain("const a = 1;");
		expect(out).toContain("const b = 2;");
		expect(out).not.toContain("⛔");
		expect(out).not.toContain("trailing");
		expect(out.split("\n")).toHaveLength(sample.split("\n").length);
		// ...and the body extractor finds a real body rather than an empty string.
		expect(callbackBody(code(read(PILL)), "refetchOnce")).toContain(
			"startRefresh",
		);
	});
});

describe("MOBILE-2k — the refetch's refusals are pinned at BOTH sites (M4/M4b/M5/M5b)", () => {
	/**
	 * ⛔⛔ THE TAP-TIME REFUSAL NAMES ALL FOUR TERMS. Measured: dropping `busy` or
	 * `isPageScrollLocked()` from this line changes NO behavioural row, because the
	 * fire-time check below catches the same cases. That is the redundancy working
	 * — and it is also what lets the redundancy be removed unnoticed.
	 */
	it("pill-structure::the-tap-refuses-on-all-four-terms", () => {
		const body = callbackBody(code(read(PILL)), "onTap");
		const guard = /if\s*\(([^)]*(?:\([^)]*\))?[^)]*)\)\s*\{\s*return;/.exec(
			body,
		);
		expect(guard, "onTap has no early-return refusal at all").not.toBeNull();
		const all = body.slice(0, body.indexOf("scrollTo"));
		for (const term of [
			"refreshing",
			"busy",
			"locked",
			"isPageScrollLocked()",
		]) {
			expect(
				all,
				`onTap stopped consulting \`${term}\` before scrolling. Behaviour cannot ` +
					"see this: the fire-time check covers the same cases, so the suite " +
					"stays green while one half of a deliberate pair is gone",
			).toContain(term);
		}
		// POSITIVE CONTROL — the recogniser fires on the shape it rejects.
		const mutated = all.replace("busy || ", "");
		expect(mutated.includes("busy")).toBe(false);
	});

	/**
	 * ⛔⛔ AND `refetchOnce` RE-READS THEM THROUGH REFS. This is the half that
	 * catches a frame callback already queued when a flag changed; the effect below
	 * is the half that stops the countdown. Both, and both pinned, because the
	 * defect they close was reachable in one ordinary tap.
	 */
	it("pill-structure::the-refetch-re-reads-the-refusals-at-fire-time", () => {
		const body = callbackBody(code(read(PILL)), "refetchOnce");
		for (const term of [
			"lockedRef.current",
			"busyRef.current",
			"isPageScrollLocked()",
		]) {
			expect(
				body,
				`refetchOnce stopped consulting \`${term}\`. The poll fires up to a ` +
					"second after the tap, and returning null from render does not " +
					"unmount a component, so nothing else is watching at that moment",
			).toContain(term);
		}
		// ⛔ AND THE READ MUST PRECEDE THE FIRE. A refusal after `startRefresh` is a
		// refusal that has already refreshed.
		expect(body.indexOf("lockedRef.current")).toBeLessThan(
			body.indexOf("startRefresh"),
		);
		expect(body.indexOf("busyRef.current")).toBeLessThan(
			body.indexOf("startRefresh"),
		);
	});

	/** The latch, whose only real job is a poll that outlives a settled refresh. */
	it("pill-structure::the-once-per-tap-latch-is-read-before-the-fire", () => {
		const body = callbackBody(code(read(PILL)), "refetchOnce");
		/**
		 * ⛔ THE READ, NOT MERELY THE IDENTIFIER — and this row was measured too weak
		 * before it said so. It asserted `body.toContain("firedForThisTap.current")`,
		 * which a build that deletes the early return and keeps only the ASSIGNMENT
		 * satisfies perfectly: the latch is then armed on every tap and consulted by
		 * nobody. Reverting exactly that left this row green. The early-return FORM is
		 * the thing under test.
		 */
		expect(
			/if\s*\(\s*firedForThisTap\.current\s*\)\s*\{\s*return;/.test(body),
			"the latch is armed but never consulted — a build that keeps only the " +
				"assignment reads as guarded and refuses nothing",
		).toBe(true);
		expect(
			body.indexOf("firedForThisTap.current"),
			"the latch is set or read only after the refresh has gone out",
		).toBeLessThan(body.indexOf("startRefresh"));
		expect(body, "the latch is never armed, so it can never refuse").toContain(
			"firedForThisTap.current = true",
		);
	});

	/**
	 * ⛔ AN IN-FLIGHT TAP IS ABANDONED WHEN EITHER FLAG RISES. Pinned by its own
	 * shape rather than by a line: an effect whose dependency list carries both
	 * flags and whose body cancels the poll.
	 */
	it("pill-structure::an-effect-cancels-the-poll-when-a-flag-rises", () => {
		const src = code(read(PILL));
		const effects = [
			...src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/g),
		];
		expect(
			effects.length,
			"no effects found at all — re-derive this row",
		).toBeGreaterThan(2);
		const cancelling = effects.filter(
			(m) =>
				(m[1] ?? "").includes("cancelPoll()") &&
				(m[2] ?? "").includes("locked") &&
				(m[2] ?? "").includes("busy"),
		);
		expect(
			cancelling.length,
			"nothing cancels the arrival poll when a sheet opens or a bet goes in " +
				"flight. Behaviour cannot see this while the fire-time re-read is also " +
				"present — the refresh is refused either way, but the frames keep running",
		).toBe(1);
		// POSITIVE CONTROL — the pattern does not match an effect that merely mentions
		// the flags, nor one that cancels on something else.
		const decoy =
			"useEffect(() => {\n\tsetShown(locked && busy);\n}, [locked, busy]);";
		expect(
			[
				...decoy.matchAll(
					/useEffect\(\(\) => \{([\s\S]*?)\}, \[([^\]]*)\]\);/g,
				),
			].filter((m) => (m[1] ?? "").includes("cancelPoll()")),
		).toHaveLength(0);
	});
});

describe("MOBILE-2k — the visibility rule stands down during the pill's own tap (M13)", () => {
	/**
	 * ⛔⛔ THE DEFECT THIS CLOSES WAS MEASURED IN A BROWSER AND IS INVISIBLE HERE.
	 * The tap scrolls the region; the scroll fires events; the events reach the rule;
	 * the rule sees the position fall below half a viewport and hides the pill —
	 * during its own scroll, before the refetch it started. Measured with the RSC
	 * response held for 700ms: the `Refreshing…` label showed for **1 frame out of
	 * 96** before the stand-down, and **46** after.
	 *
	 * Under a mocked router the transition settles inside the same `act()`, so there
	 * is no window in which to observe the label at all — which is exactly why this
	 * row is textual and says so.
	 */
	it("pill-structure::the-rule-returns-early-while-the-poll-or-the-refresh-is-live", () => {
		const body = callbackBody(code(read(PILL)), "evaluate");
		const standDown =
			/if\s*\(\s*rafRef\.current !== null \|\| refreshingRef\.current\s*\)\s*\{\s*return;\s*\}/.test(
				body
					.replace(/\s+/g, " ")
					.replace(/if \( /g, "if (")
					.replace(/ \)/g, ")")
					.replace(/\{ /g, "{")
					.replace(/ \}/g, "}"),
			) || /rafRef\.current !== null \|\| refreshingRef\.current/.test(body);
		expect(
			standDown,
			"the visibility rule no longer stands down while the pill's own scroll " +
				"or refetch is running, so the pill hides during its own tap and a " +
				"refresh leaves no trace on screen",
		).toBe(true);
		// ⛔ AND IT MUST COME BEFORE THE THRESHOLDS IT PROTECTS. Placed after them,
		// the hide has already happened.
		expect(body.indexOf("rafRef.current !== null")).toBeLessThan(
			body.indexOf("viewport * 0.5"),
		);
		// ⚠ ...but AFTER the scroll reference is updated, or the first real flick
		// after a refresh compares against a position a whole screen away.
		expect(body.indexOf("lastScrollTop.current = top")).toBeLessThan(
			body.indexOf("rafRef.current !== null"),
		);
	});
});

describe("MOBILE-2k — the host wires the two flags it owns (M18)", () => {
	/**
	 * ⛔ THE PILL CANNOT GUARD THIS AND NEITHER CAN ITS TESTS. `busy={false}` leaves
	 * the pill behaving perfectly on a lie, and every row in every pill test passes,
	 * because each one passes the prop itself. The fact under test is about the
	 * CALLER: that the flag reaching the pill is the composer's real one.
	 */
	it("pill-structure::the-host-passes-the-real-lock-and-busy-flags", () => {
		const src = code(read(VIEW));
		const at = src.indexOf("<PhoneTopPill");
		expect(at, "PhoneDebateView no longer mounts the pill").toBeGreaterThan(-1);
		const tag = src.slice(at, src.indexOf("/>", at));
		expect(tag, "the region ref is not the tier's own scroller").toContain(
			"regionRef={scrollRegionRef}",
		);
		expect(
			tag,
			"`locked` is no longer the sheet state — the pill would float over an " +
				"open sheet, and its tap-time lock refusal would never fire",
		).toContain("locked={sheet !== null}");
		expect(
			tag,
			"`busy` is no longer the composer's flag. This is the money guard, and a " +
				"constant here disarms it while every test of the pill stays green",
		).toContain("busy={composerBusy}");
		// POSITIVE CONTROL — the extractor read a real tag, and the recogniser fires.
		expect(tag.split("\n").length).toBeGreaterThan(2);
		expect(tag.replace("busy={composerBusy}", "busy={false}")).not.toContain(
			"busy={composerBusy}",
		);
	});
});

describe("MOBILE-2k — the phone border override keeps its spelling (M21b)", () => {
	/**
	 * ⛔⛔ THE SPELLING IS THE MECHANISM, NOT A STYLE. The base token is the
	 * arbitrary property `[border:var(--hairline)]`. Tailwind orders a variant AFTER
	 * its unprefixed peer within one utility kind, so an arbitrary property is what
	 * reliably overrides an arbitrary property — measured in the compiled sheet
	 * (`.[border:var(--hairline)]` at offset 59 161, `.max-mobile\\:[border:none]` at
	 * 80 612, the variant later and therefore winning) and confirmed by
	 * `getComputedStyle` reading `0px none` below 640.
	 *
	 * `border-none` sets `border-style`, a DIFFERENT declaration whose position
	 * against a `border` shorthand is not a thing to assume. It looks identical in a
	 * class list, it may well work, and "may well work" is not what a border on a
	 * money surface's imagery should rest on. Swapping the two changes no
	 * behavioural row, which is why this one is here.
	 *
	 * ⚠ ASSEMBLED, NEVER WRITTEN. Tailwind v4's source detection scans `tests/`, so
	 * a literal variant class in this file becomes a real emitted utility whose only
	 * origin is a test (AGENTS.md §9, and the measured `max-mobile:opacity-0` case).
	 */
	it("pill-structure::the-phone-border-is-an-arbitrary-property-not-a-style-utility", () => {
		const V = "max-mobile";
		const S = ":";
		const src = code(read(IMG));
		expect(
			src,
			"the phone border override changed spelling. `border-none` sets " +
				"border-style, not the shorthand, and its cascade position against the " +
				"unprefixed `[border:…]` is an assumption rather than a measurement",
		).toContain(`${V}${S}[border${S}none]`);
		expect(src, "a `border-style` utility appeared in its place").not.toContain(
			`${V}${S}border-none`,
		);
		// ⛔ AND THE UNPREFIXED HAIRLINE MUST SURVIVE, or the DESKTOP loses its border.
		expect(src).toContain("[border:var(--hairline)]");
		// POSITIVE CONTROL — both recognisers fire on the shapes they judge.
		const swapped = src.replace(
			`${V}${S}[border${S}none]`,
			`${V}${S}border-none`,
		);
		expect(swapped).toContain(`${V}${S}border-none`);
		expect(swapped).not.toContain(`${V}${S}[border${S}none]`);
	});
});
