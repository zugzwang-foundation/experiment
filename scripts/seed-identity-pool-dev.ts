/**
 * Dev seed for `identity_pool` per SCAFFOLD.3 plan §2 + Q2. Inserts one full pass over the identity grid for local development. Idempotent — `ON CONFLICT (colour, animal, number) DO NOTHING` makes re-runs no-ops.
 *
 * The vocabulary and the seed order both come from `@/server/identity-pool/rotation`, which is shared with `scripts/seed-staging.ts` and with the tests. Before PFP-1 this file hardcoded 20 colours x 10 animals invented before any render existed; 13 of those colours and 5 of those animals had no image, and one entry was not an animal.
 *
 * One pass over the grid is 13 x 67 = 871 tuples, every one of them backed by a render in the R2 `v1/` prefix.
 *
 * Run via: `pnpm seed:identity-pool:dev` (see package.json scripts).
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { generatePoolTuples } from "@/server/identity-pool/rotation";
import { ANIMALS, COLOURS } from "@/server/identity-pool/vocabulary";

// One full pass over the grid — every (colour, animal) pair exactly once.
const GRID_PASS = COLOURS.length * ANIMALS.length;

const rows = generatePoolTuples(GRID_PASS);

async function main(): Promise<void> {
	console.log(
		`[seed-identity-pool-dev] inserting ${rows.length} tuples (idempotent via ON CONFLICT)...`,
	);

	let inserted = 0;
	for (const row of rows) {
		const result = await db.execute(sql`
			INSERT INTO identity_pool (colour, animal, number, pseudonym, pfp_filename)
			VALUES (${row.colour}, ${row.animal}, ${row.number}, ${row.pseudonym}, ${row.pfpFilename})
			ON CONFLICT (colour, animal, number) DO NOTHING
			RETURNING id
		`);
		if ((result as unknown as Array<unknown>).length > 0) inserted += 1;
	}

	console.log(
		`[seed-identity-pool-dev] done — ${inserted} new rows, ${rows.length - inserted} already present`,
	);
	process.exit(0);
}

main().catch((err) => {
	console.error("[seed-identity-pool-dev] failed:", err);
	process.exit(1);
});
