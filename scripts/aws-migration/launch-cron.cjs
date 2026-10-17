// LAUNCH-DB-COPY-1 — pause and resume an environment's pg_cron jobs around the
// launch copy.
//
//   node scripts/aws-migration/launch-cron.cjs pause  <prod|staging> <ecs-instance-id> <state.json> --account=<12-digit id> [--execute]
//   node scripts/aws-migration/launch-cron.cjs resume <prod|staging> <ecs-instance-id> <state.json> --account=<12-digit id> [--execute]
//
// WHY BOTH ENVIRONMENTS. pg_cron runs inside the database, so pausing the
// app's writes does not stop it. On STAGING the liquidity injector writes
// `pools` and `events` every minute — left running, it moves the source in the
// middle of the dump and launch-dump.cjs refuses the archive (runbook step 1).
// On PRODUCTION the restore leaves every job paused, because the copied
// liquidity_policy is staging's and its injector is enabled: armed before the
// code promote and the verification it would rewrite production's pools within
// a minute. Production's jobs are resumed only after writes are open (step 15),
// from the `<dump>.cron-jobs.json` prod-restore.cjs wrote.
//
// ⛔ CHECK-ONLY BY DEFAULT: it lists the jobs and what it would change. With
// --execute, `pause` records the ids that are active into <state.json> (and
// refuses if that file already exists — it is the only record of what to
// resume) and deactivates them; `resume` re-activates EXACTLY the ids in
// <state.json>, not every job. Nothing else is changed.

const {
	ENVS,
	REGION,
	DB_NAME,
	assertEnvTarget,
	redact,
	parseSecret,
	assertLaunchWindow,
} = require("./lib/launch-common.cjs");
const { parseJobIds, rearmSql } = require("./prod-restore.cjs");

/**
 * The saved job ids; refuses a file that is missing, malformed, or recorded
 * for a different environment — one environment's job ids applied to the
 * other's cron.job would switch the wrong jobs (@security-auditor L-6).
 */
function readSavedJobIds(json, env) {
	if (json?.env !== env) {
		throw new Error(
			`refusing: the state file records env=${JSON.stringify(json?.env)}, not ${JSON.stringify(env)}`,
		);
	}
	const ids = json?.activeBefore;
	if (!Array.isArray(ids) || ids.some((x) => !Number.isInteger(x) || x < 0)) {
		throw new Error("refusing: the state file has no valid activeBefore list");
	}
	return ids;
}

/** Deactivates exactly these jobs; "" when there are none. */
function pauseSql(ids) {
	const sql = rearmSql(ids);
	return sql === ""
		? ""
		: sql.replace("set active = true", "set active = false");
}

function parseArgs(argv) {
	const [mode, env, instanceId, stateFile] = argv.filter(
		(a) => !a.startsWith("--"),
	);
	const account = (argv.find((a) => a.startsWith("--account=")) ?? "").slice(
		"--account=".length,
	);
	return {
		mode,
		env,
		instanceId,
		stateFile,
		account,
		execute: argv.includes("--execute"),
	};
}

function assertArgs(a) {
	if (a.mode !== "pause" && a.mode !== "resume") {
		throw new Error(
			`refusing: mode must be "pause" or "resume" (got ${JSON.stringify(a.mode)})`,
		);
	}
	if (!Object.hasOwn(ENVS, String(a.env))) {
		throw new Error(
			`refusing: environment must be "prod" or "staging" (got ${JSON.stringify(a.env)})`,
		);
	}
	if (!/^i-[0-9a-f]{8,}$/.test(String(a.instanceId))) {
		throw new Error(`refusing: "${a.instanceId}" is not an EC2 instance id`);
	}
	if (!/\.json$/.test(String(a.stateFile))) {
		throw new Error("refusing: a <state.json> path is required");
	}
	if (!/^[0-9]{12}$/.test(String(a.account))) {
		throw new Error(
			"refusing: --account=<12-digit AWS account id> is required",
		);
	}
	return a;
}

