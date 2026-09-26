// Readiness item 12 — compose Secrets Manager `zugzwang/production` from Doppler `prd`,
// with the database values re-pointed at the PRODUCTION RDS. PRODUCTION ONLY.
//
//   doppler run --project zugzwang-experiment --config prd -- \
//     node scripts/aws-migration/prod-secret.cjs <rds-secret-arn> <rds-host> <rds-port> <db-name> [--execute]
//
// ⛔ DRY-RUN BY DEFAULT. Without `--execute` it prints key NAMES and the RDS host and
// writes nothing. It never prints a value.
//
// The production twin of `staging-secret.cjs`, with four deliberate differences:
//   1. It REFUSES TO WRITE when any required key is missing. Staging wrote anyway;
//      in production a missing key is a task that crash-loops on boot (e.g.
//      `instrumentation.ts` refuses `ZUGZWANG_ENV=prod` without NEXT_PUBLIC_SENTRY_DSN).
//   2. The secret never travels on the command line — it goes to the AWS CLI through
//      a mode-0600 temp file that is deleted in `finally` (argv is visible to every
//      process on the machine; the staging script passed it as an argument).
//   3. It refuses unless Doppler says project `zugzwang-experiment`, config `prd`, and
//      the AWS caller is in the expected account.
//   4. The AWS CLI is `$AWS_CLI` or `aws` on PATH, not a hard-coded Windows path.
// The required key list is pinned against infra/config/types.ts RUNTIME_SECRET_KEYS by
// tests/unit/scripts/prod-secret.test.ts, so the two cannot drift.

const REGION = "ap-south-1";
const SECRET_NAME = "zugzwang/production";
const EXPECTED_ACCOUNT = "849076101704";
const DOPPLER_PROJECT = "zugzwang-experiment";
const DOPPLER_CONFIG = "prd";

/** Runtime keys the ECS task injects — must equal RUNTIME_SECRET_KEYS (test-pinned). */
const RUNTIME_KEYS = [
	"DATABASE_URL",
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"BETTER_AUTH_TRUSTED_ORIGINS",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"TURNSTILE_SECRET_KEY",
	"NEXT_PUBLIC_TURNSTILE_SITE_KEY",
	"ADMIN_PASSWORD",
	"CRON_SECRET",
	"OPENAI_API_KEY",
	"RESEND_API_KEY",
	"RESEND_FROM_EMAIL",
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
	"NEXT_PUBLIC_SENTRY_DSN",
	"NEXT_PUBLIC_POSTHOG_KEY",
	"NEXT_PUBLIC_POSTHOG_HOST",
	"R2_ENDPOINT_UPLOADS",
	"R2_BUCKET_UPLOADS",
	"R2_ACCESS_KEY_ID_UPLOADS",
	"R2_SECRET_ACCESS_KEY_UPLOADS",
	"R2_ENDPOINT_PFP",
	"R2_BUCKET_PFP",
	"R2_ACCESS_KEY_ID_PFP",
	"R2_SECRET_ACCESS_KEY_PFP",
	"R2_PUBLIC_URL_PFP",
	"R2_ENDPOINT_MARKET_MEDIA",
	"R2_BUCKET_MARKET_MEDIA",
	"R2_ACCESS_KEY_ID_MARKET_MEDIA",
	"R2_SECRET_ACCESS_KEY_MARKET_MEDIA",
];

/** The migration task's suffix-separated keys (production.ts migrationSecretKeys) + the cron header. */
const DERIVED_KEYS = [
	"DATABASE_URL_PROD",
	"PROD_PROJECT_REF_FRAGMENT",
	"CRON_AUTH_HEADER",
];

/** Throws unless `host` is a production RDS endpoint in ap-south-1. */
function assertProductionRdsHost(host) {
	if (
		typeof host !== "string" ||
		!/^[a-z0-9.-]+\.ap-south-1\.rds\.amazonaws\.com$/.test(host) ||
		!/production/i.test(host) ||
		/staging|supabase/i.test(host)
	) {
		throw new Error(
			`refusing: RDS host "${host}" is not a production RDS endpoint (must be *.ap-south-1.rds.amazonaws.com, contain "production", and not "staging"/"supabase")`,
		);
	}
}

/** Throws unless Doppler injected the production config of this project. */
function assertDopplerProduction(env) {
	if (
		env.DOPPLER_PROJECT !== DOPPLER_PROJECT ||
		env.DOPPLER_CONFIG !== DOPPLER_CONFIG
	) {
		throw new Error(
			`refusing: run under "doppler run --project ${DOPPLER_PROJECT} --config ${DOPPLER_CONFIG}" (got project="${env.DOPPLER_PROJECT ?? ""}", config="${env.DOPPLER_CONFIG ?? ""}")`,
		);
	}
}

function assertPort(port) {
	if (!/^\d{2,5}$/.test(String(port))) {
		throw new Error(`refusing: port "${port}" is not a number`);
	}
}

function assertDbName(name) {
	if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(String(name))) {
		throw new Error(
			`refusing: database name "${name}" is not a plain identifier`,
		);
	}
}

