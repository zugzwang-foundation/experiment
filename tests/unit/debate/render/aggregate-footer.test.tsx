// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AggregateFooter } from "@/components/debate/AggregateFooter";
import { PostCard } from "@/components/debate/PostCard";
import type { DebatePost, ReplyGroups, Side } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the market-view split-bar guard (plan §7; §6 row T3,
 * Tier B-3). **T3 ONLY** — re-scoped at `GC-3`, because this file previously
 * carried row 6 as well and row 6 is only sites 4-5 of `PD-3-07`. Copy is
 * `dharma-spacing.test.tsx`'s subject; this file's subject is presence and
 * POLE BINDING.
 *
 * Row T3 (C2) — `AggregateFooter.tsx:12-22 (AggregateFooter → render body)` vs
 * `d5:1099-1102 (.barrow.f2)`. Read-only; no DTO change, no server touch.
 * ⚠ The anchor is the WHOLE render body, which is why C2 discharges rows 4-6's
 * sites 4-5 by construction (GC-10) — `:14` and `:19` sit strictly inside it.
 *
 * ⛔⛔ FOUR ASSERTIONS, NOT TWO — AND THIS IS THE WHOLE POINT OF THE ROW.
 * The bar is **SIDE-CODED, NOT RELATION-CODED** (plan §7, guard form). Support
 * on a YES post resolves to the YES side; Support on a NO post resolves to the
 * NO side. So the pole a given share is painted in DEPENDS ON THE POST, and a
 * YES-post-only test passes on a bar that is inverted for every NO post.
 *
 * ⚠ THIS IS `side-pole-binding.test.ts`'s DOCUMENTED ROUTE 3, AND THAT GUARD
 * CANNOT CATCH IT. Its own docstring names the case: "a FIXED pole colour on a
 * PER-SIDE element — no side value appears in the expression at all; the pole
 * is hard-coded while the QUANTITY it measures flips meaning with the side",
 * and records that "V17's Support/Counter split bar lived in exactly this hole
 * for the length of this PR ... and this file stayed green throughout". The
 * static guard is structurally blind here; THIS render guard is the control.
 * ⇒ The bar must resolve its poles FROM the post's side. `RR-3` was the same
 * defect on `ReplySplitBar`'s own track and fill spans — corrected at C13, and
 * cited here as the worked example rather than as a live defect. The reference
 * shape is `ReplySplitBar (→ TriggerPill → the pole const)`, which derives from
 * `deriveReplySide`.
 *
 * ⚠ GUARD-COMPOSITION CONSTRAINT (plan §7). Read through `PostCard` — the only
 * component that renders `AggregateFooter` — and scoped by testid to the bar's
 * own elements, so C8/C9's card edits and C11's `Download` deletion cannot move
 * it.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

afterEach(cleanup);

/** HTML-FINISH · MARKET DETAIL row 22 — the card's Support/Counter pills.
 * These suites assert spacing / card composition, never the
 * trigger gate, so a no-op with `heldSide: null` is the honest stand-in: it
 * keeps the viewer state REQUIRED at the component (a trigger without its
 * F-3 gate invites a bet the viewer cannot place) without pretending this
 * file tests it. `aggregate-footer.test.tsx` is where the gate is pinned. */
const noopReply = () => {};

const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

/** Asymmetric on purpose — a 50/50 split hides a swapped fill. */
const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(side: Side): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000af01",
		ordinal: 1,
		sideAtPostTime: side,
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

function renderFooter(side: Side) {
	const { container } = render(
		<PostCard
			post={presentPost(side)}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
			onReplyToPost={noopReply}
			heldSide={null}
			marketOpen
			suspended={false}
		/>,
	);
	const footer = container.querySelector('[data-testid="aggregate-footer"]');
	expect(footer).not.toBeNull();
	return footer as Element;
}

function classOf(root: Element, testid: string): string {
	const node = root.querySelector(`[data-testid="${testid}"]`);
	expect(node).not.toBeNull();
	return node?.getAttribute("class") ?? "";
}

