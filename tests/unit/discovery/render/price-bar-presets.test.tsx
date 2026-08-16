// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PriceBar } from "@/components/debate/PriceBar";

/**
 * DISCOVERY-COMPLETE C1 — V29/V30 `PriceBar` size presets.
 *
 * The load-bearing test here is `detail`. `PriceBar` is a SHARED primitive with
 * three render sites — `MarketHeader.tsx` (`/m/[slug]`), `HeroPanels.tsx`
 * (Discovery hero, V29) and `MarketCard.tsx` (Discovery grid, V30). At
 * DISCOVERY-COMPLETE only the two Discovery ones were in scope, so `detail`
 * pinned the render that shipped BEFORE the preset existed, byte for byte,
 * giving `/m/[slug]` a zero pixel delta (founder ruling OD-2).
 *
 * ⚠ THAT PIN IS NOW BROKEN, DELIBERATELY. `detail` was a NAMED TRANSITIONAL
 * preset and POLISH.3 was its row: d5 specifies a 14px bar / 10px labels
 * (surface_d5_v1_0.html:507-508) and PD-3-01 / D5 applied them. The literal
 * below is the POST-change capture. The suite's job is unchanged — it is still
 * a byte pin, and any diff against it is still a regression on `/m/[slug]` —
 * but it now pins the reconciled render, not the pre-preset one.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const PRICING = { yes: "0.38", no: "0.62" };

/**
 * The `detail` render of `<PriceBar pricing={{yes:"0.38",no:"0.62"}} />`.
 * Any diff here is a REGRESSION on `/m/[slug]`.
 *
 * ⚠ HOW THIS LITERAL WAS PRODUCED, stated as what happened rather than as what
 * was prescribed. `PriceBar.tsx`'s two tokens were edited FIRST — the V-1
 * ordering obligation held — and `container.innerHTML` was then dumped from the
 * rendered component. But the literal below was **EDITED IN PLACE**, two tokens,
 * NOT pasted from that dump. An earlier version of this paragraph claimed the
 * opposite; it was wrong, and it is corrected here rather than quietly.
 *
 * ⚠ THE ORDERING CLAIM HAS AN ARTIFACT, and it is not the one you would
 * reach for. A byte-identical dump proves identity and carries NO ordering
 * information. What discharges the ordering is the capture RUN itself: a
 * Vitest log stamped nine minutes before the commit, in which this assertion
 * FAILS with `Expected` = the old 385-byte literal and `Received` = a render
 * already carrying `h-[14px]` / `text-[10px]`. The component was edited; the
 * literal was not yet. That state cannot be reconstructed after the fact.
 *
 * ⚠ BYTE-IDENTITY: the load-bearing proof is IN THIS FILE. The exact-equality
 * assertion below runs on every `pnpm vitest run` — a hand-edit that missed a
 * byte fails it, and `toBe` is `Object.is`. That is the whole proof, and it is
 * reproducible by anyone. The capture log and its dump are OUT-OF-TREE
 * artifacts retained by the operator, not committed and not reachable from a
 * clone or from CI; they corroborate the account above but no reader should be
 * asked to take them on trust.
 *
 * ⚠ V-1's ACTUAL HAZARD DID NOT OCCUR. The hazard is authoring an expected
 * string and then bending the component to match it, which yields a file
 * indistinguishable from a correct one. It cannot have happened here: the two
 * values are not this session's to choose. They are d5's, at
 * `surface_d5_v1_0.html:507-508` (14px bar / 10px labels), ratified at D5 and
 * confirmed against the mockup by `@code-reviewer` independently of the
 * literal. The component was matched to a ratified external source, and the
 * literal was then matched to the component.
 *
 * ⚠ PROVENANCE, because a stale one misdirects the exact audit V-1 exists to
 * enable. Captured at POLISH.3 PR 1, 388 bytes. The PREVIOUS literal was the
 * pre-preset render captured at origin/main `aff76b3` before `size` existed,
 * 385 bytes; the +3 is `h-1.5` → `h-[14px]`. A reviewer checking this against
 * `aff76b3` will find a mismatch, and that mismatch is D5, not tampering.
 *
 * ⚠⚠ RE-CAPTURED A THIRD TIME AT HTML-FINISH · MARKET DETAIL round 2 (R7),
 * under a founder ruling of 2026-08-16 that extended that task's allow-list by
 * THIS ONE FILE. `detail` moved into `PriceBar`'s shared `ROW` map and the early
 * return was deleted, so the render changed from TWO ROWS (bar above, labels
 * below) to d5's own ONE-ROW `.barrow` (`d5:505`, `:1037-1041`) — the
 * arrangement `PriceBar`'s `D-J` record had been carrying as a known, unactioned
 * divergence since POLISH.3.
 *
 * ⛔ THE NUMBERS DID NOT MOVE — `h-[14px]` and `text-[10px]` are POLISH.3's, byte
 * for byte. This re-capture is a COMPOSITION change, not a value change.
 *
 * ⛔ AND THE SCOPE IS EXACTLY ONE PRESET. The `hero` and `card` expectations
 * below are BYTE-IDENTICAL to their pre-R7 form — not re-derived, not re-run,
 * not touched. That is checkable rather than assertable: `git diff` this file
 * and every hunk lands above line 100. `ROW.hero` and `ROW.card` are likewise
 * byte-unchanged in the component, and both Discovery sites pass no `pick`, so
 * their labels stay `<span>`s. Round 1 had already MEASURED the boundary
 * question this raises — `next build` EXIT=0 with the handler fully wired and
 * both Discovery sites building unchanged — so `H1-e` was discharged before
 * this landed.
 *
 * ⚠ HOW THE NEW LITERAL WAS PRODUCED — stated as what actually happened, to the
 * standard the paragraph above sets for itself.
 *
 * `PriceBar.tsx` was edited FIRST; the literal below was then HAND-WRITTEN from
 * the edited component and passed on its first run. ⛔ There was NO intermediate
 * RED against the new literal, so this file carries NO ordering artifact for
 * this capture — unlike the POLISH.3 one above, which has a timestamped failing
 * run. Claiming one would be easy and false, so it is not claimed.
 *
 * ⚠ WHY THAT IS ACCEPTABLE HERE, rather than merely admitted. V-1's hazard is
 * authoring an expected string and then BENDING THE COMPONENT to match it,
 * yielding a file indistinguishable from a correct one. It cannot have happened,
 * for the same reason it could not at POLISH.3: the render is not this session's
 * to choose. The ARRANGEMENT is d5's one-row `.barrow` (`d5:505`), founder-ruled
 * in on 2026-08-16; the two NUMBERS are POLISH.3's, unchanged; and the class
 * strings are the shared `hero`/`card` return's, which this preset now shares
 * and which `hero-is-22px-…` / `card-is-16px-…` below independently pin. A
 * literal bent to a wrong component would have to be wrong in the same way as
 * three sources that were fixed before this commit started.
 *
 * ⚠ AND THE LOAD-BEARING PROOF IS STILL IN THIS FILE, reproducible by anyone:
 * `expect(container.innerHTML).toBe(DETAIL_BASELINE)` is `Object.is` on strings
 * and runs on every `pnpm vitest run`. A hand-written literal that missed one
 * byte fails it.
 */
