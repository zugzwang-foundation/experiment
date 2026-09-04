// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocusMarketCard } from "@/components/debate/FocusMarketCard";

/**
 * HTML-FINISH · MARKET DETAIL row 17 — `.mcard` (`d5:1021`), the post arm's
 * rail, which is ALSO the exit.
 *
 * ⛔⛔ THE EXIT ASSERTION IS THE SAFETY-CRITICAL ONE. If this card renders
 * inert, post-focus loses its visible way out, and nothing else in the suite
 * would notice: the card would still render, the page would still paint, and
 * every other assertion here would still pass.
 * ⚠ THE REASON GIVEN HERE IS SUPERSEDED AND CORRECTED RATHER THAN DELETED
 * (O-5). It read: "`DebateView` syncs `?post=` with `history.replaceState`,
 * NEVER `pushState` … so browser Back does not leave post view. This card
 * replaced the only other way out." RPLY-1 · R2 made entering PUSH a rung so
 * that Back would work, so this is no longer the ONLY exit — it is the only
 * VISIBLE one, which is a weaker claim that still forbids an inert card.
 *
 * ⚠⚠ UI-FOLLOWUP B — IT IS AN `<a>` NOW AND THE PLAIN CLICK STILL UNWINDS. The
 * `href` is what makes it a place (middle-click, ⌘-click, copy-link); the
 * intercepted plain click is what keeps RPLY-1 · R2's depth-neutral exit, which
 * `history-ladder.test.tsx` owns end to end. Both halves are asserted below,
 * because either alone is a different component: an `<a>` with no intercept
 * grows the history stack by two per visit, and an intercept with no modifier
 * guard makes the address unusable.
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

const SLUG = "bitcoin-price-50k";
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
			slug={SLUG}
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

	it("focus-market-card::it-is-a-real-link-to-the-market-carrying-the-CARRIED-name", () => {
		const { container } = renderCard();

		const card = screen.getByTestId("focus-market-card");
		// Keyboard-reachable by construction — a `<div onclick>` (which is what
		// d5 ships) is not, and this is the surface's visible way out.
		expect(card.tagName).toBe("A");
		// ⛔ THE ADDRESS IS THE MARKET, WITHOUT THE POST PARAM. `?post=` on this
		// href would make the exit link back into the view it exits.
		expect(card.getAttribute("href")).toBe(`/m/${SLUG}`);
		expect(card.getAttribute("href")).not.toContain("?post=");
		// ⛔ BYTE-CARRIED from the `PostFocusHeader` button this card supersedes,
		// so the exit announces identically before and after the change. No copy
		// was authored for it.
		expect(card.getAttribute("aria-label")).toBe("Back to the market");
		// ⛔ EXACTLY ONE INTERACTIVE ELEMENT — the whole card is the control, so a
		// nested anchor or button would create a second, ambiguous target, and an
		// `<a>` inside an `<a>` is not even valid markup. Asserted as a count over
		// the whole subtree rather than a spot check, because the card composes
		// three components that could each acquire one.
		expect(container.querySelectorAll("a")).toHaveLength(1);
		expect(container.querySelectorAll("button")).toHaveLength(0);
	});

	it("focus-market-card::it-carries-a-visible-focus-ring-and-a-hover-state", () => {
		// ⛔ AS A `<button>` THIS CARD HAD NO FOCUS TREATMENT AT ALL, so a keyboard
		// reader Tabbed an invisible cursor onto the control that leaves post
		// focus. Pinned by the shipped token pair rather than by appearance —
		// `outline-none` alone is the regression shape (the ring removed, nothing
		// put back), so both halves are named.
		renderCard();
		const classes = (
			screen.getByTestId("focus-market-card").getAttribute("class") ?? ""
		).split(/\s+/);

		expect(classes).toContain("outline-none");
		expect(classes).toContain("focus-visible:shadow-(--state-focus-ring)");
		expect(classes).toContain("hover:bg-n1");
	});

	it("focus-market-card::the-return-line-is-the-LAST-child-and-pinned-to-the-floor", () => {
		renderCard();
		const card = screen.getByTestId("focus-market-card");
		const line = screen.getByText("↩ Click to return to market page");
		// ⛔ LAST, AND PINNED. `mt-auto` in a flex column consumes the free space
		// ABOVE the item — which is the entire reason the rail is allowed to
		// stretch again: without it the reclaimed height would open a hole under
		// the stat line instead of seating a footer.
		expect(line.getAttribute("class") ?? "").toContain("mt-auto");
		expect(card.lastElementChild).toBe(line);
		// The muted tier the stat line above it uses — chrome about the card, not
		// a field of the market.
		expect(line.getAttribute("class") ?? "").toContain("text-muted-foreground");
	});

	it("focus-market-card::a-MODIFIED-click-is-not-intercepted-and-takes-the-href", () => {
		// ⛔⛔ THE GUARD THAT KEEPS THE `href` HONEST, and the assertion that
		// separates "there is an address" from "the address can be used". Without
		// the modifier check a ⌘-click is swallowed by `preventDefault()` and
		// quietly unwinds this tab instead of opening a new one.
		const onExit = vi.fn();
		renderCard({ onExit });
		const card = screen.getByTestId("focus-market-card");

		fireEvent.click(card, { metaKey: true });
		expect(onExit).not.toHaveBeenCalled();

		fireEvent.click(card, { ctrlKey: true });
		fireEvent.click(card, { shiftKey: true });
		fireEvent.click(card, { button: 1 });
		expect(onExit).not.toHaveBeenCalled();

		// …and the positive control, in the same test, so a guard that rejected
		// EVERY click would not pass this by rejecting nothing of interest.
		fireEvent.click(card);
		expect(onExit).toHaveBeenCalledTimes(1);
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
				slug={SLUG}
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
