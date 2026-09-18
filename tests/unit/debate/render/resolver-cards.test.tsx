// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

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

import { decodePng } from "../_png";

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
	// ⚠ UI-OVERNIGHT entry 4 — the DISCOVERY thumbnail, distinct from
	// `mediaImageUrl` above: the detail header takes the secondary media row,
	// the post arm's market CARD takes the default one, because that card is
	// the same locked composition Discovery renders. REQUIRED on the type, so a
	// fixture that forgets it is a compile error rather than a card that
	// silently shows the wrong picture.
	thumbImageUrl: null,
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
		// ⛔⛔ BLOCK-4 §2 REVERSES THIS ASSERTION, WHICH USED TO READ
		// `expect(tokens).toContain("flex-1")`. R-8 made the row `flex-1` so the
		// blocks would "absorb the height freed by R-1/R-2" — correct while they
		// were empty placeholder chrome, and the defect once they held one line of
		// real text: as the only `flex-1` child of a band fixed at
		// `basis-[24.2dvh]`, the row's height was pure LEFTOVER and tracked the
		// viewport rather than its contents (measured on the BLOCK-3 build at
		// `7155cf1`: 122.76px at 1440×900, 92.99 at 1440×777, 166.32 at
		// 1920×1080, around 53.25px of content).
		// ⇒ The row is CONTENT-SIZED now, and this is the assertion that keeps it
		// that way. `flex-1` returning here would silently restore a block four
		// times taller than its text at a tall viewport, and no other guard in
		// this file or `debate-height-chain.test.ts` would see it (jsdom performs
		// no layout, and this row is not a chain node).
		expect(tokens).not.toContain("flex-1");
		expect(tokens).not.toContain("grow");
		expect(tokens).not.toContain("self-stretch");

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
		// ⚠⚠ BLOCK-4 §2 — 78px → 54px, re-derived a third time (84 at RESO-2, 78
		// at BLOCK-3, 54 here) because the worst case changed, not because the
		// number was wrong. Every `line2` is `null` now, so the tallest possible
		// block is ONE line at the `fontSize` ceiling: padding 12 + border 2 +
		// label 14.25 + gap 4 + value 21 = 53.25px, browser-measured, rounded up.
		// See `ResolverCards.tsx`'s own docblock on this class for the full
		// derivation and for why 36px of glyph never binds.
		expect(cls).toContain("min-h-[54px]");
		expect(cls).toMatch(/min-h-\[\d+px\]/);
		expect(cls.split(/\s+/)).not.toContain("min-h-0");
		// ⛔⛔ NO TOP MARGIN. `mt-4` shipped on this row from RESO-1 to BLOCK-3
		// and was the reason the three stacked elements read 5px / 5px / 21px
		// instead of an even rhythm — the stack's own gap said 5 and this margin
		// silently added 16 to the last one. BLOCK-4 §3 moves the rhythm entirely
		// into `headzone-stack`'s `gap-5`, so a margin reappearing here would
		// re-open exactly the unevenness that task was ruled to fix, from a file
		// the founder would not think to look in.
		expect(cls.split(/\s+/).filter((t) => /^-?m[tby]?-/.test(t))).toEqual([]);
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
			// ⚠⚠ BLOCK-3 §2 — hidden below `sm`, visible at/above it. MEASURED at
			// 390×844: a 36px glyph plus this block's own padding already exceeds
			// the block's total width at that breakpoint, driving the text column
			// to 0px — invisible, not merely truncated. `ResolverCards.tsx`'s own
			// docblock on this span has the full arithmetic.
			expect(gc.split(/\s+/)).toContain("hidden");
			expect(gc.split(/\s+/)).toContain("sm:block");
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

	it("resolver-cards::G3-CLOSES-renders-the-MAP-date-on-every-market", () => {
		// ⚠⚠ MKT-ROSTER-1 TOOK THIS TEST'S SUBJECT. It was named for the one
		// market that closed 4 Oct rather than 5 Nov, and it asserted that the
		// render did not flatten that exception to the slate-wide date — a block
		// reading 5 Nov there would have locked a participant out early. That
		// market was removed, so there is no longer a second date to confuse.
		// ⛔ RE-AIMED RATHER THAN RETIRED — and the honest accounting is that ONE
		// half of the re-aim is a strengthening and the other is not yet.
		//   · STRONGER, today: the sweep. One market became all six, with a
		//     non-vacuity count, so a component that rendered the date correctly
		//     on one market and wrongly on another can no longer pass.
		//   · NOT stronger, today: the DERIVATION. Every `closes.line1` in the map
		//     is now the same string, so reading it out of the map is byte-identical
		//     to hardcoding "5 Nov 2026" and cannot distinguish a component that
		//     ignores the map from one that reads it. It buys something only when a
		//     second date exists again.
		// ⚠ An earlier version of this comment claimed the derivation was
		// "strictly stronger", which contradicted this test's own data-level twin
		// in the same commit — `resolution-block-data.test.ts` correctly calls the
		// loss "THE WEAKER HALF OF G3". Two self-assessments of one loss disagreeing
		// is worse than either being wrong (`@code-reviewer`).
		let checked = 0;
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			expect(
				container.querySelector('[data-testid="resolution-block-value-closes"]')
					?.textContent,
			).toBe(RESOLUTION_BLOCKS[slug].closes.line1);
			// ⚠⚠ BLOCK-4 §1 — the time line is gone from every market, so this
			// asserts the subvalue's ABSENCE where it used to assert its text.
			expect(
				container.querySelector(
					'[data-testid="resolution-block-subvalue-closes"]',
				),
			).toBeNull();
			checked += 1;
			unmount();
		}
		// ⛔ NON-VACUITY — an empty map would satisfy every assertion above.
		expect(checked).toBe(6);
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
		// ⚠⚠ BLOCK-4 §1 — "Zugzwang" / "repo" became the single word "GitHub".
		// The href did not move a byte, which is the whole of G5: the rendered
		// anchor must still carry the FULL repo URL even though its label no
		// longer names the repo at all.
		expect(
			container.querySelector('[data-testid="resolution-block-value-resolver"]')
				?.textContent,
		).toBe("GitHub");
		expect(
			container.querySelector(
				'[data-testid="resolution-block-subvalue-resolver"]',
			),
		).toBeNull();
		// ⛔ THE RENDERED href, not the map's — this test reads the DOM, so it
		// catches a component that renders a truncated or rewritten URL from a
		// correct map entry, which the data-level G5 guard structurally cannot.
		expect(anchor?.getAttribute("href")).toContain(
			"/zugzwang-foundation/experiment",
		);
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
		const unknown = { ...BASE, slug: "not-one-of-the-six" };
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
			/no resolution-block data for market slug "not-one-of-the-six"/,
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
		// ⚠⚠ THE FIXTURE HAS MOVED TWICE AND THE SUBJECT NARROWED ONCE. BLOCK-3
		// moved it off bitcoin because §4c dropped bitcoin's RESOLVER subvalue
		// ("Low") and another market had just gained one, making that one the
		// only market whose RESOLVER carried both an href and a subvalue. BLOCK-4 §1 removes every second line on every
		// market, so NO fixture can exercise the subvalue-inside-the-anchor
		// branch — it moves back to PRIMARY_MARKET and asserts the three
		// descendants that still exist.
		// ⛔ THE DROPPED HALF IS NOT LOST, IT IS RELOCATED. "a subvalue rendered
		// inside the anchor rather than beside it" is now proven by the synthetic
		// two-line fixture at the bottom of this file, which is the only place
		// that branch can be reached at all. Deleting it would silently retire
		// this assertion rather than move it.
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
		// ⛔ THE WHOLE BLOCK, NOT JUST THE VALUE TEXT — glyph, label and the value
		// line are all DESCENDANTS of the one anchor.
		for (const el of [glyph, label, value]) {
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
		// ⚠⚠ BLOCK-3 §2 — inset now, not the shared `--state-focus-ring` token.
		// `ResolverCards.tsx`'s `LINK_AFFORDANCE` docblock has the full reasoning:
		// the outset token clips against `headzone-stack`'s `overflow-y-auto`, so
		// this block's own focus ring switched to an inset shadow reusing `--ring`
		// (the same token its hover state already borrows) instead.
		expect(resolver).toMatch(
			/focus-visible:shadow-\[inset_0_0_0_2px_var\(--ring\)\]/,
		);
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

/**
 * BLOCK-3 §3 — value/subvalue move from `text-muted-foreground` to full ink,
 * sized per block from the map's own measured `fontSize`. Labels are
 * unchanged (still muted) — v1.1 re-ranks the VALUE against the label, never
 * the label itself.
 */
describe("BLOCK-3 §3 — value/subvalue read ink, sized per block from the map", () => {
	it("resolver-cards::every-value-and-subvalue-is-ink-sized-from-its-own-fontSize", () => {
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			const data = RESOLUTION_BLOCKS[slug];
			for (const k of KEYS) {
				const entry = data[k];
				const value = container.querySelector(
					`[data-testid="resolution-block-value-${k}"]`,
				);
				const valueClasses = (value?.getAttribute("class") ?? "").split(/\s+/);
				expect(valueClasses).toContain("text-ink");
				expect(valueClasses).not.toContain("text-muted-foreground");
				expect(valueClasses).toContain(`text-[${entry.fontSize}px]`);
				// ⛔ THE FLOOR, ASSERTED AGAINST THE DATA ITSELF — a type of
				// `11 | 12 | 13 | 14` already makes anything below 11 a `tsc` error,
				// so this is a belt asserting the runtime-rendered class agrees with
				// the type, not a second source of truth for the floor.
				expect(entry.fontSize).toBeGreaterThanOrEqual(11);
				expect(entry.fontSize).toBeLessThanOrEqual(14);

				if (entry.line2 !== null) {
					const subvalue = container.querySelector(
						`[data-testid="resolution-block-subvalue-${k}"]`,
					);
					const subvalueClasses = (subvalue?.getAttribute("class") ?? "").split(
						/\s+/,
					);
					expect(subvalueClasses).toContain("text-ink");
					expect(subvalueClasses).not.toContain("text-muted-foreground");
					// ⛔ SAME SIZE AS line1 — one shared size per block, not one per
					// line (resolution-block-data.ts's `fontSize` docblock).
					expect(subvalueClasses).toContain(`text-[${entry.fontSize}px]`);
				}
			}
			unmount();
		}
	});

	it("resolver-cards::labels-stay-muted-unchanged-by-the-ink-move", () => {
		const { container } = render(<ResolverCards market={PRIMARY_MARKET} />);
		for (const k of KEYS) {
			const label = container.querySelector(
				`[data-testid="resolution-block-label-${k}"]`,
			);
			const cls = (label?.getAttribute("class") ?? "").split(/\s+/);
			expect(cls).toContain("text-n4");
			expect(cls).not.toContain("text-ink");
		}
	});

	it("resolver-cards::no-entry-ships-at-the-11px-floor-after-BLOCK-3-§2-widened-the-column", () => {
		// ⚠⚠ THIS TEST USED TO BE "math-erdos-RESOLVER-hits-the-11px-floor-and-
		// still-truncates" — "@thomasfbloom" did not fit the column §3 first
		// measured against (79px) even at the 11px floor. §2 then shrank the
		// glyph for an unrelated reason (reducing block height) and widened
		// that column to 91px as a side effect; re-measured before shipping,
		// every entry that had been pinned to 11px moved up, including this
		// one (now 12px, fits cleanly, no truncation needed). Recorded as a
		// positive assertion rather than deleted outright (O-4): the floor and
		// `truncate` stay in the type and the render path regardless — this
		// proves the CURRENT map doesn't need them, not that it never will.
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const data = RESOLUTION_BLOCKS[slug];
			for (const k of KEYS) {
				expect(data[k].fontSize).toBeGreaterThan(11);
			}
		}
	});

	it("resolver-cards::truncate-still-ships-unconditionally-as-the-backstop", () => {
		// ⚠ `truncate` is NOT conditioned on whether a value currently needs
		// it — every value/subvalue span carries it regardless (`ResolverCards.tsx`),
		// so a future map entry with a longer string degrades safely without
		// this component needing to change. Asserted directly on the entry
		// that most recently exercised this path.
		const { container } = render(
			<ResolverCards
				market={marketFixture("math-erdos-contribution-response")}
			/>,
		);
		const value = container.querySelector(
			'[data-testid="resolution-block-value-resolver"]',
		);
		const cls = (value?.getAttribute("class") ?? "").split(/\s+/);
		expect(cls).toContain("text-[12px]");
		expect(cls).toContain("truncate");
		expect(
			RESOLUTION_BLOCKS["math-erdos-contribution-response"].resolver.fontSize,
		).toBe(12);
	});
});

