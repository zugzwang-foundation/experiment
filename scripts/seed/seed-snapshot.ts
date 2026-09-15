/**
 * SEED-DEPTH2 — the PRE-SEED snapshot that `seed-cleanup.ts` restores against.
 *
 * ⚠ TEST BRANCH ONLY. Read `scripts/seed/_cleanup-lib.ts`'s header first.
 *
 * READ-ONLY: one `REPEATABLE READ READ ONLY` transaction, so every figure is one
 * consistent picture at T0 (the transaction's `now()`). It records, per public
 * table, the row count and the sorted md5 of every row's text — which is what
 * lets the cleanup prove, inside its own transaction, that each table is back to
 * exactly this state — plus the pools, markets, watermarks, alarm and heartbeat
 * high-water marks, sequences, the guard catalogue, the liquidity policy in
 * force, the identity pool's free count, and a fingerprint of this database.
 *
 * Take it IMMEDIATELY before the seed run. Anything written between the snapshot
 * and the cleanup that is not the seed run makes the cleanup refuse.
 *
 *   pnpm exec tsx scripts/seed/seed-snapshot.ts --env local --out ../seed-runs/x/snapshot-local.json
 *   doppler run --project zugzwang-experiment --config stg -- pnpm exec tsx scripts/seed/seed-snapshot.ts --env staging --out …
 *   doppler run --project zugzwang-experiment --config prd -- pnpm exec tsx scripts/seed/seed-snapshot.ts --env prod --ack-production --out …
 *
 * Flags: --env local|staging|prod (REQUIRED, no default) · --out <file.json>
 * (REQUIRED, outside the repository, never overwritten) · --ack-production (prod).
 */
import { existsSync, writeFileSync } from "node:fs";

import {
	describeTarget,
	die,
	flag,
	guardProblems,
	openTarget,
	outsideRepo,
	PROD_ACK_FLAG,
	readSnapshot,
	resolveCleanupTarget,
	type Snapshot,
} from "./_cleanup-lib";

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	const out = outsideRepo(
		flag(argv, "--out") ?? die("--out is required"),
		"--out",
	);
	const target = resolveCleanupTarget(flag(argv, "--env"), process.env, {
		ackProduction: argv.includes(PROD_ACK_FLAG),
	});
	if (!target.ok) die(target.reason);

	// Refuse to overwrite: a snapshot replaced after the seed ran would bless the seed.
	if (existsSync(out))
		die(`${out} already exists; a snapshot is never overwritten`);

	const sql = await openTarget(target);
	let snapshot: Snapshot;
	try {
		snapshot = await sql.begin(
			"isolation level repeatable read read only",
			(tx) => readSnapshot(tx, target.mode, describeTarget(target)),
		);
	} finally {
		await sql.end({ timeout: 10 });
	}

	// "wx" again at write time: never replace a file that appeared meanwhile.
	writeFileSync(out, `${JSON.stringify(snapshot)}\n`, { flag: "wx" });

	const problems = guardProblems(snapshot.guards);
	const frozen = snapshot.systemState.some((r) => r.frozen_at !== null);
	console.log(
		[
			`[seed-snapshot] ${describeTarget(target)}`,
			`  T0              ${snapshot.takenAt}`,
			`  file            ${out}`,
			`  tables          ${Object.keys(snapshot.tables).length} · rows ${Object.values(snapshot.tables).reduce((n, t) => n + t.count, 0)}`,
			`  events          ${snapshot.events.count} (max created_at ${snapshot.events.maxCreatedAt})`,
			`  pools           ${snapshot.pools.length} · markets ${snapshot.markets.length}`,
			`  identity pool   ${snapshot.identityPool.free} free of ${snapshot.identityPool.total}`,
			`  dharma seq max  ${snapshot.dharmaLedgerMaxSeq}`,
			`  liquidity       ${snapshot.liquidityPolicyInForce ? `v${snapshot.liquidityPolicyInForce.version} enabled=${snapshot.liquidityPolicyInForce.enabled}` : "(no policy in force)"}`,
			`  guards          ${snapshot.guards.bucketCount} bucket_% · lots_no_delete=${snapshot.guards.lotsNoDelete}${problems.length ? ` · ⚠ ${problems.join("; ")}` : " · all enabled"}`,
			`  freeze          ${frozen ? "⚠ SET — a cleanup will refuse" : "not set"}`,
			`  seed markers    ${snapshot.seedMarkers.accountIds.length} dummy accounts · receipt prefixes ${snapshot.seedMarkers.receiptKeyPrefixes.join(", ") || "none"}`,
			`  I-LOT-SUM       ${snapshot.lotSumViolations} violation(s) · dangling event refs ${snapshot.danglingEventRefs}`,
		].join("\n"),
	);
}

void main().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
