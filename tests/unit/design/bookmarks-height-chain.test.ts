// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS — THE HEIGHT CHAIN, ASSERTED NODE BY NODE **AND
 * RECORDED WHERE IT STOPS**.
 *
 * WHAT THIS GUARD IS FOR. `/bookmarks` gained Profile's arena panel: a bordered
 * section whose BODY owns the scroll. A body that scrolls inside its panel
 * needs a DEFINITE height handed down from an ancestor, and a definite height
 * is not a property of any one node — it is a chain, only as good as its
 * weakest link. Break any link and NOTHING visibly errors: the panel reverts to
 * content height, the scroll never engages, and the page merely looks long.
 * There is no type error, no console warning, and no render test that can see
 * it (`profile-height-chain.test.ts:8-15` records the same hazard).
 *
 * ✅ THE CHAIN IS COMPLETE AS OF R1 (founder-ruled 2026-08-15). It was not,
 * and the history is kept because it is the reason the last `describe` exists.
 *
 *   The first link is the `PageContainer` call site, which must declare
 *   `flex-1 min-h-0 flex-col` on the minted `wide` preset — exactly as
 *   Profile's does. `/bookmarks` could declare NEITHER: its container is SITE 2
 *   of `tests/unit/shell/page-container.test.ts`, which asserts CLASS-SET
 *   EQUALITY against its verbatim `c5892bc` baseline and separately pinned the
 *   enumeration of ruled moves at exactly `[5]`. Changing the preset OR adding
 *   the two chain classes reddened both rows, and that file sat OUTSIDE the
 *   round's write allow-list — so the move was a RULING, not an edit. The
 *   previous round REFUSED it and asserted the halted state here by name.
 *
 * ⇒ The founder ruled it and extended the allow-list by that one file. The
 * container now carries the move, site 2 carries the `now`/`movedBy` that
 * authorises it, and the last `describe` asserts that BOTH happened — the
 * successor to the halt, not its deletion.
 *
 * ⚠ ONE new link, not two. R1's brief said "the two now-real links"; the
 * measurement says there is exactly one new NODE, because this surface has no
 * band between the container and the panel. Profile has one (its two-column
 * `arena` grid); this arena is a single panel. Inventing a second row to reach
 * the stated count would have been the failure, not the fix.
 *
 * ⚠ AND EVEN COMPLETED IT WOULD NOT DELIVER A SCROLL ON ITS OWN.
 * `profile-height-chain.test.ts:43-70` measured this under control: with the
 * chain fully wired at 1440, twelve injected rows moved `<main>` 1383 → 1619
 * and the panel body's client height 901 → 1136 while `scrollHeight >
 * clientHeight` stayed FALSE throughout. `<main>`'s height is
 * `max(floor, content)` because RULED A1 makes the floor a `min-height` so the
 * page GROWS rather than clips. What the chain buys is that the panel FILLS its
 * band instead of sitting at content height, and that the scroll container is
 * correctly wired the moment any ancestor becomes definite.
 * ⛔ DO NOT "FIX" THE MISSING SCROLL BY ADDING `h-*` ANYWHERE. The A1 assertion
 * below exists to stop exactly that, which is why the forbidden set is
 * asymmetric with `min-h-0`.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: no
 * `calc()`, no `100vh`, no percentage height, no Tailwind utility resolves, so
 * a render test structurally cannot see any of this
 * (`discovery-height-chain.test.ts:19-24` states the same limit). This file
 * proves the DECLARATIONS are present; a browser proves they compose.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES — including Profile's,
 * as the byte-carry's own counterparty. It never rebuilds a lookalike class
 * string and checks that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const PAGE = "src/app/(public)/bookmarks/page.tsx";
const PANEL = "src/components/bookmarks/BookmarksPanel.tsx";
/** The byte-carry's counterparty — Profile's right arena half, as shipped. */
const PROFILE_PANEL = "src/components/profile/ArgumentList.tsx";

/**
 * ⛔ THE FORBIDDEN SET, and it is NOT symmetrical with `min-h-0`.
 *
 * A FIXED height CLIPS: content taller than the box is lost, with no scroll and
 * no overflow. RULED A1 forbids it on this chain at every node, and the
 * mockup's `overflow:hidden` on html/body was struck as a fixed-viewport
 * prototype affordance. `min-h-0` is the opposite — it removes a FLOOR so a
 * node can shrink and hand the overflow to a scroll container — and is
 * REQUIRED, not forbidden.
 */
const A1_FORBIDDEN = [/^h-screen$/, /^h-dvh$/, /^h-full$/, /^h-\[/];

/** The class list of a node in a component file, by its `data-testid`. */
function nodeClasses(source: string, file: string, testid: string): string[] {
	// Verbatim from `profile-height-chain.test.ts:136-149`, deliberately: two
	// files reading the same shape must read it the same way or they can
	// disagree about what is on disk. No `s` flag — tsconfig targets ES2017
	// (TS1501), and `[\s\S]` already spans newlines.
	const m = new RegExp(
		`"${testid}"[\\s\\S]{0,400}?className=(?:"([^"]*)"|\`([^\`]*)\`)`,
	).exec(source);
	const cls = m?.[1] ?? m?.[2];
	if (!cls) {
		throw new Error(
			`${file}: no node with data-testid="${testid}" and a readable className. ` +
				`If the panel was restructured, re-derive this chain rather than ` +
				`deleting the guard.`,
		);
	}
	return cls.split(/\s+/).filter(Boolean);
}

