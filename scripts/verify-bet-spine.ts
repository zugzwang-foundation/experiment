/**
 * VERIFY BET SPINE — did the whole W-1 write actually land, or only part of it?
 *
 * Given a bet (the newest by default, or `--bet=<uuid>`), asserts that every row
 * the atomic bet+comment transaction is supposed to produce exists and agrees:
 * the comment, the durable receipt, the lot, the ledger debit, the position, and
 * the events.
 *
 * ⚠ IT ASSERTS THE SPINE, NOT THE BET ROW. A `bets` row on its own proves almost
 * nothing — a bet without its receipt, its lot or its ledger entry is a PARTIAL
 * WRITE, which under INV-1 is precisely the failure atomicity exists to make
 * impossible. Checking that the bet exists would pass in exactly the case worth
 * catching. So each leg is checked separately and reported separately.
 *
 * ⚠ NAMED DOWNSTREAM CALLER: **S-5**. After the S-1 flip a saturated pool queues
 * rather than erroring (W-10), and a request that outlives its idempotency
 * sentinel can be retried while the original is still in flight (ADR-0038 P1.4).
 * Neither shows up as an error. This is how a run checks that what it thinks it
 * wrote is what is actually there.
 *
 * ── HOW TO RUN ───────────────────────────────────────────────────────────────
 *
 *   doppler run --project zugzwang-experiment --config stg -- \
 *     pnpm tsx scripts/verify-bet-spine.ts
 *
 *   … scripts/verify-bet-spine.ts --bet=<uuid>     # a specific bet
 *
 * Optional delta table — set ALL SIX or none:
 *   BASE_BETS · BASE_COMMENTS · BASE_RECEIPTS · BASE_LOTS · BASE_LEDGER · BASE_EVENTS
 *
 * ⚠ THE BASELINES HAVE NO DEFAULTS, DELIBERATELY. An earlier version carried the
 * counts from one afternoon on staging as literals. A default baseline is a claim
 * about a database's contents at a moment that has passed — it goes stale in
 * minutes, and a stale delta is worse than no delta because it looks like a
 * measurement. Measure them yourself immediately before the run, or omit them and
 * read the spine verdict, which is self-contained.
 *
 * ── WHY THIS DOES NOT REFUSE `:6543` (and `sample-backend-activity.ts` does) ──
 *
 * That script OBSERVES a pooler, so reaching the database through the pooler
 * under test would make it unable to tell subject from instrument. This one reads
 * ROWS, and a row is the same row through either pooler. The asymmetry is
 * deliberate; do not "align" them.
 *
 * It does not use the shipped `@/db` client either — same reason as its sibling
 * (AGENTS.md §7: a tsx script inlines its own `postgres()` client).
 */

import postgres from "postgres";

const BASE_KEYS = [
	"BASE_BETS",
	"BASE_COMMENTS",
	"BASE_RECEIPTS",
	"BASE_LOTS",
	"BASE_LEDGER",
	"BASE_EVENTS",
] as const;

/** Refuse a target nobody ratified, BEFORE the first statement. Exit 2 on refusal. */
function resolveTarget(): string {
	const url = process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");

	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!fragment) {
		throw new Error(
			"STAGING_PROJECT_REF_FRAGMENT is not set; cannot verify the target is staging. " +
				"Run via: doppler run --project zugzwang-experiment --config stg -- …",
		);
	}
	if (!url.includes(fragment)) {
		throw new Error(
			"DATABASE_URL does not contain STAGING_PROJECT_REF_FRAGMENT; refusing to run. " +
				"This is the wrong-target case — check the Doppler config (stg, never prd).",
		);
	}

	const env = process.env.ZUGZWANG_ENV;
	if (env !== "staging" && env !== "preview") {
		throw new Error(
			`ZUGZWANG_ENV is ${env === undefined ? "unset" : `"${env}"`}; this script runs against staging or preview only. Refusing rather than guessing.`,
		);
	}
	return url;
}

