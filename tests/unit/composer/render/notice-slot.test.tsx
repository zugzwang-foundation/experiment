// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	COMPOSER_COPY,
	c2Sentence,
	overCapStrip,
} from "@/components/debate/composer/copy";
import { floorFor } from "@/components/debate/composer/gating";

import {
	composerProps,
	EXTENDED,
	stubWireFetch,
	TITLE,
	VIEWER,
} from "./_harness";

/**
 * RPLY-1 · R3 · G5 — THE COMPOSER'S HEIGHT NO LONGER DEPENDS ON WHICH BLOCKED
 * STATE IT IS IN.
 *
 * ⚠⚠ WHAT WAS WRONG, MEASURED RATHER THAN ASSERTED. The `<section>` is
 * `flex flex-col gap-3`, and two conditional children — the P4 429 countdown
 * banner and the C2 floor-above-balance strip — each added their own box PLUS a
 * 12px gap, while a third (the W2.10-D over-cap strip) added 22px from inside
 * the footblock. In a real browser against the real compiled CSS at 1280×800,
 * the section ran 428.81px clean, 472.81 with the 429 banner, 474.81 with C2
 * and 450.81 over-cap, against a 416px column: 13px of overflow became 57, 59
 * and 35. All three now write into ONE slot that replaces the TO WIN row, which
 * is free because TO WIN is meaningless in every state where the bet cannot be
 * submitted.
 *
 * ⛔⛔ WHY THIS FILE ASSERTS STRUCTURE AND NEVER PIXELS. jsdom performs NO
 * layout — no flexbox, no `h-8`, no `getBoundingClientRect` worth reading — so a
 * unit test cannot prove a fit and must not pretend to. What it CAN prove, and
 * what actually regresses, is the CHILD COUNT: every past version of this defect
 * arrived as a new conditional box in the column. The browser measurement is
 * reported in the run log; this is the part that runs in CI forever.
 *
 * ⚠ THE SUBMIT GATE IS ASSERTED IN EVERY STATE, deliberately. R3 is a layout
 * change on a money surface, and the one thing that must NOT have moved is which
 * states can place a bet. `submitDisabled` was already carrying all three
 * conditions before this change; these assertions are what prove the
 * consolidation did not quietly drop one.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/** The composer's own `<section>` — the `flex flex-col gap-3` column. */
function section(container: HTMLElement): HTMLElement {
	const el = container.querySelector("section");
	if (el === null) {
		throw new Error("no composer <section>");
	}
	return el;
}

/** Direct ELEMENT children of the section — the flex items that own the gaps. */
function sectionChildCount(container: HTMLElement): number {
	return section(container).children.length;
}

function submitDisabled(): boolean {
	const btn = screen.getByRole("button", { name: COMPOSER_COPY.submit });
	return btn.hasAttribute("disabled");
}

function noticeText(container: HTMLElement): string {
	const slot = container.querySelector('[data-testid="composer-notice-slot"]');
	if (slot === null) {
		throw new Error("no notice slot");
	}
	return slot.textContent ?? "";
}

/** state: none — spendable comfortably above the floor, amount at the floor. */
function renderNone() {
	stubWireFetch([]);
	return render(<BetComposer {...composerProps()} />);
}

/** state: floor-above-balance (C2). */
function renderFloorAbove() {
	stubWireFetch([]);
	return render(
		<BetComposer
			{...composerProps()}
			viewer={{ ...VIEWER, balance: "0", spendableToday: "0" }}
		/>,
	);
}

/** state: over-cap (W2.10-D) — only reachable when spendable exceeds the cap. */
function renderOverCap() {
	stubWireFetch([]);
	const r = render(
		<BetComposer
			{...composerProps()}
			viewer={{ ...VIEWER, balance: "999999", spendableToday: "999999" }}
		/>,
	);
	act(() => {
		fireEvent.change(screen.getByLabelText<HTMLInputElement>("Stake amount"), {
			target: { value: "20000" },
		});
	});
	return r;
}

