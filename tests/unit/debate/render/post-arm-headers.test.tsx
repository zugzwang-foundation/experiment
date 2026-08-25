// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: () => undefined,
		refresh: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
	usePathname: () => "/m/mumbai-metro-line-3-1m-riders",
	useSearchParams: () => new URLSearchParams(),
}));

import { DebateView } from "@/components/debate/DebateView";
import type { ViewerMarketContext } from "@/components/debate/types";

import { baseModel } from "./_posted-fixtures";

/**
 * RPLY-1 · R4b — OPENING A COMPOSER CHANGES NEITHER POST-ARM COLUMN HEADER.
 *
 * ⚠⚠ MEASURED BEFORE ACTING (OVN-O4), because the brief's mechanism was a
 * guess. The founder's words were "when composer opens, both headers should be
 * same, just as we did for the posts composer — there are no buy/sell buttons
 * anyway", and the suspected mechanism was `showControls={!hostsComposer}` on
 * the post arm's `PositionStrip`. It was: enumerated across signed-out ·
 * signed-in with no position · holding YES · holding NO, each with and without
 * a pseudonym, and in all three composer states, the flag changed exactly ONE
 * rendered thing — whether the HELD column's position readout was an `<a>` or
 * plain text.
 *
 * ⛔ AND A CLICK-THROUGH TO YOUR OWN PROFILE IS NOT A BUY OR A SELL. The CS12
 * ruling that flag came from is `SlotHeader`'s, where there ARE two controls to
 * suppress; this strip's own docblock says "the market grammar MINUS action
 * buttons … NO Đ BET / Sell buttons on the debate surface." The prop travelled
 * across by name and took an affordance with it. It is now gone from
 * `PositionStrip` entirely.
 *
 * ⚠⚠ THE TWO HEADERS ARE NOT — AND MUST NOT BE — IDENTICAL TO EACH OTHER. They
 * legitimately differ by their own pole: label, percent, odds, and which one
 * holds a position. That is the whole point of a two-column arena. So the
 * property under test is NOT "YES equals NO"; it is "**neither header moves
 * when a composer opens**", which is what the founder's sentence actually asks
 * for and the only reading that is not self-contradictory.
 *
 * ⛔⛔ WHAT IT TAKES TO MAKE THIS FILE RED, RECORDED BECAUSE IT IS SURPRISING.
 * Restoring `showControls={!hostsComposer}` ALONE does **not** redden it, and
 * that is not a weakness in the guard — it is a fact about the code. R1 moved
 * the hosting column to the pole OPPOSITE the bet, and F-3 only permits opening
 * a relation whose resulting side IS the held side, so the held column can no
 * longer BE the hosting column and the flag has nothing left to suppress.
 * Reverting BOTH — the flag and R1's column rule — reddens the `holds NO` case
 * (viewer holds NO · a YES parent · Counter → the bet is NO, the old rule hosts
 * in NO, and the held column loses its link). Verified.
 * ⇒ The two fixes are entangled, and each covers a different half: R1 made the
 * defect unreachable, R4b removed the mechanism so it STAYS unreachable even if
 * the column rule ever moves again. The mechanism's return is caught by the
 * source scan in `header-mirror.test.ts`, which does redden on the flag alone;
 * this file catches the PROPERTY. Neither is redundant.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const POST_TITLE = "The corridor is built for this volume";

function held(side: "YES" | "NO"): ViewerMarketContext {
	return {
		position: {
			side,
			quantity: "5.000000000000000000",
			currentValue: "42.500000000000000000",
		},
		balance: "100",
		spendableToday: "100",
	} as ViewerMarketContext;
}

const VIEWERS: Array<[string, ViewerMarketContext | null]> = [
	["signed-out", null],
	[
		"signed-in, no position",
		{ position: null, balance: "100", spendableToday: "100" },
	],
	["signed-in, holds YES", held("YES")],
	["signed-in, holds NO", held("NO")],
];

beforeEach(() => {
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
	history.replaceState(null, "", "/m/mumbai-metro-line-3-1m-riders");
});
afterEach(() => {
	cleanup();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

/** Both post-arm column headers, as markup. */
function headers(): Record<"YES" | "NO", string> {
	const read = (side: "YES" | "NO") => {
		const col = document.querySelector(`[data-debate-column="${side}"]`);
		const strip = col?.querySelector("div.min-h-12");
		if (!strip) {
			throw new Error(`no ${side} column header — wrong arm, or restructured`);
		}
		return strip.outerHTML;
	};
	return { YES: read("YES"), NO: read("NO") };
}

