/**
 * DATASET.1 — the operator entry point for the 2026-11-06 dataset build.
 *
 * ```
 * pnpm dataset:build:fixture          # against the local dirty fixture
 * pnpm dataset:build:fixture -- --out ./out
 * ```
 *
 * ## Why this runs under `tsx --conditions=react-server`
 *
 * The pipeline's first act is `assertStripRulesComplete()`, which reads the
 * **runtime** `EVENT_TYPES` array from `src/server/events/schemas.ts` — and
 * that module opens with `import "server-only"`, whose `default` export
 * condition is a bare `throw`. Under plain `tsx` the script dies on the
 * import before a line of it runs.
 *
 * Reading the array at runtime is not incidental; it is the guard's whole
 * point (P3, and the V-register case where a source scan over that same file
 * counted 64 against a true 24). Re-declaring the list here to dodge the
 * import would give the completeness guard a second copy to agree with,
 * which is exactly the drift it exists to detect.
 *
 * AGENTS.md §7 says a `tsx` script must not delegate into the `@/db` →
 * `server-only` chain, and reserves `--conditions=react-server` narrowly. The
 * rule's stated reason is that a seeder or smoke check needs *a* database
 * connection and should inline its own rather than borrow the shipped
 * singleton and let it drift. **This script opens no connection at all** — it
 * reads a fixture and writes files. It touches the flag not to reach a
 * client, but because a pure constant it must read for correctness sits
 * behind a module marked server-only. Flagged in the DATASET.1 report rather
 * than assumed to be covered by the existing carve-out.
 *
 * ⚠ There is no live-database source wired in. A `--source=db` arm is
 * deliberately absent: brief §5's first wall forbids production entirely, and
 * a live staging read would defeat the positive-control argument the fixture
 * exists to make (brief §3). Wiring the real read is the release task's, and
 * it needs its own reviewer pass.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildDataset } from "../src/server/export/dataset/build";
import { fixtureSource } from "../src/server/export/dataset/source";
import { DIRTY_TABLE_ROWS } from "../tests/_fixtures/dataset/dirty-source";

function arg(name: string, fallback: string): string {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(`--${name}=`.length) : fallback;
}

async function main(): Promise<void> {
	const outDir = arg("out", "./dataset-out");
	const releaseDate = arg("release-date", "2026-11-06");

	const result = await buildDataset({
		source: fixtureSource(
			"DATASET-1 local dirty fixture (tests/_fixtures/dataset)",
			DIRTY_TABLE_ROWS as never,
		),
		releaseDate,
		notes: [
			"Built from the LOCAL DIRTY FIXTURE, not from live data. This is a " +
				"pipeline-correctness artifact, not a release rehearsal.",
			"admin_events and user_events ship EMPTY — neither has a writer " +
				"anywhere in src/ (ADMIN-EVENTS-WRITER is the open founder fork " +
				"for the first; the second is recorded nowhere).",
			"lots is UNDECIDED per SPEC.2 §19.3 row 22 and is therefore absent " +
				"from the archive — which is not a ruling that it should be.",
		],
	});

	mkdirSync(outDir, { recursive: true });
	for (const artifact of result.artifacts) {
		writeFileSync(join(outDir, artifact.filename), artifact.text, "utf8");
	}
	writeFileSync(
		join(outDir, result.manifest.tarball_name),
		result.tarball as unknown as Uint8Array,
	);
	writeFileSync(
		join(outDir, "manifest.json"),
		`${JSON.stringify(result.manifest, null, 2)}\n`,
		"utf8",
	);

	// Deliberately terse and machine-readable: this is what the operator
	// pastes into the release record.
	console.log(JSON.stringify(result.manifest, null, 2));
	console.error(
		`\n[dataset] wrote ${result.artifacts.length} CSVs + tarball + manifest to ${outDir}`,
	);
	console.error(
		`[dataset] tarball sha256 ${result.manifest.tarball_sha256} (${result.manifest.tarball_size_bytes} bytes)`,
	);
}

main().catch((err: unknown) => {
	// A contract gap or an egress violation must be loud and must exit
	// non-zero — this runs once, and a build that half-succeeded quietly is
	// the failure mode that reaches a published artifact.
	console.error(`[dataset] BUILD FAILED\n${(err as Error).message}`);
	process.exit(1);
});
