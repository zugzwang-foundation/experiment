/**
 * Production seed for `identity_pool` per SCAFFOLD.17 plan §A + ADR-0011.
 * Ingests the external-dev image pipeline manifest (50K rows; CSV; 5 cols
 * `colour, animal, number, pseudonym, pfp_filename`) via chunked bulk-INSERT
 * with composite-key idempotency. Re-runs are safe — `ON CONFLICT (colour,
 * animal, number) DO NOTHING` makes the operation idempotent.
 *
 * Per-chunk transaction boundary (CHUNK_SIZE = 1000) per research brief R2:
 * 5 explicit columns × 1,000 = 5,000 binds, well under the 32,767 ceiling;
 * per-chunk isolation lets partial reruns degrade gracefully and avoids
 * long-running tx WAL bloat.
 *
 * Run via `pnpm seed:identity-pool:prod <manifest-path>` (see package.json).
 *
 * Exit codes:
 *   0 — success (manifest count = 50000 AND post-run table count >= 50000)
 *   1 — manifest parse error (file missing, malformed line, type coercion)
 *   2 — DB INSERT error (Drizzle / Postgres exception inside runSeed)
 *   3 — row-count mismatch (post-run table count not as expected)
 */

import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

import type { DbClient } from "@/db";
import { identityPool } from "@/db/schema";

const CHUNK_SIZE = 1_000;
const EXPECTED_TOTAL = 50_000;

type SeedRow = {
	colour: string;
	animal: string;
	number: number;
	pseudonym: string;
	pfpFilename: string;
};

export class ManifestParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ManifestParseError";
	}
}

function parseManifest(manifestPath: string): SeedRow[] {
	let raw: string;
	try {
		raw = readFileSync(manifestPath, "utf8");
	} catch (err) {
		throw new ManifestParseError(
			`failed to read manifest at ${manifestPath}: ${(err as Error).message}`,
		);
	}

	// No quoted commas, no embedded newlines — operator-owned constraint
	// on pipeline output (plan §A CSV shape). Empty lines (trailing newline)
	// are dropped; non-empty rows MUST be exactly 5 comma-separated fields.
	const lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
	if (lines.length < 1) {
		throw new ManifestParseError("manifest is empty (no header row)");
	}

	const header = lines[0];
	const expectedHeader = "colour,animal,number,pseudonym,pfp_filename";
	if (header !== expectedHeader) {
		throw new ManifestParseError(
			`unexpected header: got "${header}", expected "${expectedHeader}"`,
		);
	}

	const rows: SeedRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i] as string;
		const fields = line.split(",").map((f) => f.trim());
		if (fields.length !== 5) {
			throw new ManifestParseError(
				`row ${i + 1}: expected 5 fields, got ${fields.length} ("${line}")`,
			);
		}
		const [colour, animal, numberStr, pseudonym, pfpFilename] = fields as [
			string,
			string,
			string,
			string,
			string,
		];
		const numberParsed = Number.parseInt(numberStr, 10);
		// Reject NaN, non-finite, fractional, out-of-range. Use String(...)
		// re-stringify to catch "1abc"-shaped inputs that parseInt would
		// accept as 1.
		if (
			!Number.isInteger(numberParsed) ||
			numberParsed < 0 ||
			numberParsed > 999 ||
			String(numberParsed) !== numberStr
		) {
			throw new ManifestParseError(
				`row ${i + 1}: number must be an integer 0-999, got "${numberStr}"`,
			);
		}
		rows.push({
			colour,
			animal,
			number: numberParsed,
			pseudonym,
			pfpFilename,
		});
	}

	return rows;
}

function* chunked<T>(rows: T[], size: number): Generator<T[]> {
	for (let i = 0; i < rows.length; i += size) {
		yield rows.slice(i, i + size);
	}
}

export async function runSeed(
	manifestPath: string,
	db: DbClient,
): Promise<{ inserted: number; skipped: number; manifestRowCount: number }> {
	const rows = parseManifest(manifestPath);
	const manifestRowCount = rows.length;

	let inserted = 0;
	let skipped = 0;
	let chunkIdx = 0;
	const chunkTotal = Math.ceil(manifestRowCount / CHUNK_SIZE);

	for (const chunk of chunked(rows, CHUNK_SIZE)) {
		chunkIdx += 1;
		const returned = await db.transaction(async (tx) => {
			return await tx
				.insert(identityPool)
				.values(chunk)
				.onConflictDoNothing({
					target: [
						identityPool.colour,
						identityPool.animal,
						identityPool.number,
					],
				})
				.returning({ id: identityPool.id });
		});
		const chunkInserted = returned.length;
		const chunkSkipped = chunk.length - chunkInserted;
		inserted += chunkInserted;
		skipped += chunkSkipped;
		console.log(
			`[seed-identity-pool] chunk ${chunkIdx}/${chunkTotal}: inserted ${chunkInserted}, skipped (ON CONFLICT) ${chunkSkipped}, cumulative ${inserted}/${manifestRowCount}`,
		);
	}

	return { inserted, skipped, manifestRowCount };
}

async function main(): Promise<never> {
	const manifestPath = process.argv[2];
	if (!manifestPath) {
		console.error(
			"[seed-identity-pool] usage: tsx scripts/seed-identity-pool.ts <manifest-path>",
		);
		process.exit(1);
	}

	// Dynamic import keeps the production `db` client (max: 10 postgres-js
	// pool) out of the test runtime — tests import `runSeed` directly and
	// pass `testDb` from `tests/db/_fixtures/db.ts`.
	const { db } = await import("@/db");

	let result: Awaited<ReturnType<typeof runSeed>>;
	try {
		result = await runSeed(manifestPath, db);
	} catch (err) {
		if (err instanceof ManifestParseError) {
			console.error(
				`[seed-identity-pool] manifest parse error: ${err.message}`,
			);
			process.exit(1);
		}
		console.error("[seed-identity-pool] DB INSERT error:", err);
		process.exit(2);
	}

	console.log(
		`[seed-identity-pool] done — manifest ${result.manifestRowCount}, inserted ${result.inserted}, skipped (ON CONFLICT) ${result.skipped}`,
	);

	const countRows = (await db.execute(
		sql`SELECT count(*)::int AS c FROM identity_pool`,
	)) as unknown as Array<{ c: number }>;
	const tableCount = countRows[0]?.c ?? 0;
	console.log(`[seed-identity-pool] post-run table count: ${tableCount}`);

	if (
		result.manifestRowCount !== EXPECTED_TOTAL ||
		tableCount < EXPECTED_TOTAL
	) {
		console.error(
			`[seed-identity-pool] row-count mismatch: manifest ${result.manifestRowCount} (expected ${EXPECTED_TOTAL}), table ${tableCount} (expected >= ${EXPECTED_TOTAL})`,
		);
		process.exit(3);
	}

	process.exit(0);
}

// Only execute main() when invoked as CLI (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
	void main();
}
