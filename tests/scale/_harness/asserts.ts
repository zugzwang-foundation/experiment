// ENGINE.10 storm-outcome assertions. Plan §5 contract: under an engineered
// collision storm, every write either commits-correct OR surfaces a DOCUMENTED
// terminal error — NEVER a torn state, and never an UNDOCUMENTED error masking a
// real bug behind a still-reconciling end state. The end-state reconciliation
// (conservation + ledger chain + count parity) proves "never torn"; this guards
// the other half of the contract — the rejection TAXONOMY (code-reviewer
// MEDIUM-2). It is the error-shape half, NOT a count assertion (flake guard:
// never asserts HOW MANY retried/rejected, only that each rejection is expected).

/** The W-1/W-3 typed terminal errors + the friendly/structural rejects a storm
 *  legitimately produces (matched by `.name` — import-free, robust to wrapping). */
const DOCUMENTED_ERROR_NAMES = new Set<string>([
	// W-1 bet spine (src/server/bets/errors.ts)
	"BetSerializationExhaustedError", // 40001/40P01 retry budget exhausted (alarm-3)
	"MarketNotOpenError", // status re-read saw non-Open after the flip
	"InsufficientDharmaError", // friendly overdraft pre-check
	"OppositeSideHeldError", // single-side-per-user
	"PositionNotHeldError", // sell with no held position
	"PositionSingleSideError", // positions one-held-side
	// W-3 resolution spine (src/server/resolution/errors.ts)
	"ResolutionSerializationExhaustedError",
	"ResolutionStateError",
	"CorrectionOutcomeError",
	// admin-actor belt (src/server/admin/actor.ts)
	"AdminActorError",
]);

/** The retryable + constraint SQLSTATEs a storm legitimately surfaces at the
 *  storage layer: serialization_failure / deadlock (when the wrapper budget is
 *  spent and the raw driver error bubbles), unique_violation (idempotency /
 *  daily-allowance backstops), check_violation (the balance_after >= 0 backstop). */
const DOCUMENTED_SQLSTATES = new Set<string>([
	"40001",
	"40P01",
	"23505",
	"23514",
]);

/** True when a rejection reason is one of the plan §5 documented terminal errors
 *  (a typed product error by name, or a documented SQLSTATE on `.code`/`.cause.code`). */
export function isDocumentedTerminal(reason: unknown): boolean {
	const e = reason as {
		name?: unknown;
		code?: unknown;
		cause?: { code?: unknown };
	};
	if (typeof e?.name === "string" && DOCUMENTED_ERROR_NAMES.has(e.name)) {
		return true;
	}
	const code = e?.cause?.code ?? e?.code;
	return typeof code === "string" && DOCUMENTED_SQLSTATES.has(code);
}

/**
 * Assert EVERY rejected storm outcome is a documented terminal error (plan §5).
 * An undocumented rejection means a write failed in a way the engine does not
 * sanction — a real bug that the end-state reconciliation might still absorb.
 * Throws with a sample of the offending error(s). NOT a count assertion.
 */
export function assertDocumentedRejections<T>(
	results: ReadonlyArray<PromiseSettledResult<T>>,
): void {
	const undocumented = results
		.filter((r): r is PromiseRejectedResult => r.status === "rejected")
		.filter((r) => !isDocumentedTerminal(r.reason));
	if (undocumented.length > 0) {
		const sample = undocumented.slice(0, 3).map((r) => {
			const e = r.reason as { name?: string; message?: string };
			return `${e?.name ?? "?"}: ${e?.message ?? String(r.reason)}`;
		});
		throw new Error(
			`undocumented storm rejection(s) (${undocumented.length} of ${results.length}): ${JSON.stringify(sample)}`,
		);
	}
}
