// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarketMediaPanel } from "@/components/debate/MarketMediaPanel";

/**
 * HTML-FINISH · MARKET DETAIL row 2 — the market media panel (`.mmedia`,
 * `d5:949`), the market arm's first `.hleft` child.
 *
 * THREE PROPERTIES, and each exists for a different failure:
 *
 *  1. ⛔ **No media ⇒ no panel, never an empty box** — and this property has now
 *     been asserted, reversed, and re-asserted, which is why the history stays
 *     here rather than in a commit nobody will find. It first read "**The
 *     mockup's caption is never shipped.** `.mmedia .cap` reads 'MARKET MEDIA —
 *     IMG / VIDEO' … Shipping it would put a build-time note in front of every
 *     participant — `PD-3-09` / `OD-6` verbatim." Round 2 · R2 reversed it
 *     (founder-ruled 2026-08-16, the OD-2 reversal) and required the byte-carried
 *     caption on the empty arm for the REVIEW surface, docketing it at
 *     `docs/parked.md` (`HTML-FINISH-MD-PLACEHOLDERS`) in the same breath.
 *     **QUOTE-1 A (founder-ruled 2026-09-11) takes that docket's STRIP exit**, so
 *     the empty arm renders nothing again.
 *     ⚠ THE ASSERTION IS INVERTED, NOT DELETED. A test that simply stopped
 *     checking would let the caption come back silently; this one reddens on a
 *     re-mount, which is the only reason it is still here.
 *  2. ⛔ **AND NO OTHER ARM EVER CARRIED IT.** A panel with real media must NOT
 *     carry the caption — that arm is not a placeholder and a caption over a real
 *     image would be the `PD-3-09` defect for real. That assertion never changed
 *     across either reversal, which is what makes it the stable one.
 *  3. **The video is OUTBOUND** (ADR-0026): a new-tab link, never an embedded
 *     player, and never a same-tab navigation that would drop the reader out of
 *     the debate.
 *
 * ⚠ O-7 — `innerHTML`, never `textContent`. Two of the three claims are about
 * elements and attributes, which `textContent` erases entirely.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const IMAGE = "https://example.invalid/market-media.png";
const VIDEO = "https://example.invalid/watch?v=fixture";
const TITLE = "Fixture market question.";

describe("MarketMediaPanel — row 2", () => {
	it("market-media::no-media-renders-NOTHING", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={null} videoUrl={null} title={TITLE} />,
		);

		// ⛔ THREE ASSERTIONS, NOT ONE, BECAUSE ONE OF THEM CAN GO GREEN WITHOUT
		// THE OTHERS. `innerHTML === ""` is the whole claim, but a future arm that
		// rendered a wrapper with the caption inside would break only the third
		// check, and a future arm that kept the testid on an empty box would break
		// only the second. The label is asserted by its BYTES — em dash U+2014
		// (e2 80 94) — because a paraphrase is exactly what a re-mount would reach
		// for, and a paraphrase that renders is still the defect.
		expect(container.innerHTML).toBe("");
		expect(
			container.querySelector('[data-testid="market-media-placeholder"]'),
		).toBeNull();
		expect(container.innerHTML).not.toContain("MARKET MEDIA");
	});

	it("market-media::a-REAL-media-panel-carries-NO-placeholder-caption", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={VIDEO} title={TITLE} />,
		);

		// ⛔ THE HALF OF THE OLD RULING THAT SURVIVES, AND THE SCOPE OF THE
		// REVERSAL. R2 put the caption on the EMPTY arm; a caption over a real
		// image would be `PD-3-09` for real — a build-time note printed across
		// live content. This is the assertion that stops a later "restore fidelity"
		// pass from porting `.cap` onto both arms.
		expect(container.innerHTML).not.toContain("MARKET MEDIA");
		expect(container.innerHTML).not.toContain("IMG / VIDEO");
		expect(
			container.querySelector('[data-testid="market-media-placeholder"]'),
		).toBeNull();
	});

	it("market-media::an-image-alone-renders-a-panel-and-no-link", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={null} title={TITLE} />,
		);

		const panel = container.querySelector('[data-testid="market-media-panel"]');
		expect(panel).not.toBeNull();
		expect(panel?.tagName).toBe("DIV");
		expect(container.querySelector("img")?.getAttribute("src")).toBe(IMAGE);
		// No video ⇒ no affordance for one.
		expect(container.querySelector("a")).toBeNull();
		expect(container.querySelector("svg")).toBeNull();
	});

	it("market-media::a-video-makes-the-panel-an-OUTBOUND-new-tab-link", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={VIDEO} title={TITLE} />,
		);

		const panel = container.querySelector('[data-testid="market-media-panel"]');
		expect(panel?.tagName).toBe("A");
		expect(panel?.getAttribute("href")).toBe(VIDEO);
		// ADR-0026 — a NEW TAB. Same-tab would drop the reader out of the debate,
		// and `noopener` is what stops the opened page reaching `window.opener`.
		expect(panel?.getAttribute("target")).toBe("_blank");
		expect(panel?.getAttribute("rel")).toContain("noopener");
		// The play glyph is decorative; the accessible name states its meaning.
		expect(panel?.getAttribute("aria-label")).toBe("Play video");
		expect(panel?.querySelector("svg")).not.toBeNull();
		// Decorative: the anchor's `aria-label` is the single accessible name, so
		// the glyph must not announce a second one.
		expect(panel?.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});

	/**
	 * BLOCK-3 §1/§5 — THE ENABLER'S OWN MECHANISM, PREVIOUSLY UNGUARDED. §1
	 * fixed a real bug (the panel's `h-full w-auto` derived its width from
	 * viewport HEIGHT, collapsing the text column to 0 and overflowing the
	 * page by 364px at 390×844) but landed with no class-level regression
	 * test — only the run report's browser measurements. §5 asks to verify
	 * "390×844 page overflow is 0 AND the block row is on-screen... this is
	 * the bug §1 exists to fix" by assertion, not report; this is that
	 * assertion, pinned on the frame class `MarketMediaPanel.tsx`'s own
	 * docblock explains in full.
	 */
	it("market-media::the-frame-derives-width-from-the-ROW-never-from-height", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={null} title={TITLE} />,
		);
		const panel = container.querySelector('[data-testid="market-media-panel"]');
		const cls = (panel?.getAttribute("class") ?? "").split(/\s+/);
		expect(cls).toContain("w-1/3");
		expect(cls).toContain("self-start");
		expect(cls).toContain("aspect-[16/9]");
		// The two classes that CAUSED the bug, pinned gone: `h-full` derives
		// height from the row (fine alone) but paired with `w-auto` let
		// `aspect-[16/9]` derive WIDTH from that height instead of the other
		// way around — a taller viewport produced a WIDER panel and a
		// narrower text column, worst at 390×844 where it went to zero.
		expect(cls).not.toContain("h-full");
		expect(cls).not.toContain("w-auto");
	});

	it("market-media::the-VIDEO-arm-carries-the-SAME-frame-mechanism", () => {
		// Non-vacuity: the BLOCK-3 fix lives in a `frame` constant shared by every
		// branch that renders, so asserting one arm would miss a regression that
		// re-introduced `h-full w-auto` on another.
		// ⚠ THIS TEST USED TO POINT AT THE PLACEHOLDER ARM, and QUOTE-1 A stripped
		// that arm — so it is REPOINTED rather than deleted. The property it exists
		// to protect (every rendering arm shares one frame) is unchanged; what
		// changed is which arm is the one the sibling test above does not already
		// cover. That is now the VIDEO arm, which is an `<a>` rather than a `<div>`
		// and is exactly where a second frame string could be written by hand
		// without anything noticing.
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={VIDEO} title={TITLE} />,
		);
		const panel = container.querySelector('[data-testid="market-media-panel"]');
		expect(panel?.tagName).toBe("A");
		const cls = (panel?.getAttribute("class") ?? "").split(/\s+/);
		expect(cls).toContain("w-1/3");
		expect(cls).toContain("self-start");
		expect(cls).toContain("aspect-[16/9]");
		expect(cls).not.toContain("h-full");
		expect(cls).not.toContain("w-auto");
	});

	it("market-media::a-video-with-no-image-still-surfaces-the-video", () => {
		// The defensive arm. Markets always carry media (§15 F-ADMIN-1 + the
		// `market_media_one_default_per_market_uq` backstop), so a null image is a
		// missing row or a presign failure — and losing the video with it would
		// make one degraded read hide a second, unrelated affordance.
		const { container } = render(
			<MarketMediaPanel imageUrl={null} videoUrl={VIDEO} title={TITLE} />,
		);

		const panel = container.querySelector('[data-testid="market-media-panel"]');
		expect(panel?.tagName).toBe("A");
		expect(panel?.getAttribute("href")).toBe(VIDEO);
		// …and it degrades to the shipped `IMG` placeholder, not a broken image.
		expect(container.querySelector("img")).toBeNull();
		expect(container.innerHTML).toContain("IMG");
	});
});
