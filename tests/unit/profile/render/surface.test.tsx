// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { PROFILE_COPY } from "@/components/profile/copy";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import { ProfileError, ProfileLoading } from "@/components/profile/states";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionRow } from "@/server/profile/positions";
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

const ROW_OPEN: ProfilePositionRow = {
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
	marketId: M2,
	marketSlug: "fixture-beta",
	marketTitle: "Market fixture-beta",
	marketStatus: "Resolved",
	statusLabel: "Closed",
	settled: true,
	side: "NO",
	quantity: "4.000000000000000000",
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

/** Sorted data-testid values under `root` whose testid starts with `prefix`. */
function testids(root: ParentNode, prefix: string): string[] {
	return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`))
		.map((el) => el.getAttribute("data-testid") ?? "")
		.sort();
}

describe("UI.A5 Slice 6 — profile page-assembly components", () => {
	it("band-composition", () => {
		render(
			<>
				<IdentityCard user={USER} owner={false} />
				<ProfileTiles tiles={TILES} />
				<PositionsTable rows={ROWS} owner={false} />
				<ArgumentList items={ITEMS} owner={false} />
			</>,
		);

		// The four band roots.
		expect(screen.getByTestId("identity-card")).toBeTruthy();
		expect(screen.getByTestId("profile-tiles")).toBeTruthy();
		expect(screen.getByTestId("positions-table")).toBeTruthy();
		expect(screen.getByTestId("argument-list")).toBeTruthy();

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

		// Positions table: canon §6 column headers + both rows.
		const table = screen.getByTestId("positions-table");
		for (const col of ["Position", "Argument", "Staked", "Current"]) {
			expect(table.textContent ?? "").toContain(col);
		}
		const rowOpen = within(table).getByTestId(`position-row-${M1}`);
		expect(rowOpen.textContent ?? "").toContain(ROW_OPEN.marketTitle);
		// Staked / Current representations (integer parts — display formatting
		// is the component's; the 18-dp DTO strings are the source).
		expect(rowOpen.textContent ?? "").toContain("25");
		expect(rowOpen.textContent ?? "").toContain("31");
		// The present argument cell carries the opener title (N-1a).
		expect(text(within(rowOpen).getByTestId(`position-arg-${M1}`))).toContain(
			"Opener argument alpha",
		);
		// Status cells show the statusLabel.
		expect(text(within(table).getByTestId(`position-status-${M1}`))).toContain(
			"Open",
		);
		expect(text(within(table).getByTestId(`position-status-${M2}`))).toContain(
			"Closed",
		);

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
			<IdentityCard user={{ ...USER, banned: true }} owner={false} />,
		);
		expect(screen.getByTestId("identity-banned")).toBeTruthy();
		banned.unmount();

		render(<IdentityCard user={USER} owner={false} />);
		expect(screen.queryByTestId("identity-banned")).toBeNull();
	});

	it("scrubbed-silhouette-and-zero-pii", () => {
		const scrubbed = render(<IdentityCard user={SCRUBBED} owner={false} />);
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
		render(<IdentityCard user={USER} owner={false} />);
		expect(screen.queryByTestId("identity-scrubbed")).toBeNull();
	});

	it("arguments-tile-format", () => {
		// N-7: `${total} (${posts} Posts | ${replies} Replies)`, EXACTLY.
		render(<ProfileTiles tiles={TILES} />);
		expect(screen.getByTestId("tile-arguments-value").textContent).toBe(
			"5 (3 Posts | 2 Replies)",
		);
	});

	it("removed-stub-render", () => {
		// Argument list: the removed post renders the stub variant only.
		const list = render(<ArgumentList items={[A_REMOVED]} owner={false} />);
		const stub = screen.getByTestId(`argument-removed-${C_REMOVED}`);
		expect(stub.textContent ?? "").not.toContain(REMOVED_WOULD_BE_TITLE);
		expect(stub.textContent ?? "").not.toContain(REMOVED_WOULD_BE_BODY);
		// The present-variant title element must not exist for a removed item.
		expect(screen.queryByTestId(`argument-title-${C_REMOVED}`)).toBeNull();
		list.unmount();

		// Positions table: a row whose argument cell is the removed variant.
		render(<PositionsTable rows={[ROW_SETTLED]} owner={false} />);
		const cell = screen.getByTestId(`position-arg-removed-${M2}`);
		expect(cell.textContent ?? "").not.toContain(REMOVED_WOULD_BE_TITLE);
		expect(cell.textContent ?? "").not.toContain(REMOVED_WOULD_BE_BODY);
		// The present-variant cell testid must not exist for a removed cell.
		expect(screen.queryByTestId(`position-arg-${M2}`)).toBeNull();
	});

	it("owner-vs-visitor-body-identical", () => {
		// F-PROF-3 at Slice 6: the arena body is IDENTICAL across owner and
		// visitor — the only owner delta is the identity chip (Sell mounts at
		// Slice 7, not here). Compare the tiles' innerHTML and the row /
		// argument testid SETS (Slice-7-proof: sets survive the Sell mount).
		const arena = (owner: boolean) =>
			render(
				<>
					<ProfileTiles tiles={TILES} />
					<PositionsTable rows={ROWS} owner={owner} />
					<ArgumentList items={ITEMS} owner={owner} />
				</>,
			);
		const snapshot = (root: ParentNode) => ({
			tilesHtml: root.querySelector('[data-testid="profile-tiles"]')?.innerHTML,
			rowIds: testids(root, "position-row-"),
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

		// The one Slice 6 owner delta: the identity chip.
		const ownerCard = render(<IdentityCard user={USER} owner={true} />);
		expect(text(screen.getByTestId("profile-chip"))).toBe(
			PROFILE_COPY.chip.owner,
		);
		ownerCard.unmount();
		render(<IdentityCard user={USER} owner={false} />);
		expect(text(screen.getByTestId("profile-chip"))).toBe(
			PROFILE_COPY.chip.visitor,
		);
	});

	it("empty-states", () => {
		// Positions — owner copy.
		const a = render(<PositionsTable rows={[]} owner={true} />);
		expect(screen.queryByTestId("positions-table")).toBeNull();
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsOwner,
		);
		a.unmount();

		// Positions — visitor copy.
		const b = render(<PositionsTable rows={[]} owner={false} />);
		expect(text(screen.getByTestId("positions-empty"))).toBe(
			PROFILE_COPY.empty.positionsVisitor,
		);
		b.unmount();

		// Arguments — owner copy.
		const c = render(<ArgumentList items={[]} owner={true} />);
		expect(screen.queryByTestId("argument-list")).toBeNull();
		expect(text(screen.getByTestId("arguments-empty"))).toBe(
			PROFILE_COPY.empty.argumentsOwner,
		);
		c.unmount();

		// Arguments — visitor copy.
		render(<ArgumentList items={[]} owner={false} />);
		expect(text(screen.getByTestId("arguments-empty"))).toBe(
			PROFILE_COPY.empty.argumentsVisitor,
		);
	});

	it("states-kit", () => {
		const loading = render(<ProfileLoading />);
		expect(screen.getByTestId("profile-loading")).toBeTruthy();
		loading.unmount();

		render(<ProfileError />);
		expect(text(screen.getByTestId("profile-error"))).toBe(
			PROFILE_COPY.error.load,
		);
	});

	it("positions-filters", () => {
		const first = render(<PositionsTable rows={ROWS} owner={false} />);
		const statusFilter = screen.getByTestId<HTMLSelectElement>(
			"positions-status-filter",
		);
		const marketFilter = screen.getByTestId<HTMLSelectElement>(
			"positions-market-filter",
		);
		// Option inventories: All/Open/Closed; All + one per distinct marketId.
		expect(statusFilter.options).toHaveLength(3);
		expect(marketFilter.options).toHaveLength(3);
		// Both rows visible pre-filter.
		expect(screen.getByTestId(`position-row-${M1}`)).toBeTruthy();
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();

		// Status → Closed hides the Open row, keeps the Closed row.
		fireEvent.change(statusFilter, { target: { value: "Closed" } });
		expect(screen.queryByTestId(`position-row-${M1}`)).toBeNull();
		expect(screen.getByTestId(`position-row-${M2}`)).toBeTruthy();
		first.unmount();

		// Fresh mount: the market filter isolates one market's rows.
		render(<PositionsTable rows={ROWS} owner={false} />);
		fireEvent.change(
			screen.getByTestId<HTMLSelectElement>("positions-market-filter"),
			{ target: { value: M1 } },
		);
		expect(screen.queryByTestId(`position-row-${M2}`)).toBeNull();
		expect(screen.getByTestId(`position-row-${M1}`)).toBeTruthy();
	});
});
