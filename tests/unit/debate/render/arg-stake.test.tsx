// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
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
