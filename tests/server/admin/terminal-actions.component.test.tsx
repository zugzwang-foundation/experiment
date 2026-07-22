// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * UI-6 S2 tests-first (plan §2.S2 "Tests FIRST" + §7 S2 row; CLAUDE.md §5.6) —
 * the `TerminalActions` CLIENT component that replaces the plain-HTML
 * Resolve / Void / Correct submit paths with a typed hard-confirm gate and
 * renders every ActionResult error as human copy (never a raw code / `.message`).
 * Close stays one-click. The Draft "Seed" form is OUT OF SCOPE (untouched).
 *
 * RED-FIRST: neither `TerminalActions.tsx` nor `terminal-actions-logic.ts`
 * exists yet, so both VALUE imports below fail to resolve and this file fails at
 * COLLECTION until S2 lands. The four wire actions are MOCKED — this file never
 * exercises settlement / CPMM / ledger math (built + tested elsewhere, plan §5);
 * it asserts ONLY that the correct action is called with the correct FormData,
 * that the typed confirm arms/disarms submit, and that errors surface as copy.
 *
 * DOM CONTRACT the implementer must satisfy (the target this test defines):
 *   Per rendered action `a ∈ {close, resolve, void, correct}`:
 *     - `data-testid="${a}-submit"`  — the submit control (a <button>).
 *     - `data-testid="${a}-confirm"`  — the typed-confirm <input> (resolve / void /
 *       correct only; ABSENT for close).
 *     - `data-testid="${a}-reason"`   — the reason field (resolve / void / correct).
 *   Submitting an action calls its imported wire action with a FormData carrying
 *   that action's field set (plan §0.1). Error copy is rendered from
 *   `terminalErrorCopy(result.error)` — asserted by deriving the same strings.
 */

// The four built wire actions are imported by the component from their own
// modules; mock each to a hoisted spy (plan §2.S2 Tests — "mock all four").
type MockAction = (fd: FormData) => Promise<unknown>;
const { closeMock, resolveMock, voidMock, correctMock } = vi.hoisted(() => ({
	closeMock: vi.fn<MockAction>(),
	resolveMock: vi.fn<MockAction>(),
	voidMock: vi.fn<MockAction>(),
	correctMock: vi.fn<MockAction>(),
}));

vi.mock("@/server/admin/markets/close", () => ({
	closeMarketAction: closeMock,
}));
vi.mock("@/server/admin/markets/resolve", () => ({
	resolveMarketAction: resolveMock,
}));
vi.mock("@/server/admin/markets/void", () => ({ voidMarketAction: voidMock }));
vi.mock("@/server/admin/markets/correct", () => ({
	correctResolutionAction: correctMock,
}));

// `TerminalActions` is a "use client" island; the S1 sibling `NeedsResolutionCount`
// uses `useRouter().refresh()`, so mock next/navigation defensively.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { TerminalActions } from "@/app/(admin)/admin/markets/_components/TerminalActions";
import { terminalErrorCopy } from "@/app/(admin)/admin/markets/_components/terminal-actions-logic";

const MID = "0190c0de-2222-7000-8000-000000000002";
// Neutral placeholder question (CLAUDE.md §3 — never invent real market copy).
const TITLE = "Placeholder Market Question";

beforeEach(() => {
	for (const m of [closeMock, resolveMock, voidMock, correctMock]) {
		m.mockReset();
		// Default: every action succeeds so a submit doesn't crash on `result.ok`.
		m.mockResolvedValue({ ok: true, data: {} });
	}
});

afterEach(cleanup);

