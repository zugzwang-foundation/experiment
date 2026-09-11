// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneResolverRows } from "@/components/debate/phone/PhoneResolverRows";
import { getResolutionBlocks } from "@/components/debate/resolution-block-data";

import { PHONE_MODEL_BASE } from "./_fixtures";

const captureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
	captureException: (...args: unknown[]) => captureException(...args),
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const market = (slug: string) => ({ ...PHONE_MODEL_BASE.market, slug });

/**
 * MOBILE-2 — the phone's resolution rows, and the ONE branch in the phone tier
 * that is a security posture rather than a layout.
 *
 * ⛔⛔ WHY THIS FILE EXISTS AT ALL. `getResolutionBlocks` THROWS for any slug
 * outside BLOCK-1's eight. A joint `@code-reviewer` / `@security-auditor`
 * finding on `ResolverCards`' first cut was that letting that throw propagate
 * took the WHOLE `/m/[slug]` route down — unauthenticated, GET-triggerable,
 * repeatably — for a failure that needs only one row to degrade. This component
 * reads the same map from a second place, so it inherits the same exposure and
 * carries the same catch. A copied posture that was never exercised is a posture
 * nobody has checked, and a mutation audit found this component (and
 * `PhoneDetails`) reached by no test at all.
 *
 * ⚠ Its sibling `_fixtures.ts` overrides the model's slug to a KNOWN market
 * precisely so `ResolverCards` does not throw in the other three suites — which
 * is exactly why the throwing branch had no coverage anywhere.
 */
describe("phone resolver rows — the four facts, as rows", () => {
	it("phone-resolver::renders-all-four-rows-for-a-known-market", () => {
		render(<PhoneResolverRows market={market("bitcoin-price-50k")} />);
		const blocks = getResolutionBlocks("bitcoin-price-50k");
		for (const [key, label] of [
			["resolution", "Resolution"],
			["resolver", "Resolver"],
			["closes", "Closes on"],
			["flavour", "Flavour"],
		] as const) {
			const row = screen.getByTestId(`phone-resolver-row-${key}`);
			expect(row.textContent).toContain(label);
			// ⚠ THE VALUE COMES FROM THE MAP, not from a literal here — a literal
			// would pass against a component that rendered a hard-coded string.
			expect(row.textContent).toContain(blocks[key].line1);
		}
		expect(captureException).not.toHaveBeenCalled();
	});

	it("phone-resolver::the-values-are-NOT-truncated", () => {
		// ⛔ THE WHOLE POINT OF THE ROW FORM. MOBILE-2 RECON measured all four
		// desktop blocks at 375px: 50px cells, every label AND every value
		// reporting `scrollWidth > clientWidth`. A `truncate` here would reproduce
		// that defect in a different shape, and jsdom cannot measure it — so the
		// declaration is what is pinned.
		render(<PhoneResolverRows market={market("bitcoin-price-50k")} />);
		for (const key of ["resolution", "resolver", "closes", "flavour"]) {
			const row = screen.getByTestId(`phone-resolver-row-${key}`);
			expect(row.querySelector("dd")?.className ?? "").not.toContain(
				"truncate",
			);
		}
	});

	it("phone-resolver::an-unknown-slug-degrades-to-nothing-and-captures-ONCE", () => {
		// The attack this refuses: a ninth market created during the live window,
		// or any drift between what is served and the static map, taking the route
		// down for every visitor on a GET.
		const { container } = render(
			<PhoneResolverRows market={market("no-such-market-slug")} />,
		);
		expect(container.innerHTML).toBe("");
		expect(captureException).toHaveBeenCalledTimes(1);
		// STILL LOUD — degrading quietly is the other half of the defect.
		expect(String(captureException.mock.calls[0]?.[0])).toContain(
			"no-such-market-slug",
		);
	});

	it("phone-resolver::the-throw-itself-is-unchanged", () => {
		// POSITIVE CONTROL for the row above: the map really does throw, so
		// "rendered nothing" is the CATCH working rather than a component that
		// renders nothing for every input.
		expect(() => getResolutionBlocks("no-such-market-slug")).toThrow();
		expect(() => getResolutionBlocks("bitcoin-price-50k")).not.toThrow();
	});
});
