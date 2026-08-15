import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * HTML-FINISH · PROFILE — the height chain, and the pin that terminates it.
 *
 * WHAT THIS GUARD IS FOR. `/u/[pseudonym]` now composes TWO BANDS (row 1), and
 * row 3 asks the positions panel for a three-row window that "fills the panel",
 * with the fourth row and later reached by scrolling INSIDE the panel. That
 * needs a DEFINITE panel height, which needs every ancestor from `<main>` down
 * to pass its slack on. It does not: the chain stops at `PageContainer`, which
 * declares no `flex-1`.
 *
 * ⚠⚠ AND IT STOPS THERE BY A PIN IN A DIFFERENT FILE, WHICH IS WHY THIS GUARD
 * EXISTS. `tests/unit/shell/page-container.test.ts` site 5 pins this call
 * site's RESOLVED class set by exact equality, so adding `flex-1` to it reddens
 * that suite; and its `BOX_AXES` forbids a `max-w-*` on the same className, so
 * the wide preset (row 20) is closed off by the same row. Neither fact is
 * visible from `page.tsx`, from the mockup, or from any test that renders the
 * profile. Without this file, the next session reads recon §4.1's "CHAIN ENDS
 * HERE", adds `flex-1`, gets a red in a shell suite it did not touch, and has
 * to re-derive the whole story.
 *
 * ⚠ THE INTERESTING ASSERTION IS THE ONE THAT REDDENS WHEN THE BLOCK IS LIFTED.
 * `terminus-is-still-pinned-in-page-container` reads the OTHER FILE and fails
 * the moment site 5 stops pinning `max-w-3xl`. That is deliberate: when the
 * founder unblocks row 20, this guard goes RED and says "the chain is now
 * completable — finish it", instead of leaving row 3 quietly unbuilt forever.
 * A blocked row that no test mentions is indistinguishable from a forgotten one.
 *
 * ⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST. jsdom performs no layout: it
 * resolves no `calc()`, no `100vh`, no percentage height and no Tailwind
 * utility, so a render test structurally cannot see any of this.
 * `discovery-height-chain.test.ts:19-24` states the same limit for the same
 * reason, and this file follows its shape. Resolved geometry is proven in a
 * browser against compiled CSS — which is not a thing CI does.
 *
 * ⚠ V-REGISTER DISCIPLINE. This reads the SHIPPED FILES. It does not rebuild a
 * lookalike class string and check that against itself.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const LAYOUT = "src/app/(public)/layout.tsx";
const CONTAINER = "src/components/shell/PageContainer.tsx";
const PAGE = "src/app/(public)/u/[pseudonym]/page.tsx";
const PAGE_CONTAINER_GUARD = "tests/unit/shell/page-container.test.ts";

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
 * The predicate, as a pure function of the file contents — so the POSITIVE
 * CONTROLS below run the REAL check over mutated sources and prove it reddens,
 * rather than merely observing that it passes today.
 */
function chainTerminatesAtTheContainer(pageSource: string): boolean {
	return !containerExtras(pageSource).split(/\s+/).includes("flex-1");
}

/** RULED A1 — the utilities that would CLIP the profile instead of letting it
 * grow and scroll. `(public)/layout.tsx:103-107` states the rule for the page
 * chain: "⛔ `min-h-*`, never `h-*`, and NO `min-h-0` anywhere in the chain".
 * ⛔ SCOPED TO THE PAGE-LEVEL NODES — the container and the two bands. A leaf
 * panel's `overflow-hidden` (which rounds its own corner) is not in this set
 * and is not what A1 governs. */
