import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AWS-MIGRATION-3 item 6, tests-first (CLAUDE.md §5.6) — `migrate-prod.ts`
 * delegates to the shared per-transaction applier and keeps both guards. Plan
 * `docs/plans/AWS-MIGRATION-3.md` §"Test plan" row 7.
 *
 * ⛔ WHY A SOURCE SCAN AND NOT AN EXECUTION TEST. `scripts/migrate-prod.ts` is a
 * top-level script: its guards run at module scope and, past them, it opens a
 * connection to PRODUCTION. Importing it in a test either exits the process
 * (`process.exit(1)` on the missing guard variables) or dials the prod database,
 * and there is no third arm. So the property is proved textually — which is the
 * `tests/unit/config/chart-window.test.ts` and `bundle-baseline.test.ts`
 * precedent, and it is the weak form, stated plainly: this asserts what the file
 * SAYS, not what a run does. The behaviour of the applier itself is exercised
 * wherever `apply-migrations-per-tx.ts` is, and by the staging rehearsal.
 *
 * ⛔ WHAT THE DELEGATION IS ACTUALLY FOR. Both copies of the loop were correct
 * against SUPABASE. Against a FRESH RDS instance the prod copy fails twice before
 * the first migration commits — 3F000, because migration `0007` installs pg_cron
 * `WITH SCHEMA extensions` and RDS has no such schema; then 0A000, because RDS
 * pins pg_cron to `pg_catalog` and rejects the schema clause outright. Both were
 * measured on the first staging rehearsal. The shared applier carries the target
 * preparation for exactly those two cases and is a no-op on Supabase, so the
 * production cutover runs the code the staging rehearsal proved rather than a
 * sibling that merely looks like it. A second copy is not a duplicate; it is an
 * untested path that will be walked exactly once, under time pressure.
 *
 * ⚠ AND THE GUARDS MUST SURVIVE THE REFACTOR. `DATABASE_URL_PROD` is
 * suffix-separated from `DATABASE_URL` precisely so an env-confusion accident
 * REFUSES instead of connecting (ADR-0022), and the fragment check is what makes
 * "the URL is really production" checkable rather than assumed. A tidy-up that
 * moved the applier and took the guards with it would be the single most
 * expensive edit in this lane, and it would look like a simplification in the
 * diff.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
const MIGRATE_PROD = "scripts/migrate-prod.ts";
const SHARED_APPLIER = "scripts/apply-migrations-per-tx.ts";

/**
 * Source with comments removed. ⚠ This repo has caught a negative source scan
 * matching the COMMENT that explained the absence more than once (AGENTS.md §9
 * records six such cases), and `migrate-prod.ts`'s own docblock NAMES
 * `readMigrationFiles` while describing the old behaviour — so the negative row
 * below is one of those cases, not a hypothetical one. Strip first; the positive
 * controls prove the stripping did not simply eat everything.
 */
function strippedSource(relPath: string): string {
	return readFileSync(join(REPO_ROOT, relPath), "utf8")
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

describe("migrate-prod-applier — the prod script delegates to the shared applier", () => {
	it("migrate-prod-applier::imports-both-helpers-from-the-shared-module", () => {
		const source = strippedSource(MIGRATE_PROD);

		// ⛔ POSITIVE CONTROL FIRST — prove the stripped source is still a source
		// file before trusting anything read out of it.
		expect(source.length).toBeGreaterThan(100);
		expect(source).toContain("migrate-prod");

		expect(source).toMatch(/from\s+"\.\/apply-migrations-per-tx"/);
		expect(source).toContain("applyMigrationsPerTransaction");
		// `safeHost` too: the refusal message prints the host it SAW, which is what
		// makes a wrong-target refusal diagnosable rather than merely loud. Sharing
		// it also means the redaction rule cannot drift between the two scripts.
		expect(source).toContain("safeHost");
	});

	it("migrate-prod-applier::actually-calls-the-shared-applier", () => {
		// Importing a symbol is not using it. The call is the delegation.
		expect(strippedSource(MIGRATE_PROD)).toMatch(
			/applyMigrationsPerTransaction\s*\(/,
		);
	});

	it("migrate-prod-applier::no-longer-carries-its-own-migration-reader", () => {
		const source = strippedSource(MIGRATE_PROD);

		// The tell that the local copy of the loop is gone: nothing in this file
		// reads the migration folder any more.
		expect(source).not.toContain("readMigrationFiles");
		expect(source).not.toContain("drizzle-orm/migrator");
		// And it no longer opens its own connection or writes the bookkeeping row —
		// both of which belong to the applier now, and either of which surviving
		// here would mean two implementations again.
		expect(source).not.toContain("__drizzle_migrations");
	});

	it("migrate-prod-applier::the-negative-rows-are-not-vacuous", () => {
		// ⛔ THE CONTROL THAT MAKES THE ROW ABOVE MEAN SOMETHING. Every string
		// asserted absent from `migrate-prod.ts` must be PRESENT in the module that
		// now owns it — otherwise the scan would pass equally well against a typo,
		// an empty file, or a stripper that ate the whole source.
		const applier = strippedSource(SHARED_APPLIER);

		expect(applier).toContain("readMigrationFiles");
		expect(applier).toContain("drizzle-orm/migrator");
		expect(applier).toContain("__drizzle_migrations");
		expect(applier).toContain(
			"export async function applyMigrationsPerTransaction",
		);
		expect(applier).toContain("export function safeHost");
	});
});

describe("migrate-prod-applier — both ADR-0022 guards survive", () => {
	it("migrate-prod-applier::still-requires-DATABASE_URL_PROD", () => {
		const source = strippedSource(MIGRATE_PROD);

		expect(source).toContain("DATABASE_URL_PROD");
		// Read from the environment, not accepted as an argument — the separation
		// from `DATABASE_URL` is the whole mechanism (ADR-0022).
		expect(source).toMatch(/process\.env\.DATABASE_URL_PROD/);
	});

	it("migrate-prod-applier::still-requires-PROD_PROJECT_REF_FRAGMENT", () => {
		const source = strippedSource(MIGRATE_PROD);

		expect(source).toContain("PROD_PROJECT_REF_FRAGMENT");
		expect(source).toMatch(/process\.env\.PROD_PROJECT_REF_FRAGMENT/);
	});

	it("migrate-prod-applier::still-verifies-the-url-contains-the-fragment", () => {
		const source = strippedSource(MIGRATE_PROD);

		// The actual refusal, not merely the presence of the two variable names: a
		// script that read both and compared neither would pass the two rows above.
		expect(source).toMatch(/includes\(\s*fragment\s*\)/);
		// And it refuses rather than warns.
		expect(source).toMatch(/process\.exit\(1\)/);
	});

	it("migrate-prod-applier::never-reads-the-unsuffixed-DATABASE_URL", () => {
		const source = strippedSource(MIGRATE_PROD);

		// ⛔ The env-confusion accident ADR-0022 exists to prevent, in its most
		// likely modern shape: a refactor that "simplified" the prod script onto the
		// same variable every other surface uses. `DATABASE_URL_PROD` contains
		// `DATABASE_URL` as a substring, so the assertion has to exclude the suffixed
		// spelling explicitly rather than search for the bare name.
		const bareReads = source.match(/process\.env\.DATABASE_URL(?![_A-Z])/g);
		expect(bareReads).toBeNull();
	});
});
