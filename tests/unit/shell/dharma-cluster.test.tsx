// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	// HeaderNav's Back control.
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { DharmaCluster } from "@/components/shell/DharmaCluster";
import { GlobalHeader } from "@/components/shell/GlobalHeader";

/**
 * T4 + T5 + T6 (HEADER-PORTFOLIO §7) — the signed-in Đ cluster.
 *
 * T4 is the §21.1 anti-conflation guard (SG5), and it exists because the
 * failure it catches is SILENT. The hairline divider in `GlobalHeader` is the
 * register boundary, not decoration: `VisitorCounter` "reads nothing from the
 * ledger / engine" and its muted register is "load-bearing anti-conflation, not
 * styling". BOTH Đ figures are engine-derived, so putting either right of the
 * divider would file a real Đ figure and a vanity page-hit count in the same
 * visual bucket — exactly what §21.1 forbids, and NO other test would notice.
 * The locked W2.4/.5/.14 mockup settles the full order — `d-cluster` → `ident`
 * → divider → `visitor` — and its own annotation states the mechanism: "§21.1 —
 * visitor count held off the Đ cluster BY THE IDENTITY CHIP + DIVIDER". So the
 * order lives here as an assertion rather than as prose someone can violate.
 *
 * T5 pins the two-stat anatomy: Portfolio before Balance in DOM order, under
 * exactly ONE cluster glyph. It REPLACES the shipped inverted assertion
 * (`expect(cluster.textContent).not.toContain("Portfolio")`), which encoded the
 * empty slot this task fills.
 *
 * T6 pins the null matrix (R9). The cluster's render gate is BALANCE's null,
 * not Portfolio's: a failed Portfolio read must DEGRADE to Balance-only, never
 * blank the working half, and a Portfolio of zero must render `Đ 0` — zero is a
 * fact, absence is a different fact.
 *
 * NO `jest-dom` IN THIS REPO. `toBeInTheDocument()` / `toBeDisabled()` /
 * `toHaveTextContent()` and that whole matcher family are UNAVAILABLE — every
 * assertion below is plain DOM (`textContent`, `getAttribute`, `querySelector`,
 * `children`) plus `screen.getByTestId` / `queryByTestId` (AGENTS.md §9).
 */

afterEach(cleanup);

beforeEach(() => {
	// VisitorCounter POSTs /api/visits on mount.
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => ({ json: async () => ({ total: 1 }) })),
	);
});

const VIEWER = { pseudonym: "RedFox001" };

// LABEL TEXT IS THE COPY REGISTER; UPPERCASE IS ITS RENDERING. Plan §6.2 says
// exactly that — "the copy register's `Portfolio` · `Balance` is the label
// identity, uppercase is its rendering" — and the mockup agrees: `.lab` carries
// `text-transform:uppercase` over DOM text `Portfolio` (mockup `:271`, CSS
// `:128`). The §6.2 ASCII block's `<span>PORTFOLIO</span>` depicts the RENDERED
// anatomy, the same way its sibling line depicts `Đ {formatDharma(portfolio)}`
// rather than literal DOM text. The repo house style is unanimous across five
// shipped labels — `RadioSlot.tsx:29` "Radio", `PositionStrip.tsx:44,61` "To
// win"/"Your position", `SellModule.tsx:263,278` "Position"/"You receive" — all
// title-case text under a Tailwind `uppercase` class. So the DOM text is pinned
// here and the `uppercase` class is pinned separately in T5; both halves of the
// contract are asserted, and jsdom cannot see Tailwind so the class check is the
// only way the rendering half is checkable at all.
const PORTFOLIO_LABEL = "Portfolio";
const BALANCE_LABEL = "Balance";

function rightZoneChildren(): Element[] {
	const cluster = screen.getByTestId("dharma-cluster");
	const zone = cluster.parentElement;
	expect(zone).not.toBeNull();
	return Array.from(zone?.children ?? []);
}

/** Every element inside the cluster, in DOCUMENT order. */
function clusterElements(cluster: HTMLElement): Element[] {
	return Array.from(cluster.querySelectorAll("*"));
}

/**
 * The LEAF element whose entire trimmed text is `label`. The leaf constraint
 * (`children.length === 0`) stops an ancestor whose whole subtree text happens
 * to equal the label from matching.
 */
function labelElement(
	cluster: HTMLElement,
	label: string,
): Element | undefined {
	return clusterElements(cluster).find(
		(el) => el.children.length === 0 && el.textContent?.trim() === label,
	);
}

/** The stat COLUMN containing a label — label + value together (plan §6.2). */
function statBlock(cluster: HTMLElement, label: string): Element | null {
	return labelElement(cluster, label)?.parentElement ?? null;
}

