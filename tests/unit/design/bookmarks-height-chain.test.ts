import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · BOOKMARKS round 3 · C7 — THE HEIGHT CHAIN, asserted node by
 * node, and the ONE-SCREEN BOUND that closes it.
 *
 * WHAT THIS GUARD IS FOR. `/bookmarks` now occupies exactly the viewport below
 * the header at `lg`+, with both arena panels scrolling inside themselves. That
 * needs a DEFINITE height, and a definite height is not a property of any one
 * node — it is a chain, and it is only as good as its weakest link. Break ANY
 * link and nothing visibly errors: the panel silently reverts to content height,
 * the scroll never engages, the page grows a scrollbar, and the surface looks
 * merely "a bit long" rather than broken. No type error, no console warning, and
 * no render test that can see it.
 *
 * THE CHAIN, and what each node contributes:
 *
 *   <main>          min-h-[calc(100vh-60px-2px)] flex-1 flex-col   ← the SOURCE
 *                   (owned by `(public)/layout.tsx`, out of scope here)
 *   PageContainer   flex-1 min-h-0 flex-col                   ← below `lg`
 *                   + lg:h-[calc(100vh-60px-2px)] lg:flex-none ← THE BOUND
 *   headzone        lg:h-[256px], no flex-1     ← declared, does NOT grow
 *   arena band      flex-1 min-h-0              ← takes ALL the leftover
 *   both panels     min-h-0 flex-col            ← may be shorter than content
 *   both bodies     flex-1 min-h-0 overflow-y-auto ← where the scroll happens
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible. A flex
 * item's automatic minimum size is its CONTENT, so without `min-h-0` a node
 * refuses to shrink below what it holds — the arena pushes past the container,
 * the panel grows instead of scrolling, and the page just gets taller.
 *
 * ⚠⚠ THE PROPERTY THIS PROTECTS IS NOT "NO HEIGHT" — IT IS "NOTHING IS LOST".
 * A bound WITH a scroll container is not a clip: content past the fold is
 * REACHED BY SCROLLING. A bound WITHOUT one is a clip, and that is what stays
 * forbidden. This mirrors `profile-height-chain.test.ts`'s re-derivation, on the
 * surface that copied its chain.
 * ⛔ AN UNPREFIXED `h-*` REMAINS FORBIDDEN: below `lg` the two bands stack, the
 * arena cannot fit a short viewport, and the page must stay free to GROW AND
 * SCROLL. The bound is `lg:`-scoped for exactly that reason.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no `calc()`, no `100vh`, no percentage height and no Tailwind
 * utility, so a render test structurally cannot see any of this. Resolved
 * geometry is proven in a browser against compiled CSS — which is not a thing CI
 * does. This file proves the DECLARATIONS are all present; the browser proves
 * they compose.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const PAGE = "src/app/(public)/bookmarks/page.tsx";
const TABLE = "src/components/bookmarks/BookmarksTable.tsx";
const REPLICA = "src/components/bookmarks/BookmarkReplica.tsx";