function enterPost() {
	const t = Array.from(document.querySelectorAll("h3")).find(
		(h) => h.textContent === POST_TITLE,
	);
	if (t === undefined) {
		throw new Error("no post card to enter");
	}
	act(() => {
		fireEvent.click(t.closest("button") as HTMLButtonElement);
	});
}

/**
 * Click the Support/Counter trigger for `relation`.
 *
 * ⚠ THE TRIGGER'S ACCESSIBLE NAME CHANGES WHEN F-3 DISABLES IT — it becomes the
 * C3 refusal ("You hold YES. Exit your position to bet NO."), not
 * "Counter — bet NO". Matching only on the relation word therefore finds
 * NOTHING in exactly the states this file cares most about, which is how the
 * measurement pass first failed. Returns false rather than throwing, so a
 * caller can skip a relation the viewer is not permitted to open.
 */
function openRelation(relation: "Support" | "Counter"): boolean {
	const btn = Array.from(document.querySelectorAll("button")).find((b) => {
		const label = b.getAttribute("aria-label") ?? "";
		return label.startsWith(relation) && !b.hasAttribute("disabled");
	});
	if (btn === undefined) {
		return false;
	}
	act(() => {
		fireEvent.click(btn);
	});
	return true;
}

describe("R4b — neither post-arm header moves when a composer opens", () => {
	for (const [label, viewer] of VIEWERS) {
		it(`post-arm-headers::${label}-headers-are-byte-identical-before-and-after-opening`, () => {
			render(
				<DebateView
					model={baseModel()}
					viewer={viewer}
					initialPostId={null}
					ownPseudonym={viewer === null ? null : "AmberFinch404"}
				/>,
			);
			enterPost();
			const closed = headers();

			let opened = 0;
			for (const relation of ["Support", "Counter"] as const) {
				if (!openRelation(relation)) {
					continue;
				}
				opened += 1;
				const now = headers();
				// ⛔ THE ASSERTION THIS FILE EXISTS FOR, per column and per relation.
				expect(now.YES).toBe(closed.YES);
				expect(now.NO).toBe(closed.NO);
				openRelation(relation); // toggle closed again
			}

			// ⛔⛔ NON-VACUITY. Every viewer state must actually have opened at
			// least one composer; otherwise this test asserts that nothing changed
			// while nothing happened — the exact shape of a control that cannot
			// fire (OVN-V3).
			expect(opened).toBeGreaterThan(0);
		});
	}

	it("post-arm-headers::the-composer-really-does-open-positive-control", () => {
		// The control for the whole file. If opening a relation stopped mounting a
		// composer, every assertion above would pass trivially.
		render(
			<DebateView
				model={baseModel()}
				viewer={{ position: null, balance: "100", spendableToday: "100" }}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		expect(
			document.querySelector("section[aria-label*='Place your']"),
		).toBeNull();
		expect(openRelation("Support")).toBe(true);
		expect(
			document.querySelector("section[aria-label*='Place your']"),
		).not.toBeNull();
	});

	it("post-arm-headers::the-held-column-keeps-its-position-link-while-a-composer-is-open", () => {
		// ⛔ THE SPECIFIC AFFORDANCE THE OLD FLAG COULD TAKE AWAY, asserted
		// directly rather than only through the byte-comparison above. A viewer
		// holding YES may open Support on a YES post (F-3 permits it: the
		// resulting side IS the held side), and their position readout must stay a
		// click-through throughout.
		render(
			<DebateView
				model={baseModel()}
				viewer={held("YES")}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		const linkBefore = document.querySelector(
			'[data-debate-column="YES"] [data-testid="w210c-sell-link"]',
		);
		expect(linkBefore).not.toBeNull();

		expect(openRelation("Support")).toBe(true);
		const linkAfter = document.querySelector(
			'[data-debate-column="YES"] [data-testid="w210c-sell-link"]',
		);
		expect(linkAfter).not.toBeNull();
		expect(linkAfter?.getAttribute("href")).toBe(
			linkBefore?.getAttribute("href"),
		);
	});
});
