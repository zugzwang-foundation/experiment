// STAGING-PARITY Slice B — the BEHAVIOURAL half of ADR-0036 primitive 4.
// NEVER import this from src/**.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS, AND WHY IT IS NOT THE SOURCE MATCH
//
// Primitive 4 says the generator writes no rows directly, and that this is
// "enforced rather than promised". Gate 1 asserts every `bets` row has a
// matching `bet.placed` event — but if the GENERATOR could write both halves,
// gate 1 would pass BECAUSE the generator wrote them. A verification
// satisfiable by the thing it verifies is not a verification (Ratification
// Record §5 W-G).
//
// The ADR names a SOURCE-LEVEL assertion. Manifest §5 records why that is the
// WEAK form: "a source match reads text about a file rather than what the file
// does, and it false-alarms on correct code" — QK-c proved it false-alarms on a
// pure reformat. So Slice B ships BOTH, and this is the strong one:
//
//   BEHAVIOURAL (this file) — every write issued during the REAL run is
//     attributed to its immediate caller, and a write whose caller is not
//     under `src/` THROWS at the moment it is attempted. It observes what the
//     generator DOES, on the actual run, not what its text looks like.
//   SOURCE MATCH (tests/unit/staging/generator-no-direct-writes.test.ts) —
//     the cheap tripwire, with the four controls manifest §5 requires.
//
// HOW ATTRIBUTION WORKS. Drizzle's write verbs are called as `db.insert(t)` /
// `tx.insert(t)` directly by the engine. A Proxy intercepts the verb, captures
// a stack, and reads the FIRST frame that is not this file — which is, by
// construction, whoever called the verb. `src/server/bets/place.ts` passes;
// `tests/staging/generate.staging.test.ts` does not.
//
// FAILS CLOSED. An unparseable stack refuses rather than allows. A guard that
// silently degrades to permissive when its mechanism breaks is the exact shape
// Slice A's audit kept finding (the NO_MIGRATION_BASELINE case), so the
// unknown-caller branch throws and says so.
//
// SCOPE. This guards the DRIZZLE handle the engine writes through. The
// generator is additionally given no raw `postgres` client at all, so
// `INSERT INTO` as raw SQL has no handle to travel on — that half is
// structural, not asserted.

import { fileURLToPath } from "node:url";
import { getTableName, is, Table } from "drizzle-orm";

/** The verbs that can write. `execute` is included: `insertEvent` writes via a
 *  raw `sql` template through `tx.execute`, so leaving it out would leave the
 *  single highest-value table — `events` — completely unguarded. */
const WRITE_VERBS = ["insert", "update", "delete", "execute"] as const;
type WriteVerb = (typeof WRITE_VERBS)[number];

/**
 * The eleven tables ADR-0036 primitive 4 names, plus the four the reset's
 * TRUNCATE_SET covers that a generator could plausibly reach for.
 *
 * `bookmarks` is in the ADR's list deliberately: it is Bucket C, emits no
 * event, and a direct insert would be two lines shorter and look harmless.
 */
export const FORBIDDEN_DIRECT_WRITE_TABLES: readonly string[] = [
	"bets",
	"comments",
	"events",
	"dharma_ledger",
	"positions",
	"pools",
	"resolution_events",
	"payout_events",
	"mod_actions",
	"bet_receipts",
	"bookmarks",
];

export class DirectWriteForbiddenError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DirectWriteForbiddenError";
	}
}

export interface WriteRecord {
	readonly verb: WriteVerb;
	readonly table: string;
	readonly caller: string;
}

/** Absolute path of a V8 frame, `file://` scheme stripped. */
function framePath(line: string): string | null {
	// Node/V8 frames: "    at fn (/abs/path.ts:12:3)" or "    at /abs/path.ts:12:3".
	const match = line.match(/\(?((?:\/|file:)[^\s()]+?):\d+:\d+\)?\s*$/);
	const raw = match?.[1];
	if (!raw) return null;
	return raw.startsWith("file://")
		? fileURLToPath(raw.split("?")[0] ?? raw)
		: raw;
}

