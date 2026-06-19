/**
 * Read-only migration drift check: compares the code's migration journal head
 * (`drizzle/migrations/meta/_journal.json`, bundled with the checkout) against
 * the connected DB's applied head (`drizzle.__drizzle_migrations`). Exits 0 if
 * in sync, 1 on drift — usable as:
 *   - the gated post-promote release-runbook assertion ("journal head == DB
 *     head") after `db:migrate:prod`, and
 *   - a CI step that fails the build when code is ahead of / behind schema.
 *
 * It performs ONE read-only SELECT; it never mutates. Run it against whichever
 * environment's DATABASE_URL you point it at:
 *   doppler run --config prd -- pnpm db:check-drift     # prod, post-promote
 *   doppler run --config stg -- pnpm db:check-drift     # staging
 *   DATABASE_URL=... pnpm db:check-drift                # CI / local
 *
 * tsx caveat (AGENTS.md §7): self-contained — reads the journal JSON via fs and
 * inlines its own `postgres()` client; no `@/db` → `server-only` chain.
 */

import { readFileSync } from "node:fs";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL;

function safeHost(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return "(unparseable)";
	}
}

if (!dbUrl) {
	console.error(
		"[check-drift] DATABASE_URL is not set. Run with: doppler run --config <stg|prd> -- pnpm db:check-drift",
	);
	process.exit(1);
}

type JournalEntry = { idx: number; when: number; tag: string };

async function main(url: string): Promise<void> {
	const journal = JSON.parse(
		readFileSync("drizzle/migrations/meta/_journal.json", "utf8"),
	) as { entries: JournalEntry[] };
	const journalEntries = journal.entries;
	const journalHead = journalEntries.at(-1) ?? null;
	const journalCount = journalEntries.length;

	const sql = postgres(url, { max: 1 });
	try {
		const headRows = await sql.unsafe(
			"select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
		);
		const countRows = await sql.unsafe(
			"select count(*)::int as c from drizzle.__drizzle_migrations",
		);
		const dbHeadMillis =
			headRows[0]?.created_at != null ? Number(headRows[0].created_at) : null;
		const dbCount = countRows[0]?.c != null ? Number(countRows[0].c) : 0;

		console.log(`[check-drift] target host : ${safeHost(url)}`);
		console.log(
			`[check-drift] journal head: ${journalHead?.tag ?? "(none)"} (when=${journalHead?.when ?? "null"}), ${journalCount} entries`,
		);
		console.log(
			`[check-drift] db head     : created_at=${dbHeadMillis ?? "null"}, ${dbCount} applied`,
		);

		const inSync =
			journalHead != null &&
			dbHeadMillis === journalHead.when &&
			dbCount === journalCount;

		if (inSync) {
			console.log("[check-drift] IN SYNC ✓ — journal head == DB head");
			process.exit(0);
		}
		console.error(
			"[check-drift] DRIFT ✗ — code journal head != DB migration head. The deployed code expects a schema the DB does not have (or vice versa). Run migrations (db:migrate:prod) or deploy code matching the DB before serving traffic.",
		);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

main(dbUrl).catch((err) => {
	console.error("[check-drift] FAILED:", err);
	process.exit(1);
});
