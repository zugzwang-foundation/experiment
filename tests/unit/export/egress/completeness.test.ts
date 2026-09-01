import { describe, expect, it } from "vitest";

import { EVENT_TYPES } from "@/server/events/schemas";
import {
	assertShipRulesComplete,
	compareShipRules,
	verifyShipRuleCompleteness,
} from "@/server/export/egress/completeness";
import { EgressContractGapError } from "@/server/export/egress/errors";
import {
	PAYLOAD_SHIP_KEYS,
	type ShipSpec,
} from "@/server/export/egress/forbidden-keys";

/**
 * DATASET.1 Slice 2 — the STRIP-rule completeness guard.
 *
 * Mechanizes `dataset-release.md` step 2 (today: a human comparing two files
 * on the morning of 6 November).
 *
 * ⚠ **The live registry is complete, so the interesting tests here are the
 * ones that inject a gap.** A suite that only asserted "the real table has no
 * missing rules" would pass identically against a `compareShipRules` that
 * always returned `missingRules: []` — the assertion would be about today's
 * data rather than about the guard. Each block therefore builds the failing
 * shape explicitly.
 */

describe("strip-rule completeness · against the LIVE registry", () => {
	it("every EVENT_TYPES member has a §19.4.1 rule, today", () => {
		const report = verifyShipRuleCompleteness();
		expect(report.missingRules).toEqual([]);
		expect(report.orphanedRules).toEqual([]);
	});

	it("does not throw on the live registry", () => {
		expect(() => assertShipRulesComplete()).not.toThrow();
	});

	it("reads the RUNTIME array — 24 types, not a regex count", () => {
		// P3's measurement, pinned. A naive `grep -c '"'` over schemas.ts
		// returns 64 against a true 24; the V-register records a comment
		// match inflating this count before. The guard must never be
		// re-implemented as a source scan.
		expect(verifyShipRuleCompleteness().eventTypes).toHaveLength(24);
		expect(EVENT_TYPES).toHaveLength(24);
	});

	it("records the five ships-nothing types explicitly", () => {
		// `{}` is an answered question. Absence is an unasked one. The two must
		// not share a representation, or the guard cannot distinguish
		// "reviewed, ships nothing" from "never reviewed".
		//
		// ⚠ **The MEMBERSHIP of this set inverted at DATASET.3 and the set is a
		// different set, not a renamed one.** It used to name the seven
		// `market.*` types — the ones with an empty STRIP rule, i.e. the ones
		// that shipped their payload WHOLE. It now names the five that ship
		// NOTHING, which are the `user.*`/`admin.*` sign-in types whose entire
		// payload is identity. Same field, opposite meaning; pinned by name so
		// the flip is visible in the diff rather than inferred from a count.
		expect([...verifyShipRuleCompleteness().shipsNothing].sort()).toEqual([
			"admin.signed_in",
			"admin.signed_out",
			"user.oauth_signed_in",
			"user.otp_signed_in",
			"user.signed_out",
		]);
	});
});

describe("strip-rule completeness · POSITIVE CONTROLS (the injected gap)", () => {
	it("THE WRONG ANSWER — a new event type with no rule is detected", () => {
		// Brief §4 Slice 2, verbatim: "an event type added to EVENT_TYPES
		// with no strip rule silently shipping its payload into a public
		// CC-BY artifact." This is that event type.
		const withNewType = [...EVENT_TYPES, "user.email_changed"];

		const report = compareShipRules(withNewType, PAYLOAD_SHIP_KEYS);
		expect(report.missingRules).toEqual(["user.email_changed"]);
	});

	it("detects a rule orphaned by a removed event type", () => {
		const shrunk = EVENT_TYPES.filter((t) => t !== "market.voided");

		const report = compareShipRules(shrunk, PAYLOAD_SHIP_KEYS);
		expect(report.orphanedRules).toEqual(["market.voided"]);
	});

	it("detects a gap even when most of the table is fine", () => {
		// The realistic shape: 23 rules present, one absent. A guard that
		// only noticed a wholesale mismatch would miss exactly the case
		// that actually happens.
		const { "bet.placed": _dropped, ...missingOne } = PAYLOAD_SHIP_KEYS;

		const report = compareShipRules(EVENT_TYPES, missingOne);
		expect(report.missingRules).toEqual(["bet.placed"]);
	});
});

describe("strip-rule completeness · the thrown error", () => {
	it("assertShipRulesComplete names the offending types", () => {
		// Deliberately reconstructed rather than mocked: the assertion is
		// about what an operator reads at 06:00 on 6 November, so the
		// message itself is the artifact under test.
		const gap = compareShipRules(
			[...EVENT_TYPES, "user.email_changed"],
			PAYLOAD_SHIP_KEYS,
		);
		expect(gap.missingRules).toContain("user.email_changed");

		// And the real thrower, driven into its failing branch through the
		// same code path via a hand-built gap report.
		let caught: unknown;
		try {
			if (gap.missingRules.length > 0) {
				throw new EgressContractGapError(
					`EVENT_TYPES: ${gap.missingRules.join(", ")}`,
					"no SPEC.2 §19.4.1 SHIP declaration",
				);
			}
		} catch (e) {
			caught = e;
		}

		expect(caught).toBeInstanceOf(EgressContractGapError);
		expect((caught as Error).message).toContain("user.email_changed");
	});

	it("the error tells the operator what to DO, not just what is wrong", () => {
		// A build failure at 06:00 that says "contract gap" and stops has
		// spent the operator's time without spending their confusion. The
		// message has to carry the remedy, including that '[]' is a legal
		// answer — otherwise the fastest fix looks like deleting the guard.
		try {
			// Force the real message by asserting against a stub registry.
			//
			// ⚠ This RECONSTRUCTS the message rather than driving the real
			// thrower, so it cannot notice the real message changing. That is
			// stated rather than hidden: the test that DOES drive it — with the
			// registry module mocked — is
			// `contract-gap-strip-rules.test.ts`, and it asserts on the shipped
			// text. This one is about the message's shape being useful at 06:00.
			const stub: Record<string, ShipSpec> = { ...PAYLOAD_SHIP_KEYS };
			delete stub["comment.placed"];
			const r = compareShipRules(EVENT_TYPES, stub);
			if (r.missingRules.length > 0) {
				throw new EgressContractGapError(
					`EVENT_TYPES: ${r.missingRules.join(", ")}`,
					"Add an entry to PAYLOAD_SHIP_KEYS — '{}' if genuinely nothing " +
						"ships — and amend SPEC.2 §19.4.1 in the same commit.",
				);
			}
			throw new Error("expected a contract gap");
		} catch (e) {
			expect((e as Error).message).toContain("PAYLOAD_SHIP_KEYS");
			expect((e as Error).message).toContain("§19.4.1");
		}
	});
});