describe("POLISH.3 PR 2 — T3, the market-view split bar's visual half", () => {
	it("aggregate-footer::renders-a-split-bar-with-a-track-and-a-fill", () => {
		// Presence, before poling. The shipped body is a plain text row; the
		// mockup's `.barrow.f2` is a bar.
		const footer = renderFooter("YES");

		expect(
			footer.querySelector('[data-testid="aggregate-split-track"]'),
		).not.toBeNull();
		expect(
			footer.querySelector('[data-testid="aggregate-split-fill"]'),
		).not.toBeNull();
	});

	it("aggregate-footer::on-a-YES-post-the-support-fill-takes-the-YES-pole", () => {
		// Assertion 1 of 4. Support on a YES post resolves to YES.
		const footer = renderFooter("YES");

		expect(classOf(footer, "aggregate-split-fill")).toContain("bg-yes");
	});

	it("aggregate-footer::on-a-YES-post-the-track-takes-the-NO-pole", () => {
		// Assertion 2 of 4. The track is the counter remainder — the opposite
		// side — so it carries the opposite pole.
		const footer = renderFooter("YES");

		expect(classOf(footer, "aggregate-split-track")).toContain("bg-no");
	});

	it("aggregate-footer::on-a-NO-post-the-support-fill-takes-the-NO-pole", () => {
		// ⛔ Assertion 3 of 4 — THE ONE A FIXED-POLE BAR FAILS. Support on a NO
		// post resolves to NO, so the same "support share" element must flip
		// pole. A bar hard-coded `bg-yes` renders the NO-side share in the YES
		// pole on every NO post and passes assertions 1 and 2 regardless.
		const footer = renderFooter("NO");

		expect(classOf(footer, "aggregate-split-fill")).toContain("bg-no");
	});

	it("aggregate-footer::on-a-NO-post-the-track-takes-the-YES-pole", () => {
		// Assertion 4 of 4, the mirror.
		const footer = renderFooter("NO");

		expect(classOf(footer, "aggregate-split-track")).toContain("bg-yes");
	});

	it("aggregate-footer::the-track-keeps-a-visible-edge-on-BOTH-poles", () => {
		// The hairline this bar already carries was UNDEFENDED until now: the four
		// pole assertions are positive-only `toContain`, so it could have been
		// deleted with this whole suite staying green (@security-auditor LOW).
		// It is load-bearing — on a NO post the track is `bg-yes` #181818 on a
		// #212121 card, ~1.10:1, and without the edge it disappears.
		expect(classOf(renderFooter("YES"), "aggregate-split-track")).toContain(
			"[border:var(--hairline)]",
		);
		expect(classOf(renderFooter("NO"), "aggregate-split-track")).toContain(
			"[border:var(--hairline)]",
		);
	});
});

/**
 * HTML-FINISH · MARKET DETAIL row 22 — the `.rbtn2` Support/Counter TRIGGER
 * pills return to the card footer (`d5:1100`, `:1102`). `R1` reversed by the
 * founder ruling of 2026-08-16.
 *
 * ⛔⛔ THE POLE ASSERTIONS ARE EXTENDED, NEVER RELAXED. The four existing
 * assertions above (two poles × two post sides) cover the split BAR; the pills
 * are pole-bearing too, and by the SAME rule — Support inherits the post's side,
 * Counter takes the opposite, so on a NO post the Support pill is the NO pole.
 * A fixed pole on a per-side element is exactly the "Route 3" blind spot
 * `side-pole-binding.test.ts` documents itself as unable to see, which is why
 * these live here as render assertions.
 *
 * ⛔ AND THE F-3 GATE IS PINNED WITH THEM. A trigger whose RESULTING side is not
 * the viewer's held side must be DISABLED — a live pill there invites a bet the
 * viewer cannot place, and the failure would be silent: the pill renders, the
 * pole is right, and only the click fails.
 */
