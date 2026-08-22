/**
 * Correct ONE `drizzle.__drizzle_migrations` bookkeeping row whose `hash` no
 * longer matches its migration file — the state a **comment-only edit** to an
 * already-applied migration leaves behind.
 *
 * ⚠ **WHY THIS EXISTS RATHER THAN A HAND-TYPED UPDATE.** Drizzle decides what to
 * apply from the `created_at` high-water mark, not from the hash, so a hash that
 * drifts after the file has been applied is **permanent**: nothing will ever
 * re-apply that migration to heal it, and `db:check-drift` will report the
 * environment as drifted forever. The correction is one row — which is exactly
 * why it wants a guarded, committed, repeatable path instead of a `psql -c`
 * typed at four in the morning against whichever shell had the wrong
 * `DATABASE_URL` exported. Comment-only migration edits are a normal thing to
 * do; this will recur.
 *
 * ⛔ **IT IS NOT A SCHEMA TOOL AND CANNOT REPAIR ONE.** It updates a `hash`
 * column and nothing else. Before running it you must have PROVEN that the
 * migration's executable SQL is byte-identical across the edit — strip the
 * comments from both versions and diff the remainder. If one statement differs,
 * the database and the file genuinely disagree and this script would only hide
 * that.
 *
 * ## Guards, in the order they fire
 *
 *   1. **Unrecognised flags are fatal.** `--dryrun` must not silently mean "do
 *      it for real".
 *   2. **Hashes are ARGUMENTS, never constants.** Both the expected old and the
 *      new hash are supplied by the caller and validated as 64-char hex. A
 *      hardcoded hash is a script that silently does the wrong thing the second
 *      time it is used.
 *   3. **Production refusal, three ways.** The DSN containing
 *      `PRODUCTION_PROJECT_REF`; `DOPPLER_CONFIG=prd`; or `DATABASE_URL_PROD`
 *      merely being SET in the environment. Unconditional; no override flag.
 *   4. **Target must be positively named.** Either `--local` with a loopback
 *      DSN on :54322, or `STAGING_PROJECT_REF_FRAGMENT` set, **shape-checked**
 *      (≥ `MIN_FRAGMENT_LENGTH`, lowercase alphanumeric) and contained in the
 *      DSN. The shape check is what stops a generic fragment like `postgres`
 *      from making the target guard a no-op.
 *   5. **Idempotence / ambiguity.** If a row already carries the NEW hash and
 *      none carries the old, it reports success and changes nothing. If BOTH a
 *      new-hash row and an old-hash row exist, it refuses rather than creating
 *      two identical hashes.
 *   6. **Exactly one row, and the RIGHT one.** It refuses on zero matches and on
 *      more than one, and additionally asserts the matched row's `created_at`
 *      equals the `folderMillis` the caller named — a hash alone does not name a
 *      migration.
 *
 * The UPDATE runs inside a transaction and is keyed on `(id, hash)` — the
 * `hash` in the WHERE clause makes a concurrent writer a zero-row update rather
 * than a lost update.
 *
 * ## Usage
 *
 *   # local test DB
 *   DATABASE_URL=postgresql://...:54322/postgres pnpm tsx \
 *     scripts/fix-migration-hash-drift.ts --local <OLD_SHA256> <NEW_SHA256> <FOLDER_MILLIS>
 *
 *   # staging
 *   doppler run --config stg -- pnpm tsx \
 *     scripts/fix-migration-hash-drift.ts <OLD_SHA256> <NEW_SHA256> <FOLDER_MILLIS>
 *
 *   # dry run (SELECT + report only, no write) — add --dry-run
 *
 * tsx caveat (AGENTS.md §7): self-contained — inlines its own `postgres()`
 * client; no `@/db` → `server-only` chain.
 */

import postgres from "postgres";

/**
 * ⛔ The one identifier this script exists to refuse. Hardcoded ON PURPOSE,
 * unlike the hashes: a guard you can forget to pass is not a guard. Kept as the
 * literal ref rather than read from the environment so that an unset or
 * mistyped env var cannot disable it.
 */
