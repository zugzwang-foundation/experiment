// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileChart } from "@/components/profile/graph/ProfileChart";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { ProfileGraphCard } from "@/components/profile/graph/ProfileGraphCard";
import type { ProfileGraphSeries } from "@/server/profile/graph-series";

/**
 * UI.A5 Slice 5 (plan §2 row 5 / §4 "Graph" / §1d W2.6 records) — the ported
 * profile Dharma-graph components, RED-FIRST: `src/components/profile/graph/`
 * does not exist yet, so every `@/components/profile/graph/*` import above
 * MUST fail to resolve until the port lands (CLAUDE.md §5.6).
 *
 * Laws under test (SPEC.1 §23 "Net worth + the Dharma graph", 1.0.18):
 * - Placeholder card: the net-worth line ONLY, a 2-label endpoint axis
 *   (Sep 15 → Nov 5 2026), NO nodes, NO free-Dharma line (N-4 — nodes render
 *   in the expanded views only; free-Dharma is cumulative-only).
 * - The overlay is a STATE TOGGLE, not a route: absent from the DOM until the
 *   card is clicked; closes via X / ESC / backdrop — never via a panel click.
 * - Expanded default = Cumulative (net-worth + free-Dharma + a node per own
 *   post/reply at its netWorthValue). Per-market view = that market's
 *   SideEpisode segments (ONE polyline per segment — a full exit is a HARD
 *   GAP, never bridged), that market's nodes at their marketValue, a flip
 *   marker per exited segment, and NO free-Dharma line (N-4).
 * - The flip marker is its own primitive — never returned as a graph node.
 *
 * Fixtures are INLINE plain objects on the Slice-4 `ProfileGraphSeries` DTO
 * (type-only import — no server code executes; NO DB). The DTO carries no
 * market prose, so no market content is invented (CLAUDE.md §3) — slugs/ids
 * are neutral identifiers. `ProfileGraphOverlay` + `MarketFilter` are
 * exercised through the `ProfileGraph` composition per the plan's scenario
 * steps; their contract testids (`profile-graph-overlay`, `graph-close`,
 * `graph-backdrop`, `market-filter`, `market-filter-option-*`) are asserted
 * below. Render tests key `data-testid`, never final strings (plan §6/OQ-7).
 */

afterEach(cleanup);

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const M2 = "0190c0de-bbbb-7000-8000-000000000002";
const NODE_M1 = "0190c0de-cccc-7000-8000-000000000011";
const NODE_M2 = "0190c0de-dddd-7000-8000-000000000022";

const FULL: ProfileGraphSeries = {
	windowStart: "2026-09-15T00:00:00.000Z",
	windowEnd: "2026-11-05T23:59:00.000Z",
	yMax: 10_000,
	freeDharma: [
		{ at: "2026-09-15T00:00:00.000Z", value: "500.000000000000000000" },
		{ at: "2026-09-20T00:00:00.000Z", value: "450.000000000000000000" },
		{ at: "2026-10-01T00:00:00.000Z", value: "700.000000000000000000" },
	],
	netWorth: [
		{ at: "2026-09-15T00:00:00.000Z", value: "500.000000000000000000" },
		{ at: "2026-09-20T00:00:00.000Z", value: "520.000000000000000000" },
		{ at: "2026-10-01T00:00:00.000Z", value: "760.000000000000000000" },
		{ at: "2026-10-10T00:00:00.000Z", value: "800.000000000000000000" },
	],
	perMarket: [
		// M1 — TWO SideEpisodes: episode 0 fully exited (hard gap), episode 1
		// open to the window end. The exit + side change is the flip narrative.
		{
			marketId: M1,
			marketSlug: "graph-market-a",
			episodeIndex: 0,
			side: "YES",
			points: [
				{ at: "2026-09-20T00:00:00.000Z", value: "50.000000000000000000" },
				{ at: "2026-09-22T00:00:00.000Z", value: "64.000000000000000000" },
				{ at: "2026-09-25T00:00:00.000Z", value: "58.000000000000000000" },
			],
			exitedAt: "2026-09-25T00:00:00.000Z",
		},
		{
			marketId: M1,
			marketSlug: "graph-market-a",
			episodeIndex: 1,
			side: "NO",
			points: [
				{ at: "2026-10-01T00:00:00.000Z", value: "60.000000000000000000" },
				{ at: "2026-10-05T00:00:00.000Z", value: "72.000000000000000000" },
			],
			exitedAt: null,
		},
		// M2 — one open episode.
		{
			marketId: M2,
			marketSlug: "graph-market-b",
			episodeIndex: 0,
			side: "NO",
			points: [
				{ at: "2026-10-10T00:00:00.000Z", value: "40.000000000000000000" },
				{ at: "2026-10-12T00:00:00.000Z", value: "44.000000000000000000" },
			],
			exitedAt: null,
		},
	],
	// ≥1 own POST node in each market (kickoff fixture spec).
	nodes: [
		{
			id: NODE_M1,
			kind: "post",
			marketId: M1,
			side: "YES",
			at: "2026-09-20T00:00:00.000Z",
			netWorthValue: "520.000000000000000000",
			marketValue: "50.000000000000000000",
		},
		{
			id: NODE_M2,
			kind: "post",
			marketId: M2,
			side: "NO",
			at: "2026-10-10T00:00:00.000Z",
			netWorthValue: "800.000000000000000000",
			marketValue: "40.000000000000000000",
		},
	],
};

