import { expect, test } from "@playwright/test";
import world from "./.auth/world.json";

// src/app/(public)/m/[slug]/export/route.ts — GET-only, read-only file
// download, no login required.
test("exporting a debate returns a markdown file", async ({ request }) => {
	const response = await request.get(`/m/${world.marketSlug}/export`);
	expect(response.ok()).toBeTruthy();
	expect(response.headers()["content-type"]).toContain("text/markdown");
	expect(response.headers()["content-disposition"]).toContain(
		`${world.marketSlug}.md`,
	);

	const body = await response.text();
	expect(body).toContain("doc_type: zugzwang-debate-export");
	expect(body).toContain("# Debate —");
});

test("exporting an unknown market returns 404", async ({ request }) => {
	const response = await request.get("/m/does-not-exist-market/export");
	expect(response.status()).toBe(404);
});
