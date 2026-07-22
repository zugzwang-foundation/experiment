// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// UI-6 follow-up (PR #263) — the RENDERED-OUTPUT gate for the parent-snippet
// masking fix. The completeness integration test proves the READER DTO contract
// (`parent === {removed:true}`, body absent from the serialized rows); THIS test
// proves the DTO reshape is visible on screen: a removed parent renders the
// "Removed by moderator" placeholder (never its body), a live parent renders its
// snippet, and a POST (parent === null) renders NEITHER — so `null` and
// `{removed:true}` do NOT collapse to the same output (SPEC.1 §15 F-ADMIN-4).
//
// Harness precedent: tests/server/admin/terminal-actions.component.test.tsx
// (jsdom + @testing-library/react; no @testing-library/jest-dom — plain DOM
// assertions on `container.textContent`). ReviewFeed's two runtime deps are
// mocked: the "use server" `moderateComment` and `next/navigation`'s useRouter.

vi.mock("@/server/admin/moderation/act", () => ({
	moderateComment: vi.fn(async () => ({ ok: true, data: {} })),
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import {
	ReviewFeed,
	type ReviewFeedRowView,
} from "@/app/(admin)/admin/moderation/_components/ReviewFeed";

const PLACEHOLDER = "Removed by moderator";
const SNIPPET_ARROW = "↳";

function makeRow(overrides: Partial<ReviewFeedRowView>): ReviewFeedRowView {
	return {
		id: "00000000-0000-0000-0000-000000000001",
		kind: "reply",
		parent: null,
		marketSlug: "a-market",
		marketStatus: "Open",
		side: "YES",
		body: "default body",
		imageUrl: null,
		hasImage: false,
		authorPseudonym: "SomeAuthor001",
		authorDharma: "100",
		authorBanned: false,
		priorFlagCount: 0,
		createdAt: "2026-06-10T00:00:01.000Z",
		categoryScores: [],
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});
afterEach(cleanup);

describe("ReviewFeed — parent-masking rendered output (PR #263)", () => {
	it("review-feed-render::removed-parent-shows-placeholder", () => {
		const { container } = render(
			<ReviewFeed
				rows={[
					makeRow({
						id: "00000000-0000-0000-0000-0000000000aa",
						kind: "reply",
						parent: { removed: true },
						body: "MY OWN REPLY BODY — must survive.",
					}),
				]}
			/>,
		);
		// (1) A removed parent renders the placeholder — NOT its body.
		expect(container.textContent).toContain(PLACEHOLDER);
	});

	it("review-feed-render::removed-parent-row-keeps-its-own-body (thread intact)", () => {
		const OWN_BODY = "MY OWN REPLY BODY — must survive.";
		const { container } = render(
			<ReviewFeed
				rows={[
					makeRow({
						id: "00000000-0000-0000-0000-0000000000bb",
						kind: "reply",
						parent: { removed: true },
						body: OWN_BODY,
					}),
				]}
			/>,
		);
		// (2) The reply still renders its OWN body — thread intact (SPEC.1 §15
		// F-ADMIN-4: the child is live content).
		expect(container.textContent).toContain(OWN_BODY);
		expect(container.textContent).toContain(PLACEHOLDER);
	});

	it("review-feed-render::live-parent-shows-snippet", () => {
		const SNIPPET = "the parent argument, collapsed";
		const { container } = render(
			<ReviewFeed
				rows={[
					makeRow({
						id: "00000000-0000-0000-0000-0000000000cc",
						kind: "reply",
						parent: { removed: false, snippet: SNIPPET },
						body: "child reply body",
					}),
				]}
			/>,
		);
		// (3) A live parent renders its snippet, never the placeholder.
		expect(container.textContent).toContain(SNIPPET);
		expect(container.textContent).not.toContain(PLACEHOLDER);
	});

	it("review-feed-render::post-null-parent-renders-neither-snippet-nor-placeholder", () => {
		const { container } = render(
			<ReviewFeed
				rows={[
					makeRow({
						id: "00000000-0000-0000-0000-0000000000dd",
						kind: "post",
						parent: null,
						body: "top-level post body",
					}),
				]}
			/>,
		);
		// (4) THE ONE THAT MATTERS: a post (parent === null) renders NEITHER the
		// placeholder NOR a parent-snippet block — so `null` and `{removed:true}`
		// do NOT collapse to the same on-screen output. The `↳` arrow prefixes
		// BOTH parent variants and is absent for a post.
		expect(container.textContent).not.toContain(PLACEHOLDER);
		expect(container.textContent).not.toContain(SNIPPET_ARROW);
		// The post's own body still renders.
		expect(container.textContent).toContain("top-level post body");
	});
});