/** state: P4 429 — reached by an actual rate-limited submit, not by a prop. */
async function renderRateLimited() {
	const r = render(<BetComposer {...composerProps()} />);
	stubWireFetch([
		{
			status: 429,
			body: {
				ok: false,
				error: {
					code: "error_rate_limit_exceeded",
					message: "",
					retry_after: 30,
				},
			},
		},
	]);
	act(() => {
		fireEvent.change(screen.getByLabelText<HTMLElement>("Argument title"), {
			target: { value: TITLE },
		});
		fireEvent.change(screen.getByLabelText<HTMLElement>("Argument body"), {
			target: { value: EXTENDED },
		});
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
	await vi.waitFor(() => {
		expect(noticeText(r.container)).toContain("Too many requests");
	});
	return r;
}

describe("R3 — one notice slot, and no state adds a box", () => {
	it("notice-slot::the-CLEAN-state-is-the-baseline-child-count", () => {
		// The control the three below are measured against. If this number changes
		// for an unrelated reason, the three comparisons are still valid — they are
		// written against THIS value, not against a literal.
		//
		// ⚠⚠ RPLY-2 · R1 — 2 → 3, MEASURED, NOT A REGRESSION. The footblock
		// (AMOUNT/notice/TO WIN + `Đ BET`) used to live inside the argument
		// region's wrapper (a child of a child); it is now hoisted to be its OWN
		// `shrink-0` direct child of `<section>`, alongside the header row and
		// the (also new) scrollable argument region — three direct children
		// where there were two. The three comparisons below are unaffected
		// exactly as the comment above says: they read `before` fresh from this
		// same baseline function, never the literal.
		//
		// ⚠⚠ RPLY-3 · R1 — 3 → 2, AND IT IS THE SAME MOVE RUN BACKWARDS. The
		// hoist RPLY-2 recorded above was demanded by RPLY-2's own brief and that
		// demand was a SPECIFICATION error: the founder had asked for the
		// composer to FIT, not for its layout to change. R1 returns the footblock
		// to `.compright`, where d5 puts it (`:1132`), so the section is back to
		// two direct children — the header row and the argument region. Recorded
		// on top of RPLY-2's own record rather than replacing it (O-4/O-5): the
		// point of this comment is that the number has moved twice and why, not
		// what it happens to be today.
		// ⛔ THE THREE COMPARISONS BELOW REMAIN INDIFFERENT TO ALL OF THIS, which
		// is the property that made this file survive both moves untouched: they
		// read `before` fresh from this same baseline function, never a literal.
		const { container } = renderNone();
		expect(sectionChildCount(container)).toBe(2);
		// …and the clean state shows TO WIN, which is what the notice displaces.
		expect(noticeText(container)).toContain(COMPOSER_COPY.toWinLabel);
	});

	it("notice-slot::the-C2-state-adds-NO-section-child", () => {
		const baseline = renderNone().container;
		const before = sectionChildCount(baseline);
		cleanup();

		const { container } = renderFloorAbove();
		// ⛔ THE ASSERTION THIS FILE EXISTS FOR. Before R3 this was `before + 1`.
		expect(sectionChildCount(container)).toBe(before);
	});

	it("notice-slot::the-OVER-CAP-state-adds-NO-section-child", () => {
		const baseline = renderNone().container;
		const before = sectionChildCount(baseline);
		cleanup();

		const { container } = renderOverCap();
		expect(sectionChildCount(container)).toBe(before);
	});

	it("notice-slot::the-429-state-adds-NO-section-child", async () => {
		const baseline = renderNone().container;
		const before = sectionChildCount(baseline);
		cleanup();

		const { container } = await renderRateLimited();
		expect(sectionChildCount(container)).toBe(before);
	});

	it("notice-slot::there-is-exactly-ONE-notice-slot-in-every-state", () => {
		// A second slot would be a second box by another name — the defect
		// re-entering through the door this change opened.
		for (const mount of [renderNone, renderFloorAbove, renderOverCap]) {
			const { container } = mount();
			expect(
				container.querySelectorAll('[data-testid="composer-notice-slot"]')
					.length,
			).toBe(1);
			cleanup();
		}
	});

	it("notice-slot::G3-RPLY-3-the-four-states-render-a-STRUCTURALLY-IDENTICAL-section", async () => {
		// ⛔⛔ RPLY-3 · G3 — R3's CONSTANT-HEIGHT PROPERTY IS A REGRESSION TARGET
		// FOR EVERY LATER LAYOUT TASK, AND R1 MOVED EVERY BOX IN THIS SECTION.
		// The count assertions above catch a state that adds a CHILD; they cannot
		// catch a state that changes an existing child's classes — a conditional
		// `mt-2`, a `py-3` that only appears when disabled — which would move the
		// height just as surely while the count held.
		//
		// ⇒ This compares the section's direct children by CLASS STRING across
		// all four states. Anything height-bearing lives in those strings.
		//
		// ⚠ THE ONE THING THAT LEGITIMATELY DIFFERS IS THE DIMMING, and it is
		// normalised rather than ignored: the C2 state adds
		// `opacity-(--state-disabled-opacity)` to the argument region, which is
		// the state's whole visual point and costs no height. Normalising it
		// keeps this guard about GEOMETRY. ⛔ Its own correctness — that the
		// footblock INHERITS that opacity now rather than re-applying it, since a
		// second copy would composite to 0.25 and halve the notice's measured
		// contrast — is asserted in `composer-fit.test.ts`, not here.
		const shape = (container: HTMLElement) =>
			Array.from(section(container).children).map((el) =>
				(el.getAttribute("class") ?? "")
					.split(/\s+/)
					.filter((c) => c !== "opacity-(--state-disabled-opacity)")
					.join(" "),
			);

		const clean = shape(renderNone().container);
		cleanup();
		const c2 = shape(renderFloorAbove().container);
		cleanup();
		const overCap = shape(renderOverCap().container);
		cleanup();
		const limited = shape((await renderRateLimited()).container);

		expect(c2).toEqual(clean);
		expect(overCap).toEqual(clean);
		expect(limited).toEqual(clean);
		// Non-vacuity: a section that rendered no children would satisfy every
		// comparison above and prove nothing.
		expect(clean.length).toBeGreaterThan(0);
	});

	it("notice-slot::the-slot-RESERVES-a-constant-height-rather-than-fitting-its-content", () => {
		// ⛔ jsdom cannot measure this, so what is pinned is the DECLARATION that
		// produces it: a fixed `h-8`, never a `min-h-*` floor. 32px is the measured
		// tallest occupant — the C2 sentence wraps to two lines at the amount
		// block's real 210px inner width, while TO WIN is 20px and the other two
		// strings are 16px. A floor would let the C2 state grow and the composer
		// would still JUMP, which is the complaint this row answers.
		const { container } = renderNone();
		const cls =
			container
				.querySelector('[data-testid="composer-notice-slot"]')
				?.getAttribute("class") ?? "";
		const tokens = cls.split(/\s+/);
		expect(tokens).toContain("h-8");
		expect(tokens.some((t) => t.startsWith("min-h-"))).toBe(false);
	});
});

describe("R3 — the copy is unchanged and still verbatim", () => {
	it("notice-slot::the-C2-sentence-renders-VERBATIM-from-c2Sentence", () => {
		const { container } = renderFloorAbove();
		const expected = c2Sentence({
			floor: floorFor(composerProps().kind),
			spendable: "0",
		});
		// ⛔ Asserted against the function's own output, never a retyped literal —
		// a copy of the string here could drift from the module and this would
		// still pass. SPEC.1 §16.2 requires the message to name both the balance
		// and the required stake, which is what that sentence does.
		expect(noticeText(container)).toBe(expected);

		// ⛔⛔ AND THE SENTENCE ITSELF IS PINNED LITERALLY, WHICH THE REST OF THIS
		// FILE DOES NOT DO AND CANNOT. Everything above derives both sides from
		// `c2Sentence`, so rewording the FUNCTION — `Đ 0 left. Need Đ 10.` — keeps
		// every assertion green: measured. Deriving is still right for the render
		// comparison (a retyped copy there could drift from the module), but it
		// means the VERBATIM obligation was pinned nowhere in the repo at all;
		// `c2Sentence`'s only two consumers both derive. @test-writer found the
		// hole and it is closed here rather than left as "the brief said this
		// rejects a reworded C2" when it did not.
		// ⚠ SPEC.1 §16.2 is why this is a copy contract and not a preference: the
		// message must name BOTH the current balance and the required stake, and
		// this is the operator-ratified C2 batch string that satisfies it. It is
		// not CC's to reword.
		expect(c2Sentence({ floor: "10", spendable: "0" })).toBe(
			"Đ 0 spendable today — below the Đ 10 minimum.",
		);

		// Non-vacuity: SPEC.1 §16.2 requires the message to name BOTH the current
		// balance and the required stake, so both are asserted present.
		// ⚠ The floor is DERIVED, never a literal. `composerProps()` is the POST
		// variant, so its floor is `BET_MIN_STAKE_POST` (10) and not the reply
		// floor (50) — I wrote 50 here first and the test caught it. Deriving it
		// also means a HARDEN.5 floor retune cannot silently drop this assertion
		// out of the state it is testing, which is the same reason
		// `c2-strip-removal.test.tsx` derives its own below-floor fixture.
		expect(expected).toContain("Đ 0 ");
		expect(expected).toContain(`Đ ${floorFor(composerProps().kind)}`);
	});

	it("notice-slot::the-over-cap-strip-renders-VERBATIM-from-overCapStrip", () => {
		const { container } = renderOverCap();
		expect(noticeText(container)).toBe(overCapStrip());
	});

	it("notice-slot::the-429-banner-still-names-the-countdown", async () => {
		const { container } = await renderRateLimited();
		expect(noticeText(container)).toContain("Too many requests");
		expect(noticeText(container)).toContain("30s");
	});
});

describe("R3 — no submit-gating predicate moved", () => {
	it("notice-slot::submit-is-DISABLED-in-all-three-blocked-states", async () => {
		// ⛔⛔ THE MONEY-PATH ASSERTION. R3 is a layout change on a surface where a
		// loosened gate would be a bet that should not have been placeable. All
		// three were already disabled before this change; this is what proves the
		// consolidation did not drop one on the way.
		renderFloorAbove();
		expect(submitDisabled()).toBe(true);
		cleanup();

		renderOverCap();
		expect(submitDisabled()).toBe(true);
		cleanup();

		await renderRateLimited();
		expect(submitDisabled()).toBe(true);
	});

	it("notice-slot::submit-is-ENABLED-with-a-valid-argument-in-the-clean-state", () => {
		// ⛔ THE POSITIVE CONTROL, and without it the row above is worthless: a
		// composer whose submit were disabled unconditionally would pass every
		// assertion in it.
		renderNone();
		expect(submitDisabled()).toBe(true); // no argument typed yet
		act(() => {
			fireEvent.change(screen.getByLabelText<HTMLElement>("Argument title"), {
				target: { value: TITLE },
			});
		});
		expect(submitDisabled()).toBe(false);
	});
});