async function main() {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const { spawn, spawnSync } = require("node:child_process");
	const AWS = process.env.AWS_CLI || "aws";

	const args = assertArgs(parseArgs(process.argv.slice(2)));
	// Pausing stops production's injector and the alarm that watches it, so it
	// runs only inside the launch window, acknowledged. Resuming is the safe
	// direction and stays available.
	if (args.execute && args.mode === "pause") assertLaunchWindow();
	const stateFile = path.resolve(args.stateFile);
	let ids = null;
	if (args.mode === "resume") {
		ids = readSavedJobIds(
			JSON.parse(fs.readFileSync(stateFile, "utf8")),
			args.env,
		);
	} else if (fs.existsSync(stateFile)) {
		throw new Error(
			`refusing: ${stateFile} already exists — it records what to resume; resume first or choose another path`,
		);
	}

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
	if (caller !== args.account) {
		throw new Error(
			`refusing: AWS credentials are for account ${caller}, not ${args.account}`,
		);
	}
	const sec = parseSecret(
		aws([
			"secretsmanager",
			"get-secret-value",
			"--secret-id",
			ENVS[args.env].secret,
			"--query",
			"SecretString",
			"--output",
			"text",
		]),
	);
	const u = assertEnvTarget(args.env, sec.DATABASE_URL);

	const port = args.env === "prod" ? 15438 : 15439;
	const tunnel = spawn(
		AWS,
		[
			"--region",
			REGION,
			"ssm",
			"start-session",
			"--target",
			args.instanceId,
			"--document-name",
			"AWS-StartPortForwardingSessionToRemoteHost",
			"--parameters",
			JSON.stringify({
				host: [u.hostname],
				portNumber: ["5432"],
				localPortNumber: [String(port)],
			}),
		],
		{ stdio: ["ignore", "pipe", "pipe"] },
	);
	let log = "";
	tunnel.stdout.on("data", (d) => {
		log += d;
	});
	tunnel.stderr.on("data", (d) => {
		log += d;
	});
	const stop = () => {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		}
		try {
			tunnel.kill();
		} catch {}
	};
	process.on("exit", stop);
	for (
		let i = 0;
		i < 20 && !/Port [0-9]+ opened|Waiting for connections/.test(log);
		i++
	) {
		await new Promise((r) => setTimeout(r, 1000));
	}
	const envFile = path.join(os.tmpdir(), `zz-launch-cron-${process.pid}.env`);
	fs.writeFileSync(
		envFile,
		`${[
			"PGHOST=host.docker.internal",
			`PGPORT=${port}`,
			`PGUSER=${decodeURIComponent(u.username)}`,
			`PGPASSWORD=${decodeURIComponent(u.password)}`,
			`PGDATABASE=${DB_NAME}`,
			"PGSSLMODE=require",
			"PGCONNECT_TIMEOUT=15",
		].join("\n")}\n`,
		{ mode: 0o600 },
	);
	process.on("exit", () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	});
	const q = (sql) => {
		const r = spawnSync(
			"docker",
			[
				"run",
				"--rm",
				"--env-file",
				envFile,
				"postgres:17-alpine",
				"psql",
				"-X",
				"-v",
				"ON_ERROR_STOP=1",
				"-tA",
				"-c",
				sql,
			],
			{ encoding: "utf8" },
		);
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 200)));
		return r.stdout.trim();
	};
	const listJobs = () =>
		q(
			"select jobid || '|' || jobname || '|' || active from cron.job order by jobid",
		);

	console.log(`${args.env} pg_cron jobs (jobid|name|active):`);
	console.log(listJobs());
	if (args.mode === "pause") {
		ids = parseJobIds(
			q(
				"select coalesce(string_agg(jobid::text, ',' order by jobid), '') from cron.job where active",
			),
		);
	}
	console.log(
		`will ${args.mode === "pause" ? "deactivate" : "re-activate"}: ${ids.join(",") || "none"}`,
	);
	if (!args.execute) {
		console.log("CHECK ONLY — nothing changed. Re-run with --execute.");
		stop();
		process.exit(0);
	}
	if (args.mode === "pause") {
		// The record first: if the update then fails, nothing was paused and the
		// file still names exactly what was active.
		fs.writeFileSync(
			stateFile,
			`${JSON.stringify({ env: args.env, activeBefore: ids }, null, 2)}\n`,
			{ flag: "wx" },
		);
		const sql = pauseSql(ids);
		if (sql) q(sql);
	} else {
		const sql = rearmSql(ids);
		if (sql) q(sql);
	}
	console.log(listJobs());
	console.log(
		args.mode === "pause"
			? `DONE — paused; the ids are recorded in ${stateFile}.`
			: "DONE — the recorded jobs are active again.",
	);
	stop();
	process.exit(0);
}

module.exports = { readSavedJobIds, pauseSql, parseArgs, assertArgs };

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
