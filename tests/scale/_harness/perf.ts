// ENGINE.10 perf capture — RECORDED-ONLY, NEVER a CI gate (plan §7 "Perf —
// RECORDED, NOT GATED"). `collide` feeds each storm's per-task wall-times here;
// `recordStorm` prints a p50/p95/max one-liner AND appends a JSON line to a
// run-dir artifact. Local numbers do NOT predict staging/Vercel — they are a
// regression tripwire only; the hard `p95 < 500ms @ 5k VUs` gate is the next-P0
// k6/staging stratum. No assertion reads these.

import { appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** The recorded-only artifact path (under the OS run dir — never committed). */
export const SCALE_PERF_FILE = join(tmpdir(), "engine10-scale-perf.jsonl");

export interface StormPerf {
	label: string;
	n: number;
	p50_ms: number;
	p95_ms: number;
	max_ms: number;
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

/** Nearest-rank percentile over an ascending-sorted sample. */
function percentile(sortedAsc: readonly number[], p: number): number {
	if (sortedAsc.length === 0) return 0;
	const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
	const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank));
	return sortedAsc[idx] ?? 0;
}

/**
 * Record one storm's per-task latencies: print a summary line and append a JSON
 * artifact row. Best-effort — a failed append never affects the storm result
 * (perf is recorded, not gated).
 */
export function recordStorm(
	label: string,
	durationsMs: readonly number[],
): StormPerf {
	const sorted = [...durationsMs].sort((a, b) => a - b);
	const summary: StormPerf = {
		label,
		n: sorted.length,
		p50_ms: round2(percentile(sorted, 50)),
		p95_ms: round2(percentile(sorted, 95)),
		max_ms: round2(sorted[sorted.length - 1] ?? 0),
	};
	// Printed regression signal (plan §7 — manual founder escalation on an
	// egregious number, never an auto-fail).
	console.log(
		`[scale-perf] ${summary.label}: n=${summary.n} p50=${summary.p50_ms}ms p95=${summary.p95_ms}ms max=${summary.max_ms}ms`,
	);
	try {
		appendFileSync(SCALE_PERF_FILE, `${JSON.stringify(summary)}\n`);
	} catch {
		// Artifact write is best-effort; the storm result stands regardless.
	}
	return summary;
}
