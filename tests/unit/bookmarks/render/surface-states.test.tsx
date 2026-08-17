// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
/**
 * ⚠⚠ HTML-FINISH · BOOKMARKS round 3 — THE TOP BAND'S FOUR READS ARE MOCKED,
 * and the reason is the recorded failure mode rather than convenience. `@/db` is
 * mocked above as the bare object `{}`; the moment the page began calling
 * `resolveProfileUser` / `loadProfilePositions` / `loadProfileTiles` /
 * `loadProfileGraphSeries`, every test in this file died on
 * `client.select is not a function` — a real defect in the MOCK, reported by six
 * assertions that have nothing to do with the top band.
 * ⛔ MOCK THE READ MODELS, NOT `db.select`. Shimming `select` onto the fake `db`
 * would make these tests depend on the internal query shape of four modules this
 * file does not test, and would break again on the next query they add. The
 * read-model boundary is the one this suite already mocks (`loadBookmarks`).
 * ⚠ The fixtures are the EMPTY/zero arms — this file tests the empty, loading
 * and error states, so the band must render without asserting anything about it.
 */
vi.mock("@/server/profile/resolve", () => ({ resolveProfileUser: vi.fn() }));
vi.mock("@/server/profile/positions", () => ({
	loadProfilePositions: vi.fn(),
}));
vi.mock("@/server/profile/tiles", () => ({ loadProfileTiles: vi.fn() }));
vi.mock("@/server/profile/graph-series", () => ({
	loadProfileGraphSeries: vi.fn(),
}));

import BookmarksRouteError from "@/app/(public)/bookmarks/error";
import * as bookmarksPage from "@/app/(public)/bookmarks/page";
import { BookmarksLoading } from "@/components/bookmarks/states";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { auth } from "@/server/auth";
import { loadBookmarks } from "@/server/bookmarks/list";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

const BookmarksPage = bookmarksPage.default;
const { BOOKMARKS_EMPTY_COPY } = bookmarksPage;

afterEach(cleanup);

beforeEach(() => {
	vi.mocked(auth.api.getSession).mockResolvedValue({
		user: { id: "0190b3a0-9999-7000-8000-00000000000f" },
	} as unknown as Awaited<ReturnType<typeof auth.api.getSession>>);
	vi.mocked(loadBookmarks).mockResolvedValue([]);
	vi.mocked(resolveProfileUser).mockResolvedValue({
		id: "0190b3a0-9999-7000-8000-00000000000f",
		pseudonym: "RedFox001",
		banned: false,
		pfpUrl: "/pfp-placeholder.svg",
	});
	vi.mocked(loadProfilePositions).mockResolvedValue([]);
	vi.mocked(loadProfileTiles).mockResolvedValue({
		walletValue: "0.000000000000000000",
		positionsValue: "0.000000000000000000",
		netProfitLoss: "0.000000000000000000",
		argumentsCount: { total: 0, posts: 0, replies: 0 },
		supportReceived: "0.000000000000000000",
		counterReceived: "0.000000000000000000",
	});
	vi.mocked(loadProfileGraphSeries).mockResolvedValue({
		windowStart: "2026-09-15T00:00:00.000Z",
		windowEnd: "2026-11-05T23:59:00.000Z",
		netWorth: [],
		freeDharma: [],
		perMarket: [],
		nodes: [],
		yMax: 0,
		markets: [],
	} as unknown as Awaited<ReturnType<typeof loadProfileGraphSeries>>);
});

