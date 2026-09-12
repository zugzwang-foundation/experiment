// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	// POST-IMAGE-EXPORT — `DownloadPostImage` reads the market slug from the
	// route; a mock without `useParams` throws at the first post card render.
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

import {
	deriveReplySide,
	replyComposerColumn,
} from "@/components/debate/composer/gating";
import { DebateView } from "@/components/debate/DebateView";
import { formatPricePercent } from "@/components/debate/format";
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
 * ⚠⚠⚠ SUPERSEDED BY RPLY-2 · R2, RECORDED RATHER THAN DELETED (O-4/O-5). This
 * file used to assert "**neither** header moves when a composer opens" — true
 * under R4b, because R4b only ever removed a click-through/plain-text flip.
 * The founder later ruled the OTHER way for the label itself: "when a composer
 * opens, the headers must be the same as the side bet being taken" — a YES
 * composer hosted in the NO column must make THAT column read "Yes", not "No".
 * R4b and R2 do not contradict: R4b is about the position readout and the
 * (never-existing) controls; R2 is about the label/percent/TO-WIN a column
 * shows while it hosts. Both are true of the SAME render at once — see
 * `PositionStrip.tsx`'s own `composingSide` block for the measurement that
 * keeps them from colliding (the position readout is deliberately NOT part of
 * what R2 mirrors).
 *
 * ⛔⛔ WHAT IT TAKES TO MAKE THE R1 WIRING RED, RECORDED BECAUSE IT IS
 * SURPRISING (unchanged from R4b — R1's column rule is what R2's mirroring
 * rides on). Restoring the pre-R1 `composerColumn = opposite(parentSide)`
 * rule reddens the `holds NO` case below; R1 itself is guarded elsewhere
 * (`side-identity.test.tsx`).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const POST_TITLE = "The corridor is built for this volume";
/** `mumbai-metro.input`'s fixture value for this post — see `POST_TITLE`. */
const PARENT_SIDE = "YES" as const;
/** Same fixture — asymmetric on purpose (G4's vacuity hazard, see below). */
const FIXTURE_PRICING = {
	yes: "0.540000000000000000",
	no: "0.460000000000000000",
};

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
	history.replaceState(null, "", "/m/bitcoin-price-50k");
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

describe("R4b — the non-hosting post-arm header never moves when a composer opens", () => {
	// ⚠⚠ ONE RELATION PER FRESH RENDER, DELIBERATELY — NOT ONE MOUNT TOGGLING
	// BOTH. RPLY-2 · R2 means the column checked here as "non-hosting" for
	// relation A may have BEEN the hosting column a moment ago, for relation
	// B, within the same mounted instance — a real prop change (`side` swaps
	// on `PriceThumb`, YES↔NO) that React's reconciliation resolves by
	// removing and re-adding a subset of SVG attributes, leaving a harmless
	// but real ATTRIBUTE-ORDER residue in `outerHTML` (`stroke`/`class` swap
	// position) that a byte-equality check cannot tell apart from an actual
	// change. A fresh render per relation has no such history to leave a
	// residue from, which is what the strong byte-identical guarantee here
	// actually needs.
	for (const [label, viewer] of VIEWERS) {
		for (const relation of ["support", "counter"] as const) {
			const trigger = relation === "support" ? "Support" : "Counter";
			it(`post-arm-headers::${label}-${trigger}-non-hosting-header-is-byte-identical-before-and-after-opening`, () => {
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

				if (!openRelation(trigger)) {
					// F-3 blocks this relation for this viewer (e.g. holding the
					// opposite side) — nothing to assert, and the matrix test in
					// `side-identity.test.tsx` covers F-3 itself.
					return;
				}
				const hostColumn = replyComposerColumn({
					parentSide: PARENT_SIDE,
					relation,
				});
				const nonHostColumn = hostColumn === "YES" ? "NO" : "YES";

				const now = headers();
				// ⛔ THE ASSERTION R4b EXISTS FOR, now scoped to the column that is
				// NOT hosting the open composer — the one RPLY-2 · R2 leaves alone.
				expect(now[nonHostColumn]).toBe(closed[nonHostColumn]);
			});
		}
	}

	it("post-arm-headers::every-viewer-state-opens-at-least-one-relation-non-vacuity", () => {
		// ⛔⛔ NON-VACUITY for the matrix above, restated as its own assertion
		// now that each (viewer, relation) pair is its own test and a
		// skipped-via-F-3 case no longer has a shared counter to increment.
		for (const [, viewer] of VIEWERS) {
			render(
				<DebateView
					model={baseModel()}
					viewer={viewer}
					initialPostId={null}
					ownPseudonym={viewer === null ? null : "AmberFinch404"}
				/>,
			);
			enterPost();
			const opened =
				Number(openRelation("Support")) + Number(openRelation("Counter"));
			expect(opened).toBeGreaterThan(0);
			cleanup();
		}
	});

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
});

