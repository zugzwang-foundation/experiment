import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Per SCAFFOLD.15 plan §5.6 cron handler body — orphan-sweep loop tests.
// The cron handler body factors a `sweepOrphans({ db, deleteObject,
// batchSize, orphanWindowMinutes, circuitBreakerThreshold })` helper so the
// loop is testable without going through HTTP / auth / lock-acquire. The
// handler composes lock + auth + helper; the helper owns the sweep
// semantics.
//
// Covers (per plan §5.6 phase 3 — sweep loop):
//   - Selects only rows with terminal_state IS NULL and created_at older
//     than ORPHAN_WINDOW_MINUTES
//   - Per-row: deleteObject("uploads", key) THEN UPDATE terminal_state =
//     'orphan', terminal_at = now()
//   - Continues past per-row errors (R2 5xx, stale row) — accumulates
//     swept counter
//   - Circuit breaker: after CIRCUIT_BREAKER_THRESHOLD consecutive R2
//     failures, abort cleanly and return { status: 'r2_unavailable', swept }
//   - Successful delete resets the consecutive-failure counter
//
// Mocks:
//   - deleteObject is INJECTED (no module mock needed; the helper takes it
//     as a parameter). Tests pass a vi.fn() so they can script per-call
//     return / throw.
//
// NOT mocked: testDb (real DB rows; trigger semantics for the
// orphan transition are real). REFUSAL-2 / INV-2 indirect: orphan
// terminalization is a Bucket-B whitelisted transition; trigger rejects
// any other column mutation in the same UPDATE.

import { users } from "@/db/schema";
import {
	ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
	ORPHAN_WINDOW_MINUTES,
} from "@/server/config/limits";
import { sweepOrphans } from "@/server/storage/sweep-orphans";
import { testClient, testDb } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

beforeEach(() => {
	// no module-level mocks — see file header
});

afterEach(async () => {
	// Per ENGINE.6 §D.6 rebaseline: sweepOrphans now emits one
	// `image_upload.orphaned` event per CAS-success, so the events table
	// accumulates rows alongside image_uploads. TRUNCATE both to keep tests
	// isolated.
	await truncateTables(testClient, ["events", "image_uploads", "users"]);
	vi.clearAllMocks();
});

async function seedUser(suffix: string): Promise<{ userId: string }> {
	const [user] = await testDb
		.insert(users)
		.values({
			name: "Uploader",
			email: `sweep-${suffix}@example.com`,
			pseudonym: `sweep-${suffix}`,
		})
		.returning({ id: users.id });
	if (!user) throw new Error("user seed failed");
	return { userId: user.id };
}

// Insert an image_uploads row with a specified createdAt (minutes-ago).
// Uses raw SQL via testClient to bypass the Drizzle defaultNow() so we can
// simulate "old enough to be an orphan candidate" without time-travel.
async function seedUpload(
	userId: string,
	r2Key: string,
	minutesAgo: number,
	contentType = "image/jpeg",
	byteSize = 50_000,
): Promise<{ id: string }> {
	const rows = await testClient<{ id: string }[]>`
		INSERT INTO image_uploads
			(user_id, r2_object_key, content_type, byte_size, created_at)
		VALUES
			(${userId}, ${r2Key}, ${contentType}, ${byteSize},
			 now() - (${minutesAgo} || ' minutes')::interval)
		RETURNING id
	`;
	if (!rows[0]) throw new Error("upload seed failed");
	return { id: rows[0].id };
}

