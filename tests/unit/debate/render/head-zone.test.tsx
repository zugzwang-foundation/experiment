// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { HeadZone } from "@/components/debate/HeadZone";
import { MarketHeader } from "@/components/debate/MarketHeader";
import { PostFocusHeader } from "@/components/debate/PostFocusHeader";
import type {
	DebateMarketHeader,
	DebatePost,
	ReplyGroups,
} from "@/components/debate/types";

/**
 * HTML-FINISH · MARKET DETAIL row 1 — THE HEADZONE'S ARM SPLIT, pinned.
 *
 * WHAT THIS GUARD IS FOR. The mockup's headzone swaps its whole CONTENTS
 * between market view (`vm`) and post view (`vp`) and keeps only the
 * two-column frame; the build used to render `MarketHeader` OUTSIDE the
 * market↔post ternary with `PostFocusHeader` stacked underneath it, so the
 * header was arm-BLIND and both arms rendered at once. That is the defect row 1
 * removes, and it is a STRUCTURAL defect: nothing type-errors, nothing throws,
 * and every existing render test stays green either way. So it is pinned here.
 *
 * TWO MEDIA, DELIBERATELY, because the claim has two halves:
 *
 *  1. RENDER — each arm goes through the shared frame, and the rail is absent
 *     rather than empty when it has nothing to hold. Provable in jsdom.
 *  2. SOURCE — `MarketHeader` is mounted INSIDE the ternary and `DebatePoll`
 *     is NOT. jsdom cannot see this: proving it by render would mean mounting
 *     `DebateView`, which drags in `BetComposer` and the bet server actions,
 *     and a mock deep enough to host that would be proving the mock. The
 *     mount-site claim is a claim about the SOURCE, so it is read off the
 *     source — the same technique `debate-height-chain.test.ts` uses, for the
 *     same reason.
 *
 * ⚠ O-7 — assertions read `innerHTML`, never `textContent`. `textContent`
 * flattens the markup away, so an assertion over it cannot see the element that
 * carries the meaning and passes on a shape it was written to reject. The whole
 * subject here IS markup structure.
 *
 * ⛔ FENCE-BY-SYMBOL, NEVER BY LINE (O-8). Everything below names a component,
 * a `data-testid`, or a JSX tag. No line number is load-bearing.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

const ROOT = process.cwd();
const VIEW = "src/components/debate/DebateView.tsx";
const readSource = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
const market: DebateMarketHeader = {
	id: "0190c0de-3333-7000-8000-000000000003",
	slug: "head-zone-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

function presentPost(): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000da02",
		ordinal: 1,
		sideAtPostTime: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		entryPrice: "0.500000000000000000",
		aggregate: {
			supportCount: 2,
			counterCount: 1,
			supportDharma: "1000.000000000000000000",
			counterDharma: "2000.000000000000000000",
		},
		replies: EMPTY_REPLIES,
	};
}

const noop = () => {};

function renderPostArm() {
	return render(
		<PostFocusHeader
			post={presentPost()}
			bookmarks={VIEWER}
			heldSide={null}
			marketOpen
			suspended={false}
			activeRelation={null}
			onToggleRelation={noop}
			onExit={noop}
			onOpenImage={noop}
		/>,
	);
}

describe("HeadZone — the frame itself", () => {
	it("head-zone::left-content-lands-in-the-left-column", () => {
		const { container } = render(
			<HeadZone left={<p data-testid="probe-left">left</p>} right={null} />,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		expect(left).not.toBeNull();
		expect(left?.innerHTML).toContain('data-testid="probe-left"');
	});

	it("head-zone::a-null-rail-renders-NO-rail-node-at-all", () => {
		const { container } = render(<HeadZone left={<p>left</p>} right={null} />);

		// ⛔ NOT "renders an empty rail". An empty 25% column is visible empty
		// chrome, which is PD-3-09 / OD-6 — the ruling that deleted the
		// deferred-work placeholder box from `MarketHeader` for rendering a
		// build-time note about unbuilt work to every participant. The rail's
		// occupants land at C4 / C6 / C11; until then the node must not exist.
		expect(
			container.querySelector('[data-testid="headzone-right"]'),
		).toBeNull();
		// The frame itself is still there — this is absence of the RAIL, not
		// absence of the frame.
		expect(container.querySelector('[data-testid="headzone"]')).not.toBeNull();
	});

	it("head-zone::a-non-null-rail-renders-the-rail-node", () => {
		const { container } = render(
			<HeadZone
				left={<p>left</p>}
				right={<p data-testid="probe-right">right</p>}
			/>,
		);

		// The positive control beside the assertion above: the frame DOES render
		// a rail when given one, so "no rail node" is not merely "the frame never
		// renders one".
		const right = container.querySelector('[data-testid="headzone-right"]');
		expect(right).not.toBeNull();
		expect(right?.innerHTML).toContain('data-testid="probe-right"');
	});
});

describe("the arm split — each arm renders through the shared frame", () => {
	it("head-zone::the-market-arm-renders-through-the-frame", () => {
		const { container } = render(
			<MarketHeader market={market} priceChart={null} />,
		);

		const left = container.querySelector('[data-testid="headzone-left"]');
		expect(left).not.toBeNull();
		// `vm` content — the question and the attrs strip — is INSIDE the frame's
		// left column, not merely somewhere in the subtree.
		expect(left?.innerHTML).toContain("Fixture market question.");
		expect(left?.innerHTML).toContain("staked");
	});

	it("head-zone::the-post-arm-renders-through-the-SAME-frame", () => {
		const { container } = renderPostArm();

		const left = container.querySelector('[data-testid="headzone-left"]');
		expect(left).not.toBeNull();
		// `vp` content — the focused post's title and body.
		expect(left?.innerHTML).toContain("Fixture argument title.");
		expect(left?.innerHTML).toContain("Fixture body.");
	});

	it("head-zone::the-two-arms-are-DISJOINT", () => {
		// The whole finding in one assertion: `vm` and `vp` never co-render.
		const marketArm = render(<MarketHeader market={market} priceChart={null} />)
			.container.innerHTML;
		cleanup();
		const postArm = renderPostArm().container.innerHTML;

		// The market arm carries no post content …
		expect(marketArm).not.toContain("Fixture argument title.");
		expect(marketArm).not.toContain("Fixture body.");
		// … and the post arm carries no market content. This is the assertion
		// that would have failed before row 1, when `MarketHeader` rendered above
		// the ternary and BOTH were on screen in post view.
		expect(postArm).not.toContain("Fixture market question.");
		expect(postArm).not.toContain("Fixture resolution criterion.");
	});

	it("head-zone::row-9-is-NOT-deleted-it-is-market-arm-scoped", () => {
		// OD-3 keeps all five reverse deltas. The consequence of F-1 is that
		// ADR-0025's export and the INV-4 read-only marker become market-arm
		// ONLY — ⛔ never that they are removed. Asserted on both arms so a later
		// commit cannot quietly drop them while the arm split still passes.
		const marketArm = render(<MarketHeader market={market} priceChart={null} />)
			.container.innerHTML;
		cleanup();
		const postArm = renderPostArm().container.innerHTML;

		expect(marketArm).toContain("Download .md");
		expect(marketArm).toContain("Download this debate as Markdown");
		expect(marketArm).toContain("Market Open");
		expect(postArm).not.toContain("Download .md");
	});
});

describe("the mount site — read off the source, because jsdom cannot see it", () => {
	it("head-zone::MarketHeader-is-mounted-INSIDE-the-ternary", () => {
		const source = readSource(VIEW);

		const ternary = source.indexOf("{selectedPost ? (");
		const header = source.indexOf("<MarketHeader");
		expect(ternary).toBeGreaterThan(-1);
		expect(header).toBeGreaterThan(-1);

		// THE ROW-1 FIX. Before it, `<MarketHeader …>` was authored ABOVE the
		// ternary and so rendered in BOTH arms. Its one mount is now inside.
		expect(header).toBeGreaterThan(ternary);
		expect(source.split("<MarketHeader")).toHaveLength(2);
	});

	it("head-zone::DebatePoll-is-mounted-OUTSIDE-the-ternary", () => {
		const source = readSource(VIEW);

		const ternary = source.indexOf("{selectedPost ? (");
		const poll = source.indexOf("<DebatePoll");
		expect(poll).toBeGreaterThan(-1);

		// ⛔ THE COUNTERWEIGHT, and it is load-bearing. `DebateView` states the
		// reason in terms: inside the ternary, entering or leaving a post
		// REMOUNTS the poll and resets its `stopped` / `wasSuspended` refs, so
		// "stopped permanently" would last only until the reader opened a post.
		// Row 1 moved the header in; it must never sweep the poll in with it.
		expect(poll).toBeLessThan(ternary);
	});
});
