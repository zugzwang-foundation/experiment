import { describe, expect, it } from "vitest";

import {
	pseudonymizeAggregateId,
	pseudonymizeRow,
	REDACTED_ADMIN_SESSION,
} from "@/server/export/dataset/pseudonymize";
import {
	PAYLOAD_BEARING_TABLES,
	stripRow,
	stripTable,
} from "@/server/export/dataset/strip";
import { EgressContractGapError } from "@/server/export/egress/errors";
import {
	GLOBALLY_FORBIDDEN_PAYLOAD_KEYS,
	PAYLOAD_STRIP_KEYS,
} from "@/server/export/egress/forbidden-keys";

import {
	DIRTY_EVENT_ROWS,
	DIRTY_TABLE_ROWS,
	FIXTURE_SECRET_VALUES,
	FIXTURE_USER_IDS,
} from "../../../_fixtures/dataset/dirty-source";

/**
 * DATASET.1 — the three places the pipeline deliberately departs from SPEC.2,
 * each with a guard that NAMES the departure.
 *
 * ⚠ **Why a file of its own.** All three divergences are already guarded — a
 * mutation reverting any one of them goes red. But two of the three are killed
 * only by generic end-to-end assertions (*"events — transformed output is
 * egress-clean"*, *"no raw users.id survives ANYWHERE"*), and the NAMED test for
 * the row a divergence is about does not mention it: `guard 1 ·
 * user.tos_accepted` asserts `ip` and `user_agent` are gone and says nothing
 * about `userId`, which is the one key that row diverges over.
 *
 * That matters on the day somebody reads the spec, sees the pipeline strip a
 * key §19.4.1 does not name, and "corrects" it. What they will grep for is the
 * event type and the key. If the only thing that fails is a test named after a
 * whole table being clean, the revert looks like a tidy-up and the failure looks
 * unrelated.
 *
 * Each block below states which spec text it departs from, and asserts the
 * mechanism as well as the outcome — so the test cannot be satisfied by the
 * outcome arriving for some other reason.
 */

const AMBER = FIXTURE_USER_IDS.amber;

const sourceEvent = (t: string) => {
	const row = DIRTY_EVENT_ROWS.find((r) => r.event_type === t);
	if (!row) throw new Error(`fixture has no ${t} row`);
	return row;
};

// ── divergence 1 ──────────────────────────────────────────────────────────

describe("divergence 1 · user.tos_accepted payload.userId is STRIPPED", () => {
	/**
	 * §19.4.1's per-row table strips `payload.userId` from all four sibling
	 * `user.*` types and NOT from `user.tos_accepted`; `dataset-release.md`
	 * step 7 reads the omission as intentional and expects that row's payload to
	 * *"show userId"*. Appendix B.13 lists `userId` in the general strip set for
	 * `events.payload`, and B is the exhaustive authority (§19.8).
	 *
	 * The pipeline follows B. This block is why that is not an accident.
	 */

	it("the PER-TYPE rule does NOT name userId — so it cannot be the cause", () => {
		// The control that makes the next assertion mean something. If the rule
		// DID name `userId`, the strip below would prove nothing about the
		// global net, and reverting the divergence would leave this file green.
		expect(PAYLOAD_STRIP_KEYS["user.tos_accepted"]).toEqual([
			"ip",
			"user_agent",
		]);
		expect(PAYLOAD_STRIP_KEYS["user.tos_accepted"]).not.toContain("userId");
	});

	it("the GLOBAL net is what removes it, and it names userId", () => {
		expect(GLOBALLY_FORBIDDEN_PAYLOAD_KEYS).toContain("userId");
	});

	it("POSITIVE CONTROL — the source row provably carries a raw users.id", () => {
		expect(sourceEvent("user.tos_accepted").payload.userId).toBe(AMBER);
	});

	it("the stripped payload carries neither the KEY nor the VALUE", () => {
		const stripped = stripTable("events", [sourceEvent("user.tos_accepted")], {
			removedCommentIds: new Set(),
		});
		const payload = stripped[0]?.payload as Record<string, unknown>;

		// The key, and — separately — the value, because a rename would defeat
		// the first assertion while leaving the id in the artifact.
		expect(payload).not.toHaveProperty("userId");
		expect(JSON.stringify(payload)).not.toContain(AMBER);

		// …and the research keys the row exists for still survive. A strip that
		// emptied the payload would pass both absence assertions above.
		expect(payload).toHaveProperty("tosVersionHash");
		expect(payload).toHaveProperty("privacyVersionHash");
	});
});

// ── divergence 2 ──────────────────────────────────────────────────────────

