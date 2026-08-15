// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { IdentityCard } from "@/components/profile/IdentityCard";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import type { ProfileUser } from "@/server/profile/resolve";
import type { ProfileTiles as ProfileTilesData } from "@/server/profile/tiles";

/**
 * HTML-FINISH · PROFILE — the arrangement guards, one per shipped row.
 *
 * ⚠ THESE ASSERT ON `innerHTML` / element ORDER, NEVER ON `textContent`
 * (CLAUDE.md §8 O-7). Every row here is a COMPOSITION delta — which element
 * wraps which, and in what order — and `textContent` flattens exactly the
 * markup that carries the meaning. A `textContent` assertion on row 15 or
 * row 19 passes on the pre-change build it was written to reject.
 *
 * ⚠ NO VALUE IS ASSERTED. These guards pin topology (`auto-rows-fr`, sibling
 * order, nesting) and never a colour, radius, px or type size — the mockups
 * are light-mode prototypes (DESIGN.B1) and the shipped system owns the
 * values, so a guard that pinned one would pin the wrong thing.
 *
 * Fixtures are INLINE plain objects on the shipped `src/server/profile/*` DTOs
 * (type-only imports — no server code executes; NO DB), matching the posture of
 * `surface.test.tsx`. No market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const TILES: ProfileTilesData = {
	walletValue: "500.000000000000000000",
	positionsValue: "120.000000000000000000",
	netProfitLoss: "-30.000000000000000000",
	argumentsCount: { total: 5, posts: 3, replies: 2 },
	supportReceived: "40.000000000000000000",
	counterReceived: "12.000000000000000000",
};

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

/** The index of `child` among its parent's element children. */
function indexOf(child: Element): number {
	const parent = child.parentElement;
	if (parent === null) {
		throw new Error("indexOf: element has no parent");
	}
	return [...parent.children].indexOf(child);
}

describe("HTML-FINISH profile row 15 — the tile value sits ABOVE its label", () => {
	it("row15::value-node-precedes-label-node-in-every-tile", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// Every tile, not just one: the swap lives in the shared `Tile` leaf, so a
		// guard over a single tile would pass on a per-tile regression.
		const tiles = [...grid.children];
		expect(tiles.length).toBe(6);
		for (const tile of tiles) {
			const [first, second] = [...tile.children];
			if (first === undefined || second === undefined) {
				throw new Error("row15: a tile has fewer than two element children");
			}
			// The LABEL is the muted `text-n5` span; the VALUE is the emphasised
			// `text-ink` one. Asserted by CLASS ROLE rather than by reading the
			// strings, so the guard cannot be greened by re-typing a label.
			expect(
				second.className,
				`row 15: the second child of a tile must be the LABEL span. Got ` +
					`"${second.className}" — the label/value order has flipped back.`,
			).toContain("text-n5");
			expect(first.className).toContain("text-ink");
		}
	});

	it("row15::POSITIVE-CONTROL-the-order-check-detects-the-pre-change-order", () => {
		// ⚠ PROOF BY REVERSAL. The assertion above is a claim about ORDER, and an
		// order claim that has never been run against the other order is
		// indistinguishable from one that cannot fail. This runs the same
		// predicate over a deliberately label-first fragment.
		const { container } = render(
			<div data-testid="control-tile">
				<span className="text-xs text-n5">Wallet value</span>
				<span className="font-medium text-ink tabular-nums">Đ 500</span>
			</div>,
		);
		const tile = container.querySelector('[data-testid="control-tile"]');
		if (tile === null) {
			throw new Error("row15 control: fixture did not render");
		}
		const [first, second] = [...tile.children];
		// The real guard demands `text-n5` SECOND; the pre-change order has it
		// first, so the same predicate is false here.
		expect(second?.className).not.toContain("text-n5");
		expect(first?.className).toContain("text-n5");
	});
});

