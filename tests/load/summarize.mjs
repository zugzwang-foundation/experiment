// Turn a k6 --summary-export file into the one line the results table needs.
//
//   node tests/load/summarize.mjs tests/load/results/<RUN_ID>/summary.json

import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
	console.error("usage: node summarize.mjs <summary.json>");
	process.exit(2);
}

const m = JSON.parse(readFileSync(file, "utf8")).metrics ?? {};
const count = (name) => m[name]?.count ?? 0;
const ms = (name, stat) => {
	const v = m[name]?.[stat];
	return v === undefined ? "n/a" : `${Math.round(v)} ms`;
};

const total = count("http_reqs");
const checkPasses = m.checks?.passes ?? 0;
const checkFails = m.checks?.fails ?? 0;
const checks = checkPasses + checkFails;
const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(2)}%` : "n/a");

console.log(
	[
		`requests=${total}`,
		`success=${pct(checkPasses, checks)}`,
		`p50=${ms("http_req_duration", "med")}`,
		`p95=${ms("http_req_duration", "p(95)")}`,
		`p99=${ms("http_req_duration", "p(99)")}`,
		`rate_limited_429=${count("limiter_throttled_total")}`,
		`no_response=${count("connection_failures_total")}`,
		`dropped_iterations=${count("dropped_iterations")}`,
	].join("  "),
);
