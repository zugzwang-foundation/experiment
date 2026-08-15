// SPDX-License-Identifier: AGPL-3.0-or-later

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	CONTAINER_PRESETS,
	type ContainerPreset,
} from "@/components/shell/PageContainer";
import { cn } from "@/lib/utils";

/**
 * POLISH-1b B2 — the NO-CHANGE proof.
 *
 * The hard constraint is that nothing moves: every route keeps its computed
 * width, horizontal inset and vertical padding. This suite proves it by reading
 * each CALL SITE off disk and comparing the class set it actually resolves to
 * against the EXACT string that was on disk at `c5892bc`.
 *
 * READS THE CALL SITES, DOES NOT ASSUME THEM. An earlier draft compared two
 * literals inside this file — the preset table against a hardcoded `before` —
 * and so pinned the TABLE while saying nothing about what any route renders.
 * Repointing `bookmarks/page.tsx` at the wrong preset, or reverting it to a
 * hand-rolled div, left every row green. Each row now extracts the real
 * `<PageContainer>` tag from the real file, so a call-site regression fails
 * here (@code-reviewer, POLISH-1b H2).
 *
 * Why class-set equality is the right proof and not a proxy: Tailwind emits one
 * rule per utility at a fixed specificity, and class ORDER in the attribute has
 * no effect on the cascade. Two elements carrying the same SET of utilities
 * compute identically however they are written.
 *
 * `text-center` (site 1) and the `flex`/`gap-*` classes are per-site CONTENT
 * layout, deliberately outside the container contract; they ride `className`
 * and are included so each row is the whole element, not just the box.
 */

/** The three container axes plus centring — a preset's exclusive property. */
const BOX_AXES = [/^max-w-/, /^px-/, /^py-/, /^mx-auto$/];

type Site = {
	site: number;
	/** Repo-relative file holding the call site. */
	file: string;
	/** VERBATIM className on disk at `c5892bc`. Never edited to match code. */
	before: string;
	/**
	 * Classes the primitive ADDS beyond the `c5892bc` baseline. Non-empty for
	 * exactly one site, and every entry needs a stated reason — this field is
	 * how a deliberate addition stays visible instead of being absorbed into
	 * `before`.
	 */
	adds?: string;
	/**
	 * ⚠ THE SITE'S CLASS SET NOW, when a ruling has deliberately MOVED it off
	 * the `c5892bc` baseline.
	 *
	 * WHY A THIRD FIELD RATHER THAN EDITING `before`. That field's contract is
	 * one line up — "VERBATIM className on disk at `c5892bc`. Never edited to
	 * match code." Rewriting it to match a change is exactly the drift it
	 * exists to make impossible, and it would erase the evidence that anything
	 * moved. `adds` cannot express this either: it is additive by construction
	 * and this ruling REPLACES `max-w-3xl` and `px-4`.
	 *
	 * So `before` stays the historical baseline, `now` states the ruled current
	 * value, and `movedBy` says who ruled it. A site with `now` is asserted
	 * against `now`; every other site is still asserted against
	 * `before + adds`, unchanged.
	 */
	now?: string;
	/** Required whenever `now` is set — the ruling, named. */
	movedBy?: string;
};

