import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

// TEST 1 (E2E-1 v1.0 §6) — Discovery renders the seeded markets.
// src/components/discovery/MarketCard.tsx — every card carries
// data-testid="market-card".
test("discovery lists market cards", async ({ page }) => {
	await page.goto("/");

	const cards = page.getByTestId("market-card");
	await expect(cards.first()).toBeVisible();
	expect(await cards.count()).toBeGreaterThan(0);
});

// The v1.0 package's original Test 2 ("ranking modes reorder the list") is
// deliberately NOT implemented — checked against the live code and confirmed
// the feature doesn't exist (no mode-selector control anywhere, and
// listOpenMarkets() takes no mode parameter). Per the amendment (A1), that
// was the package's own error, twice over: the selector was deliberately
// retired (ADR-0017 Patch P3 — "There is no mode selector in v1"), and
// ranking modes were a debate-view concept that Discovery never had.

// TEST 2 (amendment A1, replaces the retired one) — Discovery is
// capital-neutral. SPEC.1: the featured-set selection "orders by
// recency — deliberately not by stake, volume, or activity... the front-door
// selection is capital-neutral." This is a thesis rule at the entry surface
// (K·n > C, enforced at the front door) that had never been checked.
//
// Seeded world (generate-local-world.vitest.ts): markets A, B, C created in
// that strict sequence, then a heavy stake (800 — most of a fresh user's
// entire 1000 initial balance) lands on A afterward. If Discovery ordered by
// stake instead of recency, A would jump ahead of B and C; it must not.
async function discoveryOrder(
	page: import("@playwright/test").Page,
): Promise<string[]> {
	return page
		.getByTestId("market-card")
		.evaluateAll((els) =>
			els.map((el) => el.getAttribute("href")?.replace("/m/", "") ?? ""),
		);
}

test("a heavily-staked market does not climb the front page", async ({
	page,
}) => {
	await page.goto("/");
	const order = await discoveryOrder(page);

	const indexA = order.indexOf(world.capitalNeutralMarketASlug);
	const indexB = order.indexOf(world.capitalNeutralMarketBSlug);
	expect(indexA).toBeGreaterThanOrEqual(0);
	expect(indexB).toBeGreaterThanOrEqual(0);

	// B is newer than A and was never staked — it must still render ahead of
	// A, matching created_at DESC, not stake DESC.
	expect(indexB).toBeLessThan(indexA);
});

// POSITIVE CONTROL (V-2, non-optional per the amendment) — without this,
// the test above passes on a Discovery page that renders nothing at all.
// C is the newest market of the whole seeded world and was never staked —
// it must lead the page.
test("the newest market takes the leading slot", async ({ page }) => {
	await page.goto("/");
	const order = await discoveryOrder(page);

	expect(order[0]).toBe(world.capitalNeutralMarketCSlug);
});
