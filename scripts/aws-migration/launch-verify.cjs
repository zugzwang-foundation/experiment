// LAUNCH-DB-COPY-1 — the last reading before production opens
// (docs/plans/LAUNCH-DB-COPY-1.md §6, runbook step 13). READ-ONLY.
//
//   node scripts/aws-migration/launch-verify.cjs <prod-ecs-instance-id> <zugzwang-staging-<stamp>.dump.manifest.json> --account=<12-digit id>
//
// It writes nothing: no job pause, no trigger toggle, no temporary table, no
// object in any bucket. Its database session runs with
// default_transaction_read_only=on, so even a mistake here cannot change a row.
//
// What it checks, and why each matters:
//   1. every table's row count AND content fingerprint equals the staging
//      manifest — except the three session tables, which must be EMPTY (a
//      surviving admin_sessions row would be a valid production admin login),
//      and the three pg_cron tables, whose drift is reported only;
//   2. the migration journal head equals the dump's;
//   3. the invariants, re-checked because the load ran with FK checks and user
//      triggers stood down — each statement returns 0 when it holds;
//   4. identity-pool headroom (reported; zero would break every new signup);
//   5. every storage object production's restored rows reference is present
//      in its production bucket (keys read from the database, not the report);
//   6. /api/health (prod, db ok, migrations ok, writes STILL paused), /api/ready, the home page and every market page answer 200.

const {
	ENVS,
	REGION,
	DB_NAME,
	assertEnvTarget,
	redact,
	parseSecret,
} = require("./lib/launch-common.cjs");
const { referencedObjects } = require("./launch-storage.cjs");
const {
	TABLE_LIST_SQL,
	countAndFingerprintSql,
	compareManifests,
} = require("./lib/fingerprint.cjs");

/** Each returns ONE count that is 0 when the invariant holds. */
const INVARIANT_SQL = {
	negativeBalance:
		"select count(*) from public.dharma_ledger where balance_after < 0",
	negativePosition: "select count(*) from public.positions where quantity < 0",
	twoHeldSides:
		"select count(*) from (select user_id, market_id from public.positions where quantity > 0 group by user_id, market_id having count(distinct side) > 1) as t",
	lotSumNotPosition:
		// FULL OUTER: a lot with no position row is as wrong as a position whose
		// lots do not sum to it.
		"select count(*) from public.positions as p full outer join (select user_id, market_id, side, sum(surviving_shares) as s from public.lots group by user_id, market_id, side) as l on l.user_id = p.user_id and l.market_id = p.market_id and l.side = p.side where coalesce(l.s, 0) <> coalesce(p.quantity, 0)",
	openMarketWithoutGenesisEvent:
		"select count(*) from public.markets as m where m.status = 'Open' and not exists (select 1 from public.events as e where e.event_type = 'market.opened' and e.aggregate_id = m.id)",
	frozenAtSet:
		"select count(*) from public.system_state where frozen_at is not null",
	duplicatePseudonym:
		"select count(*) from (select pseudonym from public.users group by pseudonym having count(*) > 1) as t",
	// The app reads exactly one system_state row; zero or two is a broken freeze.
	systemStateNotSingleton: "select abs(count(*) - 1) from public.system_state",
	// No policy row makes the liquidity injector fail closed, silently, forever.
	liquidityPolicyMissing:
		"select case when count(*) = 0 then 1 else 0 end from public.liquidity_policy",
	// @security-auditor M-1: the restore disables user triggers for the load;
	// this is the catalog proof that every append-only guard came back.
	triggersDisabled:
		"select count(*) from pg_trigger as t join pg_class as c on c.oid = t.tgrelid join pg_namespace as n on n.oid = c.relnamespace where n.nspname in ('public','drizzle') and not t.tgisinternal and t.tgenabled = 'D'",
	// INV-1's referential half: FK checks were suspended for the load.
	betWithoutComment:
		"select count(*) from public.bets as b left join public.comments as c on c.id = b.comment_id where c.id is null",
	// Staging-issued Google tokens must not survive into production (M-4).
	accountTokensPresent:
		"select count(*) from public.accounts where access_token is not null or refresh_token is not null or id_token is not null",
	// The ledger's identity must sit at or above every copied seq, or a
	// participant's first Dharma write collides (L-5). A missing sequence
	// counts every row, so a failed lookup is loud rather than silent.
	ledgerSequenceBehind:
		"select count(*) from public.dharma_ledger where seq > coalesce((select last_value from pg_sequences where format('%I.%I', schemaname, sequencename) = pg_get_serial_sequence('public.dharma_ledger', 'seq')), 0)",
};