const SITES: Site[] = [
	{
		site: 1,
		file: "src/app/(public)/not-found.tsx",
		before: "mx-auto w-full max-w-3xl px-4 py-24 text-center",
	},
	{
		site: 2,
		file: "src/app/(public)/bookmarks/page.tsx",
		before: "mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6",
		// ⚠⚠ HTML-FINISH · BOOKMARKS round 3 — `/bookmarks` takes the PROFILE
		// ARRANGEMENT as it ships on `main` (founder-ruled). That is a two-column
		// arena, and `reading`'s `max-w-3xl` = 768 caps the container BELOW the
		// `lg` breakpoint at which the arena may become two columns at all — so
		// the surface would render its two-column layout at its own minimum on
		// every screen and never widen. That is the exact measured defect
		// HTML-FINISH row 20 minted `wide` to fix on Profile (site 5).
		// ⇒ This site moves to `wide` and takes Profile's own content-layout
		// classes byte-for-byte. ⚠ The `lg:` ONE-SCREEN PAIR is NOT here yet — it
		// lands with the height chain at this round's last commit, and this pin
		// moves again with it, in that commit.
		// ⛔ THE PRESET IS CONSUMED, NEVER RE-MINTED — `PageContainer.tsx` is
		// read-only this round, so `BOX_AXES` moves by preset selection alone.
		now: "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-6",
		movedBy:
			"HTML-FINISH · BOOKMARKS round 3 — full replication of Profile " +
			"(founder-ruled 2026-08-15)",
	},
	{
		site: 3,
		file: "src/app/(public)/bookmarks/loading.tsx",
		before: "mx-auto w-full max-w-3xl px-4 py-6",
	},
	{
		site: 4,
		file: "src/app/(public)/bookmarks/error.tsx",
		before: "mx-auto w-full max-w-3xl px-4 py-6",
	},
	{
		site: 5,
		file: "src/app/(public)/u/[pseudonym]/page.tsx",
		before: "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6",
		// HTML-FINISH row 20. The profile's two-band arena was measured rendering
		// two 356px columns at 1440 — IDENTICAL to its 768 rendering, because the
		// container never widened. It moves to the minted `wide` preset, whose
		// `max-w-[1440px] px-6` is byte-carried from `GlobalHeader.tsx:91`.
		//
		// ⚠ `flex-1 min-h-0` are ROW 3's, not row 20's: this call site is the
		// first link of the profile's height chain, which is what lets the
		// positions panel scroll internally instead of growing. They are CONTENT
		// layout, not container axes, so `BOX_AXES` is untouched by them — and
		// `tests/unit/design/profile-height-chain.test.ts` is where the chain
		// itself is asserted, node by node.
		//
		// ⚠⚠ ROUND 5 item A ADDS THE ONE-SCREEN BOUND — `lg:h-[calc(100vh-60px-2px)]`
		// and `lg:flex-none`. The founder ruled the profile route a one-screen
		// design: it occupies exactly the viewport below the header, no page
		// scrollbar, every region that can overflow scrolling inside itself. This
		// call site is the node that does it, because bounding the container at
		// the SAME figure `<main>`'s floor already uses satisfies that `min-h`
		// EXACTLY, so main never grows: header 62 + main (100vh − 62) = 100vh.
		// ⛔ `lg:flex-none` IS NOT TIDINESS — `flex-1` is `flex: 1 1 0%` and a 0%
		// basis WINS over `height` on the main axis. MEASURED: with the height
		// applied and `flex-1` still on, the page STILL scrolled (document 1577
		// against a 725 viewport). With `flex:none` it stops (725 == 725).
		// ⛔ BOTH ARE `lg:`-SCOPED. Below `lg` the two bands stack and the page
		// must stay free to grow and scroll, so `BOX_AXES` is untouched at every
		// width and the three container axes still move only where row 20 moved
		// them.
		now: "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col gap-6 px-6 py-6 lg:h-[calc(100vh-60px-2px)] lg:flex-none",
		movedBy:
			"HTML-FINISH · PROFILE rows 20 + 3 (founder-ruled 2026-08-15, round 2); " +
			"ROUND 5 item A one-screen fit (founder-ruled 2026-08-15, round 5)",
	},
	{
		site: 6,
		file: "src/app/(public)/u/[pseudonym]/loading.tsx",
		before: "mx-auto w-full max-w-3xl px-4 py-6",
	},
	{
		site: 7,
		file: "src/app/(public)/u/[pseudonym]/error.tsx",
		before: "mx-auto w-full max-w-3xl px-4 py-6",
	},
	{
		site: 8,
		file: "src/app/(auth)/layout.tsx",
		before: "mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8",
	},
	{
		site: 9,
		file: "src/components/debate/DebateView.tsx",
		// THE ONE SITE THAT GAINS A CLASS. `c5892bc` genuinely lacked `w-full`
		// — this string is verbatim, NOT widened to match the preset.
		before: "mx-auto flex max-w-5xl flex-col gap-5 px-6 py-8",
		// Inert TODAY: DebateView's root is a block-level flex container in
		// normal flow, where width:auto and width:100% compute the same used
		// width under border-box, and `mx-auto` + `max-w-5xl` centres either
		// way. Kept rather than dropped because it is the SAFER of the two: if
		// a later task makes the parent a column flex container, `mx-auto`
		// suppresses `align-self: stretch` and the class becomes the difference
		// between fill-to-max-w and shrink-to-fit.
		adds: "w-full",
	},
];

