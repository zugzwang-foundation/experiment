// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// POSREV-1 — `PositionsTable` now owns the inline sell, which calls `useRouter`
// for its post-sale `refresh()`. Nothing here submits; the stub only has to exist.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { ArgumentList } from "@/components/profile/ArgumentList";
import { PROFILE_COPY } from "@/components/profile/copy";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import { ProfileError, ProfileLoading } from "@/components/profile/states";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type {
	ProfilePositionLot,
	ProfilePositionRow,
} from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * UI.A5 Slice 6 (plan §2 row 6 / §4 "Component & wiring design" / §5 surface-
 * state matrix) — the profile page-assembly components, RED-FIRST: only
 * `copy.ts` + `graph/` exist under `src/components/profile/`, so the
 * `IdentityCard` / `ProfileTiles` / `PositionsTable` / `ArgumentList` /
 * `states` imports above MUST fail to resolve until Slice 6 lands
 * (CLAUDE.md §5.6).
 *
 * Laws under test (SPEC.1 §23, 1.0.18):
 * - F-PROF-1 assembly: identity block (PFP / pseudonym / `Banned` label /
 *   scrubbed silhouette), the six tiles (canon §6 verbatim labels), the
 *   positions table (`Position · Argument · Staked · Current` + market and
 *   Open/Closed filters), the argument list.
 * - F-PROF-2 masking: a removed item renders the stub for EVERY viewer with
 *   NO title/body text (the union variant carries no such fields — the
 *   sentinel strings below are the "would-be" content and must never leak).
 * - F-PROF-3 payload law: owner render = visitor render at Slice 6 except
 *   the view chip (Sell mounts at Slice 7 — NOT here); tiles / row set /
 *   argument set are byte-identical across the two.
 * - N-7: the Arguments tile value renders `N (P Posts | R Replies)` EXACTLY.
 *
 * Fixtures are INLINE plain objects on the shipped `src/server/profile/*`
 * DTOs (type-only imports — no server code executes; NO DB). No market
 * content is invented (CLAUDE.md §3): titles follow the neutral
 * `Market <slug>` / labeled-fixture posture of the server profile suites.
 * Render tests key `data-testid`; copy asserts read the OQ-7 strings from
 * `PROFILE_COPY`, never re-authored literals (plan §6/OQ-7).
 */

afterEach(cleanup);

/**
 * HTML-FINISH row 7 — THE FILTER DRIVERS MOVED WITH THE CONTROLS, AND ONLY THE
 * DRIVERS. The market `<select>` became a labelled button that opens a popover
 * list, and the status `<select>` became a two-button segmented pair (canon §6:
 * `filters `Select market ▾`, `Open`/`Closed``), so `fireEvent.change` against
 * either is meaningless — jsdom reports "the given element does not have a
 * value setter".
 *
 * ⛔ EVERY ASSERTION IN THIS FILE IS UNCHANGED. These helpers translate HOW the
 * state is driven and HOW the selection is read; they assert nothing themselves,
 * so no test's subject moved with its mechanism. `selectedStatus` reads
 * `aria-pressed` and `selectedMarketCount` reads `role="option"` — the state a
 * `<select>` carried in `.value`/`.options` and a hand-rolled control must
 * declare explicitly.
 */
function setStatusFilter(label: "Open" | "Closed"): void {
	fireEvent.click(
		screen.getByTestId(`positions-status-${label.toLowerCase()}`),
	);
}

/** The pressed segment, read off `aria-pressed` — the `<select>`'s `.value`. */
function selectedStatus(): string | null {
	for (const label of ["Open", "Closed"] as const) {
		const btn = screen.getByTestId(`positions-status-${label.toLowerCase()}`);
		if (btn.getAttribute("aria-pressed") === "true") {
			return label;
		}
	}
	return null;
}

/** Open the market popover and click one option (`"all"` or a marketId). */
function setMarketFilter(marketId: string): void {
	fireEvent.click(screen.getByTestId("positions-market-filter"));
	fireEvent.click(screen.getByTestId(`positions-market-option-${marketId}`));
}

/** The popover's option count — the `<select>`'s `.options.length`. Opens the
 * popover to count, then closes it again so the caller's state is unchanged. */
function marketOptionCount(): number {
	const trigger = screen.getByTestId("positions-market-filter");
	fireEvent.click(trigger);
	const n = screen
		.getByTestId("positions-market-popover")
		.querySelectorAll('[role="option"]').length;
	fireEvent.click(trigger);
	return n;
}

/** The chosen market, read off `aria-selected` inside the popover — the
 * `<select>`'s `.value`. Returns `"all"` for the sentinel option. Opens the
 * popover to read, then closes it again so the caller's state is unchanged. */
function selectedMarket(): string | null {
	const trigger = screen.getByTestId("positions-market-filter");
	fireEvent.click(trigger);
	const chosen = screen
		.getByTestId("positions-market-popover")
		.querySelector('[role="option"][aria-selected="true"]');
	const testid = chosen?.getAttribute("data-testid") ?? null;
	fireEvent.click(trigger);
	return testid === null
		? null
		: testid.replace("positions-market-option-", "");
}

/** The status segment count — the `<select>`'s `.options.length`. */
function statusOptionCount(): number {
	return screen
		.getByTestId("positions-status-filter")
		.querySelectorAll("button").length;
}

const M1 = "0190c0de-aaaa-7000-8000-000000000001"; // Open market
const M2 = "0190c0de-bbbb-7000-8000-000000000002"; // settled market
const C_POST = "0190c0de-cccc-7000-8000-000000000011";
const C_REPLY = "0190c0de-dddd-7000-8000-000000000022";
const C_REMOVED = "0190c0de-eeee-7000-8000-000000000033";
const C_OPENER = "0190c0de-ffff-7000-8000-000000000044";

/**
 * The "would-be" title/body of the removed items. The removed DTO variants
 * carry NO title/body fields (a leak is a compile error), so these sentinels
 * exist ONLY here — the render layer must never surface them (or any other
 * title text) inside a removed stub.
 */
