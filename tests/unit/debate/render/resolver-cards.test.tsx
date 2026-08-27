// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ResolverCards } from "@/components/debate/ResolverCards";
import type { DebateMarketHeader } from "@/components/debate/types";

/**
 * RESO-1 · R-7 / R-8 / R-12 — the resolution block row.
 *
 * ⚠⚠ THIS FILE'S SUBJECT HAS NOW BEEN REVERSED TWICE, AND BOTH SUPERSEDED
 * VERSIONS ARE RECORDED HERE RATHER THAN SWAPPED OUT (O-4).
 *   v1 asserted `expect(container.innerHTML).toBe("")` under "⛔ THIS IS A
 *      STRUCTURAL TEST AND CANNOT BE A VISUAL ONE … rendering the two card
 *      shells with empty fields would reproduce `PD-3-09` / `OD-6` exactly."
 *   v2 (founder ruling 2026-08-16) required VISIBLE PLACEHOLDER CHROME: two
 *      cards, EXACTLY two, carrying the byte-carried labels `LOGO`, `Resolver`,
 *      `X` and `X — official`, each with a 30px glyph box and two blank rows.
 *   v3 — RESO-1 — is FOUR blocks from one fixture. The count assertion
 *      (`toHaveLength(2)`) and the `X — official` byte-carry are what changed;
 *      everything below about EMPTY DATA is untouched.
 *
 * ⛔⛔ THE HALF THAT HAS NEVER REVERSED IS STILL THE LOAD-BEARING ONE: THE DATA
 * FIELDS STAY EMPTY. `markets` carries no resolver name, logo, source or X
 * handle, and RESO-1 ships no migration, so a future commit that "finishes"
 * these blocks by porting the mockup's demo copy would be inventing MARKET
 * CONTENT (CLAUDE.md §3). Those four strings are pinned as absent below.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const MARKET: DebateMarketHeader = {
	id: "0190c0de-5555-7000-8000-000000000005",
	slug: "resolver-cards-fixture-market",
	title: "Fixture market question.",
	description: "Fixture resolution criterion.",
	status: "Open",
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

const KEYS = ["resolution", "resolver", "closes", "context"] as const;

describe("RESO-1 — R-7, four blocks from one fixture", () => {
	it("resolver-cards::G-3-renders-EXACTLY-four-blocks", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		// ⚠ The superseded assertion was `toHaveLength(2)`. Four now, and EXACTLY
		// four — a fifth would be a different composition, and three would satisfy
		// any "renders some blocks" check.
		expect(
			container.querySelectorAll('[data-testid^="resolution-block-"]'),
		).toHaveLength(
			// four blocks + four glyphs + four labels + four value rows
			16,
		);
		for (const k of KEYS) {
			expect(
				container.querySelector(`[data-testid="resolution-block-${k}"]`),
			).not.toBeNull();
		}
	});

	it("resolver-cards::G-3-the-four-blocks-are-EQUAL-WIDTH-and-in-ONE-ROW", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		const cls = row?.getAttribute("class") ?? "";

		// ⛔⛔ WHY THIS IS A CLASS ASSERTION AND NOT A MEASUREMENT. jsdom performs
		// NO LAYOUT — every `getBoundingClientRect()` here returns zeros, so four
		// blocks of genuinely unequal width would compare EQUAL and this guard
		// would pass on the defect it exists for. The declaration that makes them
		// equal-width and one-row is `grid-cols-4`: CSS grid divides the track
		// evenly, so equal width is a property of the container rather than of the
		// four children. That declaration is therefore the honest subject here, and
		// the RENDERED widths are measured in a real browser and reported in the
		// RESO-1 run log instead.
		// ⛔⛔ TOKEN EQUALITY, NOT `toContain`. `expect(cls).toContain("grid")` — which
		// is what this asserted first — is satisfied by the substring inside
		// `grid-cols-4`, so it asserted NOTHING about `display`. A flex container
		// carrying a stray `grid-cols-4` passed it while `grid-template-columns` sat
		// inert and `flex-wrap` put the blocks on two rows. Caught by @test-writer.
		const tokens = cls.split(/\s+/);
		expect(tokens).toContain("grid");
		// ⛔ EXACTLY ONE column declaration. `toContain("grid-cols-4")` passes on
		// `grid-cols-4 grid-cols-[2fr_1fr_1fr_1fr]`, where the cascade picks a winner
		// this test cannot see — the same double-declaration trap the `min-h-0` line
		// below was written for.
		expect(tokens.filter((t) => t.includes("grid-cols-"))).toEqual([
			"grid-cols-4",
		]);
		// ⛔ NO VARIANT MAY FOLD THE ROW — and the ban is on ANY variant, not an
		// enumeration of named breakpoints. The first version listed
		// `sm|md|lg|xl|2xl`, which `max-[600px]:grid-cols-2` and `print:grid-cols-1`
		// both walk straight past.
		expect(cls).not.toMatch(/:grid-cols-/);

		// R-8 — the row GROWS into what R-1/R-2 freed rather than carrying a tuned
		// literal height. `flex-1` is the mechanism; pinned by name.
		expect(tokens).toContain("flex-1");

		// ⛔⛔ AND THE FOUR BLOCKS MUST BE THE GRID'S OWN ITEMS, EACH SIZING ITSELF
		// TO ITS TRACK. The docblock above used to claim equal width is "a property
		// of the container rather than of the four children" — that is FALSE for
		// grid ITEMS: the track is `1fr`, but `col-span-*`, `w-*`, `max-w-*` or
		// `justify-self-*` on a child overrides the stretch, and a wrapper element
		// takes the block out of the grid entirely. Any of those renders four
		// unequal blocks, or five tracks' worth on two rows, with the container
		// class untouched. jsdom cannot measure the result — but it CAN see every
		// one of these declarations, so they are the checkable half.
		for (const k of KEYS) {
			const b = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			expect(b).not.toBeNull();
			// A DIRECT child — no wrapper, no `display:contents` shim.
			expect(b?.parentElement).toBe(row);
			for (const t of (b?.getAttribute("class") ?? "").split(/\s+/)) {
				expect(t).not.toMatch(
					/^(col-span-|col-start-|col-end-|w-|max-w-|justify-self-)/,
				);
				// ⚠ `min-w-0` IS EXPLICITLY ALLOWED, and the first version of this
				// line banned it — reddening on correct code, which is how a guard
				// gets suppressed. `min-w-0` does not SET a width; it removes the
				// automatic minimum so the block may shrink TO its track, which is
				// what equal-width grid items need and what the label's `truncate`
				// requires. Any OTHER `min-w-*` is a floor that can break the track.
				if (t.startsWith("min-w-")) {
					expect(t).toBe("min-w-0");
				}
				expect(t).not.toMatch(/^(contents|hidden)$/);
			}
		}
	});

	it("resolver-cards::the-row-carries-a-CONTENT-FLOOR-not-min-h-0", () => {
		// ⛔⛔ THE REGRESSION THIS EXISTS FOR SHIPPED ONCE, and it was invisible.
		// With `min-h-0` this row's flex base is `0%`, so its hypothetical main size
		// is 0 and the STACK's content minimum is only its fixed children (~76px).
		// `scrollHeight` can then never exceed `clientHeight` at any realistic
		// viewport, which makes the stack's `overflow-y-auto` DEAD: every shortfall
		// gets absorbed by this row shrinking, and each block clips its own label
		// with no scrollbar anywhere to reach it. The band's spill goes to zero by
		// CLIPPING rather than by FITTING — which the height-chain guard names as a
		// failure in terms: "clipping to hit a number is a failure, not a pass".
		// ⚠ 97 IS MEASURED: a block's intrinsic content is padding 18 + square 44 +
		// gap 8 + text group 26.25 = 96.25px, rounded up. Below the floor the stack
		// scrolls, which is where the overflow was always supposed to go.
		// ⚠ THIS IS A CLASS ASSERTION FOR THE USUAL REASON — jsdom performs no
		// layout, so the clipping itself is unobservable here. The DECLARATION that
		// prevents it is the checkable thing; the rendered behaviour is measured in
		// a browser and reported in the run log.
		const { container } = render(<ResolverCards market={MARKET} />);
		const cls =
			container
				.querySelector('[data-testid="resolver-cards"]')
				?.getAttribute("class") ?? "";
		expect(cls).toContain("min-h-[97px]");
		// ⛔ And NOT the shape that disabled the backstop. `toContain` alone would
		// pass on `min-h-0 min-h-[97px]`, where the cascade decides which wins.
		expect(cls.split(/\s+/)).not.toContain("min-h-0");
	});

	it("resolver-cards::a-block-does-NOT-clip-its-own-content", () => {
		// The other half of the same fix. `overflow-hidden` on the block is what
		// made the compression silent — the label was cut and nothing reported it.
		// With the floor in place the clip is unreachable, and keeping an
		// unreachable clip on a placeholder whose content the content pass will
		// replace would just re-arm the trap for whoever fills these in.
		const { container } = render(<ResolverCards market={MARKET} />);
		for (const k of KEYS) {
			const el = container.querySelector(
				`[data-testid="resolution-block-${k}"]`,
			);
			// ⛔ CONTROL. `?? ""` on a missing block yields `[""]`, which does not
			// contain "overflow-hidden" — so this loop was green over four blocks
			// that did not exist (@test-writer).
			expect(el).not.toBeNull();
			expect((el?.getAttribute("class") ?? "").split(/\s+/)).not.toContain(
				"overflow-hidden",
			);
		}
	});

	it("resolver-cards::each-block-has-a-1-to-1-placeholder-a-label-and-a-value-line", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

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

			// ⛔ 1:1 STATED AS A RATIO, not as two equal lengths a later edit could
			// desynchronise. `aspect-square` is the declaration; `shrink-0` is what
			// stops a compressed row from squashing it into a rectangle, which is
			// the one way a 1:1 placeholder silently stops being 1:1.
			const gc = glyph?.getAttribute("class") ?? "";
			expect(gc).toContain("aspect-square");
			expect(gc).toContain("shrink-0");
			// ⛔ AND NO COMPETING LENGTH. `aspect-square` plus an explicit height is
			// over-determined, and whichever wins the ratio no longer decides the
			// shape. The first version banned only the ARBITRARY form (`h-[…]`), so
			// `aspect-square shrink-0 h-8 w-12` — a 32×48 rectangle — passed, and so
			// did `size-[30px]` paired with `aspect-square` (@test-writer).
			for (const t of gc.split(/\s+/)) {
				expect(t).not.toMatch(/^(h-|size-|min-h-|max-h-)/);
			}
			// Exactly one width declaration, so the square's one free length is
			// unambiguous.
			expect(gc.split(/\s+/).filter((t) => /^w-/.test(t))).toHaveLength(1);

			// The value row is EMPTY and unannounced — an empty announced row is
			// noise while the label beside it already names the slot.
			expect(value?.textContent).toBe("");
			expect(value?.getAttribute("aria-hidden")).toBe("true");
			expect(glyph?.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("resolver-cards::carries-the-four-PROVISIONAL-fixture-labels", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		// ⚠ These four are PROVISIONAL and are NOT copy-register entries — the
		// RESO-1 brief rules them out of canon explicitly. They are pinned here so
		// the fixture cannot silently empty itself, not because the words are
		// ratified.
		// ⛔⛔ EACH LABEL IS BOUND TO ITS OWN BLOCK. This asserted
		// `container.innerHTML).toContain(label)` over the whole row, which
		// `innerHTML` satisfies from ATTRIBUTE VALUES — a single
		// `aria-label="Resolution Resolver Closes Context"` on the row passed all
		// four with ZERO visible text — and which said nothing about WHICH block a
		// label sits in, so all four could render inside `closes` (@test-writer).
		for (const [k, label] of [
			["resolution", "Resolution"],
			["resolver", "Resolver"],
			["closes", "Closes"],
			["context", "Context"],
		] as const) {
			expect(
				container.querySelector(`[data-testid="resolution-block-label-${k}"]`)
					?.textContent,
			).toBe(label);
		}
	});

	it("resolver-cards::ships-none-of-the-mockups-MARKET-CONTENT", () => {
		const { container } = render(<ResolverCards market={MARKET} />);

		// ⛔⛔ POSITIVE CONTROL FIRST, AND THIS `it` WAS WHOLLY VACUOUS WITHOUT IT.
		// Every assertion below is a `not.toContain`, and all seven pass on a
		// component that renders NOTHING — which is not hypothetical here: this
		// file's v1 asserted `innerHTML === ""`, so rendering nothing is a state
		// this component has actually been in (@test-writer).
		expect(
			container.querySelector('[data-testid="resolver-cards"]'),
		).not.toBeNull();
		expect(container.innerHTML).toContain("Resolver");

		// ⛔ THE SURVIVING HALF OF THE ORIGINAL RULING, THROUGH THREE REVERSALS.
		// These four name a market this build does not have; porting them would be
		// inventing market content (CLAUDE.md §3), not finishing a row.
		for (const demo of [
			"Brihanmumbai Municipal Corporation",
			"Monthly operational bulletins",
			"BMC",
			"@mybmc",
		]) {
			expect(container.innerHTML).not.toContain(demo);
		}

		// ⚠ AND NOTHING FROM THE MARKET ITSELF LEAKED IN EITHER, which is the
		// RESO-1-specific version of the same rule: the blocks take a `market` prop
		// and must not render any of it. A `Closes` block quietly filled from
		// `resolution_deadline` would be a settlement date on the page — market
		// content, and Hrishikesh's (CLAUDE.md §3).
		expect(container.innerHTML).not.toContain(MARKET.title);
		expect(container.innerHTML).not.toContain(MARKET.description);
		expect(container.innerHTML).not.toContain(MARKET.slug);
	});
});

/**
 * RESO-1 · G-4 / R-12 — the blocks are NON-INTERACTIVE.
 *
 * ⛔ THE REASON IS NOT STYLE. Hyperlinking these is deferred by founder ruling,
 * and the X posts a Resolution block would target do not exist — the Zugzwang X
 * account has not been created. So a block that LOOKS clickable promises a
 * destination that cannot be built, and one that IS clickable does nothing.
 *
 * ⚠ THE APPEARANCE HALF IS ASSERTED AS WELL AS THE BEHAVIOUR HALF, because they
 * fail independently: `cursor-pointer` with no handler is silent to a handler
 * check, and a handler with no cursor is silent to a style check.
 */
