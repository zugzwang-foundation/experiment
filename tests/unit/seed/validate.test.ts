import { describe, expect, it } from "vitest";

// SEED-STAGING-1 §6 (separating the data across the markets) + §16
// `validate.ts` — every rule a sheet must pass BEFORE anything is written.
//
// THE POINT OF THIS FILE: `validateSeedRows` is the only place the operator
// finds out their sheet is wrong while nothing has happened yet. §5 is explicit
// — "ANY error → nothing runs" — so a rule that is missing here does not
// produce a friendly message later, it produces a run that posts half a sheet
// and stops in the middle of a market. Each `it` below is ONE rule, named by
// the row it must reject, so a reader can map a failure straight to the §16
// bullet it came from.
//
// ⚠ TWO DELIBERATE DIVERGENCES FROM THE BET ROUTE, both asserted rather than
// assumed:
//   1. A stake above `BET_MAX_STAKE` is an ERROR here. The route CLAMPS
//      (`clampStakeToMax`, floors.ts) — silently rewriting a hand-written
//      sheet's numbers, which is the one thing a seeding tool must not do.
//   2. The body is validated on its TRIMMED form and stored UNTRIMMED. The
//      author's whitespace is the author's; the emptiness check is ours.
//
// Pure module: no database, no clock. The caller states which slugs are Open.

import {
	BET_MAX_STAKE,
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
	COMMENT_MAX_LENGTH,
	INITIAL_USER_DHARMA,
} from "@/server/config/limits";
import type { RawSeedRow } from "@/server/seed/types";
import { SEED_LABEL_RE, validateSeedRows } from "@/server/seed/validate";

const MARKET_A = "seed-market-a";
const MARKET_B = "seed-market-b";
const OPEN = { acceptedMarketSlugs: new Set([MARKET_A, MARKET_B]) };

/** A row that passes every rule, so each test varies exactly one thing. */
function raw(rowNumber: number, over: Partial<RawSeedRow> = {}): RawSeedRow {
	return {
		rowNumber,
		market: MARKET_A,
		user: "",
		side: "YES",
		stake: BET_MIN_STAKE_POST,
		argument: "a perfectly ordinary argument",
		replyTo: "",
		...over,
	};
}

function errorRows(result: { errors: { rowNumber: number }[] }): number[] {
	return result.errors.map((e) => e.rowNumber);
}

function messageFor(
	result: { errors: { rowNumber: number; message: string }[] },
	rowNumber: number,
): string {
	const hit = result.errors.find((e) => e.rowNumber === rowNumber);
	return hit?.message ?? "";
}

