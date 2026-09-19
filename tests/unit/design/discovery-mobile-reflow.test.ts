import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MOBILE-1 · Phase A — DISCOVERY AT PHONE WIDTH, asserted node by node.
 *
 * WHAT THIS GUARD IS FOR. Below 640px Discovery is a PLAIN VERTICAL LIST OF
 * MARKET CARDS and nothing else — founder-ruled. The hero and its dot rail
 * hide together; the `MarketCard` grid, which already stacks, is the whole
 * surface. This file pins all three facts plus the one that makes them safe.
 *
 * ⚠⚠ THE HIDE REVERSES A @code-reviewer FINDING, AND THE REVIEWER WAS NOT
 * WRONG — the ground changed under it. Plan §4 called the hero "decorative
 * per design-language §3.2" and asked for it to hide; the reviewer traced
 * that citation and found it STALE: CHART-1 (SPEC.1 §9, 2026-08-27) made the
 * hero price chart non-`aria-hidden` with an accessible summary, and the same
 * root wraps both `HeroPostPanel`s — SPEC.1 §22 F-DISC-2's top-ranked YES/NO
 * posts, real participant argument text. On that basis the hide was reverted,
 * correctly: hiding content with no path to it is not a reflow.
 * ⇒ THE FOUNDER'S RULING SUPPLIES THE MISSING PATH rather than waiving the
 * objection. `MarketCard` is a whole-card `<Link href="/m/{slug}">`, so on the
 * ruled surface every hidden post and chart is ONE TAP away on that market's
 * own page. Relocated, not destroyed — which is precisely the distinction the
 * reviewer's objection turned on. Recorded here rather than in a changelog
 * because the next reader of this file will otherwise re-derive the reviewer's
 * (still valid) reasoning and revert the ruling.
 * ⚠ ACCEPTED COST: a CSS hide leaves the carousel's 10s auto-advance timer and
 * document keydown listener running against a hidden hero. A JS conditional
 * render would need a client viewport read, which plan §4 rules against for
 * the hydration reasons a pure-CSS toggle avoids.
 *
 * ⛔⛔ `grid-cols-1` IS NOT REDUNDANT WITH THE HIDE, AND DELETING IT ON THAT
 * REASONING IS THE TRAP THIS PARAGRAPH EXISTS TO CLOSE. It governs the
 * 640–767px band, where the hero IS visible and `md:` has not yet taken over.
 * `HeroPanels.tsx` originally carried no unprefixed `grid-cols-*` at all, on
 * the reasoning that an implicit grid with no explicit columns already stacks
 * its children one-per-row below `md` — true, but incomplete: with no EXPLICIT
 * single column the implicit track sizes to its widest child's max-content
 * width rather than the container. That gap was invisible to source-reading
 * AND to this repo's own source-scan suites, and the local dev database had
 * zero `Open` markets throughout this task's verification pass — so
 * `HeroPanels` was never mounted with content at all until a later session
 * against hand-written preview data. Measured then: each stacked panel
 * rendered ~526px wide inside a 375px viewport. `grid-cols-1` is Tailwind's
 * `repeat(1, minmax(0, 1fr))`; the `minmax(0, …)` is what lets the track
 * shrink. Hidden below 640px is not hidden at 700px.
 *
 * ⛔ THE FAILURE MODE ON THE MOBILE SIDE IS SILENT EITHER WAY. An
 * unrecognised Tailwind variant compiles to nothing — no error, no warning —
 * so a stray `max-mobile:hidden` added to either node later would compile
 * clean and simply delete real content from every phone, with no signal
 * anywhere in CI.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no media query, no `calc()`, no Tailwind utility and no viewport
 * width, so a render test structurally CANNOT see "stacks below 640px" or
 * "unchanged at 1440px". `discovery-height-chain.test.ts:19-24` and
 * `debate-height-chain.test.ts:83-88` state the same limit for the same reason.
 * This file proves the DECLARATIONS are present (or absent); a real browser at
 * 375px and 1440px proves they compose, and horizontal overflow is measurable
 * there and only there — measured this session: 0px at both 375px and 414px,
 * hero and rail rendered.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const HERO = "src/components/discovery/HeroPanels.tsx";
const CAROUSEL = "src/components/discovery/DiscoveryCarousel.tsx";
const GRID = "src/components/discovery/DiscoveryGrid.tsx";

