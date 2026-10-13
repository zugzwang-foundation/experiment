import { describe, expect, it } from "vitest";

import { EVENT_TYPES, eventPayloadSchemas } from "@/server/events/schemas";

// EXT-1 §3.4 / §5.2 — the `market.deadline_moved` event type.
//
// ⚠ THE WRITER IS SQL. This type is emitted by migration
// `0032_ext1_end_moved_to_dec31`'s plpgsql, not by `insertEvent`, so nothing at
// write time checks the payload against this schema. What ties the two halves
// together is that the schema accepts EXACTLY the shape the migration writes
// (plan §3.3 step 6) — pinned here against a literal, and against the real
// emitted rows in `tests/db/ext1-end-moved.spec.ts`.
//
// The inventory enumeration lives in `tests/server/events/insert.test.ts`, which
// needs a database to load. This file is the half that runs without one.
//
// ⚠ EVERY REJECTION BELOW IS READ OFF `safeParse(...).success`, NEVER OFF
// `expect(() => parse(...)).toThrow()`. While the type is unregistered the
// schema is `undefined`, and calling `.parse` on that throws a TypeError — which
// a bare `toThrow()` would accept, so every "rejects" case would be green
// against a codebase that has no such event type at all.

const MARKET_ID = "01a0a0ba-c700-77bf-8395-7f6bd429e53f";

/** The payload the migration builds, key for key. */
const MIGRATION_PAYLOAD = {
	marketId: MARKET_ID,
	previousDeadline: "2026-11-05T23:45:00.000Z",
	newDeadline: "2026-12-31T23:45:00.000Z",
	ruling: "D-55",
};

describe("events::market.deadline_moved is a registered event type", () => {
	it("EVENT_TYPES has 26 entries and includes market.deadline_moved", () => {
		expect(EVENT_TYPES).toContain("market.deadline_moved");
		expect((EVENT_TYPES as readonly string[]).length).toBe(26);
		// No duplicate was introduced to reach the count.
		expect(new Set<string>(EVENT_TYPES).size).toBe(26);
	});

	it("carries a payload schema — a type without one cannot be read back", () => {
		expect(Object.keys(eventPayloadSchemas)).toContain("market.deadline_moved");
		// …and so does every other registered type: the two lists are one set.
		expect(Object.keys(eventPayloadSchemas).sort()).toEqual(
			[...EVENT_TYPES].sort(),
		);
	});
});

describe("events::market.deadline_moved payload", () => {
	const schema = eventPayloadSchemas["market.deadline_moved"];

	it("accepts the migration's payload shape, key for key", () => {
		// `toEqual` against the input: `z.object` strips unknown keys, so equality
		// proves the schema names all four and drops none.
		expect(schema.parse(MIGRATION_PAYLOAD)).toEqual(MIGRATION_PAYLOAD);
	});

	it("accepts a previousDeadline read off a 23:59 row", () => {
		// The migration reads `previousDeadline` from the row before it updates
		// it, and SPEC.1 let a market carry 23:59 rather than 23:45.
		const at2359 = {
			...MIGRATION_PAYLOAD,
			previousDeadline: "2026-11-05T23:59:00.000Z",
		};
		expect(schema.parse(at2359)).toEqual(at2359);
	});

	it("rejects a payload missing `ruling`", () => {
		// The ruling is what makes this move a sanctioned exception to the
		// no-extension guard rather than an unexplained edit; a row without it
		// records that a deadline moved and not on whose authority.
		const { ruling: _dropped, ...missing } = MIGRATION_PAYLOAD;
		expect(schema.safeParse(missing).success).toBe(false);
		// Present-but-empty is the same absence.
		expect(schema.safeParse({ ...MIGRATION_PAYLOAD, ruling: "" }).success).toBe(
			false,
		);
		// CONTROL — the same probe reports success on the full payload, so the
		// two `false`s above are rejections rather than a probe stuck at false.
		expect(schema.safeParse(MIGRATION_PAYLOAD).success).toBe(true);
	});

	it("rejects a payload missing any other key", () => {
		// Required-ness is a property of all four keys, not only of the one the
		// case above names.
		const keys = ["marketId", "previousDeadline", "newDeadline"] as const;
		for (const key of keys) {
			const { [key]: _dropped, ...missing } = MIGRATION_PAYLOAD;
			expect({ key, accepted: schema.safeParse(missing).success }).toEqual({
				key,
				accepted: false,
			});
		}
	});

	it("rejects a deadline that is not an ISO-8601 instant, and a non-uuid id", () => {
		const bad = [
			{ ...MIGRATION_PAYLOAD, newDeadline: "31 Dec 2026" },
			{ ...MIGRATION_PAYLOAD, previousDeadline: "2026-11-05 23:45" },
			{ ...MIGRATION_PAYLOAD, marketId: "not-a-uuid" },
		];
		for (const payload of bad) {
			expect({ payload, accepted: schema.safeParse(payload).success }).toEqual({
				payload,
				accepted: false,
			});
		}
	});
});
