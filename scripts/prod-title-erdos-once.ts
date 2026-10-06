/**
 * ONE-OFF, PRODUCTION ONLY — market titles. Round 1 (founder, 2026-10-06,
 * option A) removed the "3" from the Erdős title. Round 2 (founder, same day):
 * STAGING IS THE SOURCE OF TRUTH, so the Erdős and Chess titles are set to
 * staging's exact values. Run by
 * `.github/workflows/prod-title-once.yml` inside the production VPC (the
 * migration task's image and secrets), then deleted together with that
 * workflow. Staging's counterpart ran as `staging-title-erdos-once.ts`.
 *
 * Writes exactly ONE column — `markets.title` — of the rows whose ids are
 * pinned below, all in ONE transaction: any mismatch on any row rolls every
 * row back. Slug, id, description (the resolution text), status,
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
 *   2 no mode · 10 DATABASE_URL_PROD unset · 11 host names staging ·
 *   12 not a URL · 13 host is not an RDS host · 14 fragment missing or not in
 *   the host · 15 ZUGZWANG_ENV is not prod · 20 market id not found ·
 *   21 slug differs · 22 title is neither the old nor the new value ·
 *   23 UPDATE touched other than one row · 24 post-update read disagrees ·
 *   50 unexpected error
 *
 * Inline `postgres()` client per AGENTS.md §7 — never `@/db` from `tsx`.
 */
import postgres from "postgres";

// Round 3 (founder, 2026-10-06): the production Erdős title's problem number
// changes from #728 to #19, production only. OLD is read off live production.
// Escaped: U+00B7 middle dot, U+0151 ő.
const CHANGES = [
	{
		id: "01a0a0bb-3141-71ce-9843-2d98002f8c87",
		slug: "math-erdos-solved-on-zugzwang",
		oldTitle: "Math · Will Erdős problem #728 be solved on erdosproblems.com?",
		newTitle: "Math · Will Erdős problem #19 be solved on erdosproblems.com?",
	},
] as const;

function die(message: string, code: number): never {
	console.error(`[prod-title] REFUSED (${code}): ${message}`);
	process.exit(code);
}

function report(label: string, value: unknown): void {
	console.log(`[prod-title] ${label} ${JSON.stringify(value)}`);
}

function target(): { url: string; host: string } {
	const url = process.env.DATABASE_URL_PROD;
	const fragment = process.env.PROD_PROJECT_REF_FRAGMENT;
	if (!url) die("DATABASE_URL_PROD is not set", 10);
	let host: string;
	try {
		host = new URL(url).hostname.toLowerCase();
	} catch {
		die("DATABASE_URL_PROD is not a URL", 12);
	}
	if (host.includes("staging")) die(`host ${host} names staging`, 11);
	if (!host.endsWith(".rds.amazonaws.com")) {
		die(`host ${host} is not an RDS host`, 13);
	}
	if (!fragment || fragment.length < 16 || !host.includes(fragment)) {
		die("PROD_PROJECT_REF_FRAGMENT is missing or not in the host", 14);
	}
	if (process.env.ZUGZWANG_ENV !== "prod") {
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
			const read = async (id: string): Promise<Row | undefined> => {
				const rows = await tx<Row[]>`
					select id, slug, title, md5(description) as description_md5, status::text as status
					from markets where id = ${id} for update`;
				return rows[0];
			};

			for (const c of CHANGES) {
				const before = await read(c.id);
				if (!before) throw new Abort(`market ${c.id} not found`, 20);
				report("before", before);
				if (before.slug !== c.slug) {
					throw new Abort(`slug is ${before.slug}, expected ${c.slug}`, 21);
				}
				if (before.title === c.newTitle) {
					report("already-applied", c.slug);
					continue;
				}
				if (before.title !== c.oldTitle) {
					throw new Abort(
						`${c.slug}: title is neither the old nor the new value`,
						22,
					);
				}
				report("verified-old-title", before.title);
				if (mode === "--dry-run") {
					report("would-set", c.newTitle);
					continue;
				}

				const updated = await tx`
					update markets set title = ${c.newTitle}
					where id = ${c.id} and title = ${c.oldTitle}`;
				if (updated.count !== 1) {
					throw new Abort(
						`${c.slug}: UPDATE touched ${updated.count} rows`,
						23,
					);
				}

				const after = await read(c.id);
				if (
					!after ||
					after.title !== c.newTitle ||
					after.slug !== before.slug ||
					after.id !== before.id ||
					after.description_md5 !== before.description_md5 ||
					after.status !== before.status
				) {
					throw new Abort(
						`${c.slug}: post-update read disagrees; rolling back`,
						24,
					);
				}
				report("verified-new-title", after.title);
				report("after", after);
			}
			report(
				"result",
				mode === "--dry-run" ? "dry run; nothing written" : "committed",
			);
		});
	} catch (err) {
		if (err instanceof Abort) die(err.message, err.code);
		console.error("[prod-title] unexpected error", err);
		process.exit(50);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

void main();
