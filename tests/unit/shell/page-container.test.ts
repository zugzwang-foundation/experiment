// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
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

const asSet = (s: string) => new Set(s.split(/\s+/).filter(Boolean));
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

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
	}) => {
		const { preset, extras } = callSite(file);
		const expected = asSet(`${before} ${adds ?? ""}`);
		expect(asSet(cn(CONTAINER_PRESETS[preset], extras))).toEqual(expected);
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

	it("pins the four presets — a preset edit is a D2b decision, not a tidy-up", () => {
		// Exact strings, so POLISH .2/.3/.5/.6 changing one is a visible,
		// deliberate diff rather than something that slips through.
		expect(CONTAINER_PRESETS).toEqual({
			reading: "mx-auto w-full max-w-3xl px-4 py-6",
			debate: "mx-auto w-full max-w-5xl px-6 py-8",
			auth: "mx-auto w-full max-w-md px-4 py-8",
			notice: "mx-auto w-full max-w-3xl px-4 py-24",
		});
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
});
