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
 *  1. ⚠⚠ **The mockup's caption IS shipped, on the empty arm only** — REVERSED at
 *     round 2 · R2 (founder-ruled 2026-08-16, the OD-2 reversal). Properties 1
 *     and 2 used to read: "**The mockup's caption is never shipped.** `.mmedia
 *     .cap` reads 'MARKET MEDIA — IMG / VIDEO' … Shipping it would put a
 *     build-time note in front of every participant — `PD-3-09` / `OD-6`
 *     verbatim." and "**No media ⇒ no panel**, never an empty box." Visible
 *     placeholder chrome is now REQUIRED, and the caption is byte-carried from
 *     `d5:953` (em dash U+2014, hexdumped).
 *  2. ⛔ **AND IT APPEARS ONLY WHERE THERE IS NOTHING ELSE TO SHOW.** A panel
 *     with real media must NOT carry it — that arm is not a placeholder and a
 *     caption over a real image would be the `PD-3-09` defect for real. The two
 *     arms are asserted separately below, which is what makes this a scoped
 *     reversal rather than a blanket one.
 *  3. **The video is OUTBOUND** (ADR-0026): a new-tab link, never an embedded
 *     player, and never a same-tab navigation that would drop the reader out of
 *     the debate.
 *
 * ⚠⚠ REVIEW-SURFACE ONLY. Docketed at `docs/parked.md`
 * (`HTML-FINISH-MD-PLACEHOLDERS`): strip or gate before the DP.2 production
 * promote.
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
	it("market-media::no-media-renders-THE-PLACEHOLDER", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={null} videoUrl={null} title={TITLE} />,
		);

		// ⚠ The superseded assertion was `expect(container.innerHTML).toBe("")`.
		// R2 requires visible chrome here.
		expect(
			container.querySelector('[data-testid="market-media-placeholder"]'),
		).not.toBeNull();
		// ⛔ BYTE-CARRIED FROM `d5:953`, EM DASH U+2014 (bytes e2 80 94). A hyphen
		// would be a paraphrase, not a carry, and this literal is what catches it.
		expect(container.innerHTML).toContain("MARKET MEDIA — IMG / VIDEO");
		// The `.playmark` ring ships with it — the caption alone is a different
		// composition from the mockup's centred column.
		expect(container.querySelector("svg")).not.toBeNull();
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
