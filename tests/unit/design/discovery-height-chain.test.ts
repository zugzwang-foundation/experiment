import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · DISCOVERY Gate C finding H-1 — the cross-file height coupling.
 *
 * WHAT THIS GUARD IS FOR. `(public)/layout.tsx` sizes the surface column with
 * `min-h-[calc(100vh-60px-2px)]`, and the two numbers in that calc belong to a
 * DIFFERENT FILE: `GlobalHeader.tsx` independently owns the header's row height
 * (`h-[60px]`) and its border (`border-y`). Change either and Discovery
 * silently gains a permanent scrollbar or a dead gap below the fold — no test
 * reddens, no type errors, nothing in the diff looks wrong.
 *
 * ⚠ THIS IS NOT HYPOTHETICAL. The first version of that calc subtracted only
 * `60px` and shipped a 2px overflow — a permanent scrollbar on a page that
 * fits. It was caught by measuring compiled CSS in a browser, which is not a
 * thing CI does. This guard is the cheap standing version of that measurement.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no `calc()`, no `100vh`, and no Tailwind utility, so a render test
 * structurally cannot see this defect. The repo already uses source-scanning
 * consistency guards for exactly this class — `emphasis-ladder-tokens.test.ts`
 * is the established shape and this file follows it.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself, which would prove only
 * that the test agrees with the test.
 *
 * ⛔ ONE RESIDUAL ASSUMPTION, NAMED RATHER THAN HIDDEN — see BORDER_Y_TOTAL_PX.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const HEADER = "src/components/shell/GlobalHeader.tsx";

/**
 * ⛔ THE ONE NUMBER THIS FILE CANNOT DERIVE FROM SOURCE, STATED OUTRIGHT.
 *
 * `GlobalHeader` carries the bare `border-y` utility. Its WIDTH is Tailwind's
 * built-in default (1px per edge, so 2px across a `border-y`), and that default
 * is **not readable from this repository**: there is no `tailwind.config.*`
 * (v4 is CSS-first), `globals.css` declares no border-width, and the pinned
 * `tailwindcss` package exposes no `--default-border-width` in its shipped
 * `theme.css` / `preflight.css` — the value lives inside the compiler.
 *
 * So this constant is MEASURED, not derived: the header's border-box was
 * measured at 62px against real compiled CSS in a browser, versus a 60px inner
 * row. It is isolated here, named, and paired with the `border-y` pin below so
 * that the only way it can go stale without reddening is a Tailwind MAJOR
 * UPGRADE that changes the default border width — the residual risk, recorded.
 * Every drift vector that lives in THIS repo is derived, not assumed.
 */
const BORDER_Y_TOTAL_PX = 2;

/** The exact border utility the header is pinned to. */
const HEADER_BORDER_UTILITY = "border-y";

/**
 * The two numbers in `layout.tsx`'s viewport calc, parsed out of the shipped
 * className. Written as `calc(100vh-<row>px-<border>px)` precisely so the two
 * contributors stay separately checkable rather than folded into one opaque
 * total — Tailwind emits `calc(100vh - 62px)` either way.
 */
function layoutSubtrahends(source: string): { row: number; border: number } {
	const m = /min-h-\[calc\(100vh-(\d+)px-(\d+)px\)\]/.exec(source);
	if (!m) {
		throw new Error(
			`${LAYOUT}: no min-h-[calc(100vh-<row>px-<border>px)] found. If the ` +
				`viewport floor was rewritten, re-derive it against GlobalHeader ` +
				`rather than deleting this guard.`,
		);
	}
	return { row: Number(m[1]), border: Number(m[2]) };
}

/** The header's inner row height + its border utility, from the shipped file. */
function headerGeometry(source: string): {
	rowHeight: number;
	borderUtilities: string[];
} {
	const tagAt = source.indexOf("<header");
	if (tagAt === -1) {
		throw new Error(`${HEADER}: no <header> element found.`);
	}
	const afterTag = source.slice(tagAt);

	const tag = /<header className="([^"]*)"/.exec(afterTag);
	if (!tag) {
		throw new Error(`${HEADER}: <header> carries no literal className.`);
	}
	// Every border-* utility on the header element, so a SECOND one added later
	// (e.g. `border-b-2` beside `border-y`) is visible rather than ignored.
	const borderUtilities = tag[1]
		.split(/\s+/)
		.filter((c) => c === "border" || c.startsWith("border-"));

	// The first explicit pixel height inside the header — the row that sets its
	// content box.
	const row = /\bh-\[(\d+)px\]/.exec(afterTag);
	if (!row) {
		throw new Error(`${HEADER}: no h-[<n>px] row height inside <header>.`);
	}
	return { rowHeight: Number(row[1]), borderUtilities };
}