/** The className on this route's container tag, as written on disk. */
function containerTag(): { preset: string; extras: string } {
	const tag = /<PageContainer\b[^>]*>/.exec(read(PAGE));
	if (!tag) {
		throw new Error(`${PAGE}: no container tag found.`);
	}
	const preset = /preset="([^"]+)"/.exec(tag[0])?.[1];
	const extras = /className="([^"]*)"/.exec(tag[0])?.[1];
	if (preset === undefined || extras === undefined) {
		throw new Error(`${PAGE}: the container tag carries no preset/className.`);
	}
	return { preset, extras };
}

/**
 * EVERY LINK THIS SURFACE OWNS, as (name, classes, required classes). The table
 * IS the assertion: adding a node to the chain means adding a row here, which
 * is how a new link stays visible instead of being trusted.
 */
function chainLinks(): Array<{
	name: string;
	classes: string[];
	needs: string[];
}> {
	const panel = read(PANEL);
	return [
		{
			// R1 — THE FIRST LINK, NOW REAL. Until the founder ruling of
			// 2026-08-15 this node was pinned to its `c5892bc` baseline by SITE 2
			// of `page-container.test.ts` and could declare neither class, so the
			// chain started BELOW it and could not bind. It starts here now.
			name: "PageContainer call site",
			classes: containerTag().extras.split(/\s+/).filter(Boolean),
			needs: ["flex-1", "min-h-0", "flex-col"],
		},
		{
			name: "bookmarks panel",
			classes: nodeClasses(panel, PANEL, "bookmarks-panel"),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "bookmarks panel body",
			classes: nodeClasses(panel, PANEL, "bookmarks-panel-body"),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
	];
}

describe("bookmarks height chain — the links this surface owns", () => {
	it("bookmarks-height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded N1/H-1 failure mode in this directory.
		const links = chainLinks();
		// ⚠ THREE, NOT TWO, AND THE COUNT IS A CLAIM. R1's brief said "the two
		// now-real links"; the measurement says there is exactly ONE new node —
		// the container call site — because this surface has no band between the
		// container and the panel. Profile has one (its `arena` grid) because its
		// arena is two columns; this arena is ONE panel, which is the single-
		// collection measurement the previous round refused C3 on. Adding a
		// second row here to reach a count of two would mean inventing a node.
		expect(links.length).toBe(3);
		for (const l of links) {
			expect(
				l.classes.length,
				`${l.name} resolved to no classes`,
			).toBeGreaterThan(0);
		}
		// The SOURCE of every chain on this shell, in a file this task may not
		// edit. If the floor stops being a `min-h-*` calc there is no slack to pass
		// on at all — to this surface or to Profile.
		expect(read(LAYOUT)).toContain("min-h-[calc(100vh-");
	});

	it("bookmarks-height-chain::every-link-declares-what-it-owes-the-chain", () => {
		// ⚠ THE WHOLE POINT. Drop any one of these and NOTHING errors — the panel
		// quietly reverts to content height and the scroll never engages.
		for (const { name, classes, needs } of chainLinks()) {
			for (const c of needs) {
				expect(
					classes,
					`HEIGHT CHAIN BROKEN AT "${name}": it must declare \`${c}\`. ` +
						`Without it the chain stops here — the panel reverts to content ` +
						`height, the list stops scrolling inside it, and nothing else ` +
						`fails. Got: ${classes.join(" ")}`,
				).toContain(c);
			}
		}
	});

	it("bookmarks-height-chain::no-clipping-utility-on-any-node-this-round-owns", () => {
		// RULED A1 (`(public)/layout.tsx`), enforced on the nodes it governs: the
		// floor lets the page GROW and SCROLL when content exceeds the viewport
		// instead of clipping it.
		const panel = read(PANEL);
		const nodes: Array<[string, string[]]> = [
			["the container call site", containerTag().extras.split(/\s+/)],
			["the panel", nodeClasses(panel, PANEL, "bookmarks-panel")],
			["the panel head", nodeClasses(panel, PANEL, "bookmarks-panel-head")],
			["the panel body", nodeClasses(panel, PANEL, "bookmarks-panel-body")],
		];
		for (const [name, classes] of nodes) {
			for (const forbidden of A1_FORBIDDEN) {
				const hit = classes.find((c) => forbidden.test(c));
				expect(
					hit,
					`RULED A1: ${name} declares \`${hit}\`, which CLIPS instead of ` +
						`letting the page grow and scroll. Use a \`min-h-*\` floor.`,
				).toBeUndefined();
			}
		}
	});
});

