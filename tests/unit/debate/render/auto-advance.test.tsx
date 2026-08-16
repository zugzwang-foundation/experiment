// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// HTML-FINISH · MARKET DETAIL round 2 · R3 — the arena's AUTO-ADVANCE, asserted
// through the real `DebateView` rather than through the scrollers in isolation.
//
// ⛔⛔ THE COMPOSITION IS THE SUBJECT, WHICH IS WHY IT IS RENDERED WHOLE. Three of
// the five laws below are about how the two columns relate to EACH OTHER —
// mutual exclusion, the stagger, the surface-wide freeze — and a scroller
// rendered alone cannot exhibit any of them. `ScrollRail`'s own countdown
// mechanics are pinned separately in `scroll-rail.test.tsx`; this file never
// re-asserts them.
//
// The `next/navigation` mock and the `mumbaiMetroModel` fixture are the harness
// `poll.test.tsx` already established for rendering `DebateView` under fake
// timers — reused rather than re-derived, so the two files cannot disagree about
// what a mounted debate view is.
//
// No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { mumbaiMetroModel } from "../../debate-export/_fixtures/mumbai-metro.input";

/**
 * ⛔ THE CADENCE IS IMPORTED, NEVER RESTATED. Writing `15000` here would pin a
 * literal this suite does not own: `scrollers.tsx` derives the cadence from
 * `POLL_INTERVAL_MS_DEBATE_VIEW`, and a hardcoded copy would keep passing while
 * the two silently diverged — the failure mode where a green guard proves
 * nothing about the thing it names.
 */
const ADVANCE_MS = POLL_INTERVAL_MS_DEBATE_VIEW;
/** The second column's first-cycle head start — half a cadence, a derivation. */
const STAGGER_MS = ADVANCE_MS / 2;

beforeEach(() => {
	vi.useFakeTimers();
	// `history.replaceState` is called by the post-param sync; jsdom has it, but
	// the scroll reset needs a stub.
	window.scrollTo = () => undefined;
});
afterEach(() => {
	vi.useRealTimers();
	cleanup();
});

function renderView() {
	return render(
		<DebateView
			model={mumbaiMetroModel}
			viewer={null}
			initialPostId={null}
			ownPseudonym={null}
		/>,
	);
}

/**
 * ⛔⛔ THE CLOCK IS ADVANCED IN SMALL STEPS, EACH IN ITS OWN `act()`, AND THAT IS
 * NOT A STYLE CHOICE — a single `act(() => vi.advanceTimersByTime(45_000))`
 * SILENTLY UNDER-COUNTS.
 *
 * The advance timer re-arms itself through React: firing it sets state, the
 * effect re-runs on the new `progressKey`, and only then is the NEXT timeout
 * scheduled. `act()` flushes effects at its END, so inside one big jump the
 * first timeout fires and every timeout it would have scheduled is registered
 * with zero virtual time left. Three cadences of jump produce ONE advance.
 *
 * ⚠ IT COST TWO FALSE REDS TO FIND, and both looked like product defects: the
 * wrap case read as "the list does not wrap" and the countdown case as "the
 * unpicked column's bar is dead". Neither was true. Recorded here so the next
 * reader does not re-diagnose it as one.
 *
 * The step is the rail's own fill tick, which is the finest granularity anything
 * in this subtree reacts at.
 */
const STEP_MS = ADVANCE_MS / 60;

function advance(ms: number) {
	const steps = Math.round(ms / STEP_MS);
	for (let i = 0; i < steps; i++) {
		act(() => {
			vi.advanceTimersByTime(STEP_MS);
		});
	}
}

/** The `n / total` readouts, left column first. The rails are the only nodes
 * that report a column's position, and DOM order IS side order (YES then NO). */
function readouts(container: HTMLElement): string[] {
	return Array.from(
		container.querySelectorAll('[data-testid="scroll-rail"]'),
	).map(
		(rail) =>
			rail
				.querySelector('[aria-live="polite"]')
				?.textContent?.replace(/\s+/g, " ") ?? "",
	);
}

