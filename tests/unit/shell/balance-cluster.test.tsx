// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	usePathname: () => "/",
	// HeaderNav's Back control.
	useRouter: () => ({ back: () => {}, push: () => {} }),
}));

import { BalanceCluster } from "@/components/shell/BalanceCluster";
import { GlobalHeader } from "@/components/shell/GlobalHeader";

/**
 * T4 + T6 render half (SHELL-COMPLETE §7).
 *
 * T4 is the §21.1 anti-conflation guard (SG8), and it exists because the
 * failure it catches is SILENT. The hairline divider in `GlobalHeader` is the
 * register boundary, not decoration: `VisitorCounter` "reads nothing from the
 * ledger / engine" and its muted register is "load-bearing anti-conflation, not
 * styling". The spendable figure IS ledger-derived, so putting it right of the
 * divider would file a real Đ figure and a vanity page-hit count in the same
 * visual bucket — exactly what §21.1 forbids, and NO existing test would notice.
 *
 * The full order is pinned, not just the divider relation, because the plan's
 * mechanical note ("insert between :51 and :52") contradicts its own "Final
 * order: [BalanceCluster] [IdentityCluster] │ [VisitorCounter]" and its
 * cluster-before-chip paragraph. The locked W2.4/.5/.14 mockup settles it —
 * `d-cluster` → `ident` → divider → `visitor` — and its own annotation states
 * the mechanism: "§21.1 — visitor count held off the Đ cluster BY THE IDENTITY
 * CHIP + DIVIDER". Cluster-before-chip is therefore load-bearing for the very
 * guard SG8 protects, so the order lives here as an assertion rather than as
 * prose someone can silently violate.
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

function rightZoneChildren(): Element[] {
	const balance = screen.getByTestId("balance-cluster");
	const zone = balance.parentElement;
	expect(zone).not.toBeNull();
	return Array.from(zone?.children ?? []);
}

describe("T4 — §21.1 header right-zone DOM order (SG8)", () => {
	it("orders-balance-then-identity-then-divider-then-visitor", () => {
		render(<GlobalHeader viewer={VIEWER} spendable="610.000000000000000000" />);

		const kids = rightZoneChildren();
		const idx = (el: Element | null) => (el === null ? -1 : kids.indexOf(el));

		const balance = idx(screen.getByTestId("balance-cluster"));
		const identity = idx(screen.getByTestId("identity-chip-link"));
		const visitor = idx(screen.getByTestId("visitor-counter"));
		// The divider carries no testid and must not gain one — it is a named
		// untouchable. It is the hairline `w-px` rule in the right zone.
		const divider = kids.findIndex((el) =>
			el.getAttribute("class")?.includes("w-px"),
		);

		expect(balance).toBeGreaterThanOrEqual(0);
		expect(identity).toBeGreaterThanOrEqual(0);
		expect(visitor).toBeGreaterThanOrEqual(0);
		expect(divider).toBeGreaterThanOrEqual(0);

		// SG8, the load-bearing half: every engine-derived figure LEFT of the
		// divider, VisitorCounter the SOLE element to its right.
		expect(balance).toBeLessThan(divider);
		expect(visitor).toBeGreaterThan(divider);
		expect(kids.slice(divider + 1)).toEqual([
			screen.getByTestId("visitor-counter"),
		]);

		// The locked-mockup order: the identity chip sits BETWEEN the Đ cluster
		// and the divider, which is the stated §21.1 mechanism.
		expect(balance).toBeLessThan(identity);
		expect(identity).toBeLessThan(divider);
	});

	it("signed-out-header-renders-no-balance-and-keeps-the-divider-boundary", () => {
		const { container } = render(<GlobalHeader viewer={null} />);

		// No prop passed at all — the `(auth)` layout mounts the header this way.
		expect(screen.queryByTestId("balance-cluster")).toBeNull();

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

describe("T6 — BalanceCluster null path", () => {
	it("renders-nothing-when-spendable-is-null", () => {
		const { container } = render(<BalanceCluster spendable={null} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders-the-label-and-a-0dp-figure", () => {
		render(<BalanceCluster spendable="610.400000000000000000" />);
		const cluster = screen.getByTestId("balance-cluster");

		expect(cluster.textContent).toContain("Balance");
		expect(cluster.textContent).toContain("Đ");
		// formatDharma — the single shared 0-dp renderer (DROUND / SPEC.1 §10.8).
		expect(cluster.textContent).toContain("610");
		expect(cluster.textContent).not.toContain("610.4");

		// The Portfolio slot renders NOTHING — no placeholder, no dash.
		expect(cluster.textContent).not.toContain("Portfolio");
		expect(cluster.textContent).not.toContain("—");
	});
});