describe("the panel is BYTE-CARRIED from Profile's, not re-derived", () => {
	/**
	 * ⚠ THE CLAIM THIS ROUND MAKES IS SAMENESS, SO SAMENESS IS WHAT IS ASSERTED —
	 * against the shipped Profile file, never against a literal restated here. A
	 * restated literal pins this guard's own copy and goes stale the moment
	 * Profile's panel moves, which is exactly when the two would need to be
	 * compared. Class ORDER has no effect on the cascade (Tailwind emits one rule
	 * per utility at fixed specificity), so SET equality is the right proof.
	 */
	const pairs: Array<[string, string, string]> = [
		["section", "bookmarks-panel", "arguments-panel"],
		["header bar", "bookmarks-panel-head", "arguments-panel-head"],
		["body", "bookmarks-panel-body", "arguments-panel-body"],
	];

	it.each(
		pairs,
	)("the %s carries Profile's class set exactly", (_role, mine, theirs) => {
		const here = new Set(nodeClasses(read(PANEL), PANEL, mine));
		const there = new Set(
			nodeClasses(read(PROFILE_PANEL), PROFILE_PANEL, theirs),
		);
		expect(here).toEqual(there);
	});

	it("the panel TITLE carries Profile's panel-title tier", () => {
		// Extracted from each file's own title node rather than restated, for the
		// same reason as the three rows above. Profile's is a `<span>Arguments`;
		// this surface's is an `<h1>Bookmarks` — the ELEMENT differs by ruling
		// (this surface has a page heading and Profile has none) and the TIER does
		// not, which is precisely the split canon §10 `C-STATES-1`'s DOC-1 rider
		// ratifies: a shared TREATMENT never ratifies a shared FILE SHAPE.
		const mine = /className="([^"]*)"\s*>\s*Bookmarks\s*</.exec(read(PANEL));
		const theirs = /className="([^"]*)"\s*>\s*Arguments\s*</.exec(
			read(PROFILE_PANEL),
		);
		expect(mine?.[1], `${PANEL}: no titled node found`).toBeTruthy();
		expect(theirs?.[1], `${PROFILE_PANEL}: no titled node found`).toBeTruthy();
		expect(new Set((mine?.[1] ?? "").split(/\s+/))).toEqual(
			new Set((theirs?.[1] ?? "").split(/\s+/)),
		);
	});
});

