// The two arrival-rate shapes the staging campaign used, so production runs
// are directly comparable to the staging numbers in `tests/load/README.md`.

import { assertRateAllowed } from "./target.js";

function requiredRate(name, fallback) {
	const raw = __ENV[name] ?? fallback;
	if (raw === undefined) {
		throw new Error(`REFUSED — ${name} is not set`);
	}
	const rate = Number(raw);
	if (!Number.isFinite(rate) || rate <= 0) {
		throw new Error(`REFUSED — ${name}=${raw} is not a positive number`);
	}
	assertRateAllowed(rate);
	return rate;
}

/**
 * Escalating page series (sign-in, homepage, profile): 25% → 50% → 100% of
 * PEAK_RATE, hold, then cool down. 75 s per batch.
 */
export function escalatingScenario(exec, fallbackPeak) {
	const peak = requiredRate("PEAK_RATE", fallbackPeak);
	const maxVUs = Number(__ENV.MAX_VUS || String(peak * 10));
	return {
		peak,
		scenario: {
			executor: "ramping-arrival-rate",
			exec,
			startRate: 0,
			timeUnit: "1s",
			preAllocatedVUs: Math.min(peak, maxVUs),
			maxVUs,
			stages: [
				{ target: Math.round(peak * 0.25), duration: "15s" },
				{ target: Math.round(peak * 0.5), duration: "15s" },
				{ target: peak, duration: "20s" },
				{ target: peak, duration: "15s" },
				{ target: 0, duration: "10s" },
			],
		},
	};
}

/**
 * Stepped ladder (market page, image post): 25% → 50% → 100% of PEAK_RATE in
 * 20 s steps. Staging ran it at PEAK_RATE=100, i.e. 25 → 50 → 100 req/s.
 */
export function ladderScenario(exec, fallbackPeak) {
	const peak = requiredRate("PEAK_RATE", fallbackPeak);
	return {
		peak,
		scenario: {
			executor: "ramping-arrival-rate",
			exec,
			startRate: Math.max(1, Math.round(peak * 0.25)),
			timeUnit: "1s",
			preAllocatedVUs: peak,
			maxVUs: peak * 5,
			stages: [
				{ target: Math.round(peak * 0.25), duration: "20s" },
				{ target: Math.round(peak * 0.5), duration: "20s" },
				{ target: peak, duration: "20s" },
				{ target: 0, duration: "10s" },
			],
		},
	};
}

export const SUMMARY_TREND_STATS = [
	"avg",
	"min",
	"med",
	"max",
	"p(50)",
	"p(90)",
	"p(95)",
	"p(99)",
];
