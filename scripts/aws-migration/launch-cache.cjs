// LAUNCH-DB-COPY-1 — clear production's cached read models after the data
// swap, while writes are still paused (runbook step 9).
//
//   node scripts/aws-migration/launch-cache.cjs --account=<12-digit id> [--execute]
//
// ⛔ CHECK-ONLY BY DEFAULT: it counts what it would clear and writes nothing.
//
// ⛔ STAGING AND PRODUCTION SHARE ONE UPSTASH INSTANCE AND ONE TOKEN. The only
// thing separating them is the leftmost segment of every key (`prod:` vs the
// other environments' prefixes, built by src/server/upstash/keys.ts). So the
// connection cannot tell this tool which environment it holds, and
// `isClearableKey` is the ONLY boundary between clearing production's caches
// and reaching into another environment, a rate-limit window or a cron lock.
// That is why it is an allowlist of three exact prefixes, why enumeration uses
// SCAN (never a whole-keyspace listing, which would block the shared instance),
// and why there is no database-wide flush anywhere in this file.
//
// Cleared: prod:cache:* (shared views, header portfolio), prod:cache-metric:*,
// and prod:idem:* — idempotency entries whose durable receipts the restore has
// just replaced, so leaving them would describe receipts that no longer exist.

const {
	REGION,
	redact,
	parseSecret,
	assertLaunchWindow,
} = require("./lib/launch-common.cjs");

const SECRET = "zugzwang/production";

const CLEAR_PATTERNS = ["prod:cache:*", "prod:cache-metric:*", "prod:idem:*"];
const CLEAR_PREFIXES = CLEAR_PATTERNS.map((p) => p.slice(0, -1));

/** True only for a key in one of the three production cache families. */
function isClearableKey(key) {
	return (
		typeof key === "string" &&
		CLEAR_PREFIXES.some((prefix) => key.startsWith(prefix))
	);
}

/** The Upstash URL and token from the production secret; https only. */
function assertProductionRedisConfig(secretJson) {
	const url = secretJson?.UPSTASH_REDIS_REST_URL;
	const token = secretJson?.UPSTASH_REDIS_REST_TOKEN;
	if (typeof url !== "string" || url === "") {
		throw new Error(
			"refusing: the production secret has no UPSTASH_REDIS_REST_URL",
		);
	}
	if (typeof token !== "string" || token === "") {
		throw new Error(
			"refusing: the production secret has no UPSTASH_REDIS_REST_TOKEN",
		);
	}
	if (new URL(url).protocol !== "https:") {
		throw new Error("refusing: the Upstash URL is not https");
	}
	return { url, token };
}

async function main() {
	const { spawnSync } = require("node:child_process");
	const { Redis } = require("@upstash/redis");
	const AWS = process.env.AWS_CLI || "aws";

	const argv = process.argv.slice(2);
	const execute = argv.includes("--execute");
	const account = (argv.find((a) => a.startsWith("--account=")) ?? "").slice(
		"--account=".length,
	);
	if (!/^[0-9]{12}$/.test(account)) {
		throw new Error(
			"refusing: --account=<12-digit AWS account id> is required",
		);
	}
	// A delete on production: only inside the launch window, acknowledged.
	if (execute) assertLaunchWindow();
	const aws = (a) => {
		const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 300)));
		return r.stdout;
	};
	const caller = aws([
		"sts",
		"get-caller-identity",
		"--query",
		"Account",
		"--output",
		"text",
	]).trim();
	if (caller !== account) {
		throw new Error(
			`refusing: AWS credentials are for account ${caller}, not ${account}`,
		);
	}
	const cfg = assertProductionRedisConfig(
		parseSecret(
			aws([
				"secretsmanager",
				"get-secret-value",
				"--secret-id",
				SECRET,
				"--query",
				"SecretString",
				"--output",
				"text",
			]),
		),
	);
	const redis = new Redis({
		url: cfg.url,
		token: cfg.token,
		automaticDeserialization: false,
	});

	let total = 0;
	for (const pattern of CLEAR_PATTERNS) {
		let cursor = "0";
		let found = 0;
		let cleared = 0;
		do {
			const [next, batch] = await redis.scan(cursor, {
				match: pattern,
				count: 500,
			});
			cursor = String(next);
			// The server-side match is a convenience; this guard is the boundary.
			const targets = batch.filter((k) => isClearableKey(k));
			found += targets.length;
			if (!execute) continue;
			if (targets.length > 0) cleared += await redis.del(...targets);
		} while (cursor !== "0");
		total += found;
		console.log(
			`${pattern.padEnd(22)} found ${found}${execute ? ` · cleared ${cleared}` : ""}`,
		);
	}
	console.log(
		execute
			? `DONE — cleared production cache families (${total} keys found).`
			: `CHECK ONLY — ${total} keys would be cleared. Re-run with --execute while writes are paused.`,
	);
}

module.exports = {
	SECRET,
	CLEAR_PATTERNS,
	isClearableKey,
	assertProductionRedisConfig,
};

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
