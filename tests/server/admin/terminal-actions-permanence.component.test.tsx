// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * POLISH.8 S-4 (delta D12) — SPEC.1 §15 F-ADMIN-3 *Confirmation*:
 *
 *   "The confirm restates the winning side (Resolve) and names the action as
 *    permanent, with corrections available only via F-RESOLVE-2 clawback."
 *
 * Before this, the typed-confirm block showed only the market question to type.
 * The operator armed an irreversible append-only settlement without the surface
 * ever naming WHICH side they were settling to, or that it could not be undone.
 *
 * BOTH POLES ARE ASSERTED, and that is the whole point of the test. A YES-only
 * assertion passes on a confirm that says YES for both sides — the worst
 * possible failure on this control, because it would silently mis-state the
 * outcome of an INV-4 lock-in. The NO case drives the real <select> rather than
 * re-rendering with different props, so it exercises the same state path an
 * operator does.
 *
 * ⚠ The side is asserted as TEXT ONLY. This is not a pole site: INV-3's
 * poles encode side via --color-yes/--color-no, and nothing here may key a
 * colour off the side string.
 *
 * Harness precedent: tests/server/admin/terminal-actions.component.test.tsx
 * (jsdom + @testing-library/react; NO @testing-library/jest-dom — plain DOM
 * assertions). The four wire actions are mocked; this file asserts COPY only
 * and never exercises settlement / CPMM / ledger math.
 */

const { closeMock, resolveMock, voidMock, correctMock } = vi.hoisted(() => ({
	closeMock: vi.fn(),
	resolveMock: vi.fn(),
	voidMock: vi.fn(),
	correctMock: vi.fn(),
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
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { TerminalActions } from "@/app/(admin)/admin/markets/_components/TerminalActions";

const MARKET_ID = "00000000-0000-0000-0000-0000000000aa";
const TITLE = "Will the thing happen by the date?";
const PERMANENCE = "This action is permanent";
const CLAWBACK = "F-RESOLVE-2";
/** Any Tailwind side-pole class. INV-3's poles encode side; this note must not. */
const POLE_CLASS = /\b(bg|text|border|ring|fill|stroke)-(yes|no)\b/;

afterEach(() => {
	cleanup();
});

describe("TerminalActions — confirm restates side + names permanence (D12)", () => {
	it("renders the Resolve confirm block at all (N1 non-vacuity)", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Closed" />,
		);
		// If the gated block did not render, every copy assertion below would
		// pass or fail for the wrong reason.
		expect(screen.getByTestId("resolve-confirm")).toBeTruthy();
		expect(screen.getByTestId("resolve-permanence")).toBeTruthy();
	});

	it("names YES when YES is the selected winning side", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Closed" />,
		);
		const note = screen.getByTestId("resolve-permanence");
		expect(note.textContent).toContain("Winning side");
		expect(note.textContent).toContain("YES");
		expect(note.textContent).not.toContain("NO");
	});

	it("names NO when the operator switches the winning side to NO", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Closed" />,
		);
		fireEvent.change(screen.getByTestId("resolve-side"), {
			target: { value: "NO" },
		});

		const note = screen.getByTestId("resolve-permanence");
		expect(note.textContent).toContain("Winning side");
		expect(note.textContent).toContain("NO");
		// A confirm hard-coded to YES would still contain "NO" as a substring of
		// nothing here — but it WOULD still contain "YES", so pin its absence.
		expect(note.textContent).not.toContain("YES");
	});

	it("names the action permanent and points corrections at F-RESOLVE-2", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Closed" />,
		);
		const note = screen.getByTestId("resolve-permanence");
		expect(note.textContent).toContain(PERMANENCE);
		expect(note.textContent).toContain(CLAWBACK);
	});

	it("restates the CORRECTED side on Correct, both poles", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Resolved" />,
		);
		const note = screen.getByTestId("correct-permanence");
		expect(note.textContent).toContain("Corrected side");
		expect(note.textContent).toContain("YES");

		fireEvent.change(screen.getByTestId("correct-side"), {
			target: { value: "NO" },
		});
		expect(screen.getByTestId("correct-permanence").textContent).toContain(
			"NO",
		);
		expect(screen.getByTestId("correct-permanence").textContent).not.toContain(
			"YES",
		);
	});

	it("names permanence on Void, which carries no side to restate", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Open" />,
		);
		const note = screen.getByTestId("void-permanence");
		expect(note.textContent).toContain(PERMANENCE);
		// Void picks no side, so no side label may be invented for it.
		expect(note.textContent).not.toContain("Winning side");
		expect(note.textContent).not.toContain("Corrected side");
		// ⚠ AND IT MUST NOT PROMISE A CLAWBACK. F-RESOLVE-2 requires status
		// 'Resolved' (src/server/resolution/correct.ts expectedStatus), and
		// actionsForStatus("Voided") is empty — a voided market has NO correction
		// path. Claiming one here under-states finality on the one gated action
		// that is genuinely un-correctable, which is the opposite of what S-4 is
		// for (@code-reviewer H-1).
		expect(note.textContent).not.toContain(CLAWBACK);
	});

	it("never keys a COLOUR off the side string (INV-3 — not a pole site)", () => {
		// @security-auditor L-3: this diff introduces the FIRST side-encoding
		// string in (admin)/admin/markets/, and side-pole-binding.test.ts declares
		// ADMIN_EXCLUSION = "src/app/(admin)/" — so the participant pole guard is
		// structurally blind to it. Without this assertion the prohibition lives
		// only in a source comment, and a later `className={side === "YES" ? …}`
		// would mint a fourth pole surface with the whole suite green.
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Closed" />,
		);
		const note = screen.getByTestId("resolve-permanence");
		const classes = [note, ...Array.from(note.querySelectorAll("*"))]
			.map((el) => el.className)
			.join(" ");

		// POSITIVE CONTROL FIRST — a `not.toMatch` passes when the pattern matches
		// nothing at all, which is exactly what a rename or reformat produces (V-2).
		expect("text-yes").toMatch(POLE_CLASS);
		expect(classes).not.toMatch(POLE_CLASS);
	});

	it("renders NO permanence note on Close, which is not a gated action", () => {
		render(
			<TerminalActions marketId={MARKET_ID} title={TITLE} status="Open" />,
		);
		// Close is reversible in effect and carries no settlement — the gated
		// block (and therefore this note) must not attach to it.
		expect(screen.queryByTestId("close-permanence")).toBeNull();
	});
});
