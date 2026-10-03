import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroPanels } from "@/components/discovery/HeroPanels";
import type { HeroPost } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";

import { EXTENDED, MARKET_ID, SLUG, TITLE } from "../composer/render/_harness";

/**
 * The hero side panel's author row autosizes to its panel and, when one line
 * cannot fit even at the floor, splits into two at the separator after the
 * chip. jsdom does no layout, so this pins the CONTRACT the browser computes
 * from — the panel is the `@container`, the row's size is one clamp between
 * the 7.5px floor and the designed 9.5px, and the one threshold drives both
 * the size and the break. The geometry itself was measured in Chrome at
 * 1024–1920 on every live hero post.
 */

const CARD: DiscoveryCard = {
	id: MARKET_ID,
	slug: SLUG,
	title: TITLE,
	pricing: { yes: "0.380000000000000000", no: "0.620000000000000000" },
	totals: {
		dharmaStaked: "14260.000000000000000000",
		postCount: 28,
		replyCount: 68,
	},
	imageUrl: null,
};

function heroPost(currentValue: string | null): HeroPost {
	return {
		id: "0190b3a0-9999-7000-8000-00000000000a",
		ordinal: 3,
		side: "YES",
		title: TITLE,
		teaser: EXTENDED,
		author: { pseudonym: "hero-yes-author", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "25.000000000000000000",
		entryPrice: "0.270000000000000000",
		replyCount: 24,
		replyDharma: "10000.000000000000000000",
		supportDharma: "3800.000000000000000000",
		counterDharma: "6200.000000000000000000",
		imageUrl: null,
		currentValue,
		createdAt: "2026-07-01T00:00:00.000Z",
	};
}

function panelHtml(currentValue: string | null): string {
	const html = renderToStaticMarkup(
		<HeroPanels
			card={CARD}
			series={[]}
			topPosts={{ yes: heroPost(currentValue), no: null }}
			isOpen={true}
		/>,
	);
	const start = html.indexOf('data-testid="hero-post"');
	return html.slice(html.lastIndexOf("<div", start));
}

describe("hero author row — autosize and the two-line split", () => {
	it("the panel is the container the row measures against", () => {
		expect(panelHtml(null)).toMatch(/^<div[^>]*class="[^"]*@container[^"]*"/);
	});

	it("one clamp, floor 7.5px, designed 9.5px; the threshold appears three times, identically", () => {
		const html = panelHtml("49.000000000000000000");
		const style = html.match(
			/<div class="flex flex-wrap[^"]*" style="([^"]*)"/,
		);
		if (!style) throw new Error("expected the author row's inline style");
		expect(style[1]).toMatch(/^font-size:clamp\(7\.5px, max\(/);
		expect(style[1]).toMatch(/, 9\.5px\);--hero-meta-break:/);
		const thresholds = [
			...style[1].matchAll(
				/(\d+\.\d{3})px - 100cqi|100cqi - (\d+\.\d{3})px\) \* 1000/g,
			),
		].map((m) => m[1] ?? m[2]);
		expect(thresholds).toHaveLength(3);
		expect(new Set(thresholds).size).toBe(1);
	});

	it("the arrow's 4px of margin is fixed width, present only with a current value", () => {
		const one = (html: string) =>
			html.match(/max\(\(\(100cqi - ([\d.]+)px\)/)?.[1];
		expect(Number(one(panelHtml("49.000000000000000000")))).toBeCloseTo(
			Number(one(panelHtml(null))) + 4,
			3,
		);
	});

	it("only the separator after the chip is the line break", () => {
		const seps = [
			...panelHtml(null).matchAll(
				/<span aria-hidden="true" data-field-separator="" class="([^"]*)"/g,
			),
		].map((m) => m[1]);
		expect(seps).toHaveLength(3);
		expect(seps.map((c) => c.includes("basis-(--hero-meta-break)"))).toEqual([
			false,
			true,
			false,
		]);
		// clip, never hidden: a scroll container loses its content-based
		// minimum width and would vanish on ONE line as well.
		expect(seps[1]).toContain("overflow-clip");
		expect(seps[1]).not.toContain("overflow-hidden");
	});
});

describe("hero height on a short window", () => {
	function heroHtml(): string {
		return renderToStaticMarkup(
			<HeroPanels
				card={CARD}
				series={[]}
				topPosts={{ yes: heroPost(null), no: null }}
				isOpen={true}
			/>,
		);
	}

	it("the hero stops at a 290px floor unless that would hide row two entirely", () => {
		const grid = heroHtml().match(/data-testid="hero-panels" class="([^"]*)"/);
		if (!grid) throw new Error("expected the hero grid");
		expect(grid[1].split(" ")).toContain(
			"min-h-[min(290px,calc(100vh-287px))]",
		);
	});

	it("the chart is placed in its box, so its viewBox cannot set the hero's height", () => {
		// In flow, the svg's 649:320 viewBox turned the plot's WIDTH into the
		// whole hero's minimum height (355px at 1280 wide). The frame must sit
		// inside an absolutely-placed layer of a positioned, size-contained box.
		const html = heroHtml();
		const frame = html.lastIndexOf(
			"<div",
			html.indexOf('data-testid="market-price-chart-frame"'),
		);
		const layerAt = html.lastIndexOf("<div", frame - 1);
		const boxAt = html.lastIndexOf("<div", layerAt - 1);
		const layer = html.slice(layerAt, frame);
		const box = html.slice(boxAt, layerAt);
		expect(layer).toMatch(/class="absolute inset-0 /);
		expect(box).toMatch(/class="relative [^"]*min-h-24 flex-1/);
		expect(box).toContain("[container-type:size]");
	});
});
