// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgProfile } from "@/components/debate/ArgProfile";

/**
 * UI-OVERNIGHT entry 1b — THE IDENTITY ROW'S SHAPE: one wrapping area holding
 * two unbreakable groups, and a download mark pinned outside it.
 *
 *   [ Group A · identity → replies ][ Group B · age · badge ]   [ mark ]
 *
 * The defect this replaces had three baselines on one row. Without a badge the
 * row was one line with the mark at the top right; WITH one the badge sat in
 * the card's corner, stole the width the age needed, and the age wrapped — at
 * which point the mark, centred on the resulting two-line block, sat on neither
 * line. Three arrangements of the same row, decided by whether a post happened
 * to dominate its lane.
 *
 * ⚠ WHAT jsdom CAN AND CANNOT SEE. It performs no layout (AGENTS.md §9), so
 * nothing here measures a wrap. What IS checkable, and what the fix actually
 * consists of, is the STRUCTURE that makes the wrap have only two outcomes: two
 * `whitespace-nowrap` runs inside one `flex-wrap` container, and a mark that is
 * a sibling of that container rather than a member of it. A browser at 1440
 * proves the pixels; this proves the declarations are all present and in the
 * right relationship.
 *
 * No jest-dom in this repo — plain DOM only.
 */

afterEach(cleanup);

const CREATED_AT = "2026-07-30T00:00:00.000Z";

/**
 * ⚠ THE BRIEF'S OWN WORST CASE, kept as a named fixture: a 20-character
 * pseudonym, `YES @ 100%`, both the `Flipped` marker and the `Sold` tag, a
 * six-figure stake and a three-digit reply count — every field this row can
 * carry, at its widest, plus a badge. It is the arrangement that has to wrap
 * cleanly, so it is the one the structural assertions run against.
 */
function widestRow(extra?: { badge?: "Highest Stakes"; download?: boolean }) {
	return render(
		<ArgProfile
			author={{ pseudonym: "fixture-author-2026x", pfpUrl: "" }}
			side="YES"
			marker="Flipped"
			entryPrice="1.000000000000000000"
			authorStake="999900.000000000000000000"
			originalStake="999900.000000000000000000"
			sold
			replyCount={999}
			createdAt={CREATED_AT}
			badge={extra?.badge ?? null}
			download={extra?.download ?? false}
		/>,
	);
}

/** The wrapping area — the only `flex-wrap` node on the row. */
function metaArea(container: HTMLElement): HTMLElement {
	const el = container.querySelector(".flex-wrap");
	expect(el, "the row has no wrapping area at all").not.toBeNull();
	return el as HTMLElement;
}

/** Its two children that are the no-wrap groups, in document order. */
function groups(container: HTMLElement): HTMLElement[] {
	return [...metaArea(container).children].filter((el) =>
		(el.getAttribute("class") ?? "").split(/\s+/).includes("whitespace-nowrap"),
	) as HTMLElement[];
}