/**
 * POLISH.3 §18 R-a — call sites that have NO `c5892bc` baseline, because the
 * file did not exist at that commit.
 *
 * They cannot carry a `before`. That field is defined above as the VERBATIM
 * className on disk at `c5892bc`, so authoring one for a file that was not
 * there would invert the B2 no-change proof INSIDE the suite whose entire
 * purpose is that proof — the same inversion V-1 fences on `DETAIL_BASELINE`.
 * A greenfield site is therefore DECLARED here and left out of the class-set
 * rows above, rather than faked into `SITES`. `SITES` stays at nine.
 */
const GREENFIELD: { file: string; reason: string }[] = [
	{
		file: "src/app/(public)/m/[slug]/error.tsx",
		reason:
			"POLISH.3 D4 / PD-3-11 — the /m/[slug] error boundary, added after c5892bc.",
	},
];

const asSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

/** The two roots that may hold a `<PageContainer>` call site. */
const CALL_SITE_ROOTS = ["src/app", "src/components"];

/**
 * EVERY `<PageContainer>` call site on the tree, read off disk.
 *
 * The rows above are a hardcoded array, self-consistent by construction: a NEW
 * call site anywhere would silently escape the B2 no-change proof while every
 * one of them stayed green. This is the only thing in this file that looks at
 * the TREE rather than at a named path.
 *
 * ⚠ Each file is slurped WHOLE and matched with `callSite`'s own regex. A
 * line-based scan would miss `(public)/not-found.tsx`, whose tag spans five
 * lines. The regex also excludes files that mention the primitive by BARE NAME
 * in prose — `auth-error-boundary.test.tsx:90-94` records this repo already
 * going RED on correct code for exactly that reason. ⚠ It NARROWS that class
 * rather than eliminating it (@security-auditor, POLISH.3 S-L3): a doc comment
 * quoting a full tag such as `<PageContainer preset="reading">` would still
 * match and would produce a FALSE RED. That fails loudly, not silently, so it
 * is a maintenance hazard rather than a coverage hole — but do not read the
 * regex as prose-proof.
 *
 * ⚠ Scope is BOTH roots, deliberately. `src/app/(public)` alone would miss
 * site 8, `src/app/(auth)/layout.tsx`, and a guard blind to part of its own
 * domain reads as discharged over all of it.
 */
function treeCallSites(): string[] {
	const found: string[] = [];
	const walk = (rel: string) => {
		for (const entry of readdirSync(join(process.cwd(), rel), {
			withFileTypes: true,
		})) {
			const child = `${rel}/${entry.name}`;
			// A symlink reports isDirectory() === false, so a symlinked ROUTE
			// DIRECTORY would be skipped SILENTLY and any call site behind it would
			// escape this coverage proof with every assertion still green
			// (@security-auditor, POLISH.3 S-L2). Fail loudly instead. `src/` holds
			// none today, so this can only fire on a deliberate introduction.
			if (entry.isSymbolicLink()) {
				throw new Error(
					`symlink under a call-site root, unsupported: ${child}`,
				);
			}
			if (entry.isDirectory()) {
				walk(child);
			} else if (
				/\.tsx?$/.test(entry.name) &&
				/<PageContainer\b[^>]*>/.test(read(child))
			) {
				found.push(child);
			}
		}
	};
	for (const root of CALL_SITE_ROOTS) walk(root);
	return found.sort();
}

