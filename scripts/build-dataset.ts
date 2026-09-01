/**
 * DATASET.1 — the operator entry point for the 2026-11-06 dataset build.
 *
 * ```
 * pnpm dataset:build:fixture          # against the local dirty fixture
 * pnpm dataset:build:fixture -- --out ./out
 * ```
 *
 * ## Runs under plain `tsx`, and that took a change to earn
 *
 * The pipeline's first act is `assertShipRulesComplete()`, which reads the
 * **runtime** `EVENT_TYPES` array — not a scan of the source, because a naive
 * scan of that file counts 64 against a true 24, and this project has already
 * been bitten once by a comment inflating exactly that number.
 *
 * That array used to live in `src/server/events/schemas.ts`, which opens with
 * `import "server-only"` — so this script originally ran under
 * `tsx --conditions=react-server`. AGENTS.md §7 forbids a `tsx` script
 * delegating into that chain and reserves the flag to a single named control,
 * so the first version of this file argued for a third category instead.
 *
 * `@code-reviewer` H-6 was right that the argument did not carry: §7 restricts
 * the MECHANISM, and the purpose paragraph explains the restriction rather
 * than licensing exceptions to it. The constant is now extracted to
 * `src/server/events/event-types.ts`, which imports nothing — so the flag is
 * gone rather than justified, `schemas.ts` re-exports both symbols so no
 * existing import site moved, and the completeness guard still reads the one
 * runtime array instead of a second copy.
 *
 * ⚠ There is no live-database source wired in. A `--source=db` arm is
 * deliberately absent: brief §5's first wall forbids production entirely, and
 * a live staging read would defeat the positive-control argument the fixture
 * exists to make (brief §3). Wiring the real read is the release task's, and
 * it needs its own reviewer pass.
 *
 * ⚠⚠ **When that arm IS wired, it must go through `withDatasetSnapshot`**
 * (`dataset/drizzle-source.ts`, ruling B):
 *
 * ```ts
 * await withDatasetSnapshot(db, (tx) =>
 *   buildDataset({ source: drizzleSource(tx, label), releaseDate }),
 * );
 * ```
 *
 * Stated here, in the file the release task will open, rather than only in the
 * wrapper's own docblock — because the failure it prevents is invisible in the
 * output. Sixteen independent reads produce sixteen internally-consistent
 * files describing sixteen different instants, and no guard in this pipeline
 * can tell that from a correct archive. `r2-orphan-sweep` is not freeze-gated
 * and writes `events` every six hours, so the window is real.
 *
 * ⚠ And said plainly: **`withDatasetSnapshot` has no production caller
 * today** — its only callers are the round-trip integration tests. This
 * project has been bitten by exports whose docblocks described a control
 * nothing exercised (`@code-reviewer` H-4, three of them), so the absence is
 * recorded rather than implied.
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