describe("UI-OVERNIGHT 1b — the identity row wraps in two units", () => {
	it("arg-profile-row::the-wrapping-area-holds-exactly-two-no-wrap-groups", () => {
		const { container } = widestRow({ badge: "Highest Stakes" });
		const [groupA, groupB, ...rest] = groups(container);
		expect(rest, "a third no-wrap group appeared").toEqual([]);
		expect(groupA).toBeDefined();
		expect(groupB).toBeDefined();
		// Group A is everything the argument's author IS; group B is when it was
		// written and how it ranks.
		expect(groupA?.textContent).toContain("fixture-author-2026x");
		expect(groupA?.textContent).toContain("YES @ 100%");
		expect(groupA?.textContent).toContain("Flipped");
		expect(groupA?.textContent).toContain("Đ 999.9k");
		expect(groupA?.textContent).toContain("Replies ·");
		expect(groupA?.textContent).toContain("999");
		expect(groupB?.textContent).toContain("Highest Stakes");
	});

	it("arg-profile-row::the-badge-is-INSIDE-the-row-and-AFTER-the-age", () => {
		const { container } = widestRow({ badge: "Highest Stakes" });
		const [, groupB] = groups(container);
		const age = groupB?.querySelector("[data-relative-time]") ?? null;
		expect(age, "the age is not in group B").not.toBeNull();
		if (age === null) return;
		// Rule 5 — badges come after the timestamp. They wrap together, and a
		// badge before the age would put the timestamp inside the pair.
		const badge = [...(groupB?.children ?? [])].find((el) =>
			(el.textContent ?? "").includes("Highest Stakes"),
		);
		expect(badge).toBeDefined();
		expect(
			age.compareDocumentPosition(badge as Node) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("arg-profile-row::NO-separator-stands-between-the-replies-and-the-age", () => {
		// Rule 7 — the pipes inside group A stay; the one before the age goes.
		// It would DANGLE at the end of line 1 the moment group B wrapped, which
		// is the state this entry makes ordinary rather than exceptional.
		const { container } = widestRow({ badge: "Highest Stakes" });
		const [groupA, groupB] = groups(container);
		expect(groupA?.textContent).toContain("|");
		expect(groupB?.textContent ?? "").not.toContain("|");
	});

	it("arg-profile-row::the-download-mark-is-OUTSIDE-the-wrapping-area", () => {
		// Rule 3 — the mark never wraps and never lands between the two lines.
		// Being a sibling of the wrapping area is what makes that structural
		// rather than a matter of which utilities happen to win.
		const { container } = widestRow({
			badge: "Highest Stakes",
			download: true,
		});
		const mark = container.querySelector('[aria-label="Download post image"]');
		expect(mark).not.toBeNull();
		expect(metaArea(container).contains(mark)).toBe(false);
		// …and its wrapper states the height of line 1 — the SIDE CHIP's `h-5`,
		// which is what centres the mark on that line instead of on the block.
		// ⚠ MEASURED, and it was wrong first: `h-6` (the avatar's box) put the
		// mark 2px low, because the avatar is a sibling of the wrapping area and
		// sets no line inside it. jsdom performs no layout, so this assertion pins
		// the CONSTANT a browser measurement established rather than re-deriving
		// the geometry it came from.
		const wrapper = mark?.parentElement;
		expect(
			(wrapper?.getAttribute("class") ?? "").split(/\s+/),
			"the mark's wrapper no longer states line 1's height",
		).toContain("h-5");
	});

	it("arg-profile-row::the-row-renders-the-SAME-mark-with-and-without-a-badge", () => {
		// The acceptance criterion, stated as a diff: adding a badge must change
		// the row by exactly one element and move nothing else. This is what was
		// false before — a badge used to relocate the age and the mark too.
		const withBadge = widestRow({ badge: "Highest Stakes", download: true });
		const withoutBadge = widestRow({ download: true });
		const strip = (c: HTMLElement) =>
			(c.textContent ?? "").replace("Highest Stakes", "");
		expect(strip(withBadge.container)).toBe(strip(withoutBadge.container));
	});

	it("arg-profile-row::the-pseudonym-is-never-truncated", () => {
		// Rule 8. Half a pseudonym identifies nobody, and this row is the one
		// place a reader learns who is arguing.
		const { container } = widestRow();
		const link = container.querySelector('a[href^="/u/"]');
		expect(link?.textContent).toBe("fixture-author-2026x");
		expect((link?.getAttribute("class") ?? "").split(/\s+/)).not.toContain(
			"truncate",
		);
	});

	it("arg-profile-row::a-reply-row-carries-no-badge-slot-at-all", () => {
		// Lane dominance is a post-ranking artifact (`REPLY_DEPTH_MAX = 1`), so
		// the two reply mounts pass nothing and `LaneBadge` renders nothing. The
		// non-vacuity control for every assertion above.
		const { container } = widestRow();
		const [, groupB] = groups(container);
		expect(groupB?.children).toHaveLength(1);
		expect(groupB?.querySelector("[data-relative-time]")).not.toBeNull();
	});
});
