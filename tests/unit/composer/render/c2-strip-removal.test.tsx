// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import * as composerCopy from "@/components/debate/composer/copy";
import { floorFor } from "@/components/debate/composer/gating";

import { composerProps, stubWireFetch, VIEWER } from "./_harness";

/**
 * POLISH.4 PR B · R4 — `c2Strip` IS REMOVED FROM `copy.ts`, WITH ITS
 * MANDATORY POSITIVE CONTROL.
 *
 * `PD-4-05` / `PD-5-07` / `L-7`: `c2Strip` resolves to exactly one site
 * tree-wide (`composer/copy.ts`) with ZERO consumers in `src/` or `tests/`.
 * `OD-3` is RATIFIED — **remove** it. Plan §8 row 5 (`N1`/`N3`) makes the
 * positive control MANDATORY, not optional: a removal test with no live
 * sibling assertion proves nothing, because deleting the whole module would
 * pass it.
 *
 * So this file asserts BOTH halves:
 *   1. `c2Strip` is not an export of `copy.ts`             — RED at `8db535d`
 *   2. `c2Sentence` still EXISTS and still REACHES THE RENDER
 *      (the floor-above-balance strip in `BetComposer`)    — the positive
 *      control; green before AND after, by design.
 *
 * ⚠ The removal is the ONE authorised exception to POLISH-4 §7's no-edit
 * table, and it is authorised for `c2Strip` alone.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * Strictly below any positive floor — `floorFor("post")` is `BET_MIN_STAKE_POST`
 * and the C2 state is `spendableToday < floor`. Derived, so a HARDEN.5 floor
 * retune cannot silently drop this test out of the state it is testing.
 */
const SPENDABLE_BELOW_FLOOR = "0";

describe("copy.ts::c2Strip is removed (R4 / PD-4-05, OD-3)", () => {
	it("copy::c2Strip-is-not-an-export", () => {
		expect(Object.keys(composerCopy)).not.toContain("c2Strip");
		expect("c2Strip" in composerCopy).toBe(false);
	});

	it("copy::positive-control-c2Sentence-still-reaches-the-render", () => {
		// (a) the sibling export survives …
		expect(typeof composerCopy.c2Sentence).toBe("function");

		// (b) … and is still CONSUMED: the floor-above-balance strip renders it
		// verbatim. Without this, removing `c2Strip` proves nothing.
		stubWireFetch([]);
		const props = composerProps();
		const { container } = render(
			<BetComposer
				{...props}
				viewer={{
					...VIEWER,
					balance: SPENDABLE_BELOW_FLOOR,
					spendableToday: SPENDABLE_BELOW_FLOOR,
				}}
			/>,
		);
		const expected = composerCopy.c2Sentence({
			floor: floorFor(props.kind),
			spendable: SPENDABLE_BELOW_FLOOR,
		});
		expect(container.innerHTML).toContain(expected);
	});
});
