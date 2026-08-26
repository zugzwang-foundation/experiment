import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

// src/app/(public)/u/[pseudonym]/page.tsx
test("profile page shows the correct pseudonym", async ({ page }) => {
	await page.goto(`/u/${world.participantPseudonym}`);
	await expect(page.getByTestId("identity-pseudonym")).toHaveText(
		world.participantPseudonym,
	);
});

test("unknown pseudonym shows a 404", async ({ page }) => {
	await page.goto("/u/DoesNotExist999");
	await expect(page.getByTestId("public-not-found")).toBeVisible();
	await expect(page.getByRole("heading", { name: "Not found." })).toBeVisible();
});

test.describe("as the seeded participant", () => {
	test.use({ storageState: "tests/e2e/.auth/participant.json" });

	// TEST 9 (position half) — BLOCKED (A3, amendment v1.0): needs Test 5's
	// bet to have actually succeeded first, which needs a working moderation
	// call. Same root cause as Test 5 / 7b-UI.
	// src/components/profile/PositionsTable.tsx row selector confirmed:
	// data-testid={`position-row-${marketId}`}.
	test("profile shows the new position after a bet", async ({ page }) => {
		test.fixme(
			true,
			"BLOCKED: invalid OPENAI_API_KEY in this environment — moderation fails closed by design, so Test 5's bet never lands (same root cause as Test 5 / 7b-UI)",
		);

		await page.goto(`/u/${world.participantPseudonym}`);
		await expect(
			page.getByTestId(`position-row-${world.marketId}`),
		).toBeVisible();
	});
});
