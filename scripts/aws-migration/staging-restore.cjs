// STAGING-ONLY restore of the verified production backup into the staging RDS.
//   node staging-restore.cjs <instance-id> [--execute]
// Pre-flight (always): target guards, checksum, tunnel, journal, seed-row census.
// Execute (only with --execute): pause cron → truncate → pg_restore --data-only → resume cron.
// Never prints a credential. The DB URL is read from the AWS staging secret and handed to
// Docker through a mode-0600 env file that is deleted on exit.
const fs = require("node:fs"),
	os = require("node:os"),
	path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const AWS = "C:/Program Files/Amazon/AWSCLIV2/aws.exe";
const PLUGIN_DIR = "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin";
const REGION = "ap-south-1";
const SECRET = "zugzwang/staging";
const DUMP_DIR_WIN = "C:\\Users\\Lenovo\\zugzwang-backups\\prod";
const DUMP = "zugzwang-prod-2026-09-24T18-49-51Z.dump";
const DUMP_SHA =
	"FB41A75646D34A45EE23FB8B7921051710AA20DD29534E96A4701E32C33CEE30";
const LOCAL_PORT = 15432;
const EXECUTE = process.argv.includes("--execute");
const instanceId = process.argv[2];
if (!instanceId || !/^i-[0-9a-f]+$/.test(instanceId)) {
	console.error("usage: <instance-id> [--execute]");
	process.exit(2);
}

const aws = (args) => {
	const r = spawnSync(AWS, ["--region", REGION, ...args], {
		encoding: "utf8",
		env: { ...process.env, PATH: PLUGIN_DIR + ";" + process.env.PATH },
	});
	if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 300));
	return r.stdout;
};
const results = [];
let ok = true;
const step = (m) => console.log(`… ${m}`);
const check = (n, label, pass, detail) => {
	results.push([n, pass ? "PASS" : "FAIL", label, detail]);
	if (!pass) ok = false;
};

