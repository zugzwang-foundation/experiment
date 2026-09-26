// Readiness item 17 — restore the verified Supabase production backup into the
// PRODUCTION RDS. PRODUCTION ONLY.
//
//   node scripts/aws-migration/prod-restore.cjs <instance-id> <dump-file> <sha256> [--execute] [--reload-nonempty]
//
// ⛔ CHECK-ONLY BY DEFAULT. Without `--execute` it runs every pre-flight and writes
// nothing. It never prints a credential: the DB URL is read from Secrets Manager
// `zugzwang/production` and handed to Docker through a mode-0600 env file deleted on exit.
//
// The production twin of `staging-restore.cjs` (proven twice on staging, 06 §5/§10.6):
// SSM port-forward through the production ECS host, then a `postgres:17-alpine`
// container runs psql/pg_restore. Deliberate differences:
//   1. `pg_restore --single-transaction`: the whole load commits or none of it does.
//      A tunnel that dies mid-load (seen once on staging, 06 §10.6) rolls back
//      instead of leaving a half-loaded production database.
//   2. REFUSES A NON-EMPTY TARGET. After cutover this RDS IS production; a re-run
//      would TRUNCATE live data. Any row in users / markets / bets / comments /
//      dharma_ledger fails the pre-flight unless `--reload-nonempty` is passed
//      (for retrying a failed load BEFORE the go / no-go, never after).
//   3. The dump file and its SHA-256 are arguments (nothing hard-coded to one
//      backup), the dump must be a `zugzwang-prod-*.dump`, and the hash is
//      computed in Node — no PowerShell.
//   4. `$AWS_CLI` / PATH for the AWS CLI and the Session Manager plugin.
// Pure helpers are exported and covered by tests/unit/scripts/prod-restore.test.ts.

const REGION = "ap-south-1";
const SECRET = "zugzwang/production";
const DB_NAME = "zugzwang";
const LOCAL_PORT = 15433;
/** Tables that hold participant data; a freshly migrated database has none. */
const PARTICIPANT_TABLES = [
	"users",
	"markets",
	"bets",
	"comments",
	"dharma_ledger",
];

function parseArgs(argv) {
	const flags = new Set(argv.filter((a) => a.startsWith("--")));
	const [instanceId, dumpFile, sha256] = argv.filter(
		(a) => !a.startsWith("--"),
	);
	return {
		instanceId,
		dumpFile,
		sha256: sha256 ? sha256.toLowerCase() : sha256,
		execute: flags.has("--execute"),
		reloadNonEmpty: flags.has("--reload-nonempty"),
	};
}

function assertArgs({ instanceId, dumpFile, sha256 }) {
	if (!/^i-[0-9a-f]{8,}$/.test(String(instanceId))) {
		throw new Error(`refusing: "${instanceId}" is not an EC2 instance id`);
	}
	const base = String(dumpFile).split(/[\\/]/).pop();
	if (!/^zugzwang-prod-[0-9TZ-]+\.dump$/.test(base)) {
		throw new Error(
			`refusing: "${base}" is not a zugzwang-prod-<timestamp>.dump backup`,
		);
	}
	if (!/^[0-9a-f]{64}$/.test(String(sha256))) {
		throw new Error("refusing: the expected SHA-256 must be 64 hex characters");
	}
}

/** Throws unless the URL targets the production RDS database `zugzwang`. */
function assertProductionTarget(databaseUrl) {
	const u = new URL(databaseUrl);
	if (
		!/^[a-z0-9.-]+\.ap-south-1\.rds\.amazonaws\.com$/.test(u.hostname) ||
		!/production/i.test(u.hostname) ||
		/staging|supabase/i.test(u.hostname) ||
		u.pathname !== `/${DB_NAME}`
	) {
		throw new Error(
			`refusing: target ${u.hostname}${u.pathname} is not the production RDS database "${DB_NAME}"`,
		);
	}
	return u;
}

/** SHA-256 of a file, streamed (the dump can be large). */
function sha256File(file) {
	const crypto = require("node:crypto");
	const fs = require("node:fs");
	return new Promise((resolve, reject) => {
		const h = crypto.createHash("sha256");
		fs.createReadStream(file)
			.on("error", reject)
			.on("data", (d) => h.update(d))
			.on("end", () => resolve(h.digest("hex")));
	});
}

/**
 * Pre-flight verdict on the target's participant tables. `counts` maps table ->
 * row count. Empty is required unless `reloadNonEmpty`.
 */