/**
 * The whole predicate, as a pure function of the two file contents — so the
 * POSITIVE CONTROL below can run it against mutated sources and prove it
 * actually reddens, rather than merely observing that it passes today.
 */
function chainAgrees(layoutSource: string, headerSource: string): boolean {
	const calc = layoutSubtrahends(layoutSource);
	const header = headerGeometry(headerSource);
	return (
		calc.row === header.rowHeight &&
		calc.border === BORDER_Y_TOTAL_PX &&
		header.borderUtilities.length === 1 &&
		header.borderUtilities[0] === HEADER_BORDER_UTILITY
	);
}

describe("discovery height chain — layout.tsx's viewport floor tracks GlobalHeader", () => {
	it("height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing would pass every assertion below
		// vacuously — the recorded N1/H-1 failure mode in this directory. Both
		// extractors must find real values in the real files.
		const calc = layoutSubtrahends(read(LAYOUT));
		const header = headerGeometry(read(HEADER));
		expect(calc.row).toBeGreaterThan(0);
		expect(calc.border).toBeGreaterThan(0);
		expect(header.rowHeight).toBeGreaterThan(0);
		expect(header.borderUtilities.length).toBeGreaterThan(0);
	});

	it("height-chain::calc-row-height-equals-the-headers-own-row-height", () => {
		// THE DERIVED HALF — no assumption anywhere in this assertion. Change
		// `h-[60px]` in GlobalHeader and this reddens immediately.
		const calc = layoutSubtrahends(read(LAYOUT));
		const header = headerGeometry(read(HEADER));
		expect(
			calc.row,
			`${LAYOUT}'s calc subtracts ${calc.row}px for the header row, but ` +
				`${HEADER} renders h-[${header.rowHeight}px]. Discovery's surface ` +
				`column is now ${Math.abs(calc.row - header.rowHeight)}px off: too ` +
				`tall gives a permanent scrollbar, too short a dead gap.`,
		).toBe(header.rowHeight);
	});

	it("height-chain::header-border-is-still-exactly-border-y", () => {
		// THE PINNED HALF. `BORDER_Y_TOTAL_PX` is only correct while the header
		// carries exactly this one border utility, so the utility is pinned by
		// name and the count is exact — `border-y-2`, a second border-* class, or
		// removing the border all redden here and send the reader to re-derive
		// the constant rather than letting it go quietly stale.
		const { borderUtilities } = headerGeometry(read(HEADER));
		expect(
			borderUtilities,
			`${HEADER}'s border utilities changed. ${LAYOUT} subtracts ` +
				`${BORDER_Y_TOTAL_PX}px on the basis of a single \`border-y\`; ` +
				`re-measure the header's border-box and update both together.`,
		).toEqual([HEADER_BORDER_UTILITY]);
	});

	it("height-chain::calc-border-allowance-matches-the-pinned-border", () => {
		const calc = layoutSubtrahends(read(LAYOUT));
		expect(calc.border).toBe(BORDER_Y_TOTAL_PX);
	});

	it("height-chain::the-whole-chain-agrees-at-head", () => {
		expect(chainAgrees(read(LAYOUT), read(HEADER))).toBe(true);
	});

	it("height-chain::POSITIVE-CONTROL-reddens-when-the-numbers-disagree", () => {
		// ⚠ PROOF BY REVERSAL. A negative assertion that has never been observed
		// to fail is indistinguishable from one that CANNOT fail (§8.1 N8 — a
		// green run that is structurally incapable of failing reads as a
		// receipt). These mutations run the REAL predicate over the REAL file
		// contents with one byte-level change each.
		const layoutSrc = read(LAYOUT);
		const headerSrc = read(HEADER);

		// Control 0 — unmutated, the predicate holds. Without this the three
		// mutations below could all be "failing" for an unrelated reason.
		expect(chainAgrees(layoutSrc, headerSrc)).toBe(true);

		// 1. The header row grows (h-[60px] -> h-[72px]) and layout.tsx is not
		//    updated: the exact S-3 defect class, one size up.
		expect(
			chainAgrees(layoutSrc, headerSrc.replace("h-[60px]", "h-[72px]")),
		).toBe(false);

		// 2. layout.tsx drops the border allowance — literally the 2px bug that
		//    shipped in this PR's first draft.
		expect(
			chainAgrees(
				layoutSrc.replace(
					"min-h-[calc(100vh-60px-2px)]",
					"min-h-[calc(100vh-60px-0px)]",
				),
				headerSrc,
			),
		).toBe(false);

		// 3. The header's border utility is widened without the calc following.
		expect(
			chainAgrees(layoutSrc, headerSrc.replace("border-y", "border-y-2")),
		).toBe(false);

		// 4. The header's border is removed entirely.
		expect(chainAgrees(layoutSrc, headerSrc.replace(" border-y", ""))).toBe(
			false,
		);
	});
});
