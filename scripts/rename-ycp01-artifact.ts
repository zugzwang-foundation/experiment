/**
 * BLOCK-1 · RF-4 — rename YCP-01's artifact noun ("paper" → "pitch") on
 * staging, by founder ruling 2026-08-29.
 *
 * Operational, one-shot, staging-only. Inline `postgres()` client per the
 * staging-seed/smoke pattern (AGENTS.md §7) — never import `@/db` from a
 * `tsx` script.
 *
 * Usage:
 *   doppler run --project zugzwang-experiment --config stg -- \
 *     pnpm exec tsx scripts/rename-ycp01-artifact.ts
 *
 * ⛔⛔ `renameArtifactNoun` IS THE ONLY PART THAT DECIDES WHAT CHANGES, AND IT
 * IS A NEGATIVE-LOOKAHEAD REGEX, NOT A PLAIN SUBSTRING REPLACE. YCP-01's
 * title and description contain the bare artifact noun ("paper") exactly
 * three times and the untouchable proper noun "Paper Club" exactly three
 * times, and a naive `s/paper/pitch/gi` corrupts all three of the latter —
 * G6 in `tests/unit/scripts/rename-ycp01-artifact.test.ts` pins this against
 * both the real strings and synthetic edge cases (`"Paper club"`, `"PAPER
 * CLUB"`, leading/trailing "paper").
 *
 * ⚠ `renameArtifactNoun` is called on `title` and `description` ONLY (see
 * `main()` below) — never on `slug`. That's a SCOPE guarantee, not a regex
 * one: a hyphen is not a `\w` character, so `\bpaper\b` DOES match inside
 * the slug `yc-paper-club-response` (there's a word boundary on both sides
 * of "paper" there) — unlike the concatenated token "ycpaperclub", which has
 * no boundary at all and is skipped by the pattern itself. G6 tests both
 * cases and does not conflate them.
 */
import postgres from "postgres";

export function renameArtifactNoun(text: string): string {
	return text.replace(/\bpaper\b(?!\s+club\b)/gi, (match) =>
		match[0] === match[0].toUpperCase() ? "Pitch" : "pitch",
	);
}

/** Case-insensitive, exact-phrase occurrence count — the delta guard reads
 * this before and after, and refuses to commit unless it's unchanged. */
export function countPaperClub(text: string): number {
	return (text.match(/paper club/gi) ?? []).length;
}

const SLUG = "yc-paper-club-response";

async function main() {
	const DATABASE_URL_STAGING = process.env.DATABASE_URL_STAGING;
	if (!DATABASE_URL_STAGING) {
		console.error("DATABASE_URL_STAGING not set");
		process.exit(1);
	}
	const sql = postgres(DATABASE_URL_STAGING, { max: 1 });

	try {
		const before = await sql`
			SELECT id, title, description FROM markets WHERE slug = ${SLUG}
		`;
		if (before.length !== 1) {
			throw new Error(
				`Expected exactly 1 row for slug "${SLUG}", found ${before.length}. Aborting — nothing written.`,
			);
		}
		const row = before[0];
		const oldTitle: string = row.title;
		const oldDescription: string = row.description ?? "";

		const newTitle = renameArtifactNoun(oldTitle);
		const newDescription = renameArtifactNoun(oldDescription);

		const beforeCount =
			countPaperClub(oldTitle) + countPaperClub(oldDescription);
		const afterCount =
			countPaperClub(newTitle) + countPaperClub(newDescription);

		console.log("--- before ---");
		console.log("title:", oldTitle);
		console.log("--- after ---");
		console.log("title:", newTitle);
		console.log(
			`"Paper Club" occurrences: before=${beforeCount} after=${afterCount}`,
		);

		if (beforeCount !== afterCount) {
			throw new Error(
				`"Paper Club" occurrence count moved (${beforeCount} -> ${afterCount}). Aborting — nothing written.`,
			);
		}
		if (oldTitle === newTitle && oldDescription === newDescription) {
			throw new Error(
				"renameArtifactNoun produced no change on either field — the artifact noun may already be renamed, or the pattern didn't match. Aborting rather than writing a no-op UPDATE.",
			);
		}

		await sql.begin(async (tx) => {
			const result = await tx`
				UPDATE markets
				SET title = ${newTitle}, description = ${newDescription}
				WHERE slug = ${SLUG}
			`;
			if (result.count !== 1) {
				throw new Error(
					`UPDATE affected ${result.count} rows, expected exactly 1. Rolling back.`,
				);
			}
			const after = await tx`
				SELECT title, description FROM markets WHERE slug = ${SLUG}
			`;
			if (
				after.length !== 1 ||
				after[0].title !== newTitle ||
				after[0].description !== newDescription
			) {
				throw new Error(
					"Read-back after UPDATE did not match the expected new values. Rolling back.",
				);
			}
		});

		console.log(`OK — updated 1 row (slug=${SLUG}), read-back matched.`);
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