describe("TerminalActions — Resolve typed hard confirm (S2, status=Closed)", () => {
	it("terminal-actions::resolve-submit-armed-only-by-the-typed-question", async () => {
		render(<TerminalActions marketId={MID} title={TITLE} status="Closed" />);

		const submit = screen.getByTestId<HTMLButtonElement>("resolve-submit");
		const confirm = screen.getByTestId<HTMLInputElement>("resolve-confirm");

		// Disarmed before the operator types the question.
		expect(submit.disabled).toBe(true);

		// A near-miss keeps it disarmed.
		fireEvent.change(confirm, { target: { value: "not the question" } });
		expect(submit.disabled).toBe(true);

		// The question, in the WRONG case, arms it (trimmed, case-insensitive).
		fireEvent.change(confirm, {
			target: { value: `  ${TITLE.toUpperCase()}  ` },
		});
		expect(submit.disabled).toBe(false);
	});

	it("terminal-actions::resolve-submit-posts-marketId-winningSide-reason", async () => {
		render(<TerminalActions marketId={MID} title={TITLE} status="Closed" />);

		fireEvent.change(screen.getByTestId("resolve-reason"), {
			target: { value: "The outcome resolved YES." },
		});
		fireEvent.change(screen.getByTestId("resolve-confirm"), {
			target: { value: TITLE },
		});
		fireEvent.click(screen.getByTestId("resolve-submit"));

		await waitFor(() => expect(resolveMock).toHaveBeenCalledTimes(1));
		// Exactly one call, and ONLY resolve fired.
		expect(closeMock).not.toHaveBeenCalled();
		expect(voidMock).not.toHaveBeenCalled();
		expect(correctMock).not.toHaveBeenCalled();

		const fd = resolveMock.mock.calls[0]?.[0];
		expect(fd).toBeInstanceOf(FormData);
		expect(fd?.get("marketId")).toBe(MID);
		expect(fd?.get("reason")).toBe("The outcome resolved YES.");
		expect(["YES", "NO"]).toContain(fd?.get("winningSide"));
	});
});

describe("TerminalActions — Close one-click + Void gated (S2, status=Open)", () => {
	it("terminal-actions::close-is-one-click-and-posts-only-marketId", async () => {
		render(<TerminalActions marketId={MID} title={TITLE} status="Open" />);

		const closeSubmit = screen.getByTestId<HTMLButtonElement>("close-submit");
		// One-click: enabled immediately, no typed-confirm input rendered.
		expect(closeSubmit.disabled).toBe(false);
		expect(screen.queryByTestId("close-confirm")).toBeNull();

		fireEvent.click(closeSubmit);

		await waitFor(() => expect(closeMock).toHaveBeenCalledTimes(1));
		const fd = closeMock.mock.calls[0]?.[0];
		expect(fd).toBeInstanceOf(FormData);
		expect(fd?.get("marketId")).toBe(MID);
		// Close carries no reason / side.
		expect(fd?.get("reason")).toBeNull();
		expect(fd?.get("winningSide")).toBeNull();
	});

	it("terminal-actions::void-affordance-present-and-typed-gated", () => {
		render(<TerminalActions marketId={MID} title={TITLE} status="Open" />);

		const voidSubmit = screen.getByTestId<HTMLButtonElement>("void-submit");
		// Present but disarmed until the question is typed.
		expect(voidSubmit.disabled).toBe(true);
		expect(screen.getByTestId("void-confirm")).toBeTruthy();

		fireEvent.change(screen.getByTestId("void-confirm"), {
			target: { value: TITLE.toLowerCase() },
		});
		expect(voidSubmit.disabled).toBe(false);
	});
});

describe("TerminalActions — error copy is human, never raw (S2)", () => {
	it("terminal-actions::illegal-edge-renders-copy-not-the-code-or-message", async () => {
		resolveMock.mockResolvedValue({
			ok: false,
			error: { code: "illegal_edge", message: "raw msg" },
		});

		const { container } = render(
			<TerminalActions marketId={MID} title={TITLE} status="Closed" />,
		);

		fireEvent.change(screen.getByTestId("resolve-reason"), {
			target: { value: "A reason." },
		});
		fireEvent.change(screen.getByTestId("resolve-confirm"), {
			target: { value: TITLE },
		});
		fireEvent.click(screen.getByTestId("resolve-submit"));

		// The human copy is exactly what the shared logic maps the code to —
		// derived here (never re-typed) so the component must render THAT string.
		const expectedCopy = terminalErrorCopy({
			code: "illegal_edge",
			message: "raw msg",
		});
		await waitFor(() => {
			for (const line of expectedCopy) {
				expect(container.textContent).toContain(line);
			}
		});

		// The raw code and the raw `.message` must NEVER reach the DOM.
		expect(container.textContent).not.toContain("illegal_edge");
		expect(container.textContent).not.toContain("raw msg");
	});
});

describe("TerminalActions — no actions for Draft (S2, Seed out of scope)", () => {
	it("terminal-actions::draft-renders-none-of-the-four-actions", () => {
		render(<TerminalActions marketId={MID} title={TITLE} status="Draft" />);

		expect(screen.queryByTestId("close-submit")).toBeNull();
		expect(screen.queryByTestId("resolve-submit")).toBeNull();
		expect(screen.queryByTestId("void-submit")).toBeNull();
		expect(screen.queryByTestId("correct-submit")).toBeNull();
	});
});
