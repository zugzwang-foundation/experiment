// Readiness item 17 — restore the verified Supabase production backup into the
// PRODUCTION RDS. PRODUCTION ONLY.
//
//   node scripts/aws-migration/prod-restore.cjs <instance-id> <dump-file> <sha256> --account=<12-digit id> [--execute] [--reload-nonempty]
//
// ⛔ CHECK-ONLY BY DEFAULT. Without `--execute` it runs every pre-flight and writes
// nothing. It never prints a credential: the DB URL is read from Secrets Manager
// `zugzwang/production` and handed to Docker through a mode-0600 env file deleted on exit.
//
// The production twin of `staging-restore.cjs` (proven twice on staging, 06 §5/§10.6):
// SSM port-forward through the production ECS host, then a `postgres:17-alpine`
// container runs psql/pg_restore. Deliberate differences:
//   1. TRUNCATE AND LOAD ARE ONE TRANSACTION. pg_restore renders the data to a
//      file inside the container first; only if that succeeds does psql apply
//      trigger-disable → TRUNCATE → trigger-enable → data in a single
//      transaction. Any failure — a bad row, a tunnel that dies mid-load (seen
//      once on staging, 06 §10.6) — rolls back to exactly the prior state,
//      migration seeds and journal included. (`pg_restore --single-transaction`
//      alone would not: the truncate would already be committed.)
//   2. REFUSES A NON-EMPTY TARGET. After cutover this RDS IS production; a re-run
//      would TRUNCATE live data. Any row in users / markets / bets / comments /
//      dharma_ledger fails the pre-flight unless `--reload-nonempty` is passed
//      (for retrying a failed load BEFORE the go / no-go, never after).
//   3. THE DUMP AND THE TARGET MUST BE AT THE SAME MIGRATION HEAD. A data-only
//      restore replaces the target's drizzle journal with the dump's; a mismatch
//      loads rows into a different schema and leaves a journal the next deploy
//      would re-migrate against. Counted from the archive itself, no DB needed.
//   4. `--account` is REQUIRED and must equal the caller's AWS account: production
//      lives in its own account, and the wrong CLI profile must fail at once.
//   5. The dump file and its SHA-256 are arguments (nothing hard-coded to one
//      backup), the dump must be a `zugzwang-prod-*.dump`, and the hash is
//      computed in Node — no PowerShell.
//   6. `$AWS_CLI` / PATH for the AWS CLI and the Session Manager plugin.
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
	const account = argv.find((a) => a.startsWith("--account="));
	return {
		instanceId,
		dumpFile,
		sha256: sha256 ? sha256.toLowerCase() : sha256,
		account: account ? account.slice("--account=".length) : undefined,
		execute: flags.has("--execute"),
		reloadNonEmpty: flags.has("--reload-nonempty"),
	};
}