/**
 * BLOCK-3 §5 — the render-level half of the sentence-case guard.
 * `resolution-block-data.test.ts` already proves the DATA is sentence-cased;
 * this proves nothing at RENDER TIME undoes that — the specific regression the
 * data file's own docblock warns against is a future `capitalize` class on the
 * value span, which uppercases the first letter of EVERY WORD.
 *
 * ⚠⚠ MKT-ROSTER-1 RE-HOMED THIS GUARD AND DID NOT RETIRE IT. Its subject was a
 * lowercase DOMAIN carried as a removed market's RESOLUTION value, where
 * `capitalize` would have printed a DIFFERENT DOMAIN as the market's resolving
 * source. That value is gone with its market — but the hazard is not, because
 * `"Response on X"` renders `"Response On X"` under the same class, on FOUR of
 * the six remaining markets. Milder than a wrong domain, still wrong, and still
 * invisible to any assertion over `textContent`.
 * ⛔ The alternative re-home the plan suggested — `coinmarketcap.com` — does NOT
 * work, and it is worth saying why so nobody tries it again: that string is an
 * `href`, never rendered text, and the value that IS rendered for that market is
 * `"CoinMarketCap"`, which `capitalize` leaves byte-identical. A guard aimed
 * there would have been green forever and proved nothing.
 */
