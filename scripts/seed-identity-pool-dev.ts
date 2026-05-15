/**
 * Dev seed for `identity_pool` per SCAFFOLD.3 plan §2 + Q2. Inserts ~200
 * deterministic (colour, animal, number, pfp_filename) tuples for local
 * development. Idempotent — `ON CONFLICT (colour, animal, number) DO
 * NOTHING` makes re-runs no-ops.
 *
 * 20 PascalCase colours × 10 PascalCase animals × 1 number per pair = 200
 * tuples. Numbers are `(colourIdx * 10 + animalIdx)` so each (colour,
 * animal) pair gets a deterministic unique number, but pseudonyms across
 * pairs use the full 0–199 namespace for variety.
 *
 * The production 50K-row asset pipeline (per SPEC.1 §13 lines 643–651) is
 * pre-launch Hrishikesh DGX-Spark work — out of repo scope.
 *
 * PFP filename slug: `${colour.toLowerCase()}-${animal.toLowerCase()}-NNN
 * .webp`. The actual webp file lives on R2 (SCAFFOLD.15); until then the
 * UI renders /public/pfp-placeholder.svg.
 *
 * Run via: `pnpm seed:identity-pool:dev` (see package.json scripts).
 */

import { sql } from "drizzle-orm";
import { db } from "@/db";

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

async function main(): Promise<void> {
	const rows = COLOURS.flatMap((colour, colourIdx) =>
		ANIMALS.map((animal, animalIdx) => {
			const number = colourIdx * 10 + animalIdx;
			const pseudonym = `${colour}${animal}${pad3(number)}`;
			const pfpFilename = `${colour.toLowerCase()}-${animal.toLowerCase()}-${pad3(number)}.webp`;
			return { colour, animal, number, pseudonym, pfpFilename };
		}),
	);

	console.log(
		`[seed-identity-pool-dev] inserting ${rows.length} tuples (idempotent via ON CONFLICT)...`,
	);

	let inserted = 0;
	for (const row of rows) {
		const result = await db.execute(sql`
			INSERT INTO identity_pool (colour, animal, number, pseudonym, pfp_filename)
			VALUES (${row.colour}, ${row.animal}, ${row.number}, ${row.pseudonym}, ${row.pfpFilename})
			ON CONFLICT (colour, animal, number) DO NOTHING
			RETURNING id
		`);
		if ((result as unknown as Array<unknown>).length > 0) inserted += 1;
	}

	console.log(
		`[seed-identity-pool-dev] done — ${inserted} new rows, ${rows.length - inserted} already present`,
	);
	process.exit(0);
}

main().catch((err) => {
	console.error("[seed-identity-pool-dev] failed:", err);
	process.exit(1);
});
