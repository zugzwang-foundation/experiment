/**
 * DATASET.1 — egress-layer errors.
 *
 * These are deliberately NOT registered in `src/lib/errors.ts`'s
 * `DomainErrorKind` union. That union maps 1:1 onto the HTTP error envelope
 * (`error_<kind>`), and an egress violation has no wire surface: it is a
 * build-time failure of the offline export pipeline, raised before any file
 * is written and never rendered to a participant. Registering it there would
 * mint a wire code for a condition that can never reach the wire.
 *
 * Local-module error classes follow the `src/server/lots/errors.ts` pattern.
 */

/** One violated rule, at one location, in one artifact. */
export interface EgressViolation {
	/** The assertion that fired, e.g. `no-raw-user-id`. */
	readonly rule: string;
	/** What was being written — a table name or an artifact path. */
	readonly artifact: string;
	/**
	 * Where inside the artifact. A JSON path (`[3].metadata.ip`) for
	 * structured rows; a line reference (`line 12`) for rendered text.
	 */
	readonly path: string;
	/**
	 * What was found. ⚠ NEVER the offending value itself — a violation
	 * report that quotes the leaked email into a build log has moved the
	 * leak rather than reported it. Carries the KEY, or a redacted
	 * fingerprint of the value, and never the value.
	 */
	readonly detail: string;
}

/**
 * Raised when any egress assertion fails. Carries every violation found,
 * not just the first — a pipeline run that fails should tell the operator
 * everything that is wrong in one pass, because the alternative is
 * discovering them one build at a time on the morning of 6 November.
 */
export class EgressViolationError extends Error {
	readonly kind = "egress_violation" as const;

	constructor(public readonly violations: readonly EgressViolation[]) {
		super(
			`egress_violation: ${violations.length} violation(s)\n${violations
				.map((v) => `  · [${v.rule}] ${v.artifact} @ ${v.path} — ${v.detail}`)
				.join("\n")}`,
		);
		this.name = "EgressViolationError";
	}
}

/**
 * Raised when the egress layer is asked to guard something it has no rule
 * for — an unclassified table, an event type with no strip rule. Distinct
 * from a violation: a violation means "the data is wrong", this means "the
 * CONTRACT is incomplete", and the two want different fixes.
 *
 * Silence is the defect (brief §4 Slice 3). This is how silence speaks.
 */
export class EgressContractGapError extends Error {
	readonly kind = "egress_contract_gap" as const;

	constructor(
		public readonly subject: string,
		public readonly reason: string,
	) {
		super(`egress_contract_gap: ${subject} — ${reason}`);
		this.name = "EgressContractGapError";
	}
}
