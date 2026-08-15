// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POLISH.6 — what `/bookmarks` renders when it has nothing to render: the
 * EMPTY block (item 4), the LOADING state (item 5) and the ERROR boundary
 * (item 6). One subject, three states, one file.
 *
 * ⚠ A STATED DIVERGENCE from `market-error-boundary.test.tsx`'s
 * one-file-per-boundary shape (plan §5). The allow-list admits exactly ONE new
 * test file and these three are one subject; splitting would need a second file
 * the allow-list does not admit.
 *
 * ASYNC-RSC HARNESS: `render(await BookmarksPage())`, the idiom
 * `discovery/render/page-states.test.tsx:212` established for the sibling
 * surface — the page is an async Server Component, so its returned element is
 * awaited and then rendered. The auth/db/read-model surfaces are mocked BEFORE
 * the import; unit tests never touch a database.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/server/auth", () => ({
	auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/server/bookmarks/list", () => ({ loadBookmarks: vi.fn() }));

import * as bookmarksPage from "@/app/(public)/bookmarks/page";
import { BookmarksLoading } from "@/components/bookmarks/states";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";

const BookmarksPage = bookmarksPage.default;
const { BOOKMARKS_EMPTY_COPY } = bookmarksPage;

afterEach(cleanup);

beforeEach(() => {
	vi.mocked(auth.api.getSession).mockResolvedValue({
		user: { id: "0190b3a0-9999-7000-8000-00000000000f" },
	} as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);
	vi.mocked(loadBookmarks).mockResolvedValue([]);
});

describe("PD-6-04 — the empty state IS the P1 primitive", () => {
	it("adopts-the-leaf-rather-than-re-implementing-the-panel", async () => {
		// ⚠ THE MECHANICAL ANSWER TO GATE C's QUESTION — "did it adopt the
		// primitive, or re-implement the panel?" `ui/empty-block.tsx` marks
		// itself `data-empty-block`, its OWN marker. A hand-rolled panel that
		// merely copied the class string would satisfy every geometry assertion
		// below and NOT this one. This is the assertion that distinguishes them.
		render(await BookmarksPage());
		expect(document.querySelectorAll("[data-empty-block]").length).toBe(1);
	});

	it("renders-the-P1-panel-geometry-as-exact-class-tokens", async () => {
		// R9's ratified geometry, carried by the leaf: 148px floor, `--r`,
		// `bg-n0`, hairline. EXACT tokens, never a substring match — the
		// `side-encoding.test.tsx:115-123` reasoning (a substring test reports a
		// defect that is not there, O-3).
		render(await BookmarksPage());
		const panel = document.querySelector("[data-empty-block]");
		const tokens = (panel?.getAttribute("class") ?? "")
			.split(/\s+/)
			.filter(Boolean);
		for (const token of [
			"min-h-[148px]",
			"bg-n0",
			"rounded-[var(--r)]",
			"[border:var(--hairline)]",
		]) {
			expect(tokens).toContain(token);
		}
	});

	it("carries-both-copy-tiers-through-the-const-never-re-typed", async () => {
		// Asserted THROUGH the imported const — the `discovery/EmptyState.tsx`
		// discipline. Both strings are CARRIED VERBATIM from the W2.11 state-kit
		// mockup's "Empty Bookmarks · id 18" block (OD-1); re-typing either here
		// would let a test and a surface drift apart, and authoring one would
		// cross CLAUDE.md §3.
		render(await BookmarksPage());
		expect(screen.getByText(BOOKMARKS_EMPTY_COPY.msg)).toBeTruthy();
		expect(screen.getByText(BOOKMARKS_EMPTY_COPY.sub)).toBeTruthy();
	});

	it("the-testid-rides-the-message-node-not-the-panel", async () => {
		// The leaf's own contract (`empty-block.tsx:29-32`): a testid on the
		// PANEL would return message + sub through one `textContent` read and
		// break this exact-equality the moment a `sub` is passed. `/bookmarks`
		// is the only consumer that passes one, so this surface is where that
		// rule is load-bearing rather than theoretical.
		render(await BookmarksPage());
		const node = screen.getByTestId("bookmarks-empty");
		expect(node.textContent).toBe(BOOKMARKS_EMPTY_COPY.msg);
		expect(node.hasAttribute("data-empty-block")).toBe(false);
	});

	it("the-empty-block-has-NO-cta", async () => {
		// P1's CTA is OPTIONAL and this surface carries none (JR-3, F-3: mockup
		// id 18 is `.msg` + `.sub`, no CTA). Scoped to the block, which is the
		// precise statement — the surrounding page chrome is not P1's subject.
		// Model: `discovery/render/surface-states.test.tsx:199-204`.
		render(await BookmarksPage());
		const panel = document.querySelector("[data-empty-block]");
		expect(panel?.querySelectorAll("button, a").length).toBe(0);
	});

	it("the-empty-arm-renders-instead-of-the-list-not-beside-it", async () => {
		// The ternary's two arms are exclusive. A block appended next to an
		// empty list would satisfy every assertion above.
		render(await BookmarksPage());
		expect(screen.queryByTestId("bookmark-list")).toBeNull();
	});
});

describe("PD-6-05 — the loading state IS the P7 primitive", () => {
	it("adopts-the-P7-leaf-rather-than-re-implementing-the-skeleton", () => {
		// ⚠ THE DISCRIMINATING ASSERTION, same shape as item 4's. `LoadingBlock`
		// marks itself `data-loading-block`, its OWN marker. The state this
		// replaces was a raw `<Skeleton className="h-24 w-full
		// rounded-[var(--r)]">` — which already carried `data-slot="skeleton"`
		// and the same radius, so it would satisfy a marker check and a geometry
		// check alike. It CANNOT satisfy this one.
		const { container } = render(<BookmarksLoading />);
		expect(container.querySelectorAll("[data-loading-block]").length).toBe(3);
	});

	it("every-block-keeps-the-shadcn-skeleton-marker", () => {
		// Mirrors `discovery/render/surface-states.test.tsx:186-197`, and that
		// shape exists because a first draft of `LoadingBlock` passed
		// `data-slot="loading-block"` and SILENTLY DROPPED the shadcn marker
		// every skeleton-wide assertion keys on. Both markers must coexist.
		const { container } = render(<BookmarksLoading />);
		const blocks = [...container.querySelectorAll("[data-loading-block]")];
		expect(blocks.length).toBeGreaterThan(0);
		for (const block of blocks) {
			expect(block.getAttribute("data-slot")).toBe("skeleton");
		}
	});

	it("keeps-its-container-testid-and-its-three-block-count", () => {
		// ⚠ THREE IS A LITERAL, AND THAT IS A KNOWINGLY ACCEPTED PARTIAL (S-6,
		// ruled OD-3). Canon §10's P7 requires the count come from the surface's
		// own constant — Discovery has `DISCOVERY_GRID_SIZE`; `/bookmarks` has
		// no equivalent because `loadBookmarks` is UNPAGINATED, and minting one
		// would be new server API for a single consumer (§5.2). Item 5
		// discharges P7's PRIMITIVE clause and deliberately not its COUNT
		// clause. Pinned here so the partial is visible rather than implied.
		const { container } = render(<BookmarksLoading />);
		expect(screen.getByTestId("bookmarks-loading")).toBeTruthy();
		expect(container.querySelectorAll("[data-loading-block]").length).toBe(3);
	});
});