const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";

const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Mirrors `tests/staging/_lib/guards.ts`'s ratified value. A Supabase project
 * ref is 20 lowercase alphanumerics; 16 rejects every generic host/scheme
 * substring while accepting any real ref.
 */
const MIN_FRAGMENT_LENGTH = 16;

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

function fail(msg: string): never {
	console.error(`[fix-hash-drift] ⛔ ${msg}`);
	process.exit(1);
}

const argv = process.argv.slice(2);
// ⚠ WHITELISTED, not merely parsed. A typo'd `--dryrun` / `--dry_run` /
// `--dry-run=true` would otherwise be dropped silently and the script would
// perform the REAL write while the operator believed they were rehearsing —
// the sharpest edge on a write-capable script.
const KNOWN_FLAGS = ["--local", "--dry-run"] as const;
const unknownFlags = argv.filter(
	(a) => a.startsWith("--") && !(KNOWN_FLAGS as readonly string[]).includes(a),
);
const isLocal = argv.includes("--local");
const isDryRun = argv.includes("--dry-run");
const positional = argv.filter((a) => !a.startsWith("--"));

const [oldHash, newHash, expectedCreatedAt] = positional;

if (unknownFlags.length > 0) {
	fail(
		`unrecognised flag(s): ${unknownFlags.join(", ")}. Known flags: ${KNOWN_FLAGS.join(", ")}.`,
	);
}
if (positional.length !== 3) {
	fail(
		"expected exactly three positional arguments: <expected-old-sha256> <new-sha256> <expected-created-at>.\n" +
			"   Derive them yourself — e.g. `git show <old-ref>:drizzle/migrations/<file> | shasum -a 256`\n" +
			"   and `shasum -a 256 drizzle/migrations/<file>`. Never copy them from a report.\n" +
			"   <expected-created-at> is the migration's `folderMillis` from\n" +
			"   drizzle/migrations/meta/_journal.json — it names WHICH migration you mean.",
	);
}
if (!SHA256_RE.test(oldHash ?? "") || !SHA256_RE.test(newHash ?? "")) {
	fail("both hashes must be 64 lowercase hex characters (a drizzle SHA-256).");
}
if (oldHash === newHash) {
	fail("old and new hashes are identical — there is nothing to correct.");
}
// ⚠ THE HASH ALONE DOES NOT NAME A MIGRATION. Without this, a mistyped or
// mis-derived old hash that happened to match a DIFFERENT migration's current
// hash would rewrite THAT row instead — loudly (drift would go permanent) but
// against the wrong file. `created_at` is the `folderMillis` that identifies
// which migration is meant, so the caller has to say it out loud.
if (!/^\d{10,}$/.test(expectedCreatedAt ?? "")) {
	fail(
		"<expected-created-at> must be the migration's folderMillis (a millisecond epoch).",
	);
}

// ⛔ `DATABASE_URL_PROD` IS NOT IN THIS CHAIN, and its absence is the point.
// `check-migration-drift.ts` reads it because that script is READ-ONLY and
// deliberately reaches production. Every WRITE-capable operational script in
// this repo reads `DATABASE_URL_STAGING` and nothing else — `seed-staging.ts`,
// `smoke-staging.ts`, `lots-1-staging-wipe.ts`. Putting the production DSN
// second in the precedence of a script whose first guard is "refuse production"
// would make the two halves of this file argue with each other.
const dbUrl = process.env.DATABASE_URL_STAGING ?? process.env.DATABASE_URL;

if (!dbUrl) {
	fail(
		"no DB URL set. Use `doppler run --config stg -- …` for staging, or set DATABASE_URL with --local.",
	);
}

