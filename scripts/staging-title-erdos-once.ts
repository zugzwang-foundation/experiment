/**
 * ONE-OFF, STAGING ONLY — remove the "3" from the Erdős market's title.
 * Founder instruction 2026-10-06; run by `.github/workflows/staging-title-once.yml`
 * inside the staging VPC (the migration task's image and secrets), then
 * deleted together with that workflow.
 *
 * Writes exactly ONE column of ONE row: `markets.title` for the market whose
 * id is pinned below. Slug, id, description (the resolution text), status,
 * pools, bets, comments and every other table are untouched. The title is in
 * no event payload (`market.created` carries id, deadline and media only), so
 * the append-only log needs no companion row.
 *
 * Everything is checked INSIDE the transaction that writes: the row is locked,
 * its slug and its exact current title are asserted, the UPDATE is keyed on
 * id AND old title and must touch exactly one row, and the row is re-read and
 * asserted before COMMIT. Any mismatch rolls back and exits non-zero.
 *
 *   --dry-run   reads and reports; writes nothing
 *   --run       applies the change
 *
 * Exit codes (the task log may be unreadable from CI):
 *   2 no mode · 10 DATABASE_URL_STAGING unset · 11 URL names production ·
 *   12 not a URL · 13 host is not an RDS host · 14 fragment missing or not in
 *   the host · 15 ZUGZWANG_ENV is not staging · 20 market id not found ·
 *   21 slug differs · 22 title is neither the old nor the new value ·
 *   23 UPDATE touched other than one row · 24 post-update read disagrees ·
 *   50 unexpected error
 *
 * Inline `postgres()` client per AGENTS.md §7 — never `@/db` from `tsx`.
 */
import postgres from "postgres";

const MARKET_ID = "01a0a0bb-3141-71ce-9843-2d98002f8c87";
const MARKET_SLUG = "math-erdos-solved-on-zugzwang";
// Read off live staging 2026-10-06 (64 code points). Escaped so the bytes
// cannot be changed by an editor's normalisation: U+00B7 middle dot, U+0151 ő.
const OLD_TITLE =
	"Math · Will 3 Erdős problem #728 be solved on erdosproblems.com?";
const NEW_TITLE =
	"Math · Will Erdős problem #728 be solved on erdosproblems.com?";

const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";

function die(message: string, code: number): never {
	console.error(`[staging-title] REFUSED (${code}): ${message}`);
	process.exit(code);
}

function report(label: string, value: unknown): void {
	console.log(`[staging-title] ${label} ${JSON.stringify(value)}`);
}

function target(): { url: string; host: string } {
	const url = process.env.DATABASE_URL_STAGING;
	const fragment = process.env.STAGING_PROJECT_REF_FRAGMENT;
	if (!url) die("DATABASE_URL_STAGING is not set", 10);
	if (url.includes(PRODUCTION_PROJECT_REF)) die("URL names production", 11);
	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		die("DATABASE_URL_STAGING is not a URL", 12);
	}
	if (host.includes("prod")) die(`host ${host} names production`, 11);
	if (!host.endsWith(".rds.amazonaws.com")) {
		die(`host ${host} is not an RDS host`, 13);
	}
	if (!fragment || fragment.length < 16 || !host.includes(fragment)) {
		die("STAGING_PROJECT_REF_FRAGMENT is missing or not in the host", 14);
	}
	if (process.env.ZUGZWANG_ENV !== "staging") {
		die(`ZUGZWANG_ENV is ${process.env.ZUGZWANG_ENV ?? "unset"}`, 15);
	}
	return { url, host };
}

class Abort extends Error {
	constructor(
		message: string,
		readonly code: number,
	) {
		super(message);
	}
}

type Row = {
	id: string;
	slug: string;
	title: string;
	description_md5: string | null;
	status: string;
};

async function main(): Promise<void> {
	const mode = process.argv[2];
	if (mode !== "--dry-run" && mode !== "--run") {
		die("pass --dry-run or --run", 2);
	}
	const { url, host } = target();
	report("target", { host, mode });

	const sql = postgres(url, { max: 1 });
	try {
		await sql.begin(async (tx) => {
			const read = async (): Promise<Row | undefined> => {
				const rows = await tx<Row[]>`
					select id, slug, title, md5(description) as description_md5, status::text as status
					from markets where id = ${MARKET_ID} for update`;
				return rows[0];
			};

			const before = await read();
			if (!before) throw new Abort(`market ${MARKET_ID} not found`, 20);
			report("before", before);
			if (before.slug !== MARKET_SLUG) {
				throw new Abort(`slug is ${before.slug}, expected ${MARKET_SLUG}`, 21);
			}
			if (before.title === NEW_TITLE) {
				report("result", "already applied; nothing written");
				return;
			}
			if (before.title !== OLD_TITLE) {
				throw new Abort("title is neither the old nor the new value", 22);
			}
			report("verified-old-title", before.title);
			if (mode === "--dry-run") {
				report("result", "dry run; would set title to the new value");
				report("would-set", NEW_TITLE);
				return;
			}

			const updated = await tx`
				update markets set title = ${NEW_TITLE}
				where id = ${MARKET_ID} and title = ${OLD_TITLE}`;
			if (updated.count !== 1) {
				throw new Abort(`UPDATE touched ${updated.count} rows`, 23);
			}

			const after = await read();
			if (
				!after ||
				after.title !== NEW_TITLE ||
				after.slug !== before.slug ||
				after.id !== before.id ||
				after.description_md5 !== before.description_md5 ||
				after.status !== before.status
			) {
				throw new Abort("post-update read disagrees; rolling back", 24);
			}
			report("verified-new-title", after.title);
			report("after", after);
			report("result", "committed");
		});
	} catch (err) {
		if (err instanceof Abort) die(err.message, err.code);
		console.error("[staging-title] unexpected error", err);
		process.exit(50);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

void main();