/**
 * The first stack frame that is not inside this module — the immediate caller
 * of the intercepted verb. `null` when no frame can be read.
 *
 * ⚠ THE SELF-SKIP IS MATCHED ON AN EXACT PATH PREFIX, NOT A SUBSTRING.
 *
 * It was a substring — `line.includes("write-guard")` — and that was a real
 * defect, caught by `tests/unit/staging/write-guard.test.ts` on its first run.
 * The test file is named `write-guard.test.ts`, so the marker matched ITS
 * frames too: the loop skipped straight past the actual caller and landed on
 * `@vitest/runner`'s frame, which is under `node_modules/` and therefore
 * ALLOWED. The guard silently permitted the exact write it exists to refuse.
 *
 * That is worth more than the fix. A substring self-marker is a guess about
 * what else might be named similarly, and the first file named similarly was
 * the guard's own test. `import.meta.url` cannot be wrong about which file this
 * is.
 */
const SELF_PATH = fileURLToPath(import.meta.url);

function immediateCaller(): string | null {
	const stack = new Error().stack;
	if (typeof stack !== "string") return null;
	for (const line of stack.split("\n").slice(1)) {
		const path = framePath(line);
		// An unparseable frame is NOT skipped. It is the caller, we could not
		// read it, and this guard fails closed.
		if (path === null) return null;
		if (path.startsWith(SELF_PATH)) continue;
		return path;
	}
	return null;
}

/**
 * True when `caller` is engine or library code rather than the runner's own.
 *
 * POSITIVE MATCH, not "is not tests/": an origin this rule has never seen
 * refuses rather than passes. Two origins are legitimate —
 *
 *   `/src/`          — the engine. `place.ts` calls `tx.insert(bets)` itself,
 *                      so it IS the immediate caller of the verb.
 *   `/node_modules/` — library code the engine delegates to. Better Auth's
 *                      drizzle adapter issues the `users` and `accounts`
 *                      INSERTs during `createOAuthUser`, so its frame is the
 *                      immediate caller there. Refusing it would refuse
 *                      participant creation itself.
 *
 * `/tests/` is refused explicitly and first, so a runner file living under a
 * path that also matches one of the above cannot slip through.
 */
export function isEngineCaller(caller: string): boolean {
	const normalized = caller.replace(/\\/g, "/");
	if (normalized.includes("/tests/")) return false;
	return normalized.includes("/src/") || normalized.includes("/node_modules/");
}

/**
 * Properties that hand out an UNPROXIED write-capable handle, and are therefore
 * refused outright.
 *
 * @code-reviewer, Slice B — `_lib/client.ts` claimed "the generator has no
 * handle a direct INSERT INTO could travel on", and that claim was FALSE:
 * drizzle-orm 0.45 exposes the raw postgres-js client as `db.$client`, so
 * ``guardedDb.$client`INSERT INTO bets …` `` executed completely unguarded, and
 * `db._.session.execute(…)` reached the same place. The proxy's fall-through
 * handed both straight back. Refusing them is what makes the structural claim
 * true rather than aspirational.
 *
 * Nothing in `src/` reaches for these off the injected `db` — the engine uses
 * the query builder and `tx.execute` — so refusing them costs the engine
 * nothing.
 */
const FORBIDDEN_ESCAPE_HATCHES = new Set(["$client", "_", "session"]);

/**
 * Verbs that RETURN a write-capable builder rather than performing the write.
 *
 * `db.with(cte).insert(bets)` reaches `insert` on a fresh builder object that
 * never passed through this proxy (@code-reviewer). Routing `with` through the
 * same attribution closes it, and the returned builder is proxied too so the
 * verb it yields is attributed as well.
 */
const BUILDER_VERBS = ["with"] as const;

/** The table named by a raw `INSERT INTO <table>` / `UPDATE <table>` statement. */
function tableFromSqlText(arg: unknown): string | null {
	// Drizzle's `sql` template exposes its chunks; the statement keyword and the
	// table name are always in the same literal chunk.
	const chunks = (arg as { queryChunks?: unknown[] } | null)?.queryChunks;
	const text = Array.isArray(chunks)
		? chunks
				.map((c) =>
					Array.isArray((c as { value?: unknown })?.value)
						? ((c as { value: unknown[] }).value as unknown[]).join("")
						: "",
				)
				.join(" ")
		: "";
	const match = text.match(
		/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(\w+)"?/i,
	);
	return match?.[1] ?? null;
}

/**
 * Best-effort table name for the argument a write verb was handed.
 *
 * The raw-SQL branch matters more than it looks: EVERY `events` row is written
 * through `tx.execute(sql\`INSERT INTO events …\`)` (`insertEvent`), so a
 * blanket `"(raw-sql)"` meant `events` — the single highest-value table — never
 * appeared in `forbiddenTableWrites()` at all (@code-reviewer, Slice B).
 */
