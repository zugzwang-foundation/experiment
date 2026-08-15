// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS — THE HEIGHT CHAIN, asserted node by node.
 *
 * WHAT THIS GUARD IS FOR. Each arena panel's BODY owns a scroll. A body that
 * scrolls inside its panel needs a DEFINITE height handed down from an
 * ancestor, and a definite height is not a property of any one node — it is a
 * chain, only as good as its weakest link. Break any link and NOTHING visibly
 * errors: the panel reverts to content height, the scroll never engages, and
 * the page merely looks long. No type error, no console warning, and no render
 * test can see it (`profile-height-chain.test.ts:8-15` records the same hazard).
 *
 * ⚠ R2 RE-DERIVED THE CHAIN RATHER THAN EDITING IT AROUND THE NEW SHAPE. R1's
 * version asserted a ONE-panel surface with literal `bookmarks-panel*` testids.
 * R2 makes the arena two halves off one `BookmarksPanel` component whose
 * testids are template literals, so the extractor reads the COMPONENT's class
 * strings once and both halves inherit them by construction — which is a
 * stronger claim than R1's, not a weaker one: the two panels cannot drift apart.
 *
 * THE CHAIN, and what each node contributes:
 *
 *   <main>            min-h-[calc(100vh-60px-2px)] flex-1 flex-col  ← the SOURCE
 *                     (owned by `(public)/layout.tsx`, out of scope here)
 *   PageContainer     flex-1 min-h-0 flex-col   ← takes the floor, passes it on
 *   headzone band     (no flex-1)               ← deliberately does NOT grow
 *   arena band        flex-1 min-h-0            ← the growing element
 *   both panels       min-h-0 flex-col          ← may be shorter than content
 *   both panel bodies flex-1 min-h-0 overflow-y-auto ← where the scroll happens
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible: a flex
 * item's automatic minimum size is its CONTENT, so without it a node refuses to
 * shrink below what it holds. Each is pinned BY NAME on the node that needs it.
 *
 * ⚠⚠ THIS DOES NOT CONTRADICT RULED A1. `(public)/layout.tsx` forbids `h-*` and
 * `min-h-0` on the PAGE-LEVEL column so the page can GROW AND SCROLL rather
 * than clip. It still does — `<main>`'s floor is a FLOOR. What `min-h-0` buys
 * BELOW that is a bounded arena whose panels scroll internally. Two scopes, two
 * rules; `h-*` stays forbidden everywhere here and is asserted so.
 *
 * ⛔⛔ AND IT DOES NOT DELIVER A SCROLL ON ITS OWN — measured, not assumed.
 * `profile-height-chain.test.ts:43-70` records the control: with the chain fully
 * wired at 1440, twelve injected rows moved `<main>` 1383 → 1619 and the panel
 * body's client height 901 → 1136 while `scrollHeight > clientHeight` stayed
 * FALSE. `<main>` is `max(floor, content)`, so there is no definite height to
 * bind. What the chain buys is that the panels FILL the band instead of sitting
 * at content height, and that the scroll container is correctly wired the moment
 * any ancestor becomes definite. ⛔ DO NOT "fix" it with `h-*`.
 *
 * ⚠ WHY A SOURCE SCAN. jsdom performs no layout — no `calc()`, no `100vh`, no
 * percentage height, no Tailwind utility resolves. This proves the DECLARATIONS
 * are present; a browser proves they compose.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const PAGE = "src/app/(public)/bookmarks/page.tsx";
const PANEL = "src/components/bookmarks/BookmarksPanel.tsx";
/** The byte-carry's counterparties — Profile's two arena halves, as shipped. */
const PROFILE_ARGS = "src/components/profile/ArgumentList.tsx";
const PROFILE_POS = "src/components/profile/PositionsTable.tsx";
const GUARD = "tests/unit/shell/page-container.test.ts";

/**
 * ⛔ THE FORBIDDEN SET, NOT symmetrical with `min-h-0`. A FIXED height CLIPS:
 * content taller than the box is lost, with no scroll and no overflow. RULED A1
 * forbids it at every node on this chain. `min-h-0` is the opposite — it removes
 * a FLOOR so a node can shrink and hand overflow to a scroll container — and is
 * REQUIRED below.
 */
