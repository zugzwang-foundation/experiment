// Production backup pre-flight + (only with --execute) the pg_dump itself.
// Every check must PASS or the script exits 1 before Docker is ever invoked.
// Secrets: never printed; the env file is written only in --execute mode, mode 0600, deleted on exit.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const postgres = createRequire(process.cwd() + "/package.json")("postgres");

const BS = String.fromCharCode(92); // backslash, kept out of literals so no shell can eat it
const EXPECTED_HOST = "aws-1-ap-south-1.pooler.supabase.com";
const EXPECTED_PORT = "5432";
const EXPECTED_DB = "postgres";
const BACKUP_DIR_POSIX = "C:/Users/Lenovo/zugzwang-backups/prod"; // Node-on-Windows form; fs/git/path all accept it
const BACKUP_DIR_WIN = BACKUP_DIR_POSIX.split("/").join(BS); // C:\Users\Lenovo\zugzwang-backups\prod
const EXECUTE = process.argv.includes("--execute");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + "Z"; // 2026-09-25T10-11-12Z
const FILE = `zugzwang-prod-${stamp}.dump`;

// The ONLY command this script can run. Static, reviewed, no interpolation of user data.
const PG_DUMP_ARGS = [
	"pg_dump",
	"--format=custom",
	"--no-owner",
	"--no-acl",
	"--verbose",
	"--schema=public",
	"--schema=drizzle",
	"--lock-wait-timeout=30000",
	`--file=/backup/${FILE}`,
];
const FORBIDDEN =
	/pg_restore|psql|migrate|drizzle-kit|--command|\bDROP\b|\bALTER\b|\bTRUNCATE\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b|VACUUM/i;

const results = [];
let ok = true;
const check = (n, label, pass, detail) => {
	results.push([n, pass ? "PASS" : "FAIL", label, detail]);
	if (!pass) ok = false;
};

