// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: () => undefined,
		refresh: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";

import { VIEWER } from "../../composer/render/_harness";
import { baseModel } from "./_posted-fixtures";

/**
 * RPLY-1 · R1 · G1-WIRED — THE COMPOSER **OPENS** IN THE COLUMN OPPOSITE THE
 * BET. End-to-end, through a real click, on a real `DebateView`.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE `reply-composer-column.test.ts` WAS NOT ENOUGH,
 * AND THE GAP IS WORTH STATING PRECISELY BECAUSE IT IS EASY TO REPEAT. That file
 * is a good test of `replyComposerColumn` — its four rows are stated literals,
 * it never reads the badge, and reverting the helper's body reds four of its six
 * tests. But `replyComposerColumn` is code the FIX INTRODUCED. The DEFECT lived
 * in an expression in `DebateView`, and a helper cannot guard its own call site.
 *
 * ⛔⛔ THE ESCAPE THAT PROVED IT, found by `@test-writer` and reproduced before
 * this file was written. Keep every textual pin in `side-identity.test.tsx`
 * byte-satisfied — the `opposite(` census, the superseded-form negative, the
 * `replyComposerColumn({` positive — and pass the helper a CONSTANT:
 *
 *     composerColumn = replyComposerColumn({
 *         parentSide: selectedPost.sideAtPostTime,
 *         relation: "support",          // ← instead of `openReply`
 *     })
 *
 * Support inherits its parent's side, so that is `opposite(parent)` exactly: the
 * original defect, verbatim, with a Counter opening on top of the side it is
 * betting. Measured: all eight RPLY-1 guards green, 2415 unit tests green.
 * ⇒ Making `relation` a REQUIRED parameter stops a BARE revert at the compiler.
 * It says nothing about which VALUE is passed, and this file is the half that
 * does.
 *
 * ⚠ THE PREMISE THAT MADE THIS FILE LOOK IMPOSSIBLE WAS ALREADY FALSE.
 * `side-identity.test.tsx` and `header-mirror.test.ts` both explain their source
 * scans by saying `DebateView` cannot be mounted "without the whole bet stack".
 * R2's `history-ladder.test.tsx` mounts it with nothing but `baseModel()` and
 * `VIEWER` and drives clicks through it. Those docblocks are true about what
 * THEY assert and were read — by me — as a general prohibition. They are not.
 *
 * ⛔ IT ASSERTS THE COLUMN, NEVER THE BADGE. The badge renders `resultingSide`,
 * which was ALREADY correct before R1, so a badge-reading test is green on both
 * sides of the defect. The subject here is which arena child holds the OPEN
 * composer slot — the one fact the defect actually got wrong.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const ROUTE = "/m/mumbai-metro-line-3-1m-riders";

beforeEach(() => {
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
	history.replaceState(null, "", ROUTE);
});
afterEach(() => {
	cleanup();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

/**
 * Which arena column holds the OPEN composer slot.
 *
 * ⚠ Read by the arena's child ORDER (0 = YES, 1 = NO) rather than by a class,
 * because the columns are rendered from `["YES","NO"] as const` in that order
 * and a styling class is not a stable way to name the thing under test
 * (OVN-V5). The `data-debate-column` attribute is asserted to agree below, so a
 * reordering of the map cannot silently invert this reading either.
 */
function hostingColumn(): "YES" | "NO" | null {
	const arena = document.querySelector('[data-testid="arena"]');
	const cols = Array.from(arena?.children ?? []);
	for (const [i, col] of cols.entries()) {
		if (
			col.querySelector('[data-testid="composer-slot"][data-state="open"]') !==
			null
		) {
			const declared = col
				.querySelector("[data-debate-column]")
				?.getAttribute("data-debate-column");
			const byOrder = i === 0 ? "YES" : "NO";
			if (declared !== null && declared !== undefined && declared !== byOrder) {
				throw new Error(
					`arena child ${i} reads ${byOrder} by order but ${declared} by attribute`,
				);
			}
			return byOrder;
		}
	}
	return null;
}

/**
 * `cmt-p1` is a YES parent in the fixture. Support inherits ⇒ bets YES ⇒ the
 * composer hosts in NO. Counter opposes ⇒ bets NO ⇒ hosts in YES.
 *
 * ⛔ SUPPORT IS THE ROW THAT PASSES UNDER THE DEFECT, and it is kept precisely
 * so this file is not a single-case test that happens to be about Counter. Under
 * `opposite(parent)` the Support row is CORRECT by arithmetic accident — a
 * Support bet inherits its parent's side, so opposite-the-parent and
 * opposite-the-bet are the same pole. Its passing is the control that says the
 * Counter row's failure is about the RELATION and not about the harness.
 */
const CASES = [
	{ relation: "Support", bets: "YES", hosts: "NO" },
	{ relation: "Counter", bets: "NO", hosts: "YES" },
] as const;

describe("R1 — the composer opens in the column opposite the BET (wired)", () => {
	for (const c of CASES) {
		it(`column-binding::${c.relation}-on-a-YES-parent-bets-${c.bets}-and-hosts-in-${c.hosts}`, () => {
			render(
				<DebateView
					model={baseModel()}
					viewer={VIEWER}
					initialPostId="cmt-p1"
					ownPseudonym={null}
				/>,
			);
			// ⚠ The trigger is found by the accessible name it ALREADY carries,
			// which names the resulting bet side — so the fixture's own labelling
			// confirms `bets` before the column is read.
			const trigger = document.querySelector<HTMLButtonElement>(
				`[aria-label="${c.relation} — bet ${c.bets}"]`,
			);
			expect(trigger).not.toBeNull();

			expect(hostingColumn()).toBeNull(); // nothing open yet
			act(() => {
				fireEvent.click(trigger as HTMLButtonElement);
			});

			// Positive control: a composer actually opened SOMEWHERE. Without it the
			// two assertions below would both hold against a surface that opened
			// nothing at all.
			expect(hostingColumn()).not.toBeNull();
			// ⛔ THE BINDING THIS FILE EXISTS FOR.
			expect(hostingColumn()).toBe(c.hosts);
			// …and stated as the PROPERTY as well as the value: the composer never
			// covers the side being bet. That is design-canon §3.3's actual reason.
			expect(hostingColumn()).not.toBe(c.bets);
		});
	}

	it("column-binding::the-two-relations-open-in-DIFFERENT-columns", () => {
		// ⛔⛔ THE DEFECT, STATED AS ONE ASSERTION. Under `opposite(parent)` — and
		// under any constant relation fed to the helper — both relations opened in
		// the SAME column, and that identity IS the bug. Asserted end-to-end here,
		// not over the helper.
		render(
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId="cmt-p1"
				ownPseudonym={null}
			/>,
		);
		const open = (relation: "Support" | "Counter", bets: "YES" | "NO") => {
			const b = document.querySelector<HTMLButtonElement>(
				`[aria-label="${relation} — bet ${bets}"]`,
			);
			act(() => {
				fireEvent.click(b as HTMLButtonElement);
			});
			const where = hostingColumn();
			act(() => {
				fireEvent.click(b as HTMLButtonElement);
			}); // toggle closed
			return where;
		};
		const support = open("Support", "YES");
		const counter = open("Counter", "NO");
		expect(support).not.toBeNull();
		expect(counter).not.toBeNull();
		expect(support).not.toBe(counter);
	});
});
