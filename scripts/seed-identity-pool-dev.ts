/**
 * Dev seed for `identity_pool` per SCAFFOLD.3 plan §2 + Q2. Inserts one full pass over the identity grid for local development. Idempotent — `ON CONFLICT (colour, animal, number) DO NOTHING` makes re-runs no-ops.
 *
 * The vocabulary and the seed order both come from `@/server/identity-pool/rotation`, which is shared with `scripts/seed-staging.ts` and with the tests. Before PFP-1 this file hardcoded 20 colours x 10 animals invented before any render existed; 13 of those colours and 5 of those animals had no image, and one entry was not an animal.
 *
 * One pass over the grid is 13 x 67 = 871 tuples, every one of them backed by a render in the R2 `v1/` prefix.
 *
 * Run via: `pnpm seed:identity-pool:dev` (see package.json scripts).
 *
 * ⛔ THIS SCRIPT CONSTRUCTS ITS OWN `postgres()` CLIENT AND MUST NOT IMPORT `@/db`.
 * `src/db/index.ts:1` is `import "server-only"`, whose package exports map the
 * `default` condition to a module whose whole body is a `throw` — so under plain
 * `tsx` the import dies before a line of this file executes. It did: `pnpm
 * seed:identity-pool:dev` was broken on `main` from PFP-1 until this commit,
 * failing with *"This module cannot be imported from a Client Component module"*
 * — a message that names a Client Component, which this is not, and so reads as
 * anything but a missing bundler alias.
 *
 * ⚠ THE FIX IS THE CLIENT, NOT THE INVOCATION. `tsx --conditions=react-server`
 * also gets past `server-only`, and it is the wrong tool here: AGENTS.md §7 admits
 * that flag for exactly one narrow case — *a script whose subject IS the shipped
 * client* — and names a seeder in the same paragraph as the counter-example,
 * because a seeder needs *a* connection rather than *the* connection. Taking the
 * flag would have made this the second instance of a one-instance exception, and
 * would have coupled a dev seeder to the app's pool options for no benefit.
 *
 * ⚠ THE VOCABULARY IMPORTS ARE NOT THE PROBLEM AND STAY. `@/server/identity-pool/
 * rotation` and `.../vocabulary` are pure — neither imports `server-only` or
 * `@/db` (measured) — so they resolve cleanly under `tsx`. Dropping them to
 * hardcode the grid is what the pre-PFP-1 version of this file did, and it is how
 * 13 colours and 5 animals with no render, plus one entry that was not an animal,
 * got into the pool in the first place.
 *
 * This mirrors `scripts/seed-staging.ts`, whose own docblock diagnosed this exact
 * break on 2026-05-28 and routed around it by constructing its own client. That
 * fix was never carried back here, so the knowledge sat one file away for three
 * months while the command stayed broken.
 */

import postgres from "postgres";

import { generatePoolTuples } from "@/server/identity-pool/rotation";
import { ANIMALS, COLOURS } from "@/server/identity-pool/vocabulary";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	console.error("[seed-identity-pool-dev] DATABASE_URL is not set");
	process.exit(1);
}

/** Host only — never the credentials, which are in the same string. */
function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "<unparseable DATABASE_URL>";
	}
}

// One full pass over the grid — every (colour, animal) pair exactly once.
const GRID_PASS = COLOURS.length * ANIMALS.length;

const rows = generatePoolTuples(GRID_PASS);

async function main(databaseUrlValue: string): Promise<void> {
	console.log(`[seed-identity-pool-dev] target: ${safeHost(databaseUrlValue)}`);
	console.log(
		`[seed-identity-pool-dev] inserting ${rows.length} tuples (idempotent via ON CONFLICT)...`,
	);

	const sql = postgres(databaseUrlValue, { max: 1 });
	let inserted = 0;
	try {
		for (const row of rows) {
			const result = await sql<Array<{ id: string }>>`
				INSERT INTO identity_pool (colour, animal, number, pseudonym, pfp_filename)
				VALUES (${row.colour}, ${row.animal}, ${row.number}, ${row.pseudonym}, ${row.pfpFilename})
				ON CONFLICT (colour, animal, number) DO NOTHING
				RETURNING id
			`;
			if (result.length > 0) inserted += 1;
		}
		console.log(
			`[seed-identity-pool-dev] done — ${inserted} new rows, ${rows.length - inserted} already present`,
		);
	} finally {
		// Released explicitly rather than by `process.exit`, which the previous
		// version used and which drops the socket without a graceful close.
		await sql.end({ timeout: 5 });
	}
}

main(databaseUrl).catch((err) => {
	console.error("[seed-identity-pool-dev] failed:", err);
	process.exit(1);
});
