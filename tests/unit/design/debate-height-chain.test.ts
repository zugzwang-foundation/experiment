import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · MARKET DETAIL — THE DEBATE SURFACE'S HEIGHT CHAIN, asserted node
 * by node.
 *
 * WHAT THIS GUARD IS FOR. Row 1 makes the headzone a band that is DECLARED and
 * does not grow, sitting above an arena band that takes everything left over.
 * That only holds if every node in the chain is wired, and a chain is only as
 * good as its weakest link. Break ANY link and nothing visibly errors: the band
 * silently reverts to content height, the two-column composition drifts, and the
 * surface looks merely "a bit long" rather than broken. There is no type error,
 * no console warning, and no render test that can see it.
 *
 * THE CHAIN, and what each node contributes:
 *
 *   <main>          min-h-[calc(100vh-60px-2px)] flex-1 flex-col  ← the SOURCE
 *                   (owned by `(public)/layout.tsx`, OUT OF SCOPE here — read
 *                   only to prove the source still exists)
 *   PageContainer   flex flex-col                     ← the column the bands sit in
 *   headzone band   min-h-0, shrink-0, NO flex-1      ← declared, does NOT grow
 *   arena band      flex-1 min-h-0                    ← takes ALL the leftover
 *   pole columns    min-h-0 flex-col                  ← may be shorter than content
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible. A flex
 * item's automatic minimum size is its CONTENT, so without `min-h-0` a node
 * refuses to shrink below what it holds — the arena pushes past the container,
 * the headzone band gets squeezed instead of the arena, and the page just gets
 * taller. Every `min-h-0` below is therefore pinned BY NAME on the node that
 * needs it.
 *
 * ⚠ THIS ROUTE IS NOT THE PROFILE, AND THE DIFFERENCE IS DELIBERATE.
 * `(public)/layout.tsx` rules "⛔ `min-h-*`, never `h-*`" so a surface can GROW
 * AND SCROLL rather than clip, and `/m/[slug]` has NOT been ruled a one-screen
 * design the way `/u/[pseudonym]` was. So there is NO definite height on this
 * chain and none is asserted: `<main>`'s `min-h` stays a FLOOR. What the
 * declarations below buy is that the bands divide whatever height there is in
 * the ruled proportion instead of the arena silently forcing the page taller.
 * ⛔ Do not "finish" this chain by adding `h-[calc(100vh-…)]` to the container.
 * That is the profile's ruling, on the profile's route, and importing it here
 * would clip a surface whose content is unbounded by design.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no `calc()`, no `100vh`, no percentage height and no Tailwind
 * utility, so a render test structurally cannot see any of this.
 * `profile-height-chain.test.ts:70-76` and `discovery-height-chain.test.ts:19-24`
 * state the same limit for the same reason. This file proves the DECLARATIONS
 * are all present; a browser against the compiled CSS proves they compose.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const VIEW = "src/components/debate/DebateView.tsx";
const HEADZONE = "src/components/debate/HeadZone.tsx";
const COLUMN = "src/components/debate/DebateColumn.tsx";

/**
 * Every literal className carried by a node bearing `data-testid="<testid>"`, in
 * source order. Returns one entry per occurrence — the arena band is authored
 * TWICE (once per arm of the market↔post ternary) and both must be wired, so a
 * first-match helper would prove half the chain and pass.
 */
function bandClasses(source: string, file: string, testid: string): string[][] {
	const re = new RegExp(`"${testid}"\\s+className="([^"]*)"`, "g");
	const found = [...source.matchAll(re)].map((m) =>
		(m[1] ?? "").split(/\s+/).filter(Boolean),
	);
	if (found.length === 0) {
		throw new Error(
			`${file}: no node with data-testid="${testid}" and a literal className. ` +
				`If the headzone/arena frame was restructured, re-derive this chain ` +
				`rather than deleting the guard.`,
		);
	}
	return found;
}

/**
 * ⛔ THE FORBIDDEN SET. A FIXED height clips: content taller than the box is
 * simply lost, with no scroll and no overflow. `(public)/layout.tsx` rules
 * `min-h-*`, never `h-*`, on this chain, and unlike the profile this route
 * carries no founder ruling that supersedes it. `h-full` / `h-screen` /
 * `h-[calc(…)]` on a BAND are the three shapes that would do it.
 *
 * ⚠ Scoped to the band nodes only. `h-*` on a LEAF — an avatar, an icon, the
 * price bar's `h-[14px]` track — is not a chain node and is none of this
 * guard's business.
 */
