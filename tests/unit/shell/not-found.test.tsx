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
 * The `(public)` variant's "renders header and footer" property is INHERITANCE
 * from the route-group layout, not anything in `not-found.tsx` itself — the
 * page renders bare content and the layout supplies the chrome. Asserting that
 * by rendering `PublicLayout` would drag `GlobalHeader` →
 * `@/server/markets/create` → `@/db/schema` → drizzle into jsdom for a
 * presentation claim. So it is asserted at the source level (the same shape T2
 * uses for its no-server-import claim): the `(public)` layout mounts the chrome,
 * the root layout mounts none.
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

	it("public-group-layout-supplies-the-chrome-root-layout-does-not", () => {
		const publicLayout = read("src/app/(public)/layout.tsx");
		const rootLayout = read("src/app/layout.tsx");

		// The inheritance the branded 404 relies on. (The `<SiteFooter` half of
		// this assertion is added by S2, which mints the component and mounts
		// it — S1 must stay green on its own commit.)
		expect(publicLayout).toContain("<GlobalHeader");

		// ADR-0023 Option-2: the root layout is shared with `(admin)` and mounts
		// no participant chrome, which is what keeps the root 404 neutral.
		expect(rootLayout).not.toContain("GlobalHeader");
		expect(rootLayout).not.toContain("SiteFooter");
	});
});
