// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ⛔⛔ MOCKED, NOT SPIED — a joint @code-reviewer/@security-auditor finding
// (post-S6) is what makes this necessary at all: an unknown market slug used
// to throw straight through `render()`, which the "an-unknown-market-slug"
// tests below asserted directly. It now degrades instead (captures once,
// renders nothing) — see `ResolverCards.tsx`'s own docblock at the top of its
// function body for why an uncaught throw here took the WHOLE `/m/[slug]`
// route down, unauthenticated-GET-triggerable, for a failure mode that only
// needs one market's row to degrade.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { captureException } from "@sentry/nextjs";
import { ResolverCards } from "@/components/debate/ResolverCards";
import { RESOLUTION_BLOCKS } from "@/components/debate/resolution-block-data";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * RESO-1 · R-7 / R-8 / R-12, reversed in part by BLOCK-1 — the resolution
 * block row.
 *
 * ⚠⚠ THIS FILE'S SUBJECT HAS NOW BEEN REVERSED FOUR TIMES; superseded
 * versions are recorded here rather than swapped out (O-4).
 *   v1 asserted `expect(container.innerHTML).toBe("")` — empty card shells
 *      reproduced `PD-3-09` / `OD-6`.
 *   v2 (founder ruling 2026-08-16) required VISIBLE PLACEHOLDER CHROME: two
 *      cards, the byte-carried labels `LOGO`, `Resolver`, `X`, `X — official`.
 *   v3 — RESO-1 — FOUR blocks from one fixture, `toHaveLength(2)` → 4.
 *   v4 — BLOCK-1 — is this file. **THE HALF THAT HAD NEVER REVERSED THROUGH
 *   THREE ROUNDS NOW DOES, DELIBERATELY, IN PLACE.** v1→v3 all pinned the data
 *   fields EMPTY: "`markets` carries no resolver name, logo, source or X
 *   handle... those four strings are pinned as absent." BLOCK-1 fills value
 *   and subvalue with real, operator-ratified per-slug content (a static map,
 *   not a migration — `markets` is still 11 columns) and makes the RESOLVER
 *   block a real link. This file's job is now the OPPOSITE of v1-v3's on that
 *   one point: prove the values are NEVER empty for a known market, prove
 *   RESOLVER is the only interactive block, and prove no market's `title` /
 *   `description` / `slug` ever leaks into the row regardless.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const BASE = {
	id: "0190c0de-5555-7000-8000-000000000005",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open" as const,
	mediaVideoUrl: null,
	mediaImageUrl: null,
	pricing: { yes: "0.500000000000000000", no: "0.500000000000000000" },
	unitToWin: { yes: "1.960000000000000000", no: "1.960000000000000000" },
	totals: {
		dharmaStaked: "150.000000000000000000",
		postCount: 3,
		replyCount: 5,
	},
};

/**
 * `title`/`description` stay obviously-synthetic even though `slug` is real
 * — ResolverCards reads ONLY `market.slug` for its lookup, so a fake
 * title/description alongside a real slug both exercises the real map AND
 * keeps the "no market content leaked" test meaningful (a synthetic string
 * can't accidentally coincide with real rendered content).
 */
function marketFixture(
	slug: keyof typeof RESOLUTION_BLOCKS,
): DebateMarketHeader {
	return { ...BASE, slug };
}

const KEYS = ["resolution", "resolver", "closes", "flavour"] as const;

// The primary structural fixture — chosen because it exercises every branch
// in one market: RESOLVER has both line1+line2 AND an href (2-line link),
// CLOSES has line1+line2 (no href), FLAVOUR and RESOLUTION are line1-only
// with no href.
const PRIMARY_SLUG = "bitcoin-price-50k" as const;
const PRIMARY_MARKET = marketFixture(PRIMARY_SLUG);
const PRIMARY_DATA = RESOLUTION_BLOCKS[PRIMARY_SLUG];

