import { describe, expect, it } from "vitest";

import {
	actionsForStatus,
	isSubmitEnabled,
	isTypedConfirmMatch,
	type MarketStatus,
	requiresTypedConfirm,
	type TerminalAction,
	terminalActionFields,
	terminalErrorCopy,
} from "@/app/(admin)/admin/markets/_components/terminal-actions-logic";

/**
 * UI-6 S2 tests-first (plan §2.S2 "Tests FIRST" + §7 S2 row; CLAUDE.md §5.6) —
 * the CLIENT-SAFE, PURE decision logic behind the typed hard-confirm gate and
 * typed error copy over the four built terminal market actions
 * (Close / Resolve / Void / Correct). No IO, no DB, no React: import-safe in a
 * client component AND unit-testable in the Node env.
 *
 * RED-FIRST: `src/app/(admin)/admin/markets/_components/terminal-actions-logic.ts`
 * does not exist yet, so every VALUE import above fails to resolve and this file
 * fails at COLLECTION until S2 lands. Nothing here re-tests settlement / CPMM /
 * ledger math — the four wire actions are built + tested elsewhere (plan §0.1 /
 * §5). This file pins ONLY the gate + copy + render-matrix contract.
 *
 * Contract under test (plan §2.S2, web-ratified D-2 / R-4 / R-5):
 *  - typed-confirm gate arms Resolve / Void / Correct on a TRIMMED,
 *    CASE-INSENSITIVE match of the market question; Close is one-click.
 *  - `terminalActionFields` posts the EXACT field set per action.
 *  - `terminalErrorCopy` renders human copy — NEVER a raw code, NEVER `.message`.
 *  - `actionsForStatus` is the conditional-render matrix over the 7 statuses.
 */

const MID = "0190c0de-1111-7000-8000-000000000001";
// A neutral placeholder question (CLAUDE.md §3 — never invent real market
// content). Mixed-case so the case-insensitive assertions are meaningful.
const TITLE = "Placeholder Market Question";

const ALL_STATUSES: MarketStatus[] = [
	"Draft",
	"Open",
	"Closed",
	"Resolving",
	"Resolved",
	"Voided",
	"Frozen",
];

const GATED_ACTIONS: TerminalAction[] = ["resolve", "void", "correct"];

// The ActionResult error codes the four wire actions actually emit
// (plan §0.1 wire-error map), EXCLUDING `validation_error` — which carries
// `field_errors` and is asserted on its own below.
const NON_VALIDATION_CODES = [
	"admin_session_required",
	"illegal_edge",
	"correction_same_outcome",
	"error_resolution_serialization_exhausted",
	"lifecycle_serialization_exhausted",
	"market_not_open",
	"deadline_not_reached",
	"error_internal",
];

describe("terminal-actions gate — requiresTypedConfirm (S2)", () => {
	it("typed-confirm-gate::close-needs-no-typed-confirm-others-do", () => {
		expect(requiresTypedConfirm("close")).toBe(false);
		expect(requiresTypedConfirm("resolve")).toBe(true);
		expect(requiresTypedConfirm("void")).toBe(true);
		expect(requiresTypedConfirm("correct")).toBe(true);
	});
});

describe("terminal-actions gate — isTypedConfirmMatch (S2)", () => {
	it("typed-confirm-match::trims-and-ignores-case", () => {
		// The plan's literal example: padded + mixed-case typed vs lowercase title.
		expect(isTypedConfirmMatch("  The Question  ", "the question")).toBe(true);

		// Against the fixture title, both sides trimmed + lowercased.
		expect(isTypedConfirmMatch(TITLE, TITLE)).toBe(true);
		expect(isTypedConfirmMatch(TITLE.toUpperCase(), TITLE)).toBe(true);
		expect(isTypedConfirmMatch(`  ${TITLE.toLowerCase()}  `, TITLE)).toBe(true);
		// Title side padded too — trimmed equality is symmetric.
		expect(isTypedConfirmMatch(TITLE, `   ${TITLE}   `)).toBe(true);
	});

	it("typed-confirm-match::rejects-near-miss-and-empty", () => {
		expect(isTypedConfirmMatch("Placeholder Market Questio", TITLE)).toBe(
			false,
		);
		expect(isTypedConfirmMatch("something else", TITLE)).toBe(false);
		expect(isTypedConfirmMatch("", TITLE)).toBe(false);
		// Whitespace-only trims to empty — never a match against a real question.
		expect(isTypedConfirmMatch("   ", TITLE)).toBe(false);
	});
});

