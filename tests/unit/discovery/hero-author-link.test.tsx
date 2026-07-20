// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroPanels } from "@/components/discovery/HeroPanels";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";

/**
 * UI.A5 Slice 8 (plan §2 row 8 / §1c) — A4 follow-up #2, seam 1: the
 * hero-post author pseudonym activates from the NON-linked v1 `<span>`
 * (OQ-4 A) to a next/link onto the SPEC.1 §23 profile route
 * `/u/[pseudonym]`, keyed `hero-author-link-<side>` — a SIBLING of the
 * existing `/m/[slug]?post=N` card-body deep-link, never nested (no
 * anchor-in-anchor). A masked/absent side keeps the existing
 * `hero-side-empty` behaviour: no author ever renders, so no dead `/u/`
 * link can exist. §14 fence: ONLY this seam + the identity chip + W2.10-C
 * activate — debate-view card-head author links stay a named follow-up.
 * Fixtures are inline minimal-valid values with neutral labels — never
 * invented market content (CLAUDE.md §3).
 */

afterEach(cleanup);

const AUTHOR_PSEUDONYM = "RedFox001";

const CARD: DiscoveryCard = {
	id: "0190b3a0-0000-7000-8000-000000000001",
	slug: "discovery-market",
	title: "Discovery Market",
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	totals: {
		dharmaStaked: "40.000000000000000000",
		postCount: 1,
		replyCount: 0,
	},
	imageUrl: null,
};

const YES_POST: HeroPost = {
	id: "0190b3a0-0000-7000-8000-00000000000a",
	ordinal: 1,
	side: "YES",
	title: "Hero argument",
	teaser: "",
	author: { pseudonym: AUTHOR_PSEUDONYM, pfpUrl: "/pfp-placeholder.svg" },
	authorStake: "40.000000000000000000",
	createdAt: "2026-07-01T00:00:00.000Z",
};

function renderHero(topPosts: HeroTopPosts) {
	return render(<HeroPanels card={CARD} series={[]} topPosts={topPosts} />);
}

describe("UI.A5 §2 row 8 — hero author → /u/[pseudonym] (A4 follow-up #2)", () => {
	it("hero-author-links-to-profile", () => {
		renderHero({ yes: YES_POST, no: null });
		const link = screen.getByTestId("hero-author-link-YES");
		// The activation: a real anchor onto the §23 profile route.
		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe(`/u/${AUTHOR_PSEUDONYM}`);
		expect(link.textContent).toBe(AUTHOR_PSEUDONYM);
		// SIBLING of the /m/[slug]?post= card-body Link — never nested: no
		// anchor ancestor above the author link itself.
		expect(link.parentElement?.closest("a") ?? null).toBeNull();
	});

	it("masked-side-no-author-no-dead-link", () => {
		renderHero({ yes: YES_POST, no: null });
		// The absent/masked NO side renders the existing empty panel…
		const empty = screen.getByTestId("hero-side-empty");
		expect(empty.getAttribute("data-side")).toBe("NO");
		// …and no author link exists for it: no NO-side testid, and no anchor
		// of ANY kind inside the empty panel (a removed hero post's author
		// never renders, so a dead /u/ link cannot).
		expect(screen.queryByTestId("hero-author-link-NO")).toBeNull();
		expect(empty.querySelector("a")).toBeNull();
	});
});
