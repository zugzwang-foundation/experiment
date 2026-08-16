// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollRail } from "@/components/debate/ScrollRail";

/**
 * HTML-FINISH · MARKET DETAIL rows 18 + 19 — the vertical scroller rail
 * (`.pscroll` `d5:887` for posts, `.rps` `:917` for replies: the same control at
 * two mount points) — and, from round 2 · R3, its COUNTDOWN.
 *
 * ⛔⛔ THE ASSERTION THAT MATTERS MOST IS THE `sr-only` READOUT, and it is the
 * one a literal port would have deleted. The horizontal strip this rail replaces
 * rendered a visible `1 / 3` with `aria-live="polite"`, so a screen-reader user
 * heard their position change on every page. d5's rail is a PURELY VISUAL fill
 * and announces nothing — porting it faithfully would have turned a fidelity row
 * into an accessibility regression, silently, with every other assertion here
 * still passing. ⚠ R3 makes it MORE load-bearing, not less: the card now changes
 * with no user action at all, so this is the only channel that says so.
 *
 * ⛔ ROW 29 IS NOT A REGRESSION OF THE PAGED LIST. The rail replaces the prev/next
 * STRIP, never the paging MODEL — one card at a time, client-side, unchanged.
 *
 * ⚠⚠ TWO ROUND-2 REVERSALS ARE RECORDED HERE RATHER THAN SWAPPED IN SILENTLY:
 *
 *  1. `scroll-rail::the-fill-is-the-read-through-proportion` asserted
 *     `index 1 of 4 ⇒ height "50%"`, and `::a-single-item-reads-FULL-not-empty`
 *     asserted `100%`. The fill is now a COUNTDOWN driven by `durationMs` and
 *     `progressKey`; it says nothing about position at all.
 *  2. `::the-ends-disable-and-the-labels-are-byte-carried` asserted
 *     `prev.disabled === true` at index 0. The arrows no longer disable — the
 *     list wraps, because auto-advance and end-clamping cannot both be right.
 *     ⚠ THE MEASUREMENT THAT GROUNDS THAT, taken on live staging BEFORE the
 *     change: `Previous` was correctly `disabled: true` at index 0 and `Next`
 *     became `disabled: true` after one click on a 2-post side. Nothing was
 *     broken; the clamp was simply incompatible with a timer that must wrap.
 *
 * The BYTE-CARRIED LABELS half of (2) survives and is kept as its own case.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only. Fake
 * timers + `act()` for the interval behaviour (the F-DEBATE-4 harness pattern).
 */

afterEach(cleanup);

const noop = () => {};

/** Paused: no timer, empty track. The pre-R3 render's closest analogue. */
const PAUSED = { durationMs: null, progressKey: 0 } as const;