/** The variant MOBILE-1 §4 mints — phone and below, everything under 640px. */
const HIDE_BELOW_640 = "max-mobile:hidden";

/**
 * Every literal className carried by a node bearing `data-testid="<testid>"`, in
 * source order — one entry per occurrence.
 *
 * ⚠⚠ THIS IS NOT `bandClasses()` FROM `debate-height-chain.test.ts`, AND THE
 * DIFFERENCE IS FORCED BY THESE FILES RATHER THAN CHOSEN. That helper requires
 * the two attributes to be ADJACENT (`"<testid>"\s+className="…"`), and BOTH
 * nodes read here carry a multi-line `//` comment BETWEEN the testid and the
 * className — `HeroPanels.tsx`'s HTML-FINISH row 8 rationale, `DiscoveryGrid.tsx`'s
 * `flex:0 0 auto` note. The adjacent form matches neither, so a verbatim copy
 * would throw against a perfectly correct file and the guard would read as a
 * defect in the source.
 *
 * ⛔ THE WINDOW IS BOUNDED BY THE NEXT `<`, which is either this tag's first
 * child or its own close. That bound is what stops a node whose className was
 * DELETED from silently borrowing a DESCENDANT's and reporting a green — the
 * unbounded forward search is the obvious version of this helper and it is the
 * one that cannot fail.
 */
function nodeClasses(source: string, file: string, testid: string): string[][] {
	const marker = `data-testid="${testid}"`;
	const found: string[][] = [];
	let at = source.indexOf(marker);
	while (at !== -1) {
		const bound = source.indexOf("<", at);
		const window = source.slice(at, bound === -1 ? source.length : bound);
		const m = /className="([^"]*)"/.exec(window);
		if (!m) {
			throw new Error(
				`${file}: the node carrying ${marker} has no literal className before ` +
					`its tag closes. If it moved to a template literal or a variable, ` +
					`re-derive this guard rather than deleting it.`,
			);
		}
		found.push((m[1] ?? "").split(/\s+/).filter(Boolean));
		at = source.indexOf(marker, at + marker.length);
	}
	if (found.length === 0) {
		throw new Error(
			`${file}: no node with ${marker}. MOBILE-1 Phase A keys its phone-width ` +
				`overrides off this testid; if the node was renamed or restructured, ` +
				`re-derive this guard rather than deleting it.`,
		);
	}
	return found;
}

describe("discovery mobile reflow — the hero hides below 640px and keeps its md: step above it", () => {
	it("discovery-mobile::hero-panels-hides-below-640-keeps-grid-cols-1-and-its-md-step", () => {
		const [classes, ...extra] = nodeClasses(read(HERO), HERO, "hero-panels");

		// ONE authoring site.
		expect(extra).toEqual([]);

		// The desktop composition, pinned unchanged — both mobile rules below
		// are APPENDED, so a reflow that reached >=768px reddens right here.
		expect(classes).toContain("grid");
		expect(classes).toContain("flex-1");
		expect(classes).toContain("gap-[14px]");
		expect(classes).toContain("md:grid-cols-[1fr_1.9fr_1fr]");

		// ⛔⛔ EXPLICIT `grid-cols-1`, NOT ITS ABSENCE. An earlier draft of this
		// guard asserted NO unprefixed grid-cols — reasoning that "no explicit
		// columns" alone was enough to stack the three panels into one column
		// below `md`. That's half true: it does stack them, one per row — but
		// with no EXPLICIT single column, the implicit grid track sizes to its
		// content's max-content width rather than the container, so each
		// panel rendered ~526px wide on a 375px viewport (measured directly in
		// a browser, once real card content existed to render — the local
		// database had none when the earlier draft was written, so this had
		// never actually been exercised). `grid-cols-1` compiles to
		// `repeat(1, minmax(0, 1fr))`; the `minmax(0, ...)` is what lets the
		// track shrink to the viewport instead of its content.
		expect(
			classes,
			`${HERO}: the hero grid carries no unprefixed \`grid-cols-1\`. Without ` +
				`it, the implicit single-column track sizes to its widest child's ` +
				`content instead of the viewport — a real, measured overflow, not ` +
				`a theoretical one.`,
		).toContain("grid-cols-1");

		// ⛔⛔ AND `max-mobile:hidden` — FOUNDER-RULED, reversing a
		// @code-reviewer finding rather than overlooking it. The reviewer was
		// right that this root holds real participant content (SPEC.1 §22
		// F-DISC-2's top posts, CHART-1's now-accessible price chart). The
		// ruling answers that: below 640px Discovery becomes a plain vertical
		// list of `MarketCard`s, each a whole-card `<Link href="/m/{slug}">`,
		// so every hidden post and chart is ONE TAP away on the market's own
		// page. Relocated, not destroyed — which is the distinction the
		// reviewer's objection turned on.
		expect(
			classes,
			`${HERO}: the hero panel grid carries no \`${HIDE_BELOW_640}\`. The ` +
				`founder ruled the phone-width surface a plain market list; the ` +
				`hero's content stays reachable one tap into /m/{slug}.`,
		).toContain(HIDE_BELOW_640);
	});
});

