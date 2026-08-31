/**
 * BLOCK-2 · repair — YCP-01's description was renamed too broadly at BLOCK-1.
 *
 * ⛔⛔ RF-4 (BLOCK-1) was itself written broader than the founder ruling it
 * implemented — the actual AMEND-1 ruling targeted the exact phrase
 * "research paper" and nothing else. RF-4 asked for the bare noun "paper"
 * renamed wherever it wasn't part of "Paper Club", which also caught "The
 * paper being selected, scheduled or presented resolves NO…" — a NO-limb of
 * the resolution criterion that AMEND-1 deliberately preserved as "paper".
 * BLOCK-1's own guard (occurrence-count parity on "Paper Club") was correct
 * for the task it was given; the task itself was too broad.
 *
 * ⛔⛔ NO REGEX, NO OCCURRENCE-HUNTING — the mechanism that over-corrected
 * last time. Both the expected CURRENT text and the TARGET text are hardcoded
 * string literals, extracted by hand from (a) the live staging read that
 * confirmed BLOCK-1's actual over-broad result, and (b) the committed BLOCK-1
 * S1 snapshot (`git show 4e765f0:docs/data/staging-markets-snapshot.json`,
 * captured before RF-4 ran) with exactly ONE substitution applied to it:
 *
 *     "submitting its research paper to"  →  "submitting its pitch to"
 *
 * Two words out, one word in — not "research pitch". Everything else in the
 * S1 original is byte-identical in the target, INCLUDING "The paper being
 * selected…", which is restored to "paper" rather than left at BLOCK-1's
 * "pitch".
 *
 * `title` is untouched — separately founder-ruled, stays exactly as BLOCK-1
 * left it ("Zugzwang's pitch by 5 Nov 2026?").
 *
 * Usage:
 *   REPAIR_YCP01_INTENT=<token> doppler run --project zugzwang-experiment \
 *     --config stg -- pnpm exec tsx scripts/repair-ycp01-description.ts
 */
import postgres from "postgres";

const SLUG = "yc-paper-club-response";
const INTENT_TOKEN = "repair-ycp01-description-scope";
const PRODUCTION_PROJECT_REF = "zbvprdcyxhlguxbostdj";
const STAGING_PROJECT_REF = "rwfdoqzsghqhhdapxafg";

/** Exactly what BLOCK-1's over-broad rename actually left on staging —
 * verified against a live read before this script was written. If the row
 * doesn't match this, something else has changed it since, and this script
 * must not blindly overwrite it. */
const EXPECTED_CURRENT_TITLE =
	"YCombinator · Will YC reply to Zugzwang's pitch by 5 Nov 2026?";
const EXPECTED_CURRENT_DESCRIPTION =
	"Will @ycombinator reply to or quote-post any post in the Zugzwang thread submitting its research pitch to YC Paper Club, on X, between 15 September and 5 November 2026?\n\nResolves YES if a post by @ycombinator is a reply to any post in the Zugzwang Paper Club thread, or a quote-post of one. What the post says is never read: approval, rejection and dismissal all resolve YES identically.\n\nResolves NO in every other case, and this market is deliberately narrow. A standalone post naming Zugzwang resolves NO. A Paper Club recap or announcement naming Zugzwang resolves NO. The pitch being selected, scheduled or presented resolves NO absent a qualifying post — the outcome the submission wants is not the criterion. So do likes, any other account, and silence.\n\nDeadline 5 November 2026, 23:45 UTC.";

/** The S1 (pre-BLOCK-1) original, with exactly one phrase substituted. */
const TARGET_DESCRIPTION =
	"Will @ycombinator reply to or quote-post any post in the Zugzwang thread submitting its pitch to YC Paper Club, on X, between 15 September and 5 November 2026?\n\nResolves YES if a post by @ycombinator is a reply to any post in the Zugzwang Paper Club thread, or a quote-post of one. What the post says is never read: approval, rejection and dismissal all resolve YES identically.\n\nResolves NO in every other case, and this market is deliberately narrow. A standalone post naming Zugzwang resolves NO. A Paper Club recap or announcement naming Zugzwang resolves NO. The paper being selected, scheduled or presented resolves NO absent a qualifying post — the outcome the submission wants is not the criterion. So do likes, any other account, and silence.\n\nDeadline 5 November 2026, 23:45 UTC.";

function countPaperClub(text: string): number {
	return (text.match(/paper club/gi) ?? []).length;
}