/** Every element under `root` whose data-testid starts with `prefix`. */
function byPrefix(root: ParentNode, prefix: string): Element[] {
	return Array.from(root.querySelectorAll(`[data-testid^="${prefix}"]`));
}

/**
 * A node "carries a position" in any of the kickoff-permitted encodings:
 * cx/cy on the element, a transform, data-x/data-y, or a positioned
 * `<circle>` descendant.
 */
function carriesPosition(el: Element): boolean {
	const has = (name: string) => el.getAttribute(name) !== null;
	return (
		(has("cx") && has("cy")) ||
		(has("data-x") && has("data-y")) ||
		has("transform") ||
		el.querySelector("circle[cx][cy]") !== null
	);
}

/** Click the collapsed card and return the opened overlay. */
function openOverlay(): HTMLElement {
	fireEvent.click(screen.getByTestId("profile-graph-card"));
	return screen.getByTestId("profile-graph-overlay");
}

describe("UI.A5 Slice 5 — profile Dharma-graph components (the W2.6 port)", () => {
	it("placeholder-2-label-axis", () => {
		render(<ProfileGraphCard series={FULL} onExpand={vi.fn()} />);
		// Exactly the two endpoint labels — no bucketing, no interior ticks.
		expect(screen.getAllByTestId("axis-x-start")).toHaveLength(1);
		expect(screen.getAllByTestId("axis-x-end")).toHaveLength(1);
		expect(byPrefix(document.body, "axis-x-")).toHaveLength(2);
		// The placeholder plots the net-worth line ONLY.
		expect(screen.getByTestId("line-networth")).toBeTruthy();
		expect(screen.queryByTestId("line-freedharma")).toBeNull();
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);
	});

	it("nodes-absent-in-placeholder", () => {
		// N-4: nodes are an EXPANDED-views-only primitive. Non-vacuity guard
		// first — the chart rendered (its line is present), nodes withheld.
		render(<ProfileGraphCard series={FULL} onExpand={vi.fn()} />);
		expect(screen.getByTestId("line-networth")).toBeTruthy();
		expect(byPrefix(document.body, "graph-node-")).toHaveLength(0);
	});

	it("overlay-open-close", () => {
		render(<ProfileGraph series={FULL} />);
		// State toggle, not a route: NO overlay in the DOM until opened.
		expect(screen.queryByTestId("profile-graph-overlay")).toBeNull();

		// Open via the card.
		expect(openOverlay()).toBeTruthy();

		// (a) The close button.
		fireEvent.click(screen.getByTestId("graph-close"));
		expect(screen.queryByTestId("profile-graph-overlay")).toBeNull();

		// (b) ESC keydown on the document.
		expect(openOverlay()).toBeTruthy();
		fireEvent.keyDown(document, { key: "Escape" });
		expect(screen.queryByTestId("profile-graph-overlay")).toBeNull();

		// (c) Backdrop click.
		expect(openOverlay()).toBeTruthy();
		fireEvent.click(screen.getByTestId("graph-backdrop"));
		expect(screen.queryByTestId("profile-graph-overlay")).toBeNull();

		// Control: a click INSIDE the panel (the chart) does NOT close.
		const overlay = openOverlay();
		fireEvent.click(within(overlay).getByTestId("profile-chart"));
		expect(screen.getByTestId("profile-graph-overlay")).toBeTruthy();
	});

	it("cumulative-default-and-filter", () => {
		render(<ProfileGraph series={FULL} />);
		const overlay = openOverlay();

		// Default selection is "cumulative", and it is the FIRST option.
		const filter =
			within(overlay).getByTestId<HTMLSelectElement>("market-filter");
		expect(filter.value).toBe("cumulative");
		expect(filter.options.item(0)?.value).toBe("cumulative");
		// Option inventory: cumulative + ONE per DISTINCT marketId (M1 holds
		// two segments yet contributes exactly one option).
		expect(
			within(filter).getByTestId("market-filter-option-cumulative"),
		).toBeTruthy();
		expect(
			within(filter).getByTestId(`market-filter-option-${M1}`),
		).toBeTruthy();
		expect(
			within(filter).getByTestId(`market-filter-option-${M2}`),
		).toBeTruthy();
		expect(byPrefix(filter, "market-filter-option-")).toHaveLength(3);

		// Cumulative expanded view carries the free-Dharma line.
		expect(within(overlay).getByTestId("line-freedharma")).toBeTruthy();

		// Select M1 → the free-Dharma line leaves; M1 segments arrive.
		fireEvent.change(filter, { target: { value: M1 } });
		expect(screen.queryByTestId("line-freedharma")).toBeNull();
		expect(
			byPrefix(document.body, `segment-${M1}-`).length,
		).toBeGreaterThanOrEqual(1);
	});

	it("free-dharma-absent-in-per-market-view", () => {
		// N-4: the free-Dharma line is CUMULATIVE-ONLY. Direct chart render in
		// per-market mode — the per-market content is that market's segments,
		// not the cumulative lines.
		render(<ProfileChart series={FULL} selection={M1} mode="expanded" />);
		expect(screen.queryByTestId("line-freedharma")).toBeNull();
		expect(screen.queryByTestId("line-networth")).toBeNull();
		expect(screen.getByTestId(`segment-${M1}-0`)).toBeTruthy();
	});

	it("gap-rendering", () => {
		// SideEpisode gap law: episode 0 (exited) and episode 1 (open) are
		// SEPARATE polylines — a hard gap, never one bridged path.
		render(<ProfileChart series={FULL} selection={M1} mode="expanded" />);
		const s0 = screen.getByTestId(`segment-${M1}-0`);
		const s1 = screen.getByTestId(`segment-${M1}-1`);
		expect(s0).not.toBe(s1);
		expect(s0.tagName.toLowerCase()).toBe("polyline");
		expect(s1.tagName.toLowerCase()).toBe("polyline");
		expect(byPrefix(document.body, `segment-${M1}-`)).toHaveLength(2);
	});

	it("node-on-line-placement", () => {
		// Expanded cumulative: one node per series.nodes entry, positioned,
		// inside the chart svg.
		render(
			<ProfileChart series={FULL} selection="cumulative" mode="expanded" />,
		);
		const chart = screen.getByTestId("profile-chart");
		expect(chart.tagName.toLowerCase()).toBe("svg");
		expect(byPrefix(chart, "graph-node-")).toHaveLength(FULL.nodes.length);
		for (const node of FULL.nodes) {
			const el = screen.getByTestId(`graph-node-${node.id}`);
			expect(chart.contains(el)).toBe(true);
			expect(carriesPosition(el)).toBe(true);
		}
	});

	it("flip-marker-not-a-node", () => {
		render(<ProfileChart series={FULL} selection={M1} mode="expanded" />);
		// The exited segment (episode 0) carries a flip marker under its OWN
		// testid; the open segment (episode 1, exitedAt null) carries none.
		const marker = screen.getByTestId(`flip-marker-${M1}-0`);
		expect(screen.queryByTestId(`flip-marker-${M1}-1`)).toBeNull();
		// Per-market view renders exactly THAT market's nodes (non-vacuous:
		// M1 owns one post node) — and querying graph-node-* never returns
		// the flip marker, nor is the marker nested inside a node.
		const nodeEls = byPrefix(document.body, "graph-node-");
		const m1Nodes = FULL.nodes.filter((n) => n.marketId === M1);
		expect(nodeEls).toHaveLength(m1Nodes.length);
		expect(nodeEls).not.toContain(marker);
		expect(marker.closest('[data-testid^="graph-node-"]')).toBeNull();
	});
});
