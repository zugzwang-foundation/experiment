import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	DISABLED_TRUNCATE_GUARDS,
	EXPECTED_GUARD_CATALOG_ROWS,
	NEVER_DISABLED_GUARD_NAMES,
	TRUNCATE_EXCLUSIONS,
} from "../../staging/_lib/guards";

// STAGING-PARITY Slice A — ADR-0035 primitive 7: "a unit test asserts the
// reset's guard-list constant matches drizzle/migrations/0003, 0021 and 0022
// exactly. The migrations are the authority; neither the reset nor the
// fixture is."
//
// So this file parses the migration SQL and derives the expected sets from it.
// It deliberately does NOT compare against tests/db/_fixtures/truncate.ts —
// comparing two hand-maintained lists to each other proves only that they
// agree, which is the drift this assertion exists to catch.
//
// friendly_fire_events carries bucket_b guards in 0003 and is DROPPED at 0018
// (DEBATE.9), taking its triggers with it. The drop is re-derived from the
// migration rather than hard-coded, so a future drop is picked up the same way.

const MIGRATIONS = fileURLToPath(
	new URL("../../../drizzle/migrations/", import.meta.url),
);

function read(file: string): string {
	return readFileSync(`${MIGRATIONS}${file}`, "utf8");
}

/**
 * Drop whole-line `--` comments before parsing.
 *
 * ⚠ **This is a correctness fix, not tidying, and PHASE-0 found it the
 * expensive way.** 0025 ships its reversal as a documented comment block
 * containing `DROP TABLE IF EXISTS "lots";` — deliberately, so that whoever
 * writes the real down-migration does not have to re-derive it under pressure.
 * The parser read that comment as SQL, put `lots` in DROPPED, and silently
 * filtered every `lots` trigger out of LIVE_TRIGGERS. Adding 0026's
 * `lots_no_delete` guard therefore left this file GREEN — not because the guard
 * was accounted for, but because the table it guards looked dropped.
 *
 * That is the precise failure ADR-0030's forward obligation exists to catch,
 * arriving through the door marked "the migrations are the authority": a
 * migration that documents its own reversal makes its own table invisible here,
 * and the count narrows without anyone being told. Any future protected table
 * carrying a DOWN block would have done the same thing.
 *
 * Only FULL-line comments are stripped. `--> statement-breakpoint` is one, and
 * goes; `CREATE TRIGGER …();--> statement-breakpoint` is not, and stays. A
 * `--` inside a string literal cannot be reached, because no statement line
 * begins with one.
 */
function stripComments(sql: string): string {
	return sql
		.split("\n")
		.filter((line) => !/^\s*--/.test(line))
		.join("\n");
}

type Trigger = { table: string; trigger: string };

/** Every `CREATE TRIGGER <name> ... ON <table>` in the given SQL. */
function parseCreateTriggers(sql: string): Trigger[] {
	const re = /CREATE TRIGGER\s+(\S+)\s+BEFORE\s+\w+\s+ON\s+"?(\w+)"?/g;
	const out: Trigger[] = [];
	for (const m of sql.matchAll(re)) {
		const trigger = m[1];
		const table = m[2];
		if (trigger && table) out.push({ table, trigger });
	}
	return out;
}

/**
 * Every table named by a `DROP TABLE` in the given SQL.
 *
 * Handles `IF EXISTS` and comma-separated lists. The naive
 * `/DROP TABLE\s+"?(\w+)"?/` captured the literal `IF` from
 * `DROP TABLE IF EXISTS "x"`, and saw only the first name of `DROP TABLE a, b`
 * — in both cases the real table stays in LIVE_TRIGGERS and the parity
 * assertion fails LOUDLY rather than silently, but it fails for the wrong
 * reason and sends the reader after the wrong thing (Q-I).
 */