/** Production's own rows, in the shape launch-storage's referencedObjects reads. */
const STORAGE_ROWS_SQL = {
	imageUploads:
		"select coalesce(json_agg(json_build_object('r2_object_key', r2_object_key)), '[]') from public.image_uploads",
	users:
		"select coalesce(json_agg(json_build_object('pfp_filename', pfp_filename)), '[]') from public.users",
	identityPool:
		"select coalesce(json_agg(json_build_object('pfp_filename', pfp_filename)), '[]') from public.identity_pool",
	marketMedia:
		"select coalesce(json_agg(json_build_object('r2_object_key', r2_object_key)), '[]') from public.market_media",
};

/** Headroom, not an invariant: zero is the BAD answer. */
const IDENTITY_POOL_SQL =
	"select count(*) from public.identity_pool where assigned_at is null";

/** The pages that must answer 200, in order. */
function httpChecks(baseUrl, slugs) {
	const base = String(baseUrl).replace(/\/+$/, "");
	return [
		{ url: `${base}/api/health`, expect: 200 },
		{ url: `${base}/api/ready`, expect: 200 },
		{ url: `${base}/`, expect: 200 },
		...slugs.map((s) => ({ url: `${base}/m/${s}`, expect: 200 })),
	];
}

async function main() {
	const fs = require("node:fs");
	const os = require("node:os");
	const path = require("node:path");
	const { spawn, spawnSync } = require("node:child_process");
	const { S3Client, HeadObjectCommand } = require("@aws-sdk/client-s3");
	const AWS = process.env.AWS_CLI || "aws";

	const argv = process.argv.slice(2);
	const [instanceId, manifestArg] = argv.filter((a) => !a.startsWith("--"));
	const account = (argv.find((a) => a.startsWith("--account=")) ?? "").slice(
		"--account=".length,
	);
	if (!/^i-[0-9a-f]{8,}$/.test(String(instanceId))) {
		throw new Error(`refusing: "${instanceId}" is not an EC2 instance id`);
	}
	if (!/^[0-9]{12}$/.test(account)) {
		throw new Error(
			"refusing: --account=<12-digit AWS account id> is required",
		);
	}
	const manifestFile = path.resolve(String(manifestArg));
	const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
	if (manifest.env !== "staging" || !/staging/.test(String(manifest.host))) {
		throw new Error("refusing: the manifest is not a staging dump manifest");
	}
	const storageFile = manifestFile.replace(
		/\.manifest\.json$/,
		".storage.json",
	);

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
	if (caller !== account) {
		throw new Error(
			`refusing: AWS credentials are for account ${caller}, not ${account}`,
		);
	}
	const sec = parseSecret(
		aws([
			"secretsmanager",
			"get-secret-value",
			"--secret-id",
			ENVS.prod.secret,
			"--query",
			"SecretString",
			"--output",
			"text",
		]),
	);
	const u = assertEnvTarget("prod", sec.DATABASE_URL);

	const results = [];
	let ok = true;
	const check = (label, pass, detail) => {
		results.push([pass ? "PASS" : "FAIL", label, detail]);
		if (!pass) ok = false;
	};

	// tunnel + a READ-ONLY session
	const port = 15437;
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
	const envFile = path.join(os.tmpdir(), `zz-launch-verify-${process.pid}.env`);
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
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
		);
		if (r.status !== 0) throw new Error(redact(r.stderr.trim().slice(0, 200)));
		return r.stdout.trim();
	};

	// 1. census vs the staging manifest
	const actual = {};
	for (const t of q(TABLE_LIST_SQL).split(/\r?\n/).filter(Boolean)) {
		const [count, md5] = q(countAndFingerprintSql(t)).split("|");
		actual[t] = { count: Number(count), md5 };
	}
	const cmp = compareManifests(manifest.tables, actual);
	for (const row of cmp.rows) {
		if (row.status !== "match") {
			console.log(
				`  ${row.status.padEnd(18)} ${row.table}  expected=${JSON.stringify(row.expected)} actual=${JSON.stringify(row.actual)}`,
			);
		}
	}
	check(
		"every table matches the staging manifest (sessions empty; cron drift reported)",
		cmp.pass,
		`${cmp.rows.filter((r) => r.status === "match").length}/${cmp.rows.length} match`,
	);

	// 2. migration head
	const journal = Number(
		q('select count(*) from "drizzle"."__drizzle_migrations"'),
	);
	check(
		"migration journal head equals the dump's",
		journal === Number(manifest.journal),
		`production=${journal} dump=${manifest.journal}`,
	);

	// 3. invariants
	for (const [name, sql] of Object.entries(INVARIANT_SQL)) {
		const n = Number(q(sql));
		check(`invariant ${name}`, n === 0, `count=${n}`);
	}

	// 4. identity-pool headroom (zero is the failure)
	const headroom = Number(q(IDENTITY_POOL_SQL));
	check(
		"identity pool has unassigned pseudonyms for new signups",
		headroom > 0,
		`unassigned=${headroom}`,
	);

	// 5. storage: every object PRODUCTION'S OWN ROWS reference is present in its
	// production bucket. The key list is derived from the restored database,
	// not read out of the storage tool's report — a report that parsed nothing
	// would otherwise vouch for itself (@security-auditor M-5). The report is
	// still required, and must say the copy was executed.
	if (!fs.existsSync(storageFile)) {
		check("storage copy report present", false, `${storageFile} not found`);
	} else {
		const storage = JSON.parse(fs.readFileSync(storageFile, "utf8"));
		check(
			"the storage copy was executed, not only checked",
			storage.executed === true,
			`executed=${storage.executed}`,
		);
	}
	const rows = (sql) => JSON.parse(q(sql) || "[]");
	const refs = referencedObjects(
		Object.fromEntries(
			Object.entries(STORAGE_ROWS_SQL).map(([k, sql]) => [k, rows(sql)]),
		),
	);
	const arms = { uploads: "UPLOADS", pfp: "PFP", marketMedia: "MARKET_MEDIA" };
	const missing = [];
	let looked = 0;
	for (const [family, keys] of Object.entries(refs)) {
		const arm = arms[family];
		const c = new S3Client({
			region: "auto",
			endpoint: sec[`R2_ENDPOINT_${arm}`],
			credentials: {
				accessKeyId: sec[`R2_ACCESS_KEY_ID_${arm}`],
				secretAccessKey: sec[`R2_SECRET_ACCESS_KEY_${arm}`],
			},
		});
		for (const key of keys) {
			looked += 1;
			try {
				await c.send(
					new HeadObjectCommand({ Bucket: sec[`R2_BUCKET_${arm}`], Key: key }),
				);
			} catch {
				missing.push(`${family}:${key}`);
			}
		}
	}
	check(
		"every storage object production's rows reference is present",
		missing.length === 0,
		`uploads=${refs.uploads.length} pfp=${refs.pfp.length} marketMedia=${refs.marketMedia.length} checked=${looked} missing=${missing.length}${missing.length ? ` e.g. ${missing.slice(0, 3).join(", ")}` : ""}`,
	);

	// 6. HTTP
	const slugs = q(
		"select string_agg(slug, ',' order by slug) from public.markets where status <> 'Draft'",
	)
		.split(",")
		.filter(Boolean);
	const base = String(sec.BETTER_AUTH_URL);
	for (const c of httpChecks(base, slugs)) {
		try {
			// /api/ready can lag a fresh task by a few seconds; retry before failing.
			let res = await fetch(c.url, { redirect: "manual" });
			for (let i = 0; i < 5 && res.status !== c.expect; i++) {
				await new Promise((r) => setTimeout(r, 3000));
				res = await fetch(c.url, { redirect: "manual" });
			}
			let detail = `status=${res.status}`;
			if (c.url.endsWith("/api/health") && res.ok) {
				const h = await res.json();
				detail += ` env=${h.env} db=${h.db} migrations=${h.migrations} writesPaused=${h.writesPaused} canary=${h.canary}`;
				check(
					"health reports prod, db ok, migrations ok, writes still paused",
					h.env === "prod" &&
						h.db === "ok" &&
						h.migrations === "ok" &&
						h.writesPaused === true,
					detail,
				);
				continue;
			}
			check(`GET ${c.url}`, res.status === c.expect, detail);
		} catch (e) {
			check(`GET ${c.url}`, false, String(e?.message ?? e).slice(0, 120));
		}
	}

	console.log("=== LAUNCH VERIFICATION (read-only) ===");
	for (const [s, l, d] of results) console.log(`${s}  ${l}\n        ${d}`);
	console.log(
		`=== RESULT: ${ok ? "ALL PASS" : "FAILED — do not open writes"} ===`,
	);
	console.log(
		"Manual, before opening writes: Google sign-in · email OTP sign-in · admin login (production password) · each market page · post, reply, image · bet and sell · profile, portfolio, export.",
	);
	stopTunnel();
	process.exit(ok ? 0 : 1);
}

module.exports = {
	INVARIANT_SQL,
	IDENTITY_POOL_SQL,
	STORAGE_ROWS_SQL,
	httpChecks,
};

if (require.main === module) {
	main().catch((e) => {
		console.error(redact(e?.message ? e.message : String(e)));
		process.exit(1);
	});
}
