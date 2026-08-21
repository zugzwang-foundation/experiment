// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { ProfileArena } from "@/components/profile/ProfileArena";
import type { ProfileSelection } from "@/components/profile/selection";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionRow } from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";

/**
 * ROUND 4 item 7 — THE ARGUMENT PANEL FILTERS TO THE PICKED ROW.
 *
 * ⚠ THE LOAD-BEARING ASSERTION IS THAT IT FILTERS AND DOES NOT REPLACE: the
 * full list is the default, one deselect away, and every argument that was in it
 * before is in it after. `positions.ts:151-158` drops fully-exited markets from
 * the table, so the list holds arguments the table can never reach — a
 * replacement would delete them from the surface.
 *
 * ⚠ THE MASKING ASSERTIONS READ THE BODY, NOT THE ROW (SC-1). A removed argument
 * is checked by asserting its BODY STRING is absent from the panel's serialised
 * markup, never merely that its id is missing — a row-level check cannot see a
 * second body-read path, which is the leak SC-1 was minted from.
 *
 * ⚠ ASSERTED ON `innerHTML` AND ELEMENT PRESENCE, never on flattened
 * `textContent` where the markup carries the meaning (CLAUDE.md §8 O-7).
 *
 * Fixtures are inline plain objects on the shipped DTOs (type-only imports — no
 * server code executes, no DB). No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const C_POST = "0190c0de-2222-7000-8000-000000000001";
const C_REPLY = "0190c0de-2222-7000-8000-000000000002";
const C_GONE = "0190c0de-2222-7000-8000-000000000003";
const M_POST = "0190c0de-3333-7000-8000-000000000001";
const M_REPLY = "0190c0de-3333-7000-8000-000000000002";
const M_GONE = "0190c0de-3333-7000-8000-000000000003";

const POST_BODY = "Post fixture title\n\nPost fixture body paragraph.";
const REPLY_BODY = "Reply fixture title\n\nReply fixture body paragraph.";

const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "300.000000000000000000",
	counterDharma: "100.000000000000000000",
};

const ARG_POST: ProfileArgumentItem = {
	removed: false,
	kind: "post",
	id: C_POST,
	side: "YES",
	marketSlug: "fixture-post",
	marketTitle: "Market question for the post",
	ordinal: 1,
	title: "Post fixture title",
	teaser: "Post fixture teaser.",
	body: POST_BODY,
	marker: "none",
	authorStake: "12.000000000000000000",
	// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
	authorStakeOriginal: "12.000000000000000000",
	authorSold: false,
	priceAtBet: "0.310000000000000000",
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: AGGREGATE,
};

const ARG_REPLY: ProfileArgumentItem = {
	removed: false,
	kind: "reply",
	id: C_REPLY,
	side: "NO",
	marketSlug: "fixture-reply",
	marketTitle: "Market question for the reply",
	ordinal: 4,
	title: "Reply fixture title",
	teaser: "Reply fixture teaser.",
	body: REPLY_BODY,
	marker: "none",
	stake: "6.000000000000000000",
	// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
	stakeOriginal: "6.000000000000000000",
	sold: false,
	priceAtBet: "0.270000000000000000",
	repliedToTitle: "A parent argument",
	createdAt: "2026-07-02T00:00:00.000Z",
};

const ARG_REMOVED: ProfileArgumentItem = {
	removed: true,
	kind: "post",
	id: C_GONE,
	side: "YES",
	marketSlug: "fixture-gone",
	marketTitle: "Market question for the removed",
	ordinal: 7,
	createdAt: "2026-07-03T00:00:00.000Z",
	aggregate: AGGREGATE,
};

const ITEMS = [ARG_POST, ARG_REPLY, ARG_REMOVED];

const select = (
	marketId: string,
	marketTitle: string,
	commentId: string | null,
): ProfileSelection => ({ marketId, marketTitle, commentId });

const panelHTML = () => screen.getByTestId("arguments-panel").innerHTML;
const panelTitle = () =>
	screen.getByTestId("arguments-panel-title").textContent ?? "";

describe("item 7 — the panel FILTERS, it does not replace", () => {
	it("panel::with-no-selection-the-FULL-LIST-is-the-state", () => {
		render(<ArgumentList items={ITEMS} owner={false} author={USER} />);
		expect(screen.getByTestId("argument-list")).toBeTruthy();
		expect(screen.getByTestId(`argument-${C_POST}`)).toBeTruthy();
		expect(screen.getByTestId(`argument-${C_REPLY}`)).toBeTruthy();
		expect(screen.getByTestId(`argument-removed-${C_GONE}`)).toBeTruthy();
		expect(panelTitle()).toBe("Arguments");
	});

	it("panel::a-selection-narrows-to-THAT-argument-and-nothing-else", () => {
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_POST, "Market question for the post", C_POST)}
			/>,
		);
		expect(screen.getByTestId(`argument-replica-${C_POST}`)).toBeTruthy();
		// The list itself is gone, and so are the other two arguments.
		expect(screen.queryByTestId("argument-list")).toBeNull();
		expect(screen.queryByTestId(`argument-${C_REPLY}`)).toBeNull();
		expect(screen.queryByTestId(`argument-replica-${C_REPLY}`)).toBeNull();
	});

	it("panel::the-header-becomes-the-MARKET-QUESTION-and-carries-no-percent", () => {
		// ⛔ NO PERCENTAGE. The mockup's colhead prints a live side price beside
		// the title (`:652-653`); the founder ruled it out, and `priceAtBet` is the
		// FROZEN entry price — a different quantity, so substituting it would print
		// a number that is wrong rather than one that is missing.
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_POST, "Market question for the post", C_POST)}
			/>,
		);
		expect(panelTitle()).toBe("Market question for the post");
		expect(
			screen.getByTestId("arguments-panel-head").textContent ?? "",
		).not.toContain("%");
	});

	it("panel::the-landmark-name-does-NOT-move-with-the-visible-title", () => {
		// Renaming a landmark on every pick would make the panel un-findable by
		// name for a screen-reader user.
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_POST, "Market question for the post", C_POST)}
			/>,
		);
		expect(
			screen.getByTestId("arguments-panel").getAttribute("aria-label"),
		).toBe("Arguments");
	});
});

describe("item 7 — the replica card's parts", () => {
	const renderPost = () =>
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_POST, "Market question for the post", C_POST)}
			/>,
		);

	it("replica::head-cluster-title-body-image-slot-footer-in-that-order", () => {
		renderPost();
		const card = screen.getByTestId(`argument-replica-${C_POST}`);
		const kids = [...card.children];
		const at = (testid: string) =>
			kids.findIndex(
				(k) =>
					k.getAttribute("data-testid") === testid ||
					k.contains(card.querySelector(`[data-testid="${testid}"]`)),
			);
		const title = kids.findIndex(
			(k) =>
				k.getAttribute("data-testid") === `argument-replica-title-${C_POST}`,
		);
		const body = kids.findIndex(
			(k) =>
				k.getAttribute("data-testid") === `argument-replica-body-${C_POST}`,
		);
		const slot = at(`argument-replica-image-slot-${C_POST}`);
		const foot = at(`argument-split-bar-${C_POST}`);
		// The head cluster is child 0 — it carries the author, so it is asserted by
		// content rather than by a testid it does not own.
		expect(kids[0]?.textContent).toContain(USER.pseudonym);
		expect(title).toBe(1);
		expect(body).toBe(2);
		expect(slot).toBe(3);
		expect(foot).toBe(4);
	});

	it("replica::the-body-ships-WHOLE-and-UNCLAMPED", () => {
		// The list card clamps its teaser to two lines because it is a list; this
		// panel exists to READ the argument.
		renderPost();
		const body = screen.getByTestId(`argument-replica-body-${C_POST}`);
		expect(body.textContent).toBe(POST_BODY);
		expect(body.className).not.toContain("line-clamp");
		// …and it preserves the paragraph breaks it was written with.
		expect(body.className).toContain("whitespace-pre-line");
	});

	it("replica::the-IMAGE-SLOT-exists-and-renders-NOTHING", () => {
		// ⛔ The image is a LIVE VALUE (`comments.imageUploadsId`, never selected by
		// `loadProfileArguments`) — a new server read per render. The slot is the
		// mockup's growth region and it is EMPTY: not a grey box, which would state
		// "an image is missing" on every argument, most of which have none.
		renderPost();
		const slot = screen.getByTestId(`argument-replica-image-slot-${C_POST}`);
		expect(slot.childNodes.length).toBe(0);
		expect(slot.textContent).toBe("");
		for (const banned of ["bg-", "border", "[border:"]) {
			expect(
				slot.className.includes(banned),
				`the image slot declares \`${banned}\` — it must render nothing at all`,
			).toBe(false);
		}
		// It IS the growth region, which is what pins the footer to the bottom.
		expect(slot.className.split(/\s+/)).toContain("flex-1");
		expect(slot.className.split(/\s+/)).toContain("min-h-0");
	});

	it("replica::a-POST-carries-the-split-bar-footer", () => {
		renderPost();
		expect(screen.getByTestId(`argument-split-bar-${C_POST}`)).toBeTruthy();
	});

	it("replica::a-REPLY-carries-the-Replied-to-line-and-no-split-bar", () => {
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_REPLY, "Market question for the reply", C_REPLY)}
			/>,
		);
		expect(
			screen.getByTestId(`argument-replica-reply-context-${C_REPLY}`)
				.textContent,
		).toBe("Replied to A parent argument");
		expect(screen.queryByTestId(`argument-split-bar-${C_REPLY}`)).toBeNull();
	});

	it("replica::the-title-carries-NO-`+`-affordance", () => {
		// The mockup's `.rtitle .plus` (`:346`, wired `:630`) opens the
		// full-argument pop-up — and the body is rendered in full HERE, which is what
		// the pop-up existed to reach, so there is nothing for it to reveal.
		//
		// ⚠⚠ PROFILE REFINEMENT · R4 — THE CLAIM IS UNCHANGED, THE MEASUREMENT IS
		// NARROWED. This asserted the replica card held NO buttons at all, which was
		// a true but incidental way to say "no `+`": the card had no controls of any
		// kind. R4 gives it the shipped head cluster (bookmark + disabled download),
		// so an all-buttons assertion now fails for a reason that has nothing to do
		// with the `+`. It reads the `+` specifically instead.
		// ⛔ AND THE `+` IS STILL DELIBERATELY ABSENT HERE, not merely unbuilt: it IS
		// built, on the argument-LIST card where the teaser is clamped and there is
		// something to reveal. On this card it would reveal nothing.
		renderPost();
		const card = screen.getByTestId(`argument-replica-${C_POST}`);
		const labels = [...card.querySelectorAll("button")].map(
			(b) => `${b.textContent ?? ""}|${b.getAttribute("aria-label") ?? ""}`,
		);
		expect(labels.some((l) => l.startsWith("+"))).toBe(false);
		expect(labels.some((l) => l.includes("Show more"))).toBe(false);
		// …and the cluster IS here, so the narrowing did not quietly drop coverage of
		// what the card should carry.
		expect(labels.some((l) => l.includes("Bookmark"))).toBe(true);
		expect(labels.some((l) => l.includes("Download"))).toBe(true);
	});
});

describe("item 7 — masking survives the filter (SC-1)", () => {
	it("replica::a-REMOVED-opener-with-no-id-renders-the-stub-and-NO-body", () => {
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_GONE, "Market question for the removed", null)}
			/>,
		);
		expect(screen.getByTestId("argument-replica-removed")).toBeTruthy();
		// ⚠ THE BODY, NOT THE ROW. Every body string on this surface must be
		// absent from the panel's serialised markup, not merely un-listed.
		for (const body of [POST_BODY, REPLY_BODY]) {
			expect(panelHTML()).not.toContain(body);
		}
	});

	it("replica::a-MATCHED-but-removed-item-renders-the-stub-with-its-head", () => {
		// The identity of a removed argument's author is not the thing that was
		// removed — the removed union variant still carries side + author.
		render(
			<ArgumentList
				items={ITEMS}
				owner={false}
				author={USER}
				selection={select(M_GONE, "Market question for the removed", C_GONE)}
			/>,
		);
		const card = screen.getByTestId("argument-replica-removed");
		expect(card.textContent).toContain(USER.pseudonym);
		expect(panelHTML()).not.toContain(POST_BODY);
		expect(panelHTML()).not.toContain(REPLY_BODY);
	});
});

/** A positions row whose episode opener is the given comment. */
function rowFor(
	marketId: string,
	slug: string,
	marketTitle: string,
	commentId: string | null,
	ordinal: number,
): ProfilePositionRow {
	return {
		lots: [],
		marketId,
		marketSlug: slug,
		marketTitle,
		marketStatus: "Open",
		statusLabel: "Open",
		settled: false,
		side: "YES",
		quantity: "10.000000000000000000",
		staked: "25.000000000000000000",
		current: "31.000000000000000000",
		argument:
			commentId === null
				? { removed: true, marketSlug: slug }
				: {
						removed: false,
						commentId,
						title: "Opener",
						isReply: false,
						postOrdinal: ordinal,
						marketSlug: slug,
						repliedToTitle: null,
					},
	};
}

