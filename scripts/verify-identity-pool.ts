/**
 * Post-seed verification for `identity_pool` per SCAFFOLD.17 plan §C +
 * PSEUDONYM.md §10.3 (decision name; substance per ADR-0011 + SPEC.1 §13
 * F-AUTH-3 step 4). Runs four checks:
 *
 *   1. Row count = 50,000.
 *   2. Uniqueness — 50,000 distinct (colour, animal, number) tuples.
 *   3. R2 object count: logs expected 50,000 for operator out-of-band
 *      side-by-side comparison (PFP bucket IAM token does NOT have LIST
 *      permission per ADR-0011 + SCAFFOLD.15 plan §5.1).
 *   4. R2 HEAD spot-check: 20 deterministic samples derived from
 *      SHA-256("verify-identity-pool/v1/<i>") mapped to [0, 50000).
 *      Sequential `headObject("pfp", "v1/${pfp_filename}")` per sample;
 *      asserts no throw + contentType === "image/webp".
 *
 * Output: plain text PASS/FAIL per check. Exit 0 on all-pass / 1 on any-fail
 * (per plan Q3).
 *
 * Run via `pnpm verify:identity-pool` (see package.json).
 */

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

const EXPECTED_TOTAL = 50_000;
const SAMPLE_N = 20;
const SAMPLE_SEED = "verify-identity-pool/v1";

function deterministicSampleIndices(n: number, max: number): number[] {
	const indices: number[] = [];
	for (let i = 0; i < n; i++) {
		const h = createHash("sha256").update(`${SAMPLE_SEED}/${i}`).digest();
		indices.push(h.readUInt32BE(0) % max);
	}
	return indices;
}

async function main(): Promise<never> {
	const { db } = await import("@/db");
	const { headObject } = await import("@/server/storage/r2");

	let allPass = true;

	// Check 1: row count.
	const countRows = (await db.execute(
		sql`SELECT count(*)::int AS c FROM identity_pool`,
	)) as unknown as Array<{ c: number }>;
	const rowCount = countRows[0]?.c ?? 0;
	if (rowCount === EXPECTED_TOTAL) {
		console.log(`[verify-identity-pool] PASS: row count = ${rowCount}`);
	} else {
		console.error(
			`[verify-identity-pool] FAIL: row count = ${rowCount}, expected ${EXPECTED_TOTAL}`,
		);
		allPass = false;
	}

	// Check 2: uniqueness on (colour, animal, number).
	const distinctRows = (await db.execute(
		sql`SELECT count(*)::int AS c FROM (
			SELECT DISTINCT colour, animal, number FROM identity_pool
		) sub`,
	)) as unknown as Array<{ c: number }>;
	const distinctCount = distinctRows[0]?.c ?? 0;
	if (distinctCount === EXPECTED_TOTAL) {
		console.log(
			`[verify-identity-pool] PASS: uniqueness — ${distinctCount} distinct (colour, animal, number) tuples`,
		);
	} else {
		console.error(
			`[verify-identity-pool] FAIL: uniqueness — ${distinctCount} distinct tuples, expected ${EXPECTED_TOTAL}`,
		);
		allPass = false;
	}

	// Check 3: R2 object count (out-of-band).
	console.log(
		`[verify-identity-pool] INFO: expected R2 object count = ${EXPECTED_TOTAL} (verify out-of-band via R2 dashboard — IAM token lacks LIST per ADR-0011)`,
	);

	// Check 4: R2 HEAD spot-check (20 deterministic samples).
	const indices = deterministicSampleIndices(SAMPLE_N, EXPECTED_TOTAL);
	let headPass = 0;
	const headFailures: string[] = [];
	for (const idx of indices) {
		const pfRows = (await db.execute(
			sql`SELECT pfp_filename FROM identity_pool ORDER BY id LIMIT 1 OFFSET ${idx}`,
		)) as unknown as Array<{ pfp_filename: string }>;
		const pfpFilename = pfRows[0]?.pfp_filename;
		if (!pfpFilename) {
			headFailures.push(`idx ${idx}: no row at OFFSET ${idx}`);
			continue;
		}
		const key = `v1/${pfpFilename}`;
		try {
			const meta = await headObject("pfp", key);
			if (meta.contentType === "image/webp") {
				headPass += 1;
			} else {
				headFailures.push(
					`${key}: contentType = "${meta.contentType ?? "(missing)"}", expected "image/webp"`,
				);
			}
		} catch (err) {
			headFailures.push(`${key}: ${(err as Error).message}`);
		}
	}
	if (headFailures.length === 0) {
		console.log(
			`[verify-identity-pool] PASS: ${headPass}/${SAMPLE_N} R2 HEAD spot-checks (image/webp)`,
		);
	} else {
		console.error(
			`[verify-identity-pool] FAIL: R2 HEAD spot-check — ${headPass}/${SAMPLE_N} PASS, ${headFailures.length} FAIL`,
		);
		for (const f of headFailures) {
			console.error(`[verify-identity-pool]   - ${f}`);
		}
		allPass = false;
	}

	if (allPass) {
		console.log("[verify-identity-pool] all checks passed");
		process.exit(0);
	}
	console.error("[verify-identity-pool] one or more checks FAILED");
	process.exit(1);
}

void main();
