import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · PROFILE — THE HEIGHT CHAIN, FINISHED, asserted node by node.
 *
 * WHAT THIS GUARD IS FOR. Row 3 gives the positions panel a rows region that
 * fills the panel and scrolls INSIDE it, with the column-header row held out of
 * that scroll. That needs a DEFINITE panel height, and a definite height is not
 * a property of any one node — it is a chain, and it is only as good as its
 * weakest link. Break ANY link and nothing visibly errors: the panel silently
 * reverts to content height, the scroll never engages, and the surface looks
 * merely "a bit long" rather than broken. There is no type error, no console
 * warning, and no render test that can see it.
 *
 * THE CHAIN, and what each node contributes:
 *
 *   <main>            min-h-[calc(100vh-60px-2px)] flex-1 flex-col   ← the SOURCE
 *                     (owned by `(public)/layout.tsx`, out of scope here)
 *   PageContainer     flex-1 min-h-0 flex-col       ← takes the floor, passes it on
 *   headzone band     (no flex-1)                   ← deliberately does NOT grow
 *   arena band        flex-1 min-h-0                ← the growing element
 *   both panels       min-h-0 flex-col              ← may be shorter than content
 *   both panel bodies flex-1 min-h-0 overflow-y-auto ← where the scroll happens
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible. A flex
 * item's automatic minimum size is its CONTENT, so without `min-h-0` a node
 * refuses to shrink below what it holds — the arena pushes past the container,
 * the panel grows instead of scrolling, and the page just gets taller. Every
 * `min-h-0` below is therefore pinned BY NAME on the node that needs it.
 *
 * ⚠⚠ THIS DOES NOT CONTRADICT RULED A1, and the distinction is the whole design.
 * `(public)/layout.tsx` says "⛔ `min-h-*`, never `h-*`, and NO `min-h-0`
 * anywhere in the chain" — that governs the PAGE-LEVEL column, so the page can
 * GROW AND SCROLL rather than clip. It still does: `<main>`'s floor is a FLOOR,
 * and content that cannot scroll (the headzone) still pushes the page taller.
 * What `min-h-0` buys BELOW that is a bounded arena whose panels scroll
 * internally — recon A-5's own note that row 3's "fills the panel" is
 * "panel-scoped, never viewport-scoped". Two different scopes, two different
 * rules. `h-*` remains forbidden everywhere on the chain and is asserted so.
 *
 * ⛔⛔ WHAT THE CHAIN DOES **NOT** DELIVER, MEASURED AND REFUSED — READ THIS
 * BEFORE "FIXING" ANYTHING BELOW. Row 3 also asks that the fourth position row
 * and later be reached by SCROLLING INSIDE the panel. That is UNREACHABLE under
 * RULED A1, and it is a contradiction rather than a wiring bug:
 *
 *   `<main>`'s height is `max(floor, content)` — the floor is a `min-height`,
 *   deliberately, so the page GROWS AND SCROLLS instead of clipping (A1).
 *   Panel-internal scrolling needs `arena height < arena content`, which needs
 *   `main < content`. But `main = max(floor, content) >= content`. The two
 *   requirements cannot both hold.
 *
 * PROVEN BY CONTROL, not inferred: with the chain fully wired at 1440, injecting
 * twelve extra rows moved `main` 1383 -> 1619 and the panel body's CLIENT height
 * 901 -> 1136, while `scrollHeight > clientHeight` stayed FALSE throughout. The
 * page grew; the panel never scrolled. Binding it needs a DEFINITE height on an
 * ancestor (`h-[calc(...)]`), which §4 forbids outright, which A1 forbids in
 * `(public)/layout.tsx:103-107`, and which recon A-5 struck as a fixed-viewport
 * prototype affordance.
 *
 * ⇒ WHAT THIS CHAIN DOES DELIVER, and why it is still worth every line: the
 * panel FILLS the arena band (measured: positions panel 953 == arena 953, and
 * 1189 == 1189 under the control) instead of sitting at content height, and the
 * scroll container is correctly wired the moment any ancestor ever becomes
 * definite. The `<thead>` is `sticky`, so the column-header row is already held
 * out of that scroll for when it engages.
 * ⛔ DO NOT "FIX" THE MISSING SCROLL BY ADDING `h-*` ANYWHERE ON THIS CHAIN. The
 * A1 assertion below exists to stop exactly that, and it is the whole reason the
 * forbidden set is asymmetric with `min-h-0`.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no `calc()`, no `100vh`, no percentage height and no Tailwind
 * utility, so a render test structurally cannot see any of this.
 * `discovery-height-chain.test.ts:19-24` states the same limit for the same
 * reason. Resolved geometry is proven in a browser against compiled CSS — which
 * is not a thing CI does. This file proves the DECLARATIONS are all present;
 * the browser proves they compose.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const CONTAINER = "src/components/shell/PageContainer.tsx";
