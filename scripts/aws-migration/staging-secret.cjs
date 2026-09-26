// Populate Secrets Manager `zugzwang/staging` from Doppler `stg`, with the database
// values re-pointed at the new STAGING RDS. STAGING ONLY — refuses any other name.
// Run under: doppler run --config stg -- node staging-secret.cjs <rds-secret-arn> <rds-host> <rds-port> <db-name>
// Prints key NAMES and the RDS host only. Never prints a value.
const { spawnSync } = require("node:child_process");
const AWS = "C:/Program Files/Amazon/AWSCLIV2/aws.exe";
const REGION = "ap-south-1";
const SECRET_NAME = "zugzwang/staging";
if (SECRET_NAME !== "zugzwang/staging") throw new Error("staging only");
const [rdsSecretArn, rdsHost, rdsPort, dbName] = process.argv.slice(2);
if (!rdsSecretArn || !rdsHost || !rdsPort || !dbName) {
	console.error("usage: <rds-secret-arn> <rds-host> <rds-port> <db-name>");
	process.exit(2);
}
if (
	!/\.ap-south-1\.rds\.amazonaws\.com$/.test(rdsHost) ||
	!/staging/i.test(rdsHost) ||
	/supabase|prod/i.test(rdsHost)
) {
	console.error(
		`refusing: RDS host "${rdsHost}" is not a staging RDS endpoint`,
	);
	process.exit(2);
}
const aws = (args, input) => {
	const r = spawnSync(AWS, ["--region", REGION, ...args], {
		encoding: "utf8",
		input,
	});
	if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 300));
	return r.stdout;
};

// 1. RDS master credentials from the CDK-generated secret
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
const enc = encodeURIComponent;
// sslmode=require: RDS PostgreSQL ships rds.force_ssl=1, so a plaintext connection is
// refused at the server ("no pg_hba.conf entry ... SSL off"). `require` encrypts without
// CA verification; verify-full needs the RDS CA bundle in the image (follow-up).
const dbUrl = `postgresql://${enc(creds.username)}:${enc(creds.password)}@${rdsHost}:${rdsPort}/${dbName}?sslmode=require`;

// 2. Runtime keys from Doppler stg (already in process.env), overriding the database trio
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
const MIGRATION_KEYS = ["DATABASE_URL_STAGING", "STAGING_PROJECT_REF_FRAGMENT"];
const payload = {};
const missing = [];
for (const k of RUNTIME_KEYS) {
	if (process.env[k] == null || process.env[k] === "") missing.push(k);
	else payload[k] = process.env[k];
}
payload.DATABASE_URL = dbUrl; // the app → staging RDS
payload.DATABASE_URL_STAGING = dbUrl; // the migration task → staging RDS
payload.STAGING_PROJECT_REF_FRAGMENT = rdsHost; // the migrate-staging.ts guard → must be contained in the URL
payload.CRON_AUTH_HEADER = `Bearer ${process.env.CRON_SECRET ?? ""}`;
const present = Object.keys(payload).sort();

console.log(`secret: ${SECRET_NAME} (${REGION})`);
console.log(
	`RDS host: ${rdsHost}:${rdsPort}/${dbName} · db user: ${creds.username}`,
);
console.log(`keys to write (${present.length}): ${present.join(" ")}`);
if (missing.length)
	console.log(
		`MISSING in Doppler stg (task will fail to start until present): ${missing.join(" ")}`,
	);
if (process.argv.includes("--dry-run")) {
	console.log("dry-run: nothing written");
	process.exit(missing.length ? 1 : 0);
}

// 3. Create or update — never printed
const json = JSON.stringify(payload);
// Update first; create only if the secret genuinely does not exist. (The earlier
// describe-based check misreported "absent" and the create then failed on
// ResourceExistsException — update-first cannot misfire that way.)
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
		json,
	],
	{ encoding: "utf8" },
);
if (put.status === 0) console.log(`updated ${SECRET_NAME}`);
else if (/ResourceNotFoundException/.test(put.stderr)) {
	aws([
		"secretsmanager",
		"create-secret",
		"--name",
		SECRET_NAME,
		"--description",
		"Zugzwang staging runtime secrets (source: Doppler stg; DB -> staging RDS)",
		"--secret-string",
		json,
		"--tags",
		"Key=Project,Value=Zugzwang",
		"Key=Environment,Value=staging",
		"Key=ManagedBy,Value=operator",
	]);
	console.log(`created ${SECRET_NAME}`);
} else throw new Error(put.stderr.trim().slice(0, 300));
process.exit(missing.length ? 1 : 0);
