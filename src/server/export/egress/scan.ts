/**
 * DATASET.1 — deep scan primitives for the egress layer.
 *
 * Two scans, because the release ships two artifact SHAPES and a guard that
 * only understands one of them is blind to the other:
 *
 *   · `walk`      — structured rows (CSV source objects, JSONB payloads).
 *                   Finds things by KEY.
 *   · `scanText`  — rendered text (the per-market debate `.md` files).
 *                   Finds things by VALUE, because Markdown has no keys.
 *
 * ⚠ The value scan is the stronger of the two and is the one the wall rests
 * on. A key scan can only reject identifiers it was told to look for under
 * names it was told to expect; a value scan rejects a known-secret string
 * wherever it surfaces, under any key, at any depth, in any format —
 * including interpolated mid-sentence into prose, which is exactly how a
 * `user_id` reaches a rendered `.md` file.
 */

/** One (path, key, value) triple reached by `walk`. */
export interface WalkEntry {
	/** JSON-ish path from the scan root, e.g. `[3].metadata.ip`. */
	readonly path: string;
	/** The object key this value was reached under. `null` at array/root. */
	readonly key: string | null;
	readonly value: unknown;
}

/**
 * Depth-first walk of any JSON-shaped value, yielding every node — objects,
 * arrays and leaves alike.
 *
 * Cycle-safe, because a guard that infinite-loops fails open in the worst
 * possible way: the build hangs, someone kills it, and the artifact from the
 * previous run ships.
 *
 * ⚠ **Cycle detection tracks the ANCESTOR PATH, not every object ever seen.**
 * The obvious implementation — one `WeakSet` of visited objects for the whole
 * traversal — also skips the *second* reference to an object, which is not a
 * cycle at all. A fixture or an in-memory source that hoists a shared
 * `metadata` const into several rows is a completely natural thing to write,
 * and under a global `WeakSet` every row after the first would go unscanned
 * while the guard reported success. Rows parsed from `postgres` are always
 * fresh objects, so this never bit in production — which is precisely what
 * would have made it survive.
 */
export function* walk(root: unknown, rootPath = ""): Generator<WalkEntry> {
	const ancestors = new Set<object>();

	function* visit(
		value: unknown,
		path: string,
		key: string | null,
	): Generator<WalkEntry> {
		yield { path, key, value };

		if (value === null || typeof value !== "object") return;
		// A true cycle: this object is its own ancestor.
		if (ancestors.has(value)) return;
		ancestors.add(value);

		if (Array.isArray(value)) {
			for (const [i, item] of value.entries()) {
				yield* visit(item, `${path}[${i}]`, null);
			}
			ancestors.delete(value);
			return;
		}

		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			yield* visit(v, path === "" ? k : `${path}.${k}`, k);
		}
		// Leaving this subtree — it is no longer an ancestor, so a sibling
		// holding the same reference is still scanned.
		ancestors.delete(value);
	}

	yield* visit(root, rootPath, null);
}

/**
 * Every path in `root` whose KEY is one of `keys`.
 *
 * ⚠ Matches the key EXACTLY, never as a substring. A substring match would
 * make `key` (the R2 object key) collide with `idempotency_key`, `flow_id`'s
 * neighbours, and `tos_version_hash`-adjacent names — reporting shipped
 * columns as violations until someone loosened the guard to stop the noise.
 * The narrow rule is the one that survives being believed.
 */
export function findKeys(
	root: unknown,
	keys: readonly string[],
): readonly WalkEntry[] {
	const wanted = new Set(keys);
	const hits: WalkEntry[] = [];
	for (const entry of walk(root)) {
		if (entry.key !== null && wanted.has(entry.key)) hits.push(entry);
	}
	return hits;
}

/**
 * Every path in `root` whose VALUE stringifies to one of `values`.
 *
 * Empty and whitespace-only needles are ignored: a `Set` containing `""`
 * would match every empty column in the export and drown the real hits. A
 * needle that matches everything is the same failure as a needle that
 * matches nothing — neither one can tell you anything.
 */
export function findValues(
	root: unknown,
	values: ReadonlySet<string>,
): readonly WalkEntry[] {
	const hits: WalkEntry[] = [];
	for (const entry of walk(root)) {
		const v = entry.value;
		if (typeof v !== "string" && typeof v !== "number") continue;
		const s = String(v);
		if (s.trim() === "") continue;
		if (values.has(s)) hits.push(entry);
	}
	return hits;
}

/** One needle found inside a rendered text artifact. */
export interface TextHit {
	/** 1-indexed line number. */
	readonly line: number;
	/**
	 * A redacted fingerprint of what matched — first 8 chars then `…`.
	 * ⚠ NEVER the whole needle: a violation report is itself an artifact,
	 * and one that prints the leaked email into a CI log has relocated the
	 * leak rather than reported it.
	 */
	readonly fingerprint: string;
}

/**
 * Scan rendered text for any of `values`, returning line-anchored hits.
 *
 * Substring search, deliberately — unlike `findKeys`, which must be exact.
 * A UUID interpolated into a sentence (`posted by 0192f3a4-…`) is a leak,
 * and an equality test against the whole line would never see it.
 */
export function scanText(
	text: string,
	values: ReadonlySet<string>,
): readonly TextHit[] {
	const needles = [...values].filter((v) => v.trim() !== "");
	if (needles.length === 0) return [];

	const hits: TextHit[] = [];
	const lines = text.split("\n");
	for (const [i, line] of lines.entries()) {
		for (const needle of needles) {
			if (line.includes(needle)) {
				hits.push({
					line: i + 1,
					fingerprint: `${needle.slice(0, 8)}…`,
				});
			}
		}
	}
	return hits;
}

/**
 * Canonical UUID shape (any version), anchored.
 *
 * Used only as a *secondary* net. The primary raw-`users.id` guard is an
 * exact-value match against the known id set, because that is exhaustive and
 * carries no false positives. Shape matching is the backstop for the case
 * the exact set cannot cover: a UUID in an artifact built from a source the
 * id set was not collected from.
 */
export const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same shape, unanchored — for finding UUIDs embedded in prose. */
export const UUID_RE_GLOBAL =
	/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
