import { describe, expect, it, vi } from "vitest";

/**
 * DATASET.1 Slice 2 — the STRIP-rule completeness guard, driven through its
 * REAL throwing path.
 *
 * ⚠ **Why this file exists separately from `completeness.test.ts`.**
 *
 * That file's two "the thrown error" tests construct an `EgressContractGapError`
 * with a message the TEST wrote, and then assert that message contains the
 * strings the test just put in it. They are consistent with
 * `assertStripRulesComplete` never throwing at all, and with its message being
 * the empty string — the assertion is about a literal in the test, not about
 * anything in `src/`. Mutating `assertStripRulesComplete`'s body to `return;`
 * leaves the whole export suite green.
 *
 * The failing shape has to be constructed at the INPUT, not at the assertion.
 * `assertStripRulesComplete()` takes no arguments and reads the runtime
 * `EVENT_TYPES`, so the only way in is to mock that module — which is also the
 * exact real-world shape of the defect: somebody adds an event type and does
 * not add its §19.4.1 rule.
 *
 * The mock is file-scoped, which is why the live-registry assertions stay in
 * `completeness.test.ts` and only the gap lives here.
 */

vi.mock("@/server/events/schemas", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/server/events/schemas")>();
	return {
		...actual,
		// The defect, constructed: a 25th event type with no PAYLOAD_STRIP_KEYS
		// entry. Named for what it would carry, so a reader can see immediately
		// why shipping its payload unreviewed would be a privacy failure.
		EVENT_TYPES: [...actual.EVENT_TYPES, "user.email_changed"],
	};
});

describe("strip-rule completeness · the REAL throw, not a reconstruction", () => {
	it("assertStripRulesComplete THROWS when a live event type has no rule", async () => {
		const { assertStripRulesComplete } = await import(
			"@/server/export/egress/completeness"
		);
		const { EgressContractGapError } = await import(
			"@/server/export/egress/errors"
		);

		expect(() => assertStripRulesComplete()).toThrow(EgressContractGapError);
	});

	it("the REAL message names the type and carries the remedy", async () => {
		// A build failure at 06:00 on 6 November that says "contract gap" and
		// stops has spent the operator's time without spending their confusion.
		// These assertions are over `completeness.ts`'s own string — deleting the
		// remedy from it fails here, which is what the reconstructed version in
		// `completeness.test.ts` could not do.
		const { assertStripRulesComplete } = await import(
			"@/server/export/egress/completeness"
		);

		let message = "";
		try {
			assertStripRulesComplete();
		} catch (e) {
			message = (e as Error).message;
		}

		expect(message).toContain("user.email_changed");
		expect(message).toContain("PAYLOAD_STRIP_KEYS");
		expect(message).toContain("§19.4.1");
		// '[]' is a legal answer. Without saying so, the fastest-looking fix for
		// an event type with nothing to strip is to delete the guard.
		expect(message).toContain("[]");
	});

	it("verifyStripRuleCompleteness reports the gap against the LIVE array", async () => {
		const { verifyStripRuleCompleteness } = await import(
			"@/server/export/egress/completeness"
		);
		const report = verifyStripRuleCompleteness();

		expect(report.missingRules).toEqual(["user.email_changed"]);
		expect(report.eventTypes).toHaveLength(25);
	});

	it("buildDataset REFUSES to read a row while the gap exists", async () => {
		// Pins `build.ts`'s contract-check preamble, which nothing else does:
		// deleting `assertStripRulesComplete()` from `buildDataset` leaves every
		// other test in the export suite green. The claim in that file's docblock
		// — "contract checks run BEFORE the first read" — is otherwise unasserted.
		const { buildDataset } = await import("@/server/export/dataset/build");
		const { EgressContractGapError } = await import(
			"@/server/export/egress/errors"
		);

		let readAttempts = 0;
		const source = {
			label: "gap-probe",
			read: async () => {
				readAttempts++;
				return [];
			},
		};

		await expect(
			buildDataset({ source, releaseDate: "2026-11-06" }),
		).rejects.toBeInstanceOf(EgressContractGapError);
		// BEFORE the first read — not merely "eventually".
		expect(readAttempts).toBe(0);
	});
});
