// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-1 · RF-8 — THE DESKTOP HOST OPENS THE MIRROR, on both arms, in the
 * column opposite the bet.
 *
 * ⚠ THIS IS A4's POSITIVE CONTROL. `submit-baseline.test.tsx` drives the real
 * `DebateView` and is not allowed to change, so it cannot itself say WHICH layout
 * it drove. Its claim — "the Mirror sends exactly what the old layout sent" — is
 * only worth anything if the composer it opened was the Mirror; this file is what
 * shows that it was, through the same host and the same openers.
 */

vi.mock("next/navigation", () => ({
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";

import { stubWireFetch, VIEWER } from "../../composer/render/_harness";
import { baseModel } from "./_posted-fixtures";

const PARENT_ID = "cmt-p1";

beforeEach(() => {
	stubWireFetch([]);
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

function openComposerIn(side: "YES" | "NO"): HTMLElement | null {
	return document.querySelector(
		`[data-debate-column="${side}"] [data-testid="mirror-composer"]`,
	);
}

describe("MIRROR-1 — the desktop host renders the Mirror", () => {
	it("mirror-host::market-arm-buy-yes-opens-the-mirror-post-composer-in-the-no-column", () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId={null}
				ownPseudonym="OliveBeaver000"
				ownPfpUrl="/pfp-placeholder.svg"
			/>,
		);
		// Positive control: nothing is open before the click.
		expect(
			document.querySelector('[data-testid="mirror-composer"]'),
		).toBeNull();
		fireEvent.click(screen.getByLabelText("Buy YES"));
		const composer = openComposerIn("NO");
		expect(composer).not.toBeNull();
		expect(openComposerIn("YES")).toBeNull();
		// The post variant: author row with the viewer, no statement row.
		expect(composer?.textContent).toContain("OliveBeaver000");
		expect(
			composer?.querySelector('[data-testid="mirror-statement-row"]'),
		).toBeNull();
	});

	it("mirror-host::post-arm-support-opens-the-mirror-reply-composer", () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId={PARENT_ID}
				ownPseudonym="OliveBeaver000"
			/>,
		);
		fireEvent.click(screen.getByLabelText("Support — bet YES"));
		// Support on a YES parent bets YES, so it hosts in the NO column.
		const composer = openComposerIn("NO");
		expect(composer).not.toBeNull();
		const statement = composer?.querySelector(
			'[data-testid="mirror-statement-row"]',
		);
		expect(statement?.textContent).toMatch(/^Support .+'s argument/);
	});

	it("mirror-host::post-arm-counter-opens-the-mirror-reply-composer-opposite-the-bet", () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId={PARENT_ID}
				ownPseudonym="OliveBeaver000"
			/>,
		);
		fireEvent.click(screen.getByLabelText("Counter — bet NO"));
		// Counter on a YES parent bets NO, so it hosts in the YES column.
		const composer = openComposerIn("YES");
		expect(composer).not.toBeNull();
		expect(
			composer?.querySelector('[data-testid="mirror-statement-row"]')
				?.textContent,
		).toMatch(/^Counter .+'s argument/);
		// And it wears the pole of the side it bets (NO).
		const submit = composer?.querySelector('[data-testid="mirror-submit"]');
		expect(submit?.className).toContain("bg-no");
	});
});
