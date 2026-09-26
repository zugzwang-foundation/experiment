import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AWS-MIGRATION-3 item 4, tests-first (CLAUDE.md §5.6) — the `/api/ready`
 * warm-up gate. Plan `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 5: 503
 * before warm, 200 after, once-per-process memo, a failed/timed-out fetch counts
 * as done, market list read.
 *
 * ⛔ WHY A SECOND HEALTH PATH EXISTS AT ALL. `/api/health` answers the question
 * "is this process alive", and a process is alive long before it can serve. The
 * staging load test measured a task 2½ minutes old with empty caches collapsing
 * under twelve concurrent users; the ALB had already put it in rotation, because
 * the only thing it asked was whether the port answered. Liveness and readiness
 * are different questions and the target group needs the second one — hence
 * `config.readinessPath` in compute-stack.ts pointing here while the CONTAINER
 * check stays on `/api/health`.
 *
 * ⛔ THE TWO PROPERTIES THAT ARE EASY TO GET BACKWARDS, both asserted below:
 *
 *   1. SEQUENTIAL, NOT PARALLEL. Warming in parallel is the obvious
 *      implementation and it defeats the purpose: it reproduces, on a cold
 *      process, exactly the concurrent-cold-render storm the gate exists to keep
 *      traffic away from. A `Promise.all` passes any assertion about WHICH paths
 *      were fetched, so sequentiality is proved by holding the first fetch open
 *      and observing that the second has not started.
 *
 *   2. A FAILURE COUNTS AS DONE. A market whose page cannot render must make the
 *      task COLDER, never undeployable. If a failed warm left the process
 *      un-ready, one bad market would answer 503 forever, the target group would
 *      empty, and the surface would go dark — the reads included. So `warmUp`
 *      resolves `ready: true` even when every path fails, and the failures are
 *      reported rather than thrown.
 *
 * HARNESS. `warmUp` takes every effect as a dependency, so its tests inject a
 * fake `fetchImpl` and fake readers — no network, no DB, no Next runtime. The
 * `readiness()` memo test needs the module's REAL default deps, so `@/db` is
 * stubbed to return no rows and `globalThis.fetch` is spied; the subject there is
 * promise IDENTITY, not what the warm did. The route tests mock
 * `@/server/health/ready` through `vi.doMock` (NOT the hoisted `vi.mock`, which
 * would also replace the module the `warmUp` tests are here to exercise) and
 * re-import the route per arm so its module-scope state is fresh.
 *
 * Every import is DYNAMIC and inside a test, so a missing module reds the
 * individual row with its own message instead of failing collection for the
 * whole file (O-3 — a true refusal reported with a misleading cause is a defect).
 */

// `readiness()`'s default deps read two tables. No rows is the right stub: it
// makes the memo test about memoisation and nothing else.
const EMPTY_ROWS: never[] = [];
const selectChain = {
	from: () => selectChain,
	where: () => Promise.resolve(EMPTY_ROWS),
	limit: () => Promise.resolve(EMPTY_ROWS),
};
// READY-REQUEST-TIME — the route now opens with `await connection()`, which
// throws outside a Next.js request scope; these direct GET() calls are not
// requests, so the gate is stubbed. The build-time half is pinned by
// tests/unit/health/ready-request-time.test.ts.
vi.mock("next/server", async (importOriginal) => ({
	...(await importOriginal<typeof import("next/server")>()),
	connection: vi.fn(async () => undefined),
}));
vi.mock("@/db", () => ({ db: { select: () => selectChain } }));

const BASE = "http://127.0.0.1:3000";

type ReadyModule = typeof import("@/server/health/ready");

async function loadReady(): Promise<ReadyModule> {
	return await import("@/server/health/ready");
}

/** A promise that settles when `release()` is called. */
function deferred<T>(): {
	promise: Promise<T>;
	release: (value: T) => void;
} {
	let release!: (value: T) => void;
	const promise = new Promise<T>((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

/** Yield to the macrotask queue so pending chains can advance. */
function tick(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Reject a response that takes too long, so a BLOCKING implementation reds with
 * a sentence rather than with the runner's 10 s timeout. The route must answer
 * at once while the warm is in flight; an ALB health check that is held open for
 * the warm budget is marked unhealthy on the probe timeout, which is the
 * opposite of what this gate is for.
 */
async function promptly<T>(work: Promise<T>, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const bound = new Promise<never>((_resolve, reject) => {
		timer = setTimeout(
			() => reject(new Error(`${label} did not answer within 1000 ms`)),
			1000,
		);
	});
	try {
		return await Promise.race([work, bound]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("ready-warmup — warmUp walks the pages a cold task cannot serve", () => {
	it("ready-warmup::warms-home-then-every-open-market-then-a-profile", async () => {
		// Arrange
		const { warmUp } = await loadReady();
		const seen: string[] = [];
		const fetchImpl = vi.fn(async (url: string) => {
			seen.push(url);
		});

		// Act
		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["first-market", "second-market"],
			profilePseudonym: async () => "some-pseudonym",
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
			log: vi.fn(),
		});

		// Assert — the exact URL sequence. Home first because it is the entry
		// point; the markets because they are the expensive renders; one profile
		// because `/u/[pseudonym]` has its own read model and its own caches.
		expect(seen).toEqual([
			`${BASE}/`,
			`${BASE}/m/first-market`,
			`${BASE}/m/second-market`,
			`${BASE}/u/some-pseudonym`,
		]);
		expect(result.ready).toBe(true);
		expect(result.warmed).toEqual([
			"/",
			"/m/first-market",
			"/m/second-market",
			"/u/some-pseudonym",
		]);
		expect(result.failed).toEqual([]);
		expect(typeof result.durationMs).toBe("number");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("ready-warmup::fetches-sequentially-not-in-parallel", async () => {
		// ⛔ THE ROW THAT CANNOT BE PASSED BY A `Promise.all`. Hold the FIRST fetch
		// open and assert nothing else has started. A parallel implementation has
		// all four in flight before the first tick, and would satisfy every
		// assertion in the row above.
		const { warmUp } = await loadReady();
		const gate = deferred<void>();
		const seen: string[] = [];
		const fetchImpl = vi.fn(async (url: string) => {
			seen.push(url);
			if (seen.length === 1) await gate.promise;
		});

		const walk = warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["a", "b"],
			profilePseudonym: async () => "p",
			perFetchTimeoutMs: 5000,
			totalBudgetMs: 10_000,
			log: vi.fn(),
		});

		await tick();
		expect(seen).toEqual([`${BASE}/`]);

		gate.release();
		const result = await walk;
		expect(seen).toHaveLength(4);
		expect(result.warmed).toHaveLength(4);
	});

	it("ready-warmup::each-fetch-is-given-an-abort-signal", async () => {
		// The per-fetch bound is the AbortSignal, so a fetch that is never handed
		// one is a fetch that can hang for the whole budget. Asserted on the
		// argument rather than on the timing, because the timing arm below can only
		// prove it when a fetch actually honours the signal.
		const { warmUp } = await loadReady();
		// ⚠ The parameters are DECLARED even though the body ignores them. A
		// zero-arity `vi.fn` types `mock.calls` as `[][]`, so reading `[1]` off a
		// call is a compile error (TS2493) — and an assertion that cannot be
		// compiled is not a weaker assertion, it is no assertion.
		const fetchImpl = vi.fn(
			async (_url: string, _init: { signal: AbortSignal }) => undefined,
		);

		await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => [],
			profilePseudonym: async () => null,
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
		});

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const init = fetchImpl.mock.calls[0]?.[1];
		expect(init?.signal).toBeInstanceOf(AbortSignal);
		expect(init?.signal.aborted).toBe(false);
	});

	it("ready-warmup::a-rejecting-fetch-is-recorded-and-the-walk-continues", async () => {
		// Arrange — the SECOND path fails. The third and fourth must still be
		// fetched: one unrenderable market may not stop the rest of the warm.
		const { warmUp } = await loadReady();
		const seen: string[] = [];
		const fetchImpl = vi.fn(async (url: string) => {
			seen.push(url);
			if (url.endsWith("/m/broken")) {
				throw new Error("500 from the debate route");
			}
		});

		// Act
		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["broken", "fine"],
			profilePseudonym: async () => "p",
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
			log: vi.fn(),
		});

		// Assert
		expect(result.ready).toBe(true);
		expect(result.failed).toEqual(["/m/broken"]);
		expect(result.warmed).toEqual(["/", "/m/fine", "/u/p"]);
		expect(seen).toHaveLength(4);
	});

	it("ready-warmup::a-timed-out-fetch-is-recorded-and-the-walk-continues", async () => {
		// The honest fake: a fetch that never settles on its own and rejects when
		// its signal aborts — which is what `fetch` does. So this row exercises the
		// real per-fetch timeout path rather than a thrown error dressed up as one.
		const { warmUp } = await loadReady();
		const seen: string[] = [];
		const fetchImpl = vi.fn(
			(url: string, init: { signal: AbortSignal }) =>
				new Promise<void>((resolve, reject) => {
					seen.push(url);
					if (!url.endsWith("/m/hangs")) {
						resolve();
						return;
					}
					init.signal.addEventListener("abort", () =>
						reject(new Error("aborted")),
					);
				}),
		);

		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["hangs", "fine"],
			profilePseudonym: async () => "p",
			perFetchTimeoutMs: 25,
			totalBudgetMs: 5000,
			log: vi.fn(),
		});

		expect(result.ready).toBe(true);
		expect(result.failed).toEqual(["/m/hangs"]);
		expect(result.warmed).toEqual(["/", "/m/fine", "/u/p"]);
	});

	it("ready-warmup::ready-is-true-even-when-every-path-fails", async () => {
		// ⛔ THE ANTI-OUTAGE ROW. Readiness is "this process tried, once" — the
		// strongest promise that cannot leave a service with zero healthy targets.
		// An implementation that reported `ready: false` on failure, or threw, would
		// take the READS down during an incident that only affected writes.
		const { warmUp } = await loadReady();
		const log = vi.fn();

		const result = await warmUp({
			fetchImpl: async () => {
				throw new Error("nothing renders");
			},
			baseUrl: BASE,
			listOpenSlugs: async () => ["a", "b"],
			profilePseudonym: async () => "p",
			perFetchTimeoutMs: 100,
			totalBudgetMs: 5000,
			log,
		});

		expect(result.ready).toBe(true);
		expect(result.failed).toEqual(["/", "/m/a", "/m/b", "/u/p"]);
		expect(result.warmed).toEqual([]);
		// A silent total failure is the worst version of this: the task reports
		// ready, serves nothing well, and nothing in the log says why.
		expect(log).toHaveBeenCalled();
	});

	it("ready-warmup::a-failing-market-list-does-not-fail-the-warm", async () => {
		// The market list is a DB read and the DB can be slow or briefly
		// unreachable on a cold task. That must degrade the warm to "home page
		// only", never fail it — the same reasoning as the row above, one layer up.
		const { warmUp } = await loadReady();
		const fetchImpl = vi.fn(async () => undefined);

		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => {
				throw new Error("db not up yet");
			},
			profilePseudonym: async () => null,
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
			log: vi.fn(),
		});

		expect(result.ready).toBe(true);
		expect(result.warmed).toEqual(["/"]);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	it("ready-warmup::no-profile-means-no-profile-fetch", async () => {
		// A fresh environment has no users, so `/u/undefined` must never be
		// requested — it would 404 and be recorded as a failure that means nothing.
		const { warmUp } = await loadReady();
		const seen: string[] = [];
		const fetchImpl = vi.fn(async (url: string) => {
			seen.push(url);
		});

		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["only-market"],
			profilePseudonym: async () => null,
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
		});

		expect(seen).toEqual([`${BASE}/`, `${BASE}/m/only-market`]);
		expect(result.failed).toEqual([]);
	});

	it("ready-warmup::no-open-markets-still-warms-the-home-page", async () => {
		const { warmUp } = await loadReady();
		const fetchImpl = vi.fn(async () => undefined);

		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => [],
			profilePseudonym: async () => null,
			perFetchTimeoutMs: 1000,
			totalBudgetMs: 5000,
		});

		expect(result.ready).toBe(true);
		expect(result.warmed).toEqual(["/"]);
	});

	it("ready-warmup::the-total-budget-bounds-the-whole-walk", async () => {
		// The plan's own risk line: "readiness is timeout-bounded". With a budget
		// smaller than the work, the walk must still finish — the remaining paths
		// are recorded as failed rather than waited for. A per-fetch timeout alone
		// does not give this property: twelve slow markets at 20 s each is four
		// minutes, well past the ECS grace period, and the task would be killed
		// mid-warm and restarted into the same warm forever.
		const { warmUp } = await loadReady();
		const fetchImpl = vi.fn(
			(_url: string, init: { signal: AbortSignal }) =>
				new Promise<void>((_resolve, reject) => {
					init.signal.addEventListener("abort", () =>
						reject(new Error("aborted")),
					);
				}),
		);

		const started = Date.now();
		const result = await warmUp({
			fetchImpl,
			baseUrl: BASE,
			listOpenSlugs: async () => ["a", "b", "c", "d", "e"],
			profilePseudonym: async () => "p",
			perFetchTimeoutMs: 40,
			totalBudgetMs: 60,
			log: vi.fn(),
		});

		expect(result.ready).toBe(true);
		expect(result.warmed).toEqual([]);
		expect(result.failed).toHaveLength(7);
		// Bounded by the BUDGET, not by 7 × the per-fetch timeout. Generous slack
		// so the row measures the bound rather than the machine.
		expect(Date.now() - started).toBeLessThan(1000);
	});
});

describe("ready-warmup — readiness() is memoised once per process", () => {
	it("ready-warmup::readiness-returns-the-same-promise-every-call", async () => {
		// ⛔ WHY IDENTITY AND NOT EQUALITY OF THE RESULT. The ALB probes every 15 s
		// and the container probe every 30 s, so a non-memoised gate would start a
		// fresh full warm on every probe: the cold task would spend its whole grace
		// period re-rendering the same pages in parallel with itself, which is the
		// load it exists to prevent. Same promise object = one warm.
		const { readiness } = await loadReady();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("ok", { status: 200 })),
		);

		const first = readiness();
		const second = readiness();

		expect(second).toBe(first);
		// And it resolves rather than rejecting — a readiness gate that throws is a
		// 500 on the health path, which the ALB reads as unhealthy forever.
		const result = await first;
		expect(result.ready).toBe(true);
		expect(await readiness()).toBe(result);
	});
});

describe("ready-route — GET /api/ready is 503 until the warm finishes", () => {
	it("ready-route::503-while-the-warm-is-pending", async () => {
		// Arrange — a warm that has not finished.
		const gate = deferred<{
			ready: true;
			warmed: string[];
			failed: string[];
			durationMs: number;
		}>();
		vi.doMock("@/server/health/ready", () => ({
			readiness: vi.fn(() => gate.promise),
		}));

		const { GET } = await import("@/app/api/ready/route");

		// Act — `promptly` is the assertion that it does not BLOCK; see its
		// docblock. A route that awaited the warm would hold an ALB connection for
		// the whole budget and be failed on the probe timeout instead.
		const response = await promptly(GET(), "GET /api/ready (pending warm)");

		// Assert
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({ ready: false });
	});

	it("ready-route::200-after-the-warm-resolves", async () => {
		const gate = deferred<{
			ready: true;
			warmed: string[];
			failed: string[];
			durationMs: number;
		}>();
		vi.doMock("@/server/health/ready", () => ({
			readiness: vi.fn(() => gate.promise),
		}));

		const { GET } = await import("@/app/api/ready/route");

		// Before: 503. The first call is also what starts the warm, so this
		// ordering is the real deployment sequence — the ALB's own probing warms
		// the task and nothing else has to remember to.
		expect((await promptly(GET(), "GET /api/ready (before)")).status).toBe(503);

		gate.release({
			ready: true,
			warmed: ["/", "/m/a"],
			failed: [],
			durationMs: 1234,
		});
		await tick();

		// After: 200, and the body reports what was warmed — so an operator reading
		// the probe can see whether a path failed rather than only that it passed.
		const response = await promptly(GET(), "GET /api/ready (after)");
		expect(response.status).toBe(200);
		// Counts, not paths: the inventory is a deploy oracle to an
		// unauthenticated caller (`@security-auditor` LOW), and the deploy gate
		// needs only `failed`.
		expect(await response.json()).toMatchObject({
			ready: true,
			warmed: 2,
			failed: 0,
		});
	});

	it("ready-route::stays-200-on-every-later-probe", async () => {
		// The probe runs every 15 s for the life of the task. Once warm, it must
		// stay warm: a gate that re-derived readiness per request could flap and
		// deregister a healthy target.
		const gate = deferred<{
			ready: true;
			warmed: string[];
			failed: string[];
			durationMs: number;
		}>();
		vi.doMock("@/server/health/ready", () => ({
			readiness: vi.fn(() => gate.promise),
		}));

		const { GET } = await import("@/app/api/ready/route");

		await promptly(GET(), "GET /api/ready (first)");
		gate.release({ ready: true, warmed: ["/"], failed: [], durationMs: 5 });
		await tick();

		for (let probe = 0; probe < 3; probe++) {
			const response = await promptly(GET(), `GET /api/ready (probe ${probe})`);
			expect(response.status).toBe(200);
		}
	});

	it("ready-route::reports-failed-paths-rather-than-hiding-them", async () => {
		// A warm that partly failed is still ready (see the warmUp rows), but the
		// probe body must SAY so — otherwise a market that never renders is
		// invisible, and the only symptom is a slow surface nobody can attribute.
		const gate = deferred<{
			ready: true;
			warmed: string[];
			failed: string[];
			durationMs: number;
		}>();
		vi.doMock("@/server/health/ready", () => ({
			readiness: vi.fn(() => gate.promise),
		}));

		const { GET } = await import("@/app/api/ready/route");
		await promptly(GET(), "GET /api/ready (first)");
		gate.release({
			ready: true,
			warmed: ["/"],
			failed: ["/m/broken"],
			durationMs: 42,
		});
		await tick();

		const body = (await (
			await promptly(GET(), "GET /api/ready (after)")
		).json()) as { ready?: unknown; failed?: unknown };
		expect(body.ready).toBe(true);
		expect(body.failed).toBe(1);
	});
});

describe("ready-warmfetch — the default fetch drains the body and fails on non-2xx", () => {
	// `fetch` resolves on HEADERS and for a 500 exactly as for a 200; a warm that
	// used it bare could report `warmed` for a page that never rendered
	// (`@code-reviewer` HIGH). Both properties are pinned here.
	it("ready-warmfetch::non-2xx-throws-so-the-path-is-counted-failed", async () => {
		// The route tests above mock this module; reach the real one for the fetch.
		const { warmFetch } = await vi.importActual<
			typeof import("@/server/health/ready")
		>("@/server/health/ready");
		const original = globalThis.fetch;
		globalThis.fetch = (async () =>
			new Response("boom", { status: 500 })) as typeof fetch;
		try {
			await expect(
				warmFetch("http://127.0.0.1:3000/m/broken", {
					signal: new AbortController().signal,
				}),
			).rejects.toThrow(/status 500/);
		} finally {
			globalThis.fetch = original;
		}
	});

	it("ready-warmfetch::2xx-resolves-only-after-the-body-is-drained", async () => {
		// The route tests above mock this module; reach the real one for the fetch.
		const { warmFetch } = await vi.importActual<
			typeof import("@/server/health/ready")
		>("@/server/health/ready");
		const original = globalThis.fetch;
		let drained = false;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				drained = true;
				controller.enqueue(new TextEncoder().encode("<html>"));
				controller.close();
			},
		});
		globalThis.fetch = (async () =>
			new Response(body, { status: 200 })) as typeof fetch;
		try {
			await warmFetch("http://127.0.0.1:3000/", {
				signal: new AbortController().signal,
			});
			expect(drained).toBe(true);
		} finally {
			globalThis.fetch = original;
		}
	});
});