/** The real `<PageContainer>` tag at a site: its preset and its className. */
function callSite(file: string): { preset: ContainerPreset; extras: string } {
	// No `s` flag: tsconfig targets ES2017 (TS1501), and it would be inert
	// anyway — there is no `.` here, and `[^>]*` already spans newlines, which
	// is what multi-line call sites like `(public)/not-found.tsx` need.
	const tag = read(file).match(/<PageContainer\b[^>]*>/);
	if (!tag) throw new Error(`no <PageContainer> found in ${file}`);
	const preset = tag[0].match(/preset="([^"]+)"/)?.[1];
	if (!preset || !(preset in CONTAINER_PRESETS)) {
		throw new Error(`${file}: unknown or missing preset ${String(preset)}`);
	}
	return {
		preset: preset as ContainerPreset,
		extras: tag[0].match(/className="([^"]*)"/)?.[1] ?? "",
	};
}

describe("B2 — the container primitive moves nothing", () => {
	it.each(SITES)("site $site ($file) renders its pre-change class set", ({
		file,
		before,
		adds,
		now,
	}) => {
		const { preset, extras } = callSite(file);
		// A site with a RULED move is asserted against `now`; every other site is
		// still asserted against `before + adds`, byte-for-byte as before.
		const expected = asSet(now ?? `${before} ${adds ?? ""}`);
		expect(asSet(cn(CONTAINER_PRESETS[preset], extras))).toEqual(expected);
	});

	it("every moved site names the ruling that moved it, and moves are enumerated", () => {
		// A `now` without a `movedBy` would be a silent rewrite wearing the shape
		// of a deliberate one — the exact failure `before`'s "never edited to
		// match code" contract exists to prevent.
		for (const s of SITES.filter((x) => x.now)) {
			expect(
				s.movedBy,
				`site ${s.site} sets \`now\` with no \`movedBy\``,
			).toBeTruthy();
			expect(s.now).not.toBe(s.before);
		}
		// EXACT, so a second silent move cannot join the first.
		// ⚠ SITE 2 JOINS SITE 5 AT HTML-FINISH · BOOKMARKS round 3, and the two
		// moves are the SAME ruling reaching two routes: `/bookmarks` takes the
		// Profile arrangement, which is a two-column arena, and `reading`'s
		// `max-w-3xl` = 768 caps the container BELOW the `lg` breakpoint at which
		// that arena may become two columns at all. ⛔ THE LIST STAYS EXACT — this
		// is an enumeration of ruled moves, not a permission to drift.
		expect(SITES.filter((s) => s.now).map((s) => s.site)).toEqual([2, 5]);
	});

	it.each(SITES)("site $site ($file) leaves every box axis to the preset", ({
		file,
	}) => {
		// `cn` is twMerge-backed, so a call site passing `px-8` would not read
		// as a conflict — it would SILENTLY replace the preset's `px-4`. That
		// would put D2b back to hunting call sites, which is the whole thing
		// this primitive removes (@code-reviewer, POLISH-1b M3).
		const { extras } = callSite(file);
		for (const axis of BOX_AXES) {
			expect(
				[...asSet(extras)].some((c) => axis.test(c)),
				`${file} className must not set ${axis}`,
			).toBe(false);
		}
	});

	it("covers all nine declaration sites, each exactly once", () => {
		expect(SITES).toHaveLength(9);
		expect(new Set(SITES.map((s) => s.site)).size).toBe(9);
		expect(new Set(SITES.map((s) => s.file)).size).toBe(9);
	});

	it("exactly one site adds a class beyond its c5892bc baseline", () => {
		// If this number moves, a preset started normalising rather than
		// relocating — which is D2b, and D2b is not this commit.
		const adding = SITES.filter((s) => s.adds);
		expect(adding.map((s) => s.site)).toEqual([9]);
		expect(adding[0]?.adds).toBe("w-full");
	});

	/**
	 * SITE 8 IS THE ONLY SPLIT NODE, so the row above cannot prove it alone.
	 *
	 * Every other site is a 1:1 replacement — one element before, one after — so
	 * the container's class set IS the whole element. `(auth)` is not: it was
	 * ONE node at `c5892bc` and is now `<main>` + container. A row checking only
	 * the container passes while blind to whatever stayed on `<main>` — the same
	 * shape as POLISH-1a's V9 half-application, where a green gate saw one of
	 * two labels. So assert the UNION, and the flex chain on `<main>` by name.
	 *
	 * The chain is load-bearing for a fix that has NOT happened yet. `my-auto`
	 * on the sign-in / otp Cards already resolves to zero today (D4: the
	 * wrapper's `min-h-full` collapses against body `height:auto` — POLISH-1-X
	 * measured the card top at 92px, not 484px). What the split preserves is the
	 * LATENT CAPABILITY: with the chain intact, POLISH.7a repairs the wrapper
	 * UPSTREAM-ONLY and the Cards centre with no second fix. Flatten either node
	 * to a block context and `margin-block: auto` computes to zero forever, so
	 * POLISH.7a would need two fixes. Deleting `flex-1` from `<main>` is
	 * invisible today and defeats that repair — hence pinned, not left to review.
	 */
	it("site 8 ((auth)) — the two nodes' UNION equals the pre-change single node", () => {
		const file = "src/app/(auth)/layout.tsx";
		const mainClasses = read(file).match(/<main className="([^"]+)"/)?.[1];
		expect(mainClasses, "(auth) still renders a classed <main>").toBeDefined();

		const { preset, extras } = callSite(file);
		const site8 = SITES.find((s) => s.site === 8);

		const union = asSet(
			`${mainClasses} ${cn(CONTAINER_PRESETS[preset], extras)}`,
		);
		expect(union).toEqual(asSet(site8?.before ?? ""));

		// By name too — a union check alone would pass if the chain migrated
		// wholly onto the container.
		for (const c of ["flex", "flex-1", "flex-col"]) {
			expect(asSet(mainClasses ?? "").has(c), `<main> keeps ${c}`).toBe(true);
		}

		// The box axes stay OFF <main>: it is the landmark and flex child, not
		// the container. This is what keeps D2b a one-preset change later.
		for (const axis of BOX_AXES) {
			expect(
				[...asSet(mainClasses ?? "")].some((c) => axis.test(c)),
				`<main> declares no ${axis} box axis`,
			).toBe(false);
		}
	});

	/**
	 * POLISH.7a D19 — the wrapper's min-height token, pinned by NAME.
	 *
	 * The docblock above describes the collapse this repairs and calls the fix
	 * "NOT happened yet". It has now happened: `min-h-full` -> `min-h-dvh` on the
	 * `(auth)` wrapper, one token, under a line-scoped exception (POLISH-7a §12
	 * P-1). Nothing on disk pinned that token — a grep for `min-h-full` across
	 * `tests/` found exactly one hit and it was a COMMENT. So the repair was
	 * revertible by a one-word edit with no gate, which is the same shape as the
	 * `flex-1` deletion the docblock above pins by name for the same reason.
	 *
	 * ⚠ WHY A VIEWPORT UNIT AND NOT A PERCENTAGE. `min-height:100%` resolves
	 * against the containing block's SPECIFIED height, and `<body>`'s is `auto`.
	 * The first attempt gave `<body>` a definite height instead (shipped `5a11b38`,
	 * REVERTED `1a41b0f`): that makes this wrapper a flex item whose explicit
	 * `min-height:100%` suppresses the flex automatic minimum size, so flex-shrink
	 * CLAMPS it to one viewport while content overflows, and `position:sticky`
	 * — bounded by its containing block — un-sticks `GlobalHeader`. Measured on a
	 * 2000px page: header top 0 / -62 / -562 / -578 at scrollY 0 / 900 / 1400 /
	 * 2000. With `100dvh`: 0 / 0 / 0 / 0. A percentage here is the bug.
	 */
	it("site 8 ((auth)) — the wrapper's min-height is a VIEWPORT unit, not a percentage", () => {
		const wrapper = read("src/app/(auth)/layout.tsx").match(
			/<div className="(flex min-h-[^"]+)"/,
		)?.[1];
		// Alive check: the wrapper node was found at all, so the two assertions
		// below are not reading `undefined`.
		expect(wrapper, "(auth) renders a classed flex wrapper").toBeDefined();
		expect(asSet(wrapper ?? "").has("min-h-dvh")).toBe(true);
		// The percentage form is the defect, not merely a different spelling.
		expect(asSet(wrapper ?? "").has("min-h-full")).toBe(false);
		// The flex chain the docblock above protects is still on this node.
		for (const c of ["flex", "flex-col"]) {
			expect(asSet(wrapper ?? "").has(c), `wrapper keeps ${c}`).toBe(true);
		}
	});

	it("the auth preset describes a BOX only — no flex participation", () => {
		// (auth)'s `flex flex-1 flex-col` rides the CALL SITE, never the preset.
		// A preset is width + inset + padding; baking one caller's layout role
		// into it would make D2b expensive again.
		for (const c of ["flex", "flex-1", "flex-col"]) {
			expect(asSet(CONTAINER_PRESETS.auth).has(c)).toBe(false);
		}
	});

	it("pins the presets — a preset edit is a D2b decision, not a tidy-up", () => {
		// Exact strings, so POLISH .2/.3/.5/.6 changing one is a visible,
		// deliberate diff rather than something that slips through.
		//
		// ⚠ `wide` is the FIFTH, minted at HTML-FINISH · PROFILE row 20. The four
		// originals are BYTE-UNCHANGED above and below it, which is the whole
		// claim: the mint was ADDITIVE. Its `max-w-[1440px] px-6` is byte-carried
		// from `GlobalHeader.tsx:91`, the widest surface wrapper on `main`; its
		// `py-6` is `reading`'s. Nothing here is read off a mockup.
		expect(CONTAINER_PRESETS).toEqual({
			reading: "mx-auto w-full max-w-3xl px-4 py-6",
			debate: "mx-auto w-full max-w-5xl px-6 py-8",
			auth: "mx-auto w-full max-w-md px-4 py-8",
			notice: "mx-auto w-full max-w-3xl px-4 py-24",
			wide: "mx-auto w-full max-w-[1440px] px-6 py-6",
		});
	});

	it("the minted `wide` preset carries the GlobalHeader value it claims", () => {
		// ⛔ THE BYTE-CARRY, ASSERTED AGAINST THE SOURCE FILE rather than restated
		// as a literal. A trace that only lives in a comment goes stale silently;
		// this one reddens if `GlobalHeader` ever changes its wrapper, which is
		// exactly when the profile's alignment to its own chrome would break.
		const header = read("src/components/shell/GlobalHeader.tsx");
		const wrapper = /<div className="([^"]*max-w-\[[^\]]+\][^"]*)"/.exec(
			header,
		);
		expect(
			wrapper,
			"GlobalHeader no longer renders a max-w-[…] wrapper",
		).toBeTruthy();
		const headerClasses = asSet(wrapper?.[1] ?? "");
		const wideClasses = asSet(CONTAINER_PRESETS.wide);
		for (const c of [...wideClasses].filter(
			(x) => x.startsWith("max-w-") || x === "px-6",
		)) {
			expect(
				headerClasses.has(c),
				`\`wide\` claims to byte-carry \`${c}\` from GlobalHeader.tsx, but ` +
					`the header no longer declares it. Re-derive the profile's ` +
					`container width against the header, or the page will stop ` +
					`aligning with its own chrome.`,
			).toBe(true);
		}
	});

	it("every preset carries all three axes — none may be half-declared", () => {
		for (const [name, classes] of Object.entries(CONTAINER_PRESETS)) {
			const set = asSet(classes);
			for (const axis of BOX_AXES) {
				expect(
					[...set].some((c) => axis.test(c)),
					`${name} declares ${axis}`,
				).toBe(true);
			}
		}
	});

	/**
	 * POLISH.3 §18 R-a — the declared set and the tree agree, asserted BOTH ways.
	 *
	 * ⚠ THE TWO DIRECTIONS ARE NOT REDUNDANT, and only one of them could go red
	 * when they were introduced (POLISH.3 PR 1, `9468c30`, 2026-08-13).
	 *
	 * AT THE MOMENT THE PAIR WAS WRITTEN — `9468c30^`, before `error.tsx`
	 * existed — the tree held NINE call sites and all nine were in `SITES`, so
	 * the membership loop below could not fail. The RED that proved the pair
	 * non-vacuous came from the SECOND direction only, where `GREENFIELD` named
	 * a file disk did not have yet. The loop is kept because it is the direction
	 * that catches a FUTURE undeclared call site, which is the escape this pair
	 * exists to close.
	 *
	 * ⚠ AND `GREENFIELD` IS WHY THE LOOP IS STILL GREEN. `9468c30` CREATED
	 * `error.tsx`, so AT that commit — and at every commit since — the tree
	 * holds TEN, and the loop passes because the declared set is `SITES` (9)
	 * ∪ `GREENFIELD` (1). The nine above describes `9468c30^`, not `9468c30`;
	 * conflating the two is what an earlier draft of this docblock did.
	 *
	 * ⚠ BOTH NUMBERS ARE DATED MEASUREMENTS, NOT STANDING FACTS. Nothing here
	 * counts nine TREE CALL SITES at run time — the `SITES`-length assertions
	 * further down count the DECLARATION set, which is a different quantity.
	 * The tree count that IS asserted is the floor below.
	 */
	it("every <PageContainer> on the tree is declared in SITES or GREENFIELD", () => {
		const declared = new Set([
			...SITES.map((s) => s.file),
			...GREENFIELD.map((g) => g.file),
		]);
		// N1 non-vacuity floor. A `for` over an EMPTY walk passes silently, so a
		// broken root path or a regex that stopped matching would read as a green
		// coverage proof. `side-badge.test.tsx` installs the same floor for the
		// same hazard. The second direction below would also catch an empty walk,
		// but only as a side effect — this makes it explicit and independent.
		//
		// TEN is the POST-`error.tsx` measurement: the nine `SITES` files plus
		// the one `GREENFIELD` file, counted on the tree at `9468c30` and every
		// commit since. It is a FLOOR, not an equality — a tenth-plus site is
		// caught by the membership loop below, not by this line.
		expect(treeCallSites().length).toBeGreaterThanOrEqual(10);
		for (const file of treeCallSites()) {
			expect(
				declared.has(file),
				`${file} renders <PageContainer> but is declared in neither SITES nor GREENFIELD`,
			).toBe(true);
		}
	});

	it("every file declared in SITES or GREENFIELD is a real call site on disk", () => {
		const tree = new Set(treeCallSites());
		for (const file of [
			...SITES.map((s) => s.file),
			...GREENFIELD.map((g) => g.file),
		]) {
			expect(
				tree.has(file),
				`${file} is declared but renders no <PageContainer> on disk`,
			).toBe(true);
		}
	});

	/**
	 * GREENFIELD sites get the box-axis rule too (@code-reviewer, POLISH.3 M1).
	 *
	 * The `it.each(SITES)` row above cannot reach them, so a greenfield call site
	 * could pass `px-8` and SILENTLY replace its preset's `px-6` through `cn`'s
	 * twMerge — exactly the drift that row exists to stop, and exactly what would
	 * put D2b back to hunting call sites. ⚠ The `before`-baseline objection that
	 * correctly keeps these files OUT of `SITES` (§18 R-a) does not apply here:
	 * this reads only `callSite(file).extras` and needs no `c5892bc` baseline.
	 */
	it.each(GREENFIELD)("greenfield $file leaves every box axis to the preset", ({
		file,
	}) => {
		// CONTAINMENT BEFORE READ (@security-auditor, POLISH.3 S-L1). `callSite`
		// resolves through `join(process.cwd(), …)`, which normalises `..`, so a
		// declared path pointing outside the two roots would be READ here and
		// could pass this row in isolation. Membership in the walk's own output is
		// the check: every string it emits is root-prefixed by construction.
		expect(
			treeCallSites().includes(file),
			`${file} must be a real call site under ${CALL_SITE_ROOTS.join(" or ")}`,
		).toBe(true);
		const { extras } = callSite(file);
		for (const axis of BOX_AXES) {
			expect(
				[...asSet(extras)].some((c) => axis.test(c)),
				`${file} className must not set ${axis}`,
			).toBe(false);
		}
	});
});
