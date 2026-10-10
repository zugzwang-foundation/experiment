// LAUNCH-DB-COPY-1 — shared, pure helpers for the one-time launch copy tools
// (docs/plans/LAUNCH-DB-COPY-1.md §4). No I/O happens at require time.
//
// The target guard is the reason this file exists. Staging's and production's
// RDS hostnames differ by ONE word in the middle of a ~90-character string,
// both databases are called `zugzwang`, and both have the same master user. A
// tool told "prod" must never reach staging, and — the direction that destroys
// data — a tool told "staging" must never reach production. So each
// environment is identified by a word it must contain AND a word it must not,
// on an anchored RDS hostname, with the exact database path.

const REGION = "ap-south-1";
const DB_NAME = "zugzwang";

const ENVS = {
	prod: {
		secret: "zugzwang/production",
		word: "production",
		notWord: "staging",
	},
	staging: {
		secret: "zugzwang/staging",
		word: "staging",
		notWord: "production",
	},
};

const RDS_HOST_RE = /^[a-z0-9-]+\.[a-z0-9]+\.ap-south-1\.rds\.amazonaws\.com$/;

/** Throws `refusing: …` unless `databaseUrl` is `env`'s RDS database. Returns the URL. */
function assertEnvTarget(env, databaseUrl) {
	if (!Object.hasOwn(ENVS, env)) {
		throw new Error(
			`refusing: unknown environment ${JSON.stringify(env)} (expected "prod" or "staging")`,
		);
	}
	const u = new URL(databaseUrl);
	const { word, notWord } = ENVS[env];
	const host = u.hostname;
	if (
		!RDS_HOST_RE.test(host) ||
		!host.includes(word) ||
		host.includes(notWord) ||
		u.pathname !== `/${DB_NAME}`
	) {
		throw new Error(
			`refusing: ${host}${u.pathname} is not the ${env} RDS database "${DB_NAME}"`,
		);
	}
	return u;
}

/** `zugzwang-<env>-YYYY-MM-DDTHH-MM-SSZ.dump`, UTC, no milliseconds, no colons. */
function dumpFileName(env, date) {
	const stamp = `${date.toISOString().slice(0, 19).replace(/:/g, "-")}Z`;
	return `zugzwang-${env}-${stamp}.dump`;
}

const DUMP_NAME_RE =
	/^zugzwang-(prod|staging)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)\.dump$/;

/** `{ env, stamp }` for a launch dump's BASE name, or null. */
function parseDumpFileName(base) {
	const m = DUMP_NAME_RE.exec(String(base));
	return m ? { env: m[1], stamp: m[2] } : null;
}

/** Removes every postgres:// or postgresql:// URL — identical to prod-restore's. */
function redact(text) {
	return String(text).replace(/postgres(ql)?:\/\/[^\s]+/g, "<url>");
}

/**
 * The launch window, shared by every tool that WRITES during the launch (the
 * restore's --source=staging mode keeps its own copy of the same two values,
 * pinned equal by tests/unit/scripts/launch-common.test.ts). A launch write
 * tool that is still on disk after launch must not be one keystroke from a
 * live production delete (@security-auditor M-3).
 */
const LAUNCH_COPY_EXPIRES_AT = "2026-10-25T23:59:59Z";
const LAUNCH_COPY_ACK = "replace-production-with-staging";

function assertLaunchWindow({ now = new Date(), env = process.env } = {}) {
	if (env.ZZ_LAUNCH_COPY_ACK !== LAUNCH_COPY_ACK) {
		throw new Error(
			`refusing: this is a one-time launch tool — set ZZ_LAUNCH_COPY_ACK=${LAUNCH_COPY_ACK} to confirm`,
		);
	}
	if (now.getTime() > Date.parse(LAUNCH_COPY_EXPIRES_AT)) {
		throw new Error(
			`refusing: the one-time launch window closed at ${LAUNCH_COPY_EXPIRES_AT}`,
		);
	}
}

/**
 * JSON.parse for a Secrets Manager value. A SyntaxError's message quotes part
 * of its input, and the input is a secret — so the error is replaced by a fixed
 * one (@security-auditor L-3).
 */
function parseSecret(text) {
	try {
		return JSON.parse(text);
	} catch {
		throw new Error("refusing: the secret value is not valid JSON");
	}
}

module.exports = {
	LAUNCH_COPY_EXPIRES_AT,
	LAUNCH_COPY_ACK,
	assertLaunchWindow,
	parseSecret,
	REGION,
	DB_NAME,
	ENVS,
	assertEnvTarget,
	dumpFileName,
	parseDumpFileName,
	redact,
};
