// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SideBadge } from "@/components/debate/badges";

/**
 * DISCOVERY-COMPLETE C3 — V10 (entry price on the chip) and V11 (the Discovery
 * hero chip geometry). Both additions are OPT-IN, so the eight call sites that
 * pass neither prop render exactly what they rendered before.
 *
 * `SideBadge` has NINE files in its blast radius (the definition + eight
 * consumers) and exactly ONE of them changes: `discovery/HeroPanels.tsx:136`.
 * The first describe below is the zero-delta proof for the other eight — the
 * bare `<SideBadge side={…} />` render is asserted byte-for-byte.
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
	it("yes-renders-its-own-entry-price", () => {
		// `price_at_bet` is the canonical YES probability, so a YES author's own
		// entry price IS that value.
		const { container } = render(
			<SideBadge side="YES" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("YES @ 27%");
	});

	it("no-renders-the-DERIVED-complement-not-the-raw-yes-probability", () => {
		// The load-bearing assertion of V10. A NO author who bought at YES=27%
		// entered NO at 73%. Rendering the raw 27% beside the literal "NO" would
		// print a wrong number next to a pole — the defect class of this PR.
		const { container } = render(
			<SideBadge side="NO" price="0.270000000000000000" />,
		);
		expect(container.firstElementChild?.textContent).toBe("NO @ 73%");
	});

	it("the-pair-sums-to-100-at-an-exact-tie", () => {
		// PCT.ROUND (SPEC.1 §10.8): independent per-side half-up rounding renders
		// 101% at any exact .xx5 tie. Deriving NO from YES cannot.
		const TIE = "0.525000000000000000";
		const { container: yes } = render(<SideBadge side="YES" price={TIE} />);
		expect(yes.firstElementChild?.textContent).toBe("YES @ 53%");
		cleanup();
		const { container: no } = render(<SideBadge side="NO" price={TIE} />);
		expect(no.firstElementChild?.textContent).toBe("NO @ 47%");
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
