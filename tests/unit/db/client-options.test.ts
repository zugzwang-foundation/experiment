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

	it("db-client::idle-timeout-is-below-the-debate-view-poll-cadence", () => {
		// Load-bearing COUPLING, not a restatement of the line above.
		//
		// ⚠ INVERTED AT POLL-IDLE, by founder ruling. 20 s was chosen to sit
		// ABOVE the old 15 s poll so a lone polling viewer kept one warm
		// connection. The poll moved to 30 s and the idle timeout deliberately
		// did NOT follow: a lone poller now re-handshakes through Supavisor each
		// tick, and in exchange connections go back to the session pooler sooner
		// — the EMAXCONNSESSION-safe direction. If the two are ever made to agree
		// again, that is a new decision and this goes RED to force it.
		const pollSeconds = POLL_INTERVAL_MS_DEBATE_VIEW / 1000;
		expect(options.idle_timeout).toBeLessThan(pollSeconds);
	});

	it("db-client::pins-max-lifetime-at-600s", () => {
		// Bounds a continuously-busy connection — the only kind `idle_timeout`
		// never reaches — against a vendored default of 1800-3600 s.
		expect(options.max_lifetime).toBe(600);
		expect(options.max_lifetime).toBeLessThan(1800);
	});

	it("db-client::pins-pool-max-at-2 (the load-bearing control)", () => {
		// Pins the VALUE, deliberately — not a derivation of it.
		//
		// This assertion used to be a pair: `max === 4`, plus `max * 3 <= 15`
		// re-deriving that 4 from the Supavisor tenant pool. The second one is
		// removed rather than updated, because under the `:6543` transaction
		// pooler the two ceilings decouple — client connections rise to 200
		// while backend connections stay at 15 — so "three instances fit inside
		// 15" no longer describes what 4 is protecting against. A derivation
		// that has stopped describing its subject does not merely go quiet; it
		// fails for the wrong reason and teaches the next reader the wrong
		// ceiling. Moving `max` must go RED here as a decision that needs an
		// ADR touch, never as arithmetic against a phantom 15-slot bound. It
		// went RED exactly once so far — at ADR-0038 P3, which moved 4 → 2 on a
		// production measurement — and that is the mechanism working.
		expect(
			options.max,
			"`max` is pinned at 2 by ADR-0038 P3, on a measurement, and neither " +
				"reason is the tenant-pool arithmetic this test used to assert. " +
				"(1) It bounds what a SUSPENDED Vercel Fluid instance can STRAND: " +
				"a suspended instance keeps its sockets and runs no idle timer " +
				"(620 s idle measured against a 20 s idle_timeout). (2) Under the " +
				"transaction pooler the binding ceiling is CLIENT connections " +
				"(200 on Micro), spent as instances × max: on production, " +
				"2026-09-17, 200 concurrent readers → ~13 instances → 52 client " +
				"connections while Postgres held 7-9 backends of 45. Halving max " +
				"doubles the instances the same ceiling admits. Changing this " +
				"number is an ADR edit, not a test edit.",
		).toBe(2);
	});

	it("db-client::pins-prepare-false", () => {
		// Supavisor compatibility (ADR-0024 §Decision #8), and a precondition
		// for any future move to the :6543 transaction pooler.
		expect(options.prepare).toBe(false);
	});
});
