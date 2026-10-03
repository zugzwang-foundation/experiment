import { describe, expect, it } from "vitest";

// SEED-STAGING-1 §6 (grouping + ordering), §7 (idempotency and re-runs) and
// §16 `plan.ts` — the pure layer between a validated sheet and the engine.
//
// THE POINT OF THIS FILE: §5 says there is NO STORED JOB STATE. The browser
// holds the rows and sends them back in chunks, so the only thing that makes a
// resumed or repeated upload safe is that the SAME sheet derives the SAME ids,
// every time, from the content alone. That makes `computeBatchId` the hinge of
// §7: if it is unstable the idempotency keys change, the `bet_receipts` unique
// never fires, and re-uploading a file duplicates ~600 arguments on staging. If
// it is too stable — insensitive to a field or to order — a CORRECTED sheet
// silently reuses the old run's keys and the corrections are skipped.
//
// So the four properties asserted here are: deterministic, order-sensitive,
// field-sensitive, and wire-legal (`IDEMPOTENCY_KEY_REGEX`, because a key the
// bet endpoint would reject with `error_idempotency_key_invalid` is not a key).

import { IDEMPOTENCY_KEY_REGEX } from "@/server/idempotency/types";
import {
	computeBatchId,
	planSeedBatch,
	SEED_REQUEST_ID_PREFIX,
	seedIdempotencyKey,
	seedParticipantEmail,
} from "@/server/seed/plan";
import type { SeedRow } from "@/server/seed/types";

const MARKET_A = "seed-market-a";
const MARKET_B = "seed-market-b";

function row(rowNumber: number, over: Partial<SeedRow> = {}): SeedRow {
	return {
		rowNumber,
		marketSlug: MARKET_A,
		userLabel: null,
		side: "YES",
		stake: "10",
		body: "a perfectly ordinary argument",
		replyToRow: null,
		...over,
	};
}

/** The planned execution order — groups flattened, which is what `run.ts` indexes. */
function flatten(groups: { rows: SeedRow[] }[]): number[] {
	return groups.flatMap((g) => g.rows.map((r) => r.rowNumber));
}

