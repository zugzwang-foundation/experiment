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
 *  1. **The mockup's caption is never shipped.** `.mmedia .cap` reads "MARKET
 *     MEDIA — IMG / VIDEO", which is the mockup describing its own placeholder.
 *     Shipping it would put a build-time note in front of every participant —
 *     `PD-3-09` / `OD-6` verbatim.
 *  2. **No media ⇒ no panel**, never an empty box. Same ruling, other direction.
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
	it("market-media::no-media-renders-NO-panel", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={null} videoUrl={null} title={TITLE} />,
		);

		// ⛔ Not an empty box — PD-3-09 / OD-6.
		expect(container.innerHTML).toBe("");
	});

	it("market-media::the-mockups-placeholder-caption-is-NEVER-shipped", () => {
		const { container } = render(
			<MarketMediaPanel imageUrl={IMAGE} videoUrl={VIDEO} title={TITLE} />,
		);

		// The mockup's own words, pinned as absent. This is the assertion that
		// stops a later "restore fidelity" pass from porting `.cap` verbatim.
		expect(container.innerHTML).not.toContain("MARKET MEDIA");
		expect(container.innerHTML).not.toContain("IMG / VIDEO");
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
