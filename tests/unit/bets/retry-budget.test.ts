import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ADR-0056 — the W-1 retry budget, and the deliberate divergence from its two
// siblings.
//
// ⛔ WHY A SOURCE SCAN AND NOT A BEHAVIOURAL TEST. The behaviour is already
// pinned: `tests/server/bets/concurrency.test.ts` drives a callback that always
// throws 40001 and asserts the attempt count. What that test CANNOT see is the
// relationship between the three wrappers — and the relationship is the thing
// ADR-0056 changed. Before it, `bets`, `resolution` and `markets` carried a
// byte-identical `[50, 100, 200]`, described in SPEC.2 §9 as one shared shape.
// Now W-1 is wider than the other two, ON PURPOSE, and nothing else in the repo
// records that a reader who "restores consistency" would be undoing a ruling.
//
// The divergence rests on ADR-0038 decision 2 — sizing from measurement, never
// estimate. W-1 was measured under a real collision storm; W-3 and W-4 were not,
// and are admin-triggered single-writer paths that no crowd contends for.
// Widening them to match would be exactly the unmeasured retune this project
// withdrew once already (the `max: 4` recommendation, same session).

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

const BASES = /const BACKOFF_BASES_MS = \[([^\]]*)\] as const;/;

function bases(rel: string): number[] {
	const m = BASES.exec(read(rel));
	expect(m, `no BACKOFF_BASES_MS in ${rel}`).not.toBeNull();
	return (m?.[1] ?? "")
		.split(",")
		.map((x) => Number(x.trim()))
		.filter((x) => Number.isFinite(x));
}

const W1 = "src/server/bets/transaction.ts";
const W3 = "src/server/resolution/transaction.ts";
const W4 = "src/server/markets/transaction.ts";

describe("ADR-0056 — the W-1 retry budget", () => {
	it("W-1 carries the widened, measured budget", () => {
		// 1 initial attempt + 5 retries = 6. The figures come from
		// `tests/scale/_measure-write-ceiling.scale.test.ts`: at 48 and 64
		// concurrent writers on ONE pool row, 4 attempts refused ~10% and 6
		// refused none.
		expect(bases(W1)).toEqual([50, 100, 200, 400, 800]);
	});

	it("W-3 and W-4 are deliberately NOT widened with it", () => {
		// ⛔ IF YOU CAME HERE TO MAKE THESE THREE AGREE AGAIN, READ THE DOCBLOCK
		// ABOVE FIRST. The divergence is the ruling. W-3 (resolution) and W-4
		// (market lifecycle) are admin-triggered and single-writer; neither was
		// measured, and ADR-0038 decision 2 forbids sizing an unmeasured budget.
		expect(bases(W3)).toEqual([50, 100, 200]);
		expect(bases(W4)).toEqual([50, 100, 200]);
	});

	it("the widening is monotone — every base longer than the one before it", () => {
		// Full jitter draws uniformly from [0, base), so a non-increasing base
		// would make a later retry sleep no longer than an earlier one and quietly
		// waste an attempt on a queue that has not moved. Pins the SHAPE rather
		// than the literals, so a future retune stays well-formed.
		const b = bases(W1);
		for (let i = 1; i < b.length; i++) {
			expect(b[i] ?? 0).toBeGreaterThan(b[i - 1] ?? 0);
		}
	});

	it("W-1 is at least as patient as the wrappers it diverged from", () => {
		// The direction is load-bearing: W-1 is the contended path, so it may be
		// MORE patient than its siblings and must never be less. A retune that
		// shortened it below them would reintroduce the refusals ADR-0056 removed
		// while looking like a tidy-up.
		const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
		expect(bases(W1).length).toBeGreaterThanOrEqual(bases(W3).length);
		expect(sum(bases(W1))).toBeGreaterThanOrEqual(sum(bases(W3)));
	});
});