const A1_FORBIDDEN = [/^h-screen$/, /^h-dvh$/, /^h-full$/, /^h-\[/];

/** The class list of one of `BookmarksPanel`'s three nodes. The testids are
 *  TEMPLATE LITERALS (`${testid}-panel`), so the marker includes the closing
 *  backtick-brace — which is also what stops `-panel` from matching
 *  `-panel-head`. */
function panelNode(part: "" | "-head" | "-body"): string[] {
	const src = read(PANEL);
	const m = new RegExp(
		`\\$\\{testid\\}-panel${part}\`\\}[\\s\\S]{0,300}?className="([^"]*)"`,
	).exec(src);
	if (!m?.[1]) {
		throw new Error(
			`${PANEL}: no node for \`\${testid}-panel${part}\` with a readable ` +
				`className. If the panel was restructured, re-derive this chain ` +
				`rather than deleting the guard.`,
		);
	}
	return m[1].split(/\s+/).filter(Boolean);
}

/** A node in a profile file, by its literal `data-testid`. Verbatim from
 *  `profile-height-chain.test.ts:136-149`: two files reading the same shape must
 *  read it the same way or they can disagree about what is on disk. */
function profileNode(file: string, testid: string): string[] {
	const m = new RegExp(
		`"${testid}"[\\s\\S]{0,400}?className=(?:"([^"]*)"|\`([^\`]*)\`)`,
	).exec(read(file));
	const cls = m?.[1] ?? m?.[2];
	if (!cls) {
		throw new Error(`${file}: no node with data-testid="${testid}".`);
	}
	return cls.split(/\s+/).filter(Boolean);
}

/** A band on the page, by its literal `data-testid`. */
function band(testid: string): string[] {
	const m = new RegExp(`"${testid}"\\s+className="([^"]*)"`).exec(read(PAGE));
	if (!m?.[1]) {
		throw new Error(
			`${PAGE}: no band with data-testid="${testid}" and a literal className.`,
		);
	}
	return m[1].split(/\s+/).filter(Boolean);
}

/** The container tag on this route, as written on disk. */
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
 * EVERY LINK, as (name, classes, required). The table IS the assertion: adding
 * a node to the chain means adding a row here, which is how a new link stays
 * visible instead of being trusted.
 */
function chainLinks(): Array<{
	name: string;
	classes: string[];
	needs: string[];
}> {
	return [
		{
			name: "PageContainer call site",
			classes: containerTag().extras.split(/\s+/).filter(Boolean),
			needs: ["flex-1", "min-h-0", "flex-col"],
		},
		{
			name: "arena band",
			classes: band("bookmarks-arena"),
			needs: ["flex-1", "min-h-0"],
		},
		{
			// ONE component, BOTH halves — they cannot drift apart by construction.
			name: "panel (both halves)",
			classes: panelNode(""),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "panel body (both halves)",
			classes: panelNode("-body"),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
	];
}

describe("bookmarks height chain — every link, asserted by name", () => {
	it("bookmarks-height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded N1/H-1 failure mode in this directory.
		const links = chainLinks();
		expect(links.length).toBe(4);
		for (const l of links) {
			expect(
				l.classes.length,
				`${l.name} resolved to no classes`,
			).toBeGreaterThan(0);
		}
		// The SOURCE of every chain on this shell, in a file this task may not
		// edit. If the floor stops being a `min-h-*` calc there is no slack at all.
		expect(read(LAYOUT)).toContain("min-h-[calc(100vh-");
	});

	it("bookmarks-height-chain::every-link-declares-what-it-owes-the-chain", () => {
		for (const { name, classes, needs } of chainLinks()) {
			for (const c of needs) {
				expect(
					classes,
					`HEIGHT CHAIN BROKEN AT "${name}": it must declare \`${c}\`. Without ` +
						`it the chain stops here — the panel reverts to content height, the ` +
						`rows stop scrolling inside it, and nothing else fails. Got: ` +
						classes.join(" "),
				).toContain(c);
			}
		}
	});

	it("bookmarks-height-chain::the-headzone-does-NOT-grow", () => {
		// Only the arena divides the leftover. If the top band grew too, the two
		// bands would fight for the same slack and the arena would get an
		// arbitrary share of it.
		expect(band("bookmarks-headzone")).not.toContain("flex-1");
	});

	it("bookmarks-height-chain::the-two-bands-share-ONE-breakpoint", () => {
		// ⚠ A band that went two-column while the arena below it stayed stacked
		// would read as a mistake, not as a layout. Both are `lg:grid-cols-2`, and
		// `lg` is the breakpoint the profile RULED FROM MEASUREMENT
		// (`u/[pseudonym]/page.tsx:109-131`) rather than chose.
		expect(band("bookmarks-headzone")).toContain("lg:grid-cols-2");
		expect(band("bookmarks-arena")).toContain("lg:grid-cols-2");
	});

	it("bookmarks-height-chain::no-clipping-utility-on-any-node-this-round-owns", () => {
		const nodes: Array<[string, string[]]> = [
			["the container call site", containerTag().extras.split(/\s+/)],
			["the headzone band", band("bookmarks-headzone")],
			["the arena band", band("bookmarks-arena")],
			["the panel", panelNode("")],
			["the panel head", panelNode("-head")],
			["the panel body", panelNode("-body")],
		];
		for (const [name, classes] of nodes) {
			for (const forbidden of A1_FORBIDDEN) {
				const hit = classes.find((c) => forbidden.test(c));
				expect(
					hit,
					`RULED A1: ${name} declares \`${hit}\`, which CLIPS instead of letting ` +
						`the page grow and scroll. Use a \`min-h-*\` floor.`,
				).toBeUndefined();
			}
		}
	});
});

describe("the panel is BYTE-CARRIED from Profile's, not re-derived", () => {
	/**
	 * ⚠ THE CLAIM IS SAMENESS, so sameness is asserted — against the SHIPPED
	 * profile files, never against a literal restated here. A restated literal
	 * pins this guard's own copy and goes stale exactly when the two would need
	 * comparing. Class ORDER has no effect on the cascade, so SET equality is the
	 * right proof.
	 */
	it("the section carries `ArgumentsPanel`'s class set exactly", () => {
		expect(new Set(panelNode(""))).toEqual(
			new Set(profileNode(PROFILE_ARGS, "arguments-panel")),
		);
	});

	it("the body carries `ArgumentsPanel`'s class set exactly", () => {
		expect(new Set(panelNode("-body"))).toEqual(
			new Set(profileNode(PROFILE_ARGS, "arguments-panel-body")),
		);
	});

	it("the header bar carries `PositionsPanel`'s — the one WITH `relative`", () => {
		// ⚠ THE HEAD IS CARRIED FROM THE LEFT PROFILE PANEL, NOT THE RIGHT, and
		// the difference is one token. `PositionsPanel`'s head is `relative`
		// because it hosts the market popover's positioning context — a browser
		// measurement moved it there from the trigger
		// (`PositionsTable.tsx:542-545`). This surface hosts the same popover, so
		// it needs the same node.
		expect(new Set(panelNode("-head"))).toEqual(
			new Set(profileNode(PROFILE_POS, "positions-panel-head")),
		);
	});
});

describe("the container's ruled move, and the ruling that authorises it", () => {
	/**
	 * ⚠ TWO FILES MUST MOVE TOGETHER, and neither guard can see that alone: the
	 * chain classes live on the container, the `now`/`movedBy` row that
	 * authorises them lives in `page-container.test.ts`. Either alone is a defect
	 * — a container that moved with no ruling recorded, or a ruling recorded for
	 * a move that never happened. Asserted here, across both.
	 */
	it("the container declares the ruled move", () => {
		const { preset, extras } = containerTag();
		expect(preset).toBe("wide");
		const set = new Set(extras.split(/\s+/).filter(Boolean));
		for (const c of ["flex", "flex-1", "min-h-0", "flex-col"]) {
			expect(set.has(c), `the container must declare \`${c}\``).toBe(true);
		}
		// `gap-4` is this surface's own and did NOT move to profile's `gap-6`.
		expect(set.has("gap-4")).toBe(true);
		expect(set.has("gap-6")).toBe(false);
	});

	it("…and `page-container.test.ts` carries the ruling", () => {
		const guard = read(GUARD);
		const site2 = /site: 2,[\s\S]*?\n\t\},/.exec(guard)?.[0];
		expect(site2, `${GUARD}: site 2 row not found`).toBeTruthy();
		expect(site2).toContain("now:");
		expect(site2).toContain("movedBy:");
		expect(site2).toContain("max-w-[1440px]");
		expect(guard).toContain("toEqual([2, 5])");
	});

	it("POSITIVE-CONTROL — each check reddens on a real mutation", () => {
		// ⚠ PROOF BY REVERSAL. A guard only ever run against a passing tree is
		// indistinguishable from one that cannot fail.
		const body = panelNode("-body");
		expect(body).toContain("min-h-0");
		expect(body.filter((c) => c !== "min-h-0")).not.toContain("min-h-0");
		expect(body).toContain("overflow-y-auto");
		expect(body.filter((c) => c !== "overflow-y-auto")).not.toContain(
			"overflow-y-auto",
		);
		// The A1 predicate fires on a clipping utility and not on the real set.
		expect(
			A1_FORBIDDEN.some((re) => ["h-screen", ...body].some((c) => re.test(c))),
		).toBe(true);
		expect(A1_FORBIDDEN.some((re) => body.some((c) => re.test(c)))).toBe(false);
		// The extractors THROW rather than passing vacuously through a restructure.
		expect(() => band("bookmarks-nonexistent-band")).toThrow();
		expect(() => profileNode(PROFILE_ARGS, "no-such-node")).toThrow();
	});
});
