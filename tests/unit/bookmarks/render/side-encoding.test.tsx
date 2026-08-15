// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookmarkCard } from "@/components/bookmarks/BookmarkCard";
import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import type { BookmarkItem } from "@/server/bookmarks/list";

/**
 * DISCOVERY-COMPLETE C4 — INV-3 on `/bookmarks`. Written and failing FIRST.
 *
 * THE DEFECT. `BookmarkCard.tsx:89-93` hand-rolled its own `SideChip` as
 * `<Badge variant={side === "YES" ? "default" : "secondary"}>`. Resolution
 * chain, derived at source:
 *
 *   YES -> `default`   -> `bg-primary`   -> `--primary: var(--color-n7)`   #e4e4e4  near-WHITE
 *   NO  -> `secondary` -> `bg-secondary` -> `--secondary: var(--color-n1)` #2a2a2a  near-BLACK
 *
 * The ratified binding (globals.css:151-152, pinned by
 * tests/unit/design/tokens-monochrome.test.ts) is `--color-yes: #181818` (YES =
 * BLACK) and `--color-no: #fafafa` (NO = WHITE). `/bookmarks` therefore rendered
 * the EXACT INVERSE on both poles, background and text.
 *
 * Nothing rescued it: `SideChip` passed no `className`, no `[data-variant]`
 * selector exists for badges, and the `.dark` block that redefines `--primary`
 * is never applied (AGENTS.md §8 "descoped-inert").
 *
 * ⚠ HONEST LIMIT. jsdom does not evaluate the `@theme` cascade, so this file
 * proves the CLASS NAMES, not the pixel. The pixel proof needs a browser, and
 * `/bookmarks` is auth-gated. `/u/[pseudonym]` is NOT, and renders the identical
 * chip — see C4b, which is the cheaper pixel proof of the same defect.
 *
 * SCOPING NOTE. The `bg-primary` / `bg-secondary` assertions are scoped to the
 * SIDE CHIP element, not the whole card: `PositionMarker` legitimately renders
 * `variant="secondary"` for the neutral-grey marker, which is not side-keyed and
 * is not this defect.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("@/server/bookmarks/remove", () => ({
	removeBookmarkAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn() }),
}));

afterEach(cleanup);

const AGGREGATE = {
	supportCount: 3,
	counterCount: 1,
	supportDharma: "300.000000000000000000",
	counterDharma: "100.000000000000000000",
};

const BODY = "ZZ-DISTINCTIVE-BODY-MARKER-c4";

function liveItem(
	side: "YES" | "NO",
	marker: "none" | "Flipped" | "Exited" = "none",
): BookmarkItem {
	return {
		removed: false,
		kind: "post",
		id: "0190b3a0-9999-7000-8000-00000000000a",
		side,
		marketSlug: "will-x-happen",
		marketTitle: "Will X happen?",
		ordinal: 4,
		title: "A bookmarked argument",
		teaser: "The teaser.",
		body: BODY,
		marker,
		// POLISH.5 PR A / A5 (§5 row 20, ratified 2026-08-14). `BookmarkItem` is
		// defined OVER `ProfileArgumentItem` via `Extract<…>` (bookmarks/list.ts
		// :43-53), so the profile passthrough's two new REQUIRED fields reach
		// this literal — it CONSTRUCTS the DTO rather than receiving it, which
		// is why the runtime zero-delta analysis (§8.2) did not predict it.
		// ⛔ Fixture fields only: no assertion here reads them, and `removedItem`
		// below is the removed variant and carries neither (SC-1 intact).
		authorStake: "1000.000000000000000000",
		priceAtBet: "0.380000000000000000",
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: AGGREGATE,
		authorPseudonym: "ashen-rook-12",
		staked: "1000.000000000000000000",
		current: "1407.000000000000000000",
	};
}

const removedItem = (side: "YES" | "NO"): BookmarkItem => ({
	removed: true,
	kind: "post",
	id: "0190b3a0-9999-7000-8000-00000000000b",
	side,
	marketSlug: "will-x-happen",
	marketTitle: "Will X happen?",
	ordinal: 5,
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: AGGREGATE,
	authorPseudonym: "tidal-knight-88",
});

/**
 * The chip is the badge whose text is the side literal — bare, or carrying the
 * entry price.
 *
 * ⚠ WIDENED AT POLISH.6 ITEM 1 (PD-6-01). A SELECTOR CHANGE, NOT AN ASSERTION
 * DELETION. `badges.tsx:166` renders `` `${side} @ ${pct}` `` as soon as a
 * `price` is passed, so the live arm's chip now reads `YES @ 38%` and the old
 * equality predicate returned `null` — a FALSE NEGATIVE, which is exactly the
 * failure the docblock below exists to prevent (O-3).
 *
 * ⛔ STILL ANCHORED AT THE SIDE, never a bare `includes`. `text === side` keeps
 * the removed arm — which carries no price field and never will (S-5) — and
 * `startsWith(`${side} @ `)` admits only the priced form, so a badge whose text
 * merely CONTAINS the literal cannot satisfy it.
 */
