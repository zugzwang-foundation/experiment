// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SideBadge } from "@/components/debate/badges";

/**
 * DISCOVERY-COMPLETE C3 — V10 (entry price on the chip) and V11 (the Discovery
 * hero chip geometry). Both additions are OPT-IN, so the call sites that
 * pass neither prop render exactly what they rendered before.
 *
 * COUNTED INVENTORY, accurate at PR head. `SideBadge` has THIRTEEN render
 * sites across TEN consumer files, plus the definition. C3 changes exactly one
 * of them — `discovery/HeroPanels.tsx:137`, which opts into both new props. Four
 * more (`bookmarks/BookmarkCard.tsx:32,46`, `profile/ArgumentList.tsx:49,59`)
 * are NEW call sites minted by C4/C4b, which adopt this primitive to fix the
 * INV-3 inversion — they are intended changes, not deltas to preserve. The
 * remaining EIGHT pass neither prop and must render exactly what they rendered
 * before; the first describe below is their zero-delta proof, asserted on the
 * class tail this component owns.
 *
 * (The plan said "9 files / 8 consumers". That was true when the plan was
 * written and is stale at PR head BECAUSE C4/C4b adopted the primitive in this
 * same PR. Corrected here rather than left to drift — counted inventories are
 * load-bearing in this repo, which is C0's whole point.)
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

/**
 * The class tail `SideBadge` itself contributes, in the exact order it
 * contributed it before C3. Everything to the left of this is the shadcn
 * `badgeVariants` base, which C3 does not touch and which is deliberately NOT
 * pinned here — pinning it would redden this suite on an unrelated shadcn bump,
 * and a guard that reddens on correct code gets suppressed.
 *
 * The FULL rendered `outerHTML` was proven byte-identical to the component at
 * origin/main aff76b3 during C3, for both poles, by rendering the two versions
 * side by side. That was a one-time proof; this is the standing guard for the
 * part a future SideBadge edit could actually move.
 */
const OWNED_TAIL =
	"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)] bg-yes text-no";

describe("SideBadge — the eight untouched call sites have a zero delta", () => {
	it("bare-yes-render-is-unchanged", () => {
		const { container } = render(<SideBadge side="YES" />);
		const badge = container.firstElementChild;
		expect(badge?.textContent).toBe("YES");
		expect(badge?.getAttribute("aria-label")).toBe("YES side");
		// Ends with the owned tail, in order — the hairline did not migrate and
		// the geometry did not change.
		expect(badge?.getAttribute("class")?.endsWith(OWNED_TAIL)).toBe(true);
	});

	it("bare-no-render-is-unchanged", () => {
		const { container } = render(<SideBadge side="NO" />);
		const badge = container.firstElementChild;
		expect(badge?.textContent).toBe("NO");
		expect(badge?.getAttribute("aria-label")).toBe("NO side");
		expect(
			badge
				?.getAttribute("class")
				?.endsWith(
					"rounded-sm px-1.5 font-mono text-[10px] tracking-wide [border:var(--hairline)] bg-no text-yes",
				),
		).toBe(true);
	});
});

describe("SideBadge — INV-3, the side stays pole-bound whatever else is added", () => {
	it("poles-are-never-semantic-or-neutral-in-any-prop-combination", () => {
		const CASES = [
			{ side: "YES" as const, expected: "bg-yes text-no" },
			{ side: "NO" as const, expected: "bg-no text-yes" },
		];
		for (const { side, expected } of CASES) {
			for (const props of [
				{},
				{ price: "0.270000000000000000" },
				{ size: "hero" as const },
				{ size: "hero" as const, price: "0.270000000000000000" },
			]) {
				const { container } = render(<SideBadge side={side} {...props} />);
				const cls = container.firstElementChild?.getAttribute("class") ?? "";
				expect(cls).toContain(expected);
				// The C0 defect class: a side must never resolve through a shadcn
				// semantic variant or a neutral-ramp token. Matched on EXACT class
				// tokens — `badgeVariants` ships `[a]:hover:bg-primary/80`, which
				// contains the substring "bg-primary" while being a different rule,
				// so a substring assertion here would report a defect that is not
				// there (O-3).
				const tokens = cls.split(/\s+/).filter(Boolean);
				expect(tokens).not.toContain("bg-primary");
				expect(tokens).not.toContain("bg-secondary");
				expect(tokens).not.toContain("bg-ink");
				cleanup();
			}
		}
	});
});