describe("RESO-1/BLOCK-1 — R-7, four blocks from one fixture, geometry unchanged", () => {
	it("resolver-cards::G-3-renders-EXACTLY-four-blocks", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);

		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		for (const k of KEYS) {
			expect(
				container.querySelector(`[data-testid="resolution-block-${k}"]`),
			).not.toBeNull();
		}
	});

	it("resolver-cards::G-3-the-four-blocks-are-EQUAL-WIDTH-and-in-ONE-ROW", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		const cls = row?.getAttribute("class") ?? "";

		// ⛔⛔ WHY THIS IS A CLASS ASSERTION AND NOT A MEASUREMENT. jsdom performs
		// NO LAYOUT — every `getBoundingClientRect()` here returns zeros. The
		// RENDERED widths are measured in a real browser (A3/S4 in the run log).
		const tokens = cls.split(/\s+/);
		expect(tokens).toContain("grid");
		expect(tokens.filter((t) => t.includes("grid-cols-"))).toEqual([
			"grid-cols-4",
		]);
		expect(cls).not.toMatch(/:grid-cols-/);
		expect(tokens).toContain("flex-1");

		// ⚠ BLOCK-1: the RESOLVER block is now an `<a>`, the other three stay
		// `<div>`s — both are equally valid direct grid children, so this loop
		// is deliberately tag-agnostic.
		for (const k of KEYS) {
			const b = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			expect(b).not.toBeNull();
			expect(b?.parentElement).toBe(row);
			for (const t of (b?.getAttribute("class") ?? "").split(/\s+/)) {
				expect(t).not.toMatch(
					/^(col-span-|col-start-|col-end-|w-|max-w-|justify-self-)/,
				);
				if (t.startsWith("min-w-")) {
					expect(t).toBe("min-w-0");
				}
				expect(t).not.toMatch(/^(contents|hidden)$/);
			}
		}
	});

	it("resolver-cards::the-row-carries-a-CONTENT-FLOOR-not-min-h-0", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const cls =
			container
				.querySelector('[data-testid="resolver-cards"]')
				?.getAttribute("class") ?? "";
		expect(cls).toContain("min-h-[84px]");
		expect(cls).toMatch(/min-h-\[\d+px\]/);
		expect(cls.split(/\s+/)).not.toContain("min-h-0");
	});

	it("resolver-cards::a-block-does-NOT-clip-its-own-content", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		for (const k of KEYS) {
			const el = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			expect(el).not.toBeNull();
			expect((el?.getAttribute("class") ?? "").split(/\s+/)).not.toContain(
				"overflow-hidden",
			);
		}
	});

	it("resolver-cards::each-block-has-a-1-to-1-placeholder-glyph-unchanged-by-BLOCK-1", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);

		for (const k of KEYS) {
			const glyph = container.querySelector(
				`[data-testid="resolution-block-glyph-${k}"]`,
			);
			const label = container.querySelector(
				`[data-testid="resolution-block-label-${k}"]`,
			);
			const value = container.querySelector(
				`[data-testid="resolution-block-value-${k}"]`,
			);
			expect(glyph).not.toBeNull();
			expect(label).not.toBeNull();
			expect(value).not.toBeNull();

			const gc = glyph?.getAttribute("class") ?? "";
			expect(gc).toContain("aspect-square");
			expect(gc).toContain("shrink-0");
			for (const t of gc.split(/\s+/)) {
				expect(t).not.toMatch(/^(h-|size-|min-h-|max-h-)/);
			}
			expect(gc.split(/\s+/).filter((x) => /^w-/.test(x))).toHaveLength(1);
			expect(gc).not.toContain("self-stretch");
			// The glyph stays decorative — unchanged by RESOLVER becoming a link
			// (RF-3a: it must contribute nothing to the anchor's accessible name).
			expect(glyph?.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("resolver-cards::carries-the-four-PROVISIONAL-fixture-labels", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		for (const [k, label] of [
			["resolution", "Resolution"],
			["resolver", "Resolver"],
			["closes", "Closes on"],
			["flavour", "Flavour"],
		] as const) {
			expect(
				container.querySelector(`[data-testid="resolution-block-label-${k}"]`)
					?.textContent,
			).toBe(label);
		}
	});
});

/**
 * BLOCK-1 · G2/G3/G4/G5 — the values are real, per market, and never fall
 * back to an empty bar.
 */
