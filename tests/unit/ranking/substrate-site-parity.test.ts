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

	// ── RANK-2/RANK-3: what each site counts, and where the exclusion lives ───
	// `reply-substrate.ts` is deliberately absent, and its absence is the ruling
	// rather than an oversight: a self-reply keeps its own lane position, so the
	// loader that produces that lane must NOT filter.
	const COUNT_SITES = SITES.filter(
		(site) => !site.endsWith("reply-substrate.ts"),
	);

	/** ⛔ The pre-RANK-3 spelling. A revert to this counts replies, not people. */
	const COUNTS_REPLIES =
		/COUNT\(rb\.id\) FILTER \(\s*\n\s*WHERE rc\.side_at_post_time [=<>]+ p\.side_at_post_time\s*\n\s*\) AS (support|counter)_count,/;
	/** The RANK-3 ranking input: DISTINCT PEOPLE, self-authored excluded. */
	const COUNTS_PEOPLE =
		/COUNT\(DISTINCT rc\.user_id\) FILTER \([^)]*AND rc\.user_id <> p\.user_id[^)]*\) AS (support|counter)_count,/;
	/** The RANK-3 display total: every reply COMMENT, self- and removed-inclusive. */
	const COUNTS_TOTAL =
		/COUNT\(DISTINCT rc\.id\) FILTER \([^)]*AND rb\.id IS NOT NULL[^)]*\) AS (support|counter)_count_total,/;
	/**
	 * ⛔ Counting BET ROWS for the display total. `bets.comment_id` is indexed but
	 * NOT unique, so this reports 2 for a comment carrying two bets while the
	 * reply lane — one row per reply comment — still shows 1. That difference is
	 * the SC-1 differential, re-opened by a spelling.
	 */
	const COUNTS_TOTAL_BETS =
		/COUNT\(rb\.id\) FILTER \([^)]*\) AS (support|counter)_count_total,/;

	for (const site of COUNT_SITES) {
		it(`${site} counts PEOPLE for ranking and REPLIES for display`, () => {
			const src = source(site);
			// ⚠ BOTH SIDES, EXPLICITLY. An alternation would let a single match
			// satisfy the assertion, so a site that gained `support_count_total`
			// but not `counter_count_total` would pass — and SQL aliases are
			// untyped, so the missing one arrives as `NaN` and renders as `NaN`
			// on the public hero.
			for (const side of ["support", "counter"] as const) {
				// R-2 — the lanes count distinct people, self-authored excluded,
				// and only where a bet actually exists (the lane's LATERAL is an
				// inner join, so a bet-less comment is absent from what a reader
				// counts; without the guard it would still buy a person of traction).
				expect(
					new RegExp(
						`COUNT\\(DISTINCT rc\\.user_id\\) FILTER \\([^)]*AND rc\\.user_id <> p\\.user_id[^)]*AND rb\\.id IS NOT NULL[^)]*\\) AS ${side}_count,`,
					).test(src),
				).toBe(true);
				// R-1 — and a separate, self- and removed-INCLUSIVE display total,
				// over reply COMMENTS so it equals the lane length by construction.
				expect(
					new RegExp(
						`COUNT\\(DISTINCT rc\\.id\\) FILTER \\([^)]*AND rb\\.id IS NOT NULL[^)]*\\) AS ${side}_count_total,`,
					).test(src),
				).toBe(true);
			}
			// The dharma aggregates carry the same exclusion.
			expect(/AND rc\.user_id <> p\.user_id/.test(src)).toBe(true);

			// ⛔ THE NEGATIVE CONTROL. This is the exact shape that shipped before
			// RANK-3 and the exact shape a revert would restore: a bare
			// `COUNT(rb.id) … AS support_count`, which measures replies typed
			// rather than people arguing. If it ever matches again, one account's
			// five replies clear `floorLane.n` on their own.
			expect(COUNTS_REPLIES.test(src)).toBe(false);
			// ⛔ AND THE SECOND ONE, which is subtler because it looks correct: a
			// display total over BET ROWS. It agrees with the lane on every row
			// place.ts can produce and disagrees the moment anything else writes a
			// second bet on a comment — a repair script, a backfill, an admin tool.
			// The differential would re-open with no failing test and no diff to
			// point at, which is precisely the shape this file exists to refuse.
			expect(COUNTS_TOTAL_BETS.test(src)).toBe(false);
		});
	}

	it("the negative control WOULD fail if a revert shipped — proven, not asserted", () => {
		// A guard nobody has watched fail is a guard nobody knows works. This
		// feeds the regex the literal pre-RANK-3 text and requires a match, so the
		// `toBe(false)` above cannot be passing merely because the pattern is
		// unmatchable.
		const reverted = [
			"			COUNT(rb.id) FILTER (",
			"				WHERE rc.side_at_post_time = p.side_at_post_time",
			"			) AS support_count,",
		].join("\n");
		expect(COUNTS_REPLIES.test(reverted)).toBe(true);
		// …and the people-form must NOT match that text, or the positive
		// assertion would be satisfied by a reverted file too.
		expect(COUNTS_PEOPLE.test(reverted)).toBe(false);

		// The same proof for the display total, whose two spellings differ by one
		// word and whose wrong one is the more natural thing to type.
		const totalOverBets = [
			"			COUNT(rb.id) FILTER (",
			"				WHERE rc.side_at_post_time = p.side_at_post_time",
			"			) AS support_count_total,",
		].join("\n");
		expect(COUNTS_TOTAL_BETS.test(totalOverBets)).toBe(true);
		expect(COUNTS_TOTAL.test(totalOverBets)).toBe(false);
	});

	// ── R-1: which of the two numbers is allowed to leave the server ─────────
	// ⚠ THE HAZARD IS THAT BOTH SPELLINGS TYPECHECK, and the wrong one is the
	// shorter and more natural thing to write. `supportCount: sub.supportCount`
	// compiles exactly as well as `supportCount: sub.supportCountTotal` — both
	// sides are `number`, and the field names already match — so nothing but a
	// reader stands between a tidy-up and the differential re-opening. That is
	// the shape RANK-2 shipped and RANK-3 removed, on three separate surfaces.
	// Until the ranking pair is renamed or branded so the wrong assignment is a
	// COMPILE error (recommended, and deliberately not taken inside this task),
	// this scan is the control.
	const DTO_SITES = [
		{
			site: "src/server/debate-view/load-debate-view.ts",
			display: /supportCount:\s*\w+\.supportCountTotal,/,
		},
		{
			site: "src/server/profile/arguments.ts",
			display: /supportCount:\s*\w+\.supportCountTotal,/,
		},
		{
			site: "src/server/discovery/hero.ts",
			display:
				/replyCount:\s*\w+\.supportCountTotal \+ \w+\.counterCountTotal,/,
		},
	] as const;

	for (const { site, display } of DTO_SITES) {
		it(`${site} hands a client the DISPLAY total, never the ranking count`, () => {
			const src = source(site);
			expect(display.test(src)).toBe(true);
			// ⛔ The ranking pair, read off the substrate and passed outward. The
			// negative form has to name the SOURCE side (`x.supportCount`), because
			// the DESTINATION side is legitimately called `supportCount` — that is
			// the DTO field, and renaming it would change the wire shape.
			expect(/supportCount:\s*\w+\.supportCount,/.test(src)).toBe(false);
			expect(/counterCount:\s*\w+\.counterCount,/.test(src)).toBe(false);
			expect(
				/replyCount:\s*\w+\.supportCount \+ \w+\.counterCount,/.test(src),
			).toBe(false);
		});
	}

	it("the DTO negative controls WOULD fail if a tidy-up shipped — proven", () => {
		// Same discipline as above: feed each negative form the literal text it is
		// written to reject. A `toBe(false)` over three regexes that can never
		// match is three green assertions and no guard.
		expect(
			/supportCount:\s*\w+\.supportCount,/.test(
				"			supportCount: sub.supportCount,",
			),
		).toBe(true);
		expect(
			/counterCount:\s*\w+\.counterCount,/.test(
				"			counterCount: post.counterCount,",
			),
		).toBe(true);
		expect(
			/replyCount:\s*\w+\.supportCount \+ \w+\.counterCount,/.test(
				"			replyCount: p.supportCount + p.counterCount,",
			),
		).toBe(true);
		// …and the display forms must NOT satisfy the negative controls, or a
		// correct file would fail.
		expect(
			/supportCount:\s*\w+\.supportCount,/.test(
				"			supportCount: sub.supportCountTotal,",
			),
		).toBe(false);
	});

	it("the exclusion is in the FILTER, not the JOIN — and that is deliberate", () => {
		// RANK-2 put it in the `ON` clause; RANK-3 had to move it. A JOIN
		// predicate REMOVES the row, so the display total could not be computed
		// from the same query. A FILTER keeps the row and declines to count it —
		// which preserves the property the JOIN form was chosen for: a post whose
		// only replies are its own still appears, with its ranking counts at zero,
		// rather than vanishing from the listing.
		for (const site of COUNT_SITES) {
			const src = source(site);
			expect(
				/LEFT JOIN [^\n]*rc ON rc\.parent_comment_id = p\.id\s*\n/.test(src),
			).toBe(true);
			expect(
				/ON rc\.parent_comment_id = p\.id\s*\n\s*AND rc\.user_id/.test(src),
			).toBe(false);
		}
	});

	it("reply-substrate.ts does NOT filter self-replies — the ruling's other half", () => {
		// ⛔ A POSITIVE ASSERTION OF AN ABSENCE, on purpose. The ruling excludes
		// self-replies from attraction and from nothing else; a future reader
		// applying the predicate "consistently" across all five sites would silently
		// delete a participant's own arguments from the lane they belong in.
		const src = source("src/server/debate-view/reply-substrate.ts");
		// ⚠ Anchored on `user_id` appearing in ANY comparison, not on the operand
		// order this repo happens to use. `/rc\.user_id\s*<>/` would miss the
		// semantically identical `p.user_id <> rc.user_id` — and missing it is the
		// UNSAFE direction, since it would mean a self-reply had been silently
		// deleted from the lane it belongs in.
		// `NOT IN` and `IS DISTINCT FROM` are the two spellings a regex on the
		// comparison operators alone would miss — and missing them is the UNSAFE
		// direction, since either would mean a self-reply had been filtered out of
		// the lane it belongs in.
		expect(
			/user_id\s*(<>|!=|=|NOT\s+IN|IS\s+(NOT\s+)?DISTINCT)/i.test(src),
		).toBe(false);
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
