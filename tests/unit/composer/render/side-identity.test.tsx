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
		//
		// ⚠⚠ RPLY-1 · R1 SHARPENS THE RULE AND DOES NOT WEAKEN IT. The helper now
		// takes the BET's side as its argument on the reply arm rather than the
		// PARENT's — so `opposite()` is closer than ever to a value that matters,
		// and this negative is what keeps the two apart. What it forbids is
		// unchanged: no `opposite()` may reach a value handed DOWN as `side`. The
		// reply composer still receives `side={resultingSide}` — the derivation's
		// own output, untransformed — and the badge still reads that same value.
		expect(VIEW).not.toContain("side={opposite(");
		// The positive half, so the negative above cannot pass vacuously against a
		// file that stopped handing the reply composer a side at all.
		expect(VIEW).toContain("side={resultingSide}");
	});

	it("side-identity::opposite-is-used-ONLY-to-choose-the-host-column", () => {
		// Call sites, ALL positional — each one chooses a COLUMN, none transforms
		// a bet's side. If a new one appears, this reddens and it must be read
		// before it is accepted.
		//
		// ⚠⚠ THAT IS EXACTLY WHAT HAPPENED AT CS12, and it is why the count is
		// pinned rather than the predicate alone. The count went 2 → 3 when the
		// mirrored header learned to suppress its own controls:
		//   `const hostingComposer = openSide !== null && side === opposite(openSide)`
		// It was READ before being accepted, and it is the same class as the other
		// two — it answers "is THIS COLUMN the host?", never "which side is being
		// bet?". Accepted and enumerated below.
		//
		// ⛔ THE NEGATIVE IS THE PART THAT ACTUALLY GUARDS INV-3, and it is
		// untouched: `side={opposite(` must never appear, so no `opposite()` may
		// reach a value handed down as a side. Raising the count admits a new
		// POSITIONAL use; it admits nothing about the value.
		// ⚠⚠ RPLY-1 · R1 — THE CENSUS DROPS 3 → 2, AND THE REASON IS THAT THE
		// REPLY ARM STOPPED USING THIS HELPER AT ALL. It read
		// `const composerColumn = opposite(selectedPost.sideAtPostTime)`, making
		// the host column a function of the PARENT's side alone — so Support and
		// Counter could not produce different columns, and a Counter opened inside
		// the very side it was betting. design-canon §3.3's stated reason ("the
		// bet's side stays visible") was therefore failing on that path.
		// ⇒ The reply arm now calls `replyComposerColumn({parentSide, relation})`,
		// which takes the relation as a REQUIRED argument — so the dependency this
		// defect was missing is now in the type, and a revert is a compile error
		// rather than a silent re-inversion. `opposite()` is left holding only its
		// two market-arm column picks, which is what this count now measures.
		//
		// ⚠⚠ THIS COUNT IS TEXTUAL, NOT SYNTACTIC, AND THAT BIT DURING THIS VERY
		// CHANGE — THREE TIMES. It matches `opposite(` anywhere in the file,
		// COMMENTS INCLUDED, so prose that quotes the expression inflates it and
		// the guard reddens on a documentation edit that changed no code. Each
		// time, the honest fix was to reword the comment rather than raise the
		// number: a census that counts prose is not counting call sites. If you
		// are here because this went red, check whether you added a MENTION before
		// you conclude you added a CALL.
		const uses = VIEW.match(/opposite\(/g) ?? [];
		expect(uses).toHaveLength(2);
		expect(VIEW).toContain("side === opposite(openSide)");
		// ⛔ THE SUPERSEDED FORM IS PINNED GONE, so a revert to opposite-the-parent
		// reddens here and not only in the behavioural matrix.
		expect(VIEW).not.toContain("opposite(selectedPost.sideAtPostTime)");
		// …and the replacement is pinned PRESENT, so the negative above cannot
		// pass against a file that simply stopped choosing a reply column.
		expect(VIEW).toContain("replyComposerColumn({");
		expect(VIEW).toMatch(
			/const hostingComposer =\s*openSide !== null && side === opposite\(openSide\);/,
		);
		expect(VIEW).not.toContain("side={opposite(");
	});
});