function parseDroppedTables(sql: string): string[] {
	const out: string[] = [];
	for (const m of sql.matchAll(/DROP TABLE\s+(?:IF\s+EXISTS\s+)?([^;]+)/gi)) {
		const list = m[1];
		if (!list) continue;
		for (const raw of list.split(",")) {
			// Strip quotes, then the schema qualifier.
			//
			// CORRECTED 2026-08-06 (mutation QI-5c). This comment used to claim
			// the other order "leaves `"a` from `"public"."a"`, because the inner
			// quotes are not anchored". That is FALSE: `/^.*\./` is greedy, so it
			// consumes through the LAST dot — quotes included — and both orders
			// return `a` for every shape this parser accepts. Swapping them was
			// mutated and the suite stayed green, correctly: the swap is not a
			// defect. The order is stylistic, and saying otherwise sends a reader
			// after a bug that is not there — the exact failure Q-I was written
			// to prevent. What IS load-bearing is the `/^\w+$/` filter below,
			// which is what rejects anything the two replaces did not reduce to a
			// bare identifier.
			const name = raw.trim().replace(/"/g, "").replace(/^.*\./, "");
			if (/^\w+$/.test(name)) out.push(name);
		}
	}
	return out;
}

// EVERY migration is read, not a hard-coded three-file list. ADR-0030 carries
// a standing forward obligation — any migration that adds a protected relation
// or an `events` partition must add the matching triggers — and a migration
// named 0025+ would be invisible to a fixed list, leaving this test green
// while DISABLED_TRUNCATE_GUARDS was incomplete. Detection would then fall to
// the run-time catalog count, i.e. after the operator is already pointed at
// the live database. @code-reviewer flagged the fixed list at Slice A.
const MIGRATION_FILES = readdirSync(MIGRATIONS)
	.filter((f) => f.endsWith(".sql"))
	.sort();

const ALL_MIGRATION_SQL = stripComments(MIGRATION_FILES.map(read).join("\n"));

const DROPPED = new Set(parseDroppedTables(ALL_MIGRATION_SQL));

const LIVE_TRIGGERS = parseCreateTriggers(ALL_MIGRATION_SQL).filter(
	(t) => !DROPPED.has(t.table),
);

/**
 * The subset the reset's G-4 catalog can actually see. `readGuardCatalog`
 * selects `WHERE t.tgname LIKE 'bucket_%'` (tests/staging/_lib/reset.ts), so
 * that predicate — not "every trigger in the migrations" — is what
 * EXPECTED_GUARD_CATALOG_ROWS counts.
 *
 * The two agreed exactly until 0026, because every guard the repo had was a
 * bucket family. `lots_no_delete` is the first that is not: `lots` is Bucket C
 * and its R9 permanence guard must NOT claim a bucket family covering one
 * table. Deriving the catalog count from the unfiltered set would have made
 * this file demand 79 from a catalog that correctly returns 78.
 */
const CATALOG_TRIGGERS = LIVE_TRIGGERS.filter((t) =>
	t.trigger.startsWith("bucket_"),
);

/** Guards the migrations define that the `bucket_%` catalog does NOT see. */
const NON_CATALOG_TRIGGERS = LIVE_TRIGGERS.filter(
	(t) => !t.trigger.startsWith("bucket_"),
);

const key = (t: Trigger) => `${t.table}.${t.trigger}`;

describe("migration parsing — the authority is readable", () => {
	it("reads every migration on disk, not a fixed list", () => {
		expect(MIGRATION_FILES.length).toBeGreaterThanOrEqual(25);
		// The three that actually carry guards today must be among them.
		for (const f of [
			"0003_append_only_triggers.sql",
			"0021_truncate_guards.sql",
			"0022_bet_receipts.sql",
		]) {
			expect(MIGRATION_FILES).toContain(f);
		}
	});

	it("finds the six guard families across the migration set", () => {
		const names = new Set(CATALOG_TRIGGERS.map((t) => t.trigger));
		expect([...names].sort()).toEqual([
			"bucket_a_no_delete",
			"bucket_a_no_truncate",
			"bucket_a_no_update",
			"bucket_b_no_delete",
			"bucket_b_no_truncate",
			"bucket_b_update_check",
		]);
	});

	it("parses DROP TABLE in every shape it could legally take", () => {
		// The parser is the only thing standing between a dropped table and a
		// false parity failure. Prove it on shapes the repo does not use YET
		// — a future migration is free to write any of them (Q-I).
		expect(parseDroppedTables('DROP TABLE "a";')).toEqual(["a"]);
		expect(parseDroppedTables("DROP TABLE a;")).toEqual(["a"]);
		expect(parseDroppedTables('DROP TABLE IF EXISTS "a";')).toEqual(["a"]);
		expect(parseDroppedTables("DROP TABLE IF EXISTS a;")).toEqual(["a"]);
		expect(parseDroppedTables('DROP TABLE "a", "b";')).toEqual(["a", "b"]);
		expect(parseDroppedTables('DROP TABLE "public"."a";')).toEqual(["a"]);
		expect(parseDroppedTables("-- nothing here")).toEqual([]);
	});

	it("parses CREATE TRIGGER, and fails loudly rather than silently on none", () => {
		// parseCreateTriggers matching nothing would empty LIVE_TRIGGERS and
		// make every downstream comparison vacuous. The families assertion
		// above is the control; this pins the parser's own shape.
		expect(
			parseCreateTriggers(
				"CREATE TRIGGER t BEFORE TRUNCATE ON x FOR EACH STATEMENT EXECUTE FUNCTION f();",
			),
		).toEqual([{ table: "x", trigger: "t" }]);
		expect(parseCreateTriggers("-- nothing")).toEqual([]);
	});

	it("does not read a DOCUMENTED reversal as a real DROP TABLE", () => {
		// The control for stripComments, and it has to be a control rather than
		// an assertion about the current tree: without it, `lots` lands in
		// DROPPED and every `lots` guard silently leaves LIVE_TRIGGERS — this
		// whole file then goes green while counting one guard fewer than exists.
		expect(DROPPED.has("lots")).toBe(false);
		// ...and the comment it must not read IS there, so the negative above is
		// earned rather than vacuous.
		const raw = MIGRATION_FILES.map(read).join("\n");
		expect(raw).toMatch(/--\s+DROP TABLE IF EXISTS "lots";/);
		expect(parseDroppedTables(raw)).toContain("lots");
		expect(parseDroppedTables(stripComments(raw))).not.toContain("lots");
	});

	it("still strips only whole-line comments, never a statement", () => {
		// `--> statement-breakpoint` goes; a trailing marker on a real statement
		// line stays, along with the statement.
		const sql =
			'CREATE TRIGGER t BEFORE DELETE ON x FOR EACH ROW EXECUTE FUNCTION f();--> statement-breakpoint\n--   DROP TABLE IF EXISTS "x";\n';
		const stripped = stripComments(sql);
		expect(parseCreateTriggers(stripped)).toEqual([
			{ table: "x", trigger: "t" },
		]);
		expect(parseDroppedTables(stripped)).toEqual([]);
	});

	it("drops friendly_fire_events' guards, re-derived from the DROP TABLE", () => {
		expect(DROPPED.has("friendly_fire_events")).toBe(true);
		expect(
			LIVE_TRIGGERS.filter((t) => t.table === "friendly_fire_events"),
		).toHaveLength(0);
		// It IS present before the drop is applied — proves the filter is doing
		// work rather than matching nothing.
		expect(
			parseCreateTriggers(ALL_MIGRATION_SQL).filter(
				(t) => t.table === "friendly_fire_events",
			).length,
		).toBeGreaterThan(0);
	});
});

describe("EXPECTED_GUARD_CATALOG_ROWS is derived, not guessed", () => {
	// The catalog count is what bounds G-4's coverage, and it lived in the same
	// hand-maintained file as the guard list — outside this test's reach
	// (@code-reviewer, Slice A). Derive it from the parsed migrations plus the
	// one term the SQL cannot show: PostgreSQL CLONES row-level triggers to
	// partitions, but NOT statement-level ones (ADR-0030). So each ROW-level
	// Bucket-A family on `events` appears on all 13 partitions too, while the
	// statement-level `_no_truncate` family had to be written out per partition
	// and is therefore already in the SQL.
	const EVENTS_PARTITIONS = 13;

	it("matches the parsed migrations plus the partition-clone term", () => {
		const rowLevelOnEvents = CATALOG_TRIGGERS.filter(
			(t) => t.table === "events" && !t.trigger.endsWith("_no_truncate"),
		).length;
		const clones = rowLevelOnEvents * EVENTS_PARTITIONS;
		expect(CATALOG_TRIGGERS.length + clones).toBe(EXPECTED_GUARD_CATALOG_ROWS);
	});

	it("counts 13 events partitions in the truncate guards", () => {
		// Cross-check the clone multiplier against the SQL rather than trusting
		// the constant: the statement-level family names every partition.
		const partitions = CATALOG_TRIGGERS.filter(
			(t) => t.trigger.endsWith("_no_truncate") && /^events_/.test(t.table),
		);
		expect(partitions).toHaveLength(EVENTS_PARTITIONS);
	});
});

describe("guards outside the bucket_% catalog are named, not forgotten", () => {
	// guards.ts warns that "a table in none of the three lists is FORGOTTEN, not
	// deliberate". The same hazard applies one level up, to a TRIGGER in none of
	// the derived sets — and 0026 mints the first one. Pinning it here is what
	// makes `lots_no_delete`'s absence from EXPECTED_GUARD_CATALOG_ROWS a
	// decision on the record rather than an omission nobody can distinguish from
	// a mistake. A second unclassified guard fails HERE, loudly, instead of
	// quietly not being counted anywhere.
	it("is exactly lots_no_delete (ADR-0039 R9, migration 0026)", () => {
		expect(NON_CATALOG_TRIGGERS.map(key).sort()).toEqual([
			"lots.lots_no_delete",
		]);
	});

	it("is never disabled — it is not a _no_truncate guard", () => {
		// `lots` is Bucket C: TRUNCATE must still reach it through
		// `TRUNCATE bets CASCADE`, which is why there is no truncate guard to
		// disable. The teardown helper's list must never learn this name.
		for (const t of NON_CATALOG_TRIGGERS) {
			expect(t.trigger).not.toMatch(/_no_truncate$/);
			expect(
				DISABLED_TRUNCATE_GUARDS.some(([, name]) => name === t.trigger),
			).toBe(false);
		}
	});
});

describe("DISABLED_TRUNCATE_GUARDS matches the migrations", () => {
	const truncateGuards = CATALOG_TRIGGERS.filter((t) =>
		t.trigger.endsWith("_no_truncate"),
	);

	it("is exactly the migrations' _no_truncate set minus the exclusions", () => {
		const expected = truncateGuards
			.filter((t) => !TRUNCATE_EXCLUSIONS.includes(t.table))
			.map(key)
			.sort();
		const actual = DISABLED_TRUNCATE_GUARDS.map(([table, trigger]) =>
			key({ table, trigger }),
		).sort();
		expect(actual).toEqual(expected);
	});

	it("omits system_state, whose guard is never disabled (ADR-0035 primitive 4)", () => {
		expect(TRUNCATE_EXCLUSIONS).toContain("system_state");
		expect(
			DISABLED_TRUNCATE_GUARDS.some(([table]) => table === "system_state"),
		).toBe(false);
		// ...but the migrations DO define a truncate guard on it, which is
		// exactly why the exclusion has to be explicit rather than implied.
		expect(truncateGuards.some((t) => t.table === "system_state")).toBe(true);
	});

	it("covers the events parent and all 13 partitions individually", () => {
		// Statement-level triggers do not clone to partitions (ADR-0030), so a
		// missing partition would leave a live guard that aborts the batch.
		const eventsTables = DISABLED_TRUNCATE_GUARDS.map(([t]) => t).filter((t) =>
			t.startsWith("events"),
		);
		expect(eventsTables).toHaveLength(14);
		expect(eventsTables).toContain("events");
		expect(eventsTables).toContain("events_default");
	});

	it("contains no duplicate pairs", () => {
		const seen = DISABLED_TRUNCATE_GUARDS.map(([table, trigger]) =>
			key({ table, trigger }),
		);
		expect(new Set(seen).size).toBe(seen.length);
	});

	it("disables only _no_truncate guards — never update/delete", () => {
		for (const [, trigger] of DISABLED_TRUNCATE_GUARDS) {
			expect(trigger).toMatch(/_no_truncate$/);
		}
	});
});

describe("NEVER_DISABLED_GUARD_NAMES matches the migrations", () => {
	it("is exactly the non-truncate guard families the migrations define", () => {
		const expected = [
			...new Set(
				CATALOG_TRIGGERS.map((t) => t.trigger).filter(
					(n) => !n.endsWith("_no_truncate"),
				),
			),
		].sort();
		expect([...NEVER_DISABLED_GUARD_NAMES].sort()).toEqual(expected);
	});

	it("names the four ADR-0035 primitive 3 guards", () => {
		expect([...NEVER_DISABLED_GUARD_NAMES].sort()).toEqual([
			"bucket_a_no_delete",
			"bucket_a_no_update",
			"bucket_b_no_delete",
			"bucket_b_update_check",
		]);
	});

	it("shares no name with the disabled set", () => {
		const disabled = new Set(DISABLED_TRUNCATE_GUARDS.map(([, t]) => t));
		for (const name of NEVER_DISABLED_GUARD_NAMES) {
			expect(disabled.has(name)).toBe(false);
		}
	});
});
