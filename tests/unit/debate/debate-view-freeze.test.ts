import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UI-QUICK change set 3 §D — THE SUB-VIEW FREEZE COVERS THE RESOLUTION DIALOG.
 *
 * WHAT THIS GUARD IS FOR. `design-canon.md` §5:100 ratifies a "Sub-view freeze:
 * composer (`slot.bet`) / `+` popover (`body.ppop`) / debate (`body.postview`)
 * hides controls and freezes both columns", and `DebateView` implements it as a
 * single `frozen` predicate threaded into both scrollers' `auto` config. The
 * predicate is a hand-maintained OR over one state variable per sub-view, which
 * makes it exactly the kind of list that silently falls out of date: adding a
 * sixth sub-view and forgetting the sixth term costs nothing at compile time and
 * nothing at render time. It cost exactly that once — `ResolutionPopup` shipped
 * in change set 2 holding its `open` flag locally inside `ResolutionCriterion`,
 * invisible to this predicate, and the carousel advanced behind the modal.
 *
 * ⚠⚠ WHY A SOURCE SCAN AND NOT A RENDER TEST, stated because the weaker choice
 * is the tempting one. Proving the behaviour by render means mounting
 * `DebateView`, which drags in `BetComposer`, the bet server actions, the quote
 * reader and the R2 upload chain — and a mock deep enough to host that stack
 * would be proving the mock rather than the component.
 * `head-zone.test.tsx` states the same limit for the same reason, and
 * `debate-height-chain.test.ts` is the same technique. What is being asserted
 * here IS a claim about the source: that a particular state variable appears in
 * a particular expression.
 *
 * ⛔ FENCE BY SYMBOL, NEVER BY LINE (O-8). Everything below names an identifier —
 * `frozen`, `criterionOpen`, `setCriterionOpen` — and no line number is
 * load-bearing.
 *
 * ⚠⚠ THIS GUARD WAS WATCHED FAILING BEFORE IT WAS TRUSTED (V-2). With
 * `criterionOpen` removed from the `frozen` initialiser, the first assertion
 * below goes RED with `expected false to be true`; with the `useState` line
 * removed as well, the third goes RED too. A guard nobody has seen fail is a
 * guard nobody has tested.
 */

const ROOT = process.cwd();
const VIEW = "src/components/debate/DebateView.tsx";
const source = readFileSync(join(ROOT, VIEW), "utf8");

/**
 * The right-hand side of `const frozen = … ;` — the whole OR chain, comments
 * included. Anchored on the declaration rather than on a line range so the
 * expression can grow, be reformatted, or gain further terms without this guard
 * needing to be re-derived.
 */
function frozenExpression(): string {
	const start = source.indexOf("const frozen =");
	if (start === -1) {
		throw new Error(
			`${VIEW}: no \`const frozen =\` declaration. If the sub-view freeze was ` +
				`restructured, re-derive this guard rather than deleting it.`,
		);
	}
	const end = source.indexOf(";", start);
	if (end === -1) {
		throw new Error(`${VIEW}: \`const frozen =\` never terminates.`);
	}
	return source.slice(start, end);
}

describe("the sub-view freeze — every sub-view stops the carousel", () => {
	it("debate-freeze::the-resolution-dialog-is-IN-the-frozen-predicate", () => {
		const expr = frozenExpression();

		// ⛔ THE ASSERTION THIS FILE EXISTS FOR. Remove `criterionOpen` from the
		// predicate and this goes red — which is the failure that was observed
		// before this guard was trusted.
		expect(expr.includes("criterionOpen")).toBe(true);
	});

	it("debate-freeze::the-five-original-sub-views-are-STILL-in-the-predicate", () => {
		const expr = frozenExpression();

		// Non-vacuity, and regression cover for the other five. A guard that only
		// checked the newest term would pass on a predicate that had lost the
		// lightbox — so every sub-view canon §5:100 covers is named.
		for (const flag of [
			"openSide",
			"openReply",
			"popupPost",
			"popupReply",
			"lightboxUrl",
		]) {
			expect(expr.includes(flag)).toBe(true);
		}
	});

	it("debate-freeze::the-dialog-state-is-OWNED-by-DebateView-not-the-criterion", () => {
		// ⛔ THE STRUCTURAL HALF. The predicate can only see a flag that lives in
		// this component; a `criterionOpen` that were merely PASSED IN would put
		// the source of truth back inside `ResolutionCriterion`, which is the
		// arrangement that produced the defect. The `useState` declaration is what
		// makes `DebateView` the owner.
		expect(source).toContain("const [criterionOpen, setCriterionOpen] =");
		expect(source).toContain("useState(false)");

		// …and it is actually handed to the header, rather than owned and dropped.
		expect(source).toContain("criterion={{");
		expect(source).toContain("onOpenChange: setCriterionOpen");
	});

	it("debate-freeze::the-predicate-is-threaded-into-BOTH-scrollers", () => {
		// One `frozen` reaching one column would freeze half the arena. The
		// market arm's `PostScroller` and the post arm's `ReplyScroller` each take
		// it inside their own `auto={{ … }}` config, so the count is two.
		const threaded = source.match(/\n\s*frozen,\n/g) ?? [];
		expect(threaded.length).toBe(2);
	});
});