function sideChip(container: HTMLElement, side: "YES" | "NO"): Element | null {
	return (
		[...container.querySelectorAll('[data-slot="badge"]')].find((el) => {
			const text = el.textContent?.trim() ?? "";
			return text === side || text.startsWith(`${side} @ `);
		}) ?? null
	);
}

/**
 * EXACT class tokens, never a substring match. `badgeVariants` ships
 * `[a]:hover:bg-primary/80` — an anchor-scoped HOVER variant that CONTAINS the
 * substring "bg-primary" while being an entirely different rule. A
 * `.not.toContain("bg-primary")` on the raw string therefore fails even after
 * twMerge has correctly dropped the base `bg-primary`, reporting a defect that
 * is not there. O-3: a true finding with a misleading cause is a defect, and so
 * is a false one.
 */
const classTokens = (el: Element | null): string[] =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("BookmarkCard — INV-3, the side chip is pole-bound", () => {
	it("yes-chip-is-black-not-near-white", () => {
		const { container } = render(<BookmarkCard item={liveItem("YES")} />);
		const chip = sideChip(container, "YES");
		expect(chip).not.toBeNull();

		const cls = classTokens(chip);
		// The ratified binding: YES = `--color-yes` = #181818.
		expect(cls).toContain("bg-yes");
		expect(cls).toContain("text-no");
		// The defect: a side resolved through a shadcn semantic variant.
		expect(cls).not.toContain("bg-primary");
		expect(cls).not.toContain("bg-secondary");
	});

	it("no-chip-is-white-not-near-black", () => {
		const { container } = render(<BookmarkCard item={liveItem("NO")} />);
		const chip = sideChip(container, "NO");
		expect(chip).not.toBeNull();

		const cls = classTokens(chip);
		expect(cls).toContain("bg-no");
		expect(cls).toContain("text-yes");
		expect(cls).not.toContain("bg-primary");
		expect(cls).not.toContain("bg-secondary");
	});

	it("the-chip-announces-the-side-and-its-entry-price", () => {
		// The adopted primitive carries the `aria-label` the hand-roll lacked —
		// colour paired with literal text (AGENTS.md §8).
		//
		// ⚠ RELAXED TO THE PRICED LABEL AT POLISH.6 ITEM 1 (PD-6-01). Both
		// strings below are DERIVED FROM `badges.tsx`'s own templates at head,
		// never copied off a render: `${side} @ ${pct}` (:166) and
		// `${side} side, entry price ${pct}` (:155-157), where `pct` is
		// `formatPercentUnpaired("0.380000000000000000")` → `wholePercent` reads
		// intPart "0" → 0, firstTwo "38", third "0" (< 5, no bump) → `"38%"`.
		const { container } = render(<BookmarkCard item={liveItem("YES")} />);
		// The visible deliverable, pinned rather than inferred from the selector.
		expect(sideChip(container, "YES")?.textContent?.trim()).toBe("YES @ 38%");
		expect(sideChip(container, "YES")?.getAttribute("aria-label")).toBe(
			"YES side, entry price 38%",
		);
	});
});

describe("BookmarkCard — PD-0-10, the marker gains its missing aria-label", () => {
	it("flipped-marker-announces-itself", () => {
		const { container } = render(
			<BookmarkCard item={liveItem("YES", "Flipped")} />,
		);
		const marker = [...container.querySelectorAll('[data-slot="badge"]')].find(
			(el) => el.textContent?.trim() === "Flipped",
		);
		expect(marker).toBeTruthy();
		// The hand-rolled `<Badge variant="outline">{marker}</Badge>` had none.
		expect(marker?.getAttribute("aria-label")).toBe("Author Flipped");
	});

	it("none-marker-still-renders-nothing", () => {
		const { container } = render(<BookmarkCard item={liveItem("YES")} />);
		const labels = [...container.querySelectorAll('[data-slot="badge"]')].map(
			(el) => el.textContent?.trim(),
		);
		expect(labels).not.toContain("none");
	});
});

