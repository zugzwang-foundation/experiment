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
function widestRow(extra?: {
	badge?: "Highest Stakes";
	download?: { ordinal: number };
}) {
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
			download={extra?.download}
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

	it("arg-profile-row::the-separator-LEADS-group-B-rather-than-trailing-group-A", () => {
		// SEP-1, founder ruling — AND THIS ASSERTION IS INVERTED FROM WHAT IT SAID
		// UNTIL THIS COMMIT. It read
		// `arg-profile-row::NO-separator-stands-between-the-replies-and-the-age`,
		// on rule 7: "the pipes inside group A stay; the one before the age goes.
		// It would DANGLE at the end of line 1 the moment group B wrapped."
		//
		// The dangle was real; deleting the separator was the wrong remedy for it,
		// and it left this row the only author row in the product without one —
		// `… REPLIES · 2  14d ago` here against `… Đ 18 | 1d ago` on Discovery and
		// on the profile, off the SAME governing rule (canon §3 item 11).
		//
		// ⛔ THE PLACEMENT IS THE FIX, AND IT IS WHAT THIS ASSERTS. A separator
		// that is a sibling of group B is the last thing on line 1 when the group
		// wraps away from it — the dangle. As group B's FIRST CHILD it travels
		// with the timestamp it divides, and line 2 reads `| 14d ago  [badge]`.
		// That is accepted and known; nothing measures around it.
		//
		// ⚠ jsdom performs no layout, so this cannot see a wrap. What it CAN see
		// is the containment that decides the wrap's outcome, which is exactly the
		// part that was wrong.
		const { container } = widestRow({ badge: "Highest Stakes" });
		const [groupA, groupB] = groups(container);
		expect(groupA?.textContent).toContain("|");
		expect(groupB?.textContent ?? "").toContain("|");
		// FIRST child, not merely present: appended after the age it would divide
		// nothing, and would trail line 2 instead of leading it.
		const first = groupB?.firstElementChild ?? null;
		expect(first?.getAttribute("data-field-separator")).toBe("");
		expect(first?.textContent).toBe("|");
	});

	it("arg-profile-row::every-separator-on-the-row-is-the-SHARED-primitive", () => {
		// SEP-1 — the defect was not one missing pipe, it was three private
		// copies of the same element drifting apart. Counting pipes that are NOT
		// the shared component is what would catch a fourth copy being hand-rolled
		// back in, which is how the first three arrived.
		const { container } = widestRow({ badge: "Highest Stakes" });
		const pipes = [...container.querySelectorAll("span")].filter(
			(el) => el.textContent === "|",
		);
		expect(pipes.length).toBeGreaterThan(0);
		for (const pipe of pipes) {
			expect(pipe.getAttribute("data-field-separator")).toBe("");
			// The glyph is U+007C, plain ASCII — asserted by CODE POINT so a
			// visually identical look-alike (U+2502 and the box-drawing family)
			// reddens, exactly as the Discovery and profile guards do.
			expect(pipe.textContent?.codePointAt(0)).toBe(0x7c);
			// Punctuation, and never announced. Two of the three copies this
			// primitive replaces lacked this, so Discovery and the profile were
			// reading their pipes aloud.
			expect(pipe.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("arg-profile-row::the-download-mark-is-OUTSIDE-the-wrapping-area", () => {
		// Rule 3 — the mark never wraps and never lands between the two lines.
		// Being a sibling of the wrapping area is what makes that structural
		// rather than a matter of which utilities happen to win.
		const { container } = widestRow({
			badge: "Highest Stakes",
			download: { ordinal: 1 },
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
		const withBadge = widestRow({
			badge: "Highest Stakes",
			download: { ordinal: 1 },
		});
		const withoutBadge = widestRow({ download: { ordinal: 1 } });
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
		// TWO children — the separator and the age. ⚠ It was ONE until SEP-1 put
		// the divider back INSIDE this group; the assertion moved because the
		// composition did, and what it is actually guarding is unchanged: no
		// badge slot, empty or otherwise, on a reply.
		expect(groupB?.children).toHaveLength(2);
		expect(groupB?.querySelector("[data-relative-time]")).not.toBeNull();
		expect(groupB?.querySelector("[data-field-separator]")).not.toBeNull();
		expect(groupB?.textContent).not.toContain("Highest Stakes");
	});
});

/**
 * MOBILE-2e · R-Q1 — **THE LIFT REACHES THE DOM**, which nothing established.
 *
 * ⛔⛔ `ArgProfile` hands `PositionMarker` and `LaneBadge` a `className`, and
 * both are supposed to merge it. `@test-writer` DELETED `className` from the
 * `cn(...)` call in `badges.tsx` — so the prop is accepted and silently thrown
 * away, the chips never lift, and the phone's identity row goes back to the
 * arrangement R-Q1 exists to end — and **all 3 643 unit tests stayed green**,
 * in both components. Every guard for those tokens read the CALL SITE.
 *
 * A prop asserted where it is passed is not a prop asserted where it lands.
 * This renders the row and asks the DOM.
 *
 * ⚠ The token is assembled rather than written: Tailwind v4 scans `tests/`, so
 * a literal here becomes a real utility in the built stylesheet and the built
 * sheet stops being evidence of what components use (AGENTS.md §8).
 */
describe("MOBILE-2n R-1 / A10 D-1 — line 1 is the name's, and the chips land after the age", () => {
	const LIFT = `${["max", "mobile"].join("-")}:-order-2`;
	const PAST = `${["max", "mobile"].join("-")}:order-1`;

	/**
	 * ⛔⛔ THIS BLOCK IS MOBILE-2e R-Q1's, INVERTED BY ADR-0051 A10 D-1 RATHER
	 * THAN DELETED. R-Q1 lifted FOUR passengers onto line 1 — the pseudonym, the
	 * position marker, the `Sold` chip and the lane badge — and its own comment
	 * recorded why a rendered check was needed: two of those four take the lift
	 * through a `className` PROP, and a badge that accepts the prop and discards
	 * it leaves every source scan green while the chips stay put. That hazard is
	 * unchanged and is why these rows still read the DOM; only the destination
	 * has reversed.
	 */
	it("arg-profile-row::ONE-passenger-carries-the-lift-IN-THE-DOM", () => {
		const { container } = widestRow({ badge: "Highest Stakes" });
		const lifted = [...container.querySelectorAll("*")].filter((el) =>
			(el.getAttribute("class") ?? "").split(/\s+/).includes(LIFT),
		);
		expect(
			lifted.length,
			"line 1 has more than the pseudonym on it. A10 D-1 gives that line to " +
				"the name, the avatar and the export mark and to nothing else.",
		).toBe(1);
		expect(
			lifted[0]?.tagName.toLowerCase() +
				(lifted[0]?.getAttribute("href") ?? ""),
			"the one lifted node is not the pseudonym link",
		).toMatch(/^a\/u\//);
	});

	it("arg-profile-row::each-chip-is-ordered-PAST-the-meta-row-where-a-reader-would-look", () => {
		const { container } = widestRow({ badge: "Highest Stakes" });
		const tokens = (el: Element | null) =>
			(el?.getAttribute("class") ?? "").split(/\s+/);
		expect(
			tokens(container.querySelector('[data-testid="argstake-sold"]')),
			"the Sold chip",
		).toContain(PAST);
		// The marker is the one whose prop was being discarded at R-Q1 — the same
		// hazard, read on the rendered node rather than in the source.
		const marker = [...container.querySelectorAll("*")].find(
			(el) => el.textContent === "Flipped",
		);
		expect(marker, "the position marker did not render").toBeDefined();
		expect(tokens(marker ?? null), "the position marker").toContain(PAST);
		// ⛔ AND THE LANE BADGE TAKES NEITHER, which is a third state rather than
		// the absence of the second: order 0 lands it at its own DOM position,
		// immediately after the age, which is where canon §3 item 11 puts it.
		const lane = [...container.querySelectorAll("*")].find(
			(el) => el.textContent === "Highest Stakes",
		);
		expect(lane, "the lane badge did not render").toBeDefined();
		expect(tokens(lane ?? null), "the lane badge").not.toContain(PAST);
		expect(tokens(lane ?? null), "the lane badge").not.toContain(LIFT);
	});

	it("arg-profile-row::POSITIVE-CONTROL-the-badge-is-what-the-counts-are-reading", () => {
		// ⛔ Without a badge this row has TWO ordered chips, not three — so the
		// rows above are reading the lane badge and not a constant. ⚠ The lift
		// count is unchanged at one, which is the other half of the control: the
		// badge's presence must not reach line 1 in either direction.
		const { container } = widestRow();
		const count = (token: string) =>
			[...container.querySelectorAll("*")].filter((el) =>
				(el.getAttribute("class") ?? "").split(/\s+/).includes(token),
			).length;
		expect(count(PAST), "a lane badge ordered itself out of nowhere").toBe(2);
		expect(count(LIFT), "line 1's membership depends on the badge").toBe(1);
	});
});
