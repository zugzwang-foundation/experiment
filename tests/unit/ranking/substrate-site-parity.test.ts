import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * RANK-1 R-F — **a SOURCE SCAN, and it is the only control that catches the
 * failure it is written for.**
 *
 * The stake block is duplicated across four separately-maintained query
 * sites. (UNWIRE-1-RESOLVE: RANK-1 landed naming five — `src/server/
 * bookmarks/list.ts` was one of them; the bookmark module is unwired
 * product-wide, so this file's SITES/AGGREGATE_SITES arrays and this count
 * both drop to four.) `rank-decay-parity.test.ts` exercises three of them
 * behaviourally, which is the stronger check where it applies — but it
 * cannot reach the fourth, because `scripts/verify-ranking-staging.ts` runs
 * against the LIVE staging database and no test may dial one (ADR-0036
 * primitive 2; `vitest.config.ts` excludes `tests/staging/**` for exactly
 * this reason).
 *
 * That fourth site is not a hypothetical gap. **It had already drifted.** It
 * still read the frozen `bets.stake` after LOTS-1 moved the aggregates, so the
 * instrument whose stated job is to confirm the engine's ranking against real
 * rows had been computing a different order from the application — silently,
 * for a release. Nothing could have said so: it has no test, and it never will
 * have a behavioural one.
 *
 * So this file asserts the thing that IS checkable without a database — that
 * every site still spells the substitution the same way. It is a weak assertion
 * about strong-looking code, and it is deliberately weak: it cannot tell you the
 * query is CORRECT, only that no copy has quietly reverted to the frozen
 * reading. That is the failure that actually happened.
 */

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

/** Every site that turns a bet's stake into a ranking input. */
const SITES = [
	"src/server/debate-view/ranking-substrate.ts",
	"src/server/debate-view/reply-substrate.ts",
	"src/server/profile/arguments.ts",
	"scripts/verify-ranking-staging.ts",
] as const;

/** The per-bet ruler substitution (the `JOIN LATERAL … LIMIT 1` blocks). */
const RULER =
	/COALESCE\(\s*(pl|rl)\.surviving_basis,\s*b\.stake\s*\)\s+AS\s+stake/;
/** R6's Sold predicate — exactly zero, and false when there is no lot at all. */
const SOLD =
	/COALESCE\(\s*(pl|rl)\.surviving_shares\s*=\s*0,\s*false\s*\)\s+AS\s+sold/;
/** The frozen original, carried for the badge's strikethrough. */
const ORIGINAL = /b\.stake\s+AS\s+original_stake/;

function source(site: string): string {
	return readFileSync(join(REPO_ROOT, site), "utf8");
}

describe("RANK-1 — every substrate site spells the substitution the same way", () => {
	for (const site of SITES) {
		it(`${site} keys the per-bet ruler off surviving basis, with the COALESCE fallback`, () => {
			const src = source(site);
			expect(RULER.test(src)).toBe(true);
			expect(SOLD.test(src)).toBe(true);
			expect(ORIGINAL.test(src)).toBe(true);
		});
	}

	// The three aggregate sites (UNWIRE-1-RESOLVE: four before the bookmark
	// module's site was removed). `reply-substrate.ts` is deliberately absent: it
	// loads ONE reply per row and computes no per-side sum, so requiring the
	// aggregate form there would be requiring a query it does not run.
	const AGGREGATE_SITES = SITES.filter(
		(s) => !s.endsWith("reply-substrate.ts"),
	);
	for (const site of AGGREGATE_SITES) {
		it(`${site} keys the attracted aggregates off surviving basis too`, () => {
			const src = source(site);
			expect(
				/SUM\(\s*COALESCE\(\s*rl\.surviving_basis,\s*rb\.stake\s*\)\s*\)/.test(
					src,
				),
			).toBe(true);
		});
	}

	it("the Discovery hero reaches the LOT for its shares, not the bet's minted ones", () => {
		// A SIXTH copy of the earliest-bet-plus-lots pattern, and the one the audit
		// found uncovered. It is written in the Drizzle BUILDER rather than raw SQL,
		// so the regexes above cannot see it — which is exactly how a copy goes
		// unnoticed, and exactly what this file exists to prevent.
		//
		// Why it matters here specifically: OD-1 = Option B rules that the two halves
		// of the `Đa → Đb` arrow must be the same quantity at two times. RANK-1 moved
		// the LEFT half onto the surviving basis, so the RIGHT half has to come from
		// the same lot or the arrow joins a stake that was exited to a value computed
		// from shares the author no longer holds — `Đ 0 → Đ 500` on a public panel.
		const src = source("src/server/discovery/hero.ts");
		expect(
			/COALESCE\(\$\{lots\.survivingShares\},\s*\$\{bets\.shareQuantity\}\)/.test(
				src,
			),
		).toBe(true);
		expect(/leftJoin\(lots,\s*eq\(lots\.betId,\s*bets\.id\)\)/.test(src)).toBe(
			true,
		);
		// ⛔ The pre-RANK-1 spelling: the bet's minted shares, unqualified.
		expect(/shareQuantity:\s*bets\.shareQuantity,/.test(src)).toBe(false);
	});

	it("NO site reads a bare frozen stake as a ranking input any more", () => {
		// ⛔ The exact shapes that shipped the exploit and the drift: a per-bet
		// `SELECT b.stake` with no lot reach, and a `SUM(rb.stake)` with no
		// COALESCE. Either one reappearing means a site has reverted.
		for (const site of SITES) {
			const src = source(site);
			expect(/SELECT\s+b\.stake,\s*b\.price_at_bet/.test(src)).toBe(false);
			expect(/SUM\(\s*rb\.stake\s*\)/.test(src)).toBe(false);
		}
	});
});
