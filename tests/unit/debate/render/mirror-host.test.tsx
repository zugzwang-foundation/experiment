// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
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

describe("MIRROR-2 RF-4 — through the real host, the composer opens with the cursor in the title", () => {
	/**
	 * ⛔ WHY THIS GOES THROUGH THE HOST. `ComposerSlot` moves focus into the slot
	 * when it opens — to its FIRST focusable element — and its effect runs after
	 * the composer's own (a parent's effects run after its children's). A test
	 * that mounts `BetComposer` bare sees the title focused and passes; on the
	 * page the slot then moved focus to the author row's `×`. Only the real host
	 * can tell the two apart.
	 */
	async function flush() {
		for (let i = 0; i < 5; i++) {
			await act(async () => {
				await Promise.resolve();
			});
		}
	}

	it("mirror-host::market-arm-post-composer-opens-with-the-title-focused", async () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={VIEWER}
				initialPostId={null}
				ownPseudonym="OliveBeaver000"
			/>,
		);
		fireEvent.click(screen.getByLabelText("Buy YES"));
		await flush();
		const composer = openComposerIn("NO");
		const title = composer?.querySelector('[aria-label="Argument title"]');
		expect(title).not.toBeNull();
		expect(document.activeElement).toBe(title);
	});

	it("mirror-host::a-c2-composer-lands-on-its-first-control-not-on-a-disabled-title", async () => {
		// The C2 floor disables the title; the slot must still move focus INTO the
		// composer (its first enabled control), never leave it on the opener.
		render(
			<DebateView
				model={baseModel()}
				viewer={{ ...VIEWER, balance: "5", spendableToday: "5" }}
				initialPostId={null}
				ownPseudonym="OliveBeaver000"
			/>,
		);
		const opener = screen.getByLabelText("Buy YES");
		fireEvent.click(opener);
		await flush();
		const composer = openComposerIn("NO");
		const title = composer?.querySelector('[aria-label="Argument title"]');
		expect(title?.hasAttribute("disabled")).toBe(true);
		expect(document.activeElement).not.toBe(title);
		expect(composer?.contains(document.activeElement)).toBe(true);
		expect(document.activeElement?.getAttribute("aria-label")).toBe("Close");
	});

	it("mirror-host::reply-composers-open-with-the-title-focused-not-the-switch-or-close", async () => {
		for (const opener of ["Support — bet YES", "Counter — bet NO"]) {
			cleanup();
			render(
				<DebateView
					model={baseModel()}
					viewer={VIEWER}
					initialPostId={PARENT_ID}
					ownPseudonym="OliveBeaver000"
				/>,
			);
			fireEvent.click(screen.getByLabelText(opener));
			await flush();
			const composer = document.querySelector(
				'[data-testid="mirror-composer"]',
			);
			const title = composer?.querySelector('[aria-label="Argument title"]');
			expect(title, opener).not.toBeNull();
			expect(document.activeElement, opener).toBe(title);
		}
	});
});