function targetEmptyVerdict(counts, reloadNonEmpty) {
	const nonEmpty = PARTICIPANT_TABLES.filter((t) => Number(counts[t] ?? 0) > 0);
	if (nonEmpty.length === 0) return { pass: true, nonEmpty };
	return { pass: reloadNonEmpty, nonEmpty };
}

/** The pg_restore argument list — pinned by the tests. */
function pgRestoreArgs(dumpBase) {
	return [
		"pg_restore",
		"--data-only",
		"--single-transaction",
		"--exit-on-error",
		"--no-owner",
		"--no-acl",
		"--verbose",
		"--schema=public",
		"--schema=drizzle",
		`--dbname=${DB_NAME}`,
		`/backup/${dumpBase}`,
	];
}

/** Redact any connection URL from tool output before it is printed or saved. */
function redact(text) {
	return String(text).replace(/postgres(ql)?:\/\/[^\s]+/g, "<url>");
}

async function main() {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const { spawn, spawnSync } = require("node:child_process");
	const AWS = process.env.AWS_CLI || "aws";

	const args = parseArgs(process.argv.slice(2));
	assertArgs(args);
	const dumpFile = path.resolve(args.dumpFile);
	const dumpDir = path.dirname(dumpFile);
	const dumpBase = path.basename(dumpFile);

	const aws = (a) => {
		const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
		if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 300));
		return r.stdout;
	};
	const results = [];
	let ok = true;
	const check = (n, label, pass, detail) => {
		results.push([n, pass ? "PASS" : "FAIL", label, detail]);
		if (!pass) ok = false;
	};

	// 1. target: the production RDS, from the production secret
	const sec = JSON.parse(
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
	);
	let u;
	try {
		u = assertProductionTarget(sec.DATABASE_URL);
		check(1, "target is the production RDS database", true, u.hostname);
	} catch (e) {
		check(1, "target is the production RDS database", false, e.message);
	}

	// 2. dump integrity
	const actual = fs.existsSync(dumpFile) ? await sha256File(dumpFile) : "";
	check(
		2,
		"backup present and SHA-256 matches the value given",
		actual === args.sha256,
		`${dumpBase} sha=${actual.slice(0, 16) || "(missing)"}…`,
	);
	if (!u) {
		report(results, ok, args.execute);
		process.exit(1);
	}

	// 3. SSM tunnel through the production ECS host
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
				localPortNumber: [String(LOCAL_PORT)],
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
	check(
		3,
		"SSM port-forward session established",
		/Waiting for connections|Port [0-9]+ opened/.test(tunnelLog),
		redact(tunnelLog.replace(/\s+/g, " ").slice(0, 120)),
	);

	// 4. database reachable; migrated
	const envFile = path.join(os.tmpdir(), `zz-prod-restore-${process.pid}.env`);
	const writeEnv = (file, pgoptions) =>
		fs.writeFileSync(
			file,
			`${[
				"PGHOST=host.docker.internal",
				`PGPORT=${LOCAL_PORT}`,
				`PGUSER=${decodeURIComponent(u.username)}`,
				`PGPASSWORD=${decodeURIComponent(u.password)}`,
				`PGDATABASE=${DB_NAME}`,
				"PGSSLMODE=require",
				"PGCONNECT_TIMEOUT=15",
				`PGOPTIONS=${pgoptions}`,
			].join("\n")}\n`,
			{ mode: 0o600 },
		);
	const envFiles = [envFile];
	process.on("exit", () => {
		for (const f of envFiles) {
			try {
				fs.rmSync(f, { force: true });
			} catch {}
		}
	});
	writeEnv(envFile, "-c statement_timeout=600000");
	const docker = (file, cmd) =>
		spawnSync(
			"docker",
			[
				"run",
				"--rm",
				"--env-file",
				file,
				"-v",
				`${dumpDir}:/backup`,
				"postgres:17-alpine",
				...cmd,
			],
			{ encoding: "utf8" },
		);
	const q = (sql) => {
		const r = docker(envFile, [
			"psql",
			"-X",
			"-v",
			"ON_ERROR_STOP=1",
			"-tA",
			"-c",
			sql,
		]);
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 200)));
		return r.stdout.trim();
	};
	try {
		const ver = q("select current_setting('server_version')");
		const journal = q('select count(*) from "drizzle"."__drizzle_migrations"');
		check(
			4,
			"database reachable; PostgreSQL 17; migrations applied",
			/^17\./.test(ver) && Number(journal) > 0,
			`server=${ver} journal=${journal}`,
		);
	} catch (e) {
		check(4, "database reachable", false, e.message);
	}

	// 5. the target holds no participant data
	try {
		const counts = {};
		for (const t of PARTICIPANT_TABLES)
			counts[t] = q(`select count(*) from public.${t}`);
		const v = targetEmptyVerdict(counts, args.reloadNonEmpty);
		check(
			5,
			args.reloadNonEmpty
				? "target participant tables (reload explicitly allowed)"
				: "target holds NO participant data",
			v.pass,
			PARTICIPANT_TABLES.map((t) => `${t}=${counts[t]}`).join(" "),
		);
	} catch (e) {
		check(5, "target census", false, e.message);
	}

	// 6. the restore connection may suspend FK checks (RDS grants this to rds_superuser)
	const probe = `${envFile}.probe`;
	envFiles.push(probe);
	writeEnv(probe, "-c session_replication_role=replica");
	const pr = docker(probe, [
		"psql",
		"-X",
		"-tA",
		"-c",
		"show session_replication_role",
	]);
	check(
		6,
		"restore connection can set session_replication_role=replica",
		pr.status === 0 && pr.stdout.trim() === "replica",
		pr.status === 0
			? `value=${pr.stdout.trim()}`
			: redact(pr.stderr.trim().slice(0, 160)),
	);

	report(results, ok, args.execute);
	if (!ok || !args.execute) {
		stopTunnel();
		process.exit(ok ? 0 : 1);
	}

	// ── EXECUTE ──
	const t0 = Date.now();
	console.log("[1/6] pausing pg_cron jobs");
	q("update cron.job set active = false");
	console.log(
		"[2/6] truncating public + drizzle tables (USER triggers disabled for the statement only)",
	);
	const tables = q(
		"select string_agg(format('%I.%I', schemaname, tablename), ',') from pg_tables where schemaname in ('public','drizzle') and tablename not like 'events_%'",
	);
	const disable = q(
		"select string_agg(format('ALTER TABLE %I.%I DISABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')",
	);
	const enable = q(
		"select string_agg(format('ALTER TABLE %I.%I ENABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')",
	);
	q(`${disable}; TRUNCATE ${tables} CASCADE; ${enable}`);
	console.log(
		"[3/6] pg_restore --data-only --single-transaction (FK checks suspended for the load)",
	);
	const restoreEnv = `${envFile}.restore`;
	envFiles.push(restoreEnv);
	writeEnv(
		restoreEnv,
		"-c session_replication_role=replica -c statement_timeout=600000",
	);
	const r = docker(restoreEnv, pgRestoreArgs(dumpBase));
	const out = redact(`${r.stdout}\n${r.stderr}`);
	fs.writeFileSync(`${dumpFile}.prod-restore.log`, out, { mode: 0o600 });
	console.log(
		`      pg_restore exit=${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s · log: ${dumpBase}.prod-restore.log`,
	);
	console.log("[4/6] resuming pg_cron jobs");
	q("update cron.job set active = true");
	console.log("[5/6] post-load census");
	for (const t of PARTICIPANT_TABLES)
		console.log(`      ${t}=${q(`select count(*) from public.${t}`)}`);
	console.log(
		`[6/6] ${r.status === 0 ? "done — verify invariants before go / no-go (09 §K step 18)" : "FAILED — the single transaction rolled back; the target is empty"}`,
	);
	stopTunnel();
	process.exit(r.status === 0 ? 0 : 1);
}

function report(results, ok, execute) {
	console.log(
		`=== PRODUCTION RESTORE PRE-FLIGHT ${execute ? "(EXECUTE MODE)" : "(CHECK ONLY)"} ===`,
	);
	for (const [n, s, l, d] of results)
		console.log(`${s}  ${n}. ${l}\n        ${d}`);
	console.log(
		`=== RESULT: ${ok ? "ALL PASS" : "FAILED — nothing will run"} ===`,
	);
}

module.exports = {
	REGION,
	SECRET,
	DB_NAME,
	PARTICIPANT_TABLES,
	parseArgs,
	assertArgs,
	assertProductionTarget,
	sha256File,
	targetEmptyVerdict,
	pgRestoreArgs,
	redact,
};

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
