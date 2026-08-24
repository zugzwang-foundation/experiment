// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY } from "@/components/debate/composer/copy";

import { composerProps, EXTENDED, stubWireFetch, TITLE } from "./_harness";

/**
 * UI-QUICK change set 7 §0d — CLICKED SIDE == CHIP SIDE == SUBMITTED SIDE.
 *
 * ⚠⚠ WHY THIS FILE EXISTS, AND WHY NOW. The composer mounts in the column
 * OPPOSITE the side being bet — founder-ruled as intended — so on screen the
 * panel for a YES bet sits under the NO column's header. That is a deliberate
 * design, but it means the ONE thing standing between it and a
 * bet-on-the-wrong-side defect is that `opposite()` is applied to the CHOICE OF
 * COLUMN and never to the VALUE CARRIED. Nothing pinned that. The §0c trace
 * found the chain clean; this file is what keeps it clean.
 *
 * ⛔ IT MATTERS MORE AFTER §5. Once both column headers read the composing
 * side, the on-screen contradiction that would expose a mismatch is gone — a
 * wrongly-bound side would look correct. This guard is the replacement for that
 * accidental evidence, which is why the founder gated §5 behind it.
 *
 * THE CHAIN, and where each link is asserted:
 *   click Buy in column S   → `toggleEntry(S)`          ⟶ source pin below
 *   → `setOpenSide(S)`      (identity, never inverted)  ⟶ source pin below
 *   → host column = opposite(openSide)  (COLUMN ONLY)   ⟶ source pin below
 *   → `<BetComposer side={openSide}>`   (value intact)  ⟶ source pin below
 *   → chip renders `props.side`                         ⟶ render assertion
 *   → payload `side: props.side`                        ⟶ wire assertion
 *
 * ⚠ The render half mounts the REAL `BetComposer` and reads the REAL request
 * body off a stubbed fetch — it does not re-implement the payload shape. The
 * source half covers the two links above the composer, which cannot be reached
 * without mounting `DebateView` and, with it, the whole bet stack.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const ROOT = process.cwd();
const VIEW = readFileSync(
	join(ROOT, "src/components/debate/DebateView.tsx"),
	"utf8",
);

/** Types a minimal valid argument and submits. */
function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	fireEvent.change(
		screen.getByLabelText<HTMLTextAreaElement>("Argument body"),
		{ target: { value: EXTENDED } },
	);
	fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
}

/** The `side` the composer actually put on the wire. */
function submittedSide(fetchStub: ReturnType<typeof vi.fn>): string | null {
	for (const call of fetchStub.mock.calls) {
		const url = String(call[0]);
		if (!url.includes("/api/bets/place")) {
			continue;
		}
		const init = call[1] as RequestInit | undefined;
		if (typeof init?.body !== "string") {
			continue;
		}
		return (JSON.parse(init.body) as { side?: string }).side ?? null;
	}
	return null;
}

describe("§0d the composer submits the side it displays", () => {
	for (const side of ["YES", "NO"] as const) {
		it(`side-identity::a-${side}-composer-shows-${side}-and-submits-${side}`, async () => {
			const fetchStub = stubWireFetch([{ status: 200, body: { ok: true } }]);
			render(<BetComposer {...composerProps()} side={side} />);

			// The chip is the ONE on-screen statement of which side is being bet,
			// and with the composer sitting in the opposite column it is the only
			// thing distinguishing the two.
			expect(screen.getByText(side)).toBeTruthy();

			typeAndSubmit();
			await vi.waitFor(() => {
				expect(submittedSide(fetchStub)).not.toBeNull();
			});

			// ⛔ THE ASSERTION THIS FILE EXISTS FOR.
			expect(submittedSide(fetchStub)).toBe(side);
			// …and the opposite is pinned absent, so a component that submitted a
			// constant could not pass one of the two cases by luck.
			expect(submittedSide(fetchStub)).not.toBe(side === "YES" ? "NO" : "YES");
		});
	}
});

describe("§0d the value survives the opposite-column mount", () => {
	it("side-identity::toggleEntry-stores-the-CLICKED-side-unchanged", () => {
		// `setOpenSide((cur) => (cur === side ? null : side))` — toggle-to-close,
		// and otherwise the identity. ⛔ An `opposite(side)` here would invert every
		// bet on the surface while every label still read correctly.
		expect(VIEW).toContain(
			"setOpenSide((cur) => (cur === side ? null : side))",
		);
	});

	it("side-identity::the-composer-receives-openSide-NOT-its-host-column", () => {
		// The market arm hands the composer the state value directly.
		expect(VIEW).toContain("side={openSide}");
		// ⛔⛔ AND `opposite()` NEVER WRAPS A VALUE HANDED DOWN AS `side`. This is
		// the whole invariant in one assertion: the helper exists to pick the host
		// COLUMN, never to transform the bet's side.
		expect(VIEW).not.toContain("side={opposite(");
	});

	it("side-identity::opposite-is-used-ONLY-to-choose-the-host-column", () => {
		// Two call sites, both positional: the market arm's `hosts` predicate and
		// the reply arm's `composerColumn`. If a third appears, this reddens and
		// the new one must be read before it is accepted.
		const uses = VIEW.match(/opposite\(/g) ?? [];
		expect(uses).toHaveLength(2);
		expect(VIEW).toContain("side === opposite(openSide)");
		expect(VIEW).toContain(
			"const composerColumn = opposite(selectedPost.sideAtPostTime)",
		);
	});
});