describe("BLOCK-3 §5 — RESOLUTION sentence case survives to the DOM", () => {
	it("resolver-cards::Response-on-X-renders-a-lowercase-on-in-the-DOM", () => {
		const { container } = render(
			<ResolverCards market={marketFixture("chess-fide-tiebreak-response")} />,
		);
		const value = container.querySelector(
			'[data-testid="resolution-block-value-resolution"]',
		);
		// The subject: a multi-word value whose second word is lowercase.
		expect(value?.textContent).toBe("Response on X");
		expect(value?.textContent?.split(" ")[1]).toBe("on");
		// ⛔⛔ THE STRING CHECK ABOVE CANNOT CATCH THE REGRESSION THIS TEST IS
		// FOR. CSS `text-transform` does not touch the DOM text node, so
		// `textContent` stays "Response on X" while the participant reads
		// "Response On X". The class-list check is the one that fires.
		const cls = (value?.getAttribute("class") ?? "").split(/\s+/);
		expect(cls).not.toContain("capitalize");
		expect(cls).not.toContain("uppercase");
	});

	it("resolver-cards::no-value-or-subvalue-span-anywhere-carries-a-CSS-capitalize-class", () => {
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			for (const k of KEYS) {
				for (const suffix of ["value", "subvalue"]) {
					const el = container.querySelector(
						`[data-testid="resolution-block-${suffix}-${k}"]`,
					);
					if (!el) continue;
					const cls = (el.getAttribute("class") ?? "").split(/\s+/);
					expect(cls).not.toContain("capitalize");
				}
			}
			unmount();
		}
	});
});