describe("✅ THE FIRST LINK, LIFTED — the record moved with the code", () => {
	/**
	 * ⚠ THIS BLOCK IS THE HALT'S SUCCESSOR, NOT ITS DELETION, and the difference
	 * is the whole reason the halt was written as an assertion.
	 *
	 * WHAT IT REPLACED. Until 2026-08-15 this file asserted that the container
	 * was STILL on its pinned `c5892bc` baseline and that neither chain class had
	 * been smuggled onto it — a known-incomplete state, pinned deliberately so
	 * that lifting the block could not happen silently. The founder ruled the
	 * move and extended the write allow-list by `page-container.test.ts`; the
	 * two rows above (`chainLinks()`'s new first entry) are the code half.
	 *
	 * ⇒ WHAT THIS BLOCK NOW DOES: assert the two files moved TOGETHER. The chain
	 * classes on the container and the `now`/`movedBy` row that authorises them
	 * live in different files, and either one alone is a defect — a container
	 * that moved with no ruling recorded, or a ruling recorded for a move that
	 * never happened. Neither guard can see that on its own, so it is asserted
	 * here, across both.
	 */
	it("the container declares the ruled move", () => {
		const { preset, extras } = containerTag();
		expect(preset).toBe("wide");
		const set = new Set(extras.split(/\s+/).filter(Boolean));
		for (const c of ["flex", "flex-1", "min-h-0", "flex-col"]) {
			expect(set.has(c), `the container must declare \`${c}\``).toBe(true);
		}
		// ⚠ `gap-4` IS THIS SURFACE'S OWN and deliberately did NOT move to
		// profile's `gap-6`: the ruling named the preset and the two chain
		// classes, and a gap is neither. Pinned so a later "tidy-up" to match
		// profile reads as the value change it would be.
		expect(set.has("gap-4")).toBe(true);
		expect(set.has("gap-6")).toBe(false);
	});

	it("…and `page-container.test.ts` carries the ruling that authorises it", () => {
		// ⛔ READ OFF THE GUARD FILE ITSELF, never restated here. If site 2's row
		// is reverted while the container keeps the classes, this reddens — which
		// is the pairing the halt existed to force.
		const guard = read("tests/unit/shell/page-container.test.ts");
		const site2 =
			/site: 2,[\s\S]*?\n\t\},/.exec(guard)?.[0] ??
			(() => {
				throw new Error("page-container.test.ts: site 2 row not found");
			})();
		expect(site2).toContain("now:");
		expect(site2).toContain("movedBy:");
		expect(site2).toContain("max-w-[1440px]");
		// The enumeration of ruled moves must NAME site 2 — a `now` row that the
		// enumeration does not list would fail that guard, not this one, but the
		// cross-check keeps the two facts from drifting apart.
		expect(guard).toContain("toEqual([2, 5])");
	});

	it("POSITIVE-CONTROL — each check above reddens on a real mutation", () => {
		// ⚠ PROOF BY REVERSAL. A guard only ever run against a passing tree is
		// indistinguishable from one that cannot fail. Each mutation below runs the
		// REAL predicate over the REAL file contents.
		const panel = read(PANEL);

		// 1. A link drops `min-h-0` — the silent break this whole file exists for.
		const body = nodeClasses(panel, PANEL, "bookmarks-panel-body");
		expect(body).toContain("min-h-0");
		expect(body.filter((c) => c !== "min-h-0")).not.toContain("min-h-0");

		// 2. The scroll container loses its overflow — the panel would then grow
		//    instead of scrolling, with no error anywhere.
		expect(body).toContain("overflow-y-auto");
		expect(body.filter((c) => c !== "overflow-y-auto")).not.toContain(
			"overflow-y-auto",
		);

		// 3. A node gains a CLIPPING utility. Same A1 predicate the assertion above
		//    uses, so the two cannot drift apart.
		expect(
			A1_FORBIDDEN.some((re) => ["h-screen", ...body].some((c) => re.test(c))),
		).toBe(true);
		expect(A1_FORBIDDEN.some((re) => body.some((c) => re.test(c)))).toBe(false);

		// 4. The extractors THROW rather than silently returning nothing when the
		//    node they name is gone — a guard that reports a restructure, not one
		//    that passes vacuously through it.
		expect(() => nodeClasses(panel, PANEL, "no-such-node")).toThrow();
		expect(() =>
			nodeClasses("export const X = 1;", PANEL, "bookmarks-panel"),
		).toThrow();
	});
});
