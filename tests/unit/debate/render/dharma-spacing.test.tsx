// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookmarkAffordance } from "@/components/bookmarks/BookmarkToggle";
import { ArgProfile } from "@/components/debate/ArgProfile";
import { PostCard } from "@/components/debate/PostCard";
import { ReplyCard } from "@/components/debate/ReplyCard";
import type {
	DebatePost,
	DebateReply,
	ReplyGroups,
} from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the `PD-3-07` Đ-spacing guard (plan §7; §6 rows 4 · 5 ·
 * 6 — sites 2, 3, 4 and 5).
 *
 * ⛔ THIS FILE IS `GC-3`'s REMEDY (a), AND IT IS THE REASON §18's CLOSURE IS
 * HONEST. `PD-3-07` was consumed PARTIAL at PR 1 *precisely because* sites 2-5
 * "are not guarded by anything today". §18 closes the row here. Closing it with
 * sites 2 and 3 unguarded would close it on the EXACT footing PR 1 refused —
 * which is what the plan shipped until read 1 found that
 * `aggregate-footer.test.tsx` reached row 6 alone.
 *
 * ⚠ ONE GUARD, FOUR SITES, BY DESIGN. The spaced `Đ` is ONE display rule with
 * FOUR implementations. A per-component guard set is four assertions of the
 * same rule, each able to drift alone (`PLURAL-NOUN-DUP`'s genus). Site 1
 * (`MarketHeader`) was taken at PR 1 and is guarded there.
 *
 * ⚠ WHY A RENDER GUARD AND NOT A GREP. Sites 4-5 render unspaced because JSX
 * STRIPS THE TRAILING NEWLINE AND INDENTATION from a text node before an
 * expression child — invisible to a `Đ`-followed-by-digit grep, which is how a
 * first measurement of this row found three sites instead of five. Only the
 * rendered output can see it.
 *
 * ⚠ SCHEDULED PARTIAL GREEN — the longest window in the PR, and it is EXPECTED
 * (§12 `H-GREEN` (b), GC-10): sites 4-5 discharge at **C2**, eight commits
 * before sites 2-3 at **C10**. C2 cannot rebuild `AggregateFooter`'s render
 * body as a split bar without writing both spans, and it writes them in canon
 * §107's SPACED grammar. C10's `AggregateFooter` arm is therefore a
 * VERIFICATION, not an edit.
 *
 * ⚠ GUARD-COMPOSITION CONSTRAINT (plan §7). `ArgProfile` and `ReplyCard` both
 * render `CardActions`, whose `Download` trigger C11 DELETES. Every assertion
 * below is scoped to the element carrying the Đ figure, so C11 cannot move it.
 * Sites 4-5 are read through `PostCard` rather than through `AggregateFooter`
 * directly, so this guard is independent of that component's own signature.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

const VIEWER: BookmarkAffordance = { saved: new Set(), own: new Set() };
const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentReply(): DebateReply {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-0000000007a1",
		side: "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		body: "Fixture reply body.",
		marker: "none",
		author: { pseudonym: "fixture-replier", pfpUrl: "" },
		stake: "5000.000000000000000000",
		entryPrice: "0.500000000000000000",
	};
}

function presentPost(): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-0000000007b1",
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
		aggregate: AGGREGATE,
		replies: EMPTY_REPLIES,
	};
}

const noop = () => {};

/**
 * ⛔ THE STAKE SPAN, AND WHY IT IS NOT JUST `.font-mono`.
 *
 * `SideBadge` rides `CHIP.base`, which CARRIES `font-mono`
 * (`badges.tsx:61 (CHIP → base)`, pinned verbatim by a passing assertion at
 * `side-badge.test.tsx:66-67`). And in BOTH components the badge precedes the
 * stake in document order — `ReplyCard.tsx:49` before `:54`,
 * `ArgProfile.tsx:62` before `:67`.
 *
 * ⇒ A bare `.font-mono` returns the FIRST match in tree order, which is the
 * SIDE BADGE, whose innerHTML is "YES". Sites 2 and 3 would have failed at C1
 * and failed again after C10 wrote the ruled spaced form, because C10 does not
 * touch the element that selector returns. The guard would have looked like
 * coverage while proving only that a side badge contains no Đ figure — `O-3`,
 * a true refusal reported with a misleading cause.
 *
 * ⚠ THIS IS THE ASSERTION §18's CLOSURE OF `PD-3-07` RESTS ON. PR 1 consumed
 * the row PARTIAL precisely because sites 2-5 were unguarded; closing it on a
 * guard that cannot observe sites 2 and 3 would close it on the exact footing
 * PR 1 refused — `GC-3` reproduced inside `GC-3`'s own remedy.
 *
 * `Badge` stamps `data-slot="badge"` (`ui/badge.tsx:41`); the stake spans carry
 * no `data-slot`, so excluding it selects the figure and nothing else.
 * Caught by `@code-reviewer` (HIGH-1) on the C1 diff.
 */
const STAKE_SPAN = '.font-mono:not([data-slot="badge"])';

describe("POLISH.3 PR 2 — PD-3-07, the spaced Đ across all four PR-2 sites", () => {
	it("dharma-spacing::site-2-the-reply-card-stake-is-spaced", () => {
		// Site 2 · `ReplyCard.tsx:55 (ReplyCard → stake span)` · lands at C10.
		const { container } = render(
			<ReplyCard reply={presentReply()} bookmarks={VIEWER} />,
		);

		const stake = container.querySelector(STAKE_SPAN);
		expect(stake).not.toBeNull();
		expect(stake?.innerHTML).toContain("Đ 5,000");
	});

	it("dharma-spacing::site-3-the-argprofile-author-stake-is-spaced", () => {
		// Site 3 · `ArgProfile.tsx:67 (ArgProfile → authorStake span)` · C10.
		const { container } = render(
			<ArgProfile
				commentId="0199a0c0-0000-7000-8000-0000000007c1"
				author={{ pseudonym: "fixture-author", pfpUrl: "" }}
				side="YES"
				marker="none"
				authorStake="1500.000000000000000000"
				replyCount={0}
				bookmarks={VIEWER}
			/>,
		);

		const stake = container.querySelector(STAKE_SPAN);
		expect(stake).not.toBeNull();
		expect(stake?.innerHTML).toContain("Đ 1,500");
	});

	it("dharma-spacing::sites-4-and-5-the-aggregate-figures-are-spaced", () => {
		// Sites 4-5 · `AggregateFooter.tsx:14` and `:19` · discharged at **C2**,
		// NOT at C10 (GC-10). Read through `PostCard`, which is the only
		// component that renders `AggregateFooter` (two call sites, both there).
		const { container } = render(
			<PostCard
				post={presentPost()}
				bookmarks={VIEWER}
				onEnter={noop}
				onOpenPopup={noop}
				onOpenImage={noop}
			/>,
		);

		const footer = container.querySelector('[data-testid="aggregate-footer"]');
		expect(footer).not.toBeNull();
		expect(footer?.innerHTML).toContain("Đ 1,000");
		expect(footer?.innerHTML).toContain("Đ 2,000");
	});
});
