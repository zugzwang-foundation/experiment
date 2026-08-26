import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

// TEST 3 (E2E-1 v1.0 §6) — a card opens ITS market, not just any market.
// MarketCard.tsx renders <Link href={`/m/${card.slug}`} data-testid="market-card">
// on the SAME element, so the slug is selectable via the href, not a
// data-market-slug attribute (the v1.0 package's guess — no such attribute
// exists in the actual component).
test("card click opens the correct market", async ({ page }) => {
	await page.goto("/");

	const card = page.locator(
		`[data-testid="market-card"][href*="/m/${world.marketSlug}"]`,
	);
	const title = (await card.locator("h3").innerText()).trim();
	await card.click();

	await expect(page).toHaveURL(new RegExp(`/m/${world.marketSlug}`));
	await expect(page.getByTestId("headzone")).toBeVisible();
	await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
	await expect(page.getByTestId("arena")).toBeVisible();
});

// TEST 4 — both sides render and a price is present.
// PriceBar.tsx's price-label-YES/NO buttons are only interactive (real
// role="button", data-testid present) when rendered with a `pick` handler —
// true on the market header, false on Discovery cards (format.ts:337-343:
// NO is always 100 − YES, never its own stored value — confirmed here by
// asserting the pair sums to 100, not just that both render).
test("market detail shows both sides and a price that sums to 100", async ({
	page,
}) => {
	await page.goto(`/m/${world.marketSlug}`);

	const yesLabel = page.getByTestId("price-label-YES");
	const noLabel = page.getByTestId("price-label-NO");
	await expect(yesLabel).toBeVisible();
	await expect(noLabel).toBeVisible();

	const yesText = await yesLabel.innerText();
	const noText = await noLabel.innerText();
	const yesPct = Number(yesText.match(/(\d+)%/)?.[1]);
	const noPct = Number(noText.match(/(\d+)%/)?.[1]);

	expect(Number.isNaN(yesPct)).toBe(false);
	expect(Number.isNaN(noPct)).toBe(false);
	expect(yesPct + noPct).toBe(100);
});