const FORBIDDEN_HEIGHT = /^h-(full|screen|\[)/;

describe("debate height chain — the source", () => {
	it("debate-height::main-still-declares-the-floor-flex-column", () => {
		const source = read(LAYOUT);

		// OUT OF SCOPE — read, never written. If this changes, every `(public)`
		// surface's chain changes with it and that is a shell decision, not this
		// route's. Asserted so the chain below cannot be read as self-supporting.
		expect(source).toContain("min-h-[calc(100vh-60px-2px)]");
		expect(source).toContain("flex-1");
		expect(source).toContain("flex-col");
	});

	it("debate-height::the-container-is-the-flex-column-the-bands-sit-in", () => {
		const source = read(VIEW);

		// No `s` flag — tsconfig targets ES2017 (TS1501), and `[^>]*` already
		// spans newlines. Verbatim from `page-container.test.ts`, deliberately:
		// files reading the same tag must read it the same way or they can
		// disagree about what is on disk.
		const tag = /<PageContainer\b[^>]*>/.exec(source);
		if (!tag) {
			throw new Error(`${VIEW}: no PageContainer tag found.`);
		}
		const extras = /className="([^"]*)"/.exec(tag[0])?.[1] ?? "";
		const classes = extras.split(/\s+/).filter(Boolean);

		// The bands are DIRECT children of this column. Without `flex-col` the
		// headzone and arena are not stacked at all and nothing else here means
		// anything.
		expect(classes).toContain("flex");
		expect(classes).toContain("flex-col");
		// ⛔ The container is NOT bounded on this route — see the docblock.
		expect(classes.filter((c) => FORBIDDEN_HEIGHT.test(c))).toEqual([]);
	});
});

describe("debate height chain — the headzone band does not grow", () => {
	it("debate-height::headzone-is-declared-and-does-NOT-grow", () => {
		const [classes, ...extra] = bandClasses(
			read(HEADZONE),
			HEADZONE,
			"headzone",
		);

		// One frame, ONE authoring site. Two would be the duplicated grid
		// class-set this component exists to prevent.
		expect(extra).toEqual([]);

		// The mockup's `.headzone{flex:0 0 …}` — it does not grow and it does not
		// shrink. The LENGTH is deliberately not carried (it is a mockup value);
		// the SHAPE is.
		expect(classes).toContain("shrink-0");
		expect(classes).not.toContain("flex-1");
		expect(classes).not.toContain("grow");
		// `.headzone{min-height:0}` — the link.
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("flex");
		expect(classes.filter((c) => FORBIDDEN_HEIGHT.test(c))).toEqual([]);
	});

	it("debate-height::both-headzone-columns-may-shrink-below-their-content", () => {
		const source = read(HEADZONE);
		const left = bandClasses(source, HEADZONE, "headzone-left");
		const right = bandClasses(source, HEADZONE, "headzone-right");

		expect(left).toHaveLength(1);
		expect(right).toHaveLength(1);

		// `.hleft{flex:1 1 auto;min-width:0}` — grows, and may shrink below its
		// content. `min-w-0` is the horizontal twin of `min-h-0` and is dropped
		// exactly as often: without it a long question string sets the column's
		// automatic minimum and the rail is pushed off the row.
		expect(left[0]).toContain("flex-1");
		expect(left[0]).toContain("min-w-0");
		// `.hright{flex:0 0 …;min-width:0}` — does not grow.
		expect(right[0]).toContain("min-w-0");
		expect(right[0]).not.toContain("flex-1");
	});

	it("debate-height::the-rail-is-a-FRACTION-never-the-mockups-fixed-track", () => {
		const right = bandClasses(read(HEADZONE), HEADZONE, "headzone-right")[0];

		// ⛔ THE ONE SURVIVING RULE. `.hright` is `flex:0 0 340px` in the mockup
		// and that length is NOT carried: the mockup is a fixed-desktop
		// light-mode prototype that declares no breakpoint at all, and a fixed
		// track is precisely the defect `shell/page-container.test.ts` records
		// for the profile — "two 356px columns at 1440, IDENTICAL to its 768
		// rendering". A fraction scales with the container; 340px does not.
		expect(right.some((c) => c.includes("340px"))).toBe(false);
		expect(right.some((c) => /^lg:w-\d+\/\d+$/.test(c))).toBe(true);
	});
});

describe("debate height chain — the arena band takes the leftover", () => {
	it("debate-height::BOTH-arms-wire-the-arena-band-identically", () => {
		const arenas = bandClasses(read(VIEW), VIEW, "arena");

		// One per arm of the market↔post ternary. If a later change collapses the
		// ternary this count moves and the guard should be re-derived, not
		// loosened.
		expect(arenas).toHaveLength(2);

		for (const classes of arenas) {
			// `.arena{flex:1 1 auto;min-height:0}` — takes everything the headzone
			// band left, and may shrink below its content.
			expect(classes).toContain("flex-1");
			expect(classes).toContain("min-h-0");
			expect(classes).toContain("flex");
			expect(classes.filter((c) => FORBIDDEN_HEIGHT.test(c))).toEqual([]);
		}

		// Both arms identical — the failure this catches is wiring one arm and
		// leaving the other on the old `flex gap-4`.
		expect(new Set(arenas[0]).size).toBe(new Set(arenas[1]).size);
		expect([...arenas[0]].sort()).toEqual([...arenas[1]].sort());
	});

	it("debate-height::the-pole-column-may-shrink-below-its-content", () => {
		const source = read(COLUMN);

		// `DebateColumn`'s className is a TEMPLATE LITERAL (it appends the
		// engaged-slot backlight), so it is asserted as the literal prefix rather
		// than through `bandClasses` — the same declaration, read the way it is
		// actually written on disk.
		expect(source).toContain("flex min-h-0 flex-1 flex-col gap-3");
	});
});
