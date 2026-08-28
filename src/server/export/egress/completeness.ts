import { EVENT_TYPES, type EventType } from "@/server/events/event-types";

import { EgressContractGapError } from "./errors";
import { PAYLOAD_STRIP_KEYS } from "./forbidden-keys";

/**
 * DATASET.1 Slice 2 — the STRIP-rule completeness guard.
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
 * An `event_type` added to `EVENT_TYPES` with no §19.4.1 strip rule, silently
 * shipping its whole payload into a public CC-BY-4.0 artifact. That payload
 * has never been PII-reviewed — the review is the §19.4.1 table entry.
 *
 * ## Two layers, deliberately
 *
 * `PAYLOAD_STRIP_KEYS` is declared `satisfies Record<EventType, …>`, so the
 * gap is a **compile** error first (O-1 — structural beats procedural). This
 * runtime guard is the belt to that brace, and it is not redundant: a type
 * error is silenceable with one `as`, an `@ts-expect-error`, or a `Partial<>`
 * that looks like a tidy-up in review. The runtime check is not.
 *
 * ⚠ It reads the **runtime** `EVENT_TYPES` array, never a regex over the
 * source file. A naive `grep -c '"'` over `schemas.ts` returns 64 against a
 * true count of 24 — the V-register's comment-match inflation, measured again
 * here at P3.
 */

/** What `verifyStripRuleCompleteness` found. */
export interface CompletenessReport {
	/** Every `EVENT_TYPES` member, in declaration order. */
	readonly eventTypes: readonly EventType[];
	/** Types present in `EVENT_TYPES` with no §19.4.1 rule. The defect. */
	readonly missingRules: readonly string[];
	/** Rules declared for a type no longer in `EVENT_TYPES`. Also a defect. */
	readonly orphanedRules: readonly string[];
	/** Types whose rule is explicitly `[]` — answered, nothing to strip. */
	readonly noStripRequired: readonly string[];
}

/**
 * Compare the runtime `EVENT_TYPES` against the §19.4.1 rule table.
 *
 * Reports BOTH directions. A missing rule is the dangerous one — payload
 * ships unreviewed. An orphaned rule is the quieter one: it means an event
 * type was removed and the strip table was not updated, so the next reader
 * cannot tell whether the table is current, and a table nobody trusts stops
 * being consulted.
 */
export function verifyStripRuleCompleteness(): CompletenessReport {
	return compareStripRules(EVENT_TYPES, PAYLOAD_STRIP_KEYS);
}

/**
 * The pure comparison, with both sides injectable.
 *
 * ⚠ **Exported for the guard's own positive control, and that is not a
 * testing convenience.** The live registry is complete today, so a test that
 * could only call `verifyStripRuleCompleteness()` would assert
 * `missingRules === []` against a table that has no gap — passing equally
 * whether the comparison works or always returns empty. The control has to be
 * able to construct the failing shape, or it is not a control (OVN-V3).
 *
 * Production callers use `verifyStripRuleCompleteness()`; nothing in `src/`
 * should pass its own arguments here.
 */
export function compareStripRules(
	eventTypes: readonly string[],
	rules: Readonly<Record<string, readonly string[]>>,
): CompletenessReport {
	const declared = new Set(Object.keys(rules));
	const live = new Set(eventTypes);

	return {
		eventTypes: eventTypes as readonly EventType[],
		missingRules: eventTypes.filter((t) => !declared.has(t)),
		orphanedRules: [...declared].filter((t) => !live.has(t)).sort(),
		noStripRequired: eventTypes.filter((t) => rules[t]?.length === 0),
	};
}

/**
 * Throw unless every `EVENT_TYPES` member has a §19.4.1 rule.
 *
 * The build-facing entry point. Called by the CI guard test and by the
 * pipeline before it reads a single row — a pipeline that discovers the gap
 * after writing half the tables has already spent the operator's one shot.
 */
export function assertStripRulesComplete(): void {
	const report = verifyStripRuleCompleteness();

	if (report.missingRules.length > 0) {
		throw new EgressContractGapError(
			`EVENT_TYPES: ${report.missingRules.join(", ")}`,
			`${report.missingRules.length} event type(s) have no SPEC.2 §19.4.1 ` +
				`STRIP rule. Their payloads would ship verbatim into a public ` +
				`CC-BY-4.0 artifact without PII review. Add an entry to ` +
				`PAYLOAD_STRIP_KEYS — '[]' if genuinely nothing needs stripping, ` +
				`which is a decision to record rather than a default to fall into ` +
				`— and amend SPEC.2 §19.4.1 in the same commit.`,
		);
	}

	if (report.orphanedRules.length > 0) {
		throw new EgressContractGapError(
			`PAYLOAD_STRIP_KEYS: ${report.orphanedRules.join(", ")}`,
			`${report.orphanedRules.length} strip rule(s) name an event type that ` +
				`is no longer in EVENT_TYPES. Not dangerous, but it makes the table ` +
				`untrustworthy, and a table nobody trusts stops being read.`,
		);
	}
}
