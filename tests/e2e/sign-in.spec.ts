import { expect, test } from "@playwright/test";

// src/app/(auth)/sign-in/page.tsx — two entry points: Google, or email + OTP code.
test("sign-in page shows Google and email options", async ({ page }) => {
	await page.goto("/sign-in");

	await expect(page.getByText("Continue to Zugzwang")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Continue with Google" }),
	).toBeVisible();
	await expect(page.getByLabel("Email address")).toBeVisible();
	await expect(page.getByRole("button", { name: "Send code" })).toBeVisible();
});