/**
 * The secret payload. Pure: no I/O. Returns `{ payload, missing }` where `missing`
 * lists runtime keys absent or empty in `env`. The database URL uses
 * `sslmode=require` (RDS ships rds.force_ssl=1 — same as staging).
 */
function composeSecret(env, creds, host, port, dbName) {
	const enc = encodeURIComponent;
	const dbUrl = `postgresql://${enc(creds.username)}:${enc(creds.password)}@${host}:${port}/${dbName}?sslmode=require`;
	const payload = {};
	const missing = [];
	for (const key of RUNTIME_KEYS) {
		if (env[key] == null || env[key] === "") missing.push(key);
		else payload[key] = env[key];
	}
	// Doppler prd's DATABASE_URL still names Supabase; the task must reach RDS.
	payload.DATABASE_URL = dbUrl;
	payload.DATABASE_URL_PROD = dbUrl;
	// migrate-prod.ts refuses unless DATABASE_URL_PROD contains this fragment.
	payload.PROD_PROJECT_REF_FRAGMENT = host;
	if (env.CRON_SECRET) payload.CRON_AUTH_HEADER = `Bearer ${env.CRON_SECRET}`;
	// DATABASE_URL is overridden above, so it can never be "missing" in the result.
	return { payload, missing: missing.filter((k) => k !== "DATABASE_URL") };
}

function parseArgs(argv) {
	const execute = argv.includes("--execute");
	const [rdsSecretArn, host, port, dbName] = argv.filter(
		(a) => !a.startsWith("--"),
	);
	return { rdsSecretArn, host, port, dbName, execute };
}

function main() {
	const { spawnSync } = require("node:child_process");
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const AWS = process.env.AWS_CLI || "aws";
	const aws = (args) => {
		const r = spawnSync(AWS, ["--region", REGION, ...args], {
			encoding: "utf8",
		});
		if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 300));
		return r.stdout;
	};

	const { rdsSecretArn, host, port, dbName, execute } = parseArgs(
		process.argv.slice(2),
	);
	if (!rdsSecretArn || !host || !port || !dbName) {
		console.error(
			"usage: <rds-secret-arn> <rds-host> <rds-port> <db-name> [--execute]",
		);
		process.exit(2);
	}
	assertDopplerProduction(process.env);
	assertProductionRdsHost(host);
	assertPort(port);
	assertDbName(dbName);
	const account = aws([
		"sts",
		"get-caller-identity",
		"--query",
		"Account",
		"--output",
		"text",
	]).trim();
	if (account !== EXPECTED_ACCOUNT) {
		throw new Error(
			`refusing: AWS account ${account} is not ${EXPECTED_ACCOUNT}`,
		);
	}

	const creds = JSON.parse(
		JSON.parse(
			aws([
				"secretsmanager",
				"get-secret-value",
				"--secret-id",
				rdsSecretArn,
				"--query",
				"SecretString",
				"--output",
				"json",
			]),
		),
	);
	const { payload, missing } = composeSecret(
		process.env,
		creds,
		host,
		port,
		dbName,
	);
	const names = Object.keys(payload).sort();
	console.log(`secret: ${SECRET_NAME} (${REGION}) · account ${account}`);
	console.log(`RDS: ${host}:${port}/${dbName} · db user: ${creds.username}`);
	console.log(`keys (${names.length}): ${names.join(" ")}`);
	if (missing.length) {
		console.log(
			`REFUSING TO WRITE — missing in Doppler prd: ${missing.join(" ")}`,
		);
		process.exit(1);
	}
	if (!execute) {
		console.log("dry-run (default): nothing written. Re-run with --execute.");
		return;
	}

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zz-prod-secret-"));
	const file = path.join(dir, "secret.json");
	try {
		fs.writeFileSync(file, JSON.stringify(payload), { mode: 0o600 });
		const ref = `file://${file.replace(/\\/g, "/")}`;
		const put = spawnSync(
			AWS,
			[
				"--region",
				REGION,
				"secretsmanager",
				"put-secret-value",
				"--secret-id",
				SECRET_NAME,
				"--secret-string",
				ref,
			],
			{ encoding: "utf8" },
		);
		if (put.status === 0) {
			console.log(`updated ${SECRET_NAME}`);
		} else if (/ResourceNotFoundException/.test(put.stderr)) {
			aws([
				"secretsmanager",
				"create-secret",
				"--name",
				SECRET_NAME,
				"--description",
				"Zugzwang production runtime secrets (source: Doppler prd; DB -> production RDS)",
				"--secret-string",
				ref,
				"--tags",
				"Key=Project,Value=Zugzwang",
				"Key=Environment,Value=production",
				"Key=ManagedBy,Value=operator",
			]);
			console.log(`created ${SECRET_NAME}`);
		} else {
			throw new Error(put.stderr.trim().slice(0, 300));
		}
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

module.exports = {
	REGION,
	SECRET_NAME,
	EXPECTED_ACCOUNT,
	RUNTIME_KEYS,
	DERIVED_KEYS,
	assertProductionRdsHost,
	assertDopplerProduction,
	assertPort,
	assertDbName,
	composeSecret,
	parseArgs,
};

if (require.main === module) {
	try {
		main();
	} catch (error) {
		console.error(String(error && error.message ? error.message : error));
		process.exit(1);
	}
}