(async () => {
	const raw = process.env.DATABASE_URL_PROD;
	const frag = process.env.PROD_PROJECT_REF_FRAGMENT;
	let u = null;
	try {
		u = raw ? new URL(raw) : null;
	} catch {}
	const ref = (frag ?? "").split(".")[0];

	check(
		1,
		"resolved host is the expected production Supabase session pooler",
		!!u && u.hostname === EXPECTED_HOST && (u.port || "5432") === EXPECTED_PORT,
		`host=${u ? u.hostname : "(none)"} port=${u ? u.port || "5432" : "?"} expected=${EXPECTED_HOST}:${EXPECTED_PORT}`,
	);

	check(
		2,
		"production project-ref guard matches (same check migrate-prod.ts uses)",
		!!frag &&
			!!raw &&
			raw.includes(frag) &&
			(u ? decodeURIComponent(u.username) : "").endsWith(ref),
		`PROD_PROJECT_REF_FRAGMENT set=${!!frag} · URL contains it=${!!(frag && raw && raw.includes(frag))} · user=postgres.*** ends with ref=${(u ? decodeURIComponent(u.username) : "").endsWith(ref)}`,
	);

	check(
		3,
		"database is `postgres`",
		!!u && u.pathname === `/${EXPECTED_DB}`,
		`db=${u ? u.pathname.slice(1) : "(none)"}`,
	);

	let ver = "(no connection)",
		size = "?",
		sizeBytes = 0;
	if (u) {
		const sql = postgres(raw, {
			max: 1,
			prepare: false,
			connect_timeout: 20,
			connection: { application_name: "zz-backup-preflight" },
		});
		try {
			const [r] =
				await sql`select current_setting('server_version') v, pg_size_pretty(pg_database_size(current_database())) s, pg_database_size(current_database()) b`;
			ver = r.v;
			size = r.s;
			sizeBytes = Number(r.b);
			check(
				4,
				"server is PostgreSQL 17.x",
				/^17\./.test(ver),
				`server_version=${ver}`,
			);
			check(
				5,
				"current database size",
				sizeBytes > 0 && sizeBytes < 2 * 1024 ** 3,
				`${size} (${sizeBytes} bytes) — the custom-format dump compresses, so the file will be smaller`,
			);
		} catch (e) {
			check(
				4,
				"server is PostgreSQL 17.x",
				false,
				`connect failed: ${e.code ?? e.message}`,
			);
			check(5, "current database size", false, "n/a");
		} finally {
			await sql.end({ timeout: 3 });
		}
	} else {
		check(4, "server is PostgreSQL 17.x", false, "no URL");
		check(5, "current database size", false, "no URL");
	}

	const exists = fs.existsSync(BACKUP_DIR_POSIX);
	let insideRepo = false;
	if (exists) {
		const r = spawnSync(
			"git",
			["-C", BACKUP_DIR_POSIX, "rev-parse", "--is-inside-work-tree"],
			{ encoding: "utf8" },
		);
		insideRepo = r.status === 0 && r.stdout.trim() === "true";
	}
	check(
		6,
		"backup path is the approved local directory, outside any git repo",
		exists &&
			!insideRepo &&
			BACKUP_DIR_WIN ===
				"C:" +
					BS +
					"Users" +
					BS +
					"Lenovo" +
					BS +
					"zugzwang-backups" +
					BS +
					"prod" &&
			!BACKUP_DIR_WIN.startsWith(BS + BS),
		`${BACKUP_DIR_WIN} exists=${exists} insideGitRepo=${insideRepo} unc=false`,
	);

	const target = path.posix.join(BACKUP_DIR_POSIX, FILE);
	check(
		7,
		"backup file name does not already exist",
		!fs.existsSync(target),
		FILE,
	);

	const joined = PG_DUMP_ARGS.join(" ");
	check(
		8,
		"command is pg_dump only — no restore, migration, DDL or write",
		PG_DUMP_ARGS[0] === "pg_dump" &&
			!FORBIDDEN.test(joined) &&
			PG_DUMP_ARGS.every((a) => !a.includes("$") && !a.includes(";")),
		"argv reviewed statically; forbidden tokens: none",
	);

	console.log(
		"=== PRE-FLIGHT " +
			(EXECUTE ? "(EXECUTE MODE)" : "(CHECK ONLY — pg_dump will NOT run)") +
			" ===",
	);
	for (const [n, s, l, d] of results)
		console.log(`${s}  ${n}. ${l}\n        ${d}`);
	console.log("=== FINAL COMMAND (masked) ===");
	console.log(
		`docker run --rm --env-file <TEMP_ENV_FILE mode 0600, deleted on exit> -v "${BACKUP_DIR_WIN}:/backup" postgres:17-alpine ${joined}`,
	);
	console.log(
		`env file layout: PGHOST=${EXPECTED_HOST} PGPORT=${EXPECTED_PORT} PGUSER=postgres.<REF> PGDATABASE=${EXPECTED_DB} PGPASSWORD=<REDACTED>`,
	);
	console.log(
		`=== RESULT: ${ok ? "ALL 8 PASS" : "FAILED — nothing will run"} ===`,
	);
	if (!ok) process.exit(1);
	if (!EXECUTE) {
		console.log("check-only mode: stopping before pg_dump, as instructed.");
		return;
	}

	// ---- EXECUTE: the identical checks passed just now; write env file, run pg_dump, delete env file ----
	const envFile = path.join(os.tmpdir(), `zz-pg-${process.pid}.env`);
	const cleanup = () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	};
	process.on("exit", cleanup);
	process.on("SIGINT", () => {
		cleanup();
		process.exit(130);
	});
	fs.writeFileSync(
		envFile,
		[
			`PGHOST=${u.hostname}`,
			`PGPORT=${u.port || "5432"}`,
			`PGUSER=${decodeURIComponent(u.username)}`,
			`PGDATABASE=${EXPECTED_DB}`,
			`PGPASSWORD=${decodeURIComponent(u.password)}`,
		].join("\n") + "\n",
		{ mode: 0o600 },
	);
	const t0 = Date.now();
	const r = spawnSync(
		"docker",
		[
			"run",
			"--rm",
			"--env-file",
			envFile,
			"-v",
			`${BACKUP_DIR_WIN}:/backup`,
			"postgres:17-alpine",
			...PG_DUMP_ARGS,
		],
		{ encoding: "utf8" },
	);
	cleanup();
	const out = (r.stdout + "\n" + r.stderr).replace(
		/postgres(ql)?:\/\/[^\s]+/g,
		"<url>",
	);
	const lines = out.split("\n").filter(Boolean);
	console.log(
		`pg_dump exit=${r.status} in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${lines.length} log lines · last lines:`,
	);
	console.log(lines.slice(-6).join("\n"));
	fs.writeFileSync(
		path.posix.join(BACKUP_DIR_POSIX, FILE + ".pg_dump.log"),
		out,
		{ mode: 0o600 },
	);
	const st = fs.existsSync(target) ? fs.statSync(target) : null;
	console.log(`file: ${target} exists=${!!st} size=${st ? st.size : 0} bytes`);
	process.exit(r.status === 0 && st && st.size > 0 ? 0 : 1);
})();
