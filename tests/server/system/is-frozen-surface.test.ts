import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ENGINE.16 §5.6 tests-first (charter row (e)) — the §20.3 structural guard. The
// freeze read-guard `isFrozen()` is wired onto EXACTLY the two state-mutating
// surfaces (participant bet endpoints via the shared `runBetEndpoint`, and the
// automated W-4 close-due cron) and onto NOTHING else: admin paths (resolve /
// correct / void), the W-3/W-4 transaction wrappers, and read/auth paths stay
// UNGATED (§20.3). This is a SOURCE-GREP guard — it reads the files as TEXT via
// `node:fs` (never imports the modules), so it makes no IO and has no DB.
//
// The "present in the two gated surfaces" assertions are the TEETH: they fail
// now (zero `isFrozen` occurrences anywhere in src/ today — P0 recon) → RED,
// and go green when S2 wires the two gates. The "absent from the ungated paths"
// assertions PASS now and pin the §20.3 contract against future over-gating.

function src(relativeFromRepoRoot: string): string {
	const url = new URL(`../../../${relativeFromRepoRoot}`, import.meta.url);
	return stripComments(readFileSync(fileURLToPath(url), "utf8"));
}

/**
 * Remove `//` line comments and block comments before matching.
 *
 * ⚠ **THIS IS A CORRECTNESS FIX AND THE REGISTER NAMES SIX PRIOR INSTANCES.**
 * The guard's subject is a CALL, and a raw text match cannot tell a call from a
 * sentence about one. LIQ-1 Phase 2 added a docblock to `open.ts` explaining
 * why `isFrozen()` must NOT be used there — the exact rule this file enforces —
 * and the guard went red on it: a negative assertion catching the comment that
 * explains the absence, certifying a defect that was documentation.
 *
 * Stripping is deliberately crude and that is fine: it only has to be
 * conservative in one direction. Removing too much can only make a MUST-appear
 * assertion fail loudly; it cannot make a MUST-NOT-appear assertion pass
 * silently, because a real call is never inside a comment.
 */
function stripComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.split("\n")
		.map((line) => line.replace(/\/\/.*$/, ""))
		.join("\n");
}

// The two gated surfaces — `isFrozen` MUST appear (the wiring).
const GATED = [
	"src/server/bets/endpoint.ts",
	"src/app/api/cron/close-due-markets/route.ts",
];

// The ungated paths — `isFrozen` MUST NOT appear (§20.3 admin/read/auth
// exemption + the W-3/W-4 lock-order isolation).
const UNGATED = [
	"src/server/resolution/settle.ts",
	"src/server/resolution/correct.ts",
	"src/server/resolution/void.ts",
	"src/server/resolution/transaction.ts",
	"src/server/markets/transaction.ts",
	"src/server/markets/close.ts",
	"src/server/markets/create.ts",
	"src/server/admin/wire.ts",
	"src/server/auth/index.ts",
];

/**
 * ⚠ `open.ts` IS FREEZE-GATED, AND STILL MUST NOT USE `isFrozen()`.
 *
 * It sat in UNGATED above until LIQ-1 Phase 2, when `docs/parked.md` L-4 was
 * ruled and `openMarket` gained a refusal: nothing NEW may open after the
 * conclusion freeze. So "ungated" became false for it — but the helper ban did
 * NOT, and the two are separate claims that this file previously conflated.
 *
 * The ban survives for the §20.3 reason: `isFrozen()` opens its own connection
 * off the top-level `db`, so calling it inside the W-4 transaction would read
 * OUTSIDE the lock — it could see a freeze this transaction's snapshot does not,
 * or miss one it should. The gate therefore reads `system_state` on `tx`.
 *
 * Filing it here rather than deleting the row is the point: a reader of UNGATED
 * would conclude the gap L-4 named is still open, and a reader of nothing at all
 * would not know the ban still applies.
 */
const GATED_WITHOUT_THE_HELPER = ["src/server/markets/open.ts"];

describe("ENGINE.16 (e) — isFrozen() wiring surface (§20.3 structural guard)", () => {
	for (const path of GATED) {
		it(`freeze-surface::isFrozen-present-on-gated-${path}`, () => {
			expect(src(path)).toMatch(/isFrozen/);
		});
	}

	for (const path of UNGATED) {
		it(`freeze-surface::isFrozen-absent-from-ungated-${path}`, () => {
			expect(src(path)).not.toMatch(/isFrozen/);
		});
	}

	for (const path of GATED_WITHOUT_THE_HELPER) {
		it(`freeze-surface::isFrozen-absent-but-the-gate-is-present-${path}`, () => {
			const text = src(path);
			// The helper ban still holds — §20.3 lock-order isolation.
			expect(text).not.toMatch(/isFrozen/);
			// ...AND the gate exists, read through the transaction. Without this
			// half the row is indistinguishable from an ungated file, which is
			// exactly the confusion that moving it here is meant to end.
			expect(text).toMatch(/systemState/);
			expect(text).toMatch(/frozenAt/);
			expect(text).toMatch(/MarketFrozenError/);
		});
	}

	it("freeze-surface::the-scan-ignores-comments-that-merely-NAME-the-helper", () => {
		// THE CONTROL FOR `stripComments`, and it earns its place: without it the
		// negatives above are satisfiable by a stripper that deletes everything.
		// A commented mention is invisible; a real call is not.
		expect(
			stripComments("// isFrozen() must not be used here\nconst a = 1;"),
		).not.toMatch(/isFrozen/);
		expect(stripComments("/* isFrozen */\nawait isFrozen();")).toMatch(
			/isFrozen/,
		);
		// And it does not eat the code it was pointed at.
		expect(stripComments("const x = 1; // note")).toContain("const x = 1;");
	});
});