describe("seed-plan — grouping and ordering (§6 steps 3 and 4)", () => {
	it("seed-plan::groups-markets-in-first-appearance-order", () => {
		// Sheet order decides group order, NOT alphabetical or insertion into a
		// Set of slugs. The operator reads their own file top-down, and the final
		// report is per market — so the first market they wrote is the first one
		// they see move.
		const groups = planSeedBatch([
			row(1, { marketSlug: MARKET_B }),
			row(2, { marketSlug: MARKET_A }),
			row(3, { marketSlug: MARKET_B }),
			row(4, { marketSlug: MARKET_A }),
		]);

		expect(groups.map((g) => g.marketSlug)).toEqual([MARKET_B, MARKET_A]);
	});

	it("seed-plan::keeps-sheet-order-within-a-group", () => {
		const groups = planSeedBatch([
			row(1, { marketSlug: MARKET_B }),
			row(2, { marketSlug: MARKET_A }),
			row(3, { marketSlug: MARKET_B }),
			row(4, { marketSlug: MARKET_A }),
			row(5, { marketSlug: MARKET_B }),
		]);

		expect(groups[0]?.rows.map((r) => r.rowNumber)).toEqual([1, 3, 5]);
		expect(groups[1]?.rows.map((r) => r.rowNumber)).toEqual([2, 4]);
		// §6 step 5: the groups are independent, so the flattened order runs one
		// market to its end before touching the next. That is what makes "a
		// failure in one market doesn't affect the others" implementable.
		expect(flatten(groups)).toEqual([1, 3, 5, 2, 4]);
	});

	it("seed-plan::never-places-a-reply-before-its-parent", () => {
		// §6's ordering rule — "sheet order, except that a reply is never posted
		// before its parent". It holds because `validateSeedRows` already refused
		// any `replyToRow` that is not EARLIER and in the SAME market, and
		// grouping preserves sheet order — but it is asserted at this boundary
		// because the property the engine depends on is about the PLANNED order,
		// and a future ranking or shuffling step here would break it silently.
		//
		// ⚠ Cited by its RULE and not by its step number, deliberately: this
		// comment read "§6 step 4" until the §6.1 edit renumbered that list and
		// dropped the step, so the citation named a step the plan no longer had
		// (O-8 — a reference fenced by position goes stale from the very edit it
		// describes). The rule is the durable part.
		const groups = planSeedBatch([
			row(1, { marketSlug: MARKET_A, userLabel: "alpha" }),
			row(2, { marketSlug: MARKET_B, userLabel: "beta" }),
			row(3, { marketSlug: MARKET_A, userLabel: "gamma", replyToRow: 1 }),
			row(4, { marketSlug: MARKET_B, userLabel: "delta", replyToRow: 2 }),
		]);

		const order = flatten(groups);
		expect(order.indexOf(1)).toBeLessThan(order.indexOf(3));
		expect(order.indexOf(2)).toBeLessThan(order.indexOf(4));
	});

	it("seed-plan::groups-an-empty-batch-into-nothing", () => {
		expect(planSeedBatch([])).toEqual([]);
	});

	it("seed-plan::loses-no-row", () => {
		// A grouping bug that DROPS a row is the one that produces a green run
		// with a short report, so the count is asserted independently of order.
		const rows = [
			row(1, { marketSlug: MARKET_A }),
			row(2, { marketSlug: MARKET_B }),
			row(3, { marketSlug: MARKET_A }),
			row(4, { marketSlug: "third-market" }),
		];
		const groups = planSeedBatch(rows);
		expect(flatten(groups).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
		expect(groups.length).toBe(3);
	});
});

describe("seed-plan — the batch id (§7)", () => {
	const rows = [
		row(1, { userLabel: "alpha" }),
		row(2, { marketSlug: MARKET_B, userLabel: "beta", side: "NO" }),
	];

	it("seed-plan::batch-id-is-a-sha256-hex-digest", () => {
		const id = computeBatchId(rows);
		expect(id).toMatch(/^[0-9a-f]{64}$/);
	});

	it("seed-plan::batch-id-is-deterministic-for-the-same-rows", () => {
		// The whole of §7 rests on this line: the same file re-uploaded derives
		// the same keys, so the re-run skips instead of duplicating.
		expect(computeBatchId(rows)).toBe(computeBatchId(rows));
		// A structurally-equal but distinct array — the digest is over the DATA,
		// never over object identity.
		expect(computeBatchId(rows.map((r) => ({ ...r })))).toBe(
			computeBatchId(rows),
		);
	});

	it("seed-plan::batch-id-is-order-sensitive", () => {
		// Two sheets with the same rows in a different order are different runs:
		// row numbers drive the keys, and the order drives who posts first and
		// therefore what price everyone after them pays.
		const reversed = [...rows].reverse();
		expect(computeBatchId(reversed)).not.toBe(computeBatchId(rows));
	});

	it("seed-plan::batch-id-changes-when-any-field-changes", () => {
		// Field by field, because an id computed from a SUBSET would make an
		// edited sheet reuse the previous run's keys — and a corrected argument
		// would then report `skipped` and never appear. Every field is part of
		// what the operator meant.
		const base = row(1, { userLabel: "alpha", replyToRow: null });
		const baseId = computeBatchId([base]);

		const mutations: SeedRow[] = [
			{ ...base, rowNumber: 2 },
			{ ...base, marketSlug: MARKET_B },
			{ ...base, userLabel: "beta" },
			{ ...base, userLabel: null },
			{ ...base, side: "NO" },
			{ ...base, stake: "11" },
			{ ...base, body: `${base.body}.` },
			{ ...base, replyToRow: 1 },
		];

		for (const mutated of mutations) {
			expect(computeBatchId([mutated])).not.toBe(baseId);
		}
		// Distinctness across the whole set, not just against the base — two
		// different edits must not collapse onto one id either.
		const ids = new Set([baseId, ...mutations.map((m) => computeBatchId([m]))]);
		expect(ids.size).toBe(mutations.length + 1);
	});
});

describe("seed-plan — derived identifiers (§7, §8)", () => {
	const BATCH_ID = computeBatchId([row(1, { userLabel: "alpha" })]);

	it("seed-plan::idempotency-key-has-the-contract-shape", () => {
		expect(seedIdempotencyKey(BATCH_ID, 1)).toBe(
			`seed-${BATCH_ID.slice(0, 16)}-r1`,
		);
		expect(seedIdempotencyKey(BATCH_ID, 617)).toBe(
			`seed-${BATCH_ID.slice(0, 16)}-r617`,
		);
	});

	it("seed-plan::idempotency-key-matches-IDEMPOTENCY_KEY_REGEX", () => {
		// ⚠ NOT a restatement of the shape above. The key is what reaches
		// `bets.idempotency_key` / `bet_receipts.idempotency_key`, and the wire
		// contract (SPEC.2 §11) is `^[A-Za-z0-9_-]{1,255}$`. A prefix with a `:`
		// or a `@` in it would be rejected as malformed at the endpoint, so the
		// regex is imported from the module that owns it rather than copied.
		for (const n of [1, 9, 25, 600]) {
			expect(IDEMPOTENCY_KEY_REGEX.test(seedIdempotencyKey(BATCH_ID, n))).toBe(
				true,
			);
		}
	});

	it("seed-plan::idempotency-key-is-unique-per-row-and-per-batch", () => {
		const otherBatch = computeBatchId([row(1, { userLabel: "beta" })]);
		const keys = new Set([
			seedIdempotencyKey(BATCH_ID, 1),
			seedIdempotencyKey(BATCH_ID, 2),
			seedIdempotencyKey(otherBatch, 1),
			seedIdempotencyKey(otherBatch, 2),
		]);
		expect(keys.size).toBe(4);
	});

	it("seed-plan::participant-email-for-a-label-is-the-lowercased-label", () => {
		// §7: "a label maps to the deterministic email". Lowercased, so a sheet
		// that writes `Alpha` on one row and `alpha` on another means ONE
		// participant — the email is the lookup key, and email is matched
		// case-insensitively by every provider but not by a string compare.
		expect(seedParticipantEmail(BATCH_ID, row(1, { userLabel: "alpha" }))).toBe(
			"seed-alpha@seed.staging.invalid",
		);
		expect(seedParticipantEmail(BATCH_ID, row(2, { userLabel: "ALPHA" }))).toBe(
			"seed-alpha@seed.staging.invalid",
		);
		expect(seedParticipantEmail(BATCH_ID, row(3, { userLabel: "Alpha" }))).toBe(
			"seed-alpha@seed.staging.invalid",
		);
	});

	it("seed-plan::participant-email-for-a-label-ignores-the-row-number", () => {
		// The same label on rows 1 and 40 is the same person — that is the whole
		// purpose of the column (§4).
		const a = seedParticipantEmail(BATCH_ID, row(1, { userLabel: "beta" }));
		const b = seedParticipantEmail(BATCH_ID, row(40, { userLabel: "beta" }));
		expect(a).toBe(b);
	});

	it("seed-plan::participant-email-for-a-blank-label-is-batch-and-row-scoped", () => {
		expect(seedParticipantEmail(BATCH_ID, row(7))).toBe(
			`seed-${BATCH_ID.slice(0, 12)}-r7@seed.staging.invalid`,
		);
		// A blank label is a NEW participant per row — two blank rows are two
		// people — yet still DETERMINISTIC, so a re-run of the same file reuses
		// them instead of minting a second set and burning the identity pool.
		expect(seedParticipantEmail(BATCH_ID, row(7))).toBe(
			seedParticipantEmail(BATCH_ID, row(7)),
		);
		expect(seedParticipantEmail(BATCH_ID, row(7))).not.toBe(
			seedParticipantEmail(BATCH_ID, row(8)),
		);
	});

	it("seed-plan::every-participant-email-is-on-the-reserved-invalid-domain", () => {
		// G4. `.invalid` is reserved by RFC 2606 and can never be delivered or
		// registered, so a seeded account can never belong to a real person and
		// is greppable in one query. Both arms of the function, asserted together
		// — the blank-label arm is the one a reader is most likely to forget.
		const emails = [
			seedParticipantEmail(BATCH_ID, row(1, { userLabel: "alpha" })),
			seedParticipantEmail(BATCH_ID, row(2)),
		];
		for (const email of emails) {
			expect(email.endsWith("@seed.staging.invalid")).toBe(true);
			expect(email.startsWith("seed-")).toBe(true);
		}
	});

	it("seed-plan::request-id-prefix-is-the-pinned-provenance-tag", () => {
		// §8 Provenance: `metadata.request_id = "seed-staging:<batchId[0:16]>"` on
		// every event the tool causes, which is how seeded activity is identified
		// in the append-only log with NO schema change. The prefix is pinned here
		// because a drifted string would leave the log unqueryable after the fact
		// and the rows are not editable (INV-4 family).
		expect(SEED_REQUEST_ID_PREFIX).toBe("seed-staging:");
	});
});
