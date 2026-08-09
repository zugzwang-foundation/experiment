// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { REMOVED_STUB_TEXT } from "@/components/debate/placeholders";
import { ArgumentList } from "@/components/profile/ArgumentList";
import type { ProfileArgumentItem } from "@/server/profile/arguments";

/**
 * DISCOVERY-COMPLETE C4b — INV-3 on `/u/[pseudonym]`. Written and failing FIRST.
 *
 * `profile/ArgumentList.tsx:94-97` was a BYTE-IDENTICAL clone of the
 * BookmarkCard defect C4 fixes: same local function name `SideChip`, same
 * signature, same `variant={side === "YES" ? "default" : "secondary"}` — so the
 * same inversion, YES rendering near-WHITE and NO near-BLACK against a ratified
 * binding of YES = #181818 / NO = #fafafa.
 *
 * ⚠ AND THIS SURFACE IS NOT AUTH-GATED. `(public)/u/[pseudonym]/page.tsx:73-74`
 * reads the session ONLY to compute `owner` for the Sell affordance — there is
 * no `redirect`, no gate. An anonymous visitor gets the page. So of the two
 * inverted surfaces, the one the original kickoff scoped OUT is the PUBLICLY
 * REACHABLE one: `/bookmarks` requires a login to see the inversion,
 * `/u/<pseudonym>` does not. That is why founder ruling OD-4 = Option A lands
 * this commit here rather than deferring it to POLISH.5, and it is why this
 * surface — not `/bookmarks` — is the cheap browser proof of the pixel.
 *
 * The chip renders at BOTH `:49` (removed variant) and `:59` (live variant).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const AGGREGATE = {
	supportCount: 3,
	counterCount: 1,
	supportDharma: "300.000000000000000000",
	counterDharma: "100.000000000000000000",
};

const BODY = "ZZ-DISTINCTIVE-BODY-MARKER-c4b";

const liveItem = (
	side: "YES" | "NO",
	marker: "none" | "Flipped" | "Exited" = "none",
): ProfileArgumentItem => ({
	removed: false,
	kind: "post",
	id: "0190b3a0-9999-7000-8000-00000000000c",
	side,
	marketSlug: "will-x-happen",
	marketTitle: "Will X happen?",
	ordinal: 4,
	title: "A profile argument",
	teaser: "The teaser.",
	body: BODY,
	marker,
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: AGGREGATE,
});

const removedItem = (side: "YES" | "NO"): ProfileArgumentItem => ({
	removed: true,
	kind: "post",
	id: "0190b3a0-9999-7000-8000-00000000000d",
	side,
	marketSlug: "will-x-happen",
	marketTitle: "Will X happen?",
	ordinal: 5,
	createdAt: "2026-07-01T00:00:00.000Z",
	aggregate: AGGREGATE,
});

function sideChip(container: HTMLElement, side: "YES" | "NO"): Element | null {
	return (
		[...container.querySelectorAll('[data-slot="badge"]')].find(
			(el) => el.textContent?.trim() === side,
		) ?? null
	);
}

/** EXACT class tokens — `badgeVariants` ships `[a]:hover:bg-primary/80`, which
 * contains the substring "bg-primary" while being a different rule (O-3). */
const classTokens = (el: Element | null): string[] =>
	(el?.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);

describe("ArgumentList — INV-3, the side chip is pole-bound (live variant, :59)", () => {
	it("yes-chip-is-black-not-near-white", () => {
		const { container } = render(
			<ArgumentList items={[liveItem("YES")]} owner={false} />,
		);
		const cls = classTokens(sideChip(container, "YES"));
		expect(cls).toContain("bg-yes");
		expect(cls).toContain("text-no");
		expect(cls).not.toContain("bg-primary");
		expect(cls).not.toContain("bg-secondary");
	});

	it("no-chip-is-white-not-near-black", () => {
		const { container } = render(
			<ArgumentList items={[liveItem("NO")]} owner={false} />,
		);
		const cls = classTokens(sideChip(container, "NO"));
		expect(cls).toContain("bg-no");
		expect(cls).toContain("text-yes");
		expect(cls).not.toContain("bg-primary");
		expect(cls).not.toContain("bg-secondary");
	});

	it("the-chip-announces-the-side", () => {
		const { container } = render(
			<ArgumentList items={[liveItem("YES")]} owner={false} />,
		);
		expect(sideChip(container, "YES")?.getAttribute("aria-label")).toBe(
			"YES side",
		);
	});
});

describe("ArgumentList — INV-3 holds on the removed variant too (:49)", () => {
	it("removed-chip-is-pole-bound-and-leaks-no-body", () => {
		const { container } = render(
			<ArgumentList items={[removedItem("YES")]} owner={false} />,
		);
		const cls = classTokens(sideChip(container, "YES"));
		expect(cls).toContain("bg-yes");
		expect(cls).not.toContain("bg-primary");

		expect(container.textContent).toContain(REMOVED_STUB_TEXT);
		// SC-1: assert the BODY's absence, not the row's.
		expect(container.innerHTML).not.toContain(BODY);
		expect(container.textContent).not.toContain("A profile argument");
	});
});

describe("ArgumentList — PD-0-10, the marker gains its missing aria-label", () => {
	it("flipped-marker-announces-itself", () => {
		const { container } = render(
			<ArgumentList items={[liveItem("YES", "Flipped")]} owner={true} />,
		);
		const marker = [...container.querySelectorAll('[data-slot="badge"]')].find(
			(el) => el.textContent?.trim() === "Flipped",
		);
		expect(marker).toBeTruthy();
		expect(marker?.getAttribute("aria-label")).toBe("Author Flipped");
	});

	it("none-marker-renders-nothing", () => {
		const { container } = render(
			<ArgumentList items={[liveItem("YES")]} owner={true} />,
		);
		const labels = [...container.querySelectorAll('[data-slot="badge"]')].map(
			(el) => el.textContent?.trim(),
		);
		expect(labels).not.toContain("none");
	});
});