async function main(): Promise<void> {
	const url = resolveTarget();
	const sql = postgres(url, { max: 1, idle_timeout: 20, prepare: false });

	try {
		const betArg = process.argv
			.find((a) => a.startsWith("--bet="))
			?.slice("--bet=".length);

		const [bet] = betArg
			? await sql`
          SELECT b.id, b.user_id, b.market_id, u.pseudonym, m.slug, b.side, b.stake,
                 b.share_quantity, b.price_at_bet, b.comment_id, b.idempotency_key, b.created_at
            FROM bets b JOIN users u ON u.id = b.user_id JOIN markets m ON m.id = b.market_id
           WHERE b.id = ${betArg}`
			: await sql`
          SELECT b.id, b.user_id, b.market_id, u.pseudonym, m.slug, b.side, b.stake,
                 b.share_quantity, b.price_at_bet, b.comment_id, b.idempotency_key, b.created_at
            FROM bets b JOIN users u ON u.id = b.user_id JOIN markets m ON m.id = b.market_id
           ORDER BY b.created_at DESC LIMIT 1`;

		if (!bet) {
			console.log(
				betArg ? `no bet with id ${betArg}` : "no bets in this database",
			);
			process.exitCode = 2;
			return;
		}

		// Optional delta table. All six or none — a partial baseline reports some
		// tables against a measured number and others against nothing, which reads
		// like a finding rather than a gap.
		const provided = BASE_KEYS.filter((k) => process.env[k] !== undefined);
		if (provided.length > 0 && provided.length < BASE_KEYS.length) {
			throw new Error(
				`baseline is partial: ${provided.length}/${BASE_KEYS.length} set (${provided.join(", ")}). Set all six or none.`,
			);
		}
		if (provided.length === BASE_KEYS.length) {
			const [now] = await sql`
        SELECT (SELECT count(*) FROM bets) AS bets,
               (SELECT count(*) FROM comments) AS comments,
               (SELECT count(*) FROM bet_receipts) AS receipts,
               (SELECT count(*) FROM lots) AS lots,
               (SELECT count(*) FROM dharma_ledger) AS ledger,
               (SELECT count(*) FROM events) AS events`;
			console.log("== DELTAS vs supplied baseline ==");
			console.table(
				BASE_KEYS.map((k) => {
					const table = k.replace("BASE_", "").toLowerCase();
					const base = Number(process.env[k]);
					const val = Number((now as Record<string, string>)[table]);
					return { table, base, now: val, delta: val - base };
				}),
			);
			console.log("");
		}

		console.log("== BET UNDER TEST ==");
		console.log(JSON.stringify(bet, null, 2));

		const spine = {
			comment:
				await sql`SELECT id, side_at_post_time, bet_id, parent_comment_id, length(body) AS body_len, created_at FROM comments WHERE id = ${bet.comment_id as string}`,
			receipt:
				await sql`SELECT idempotency_key, flow, created_at FROM bet_receipts WHERE idempotency_key = ${bet.idempotency_key as string}`,
			lot: await sql`SELECT id, bet_id, side, original_shares, surviving_shares, original_basis, surviving_basis FROM lots WHERE bet_id = ${bet.id as string}`,
			ledger:
				await sql`SELECT seq, entry_type, amount, balance_after FROM dharma_ledger WHERE bet_id = ${bet.id as string} ORDER BY seq`,
			position:
				await sql`SELECT side, quantity, updated_at FROM positions WHERE user_id = ${bet.user_id as string} AND market_id = ${bet.market_id as string}`,
			events:
				await sql`SELECT event_type, created_at FROM events WHERE metadata->>'idempotency_key' = ${bet.idempotency_key as string} ORDER BY created_at`,
		};

		console.log("\n== SPINE ==");
		for (const [k, v] of Object.entries(spine)) {
			console.log(`\n-- ${k} (${v.length} row${v.length === 1 ? "" : "s"})`);
			if (v.length) console.table(v);
		}

		const checks: Array<[string, boolean]> = [
			["comment row exists", spine.comment.length === 1],
			[
				"comment side == bet side",
				spine.comment[0]?.side_at_post_time === bet.side,
			],
			["durable receipt exists (I-IDEM-ONCE-001)", spine.receipt.length === 1],
			["exactly one lot minted (ADR-0039)", spine.lot.length === 1],
			["lot side == bet side", spine.lot[0]?.side === bet.side],
			[
				"bet_stake ledger row exists (INV-2)",
				spine.ledger.some((r) => r.entry_type === "bet_stake"),
			],
			[
				// Positions are per (user, market, SIDE) — a user legitimately carries a
				// zero row on the side they sold out of, so "exactly one row" was never
				// the claim and an earlier version wrongly FAILed a healthy bet on it.
				"position row for the bet's side, quantity > 0",
				spine.position.some(
					(r) => r.side === bet.side && Number(r.quantity) > 0,
				),
			],
			[
				"bet.placed + comment.placed events",
				spine.events.some((e) => e.event_type === "bet.placed") &&
					spine.events.some((e) => e.event_type === "comment.placed"),
			],
		];

		console.log("\n== SPINE VERDICT ==");
		for (const [label, ok] of checks) {
			console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
		}
		const spineOk = checks.every(([, ok]) => ok);

		// I-LOT-SUM-001 (ADR-0039 R2) against the LIVE database.
		//
		// ⚠ The on-disk invariant spec seeds its own rows into a local ephemeral
		// Postgres and truncates after — so it proves the RULE and observes no live
		// environment. AGENTS.md §9 records that a live Σ check is owed. This is it.
		console.log(
			"\n== I-LOT-SUM-001, LIVE (Σ lots.surviving_shares == positions.quantity) ==",
		);
		const drift = await sql`
      SELECT u.pseudonym, m.slug, p.side, p.quantity,
             coalesce(sum(l.surviving_shares), 0) AS lot_sum,
             p.quantity - coalesce(sum(l.surviving_shares), 0) AS drift
        FROM positions p
        JOIN users u ON u.id = p.user_id
        JOIN markets m ON m.id = p.market_id
        LEFT JOIN lots l ON l.user_id = p.user_id AND l.market_id = p.market_id AND l.side = p.side
       GROUP BY u.pseudonym, m.slug, p.side, p.quantity
       ORDER BY abs(p.quantity - coalesce(sum(l.surviving_shares), 0)) DESC`;
		console.table(drift);
		const noDrift = drift.every((r) => Number(r.drift) === 0);
		console.log(
			noDrift
				? `PASS  no drift on any of ${drift.length} (user, market, side)`
				: "FAIL  lot sum drifts from position quantity",
		);

		console.log("");
		if (spineOk && noDrift) {
			console.log(
				`✅ PASS — the full W-1 spine landed for bet ${bet.id as string}.`,
			);
			return;
		}
		console.log(
			"⛔ FAIL — see the rows above. A partial write is an INV-1 matter,",
		);
		console.log("  not a tuning note. Do not record the bet as successful.");
		process.exitCode = 1;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main().catch((err: unknown) => {
	console.error("[verify-bet-spine]", err);
	// 2 = could not answer (refused, or broke). 1 is reserved for a spine that
	// was checked and found incomplete.
	process.exitCode = 2;
});