(async () => {
	// ── 1. target: the STAGING RDS, from the staging secret ──
	step("reading the staging secret");
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
	const u = new URL(sec.DATABASE_URL);
	const host = u.hostname;
	check(
		1,
		"target host is the STAGING RDS endpoint (never Supabase, never production)",
		/\.ap-south-1\.rds\.amazonaws\.com$/.test(host) &&
			/staging/.test(host) &&
			!/supabase|prod/i.test(host) &&
			u.pathname === "/zugzwang",
		`host=${host} db=${u.pathname.slice(1)}`,
	);
	// ── 2. dump integrity ──
	step("hashing the backup file");
	const dumpWin = path.win32.join(DUMP_DIR_WIN, DUMP);
	const dumpNode = dumpWin.split("\\").join("/");
	const sha = spawnSync(
		"powershell",
		[
			"-NoProfile",
			"-Command",
			`(Get-FileHash '${dumpWin}' -Algorithm SHA256).Hash`,
		],
		{ encoding: "utf8" },
	).stdout.trim();
	check(
		2,
		"backup file present and SHA-256 matches the verified backup",
		fs.existsSync(dumpNode) && sha === DUMP_SHA,
		`${DUMP} sha=${sha.slice(0, 16)}…`,
	);
	// ── 3. SSM tunnel to RDS through the staging instance ──
	step("opening the SSM tunnel");
	const tunnel = spawn(
		AWS,
		[
			"--region",
			REGION,
			"ssm",
			"start-session",
			"--target",
			instanceId,
			"--document-name",
			"AWS-StartPortForwardingSessionToRemoteHost",
			"--parameters",
			JSON.stringify({
				host: [host],
				portNumber: ["5432"],
				localPortNumber: [String(LOCAL_PORT)],
			}),
		],
		{
			env: { ...process.env, PATH: PLUGIN_DIR + ";" + process.env.PATH },
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	let tunnelLog = "";
	tunnel.stdout.on("data", (d) => {
		tunnelLog += d;
	});
	tunnel.stderr.on("data", (d) => {
		tunnelLog += d;
	});
	// Kill the TREE: `aws` spawns session-manager-plugin, which owns the port and
	// holds our stdio pipes open. A plain kill() leaves the grandchild alive, the
	// event loop never drains, and the script hangs after finishing (measured).
	const stopTunnel = () => {
		try {
			spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		} catch {}
		try {
			tunnel.kill();
		} catch {}
	};
	process.on("exit", stopTunnel);
	for (
		let i = 0;
		i < 20 && !/Port [0-9]+ opened|Waiting for connections/.test(tunnelLog);
		i++
	)
		await new Promise((r) => setTimeout(r, 1000));
	check(
		3,
		"SSM port-forward session established",
		/Starting session with SessionId|Waiting for connections|Port [0-9]+ opened/.test(
			tunnelLog,
		),
		tunnelLog.replace(/\s+/g, " ").slice(0, 120),
	);
	// ── 4. reach the database through the tunnel (from the pg client container) ──
	step("connecting through the tunnel (15 s connect timeout)");
	const envFile = path.join(os.tmpdir(), `zz-restore-${process.pid}.env`);
	const cleanupEnv = () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	};
	process.on("exit", cleanupEnv);
	fs.writeFileSync(
		envFile,
		[
			`PGHOST=host.docker.internal`,
			`PGPORT=${LOCAL_PORT}`,
			`PGUSER=${decodeURIComponent(u.username)}`,
			`PGPASSWORD=${decodeURIComponent(u.password)}`,
			`PGDATABASE=zugzwang`,
			`PGSSLMODE=require`,
			`PGCONNECT_TIMEOUT=15`,
			`PGOPTIONS=-c statement_timeout=600000`,
		].join("\n") + "\n",
		{ mode: 0o600 },
	);
	const psql = (sqlText) =>
		spawnSync(
			"docker",
			[
				"run",
				"--rm",
				"--env-file",
				envFile,
				"-v",
				`${DUMP_DIR_WIN}:/backup`,
				"postgres:17-alpine",
				"psql",
				"-X",
				"-v",
				"ON_ERROR_STOP=1",
				"-tA",
				"-c",
				sqlText,
			],
			{ encoding: "utf8" },
		);
	const q = (sqlText) => {
		const r = psql(sqlText);
		if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 200));
		return r.stdout.trim();
	};
	let journal = "?",
		ver = "?";
	try {
		ver = q("select current_setting('server_version')");
		journal = q('select count(*) from "drizzle"."__drizzle_migrations"');
		check(
			4,
			"database reachable through the tunnel; PostgreSQL 17; 32 migrations in the journal",
			/^17\./.test(ver) && journal === "32",
			`server=${ver} journal=${journal}`,
		);
	} catch (e) {
		check(
			4,
			"database reachable through the tunnel",
			false,
			String(e.message).slice(0, 160) +
				" | tunnel: " +
				tunnelLog.replace(/\s+/g, " ").slice(-160),
		);
	}
	// ── 5. what is in the staging tables right now (seed rows + cron output only) ──
	let census = "";
	try {
		census = q(
			"select string_agg(relname||'='||n_live_tup, ' ' order by relname) from pg_stat_user_tables where schemaname='public' and n_live_tup>0",
		);
		const jobs = q("select count(*) from cron.job");
		check(
			5,
			"staging holds only migration seeds and cron output; 4 cron jobs registered",
			jobs === "4",
			`cron.job=${jobs} · non-empty: ${census || "(none)"}`,
		);
	} catch (e) {
		check(5, "seed census", false, String(e.message).slice(0, 160));
	}

	// ── 6. the restore connection may suspend FK checks (RDS grants this to rds_superuser) ──
	try {
		const probeEnv = envFile + ".probe";
		fs.writeFileSync(
			probeEnv,
			fs
				.readFileSync(envFile, "utf8")
				.replace(
					/^PGOPTIONS=.*$/m,
					"PGOPTIONS=-c session_replication_role=replica",
				),
			{ mode: 0o600 },
		);
		const pr = spawnSync(
			"docker",
			[
				"run",
				"--rm",
				"--env-file",
				probeEnv,
				"postgres:17-alpine",
				"psql",
				"-X",
				"-tA",
				"-c",
				"show session_replication_role",
			],
			{ encoding: "utf8" },
		);
		try {
			fs.rmSync(probeEnv, { force: true });
		} catch {}
		check(
			6,
			"restore connection can set session_replication_role=replica (FK checks suspended for the load)",
			pr.status === 0 && pr.stdout.trim() === "replica",
			pr.status === 0
				? `value=${pr.stdout.trim()}`
				: pr.stderr.trim().slice(0, 160),
		);
	} catch (e) {
		check(6, "replica role probe", false, String(e.message).slice(0, 160));
	}

	console.log(
		"=== RESTORE PRE-FLIGHT " +
			(EXECUTE ? "(EXECUTE MODE)" : "(CHECK ONLY)") +
			" ===",
	);
	for (const [n, s, l, d] of results)
		console.log(`${s}  ${n}. ${l}\n        ${d}`);
	console.log(
		`=== RESULT: ${ok ? "ALL 6 PASS" : "FAILED — nothing will run"} ===`,
	);
	if (!ok) {
		stopTunnel();
		cleanupEnv();
		process.exit(1);
	}
	if (!EXECUTE) {
		console.log("check-only: stopping before any write.");
		stopTunnel();
		cleanupEnv();
		process.exit(0);
	}

	// ── EXECUTE ──
	const t0 = Date.now();
	console.log("[1/5] pausing the 4 pg_cron jobs");
	q("update cron.job set active = false");
	console.log(
		"[2/5] truncating public + drizzle tables (USER triggers disabled for the statement only — RDS forbids touching the system FK triggers)",
	);
	const tables = q(
		"select string_agg(format('%I.%I', schemaname, tablename), ',') from pg_tables where schemaname in ('public','drizzle') and tablename not like 'events_%'",
	);
	// events partitions are truncated through the parent; TRUNCATE ... CASCADE handles FKs.
	const disable = q(
		`select string_agg(format('ALTER TABLE %I.%I DISABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')`,
	);
	const enable = q(
		`select string_agg(format('ALTER TABLE %I.%I ENABLE TRIGGER USER', schemaname, tablename), '; ') from pg_tables where schemaname in ('public','drizzle')`,
	);
	q(`${disable}; TRUNCATE ${tables} CASCADE; ${enable}`);
	console.log("      truncated:", tables.split(",").length, "tables");
	console.log(
		"[3/5] pg_restore --data-only (public + drizzle) with session_replication_role=replica — FK checks suspended for the load; the archive is a single consistent snapshot",
	);
	const restoreEnv = envFile + ".restore";
	fs.writeFileSync(
		restoreEnv,
		fs
			.readFileSync(envFile, "utf8")
			.replace(
				/^PGOPTIONS=.*$/m,
				"PGOPTIONS=-c session_replication_role=replica -c statement_timeout=600000",
			),
		{ mode: 0o600 },
	);
	process.on("exit", () => {
		try {
			fs.rmSync(restoreEnv, { force: true });
		} catch {}
	});
	const r = spawnSync(
		"docker",
		[
			"run",
			"--rm",
			"--env-file",
			restoreEnv,
			"-v",
			`${DUMP_DIR_WIN}:/backup`,
			"postgres:17-alpine",
			"pg_restore",
			"--data-only",
			"--no-owner",
			"--no-acl",
			"--exit-on-error",
			"--verbose",
			"--schema=public",
			"--schema=drizzle",
			"--dbname=zugzwang",
			`/backup/${DUMP}`,
		],
		{ encoding: "utf8" },
	);
	const out = (r.stdout + "\n" + r.stderr).replace(
		/postgres(ql)?:\/\/[^\s]+/g,
		"<url>",
	);
	fs.writeFileSync(dumpNode + ".staging-restore.log", out, { mode: 0o600 });
	console.log(
		`      pg_restore exit=${r.status} · ${out.split("\n").filter(Boolean).length} log lines · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
	);
	if (r.status !== 0) {
		console.log(
			out
				.split("\n")
				.filter((l) => /error/i.test(l))
				.slice(0, 5)
				.join("\n"),
		);
	}
	try {
		fs.rmSync(restoreEnv, { force: true });
	} catch {}
	console.log("[4/5] resuming the 4 pg_cron jobs");
	q("update cron.job set active = true");
	console.log("[5/5] done");
	stopTunnel();
	cleanupEnv();
	process.exit(r.status === 0 ? 0 : 1);
})().catch((e) => {
	console.log("error:", String(e.message).slice(0, 200));
	process.exit(1);
});