describe("BLOCK-1 — G2, every value line is real content, never an empty bar", () => {
	it("resolver-cards::G2-no-block-has-a-zero-character-value-for-any-known-market", () => {
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			const data = RESOLUTION_BLOCKS[slug];
			for (const k of KEYS) {
				const value = container.querySelector(
					`[data-testid="resolution-block-value-${k}"]`,
				);
				expect(value).not.toBeNull();
				expect(value?.textContent).toBe(data[k].line1);
				expect(value?.textContent?.length).toBeGreaterThan(0);
				// ⛔ Real content now — never `aria-hidden`.
				expect(value?.getAttribute("aria-hidden")).toBeNull();

				const subvalue = container.querySelector(
					`[data-testid="resolution-block-subvalue-${k}"]`,
				);
				if (data[k].line2 === null) {
					// ⛔⛔ NO EMPTY SPAN — line2 is omitted entirely, not rendered blank.
					expect(subvalue).toBeNull();
				} else {
					expect(subvalue).not.toBeNull();
					expect(subvalue?.textContent).toBe(data[k].line2);
					expect(subvalue?.getAttribute("aria-hidden")).toBeNull();
				}
			}
			unmount();
		}
	});

	it("resolver-cards::G3-oktoberfest-closes-4-Oct-not-5-Nov-slate-wide", () => {
		const { container } = render(
			<ResolverCards
				market={marketFixture("oktoberfest-munich-beer-volume")}
			/>,
		);
		expect(
			container.querySelector('[data-testid="resolution-block-value-closes"]')
				?.textContent,
		).toBe("4 Oct 2026");
		expect(
			container.querySelector(
				'[data-testid="resolution-block-subvalue-closes"]',
			)?.textContent,
		).toBe("21:59Z");

		// Positive control: a different market on the SAME test run reads 5 Nov,
		// proving the assertion above isn't vacuously true of every market.
		const { container: other } = render(
			<ResolverCards market={marketFixture("bitcoin-price-50k")} />,
		);
		expect(
			other.querySelector('[data-testid="resolution-block-value-closes"]')
				?.textContent,
		).toBe("5 Nov 2026");
	});

	it("resolver-cards::G4-no-rendered-anchor-ever-has-an-empty-hash-or-placeholder-href", () => {
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			const data = RESOLUTION_BLOCKS[slug];
			const anchors = Array.from(container.querySelectorAll("a"));

			// ⛔⛔ NON-VACUITY CONTROL, AND IT IS NOT OPTIONAL. The href loop below
			// iterates `querySelectorAll("a")` — on a component that renders NO
			// anchor at all it runs ZERO times and asserts NOTHING, so the guard
			// goes green against exactly the regression that would delete the
			// RESOLVER link. Measured: a mutant rendering all four blocks as plain
			// `<div>`s passed this test unchanged before these three lines existed.
			// Only `bitcoin-price-50k` (G7) and `github-zugzwang-repo-stars` (G5)
			// pin an anchor's existence by slug, so the other six markets had no
			// coverage at all.
			// ⚠ THE EXPECTED COUNT IS DERIVED FROM THE MAP, NOT HARDCODED TO 1 —
			// that is what keeps the RESOLUTION-href seam open (the guard is
			// deliberately generic over all blocks). Wire a second href in
			// `resolution-block-data.ts` and this expectation moves with it, with
			// no edit here.
			const expectedAnchorKeys = KEYS.filter((k) => data[k].href !== null);
			expect(expectedAnchorKeys.length).toBeGreaterThan(0);
			expect(anchors.length).toBe(expectedAnchorKeys.length);
			for (const k of expectedAnchorKeys) {
				const block = container.querySelector(
					`[data-testid="resolution-block-${k}"]`,
				);
				expect(block?.tagName).toBe("A");
				expect(block?.getAttribute("href")).toBe(data[k].href);
			}

			for (const a of anchors) {
				const href = a.getAttribute("href");
				expect(href).not.toBeNull();
				expect(href).not.toBe("");
				expect(href).not.toBe("#");
				expect(href).toMatch(/^https:\/\//);
			}
			unmount();
		}
	});

	it("resolver-cards::G5-github-href-is-the-FULL-repo-url-not-shortened-to-match-the-text", () => {
		const { container } = render(
			<ResolverCards market={marketFixture("github-zugzwang-repo-stars")} />,
		);
		const anchor = container.querySelector(
			'[data-testid="resolution-block-resolver"]',
		);
		expect(anchor?.tagName).toBe("A");
		expect(anchor?.getAttribute("href")).toBe(
			"https://github.com/zugzwang-foundation/experiment",
		);
		// The display text is short by design — the href is not.
		expect(
			container.querySelector('[data-testid="resolution-block-value-resolver"]')
				?.textContent,
		).toBe("Zugzwang");
		expect(
			container.querySelector(
				'[data-testid="resolution-block-subvalue-resolver"]',
			)?.textContent,
		).toBe("repo");
	});

	it("resolver-cards::an-unknown-market-slug-degrades-to-NOTHING-captured-once-never-crashes-the-route", () => {
		// ⛔⛔ REVERSED POST-REVIEW: this used to assert `render(...)` THROWS —
		// correct End-to-end confirmation of G1 at the time, but @code-reviewer
		// and @security-auditor independently converged on the same finding:
		// letting that throw reach `MarketHeader` → `DebateView` took the WHOLE
		// `/m/[slug]` route down (unauthenticated, GET-triggerable, repeatably)
		// for a failure that only needs one market's resolution row to degrade.
		// `getResolutionBlocks` itself is UNCHANGED and still throws — proven
		// directly by `resolution-block-data.test.ts`'s G1 tests, not
		// re-asserted here. What changed is `ResolverCards`, the caller: it now
		// catches that throw, captures it once, and renders nothing.
		vi.mocked(captureException).mockClear();
		const unknown = { ...BASE, slug: "not-one-of-the-eight" };
		const { container } = render(<ResolverCards market={unknown} />);

		// ⛔ NOTHING renders — no row, no partial chrome, no empty bar (the
		// state RF-1 removed). `container.firstChild === null` is the honest
		// "this component opted out of rendering" signal; a stray wrapper
		// `<div />` would pass a `toBeNull()` on `resolver-cards` alone while
		// still adding an empty node to the DOM.
		expect(container.firstChild).toBeNull();
		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).toBeNull();

		// ⛔⛔ STILL LOUD — captured, not swallowed. This is what keeps the RF-1
		// guarantee ("a missing slug must fail... a silent fallback would be
		// undetectable") true under the new behaviour: an operator sees this in
		// Sentry, a participant sees a working page with one row missing.
		expect(captureException).toHaveBeenCalledTimes(1);
		const captured = vi.mocked(captureException).mock.calls[0]?.[0];
		expect(captured).toBeInstanceOf(Error);
		expect((captured as Error).message).toMatch(
			/no resolution-block data for market slug "not-one-of-the-eight"/,
		);
	});

	it("resolver-cards::a-known-slug-never-calls-captureException", () => {
		// ⛔ POSITIVE-PATH CONTROL for the test above — proves `captureException`
		// isn't called unconditionally on every render, which would make the
		// assertion above vacuous in the other direction.
		vi.mocked(captureException).mockClear();
		render(<ResolverCards market={PRIMARY_MARKET} />);
		expect(captureException).not.toHaveBeenCalled();
	});
});

