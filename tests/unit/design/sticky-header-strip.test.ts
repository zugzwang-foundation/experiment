import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PROFILE OVERLAP · R1 — THE STICKY HEADER OWNS THE PADDING ABOVE IT.
 *
 * ⚠⚠ THE BUG THIS EXISTS FOR, measured on staging at a pinned 1440×777 and then
 * confirmed by PAINT rather than by reasoning about paint. Chrome resolves a
 * sticky `top: 0` against the scroll container's CONTENT box, so a container with
 * `p-3` leaves **12px of scrollable space above its own sticky header** that the
 * header does not cover: body top 331, header top 343. Rows scroll into that
 * strip and appear ABOVE the column titles, inside the panel frame — a zoom of
 * the region showed the selected row's rounded top edge sitting over it. Opaque
 * was never enough; the header has to claim the gap.
 *
 * ⇒ It claims it with a zero-blur, zero-spread shadow offset up by exactly that
 * padding, which paints above the plain rows because the header is `sticky z-10`.
 *
 * ⛔ THE POINT OF THIS FILE IS THE BINDING, NOT THE CLASS. The offset and the
 * padding are the SAME NUMBER for a reason, and nothing else in the codebase
 * makes them move together — change `p-3` to `p-4` and a hand-typed `-12px`
 * silently uncovers 4px of strip again. Both sides are written as multiples of
 * `var(--spacing)`, and this asserts they are the same multiple.
 *
 * ⚠ AND IT COVERS BOTH SURFACES IN ONE FILE, deliberately. Positions and
 * bookmarks are one shell with the left panel swapped — same padding, same
 * sticky header — so a fix on one is drift waiting to be filed as a second bug.
 * That is the same reason the row-third lives in a shared module.
 *
 * ⚠ A SOURCE SCAN, and the limit is stated: jsdom performs no layout and paints
 * nothing, so no render test can see a strip or a stacking order. What is
 * checkable here is that the two numbers agree; that the strip is actually
 * covered was verified in a browser against the compiled CSS.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const SURFACES = [
	{
		name: "positions",
		file: "src/components/profile/PositionsTable.tsx",
		bodyTestId: "positions-panel-body",
	},
	{
		name: "bookmarks",
		file: "src/components/bookmarks/BookmarksTable.tsx",
		bodyTestId: "bookmarks-panel-body",
	},
] as const;

/** The className string of the node carrying `testid`. */
function classesOf(source: string, testid: string): string {
	const m = new RegExp(
		`"${testid}"[\\s\\S]{0,400}?className=(?:"([^"]*)"|\`([^\`]*)\`)`,
	).exec(source);
	const cls = m?.[1] ?? m?.[2];
	if (!cls) {
		throw new Error(
			`no node with data-testid="${testid}" and a readable className — if the ` +
				`panel was restructured, re-derive the binding rather than deleting it.`,
		);
	}
	return cls;
}

/** The `<thead>` className string. One per file, and that is asserted. */
function theadClasses(source: string): string {
	const all = [...source.matchAll(/<thead className="([^"]*)"/g)];
	expect(all.length, "expected exactly one <thead> in this file").toBe(1);
	return all[0]?.[1] ?? "";
}

/** The spacing multiple a padding utility applies to the TOP edge, if any. */
function topPaddingMultiple(classes: string): number | null {
	for (const c of classes.split(/\s+/)) {
		const m = /^(p|py|pt)-(\d+)$/.exec(c);
		if (m?.[2] !== undefined) {
			return Number(m[2]);
		}
	}
	return null;
}

describe("the sticky column header covers its container's top padding", () => {
	for (const surface of SURFACES) {
		describe(surface.name, () => {
			const source = read(surface.file);

			it(`${surface.name}::the-header-is-sticky-opaque-and-above-the-rows`, () => {
				const thead = theadClasses(source);
				// All three are load-bearing and none implies the others: unstuck it
				// scrolls away, transparent the rows read through it, and without a
				// stacking order the shadow has nothing to paint above.
				expect(thead).toContain("sticky");
				expect(thead).toContain("top-0");
				expect(thead).toMatch(/\bbg-n\d\b/);
				expect(thead).toMatch(/\bz-\d+\b/);
			});

			it(`${surface.name}::the-shadow-offset-EQUALS-the-body-padding`, () => {
				const pad = topPaddingMultiple(classesOf(source, surface.bodyTestId));
				expect(
					pad,
					`${surface.bodyTestId} declares no top padding — if that is now ` +
						`true the strip is gone and this binding can go with it, but ` +
						`say so deliberately rather than by deletion.`,
				).not.toBeNull();

				const thead = theadClasses(source);
				const offset = /shadow-\[0_calc\(var\(--spacing\)\*-(\d+)\)_0_0_/.exec(
					thead,
				);
				expect(
					offset,
					"the sticky header declares no upward spacing-bound shadow, so " +
						`${pad} spacing units of scrollable strip sit above it uncovered.`,
				).not.toBeNull();
				expect(Number(offset?.[1])).toBe(pad);
			});

			it(`${surface.name}::the-shadow-colour-is-a-TOKEN-and-matches-the-header`, () => {
				const thead = theadClasses(source);
				// ⛔ Raw colour is banned outright (`tokens-monochrome.test.ts`), and a
				// strip painted in anything but the header's own background would read
				// as a band rather than as nothing.
				const bg = /\bbg-(n\d)\b/.exec(thead)?.[1];
				expect(thead).toContain(`0_0_var(--color-${bg})]`);
			});

			it(`${surface.name}::the-strip-is-not-fixed-by-CLIPPING`, () => {
				// ⛔ The two wrong fixes, both cheaper than the right one. Shrinking the
				// padding changes the region the row-third divides; `overflow:hidden`
				// hides a row out of a participant's own portfolio, which R1 forbids
				// in the same breath as it names the overlap.
				const body = classesOf(source, surface.bodyTestId);
				expect(body).toMatch(/\boverflow-y-auto\b/);
				expect(body).not.toMatch(/\boverflow(-y)?-(hidden|clip)\b/);
			});
		});
	}
});