describe("HTML-FINISH · MARKET DETAIL — row 22, the card trigger pills", () => {
	const TRIGGERS = {
		heldSide: null,
		marketOpen: true,
		suspended: false,
		onReply: () => {},
	};

	it("aggregate-footer::no-triggers-prop-renders-the-read-only-footer", () => {
		// The pills are OPTIONAL, so every consumer without viewer state keeps
		// today's render. Non-vacuity for the assertions below.
		const { container } = render(
			<AggregateFooter aggregate={AGGREGATE} postSide="YES" />,
		);
		expect(
			container.querySelector('[data-testid="card-trigger-support"]'),
		).toBeNull();
		// ⚠ HTML-FINISH · MARKET DETAIL round 2 · R5 — this line used to read
		// `toContain("Support (")`, which R5 deleted from the render. The
		// assertion's JOB was non-vacuity ("the read-only footer still drew
		// something"), and the label it happened to reach for is now gone, so it is
		// REPOINTED at what the read-only footer actually still renders rather than
		// deleted — dropping it would leave the `toBeNull()` above unpaired and a
		// component that rendered NOTHING would pass this row.
		// ⛔ Assert on `innerHTML`, never `textContent` (O-7).
		expect(
			container.querySelector('[data-testid="aggregate-footer"]'),
		).not.toBe(null);
		expect(container.innerHTML).not.toContain("Support (");
		expect(container.innerHTML).not.toContain("Counter (");
	});

	it("aggregate-footer::row-5-the-flanking-figures-are-bare-dharma", () => {
		// R5's positive control. The two flanking spans carry the figure ALONE —
		// d5's `.sb2` (`:981`/`:983`) — with the word "Support"/"Counter" living on
		// the pill above, not restated beside the number.
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="YES"
				triggers={TRIGGERS}
			/>,
		);
		const columns = container.querySelectorAll(
			'[data-testid="aggregate-footer"] > span',
		);
		expect(columns).toHaveLength(3);
		// Column 0 = Support side, column 2 = Counter side; the middle is the bar.
		// `:scope > span:last-child` is the figure under each pill.
		expect(columns[0]?.querySelector("span:last-child")?.textContent).toBe(
			"Đ 1,000",
		);
		expect(columns[2]?.querySelector("span:last-child")?.textContent).toBe(
			"Đ 2,000",
		);
		// The pill IS still there and still says the word — which is why dropping
		// the prefix loses nothing.
		expect(
			columns[0]?.querySelector('[data-testid="card-trigger-support"]')
				?.textContent,
		).toBe("Support");
		expect(
			columns[2]?.querySelector('[data-testid="card-trigger-counter"]')
				?.textContent,
		).toBe("Counter");
	});

	it("aggregate-footer::pills-are-poled-by-the-RESULTING-side-on-a-YES-post", () => {
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="YES"
				triggers={TRIGGERS}
			/>,
		);

		// Support inherits YES → the YES pole; Counter opposes → the NO pole.
		const support = container.querySelector(
			'[data-testid="card-trigger-support"]',
		);
		const counter = container.querySelector(
			'[data-testid="card-trigger-counter"]',
		);
		expect(support?.getAttribute("class")).toContain("bg-yes");
		expect(counter?.getAttribute("class")).toContain("bg-no");
		// The accessible name names the RESULTING BET SIDE, never the relation
		// alone — AGENTS.md §8: the poles name the SIDE, never Support/Counter.
		expect(support?.getAttribute("aria-label")).toBe("Support — bet YES");
		expect(counter?.getAttribute("aria-label")).toBe("Counter — bet NO");
	});

	it("aggregate-footer::pills-INVERT-on-a-NO-post", () => {
		// THE assertion a fixed-pole implementation fails. Same relations, other
		// post side, opposite poles.
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="NO"
				triggers={TRIGGERS}
			/>,
		);

		const support = container.querySelector(
			'[data-testid="card-trigger-support"]',
		);
		const counter = container.querySelector(
			'[data-testid="card-trigger-counter"]',
		);
		expect(support?.getAttribute("class")).toContain("bg-no");
		expect(counter?.getAttribute("class")).toContain("bg-yes");
		expect(support?.getAttribute("aria-label")).toBe("Support — bet NO");
		expect(counter?.getAttribute("aria-label")).toBe("Counter — bet YES");
	});

	it("aggregate-footer::F-3-disables-the-trigger-that-opposes-the-held-side", () => {
		// The viewer holds YES on a YES post: Support resolves to YES (allowed),
		// Counter resolves to NO (forbidden — one held side per market).
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="YES"
				triggers={{ ...TRIGGERS, heldSide: "YES" }}
			/>,
		);

		const support = container.querySelector<HTMLButtonElement>(
			'[data-testid="card-trigger-support"]',
		);
		const counter = container.querySelector<HTMLButtonElement>(
			'[data-testid="card-trigger-counter"]',
		);
		expect(support?.disabled).toBe(false);
		expect(counter?.disabled).toBe(true);
		// The C3 batch string carries the refusal in BOTH channels, identical to
		// the focused-post bar — one refusal, one wording, wherever it is met.
		expect(counter?.getAttribute("title")).toBeTruthy();
		expect(counter?.getAttribute("aria-label")).toBe(
			counter?.getAttribute("title"),
		);
	});

	it("aggregate-footer::a-closed-market-disables-both", () => {
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="YES"
				triggers={{ ...TRIGGERS, marketOpen: false }}
			/>,
		);
		for (const relation of ["support", "counter"]) {
			const pill = container.querySelector<HTMLButtonElement>(
				`[data-testid="card-trigger-${relation}"]`,
			);
			expect(pill?.disabled).toBe(true);
		}
	});

	it("aggregate-footer::clicking-a-pill-reports-its-relation", () => {
		const onReply = vi.fn();
		const { container } = render(
			<AggregateFooter
				aggregate={AGGREGATE}
				postSide="YES"
				triggers={{ ...TRIGGERS, onReply }}
			/>,
		);

		fireEvent.click(
			container.querySelector(
				'[data-testid="card-trigger-counter"]',
			) as HTMLButtonElement,
		);
		expect(onReply).toHaveBeenCalledWith("counter");
	});
});