function fail(message: string): never {
	console.error(`\n⛔ REFUSED — ${message}\n`);
	process.exit(1);
}

async function main() {
	if (process.env.REPAIR_YCP01_INTENT !== INTENT_TOKEN) {
		fail(
			`intent token absent. Set REPAIR_YCP01_INTENT=${INTENT_TOKEN} to proceed.`,
		);
	}
	const DATABASE_URL_STAGING = process.env.DATABASE_URL_STAGING;
	if (!DATABASE_URL_STAGING) {
		fail(
			"DATABASE_URL_STAGING is not set (run under `doppler run --config stg`).",
		);
	}
	if (DATABASE_URL_STAGING.includes(PRODUCTION_PROJECT_REF)) {
		fail(
			"the target DSN contains the PRODUCTION project ref. Production is forbidden.",
		);
	}
	if (!DATABASE_URL_STAGING.includes(STAGING_PROJECT_REF)) {
		fail("the target DSN does not contain the STAGING project ref.");
	}
	console.log("✓ guard 1 — intent token present");
	console.log("✓ guard 2 — target is staging; production ref absent");

	// ⚠ NO runtime "are these equal" guard here — both constants are string
	// LITERAL types (no widening annotation), so `tsc` itself rejects this
	// file the moment they're edited to be identical ("no overlap" on the
	// comparison) — a stronger, earlier guarantee than a runtime check.
	const beforeClubCount = countPaperClub(EXPECTED_CURRENT_DESCRIPTION);
	const afterClubCount = countPaperClub(TARGET_DESCRIPTION);
	console.log(
		`"Paper Club" occurrences: before=${beforeClubCount} after=${afterClubCount}`,
	);
	if (beforeClubCount !== afterClubCount) {
		fail(
			`"Paper Club" occurrence count moved (${beforeClubCount} -> ${afterClubCount}).`,
		);
	}
	if (beforeClubCount !== 3) {
		fail(
			`expected exactly 3 "Paper Club" occurrences, hardcoded text has ${beforeClubCount}.`,
		);
	}

	const sql = postgres(DATABASE_URL_STAGING, { max: 1 });
	try {
		const before = await sql<
			{ id: string; title: string; description: string | null }[]
		>`
			SELECT id, title, description FROM markets WHERE slug = ${SLUG}
		`;
		if (before.length !== 1) {
			throw new Error(
				`Expected exactly 1 row for slug "${SLUG}", found ${before.length}.`,
			);
		}
		const row = before[0];

		console.log("--- live current title ---");
		console.log(row.title);
		console.log("--- live current description ---");
		console.log(row.description);

		if (row.title !== EXPECTED_CURRENT_TITLE) {
			throw new Error(
				"Live title does not match EXPECTED_CURRENT_TITLE — refusing to guess. Read the live value and update this script's expectations by hand before re-running.",
			);
		}
		if (row.description !== EXPECTED_CURRENT_DESCRIPTION) {
			throw new Error(
				"Live description does not match EXPECTED_CURRENT_DESCRIPTION — refusing to guess. Read the live value and update this script's expectations by hand before re-running.",
			);
		}

		await sql.begin(async (tx) => {
			// title is NOT in the SET list — untouched, per the ruling.
			const result = await tx`
				UPDATE markets
				SET description = ${TARGET_DESCRIPTION}
				WHERE slug = ${SLUG}
				  AND title = ${EXPECTED_CURRENT_TITLE}
				  AND description = ${EXPECTED_CURRENT_DESCRIPTION}
			`;
			if (result.count !== 1) {
				throw new Error(
					`UPDATE affected ${result.count} rows (expected exactly 1) — the row changed between read and write. Rolling back.`,
				);
			}
			const after = await tx<{ title: string; description: string | null }[]>`
				SELECT title, description FROM markets WHERE slug = ${SLUG}
			`;
			if (
				after.length !== 1 ||
				after[0].title !== EXPECTED_CURRENT_TITLE ||
				after[0].description !== TARGET_DESCRIPTION
			) {
				throw new Error(
					"Read-back after UPDATE did not match the expected values. Rolling back.",
				);
			}
		});

		console.log("--- new description (committed) ---");
		console.log(TARGET_DESCRIPTION);
		console.log(
			`OK — updated 1 row (slug=${SLUG}), title untouched, read-back matched.`,
		);
	} finally {
		await sql.end();
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((err) => {
		console.error(err);
		process.exit(1);
	});
}