const REMOVED_WOULD_BE_TITLE = "Sentinel removed opener title";
const REMOVED_WOULD_BE_BODY = "Sentinel removed opener body";

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const SCRUBBED: ProfileUser = {
	id: "0190c0de-2222-7000-8000-0000000000f2",
	pseudonym: "[scrubbed_user_4729]",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const TILES: ProfileTilesData = {
	walletValue: "500.000000000000000000",
	positionsValue: "120.000000000000000000",
	netProfitLoss: "-30.000000000000000000",
	argumentsCount: { total: 5, posts: 3, replies: 2 },
	supportReceived: "40.000000000000000000",
	counterReceived: "12.000000000000000000",
};

const L1 = "0190c0de-2222-7000-8000-000000000001";
const L2 = "0190c0de-2222-7000-8000-000000000002";

/**
 * ⚠⚠ POSREV-1 — THESE ROWS CARRY REAL LOTS NOW, AND THAT IS NOT COSMETIC.
 * The table's unit is the ARGUMENT: a row with no lots renders through the
 * whole-holding FALLBACK tile, which is the drift path, not the ordinary one.
 * Fixtures without lots would have tested the exception on every assertion.
 * ⚠ `ROW_SETTLED`'s lot is fully EXITED, so it lands in the CLOSED tab — which
 * is what lets the both-poles assertions below reach a NO tile at all. Under
 * RF-13 the tab is holding status, so a Resolved MARKET is no longer what puts
 * a row on the Closed side.
 */
function LOT(
	lotId: string,
	side: "YES" | "NO",
	held: boolean,
	argument: ProfilePositionLot["argument"],
): ProfilePositionLot {
	return {
		lotId,
		betId: `bet-${lotId}`,
		side,
		originalBasis: held ? "25.000000000000000000" : "8.000000000000000000",
		survivingBasis: held ? "25.000000000000000000" : "0.000000000000000000",
		survivingShares: held ? "10.000000000000000000" : "0.000000000000000000",
		sold: !held,
		placedAt: "2026-09-10T10:00:00.000Z",
		argument,
	};
}

const OPENER_CELL = {
	removed: false as const,
	commentId: C_OPENER,
	title: "Opener argument alpha",
	isReply: false,
	postOrdinal: 1,
	marketSlug: "fixture-alpha",
	repliedToTitle: null,
};

const ROW_OPEN: ProfilePositionRow = {
	lots: [LOT(L1, "YES", true, OPENER_CELL)],
	marketId: M1,
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	marketStatus: "Open",
	statusLabel: "Open",
	settled: false,
	side: "YES",
	quantity: "10.000000000000000000",
	staked: "25.000000000000000000",
	current: "31.000000000000000000",
	argument: {
		removed: false,
		commentId: C_OPENER,
		title: "Opener argument alpha",
		isReply: false,
		postOrdinal: 1,
		marketSlug: "fixture-alpha",
		repliedToTitle: null,
	},
};

/** Settled row whose episode-opening argument is content_removed (N-1a). */
const ROW_SETTLED: ProfilePositionRow = {
	lots: [LOT(L2, "NO", false, { removed: true, marketSlug: "fixture-beta" })],
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	// ⚠⚠ ZERO, AND THE FIXTURE WAS INCONSISTENT UNTIL POSREV-1'S REVIEW. This row's
	// only argument is fully EXITED, and `I-LOT-SUM-001` says Σ surviving lot
	// shares == `positions.quantity` — so a sold-out holding cannot also hold 4.
	// The old render never noticed, because nothing read the two together. The
	// whole-holding fallback does: "no surviving lot AND a positive quantity" is
	// exactly the lots↔positions DRIFT shape, so an invariant-violating fixture
	// now (correctly) renders an extra Open tile and reddens these tests. Making
	// the fixture obey the invariant is the fix; loosening the predicate would be
	// deleting a real guard to accommodate an impossible row.
	quantity: "0.000000000000000000",
	staked: "8.000000000000000000",
	current: "12.000000000000000000",
	argument: { removed: true, marketSlug: "fixture-beta" },
};

const ROWS: ProfilePositionRow[] = [ROW_OPEN, ROW_SETTLED];

const A_POST: ProfileArgumentItem = {
	removed: false,
	kind: "post",
	id: C_POST,
	side: "YES",
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	ordinal: 1,
	title: "Argument post alpha",
	teaser: "Neutral fixture teaser alpha.",
	body: "Argument post alpha\n\nNeutral fixture body alpha.",
	marker: "none",
	authorStake: "25.000000000000000000",
	// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
	authorStakeOriginal: "25.000000000000000000",
	authorSold: false,
	priceAtBet: "0.410000000000000000",
	createdAt: "2026-09-20T00:00:00.000Z",
	aggregate: {
		supportCount: 2,
		counterCount: 1,
		supportDharma: "40.000000000000000000",
		counterDharma: "12.000000000000000000",
	},
};

const A_REPLY: ProfileArgumentItem = {
	removed: false,
	kind: "reply",
	id: C_REPLY,
	side: "NO",
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	ordinal: 3,
	title: "Argument reply beta",
	teaser: "Neutral fixture teaser beta.",
	body: "Argument reply beta\n\nNeutral fixture body beta.",
	marker: "Flipped",
	stake: "6.000000000000000000",
	// RANK-1 — the substrate stake is SURVIVING basis; nothing is sold in this fixture.
	stakeOriginal: "6.000000000000000000",
	sold: false,
	priceAtBet: "0.630000000000000000",
	repliedToTitle: "Parent argument gamma",
	createdAt: "2026-09-21T00:00:00.000Z",
};

const A_REMOVED: ProfileArgumentItem = {
	removed: true,
	kind: "post",
	id: C_REMOVED,
	side: "NO",
	marketSlug: "fixture-alpha",
	marketTitle: "Market fixture-alpha",
	ordinal: 2,
	createdAt: "2026-09-22T00:00:00.000Z",
	aggregate: {
		supportCount: 0,
		counterCount: 3,
		supportDharma: "0.000000000000000000",
		counterDharma: "9.000000000000000000",
	},
};

const ITEMS: ProfileArgumentItem[] = [A_POST, A_REPLY, A_REMOVED];

/** Trimmed textContent of an element (no jest-dom in this repo). */
function text(el: Element): string {
	return (el.textContent ?? "").trim();
}

/**
 * The P1 panel wrapping a marked message node. Throws rather than returning
 * `Element | null` so callers assert on a real element without a cast (no
 * jest-dom, and `as` is reserved for trust boundaries — AGENTS.md §4).
 */
function panelOf(messageTestId: string): Element {
	const panel = screen.getByTestId(messageTestId).closest("[data-empty-block]");
	if (panel === null) {
		throw new Error(`no [data-empty-block] ancestor for "${messageTestId}"`);
	}
	return panel;
}

/** Sorted data-testid values under `root` whose testid starts with `prefix`. */
function testids(root: ParentNode, prefix: string): string[] {
	return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`))
		.map((el) => el.getAttribute("data-testid") ?? "")
		.sort();
}

describe("UI.A5 Slice 6 — profile page-assembly components", () => {
	it("band-composition", () => {
		// HTML-FINISH row 8 — the tiles are NO LONGER A SIBLING BAND. They render
		// inside `IdentityCard` now, so mounting `<ProfileTiles>` here as well
		// would put two `profile-tiles` nodes in the tree and `getByTestId` would
		// throw. Dropping the standalone mount is the row's own consequence, not a
		// relaxation: every assertion below still runs, and the tile lookup at
		// `:238` now proves the tiles are REACHABLE THROUGH the identity card —
		// a stronger statement than the sibling mount made.
		render(
			<>
				<IdentityCard user={USER} owner={false} tiles={TILES} />
				<PositionsTable payload={{ owner: false, rows: ROWS }} />
				<ArgumentList items={ITEMS} owner={false} author={USER} />
			</>,
		);

		// The four band roots.
		expect(screen.getByTestId("identity-card")).toBeTruthy();
		expect(screen.getByTestId("profile-tiles")).toBeTruthy();
		expect(screen.getByTestId("positions-table")).toBeTruthy();
		expect(screen.getByTestId("argument-list")).toBeTruthy();
		// …and the tile band is INSIDE the identity band (row 8), not beside it.
		expect(
			screen
				.getByTestId("identity-card")
				.contains(screen.getByTestId("profile-tiles")),
		).toBe(true);

		// Identity: the pseudonym is rendered verbatim.
		expect(text(screen.getByTestId("identity-pseudonym"))).toBe(USER.pseudonym);

		// The six tiles, each carrying its canon §6 verbatim label.
		const tiles = screen.getByTestId("profile-tiles");
		const labelByKey = {
			wallet: "Wallet value",
			positions: "Positions value",
			"net-pl": "Net profit / loss",
			arguments: "Arguments",
			support: "Total Support received",
			counter: "Total Counter received",
		};
		for (const [key, label] of Object.entries(labelByKey)) {
			const tile = within(tiles).getByTestId(`tile-${key}`);
			expect(tile.textContent ?? "").toContain(label);
		}

		// ⚠⚠ POSREV-1 RF-4 — THE OPEN TAB'S FOUR COLUMNS. `Staked` is DELETED from
		// the tile row: Đa now lives on the market GROUP HEADER, where it belongs to
		// the market rather than to one argument, and `Sell` takes the far-right
		// slot. The `→` arrow track goes with `Staked` — it existed only to carry a
		// relation between two value columns, and there is one.
		const table = screen.getByTestId("positions-table");
		for (const col of ["Position", "Argument", "Current", "Sell"]) {
			expect(table.textContent ?? "").toContain(col);
		}
		const rowOpen = within(table).getByTestId(`position-tile-${L1}`);
		// ⛔ THE MARKET TITLE IS NO LONGER ON THE TILE — RF-3 moved it to the group
		// header, and removing that repetition is the point of the whole revamp: a
		// participant holding three arguments in one market read the question three
		// times. Asserted on the header, and asserted ABSENT from the tile, because
		// "it moved" and "it is gone" are different outcomes and only one is right.
		expect(rowOpen.textContent ?? "").not.toContain(ROW_OPEN.marketTitle);
		expect(
			within(table).getByTestId(`positions-group-title-${M1}`).textContent,
		).toBe(ROW_OPEN.marketTitle);
		// …and Đa → Đb ride the header, so the market's own figures still render.
		expect(
			within(table).getByTestId(`positions-group-figures-${M1}`).textContent ??
				"",
		).toContain("Đ 25");
		// Staked / Current representations (integer parts — display formatting
		// is the component's; the 18-dp DTO strings are the source).
		expect(rowOpen.textContent ?? "").toContain("25");
		expect(rowOpen.textContent ?? "").toContain("31");
		// The present argument cell carries the opener title (N-1a).
		expect(text(within(rowOpen).getByTestId(`tile-arg-${L1}`))).toContain(
			"Opener argument alpha",
		);
		// ⛔⛔ THE PER-TILE STATUS CELL IS DELETED (POSREV-1 RF-12), AND THE
		// ASSERTION IS REPLACED RATHER THAN DROPPED. It read the `statusLabel` off
		// each row in its own filter state. Market status now renders NOWHERE:
		// every market carries the same deadline and none resolves early, so the
		// chip repeated one constant word on every tile — and RF-13 then took the
		// two WORDS for a different meaning entirely, so a chip reading `Open`
		// beside a tab reading `Open` would name two unrelated facts with one word.
		// ⇒ What replaces it is the ABSENCE, asserted with the tab switch kept:
		// each tile is read in its own tab, and neither carries a status node.
		expect(table.querySelector('[data-testid^="position-status-"]')).toBeNull();
		setStatusFilter("Closed");
		// The settled row's argument is fully exited, so it is the CLOSED tab's
		// tile — which is RF-13's whole redefinition, exercised here rather than
		// merely described.
		expect(within(table).getByTestId(`position-tile-${L2}`)).toBeTruthy();
		expect(table.querySelector('[data-testid^="position-status-"]')).toBeNull();
		setStatusFilter("Open");

		// Argument list: present post + present reply + removed stub.
		const list = screen.getByTestId("argument-list");
		expect(within(list).getByTestId(`argument-${C_POST}`)).toBeTruthy();
		expect(within(list).getByTestId(`argument-${C_REPLY}`)).toBeTruthy();
		expect(
			within(list).getByTestId(`argument-removed-${C_REMOVED}`),
		).toBeTruthy();
		// The present post's title element; the reply's "Replied to …" context
		// carries the parent's title (contract-pinned).
		expect(
			text(within(list).getByTestId(`argument-title-${C_POST}`)),
		).toContain("Argument post alpha");
		expect(
			text(within(list).getByTestId(`argument-reply-context-${C_REPLY}`)),
		).toContain("Parent argument gamma");
	});

	it("banned-label", () => {
		const banned = render(
			<IdentityCard
				user={{ ...USER, banned: true }}
				owner={false}
				tiles={TILES}
			/>,
		);
		expect(screen.getByTestId("identity-banned")).toBeTruthy();
		banned.unmount();

		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		expect(screen.queryByTestId("identity-banned")).toBeNull();
	});

	it("scrubbed-silhouette-and-zero-pii", () => {
		const scrubbed = render(
			<IdentityCard user={SCRUBBED} owner={false} tiles={TILES} />,
		);
		const card = screen.getByTestId("identity-card");

		// The scrub marker renders for a placeholder pseudonym.
		expect(screen.getByTestId("identity-scrubbed")).toBeTruthy();
		// The PFP img renders the placeholder path with an empty alt.
		const img = card.querySelector("img");
		expect(img).not.toBeNull();
		expect(img?.getAttribute("src")).toBe(SCRUBBED.pfpUrl);
		expect(img?.getAttribute("alt")).toBe("");
		// The pseudonym text is the placeholder, verbatim.
		expect(text(screen.getByTestId("identity-pseudonym"))).toBe(
			SCRUBBED.pseudonym,
		);
		// ZERO PII: no "@" (no email/name props even exist on the DTO).
		expect(card.textContent ?? "").not.toContain("@");
		scrubbed.unmount();

		// Control: a non-scrubbed pseudonym renders NO scrub marker.
		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		expect(screen.queryByTestId("identity-scrubbed")).toBeNull();
	});

	it("arguments-tile-format", () => {
		// N-7: `${total} (${posts} Posts | ${replies} Replies)`, EXACTLY.
		render(<ProfileTiles tiles={TILES} />);
		expect(screen.getByTestId("tile-arguments-value").textContent).toBe(
			"5 (3 Posts | 2 Replies)",
		);
	});

	it("no-bookmark-affordance-on-the-identity-card-either-arm", () => {
		// UNWIRE-1 — supersedes `owner-only-bookmark-affordance-on-the-identity-
		// card`. That test asserted the headzone bookmark icon was OWNER-ONLY
		// (POLISH.5 item 17, founder ruling 2026-07-31); the bookmark module is
		// now unwired product-wide (SUB-2), so the control isn't gated by
		// ownership anymore — it's gone from both arms. Kept as a two-arm
		// negative guard rather than dropped outright, so a bookmark-link
		// regression on EITHER arm still fails loudly.
		const asOwner = render(
			<IdentityCard user={USER} owner={true} tiles={TILES} />,
		);
		expect(
			screen.getByTestId("identity-card").querySelector('a[href="/bookmarks"]'),
		).toBeNull();
		asOwner.unmount();

		render(<IdentityCard user={USER} owner={false} tiles={TILES} />);
		expect(
			screen.getByTestId("identity-card").querySelector('a[href="/bookmarks"]'),
		).toBeNull();
	});

	it("post-carries-replies-count-summing-both-poles", () => {
		// POLISH.5 item 5 (P5-D07) — canon §3 item 11's `Replies · N`, inline,
		// count enlarged. N sums BOTH poles: every reply is a Support or a
		// Counter bet (ADR-0017), so supportCount + counterCount IS the total.
		render(<ArgumentList items={ITEMS} owner={false} author={USER} />);

		// A_POST is 2 support + 1 counter. THREE is the sum and equals NEITHER
		// operand, so this cannot pass by rendering one of the halves.
		const count = screen.getByTestId(`argument-replies-${C_POST}`);
		expect(text(count)).toBe("3");
		expect(text(count)).not.toBe("2");
		expect(text(count)).not.toBe("1");

		// Post-only: a reply carries no Support/Counter footer, so no count.
		expect(screen.queryByTestId(`argument-replies-${C_REPLY}`)).toBeNull();
		// And the removed stub renders no footer at all.
		expect(screen.queryByTestId(`argument-replies-${C_REMOVED}`)).toBeNull();

		// The label rides beside the count, in the same line (canon "inline").
		const post = screen.getByTestId(`argument-${C_POST}`);
		expect(post.textContent ?? "").toContain("Replies · 3");
	});

	it("removed-stub-render", () => {
		// Argument list: the removed post renders the stub variant only.
		const list = render(
			<ArgumentList items={[A_REMOVED]} owner={false} author={USER} />,
		);
		const stub = screen.getByTestId(`argument-removed-${C_REMOVED}`);
		expect(stub.textContent ?? "").not.toContain(REMOVED_WOULD_BE_TITLE);
		expect(stub.textContent ?? "").not.toContain(REMOVED_WOULD_BE_BODY);
		// The present-variant title element must not exist for a removed item.
		expect(screen.queryByTestId(`argument-title-${C_REMOVED}`)).toBeNull();
		list.unmount();

		// Positions table: a row whose argument cell is the removed variant.
		// ⚠ B7 had to switch the status filter to `Closed` here, because item 11
		// defaulted it to a FIXED `Open` and `ROW_SETTLED` is the Closed market —
		// the row was filtered out at mount. Gate C S-1 made the default DERIVED,
		// and this fixture is all-Closed, so the row is visible at mount and that
		// switch became a no-op. It is REMOVED rather than left: a redundant step
		// under a comment describing a default that no longer exists is the
		// lying-docblock class, and it would have hidden a real regression in the
		// derivation behind a manual override.
		render(<PositionsTable payload={{ owner: false, rows: [ROW_SETTLED] }} />);
		const cell = screen.getByTestId(`tile-arg-removed-${L2}`);
		expect(cell.textContent ?? "").not.toContain(REMOVED_WOULD_BE_TITLE);
		expect(cell.textContent ?? "").not.toContain(REMOVED_WOULD_BE_BODY);
		// The present-variant cell testid must not exist for a removed cell.
		expect(screen.queryByTestId(`tile-arg-${L2}`)).toBeNull();
	});

	it("owner-vs-visitor-body-identical", () => {
		// F-PROF-3 at Slice 6: the arena body is IDENTICAL across owner and
		// visitor. ⚠ The identity card now carries TWO owner deltas — the view
		// chip and, since POLISH.5 item 17, the bookmark link — but neither is
		// in scope here: `arena()` renders the tiles, the table and the argument
		// list and NOT `IdentityCard`, so the body-identity law is unaffected
		// (Sell mounts at Slice 7, not here). Compare the tiles' innerHTML and
		// the row / argument testid SETS (Slice-7-proof: sets survive the Sell
		// mount).
		const arena = (owner: boolean) =>
			render(
				<>
					<ProfileTiles tiles={TILES} />
					{/* Slice 7 payload migration: the owner arm decorates rows with
					    sellEligible:false — the body-identity law asserts sell-free. */}
					<PositionsTable
						payload={
							owner
								? {
										owner: true,
										rows: ROWS.map((r) => ({ ...r, sellEligible: false })),
									}
								: { owner: false, rows: ROWS }
						}
					/>
					<ArgumentList items={ITEMS} owner={owner} author={USER} />
				</>,
			);
		const snapshot = (root: ParentNode) => ({
			tilesHtml: root.querySelector('[data-testid="profile-tiles"]')?.innerHTML,
			rowIds: testids(root, "position-tile-"),
			argIds: testids(root, "argument-"),
		});

		const first = arena(true);
		const asOwner = snapshot(first.container);
		first.unmount();
		const second = arena(false);
		const asVisitor = snapshot(second.container);
		second.unmount();

		// Non-vacuity: the compared body actually rendered.
		expect(asOwner.tilesHtml ?? "").not.toBe("");
		expect(asOwner.rowIds.length).toBeGreaterThan(0);
		expect(asOwner.argIds.length).toBeGreaterThan(0);

		expect(asVisitor.tilesHtml).toBe(asOwner.tilesHtml);
		expect(asVisitor.rowIds).toEqual(asOwner.rowIds);
		expect(asVisitor.argIds).toEqual(asOwner.argIds);

		// The FIRST of the two owner deltas: the view chip. The second — item 17's
		// bookmark link — has its own two-armed guard above
		// (`owner-only-bookmark-affordance-on-the-identity-card`).
		//
		// ⚠⚠ PROFILE REFINEMENT · R5 — THE CHIP IS GONE, SO THIS READS THE VIEWER
		// CONTEXT INSTEAD OF A CHIP. The founder ruled the `Viewing as owner` chip
		// out, and it had been this assertion's proxy for "the owner arm rendered".
		// Deleting the chip must not delete the CLAIM — the owner/visitor
		// distinction is still a real branch and still needs a guard — so the guard
		// re-points at the other thing that branch decides: the empty-state copy,
		// which `payload.owner` selects directly.
		// ⛔ THIS IS STRICTLY BETTER, NOT A CONSOLATION. A chip's text was a render
		// of the flag; the empty copy IS the flag's consequence, so a wiring bug
		// that fed the wrong `owner` through now fails here for the right reason
		// rather than because a decorative span read wrong.
		// ⚠ AND IT IS ASSERTED ON THE EMPTY-ROWS ARM, deliberately: that arm mounts
		// the panel with no `controls` at all, which is where an owner-dependent
		// render is easiest to lose.
		const ownerHead = render(
			<PositionsTable payload={{ owner: true, rows: [] }} />,
		);
		expect(screen.queryByTestId("profile-chip")).toBeNull();
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsOwner,
		);
		ownerHead.unmount();
		render(<PositionsTable payload={{ owner: false, rows: [] }} />);
		expect(screen.queryByTestId("profile-chip")).toBeNull();
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsVisitor,
		);
		// …and the two arms actually DIFFER, so the pair above cannot both pass on a
		// component that ignores `owner` entirely.
		expect(PROFILE_COPY.empty.positionsOwner).not.toBe(
			PROFILE_COPY.empty.positionsVisitor,
		);
	});

	it("empty-states", () => {
		// Positions — owner copy.
		const a = render(<PositionsTable payload={{ owner: true, rows: [] }} />);
		expect(screen.queryByTestId("positions-table")).toBeNull();
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsOwner,
		);
		a.unmount();

		// Positions — visitor copy.
		const b = render(<PositionsTable payload={{ owner: false, rows: [] }} />);
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsVisitor,
		);
		b.unmount();

		// Arguments — owner copy.
		const c = render(<ArgumentList items={[]} owner={true} author={USER} />);
		expect(screen.queryByTestId("argument-list")).toBeNull();
		expect(text(screen.getByTestId("arguments-empty"))).toBe(
			PROFILE_COPY.empty.argumentsOwner,
		);
		c.unmount();

		// Arguments — visitor copy.
		render(<ArgumentList items={[]} owner={false} author={USER} />);
		expect(text(screen.getByTestId("arguments-empty"))).toBe(
			PROFILE_COPY.empty.argumentsVisitor,
		);
	});

	it("empty-states-adopt-p1", () => {
		// POLISH.5 item 8 (P5-D11) — the empties adopt W2.11 P1 at ONE message
		// tier (D3(a)). TWO of the three sites are here; the third is
		// `ProfileGraphCard`, which this file does not import — its assertion
		// lives in `graph.test.tsx`, beside the component that renders it.
		//
		// ⚠ NON-VACUITY IS WHY THIS CASE EXISTS. The four `empty-states`
		// equalities above stay green at a single tier — but they stay green on
		// the bare `<p>` this item REPLACES, and on a component that renders the
		// string and no panel at all. The panel is what has to be asserted.
		const positions = render(
			<PositionsTable payload={{ owner: true, rows: [] }} />,
		);
		const positionsPanel = panelOf("positions-empty");
		// P1's ratified geometry (canon §10, R9's second clause): hairline
		// border, `bg-n0`, the 148px floor, `--r`. On the PANEL, not the message.
		const positionsClass = positionsPanel.getAttribute("class") ?? "";
		expect(positionsClass).toContain("[border:var(--hairline)]");
		expect(positionsClass).toContain("bg-n0");
		expect(positionsClass).toContain("min-h-[148px]");
		expect(positionsClass).toContain("rounded-[var(--r)]");
		// …and the string is STILL THERE, on the message node inside it.
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsOwner,
		);
		// ONE TIER: the panel's whole subtree is that message and nothing else.
		// This is what keeps the four equalities above green — a `sub` node
		// inside the marked subtree would break every one of them, so no `sub`
		// is passed on this surface.
		expect(text(positionsPanel)).toBe(PROFILE_COPY.empty.positionsOwner);
		// ⚠ Gate C G-2 — THE DEFAULT DID NOT MOVE. `messageAs` was added for
		// `ProfileGraphCard` alone; these two sites pass nothing and must still
		// render the `<h2>`, on `EmptyState.tsx`'s recorded semantics ground.
		// Without this pin, flipping the default would be caught only by the
		// graph site's assertion.
		expect(screen.getByTestId("positions-empty").tagName).toBe("H2");
		positions.unmount();

		render(<ArgumentList items={[]} owner={true} author={USER} />);
		const argumentsPanel = panelOf("arguments-empty");
		const argumentsClass = argumentsPanel.getAttribute("class") ?? "";
		expect(argumentsClass).toContain("[border:var(--hairline)]");
		expect(argumentsClass).toContain("bg-n0");
		expect(argumentsClass).toContain("min-h-[148px]");
		expect(text(argumentsPanel)).toBe(PROFILE_COPY.empty.argumentsOwner);
		expect(screen.getByTestId("arguments-empty").tagName).toBe("H2");
	});

	it("states-kit", () => {
		const loading = render(<ProfileLoading />);
		expect(screen.getByTestId("profile-loading")).toBeTruthy();
		loading.unmount();

		// Item 9 gave `ProfileError` its action as a prop; the assertion itself
		// is unchanged and still reads THROUGH the const, so `error.load`'s trim
		// moved both sides together and this stayed green.
		render(<ProfileError onAction={vi.fn()} />);
		expect(text(screen.getByTestId("profile-error"))).toBe(
			PROFILE_COPY.error.load,
		);
	});

	it("error-state-has-a-real-retry-affordance", () => {
		// POLISH.5 item 9 (P5-D12). ⚠ THE RETRY ALREADY WORKED before this item:
		// `error.tsx` wrapped the whole message in a `<button onClick={reset}
		// className="block w-full text-left">`. What it had was no AFFORDANCE —
		// no visible control, no focus treatment, no accessible name. So the law
		// here is not "an action exists" but "an action is REACHABLE".
		const onAction = vi.fn();
		const { container } = render(<ProfileError onAction={onAction} />);

		// Exactly one control, and `getByRole` would throw on a second — which
		// is also the ⛔ no-button-inside-a-button proof, since the wrapper this
		// item removes could not have coexisted with the block's own CTA.
		const button = screen.getByRole("button");
		expect(container.querySelectorAll("button")).toHaveLength(1);
		expect(button.getAttribute("type")).toBe("button");

		// Accessible-named, from the copy const — never a re-typed literal.
		expect((button.textContent ?? "").trim()).toBe(PROFILE_COPY.error.action);

		// The focus treatment, copied BY NAME from the shipped `m/[slug]`
		// boundary. `--state-focus-ring` is already in the raw-props token set,
		// so nothing is added and the 11-token census is untouched.
		expect(button.getAttribute("class") ?? "").toContain(
			"focus-visible:shadow-(--state-focus-ring)",
		);

		// Reachable, and it actually fires `reset`.
		button.focus();
		expect(document.activeElement).toBe(button);
		fireEvent.click(button);
		expect(onAction).toHaveBeenCalledTimes(1);

		// `OD-7` = BESIDE. The marked subtree is the BODY ALONE: the button is
		// its sibling, not its child. ⚠ `m/[slug]/error.tsx` marks its CONTAINER
		// instead; copying that placement would pull the button's label into
		// this subtree and redden `states-kit`'s exact-equality assertion above.
		const body = screen.getByTestId("profile-error");
		expect(body.tagName).toBe("P");
		expect(body.contains(button)).toBe(false);
		expect(text(body)).toBe(PROFILE_COPY.error.load);

		// ⛔ NOT the P1 panel. `error-block` is NEITHER kit member: no hairline,
		// no `bg-n0`, no 148px floor. Asserting this is what stops a later
		// reader "harmonising" the two leaves into one shape.
		expect(body.closest("[data-empty-block]")).toBeNull();
		const block = container.querySelector("[data-error-block]");
		expect(block).not.toBeNull();
		expect(block?.getAttribute("class") ?? "").toBe("text-center");
	});

	it("profile-loading-adopts-p7", () => {
		// POLISH.5 item 7 (P5-D10) — `ProfileLoading` becomes P7's SECOND
		// consumer. `PD-0-08` closed because the PRIMITIVE was minted, not
		// because every surface it lists had adopted it.
		//
		// ⚠ NON-VACUITY IS THE WHOLE POINT OF THIS CASE. `states-kit` above
		// asserts only the wrapper testid, and the wrapper does not move in
		// this swap — that assertion stays green on a component rendering
		// NOTHING inside it. These assertions are what make the adoption
		// observable at all.
		const { container } = render(<ProfileLoading />);
		const blocks = container.querySelectorAll("[data-loading-block]");

		// NINE blocks: identity + SIX tiles + graph + arena. ⚠ Grepping the
		// source for nine tags finds FOUR — the tile band is one tag mapped
		// over the surface's own count constant, which is what P7 requires
		// instead of the six-element literal it replaced.
		expect(blocks).toHaveLength(9);

		// BOTH markers coexist. `ui/loading-block.tsx:30-35` records the
		// failure that minted the rule: passing `data-slot="loading-block"`
		// silently REPLACED the shadcn primitive marker. A test asserting only
		// `data-loading-block` passes on exactly that regression.
		for (const block of blocks) {
			expect(block.getAttribute("data-slot")).toBe("skeleton");
		}
	});

	it("position-cell-carries-the-held-side", () => {
		// POLISH.5 item 1 (P5-D02) — the mockup's `.pside`: the side WORD plus
		// the thumb glyph at 12px, in the Position cell. ⛔ NOT a chip (R12).
		// ⚠ Before this item `row.side` reached NO rendered node anywhere on this
		// surface — it went only to `SellModule`'s prop — so `band-composition`
		// above cannot see this and could not have caught its absence.
		//
		// ⚠ NAMED "HELD", NOT "FROZEN", DELIBERATELY. Item 1's plan text says
		// "the frozen side", but `row.side` is `positions.side` — Bucket C,
		// MUTABLE. The frozen-at-post-time side is `comments.side_at_post_time`
		// (INV-3), rendered elsewhere by `SideBadge`. A test name asserting
		// "frozen" over a mutable field is the conflation INV-3 exists to
		// prevent, and a test name that contradicts its subject is the
		// lying-docblock class this plan polices.
		render(<PositionsTable payload={{ owner: false, rows: ROWS }} />);

		// BOTH POLES, or the case proves nothing: a YES-only assertion passes
		// unchanged on a component that hard-codes YES (V-2).
		// ⚠ Item 11 removed the status filter's `All`, so the YES row (Open) and
		// the NO row (Closed) are never on screen together. The both-pole
		// property is PRESERVED by reading each in its own filter state — it is
		// the reach that changed, not the law.
		// The YES pole, and the market title that proves the glyph is ADDITIVE.
		const yes = screen.getByTestId(`tile-side-${L1}`);
		const yesGlyph = yes.querySelector("svg");
		expect(text(yes)).toBe("Yes");
		// ⛔ INVERTED AT POSREV-1 RF-3. This asserted the market title sits on the
		// tile — "the glyph is ADDITIVE, it did not replace the question". The
		// question MOVED to the group header, so the additive claim is now made
		// against the header instead; asserting it on the tile would re-introduce
		// the repetition the revamp exists to remove.
		expect(
			(screen.getByTestId(`position-tile-${L1}`).textContent ?? "").includes(
				ROW_OPEN.marketTitle,
			),
		).toBe(false);
		expect(screen.getByTestId(`positions-group-title-${M1}`).textContent).toBe(
			ROW_OPEN.marketTitle,
		);

		// The NO pole, in its own filter state.
		setStatusFilter("Closed");
		const no = screen.getByTestId(`tile-side-${L2}`);
		const noGlyph = no.querySelector("svg");
		expect(text(no)).toBe("No");

		// ⚠ 14, NOT 12 — POSREV-1 RF-12: "Larger than current." The side is the
		// only thing left in this cell now that the status chip is gone, and it was
		// the smallest thing in it. ⛔ STILL NOT 16: the slot header's 16 is scoped
		// to it BY NAME in the values-log and does not inherit, so a glyph rendering
		// at 16 here would mean the default leaked through rather than that RF-12
		// was applied.
		expect(yesGlyph?.getAttribute("width")).toBe("14");
		expect(yesGlyph?.getAttribute("height")).toBe("14");
		expect(noGlyph?.getAttribute("width")).toBe("14");
		expect(noGlyph?.getAttribute("height")).toBe("14");

		// Decorative: the WORD carries the meaning, so the glyph stays out of
		// the accessibility tree.
		expect(yesGlyph?.getAttribute("aria-hidden")).toBe("true");
		expect(noGlyph?.getAttribute("aria-hidden")).toBe("true");

		// The two arms, as RATIFIED rather than as the mockup draws them: NO is
		// the rotated, FILLED thumb (`fill-no`, no stroke); YES is stroked
		// `currentColor`. The mockup's `THDN` is stroked and does NOT govern.
		expect(noGlyph?.getAttribute("class")).toBe("rotate-180");
		expect(yesGlyph?.getAttribute("class")).toBeNull();
		expect(noGlyph?.querySelector("path")?.getAttribute("class")).toBe(
			"fill-no",
		);
		expect(noGlyph?.querySelector("path")?.getAttribute("stroke")).toBe("none");
		expect(yesGlyph?.querySelector("path")?.getAttribute("stroke")).toBe(
			"currentColor",
		);
		expect(yesGlyph?.querySelector("path")?.getAttribute("fill")).toBe("none");
	});

	it("positions-filters", () => {
		const first = render(
			<PositionsTable payload={{ owner: false, rows: ROWS }} />,
		);
		// Option inventories (item 11, P5-D17a): the STATUS filter is now
		// Open/Closed — the canon inventory, with `All` removed. ⛔ The MARKET
		// filter is a DIFFERENT control and keeps its `all` sentinel: `All` +
		// one per distinct marketId. Repairing the two together would ship a
		// defect.
		expect(statusOptionCount()).toBe(2);
		expect(marketOptionCount()).toBe(3);

		// The initial state moved WITH the option. A `<select>` whose `value`
		// matched no option would paint its first option while the predicate
		// still returned every row — the control saying one thing and the table
		// showing another, with nothing going red.
		// ⚠ `Open` here is DERIVED, not fixed (Gate C S-1): `ROWS` contains an
		// Open row, so the derivation selects it. The derivation itself is
		// pinned by `status-default-is-derived`, including the all-Closed and
		// deep-link arms this fixture cannot reach.
		expect(selectedStatus()).toBe("Open");

		// ⇒ Only the Open row is visible at mount. This is the CAPABILITY
		// REMOVAL, asserted rather than implied: there is no longer any state of
		// this surface in which an open and a closed position appear together.
		expect(screen.getByTestId(`position-tile-${L1}`)).toBeTruthy();
		expect(screen.queryByTestId(`position-tile-${L2}`)).toBeNull();

		// Status → Closed hides the Open row, keeps the Closed row.
		setStatusFilter("Closed");
		expect(screen.queryByTestId(`position-tile-${L1}`)).toBeNull();
		expect(screen.getByTestId(`position-tile-${L2}`)).toBeTruthy();
		first.unmount();

		// Fresh mount: the market filter isolates one market's rows, and it does
		// so independently of the status filter.
		render(<PositionsTable payload={{ owner: false, rows: ROWS }} />);
		setMarketFilter(M1);
		expect(screen.getByTestId(`position-tile-${L1}`)).toBeTruthy();

		// ⚠ The negative arm now selects the OTHER market rather than asserting
		// M2's absence under `market=M1`: item 11's `Open` default already
		// withholds M2, so the old assertion became over-determined and would
		// have passed with the market filter entirely broken. Hiding M1 by
		// selecting M2 is the market filter's own doing — the status filter has
		// not moved.
		setMarketFilter(M2);
		expect(screen.queryByTestId(`position-tile-${L1}`)).toBeNull();
	});

	it("positions-empty-TAB-is-not-stranded", () => {
		// POLISH.5 Gate C S-1. Item 11 made `rows > 0 ∧ visible === 0` reachable
		// at mount; the component rendered four column headers over an empty
		// `<tbody>` and NO message. This is that state, entered deliberately.
		// The OWNER arm, because that is the motivating case: an owner opening
		// their own profile. Its rows carry `sellEligible` (`SellablePositionRow`).
		//
		// ⚠⚠ THE COPY MOVED AT POSREV-1 RF-14 AND THE LAW DID NOT. This asserted
		// `positionsFiltered` — "No positions match this filter." — which was the
		// only empty message a one-message surface could offer. RF-14 makes the
		// empty states per-tab AND aware of each other, because the old single
		// message told someone who had traded and fully exited that they had never
		// traded. An Open-populated / Closed-empty state now says exactly that.
		// ⛔ `positionsFiltered` IS NOW UNREACHABLE: the market options are built
		// FROM the rows, so every option has a row and every row lands in exactly
		// one tab — at least one tab is always non-empty. The string stays in
		// `copy.ts` unrendered, on the `PROFILE_COPY.chip` precedent.
		render(
			<PositionsTable
				payload={{ owner: true, rows: [{ ...ROW_OPEN, sellEligible: false }] }}
			/>,
		);
		setStatusFilter("Closed");

		// The filter-scoped message, which is a DIFFERENT state from "no
		// positions at all" and carries different copy.
		expect(text(screen.getByTestId("positions-empty-tab"))).toBe(
			PROFILE_COPY.empty.closedEmpty,
		);

		// ⛔ THE TWO EMPTY STATES NEVER COLLIDE. Reusing `positions-empty` here
		// would render "No positions yet" to someone whose positions the filter
		// is merely hiding — a lying empty state every existing test would pass.
		expect(screen.queryByTestId("positions-empty")).toBeNull();

		// ⚠ NON-VACUITY, AND IT IS THE ACTUAL LAW: the message alone would still
		// TRAP the user. Both filter controls must survive into this state, or
		// there is no way back out of it.
		expect(screen.getByTestId("positions-status-filter")).toBeTruthy();
		expect(screen.getByTestId("positions-market-filter")).toBeTruthy();
		// …and the control still reads the state the user selected, so the way
		// out is discoverable rather than merely present.
		expect(selectedStatus()).toBe("Closed");

		// The way out WORKS: switching back restores the row.
		setStatusFilter("Open");
		expect(screen.getByTestId(`position-tile-${L1}`)).toBeTruthy();
		expect(screen.queryByTestId("positions-empty-tab")).toBeNull();
	});

	it("status-default-is-derived", () => {
		// POLISH.5 Gate C S-1. A FIXED `Open` default is permanently empty for
		// anyone whose held markets are all non-Open — and after the 2026-11-05
		// freeze that is every participant.

		// (a) An Open row is present → `Open`.
		const withOpen = render(
			<PositionsTable payload={{ owner: false, rows: ROWS }} />,
		);
		expect(selectedStatus()).toBe("Open");
		withOpen.unmount();

		// (b) EVERY row is Closed → `Closed`.
		const allClosed = render(
			<PositionsTable payload={{ owner: false, rows: [ROW_SETTLED] }} />,
		);
		expect(selectedStatus()).toBe("Closed");
		// ⚠ POSITIVE CONTROL. A default that only moves the `<select>`'s value
		// while the table stays empty satisfies a value-only assertion — which
		// is the exact bug this finding is about.
		expect(screen.getByTestId(`position-tile-${L2}`)).toBeTruthy();
		expect(screen.queryByTestId("positions-empty-tab")).toBeNull();
		allClosed.unmount();

		// (c) ⚠ THE DEEP-LINK ARM — the one that pins the SCOPING. `fixture-beta`
		// is Closed and is the preselected market, while an Open row exists in
		// ANOTHER market. A derivation over ALL rows would see that Open row,
		// choose `Open`, and land the `?market=<slug>` deep link on a blank
		// table. Scoping to the initial market is what this arm guards.
		render(
			<PositionsTable
				payload={{ owner: false, rows: ROWS }}
				initialMarketSlug="fixture-beta"
			/>,
		);
		expect(selectedMarket()).toBe(M2);
		expect(selectedStatus()).toBe("Closed");
		expect(screen.getByTestId(`position-tile-${L2}`)).toBeTruthy();
	});
});