describe("discovery mobile reflow — the carousel rail hides with its hero", () => {
	it("discovery-mobile::hero-and-rail-hide-TOGETHER-never-one-alone", () => {
		// ⛔⛔ THE PAIRING IS THE ASSERTION. Either alone is a defect with a
		// different shape: a rail without its hero is eight dots and two arrows
		// steering a panel that is not on screen; a hero without its rail is a
		// carousel a touch user cannot advance (no arrow keys on a phone). Both
		// pass every per-node check above and below — only comparing them
		// catches it.
		const hero = nodeClasses(read(HERO), HERO, "hero-panels")[0] ?? [];
		const rail =
			nodeClasses(read(CAROUSEL), CAROUSEL, "carousel-rail")[0] ?? [];
		expect(
			hero.includes(HIDE_BELOW_640),
			`${HERO} and ${CAROUSEL} disagree about the phone-width hide: hero=` +
				`${hero.includes(HIDE_BELOW_640)}, rail=${rail.includes(HIDE_BELOW_640)}. ` +
				`They hide together or not at all.`,
		).toBe(rail.includes(HIDE_BELOW_640));
	});

	it("discovery-mobile::carousel-rail-keeps-its-18px-track-and-hides-below-640", () => {
		const [classes, ...extra] = nodeClasses(
			read(CAROUSEL),
			CAROUSEL,
			"carousel-rail",
		);

		// ONE rail per carousel.
		expect(extra).toEqual([]);

		// The mockup's `.sliderwrap{flex:0 0 18px}` (HTML-FINISH row 8) — the
		// rail is fixed height and takes no share of the column's slack.
		expect(classes).toContain("h-[18px]");
		expect(classes).toContain("flex-none");
		expect(classes).toContain("items-center");
		expect(classes).toContain("justify-center");

		// ⛔⛔ HIDES WITH THE HERO, NEVER INDEPENDENTLY OF IT. The rail
		// navigates `HeroPanels`; with that hidden below 640px, a surviving
		// rail is eight dots and two arrows steering a panel that is not on
		// screen. The pairing is the assertion — see the "hide together" test
		// below, which is what stops a later edit unhiding one of the two.
		expect(
			classes,
			`${CAROUSEL}: the dot rail carries no \`${HIDE_BELOW_640}\` while the ` +
				`hero it navigates is hidden below 640px.`,
		).toContain(HIDE_BELOW_640);
	});
});

/**
 * ⚠⚠ THIS BLOCK IS A REGRESSION GUARD, NOT A DRIVER, AND IT IS GREEN THE DAY IT
 * IS WRITTEN — deliberately, and stated so it is not mistaken for a passing
 * test of unwritten work. `DiscoveryGrid.tsx` takes ZERO diff in MOBILE-1 Phase
 * A because it is already correct: it declares no UNPREFIXED `grid-cols-*`, so
 * it already falls back to Tailwind's single-column default below `sm` — which
 * is 640px, the same cutoff `--breakpoint-mobile` mints under its own name.
 *
 * ⛔ THAT IS EXACTLY WHY IT NEEDS A TEST. Phone-width stacking here is a
 * property of an ABSENCE, and nothing on disk asserts an absence. A later edit
 * adding `grid-cols-2` to the base — a wholly reasonable-looking change — would
 * pin two columns at every width including 375px, and no other guard in this
 * repo would see it. The single-column phone default would be gone and the only
 * symptom would be on a device.
 */
