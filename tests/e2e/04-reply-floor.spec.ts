import { expect, test } from "@playwright/test";
import {
	BET_MIN_STAKE_POST,
	BET_MIN_STAKE_REPLY,
} from "@/server/config/limits";
import world from "./.auth/world.json";

test.use({ storageState: "tests/e2e/.auth/participant.json" });

// See 03-bet-place.spec.ts for why this strip is needed.
function stripExportedAt(markdown: string): string {
	return markdown.replace(/^exported_at:.*$/m, "exported_at: <stripped>");
}

// Floors are NOT hardcoded — imported from source so this test doesn't rot
// silently if the numbers change at a future tuning pass. Real names
// confirmed against src/server/config/limits.ts:103-107 (the v1.0 package's
// REPLY_FLOOR/POST_FLOOR names don't exist in this codebase).

// TEST 7a (E2E-1 v1.0 §6) — a reply below the reply floor is rejected.
// Same client-side gating.ts mechanism as Test 6 — assessAmount() computes
// belowFloor and folds it into submitEnabled, so this is a genuine client
// block, not a server round-trip (no moderation call needed).
test("a reply below the reply floor is rejected", async ({ page }) => {
	await page.goto(`/m/${world.marketSlug}`);

	// AggregateFooter.tsx — card-trigger-counter both enters post-focus AND
	// opens the reply composer in one click.
	await page.getByTestId("card-trigger-counter").click();

	// Countering a YES post resolves the reply to the NO side — the section's
	// aria-label follows the same "Place your Đ BET — {side}" pattern as the
	// post composer (BetComposer.tsx:424-426); "Counter X's argument" is
	// separate visible body text, not part of the accessible name.
	const composer = page.locator('[aria-label*="BET — NO"]');
	await expect(composer).toBeVisible();

	const belowFloor = String(Number(BET_MIN_STAKE_REPLY) - 1);
	await composer.getByLabel("Argument title").fill("E2E: under-floor counter.");
	await composer.getByLabel("Stake amount").fill(belowFloor);

	await expect(
		composer.getByRole("button", { name: "PLACE Đ BET" }),
	).toBeDisabled();
});

// TEST 7b (UI half) — a reply AT the floor is accepted. BLOCKED (A3,
// amendment v1.0): needs a successful submission, which needs a working
// moderation call. Same root cause as Test 5 — see that file's comment.
// Marked fixme rather than left absent, per the amendment's explicit
// definition-of-done (item 8: "Tests 5, 7b-UI, 9-position" stay blocked,
// visibly, not silently).
test("a reply at the reply floor is accepted", async ({ page }) => {
	test.fixme(
		true,
		"BLOCKED: invalid OPENAI_API_KEY in this environment — moderation fails closed by design (same root cause as Test 5)",
	);

	await page.goto(`/m/${world.marketSlug}`);
	await page.getByTestId("card-trigger-counter").click();

	const composer = page.locator('[aria-label*="BET — NO"]');
	await expect(composer).toBeVisible();

	const atFloor = String(Number(BET_MIN_STAKE_REPLY));
	await composer.getByLabel("Argument title").fill("E2E: at-floor counter.");
	await composer.getByLabel("Stake amount").fill(atFloor);
	await composer.getByRole("button", { name: "PLACE Đ BET" }).click();

	await expect(page.getByText("E2E: at-floor counter.")).toBeVisible();
});

test("the reply floor is deliberately higher than the post floor", () => {
	// The reversal is the point (v1.0 package §6, Test 7b's closing assertion) —
	// checkable without any UI at all, so it's not blocked by the moderation issue.
	expect(Number(BET_MIN_STAKE_REPLY)).toBeGreaterThan(
		Number(BET_MIN_STAKE_POST),
	);
});

// TEST 7c (amendment A2, new) — the server-side half of the reply floor.
// Same shape as Test 6b: bypasses BetComposer.tsx entirely, POSTs directly
// with a valid argument but a below-floor stake and a real parentCommentId
// (world.seedPostId — the rival's seeded YES post). Proves the floor holds
// server-side even against a request that never touched the UI.
test("server rejects a below-floor reply even bypassing the composer", async ({
	request,
}) => {
	const before = stripExportedAt(
		await (await request.get(`/m/${world.marketSlug}/export`)).text(),
	);

	const belowFloor = String(Number(BET_MIN_STAKE_REPLY) - 1);
	const response = await request.post("/api/bets/place", {
		headers: { "Idempotency-Key": `e2e-7c-${Date.now()}` },
		data: {
			marketId: world.marketId,
			side: "NO",
			stake: belowFloor,
			body: "E2E 7c: a valid argument, but the stake is below the reply floor.",
			parentCommentId: world.seedPostId,
		},
	});

	// Assert on STATE, not status code alone (V-3).
	expect(response.status()).toBeGreaterThanOrEqual(400);
	expect(response.status()).toBeLessThan(500);

	const after = stripExportedAt(
		await (await request.get(`/m/${world.marketSlug}/export`)).text(),
	);
	expect(after).toBe(before);
});