const PAGE = "src/app/(public)/u/[pseudonym]/page.tsx";
const POSITIONS = "src/components/profile/PositionsTable.tsx";
const ARGUMENTS = "src/components/profile/ArgumentList.tsx";

/** The className on the profile's `<PageContainer>` tag, as written on disk. */
function containerExtras(source: string): string {
	// No `s` flag — tsconfig targets ES2017 (TS1501), and `[^>]*` already spans
	// newlines, which is what a multi-line call site needs. Verbatim from
	// `page-container.test.ts:196-199`, deliberately: two files reading the same
	// tag must read it the same way or they can disagree about what is on disk.
	const tag = /<PageContainer\b[^>]*>/.exec(source);
	if (!tag) {
		throw new Error(`${PAGE}: no <PageContainer> tag found.`);
	}
	const extras = /className="([^"]*)"/.exec(tag[0])?.[1];
	if (extras === undefined) {
		throw new Error(`${PAGE}: the <PageContainer> tag carries no className.`);
	}
	return extras;
}

/** The literal className of a band, by its `data-testid`. */
function bandClasses(source: string, testid: string): string[] {
	const m = new RegExp(`"${testid}"\\s+className="([^"]*)"`).exec(source);
	if (!m?.[1]) {
		throw new Error(
			`${PAGE}: no band with data-testid="${testid}" and a literal className. ` +
				`If the two-band frame was restructured, re-derive this chain rather ` +
				`than deleting the guard.`,
		);
	}
	return m[1].split(/\s+/).filter(Boolean);
}

/**
 * ⛔ THE FORBIDDEN SET, and it is NOT symmetrical with `min-h-0`.
 *
 * A FIXED height clips: content taller than the box is simply lost, with no
 * scroll and no overflow. RULED A1 forbids it on this chain outright, at every
 * node, and the mockup's `overflow:hidden` on html/body was struck as a
 * fixed-viewport prototype affordance (recon A-5). `min-h-0` is the opposite —
 * it removes a FLOOR so a node can shrink and hand the overflow to a scroll
 * container — and is REQUIRED below, not forbidden.
 */