describe("HTML-FINISH profile row 16 — the PFP fills the band as a square", () => {
	/**
	 * ⚠ A CLASS-PRESENCE GUARD, AND THE LIMIT IS STATED. jsdom performs NO
	 * layout — it resolves no percentage height, no `aspect-ratio` and no
	 * Tailwind utility — so this cannot prove the rendered box is square. It
	 * proves the DECLARATION is intact, which is the drift this file can see;
	 * the rendered geometry is proven in a browser against compiled CSS
	 * (`discovery-height-chain.test.ts:19-24` states the same limit).
	 */
	it("row16::pfp-is-height-driven-and-ratio-derived", () => {
		render(<IdentityCard user={USER} owner={false} />);
		const card = screen.getByTestId("identity-card");
		const pfp = card.querySelector("img");
		if (pfp === null) {
			throw new Error("row16: the identity card renders no <img>");
		}
		const classes = pfp.className.split(/\s+/);
		// The mockup's three declarations (`:191`), each ported as topology.
		expect(classes).toContain("h-full");
		expect(classes).toContain("aspect-square");
		expect(classes).toContain("shrink-0");
		// `w-auto` is what hands the width back to the ratio — without it the
		// `width={56}` presentational hint pins both axes and `aspect-ratio` is
		// ignored. Pinned by name because dropping it is a SILENT regression:
		// the element still renders, at the old fixed size.
		expect(
			classes,
			`row 16: \`w-auto\` is missing, so the width={56} attribute pins the ` +
				`box and aspect-square is inert. The PFP is back at a fixed size.`,
		).toContain("w-auto");
		// The fixed box must be GONE — its survival would win over the ratio.
		expect(classes).not.toContain("size-14");
		expect(classes).not.toContain("h-14");
	});

	it("row16::the-intrinsic-ratio-hint-attributes-survive", () => {
		// Deliberately asserted: `w-auto` only works BECAUSE the attributes are a
		// hint rather than an author rule, so a future reader must not "clean up"
		// the attributes on the theory that the CSS replaced them. They are the
		// pre-load ratio hint that keeps the identity band from shifting.
		render(<IdentityCard user={USER} owner={false} />);
		const pfp = screen.getByTestId("identity-card").querySelector("img");
		expect(pfp?.getAttribute("width")).toBe("56");
		expect(pfp?.getAttribute("height")).toBe("56");
	});

	it("row16::POSITIVE-CONTROL-the-pre-change-class-list-fails", () => {
		// ⚠ PROOF BY REVERSAL over the REAL class string this row replaced.
		const before = "size-14 rounded-[var(--imgr)] bg-n1".split(/\s+/);
		expect(before).not.toContain("h-full");
		expect(before).not.toContain("aspect-square");
		expect(before).not.toContain("w-auto");
		expect(before).toContain("size-14");
	});
});

describe("HTML-FINISH profile row 18 — the two tile rows share one height", () => {
	it("row18::grid-declares-equal-implicit-rows", () => {
		render(<ProfileTiles tiles={TILES} />);
		const grid = screen.getByTestId("profile-tiles");
		// The mockup's `grid-auto-rows:1fr` (`:204`). A RULE, not a number — the
		// class is pinned by name because that is the whole declaration.
		expect(
			grid.className.split(/\s+/),
			`row 18: the tile grid must declare \`auto-rows-fr\` so both rows share ` +
				`one height. Without it each row sizes to its own tallest tile.`,
		).toContain("auto-rows-fr");
	});
});

describe("HTML-FINISH profile row 19 — the Arguments breakdown is its own element", () => {
	it("row19::breakdown-is-a-nested-element-inside-the-value-node", () => {
		render(<ProfileTiles tiles={TILES} />);
		const value = screen.getByTestId("tile-arguments-value");
		const breakdown = screen.getByTestId("tile-arguments-breakdown");
		// O-7: the seam is only visible in the MARKUP. `textContent` on the value
		// node is byte-identical before and after this row, by design.
		expect(value.innerHTML).toContain("tile-arguments-breakdown");
		expect(breakdown.parentElement).toBe(value);
		expect(indexOf(breakdown)).toBeGreaterThanOrEqual(0);
	});

	it("row19::the-SPEC-pinned-string-is-unchanged-by-the-nesting", () => {
		// SPEC.1 §23 pins `N (P Posts | R Replies)`. The nesting must add markup
		// and NOTHING else — this is the clause that makes row 19 shippable
		// without a spec amendment.
		render(<ProfileTiles tiles={TILES} />);
		expect(screen.getByTestId("tile-arguments-value").textContent).toBe(
			"5 (3 Posts | 2 Replies)",
		);
	});

	it("row19::POSITIVE-CONTROL-a-flat-string-fails-the-nesting-check", () => {
		// The pre-change build rendered one flat string. Same predicate, and it
		// must be false — otherwise the guard above is asserting nothing.
		const { container } = render(
			<span data-testid="control-flat">5 (3 Posts | 2 Replies)</span>,
		);
		const flat = container.querySelector('[data-testid="control-flat"]');
		if (flat === null) {
			throw new Error("row19 control: fixture did not render");
		}
		expect(flat.innerHTML).not.toContain("tile-arguments-breakdown");
		// ⚠ AND the textContent read — the assertion a careless guard would have
		// used — passes on the flat form. That is the point of O-7, demonstrated.
		expect(flat.textContent).toBe("5 (3 Posts | 2 Replies)");
	});
});
