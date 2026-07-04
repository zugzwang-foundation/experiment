import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUDIT-FIX-B1 A7 (rulings #5, #10-OVERRIDE) tests-first — `drainCronAlarms`
// against REAL Postgres. Emit-then-stamp, at-least-once, NO open tx across the
// Sentry hop: SELECT unprocessed cron_alarms → per-row safeCaptureMessage →
// single UPDATE ... SET processed_at = now() for ONLY the ids whose emit returned
// true. Plus the events_default fold: SELECT count(*) FROM events_default; if > 0
// → safeCaptureMessage("events_default_nonempty", ...).
//
// RED reason: GREENFIELD module — this file is COLLECTION-RED ("Cannot find
// module '@/server/observability/drain-cron-alarms'") until the implementer lands
// it. Only `@sentry/nextjs` is mocked (the vendor boundary); `safeCaptureMessage`
// runs FOR REAL, so a captureMessage throw on ONE row makes safeCaptureMessage
// return false → that row is NOT stamped (the at-least-once heart). `drainCronAlarms`
// uses the real `@/db` client; rows are seeded/read via `testClient` (same DB,
// :54322). cron_alarms + events_default are cleared in setup/teardown
// (events_default via the truncateTables fixture — 0021 guards partitions too).

const { mockCaptureMessage, mockFlush } = vi.hoisted(() => ({
	mockCaptureMessage: vi.fn(),
	mockFlush: vi.fn(),
}));
vi.mock("@sentry/nextjs", () => ({
	captureMessage: mockCaptureMessage,
	captureException: vi.fn(),
	addBreadcrumb: vi.fn(),
	flush: mockFlush,
}));

import { drainCronAlarms } from "@/server/observability/drain-cron-alarms";
import { testClient } from "../db/_fixtures/db";
import { truncateTables } from "../db/_fixtures/truncate";

async function seedAlarm(
	alarmId: string,
	payload: Record<string, unknown>,
): Promise<void> {
	await testClient.unsafe(
		`INSERT INTO cron_alarms (alarm_id, payload) VALUES ($1, $2::jsonb)`,
		[alarmId, JSON.stringify(payload)],
	);
}

async function readAlarms(): Promise<
	Array<{ alarm_id: string; processed_at: Date | null }>
> {
	return (await testClient.unsafe(
		`SELECT alarm_id, processed_at FROM cron_alarms ORDER BY id`,
	)) as unknown as Array<{ alarm_id: string; processed_at: Date | null }>;
}

async function truncate(): Promise<void> {
	await testClient.unsafe(`TRUNCATE cron_alarms`);
	// events_default is a partition: 0003's row-level guard never fired on
	// TRUNCATE, and 0021 now rejects it outright — cleared via the fixture
	// (owner-privilege disable → TRUNCATE → re-enable).
	await truncateTables(testClient, ["events_default"]);
}

describe("drainCronAlarms — cron_alarms drain (A7, real Postgres)", () => {
	beforeEach(async () => {
		mockCaptureMessage.mockReset();
		mockCaptureMessage.mockImplementation(() => "event-id");
		// Default: the Sentry transport confirms delivery, so the stamp proceeds
		// exactly as before flush-before-stamp landed (existing tests unchanged).
		mockFlush.mockReset();
		mockFlush.mockResolvedValue(true);
		await truncate();
	});
	afterEach(async () => {
		await truncate();
		vi.clearAllMocks();
	});

	it("alarms-drain::all-emitted-and-stamped", async () => {
		await seedAlarm("position_drift", { marketId: "m1" });
		await seedAlarm("dharma_chain_drift", { delta: "0.5" });
		await seedAlarm("single_side_violation", { userId: "u1" });

		const result = await drainCronAlarms();

		expect(result.selected).toBe(3);
		expect(result.emitted).toBe(3);
		expect(result.stamped).toBe(3);
		expect(result.defaultPartitionCount).toBe(0);

		// Every row stamped (processed_at set).
		const rows = await readAlarms();
		expect(rows.every((r) => r.processed_at !== null)).toBe(true);

		// One title-matched emit per row with the level + tag container.
		expect(mockCaptureMessage).toHaveBeenCalledTimes(3);
		for (const alarmId of [
			"position_drift",
			"dharma_chain_drift",
			"single_side_violation",
		]) {
			expect(mockCaptureMessage).toHaveBeenCalledWith(
				alarmId,
				expect.objectContaining({
					level: "error",
					tags: { alarm_id: alarmId },
				}),
			);
		}
	});

	it("alarms-drain::one-emit-fails-leaves-that-row-unstamped-then-rerun-reemits-only-it", async () => {
		await seedAlarm("position_drift", { a: 1 });
		await seedAlarm("dharma_chain_drift", { b: 2 });
		await seedAlarm("single_side_violation", { c: 3 });

		// captureMessage throws for exactly ONE alarm_id → safeCaptureMessage returns
		// false for that row → it is NOT stamped; the other two ARE.
		mockCaptureMessage.mockImplementation((name: string) => {
			if (name === "dharma_chain_drift") {
				throw new Error("sentry down for this one");
			}
			return "event-id";
		});

		const first = await drainCronAlarms();
		expect(first.selected).toBe(3);
		expect(first.emitted).toBe(2);
		expect(first.stamped).toBe(2);

		const afterFirst = await readAlarms();
		const failedRow = afterFirst.find(
			(r) => r.alarm_id === "dharma_chain_drift",
		);
		const okRows = afterFirst.filter(
			(r) => r.alarm_id !== "dharma_chain_drift",
		);
		// THE at-least-once heart: the failed emit's row stays unprocessed.
		expect(failedRow?.processed_at).toBeNull();
		expect(okRows.every((r) => r.processed_at !== null)).toBe(true);

		// Second tick: Sentry recovers → re-emit ONLY the still-unstamped row.
		mockCaptureMessage.mockReset();
		mockCaptureMessage.mockImplementation(() => "event-id");

		const second = await drainCronAlarms();
		expect(second.selected).toBe(1);
		expect(second.emitted).toBe(1);
		expect(second.stamped).toBe(1);
		expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
		expect(mockCaptureMessage).toHaveBeenCalledWith(
			"dharma_chain_drift",
			expect.objectContaining({
				level: "error",
				tags: { alarm_id: "dharma_chain_drift" },
			}),
		);

		const afterSecond = await readAlarms();
		expect(afterSecond.every((r) => r.processed_at !== null)).toBe(true);
	});

	it("alarms-drain::flush-miss-stamps-nothing-all-rows-stay-unprocessed", async () => {
		await seedAlarm("position_drift", { a: 1 });
		await seedAlarm("dharma_chain_drift", { b: 2 });
		await seedAlarm("single_side_violation", { c: 3 });

		// Delivery-level at-least-once: every per-row enqueue succeeds, but the
		// Sentry transport flush does NOT confirm delivery within the budget →
		// stamp NOTHING. Every row re-drains next tick (fingerprint dedup absorbs
		// the re-emit). This is the flush-before-stamp heart (B1 close-out ruling).
		mockFlush.mockResolvedValue(false);

		const result = await drainCronAlarms();

		expect(result.selected).toBe(3);
		expect(result.emitted).toBe(3); // all enqueued...
		expect(result.stamped).toBe(0); // ...but none retired
		expect(result.flushed).toBe(false);

		// Every row still unprocessed — the delivery-level at-least-once guarantee.
		const rows = await readAlarms();
		expect(rows.every((r) => r.processed_at === null)).toBe(true);
	});

	it("alarms-drain::flush-throw-is-fail-safe-stamps-nothing-and-returns", async () => {
		await seedAlarm("position_drift", { a: 1 });

		// A flush REJECT is swallowed by safeFlush (fail-open §17.5) → treated as
		// not-flushed → stamp none; drainCronAlarms returns normally and NEVER
		// breaks the cron route (the crash arm is the route's, not the drain's).
		mockFlush.mockRejectedValue(new Error("sentry transport exploded"));

		const result = await drainCronAlarms(); // must NOT throw

		expect(result.selected).toBe(1);
		expect(result.emitted).toBe(1);
		expect(result.stamped).toBe(0);
		expect(result.flushed).toBe(false);

		const rows = await readAlarms();
		expect(rows.every((r) => r.processed_at === null)).toBe(true);
	});

	it("alarms-drain::events-default-nonempty-emits-with-count", async () => {
		// An out-of-range created_at routes to the DEFAULT partition (monthly ranges
		// cover 2026-05 .. 2027-05). No cron_alarms rows.
		await testClient.unsafe(
			`INSERT INTO events (event_type, aggregate_type, aggregate_id, payload, payload_version, metadata, created_at)
			 VALUES ('test.default_partition', 'test', gen_random_uuid(), '{}'::jsonb, 1, '{}'::jsonb, '2020-01-01T00:00:00Z')`,
		);

		const result = await drainCronAlarms();

		expect(result.selected).toBe(0);
		expect(result.emitted).toBe(0);
		expect(result.stamped).toBe(0);
		expect(result.defaultPartitionCount).toBe(1);

		expect(mockCaptureMessage).toHaveBeenCalledWith(
			"events_default_nonempty",
			expect.objectContaining({
				level: "error",
				extra: expect.objectContaining({ count: 1 }),
			}),
		);
	});

	it("alarms-drain::empty-queue-is-a-zero-result-no-op", async () => {
		const result = await drainCronAlarms();
		expect(result).toEqual({
			selected: 0,
			emitted: 0,
			stamped: 0,
			defaultPartitionCount: 0,
			flushed: true,
		});
		expect(mockCaptureMessage).not.toHaveBeenCalled();
	});
});
