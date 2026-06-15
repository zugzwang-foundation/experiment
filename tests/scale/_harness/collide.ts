// ENGINE.10 collision driver (BUILD — wired). The barrier-synchronized,
// bounded-pool concurrent driver: every task factory is pre-built and parked on
// ONE start barrier, then released together so the workers hit the same hot pool
// row in the tightest possible window → maximizes SERIALIZABLE 40001 frequency →
// exercises the full-jitter retry ladder of `runBetTransaction` /
// `runResolutionTransaction` (ADR-0013). The schedule is nondeterministic; the
// END STATE the scale tests assert on is deterministic — that is what makes the
// battery CI-able (plan §7 methodology: assert end-state, NEVER retry
// counts/interleaving).
//
// Returns a `PromiseSettledResult` per task (index-aligned with `taskFactories`)
// so the caller partitions the storm into committed-vs-rejected outcomes WITHOUT
// throwing on the (expected) terminal errors a contention storm produces
// (MarketNotOpenError, BetSerializationExhaustedError, InsufficientDharmaError,
// the idempotency unique-violation, …). Per-task wall-times feed the
// recorded-only perf artifact (`recordStorm`) — never a gate.

import { performance } from "node:perf_hooks";

import { recordStorm } from "./perf";

/** CI-safe ceiling on in-flight workers; the storm pile-up is engineered, not
 *  unbounded. The `@/db` pool (max:10) is the deeper bound on real DB
 *  concurrency — `degree` keeps promise creation bounded above it. */
const MAX_DEGREE = 64;

/**
 * Release every `taskFactory` on a single start barrier and await all of them to
 * settle. `opts.degree` bounds the worker pool (default = task count, capped to
 * {@link MAX_DEGREE}); `opts.label` tags the perf line. Every worker parks on the
 * SAME barrier before any runs, so `release()` is a single fan-out — the tightest
 * collision window (plan §7). A worker pulls the next index off a shared cursor
 * until the queue drains; a task that throws is captured as `rejected`, never
 * propagated, so one rejected writer never aborts the storm.
 */
export async function collide<T>(
	taskFactories: ReadonlyArray<() => Promise<T>>,
	opts?: { degree?: number; label?: string },
): Promise<PromiseSettledResult<T>[]> {
	const n = taskFactories.length;
	const results: PromiseSettledResult<T>[] = new Array(n);
	const durationsMs: number[] = new Array(n);
	if (n === 0) return results;

	const degree = Math.max(1, Math.min(opts?.degree ?? n, n, MAX_DEGREE));

	// ONE start barrier: all workers `await gate` before any task runs.
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});

	// Shared cursor — `idx = cursor++` is atomic (synchronous, single-threaded
	// JS); there is no await between the read and the increment.
	let cursor = 0;
	async function worker(): Promise<void> {
		await gate;
		for (;;) {
			const idx = cursor++;
			if (idx >= n) return;
			const factory = taskFactories[idx];
			if (factory === undefined) {
				// Only reachable on a sparse input array (no caller passes one) —
				// keep index-alignment total rather than leaving a hole.
				results[idx] = {
					status: "rejected",
					reason: new Error(`collide: undefined task factory at index ${idx}`),
				};
				durationsMs[idx] = 0;
				continue;
			}
			const started = performance.now();
			try {
				results[idx] = { status: "fulfilled", value: await factory() };
			} catch (reason) {
				results[idx] = { status: "rejected", reason };
			} finally {
				durationsMs[idx] = performance.now() - started;
			}
		}
	}

	// Construct (and park) every worker BEFORE releasing the gate, so the release
	// is a single synchronized fan-out — the engineered collision window.
	const workers = Array.from({ length: degree }, () => worker());
	release();
	await Promise.all(workers);

	recordStorm(opts?.label ?? "storm", durationsMs);
	return results;
}
