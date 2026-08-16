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
 *   PageContainer     flex-1 min-h-0 flex-col                   ← below `lg`
 *                     + lg:h-[calc(100vh-60px-2px)] lg:flex-none ← THE BOUND (R5 A)
 *   headzone band     lg:h-[256px], no flex-1       ← declared, does NOT grow (R5 B)
 *   arena band        flex-1 min-h-0                ← takes ALL the leftover
 *   both panels       min-h-0 flex-col              ← may be shorter than content
 *   both panel bodies flex-1 min-h-0 overflow-y-auto ← where the scroll happens
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible. A flex
 * item's automatic minimum size is its CONTENT, so without `min-h-0` a node
 * refuses to shrink below what it holds — the arena pushes past the container,
 * the panel grows instead of scrolling, and the page just gets taller. Every
 * `min-h-0` below is therefore pinned BY NAME on the node that needs it.
 *
 * ⚠⚠ TWO SCOPES, TWO RULES — AND AT ROUND 5 THE OUTER ONE MOVED.
 * `(public)/layout.tsx` says "⛔ `min-h-*`, never `h-*`, and NO `min-h-0`
 * anywhere in the chain", so the page can GROW AND SCROLL rather than clip.
 * That still governs every OTHER `(public)` surface and it is untouched — the
 * layout file was not edited. What changed is this ROUTE: the founder ruled the
 * profile a ONE-SCREEN design, so the profile's own container is bounded at
 * `lg`+ against the same figure the floor uses, and `<main>`'s `min-h` is
 * satisfied exactly instead of being exceeded.
 *
 * ⛔⛔ WHAT THE CHAIN COULD NOT DELIVER BEFORE ROUND 5 — KEPT, BECAUSE IT IS THE
 * MEASUREMENT THAT EXPLAINS WHY THE BOUND EXISTS. Row 3 asks that the fourth
 * position row and later be reached by SCROLLING INSIDE the panel. Under a
 * floor-only chain that is unreachable, and it is a contradiction rather than a
 * wiring bug:
 *
 *   `<main>`'s height is `max(floor, content)`. Panel-internal scrolling needs
 *   `arena height < arena content`, which needs `main < content`. But
 *   `main = max(floor, content) >= content`. The two cannot both hold.
 *
 * PROVEN BY CONTROL, not inferred: with the chain fully wired at 1440, injecting
 * twelve extra rows moved `main` 1383 -> 1619 and the panel body's CLIENT height
 * 901 -> 1136, while `scrollHeight > clientHeight` stayed FALSE throughout. The
 * page grew; the panel never scrolled.
 *
 * ✅ ROUND 5 item A RESOLVED IT, and by the only lever that ever could: a
 * DEFINITE height on an ancestor. `lg:h-[calc(100vh-60px-2px)] lg:flex-none` on
 * the container makes `main` exactly the viewport below the header, so the arena
 * is definite, both panels get a real height, and the overflow goes to their
 * `overflow-y-auto` bodies. Measured after: page does NOT scroll at `lg`+
 * (document 725 == viewport 725), and at 1440 × {1080, 768, 600, 500, 360} ZERO
 * position rows and ZERO arguments are unreachable.
 * ⛔ THE OLD BLANKET BAN ("never `h-*` anywhere on this chain") IS SUPERSEDED and
 * has been re-derived onto the property it actually protected — see the
 * FORBIDDEN-SET docblock below. An UNPREFIXED `h-*` is still forbidden, because
 * below `lg` the bands stack and the page must still be free to grow.
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
 * ⛔ THE FORBIDDEN SET — RE-DERIVED AT ROUND 5, NOT DELETED.
 *
 * WHAT IT USED TO SAY. "A FIXED height clips: content taller than the box is
 * simply lost, with no scroll and no overflow. RULED A1 forbids it on this
 * chain outright, at every node." That banned `h-*` unconditionally, and the
 * mockup's `overflow:hidden` on html/body was struck as a fixed-viewport
 * prototype affordance (recon A-5).
 *
 * WHAT CHANGED. The founder ruled the profile a ONE-SCREEN design: the route
 * occupies exactly the viewport below the header, and every region that can
 * overflow scrolls inside itself. That reverses A-5 FOR THIS SURFACE, so the
 * chain is now deliberately BOUNDED at two nodes — the container at
 * `lg:h-[calc(100vh-60px-2px)]` and the headzone at `lg:h-[256px]`.
 *
 * ⚠⚠ THE PROPERTY A1 ACTUALLY PROTECTS IS NOT "NO HEIGHT" — IT IS "NOTHING IS
 * LOST". A bound with a scroll container is not a clip: the content past the
 * fold is REACHED BY SCROLLING. A bound WITHOUT one is a clip, and that is what
 * must stay forbidden. So this file now asserts the property directly:
 *
 *   ⑴ the two bounds are declared, BY NAME, and are `lg:`-scoped — below `lg`
 *     the arena stacks and the page must still grow and scroll;
 *   ⑵ the container's figure is byte-identical to `<main>`'s own floor, so the
 *     `min-h` is satisfied exactly and main never grows;
 *   ⑶ every bounded region hands its overflow to a scroll container — both
 *     panel bodies keep `overflow-y-auto`, and the arena keeps `flex-1 min-h-0`
 *     so it can shrink to the bound instead of pushing past it;
 *   ⑷ NOTHING on the chain declares a clipping overflow.
 *
 * ⛔ THE UNPREFIXED BAN SURVIVES, and it is the half that still does A1's
 * original job: an unprefixed `h-*` would cap the STACKED layout below `lg`,
 * where the identity card sits above a full-width graph and there is no
 * one-screen promise to keep. `min-h-0` remains REQUIRED, not forbidden — it
 * removes a FLOOR so a node can shrink and hand overflow to a scroll container.
 *
 * ⚠ Resolved geometry is proven in a browser, not here: at 1440 × {1080, 768,
 * 600, 500, 360} the page does not scroll at `lg`+ and ZERO position rows and
 * ZERO arguments are unreachable. jsdom performs no layout and can see none of
 * that; this file proves the DECLARATIONS compose.
 */
