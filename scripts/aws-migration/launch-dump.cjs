// LAUNCH-DB-COPY-1 — pg_dump of ONE named environment, plus a manifest
// (row count + content fingerprint per table) written beside it.
//
//   node scripts/aws-migration/launch-dump.cjs <prod|staging> <ecs-instance-id> --account=<12-digit id> [--out=<dir>] [--execute]
//
// ⛔ CHECK-ONLY BY DEFAULT. Without `--execute` it verifies the target, opens the
// tunnel and prints the census; it writes nothing. With `--execute` it writes
// three LOCAL files and nothing else:
//   zugzwang-<env>-<stamp>.dump           the custom-format archive (public + drizzle)
//   zugzwang-<env>-<stamp>.dump.sha256    its SHA-256
//   zugzwang-<env>-<stamp>.dump.manifest.json   { env, host, stamp, sha256, tables }
//
// It never restores, never changes a row, never pauses a job — the database is
// only read. Used twice in the runbook: step 3b (production backup) and step 5
// (the staging source). The environment is a stated positional argument that
// is checked against the secret's host (`assertEnvTarget`), because the same
// operator points this at both databases within the hour.
//
// The census is taken BEFORE and AFTER pg_dump. If any table other than the
// three pg_cron writes moved in between, the source was live during the dump,
// the archive describes no single state, and the run is refused.

const {
	ENVS,
	assertEnvTarget,
	dumpFileName,
	redact,
	parseSecret,
	REGION,
	DB_NAME,
} = require("./lib/launch-common.cjs");
const {
	TABLE_LIST_SQL,
	countAndFingerprintSql,
	VOLATILE_TABLES,
} = require("./lib/fingerprint.cjs");

const LOCAL_PORT = { prod: 15435, staging: 15436 };

function parseArgs(argv) {
	const flags = new Set(argv.filter((a) => a.startsWith("--")));
	const [env, instanceId] = argv.filter((a) => !a.startsWith("--"));
	const account = argv.find((a) => a.startsWith("--account="));
	const out = argv.find((a) => a.startsWith("--out="));
	return {
		env,
		instanceId,
		account: account ? account.slice("--account=".length) : undefined,
		out: out ? out.slice("--out=".length) : undefined,
		execute: flags.has("--execute"),
	};
}

function assertArgs({ env, instanceId, account }) {
	if (!Object.hasOwn(ENVS, String(env))) {
		throw new Error(
			`refusing: environment must be "prod" or "staging" (got ${JSON.stringify(env)})`,
		);
	}
	if (!/^i-[0-9a-f]{8,}$/.test(String(instanceId))) {
		throw new Error(`refusing: "${instanceId}" is not an EC2 instance id`);
	}
	if (!/^[0-9]{12}$/.test(String(account))) {
		throw new Error(
			"refusing: --account=<12-digit AWS account id> is required",
		);
	}
}

/** The one command this tool runs against a database that is not a read query. */
function dumpCommand(base) {
	return [
		"pg_dump",
		"--format=custom",
		"--no-owner",
		"--no-acl",
		"--schema=public",
		"--schema=drizzle",
		"-f",
		`/backup/${base}`,
	];
}

/**
 * The census before and after pg_dump must agree on every table except the
 * pg_cron ones. A session table is NOT excused here (unlike at verification):
 * a session written mid-dump proves the source was serving requests.
 */
function stableVerdict(before, after) {
	const tables = [
		...new Set([...Object.keys(before), ...Object.keys(after)]),
	].sort();
	const moved = tables.filter((t) => {
		if (VOLATILE_TABLES.includes(t)) return false;
		const b = before[t];
		const a = after[t];
		if (!b || !a) return true;
		return Number(b.count) !== Number(a.count) || b.md5 !== a.md5;
	});
	return { pass: moved.length === 0, moved };
}