/**
 * BLOCK-1 · R-12 (reversed for RESOLVER only) / G7 / G8 — RESOLVER is the
 * ONLY interactive block; RESOLUTION, CLOSES and FLAVOUR stay exactly as
 * non-interactive as RESO-1 shipped them.
 *
 * ⛔ THE REASON RESOLVER CHANGED IS NOT STYLE. Its authoritative source (an X
 * account, or the institution's own site/data page) exists and is linkable
 * today, for all eight markets — unlike RESOLUTION, whose eventual target
 * (Zugzwang's own X post, U-3) does not exist yet.
 */
describe("BLOCK-1 — R-12 reversed for RESOLVER only; G7/G8 on the split", () => {
	it("resolver-cards::G8-RESOLUTION-CLOSES-FLAVOUR-remain-non-navigable-and-non-focusable", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		for (const k of ["resolution", "closes", "flavour"] as const) {
			const el = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			expect(el).not.toBeNull();
			expect(el?.tagName).toBe("DIV");
			const scope = [
				el as Element,
				...Array.from(el?.querySelectorAll("*") ?? []),
			];
			for (const node of scope) {
				expect(
					node.matches("a, button, [href], [onclick], [role], [tabindex]"),
				).toBe(false);
			}
		}
	});

	it("resolver-cards::G7-RESOLVER-is-ONE-anchor-wrapping-glyph-label-AND-value", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const block = container.querySelector(
			'[data-testid="resolution-block-resolver"]',
		);
		expect(block?.tagName).toBe("A");

		const glyph = container.querySelector(
			'[data-testid="resolution-block-glyph-resolver"]',
		);
		const label = container.querySelector(
			'[data-testid="resolution-block-label-resolver"]',
		);
		const value = container.querySelector(
			'[data-testid="resolution-block-value-resolver"]',
		);
		const subvalue = container.querySelector(
			'[data-testid="resolution-block-subvalue-resolver"]',
		);
		// ⛔ THE WHOLE BLOCK, NOT JUST THE VALUE TEXT — glyph, label and both
		// value lines are all DESCENDANTS of the one anchor.
		for (const el of [glyph, label, value, subvalue]) {
			expect(el).not.toBeNull();
			expect(block?.contains(el as Node)).toBe(true);
		}
		// No nested interactive element inside the anchor.
		expect(block?.querySelectorAll("a, button, [role]").length).toBe(0);
	});

	it("resolver-cards::G7-RESOLVER-carries-target-blank-and-rel-noopener-noreferrer", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const anchor = container.querySelector(
			'[data-testid="resolution-block-resolver"]',
		);
		expect(anchor?.getAttribute("target")).toBe("_blank");
		expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
		expect(anchor?.getAttribute("href")).toBe(PRIMARY_DATA.resolver.href);
	});

	it("resolver-cards::clicking-an-inert-block-DOES-NOTHING", () => {
		const open = vi.spyOn(window, "open").mockImplementation(() => null);
		try {
			const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
			for (const k of ["resolution", "closes", "flavour"] as const) {
				const el = container.querySelector(
					`[data-testid="resolution-block-${k}"]`,
				);
				expect(el).not.toBeNull();
				fireEvent.click(el as Element);
			}
			expect(open).not.toHaveBeenCalled();
		} finally {
			open.mockRestore();
		}
	});

	it("resolver-cards::only-RESOLVER-carries-the-hover-focus-affordance-classes", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const resolver =
			container
				.querySelector('[data-testid="resolution-block-resolver"]')
				?.getAttribute("class") ?? "";
		expect(resolver).toMatch(/focus-visible:shadow-\(--state-focus-ring\)/);
		expect(resolver).toContain("outline-none");

		for (const k of ["resolution", "closes", "flavour"] as const) {
			const el = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			// ⛔ NON-VACUITY — the `?? ""` below turns a MISSING element into a
			// one-token list holding `""`, which satisfies every `not.toMatch` in
			// the loop. Measured: rendering a row with no blocks at all passed this
			// test before this assertion existed.
			expect(el).not.toBeNull();
			const cls = el?.getAttribute("class") ?? "";
			expect(cls.length).toBeGreaterThan(0);
			for (const t of cls.split(/\s+/)) {
				// ⚠⚠ MATCH THE WORD, NOT THE `word:` VARIANT PREFIX. This read
				// `/cursor|hover:|focus-visible:|active:|group-hover/` and an
				// ARBITRARY-VARIANT form slipped straight past it — in
				// `[&:hover]:border-(--ring)` the character after "hover" is `]`,
				// not `:`, so the old pattern matched nothing and an inert block
				// carrying a real hover affordance passed (measured). None of the
				// shipped inert-block classes (`rounded-(--r) px-[11px] py-2
				// [border:var(--hairline)] flex min-h-0 min-w-0 items-center
				// gap-2.5`) contain any of these words, so the wider pattern costs
				// nothing.
				expect(t).not.toMatch(/cursor|hover|focus|active|group-/);
			}
		}
	});

	it("resolver-cards::the-scan-is-ALIVE", () => {
		// ⛔ NON-VACUITY CONTROL (OVN-V1) — every assertion above this line is a
		// `not.toBeNull` / `toBe(false)` / `not.toContain`, all of which pass on
		// a component rendering nothing at all. Prove the row actually has
		// content and children before trusting the negatives.
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		expect(row).not.toBeNull();
		expect(row?.children.length).toBe(4);
		expect((row?.textContent ?? "").trim()).toContain("Resolution");
		expect((row?.textContent ?? "").trim().length).toBeGreaterThan(20);
	});
});

describe("BLOCK-1 — no market's title/description/slug ever leaks into the row", () => {
	it("resolver-cards::ships-no-invented-content-and-no-market-fields-leak", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);

		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		expect(container.innerHTML).toContain("Resolver");

		// ⛔ Demo copy from a wholly different (never-built) market — porting it
		// would be inventing market content (CLAUDE.md §3). Still banned.
		for (const demo of [
			"Brihanmumbai Municipal Corporation",
			"Monthly operational bulletins",
			"BMC",
		]) {
			expect(container.innerHTML).not.toContain(demo);
		}

		// ⚠ The fixture's title/description/slug are deliberately synthetic
		// (`marketFixture`) — none of them may leak into the resolution row,
		// which reads ONLY `market.slug` for its lookup, never `.title` or
		// `.description`, and never prints the slug itself.
		expect(container.innerHTML).not.toContain(PRIMARY_MARKET.title);
		expect(container.innerHTML).not.toContain(PRIMARY_MARKET.description);
		expect(container.innerHTML).not.toContain(PRIMARY_MARKET.slug);
	});
});