describe("seed-validate — the §6 rule set", () => {
	// ── THE POSITIVE CONTROL ────────────────────────────────────────────────
	// Every rejection below is worthless without it: a validator that errored
	// on everything would satisfy all twenty-odd negative tests at once.
	it("seed-validate::accepts-a-valid-multi-market-sheet", () => {
		const rows: RawSeedRow[] = [
			raw(1, { market: MARKET_A, user: "alpha", side: "YES", stake: "10" }),
			raw(2, {
				market: MARKET_A,
				user: "beta",
				side: "NO",
				stake: BET_MIN_STAKE_REPLY,
				replyTo: "1",
			}),
			raw(3, { market: MARKET_A, user: "", side: "YES", stake: "10" }),
			raw(4, { market: MARKET_B, user: "alpha", side: "NO", stake: "10" }),
			raw(5, {
				market: MARKET_B,
				user: "gamma",
				side: "NO",
				stake: BET_MIN_STAKE_REPLY,
				replyTo: "4",
			}),
		];

		const result = validateSeedRows(rows, OPEN);

		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(5);
		// The normalised shape, field by field — this is the contract every
		// downstream module (plan, run) reads.
		expect(result.rows[0]).toEqual({
			rowNumber: 1,
			marketSlug: MARKET_A,
			userLabel: "alpha",
			side: "YES",
			stake: "10",
			body: "a perfectly ordinary argument",
			replyToRow: null,
		});
		// A blank label becomes NULL, not "" — "one new participant for this row"
		// is a different statement from "a participant named empty string".
		expect(result.rows[2]?.userLabel).toBeNull();
		expect(result.rows[1]?.replyToRow).toBe(1);
		expect(result.rows[4]?.replyToRow).toBe(4);
		// alpha appears in BOTH markets: one side per market is per-MARKET.
		expect(result.rows[3]?.userLabel).toBe("alpha");
		expect(result.rows[3]?.side).toBe("NO");
	});

	// ── market ∈ acceptedMarketSlugs ────────────────────────────────────────────
	it("seed-validate::rejects-a-market-that-is-not-open", () => {
		// One slug that does not exist, one that is blank. A Draft or Closed
		// market is simply absent from the Open set, so this one rule covers
		// "unknown" and "not Open" together — which is why the caller passes the
		// OPEN set rather than the full market list.
		const result = validateSeedRows(
			[
				raw(1, { market: "no-such-market" }),
				raw(2, { market: "" }),
				raw(3, { market: MARKET_A }),
			],
			OPEN,
		);

		expect(errorRows(result)).toEqual([1, 2]);
		expect(messageFor(result, 1)).toContain("no-such-market");
		expect(result.rows.map((r) => r.rowNumber)).toEqual([3]);
	});

	// ── side ∈ {YES, NO}, case-insensitive INPUT ─────────────────────────────
	it("seed-validate::rejects-a-side-that-is-neither-YES-nor-NO", () => {
		const result = validateSeedRows(
			[raw(1, { side: "MAYBE" }), raw(2, { side: "" }), raw(3, { side: "Y" })],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2, 3]);
		expect(result.rows).toEqual([]);
	});

	it("seed-validate::accepts-a-lowercase-side-and-normalises-it", () => {
		const result = validateSeedRows(
			[
				raw(1, { side: "yes" }),
				raw(2, { side: "no" }),
				raw(3, { side: "YeS" }),
			],
			OPEN,
		);
		expect(result.errors).toEqual([]);
		expect(result.rows.map((r) => r.side)).toEqual(["YES", "NO", "YES"]);
	});

	// ── label blank or SEED_LABEL_RE ─────────────────────────────────────────
	it("seed-validate::rejects-a-label-outside-SEED_LABEL_RE", () => {
		// The exported regex is pinned directly too: the rule and the constant
		// have to agree, and a test that only drove rows could not tell a
		// loosened regex from a loosened rule.
		expect(SEED_LABEL_RE.test("alpha_1-2")).toBe(true);
		expect(SEED_LABEL_RE.test("has space")).toBe(false);
		expect(SEED_LABEL_RE.test("bang!")).toBe(false);
		expect(SEED_LABEL_RE.test("a".repeat(40))).toBe(true);
		expect(SEED_LABEL_RE.test("a".repeat(41))).toBe(false);

		const result = validateSeedRows(
			[
				raw(1, { user: "has space" }),
				raw(2, { user: "bang!" }),
				raw(3, { user: "a".repeat(41) }),
				raw(4, { user: "alpha_1-2" }),
				raw(5, { user: "" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2, 3]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([4, 5]);
	});

	// ── stake shape + the two floors + the ceiling ───────────────────────────
	it("seed-validate::rejects-a-stake-that-is-not-a-plain-positive-decimal", () => {
		const result = validateSeedRows(
			[
				raw(1, { stake: "" }),
				raw(2, { stake: "-10" }),
				raw(3, { stake: "1e3" }),
				raw(4, { stake: "ten" }),
				raw(5, { stake: "+10" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2, 3, 4, 5]);
		expect(result.rows).toEqual([]);
	});

	it("seed-validate::rejects-a-stake-below-the-post-floor", () => {
		const result = validateSeedRows(
			[
				raw(1, { stake: "9" }),
				raw(2, { stake: "0" }),
				raw(3, { stake: BET_MIN_STAKE_POST }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2]);
		expect(messageFor(result, 1)).toContain(BET_MIN_STAKE_POST);
		// The boundary is INCLUSIVE — exactly at the floor passes (ADR-0018).
		expect(result.rows.map((r) => r.rowNumber)).toEqual([3]);
	});

	it("seed-validate::rejects-a-reply-stake-below-the-reply-floor", () => {
		// The gap is the whole test: 25 clears the POST floor (10) and misses the
		// REPLY floor (50). A validator that picked the floor without looking at
		// `replyTo` would pass this row and fail inside the engine.
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha", stake: BET_MIN_STAKE_POST }),
				raw(2, { user: "beta", stake: "25", replyTo: "1" }),
				raw(3, { user: "gamma", stake: BET_MIN_STAKE_REPLY, replyTo: "1" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(messageFor(result, 2)).toContain(BET_MIN_STAKE_REPLY);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 3]);
	});

	it("seed-validate::rejects-a-stake-above-the-maximum-and-never-clamps-it", () => {
		// ⚠ THE DIVERGENCE FROM THE ROUTE (plan §8). The route clamps to
		// BET_MAX_STAKE; a sheet must not have its numbers rewritten. The
		// load-bearing half is the SECOND assertion: no surviving row may carry
		// the clamped value.
		const over = "251";
		const result = validateSeedRows(
			[raw(1, { stake: over }), raw(2, { stake: BET_MAX_STAKE })],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1]);
		expect(messageFor(result, 1)).toContain(BET_MAX_STAKE);
		expect(result.rows.map((r) => r.stake)).toEqual([BET_MAX_STAKE]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([2]);
	});

	it("seed-validate::rejects-more-than-18-fraction-digits", () => {
		// NUMERIC(38,18) is the domain (CLAUDE.md §2). A 19th digit is not a
		// rounding question; it is a value the column cannot hold.
		const eighteen = `10.${"1".repeat(18)}`;
		const nineteen = `10.${"1".repeat(19)}`;
		const result = validateSeedRows(
			[raw(1, { stake: nineteen }), raw(2, { stake: eighteen })],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1]);
		expect(result.rows.map((r) => r.stake)).toEqual([eighteen]);
	});

	// ── body ─────────────────────────────────────────────────────────────────
	it("seed-validate::rejects-a-whitespace-only-argument", () => {
		const result = validateSeedRows(
			[
				raw(1, { argument: "" }),
				raw(2, { argument: "   " }),
				raw(3, { argument: "\n\t  \r\n" }),
				raw(4, { argument: " x " }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2, 3]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([4]);
	});

	it("seed-validate::rejects-an-argument-over-COMMENT_MAX_LENGTH", () => {
		const atLimit = "a".repeat(COMMENT_MAX_LENGTH);
		const overLimit = "a".repeat(COMMENT_MAX_LENGTH + 1);
		const result = validateSeedRows(
			[raw(1, { argument: overLimit }), raw(2, { argument: atLimit })],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1]);
		expect(messageFor(result, 1)).toContain(String(COMMENT_MAX_LENGTH));
		expect(result.rows.map((r) => r.body.length)).toEqual([COMMENT_MAX_LENGTH]);
	});

	it("seed-validate::keeps-the-body-untrimmed", () => {
		// Validated on the trimmed form, STORED verbatim — the §16 note. A
		// validator that trimmed into `SeedRow` would change what the operator
		// wrote, and the difference is invisible on the site.
		const body = "  leading and trailing matter  ";
		const result = validateSeedRows([raw(1, { argument: body })], OPEN);
		expect(result.errors).toEqual([]);
		expect(result.rows[0]?.body).toBe(body);
	});

	// ── replyTo ──────────────────────────────────────────────────────────────
	it("seed-validate::rejects-reply-to-a-later-or-absent-row", () => {
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha", stake: BET_MIN_STAKE_REPLY, replyTo: "2" }),
				raw(2, { user: "beta" }),
				raw(3, { user: "gamma", stake: BET_MIN_STAKE_REPLY, replyTo: "99" }),
				raw(4, { user: "delta", stake: BET_MIN_STAKE_REPLY, replyTo: "4" }),
			],
			OPEN,
		);
		// Row 1 points FORWARD, row 3 at nothing, row 4 at ITSELF — all three are
		// "not an earlier row". A parent must already exist when its reply runs.
		expect(errorRows(result)).toEqual([1, 3, 4]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([2]);
	});

	it("seed-validate::rejects-reply-to-a-row-in-another-market", () => {
		// §6 rule 2: a reply belongs to its parent's debate. Crossing markets
		// would make `validateReplyParent` refuse inside the engine, after the
		// market's earlier rows had already committed.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "alpha" }),
				raw(2, {
					market: MARKET_B,
					user: "beta",
					stake: BET_MIN_STAKE_REPLY,
					replyTo: "1",
				}),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(messageFor(result, 2)).toContain(MARKET_B);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);
	});

	it("seed-validate::rejects-a-reply-to-a-reply (REPLY_DEPTH_MAX = 1)", () => {
		// ADR-0017 — replies are flat. The parent must itself be a top-level post.
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha" }),
				raw(2, { user: "beta", stake: BET_MIN_STAKE_REPLY, replyTo: "1" }),
				raw(3, { user: "gamma", stake: BET_MIN_STAKE_REPLY, replyTo: "2" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([3]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2]);
	});

	it("seed-validate::rejects-reply-to-a-row-that-is-itself-invalid", () => {
		// A parent that will never be posted cannot be replied to. Without this
		// the reply would reach the engine naming a comment id that does not
		// exist — and the row it depended on is already reported, so reporting
		// this one too is what keeps "fix the sheet and re-upload" true.
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha", side: "SIDEWAYS" }),
				raw(2, { user: "beta", stake: BET_MIN_STAKE_REPLY, replyTo: "1" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([1, 2]);
		expect(result.rows).toEqual([]);
	});

	it("seed-validate::rejects-a-malformed-reply_to-value", () => {
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha" }),
				raw(2, { user: "beta", stake: BET_MIN_STAKE_REPLY, replyTo: "one" }),
				raw(3, { user: "gamma", stake: BET_MIN_STAKE_REPLY, replyTo: "1.5" }),
				raw(4, { user: "delta", stake: BET_MIN_STAKE_REPLY, replyTo: "-1" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2, 3, 4]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);
	});

	it("seed-validate::rejects-a-self-reply (D-52)", () => {
		// D-52: nobody replies to their own argument, either side. The rule is
		// about the PARTICIPANT, so it fires on the label rather than the row.
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha", side: "YES" }),
				raw(2, {
					user: "alpha",
					side: "YES",
					stake: BET_MIN_STAKE_REPLY,
					replyTo: "1",
				}),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(messageFor(result, 2)).toContain("alpha");
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);
	});

	// ── one side per (label, market) — I-SINGLE-SIDE ─────────────────────────
	it("seed-validate::rejects-one-label-on-both-sides-of-one-market", () => {
		// I-SINGLE-SIDE at the sheet layer. `place()` raises
		// `OppositeSideHeldError` for this, so without the rule the run stops
		// mid-market on a condition the sheet could have been told about.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "alpha", side: "YES" }),
				raw(2, { market: MARKET_A, user: "alpha", side: "NO" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);
	});

	it("seed-validate::allows-one-label-on-different-sides-across-markets", () => {
		// The invariant is per (user, market) — a participant may hold YES in one
		// debate and NO in another. Over-reaching here would make the rule wrong
		// in the direction nobody notices: fewer rows posted, no error shown.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "alpha", side: "YES" }),
				raw(2, { market: MARKET_B, user: "alpha", side: "NO" }),
			],
			OPEN,
		);
		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(2);
	});

	it("seed-validate::allows-a-label-to-add-to-the-same-side-twice", () => {
		// F-BET-2, the subsequent buy. Two rows, same label, same market, same
		// side is a participant arguing twice — the ordinary case.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "alpha", side: "YES" }),
				raw(2, { market: MARKET_A, user: "alpha", side: "YES" }),
			],
			OPEN,
		);
		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(2);
	});

	// ── label identity is CASE-INSENSITIVE (§6 rule 2, last bullet) ──────────
	//
	// ⛔ THIS IS NOT A COSMETIC RULE, AND IT IS NOT OPTIONAL. `seedParticipantEmail`
	// lowercases the label, so `Alpha` and `alpha` resolve to ONE email, which
	// resolves to ONE `users` row and ONE Dharma balance. Every cross-row rule
	// that compares labels is therefore asking about a PARTICIPANT, not about a
	// string — and a rule that compared the strings would judge one person as
	// two. The direction of that mistake is the dangerous one: the sheet passes
	// validation, and the engine then refuses mid-market on a condition the
	// preview was supposed to catch (an opposite side held, an overdraft) or
	// commits something the product forbids (a self-reply).
	it("seed-validate::treats-labels-differing-only-in-case-as-one-participant-per-market", () => {
		// I-SINGLE-SIDE, across case. `place()` would raise
		// `OppositeSideHeldError` on row 2 because the held position belongs to
		// the same user row — four rows into a market, with no error shown.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "Alpha", side: "YES" }),
				raw(2, { market: MARKET_A, user: "alpha", side: "NO" }),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);

		// THE DISCRIMINATOR: the identical sheet with two genuinely different
		// labels is legal. So the rejection above is caused by the labels being
		// ONE participant and by nothing else in the row.
		const distinct = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "Alpha", side: "YES" }),
				raw(2, { market: MARKET_A, user: "beta", side: "NO" }),
			],
			OPEN,
		);
		expect(distinct.errors).toEqual([]);
		expect(distinct.rows.length).toBe(2);
	});

	it("seed-validate::pools-the-budget-across-labels-differing-only-in-case", () => {
		// The budget is one person's Dharma, so it accumulates over every
		// spelling of their label. Five rows at the per-bet ceiling is 1,250
		// against INITIAL_USER_DHARMA — and a string-keyed accumulator would see
		// five separate participants at 250 each and pass the sheet, leaving the
		// fifth row to fail as an overdraft inside the W-1 transaction.
		const spellings = ["Whale", "whale", "WHALE", "WhAlE", "whaLE"];
		const result = validateSeedRows(
			spellings.map((user, i) =>
				raw(i + 1, { market: MARKET_A, user, side: "YES", stake: "250" }),
			),
			OPEN,
		);

		expect(errorRows(result)).toEqual([5]);
		expect(messageFor(result, 5)).toContain(INITIAL_USER_DHARMA);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4]);

		// THE DISCRIMINATOR. The identical five rows under five genuinely
		// different labels are five participants spending 250 each — entirely
		// legal. So the rejection above is caused by the POOLING and not by the
		// stake, the count or the market, and a string-keyed accumulator would
		// return this second result for both sheets.
		const distinct = validateSeedRows(
			spellings.map((_, i) =>
				raw(i + 1, {
					market: MARKET_A,
					user: `whale${i}`,
					side: "YES",
					stake: "250",
				}),
			),
			OPEN,
		);
		expect(distinct.errors).toEqual([]);
		expect(distinct.rows.length).toBe(5);
	});

	it("seed-validate::rejects-a-self-reply-across-case (D-52)", () => {
		// D-52 is about the author, and the author is the user row the label
		// resolves to. Both rows sit on the SAME side, so the one-side rule
		// cannot fire here — the self-reply rule is the only thing that can
		// reject row 2, which is what makes this a test of that rule.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "Alpha", side: "YES" }),
				raw(2, {
					market: MARKET_A,
					user: "alpha",
					side: "YES",
					stake: BET_MIN_STAKE_REPLY,
					replyTo: "1",
				}),
			],
			OPEN,
		);
		expect(errorRows(result)).toEqual([2]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1]);

		// THE DISCRIMINATOR again: the same shape with a different replier is a
		// perfectly ordinary Support reply.
		const distinct = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "Alpha", side: "YES" }),
				raw(2, {
					market: MARKET_A,
					user: "beta",
					side: "YES",
					stake: BET_MIN_STAKE_REPLY,
					replyTo: "1",
				}),
			],
			OPEN,
		);
		expect(distinct.errors).toEqual([]);
		expect(distinct.rows.length).toBe(2);
	});

	it("seed-validate::case-folding-does-not-reach-across-markets", () => {
		// The control that keeps the folding from over-reaching. Folding decides
		// WHO a row belongs to; it must not change the SCOPE of the one-side
		// rule, which is per (participant, market). `Alpha` on YES in one debate
		// and `alpha` on NO in another is one person holding opposite sides of
		// two different questions — legal, and the ordinary case for a seeded
		// sheet that covers six markets.
		const result = validateSeedRows(
			[
				raw(1, { market: MARKET_A, user: "Alpha", side: "YES" }),
				raw(2, { market: MARKET_B, user: "alpha", side: "NO" }),
			],
			OPEN,
		);
		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(2);
		// The labels round-trip VERBATIM into `SeedRow` — folding is a
		// comparison rule, not a rewrite. `seedParticipantEmail` lowercases at
		// the point of use, so the operator's own spelling survives into the
		// report they read.
		expect(result.rows.map((r) => r.userLabel)).toEqual(["Alpha", "alpha"]);
	});

	// ── budget ───────────────────────────────────────────────────────────────
	it("seed-validate::rejects-a-label-whose-total-stake-exceeds-the-initial-grant", () => {
		// A participant starts with INITIAL_USER_DHARMA and nothing else. Five
		// rows at the per-bet ceiling is 1,250 against 1,000 — the fifth is where
		// the engine would raise `InsufficientDharmaError`, four rows deep into a
		// market. Accumulation is PER LABEL, so the error lands on the row that
		// breaks the budget and not on the whole sheet.
		const rows = [1, 2, 3, 4, 5].map((n) =>
			raw(n, { market: MARKET_A, user: "whale", side: "YES", stake: "250" }),
		);
		const result = validateSeedRows(rows, OPEN);

		expect(errorRows(result)).toEqual([5]);
		expect(messageFor(result, 5)).toContain(INITIAL_USER_DHARMA);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4]);
	});

	it("seed-validate::never-pools-budget-across-blank-labels", () => {
		// A blank label is a NEW participant per row (§4), each with their own
		// grant — so six rows at 250 is six participants spending 250, not one
		// spending 1,500. Pooling them would reject a perfectly legal sheet.
		const rows = [1, 2, 3, 4, 5, 6].map((n) =>
			raw(n, { market: MARKET_A, user: "", side: "YES", stake: "250" }),
		);
		const result = validateSeedRows(rows, OPEN);

		expect(result.errors).toEqual([]);
		expect(result.rows.length).toBe(6);
		expect(result.rows.every((r) => r.userLabel === null)).toBe(true);
	});

	// ── the `rows` contract ──────────────────────────────────────────────────
	it("seed-validate::rows-contains-only-rows-with-no-error", () => {
		// §16: "`rows` contains ONLY rows with no error." The caller treats
		// `errors.length > 0` as "run nothing", so the two outputs must never
		// describe overlapping sets — a row cannot be both reported and planned.
		const result = validateSeedRows(
			[
				raw(1, { user: "alpha" }),
				raw(2, { side: "nope" }),
				raw(3, { user: "gamma" }),
				raw(4, { stake: "1" }),
				raw(5, { argument: "  " }),
			],
			OPEN,
		);

		expect(errorRows(result)).toEqual([2, 4, 5]);
		expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 3]);
		const reported = new Set(errorRows(result));
		expect(result.rows.filter((r) => reported.has(r.rowNumber))).toEqual([]);
	});

	it("seed-validate::reports-an-empty-sheet-without-throwing", () => {
		const result = validateSeedRows([], OPEN);
		expect(result.rows).toEqual([]);
		expect(result.errors).toEqual([]);
	});
});