describe("sweepOrphans (SCAFFOLD.15 §5.6)", () => {
	// === Happy path: orphans get deleted from R2 + marked terminal =============

	it("orphan-sweep::deletes-r2-then-marks-orphan", async () => {
		// Single orphan-candidate row: deleteObject is called THEN UPDATE
		// terminal_state='orphan' fires. Verifies the two-phase per-row
		// order — if UPDATE went first and deleteObject threw, we'd lose
		// the row→key link for retry.
		const { userId } = await seedUser("ok-1");
		const { id } = await seedUpload(
			userId,
			"u/u/abc.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		expect(result.swept).toBe(1);
		expect(mockDelete).toHaveBeenCalledTimes(1);
		expect(mockDelete).toHaveBeenCalledWith("uploads", "u/u/abc.jpg");

		// DB state: terminal_state='orphan', terminal_at IS NOT NULL.
		const rows = await testClient<
			{ terminal_state: string | null; terminal_at: Date | null }[]
		>`SELECT terminal_state, terminal_at FROM image_uploads WHERE id = ${id}`;
		expect(rows[0]?.terminal_state).toBe("orphan");
		expect(rows[0]?.terminal_at).not.toBeNull();
	});

	it("orphan-sweep::skips-rows-newer-than-window", async () => {
		// Row inserted with created_at 5 minutes ago — younger than the
		// 120-minute window — MUST NOT be swept. Asserts the time filter
		// (WHERE created_at < now() - interval ...) actually fires.
		const { userId } = await seedUser("fresh");
		const { id } = await seedUpload(userId, "u/u/fresh.jpg", 5);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		expect(result.swept).toBe(0);
		expect(mockDelete).not.toHaveBeenCalled();
		// DB state: row is untouched (terminal_state stays NULL).
		const rows = await testClient<
			{ terminal_state: string | null }[]
		>`SELECT terminal_state FROM image_uploads WHERE id = ${id}`;
		expect(rows[0]?.terminal_state).toBeNull();
	});

	it("orphan-sweep::skips-rows-already-terminal", async () => {
		// A row that was already terminalized (e.g., 'committed' via W-2 or
		// 'blocked' via moderation) MUST NOT be re-swept. WHERE clause
		// is `terminal_state IS NULL` — the partial sweep index
		// (image_uploads_orphan_sweep_idx) embeds this filter.
		const { userId } = await seedUser("term");
		const { id } = await seedUpload(
			userId,
			"u/u/committed.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		// Apply a committed terminal state (uses two-column atomic transition).
		await testClient.unsafe(
			`UPDATE image_uploads
			   SET terminal_state = 'committed',
			       terminal_at = now()
			   WHERE id = $1`,
			[id],
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		expect(result.swept).toBe(0);
		expect(mockDelete).not.toHaveBeenCalled();
		// Row unchanged — still 'committed', terminal_at stable.
		const rows = await testClient<
			{ terminal_state: string | null }[]
		>`SELECT terminal_state FROM image_uploads WHERE id = ${id}`;
		expect(rows[0]?.terminal_state).toBe("committed");
	});

	// === Multi-row sweep ======================================================

	it("orphan-sweep::sweeps-multiple-orphans-in-single-batch", async () => {
		// Three orphan-candidate rows; helper sweeps all three; returns
		// swept=3. Each row's UPDATE fires.
		const { userId } = await seedUser("multi");
		const a = await seedUpload(userId, "u/u/a.jpg", ORPHAN_WINDOW_MINUTES + 5);
		const b = await seedUpload(userId, "u/u/b.png", ORPHAN_WINDOW_MINUTES + 10);
		const c = await seedUpload(
			userId,
			"u/u/c.webp",
			ORPHAN_WINDOW_MINUTES + 30,
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		expect(result.swept).toBe(3);
		expect(mockDelete).toHaveBeenCalledTimes(3);
		// All three keys were passed to deleteObject in some order.
		const calledKeys = mockDelete.mock.calls.map((c2) => c2[1]).sort();
		expect(calledKeys).toEqual(["u/u/a.jpg", "u/u/b.png", "u/u/c.webp"].sort());
		// Each DB row is now orphan-terminalized.
		const rows = await testClient<
			{ id: string; terminal_state: string | null }[]
		>`SELECT id, terminal_state FROM image_uploads
		   WHERE id = ANY (ARRAY[${a.id}, ${b.id}, ${c.id}]::uuid[])`;
		for (const r of rows) {
			expect(r.terminal_state).toBe("orphan");
		}
	});

	// === Per-row error continuation ===========================================

	it("orphan-sweep::continues-past-per-row-r2-error", async () => {
		// Two orphans. Per the UPDATE-then-delete order (SCAFFOLD.15 security-
		// auditor MEDIUM #1 absorption), BOTH rows are DB-orphan-terminalized
		// via CAS-UPDATE before the deleteObject hop. R2 delete fails on the
		// first call, succeeds on the second. The helper does not abort
		// (counter goes 0→1→0 due to the mid-success reset) and both rows
		// land orphan-terminalized. swept=2 (CAS-success count, not delete-
		// success count). Layer 1 R2 lifecycle catches the linger on row a.
		const { userId } = await seedUser("err-cont");
		const a = await seedUpload(
			userId,
			"u/u/err-a.jpg",
			ORPHAN_WINDOW_MINUTES + 5,
		);
		const b = await seedUpload(
			userId,
			"u/u/ok-b.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);

		const mockDelete = vi
			.fn()
			.mockRejectedValueOnce(new Error("R2 503"))
			.mockResolvedValueOnce(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});

		expect(result.status).toBe("ok");
		// swept counts DB-orphan-terminalizations (CAS-UPDATE wins), NOT R2
		// delete successes. Both rows landed orphan.
		expect(result.swept).toBe(2);
		expect(mockDelete).toHaveBeenCalledTimes(2);

		// Both rows are orphan-terminalized per the UPDATE-first order; R2
		// state for row a is "object lingers, will be caught by Layer 1
		// 90-day lifecycle per §12.6 layer asymmetry".
		const rows = await testClient<
			{ id: string; terminal_state: string | null }[]
		>`SELECT id, terminal_state FROM image_uploads
		   WHERE id = ANY (ARRAY[${a.id}, ${b.id}]::uuid[])`;
		const termCount = rows.filter((r) => r.terminal_state === "orphan").length;
		const nullCount = rows.filter((r) => r.terminal_state === null).length;
		expect(termCount).toBe(2);
		expect(nullCount).toBe(0);
	});

	// === Circuit breaker =====================================================

	it("orphan-sweep::circuit-breaker-aborts-after-N-consecutive-failures", async () => {
		// Seed CIRCUIT_BREAKER_THRESHOLD + 2 orphans. deleteObject throws on
		// every call. After THRESHOLD consecutive failures, sweep aborts;
		// remaining rows are NOT visited; result.status === 'r2_unavailable'.
		const threshold = ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD;
		const seedCount = threshold + 2;
		const { userId } = await seedUser("cb");
		for (let i = 0; i < seedCount; i++) {
			await seedUpload(
				userId,
				`u/u/cb-${i}.jpg`,
				ORPHAN_WINDOW_MINUTES + i + 1,
			);
		}
		const mockDelete = vi.fn().mockRejectedValue(new Error("R2 503"));

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: threshold,
		});

		expect(result.status).toBe("r2_unavailable");
		// Under the UPDATE-then-delete order, every processed row is DB-
		// orphan-terminalized BEFORE its delete is attempted. After `threshold`
		// consecutive R2 failures, the helper aborts — but the `threshold` rows
		// that did get visited are already CAS-UPDATED. swept = threshold.
		// Remaining `seedCount - threshold` rows are never visited.
		expect(result.swept).toBe(threshold);
		expect(mockDelete).toHaveBeenCalledTimes(threshold);
		// Sanity floor on the constant (per §5.5 placeholder = 5).
		expect(ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD).toBe(5);
	});

	it("orphan-sweep::circuit-breaker-resets-on-successful-delete", async () => {
		// Failures THEN a success THEN failures → counter resets on the
		// success, so the next failure-streak starts at 1, not at the prior
		// run-up. This proves the consecutive-failure counter is reset (not
		// monotonically incremented).
		//
		// Sequence: fail, fail, success, fail, fail, fail, fail, fail → at
		// (threshold) failures AFTER the reset, abort.
		const threshold = ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD;
		// Build a sequence of throws + a success + a long tail of throws.
		// Total rows: 2 fails + 1 success + (threshold) fails = threshold + 3.
		const totalRows = threshold + 3;
		const { userId } = await seedUser("cb-reset");
		for (let i = 0; i < totalRows; i++) {
			await seedUpload(
				userId,
				`u/u/reset-${i}.jpg`,
				ORPHAN_WINDOW_MINUTES + i + 1,
			);
		}
		const mockDelete = vi.fn();
		// fail, fail, success, then `threshold` consecutive fails.
		mockDelete.mockRejectedValueOnce(new Error("R2 503"));
		mockDelete.mockRejectedValueOnce(new Error("R2 503"));
		mockDelete.mockResolvedValueOnce(undefined);
		for (let i = 0; i < threshold; i++) {
			mockDelete.mockRejectedValueOnce(new Error("R2 503"));
		}

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: threshold,
		});

		expect(result.status).toBe("r2_unavailable");
		// Under the UPDATE-then-delete order, every visited row is CAS-
		// UPDATED before the delete is attempted. The threshold+3 visited
		// rows are all orphan-terminalized; swept = threshold + 3. R2
		// delete: 2 (pre-success fails) + 1 (success) + threshold (post-
		// reset fails) = threshold + 3 calls; abort fires at the
		// threshold-th consecutive R2 failure AFTER the reset.
		expect(result.swept).toBe(threshold + 3);
		expect(mockDelete).toHaveBeenCalledTimes(threshold + 3);
	});

	// === Bucket-B trigger compliance ==========================================

	it("orphan-sweep::transition-is-trigger-compliant-bucket-b", async () => {
		// The orphan terminalization (terminal_state + terminal_at flipped
		// together, single UPDATE, no other column touched) MUST satisfy
		// the image_uploads Bucket-B trigger (see
		// tests/db/triggers/image-uploads-append-only.spec.ts). If the
		// helper accidentally also touches r2_object_key or content_type,
		// the trigger fires P0001 — this test runs the full sweep against
		// a real row and verifies the trigger did NOT reject.
		const { userId } = await seedUser("trig-ok");
		const { id } = await seedUpload(
			userId,
			"u/u/trig.jpg",
			ORPHAN_WINDOW_MINUTES + 10,
		);
		const mockDelete = vi.fn().mockResolvedValue(undefined);

		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		expect(result.status).toBe("ok");
		expect(result.swept).toBe(1);

		// terminal_state + terminal_at both NOT NULL (atomic XOR holds);
		// other columns identity-stable.
		const rows = await testClient<
			{
				terminal_state: string | null;
				terminal_at: Date | null;
				r2_object_key: string;
				content_type: string;
				byte_size: number;
			}[]
		>`SELECT terminal_state, terminal_at, r2_object_key, content_type, byte_size
		   FROM image_uploads WHERE id = ${id}`;
		expect(rows[0]?.terminal_state).toBe("orphan");
		expect(rows[0]?.terminal_at).not.toBeNull();
		expect(rows[0]?.r2_object_key).toBe("u/u/trig.jpg");
		expect(rows[0]?.content_type).toBe("image/jpeg");
		expect(rows[0]?.byte_size).toBe(50_000);
	});

	// === Constants exposure ==================================================

	it("orphan-sweep::constants-have-spec-ratified-values", async () => {
		// Sanity floors on the SPEC.2 §12.6-ratified constants.
		expect(ORPHAN_WINDOW_MINUTES).toBe(120);
		expect(ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD).toBe(5);
	});

	// === Sanity: empty DB returns swept=0 ====================================

	it("orphan-sweep::empty-batch-returns-zero-swept", async () => {
		// No rows at all — helper exits immediately with swept=0.
		const mockDelete = vi.fn().mockResolvedValue(undefined);
		const result = await sweepOrphans({
			db: testDb,
			deleteObject: mockDelete,
			batchSize: 100,
			orphanWindowMinutes: ORPHAN_WINDOW_MINUTES,
			circuitBreakerThreshold: ORPHAN_SWEEP_CIRCUIT_BREAKER_THRESHOLD,
		});
		expect(result.status).toBe("ok");
		expect(result.swept).toBe(0);
		expect(mockDelete).not.toHaveBeenCalled();
	});
});
