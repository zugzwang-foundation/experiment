// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollRail } from "@/components/debate/ScrollRail";

/**
 * HTML-FINISH · MARKET DETAIL rows 18 + 19 — the vertical scroller rail
 * (`.pscroll` `d5:887` for posts, `.rps` `:917` for replies: the same control at
 * two mount points).
 *
 * ⛔⛔ THE ASSERTION THAT MATTERS MOST IS THE `sr-only` READOUT, and it is the
 * one a literal port would have deleted. The horizontal strip this rail replaces
 * rendered a visible `1 / 3` with `aria-live="polite"`, so a screen-reader user
 * heard their position change on every page. d5's rail is a PURELY VISUAL fill
 * and announces nothing — porting it faithfully would have turned a fidelity row
 * into an accessibility regression, silently, with every other assertion here
 * still passing.
 *
 * ⛔ ROW 29 IS NOT A REGRESSION OF THE PAGED LIST. The rail replaces the prev/next
 * STRIP, never the paging MODEL — one card at a time, client-side, unchanged.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const noop = () => {};

describe("ScrollRail — rows 18 + 19", () => {
	it("scroll-rail::the-position-is-still-ANNOUNCED", () => {
		const { container } = render(
			<ScrollRail
				index={1}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
			/>,
		);

		const live = container.querySelector('[aria-live="polite"]');
		expect(live).not.toBeNull();
		expect(live?.textContent?.replace(/\s+/g, " ")).toContain("2 / 3");
		// It is `sr-only`, not deleted: the FILL is the visual channel now.
		expect(live?.getAttribute("class")).toContain("sr-only");
	});

	it("scroll-rail::the-fill-is-the-read-through-proportion", () => {
		const { container } = render(
			<ScrollRail
				index={1}
				total={4}
				noun="post"
				onPrev={noop}
				onNext={noop}
			/>,
		);

		const fill = container.querySelector<HTMLElement>(
			'[data-testid="scroll-rail-fill"]',
		);
		// Second of four read ⇒ half the track.
		expect(fill?.style.height).toBe("50%");
		// The TRACK is decorative — the readout above is the accessible channel.
		expect(
			container
				.querySelector('[data-testid="scroll-rail-track"]')
				?.getAttribute("aria-hidden"),
		).toBe("true");
	});

	it("scroll-rail::a-single-item-reads-FULL-not-empty", () => {
		// No travel to make: an empty bar would read as "nothing read yet" on a
		// scroller that is already showing everything it has.
		const { container } = render(
			<ScrollRail
				index={0}
				total={1}
				noun="reply"
				onPrev={noop}
				onNext={noop}
			/>,
		);
		expect(
			container.querySelector<HTMLElement>('[data-testid="scroll-rail-fill"]')
				?.style.height,
		).toBe("100%");
	});

	it("scroll-rail::the-ends-disable-and-the-labels-are-byte-carried", () => {
		const onPrev = vi.fn();
		const onNext = vi.fn();
		const { container } = render(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={onPrev}
				onNext={onNext}
			/>,
		);

		// d5's own labels, and the ones the strip already used.
		const prev = screen.getByRole("button", { name: "Previous post" });
		const next = screen.getByRole("button", { name: "Next post" });
		expect((prev as HTMLButtonElement).disabled).toBe(true);
		expect((next as HTMLButtonElement).disabled).toBe(false);

		fireEvent.click(next);
		expect(onNext).toHaveBeenCalledTimes(1);
		// A disabled control must not fire — the clamp lives in the scroller, but
		// a rail that reported past the end would page onto nothing.
		fireEvent.click(prev);
		expect(onPrev).not.toHaveBeenCalled();

		cleanup();
		render(
			<ScrollRail
				index={2}
				total={3}
				noun="reply"
				onPrev={noop}
				onNext={noop}
			/>,
		);
		expect(
			(screen.getByRole("button", { name: "Next reply" }) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(container).toBeTruthy();
	});

	it("scroll-rail::carries-NO-d5-length", () => {
		// ⛔ The one surviving rule. d5's rail is `92px` tall, `5px` wide,
		// `gap:9px`, `right:2px` — none of those may appear. The fill's
		// `w-[3px] rounded-[1px]` is BYTE-CARRIED from `shell/RadioSlot.tsx`,
		// already on `main`, which is why it is the one length that may.
		const { container } = render(
			<ScrollRail
				index={0}
				total={3}
				noun="post"
				onPrev={noop}
				onNext={noop}
			/>,
		);
		const html = container.innerHTML;
		for (const forbidden of ["92px", "5px", "gap-[9px]", "right-[2px]"]) {
			expect(html).not.toContain(forbidden);
		}
		expect(html).toContain("w-[3px]");
	});
});