const DETAIL_BASELINE =
	'<div data-size="detail" class="flex items-center gap-[9px]">' +
	'<span class="text-[10px] font-bold tracking-[0.05em] whitespace-nowrap text-ink">YES 38%</span>' +
	'<div class="h-[14px] flex flex-1 overflow-hidden rounded-[var(--r)] [border:var(--hairline)]" role="img" aria-label="YES 38%, NO 62%">' +
	'<div class="h-full bg-yes" style="width: 38%;"></div>' +
	'<div class="h-full flex-1 bg-no"></div>' +
	"</div>" +
	'<span class="text-[10px] font-bold tracking-[0.05em] whitespace-nowrap text-ink">NO 62%</span>' +
	"</div>";

describe("PriceBar presets — `detail` is byte-pinned to its captured render", () => {
	it("detail-render-matches-the-captured-baseline", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="detail" />);
		expect(container.innerHTML).toBe(DETAIL_BASELINE);
	});

	it("detail-carries-its-data-size-attribute", () => {
		// ⚠⚠ THIS ROW WAS `detail-carries-no-data-size-attribute` AND IT IS
		// INVERTED, not relaxed. Its stated ground was, verbatim: "Adding
		// `data-size` there would be a real (if inert) delta on a surface this task
		// is not opening." THIS task is opening that surface — the founder ruled
		// row 7 in on 2026-08-16 and extended the allow-list by this one file — so
		// the assertion's own justification is spent. Spending it is a ruling, not
		// an inference, which is why round 1 reported it instead of shipping it.
		//
		// The row is kept rather than deleted because the PROPERTY it guards is
		// still worth pinning, only with the sign flipped: `detail` is now
		// generated by the same shared return as `hero` and `card`, so it must
		// carry the same preset marker they do. A `detail` that quietly stopped
		// emitting `data-size` would mean the early return had come back.
		const { container } = render(<PriceBar pricing={PRICING} size="detail" />);
		expect(
			container.querySelector("[data-size]")?.getAttribute("data-size"),
		).toBe("detail");
	});
});

