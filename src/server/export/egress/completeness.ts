import { EVENT_TYPES, type EventType } from "@/server/events/event-types";

import { EgressContractGapError } from "./errors";
import { PAYLOAD_SHIP_KEYS, type ShipSpec } from "./forbidden-keys";

/**
 * DATASET.1 Slice 2 — the §19.4.1 declaration-completeness guard.
 *
 * Mechanizes `docs/runbooks/dataset-release.md` **step 2**, which today reads:
 *
 * > *"Verify SPEC.2 §19.4 + §19.4.1 strip-rules document is current. […] If an
 * > event_type exists in `src/server/events/schemas.ts` `EVENT_TYPES` array but
 * > has NO §19.4.1 entry → STOP and amend SPEC.2."*
 *
 * That is a human reading two files against each other, scheduled for the
 * morning of 6 November, on the one run of a one-shot pipeline, for an artifact
 * that cannot be un-published. This turns it into a build failure months
 * earlier, on the commit that introduces the gap.
 *
 * ## The wrong answer this must reject
 *
 * An `event_type` added to `EVENT_TYPES` with no §19.4.1 entry. Under the
 * deny-list this guard was written for, that shipped the type's WHOLE payload
 * into a public CC-BY-4.0 artifact. Since the DATASET.3 inversion it ships
 * nothing instead — but the guard is not thereby redundant, and the reason is
 * worth stating: **"ships nothing" is the right default and the wrong outcome.**
 * A whole event type silently exporting blank payloads deletes research data
 * from a corpus that is append-only and cannot be corrected after publication.
 * The guard's job changed from preventing a leak to preventing a silence.
 *
 * ## Two layers, deliberately
 *
 * `PAYLOAD_SHIP_KEYS` is declared `satisfies Record<EventType, …>`, so the
 * gap is a **compile** error first (O-1 — structural beats procedural). This
 * runtime guard is the belt to that brace, and it is not redundant: a type
 * error is silenceable with one `as`, an `@ts-expect-error`, or a `Partial<>`
 * that looks like a tidy-up in review. The runtime check is not.
 *
 * ⚠ **Neither layer sees a new KEY on an existing type**, and that gap is what
 * `tests/unit/export/egress/payload-ship-schema-parity.test.ts` covers, by
 * comparing the declaration against `eventPayloadSchemas`. This file answers
 * *"is every type declared?"* and has never answered *"is every key
 * classified?"* — a distinction `build.ts`'s `HARVEST_KEYS` docblock once got
 * wrong in the other direction (`@test-writer` HIGH-1b).
 *
 * ⚠ It reads the **runtime** `EVENT_TYPES` array, never a regex over the
 * source file. A naive `grep -c '"'` over `event-types.ts` returns 26 against
 * a true count of 24 — the V-register's comment-match inflation, re-measured
 * at DATASET.3 against the merged head.
 */

/** What `verifyShipRuleCompleteness` found. */
export interface CompletenessReport {
	/** Every `EVENT_TYPES` member, in declaration order. */
	readonly eventTypes: readonly EventType[];
	/** Types present in `EVENT_TYPES` with no §19.4.1 entry. The defect. */
	readonly missingRules: readonly string[];
	/** Entries declared for a type no longer in `EVENT_TYPES`. Also a defect. */
	readonly orphanedRules: readonly string[];
	/** Types whose declaration is explicitly `{}` — answered, ships nothing. */
	readonly shipsNothing: readonly string[];
}

/**
 * Compare the runtime `EVENT_TYPES` against the §19.4.1 declaration table.
 *
 * Reports BOTH directions. A missing entry is the dangerous one — the type's
 * payload exports blank, permanently, into an append-only corpus. An orphaned
 * entry is the quieter one: it means an event type was removed and the table
 * was not updated, so the next reader cannot tell whether the table is
 * current, and a table nobody trusts stops being consulted.
 */
export function verifyShipRuleCompleteness(): CompletenessReport {
	return compareShipRules(EVENT_TYPES, PAYLOAD_SHIP_KEYS);
}

/**
 * The pure comparison, with both sides injectable.
 *
 * ⚠ **Exported for the guard's own positive control, and that is not a
 * testing convenience.** The live registry is complete today, so a test that
 * could only call `verifyShipRuleCompleteness()` would assert
 * `missingRules === []` against a table that has no gap — passing equally
 * whether the comparison works or always returns empty. The control has to be
 * able to construct the failing shape, or it is not a control (OVN-V3).
 *
 * Production callers use `verifyShipRuleCompleteness()`; nothing in `src/`
 * should pass its own arguments here.
 */
export function compareShipRules(
	eventTypes: readonly string[],
	rules: Readonly<Record<string, ShipSpec>>,
): CompletenessReport {
	const declared = new Set(Object.keys(rules));
	const live = new Set(eventTypes);

	return {
		eventTypes: eventTypes as readonly EventType[],
		missingRules: eventTypes.filter((t) => !declared.has(t)),
		orphanedRules: [...declared].filter((t) => !live.has(t)).sort(),
		// ⚠ `Object.keys(spec).length === 0`, guarded on the entry EXISTING —
		// a missing entry has no keys either, and reporting it as "ships
		// nothing, decided" is exactly the conflation between an answered
		// question and an unasked one that this report exists to keep apart.
		shipsNothing: eventTypes.filter((t) => {
			const spec = rules[t];
			return spec !== undefined && Object.keys(spec).length === 0;
		}),
	};
}

/**
 * Throw unless every `EVENT_TYPES` member has a §19.4.1 declaration.
 *
 * The build-facing entry point. Called by the CI guard test and by the
 * pipeline before it reads a single row — a pipeline that discovers the gap
 * after writing half the tables has already spent the operator's one shot.
 */
export function assertShipRulesComplete(): void {
	const report = verifyShipRuleCompleteness();

	if (report.missingRules.length > 0) {
		throw new EgressContractGapError(
			`EVENT_TYPES: ${report.missingRules.join(", ")}`,
			`${report.missingRules.length} event type(s) have no SPEC.2 §19.4.1 ` +
				`SHIP declaration. Since the payload strip inverts to an allow-list ` +
				`they would export BLANK rather than leak — which is the safe ` +
				`default and still the wrong artifact: a whole event type's ` +
				`research content silently absent from an append-only corpus that ` +
				`cannot be corrected after publication. Add an entry to ` +
				`PAYLOAD_SHIP_KEYS — '{}' if genuinely nothing ships, which is a ` +
				`decision to record rather than a default to fall into — and amend ` +
				`SPEC.2 §19.4.1 in the same commit.`,
		);
	}

	if (report.orphanedRules.length > 0) {
		throw new EgressContractGapError(
			`PAYLOAD_SHIP_KEYS: ${report.orphanedRules.join(", ")}`,
			`${report.orphanedRules.length} declaration(s) name an event type that ` +
				`is no longer in EVENT_TYPES. Not dangerous, but it makes the table ` +
				`untrustworthy, and a table nobody trusts stops being read.`,
		);
	}
}
