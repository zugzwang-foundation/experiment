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
 * ⛔⛔ THIS CHAIN IS INCOMPLETE AT ITS FIRST LINK, ON PURPOSE, AND THE HALT IS
 * ASSERTED RATHER THAN DESCRIBED. Profile's chain starts at its
 * `PageContainer` call site, which declares `flex-1 min-h-0 flex-col` on the
 * minted `wide` preset. `/bookmarks` cannot declare either, and the blocker is
 * a pin, not an oversight:
 *
 *   `tests/unit/shell/page-container.test.ts` declares this route's container
 *   as SITE 2 and asserts CLASS-SET EQUALITY of `cn(preset, className)` against
 *   its verbatim `c5892bc` baseline, then separately pins the enumeration of
 *   ruled moves at exactly `[5]`. Changing the preset OR adding the two chain
 *   classes reddens both rows. That file sits OUTSIDE this round's write
 *   allow-list, and its own `now`/`movedBy` fields are the documented way a
 *   deliberate move is recorded — the mechanism PR #337 used for site 5 in the
 *   same commit as the move.
 *
 * ⇒ The move is a RULING (extend the allow-list by that one file), not an edit.
 * Until it lands, the panel below sits at CONTENT height and its
 * `overflow-y-auto` cannot engage. The last `describe` asserts that halted
 * state by name, so the day the container moves this guard goes RED and the
 * recorded halt must move with it — instead of quietly outliving the block it
 * documents.
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
		expect(links.length).toBe(2);
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

describe("⛔ THE HALTED FIRST LINK — recorded as an assertion, not as prose", () => {
	/**
	 * ⚠ THIS BLOCK PINS A KNOWN-INCOMPLETE STATE, DELIBERATELY, AND IT IS THE
	 * OPPOSITE OF PINNING A DEFECT. The container cannot move without a ruling
	 * (see this file's head). A halt recorded only in a comment outlives the
	 * block it documents in silence; a halt recorded as an assertion goes RED the
	 * moment the block is lifted, forcing the record and the code to move in one
	 * commit. That is the same posture `IdentityCard.tsx`'s row-16 refusal takes.
	 *
	 * ⇒ WHEN THE RULING LANDS: move the container to `wide` + `flex min-h-0
	 * flex-1 flex-col`, add the `now`/`movedBy` row for site 2 in
	 * `tests/unit/shell/page-container.test.ts`, and REPLACE this whole
	 * `describe` with the two missing links added to `chainLinks()` above.
	 * ⛔ Do not simply delete it.
	 */
	it("the container is still on the pinned baseline — the chain does not start here", () => {
		const { preset, extras } = containerTag();
		expect(
			preset,
			`${PAGE} moved off the pinned preset. If that was RULED, this guard is ` +
				`now the stale record — see this block's docblock for the three edits ` +
				`that land together.`,
		).toBe("reading");
		expect(new Set(extras.split(/\s+/).filter(Boolean))).toEqual(
			new Set(["flex", "flex-col", "gap-4"]),
		);
	});

	it("neither chain class has been smuggled onto the container", () => {
		// The two links Profile's chain declares at this node. Adding either here
		// without the paired `page-container.test.ts` row would redden THAT guard
		// while this one stayed green, so it is named on both sides.
		const extras = new Set(containerTag().extras.split(/\s+/));
		for (const c of ["flex-1", "min-h-0"]) {
			expect(
				extras.has(c),
				`${PAGE} declares \`${c}\`. That is the ruled move, and it must land ` +
					`WITH its \`now\`/\`movedBy\` row in tests/unit/shell/page-container.test.ts.`,
			).toBe(false);
		}
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