describe("HTML-FINISH · MARKET DETAIL round 2 · R3 — the arena advances itself", () => {
	it("auto-advance::both-columns-advance-with-no-user-action", () => {
		// ⛔ THE WHOLE ROW IN ONE ASSERTION. Before R3 nothing moved unless the
		// reader clicked, which is why the rail's static half-full bar read as
		// broken: there was nothing for it to be counting down to.
		const { container } = renderView();
		const before = readouts(container);
		expect(before).toHaveLength(2);
		expect(before[0]).toBe("1 / 3");
		expect(before[1]).toBe("1 / 3");

		// One full cadence. YES advances at ADVANCE_MS; NO advanced earlier, at
		// STAGGER_MS, and its second is not due until ADVANCE_MS + STAGGER_MS. So
		// both sit on their SECOND card — one having got there sooner than the
		// other, which is the stagger's whole point.
		advance(ADVANCE_MS);
		const after = readouts(container);
		expect(after[0]).toBe("2 / 3");
		expect(after[1]).toBe("2 / 3");
	});

	it("auto-advance::the-second-column-LEADS-by-half-a-cadence", () => {
		// d5's own reason (`:1724`): "the two sides are offset 10s so posts advance
		// one-after-another". Without the stagger both columns flip in the same
		// frame, which is a different — and much noisier — surface.
		// ⛔ The window is asserted from BOTH ends. Only checking that NO moved
		// first would pass on a build with no stagger at all if YES happened to be
		// slower for an unrelated reason.
		const { container } = renderView();

		advance(STAGGER_MS);
		expect(readouts(container)[1]).toBe("2 / 3"); // NO led…
		expect(readouts(container)[0]).toBe("1 / 3"); // …and YES had not yet moved.

		advance(STAGGER_MS);
		expect(readouts(container)[0]).toBe("2 / 3"); // YES lands half a cycle later.
	});

	it("auto-advance::it-WRAPS-past-the-end", () => {
		// Auto-advance and end-clamping cannot both be right: a clamped list stops
		// at the last card while the loader keeps counting down to nothing. This is
		// the assertion that pins the `% total` d5 uses (`:1713`) and that the
		// dropped `disabled`-at-the-ends state went with.
		const { container } = renderView();
		advance(STAGGER_MS + ADVANCE_MS * 3);
		// Three posts, three advances ⇒ back to the first.
		expect(readouts(container)[0]).toBe("1 / 3");
	});

	it("auto-advance::ArrowLeft-and-ArrowRight-PICK-a-column", () => {
		// ⛔ PICKING IS MUTUALLY EXCLUSIVE, and that is what the second half of this
		// row proves. d5: "picked side is manual (loader off); the OTHER side keeps
		// auto-scrolling" (`:1744`). A build that froze BOTH on a pick would pass a
		// test that only looked at the picked column.
		const { container } = renderView();

		fireEvent.keyDown(document, { key: "ArrowLeft" });
		advance(ADVANCE_MS);
		expect(readouts(container)[0]).toBe("1 / 3"); // YES picked ⇒ frozen…
		expect(readouts(container)[1]).toBe("2 / 3"); // …NO still running.

		// Switching the pick RELEASES the first column.
		fireEvent.keyDown(document, { key: "ArrowRight" });
		advance(ADVANCE_MS);
		expect(readouts(container)[0]).toBe("2 / 3"); // YES resumed…
		expect(readouts(container)[1]).toBe("2 / 3"); // …NO now picked and frozen.
	});

	it("auto-advance::the-picked-column-empties-its-countdown-bar", () => {
		// The visual half of the pick. A picked column whose bar kept filling would
		// depict a timer that is not running — d5 hides the loader outright on a
		// picked slot (`:897`).
		const { container } = renderView();
		const fillOf = (i: number) =>
			container
				.querySelectorAll('[data-testid="scroll-rail"]')
				[i]?.querySelector<HTMLElement>('[data-testid="scroll-rail-fill"]')
				?.style.height ?? "";

		advance(ADVANCE_MS / 3);
		expect(Number.parseFloat(fillOf(0))).toBeGreaterThan(0);

		fireEvent.keyDown(document, { key: "ArrowLeft" });
		expect(fillOf(0)).toBe("0%");
		// ⛔ And the OTHER column's bar keeps filling — the pick is per-column.
		advance(ADVANCE_MS / 3);
		expect(Number.parseFloat(fillOf(1))).toBeGreaterThan(0);
	});

	it("auto-advance::arrow-keys-are-IGNORED-while-typing", () => {
		// ⛔ Stealing ← from an author mid-argument would move the surface under
		// them while they are trying to move the caret. d5 guards the same way
		// (`:1461`). `frozen` covers the composer-open case on its own; this is the
		// belt for any input this surface grows later.
		const { container } = renderView();
		const input = document.createElement("textarea");
		document.body.appendChild(input);

		fireEvent.keyDown(input, { key: "ArrowLeft" });
		advance(ADVANCE_MS + STAGGER_MS);
		// Not picked ⇒ YES advanced normally.
		expect(readouts(container)[0]).toBe("2 / 3");
		input.remove();
	});

	it("auto-advance::an-OPEN-COMPOSER-freezes-the-surviving-column", () => {
		// ⛔ IT FREEZES THE COLUMN THAT IS STILL SHOWING CARDS, which is the only
		// one that can move. Opening entry on one side replaces the OPPOSITE
		// column's scroller with the composer, so a freeze that only covered the
		// composer's own column would be a no-op — a reader composing would still
		// have the other column shuffling beside them. d5 freezes both (`:1762`).
		const { container } = renderView();
		expect(readouts(container)).toHaveLength(2);

		const buy = Array.from(container.querySelectorAll("button")).find(
			(b) => b.getAttribute("aria-label") === "Buy YES",
		);
		expect(buy).toBeDefined();
		fireEvent.click(buy as HTMLButtonElement);

		// One rail left — the YES column keeps its scroller, NO hosts the composer.
		const after = readouts(container);
		expect(after).toHaveLength(1);
		expect(after[0]).toBe("1 / 3");

		advance(ADVANCE_MS * 3);
		expect(readouts(container)[0]).toBe("1 / 3");
	});

	it("auto-advance::pressing-an-arrow-button-PICKS-that-column-too", () => {
		// d5's `.psbtn` handler is `pickSide(side); step(side, ±1)` (`:1780`): a
		// reader who reaches for the arrow has taken manual control, and leaving the
		// timer running would advance the card again a moment later, past the one
		// they just chose.
		const { container } = renderView();
		const nextOn = (i: number) =>
			Array.from(
				container
					.querySelectorAll('[data-testid="scroll-rail"]')
					[i]?.querySelectorAll("button") ?? [],
			).find((b) => (b.getAttribute("aria-label") ?? "").startsWith("Next"));

		fireEvent.click(nextOn(0) as HTMLButtonElement);
		expect(readouts(container)[0]).toBe("2 / 3");

		// A full cadence later it has NOT moved again — the column is now manual.
		advance(ADVANCE_MS * 2);
		expect(readouts(container)[0]).toBe("2 / 3");
		// …while the unpicked column kept going.
		expect(readouts(container)[1]).not.toBe("1 / 3");
	});
});