describe("PD-6-04 — the empty state IS the P1 primitive", () => {
	it("adopts-the-leaf-rather-than-re-implementing-the-panel", async () => {
		// ⚠ THE MECHANICAL ANSWER TO GATE C's QUESTION — "did it adopt the
		// primitive, or re-implement the panel?" `ui/empty-block.tsx` marks
		// itself `data-empty-block`, its OWN marker. A hand-rolled panel that
		// merely copied the class string would satisfy every geometry assertion
		// below and NOT this one. This is the assertion that distinguishes them.
		//
		// ⚠⚠ RE-DERIVED AT HTML-FINISH · BOOKMARKS round 3, AND NOT WEAKENED. This
		// counted `data-empty-block` DOCUMENT-WIDE and expected exactly 1. Round 3
		// puts Profile's graph slot on this route, and `ProfileGraphCard` renders
		// its OWN P1 block when there is nothing to plot — so an account with no
		// bookmarks AND no plottable history now carries TWO, legitimately. The
		// document-wide count was never the property; it was a proxy for it.
		// ⇒ THE PROPERTY, STATED DIRECTLY: the block that carries this surface's
		// empty MESSAGE is itself the primitive. A copied class string still
		// fails, which is the whole point of the assertion.
		render(await BookmarksPage());
		const panel = screen
			.getByTestId("bookmarks-empty")
			.closest("[data-empty-block]");
		expect(
			panel,
			"the bookmarks empty message is not inside a `data-empty-block` — the " +
				"panel was re-implemented rather than adopted.",
		).not.toBeNull();
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

/**
 * PD-6-06 — the route error boundary adopts the ROUTE-BOUNDARY FAMILY by
 * importing `ui/error-block.tsx` (JR-1 + JR-5, variant B′).
 *
 * PRIMARY MODEL: `tests/unit/debate/render/market-error-boundary.test.tsx` —
 * the default export imported directly, its four load-bearing shapes reused.
 * ⚠ ABSENCE assertions are CONTAINER-WIDE and PRESENCE assertions are TARGETED,
 * that file's `:20-35` rule.
 */
const THROWN = {
	message: "ZZ-DISTINCTIVE-THROWN-MESSAGE-c5",
	digest: "ZZ-DISTINCTIVE-DIGEST-c5",
	stack: "ZZ-DISTINCTIVE-STACK-c5",
	cause: "ZZ-DISTINCTIVE-CAUSE-c5",
};

/** A thrown error carrying a distinctive marker in every field a leak could
 *  travel through. */
const thrown = (): Error & { digest?: string } =>
	Object.assign(new Error(THROWN.message), THROWN);

/** This surface's own body string, carried under B′ — the sentence split of the
 *  live `states.tsx` line at its sentence boundary, with the trailing action
 *  phrase routed to `actionLabel`. Never authored. */
const BOOKMARKS_ERROR_BODY = "Couldn't load your bookmarks.";

describe("PD-6-06 — the error boundary IS the route-boundary family block", () => {
	it("adopts-the-leaf-rather-than-re-implementing-the-family", () => {
		// ⚠ THE DISCRIMINATING ASSERTION, third of three. `ui/error-block.tsx`
		// marks itself `data-error-block`, its OWN marker. An inline byte-copy
		// of the family treatment — which is exactly what v1.3 of the plan ruled
		// before the leaf existed — would satisfy every copy and class assertion
		// below and FAIL this one.
		const { container } = render(
			<BookmarksRouteError error={thrown()} reset={vi.fn()} />,
		);
		expect(container.querySelectorAll("[data-error-block]").length).toBe(1);
	});

	it("renders-the-family-generic-heading-and-action-label", () => {
		// Both are byte-copies carried by the leaf: the heading is its internal
		// module const, and `Try again` is byte-identical to the family's own
		// label at the debate boundary. The HEADING and the BUTTON go generic —
		// that is the family ruling — while the BODY does not.
		const { container } = render(
			<BookmarksRouteError error={thrown()} reset={vi.fn()} />,
		);
		expect(container.querySelector("h1")?.textContent).toBe(
			"Something went wrong.",
		);
		expect(container.querySelector("button")?.textContent).toBe("Try again");
	});

	it("the-body-carries-THIS-surfaces-string-never-the-family-generic", () => {
		// B′ — OD-4 removed the tier that could hold a surface string; JR-5 gives
		// the tier back. Two of the four boundaries carry a surface line and two
		// do not, and that divergence falls on a principled line: surfaces with a
		// carried string vs surfaces without.
		const { container } = render(
			<BookmarksRouteError error={thrown()} reset={vi.fn()} />,
		);
		expect(screen.getByTestId("bookmarks-error").textContent).toBe(
			BOOKMARKS_ERROR_BODY,
		);
		// ⛔ And NOT the debate boundary's generic paragraph.
		expect(container.innerHTML).not.toContain(
			"An unexpected error stopped this page from loading.",
		);
		// ⛔ Nor the dropped trailing phrase — the split is a sentence split, and
		// `Tap to retry.` is deleted rather than relocated.
		expect(container.innerHTML).not.toContain("Tap to retry");
	});

	it("the-testid-rides-the-body-node-beside-the-button-never-the-container", () => {
		// OD-7 = BESIDE. The marked subtree EXCLUDES the button and the h1 — the
		// debate boundary marks its CONTAINER instead, and copying that placement
		// would put the button's label inside the marked subtree and break the
		// exact-equality above the moment anyone read `textContent`.
		render(<BookmarksRouteError error={thrown()} reset={vi.fn()} />);
		const body = screen.getByTestId("bookmarks-error");
		expect(body.tagName).toBe("P");
		expect(body.querySelector("button")).toBeNull();
		expect(body.querySelector("h1")).toBeNull();
	});

	it("the-action-invokes-reset-exactly-once", () => {
		// A segment re-render, never a full document reload. The whole-panel
		// button this replaces DID work; it simply had no affordance.
		const reset = vi.fn();
		render(<BookmarksRouteError error={thrown()} reset={reset} />);
		fireEvent.click(screen.getByText("Try again"));
		expect(reset).toHaveBeenCalledTimes(1);
	});

	it("nothing-from-the-error-object-reaches-the-DOM", () => {
		// CONTAINER-WIDE absence, every field a leak could travel through.
		const { container } = render(
			<BookmarksRouteError error={thrown()} reset={vi.fn()} />,
		);
		for (const marker of Object.values(THROWN)) {
			expect(container.innerHTML).not.toContain(marker);
		}
	});

	it("the-component-binds-no-reference-to-the-error-prop", () => {
		// THE STRUCTURAL PIN. Behavioural probes cannot prove a NEGATIVE about
		// code that is not there; this reads the source and proves no binding
		// EXISTS to render by accident (CLAUDE.md §8 O-1 — structural, not a rule
		// someone has to remember). Source-reading is an established idiom here.
		const source = readFileSync(
			join(process.cwd(), "src/app/(public)/bookmarks/error.tsx"),
			"utf8",
		);
		// Strip comments first: the docblock discusses the error prop in prose and
		// a naive scan would read that as a binding.
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^[ \t]*\/\/.*$/gm, "");

		const sig = code.match(
			/export default function BookmarksRouteError\(([\s\S]*?)\)\s*:/,
		);
		expect(sig, "component signature is findable").not.toBeNull();
		const [pattern = "", types = ""] = (sig?.[1] ?? "").split(/\}\s*:\s*\{/);

		// The DESTRUCTURING PATTERN binds `reset`, and nothing else.
		expect(pattern.replace(/[{}\s,]/g, "")).toBe("reset");
		// POSITIVE CONTROL: the prop IS still declared in the type — Next's
		// contract passes it — so this is not passing because the signature
		// vanished, and the matcher demonstrably finds the word when present.
		expect(types).toMatch(/\berror\b/);
	});
});

describe("GATE C F-1 — `Bookmarks` renders exactly once", () => {
	/**
	 * ⚠⚠ RECOVERED FROM `bookmarks-parity-r1-archive`, NOT RE-WRITTEN. Round 2
	 * caught this exact defect and wrote this exact assertion
	 * (`tests/unit/bookmarks/render/arrangement.test.tsx:189` on that branch);
	 * the guard was discarded with round 2's code, and the defect came straight
	 * back with round 3's replication. Its answer was correct then and is the
	 * ruling now, so the predicate is carried verbatim rather than re-derived —
	 * a re-derivation would be a second chance to get it wrong.
	 *
	 * ⚠ IT COUNTS LEAF TEXT NODES, and that is what makes it work. An ancestor's
	 * `textContent` concatenates its descendants', so `container.textContent`
	 * would match on any wrapper containing the word and a whole-tree
	 * `getAllByText` would be defeated by nesting. `children.length === 0`
	 * restricts the count to elements that OWN the string.
	 */
	it("f1::the-word-renders-once-and-the-survivor-is-the-h1", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		const { container } = render(await BookmarksPage());
		const exact = [...container.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === "Bookmarks",
		);
		expect(
			exact.length,
			`F-1: "Bookmarks" renders ${exact.length} times. The page-level header ` +
				`row is REMOVED and the panel head carries the only one.`,
		).toBe(1);
		expect(exact[0]?.tagName).toBe("H1");
		expect(
			screen.getByTestId("bookmarks-panel-head").contains(exact[0] as Node),
		).toBe(true);
	});

	it("f1::the-heading-keeps-the-PANEL-TITLE-classes-so-nothing-moves", async () => {
		// The element changed from `<span>` to `<h1>`; the class string did not.
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		render(await BookmarksPage());
		const h1 = screen.getByTestId("bookmarks-panel-head").querySelector("h1");
		expect(h1?.className.split(/\s+/)).toEqual([
			"text-xs",
			"font-medium",
			"text-ink",
		]);
	});

	it("f1::no-page-level-header-row-survives-above-the-panel", async () => {
		// ⛔ A COPY IS THE DEFECT. The heading must not exist outside the panel.
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		const { container } = render(await BookmarksPage());
		const headings = [...container.querySelectorAll("h1")];
		expect(headings.length).toBe(1);
		const head = screen.getByTestId("bookmarks-panel-head");
		expect(head.contains(headings[0] as Node)).toBe(true);
	});

	it("f1::the-view-chip-still-renders-exactly-once-pending-the-ruling", async () => {
		// ⚠ The chip is SHIPPED WHERE IT WAS relative to the title, not resolved.
		// The two-chip question (this vs IdentityCard's "Viewing as owner") is the
		// founder's; this only pins that moving it did not duplicate or drop it.
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		const { container } = render(await BookmarksPage());
		const chips = [...container.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === "Your bookmarks",
		);
		expect(chips.length).toBe(1);
		expect(
			screen.getByTestId("bookmarks-panel-head").contains(chips[0] as Node),
		).toBe(true);
	});

	it("f1::POSITIVE-CONTROL-the-leaf-predicate-catches-a-duplicate", () => {
		// ⚠ PROOF BY REVERSAL, and it also proves the predicate is not fooled by
		// an ancestor: the wrapper's textContent is "Bookmarks" too, but it has
		// children, so only the two LEAVES are counted.
		const { container } = render(
			<div>
				<h1>Bookmarks</h1>
				<span>Bookmarks</span>
			</div>,
		);
		const exact = [...container.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === "Bookmarks",
		);
		expect(exact.length).toBe(2);
	});
});

describe("ROUND 5 — one chip on /bookmarks, and Profile keeps its own", () => {
	/**
	 * ⚠ LEAF TEXT NODES, as the F-1 guard does. An ancestor's `textContent`
	 * concatenates its descendants', so a whole-tree sweep matches on any wrapper
	 * containing the words and cannot tell one chip from two.
	 */
	const leaves = (root: ParentNode, text: string) =>
		[...root.querySelectorAll("*")].filter(
			(el) => el.children.length === 0 && el.textContent === text,
		);

	it("chip::`Your bookmarks` renders exactly ONCE on the surface", async () => {
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		const { container } = render(await BookmarksPage());
		const hits = leaves(container, "Your bookmarks");
		expect(
			hits.length,
			`round 5: "Your bookmarks" renders ${hits.length} times; it is the ` +
				`surface's ONLY chip and lives in the panel head.`,
		).toBe(1);
		expect(
			screen.getByTestId("bookmarks-panel-head").contains(hits[0] as Node),
		).toBe(true);
	});

	it("chip::`Viewing as owner` renders ZERO times on the surface", async () => {
		// ⛔ THE FOUNDER'S RULING. The identity card is still mounted with
		// `owner={true}` — the viewer IS the owner — but its view chip is
		// suppressed, so the surface no longer says the same thing twice in two
		// different wordings.
		vi.mocked(loadBookmarks).mockResolvedValue([]);
		const { container } = render(await BookmarksPage());
		expect(leaves(container, "Viewing as owner").length).toBe(0);
		// …and the suppression is the CHIP, not the card: the identity card is
		// still there, with its pseudonym.
		expect(screen.getByTestId("identity-card")).toBeTruthy();
		expect(screen.getByTestId("identity-pseudonym").textContent).toBe(
			"RedFox001",
		);
		// …and the chip's testid is gone, not merely re-worded.
		expect(screen.queryByTestId("profile-chip")).toBeNull();
	});

	it("chip::the identity BLOCK carries no view chip on either surface", async () => {
		// ⚠⚠ RE-POINTED AT PROFILE-FULL, AND THE INVERSION IS THE POINT. This used
		// to assert that `IdentityCard` still rendered the chip by DEFAULT, because
		// the chip lived in the identity block and only `/bookmarks` suppressed it.
		// The chip has now left that block on BOTH surfaces — the mockup carries it
		// as a head control (`.viewchip`, `:425`), and as a body chip it cost the
		// identity band 24px of the 188 it had to reach. So the assertion flips:
		// the block renders NO chip, for any viewer, on any surface.
		// ⛔ WHERE THE CHIP WENT IS ASSERTED WHERE IT LANDED, not here — Profile's
		// `surface.test.tsx` reads it out of the positions panel head, and the
		// `bookmarks-view-chip` case above reads it out of the bookmarks head. This
		// file owns only the claim that it is no longer in the identity block.
		const { container } = render(
			<IdentityCard
				user={{
					id: "0190b3a0-9999-7000-8000-00000000000f",
					pseudonym: "RedFox001",
					banned: false,
					pfpUrl: "/pfp-placeholder.svg",
				}}
				owner={true}
				tiles={{
					walletValue: "0.000000000000000000",
					positionsValue: "0.000000000000000000",
					netProfitLoss: "0.000000000000000000",
					argumentsCount: { total: 0, posts: 0, replies: 0 },
					supportReceived: "0.000000000000000000",
					counterReceived: "0.000000000000000000",
				}}
			/>,
		);
		expect(leaves(container, "Viewing as owner").length).toBe(0);
		expect(screen.queryByTestId("profile-chip")).toBeNull();
		// …and NOTHING ELSE left with it: the block still holds the pseudonym, the
		// avatar and the six tiles.
		expect(screen.getByTestId("identity-pseudonym").textContent).toBe(
			"RedFox001",
		);
		expect(container.querySelector("img")).not.toBeNull();
		expect(screen.getByTestId("profile-tiles")).toBeTruthy();
	});

	it("chip::the-badges-are-untouched-by-the-chip-s-departure", async () => {
		// ⛔ THE FENCE, ASSERTED. A banned + scrubbed user still gets BOTH badges.
		// They moved into the pseudonym ROW when the chip left (a second line costs
		// the 188 band ~24px for every viewer, while these two are rare), and their
		// wrapper is now CONDITIONAL — so this also proves the wrapper still appears
		// when it has something to hold.
		const { container } = render(
			<IdentityCard
				user={{
					id: "0190b3a0-9999-7000-8000-00000000000f",
					pseudonym: "[scrubbed_user_4729]",
					banned: true,
					pfpUrl: "/pfp-placeholder.svg",
				}}
				owner={true}
				tiles={{
					walletValue: "0.000000000000000000",
					positionsValue: "0.000000000000000000",
					netProfitLoss: "0.000000000000000000",
					argumentsCount: { total: 0, posts: 0, replies: 0 },
					supportReceived: "0.000000000000000000",
					counterReceived: "0.000000000000000000",
				}}
			/>,
		);
		expect(leaves(container, "Viewing as owner").length).toBe(0);
		expect(screen.getByTestId("identity-banned")).toBeTruthy();
		expect(screen.getByTestId("identity-scrubbed")).toBeTruthy();
		expect(screen.getByTestId("identity-pseudonym")).toBeTruthy();
		expect(container.querySelector("img")).not.toBeNull();
	});
});