const A1_FORBIDDEN = [/^h-screen$/, /^h-dvh$/, /^h-full$/, /^h-\[/];

/** The class list of a node in one of the two panel files, by `data-testid`. */
function panelClasses(source: string, file: string, testid: string): string[] {
	const m = new RegExp(
		`"${testid}"[\\s\\S]{0,400}?className=(?:"([^"]*)"|\`([^\`]*)\`)`,
	).exec(source);
	const cls = m?.[1] ?? m?.[2];
	if (!cls) {
		throw new Error(
			`${file}: no node with data-testid="${testid}" and a readable className. ` +
				`If the panel was restructured, re-derive the chain rather than ` +
				deletingHint,
		);
	}
	return cls.split(/\s+/).filter(Boolean);
}
const deletingHint = "deleting this guard.";

/**
 * EVERY LINK IN THE CHAIN, as (name, classes, required classes). The table IS
 * the assertion: adding a node to the chain means adding a row here, which is
 * how a new link stays visible instead of being trusted.
 */
function chainLinks(): Array<{
	name: string;
	classes: string[];
	needs: string[];
}> {
	const page = read(PAGE);
	const pos = read(POSITIONS);
	const arg = read(ARGUMENTS);
	return [
		{
			name: "PageContainer call site",
			classes: containerExtras(page).split(/\s+/),
			needs: ["flex-1", "min-h-0", "flex-col"],
		},
		{
			name: "arena band",
			classes: bandClasses(page, "profile-arena"),
			needs: ["flex-1", "min-h-0"],
		},
		{
			name: "positions panel",
			classes: panelClasses(pos, POSITIONS, "positions-panel"),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "positions panel body",
			classes: panelClasses(pos, POSITIONS, "positions-panel-body"),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
		{
			name: "arguments panel",
			classes: panelClasses(arg, ARGUMENTS, "arguments-panel"),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "arguments panel body",
			classes: panelClasses(arg, ARGUMENTS, "arguments-panel-body"),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
	];
}

describe("profile height chain — every link, asserted by name", () => {
	it("profile-height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded N1/H-1 failure mode in this directory.
		const links = chainLinks();
		expect(links.length).toBe(6);
		for (const l of links) {
			expect(
				l.classes.length,
				`${l.name} resolved to no classes`,
			).toBeGreaterThan(0);
		}
		// The SOURCE of the chain, in a file this task may not edit. If the floor
		// stops being a `min-h-*` calc there is no slack to pass on at all.
		expect(read(LAYOUT)).toContain("min-h-[calc(100vh-");
		expect(read(CONTAINER)).toContain("wide:");
	});

	it("profile-height-chain::every-link-declares-what-it-owes-the-chain", () => {
		// ⚠ THE WHOLE POINT. Drop any one of these and NOTHING errors — the panel
		// quietly reverts to content height and the scroll never engages.
		for (const { name, classes, needs } of chainLinks()) {
			for (const c of needs) {
				expect(
					classes,
					`HEIGHT CHAIN BROKEN AT "${name}": it must declare \`${c}\`. ` +
						`Without it the chain stops here — the positions panel reverts to ` +
						`content height, row 3's rows stop scrolling inside the panel, and ` +
						`nothing else fails. Got: ${classes.join(" ")}`,
				).toContain(c);
			}
		}
	});

	it("profile-height-chain::the-headzone-does-NOT-grow", () => {
		// Only the arena divides the leftover. The mockup's headzone is
		// `flex:0 0 188px` — fixed — and here it is content-height. If it grew too,
		// the two bands would fight for the same slack and the arena would get an
		// arbitrary share of it.
		expect(bandClasses(read(PAGE), "profile-headzone")).not.toContain("flex-1");
	});

	it("profile-height-chain::no-clipping-utility-on-the-page-level-nodes", () => {
		// RULED A1 (`(public)/layout.tsx:103-107`), enforced on the nodes it
		// governs: the floor lets the page GROW and SCROLL when content exceeds
		// the viewport instead of clipping it. The mockup's `overflow:hidden` on
		// html/body is a fixed-viewport prototype affordance and is deliberately
		// NOT adopted (recon A-5).
		const page = read(PAGE);
		const nodes: Array<[string, string[]]> = [
			["the PageContainer call site", containerExtras(page).split(/\s+/)],
			["the headzone band", bandClasses(page, "profile-headzone")],
			["the arena band", bandClasses(page, "profile-arena")],
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

	it("profile-height-chain::POSITIVE-CONTROL-each-check-reddens-on-a-real-mutation", () => {
		// ⚠ PROOF BY REVERSAL. A guard that has only ever been run against a
		// passing tree is indistinguishable from one that cannot fail. Each
		// mutation below runs the REAL predicate over the REAL file contents.
		const page = read(PAGE);
		const pos = read(POSITIONS);

		// 1. A link drops `min-h-0` — the silent break this whole file exists for.
		const arena = bandClasses(page, "profile-arena");
		expect(arena).toContain("min-h-0");
		expect(arena.filter((c) => c !== "min-h-0")).not.toContain("min-h-0");

		// 2. The scroll container loses its overflow — the panel would then grow
		//    instead of scrolling, with no error anywhere.
		const body = panelClasses(pos, POSITIONS, "positions-panel-body");
		expect(body).toContain("overflow-y-auto");
		expect(body.filter((c) => c !== "overflow-y-auto")).not.toContain(
			"overflow-y-auto",
		);

		// 3. A band gains a CLIPPING utility. Same A1 predicate the assertion
		//    below uses, so the two cannot drift apart.
		const arenaClass = arena.join(" ");
		const clipped = page.replace(
			`"profile-arena"\n\t\t\t\tclassName="${arenaClass}"`,
			`"profile-arena"\n\t\t\t\tclassName="h-screen ${arenaClass}"`,
		);
		expect(
			A1_FORBIDDEN.some((re) =>
				bandClasses(clipped, "profile-arena").some((c) => re.test(c)),
			),
			"the h-screen mutation did not take — the control is inert",
		).toBe(true);
		// …and the unmutated band does NOT trip it, so the check discriminates.
		expect(A1_FORBIDDEN.some((re) => arena.some((c) => re.test(c)))).toBe(
			false,
		);

		// 4. The extractors THROW rather than silently returning nothing when the
		//    node they name is gone — a guard that reports a restructure, not one
		//    that passes vacuously through it.
		expect(() => containerExtras("export default function P() {}")).toThrow();
		expect(() => bandClasses(page, "profile-nonexistent-band")).toThrow();
		expect(() => panelClasses(pos, POSITIONS, "no-such-node")).toThrow();
	});
});
