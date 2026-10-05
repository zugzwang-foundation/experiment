// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({
		push: () => undefined,
		refresh: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";

import { VIEWER } from "../../composer/render/_harness";
import { baseModel } from "./_posted-fixtures";

/**
 * NAV-1 — every entry to `/m/[slug]` takes its arm from the address.
 *
 * ⚠ THE `<Activity>` WRAPPER IS THE MECHANISM, NOT SCAFFOLDING. With
 * `cacheComponents` on, Next's `layout-router` keeps a route you leave mounted
 * inside a hidden `<Activity>` keyed WITHOUT search params, and reveals that
 * same instance when you come back — so an entry is not a fresh mount, and a
 * `useState` seeded from `initialPostId` keeps whatever the last visit left in
 * it. Hiding and revealing here is the trip through Home; the URL is written
 * before the reveal because Next writes it in an insertion effect.
 *
 * Fixture: ordinal 2 is `cmt-p1`, ordinal 1 is `cmt-p3` (not array order — see
 * `history-ladder.test.tsx`), so `?post=1` shows a resolver, not an indexer.
 */

const ROUTE = "/m/bitcoin-price-50k";
const P1_TITLE = "The corridor is built for this volume";
const P3_TITLE = "The monsoon case alone gets you most of the way";

const onMarketArm = () =>
	document.querySelector('[data-testid="slot-header-YES"]') !== null;
const onPostArm = () =>
	document.querySelector('[data-testid="post-focus-foot"]') !== null;

function tree(mode: "visible" | "hidden") {
	return (
		<Activity mode={mode}>
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId={null}
				ownPseudonym={null}
			/>
		</Activity>
	);
}

beforeEach(() => {
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
	history.replaceState(null, "", ROUTE);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

describe("NAV-1 — the address decides the arm on every entry", () => {
	it("nav-1::a-revived-market-view-takes-its-arm-from-the-address", () => {
		const { rerender } = render(tree("visible"));
		const title = Array.from(document.querySelectorAll("h3")).find(
			(h) => h.textContent === P1_TITLE,
		);
		act(() => {
			fireEvent.click(title?.closest("button") as HTMLButtonElement);
		});
		expect(onPostArm()).toBe(true);
		expect(new URL(window.location.href).searchParams.get("post")).toBe("2");

		// Home, then the market again from Discovery — plain `/m/<slug>`.
		rerender(tree("hidden"));
		history.pushState(null, "", ROUTE);
		rerender(tree("visible"));
		expect(onMarketArm()).toBe(true);
		expect(onPostArm()).toBe(false);

		// Home, then a hero panel's `?post=1` link — post 1's replies view.
		rerender(tree("hidden"));
		history.pushState(null, "", `${ROUTE}?post=1`);
		rerender(tree("visible"));
		expect(onPostArm()).toBe(true);
		expect(document.body.textContent).toContain(P3_TITLE);
		expect(document.body.textContent).not.toContain(P1_TITLE);

		// …and leaving it stays on the page. The rung pushed on the first visit
		// is not beneath this entry, so the exit must not `history.back()` onto
		// Discovery; it falls back to dropping the param in place.
		const back = vi.spyOn(history, "back").mockImplementation(() => undefined);
		act(() => {
			fireEvent.click(
				document.querySelector(
					'[data-testid="focus-market-card"]',
				) as HTMLElement,
			);
		});
		expect(back).not.toHaveBeenCalled();
		expect(onMarketArm()).toBe(true);
		expect(new URL(window.location.href).searchParams.get("post")).toBeNull();
	});
});
