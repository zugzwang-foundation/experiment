/**
 * Seed the staging Supabase identity_pool — 871 deterministic
 * (colour, animal, number) tuples via DATABASE_URL_STAGING (the
 * Session pooler URL synced from Doppler stg). Per SCAFFOLD.8 plan
 * §4.3 + J2 fix.
 *
 * Operator usage:
 *   doppler run --config stg -- pnpm db:seed:staging
 *
 * Guard pattern (preserved from migrate-staging.ts): refuses to run
 * unless DATABASE_URL_STAGING is set AND contains
 * STAGING_PROJECT_REF_FRAGMENT.
 *
 * J2 fix (2026-05-28): previously delegated to
 * scripts/seed-identity-pool-dev.ts via a tsx subprocess. That file
 * imports `@/db`, which imports `server-only`, which throws
 * unconditionally under tsx (no Next.js bundler / Vitest alias to
 * replace it). Bypassed here by constructing our own `postgres()`
 * client directly — mirroring the pattern in scripts/smoke-staging.ts
 * (lines 8 + 110). The tuples themselves come from
 * `@/server/identity-pool/rotation`, which is pure and so imports
 * cleanly here; the C12 duplication this file used to carry is gone.
 *
 * Idempotent via `ON CONFLICT (colour, animal, number) DO NOTHING`
 * against the identity_pool_tuple_idx unique constraint (see
 * src/db/schema/identity.ts:36-40). Re-runs report "0 new rows, 871
 * already present"; total row count stays at 871. Existing rows are
 * preserved — including any with `assigned_at` set via the Bucket B
 * transition (per src/db/schema/identity.ts:30,41-43) — so the
 * idempotency strategy is non-destructive vs. truncate-then-insert.
 *
 * Re-runs report "0 new rows, 871 already present".
 */

import postgres from "postgres";

import { generatePoolTuples } from "@/server/identity-pool/rotation";
import { ANIMALS, COLOURS } from "@/server/identity-pool/vocabulary";

const dbUrl = process.env.DATABASE_URL_STAGING;
const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

if (!dbUrl) {
	console.error(
		"[seed-staging] DATABASE_URL_STAGING is not set. Run with: doppler run --config stg -- pnpm db:seed:staging",
	);
	process.exit(1);
}
if (!fragment) {
	console.error(
		"[seed-staging] STAGING_PROJECT_REF_FRAGMENT not set; cannot verify URL is staging",
	);
	process.exit(1);
}
if (!dbUrl.includes(fragment)) {
	console.error(
		`[seed-staging] DATABASE_URL_STAGING does not contain expected fragment "${fragment}"; refusing to run`,
	);
	console.error(`[seed-staging] Saw URL host: ${safeHost(dbUrl)}`);
	process.exit(1);
}

// One full pass over the identity grid — every (colour, animal) pair exactly once, in the order `consumeIdentityPoolTuple` will hand them out.
//
// The COLOURS/ANIMALS duplication this block used to carry (tracked for C12) is gone: `@/server/identity-pool/rotation` is pure, so it imports cleanly under tsx without dragging in the `@/db` -> `server-only` chain that made the duplication necessary.
const rows = generatePoolTuples(COLOURS.length * ANIMALS.length);

console.log(`[seed-staging] Target: ${safeHost(dbUrl)}`);
console.log(
	`[seed-staging] Seeding identity_pool (${rows.length} deterministic tuples)...`,
);

async function seedStaging(stagingUrl: string): Promise<void> {
	const sql = postgres(stagingUrl, { max: 1 });
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
			`[seed-staging] Done — ${inserted} new rows, ${rows.length - inserted} already present`,
		);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

seedStaging(dbUrl).catch((err) => {
	console.error("[seed-staging] Seed failed:", err);
	process.exit(1);
});