describe("RESO-1 — R-12, the blocks are non-interactive", () => {
	it("resolver-cards::G-4-NOTHING-in-the-row-is-navigable-or-activatable", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		expect(row).not.toBeNull();

		// ⛔⛔ THE SCOPE INCLUDES THE ROW ITSELF, AND THAT IS THE WHOLE CORRECTION.
		// This used `row.querySelectorAll(...)`, which matches DESCENDANTS ONLY and
		// never the element it is called on — so the row could carry
		// `role="link" tabIndex={0} onClick={…} className="cursor-pointer"` and every
		// assertion here passed, because no CHILD had changed. @test-writer rated the
		// old version CANNOT FIRE on the two most likely clickable implementations,
		// and it was right: a click target on the container is the obvious way
		// someone "makes the blocks clickable".
		const scope = [
			row as Element,
			...Array.from(row?.querySelectorAll("*") ?? []),
		];
		expect(scope.length).toBeGreaterThan(4); // control: the scan has a subtree
		for (const el of scope) {
			expect(
				el.matches("a, button, [href], [onclick], [role], [tabindex]"),
			).toBe(false);
		}
	});

	it("resolver-cards::G-4-clicking-a-block-or-the-row-DOES-NOTHING", () => {
		// ⛔⛔ THE BEHAVIOURAL HALF, AND THE ONLY THING THAT CAN SEE A DELEGATED
		// HANDLER AT ALL. React attaches `onClick` at the root — there is NO
		// `onclick` attribute on the element — so an attribute scan structurally
		// cannot detect `<div onClick={…}>`, which needs neither `role` nor
		// `tabindex` to be clickable with a mouse. Only dispatching a click can.
		const open = vi.spyOn(window, "open").mockImplementation(() => null);
		try {
			const { container } = render(<ResolverCards market={MARKET} />);
			const row = container.querySelector('[data-testid="resolver-cards"]');
			for (const k of KEYS) {
				const el = container.querySelector(
					`[data-testid="resolution-block-${k}"]`,
				);
				expect(el).not.toBeNull(); // control
				fireEvent.click(el as Element);
			}
			fireEvent.click(row as Element);
			expect(open).not.toHaveBeenCalled();
		} finally {
			open.mockRestore();
		}
	});

	it("resolver-cards::G-4-no-block-LOOKS-clickable-either", () => {
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		const scope = [
			row as Element,
			...Array.from(row?.querySelectorAll("*") ?? []),
		];
		expect(scope.length).toBeGreaterThan(4); // control

		// ⛔ MATCH A CLASS TOKEN AGAINST A PATTERN, NOT A SUBSTRING AGAINST THE
		// WHOLE STRING. This asserted `not.toContain("cursor-pointer")` and
		// `not.toContain("hover:")` on the block's class string, which Tailwind's
		// arbitrary forms walk straight past: `[cursor:pointer]` contains no
		// "cursor-pointer", and `[&:hover]:bg-n1` contains no "hover:" (it is
		// "hover]" then ":"). Both render a block that looks and behaves clickable.
		// ⚠ AND IT COVERS THE ROW NOW TOO, for the same reason as the test above.
		for (const el of scope) {
			for (const t of (el.getAttribute("class") ?? "").split(/\s+/)) {
				expect(t).not.toMatch(/cursor|hover|focus|active|group-hover/);
			}
		}
	});

	it("resolver-cards::G-4-the-scan-is-ALIVE", () => {
		// ⛔ NON-VACUITY FOR THE WHOLE DESCRIBE (OVN-V1). Every assertion above is a
		// `toHaveLength(0)` or a `not.toContain`, and all of them pass on a
		// component that renders NOTHING AT ALL — which is exactly what this file's
		// v1 asserted, so it is a real state this component has been in. This is the
		// positive control: the row exists and has four children to scan.
		const { container } = render(<ResolverCards market={MARKET} />);
		const row = container.querySelector('[data-testid="resolver-cards"]');
		expect(row).not.toBeNull();
		expect(row?.children.length).toBe(4);
		// ⚠ THE `innerHTML.length > 200` THAT STOOD HERE IS REPLACED. @test-writer
		// called it near-cosmetic and it was: four empty shells clear 200 characters
		// on their ATTRIBUTES alone, so it could not distinguish "has content" from
		// "has testids". Rendered TEXT is the thing that would be missing.
		expect((row?.textContent ?? "").trim()).toContain("Resolution");
		expect((row?.textContent ?? "").trim().length).toBeGreaterThan(20);
	});
});