// ── Guard 1: production, unconditionally ─────────────────────────────────────
if (dbUrl.includes(PRODUCTION_PROJECT_REF)) {
	fail(
		`the DSN names the PRODUCTION project (${PRODUCTION_PROJECT_REF}). Refusing.\n` +
			"   Production has never applied a drifted migration row; there is nothing here to correct.",
	);
}
if (process.env.DOPPLER_CONFIG === "prd") {
	fail("DOPPLER_CONFIG=prd. Refusing.");
}
if (process.env.DATABASE_URL_PROD) {
	fail(
		"DATABASE_URL_PROD is set in this environment. Refusing to run a write-capable\n" +
			"   script from a shell that has the production DSN in scope at all.",
	);
}

// ── Guard 2: the target must be positively identified ────────────────────────
const stagingFragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
if (isLocal) {
	const host = safeHost(dbUrl);
	if (!/^(127\.0\.0\.1|localhost|\[::1\]):54322$/.test(host)) {
		fail(
			`--local was passed but the DSN host is ${host}, not a loopback address on :54322.`,
		);
	}
} else {
	if (!stagingFragment) {
		fail(
			"STAGING_PROJECT_REF_FRAGMENT is unset.\n" +
				"   Run under `doppler run --config stg`, or pass --local for the local test database.",
		);
	}
	// ⚠ THE FRAGMENT'S SHAPE IS CHECKED, NOT JUST ITS PRESENCE — the same control
	// `tests/staging/_lib/guards.ts` ratifies (MIN_FRAGMENT_LENGTH, lowercase
	// alphanumeric) and for the reason `.env.example` states verbatim: a short or
	// generic value like `postgres` or `supabase` is true of every Postgres DSN in
	// existence and turns the target guard into a no-op. Duplicated here rather
	// than imported because `scripts/` must not depend on `tests/` to be safe.
	if (
		stagingFragment.length < MIN_FRAGMENT_LENGTH ||
		!/^[a-z0-9]+$/.test(stagingFragment)
	) {
		fail(
			`STAGING_PROJECT_REF_FRAGMENT must be at least ${MIN_FRAGMENT_LENGTH} lowercase alphanumeric\n` +
				"   characters (a Supabase project ref). A short or generic fragment matches every\n" +
				"   Postgres DSN and makes the target guard a no-op; refusing.",
		);
	}
	if (!dbUrl.includes(stagingFragment)) {
		fail("the DSN does not contain STAGING_PROJECT_REF_FRAGMENT. Refusing.");
	}
}

const targetLabel = isLocal ? "LOCAL" : "STAGING";

type MigrationRow = { id: number; hash: string; created_at: string };

