import type { SourceRow } from "./strip";

/**
 * DATASET.1 — the read seam between the pipeline and wherever rows come from.
 *
 * One interface, two implementations: the deliberately-dirty fixture (which
 * is what every guard runs against) and a live Postgres reader. The seam
 * exists so the pipeline can be exercised end-to-end, producing a real
 * manifest with real checksums, **without pointing anything at a database**.
 *
 * That is not only convenience. Brief §5's first wall forbids connecting to
 * production at all, and brief §3 rules the fixture over staging because a
 * guard verified against real data cannot distinguish *"the strip worked"*
 * from *"there was nothing to strip"*. A seam is what lets the verified path
 * and the operational path be the same code.
 */
export interface DatasetSource {
	/** Human-readable name of what is being read — goes in the manifest. */
	readonly label: string;
	/** All rows of one table, in a deterministic order. */
	read(table: string): Promise<readonly SourceRow[]>;
}

/**
 * A source backed by an in-memory table map — the fixture path.
 *
 * Returns `[]` for a table it has no rows for, rather than throwing. An
 * empty shipped table is a legitimate state of this dataset and not an
 * error: `admin_events` and `user_events` both ship empty today because
 * neither has a writer, and the pipeline must produce their (header-only)
 * CSVs rather than fall over.
 */
export function fixtureSource(
	label: string,
	tables: Readonly<Record<string, readonly SourceRow[]>>,
): DatasetSource {
	return {
		label,
		read: async (table) => tables[table] ?? [],
	};
}