const A1_FORBIDDEN = [
	/^h-screen$/,
	/^h-dvh$/,
	/^h-full$/,
	/^min-h-0$/,
	/^h-\[/,
];

describe("profile height chain — the terminus, and the pin that holds it", () => {
	it("profile-height-chain::guard-is-alive", () => {
		// A guard that silently matched nothing passes every assertion below
		// vacuously — the recorded N1/H-1 failure mode in this directory. Every
		// extractor must find a real value in a real file.
		expect(containerExtras(read(PAGE)).length).toBeGreaterThan(0);
		expect(bandClasses(read(PAGE), "profile-headzone").length).toBeGreaterThan(
			0,
		);
		expect(bandClasses(read(PAGE), "profile-arena").length).toBeGreaterThan(0);
		// The layout's viewport floor is the chain's SOURCE. If it ever stops
		// being a `min-h-*` calc there is no slack to pass on at all.
		expect(read(LAYOUT)).toContain("min-h-[calc(100vh-");
		// And the container preset the profile rides still exists.
		expect(read(CONTAINER)).toContain("reading:");
	});

	it("profile-height-chain::the-chain-terminates-at-the-container", () => {
		// The measured state, pinned so it cannot change silently in EITHER
		// direction. Recon §4.1: "⚠ ── CHAIN ENDS HERE ── the container declares
		// NO `flex-1` and NO `min-h-0`, so `main`'s floor is not passed to any
		// child."
		expect(
			chainTerminatesAtTheContainer(read(PAGE)),
			`The profile's PageContainer call site now declares \`flex-1\`, so the ` +
				`chain no longer terminates there. That is the RIGHT direction — but ` +
				`it must be finished: the arena band and both arena panels need to ` +
				`grow too, or the slack stops one node lower and row 3 still has no ` +
				`definite height to divide into thirds. See this file's docblock.`,
		).toBe(true);
	});

	it("profile-height-chain::terminus-is-still-pinned-in-page-container", () => {
		// ⚠ THE ASSERTION THAT REDDENS WHEN THE BLOCK IS LIFTED. This reads the
		// OTHER FILE — the shell guard that makes the terminus non-negotiable —
		// and fails the moment site 5 stops pinning `max-w-3xl` on this call site.
		// When that happens, row 20 (the wide preset) and row 3 (the three-row
		// window) both become buildable, and this red is the prompt to build them.
		const guard = read(PAGE_CONTAINER_GUARD);
		expect(
			guard,
			`${PAGE_CONTAINER_GUARD} no longer names the profile page as a pinned ` +
				`call site. If site 5 was retired or repointed, HTML-FINISH rows 3 ` +
				`and 20 are now UNBLOCKED — build them, then update this guard.`,
		).toContain('file: "src/app/(public)/u/[pseudonym]/page.tsx"');
		expect(
			guard,
			`${PAGE_CONTAINER_GUARD} site 5 no longer pins \`max-w-3xl\` on the ` +
				`profile container. Rows 3 and 20 are UNBLOCKED — see this file's ` +
				`docblock for what "finishing the chain" means.`,
		).toContain("mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6");
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
		// ⚠ PROOF BY REVERSAL. A negative assertion never observed to fail is
		// indistinguishable from one that CANNOT fail. These run the REAL
		// predicates over the REAL file contents with one byte-level change each.
		const page = read(PAGE);

		// Control 0 — unmutated, the predicate holds. Without this the mutations
		// below could all be "failing" for an unrelated reason.
		expect(chainTerminatesAtTheContainer(page)).toBe(true);

		// 1. The chain is completed at the container — the exact edit this guard
		//    is waiting for, and the exact edit that reddens the shell suite.
		expect(
			chainTerminatesAtTheContainer(
				page.replace(
					'className="flex flex-col gap-6"',
					'className="flex flex-1 flex-col gap-6"',
				),
			),
		).toBe(false);

		// 2. A band gains a clipping utility. Run through the SAME A1 predicate
		//    the assertion above uses, so the two cannot drift apart.
		const arenaClass = bandClasses(page, "profile-arena").join(" ");
		const clipped = page.replace(
			`"profile-arena" className="${arenaClass}"`,
			`"profile-arena" className="h-screen ${arenaClass}"`,
		);
		const clippedClasses = bandClasses(clipped, "profile-arena");
		expect(
			A1_FORBIDDEN.some((re) => clippedClasses.some((c) => re.test(c))),
		).toBe(true);
		// …and the unmutated band does NOT trip it, so the check discriminates.
		expect(
			A1_FORBIDDEN.some((re) =>
				bandClasses(page, "profile-arena").some((c) => re.test(c)),
			),
		).toBe(false);

		// 3. The extractors THROW rather than silently returning nothing when the
		//    node they name is gone — the difference between a guard that reports
		//    a restructure and one that passes vacuously through it.
		expect(() => containerExtras("export default function P() {}")).toThrow();
		expect(() => bandClasses(page, "profile-nonexistent-band")).toThrow();
	});
});