async function main(url: string): Promise<void> {
	const sql = postgres(url, { max: 1 });
	try {
		console.log(`[fix-hash-drift] target    : ${targetLabel} ${safeHost(url)}`);
		console.log(`[fix-hash-drift] old hash  : ${oldHash}`);
		console.log(`[fix-hash-drift] new hash  : ${newHash}`);
		if (isDryRun) {
			console.log("[fix-hash-drift] mode      : DRY RUN (no write)");
		}

		// ── Guard 5: already corrected? ──────────────────────────────────────────
		const already = (await sql`
			SELECT id, hash, created_at::text AS created_at
			FROM drizzle.__drizzle_migrations
			WHERE hash = ${newHash as string}
		`) as unknown as MigrationRow[];

		// ── Guard 4: exactly one row carries the old hash ────────────────────────
		const matches = (await sql`
			SELECT id, hash, created_at::text AS created_at
			FROM drizzle.__drizzle_migrations
			WHERE hash = ${oldHash as string}
		`) as unknown as MigrationRow[];

		if (matches.length === 0) {
			if (already.length > 0) {
				// ⚠ The identity check applies HERE TOO. Reporting "already
				// corrected" for a migration the caller did not name would tell them
				// their job is done when it is not — a true statement about the wrong
				// row (O-3).
				if (already[0]?.created_at !== expectedCreatedAt) {
					fail(
						`a row carries the new hash, but its created_at=${already[0]?.created_at} is not the\n` +
							`   expected ${expectedCreatedAt}. That is a DIFFERENT migration than the one you named.`,
					);
				}
				console.log(
					`[fix-hash-drift] ✓ nothing to do — a row already carries the new hash (id=${already[0]?.id}, created_at=${already[0]?.created_at}).`,
				);
				return;
			}
			fail(
				"no row carries the expected OLD hash, and none carries the new one either.\n" +
					"   That is not a drift this script can explain. Read the table and diagnose before writing anything.",
			);
		}
		if (matches.length > 0 && already.length > 0) {
			fail(
				"one row carries the OLD hash and another already carries the NEW one.\n" +
					"   Updating would leave two rows with identical hashes. Refusing — diagnose by hand.",
			);
		}
		if (matches.length > 1) {
			fail(
				`${matches.length} rows carry the expected OLD hash. Refusing — a blind UPDATE would corrupt all of them.\n` +
					`   ids: ${matches.map((r) => r.id).join(", ")}`,
			);
		}

		const before = matches[0] as MigrationRow;
		if (before.created_at !== expectedCreatedAt) {
			fail(
				`the row carrying that old hash has created_at=${before.created_at}, not the\n` +
					`   expected ${expectedCreatedAt}. That is a DIFFERENT migration than the one you named.\n` +
					"   Refusing — re-derive the hashes against the migration you actually mean.",
			);
		}
		console.log(
			`[fix-hash-drift] BEFORE    : id=${before.id} created_at=${before.created_at}\n                            hash=${before.hash}`,
		);

		if (isDryRun) {
			console.log(
				"[fix-hash-drift] dry run — the single matching row above WOULD be updated. No write performed.",
			);
			return;
		}

		// The `hash` in the WHERE clause makes a concurrent writer a zero-row
		// update rather than a lost update.
		const updated = (await sql.begin(async (tx) => {
			return (await tx`
				UPDATE drizzle.__drizzle_migrations
				SET hash = ${newHash as string}
				WHERE id = ${before.id} AND hash = ${oldHash as string}
				RETURNING id, hash, created_at::text AS created_at
			`) as unknown as MigrationRow[];
		})) as unknown as MigrationRow[];

		if (updated.length !== 1) {
			// ⚠ NOT "the transaction rolled back" — it committed. `sql.begin`
			// resolved before this line, so the only reachable case is a
			// concurrent writer having changed the hash between the SELECT and
			// the UPDATE, which the `AND hash = <old>` predicate turns into a
			// committed NO-OP. Saying "rolled back" would be a true refusal
			// reported with a false cause (O-3).
			fail(
				`the UPDATE matched ${updated.length} rows, expected exactly 1 — nothing was written.\n` +
					"   Most likely another writer changed the hash between the SELECT and the UPDATE.\n" +
					"   Re-read the table and re-derive the hashes before retrying.",
			);
		}
		const after = updated[0] as MigrationRow;
		console.log(
			`[fix-hash-drift] AFTER     : id=${after.id} created_at=${after.created_at}\n                            hash=${after.hash}`,
		);

		// Read back through a fresh statement rather than trusting RETURNING.
		const verify = (await sql`
			SELECT id, hash, created_at::text AS created_at
			FROM drizzle.__drizzle_migrations
			WHERE id = ${before.id}
		`) as unknown as MigrationRow[];
		const confirmed = verify[0]?.hash === newHash;
		console.log(
			`[fix-hash-drift] VERIFY    : re-read hash ${confirmed ? "MATCHES" : "DOES NOT MATCH"} the new hash`,
		);
		if (!confirmed) {
			fail("post-update read-back does not show the new hash.");
		}
		// `created_at` is the high-water mark drizzle actually sequences on;
		// changing it would change what gets applied. Assert it did not move.
		if (verify[0]?.created_at !== before.created_at) {
			fail(
				"created_at moved. That column is drizzle's high-water mark and must never change here.",
			);
		}
		console.log("[fix-hash-drift] ✓ corrected exactly one row.");
	} finally {
		await sql.end({ timeout: 5 });
	}
}

main(dbUrl).catch((err: unknown) => {
	console.error("[fix-hash-drift] ⛔ failed:", err);
	process.exit(1);
});