function assertArgs({ instanceId, dumpFile, sha256, account }) {
	if (!/^[0-9]{12}$/.test(String(account))) {
		throw new Error(
			"refusing: --account=<12-digit production AWS account id> is required",
		);
	}
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

/**
 * The container command for the load — pinned by the tests. Renders the data to
 * a file first (`set -e`: psql never starts if pg_restore fails), then applies
 * `$ZZ_PRE_SQL` (trigger-disable, TRUNCATE, trigger-enable) and the data in ONE
 * transaction, stopping at the first error. The rendered file lives only inside
 * the throwaway container.
 */
function loadCommand(dumpBase) {
	return [
		"sh",
		"-c",
		[
			"set -eu",
			`pg_restore --data-only --exit-on-error --no-owner --no-acl --schema=public --schema=drizzle -f /tmp/data.sql /backup/${dumpBase}`,
			'psql -X -v ON_ERROR_STOP=1 --single-transaction -c "$ZZ_PRE_SQL" -f /tmp/data.sql',
		].join("\n"),
	];
}

/**
 * Read-only queries that list the target's tables for `preSql` (as in
 * staging-restore.cjs). Events partitions are emptied through the parent.
 */
const TARGET_SQL = {
	tables:
		"select string_agg(format('%I.%I', schemaname, tablename), ',') from pg_tables where schemaname in ('public','drizzle') and tablename not like 'events_%'",
	disable:
		"select string_agg(format('ALTER TABLE %I.%I DISABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')",
	enable:
		"select string_agg(format('ALTER TABLE %I.%I ENABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')",
};

/** The statements that empty the target inside the load transaction. */
function preSql({ disable, tables, enable }) {
	if (!disable || !tables || !enable) {
		throw new Error(
			"refusing: empty table list — is this the migrated database?",
		);
	}
	return `${disable}; TRUNCATE ${tables} CASCADE; ${enable};`;
}

/** Reads the dump's drizzle journal without a database connection. */
function dumpJournalArgs(dumpBase) {
	return [
		"pg_restore",
		"--data-only",
		"--schema=drizzle",
		"--table=__drizzle_migrations",
		"-f",
		"-",
		`/backup/${dumpBase}`,
	];
}

/** Rows in the COPY block for drizzle.__drizzle_migrations; -1 if absent. */
function countJournalRows(sqlText) {
	const lines = String(sqlText).split(/\r?\n/);
	const start = lines.findIndex((l) =>
		/^COPY drizzle\.__drizzle_migrations\b.*FROM stdin;$/.test(l),
	);
	if (start === -1) return -1;
	const end = lines.indexOf("\\.", start + 1);
	if (end === -1) return -1;
	return end - start - 1;
}

/** The dump and the target must be at the same, non-empty migration head. */
function journalVerdict(dumpRows, targetRows) {
	const d = Number(dumpRows);
	const t = Number(targetRows);
	return { pass: d > 0 && d === t, dump: d, target: t };
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

	// 0. the caller is in the production account — before any secret is read
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
			`refusing: AWS credentials are for account ${caller}, not the production account ${args.account} — check the CLI profile`,
		);
	}

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
	// `file` may be null for a command that needs no connection. `extra` names
	// variables passed through from this process's environment (never argv).
	const docker = (file, cmd, extra = {}) =>
		spawnSync(
			"docker",
			[
				"run",
				"--rm",
				...(file ? ["--env-file", file] : []),
				...Object.keys(extra).flatMap((k) => ["-e", k]),
				"-v",
				`${dumpDir}:/backup`,
				"postgres:17-alpine",
				...cmd,
			],
			{
				encoding: "utf8",
				env: { ...process.env, ...extra },
				maxBuffer: 256 * 1024 * 1024,
			},
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
		const d = docker(null, dumpJournalArgs(dumpBase));
		const dumpRows = d.status === 0 ? countJournalRows(d.stdout) : -1;
		const v = journalVerdict(dumpRows, journal);
		check(
			4,
			"database reachable; PostgreSQL 17; dump and target at the same migration head",
			/^17\./.test(ver) && v.pass,
			`server=${ver} target journal=${v.target} dump journal=${v.dump}`,
		);
	} catch (e) {
		check(4, "database reachable / migration head", false, e.message);
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
	console.log("[1/5] pausing pg_cron jobs");
	q("update cron.job set active = false");
	let r;
	try {
		console.log("[2/5] listing public + drizzle tables (read only)");
		const pre = preSql({
			tables: q(TARGET_SQL.tables),
			disable: q(TARGET_SQL.disable),
			enable: q(TARGET_SQL.enable),
		});
		console.log(
			"[3/5] one transaction: truncate + load (FK checks suspended for the load)",
		);
		const restoreEnv = `${envFile}.restore`;
		envFiles.push(restoreEnv);
		writeEnv(
			restoreEnv,
			"-c session_replication_role=replica -c statement_timeout=600000",
		);
		r = docker(restoreEnv, loadCommand(dumpBase), { ZZ_PRE_SQL: pre });
		const out = redact(`${r.stdout ?? ""}\n${r.stderr ?? ""}`);
		fs.writeFileSync(`${dumpFile}.prod-restore.log`, out, { mode: 0o600 });
		console.log(
			`      load exit=${r.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s · log: ${dumpBase}.prod-restore.log`,
		);
	} finally {
		// Loaded, or rolled back to exactly the prior state — either way the jobs
		// belong back on.
		console.log("[4/5] resuming pg_cron jobs");
		q("update cron.job set active = true");
	}
	console.log("[5/5] post-load census");
	for (const t of PARTICIPANT_TABLES)
		console.log(`      ${t}=${q(`select count(*) from public.${t}`)}`);
	console.log(
		`      journal=${q('select count(*) from "drizzle"."__drizzle_migrations"')}`,
	);
	console.log(
		r.status === 0
			? "DONE — verify invariants before go / no-go (09 §K)"
			: "FAILED — the transaction rolled back; the target is exactly as it was before this run. Read the log, fix, re-run.",
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
	loadCommand,
	TARGET_SQL,
	preSql,
	dumpJournalArgs,
	countJournalRows,
	journalVerdict,
	redact,
};

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
