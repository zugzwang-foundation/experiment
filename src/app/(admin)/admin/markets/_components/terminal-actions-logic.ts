// UI.6 S2 — client-safe, PURE decision logic for the terminal-market-action
// typed hard-confirm gate + typed error copy (§2.S2, web-ratified D-2/R-4/R-5).
// No IO, no DB, no React, no server-only: import-safe inside the "use client"
// TerminalActions island AND unit-testable in the Node env. The four wire
// actions (Close / Resolve / Void / Correct) are built + tested elsewhere; this
// module owns only the gate/copy/render-matrix contract.

export type TerminalAction = "close" | "resolve" | "void" | "correct";

export type MarketStatus =
	| "Draft"
	| "Open"
	| "Closed"
	| "Resolving"
	| "Resolved"
	| "Voided"
	| "Frozen";

/**
 * The conditional-render matrix (plan §2.S2). Close only when Open; Resolve when
 * Closed/Resolving; Void when Open/Closed; Correct when Resolved. Draft (Seed is
 * a separate, out-of-scope affordance) and the terminal Voided/Frozen states
 * offer no terminal action. This mirrors each wire action's server-side Pre — it
 * is UX gating, never the authoritative gate (the service + state machine are).
 */
export function actionsForStatus(status: MarketStatus): TerminalAction[] {
	switch (status) {
		case "Open":
			return ["close", "void"];
		case "Closed":
			return ["resolve", "void"];
		case "Resolving":
			return ["resolve"];
		case "Resolved":
			return ["correct"];
		default:
			return [];
	}
}

/**
 * Whether an action requires typing the market question to arm submit. Close is
 * reversible in effect (no settlement) → one-click. Resolve / Void / Correct are
 * irreversible against an append-only lineage (INV-4) → hard typed confirm; and
 * Correct (F-RESOLVE-2, R-4) must not carry LESS friction than the resolution it
 * repairs, so it is gated too.
 */
export function requiresTypedConfirm(action: TerminalAction): boolean {
	return action !== "close";
}

/** Trimmed, CASE-INSENSITIVE equality against the market question (D-2). */
export function isTypedConfirmMatch(typed: string, title: string): boolean {
	return typed.trim().toLowerCase() === title.trim().toLowerCase();
}

/** Close: always enabled. Gated actions: enabled only on a typed-question match. */
export function isSubmitEnabled(
	action: TerminalAction,
	typed: string,
	title: string,
): boolean {
	if (!requiresTypedConfirm(action)) return true;
	return isTypedConfirmMatch(typed, title);
}

export interface TerminalActionInput {
	marketId: string;
	/** winningSide (resolve) / correctedSide (correct); ignored by close/void. */
	side?: "YES" | "NO";
	reason?: string;
}

/**
 * The EXACT FormData field set each wire action consumes (plan §0.1). Close →
 * `{marketId}`; Resolve → `{marketId, winningSide, reason}`; Void →
 * `{marketId, reason}`; Correct → `{marketId, correctedSide, reason}`. No stray
 * keys — the single source of truth the client island posts through.
 */
export function terminalActionFields(
	action: TerminalAction,
	input: TerminalActionInput,
): Record<string, string> {
	const reason = input.reason ?? "";
	const side = input.side ?? "YES";
	switch (action) {
		case "close":
			return { marketId: input.marketId };
		case "resolve":
			return { marketId: input.marketId, winningSide: side, reason };
		case "void":
			return { marketId: input.marketId, reason };
		case "correct":
			return { marketId: input.marketId, correctedSide: side, reason };
	}
}

export interface TerminalActionError {
	code: string;
	message: string;
	field_errors?: Record<string, string[]>;
}

/**
 * The typed-copy map (plan §2.S2). Each stable `error.code` → a fixed
 * human sentence. The rendered copy is NEVER the raw code and NEVER the wire
 * `.message` — even the wire's curated `.message` is not echoed, so a future
 * action returning a raw `.message` cannot leak internals to the operator.
 */
const ERROR_COPY: Record<string, string> = {
	admin_session_required:
		"Your admin session has expired — sign in again to continue.",
	illegal_edge: "That action is not legal for the market's current state.",
	correction_same_outcome: "The correction must change the outcome.",
	error_resolution_serialization_exhausted:
		"The system is busy — please retry.",
	// close under pool-row contention (racing the cron close-due sweep) surfaces
	// the lifecycle serialization variant — same operator copy as the resolution
	// variant above.
	lifecycle_serialization_exhausted: "The system is busy — please retry.",
	market_not_open: "The market is not Open.",
	deadline_not_reached:
		"The market's resolution deadline has not been reached yet.",
	error_internal: "Something went wrong — please try again.",
};

const FALLBACK_COPY = "That action could not be completed — please try again.";

/**
 * Map an ActionResult error to operator-facing copy. `validation_error` surfaces
 * the flattened per-field messages; every other known code maps to its fixed
 * sentence; an unknown code falls back to a generic human string. Returns a
 * non-empty `string[]` (one line per field message, or a single sentence).
 */
export function terminalErrorCopy(error: TerminalActionError): string[] {
	if (error.code === "validation_error" && error.field_errors) {
		const lines: string[] = [];
		for (const messages of Object.values(error.field_errors)) {
			for (const message of messages) lines.push(message);
		}
		if (lines.length > 0) return lines;
	}
	return [ERROR_COPY[error.code] ?? FALLBACK_COPY];
}
