import { beforeEach, describe, expect, it, vi } from "vitest";

// Bound the postgres.js connection pool. The vendored default
// (`idle_timeout: null`) makes the idle timer a LITERAL NO-OP — postgres.js
// `timer()` returns `{ cancel: noop, start: noop }` on a falsy interval — so a
// connection this pool opened was never closed until `max_lifetime` fired
// 30-60 min later.
//
// On the :5432 Supavisor SESSION pooler a checked-out server connection is
// held for the whole client session and the tenant ceiling is `pool_size: 15`,
// so "never closed" means "never given back". Measured on staging 2026-08-16:
// 12 of 15 slots held idle for up to 11 min, `/api/health` reporting
// `db:"error"`, and the server itself answering
// `FATAL: (EMAXCONNSESSION) max clients reached in session mode`.
//
// Approach mirrors tests/unit/upstash-redis-config.test.ts: mock `postgres` so
// the client constructor is a spy capturing its options arg, and mock the
// drizzle adapter so the fake client is never dereferenced. `vi.resetModules()`
// + a dynamic import makes the module-load construction deterministic.

import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

// The subset of the postgres.js options this test pins.
type CapturedClientOptions = {
	max?: number;
	prepare?: boolean;
	idle_timeout?: number | null;
	max_lifetime?: number | null;
};

const { postgresSpy } = vi.hoisted(() => ({
	postgresSpy: vi.fn(
		(_url: string, _options?: CapturedClientOptions): unknown => ({}),
	),
}));

vi.mock("postgres", () => ({ default: postgresSpy }));
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: vi.fn(() => ({})) }));

// Re-evaluate the client under a cleared module registry and return the options
// `postgres()` was constructed with (module-load capture).
async function loadClientOptions(): Promise<CapturedClientOptions> {
	vi.resetModules();
	postgresSpy.mockClear();
	await import("@/db");
	expect(postgresSpy).toHaveBeenCalledTimes(1);
	const captured = postgresSpy.mock.calls[0]?.[1];
	if (captured === undefined) {
		throw new Error("postgres() was called without an options argument");
	}
	return captured;
}

describe("db client — postgres.js pool options", () => {
	let options: CapturedClientOptions;

	beforeEach(async () => {
		options = await loadClientOptions();
	});

	it("db-client::arms-the-idle-timer (regression — EMAXCONNSESSION)", () => {
		// The DEFECT was a falsy value, not a wrong number: postgres.js
		// short-circuits `timer()` on anything falsy, so `null`/`0`/`undefined`
		// all silently disarm the idle timer and the pool leaks slots forever.
		// Assert the PROPERTY that makes the knob live, not only its value.
		expect(options.idle_timeout).toBeTypeOf("number");
		expect(options.idle_timeout).toBeGreaterThan(0);
		expect(Number.isFinite(options.idle_timeout)).toBe(true);
	});

	it("db-client::pins-idle-timeout-at-20s", () => {
		expect(options.idle_timeout).toBe(20);
	});

	it("db-client::idle-timeout-clears-the-debate-view-poll-cadence", () => {
		// Load-bearing COUPLING, not a restatement of the line above. 20 s is
		// chosen to sit above POLL_INTERVAL_MS_DEBATE_VIEW so an actively-polling
		// viewer keeps one warm connection instead of re-handshaking through
		// Supavisor every tick. If the poll cadence is ever raised past the idle
		// timeout, that reasoning inverts and this goes RED to force the re-think.
		const pollSeconds = POLL_INTERVAL_MS_DEBATE_VIEW / 1000;
		expect(options.idle_timeout).toBeGreaterThan(pollSeconds);
	});

	it("db-client::pins-max-lifetime-at-600s", () => {
		// Bounds a continuously-busy connection — the only kind `idle_timeout`
		// never reaches — against a vendored default of 1800-3600 s.
		expect(options.max_lifetime).toBe(600);
		expect(options.max_lifetime).toBeLessThan(1800);
	});

	it("db-client::pins-pool-max-and-prepare", () => {
		// Unchanged by this fix, pinned so the pool arithmetic behind the
		// timeouts above cannot drift silently: `max` is PER INSTANCE and a
		// Vercel instance is per DEPLOYMENT, against a 15-slot tenant pool.
		expect(options.max).toBe(10);
		// `prepare: false` — Supavisor compatibility (ADR-0024 §Decision #8).
		expect(options.prepare).toBe(false);
	});
});