function tableNameOf(arg: unknown): string {
	if (is(arg, Table)) {
		try {
			return getTableName(arg);
		} catch {
			return "(unnamed-table)";
		}
	}
	return tableFromSqlText(arg) ?? "(raw-sql)";
}

export interface WriteGuard<TDb> {
	/** The proxied handle. Hand THIS to `vi.mock("@/db")`. */
	readonly db: TDb;
	/** Every write the run issued, in order. */
	writes(): readonly WriteRecord[];
	/** Writes into the primitive-4 table set, in order. */
	forbiddenTableWrites(): readonly WriteRecord[];
}

/**
 * Wrap a drizzle client so every write is attributed to its immediate caller
 * and a non-engine caller THROWS.
 *
 * `transaction` is wrapped too — the engine writes through the `tx` handle
 * drizzle hands its callback, so guarding only the top-level client would
 * guard nothing that matters.
 */
export function createWriteGuard<TDb extends object>(db: TDb): WriteGuard<TDb> {
	const log: WriteRecord[] = [];

	function guard<T extends object>(handle: T): T {
		return new Proxy(handle, {
			get(target, prop) {
				// `receiver` is deliberately NOT forwarded: drizzle and postgres-js
				// carry `#private` fields, and reading one through a Proxy receiver
				// throws a brand-check TypeError. Defaulting the receiver to `target`
				// keeps getters bound to the real object.
				// ESCAPE HATCHES, refused before anything else. These do not write —
				// they hand back an UNPROXIED handle that can, which is worse,
				// because nothing downstream is attributed at all.
				if (typeof prop === "string" && FORBIDDEN_ESCAPE_HATCHES.has(prop)) {
					throw new DirectWriteForbiddenError(
						`REFUSED — \`${prop}\` hands out an unguarded write-capable handle. ` +
							"ADR-0036 primitive 4: the generator has no handle a direct write can travel on. " +
							"Use the engine's own entrypoints.",
					);
				}

				const value = Reflect.get(target, prop);

				if (
					typeof value === "function" &&
					(BUILDER_VERBS as readonly string[]).includes(prop as string)
				) {
					// Returns a BUILDER carrying insert/update/delete. Attribute the
					// call, then proxy what it yields so the verb is attributed too.
					return (...args: unknown[]): unknown => {
						const caller = immediateCaller();
						if (caller === null || !isEngineCaller(caller)) {
							throw new DirectWriteForbiddenError(
								`DIRECT WRITE REFUSED — \`${String(prop)}\` builder issued from ${caller ?? "(unattributable)"}. ` +
									"ADR-0036 primitive 4.",
							);
						}
						const built = (value as (...a: unknown[]) => unknown).apply(
							target,
							args,
						);
						return typeof built === "object" && built !== null
							? guard(built as object)
							: built;
					};
				}

				if (prop === "transaction" && typeof value === "function") {
					return (
						callback: (tx: object) => unknown,
						...rest: unknown[]
					): unknown =>
						(value as (cb: unknown, ...r: unknown[]) => unknown).call(
							target,
							(tx: object) => callback(guard(tx)),
							...rest,
						);
				}

				if (
					typeof value === "function" &&
					(WRITE_VERBS as readonly string[]).includes(prop as string)
				) {
					const verb = prop as WriteVerb;
					return (...args: unknown[]): unknown => {
						const caller = immediateCaller();
						const table = tableNameOf(args[0]);
						if (caller === null) {
							throw new DirectWriteForbiddenError(
								`refusing a ${verb} on ${table}: the immediate caller could not be attributed, and this guard fails closed (ADR-0036 primitive 4)`,
							);
						}
						if (!isEngineCaller(caller)) {
							throw new DirectWriteForbiddenError(
								`DIRECT WRITE REFUSED — ${verb} on ${table} issued from ${caller}.\n` +
									"ADR-0036 primitive 4: the generator writes NO rows directly; every row comes from the real engine. " +
									"A generator that could write both a bets row and its event would make gate 1 pass BECAUSE the generator wrote both halves.",
							);
						}
						log.push({ verb, table, caller });
						return (value as (...a: unknown[]) => unknown).apply(target, args);
					};
				}

				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	}

	return {
		db: guard(db),
		writes: () => log,
		forbiddenTableWrites: () =>
			log.filter((w) => FORBIDDEN_DIRECT_WRITE_TABLES.includes(w.table)),
	};
}