describe("ScrollRail — rows 18 + 19", () => {
	it("scroll-rail::the-position-is-still-ANNOUNCED", () => {
		const { container } = render(
			<ScrollRail
				index={1}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
				{...PAUSED}
			/>,
		);

		const live = container.querySelector('[aria-live="polite"]');
		expect(live).not.toBeNull();
		expect(live?.textContent?.replace(/\s+/g, " ")).toContain("2 / 3");
		// It is `sr-only`, not deleted: the FILL is the visual channel now.
		expect(live?.getAttribute("class")).toContain("sr-only");
	});

	it("scroll-rail::a-PAUSED-rail-empties-its-track", () => {
		// ⛔ EMPTY, NOT FROZEN PARTWAY. A bar left at 40% while no timer runs is a
		// picture of a countdown that is not counting — d5's `stopFill` sets
		// `height:0%` (`:1731`) and hides the loader outright on a picked column
		// (`:897`). Position is NOT what this bar means any more, which is exactly
		// the reversal: the superseded assertion read `index 1 of 4 ⇒ "50%"`.
		const { container } = render(
			<ScrollRail
				index={1}
				total={4}
				noun="post"
				onPrev={noop}
				onNext={noop}
				{...PAUSED}
			/>,
		);

		const fill = container.querySelector<HTMLElement>(
			'[data-testid="scroll-rail-fill"]',
		);
		expect(fill?.style.height).toBe("0%");
		// The TRACK is decorative — the readout above is the accessible channel.
		expect(
			container
				.querySelector('[data-testid="scroll-rail-track"]')
				?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("scroll-rail::the-labels-are-byte-carried-and-BOTH-arrows-stay-live", () => {
		const onPrev = vi.fn();
		const onNext = vi.fn();
		render(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={onPrev}
				onNext={onNext}
				{...PAUSED}
			/>,
		);

		// d5's own labels, and the ones the strip already used.
		const prev = screen.getByRole("button", { name: "Previous post" });
		const next = screen.getByRole("button", { name: "Next post" });

		// ⚠ REVERSED: `prev.disabled` was `true` here. The list wraps now, so index
		// 0 has a previous card and there is no end to clamp to.
		expect((prev as HTMLButtonElement).disabled).toBe(false);
		expect((next as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(next);
		expect(onNext).toHaveBeenCalledTimes(1);
		fireEvent.click(prev);
		expect(onPrev).toHaveBeenCalledTimes(1);

		cleanup();
		render(
			<ScrollRail
				index={2}
				total={3}
				noun="reply"
				onPrev={noop}
				onNext={noop}
				{...PAUSED}
			/>,
		);
		// The LAST card's `Next` is live too — it wraps to the first.
		expect(
			(screen.getByRole("button", { name: "Next reply" }) as HTMLButtonElement)
				.disabled,
		).toBe(false);
	});

	it("scroll-rail::carries-NO-d5-length", () => {
		// ⛔ The one surviving rule. d5's rail is `92px` tall, `5px` wide,
		// `gap:9px`, `right:2px` — none of those may appear. The fill's
		// `w-[3px] rounded-[1px]` is BYTE-CARRIED from `shell/RadioSlot.tsx`,
		// already on `main`, which is why it is the one length that may.
		// ⚠ R3 adds a DURATION to the value classes that must not be carried: d5's
		// cadence is 20s and the build's comes from `POLL_INTERVAL_MS_DEBATE_VIEW`.
		// A rail rendering a 20000ms transition would be that leak.
		const { container } = render(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
				{...PAUSED}
			/>,
		);
		const html = container.innerHTML;
		for (const forbidden of [
			"92px",
			"5px",
			"gap-[9px]",
			"right-[2px]",
			"20000",
		]) {
			expect(html).not.toContain(forbidden);
		}
		expect(html).toContain("w-[3px]");
	});
});

/**
 * HTML-FINISH · MARKET DETAIL round 2 · R3 — THE COUNTDOWN ITSELF.
 *
 * The founder's D8 reversal in one line: the loader IS the countdown to the
 * auto-advance, and nothing to count means nothing to see. Before R3 the fill
 * was `(index + 1) / total` — on the common two-post side a dead 50% that never
 * moved, which is what read as broken on staging.
 */
describe("ScrollRail — round 2 · R3, the countdown fill", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	function renderRunning(progressKey = 0) {
		return render(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
				durationMs={6000}
				progressKey={progressKey}
			/>,
		);
	}

	const heightOf = (container: HTMLElement) =>
		container.querySelector<HTMLElement>('[data-testid="scroll-rail-fill"]')
			?.style.height ?? "";

	it("scroll-rail::a-running-rail-starts-EMPTY-and-GROWS", () => {
		// ⛔ BOTH HALVES. "Starts empty" alone passes on a bar that never moves —
		// which is the exact defect this row exists to end. "Grows" alone passes on
		// a bar that starts full.
		const { container } = renderRunning();
		expect(heightOf(container)).toBe("0%");

		act(() => {
			vi.advanceTimersByTime(3000);
		});
		const half = Number.parseFloat(heightOf(container));
		expect(half).toBeGreaterThan(40);
		expect(half).toBeLessThan(60);

		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(Number.parseFloat(heightOf(container))).toBe(100);
	});

	it("scroll-rail::it-does-not-overrun-past-100", () => {
		// The interval keeps firing until the owner advances and bumps
		// `progressKey`; a fill that kept incrementing would render `height: 150%`
		// and overflow the track.
		const { container } = renderRunning();
		act(() => {
			vi.advanceTimersByTime(60_000);
		});
		expect(Number.parseFloat(heightOf(container))).toBe(100);
	});

	it("scroll-rail::a-new-progressKey-RESTARTS-the-countdown", () => {
		// This is what makes an arrow press reset the bar (the scroller bumps the
		// key on every index change, whoever caused it) and what re-arms the bar
		// after each automatic advance.
		const { container, rerender } = renderRunning(0);
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(Number.parseFloat(heightOf(container))).toBeGreaterThan(0);

		rerender(
			<ScrollRail
				index={1}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
				durationMs={6000}
				progressKey={1}
			/>,
		);
		expect(heightOf(container)).toBe("0%");
	});

	it("scroll-rail::PAUSING-mid-countdown-empties-the-bar", () => {
		// The picked/frozen transition. A bar frozen at 47% claims a timer that is
		// not running.
		const { container, rerender } = renderRunning(0);
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(Number.parseFloat(heightOf(container))).toBeGreaterThan(0);

		rerender(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
				durationMs={null}
				progressKey={0}
			/>,
		);
		expect(heightOf(container)).toBe("0%");

		// And it STAYS empty — no orphan interval kept ticking through the pause.
		act(() => {
			vi.advanceTimersByTime(10_000);
		});
		expect(heightOf(container)).toBe("0%");
	});
});