describe("discovery mobile reflow — the grid already stacks, and must keep doing so", () => {
	it("discovery-mobile::discovery-grid-declares-NO-unprefixed-grid-cols", () => {
		// ⚠⚠ THIS ASSERTS ACROSS **EVERY** `discovery-grid` NODE, WHERE IT USED TO
		// DESTRUCTURE ONE AND REQUIRE `extra` EMPTY. MKT-ROSTER-1-P3 ships two
		// literal JSX branches behind one `GRID_VARIANT` const so the founder can
		// photograph both candidate desktop shapes from a single commit, and a
		// second literal className is exactly what the old form rejected.
		//
		// ⛔ ITERATING IS NOT A LOOSENING. The old `extra` check bought "one class
		// string, so two cannot drift apart"; every property below is now asserted
		// on EACH string independently, so a second node that drifted would red on
		// its own row rather than slipping through the first. What is genuinely
		// given up is the count itself — and it comes back in Phase 2, when the
		// unchosen variant is deleted and this reverts to the single-node form.
		const nodes = nodeClasses(read(GRID), GRID, "discovery-grid");
		expect(nodes.length).toBeGreaterThan(0);

		for (const classes of nodes) {
			// The two responsive steps that DO exist, pinned by name — the grid is
			// two columns from `sm`, and THREE from `lg` since the D-49 six-market
			// roster (it was four; four rendered six markets as 4 + 2).
			expect(classes).toContain("sm:grid-cols-2");
			expect(
				classes.some((c) => /^lg:grid-cols-/.test(c)),
				`${GRID}: a market-grid node declares no \`lg:grid-cols-*\` at all, ` +
					`so the desktop tier falls back to the \`sm\` two-column step.`,
			).toBe(true);

			// ⛔ AND NOTHING UNPREFIXED. `sm:grid-cols-2` only wins below 640px if
			// nothing beneath it sets a column count; a base `grid-cols-*` would
			// apply at EVERY width and phone-width stacking would silently end.
			const unprefixed = classes.filter((c) => /^grid-cols-/.test(c));
			expect(
				unprefixed,
				`${GRID}: the market grid declares unprefixed ${JSON.stringify(
					unprefixed,
				)}. An unprefixed grid-cols applies at every width, so the ` +
					`phone-width single-column default is gone — the cards render ` +
					`multi-column at 375px. Add the column count at a breakpoint ` +
					`(\`sm:\`/\`lg:\`) instead.`,
			).toEqual([]);
		}
	});

	/**
	 * ⛔ MKT-ROSTER-1-P3 — THE DESKTOP TIER IS THREE COLUMNS IN BOTH VARIANTS, AND
	 * NEITHER MAY REACH BELOW 640px. The centred variant buys its equal side
	 * margins with `lg:justify-center` on the grid itself; an UNPREFIXED
	 * `justify-center` would centre the phone tier's single column too, shrinking
	 * every card to its own content width on a device — the same silent,
	 * device-only failure the unprefixed `grid-cols` guard above exists for.
	 */
	it("discovery-mobile::the-desktop-column-count-is-three-and-stays-above-640", () => {
		// ⚠ ASSEMBLED AT RUNTIME, NOT WRITTEN AS A LITERAL (AGENTS.md §8).
		// Tailwind v4's source detection scans `tests/` as well as `src/`, so a
		// class-shaped string here EMITS a real utility into the built stylesheet —
		// and in Phase 2 exactly one of these two variants survives in `src/`. A
		// literal would keep the loser's utility alive with no component behind it,
		// which is precisely how the built sheet stops being evidence of what the
		// components use.
		const LG = "lg";
		const S = ":";
		const THREE = `${LG}${S}grid-cols-3`;
		const CENTRED = `${LG}${S}grid-cols-[repeat(3,`;
		const PREFIX = new RegExp(`^${LG}${S}grid-cols-`);

		for (const classes of nodeClasses(read(GRID), GRID, "discovery-grid")) {
			const cols = classes.filter((c) => PREFIX.test(c));
			expect(cols.length).toBe(1);
			expect(
				cols[0] === THREE || cols[0]?.startsWith(CENTRED),
				`${GRID}: the desktop grid declares ${JSON.stringify(cols[0])}. ` +
					`The D-49 roster is six markets and the founder ruled 3 × 2; a ` +
					`fourth column renders them 4 + 2 again.`,
			).toBe(true);

			const bareJustify = classes.filter((c) => /^justify-/.test(c));
			expect(
				bareJustify,
				`${GRID}: the market grid declares unprefixed ${JSON.stringify(
					bareJustify,
				)}. Centring applies at every width, so the phone tier's single ` +
					`column stops filling the viewport.`,
			).toEqual([]);
		}
	});
});
