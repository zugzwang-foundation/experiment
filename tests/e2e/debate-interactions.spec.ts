import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

// src/components/debate/PriceBar.tsx + AuthGateSlot.tsx — a logged-out
// visitor who clicks YES/NO gets prompted to sign in, not a bet form.
test("clicking YES as a logged-out visitor prompts sign-in", async ({
	page,
}) => {
	await page.goto(`/m/${world.marketSlug}`);
	await page.getByTestId("price-label-YES").click();

	await expect(
		page
			.getByTestId("column-scroll")
			.getByRole("heading", { name: "Sign in to bet YES" }),
	).toBeVisible();
});

// src/components/debate/PostCard.tsx + dialogs.tsx — "Show more" opens a
// dialog with the post's full content.
test("opening a post's popup shows its content", async ({ page }) => {
	await page.goto(`/m/${world.marketSlug}`);

	await page.getByRole("button", { name: "Show more" }).first().click();

	const dialog = page.getByRole("dialog");
	await expect(dialog).toBeVisible();
	await expect(dialog).not.toBeEmpty();
});