describe("terminal-actions gate — isSubmitEnabled (S2)", () => {
	it("submit-enabled::close-is-always-enabled-regardless-of-typed", () => {
		expect(isSubmitEnabled("close", "", TITLE)).toBe(true);
		expect(isSubmitEnabled("close", "anything at all", TITLE)).toBe(true);
		expect(isSubmitEnabled("close", TITLE, TITLE)).toBe(true);
	});

	it("submit-enabled::gated-actions-arm-only-on-a-typed-question-match", () => {
		for (const action of GATED_ACTIONS) {
			// Disarmed until the question is typed.
			expect(isSubmitEnabled(action, "", TITLE)).toBe(false);
			expect(isSubmitEnabled(action, "wrong text", TITLE)).toBe(false);
			// Armed on a trimmed, case-insensitive match.
			expect(isSubmitEnabled(action, `  ${TITLE.toLowerCase()}  `, TITLE)).toBe(
				true,
			);
			expect(isSubmitEnabled(action, TITLE, TITLE)).toBe(true);
		}
	});
});

describe("terminal-actions — terminalActionFields exact field sets (S2)", () => {
	const input = { marketId: MID, side: "YES" as const, reason: "A reason." };

	it("action-fields::close-posts-only-marketId", () => {
		const fields = terminalActionFields("close", input);
		expect(fields).toEqual({ marketId: MID });
		// No stray keys — side / reason are dropped for close.
		expect(Object.keys(fields).sort()).toEqual(["marketId"]);
	});

	it("action-fields::resolve-posts-marketId-winningSide-reason", () => {
		const fields = terminalActionFields("resolve", input);
		expect(fields).toEqual({
			marketId: MID,
			winningSide: "YES",
			reason: "A reason.",
		});
		expect(Object.keys(fields).sort()).toEqual([
			"marketId",
			"reason",
			"winningSide",
		]);
	});

	it("action-fields::void-posts-marketId-reason", () => {
		const fields = terminalActionFields("void", input);
		expect(fields).toEqual({ marketId: MID, reason: "A reason." });
		expect(Object.keys(fields).sort()).toEqual(["marketId", "reason"]);
	});

	it("action-fields::correct-posts-marketId-correctedSide-reason", () => {
		const fields = terminalActionFields("correct", { ...input, side: "NO" });
		expect(fields).toEqual({
			marketId: MID,
			correctedSide: "NO",
			reason: "A reason.",
		});
		// The R-4 addition: correct carries `correctedSide`, never `winningSide`.
		expect(Object.keys(fields).sort()).toEqual([
			"correctedSide",
			"marketId",
			"reason",
		]);
	});
});

