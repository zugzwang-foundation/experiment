// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SideBadge } from "@/components/debate/badges";
import { PostPopup } from "@/components/debate/dialogs";
import type { PresentPost, Side } from "@/components/debate/types";

/**
 * POLISH.3 PR 2 · C1 — the `PostPopup` guards (plan §7; §6 rows 9 · 10 · 11 ·
 * 12 · 14).
 *
 * ⛔ FIVE ROWS, NOT FOUR — GC-12, Gate C read 4. The ratified plan's §7 lists
 * this file as covering "rows 10, 11, 12, 14" and §12's `H-GREEN` schedule
 * reproduces the same four. **ROW 9 IS IN NEITHER.** Sweeping §7's whole table,
 * row 9 (`PD-3-06`, the pop-up image height bound at `dialogs.tsx:44-51`) was
 * the ONLY §6 row with no guard at all — while §18 CLOSES `PD-3-06` "by row 9".
 * That is `GC-3`'s genus one row over: a register row closing on a site no
 * guard reaches. Ruled at kickoff — this file covers rows 9, 10, 11, 12, 14,
 * and §12's schedule for it reads: rows 9 + 14 at C5 · rows 10-12 at C6.
 *
 * Rows under test:
 *  - row 9  (`PD-3-06`, C5) — the pop-up image is bounded on HEIGHT, so a tall
 *    image renders WHOLE instead of scrolling. R14 check 2 half-passed: the
 *    `w-full` discharges width and is SILENT on height.
 *  - row 10 (`PD-3-12`, C6) — the three omissions the card renders and the
 *    pop-up does not: position marker · lane badge · aggregate footer.
 *  - row 11 (`PD-3-13`, C6) — the author's stake `a`, SPEC.1 §9 F-DEBATE-1
 *    ("each post renders the author's stake at its header"). Tier 1.
 *  - row 12 (`PD-3-14`, C6) — the frozen `SideBadge`, replacing bare
 *    interpolated text. Tier 1, INV-3's UI expression.
 *  - row 14 (`PD-0-03`, C5) — geometry 512→720px, 80→90vh.
 *
 * ⚠ PORTALLED BY CONSTRUCTION. The repo's `Dialog` portals by default
 * (`ui/dialog.tsx (DialogContent → DialogPortal)`), so `container` holds
 * NOTHING. Every query below runs against `baseElement` (plan §7, guard form).
 *
 * ⚠ Row 12 asserts BOTH POLES. The register says so explicitly: "a per-pole
 * render test must assert both a YES and a NO instance — a YES-only test passes
 * on an inverted NO panel, which is exactly how the last live inversion
 * survived a full PR."
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM only.
 */

vi.mock("@/server/bookmarks/add", () => ({ addBookmarkAction: vi.fn() }));
vi.mock("@/server/bookmarks/remove", () => ({ removeBookmarkAction: vi.fn() }));

afterEach(cleanup);

const AGGREGATE = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(side: Side): PresentPost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000dp01",
		ordinal: 1,
		sideAtPostTime: side,
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture body.",
		imageUrl: "https://example.invalid/fixture-image",
		marker: "Flipped",
		badge: "Contested",
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		entryPrice: "0.500000000000000000",
		aggregate: AGGREGATE,
		replies: { support: [], counter: [], twoSlot: [] },
	};
}

const noop = () => {};

function renderPopup(side: Side = "YES") {
	return render(<PostPopup post={presentPost(side)} onClose={noop} />);
}

function dialogContent(baseElement: HTMLElement): Element {
	const node = baseElement.querySelector('[data-slot="dialog-content"]');
	expect(node).not.toBeNull();
	return node as Element;
}

