// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PublicNotFound from "@/app/(public)/not-found";
import RootNotFound from "@/app/not-found";

/**
 * T1 (SHELL-COMPLETE §7) — the B10 `not-found` boundaries.
 *
 * The load-bearing half is the ADR-0023 Option-2 regression guard: the ROOT
 * variant must render NO `GlobalHeader`. Option-2 rejected root-mounted
 * participant chrome precisely because the root layout is shared with
 * `(admin)` (which has no layout at any depth), so a header added here would
 * leak participant chrome onto the two admin `notFound()` throws. `GlobalHeader`
 * renders a `<header>` element, so asserting its absence catches exactly the
 * regression of someone mounting it.
 *
 * The `(public)` variant's branded property is INHERITANCE from the route-group
 * layout, not anything in `not-found.tsx` itself — the page renders bare content
 * and the layout supplies the chrome. Asserting that by rendering `PublicLayout`
 * would drag `GlobalHeader` → `@/server/markets/create` → `@/db/schema` →
 * drizzle into jsdom for a presentation claim. So it is asserted at the source
 * level (the same shape T2 uses for its no-server-import claim): the `(public)`
 * layout mounts the header, the root layout mounts none.
 *
 * NO FOOTER — founder ruling 2026-08-02. The product ships no page-level footer
 * on ANY surface: not reduced, not AGPL-only, none. `SiteFooter` and its T3
 * allow-list suite were reverted with B4. The AGPL §13 source offer relocates to
 * the ToS body at LEGAL.1 and the DPDPA grievance contact to the Privacy Policy;
 * neither is a footer item any more. The `SiteFooter` assertions below are
 * therefore no longer descriptive — they are a REGRESSION GUARD asserting the
 * footer does not come back, across all three layouts.
 */

afterEach(cleanup);

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("T1 — not-found boundaries", () => {
	it("root-variant-renders-no-global-header", () => {
		const { container } = render(<RootNotFound />);

		// The ADR-0023 Option-2 guard. GlobalHeader renders <header>.
		expect(container.querySelector("header")).toBeNull();
		// Nor any of the header's identifying leaves.
		expect(
			container.querySelector('[data-testid="visitor-counter"]'),
		).toBeNull();
		expect(
			container.querySelector('[data-testid="identity-chip-link"]'),
		).toBeNull();

		// Positive half: the neutral surface DID render its §5 copy.
		const root = container.querySelector('[data-testid="root-not-found"]');
		expect(root).not.toBeNull();
		expect(root?.textContent).toContain("Not found.");
		expect(root?.textContent).toContain("ZUGZWANG");
		expect(container.querySelector('a[href="/"]')?.textContent).toBe(
			"Go to Zugzwang",
		);
	});

	it("public-variant-renders-copy-and-no-chrome-of-its-own", () => {
		const { container } = render(<PublicNotFound />);

		const page = container.querySelector('[data-testid="public-not-found"]');
		expect(page).not.toBeNull();
		expect(page?.textContent).toContain("Not found.");
		expect(page?.textContent).toContain(
			"This page doesn't exist, or the market isn't public yet.",
		);
		expect(container.querySelector('a[href="/"]')?.textContent).toBe(
			"Back to markets",
		);

		// It mounts NO chrome itself — header and footer arrive by inheritance
		// from the group layout (asserted below). A header mounted here would
		// double it inside the layout.
		expect(container.querySelector("header")).toBeNull();
		expect(container.querySelector("footer")).toBeNull();
	});

	it("public-group-layout-supplies-the-header-root-layout-does-not", () => {
		const publicLayout = read("src/app/(public)/layout.tsx");
		const rootLayout = read("src/app/layout.tsx");

		// The inheritance the branded 404 relies on.
		expect(publicLayout).toContain("<GlobalHeader");

		// ADR-0023 Option-2: the root layout is shared with `(admin)` and mounts
		// no participant chrome, which is what keeps the root 404 neutral.
		expect(rootLayout).not.toContain("GlobalHeader");
	});

	it("no-layout-mounts-a-footer", () => {
		// Founder ruling 2026-08-02: the footer is RETIRED — no page-level footer
		// on any surface. This is the guard against it returning. All three
		// layouts, not just root: B4 had mounted it in BOTH group layouts, so a
		// root-only assertion would miss the regression it is written to catch.
		for (const rel of [
			"src/app/layout.tsx",
			"src/app/(public)/layout.tsx",
			"src/app/(auth)/layout.tsx",
		]) {
			expect(read(rel)).not.toContain("SiteFooter");
			expect(read(rel)).not.toContain("<footer");
		}
	});
});
