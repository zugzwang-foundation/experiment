// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgProfile } from "@/components/debate/ArgProfile";

/**
 * RANK-1 R-B — **the badge FOLLOWS THE RULER**, at the one component every
 * debate-surface author row goes through (`PostCard`, `ReplyCard`,
 * `PostFocusHeader`, and both pop-ups all render `ArgProfile`; one guard
 * therefore covers five call sites, which is the same reason `dharma-spacing`
 * guards the spaced `Đ` here rather than four times over).
 *
 * What is being pinned, per ADR-0039 R6 and RANKING.md §7.3:
 *
 *   - the figure shown is the stake **still held** — the same number the lane
 *     sorted on, so an ordering and the figure beside it cannot disagree;
 *   - when it has MOVED, the frozen original renders **struck through** beside
 *     it, and nothing is erased;
 *   - when it has NOT moved, there is **one** number, not the same number
 *     twice;
 *   - `Sold` renders at EXACTLY zero and never on a partial (R6 is explicit
 *     that a trimmed argument gets a reduced figure and no tag — a tag there
 *     would say more than happened).
 *
 * ⛔ AND THAT THE WORD "LOT" NEVER REACHES A READER (ADR-0039 R1). That is a
 * `textContent` assertion below and it is the one assertion here that is about
 * vocabulary rather than arithmetic: "lot" is the schema's word for this thing,
 * the product's word is *argument*, and the two have to stay apart on screen.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

function renderStake(props: {
	authorStake: string;
	originalStake?: string;
	sold?: boolean;
}) {
	return render(
		<ArgProfile
			author={{ pseudonym: "fixture-author", pfpUrl: "" }}
			side="YES"
			marker="none"
			// TIME-1 — `createdAt` became REQUIRED on `ArgProfile` so that a mount
			// which forgets the age is a compile error rather than a card silently
			// missing it. This fixture therefore supplies one. ⛔ NOT AN ASSERTION
			// CHANGE: every `expect` below is untouched, and none of them reads the
			// timestamp. The value is arbitrary — nothing here measures age.
			createdAt="2026-07-30T00:00:00.000Z"
			{...props}
		/>,
	);
}

describe("RANK-1 — the rendered stake follows the ruler (ADR-0039 R6)", () => {
	it("untouched: ONE figure, no strikethrough, no tag", () => {
		const { container } = renderStake({
			authorStake: "1500.000000000000000000",
			originalStake: "1500.000000000000000000",
			sold: false,
		});
		expect(container.innerHTML).toContain("Đ 1,500");
		// The same number twice would be noise, not information.
		expect(container.querySelector('[data-testid="argstake-original"]')).toBe(
			null,
		);
		expect(container.querySelector('[data-testid="argstake-sold"]')).toBe(null);
	});

	it("partially sold: the REDUCED figure, the original struck through, NO tag", () => {
		const { container } = renderStake({
			authorStake: "600.000000000000000000",
			originalStake: "1500.000000000000000000",
			sold: false,
		});
		const original = container.querySelector(
			'[data-testid="argstake-original"]',
		);
		expect(original).not.toBeNull();
		// ⚠ innerHTML, never textContent (O-7): the strike is carried by the
		// CLASS on this element, and textContent cannot see a class.
		expect(original?.innerHTML).toContain("Đ 1,500");
		expect(original?.getAttribute("class") ?? "").toContain("line-through");
		// R6 — a trimmed argument is a reduced number, not a tag.
		expect(container.querySelector('[data-testid="argstake-sold"]')).toBe(null);
		expect(container.innerHTML).toContain("Đ 600");
	});

	it("fully exited: Đ 0 and the Sold tag, and NO strikethrough beside it", () => {
		const { container } = renderStake({
			authorStake: "0.000000000000000000",
			originalStake: "1500.000000000000000000",
			sold: true,
		});
		expect(container.innerHTML).toContain("Đ 0");
		const tag = container.querySelector('[data-testid="argstake-sold"]');
		expect(tag).not.toBeNull();
		expect(tag?.textContent).toBe("Sold");
		// The tag already says the whole story; a struck original beside it would
		// be a second telling of the same fact.
		expect(container.querySelector('[data-testid="argstake-original"]')).toBe(
			null,
		);
	});

	it("⛔ never renders the word 'lot' to a participant (R1)", () => {
		const { container } = renderStake({
			authorStake: "0.000000000000000000",
			originalStake: "1500.000000000000000000",
			sold: true,
		});
		// Case-insensitive over the RENDERED TEXT — `data-testid`s legitimately
		// carry "lot"-free names, but a reader must never meet the schema's word.
		expect((container.textContent ?? "").toLowerCase()).not.toContain("lot");
	});

	it("a sub-Đ1 reduction shows ONE figure — the guard compares what is RENDERED", () => {
		// `formatDharma` rounds to whole Đ. A basis that moved by less than that is
		// a real change to the ruler and a NON-change to the reader, and striking a
		// number through beside an identical number is the "same number twice" the
		// branch exists to prevent. Comparing the raw 18-dp strings would do exactly
		// that; comparing the rendered values does not.
		const { container } = renderStake({
			authorStake: "1499.900000000000000000",
			originalStake: "1500.000000000000000000",
			sold: false,
		});
		expect(container.innerHTML).toContain("Đ 1,500");
		expect(container.querySelector('[data-testid="argstake-original"]')).toBe(
			null,
		);
	});

	it("omitting the original degrades to one figure rather than a false strike", () => {
		// A call site that has no original to offer must not imply the figure
		// moved. `originalStake` is optional precisely so this is the default.
		const { container } = renderStake({
			authorStake: "600.000000000000000000",
		});
		expect(container.innerHTML).toContain("Đ 600");
		expect(container.querySelector('[data-testid="argstake-original"]')).toBe(
			null,
		);
		expect(container.querySelector('[data-testid="argstake-sold"]')).toBe(null);
	});
});

/**
 * UI-OVERNIGHT entry 1a — the header stake ABBREVIATES past Đ10,000, and the
 * exact figure survives on the element's tooltip.
 *
 * ⚠ WHY IT IS GUARDED AT THE RENDER AND NOT ONLY AT THE FORMATTER.
 * `tests/unit/debate/format.test.ts` proves the rule; this proves the ROW USES
 * IT. Those are two claims, and the second is the one that was broken before
 * this task: a correct formatter that no card calls changes nothing on screen.
 *
 * ⚠ THE STRIKE-THROUGH COMPARISON MOVED WITH IT, and that is the non-obvious
 * half. It compares the two stakes AS RENDERED — so two figures that both print
 * `Đ 12.5k` are one number to the reader and only one is drawn. Comparing the
 * stored values there would print `Đ 12.5k  ~~Đ 12.5k~~`, which says a stake
 * moved while showing that it did not.
 */