/** The className on the route's `<PageContainer>` tag, as written on disk. */
function containerExtras(source: string): string {
	// No `s` flag — tsconfig targets ES2017 (TS1501), and `[^>]*` already spans
	// newlines, which is what a multi-line call site needs.
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

/** The literal className of a node, by its `data-testid`. */
function classesOf(source: string, file: string, testid: string): string[] {
	const m = new RegExp(
		`"${testid}"[\\s\\S]{0,400}?className=(?:"([^"]*)"|\`([^\`]*)\`)`,
	).exec(source);
	const cls = m?.[1] ?? m?.[2];
	if (!cls) {
		throw new Error(
			`${file}: no node with data-testid="${testid}" and a readable className. ` +
				`If the frame was restructured, RE-DERIVE this chain rather than ` +
				`deleting the guard.`,
		);
	}
	return cls.split(/\s+/).filter(Boolean);
}

/** ⛔ A FIXED, UNPREFIXED height clips the stacked layout below `lg`. */
const UNPREFIXED_HEIGHT = [/^h-screen$/, /^h-dvh$/, /^h-full$/, /^h-\[/];

/** A clipping overflow on the vertical path — what turns a bound into a clip. */
const CLIPPING_OVERFLOW = /^(overflow|overflow-y)-(hidden|clip)$/;

/**
 * The mockup's `.colhead{min-height:52px}` (`surface_profile_v1_0.html:228`).
 * ⚠ THE SAME LITERAL `profile-height-chain.test.ts` PINS, and that is the point:
 * `/bookmarks` IS that mockup in its `sub:'bookmark'` arm (`:765-771`), so the
 * two surfaces' four panel heads take one floor in one commit. Sizing one
 * surface and then re-sizing the other is the drift §3 forbids by name.
 */
const HEAD_FLOOR = "min-h-[52px]";

/** Every link, as (name, classes, required). The table IS the assertion. */
function chainLinks(): Array<{
	name: string;
	classes: string[];
	needs: string[];
}> {
	const page = read(PAGE);
	return [
		{
			name: "PageContainer call site",
			classes: containerExtras(page).split(/\s+/),
			needs: ["flex-1", "min-h-0", "flex-col"],
		},
		{
			name: "arena band",
			classes: classesOf(page, PAGE, "bookmarks-arena"),
			needs: ["flex-1", "min-h-0"],
		},
		{
			name: "bookmarks panel",
			classes: classesOf(read(TABLE), TABLE, "bookmarks-panel"),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "bookmarks panel body",
			classes: classesOf(read(TABLE), TABLE, "bookmarks-panel-body"),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
		{
			name: "replica panel",
			classes: classesOf(read(REPLICA), REPLICA, "bookmarks-replica-panel"),
			needs: ["min-h-0", "flex-col"],
		},
		{
			name: "replica panel body",
			classes: classesOf(
				read(REPLICA),
				REPLICA,
				"bookmarks-replica-panel-body",
			),
			needs: ["flex-1", "min-h-0", "overflow-y-auto"],
		},
	];
}

describe("bookmarks height chain — every link, asserted by name", () => {
	it("bookmarks-height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded failure mode in this directory.
		const links = chainLinks();
		expect(links.length).toBe(6);
		for (const l of links) {
			expect(
				l.classes.length,
				`${l.name} resolved to no classes`,
			).toBeGreaterThan(0);
		}
		// The SOURCE of the chain, in a file this task may not edit.
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
						`height, the rows stop scrolling inside it, and nothing else ` +
						`fails. Got: ${classes.join(" ")}`,
				).toContain(c);
			}
		}
	});

	it("bookmarks-height-chain::the-headzone-does-NOT-grow", () => {
		// Only the arena divides the leftover. If the band grew too, the two would
		// fight for the same slack and the arena would get an arbitrary share.
		expect(classesOf(read(PAGE), PAGE, "bookmarks-headzone")).not.toContain(
			"flex-1",
		);
	});

	it("bookmarks-height-chain::the-ONE-SCREEN-bound-is-declared-at-lg-and-only-at-lg", () => {
		// The container is bounded against the SAME figure `<main>`'s floor uses,
		// so the `min-h` is satisfied exactly and main never grows.
		// ⛔ `lg:flex-none` IS LOAD-BEARING: `flex-1` is `flex: 1 1 0%`, and a 0%
		// basis WINS over `height` on the main axis — Profile measured the page
		// still scrolling (document 1577 against a 725 viewport) with the height
		// applied and `flex-1` still on.
		const page = read(PAGE);
		const extras = containerExtras(page).split(/\s+/);
		expect(
			extras,
			"C7: the container declares no one-screen bound, so `<main>` grows with " +
				"its content and the page scrolls.",
		).toContain("lg:h-[calc(100vh-60px-2px)]");
		expect(
			extras,
			"C7: the bound is inert without `lg:flex-none` — `flex-1`'s 0% basis " +
				"wins over `height` on the main axis.",
		).toContain("lg:flex-none");
		// …and the figure is byte-identical to the floor the shell already sets.
		expect(
			read(LAYOUT),
			"C7: the container's bound and `<main>`'s floor have drifted apart. " +
				"They must be the same figure or main either grows or is starved.",
		).toContain("min-h-[calc(100vh-60px-2px)]");
		// The headzone's declared height — the other half of what makes the arena
		// definite. ⚠ 256 is Profile's DERIVED worst case, and this surface renders
		// the SAME IdentityCard with the SAME six tiles.
		expect(classesOf(page, PAGE, "bookmarks-headzone")).toContain(
			"lg:h-[256px]",
		);
	});

	it("bookmarks-height-chain::no-UNPREFIXED-height-so-the-stacked-layout-still-grows", () => {
		// ⚠ Below `lg` the bands stack and the page must GROW AND SCROLL — the
		// arena cannot fit a short viewport there. An UNPREFIXED `h-*` on any of
		// these three would cap that layout too, and THAT is a clip.
		const page = read(PAGE);
		const nodes: Array<[string, string[]]> = [
			["the PageContainer call site", containerExtras(page).split(/\s+/)],
			["the headzone band", classesOf(page, PAGE, "bookmarks-headzone")],
			["the arena band", classesOf(page, PAGE, "bookmarks-arena")],
		];
		for (const [name, classes] of nodes) {
			for (const forbidden of UNPREFIXED_HEIGHT) {
				const hit = classes.find((c) => forbidden.test(c));
				expect(
					hit,
					`${name} declares \`${hit}\` UNPREFIXED, which caps the STACKED ` +
						`layout below \`lg\` as well — where nothing scrolls internally ` +
						`and the page must be free to grow.`,
				).toBeUndefined();
			}
		}
	});

	it("bookmarks-height-chain::every-bounded-region-hands-overflow-to-a-SCROLL-container", () => {
		// ⚠ THE PROPERTY THE BAN ACTUALLY PROTECTS. A bound with a scroll is not a
		// clip; a bound without one is.
		const page = read(PAGE);
		const table = read(TABLE);
		const replica = read(REPLICA);
		const nodes: Array<[string, string[]]> = [
			["the PageContainer call site", containerExtras(page).split(/\s+/)],
			["the headzone band", classesOf(page, PAGE, "bookmarks-headzone")],
			["the arena band", classesOf(page, PAGE, "bookmarks-arena")],
			[
				"the bookmarks panel body",
				classesOf(table, TABLE, "bookmarks-panel-body"),
			],
			[
				"the replica panel body",
				classesOf(replica, REPLICA, "bookmarks-replica-panel-body"),
			],
		];
		for (const [name, classes] of nodes) {
			const hit = classes.find((c) => CLIPPING_OVERFLOW.test(c));
			expect(
				hit,
				`C7: ${name} declares \`${hit}\`. With the chain BOUNDED, a clipping ` +
					`overflow makes content unreachable — content past the fold must be ` +
					`reached by SCROLLING.`,
			).toBeUndefined();
		}
		// The two scroll containers, by name — what "nothing is lost" rests on.
		expect(classesOf(table, TABLE, "bookmarks-panel-body")).toContain(
			"overflow-y-auto",
		);
		expect(
			classesOf(replica, REPLICA, "bookmarks-replica-panel-body"),
		).toContain("overflow-y-auto");
		// …and the arena must be able to SHRINK to the bound rather than push past.
		const arena = classesOf(page, PAGE, "bookmarks-arena");
		expect(arena).toContain("flex-1");
		expect(arena).toContain("min-h-0");
	});

	it("bookmarks-height-chain::both-panel-heads-share-ONE-floor-so-the-bodies-start-level", () => {
		// ⚠⚠ THE LAW. The two arena panels sit side by side, so their heads must be
		// one height or their scrolling bodies begin on different lines. The mockup
		// pins it with `.colhead{min-height:52px}` on BOTH slots (`:227-228`).
		//
		// ⚠ MEASURED ON THIS SURFACE, NOT INHERITED FROM PROFILE. A session was
		// available this round, so `/bookmarks` was loaded signed-in at a pinned
		// 1440×777 and its own split measured: list head **51**, replica head
		// **41**, bodies at y418 vs y408. (The previous round could only infer this
		// surface from Profile's identical class strings; this one measured it.)
		const heads = [
			{
				testid: "bookmarks-panel-head",
				classes: classesOf(read(TABLE), TABLE, "bookmarks-panel-head"),
			},
			{
				testid: "bookmarks-replica-panel-head",
				classes: classesOf(
					read(REPLICA),
					REPLICA,
					"bookmarks-replica-panel-head",
				),
			},
		];
		const floorsOf = (cs: string[]) =>
			cs.filter((c) => /^min-h-/.test(c)).join(" ");

		for (const h of heads) {
			expect(
				h.classes,
				`${h.testid} lost the \`.colhead\` floor — the two panel bodies will ` +
					`start on different lines.`,
			).toContain(HEAD_FLOOR);
		}
		expect(new Set(heads.map((h) => floorsOf(h.classes))).size).toBe(1);
		for (const h of heads) {
			expect(
				UNPREFIXED_HEIGHT.some((re) => h.classes.some((c) => re.test(c))),
				`${h.testid} declares a fixed height; a head must only ever be floored`,
			).toBe(false);
		}

		// ⚠ POSITIVE CONTROLS, INLINE — each runs the REAL predicate.
		expect(heads[0].classes.filter((c) => c !== HEAD_FLOOR)).not.toContain(
			HEAD_FLOOR,
		);
		expect(
			new Set([
				floorsOf(heads[0].classes),
				floorsOf(
					heads[1].classes.map((c) => (c === HEAD_FLOOR ? "min-h-[40px]" : c)),
				),
			]).size,
			"the drift mutation did not take — check 2 is inert",
		).toBe(2);
		expect(
			UNPREFIXED_HEIGHT.some((re) =>
				heads[0].classes.concat("h-[52px]").some((c) => re.test(c)),
			),
			"the fixed-height mutation did not take — check 3 is inert",
		).toBe(true);
	});

	it("bookmarks-height-chain::POSITIVE-CONTROL-each-check-reddens-on-a-real-mutation", () => {
		// ⚠ PROOF BY REVERSAL. A guard only ever run against a passing tree is
		// indistinguishable from one that cannot fail. Each mutation runs the REAL
		// predicate over the REAL file contents.
		const page = read(PAGE);
		const table = read(TABLE);

		// 1. A link drops `min-h-0` — the silent break this file exists for.
		const arena = classesOf(page, PAGE, "bookmarks-arena");
		expect(arena).toContain("min-h-0");
		expect(arena.filter((c) => c !== "min-h-0")).not.toContain("min-h-0");

		// 2. The scroll container loses its overflow — the panel would then grow
		//    instead of scrolling, with no error anywhere.
		const body = classesOf(table, TABLE, "bookmarks-panel-body");
		expect(body).toContain("overflow-y-auto");
		expect(body.filter((c) => c !== "overflow-y-auto")).not.toContain(
			"overflow-y-auto",
		);

		// 3. An unprefixed clipping height on a band trips the predicate, and the
		//    unmutated band does NOT — so the check discriminates.
		expect(UNPREFIXED_HEIGHT.some((re) => re.test("h-screen"))).toBe(true);
		expect(UNPREFIXED_HEIGHT.some((re) => arena.some((c) => re.test(c)))).toBe(
			false,
		);
		// …and the `lg:`-prefixed bound is deliberately NOT caught by it.
		expect(UNPREFIXED_HEIGHT.some((re) => re.test("lg:h-[256px]"))).toBe(false);

		// 4. A clipping overflow trips its predicate.
		expect(CLIPPING_OVERFLOW.test("overflow-hidden")).toBe(true);
		expect(CLIPPING_OVERFLOW.test("overflow-y-auto")).toBe(false);

		// 5. The extractors THROW rather than silently returning nothing when the
		//    node they name is gone — a guard that reports a restructure.
		expect(() => containerExtras("export default function P() {}")).toThrow();
		expect(() => classesOf(page, PAGE, "no-such-band")).toThrow();
	});
});