// ⚠ RE-DERIVED AT HTML-FINISH · MARKET DETAIL rows 13 + 33, never relaxed.
// Row 33 replaced the pop-up's hand-built strip with the SHARED `ArgProfile`
// cluster, and row 13 put the author's entry price ON the side chip. The badge
// is still rendered, still frozen, still poled — its ACCESSIBLE NAME now also
// carries the price ("YES side, entry price 50%"), so the exact-match selectors
// below became prefix matches. The properties under test are unchanged: the
// primitive renders, at both poles, unsized.
describe("POLISH.3 PR 2 — PostPopup geometry, omissions, stake and side badge", () => {
	it("post-popup::geometry-is-720px-wide-and-90vh-tall", () => {
		// Row 14 · PD-0-03 · R5 geometry half. CD-A ratified 720px / 90vh; the
		// build ships `max-w-lg` (~512px) from `ui/dialog.tsx (DialogContent)` and
		// `max-h-[80vh]`. The override lands on the INSTANCE at `dialogs.tsx`
		// (`ui/dialog.tsx` is NOT on §8's allow-list and is not edited).
		const { baseElement } = renderPopup();

		const className = dialogContent(baseElement).getAttribute("class") ?? "";

		expect(className).toContain("max-w-[720px]");
		expect(className).toContain("max-h-[90vh]");
		// The superseded height must be GONE, not merely outranked — a stale
		// `max-h-[80vh]` left beside the new one is a tailwind-merge coin flip.
		expect(className).not.toContain("max-h-[80vh]");
	});

	it("post-popup::image-is-bounded-on-height-so-it-renders-whole", () => {
		// Row 9 · PD-3-06 (GC-12) · R14 check 2's OPEN half. CD-A's phrase
		// "renders whole in the pop-up" names no axis, so a two-axis obligation
		// was recorded as one claim and the height half was never checkable.
		// The shipped sibling in this very file — `ImageLightbox` — already
		// answers the same question with `max-h-[…] w-full object-contain`.
		const { baseElement } = renderPopup();

		const img = dialogContent(baseElement).querySelector("img");
		expect(img).not.toBeNull();

		const className = img?.getAttribute("class") ?? "";
		expect(className).toMatch(/\bmax-h-\[/);
		expect(className).toContain("object-contain");
	});

	it("post-popup::renders-the-position-marker-the-card-renders", () => {
		// Row 10, omission 1 of 3 · PD-3-12. `marker` is REQUIRED on the present
		// variant and `"none"` is a SENTINEL, never a missing field — so nothing
		// is missing from the read model and ADR-0034 D-1 does not fire.
		const { baseElement } = renderPopup();

		expect(
			dialogContent(baseElement).querySelector('[aria-label="Author Flipped"]'),
		).not.toBeNull();
	});

	it("post-popup::renders-the-lane-badge-the-card-renders", () => {
		// Row 10, omission 2 of 3 · PD-3-12.
		const { baseElement } = renderPopup();

		expect(dialogContent(baseElement).innerHTML).toContain("Contested");
	});

	it("post-popup::renders-the-aggregate-footer-the-card-renders", () => {
		// Row 10, omission 3 of 3 · PD-3-12. Keyed to the footer's own element
		// so C2's split-bar rebuild is what satisfies it, not a text coincidence
		// somewhere else in the dialog.
		const { baseElement } = renderPopup();

		expect(
			dialogContent(baseElement).querySelector(
				'[data-testid="aggregate-footer"]',
			),
		).not.toBeNull();
	});

	it("post-popup::header-renders-the-authors-stake", () => {
		// Row 11 · PD-3-13 · TIER 1, SPEC.1 §9 F-DEBATE-1: "each post renders the
		// author's stake `a` at its header". Class F, not V — "no stake, no
		// voice" is the thesis the stake display carries. `authorStake` is
		// already on `PresentPost`; the remedy reads it, it fetches nothing.
		const { baseElement } = renderPopup();

		const header = dialogContent(baseElement).querySelector(
			'[data-slot="dialog-header"]',
		);
		expect(header).not.toBeNull();
		// Canon §107's SPACED grammar — this is NEW copy, so it is written in the
		// ruled form rather than adding a fifth unspaced site.
		expect(header?.innerHTML).toContain("Đ 10");
	});

	it("post-popup::renders-a-frozen-side-badge-on-the-YES-pole", () => {
		// Row 12 · PD-3-14 · TIER 1. The build interpolates `sideAtPostTime` as a
		// bare text node; INV-3 is expressed in the UI through the frozen badge
		// primitive, so the remedy renders the primitive.
		const { baseElement } = renderPopup("YES");

		const description = dialogContent(baseElement).querySelector(
			'[data-slot="dialog-description"]',
		);
		expect(description).not.toBeNull();
		expect(
			description?.querySelector('[aria-label^="YES side"]'),
		).not.toBeNull();
	});

	it("post-popup::renders-a-frozen-side-badge-on-the-NO-pole", () => {
		// Row 12, the other pole. A YES-only test passes on an inverted NO panel.
		const { baseElement } = renderPopup("NO");

		const description = dialogContent(baseElement).querySelector(
			'[data-slot="dialog-description"]',
		);
		expect(description).not.toBeNull();
		expect(
			description?.querySelector('[aria-label^="NO side"]'),
		).not.toBeNull();
	});

	it("post-popup::side-badge-is-UNSIZED-and-rides-the-CHIP-base-preset", () => {
		// Row 12's fence. `side-badge.test.tsx`'s
		// `detail-stays-unwired-and-profile-is-wired-only-where-ruled` assertion
		// pins `detail` at ZERO for POLISH.3, so a `size="detail"` here would
		// redden a second, unplanned assertion in a file this PR also edits.
		// Pinned STRUCTURALLY: the rendered badge must carry exactly the classes
		// an unsized `<SideBadge>` renders, compared against a live reference
		// render rather than a transcribed string that can drift.
		const reference = render(<SideBadge side="YES" />);
		const referenceClass =
			reference.container.firstElementChild?.getAttribute("class") ?? "";
		expect(referenceClass).not.toBe("");
		cleanup();

		const { baseElement } = renderPopup("YES");
		const badge = dialogContent(baseElement).querySelector(
			'[aria-label^="YES side"]',
		);

		expect(badge?.getAttribute("class")).toBe(referenceClass);
	});
});

/**
 * HTML-FINISH · MARKET DETAIL rows 33 + 35 — the pop-up's head cluster and its
 * scroll reset.
 */
describe("HTML-FINISH · MARKET DETAIL — rows 33 + 35", () => {
	it("post-popup::the-head-is-the-SHARED-cluster", () => {
		// Row 33 — d5's `fillPop` (`:1628-1637`) writes author · chip (SIDE @
		// entry%) · stake, which is the row `ArgProfile` renders everywhere else.
		// The avatar and the entry price are what the hand-built strip never had.
		const { baseElement } = renderPopup("YES");
		const html = dialogContent(baseElement).innerHTML;

		expect(html).toContain("@");
		expect(html).toContain("|");
		// ⛔ NO bookmark cluster in the pop-up: the reader has already chosen, and
		// the card they opened it from still carries it. `showActions={false}` is
		// a caller-side layout switch designed for exactly this.
		expect(
			dialogContent(baseElement).querySelector('button[aria-label="Bookmark"]'),
		).toBeNull();
	});

	it("post-popup::opens-scrolled-to-the-TOP", () => {
		// Row 35 — d5 resets `.pmscroll`'s `scrollTop` on every fill (`:1641`).
		// ⚠ THE DEFECT ONLY APPEARS ON THE SECOND OPEN, which is why it survives
		// hand-testing: `DialogContent` is `overflow-y-auto` and shadcn keeps the
		// node mounted between opens, so the previous long argument's scroll
		// position carries into the next one and a reader lands halfway down a
		// short reply. A mount-only reset would fire once and never again — the
		// exact shape of the bug — so the effect keys on the OPEN transition.
		const { baseElement, rerender } = render(
			<PostPopup post={presentPost("YES")} onClose={noop} />,
		);
		const content = dialogContent(baseElement) as HTMLElement;

		// Simulate the reader having scrolled the first argument.
		content.scrollTop = 400;
		expect(content.scrollTop).toBe(400);

		// Close, then open again on a different post — the second-open case.
		rerender(<PostPopup post={null} onClose={noop} />);
		rerender(<PostPopup post={presentPost("NO")} onClose={noop} />);

		expect((dialogContent(baseElement) as HTMLElement).scrollTop).toBe(0);
	});
});