describe("items 5 + 7 end to end — picking a row moves the panel", () => {
	const ROWS = [
		rowFor(M_POST, "fixture-post", "Market question for the post", C_POST, 1),
		rowFor(
			M_REPLY,
			"fixture-reply",
			"Market question for the reply",
			C_REPLY,
			4,
		),
	];

	const mount = () =>
		render(
			<ProfileArena
				positions={{ owner: false, rows: ROWS }}
				argumentItems={ITEMS}
				owner={false}
				author={USER}
			/>,
		);

	it("arena::THE-PANEL-OPENS-ON-THE-FIRST-ROW-S-ARGUMENT", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED AT THE FRONT. This opened by asserting
		// the FULL LIST was on screen at mount and that a click then filtered it. R3
		// rules the opposite: the rail must show a full post on load, because a rail
		// of stubs was the defect. So the arena now mounts already filtered to the
		// first row's argument, under that row's market question.
		mount();
		expect(screen.queryByTestId("argument-list")).toBeNull();
		expect(screen.getByTestId(`argument-replica-${C_POST}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market question for the post");
	});

	it("arena::a-click-on-ANOTHER-row-moves-the-panel-to-ITS-argument", () => {
		// The half of the original claim that survives unchanged: a pick still drives
		// the panel. Asserted on the row that is NOT the mount default, so it is a
		// real transition rather than a no-op.
		mount();
		fireEvent.click(screen.getByTestId(`position-row-${M_REPLY}`));
		expect(screen.getByTestId(`argument-replica-${C_REPLY}`)).toBeTruthy();
		expect(panelTitle()).toBe("Market question for the reply");
	});

	it("arena::A-SECOND-CLICK-KEEPS-THE-PANEL-rather-than-emptying-it", () => {
		// ⚠⚠ PROFILE REFINEMENT · R3 — INVERTED. This asserted that a second click
		// DESELECTED and returned the full list under the header word `Arguments`.
		// R3 retires deselect: the panel always holds a selection, so clearing would
		// re-derive to the first visible row — making a second click a no-op on row
		// one and a jump-to-row-one elsewhere. The full-list arm is not dead (a
		// zero-row filter and every call site that passes no selection still reach
		// it); it is simply no longer where a second click goes.
		mount();
		const row = screen.getByTestId(`position-row-${M_REPLY}`);
		fireEvent.click(row);
		expect(screen.getByTestId(`argument-replica-${C_REPLY}`)).toBeTruthy();
		fireEvent.click(row);
		expect(screen.getByTestId(`argument-replica-${C_REPLY}`)).toBeTruthy();
		expect(screen.queryByTestId("argument-list")).toBeNull();
		expect(panelTitle()).toBe("Market question for the reply");
	});

	it("arena::THE-PANEL-FOLLOWS-THE-ARROW-KEYS", () => {
		// The founder's own verification step: arrows step rows, wrap, and the
		// panel follows. Both halves are asserted from the panel's side.
		// ⚠ PROFILE OVERLAP R4 — THE PANEL STARTS ON THE FIRST ROW, so the first
		// press moves to the SECOND. This used to open on the first press because
		// the stepper anchored on the stored pick and re-selected row one; the panel
		// therefore appeared to "follow" a press that had moved nothing. The claim
		// is unchanged and the sequence is one row earlier.
		mount();
		const table = screen.getByTestId("positions-table");
		expect(screen.getByTestId(`argument-replica-${C_POST}`)).toBeTruthy();
		fireEvent.keyDown(table, { key: "ArrowDown" });
		expect(screen.getByTestId(`argument-replica-${C_REPLY}`)).toBeTruthy();
		// …and it WRAPS back to the first.
		fireEvent.keyDown(table, { key: "ArrowDown" });
		expect(screen.getByTestId(`argument-replica-${C_POST}`)).toBeTruthy();
	});

	it("arena::a-filter-that-hides-the-picked-row-returns-the-panel-to-the-list", () => {
		// The derived-selection rule reaching the OTHER side of the arena: a panel
		// filtered to a row that is no longer on screen would be unexplainable.
		mount();
		fireEvent.click(screen.getByTestId(`position-row-${M_POST}`));
		expect(screen.getByTestId(`argument-replica-${C_POST}`)).toBeTruthy();
		fireEvent.click(screen.getByTestId("positions-status-closed"));
		expect(screen.getByTestId("argument-list")).toBeTruthy();
		expect(panelTitle()).toBe("Arguments");
	});
});