describe("T4 — §21.1 header right-zone DOM order (SG5)", () => {
	it("orders-dharma-cluster-then-identity-then-divider-then-visitor", () => {
		render(
			<GlobalHeader
				viewer={VIEWER}
				portfolio="2480.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);

		const kids = rightZoneChildren();
		const idx = (el: Element | null) => (el === null ? -1 : kids.indexOf(el));

		const cluster = idx(screen.getByTestId("dharma-cluster"));
		const identity = idx(screen.getByTestId("identity-chip-link"));
		const visitor = idx(screen.getByTestId("visitor-counter"));
		// The divider carries no testid and MUST NOT gain one — it is a named
		// untouchable (SG6). It is the hairline `w-px` rule in the right zone.
		const divider = kids.findIndex((el) =>
			el.getAttribute("class")?.includes("w-px"),
		);

		expect(cluster).toBeGreaterThanOrEqual(0);
		expect(identity).toBeGreaterThanOrEqual(0);
		expect(visitor).toBeGreaterThanOrEqual(0);
		expect(divider).toBeGreaterThanOrEqual(0);

		// SG5, the load-bearing half: BOTH engine-derived figures LEFT of the
		// divider (they live inside the single cluster node), VisitorCounter the
		// SOLE element to its right.
		expect(cluster).toBeLessThan(divider);
		expect(visitor).toBeGreaterThan(divider);
		expect(kids.slice(divider + 1)).toEqual([
			screen.getByTestId("visitor-counter"),
		]);

		// The locked-mockup order: the identity chip sits BETWEEN the Đ cluster
		// and the divider, which is the stated §21.1 mechanism.
		expect(cluster).toBeLessThan(identity);
		expect(identity).toBeLessThan(divider);
	});

	it("both-stats-live-inside-the-single-node-left-of-the-divider", () => {
		// Said structurally rather than by index: neither figure can drift right
		// of the boundary without leaving the cluster node entirely.
		render(
			<GlobalHeader
				viewer={VIEWER}
				portfolio="2480.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);

		const cluster = screen.getByTestId("dharma-cluster");
		expect(statBlock(cluster, PORTFOLIO_LABEL)).not.toBeNull();
		expect(statBlock(cluster, BALANCE_LABEL)).not.toBeNull();

		const kids = rightZoneChildren();
		const divider = kids.findIndex((el) =>
			el.getAttribute("class")?.includes("w-px"),
		);
		expect(kids.indexOf(cluster)).toBeLessThan(divider);
	});

	it("signed-out-header-renders-no-cluster-and-keeps-the-divider-boundary", () => {
		const { container } = render(<GlobalHeader viewer={null} />);

		// No prop passed at all — the `(auth)` layout mounts the header this way
		// (SG7: that layout passes NEITHER prop).
		expect(screen.queryByTestId("dharma-cluster")).toBeNull();

		// The divider still separates JOIN from the counter.
		const join = container.querySelector('a[href="/sign-in"]');
		const zone = join?.parentElement;
		const kids = Array.from(zone?.children ?? []);
		const divider = kids.findIndex((el) =>
			el.getAttribute("class")?.includes("w-px"),
		);
		expect(kids.indexOf(join as Element)).toBeLessThan(divider);
		expect(kids.slice(divider + 1)).toEqual([
			screen.getByTestId("visitor-counter"),
		]);
	});
});

describe("T5 — two stats, Portfolio before Balance, one cluster glyph", () => {
	it("renders-portfolio-before-balance-in-DOM-order", () => {
		render(
			<DharmaCluster
				portfolio="2480.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);
		const cluster = screen.getByTestId("dharma-cluster");

		const portfolioLabel = labelElement(cluster, PORTFOLIO_LABEL);
		const balanceLabel = labelElement(cluster, BALANCE_LABEL);
		expect(portfolioLabel).toBeDefined();
		expect(balanceLabel).toBeDefined();

		// POSITIONAL, not string-containment order: `textContent.indexOf` would
		// pass for a cluster that happened to mention the words in that sequence
		// anywhere. `querySelectorAll("*")` is document order.
		const order = clusterElements(cluster);
		expect(order.indexOf(portfolioLabel as Element)).toBeLessThan(
			order.indexOf(balanceLabel as Element),
		);
		// PORTFOLIO FIRST is the ratified two-stat order (plan §3, §6.2).
		expect(order.indexOf(portfolioLabel as Element)).toBeGreaterThanOrEqual(0);

		// The rendering half of the label contract (see the LABEL constants
		// above): the copy register is title case, the mockup's `.lab` renders it
		// uppercase. jsdom applies no Tailwind, so the class IS the assertion.
		expect(portfolioLabel?.getAttribute("class")).toContain("uppercase");
		expect(balanceLabel?.getAttribute("class")).toContain("uppercase");
	});

	it("renders-both-figures-through-formatDharma", () => {
		render(
			<DharmaCluster
				portfolio="2480.400000000000000000"
				spendable="610.400000000000000000"
			/>,
		);
		const cluster = screen.getByTestId("dharma-cluster");

		// `formatDharma` is the single shared 0-dp renderer (DROUND / SPEC.1
		// §10.8) and BOTH figures go through it — a raw NUMERIC(38,18) string in
		// the header would read `2480.400000000000000000`.
		const portfolio = statBlock(cluster, PORTFOLIO_LABEL);
		expect(portfolio?.textContent).toContain("2480");
		expect(portfolio?.textContent).not.toContain("2480.4");

		const balance = statBlock(cluster, BALANCE_LABEL);
		expect(balance?.textContent).toContain("610");
		expect(balance?.textContent).not.toContain("610.4");

		// R4 — UNGROUPED, matching the §23 Positions-value tile and the shipped
		// Balance. The mockup's `Đ 2,480` is tier-4 illustrative; grouping is
		// class R, routed to POLISH.
		expect(cluster.textContent).not.toContain("2,480");
	});

	it("carries-exactly-one-standalone-cluster-glyph", () => {
		render(
			<DharmaCluster
				portfolio="2480.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);
		const cluster = screen.getByTestId("dharma-cluster");

		// COUNT ELEMENTS, NOT CHARACTERS. Per the mockup each stat VALUE also
		// carries its own `Đ` (`Đ 2,480`), so a naive count of `Đ` occurrences in
		// `textContent` is 3, not 1. What the mockup specifies is ONE standalone
		// glyph element beside the hairline separator — so count elements whose
		// OWN entire text is exactly `Đ`. Do not "fix" this to a substring count.
		const glyphs = clusterElements(cluster).filter(
			(el) => el.children.length === 0 && el.textContent?.trim() === "Đ",
		);
		expect(glyphs).toHaveLength(1);

		// And the values still carry theirs — three `Đ` characters in total.
		expect((cluster.textContent?.match(/Đ/g) ?? []).length).toBe(3);
	});
});

describe("T6 — the null matrix (R9: zero ≠ absence)", () => {
	it("renders-nothing-when-both-are-null", () => {
		const { container } = render(
			<DharmaCluster portfolio={null} spendable={null} />,
		);
		expect(container.firstChild).toBeNull();
	});

	it("renders-nothing-when-spendable-is-null-even-with-a-portfolio", () => {
		// THE CELL THAT CATCHES A WRONG GATE. The cluster's existence is governed
		// by BALANCE's null (no `dharma_ledger` row — pre-grant / mid-signup), not
		// by Portfolio's. A gate written as `portfolio === null` or as
		// `portfolio === null && spendable === null` passes every other cell here
		// and fails only this one.
		const { container } = render(
			<DharmaCluster portfolio="2480.000000000000000000" spendable={null} />,
		);
		expect(container.firstChild).toBeNull();
		expect(screen.queryByTestId("dharma-cluster")).toBeNull();
	});

	it("degrades-to-balance-only-when-portfolio-is-null", () => {
		// A FAILED Portfolio read must never blank the working half (R8 + R9).
		render(
			<DharmaCluster portfolio={null} spendable="610.000000000000000000" />,
		);
		const cluster = screen.getByTestId("dharma-cluster");

		expect(statBlock(cluster, BALANCE_LABEL)?.textContent).toContain("610");
		expect(labelElement(cluster, PORTFOLIO_LABEL)).toBeUndefined();
		expect(cluster.textContent).not.toContain(PORTFOLIO_LABEL);
		// No placeholder for the missing half — `Portfolio —` is worse than absence.
		expect(cluster.textContent).not.toContain("—");
	});

	it("renders-a-zero-portfolio-as-Đ-0-not-blank-and-not-a-dash", () => {
		// R9's whole point. A viewer holding no open positions has a TRUE figure.
		render(<DharmaCluster portfolio="0" spendable="610.000000000000000000" />);
		const cluster = screen.getByTestId("dharma-cluster");

		const portfolio = statBlock(cluster, PORTFOLIO_LABEL);
		expect(portfolio).not.toBeNull();
		expect(portfolio?.textContent).toContain("Đ 0");
		expect(portfolio?.textContent).not.toContain("—");
		expect(cluster.textContent).not.toContain("—");
	});

	it("renders-a-canonical-18dp-zero-as-Đ-0-too", () => {
		// The value the read module actually returns for "no open positions" is
		// the canonical 18-dp zero, not the string "0".
		render(
			<DharmaCluster
				portfolio="0.000000000000000000"
				spendable="610.000000000000000000"
			/>,
		);
		const cluster = screen.getByTestId("dharma-cluster");

		expect(statBlock(cluster, PORTFOLIO_LABEL)?.textContent).toContain("Đ 0");
		expect(cluster.textContent).not.toContain("0.000000000000000000");
		expect(cluster.textContent).not.toContain("—");
	});
});
