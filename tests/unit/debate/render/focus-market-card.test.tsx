// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocusMarketCard } from "@/components/debate/FocusMarketCard";

/**
 * HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`), the post arm's
 * rail, which is ALSO the exit.
 *
 * ⛔⛔ THE EXIT ASSERTION IS THE SAFETY-CRITICAL ONE. `DebateView` syncs
 * `?post=` with `history.replaceState`, NEVER `pushState`, and says so in terms
 * — so browser Back does not leave post view. This card replaced the only other
 * way out. If it renders inert, post-focus becomes a TRAP with no exit at all,
 * and nothing else in the suite would notice: the card would still render, the
 * page would still paint, and every other assertion here would still pass.
 *
 * ⚠ d5 CONTRADICTS ITSELF and cannot be followed literally: its comment at
 * `:1020` says "context only — no click, exit lives on the ↙ arrows" while the
 * very next line is `<div class="mcard vp" onclick="exitPost()">`. There are no
 * ↙ arrows in this build, so the inert reading is the one that breaks.
 *
 * ⛔ NO SPARKLINE — the locked market-card composition (design-language §3.2)
 * is "image thumb + question · YES/NO split bar · `Đ volume · posts · replies`",
 * from which the two-line sparkline was STRUCK at HTML-FINISH · DISCOVERY with
 * the paired SPEC.1 1.0.30 amendment. That amendment deliberately RETAINED
 * "must be identical everywhere" as its load-bearing half. d5's `.mcard` still
 * draws a `.spark`; taking it would re-open exactly what that ruling closed.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const TOTALS = {
	dharmaStaked: "150.000000000000000000",
	postCount: 3,
	replyCount: 5,
};
const PRICING = { yes: "0.500000000000000000", no: "0.500000000000000000" };

function renderCard(overrides?: {
	imageUrl?: string | null;
	onExit?: () => void;
}) {
	return render(
		<FocusMarketCard
			title="Fixture market question."
			imageUrl={overrides?.imageUrl ?? null}
			pricing={PRICING}
			totals={TOTALS}
			onExit={overrides?.onExit ?? (() => {})}
		/>,
	);
}

describe("FocusMarketCard — row 17, the card IS the exit", () => {
	it("focus-market-card::clicking-it-exits-post-focus", () => {
		const onExit = vi.fn();
		renderCard({ onExit });

		fireEvent.click(screen.getByTestId("focus-market-card"));
		expect(onExit).toHaveBeenCalledTimes(1);
	});

	it("focus-market-card::it-is-a-real-button-carrying-the-CARRIED-name", () => {
		const { container } = renderCard();

		const card = screen.getByTestId("focus-market-card");
		// Keyboard-reachable by construction — a `<div onclick>` (which is what
		// d5 ships) is not, and post-focus has no other exit.
		expect(card.tagName).toBe("BUTTON");
		expect(card.getAttribute("type")).toBe("button");
		// ⛔ BYTE-CARRIED from the `PostFocusHeader` button this card supersedes,
		// so the exit announces identically before and after the change. No copy
		// was authored for it.
		expect(card.getAttribute("aria-label")).toBe("Back to the market");
		// Exactly one interactive element — the whole card is the control, so a
		// nested button would create a second, ambiguous target.
		expect(container.querySelectorAll("button")).toHaveLength(1);
	});

	it("focus-market-card::it-renders-the-LOCKED-composition", () => {
		const { container } = renderCard();
		const html = container.innerHTML;

		// image thumb + question …
		expect(html).toContain("Fixture market question.");
		// … YES/NO split bar …
		expect(html).toContain("YES 50%");
		expect(html).toContain("NO 50%");
		// … `Đ volume · posts · replies`, with PD-3-08's plural rule intact.
		expect(html).toContain("Đ 150 staked");
		expect(html).toContain("3 posts");
		expect(html).toContain("5 replies");
	});

	it("focus-market-card::the-count-nouns-agree-with-their-counts", () => {
		// PD-3-08 asserted on THIS render, not inherited: the rule lives in a
		// third local copy here (the two shared homes are unreachable — see the
		// component's own docblock), and a copy nobody tests is a copy that drifts.
		cleanup();
		render(
			<FocusMarketCard
				title="Fixture market question."
				imageUrl={null}
				pricing={PRICING}
				totals={{ ...TOTALS, postCount: 1, replyCount: 1 }}
				onExit={() => {}}
			/>,
		);
		const html = document.body.innerHTML;
		expect(html).toContain("1 post");
		expect(html).toContain("1 reply");
		expect(html).not.toContain("1 posts");
		expect(html).not.toContain("1 replies");
	});

	it("focus-market-card::NO-sparkline-the-locked-composition-struck-it", () => {
		const { container } = renderCard();

		// d5's `.mcard` draws a `.spark` between the title block and the bar. The
		// locked composition dropped it at SPEC.1 1.0.30 and RETAINED "must be
		// identical everywhere", so Discovery, Profile and this card stay ONE
		// composition. `<polyline>` is what a two-line spark renders as.
		expect(container.querySelector("polyline")).toBeNull();
		expect(container.querySelectorAll("svg")).toHaveLength(0);
	});

	it("focus-market-card::a-null-image-degrades-to-the-shipped-placeholder", () => {
		const { container } = renderCard({ imageUrl: null });

		// The design-ratified `IMG` glyph box, byte-carried from
		// `discovery/MarketCard.tsx` — nothing new invented for the null arm.
		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).toContain("IMG");
	});
});
