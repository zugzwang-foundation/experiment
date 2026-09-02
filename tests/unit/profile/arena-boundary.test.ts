import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE GUARD FOR A DEFECT THAT WAS INVISIBLE FROM ITS OWN CALL SITE.
 *
 * `ProfileArena` code-splits `PositionsTable` with `next/dynamic`. It shipped as
 * `{ ssr: true }` with no `loading`, and that one omission decided something no
 * reviewer would infer from reading the call: Next resolves
 * `hasSuspenseBoundary = !opts.ssr || !!opts.loading`, so that exact shape
 * yields a Fragment and NO local Suspense boundary. The suspension escaped to
 * the route segment, and a client-side navigation showed the whole-page skeleton
 * until one chunk arrived.
 *
 * ⛔ WITHOUT THIS FILE THE FIX IS SILENTLY REVERTIBLE. Deleting `loading:`
 * returns every other suite to green — measured, not assumed: the same tests
 * passed against the bare form for the whole lane it was broken in. A defect
 * whose absence nothing asserts is a defect waiting for the next refactor.
 *
 * These are SOURCE SCANS, following `initial-selection.test.ts`'s idiom for this
 * repo. jsdom performs no layout and cannot observe a Suspense boundary's effect
 * on a grid, so the property is pinned where it is decided — in the source.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const ARENA = "src/components/profile/ProfileArena.tsx";
const POSITIONS = "src/components/profile/PositionsTable.tsx";
const ARGUMENTS = "src/components/profile/ArgumentList.tsx";

/** The panel shell's outer box. All three copies must agree on this one. */
const PANEL_ROOT =
	"flex min-h-0 flex-col overflow-hidden rounded-[var(--r)] bg-n0 [border:var(--hairline)]";

describe("ProfileArena — the lazy boundary and the shell it stands in for", () => {
	it("arena::THE-DYNAMIC-IMPORT-CARRIES-A-loading", () => {
		const src = read(ARENA);

		// The positive control for the whole file: there IS a dynamic import here.
		// Without this, a rename or a removal would make every assertion below
		// vacuously true against a file that no longer splits anything.
		expect(src).toContain("dynamic(");
		expect(src).toContain('import("./PositionsTable")');

		// `loading` is what flips `hasSuspenseBoundary`. `ssr: true` alone does not.
		expect(src).toMatch(/loading:\s*\(\)\s*=>/);
	});

	it("arena::THE-FALLBACK-OCCUPIES-THE-GRID-CELL", () => {
		// `ProfileArena` returns a FRAGMENT, so both panels are direct children of
		// the page's `lg:grid-cols-2` band. A fallback rendering nothing leaves ONE
		// child and `ArgumentList` slides into column one — a column reassignment,
		// not a height collapse. The fallback must therefore be a real box.
		expect(read(ARENA)).toContain(PANEL_ROOT);
	});

	it("arena::THE-LANDMARK-NAME-DOES-NOT-MOVE-WHEN-THE-CHUNK-LANDS", () => {
		// Both the fallback and the real panel are `<section>` with an accessible
		// name, so both are `region` landmarks. Renaming one as it loads makes the
		// panel un-findable by name for a screen-reader user mid-navigation — the
		// same rule `panel-filter.test.tsx` already ratifies for the sibling panel.
		// Transient state belongs on `aria-busy`, which is why that is there.
		const src = read(ARENA);
		expect(src).toContain('aria-label="Positions"');
		expect(src).not.toContain('aria-label="Positions loading"');
		expect(src).toContain('aria-busy="true"');
	});

	it("arena::THE-SHELL-COPIES-HAVE-NOT-DRIFTED", () => {
		// The shell is written out here rather than imported, because the real one
		// is module-private inside a ~1,519-line `PositionsTable.tsx` and importing
		// it would pull that module back into the initial chunk — undoing the split
		// the boundary exists to protect. That trade costs a third copy, and
		// nothing pinned the copies together until this assertion.
		for (const file of [ARENA, POSITIONS, ARGUMENTS]) {
			expect(read(file)).toContain(PANEL_ROOT);
		}
	});
});
