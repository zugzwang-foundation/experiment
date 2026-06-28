/**
 * Seed the staging Supabase identity_pool — 200 deterministic
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
 * (lines 8 + 110). The COLOURS/ANIMALS constants below are
 * intentionally duplicated from scripts/seed-identity-pool-dev.ts:25-63
 * pending the root-cause fix tracked for C12 close-out.
 *
 * Idempotent via `ON CONFLICT (colour, animal, number) DO NOTHING`
 * against the identity_pool_tuple_idx unique constraint (see
 * src/db/schema/identity.ts:36-40). Re-runs report "0 new rows, 200
 * already present"; total row count stays at 200. Existing rows are
 * preserved — including any with `assigned_at` set via the Bucket B
 * transition (per src/db/schema/identity.ts:30,41-43) — so the
 * idempotency strategy is non-destructive vs. truncate-then-insert.
 */

import postgres from "postgres";

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

// Deterministic tuple constants — duplicated verbatim from
// scripts/seed-identity-pool-dev.ts:25-63 pending the root-cause fix
// for the dev-seed tsx-import-crash (tracked for C12).
const COLOURS = [
	"Red",
	"Blue",
	"Amber",
	"Green",
	"Crimson",
	"Azure",
	"Emerald",
	"Violet",
	"Saffron",
	"Ivory",
	"Coral",
	"Cyan",
	"Magenta",
	"Plum",
	"Olive",
	"Teal",
	"Maroon",
	"Beige",
	"Indigo",
	"Gold",
] as const;

const ANIMALS = [
	"Fox",
	"Wolf",
	"Otter",
	"Badger",
	"Lynx",
	"Hare",
	"Owl",
	"Hawk",
	"Stoat",
	"Pine",
] as const;

function pad3(n: number): string {
	return String(n).padStart(3, "0");
}

const rows = COLOURS.flatMap((colour, colourIdx) =>
	ANIMALS.map((animal, animalIdx) => {
		const number = colourIdx * 10 + animalIdx;
		const pseudonym = `${colour}${animal}${pad3(number)}`;
		const pfpFilename = `${colour.toLowerCase()}-${animal.toLowerCase()}-${pad3(number)}.webp`;
		return { colour, animal, number, pseudonym, pfpFilename };
	}),
);

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