const A1_FORBIDDEN = [/^h-screen$/, /^h-dvh$/, /^h-full$/, /^h-\[/];

/** A clipping overflow on the vertical path — the thing that turns a bound
 * into a clip. `overflow-y-auto` and `overflow-hidden` are NOT interchangeable
 * here, and only one of them keeps the content reachable. */
const CLIPPING_OVERFLOW = /^(overflow|overflow-y)-(hidden|clip)$/;

/**
 * The mockup's `.colhead{min-height:52px}` (`surface_profile_v1_0.html:228`),
 * carried as a LITERAL because the mockup states it as one. It is what makes
 * the two side-by-side panel heads the same height, and therefore what makes
 * their two scrolling bodies start on the same line. ⛔ One string, asserted on
 * all FOUR heads across this file and `bookmarks-height-chain.test.ts`, so the
 * two surfaces cannot be sized one after the other (§6).
 */
const HEAD_FLOOR = "min-h-[52px]";

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

	it("profile-height-chain::no-UNPREFIXED-height-so-the-stacked-layout-still-grows", () => {
		// ⚠ THE HALF OF RULED A1 THAT SURVIVES ROUND 5 UNCHANGED. Below `lg` the
		// two bands stack to one column and the page must GROW AND SCROLL — the
		// arena cannot fit a short viewport there, and the mockup (a fixed-desktop
		// prototype) declares no breakpoint at all. An UNPREFIXED `h-*` on any of
		// these three nodes would cap that layout too, and THAT is a clip.
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
					`RULED A1: ${name} declares \`${hit}\` UNPREFIXED, which caps the ` +
						`STACKED layout below \`lg\` as well — where nothing scrolls ` +
						`internally and the page must be free to grow. The one-screen ` +
						`bound is \`lg:\`-scoped for exactly this reason.`,
				).toBeUndefined();
			}
		}
	});

	it("profile-height-chain::the-ONE-SCREEN-bound-is-declared-at-lg-and-only-at-lg", () => {
		// ⑴ + ⑵ of the re-derivation. The container is bounded against the SAME
		// figure `<main>`'s floor uses, so the `min-h` is satisfied exactly and
		// main never grows: header 62 + main (100vh − 62) = 100vh.
		// ⛔ `lg:flex-none` IS LOAD-BEARING AND WAS MEASURED. `flex-1` is
		// `flex: 1 1 0%`, and a 0% basis WINS over `height` on the main axis — with
		// the height applied and `flex-1` still on, the page STILL scrolled
		// (document 1577 against a 725 viewport). With `flex:none` the basis
		// returns to `auto`, the height binds, and document == viewport.
		const page = read(PAGE);
		const extras = containerExtras(page).split(/\s+/);
		expect(
			extras,
			"item A: the container declares no one-screen bound, so `<main>` grows " +
				"with its content and the page scrolls.",
		).toContain("lg:h-[calc(100vh-60px-2px)]");
		expect(
			extras,
			"item A: the bound is inert without `lg:flex-none` — `flex-1`'s 0% " +
				"basis wins over `height` on the main axis. MEASURED: page still " +
				"scrolled at 1577 against a 725 viewport.",
		).toContain("lg:flex-none");
		// …and the figure is byte-identical to the floor the shell already sets.
		expect(
			read(LAYOUT),
			"item A: the container's bound and `<main>`'s floor have drifted apart. " +
				"They must be the same figure or main either grows or is starved.",
		).toContain("min-h-[calc(100vh-60px-2px)]");
		// The headzone's declared height, pinned here too — it is the other half of
		// what makes the arena's height definite.
		expect(bandClasses(page, "profile-headzone")).toContain("lg:h-[256px]");
	});

	it("profile-height-chain::every-bounded-region-hands-overflow-to-a-SCROLL-container", () => {
		// ⑶ + ⑷ — THE PROPERTY A1 ACTUALLY PROTECTS. A bound with a scroll is not
		// a clip; a bound without one is. So: no clipping overflow anywhere on the
		// vertical path, and both panel bodies keep their scroll container.
		const page = read(PAGE);
		const pos = read(POSITIONS);
		const arg = read(ARGUMENTS);
		const nodes: Array<[string, string[]]> = [
			["the PageContainer call site", containerExtras(page).split(/\s+/)],
			["the headzone band", bandClasses(page, "profile-headzone")],
			["the arena band", bandClasses(page, "profile-arena")],
			[
				"the positions panel body",
				panelClasses(pos, POSITIONS, "positions-panel-body"),
			],
			[
				"the arguments panel body",
				panelClasses(arg, ARGUMENTS, "arguments-panel-body"),
			],
		];
		for (const [name, classes] of nodes) {
			const hit = classes.find((c) => CLIPPING_OVERFLOW.test(c));
			expect(
				hit,
				`item A: ${name} declares \`${hit}\`. With the chain BOUNDED, a ` +
					`clipping overflow makes content unreachable — content past the ` +
					`fold must be reached by SCROLLING. Measured at 1440 × {1080, 768, ` +
					`600, 500, 360}: zero rows and zero arguments unreachable.`,
			).toBeUndefined();
		}
		// The two scroll containers, by name — these are what "nothing is lost"
		// rests on once the page can no longer grow.
		expect(panelClasses(pos, POSITIONS, "positions-panel-body")).toContain(
			"overflow-y-auto",
		);
		expect(panelClasses(arg, ARGUMENTS, "arguments-panel-body")).toContain(
			"overflow-y-auto",
		);
		// …and the arena must still be able to SHRINK to the bound rather than
		// pushing past it, or the bound would simply overflow.
		const arena = bandClasses(page, "profile-arena");
		expect(arena).toContain("flex-1");
		expect(arena).toContain("min-h-0");
	});

	it("profile-height-chain::the-THREE-ROW-WINDOW-bounds-the-panel-without-clipping", () => {
		// ⚠⚠ ROUND 4 item 8 ADDS A SECOND, PANEL-SCOPED BOUND, and this file is
		// where it has to be recorded or the next reader will meet an inline
		// `max-height` on the very chain whose docblock says heights are forbidden.
		//
		// THE TWO SCOPES ARE STILL TWO. RULED A1 governs the PAGE-LEVEL column so
		// the page GROWS AND SCROLLS instead of clipping — asserted unchanged
		// above, on the container and the two bands. The window is the other
		// scope: it caps the positions panel BODY, which is a scroll container, so
		// row four is reached by SCROLLING rather than lost. A bound with a scroll
		// is not a clip; that is the whole distinction, and it is why the cap is
		// `max-height` and never `height`.
		//
		// ⛔ THE MOCKUP'S OWN CSS RULE IS UNUSABLE HERE and the reason is measured,
		// not asserted: `.rows .prow{flex:0 0 calc(100% / 3)}` (`:273`) needs a
		// DEFINITE panel height, which its fixed-100vh page has and this one does
		// not. Measured at 1440, the arena is 1187 and the panel body 1135, so a
		// one-third basis renders three rows at ~378px each. The mechanism shipped
		// is the mockup's own EARLIER one, from its changelog: v0.11 — "the rows
		// container is height-capped to exactly the first three rows (JS measures
		// the 3rd row's bottom) … No row content is clipped."
		const pos = read(POSITIONS);
		// It is a BOUND…
		expect(pos).toContain("style.maxHeight");
		// …never a fixed height, on the node the chain hands the scroll to.
		expect(pos).not.toContain("style.height");
		// …and the scroll container it caps still declares its overflow, so the
		// capped rows remain reachable.
		expect(
			panelClasses(pos, POSITIONS, "positions-panel-body"),
			"the three-row window caps a container that no longer scrolls — that " +
				"is a CLIP, and RULED A1 forbids it.",
		).toContain("overflow-y-auto");
		// The window is the founder's three, named once.
		expect(/const ROW_WINDOW = 3;/.test(pos)).toBe(true);
	});

	it("profile-height-chain::both-panel-heads-share-ONE-floor-so-the-bodies-start-level", () => {
		// ⚠⚠ THE LAW THIS ENCODES, and it is a DIMENSION, not a decoration. The
		// two arena panels sit side by side, so their heads must be the same
		// height or their two scrolling bodies begin on different lines. The
		// mockup pins that with `.colhead{min-height:52px}`
		// (`surface_profile_v1_0.html:227-228`) applied to BOTH slots.
		//
		// ⛔ WITHOUT A FLOOR THE SPLIT IS INVISIBLE IN THE CLASS STRINGS, which is
		// why it needs a guard rather than a review. Both heads carry the SAME
		// className; the heights diverged purely on CONTENT — the positions head
		// holds a market filter and a segmented control, the arguments head holds
		// a bare title. Measured at a pinned 1440×777 on live staging: positions
		// head 51px, arguments head 41px, bodies starting at y418 and y408.
		const heads = [
			{
				file: POSITIONS,
				testid: "positions-panel-head",
				classes: panelClasses(
					read(POSITIONS),
					POSITIONS,
					"positions-panel-head",
				),
			},
			{
				file: ARGUMENTS,
				testid: "arguments-panel-head",
				classes: panelClasses(
					read(ARGUMENTS),
					ARGUMENTS,
					"arguments-panel-head",
				),
			},
		];
		const floorsOf = (classes: string[]) =>
			classes.filter((c) => /^min-h-/.test(c)).join(" ");

		// 1. Each head declares the floor.
		for (const h of heads) {
			expect(
				h.classes,
				`${h.testid} lost the \`.colhead\` floor — the two panel bodies will ` +
					`start on different lines. Re-derive the head rather than ` +
					deletingHint,
			).toContain(HEAD_FLOOR);
		}

		// 2. ONE value across both, so they cannot drift to two floors that each
		//    pass check 1 while still leaving the bodies unlevel.
		expect(new Set(heads.map((h) => floorsOf(h.classes))).size).toBe(1);

		// 3. A FLOOR, NEVER A FIXED HEIGHT. `h-[52px]` would also level the two
		//    heads — and would CLIP the moment either gains a control. Same
		//    `A1_FORBIDDEN` predicate the band checks use, so they cannot drift.
		for (const h of heads) {
			expect(
				A1_FORBIDDEN.some((re) => h.classes.some((c) => re.test(c))),
				`${h.testid} declares a fixed height; a head must only ever be floored`,
			).toBe(false);
		}

		// ⚠ POSITIVE CONTROL, INLINE — a guard only ever run against a passing
		// tree is indistinguishable from one that cannot fail (V-2: a negative
		// assertion needs a positive control). Each mutation runs the REAL
		// predicate over the REAL class list.
		//   a. the floor removed → check 1 reddens
		expect(heads[0].classes.filter((c) => c !== HEAD_FLOOR)).not.toContain(
			HEAD_FLOOR,
		);
		//   b. the two floors drift apart → check 2 reddens
		expect(
			new Set([
				floorsOf(heads[0].classes),
				floorsOf(
					heads[1].classes.map((c) => (c === HEAD_FLOOR ? "min-h-[40px]" : c)),
				),
			]).size,
			"the drift mutation did not take — check 2 is inert",
		).toBe(2);
		//   c. a fixed height → check 3 reddens
		expect(
			A1_FORBIDDEN.some((re) =>
				heads[0].classes.concat("h-[52px]").some((c) => re.test(c)),
			),
			"the fixed-height mutation did not take — check 3 is inert",
		).toBe(true);
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
