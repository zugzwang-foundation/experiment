// STAGING-ONLY, READ-ONLY: what the authenticated bet test left in the database.
//   node staging-bet-check.cjs <instance-id> [--since <ISO timestamp>]
// Prints counts vs the restore baseline and the newest bet's full write spine
// (comment, lot, ledger row, events, position, receipt). No credentials printed.
const fs = require("node:fs"),
	os = require("node:os"),
	path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const AWS = "C:/Program Files/Amazon/AWSCLIV2/aws.exe",
	PLUGIN_DIR = "C:\\Program Files\\Amazon\\SessionManagerPlugin\\bin";
const REGION = "ap-south-1",
	SECRET = "zugzwang/staging",
	LOCAL_PORT = 15432;
const BASE = {
	bets: 3168,
	comments: 3168,
	lots: 3168,
	bet_receipts: 3168,
	dharma_ledger: 4412,
	positions: 1134,
	users: 621,
	sessions: 725,
	events: 10074,
};
const instanceId = process.argv[2];
const sinceIdx = process.argv.indexOf("--since");
const since = sinceIdx > 0 ? process.argv[sinceIdx + 1] : null;
const aws = (a) => {
	const r = spawnSync(AWS, ["--region", REGION, ...a], { encoding: "utf8" });
	if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 200));
	return r.stdout;
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
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	let log = "";
	tunnel.stdout.on("data", (d) => {
		log += d;
	});
	tunnel.stderr.on("data", (d) => {
		log += d;
	});
	const stop = () => {
		try {
			spawnSync("taskkill", ["/PID", String(tunnel.pid), "/T", "/F"], {
				stdio: "ignore",
			});
		} catch {}
	};
	process.on("exit", stop);
	for (
		let i = 0;
		i < 20 && !/Port [0-9]+ opened|Waiting for connections/.test(log);
		i++
	)
		await new Promise((r) => setTimeout(r, 1000));
	const envFile = path.join(os.tmpdir(), `zz-betcheck-${process.pid}.env`);
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
			`PGOPTIONS=-c default_transaction_read_only=on`,
		].join("\n") + "\n",
		{ mode: 0o600 },
	);
	process.on("exit", () => {
		try {
			fs.rmSync(envFile, { force: true });
		} catch {}
	});
	const Q = (s) => {
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
				"-F",
				" | ",
				"-c",
				s,
			],
			{ encoding: "utf8" },
		);
		if (r.status !== 0) throw new Error(r.stderr.trim().slice(0, 200));
		return r.stdout.trim();
	};

	console.log("=== COUNTS vs restore baseline ===");
	for (const [t, n] of Object.entries(BASE)) {
		const got = Number(Q(`select count(*) from public.${t}`));
		console.log(
			`  ${t.padEnd(14)} ${String(got).padStart(6)}  (baseline ${n}, Δ ${got - n >= 0 ? "+" : ""}${got - n})`,
		);
	}
	console.log("=== newest bet — the full write spine ===");
	console.log(
		"  bet:      " +
			Q(
				"select b.id, b.side, b.stake, b.share_quantity, b.price_at_bet, b.created_at, m.slug, u.pseudonym from bets b join markets m on m.id=b.market_id join users u on u.id=b.user_id order by b.created_at desc limit 1",
			),
	);
	console.log(
		"  comment:  " +
			Q(
				"select c.id, c.side_at_post_time, left(c.body, 60), c.parent_comment_id is not null as is_reply from comments c where c.id = (select comment_id from bets order by created_at desc limit 1)",
			),
	);
	console.log(
		"  lot:      " +
			Q(
				"select id, surviving_shares, surviving_basis from lots where bet_id = (select id from bets order by created_at desc limit 1)",
			),
	);
	console.log(
		"  ledger:   " +
			Q(
				"select seq, entry_type, amount, balance_after from dharma_ledger where bet_id = (select id from bets order by created_at desc limit 1) order by seq",
			),
	);
	console.log(
		"  receipt:  " +
			Q(
				"select flow, left(idempotency_key, 12) || '…', created_at from bet_receipts where user_id = (select user_id from bets order by created_at desc limit 1) order by created_at desc limit 1",
			),
	);
	console.log(
		"  position: " +
			Q(
				"select side, quantity, updated_at from positions where user_id = (select user_id from bets order by created_at desc limit 1) and market_id = (select market_id from bets order by created_at desc limit 1)",
			),
	);
	console.log(
		"  events:   " +
			Q(
				"select string_agg(event_type || '@' || to_char(created_at, 'HH24:MI:SS'), ', ' order by created_at) from events where created_at >= (select created_at - interval '2 seconds' from bets order by created_at desc limit 1)",
			),
	);
	console.log(
		"  pool:     " +
			Q(
				"select yes_reserves, no_reserves from pools where market_id = (select market_id from bets order by created_at desc limit 1)",
			),
	);
	if (since) {
		console.log(`=== everything written since ${since} ===`);
		console.log(
			"  " +
				Q(
					`select 'bets='||(select count(*) from bets where created_at >= '${since}') || ' comments='||(select count(*) from comments where created_at >= '${since}') || ' ledger='||(select count(*) from dharma_ledger where created_at >= '${since}') || ' events='||(select count(*) from events where created_at >= '${since}') || ' sessions='||(select count(*) from sessions where created_at >= '${since}') || ' users='||(select count(*) from users where created_at >= '${since}')`,
				),
		);
	}
	if (process.argv.includes("--deep")) {
		const SEP = "', ' || "; // separator built in SQL, so no JS escape sequences are needed
		console.log("=== all events since the pre-test timestamp ===");
		console.log(
			"  " +
				Q(
					"select string_agg(event_type || ' [' || aggregate_type || '] @' || to_char(created_at,'HH24:MI:SS.MS'), ', ' order by created_at, event_id) from events where created_at >= '" +
						since +
						"'",
				),
		);
		console.log("=== ledger chain for the newest bettor ===");
		console.log(
			"  " +
				Q(
					"select string_agg(seq || ' ' || entry_type || ' ' || amount || ' -> ' || balance_after, ' ; ' order by seq) from dharma_ledger where user_id = (select user_id from bets order by created_at desc limit 1)",
				),
		);
		console.log(
			"  chain consistent (balance_after = previous + amount): " +
				Q(
					"select bool_and(balance_after = prev + amount) from (select amount, balance_after, lag(balance_after) over (order by seq) prev from dharma_ledger where user_id = (select user_id from bets order by created_at desc limit 1)) x where prev is not null",
				),
		);
		console.log("=== both new bets ===");
		console.log(
			"  " +
				Q(
					"select string_agg(b.side || ' D' || b.stake || ' shares=' || round(b.share_quantity,4) || ' price=' || round(b.price_at_bet,4) || ' reply=' || (c.parent_comment_id is not null) || ' body=' || left(c.body,20), ' ; ' order by b.created_at) from bets b join comments c on c.id=b.comment_id where b.created_at >= '" +
						since +
						"'",
				),
		);
		console.log("=== new user / onboarding ===");
		console.log(
			"  " +
				Q(
					"select pseudonym || ' tos_accepted=' || (tos_accepted_at is not null) || ' created=' || to_char(created_at,'HH24:MI:SS') from users where created_at >= '" +
						since +
						"'",
				),
		);
		console.log(
			"  identity_pool rows consumed since: " +
				Q(
					"select count(*) from identity_pool where consumed_at >= '" +
						since +
						"'",
				),
		);
		console.log(
			"=== reserves recorded in the two bet.placed payloads (yes / no) ===",
		);
		console.log(
			"  " +
				Q(
					"select string_agg(coalesce(payload->'reserves'->>'yes', payload->'pool'->>'yes', '?') || ' / ' || coalesce(payload->'reserves'->>'no', payload->'pool'->>'no', '?'), ' ; ' order by created_at) from events where event_type='bet.placed' and created_at >= '" +
						since +
						"'",
				),
		);
	}
	console.log("=== invariants still hold ===");
	console.log(
		"  INV-1 bets==comments: " +
			Q(
				"select (select count(*) from bets) = (select count(*) from comments where id in (select comment_id from bets))",
			),
	);
	console.log(
		"  INV-2 no negative balance: " +
			Q("select count(*) = 0 from dharma_ledger where balance_after < 0"),
	);
	console.log(
		"  I-LOT-SUM: " +
			Q(
				"select count(*) = 0 from (select p.user_id, p.market_id, p.side, p.quantity, coalesce(sum(l.surviving_shares),0) s from positions p left join lots l on l.user_id=p.user_id and l.market_id=p.market_id and l.side=p.side group by 1,2,3,4) x where quantity <> s",
			),
	);
	stop();
	process.exit(0);
})().catch((e) => {
	console.log("error:", String(e.message).slice(0, 200));
	process.exit(1);
});