describe("divergence 2 · the §19.4.1 payload rules apply to all THREE payload-bearing tables", () => {
	/**
	 * §19.4.1 is written as though only `events.payload` existed. Appendix B.11
	 * and B.12 give `admin_events.payload` and `user_events.payload` a bare
	 * `SHIP` with no strip rules — but those rows carry the same `admin.signed_in`
	 * / `user.tos_accepted` facts, with the same `sessionId` and `ip` keys
	 * §19.4.1 strips from `events`. Stripping one table and publishing its twin
	 * is not a policy anybody chose.
	 *
	 * Latent today (both tables have zero writers, so both ship empty) and
	 * un-latent the moment `ADMIN-EVENTS-WRITER`'s option (a) lands, which
	 * projects `events` into `admin_events`.
	 */

	it("all three tables are declared payload-bearing", () => {
		expect([...PAYLOAD_BEARING_TABLES].sort()).toEqual([
			"admin_events",
			"events",
			"user_events",
		]);
	});

	it("POSITIVE CONTROL — both source rows carry their secrets", () => {
		const ae = DIRTY_TABLE_ROWS.admin_events[0];
		const ue = DIRTY_TABLE_ROWS.user_events[0];

		expect(ae?.payload).toHaveProperty("sessionId");
		expect(ae?.payload).toHaveProperty("ip");
		expect(ue?.payload).toHaveProperty("ip");
	});

	it("admin_events.payload loses sessionId and ip — key AND value", () => {
		const [out] = stripTable("admin_events", DIRTY_TABLE_ROWS.admin_events, {
			removedCommentIds: new Set(),
		});
		const payload = out?.payload as Record<string, unknown>;

		expect(payload).not.toHaveProperty("sessionId");
		expect(payload).not.toHaveProperty("ip");
		const json = JSON.stringify(payload);
		expect(json).not.toContain(FIXTURE_SECRET_VALUES.adminSessionIds[0]);
		expect(json).not.toContain(FIXTURE_SECRET_VALUES.ips[2]);
	});

	it("user_events.payload loses ip while its research key survives", () => {
		const [out] = stripTable("user_events", DIRTY_TABLE_ROWS.user_events, {
			removedCommentIds: new Set(),
		});
		const payload = out?.payload as Record<string, unknown>;

		expect(payload).not.toHaveProperty("ip");
		expect(JSON.stringify(payload)).not.toContain(FIXTURE_SECRET_VALUES.ips[1]);
		expect(payload).toHaveProperty("tosVersionHash");
	});
});

// ── divergence 3 ──────────────────────────────────────────────────────────

describe("divergence 3 · admin_session aggregate_id is REDACTED, not shipped raw", () => {
	/**
	 * Appendix B.13 rules `admin_session` `aggregate_id` *"SHIPs raw"*, while
	 * §19.4.1 strips the SAME value from `payload.sessionId` one field over and
	 * §19.3 row 21 withholds the whole `admin_sessions` table. The pipeline
	 * redacts. `transform.test.ts` already pins the return value; what is added
	 * here is that the substitute is a FIXED sentinel rather than a derived
	 * token, which is the thing §19.4's strip-not-hash policy actually forbids.
	 */

	it("substitutes a fixed literal — not a hash, not a per-session token", () => {
		const [a, b] = FIXTURE_SECRET_VALUES.adminSessionIds;
		const map = new Map<string, string>();

		const outA = pseudonymizeAggregateId("admin_session", a, map, "t");
		const outB = pseudonymizeAggregateId("admin_session", b, map, "t");

		// Two DIFFERENT session ids must produce the SAME output. A hash or an
		// opaque per-session token would satisfy "not the raw value" while
		// preserving exactly the correlation §19.3 row 21 withholds.
		expect(outA).toBe(REDACTED_ADMIN_SESSION);
		expect(outB).toBe(REDACTED_ADMIN_SESSION);
		expect(outA).toBe(outB);
	});
});

// ── fail-closed on a table nobody classified ─────────────────────────────

describe("strip + pseudonymize fail CLOSED on an unclassified table", () => {
	/**
	 * ⚠ Neither `stripRow`'s nor `pseudonymizeRow`'s
	 * *"no Appendix B per-column treatment block"* throw was exercised by any
	 * test. Mutating either to `return { ...row }` — the pass-through a
	 * reasonable person writes without thinking — left the whole export suite
	 * green, which is the shape both docblocks say they exist to prevent.
	 *
	 * `lots` is the right subject rather than an invented name: it is a real
	 * live table, deliberately `UNDECIDED`, and Appendix B.19 deliberately gives
	 * it no per-column section. It is the table this guard would actually meet.
	 */

	const lotsRow = {
		id: "0192f3a4-1010-7000-8000-00000000lo01",
		user_id: AMBER,
		bet_id: "0192f3a4-dddd-7000-8000-00000000be01",
		surviving_shares: "50.000000000000000000",
	};

	it("stripRow THROWS rather than passing an unclassified table through", () => {
		expect(() =>
			stripRow("lots", lotsRow, { removedCommentIds: new Set() }),
		).toThrow(EgressContractGapError);
	});

	it("pseudonymizeRow THROWS on the same table", () => {
		const map = new Map([[AMBER, "AmberOtter042"]]);
		expect(() => pseudonymizeRow("lots", lotsRow, map)).toThrow(
			EgressContractGapError,
		);
	});

	it("the thrown message names the table and the missing authority", () => {
		let message = "";
		try {
			stripRow("lots", lotsRow, { removedCommentIds: new Set() });
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).toContain("lots");
		expect(message).toContain("Appendix B");
	});

	it("POSITIVE CONTROL — a CLASSIFIED table with the same shape does not throw", () => {
		// Proves the throw comes from the missing treatment block and not from
		// the row's shape, which is otherwise indistinguishable.
		expect(() =>
			stripRow("positions", lotsRow, { removedCommentIds: new Set() }),
		).not.toThrow();
	});
});