describe("BookmarkCard — the removed variant keeps its slot and leaks no body", () => {
	it("removed-renders-chip-stub-and-author-but-no-body", () => {
		const { container } = render(<BookmarkCard item={removedItem("NO")} />);

		// The row keeps its slot: side chip + author head + the active icon.
		const chip = sideChip(container, "NO");
		expect(classTokens(chip)).toContain("bg-no");
		expect(container.textContent).toContain("tidal-knight-88");
		expect(container.querySelector("button")).not.toBeNull();
		expect(container.textContent).toContain(REMOVED_STUB_TEXT);

		// SC-1: assert the BODY's absence, not the row's. The removed union
		// carries no body/title field at all, so this is belt over a
		// compile-enforced property.
		expect(container.innerHTML).not.toContain(BODY);
		expect(container.textContent).not.toContain("A bookmarked argument");
	});

	it("removed-side-chip-is-pole-bound-too", () => {
		const { container } = render(<BookmarkCard item={removedItem("YES")} />);
		const cls = classTokens(sideChip(container, "YES"));
		expect(cls).toContain("bg-yes");
		expect(cls).not.toContain("bg-primary");
	});
});

/**
 * POLISH.6 item 3 / `PD-6-03` — the ratified `profile` chip geometry, adopted at
 * BOTH call sites. Tier-4 baseline `surface_profile_v1_0.html:278-279`
 * (8.5px / 2px 7px / .08em / 800).
 *
 * ASSERTED AS THE FLATTENED CASCADE, property by property and at BOTH POLES —
 * `side-badge.test.tsx:374-392`'s shape, reused rather than re-invented. The
 * mockups are cascading CSS and this component has none, so a property the
 * modifier would inherit from its base is silently dropped unless it is written
 * out. `font-extrabold` is the sharp edge: omit it and the chip lands on
 * shadcn's `font-medium` (500) instead of the mockups' 800, which no geometry
 * assertion would catch.
 *
 * BOTH CALL SITES, deliberately. `BookmarkCard.tsx:32` is the `removed === true`
 * arm and `:46` the live arm (S-5). A live-arm-only assertion passes while a
 * removed stub still renders the default preset — precisely the split this
 * file's chip coverage exists to close.
 *
 * ⚠ These ride `sideChip()` rather than a hand-rolled selector so that item 1's
 * widening of that helper (C2, when the live chip's text becomes `YES @ 27%`)
 * carries them automatically. The removed arm never gains a price, so its chip
 * text stays the bare side literal under either predicate.
 */
const PROFILE_CHIP_TOKENS = [
	"rounded-[var(--r)]",
	"px-[7px]",
	"py-[2px]",
	"text-[8.5px]",
	"font-extrabold",
	"tracking-[0.08em]",
	"[border:var(--hairline)]",
];

describe("BookmarkCard — PD-6-03, both chips carry the profile geometry", () => {
	it("live-arm-chip-emits-the-full-flattened-profile-cascade-at-both-poles", () => {
		for (const side of ["YES", "NO"] as const) {
			const { container } = render(<BookmarkCard item={liveItem(side)} />);
			const cls = classTokens(sideChip(container, side));
			for (const token of PROFILE_CHIP_TOKENS) {
				expect(cls).toContain(token);
			}
			cleanup();
		}
	});

	it("removed-arm-chip-emits-the-full-flattened-profile-cascade-at-both-poles", () => {
		for (const side of ["YES", "NO"] as const) {
			const { container } = render(<BookmarkCard item={removedItem(side)} />);
			const cls = classTokens(sideChip(container, side));
			for (const token of PROFILE_CHIP_TOKENS) {
				expect(cls).toContain(token);
			}
			cleanup();
		}
	});

	it("neither-chip-inherits-a-shadcn-default-the-preset-must-override", () => {
		// The flattening rule's teeth, asserted as ABSENCE. `font-medium` and
		// `rounded-4xl` are the two `badgeVariants` defaults `twMerge` does NOT
		// resolve away on its own, so absence is the only way to catch them
		// (`side-badge.test.tsx:394-415`).
		for (const item of [liveItem("YES"), removedItem("YES")]) {
			const { container } = render(<BookmarkCard item={item} />);
			const cls = classTokens(sideChip(container, "YES"));
			expect(cls).not.toContain("font-medium");
			expect(cls).not.toContain("rounded-4xl");
			cleanup();
		}
	});
});