describe("UI-OVERNIGHT 1a — the header stake abbreviates", () => {
	it("arg-stake::under-the-threshold-renders-the-exact-grouped-figure", () => {
		const { container } = renderStake({ authorStake: "9999" });
		expect(container.textContent).toContain("Đ 9,999");
		// ⚠ READ OFF `textContent`, NOT `innerHTML`: a bare `k` occurs in a dozen
		// Tailwind class names on this row, so the same assertion over the markup
		// is red for a reason that has nothing to do with the figure.
		expect(container.textContent).not.toContain("Đ 10k");
	});

	it("arg-stake::at-and-past-the-threshold-renders-the-k-form", () => {
		const { container } = renderStake({ authorStake: "12500" });
		expect(container.textContent).toContain("Đ 12.5k");
		// Non-vacuity: the exact spelling is GONE from the row, not merely joined.
		expect(container.textContent).not.toContain("12,500");
	});

	it("arg-stake::the-abbreviated-figure-carries-the-exact-value", async () => {
		const { container } = renderStake({ authorStake: "12500" });
		const figure = container.querySelector(
			'.font-mono:not([data-slot="badge"])',
		) as HTMLElement;
		expect(figure.textContent).toBe("Đ 12.5k");
		// INFO-1's affordance, merged onto the figure (`asChild`) rather than
		// wrapping it — so the tip is reachable by pointer AND by tap, which a
		// native `title` is not.
		const describedBy = figure.getAttribute("aria-describedby");
		expect(describedBy).toBeTruthy();
		// ⛔ THE CONTENT IS PORTALLED AND ONLY EXISTS WHILE OPEN, so the exact
		// figure is asserted after a tap rather than in the closed markup. Reading
		// the closed DOM for it passes vacuously on `aria-describedby` alone and
		// proves nothing about WHAT the tip says — which is the whole claim.
		// jsdom has no `matchMedia`, so `usePointerFine` takes its unknown ⇒ touch
		// default and this is the Popover branch (INFO-1).
		expect(document.body.textContent).not.toContain("Đ 12,500");
		fireEvent.click(figure);
		await waitFor(() => {
			expect(document.body.textContent).toContain("Đ 12,500");
		});
		const content = Array.from(document.querySelectorAll("[id]")).find(
			(el) => el.textContent === "Đ 12,500",
		);
		expect(content?.id).toBe(describedBy);
	});

	it("arg-stake::an-unabbreviated-figure-carries-NO-tooltip", () => {
		// A figure that already renders exactly needs no second copy of itself.
		const { container } = renderStake({ authorStake: "1500" });
		const figure = container.querySelector(
			'.font-mono:not([data-slot="badge"])',
		);
		expect(figure?.textContent).toBe("Đ 1,500");
		expect(figure?.getAttribute("aria-describedby")).toBeNull();
	});

	it("arg-stake::two-stakes-that-PRINT-the-same-draw-ONE-figure", () => {
		// 12,499 and 12,500 are both `Đ 12.5k`. The strike-through exists to show
		// movement; drawing it here would show movement that is not visible.
		const { container } = renderStake({
			authorStake: "12500",
			originalStake: "12499",
			sold: false,
		});
		expect(container.querySelector('[data-testid="argstake-original"]')).toBe(
			null,
		);
	});

	it("arg-stake::a-VISIBLE-reduction-still-strikes-the-original-through", () => {
		// The positive control for the assertion above: when the two spellings do
		// differ, both figures render and the original is struck.
		const { container } = renderStake({
			authorStake: "12500",
			originalStake: "40000",
			sold: false,
		});
		const original = container.querySelector(
			'[data-testid="argstake-original"]',
		);
		expect(original?.textContent).toBe("Đ 40k");
		expect(container.textContent).toContain("Đ 12.5k");
	});
});
