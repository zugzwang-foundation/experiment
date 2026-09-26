import { createRequire } from "node:module";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AWS-MIGRATION-3 item 2, tests-first (CLAUDE.md §5.6) — the runner-image
 * preload that keeps `headersTimeout` above `keepAliveTimeout`. Plan
 * `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 6: preload sets
 * `headersTimeout = keepAliveTimeout + 5000`; no-op without env.
 *
 * ⛔ WHY THIS EXISTS, AND WHY IT IS A PRELOAD RATHER THAN A CONFIG VALUE. The
 * ALB holds idle connections for 60 s and reuses them. Node's
 * `server.keepAliveTimeout` defaults to 5 s, so the ALB kept writing requests
 * onto sockets the target had already closed — the 0.1–0.5 % `HTTPCode_ELB_5XX`
 * floor the staging load test measured at EVERY load level, including idle.
 * Next's standalone `server.js` reads `KEEP_ALIVE_TIMEOUT` and sets
 * `keepAliveTimeout` from it — and nothing else. It never touches
 * `headersTimeout`, which stays at its 60 s default, and Node exposes no
 * environment variable for it. So raising keep-alive to 65 s alone INVERTS the
 * pair: `headersTimeout` (60 s) below `keepAliveTimeout` (65 s) means a request
 * whose headers arrive near the boundary is cut mid-parse — a new, quieter
 * version of the same 5xx. Both halves have to move together, and a
 * `--require` preload is the only place that can reach the server object Next
 * constructs for itself.
 *
 * ⚠ THE NO-OP ARM IS THE ONE THAT PROTECTS DEVELOPMENT. Without
 * `KEEP_ALIVE_TIMEOUT` the module must change NOTHING, so a local `next start`
 * (and CI, and any script that happens to preload it) behaves exactly as it does
 * today. A preload that defaulted to production numbers would silently change
 * the timing of every local run, and the symptom would appear somewhere else
 * entirely.
 *
 * HARNESS. The subject is a CommonJS module with a module-scope SIDE EFFECT on
 * the shared `node:http` object, which Vite's module graph does not mediate — so
 * `vi.resetModules()` alone cannot re-run it. Isolation here is three explicit
 * steps, done per arm:
 *
 *   1. `require.cache` entry deleted, so the module body runs again.
 *   2. `http.createServer` restored to the value captured before any arm ran, so
 *      one arm's monkey patch cannot be another arm's starting state.
 *   3. `KEEP_ALIVE_TIMEOUT` set or deleted, and restored afterwards.
 *
 * `createRequire` is used rather than an `import`: the ESM namespace object for a
 * builtin is not writable, and the patch this module installs is a WRITE to
 * `http.createServer` — so the test has to hold the same mutable CJS module
 * object the preload does, or it would be asserting against a different view of
 * `node:http` than the one production patches.
 */

const ENV = "KEEP_ALIVE_TIMEOUT";
const ORIGINAL_ENV = process.env[ENV];

const nodeRequire = createRequire(import.meta.url);
const PRELOAD_PATH = join(
	process.cwd(),
	"scripts",
	"docker",
	"server-timeouts.cjs",
);

const http = nodeRequire("node:http") as typeof import("node:http");
/** Captured ONCE, before any arm has had a chance to patch it. */
const PRISTINE_CREATE_SERVER = http.createServer;

/** Node's own documented defaults, and the no-op arm's expectation. */
const NODE_DEFAULT_KEEP_ALIVE_MS = 5_000;
const NODE_DEFAULT_HEADERS_MS = 60_000;

/** Run the preload's module body from scratch. */
function loadPreload(): void {
	delete nodeRequire.cache[PRELOAD_PATH];
	nodeRequire(PRELOAD_PATH);
}

/** A server built the way Next's standalone `server.js` builds one. */
function createServerAndRead(): {
	keepAliveTimeout: number;
	headersTimeout: number;
} {
	const server = http.createServer();
	const read = {
		keepAliveTimeout: server.keepAliveTimeout,
		headersTimeout: server.headersTimeout,
	};
	server.close();
	return read;
}

beforeEach(() => {
	vi.resetModules();
	http.createServer = PRISTINE_CREATE_SERVER;
	delete nodeRequire.cache[PRELOAD_PATH];
	delete process.env[ENV];
});

afterEach(() => {
	http.createServer = PRISTINE_CREATE_SERVER;
	delete nodeRequire.cache[PRELOAD_PATH];
	if (ORIGINAL_ENV === undefined) {
		delete process.env[ENV];
	} else {
		process.env[ENV] = ORIGINAL_ENV;
	}
});

describe("server-timeouts — the preload lifts headersTimeout above keep-alive", () => {
	it("server-timeouts::sets-keep-alive-65000-and-headers-70000", async () => {
		// Arrange — the production value from the plan's Values table.
		process.env[ENV] = "65000";

		// Act
		loadPreload();
		const server = createServerAndRead();

		// Assert — both halves. 65 s clears the ALB's 60 s idle timeout, and the
		// header bound sits 5 s above it so the pair can never invert.
		expect(server.keepAliveTimeout).toBe(65_000);
		expect(server.headersTimeout).toBe(70_000);
		// Stated as a relation as well as as two numbers: the relation is the
		// invariant, the numbers are today's configuration of it.
		expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
	});

	it("server-timeouts::the-margin-follows-the-configured-value", async () => {
		// A second, distinct value read back distinctly — so a hardcoded 70000 (or
		// a hardcoded 65000) cannot satisfy the row above.
		process.env[ENV] = "31000";

		loadPreload();
		const server = createServerAndRead();

		expect(server.keepAliveTimeout).toBe(31_000);
		expect(server.headersTimeout).toBe(36_000);
	});

	it("server-timeouts::a-value-above-the-ceiling-is-clamped-not-skipped", async () => {
		// Next applies KEEP_ALIVE_TIMEOUT on its own, so SKIPPING the patch for an
		// oversized value would silently recreate the keep-alive > headers
		// inversion; the preload clamps to its 600 s ceiling instead. A value at
		// 2^31 would otherwise make Node use 1 ms (TimeoutOverflowWarning).
		process.env[ENV] = "2147483647";

		loadPreload();
		const server = createServerAndRead();

		expect(server.keepAliveTimeout).toBe(600_000);
		expect(server.headersTimeout).toBe(605_000);
	});

	it("server-timeouts::applies-to-every-server-the-process-creates", async () => {
		// The patch is on the FACTORY, not on one instance. Next's standalone entry
		// may construct more than one server (and a script preloading this module
		// certainly can), so a patch that only reached the first would leave the
		// pair inverted on the rest.
		process.env[ENV] = "65000";
		loadPreload();

		const first = createServerAndRead();
		const second = createServerAndRead();

		expect(first.headersTimeout).toBe(70_000);
		expect(second.headersTimeout).toBe(70_000);
	});
});

describe("server-timeouts — without the env it changes nothing", () => {
	it("server-timeouts::no-env-leaves-node-defaults", async () => {
		// ⛔ THE LOCAL-DEVELOPMENT GUARD. `next start` on a laptop has no
		// KEEP_ALIVE_TIMEOUT, so the module must leave the process exactly as it
		// found it.
		expect(process.env[ENV]).toBeUndefined();

		loadPreload();
		const server = createServerAndRead();

		expect(server.keepAliveTimeout).toBe(NODE_DEFAULT_KEEP_ALIVE_MS);
		expect(server.headersTimeout).toBe(NODE_DEFAULT_HEADERS_MS);
	});

	it("server-timeouts::no-env-leaves-createServer-unwrapped", async () => {
		// ⛔ STRONGER THAN THE ROW ABOVE, AND IT IS WHAT MAKES THAT ROW NON-VACUOUS.
		// A patch that wrapped `createServer` and then assigned Node's own defaults
		// would satisfy every number above while still adding a wrapper to every
		// server in every local run. The absence of the wrapper is the actual
		// contract: "does nothing" must mean nothing, not "assigns the same values".
		loadPreload();

		expect(http.createServer).toBe(PRISTINE_CREATE_SERVER);
	});

	it("server-timeouts::garbage-in-the-env-is-treated-as-absent", async () => {
		// A malformed value must not become `NaN` on a server timeout — assigning
		// NaN disables the timeout entirely in Node, which is the most dangerous
		// possible reading of a typo. Fail back to Node's own behaviour instead.
		for (const value of ["", " ", "abc", "-1", "0", "not-a-number"]) {
			http.createServer = PRISTINE_CREATE_SERVER;
			process.env[ENV] = value;

			loadPreload();
			const server = createServerAndRead();

			expect(server.keepAliveTimeout).toBe(NODE_DEFAULT_KEEP_ALIVE_MS);
			expect(server.headersTimeout).toBe(NODE_DEFAULT_HEADERS_MS);
		}
	});
});

describe("server-timeouts — the patch is observable at all", () => {
	it("server-timeouts::positive-control-the-harness-can-see-a-patch", async () => {
		// ⛔ POSITIVE CONTROL for the two negative rows above. Every "unchanged"
		// assertion in this file rests on the harness being able to observe a
		// change. Prove it can: patch, observe, restore, observe.
		process.env[ENV] = "65000";
		loadPreload();
		expect(http.createServer).not.toBe(PRISTINE_CREATE_SERVER);
		expect(createServerAndRead().keepAliveTimeout).toBe(65_000);

		http.createServer = PRISTINE_CREATE_SERVER;
		expect(createServerAndRead().keepAliveTimeout).toBe(
			NODE_DEFAULT_KEEP_ALIVE_MS,
		);
	});
});
