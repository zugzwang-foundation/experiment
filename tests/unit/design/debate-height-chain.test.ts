import { existsSync, readFileSync } from "node:fs";
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
 *   PageContainer   h-[calc(100dvh-60px-2px)] min-h-0 flex flex-col overflow-hidden
 *                                                     ← ONE SCREEN, declared
 *   headzone band   min-h-0, shrink-0, basis-%, NO flex-1  ← declared, does NOT grow
 *   arena band      flex-1 min-h-0                    ← takes ALL the leftover
 *   pole columns    min-h-0 flex-col                  ← may be shorter than content
 *   column scroll   flex-1 min-h-0 overflow-y-auto    ← THE ONLY SCROLLER
 *                                                       IN *THIS* CHAIN
 *
 * ⚠⚠ RPLY-2 · R1 — NOT the only scroller on the surface any more, one level
 * BELOW this chain: `BetComposer` gained a second, deliberate `overflow-y-auto`
 * region, nested INSIDE whatever `column scroll` renders (a card, a composer —
 * the chain above does not know or care which).
 * `DebateColumn.tsx`'s own docblock is corrected in place for that; this
 * diagram is left naming only the chain it actually asserts node-by-node
 * below, which stops at `column scroll` and never reaches into its children.
 *
 * ⚠⚠ RPLY-3 · R1 — THE EXCEPTION STANDS AND THE ELEMENT MOVED, which is worth
 * a line because "is the claim true again?" was asked explicitly and the answer
 * is no. RPLY-2 put that `overflow-y-auto` on the composer's whole ARGUMENT
 * REGION. R1 rules the money footblock back into the right column — i.e. back
 * INSIDE that region — so a scroller there would once again be able to hide
 * `Đ BET`, the exact defect RPLY-2 hoisted the footblock to avoid. The overflow
 * therefore moved DOWN onto the title/body pair's own wrapper (`.fieldscroll`),
 * whose sibling the footblock is.
 * ⇒ `column scroll` is STILL not the only scroller on the surface; there is
 * still exactly one deliberate exception, and it is now a smaller box in a
 * different place. The retired claim is NOT restored.
 *
 * ⚠ `min-h-0` IS THE LINK EVERYONE DROPS, and dropping it is invisible. A flex
 * item's automatic minimum size is its CONTENT, so without `min-h-0` a node
 * refuses to shrink below what it holds — the arena pushes past the container,
 * the headzone band gets squeezed instead of the arena, and the page just gets
 * taller. Every `min-h-0` below is therefore pinned BY NAME on the node that
 * needs it.
 *
 * ⚠⚠ THE ROUTE IS NOW A ONE-SCREEN GRID, AND THE RULING THAT SAID OTHERWISE IS
 * REVERSED. This block read: "THIS ROUTE IS NOT THE PROFILE, AND THE DIFFERENCE
 * IS DELIBERATE. `(public)/layout.tsx` rules '⛔ `min-h-*`, never `h-*`' so a
 * surface can GROW AND SCROLL rather than clip, and `/m/[slug]` has NOT been
 * ruled a one-screen design the way `/u/[pseudonym]` was. So there is NO
 * definite height on this chain and none is asserted … ⛔ Do not 'finish' this
 * chain by adding `h-[calc(100vh-…)]` to the container."
 *
 * ⇒ FOUNDER RULING, 2026-08-17: "It's a one page view — there should be no
 * scroll down. The dimensions of the whole market detail page are not matching —
 * it should be exact." The container now DECLARES `h-[calc(100dvh-60px-2px)]`
 * and hides its own overflow, and this guard requires it rather than forbidding
 * it. ⛔ The layout's `min-h-*` floor is UNTOUCHED — the ruling names one route,
 * and every other `(public)` surface still grows and scrolls.
 *
 * ⛔⛔ AND THE OVERFLOW MUST STILL EXIST SOMEWHERE. A fixed height does not make
 * content fit — it CLIPS it, and clipping to hit a number is a failure, not a
 * pass. d5 survives its own `overflow:hidden` because the scrolling lives in
 * `.colwrap` (`d5:568`, `flex:1 1 auto;min-height:0;overflow-y:auto`). So this
 * guard now asserts BOTH halves: the page may not scroll, AND the column must.
 * A long argument and a `Removed by moderator` placeholder (ADR-0020/0021) stay
 * reachable because the column scrolls, never because the page grew.
 *
 * ⚠ `100dvh`, not `100vh` — the dynamic viewport unit, so a collapsing mobile
 * URL bar cannot leave the band taller than the window it is meant to equal.
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
 * price bar's `h-[18px]` track (BLOCK-3 §2; was `h-[14px]`) — is not a chain
 * node and is none of this guard's business.
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
		// ⚠⚠ THE ONE-SCREEN BAND, founder-ruled 2026-08-17. This line used to be
		// `expect(classes.filter(FORBIDDEN_HEIGHT)).toEqual([])` — the container
		// was forbidden a height. It is now REQUIRED to declare exactly one
		// screen, and `100dvh` specifically (not `100vh`) so a collapsing mobile
		// URL bar cannot make the band taller than its window.
		expect(classes).toContain("h-[calc(100dvh-60px-2px)]");
		// The container is itself a flex item of `<main>`; without `min-h-0` its
		// automatic minimum size is its CONTENT, and a tall arena would push the
		// band past the height it just declared.
		expect(classes).toContain("min-h-0");
		// ⛔ THE PAGE MAY NOT SCROLL. This is the half that makes the ruling real:
		// without it the container is one screen tall and the content spills out
		// of it, which is the same page scroll under a different name.
		expect(classes).toContain("overflow-hidden");
	});

	it("debate-height::the-page-declares-100dvh-and-NEVER-100vh", () => {
		// ⚠ SCOPED TO THE TAG, NOT THE FILE. A whole-file scan for "100vh" is
		// unusable here and the first version of this assertion proved it: this
		// component's own docblocks QUOTE the superseded `min-h-[calc(100vh-…)]`
		// ruling verbatim (O-4 requires recording it rather than deleting it), so
		// the guard failed on its own prose. A guard that cannot tell a
		// declaration from a comment about a declaration is not measuring the
		// thing it names.
		const tag = /<PageContainer\b[^>]*>/.exec(read(VIEW));
		if (!tag) {
			throw new Error(`${VIEW}: no PageContainer tag found.`);
		}
		const extras = /className="([^"]*)"/.exec(tag[0])?.[1] ?? "";
		// `100vh` on a mobile browser is the LARGEST viewport (URL bar collapsed),
		// so a `100vh` band is taller than the visible window whenever the bar is
		// showing — a page that scrolls by exactly the height of the browser
		// chrome, which is the defect this route was just ruled out of.
		expect(extras).not.toContain("100vh");
		expect(extras).toContain("100dvh");
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

		// ⛔⛔ UI-QUICK change set 4 §C — THE BAND CONTAINS ITS OWN CONTENT, and
		// this line is the guard for a defect that shipped to staging and that
		// NOTHING in this file could previously see.
		//
		// `basis-[24.2dvh]` is a viewport FRACTION; the stack inside it has an
		// INTRINSIC height. Below ~715px of viewport height the fraction is the
		// smaller of the two, and with no containment the excess painted downward
		// over the top border of both debate columns — measured at 1440×700 on
		// staging, and worse before the resolution trigger came out.
		//
		// ⚠ WHY THE REST OF THIS FILE COULD NOT CATCH IT. Every other assertion
		// here checks that a DECLARATION is present, and every declaration WAS
		// present and correct: the band declared its fraction, the arena took the
		// leftover, the column scrolled. The defect was that the declared band was
		// smaller than its own content at a viewport height nobody had measured —
		// a layout FACT, not a missing class. This file is a source scan (jsdom
		// performs no layout, as the header says), so the only thing it can pin is
		// the containment that makes the fact harmless. That is what this line is.
		//
		// ⛔ Do not "simplify" this away as redundant with `PageContainer`'s own
		// `overflow-hidden`. That one keeps content inside the PAGE; this one keeps
		// the headzone's content inside the HEADZONE, one level down, and the
		// overlap happened with the page-level rule already in force.
		expect(classes).toContain("overflow-hidden");
		// ⚠ THE BAND IS A FRACTION OF THE VIEWPORT, never d5's literal `188px` and
		// never a percentage of the CONTAINER. `.headzone{flex:0 0 188px}` is
		// 188/777 = 24.2% of the viewport at the pinned 1440×777.
		// ⛔ `dvh`, NOT `%`, and this assertion was written the wrong way first: a
		// container percentage is 21.4% at 1800×971 and 27.5% at 1440×777 for the
		// SAME 188px band, because it drifts with the container's own padding and
		// chrome. Shipping the percentage measured 146px on staging. A viewport
		// fraction is the ratio d5's fixed px actually encodes, so the unit is
		// pinned here and not just the shape.
		expect(classes.some((c) => /^basis-\[\d+(\.\d+)?dvh\]$/.test(c))).toBe(
			true,
		);
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

	it("debate-height::the-rail-carries-d5s-LITERAL-340px-track", () => {
		const right = bandClasses(read(HEADZONE), HEADZONE, "headzone-right")[0];

		// ⚠⚠ THIS ASSERTION IS INVERTED FROM WHAT IT SAID, by founder ruling.
		// It read: "⛔ THE ONE SURVIVING RULE. `.hright` is `flex:0 0 340px` in
		// the mockup and that length is NOT carried … A fraction scales with the
		// container; 340px does not." — and required `lg:w-<n>/<n>`.
		//
		// ⇒ The 2026-08-17 parity ruling names rail width as one of the literals
		// to copy: "Where d5 uses a literal (rail width, 640:586 image aspect),
		// copy the literal." The measurement backs it. `w-1/4` was only ever
		// close because it took its quarter from a container that was ALSO wrong
		// (capped at 1440 where d5 is full-bleed) — two errors cancelling. With
		// the container corrected, a quarter of 1744px is 436px, 5.7pp too wide,
		// and it eats the text stack.
		// ⚠ The `340px` REPLACES the fraction; it does not join it.
		expect(right).toContain("w-[340px]");
		expect(right.some((c) => /^lg:w-\d+\/\d+$/.test(c))).toBe(false);
		// A fixed basis that may shrink is not a fixed basis.
		expect(right).toContain("shrink-0");
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

	it("debate-height::the-column-is-the-ONLY-scroller-IN-THIS-CHAIN-and-it-is-wired", () => {
		// ⚠ RPLY-2 · R1 gave `BetComposer` its own nested `overflow-y-auto`
		// region — see the docblock amendment above. This test's own three
		// assertions were never about "nothing else on the page scrolls"; they
		// pin `column-scroll`'s className, which R1 does not touch.
		const source = read(COLUMN);
		const [classes, ...extra] = bandClasses(source, COLUMN, "column-scroll");

		// ONE authoring site — both arms render through this same component.
		expect(extra).toEqual([]);

		// ⛔⛔ THE HALF THAT KEEPS THE FIXED HEIGHT HONEST. The page may not
		// scroll, so the overflow has to live here or content is CLIPPED —
		// a long argument, a tall reply card, a `Removed by moderator`
		// placeholder (ADR-0020/0021). d5 puts it in `.colwrap` (`:568`).
		expect(classes).toContain("overflow-y-auto");
		// ⚠ `min-h-0` IS WHAT MAKES `overflow-y-auto` DO ANYTHING. Without it the
		// item's automatic minimum size is its content, so it grows to fit the
		// card instead of scrolling it — and the page, told it is exactly one
		// screen, clips the difference in silence. The two are one mechanism.
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("flex-1");
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

/**
 * CRIT-1 · G-5 — THE CHAIN GAINS A NODE, AND THE BAND MUST NOT PAY FOR IT.
 *
 * The criterion disclosure is a new flex item of the one-screen container. That
 * container is a FIXED `h-[calc(100dvh-60px-2px)]` with `overflow-hidden`, so
 * every child's height comes out of somewhere — and the only thing that may give
 * is the ARENA, which is the container's sole `flex-1` and whose columns scroll
 * internally. The band must NOT give: it is `shrink-0 basis-[24.2dvh]`, and
 * RESO-1 closed `headzone-stack` at scroll 188 vs client 188 — exactly zero
 * overflow, down from +14. That was a deliverable, and this is what stops the
 * next change from spending it.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A MEASUREMENT. jsdom performs no layout — it
 * resolves no `calc()`, no `dvh`, no flex — so `scrollHeight`/`clientHeight` here
 * are meaningless. What IS checkable is the STRUCTURAL property that protects the
 * band: the disclosure is a sibling of the band, never a descendant of it. The
 * rendered scroll-vs-client equality is measured in a browser at the RESO-1
 * viewport ladder and reported in the CRIT-1 run log.
 */
describe("debate height chain — CRIT-1's criterion disclosure", () => {
	const DISCLOSURE = "src/components/debate/CriterionDisclosure.tsx";

	it("debate-height::the-disclosure-is-NOT-inside-the-band-or-the-header-stack", () => {
		// ⛔ THE WALL, ASSERTED. Anything mounted inside `headzone-stack` comes
		// straight back out of the four-block row, which is fully allocated.
		// ⛔⛔ MATCH JSX SYNTAX, NEVER A BARE WORD. This was
		// `expect(source).not.toContain("CriterionDisclosure")`, which fires on
		// PROSE — and `MarketHeader.tsx`'s docblocks must NAME this component to
		// explain why the criterion left that file. So the bare form would have gone
		// red on a correct documentation fix, and the cheapest escape from a red
		// guard is to write a correction that cannot name its subject. That is the
		// substring-for-token defect this repo has now hit SIX times; the G-4 block
		// in `criterion-disclosure.test.tsx` avoids it the same way.
		// ⛔⛔ `VIEW` JOINED THIS LIST AT RESO-3 · CHANGE 6. It used to carry the
		// POSITIVE control below — "it IS mounted, in the view that owns the
		// container" — which was the right guard while the criterion was on the
		// page. The founder has ruled it off the page again, so the same scan now
		// asserts the same thing about all three files: no JSX site renders it.
		for (const file of [
			HEADZONE,
			"src/components/debate/MarketHeader.tsx",
			VIEW,
		]) {
			expect(read(file)).not.toMatch(/<CriterionDisclosure\b/);
		}
		// ⛔ THE POSITIVE CONTROL IS NOW THE FILE'S CONTINUED EXISTENCE, and it is
		// not decoration. With nothing rendering the component, every assertion
		// above would pass just as well against a repo where the component had been
		// DELETED — which is precisely the outcome CHANGE 6 rules against ("keep the
		// component file, unrendered"). This is what makes the negatives mean
		// "unrendered" rather than "gone".
		expect(existsSync(join(ROOT, DISCLOSURE))).toBe(true);
		expect(read(DISCLOSURE)).toMatch(/export function CriterionDisclosure\b/);
	});

	it("debate-height::RESO-3-the-arena-does-not-pay-for-a-disclosure-it-no-longer-holds", () => {
		// ⛔⛔ THIS REPLACES `the-disclosure-is-a-DIRECT-child-of-the-one-screen-
		// container`, WHICH HAD NO SUBJECT LEFT. That test pinned the mount's DEPTH
		// at three tabs, after a long fight to stop it being a false receipt — first
		// an index window containing the whole ternary, then "after both arm
		// headers", which a mount inside the market arm still satisfied. Depth was
		// the class change that finally discriminated.
		// ⇒ RESO-3 · CHANGE 6 removes the mount, so there is no depth to assert. The
		// history above is kept because the NEXT person to mount something into this
		// container will reach for a positional proxy, and this file is where they
		// will look. The lesson outlived its assertion.
		//
		// ⚠ WHAT IS ASSERTED INSTEAD IS THE HEIGHT LEDGER, which is the reason this
		// describe exists at all. `PageContainer` is a FIXED
		// `h-[calc(100dvh-60px-2px)]` with `overflow-hidden`; the band is `shrink-0
		// basis-[24.2dvh]` and the ARENA is the sole `flex-1`, so every direct child
		// of the container is paid for by the arena and nothing else. The disclosure
		// cost it 46.50px closed at 1440×777 (CRIT-1's own measurement, §3 of its
		// log). With the mount gone the arena gets that back — measured in the
		// browser and reported in the RESO-3 run notes, since jsdom resolves no
		// `calc()`, no `dvh` and no flex.
		// ⇒ What is checkable HERE is the structural precondition for that refund:
		// the container's children are the band, the arena and the overlays, and the
		// disclosure is not among them.
		const source = read(VIEW);
		expect(source).not.toMatch(/<CriterionDisclosure\b/);
		// …and the arena is still the only thing allowed to absorb the difference.
		// If a second `flex-1` ever appears among the container's children, the
		// refund silently goes somewhere else and this describe's premise is void.
		const containerChildren = [...source.matchAll(/^\t\t\t<(\w+)/gm)].map(
			(m) => m[1],
		);
		expect(containerChildren.length).toBeGreaterThan(0); // the scan found something
		expect(containerChildren).not.toContain("CriterionDisclosure");
	});

	it("debate-height::the-disclosure-does-not-grow-and-bounds-its-own-open-body", () => {
		const source = read(DISCLOSURE);
		const classAttrs = [...source.matchAll(/className="([^"]*)"/g)].map(
			(m) => m[1] ?? "",
		);
		expect(classAttrs.length).toBeGreaterThan(0); // the scan found something

		// ⚠ THE ELEMENT-BINDING HALF OF THIS MOVED TO THE RENDER TEST, and the
		// reason is worth keeping: `classAttrs.find(c => …includes("shrink-0"))`
		// scans EVERY `className` in the file and takes the first hit, so if
		// `shrink-0` migrated off the `<details>` onto the summary this stayed green
		// while the crushable element lost its protection — which is precisely the
		// `<h1>` precedent the comment cites (@code-reviewer). `criterion-disclosure
		// .test.tsx` now asserts it on the rendered `<details>` node itself. What
		// remains here is the file-level property: the disclosure does not GROW.
		const details = classAttrs.find((c) => c.split(/\s+/).includes("shrink-0"));
		expect(details).toBeDefined();
		expect(details?.split(/\s+/)).not.toContain("flex-1");

		// ⛔ THE OPEN BODY IS BOUNDED AND SCROLLS ITSELF. Unbounded open content in
		// an `overflow-hidden` one-screen container is CLIPPED, which this file's
		// own doctrine calls a failure rather than a pass. The bound is a viewport
		// FRACTION, matching the band's own `basis-[24.2dvh]` — a pixel cap would be
		// correct at exactly one viewport height.
		const body = classAttrs.find((c) => c.includes("overflow-y-auto"));
		expect(body).toBeDefined();
		expect(body).toMatch(/max-h-\[\d+(\.\d+)?dvh\]/);
	});
});
