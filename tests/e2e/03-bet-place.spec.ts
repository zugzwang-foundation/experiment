import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

test.use({ storageState: "tests/e2e/.auth/participant.json" });

// The export's `exported_at:` line is a live timestamp that legitimately
// differs between any two calls, even with zero state change — strip it
// before comparing so the comparison reflects the market content, not the
// clock.
function stripExportedAt(markdown: string): string {
	return markdown.replace(/^exported_at:.*$/m, "exported_at: <stripped>");
}

// src/components/debate/composer/BetComposer.tsx — opens when a logged-in
// visitor clicks a price-label button. Fields have no data-testid; they're
// selected by their real aria-labels ("Argument title", "Stake amount"),
// confirmed against the source.

// TEST 5 (E2E-1 v1.0 §6) — a commented bet moves the price and lands in the debate.
// BLOCKED (A3, amendment v1.0): the shared OPENAI_API_KEY in this environment
// is invalid — confirmed with a direct curl to api.openai.com/v1/moderations,
// not a code issue. Moderation fails closed by design, so no bet can commit
// until a working key is available. Marked fixme rather than left failing or
// deleted, so the block stays visible in run output instead of vanishing.
test("bet with an argument moves the price and appears in the debate", async ({
	page,
}) => {
	test.fixme(
		true,
		"BLOCKED: invalid OPENAI_API_KEY in this environment — moderation fails closed by design (confirmed via direct OpenAI API call, not a code issue)",
	);

	await page.goto(`/m/${world.marketSlug}`);
	const priceBefore = await page.getByTestId("price-label-YES").innerText();

	await page.getByTestId("price-label-YES").click();
	const composer = page.locator('[aria-label*="BET — YES"]');
	await expect(composer).toBeVisible();

	const argumentText = "E2E: a YES argument long enough to clear the floor.";
	await composer.getByLabel("Argument title").fill(argumentText);
	await composer.getByLabel("Stake amount").fill("100");
	await composer.getByRole("button", { name: "PLACE Đ BET" }).click();

	await expect
		.poll(async () => page.getByTestId("price-label-YES").innerText())
		.not.toBe(priceBefore);
	await expect(page.getByText(argumentText)).toBeVisible();
});

// TEST 6b (E2E-1 v1.0 §6 / amendment A2) — "no stake, no voice", enforced.
// THE THESIS TEST. Bypasses BetComposer.tsx entirely: a direct POST to the
// real bet endpoint, with the forged session cookie carried automatically by
// Playwright's `request` fixture (via the same storageState as the page
// fixture). Proves the rule holds even against a request that never touched
// the browser UI — built exactly the way an attacker skipping the composer
// would.
//
// The original Test 6 (checking the composer's `disabled` attribute in a
// real browser) was DROPPED at close-out (C3): now that 6b proves the server
// refuses independently, the client half earned little and coupled the test
// to composer internals the upcoming POLISH redesign is about to change.
// 6b is the test.
//
// Contract verified against src/app/api/bets/place/route.ts:
//   - body.trim().length === 0 → CommentRequiresBetError (a NAMED rejection,
//     not a generic parse failure)
//   - requires an `Idempotency-Key` header (src/server/idempotency/types.ts:
//     IDEMPOTENCY_HEADER_NAME = "Idempotency-Key", format /^[A-Za-z0-9_-]{1,255}$/)
//   - a missing Origin header is ADMITTED by checkOrigin (server-to-server
//     callers don't carry a browser Origin) — Playwright's request fixture
//     sends none, so no extra header is needed here
test("server rejects a comment-free bet even bypassing the composer", async ({
	request,
}) => {
	// The debate export (src/app/(public)/m/[slug]/export/route.ts) is a
	// read-only, no-login snapshot of the market's full state — title,
	// price, and every post. Used here as the "nothing changed" oracle: no
	// new post, no price movement reflected, byte-identical before and after.
	const before = stripExportedAt(
		await (await request.get(`/m/${world.marketSlug}/export`)).text(),
	);

	const response = await request.post("/api/bets/place", {
		headers: { "Idempotency-Key": `e2e-6b-${Date.now()}` },
		data: {
			marketId: world.marketId,
			side: "YES",
			stake: "100",
			// body deliberately omitted — the empty-argument case.
		},
	});

	// Assert on STATE, not status code alone (V-3) — a 4xx could be the
	// idempotency layer, a rate limiter, or a malformed body. The real proof
	// is that nothing changed.
	expect(response.status()).toBeGreaterThanOrEqual(400);
	expect(response.status()).toBeLessThan(500);

	const after = stripExportedAt(
		await (await request.get(`/m/${world.marketSlug}/export`)).text(),
	);
	expect(after).toBe(before);
});