/**
 * BLOCK-4 §1/§5 — every `line2` is `null`, so nothing on the surface renders a
 * second line; and because nothing does, the two-line branch is held open by a
 * SYNTHETIC fixture instead of a real market.
 *
 * ⚠ THE TWO TESTS BELOW ARE OPPOSITES ON PURPOSE. The first proves the branch
 * never fires against shipped data; the second proves it still WORKS. Either
 * one alone is a trap: without the first, a restored second line ships
 * unnoticed; without the second, the branch could be deleted outright and every
 * remaining assertion in this file would stay green, taking the U-3 seam
 * `resolution-block-data.ts` deliberately keeps with it.
 */
describe("BLOCK-4 §1 — no second line ships, and the two-line path stays alive", () => {
	it("resolver-cards::no-block-on-any-market-renders-a-SECOND-line", () => {
		let checked = 0;
		for (const slug of Object.keys(RESOLUTION_BLOCKS) as Array<
			keyof typeof RESOLUTION_BLOCKS
		>) {
			const { container, unmount } = render(
				<ResolverCards market={marketFixture(slug)} />,
			);
			for (const k of KEYS) {
				expect(
					container.querySelector(
						`[data-testid="resolution-block-subvalue-${k}"]`,
					),
				).toBeNull();
				// ⛔ NON-VACUITY, PER BLOCK — a component rendering nothing at all
				// satisfies every `toBeNull()` above. The FIRST line must be present
				// and non-empty for the absence of the second to mean anything.
				const value = container.querySelector(
					`[data-testid="resolution-block-value-${k}"]`,
				);
				expect(value).not.toBeNull();
				expect((value?.textContent ?? "").length).toBeGreaterThan(0);
				checked += 1;
			}
			unmount();
		}
		expect(checked).toBe(24);
	});

	it("resolver-cards::a-SYNTHETIC-two-line-entry-still-renders-BOTH-lines", async () => {
		// ⛔⛔ THE ONLY TEST IN THE REPO THAT REACHES THE `entry.line2 !== null`
		// BRANCH. No shipped market can reach it any more, so this mocks the map
		// with a fixture that is OBVIOUSLY not market content — if either string
		// ever appears on staging, the mock has leaked into a real render path.
		// ⚠ `doMock` + `resetModules` + a dynamic import, rather than a top-level
		// `vi.mock`: the latter is hoisted to the whole FILE and would replace the
		// real map for all ~30 tests above, every one of which exists to assert
		// against the real one.
		const entry = (line1: string, line2: string | null) => ({
			line1,
			line2,
			href: null,
			fontSize: 14 as const,
		});
		vi.resetModules();
		vi.doMock("@/components/debate/resolution-block-data", () => ({
			isKnownMarketSlug: () => true,
			RESOLUTION_BLOCKS: {},
			getResolutionBlocks: () => ({
				resolution: entry("SYNTHETIC-LINE-1", "SYNTHETIC-LINE-2"),
				resolver: {
					...entry("SYNTHETIC-RESOLVER-1", "SYNTHETIC-RESOLVER-2"),
					// ⛔ AN href TOO — the branch that matters is a subvalue rendered
					// INSIDE the anchor rather than beside it, which is the half G7
					// used to cover with a since-removed market's RESOLVER subvalue
					// and can no longer reach.
					href: "https://example.invalid/synthetic",
				},
				closes: entry("SYNTHETIC-CLOSES", null),
				flavour: entry("SYNTHETIC-FLAVOUR", null),
			}),
		}));
		try {
			const { ResolverCards: Isolated } = await import(
				"@/components/debate/ResolverCards"
			);
			const { container, unmount } = render(
				<Isolated market={{ ...BASE, slug: "synthetic-two-line-fixture" }} />,
			);

			// BOTH lines render, in order, for the entry that has two.
			const value = container.querySelector(
				'[data-testid="resolution-block-value-resolution"]',
			);
			const subvalue = container.querySelector(
				'[data-testid="resolution-block-subvalue-resolution"]',
			);
			// ⛔ ASSERTED PRESENT BEFORE ANYTHING IS READ OFF THEM. `value?.x` on a
			// null node yields `undefined`, which compares unequal to the expected
			// string and so still reds here — but the ORDER check below would
			// degrade to `undefined & N === 0`, falsy, and read as "wrong order"
			// rather than "no element". Two different defects, one message.
			expect(value).not.toBeNull();
			expect(subvalue).not.toBeNull();
			expect(value?.textContent).toBe("SYNTHETIC-LINE-1");
			expect(subvalue?.textContent).toBe("SYNTHETIC-LINE-2");
			// ⛔ ORDER, NOT JUST PRESENCE — `line2` under `line1`, never above it.
			const order = (value as Element).compareDocumentPosition(
				subvalue as Node,
			);
			expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
			// Both lines share ONE size, taken from the block's own `fontSize`
			// (`resolution-block-data.ts` — one shared size per block, not per line).
			for (const el of [value, subvalue]) {
				const cls = (el?.getAttribute("class") ?? "").split(/\s+/);
				expect(cls).toContain("text-[14px]");
				expect(cls).toContain("text-ink");
				expect(cls).toContain("truncate");
			}
			// The linked block wraps BOTH of its lines in the one anchor.
			const anchor = container.querySelector(
				'[data-testid="resolution-block-resolver"]',
			);
			expect(anchor?.tagName).toBe("A");
			const resolverSub = container.querySelector(
				'[data-testid="resolution-block-subvalue-resolver"]',
			);
			expect(resolverSub?.textContent).toBe("SYNTHETIC-RESOLVER-2");
			expect(anchor?.contains(resolverSub as Node)).toBe(true);
			// ⛔ THE CONTROL THAT MAKES THE ASSERTIONS ABOVE MEAN SOMETHING: a
			// null `line2` in the SAME render still omits its span. Without this,
			// a component that rendered a subvalue unconditionally would pass.
			expect(
				container.querySelector(
					'[data-testid="resolution-block-subvalue-closes"]',
				),
			).toBeNull();
			unmount();
		} finally {
			vi.doUnmock("@/components/debate/resolution-block-data");
			vi.resetModules();
		}
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

describe("BLOCK-5b · G-d — every block on every market renders a real glyph image", () => {
	// ⚠⚠ WHAT jsdom CAN AND CANNOT PROVE, STATED PLAINLY. jsdom fetches nothing
	// and decodes nothing, so `naturalWidth` here is 0 for every image no matter
	// what — asserting it non-zero in this environment would be asserting a
	// constant, and would keep passing over a `src` that 404s. So the guarantee
	// is split: this file proves all 24 images render with the RIGHT `src`, and
	// that each `src` resolves to a file on disk whose PNG header declares
	// non-zero dimensions (decoded from the real shipped bytes); the browser's
	// own decode is measured against the deployed build at close.
	const slugs = Object.keys(
		RESOLUTION_BLOCKS,
	) as (keyof typeof RESOLUTION_BLOCKS)[];

	it("finds EXACTLY 24 glyph images across the six markets — 6 x 4", () => {
		// ⛔⛔ THE POSITIVE CONTROL, AND IT COMES FIRST ON PURPOSE. Every assertion
		// below iterates a NodeList; a selector that matched nothing would make all
		// of them pass vacuously and report "0 broken" as success. The count is
		// asserted before any property of any element is read, so "found nothing"
		// can never be mistaken for "nothing wrong".
		let total = 0;
		for (const slug of slugs) {
			const { container } = render(
				<ResolverCards market={{ ...BASE, slug }} />,
			);
			total += container.querySelectorAll(
				'[data-testid^="resolution-block-glyph-img-"]',
			).length;
			cleanup();
		}
		expect(slugs).toHaveLength(6);
		expect(total).toBe(24);
	});

	it("gives every one of the 24 a src that resolves to a non-empty 512x512 PNG", () => {
		const seen = new Set<string>();
		let checked = 0;
		for (const slug of slugs) {
			const { container } = render(
				<ResolverCards market={{ ...BASE, slug }} />,
			);
			const imgs = container.querySelectorAll<HTMLImageElement>(
				'[data-testid^="resolution-block-glyph-img-"]',
			);
			expect(imgs).toHaveLength(4);
			for (const img of imgs) {
				const src = img.getAttribute("src") ?? "";
				expect(src).toMatch(/^\/brand\/blocks\/[a-z0-9-]+\.png$/);
				// Decorative: the value text beside it already names the thing.
				expect(img.getAttribute("alt")).toBe("");
				const png = decodePng(readFileSync(join(process.cwd(), "public", src)));
				// The stand-in for `naturalWidth`: the referenced bytes really are an
				// image, and really do have dimensions.
				expect(png.width).toBe(512);
				expect(png.height).toBe(512);
				seen.add(src);
				checked++;
			}
			cleanup();
		}
		expect(checked).toBe(24);
		// 24 slots, 10 distinct assets — RESOLUTION/RESOLVER share, CLOSES is one
		// for all six, and four markets share `response-on-x`.
		expect(seen.size).toBe(10);
	});

	it("puts the image INSIDE the aria-hidden span that carries bg-n1", () => {
		// ⛔ THE COMPOSITING CONTRACT. The asset is transparent; the span's own
		// `bg-n1` is the plate. If the image ever escapes that span, the mark
		// renders on whatever happens to be behind the block.
		const { container } = render(
			<ResolverCards market={{ ...BASE, slug: "bitcoin-price-50k" }} />,
		);
		for (const key of ["resolution", "resolver", "closes", "flavour"]) {
			const span = container.querySelector(
				`[data-testid="resolution-block-glyph-${key}"]`,
			);
			expect(span).not.toBeNull();
			expect(span?.getAttribute("aria-hidden")).toBe("true");
			expect(span?.className).toContain("bg-n1");
			expect(span?.className).toContain("overflow-hidden");
			expect(
				span?.querySelector(
					`[data-testid="resolution-block-glyph-img-${key}"]`,
				),
			).not.toBeNull();
		}
	});

	it("renders RESOLUTION and RESOLVER from the same asset, per market", () => {
		for (const slug of slugs) {
			const { container } = render(
				<ResolverCards market={{ ...BASE, slug }} />,
			);
			const res = container
				.querySelector('[data-testid="resolution-block-glyph-img-resolution"]')
				?.getAttribute("src");
			const rsv = container
				.querySelector('[data-testid="resolution-block-glyph-img-resolver"]')
				?.getAttribute("src");
			expect(res).toBeTruthy();
			expect(res).toBe(rsv);
			cleanup();
		}
	});

	it("renders NO glyph image for an unknown slug — the whole row degrades", () => {
		// The row returns null before any block renders, so there is no
		// half-rendered state with chrome but no glyph.
		vi.mocked(captureException).mockClear();
		const { container } = render(
			<ResolverCards market={{ ...BASE, slug: "not-one-of-the-six" }} />,
		);
		expect(
			container.querySelectorAll(
				'[data-testid^="resolution-block-glyph-img-"]',
			),
		).toHaveLength(0);
		expect(captureException).toHaveBeenCalledTimes(1);
	});
});
