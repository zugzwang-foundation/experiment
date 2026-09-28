// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";

import { mumbaiMetroModel as raw } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * NAV-2 — ↑/↓ step the ACTIVE column, exactly as its ▲/▼ rail buttons do.
 *
 * The active column is the one that last took a pointer-down, a pointer-enter
 * or focus, and the LEFT (YES) column before any of those. Before NAV-2, ↑/↓
 * moved only a column that had been picked, and did nothing at all while either
 * column showed a composer or the signed-out panel — so the left column, the
 * natural first target, did not respond on arrival or after `Bet YES`.
 *
 * Rendered whole because "active" is a relation between the two columns and the
 * key handler above them. Fixture: three posts a side, signed out, so the bet
 * control opens the signed-out panel. The slug is corrected for the reason
 * `auto-advance.test.tsx` gives (`ResolverCards` throws on an unknown one).
 */

const model: DebateViewModel = {
	...raw,
	market: { ...raw.market, slug: "bitcoin-price-50k" },
};

beforeEach(() => {
	window.scrollTo = () => undefined;
});
afterEach(cleanup);

const column = (side: "YES" | "NO") =>
	document.querySelector(`[data-debate-column="${side}"]`) as HTMLElement;

/** A column's `n / total` readout, or null while it shows no rail. */
const readout = (side: "YES" | "NO") =>
	column(side)
		.querySelector('[data-testid="scroll-rail"] [aria-live="polite"]')
		?.textContent?.replace(/\s+/g, " ") ?? null;

const press = (key: string, target: Element | Document = document) =>
	act(() => {
		fireEvent.keyDown(target, { key });
	});

describe("NAV-2 — ↑/↓ on both columns", () => {
	it("nav-2::the-left-column-steps-when-active-and-a-text-field-keeps-its-keys", () => {
		render(
			<DebateView
				model={model}
				viewer={null}
				initialPostId={null}
				ownPseudonym={null}
			/>,
		);
		expect([readout("YES"), readout("NO")]).toEqual(["1 / 3", "1 / 3"]);

		// Before any interaction the left column is the active one.
		press("ArrowDown");
		expect([readout("YES"), readout("NO")]).toEqual(["2 / 3", "1 / 3"]);
		press("ArrowUp");
		expect([readout("YES"), readout("NO")]).toEqual(["1 / 3", "1 / 3"]);

		// The pointer entering a column makes it active, and the left column
		// takes the keys back the same way.
		fireEvent.pointerOver(column("NO"));
		press("ArrowDown");
		expect([readout("YES"), readout("NO")]).toEqual(["1 / 3", "2 / 3"]);
		fireEvent.pointerOver(column("YES"));
		press("ArrowDown");
		expect([readout("YES"), readout("NO")]).toEqual(["2 / 3", "2 / 3"]);

		// Typing into a text field is left alone.
		const field = document.createElement("textarea");
		column("YES").appendChild(field);
		field.focus();
		// Asserted after EACH key: a ↓ and a ↑ that both stepped would cancel out.
		press("ArrowDown", field);
		expect([readout("YES"), readout("NO")]).toEqual(["2 / 3", "2 / 3"]);
		press("ArrowUp", field);
		expect([readout("YES"), readout("NO")]).toEqual(["2 / 3", "2 / 3"]);
		field.remove();

		// While the other column shows the signed-out panel, the left column
		// still steps.
		const bet = Array.from(document.querySelectorAll("button")).find(
			(b) => b.getAttribute("aria-label") === "Bet YES",
		) as HTMLButtonElement;
		act(() => {
			fireEvent.pointerDown(bet);
			fireEvent.click(bet);
		});
		expect(
			column("NO").querySelector('[data-testid="composer-slot"]'),
		).not.toBeNull();
		expect(readout("NO")).toBeNull();
		press("ArrowDown");
		expect(readout("YES")).toBe("3 / 3");
	});
});