describe("PriceBar presets — the Discovery geometry", () => {
	it("hero-is-22px-bar-with-12px-labels-outside", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="hero" />);

		const row = container.querySelector('[data-size="hero"]');
		expect(row).not.toBeNull();
		// `.barrow` — one flex row, gap 9px (surface_discovery_v1_0.html:99).
		expect(row?.getAttribute("class")).toContain("flex items-center gap-[9px]");

		const bar = screen.getByRole("img");
		expect(bar.getAttribute("class")).toContain("h-[22px]");
		expect(bar.getAttribute("class")).toContain("rounded-[var(--r)]");

		// Labels are OUTSIDE the bar — the mockup puts no text inside it.
		expect(bar.textContent).toBe("");
		const labels = row?.querySelectorAll(":scope > span");
		expect(labels?.length).toBe(2);
		expect(labels?.[0]?.getAttribute("class")).toContain("text-[12px]");
		expect(labels?.[0]?.textContent).toBe("YES 38%");
		expect(labels?.[1]?.textContent).toBe("NO 62%");
	});

	it("card-is-16px-bar-with-10.5px-labels-outside", () => {
		const { container } = render(<PriceBar pricing={PRICING} size="card" />);

		const row = container.querySelector('[data-size="card"]');
		expect(row).not.toBeNull();

		const bar = screen.getByRole("img");
		expect(bar.getAttribute("class")).toContain("h-[16px]");
		expect(bar.textContent).toBe("");

		const labels = row?.querySelectorAll(":scope > span");
		expect(labels?.length).toBe(2);
		expect(labels?.[0]?.getAttribute("class")).toContain("text-[10.5px]");
	});
});

describe("PriceBar presets — the invariants that hold across all three", () => {
	const SIZES = ["hero", "card", "detail"] as const;

	it("paired-aria-label-sums-to-100-in-every-preset", () => {
		// PCT.ROUND: YES canonical, NO derived — the pair always sums to exactly
		// 100 (SPEC.1 §10.8). A preset must not fork the formatter.
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			const bar = container.querySelector('[role="img"]');
			expect(bar?.getAttribute("aria-label")).toBe("YES 38%, NO 62%");
			cleanup();
		}
	});

	it("yes-segment-width-is-the-rounded-percent-in-every-preset", () => {
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			const yesSegment = container.querySelector<HTMLElement>(".bg-yes");
			expect(yesSegment?.style.width).toBe("38%");
			cleanup();
		}
	});

	it("poles-are-never-ported-by-neutral-token-name-in-any-preset", () => {
		// The C0 defect class, asserted at the render. The mockup's
		// `.fill{background:var(--ink)}` / `.bar{background:var(--n0)}` would
		// invert the poles here — the fill IS the YES side and the track IS the
		// NO side, and this build's ramp is inverted vs the light mockup.
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={PRICING} size={size} />);
			expect(container.querySelector(".bg-yes")).not.toBeNull();
			expect(container.querySelector(".bg-no")).not.toBeNull();
			expect(container.innerHTML).not.toContain("bg-ink");
			expect(container.innerHTML).not.toContain("bg-n0");
			cleanup();
		}
	});

	it("null-pricing-renders-the-quiet-stub-in-every-preset", () => {
		for (const size of SIZES) {
			const { container } = render(<PriceBar pricing={null} size={size} />);
			expect(container.textContent).toBe("Pricing unavailable");
			expect(container.querySelector('[role="img"]')).toBeNull();
			cleanup();
		}
	});
});