describe("SideBadge — V10, the entry price", () => {
	it("yes-renders-its-entry-price-raw", () => {
		const { container } = render(
			<SideBadge side="YES" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("YES @ 27%");
	});

	it("no-renders-its-entry-price-RAW-never-a-derived-complement", () => {
		// The load-bearing assertion of V10, and it points the OPPOSITE way to the
		// first draft of this file. `bets.price_at_bet` stores
		// `computeBuy(...).pEff` for the side BOUGHT (bets/place.ts:162 ->
		// cpmm/calculate.ts:73-97, `a = reserves[side]`), so a NO bet ALREADY
		// stores the NO price. Deriving `100 - x` here would print `NO @ 73%` for
		// an author who entered NO at 27% — a factually false figure attributed to
		// a named pseudonym on a public surface, and one that disagrees with the
		// .md export rendering the same field raw (debate-export/serialize.ts:320).
		const { container } = render(
			<SideBadge side="NO" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("NO @ 27%");
	});

	it("both-poles-render-the-same-stored-value-identically", () => {
		// The side selects the POLE COLOUR, never the number. Two bets that
		// executed at the same effective price read the same, whichever side they
		// were on.
		const P = "0.525000000000000000";
		const { container: yes } = render(<SideBadge side="YES" price={P} />);
		expect(yes.firstElementChild?.textContent).toBe("YES @ 53%");
		cleanup();
		const { container: no } = render(<SideBadge side="NO" price={P} />);
		expect(no.firstElementChild?.textContent).toBe("NO @ 53%");
	});

	it("aria-label-carries-the-side-and-the-price", () => {
		const { container } = render(
			<SideBadge side="YES" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.getAttribute("aria-label")).toBe(
			"YES side, entry price 27%",
		);
	});

	it("absent-price-renders-the-bare-side", () => {
		// Sites 7-9 (DebateColumn, BetComposer, SellModule) have no entry price in
		// existence; a required prop would force them to invent one.
		const { container } = render(<SideBadge side="YES" />);
		expect(container.firstElementChild?.textContent).toBe("YES");
		expect(container.firstElementChild?.textContent).not.toContain("@");
	});
});

describe("SideBadge — V11, the Discovery hero geometry", () => {
	it("hero-applies-the-sidechip-md-numbers", () => {
		// `.sidechip.md` — 9px / 2px 7px / .06em / 800 (mockup :115-116).
		const { container } = render(<SideBadge side="YES" size="hero" />);
		const cls = container.firstElementChild?.getAttribute("class") ?? "";
		expect(cls).toContain("text-[9px]");
		expect(cls).toContain("px-[7px]");
		expect(cls).toContain("py-[2px]");
		expect(cls).toContain("tracking-[0.06em]");
		expect(cls).toContain("font-extrabold");
		expect(cls).toContain("rounded-[var(--r)]");
	});

	it("hero-does-not-leak-into-the-default", () => {
		const { container } = render(<SideBadge side="YES" />);
		const cls = container.firstElementChild?.getAttribute("class") ?? "";
		expect(cls).not.toContain("text-[9px]");
		expect(cls).not.toContain("px-[7px]");
		expect(cls).toContain("text-[10px]");
	});

	it("the-hairline-edge-survives-in-both-geometries", () => {
		// Without it the black YES fill is invisible on the n0 card
		// (values-log v0_3 §3).
		for (const size of [undefined, "hero" as const]) {
			const { container } = render(<SideBadge side="YES" size={size} />);
			expect(container.firstElementChild?.getAttribute("class")).toContain(
				"[border:var(--hairline)]",
			);
			cleanup();
		}
	});
});
