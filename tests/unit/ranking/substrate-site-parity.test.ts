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

// ── FF-1 · G11 — the THREE new aggregates, at the THREE duplicated sites ─────
//
// ADR-0058 adds `endorse_count`, `contest_count` and `friendly_fire_dharma` to
// a query block that exists in three separately-maintained copies. That is the
// same hazard this file was minted for, arriving again with three more
// spellings — and the third copy, `scripts/verify-ranking-staging.ts`, is the
// one that has ALREADY drifted once and can never have a behavioural test,
// because it dials the live staging database and no test may (ADR-0036).
//
// ⚠ Weak on purpose, exactly as the rest of this file is: it cannot tell you
// the predicate is CORRECT, only that no copy spells it differently. What makes
// each pin worth having is the defect it names.
describe("FF-1 G11 — the friendly-fire aggregates are spelled identically everywhere", () => {
	const FF_COUNT_SITES = SITES.filter(
		(site) => !site.endsWith("reply-substrate.ts"),
	);

	/**
	 * ENDORSE — distinct people, own side, NO flag, not the author, bet exists.
	 * Bounded by `[^)]` because this FILTER's predicate carries no parentheses,
	 * which is what keeps the pattern inside ONE aggregate.
	 */
	const ENDORSE_COUNT =
		/COUNT\(DISTINCT rc\.user_id\) FILTER \([^)]*NOT rc\.friendly_fire[^)]*AND rc\.user_id <> p\.user_id[^)]*AND rb\.id IS NOT NULL[^)]*\) AS endorse_count,/;

	/**
	 * CONTEST — the ONE predicate in this family that carries its own
	 * parentheses, so it is pinned in two bounded halves rather than one
	 * unbounded pattern: the disjunction itself, then everything from its
	 * closing paren to the alias.
	 */
	const CONTEST_DISJUNCTION =
		/COUNT\(DISTINCT rc\.user_id\) FILTER \([^)]*\(\s*rc\.side_at_post_time <> p\.side_at_post_time[^)]*OR rc\.friendly_fire\s*\)/;
	const CONTEST_TAIL =
		/OR rc\.friendly_fire\s*\)[^)]*AND rc\.user_id <> p\.user_id[^)]*AND rb\.id IS NOT NULL[^)]*\) AS contest_count,/;

	/** The meter's numerator — surviving basis, flagged, own side, not the author. */
	const FF_DHARMA =
		/SUM\(\s*COALESCE\(\s*rl\.surviving_basis,\s*rb\.stake\s*\)\s*\)\s*FILTER \([^)]*AND rc\.friendly_fire[^)]*AND rc\.user_id <> p\.user_id[^)]*\),\s*0\) AS friendly_fire_dharma/;

	/**
	 * ⛔ THE FLAG IGNORED. An `endorse_count` whose FILTER never mentions
	 * `friendly_fire` is `support_count` under a new alias — the ADR's two new
	 * fields wired up and delivering nothing, which is the failure mode that
	 * looks most like success.
	 */
	const ENDORSE_IGNORES_FLAG =
		/COUNT\(DISTINCT rc\.user_id\) FILTER \((?:(?!friendly_fire)[^)])*\) AS endorse_count,/;
	/** ⛔ The same for contest: `counter_count` re-aliased, the flag unread. */
	const CONTEST_IGNORES_FLAG =
		/COUNT\(DISTINCT rc\.user_id\) FILTER \((?:(?!friendly_fire)[^)])*\) AS contest_count,/;
	/**
	 * ⛔ THE SELF-COUNTING METER. Without `rc.user_id <> p.user_id` the numerator
	 * absorbs the author's own flagged replies, so a post the author critiqued
	 * once reads as half-contested by its own writer — and the meter is a public
	 * surface, so that is a false claim about a named pseudonym.
	 */
	const FF_DHARMA_COUNTS_SELF =
		/FILTER \((?:(?!rc\.user_id <> p\.user_id)[^)])*\),\s*0\) AS friendly_fire_dharma/;

	for (const site of FF_COUNT_SITES) {
		it(`${site} carries endorse_count, contest_count and friendly_fire_dharma`, () => {
			const src = source(site);
			expect(ENDORSE_COUNT.test(src)).toBe(true);
			expect(CONTEST_DISJUNCTION.test(src)).toBe(true);
			expect(CONTEST_TAIL.test(src)).toBe(true);
			expect(FF_DHARMA.test(src)).toBe(true);

			// ⛔ And none of the three defect shapes.
			expect(ENDORSE_IGNORES_FLAG.test(src)).toBe(false);
			expect(CONTEST_IGNORES_FLAG.test(src)).toBe(false);
			expect(FF_DHARMA_COUNTS_SELF.test(src)).toBe(false);
		});

		it(`${site} leaves support_dharma and the two count pairs UNPARTITIONED`, () => {
			// The purity half, at the query layer. `support_dharma` still includes
			// flagged stake — the meter reads a SUBSET of it, and a numerator
			// subtracted OUT of the denominator would make the bar read 100 % on
			// a post where every same-side replier flagged.
			const src = source(site);
			expect(/NOT rc\.friendly_fire[^)]*\) AS support_count,/.test(src)).toBe(
				false,
			);
			expect(/rc\.friendly_fire[^)]*\) AS support_dharma/.test(src)).toBe(
				false,
			);
			expect(
				/rc\.friendly_fire[^)]*\) AS (support|counter)_count_total,/.test(src),
			).toBe(false);
		});
	}

	it("reply-substrate.ts selects the flag per row", () => {
		// The lane loader does NOT aggregate, so it takes none of the patterns
		// above; what it owes is the RAW COLUMN, which is the only path by which
		// a reply's tag reaches a reader. It stays out of `FF_COUNT_SITES` for
		// the same reason it stays out of `COUNT_SITES` and `AGGREGATE_SITES`:
		// requiring an aggregate there would be requiring a query it does not run.
		expect(
			/rc\.friendly_fire/.test(
				source("src/server/debate-view/reply-substrate.ts"),
			),
		).toBe(true);
	});

	it("the negative controls WOULD fail if the flag went unread — proven", () => {
		// The file's own discipline: feed each ⛔ pattern the literal text it is
		// written to reject and require a match, so the `toBe(false)` assertions
		// above cannot be passing on an unmatchable regex.
		const endorseUnflagged = [
			"			COUNT(DISTINCT rc.user_id) FILTER (",
			"				WHERE rc.side_at_post_time = p.side_at_post_time",
			"					AND rc.user_id <> p.user_id",
			"					AND rb.id IS NOT NULL",
			"			) AS endorse_count,",
		].join("\n");
		expect(ENDORSE_IGNORES_FLAG.test(endorseUnflagged)).toBe(true);
		// …and the CORRECT form must not satisfy the negative, or a good file
		// would fail; nor must the reverted text satisfy the positive.
		expect(ENDORSE_COUNT.test(endorseUnflagged)).toBe(false);

		const contestSideOnly = [
			"			COUNT(DISTINCT rc.user_id) FILTER (",
			"				WHERE rc.side_at_post_time <> p.side_at_post_time",
			"					AND rc.user_id <> p.user_id",
			"					AND rb.id IS NOT NULL",
			"			) AS contest_count,",
		].join("\n");
		expect(CONTEST_IGNORES_FLAG.test(contestSideOnly)).toBe(true);
		expect(CONTEST_DISJUNCTION.test(contestSideOnly)).toBe(false);
		expect(CONTEST_TAIL.test(contestSideOnly)).toBe(false);

		const ffDharmaSelfCounted = [
			"			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (",
			"				WHERE rc.side_at_post_time = p.side_at_post_time",
			"					AND rc.friendly_fire",
			"					AND rb.id IS NOT NULL",
			"			), 0) AS friendly_fire_dharma",
		].join("\n");
		expect(FF_DHARMA_COUNTS_SELF.test(ffDharmaSelfCounted)).toBe(true);
		expect(FF_DHARMA.test(ffDharmaSelfCounted)).toBe(false);

		// …and the correct shape DOES satisfy the positive, so a green run above
		// means the pattern can be satisfied at all rather than that no site was
		// read. (The `source()` reads are the other half of that control.)
		const ffDharmaCorrect = [
			"			COALESCE(SUM(COALESCE(rl.surviving_basis, rb.stake)) FILTER (",
			"				WHERE rc.side_at_post_time = p.side_at_post_time",
			"					AND rc.friendly_fire",
			"					AND rc.user_id <> p.user_id",
			"					AND rb.id IS NOT NULL",
			"			), 0) AS friendly_fire_dharma",
		].join("\n");
		expect(FF_DHARMA.test(ffDharmaCorrect)).toBe(true);
		expect(FF_DHARMA_COUNTS_SELF.test(ffDharmaCorrect)).toBe(false);
	});

	// ── The DTO wall, one class wider than RANK-3 left it ────────────────────
	// `endorse_count` and `contest_count` are RANKING INPUTS and join
	// `support_count` / `counter_count` behind the wall: their difference from
	// the side counts is the per-post flagged-replier count, which on a post
	// with one same-side reply names that person's stance from a signed-out
	// page. ⚠ `friendly_fire_dharma` is deliberately NOT in this list — it is
	// DISPLAYED (the meter's numerator, ADR-0058 outcome 4/6) and is MEANT to
	// reach a client. Two new fields, opposite rules, one commit: the contrast
	// is why this is stated rather than assumed.
	const DTO_SITES = [
		"src/server/debate-view/load-debate-view.ts",
		"src/server/profile/arguments.ts",
		"src/server/discovery/hero.ts",
	] as const;
	const DTO_LEAK_ENDORSE = /endorseCount:\s*\w+\.endorseCount,/;
	const DTO_LEAK_CONTEST = /contestCount:\s*\w+\.contestCount,/;

	for (const site of DTO_SITES) {
		it(`${site} never hands a client the stance counts`, () => {
			const src = source(site);
			expect(DTO_LEAK_ENDORSE.test(src)).toBe(false);
			expect(DTO_LEAK_CONTEST.test(src)).toBe(false);
		});
	}

	it("the DTO stance-leak controls WOULD fail on a tidy-up — proven", () => {
		expect(DTO_LEAK_ENDORSE.test("			endorseCount: sub.endorseCount,")).toBe(
			true,
		);
		expect(
			DTO_LEAK_CONTEST.test("			contestCount: post.contestCount,"),
		).toBe(true);
		// ⚠ And the DISPLAY figure must not trip them — a meter numerator handed
		// outward is correct, and a guard that rejected it would be telling the
		// implementer to hide the thing the ADR exists to show.
		expect(
			DTO_LEAK_ENDORSE.test(
				"			friendlyFireDharma: sub.friendlyFireDharma,",
			),
		).toBe(false);
		expect(
			DTO_LEAK_CONTEST.test(
				"			friendlyFireDharma: sub.friendlyFireDharma,",
			),
		).toBe(false);
	});
});