describe("terminal-actions — terminalErrorCopy is human, never raw (S2)", () => {
	// The CRITICAL law (plan §2.S2 typed error copy): the rendered strings must
	// NEVER equal or contain the raw `error.code`, and NEVER equal or contain the
	// raw `error.message`. A sentinel message proves the message is not echoed.
	for (const code of NON_VALIDATION_CODES) {
		it(`error-copy::${code}-renders-human-copy-not-raw`, () => {
			const message = `__RAW_MESSAGE_SENTINEL_${code}__`;
			const copy = terminalErrorCopy({ code, message });

			expect(Array.isArray(copy)).toBe(true);
			expect(copy.length).toBeGreaterThan(0);
			for (const line of copy) {
				expect(typeof line).toBe("string");
				expect(line.length).toBeGreaterThan(0);
				expect(line).not.toBe(code);
				expect(line).not.toContain(code);
				expect(line).not.toBe(message);
				expect(line).not.toContain(message);
			}
			const joined = copy.join(" ");
			expect(joined).not.toContain(code);
			expect(joined).not.toContain(message);
		});
	}

	it("error-copy::validation-error-surfaces-the-flattened-field-message", () => {
		const message = "__RAW_VALIDATION_MESSAGE__";
		const copy = terminalErrorCopy({
			code: "validation_error",
			message,
			field_errors: { reason: ["Required"] },
		});

		expect(copy.length).toBeGreaterThan(0);
		const joined = copy.join(" ");
		// The per-field message is what surfaces to the operator.
		expect(joined).toContain("Required");
		// Still never the raw code or the top-level message.
		expect(joined).not.toContain("validation_error");
		expect(joined).not.toContain(message);
	});

	it("error-copy::validation-error-flattens-every-field", () => {
		const copy = terminalErrorCopy({
			code: "validation_error",
			message: "ignored-top-level",
			field_errors: {
				reason: ["Reason is required"],
				winningSide: ["Choose a side"],
			},
		});
		const joined = copy.join(" ");
		expect(joined).toContain("Reason is required");
		expect(joined).toContain("Choose a side");
		expect(joined).not.toContain("validation_error");
	});

	it("error-copy::unknown-code-falls-back-to-a-human-string-not-the-code", () => {
		const code = "some_unknown_code_xyz";
		const message = "__RAW_UNKNOWN_MESSAGE__";
		const copy = terminalErrorCopy({ code, message });

		expect(copy.length).toBeGreaterThan(0);
		const joined = copy.join(" ");
		expect(joined.length).toBeGreaterThan(0);
		expect(joined).not.toBe(code);
		expect(joined).not.toContain(code);
		expect(joined).not.toContain(message);
	});
});

describe("terminal-actions — actionsForStatus conditional-render matrix (S2)", () => {
	it("actions-for-status::exact-arrays-per-status", () => {
		expect(actionsForStatus("Draft")).toEqual([]);
		expect(actionsForStatus("Open")).toEqual(["close", "void"]);
		expect(actionsForStatus("Closed")).toEqual(["resolve", "void"]);
		expect(actionsForStatus("Resolving")).toEqual(["resolve"]);
		expect(actionsForStatus("Resolved")).toEqual(["correct"]);
		expect(actionsForStatus("Voided")).toEqual([]);
		expect(actionsForStatus("Frozen")).toEqual([]);
	});

	it("actions-for-status::close-renders-only-when-open", () => {
		for (const status of ALL_STATUSES) {
			expect(actionsForStatus(status).includes("close")).toBe(
				status === "Open",
			);
		}
	});

	it("actions-for-status::resolve-renders-only-when-closed-or-resolving", () => {
		for (const status of ALL_STATUSES) {
			expect(actionsForStatus(status).includes("resolve")).toBe(
				status === "Closed" || status === "Resolving",
			);
		}
	});

	it("actions-for-status::void-renders-only-when-open-or-closed", () => {
		for (const status of ALL_STATUSES) {
			expect(actionsForStatus(status).includes("void")).toBe(
				status === "Open" || status === "Closed",
			);
		}
	});

	it("actions-for-status::correct-renders-only-when-resolved", () => {
		for (const status of ALL_STATUSES) {
			expect(actionsForStatus(status).includes("correct")).toBe(
				status === "Resolved",
			);
		}
	});

	it("actions-for-status::terminal-and-draft-states-offer-no-actions", () => {
		expect(actionsForStatus("Draft")).toHaveLength(0);
		expect(actionsForStatus("Voided")).toHaveLength(0);
		expect(actionsForStatus("Frozen")).toHaveLength(0);
	});
});