describe("RPLY-2 · R2 — the HOSTING column's header mirrors the bet's side", () => {
	it("post-arm-headers::G4-the-hosting-columns-label-and-percent-mirror-the-bet-Support", () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={{ position: null, balance: "100", spendableToday: "100" }}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		const closed = headers();

		// Support on a YES parent bets YES, hosted in the NO column (R1: the
		// column is opposite the BET, never the parent).
		const resultingSide = deriveReplySide({
			parentSide: PARENT_SIDE,
			relation: "support",
		});
		const hostColumn = replyComposerColumn({
			parentSide: PARENT_SIDE,
			relation: "support",
		});
		expect(resultingSide).toBe("YES");
		expect(hostColumn).toBe("NO");

		expect(openRelation("Support")).toBe(true);
		const now = headers();

		// ⛔⛔ G4 — THE VACUITY HAZARD OF THIS TASK. `mumbai-metro.input`'s
		// pricing is 54/46, NOT 50/50 — asserted here so a future edit that
		// "simplifies" the fixture toward parity cannot silently turn this
		// green-against-the-defect. At 50/50 a mirrored and an unmirrored
		// render would print the SAME percent, and this assertion would pass
		// whether or not `composingSide` actually did anything.
		expect(FIXTURE_PRICING.yes).not.toBe(FIXTURE_PRICING.no);

		// The NO column now reads the BET's side (YES), not its own (NO).
		expect(now.NO).not.toBe(closed.NO);
		expect(now.NO).toContain(">Yes<");
		expect(now.NO).toContain(
			formatPricePercent(FIXTURE_PRICING, resultingSide),
		);
		// ⛔ the percent that would have printed had mirroring done nothing.
		expect(now.NO).not.toContain(formatPricePercent(FIXTURE_PRICING, "NO"));
	});

	it("post-arm-headers::G4-the-hosting-columns-label-and-percent-mirror-the-bet-Counter", () => {
		render(
			<DebateView
				model={baseModel()}
				viewer={{ position: null, balance: "100", spendableToday: "100" }}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		const closed = headers();

		// Counter on a YES parent bets NO, hosted in the YES column.
		const resultingSide = deriveReplySide({
			parentSide: PARENT_SIDE,
			relation: "counter",
		});
		const hostColumn = replyComposerColumn({
			parentSide: PARENT_SIDE,
			relation: "counter",
		});
		expect(resultingSide).toBe("NO");
		expect(hostColumn).toBe("YES");

		expect(openRelation("Counter")).toBe(true);
		const now = headers();

		expect(now.YES).not.toBe(closed.YES);
		expect(now.YES).toContain(">No<");
		expect(now.YES).toContain(
			formatPricePercent(FIXTURE_PRICING, resultingSide),
		);
		expect(now.YES).not.toContain(formatPricePercent(FIXTURE_PRICING, "YES"));
	});

	it("post-arm-headers::G5-the-non-hosting-columns-header-is-unchanged-in-every-composer-state", () => {
		// The other half of the same render: the column NOT hosting the composer
		// must be byte-identical, restated here beside G4 so the pairing (one
		// column moves, one does not) is visible from a single test.
		//
		// ⚠⚠ THE REAL GUARANTEE LIVES IN THE R4b SUITE ABOVE, NOT HERE, and this
		// is worth stating in terms because it is not obvious. `replyComposerColumn`
		// makes `hostColumn = opposite(resultingSide)` ALWAYS, which makes the
		// non-hosting column's OWN natural side algebraically EQUAL to
		// `resultingSide` — so `composingSide = resultingSide` applied to the
		// non-hosting column is a mathematical no-op, and so is the wrong-in-a-
		// CONSTANT-way bug tried here while writing this guard (`composingSide`
		// computed from `side` alone, ignoring `hostsComposer` — WRONG at both
		// `closed` and `now`, so `now.YES === closed.YES` stayed true against a
		// real defect). A before/after comparison on ONE mount cannot see a bug
		// that is wrong the same way at both timestamps. What DOES catch the
		// realistic version of this bug — the `hostsComposer` gate itself
		// inverted, so the WRONG column mirrors — is G4 above, which checks the
		// hosting column against an EXPECTED VALUE rather than only against its
		// own earlier render (verified: `composingSide={!hostsComposer ? …}`
		// reddens both G4 cases). The R4b suite above is the one that actually
		// exercises fresh, independent renders per (viewer, relation) pair,
		// which is what makes ITS byte-identical assertion meaningful. This test
		// stays as a direct, readable restatement of the pairing, not as an
		// independent guard.
		render(
			<DebateView
				model={baseModel()}
				viewer={{ position: null, balance: "100", spendableToday: "100" }}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		const closed = headers();
		expect(openRelation("Support")).toBe(true);
		const now = headers();
		expect(now.YES).toBe(closed.YES);
	});

	it("post-arm-headers::G6-the-hosting-columns-position-readout-is-NOT-mirrored", () => {
		// ⛔⛔ THE FALSEHOOD THIS GUARD REJECTS. A viewer holding NO opens Counter
		// (resultingSide NO matches their held side, so F-3 permits it), which
		// hosts in the YES column. If the position readout mirrored the way
		// `SlotHeader`'s does (a measured, reported-not-fixed finding against
		// the market arm — see `PositionStrip.tsx`), the YES column would print
		// "Your position" for a NO holding it does not have on that pole. It
		// must print "No active position" instead: the readout is a fact about
		// THIS column's own true side, never the mirrored one.
		render(
			<DebateView
				model={baseModel()}
				viewer={held("NO")}
				initialPostId={null}
				ownPseudonym="AmberFinch404"
			/>,
		);
		enterPost();
		expect(openRelation("Counter")).toBe(true);
		const now = headers();

		// Non-vacuity: the hosting column really did mirror the label (G4 covers
		// the general case; this confirms it fired on THIS render too).
		expect(now.YES).toContain(">No<");
		expect(now.YES).toContain("No active position");
		expect(now.YES).not.toContain("Your position");

		// Positive control: the viewer's REAL NO holding still shows correctly
		// on the NO column, which is never mirrored.
		expect(now.NO).toContain("Your position");
	});

	it("post-arm-headers::the-held-column-keeps-its-position-link-while-a-composer-is-open", () => {
		// ⛔ THE SPECIFIC AFFORDANCE THE OLD FLAG COULD TAKE AWAY (R4b), asserted
		// directly rather than only through the byte-comparison above. A viewer
		// holding YES may open Support on a YES post (F-3 permits it: the
		// resulting side IS the held side), and their position readout must stay
		// a click-through throughout — on the YES column, which does NOT host
		// this composer (Support hosts in NO) and so is never mirrored either.
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