async function main() {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const crypto = require("node:crypto");
	const { spawn, spawnSync } = require("node:child_process");
	const AWS = process.env.AWS_CLI || "aws";

	const args = parseArgs(process.argv.slice(2));
	assertArgs(args);
	const outDir = path.resolve(
		args.out || path.join(os.homedir(), "zugzwang-backups", "launch"),
	);

	const aws = (a) => {
		const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 300)));
		return r.stdout;
	};

	// 0. the caller's account, before any secret is read
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

	// 1. the target, from that environment's secret — and it must BE that environment
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
	console.log(`target: ${args.env} → ${u.hostname}${u.pathname}`);

	// 2. SSM port-forward through that environment's ECS host
	const port = LOCAL_PORT[args.env];
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
	let tunnelLog = "";
	tunnel.stdout.on("data", (d) => {
		tunnelLog += d;
	});
	tunnel.stderr.on("data", (d) => {
		tunnelLog += d;
	});
	const stopTunnel = () => {
		if (process.platform === "win32") {
			spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		}
		try {
			tunnel.kill();
		} catch {}
	};
	process.on("exit", stopTunnel);
	for (
		let i = 0;
		i < 20 && !/Port [0-9]+ opened|Waiting for connections/.test(tunnelLog);
		i++
	) {
		await new Promise((r) => setTimeout(r, 1000));
	}
	if (!/Port [0-9]+ opened|Waiting for connections/.test(tunnelLog)) {
		throw new Error(
			`SSM tunnel did not open: ${redact(tunnelLog.slice(0, 160))}`,
		);
	}

	// 3. credentials to Docker through a mode-0600 env file, deleted on exit
	fs.mkdirSync(outDir, { recursive: true });
	const envFile = path.join(os.tmpdir(), `zz-launch-dump-${process.pid}.env`);
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
			"PGOPTIONS=-c statement_timeout=600000 -c default_transaction_read_only=on -c timezone=UTC -c datestyle=ISO,MDY -c intervalstyle=postgres -c extra_float_digits=3 -c bytea_output=hex",
		].join("\n")}\n`,
		{ mode: 0o600 },
	);
	process.on("exit", () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	});
	const docker = (cmd) =>
		spawnSync(
			"docker",
			[
				"run",
				"--rm",
				"--env-file",
				envFile,
				"-v",
				`${outDir}:/backup`,
				"postgres:17-alpine",
				...cmd,
			],
			{ encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
		);
	const q = (sql) => {
		const r = docker(["psql", "-X", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql]);
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 200)));
		return r.stdout.trim();
	};
	const census = () => {
		const tables = q(TABLE_LIST_SQL).split(/\r?\n/).filter(Boolean);
		const out = {};
		for (const t of tables) {
			const [count, md5] = q(countAndFingerprintSql(t)).split("|");
			out[t] = { count: Number(count), md5 };
		}
		return out;
	};

	const journal = q('select count(*) from "drizzle"."__drizzle_migrations"');
	const before = census();
	console.log(
		`census (${Object.keys(before).length} tables, migration journal ${journal}):`,
	);
	for (const [t, v] of Object.entries(before))
		console.log(`  ${t.padEnd(36)} ${String(v.count).padStart(8)}  ${v.md5}`);

	if (!args.execute) {
		console.log("CHECK ONLY — nothing written. Re-run with --execute to dump.");
		stopTunnel();
		process.exit(0);
	}

	// ── EXECUTE: pg_dump, then the second census ──
	const base = dumpFileName(args.env, new Date());
	const file = path.join(outDir, base);
	const t0 = Date.now();
	const r = docker(dumpCommand(base));
	if (r.status !== 0 || !fs.existsSync(file)) {
		throw new Error(`pg_dump failed: ${redact(r.stderr.trim().slice(0, 300))}`);
	}
	const after = census();
	const v = stableVerdict(before, after);
	if (!v.pass) {
		fs.renameSync(file, `${file}.unstable`);
		throw new Error(
			`refusing: the ${args.env} database changed during the dump (${v.moved.join(", ")}). The archive was renamed *.unstable. Pause writes AND the pg_cron jobs (launch-cron.cjs pause), then re-run.`,
		);
	}
	// Streamed into the hash (the archive can be large); the digest is read off
	// the hash stream once the file has been piped through it.
	const hash = crypto.createHash("sha256");
	await new Promise((resolve, reject) => {
		fs.createReadStream(file)
			.on("error", reject)
			.pipe(hash)
			.on("finish", resolve)
			.on("error", reject);
	});
	const sha256 = hash.read().toString("hex");
	fs.writeFileSync(`${file}.sha256`, `${sha256}  ${base}\n`);
	fs.writeFileSync(
		`${file}.manifest.json`,
		`${JSON.stringify(
			{
				env: args.env,
				host: u.hostname,
				stamp: base.replace(/^zugzwang-[a-z]+-|\.dump$/g, ""),
				journal: Number(journal),
				sha256,
				tables: after,
			},
			null,
			2,
		)}\n`,
	);
	console.log(
		`DUMPED ${base} in ${((Date.now() - t0) / 1000).toFixed(1)}s\n  sha256 ${sha256}\n  ${file}.manifest.json`,
	);
	stopTunnel();
	process.exit(0);
}

module.exports = { parseArgs, assertArgs, dumpCommand, stableVerdict };

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
