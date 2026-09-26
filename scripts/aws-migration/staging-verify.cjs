// STAGING-ONLY post-restore verification: schema, data, extensions, cron, and the
// behavioural append-only test. Read-only except for ONE deliberate write attempt —
// a DELETE on `bets` that MUST be rejected by the Bucket-A trigger (check 3 of the
// cutover gate); it runs inside a transaction that is rolled back regardless.
//   node staging-verify.cjs <instance-id>
const fs = require("node:fs"),
	os = require("node:os"),
	path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const AWS = "C:/Program Files/Amazon/AWSCLIV2/aws.exe";
const PLUGIN_DIR = "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin";
const REGION = "ap-south-1",
	SECRET = "zugzwang/staging",
	LOCAL_PORT = 15432;
const DUMP_DIR_WIN = "C:\\Users\\Lenovo\\zugzwang-backups\\prod";
const instanceId = process.argv[2];
// Production row counts as measured read-only at backup time (pg_stat live-tuple
// estimates, so ±a few rows on tables that were being written at that moment).
const SOURCE = {
	accounts: 607,
	admin_events: 0,
	admin_sessions: 0,
	bet_receipts: 3168,
	bets: 3168,
	bookmarks: 0,
	comments: 3168,
	cron_alarms: 0,
	dharma_ledger: 4412,
	events: 10074,
	identity_pool: 19904,
	image_uploads: 292,
	liquidity_heartbeat: 16228,
	liquidity_policy: 2,
	lots: 3168,
	market_media: 12,
	markets: 6,
	mod_actions: 0,
	payout_events: 0,
	pools: 6,
	positions: 1134,
	resolution_events: 0,
	sessions: 725,
	system_state: 1,
	user_events: 0,
	users: 621,
	verifications: 0,
	watermark_state: 2,
}; // exact for the EXACT set (counted in the archive); pg_stat estimates elsewhere
const EXACT = [
	"bets",
	"comments",
	"lots",
	"bet_receipts",
	"dharma_ledger",
	"positions",
	"markets",
	"pools",
	"users",
	"market_media",
	"system_state",
	"liquidity_policy",
	"identity_pool",
	"events",
]; // append-only / static tables: must match exactly

const aws = (a) => {
	const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 200));
	return r.stdout;
};
const rows = [];
let ok = true;
const check = (label, pass, detail) => {
	rows.push([pass ? "PASS" : "FAIL", label, detail]);
	if (!pass) ok = false;
};

