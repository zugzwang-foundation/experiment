import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	DISABLED_TRUNCATE_GUARDS,
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

/** Every `DROP TABLE "<name>"` in the given SQL. */
function parseDroppedTables(sql: string): string[] {
	const out: string[] = [];
	for (const m of sql.matchAll(/DROP TABLE\s+"?(\w+)"?/g)) {
		const table = m[1];
		if (table) out.push(table);
	}
	return out;
}

const ALL_TRIGGER_SQL = [
	read("0003_append_only_triggers.sql"),
	read("0021_truncate_guards.sql"),
	read("0022_bet_receipts.sql"),
].join("\n");

const DROPPED = new Set(
	parseDroppedTables(read("0018_drop_friendly_fire_events.sql")),
);

const LIVE_TRIGGERS = parseCreateTriggers(ALL_TRIGGER_SQL).filter(
	(t) => !DROPPED.has(t.table),
);

const key = (t: Trigger) => `${t.table}.${t.trigger}`;

describe("migration parsing — the authority is readable", () => {
	it("finds the three guard families across 0003 + 0021 + 0022", () => {
		const names = new Set(LIVE_TRIGGERS.map((t) => t.trigger));
		expect([...names].sort()).toEqual([
			"bucket_a_no_delete",
			"bucket_a_no_truncate",
			"bucket_a_no_update",
			"bucket_b_no_delete",
			"bucket_b_no_truncate",
			"bucket_b_update_check",
		]);
	});

	it("drops friendly_fire_events' guards via 0018", () => {
		expect(DROPPED.has("friendly_fire_events")).toBe(true);
		expect(
			LIVE_TRIGGERS.filter((t) => t.table === "friendly_fire_events"),
		).toHaveLength(0);
		// It IS present before the drop is applied — proves the filter is doing
		// work rather than matching nothing.
		expect(
			parseCreateTriggers(ALL_TRIGGER_SQL).filter(
				(t) => t.table === "friendly_fire_events",
			).length,
		).toBeGreaterThan(0);
	});
});

describe("DISABLED_TRUNCATE_GUARDS matches the migrations", () => {
	const truncateGuards = LIVE_TRIGGERS.filter((t) =>
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
				LIVE_TRIGGERS.map((t) => t.trigger).filter(
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