(async () => {
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
	if (!/staging/.test(u.hostname) || /supabase|prod/i.test(u.hostname)) {
		console.log("refusing: not the staging RDS");
		process.exit(2);
	}
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
				host: [u.hostname],
				portNumber: ["5432"],
				localPortNumber: [String(LOCAL_PORT)],
			}),
		],
		{
			env: { ...process.env, PATH: PLUGIN_DIR + ";" + process.env.PATH },
			stdio: "ignore",
		},
	);
	const stop = () => {
		try {
			spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		} catch {}
	};
	process.on("exit", stop);
	await new Promise((r) => setTimeout(r, 6000));
	const envFile = path.join(os.tmpdir(), `zz-verify-${process.pid}.env`);
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
		].join("\n") + "\n",
		{ mode: 0o600 },
	);
	process.on("exit", () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	});
	const q = (sqlText) => {
		const r = spawnSync(
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
		return { out: r.stdout.trim(), err: r.stderr.trim(), status: r.status };
	};
	const Q = (s) => {
		const r = q(s);
		if (r.status !== 0) throw new Error(r.err.slice(0, 200));
		return r.out;
	};

	// ── schema ──
	const counts = Object.fromEntries(
		Q(
			"select relname||'='||n_live_tup from pg_stat_user_tables where schemaname='public'",
		)
			.split("\n")
			.filter(Boolean)
			.map((l) => l.split("=")),
	);
	const exact = Q(
		"select 'x' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')",
	)
		.split("\n")
		.filter(Boolean).length;
	check("41 relations in public", exact === 41, `${exact}`);
	check(
		"13 events partitions",
		Q(
			"select count(*) from pg_inherits i join pg_class p on p.oid=i.inhparent where p.relname='events'",
		) === "13",
		"",
	);
	check(
		"82 user triggers in public (56 + 26 partition copies)",
		Q(
			"select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal",
		) === "82",
		"",
	);
	check(
		"all triggers ENABLED (none left disabled by the restore)",
		Q(
			"select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','drizzle') and not t.tgisinternal and t.tgenabled='D'",
		) === "0",
		"",
	);
	check(
		"13 functions in public",
		Q(
			"select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'",
		) === "13",
		"",
	);
	check(
		"35 foreign keys",
		Q(
			"select count(*) from pg_constraint where contype='f' and connamespace='public'::regnamespace",
		) === "35",
		"",
	);
	check(
		"133 indexes in public",
		Q("select count(*) from pg_indexes where schemaname='public'") === "133",
		"",
	);
	check(
		"4 sequences (public+drizzle)",
		Q(
			"select count(*) from pg_sequences where schemaname in ('public','drizzle')",
		) === "4",
		"",
	);
	// ── extensions & cron ──
	const ext = Q(
		"select string_agg(extname||'@'||extversion,' ' order by extname) from pg_extension",
	);
	check("pg_cron extension installed", /pg_cron@/.test(ext), ext);
	const jobs = Q(
		"select string_agg(jobname||'['||schedule||']'||case when active then '' else ' INACTIVE' end, ' ' order by jobname) from cron.job",
	);
	check(
		"4 cron jobs registered and active",
		(jobs.match(/\[/g) || []).length === 4 && !/INACTIVE/.test(jobs),
		jobs,
	);
	const lastRun = Q(
		"select coalesce(max(start_time)::text,'never') from cron.job_run_details",
	);
	check(
		"cron has executed on this database",
		lastRun !== "never",
		`last run ${lastRun}`,
	);
	check(
		"cron.database_name = zugzwang",
		Q("select current_setting('cron.database_name')") === "zugzwang",
		"",
	);
	// ── journal ──
	check(
		"32 migrations in the drizzle journal",
		Q('select count(*) from "drizzle"."__drizzle_migrations"') === "32",
		"",
	);
	// ── data ──
	const diffs = [];
	for (const [t, n] of Object.entries(SOURCE)) {
		const got = Number(
			Q(`select count(*) from public.${t === "events" ? "events" : t}`),
		);
		const mustMatch = EXACT.includes(t);
		const pass = mustMatch
			? got === n
			: Math.abs(got - n) <= Math.max(5, n * 0.02);
		if (!pass) diffs.push(`${t}: staging=${got} source≈${n}`);
	}
	check(
		"row counts match the ARCHIVE (exact on the 14 tables counted in it; ±2% where only a pg_stat estimate exists)",
		diffs.length === 0,
		diffs.join("; ") || "all tables",
	);
	check(
		"frozen_at preserved (null — experiment not frozen)",
		Q(
			"select coalesce(frozen_at::text,'null') from system_state where id='system'",
		) === "null",
		"",
	);
	check(
		"INV-2: no negative ledger balance",
		Q("select count(*) from dharma_ledger where balance_after < 0") === "0",
		"",
	);
	check(
		"I-LOT-SUM: Σ lots.surviving_shares = positions.quantity per (user,market,side)",
		Q(
			"select count(*) from (select p.user_id, p.market_id, p.side, p.quantity, coalesce(sum(l.surviving_shares),0) s from positions p left join lots l on l.user_id=p.user_id and l.market_id=p.market_id and l.side=p.side group by 1,2,3,4) x where quantity <> s",
		) === "0",
		"",
	);
	check(
		"every Open market carries a market.opened event (I-GENESIS)",
		Q(
			"select count(*) from markets m where m.status='Open' and not exists (select 1 from events e where e.aggregate_type='market' and e.aggregate_id=m.id and e.event_type='market.opened')",
		) === "0",
		"",
	);
	check(
		"sequence current values restored (dharma_ledger.seq ≥ max row)",
		Q(
			"select (select last_value from pg_sequences where sequencename like 'dharma_ledger_seq%' limit 1) >= (select max(seq) from dharma_ledger)",
		) === "t",
		"",
	);
	// ── behavioural: append-only is ARMED ──
	const del = q(
		"begin; delete from bets where id = (select id from bets limit 1); rollback;",
	);
	check(
		"a DELETE on bets is REJECTED by the append-only trigger (armed, not merely present)",
		del.status !== 0 && /append-only violation/.test(del.err),
		del.err.slice(0, 80),
	);
	const upd = q(
		"begin; update dharma_ledger set amount = amount where seq = (select min(seq) from dharma_ledger); rollback;",
	);
	check(
		"an UPDATE on dharma_ledger is REJECTED",
		upd.status !== 0 && /append-only violation/.test(upd.err),
		upd.err.slice(0, 80),
	);

	console.log("=== STAGING RESTORE VERIFICATION ===");
	for (const [s, l, d] of rows)
		console.log(`${s}  ${l}${d ? `\n        ${d}` : ""}`);
	console.log(
		`=== ${ok ? "ALL PASS" : "FAILURES PRESENT"} (${rows.filter((r) => r[0] === "PASS").length}/${rows.length}) ===`,
	);
	stop();
	process.exit(ok ? 0 : 1);
})().catch((e) => {
	console.log("error:", String(e.message).slice(0, 200));
	process.exit(1);
});
