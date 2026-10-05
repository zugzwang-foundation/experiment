// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AggregateFooter } from "@/components/debate/AggregateFooter";
import {
	FriendlyFireLegend,
	ReplySplitBar,
} from "@/components/debate/composer/ReplySplitBar";
import { friendlyFireOfSupport } from "@/components/debate/composer/split-bar";
import { PhoneSideTabs } from "@/components/debate/phone/PhoneSideTabs";

/**
 * Founder ruling 2026-10-04 — the post's Support/Counter bar shows its
 * friendly-fire share as a HATCHED segment inside the Support fill, from
 * the fill's start. Friendly fire is Support money contesting the
 * post (ADR-0058), so it is a part OF the Support fill, never a third pole and
 * never spilling into the Counter track.
 */

afterEach(cleanup);

describe("friendlyFireOfSupport — the hatched share of the Support fill", () => {
	it("is friendly fire ÷ Support, truncated to 2 decimals", () => {
		expect(
			friendlyFireOfSupport({
				friendlyFireDharma: "100.000000000000000000",
				supportDharma: "300.000000000000000000",
			}),
		).toBe("33.33%");
	});

	it("never claims more than the whole fill", () => {
		expect(
			friendlyFireOfSupport({
				friendlyFireDharma: "500",
				supportDharma: "300",
			}),
		).toBe("100.00%");
	});

	it("is null with no friendly fire, a zero figure, or no Support to sit in", () => {
		expect(
			friendlyFireOfSupport({
				friendlyFireDharma: undefined,
				supportDharma: "300",
			}),
		).toBeNull();
		expect(
			friendlyFireOfSupport({ friendlyFireDharma: "0", supportDharma: "300" }),
		).toBeNull();
		expect(
			friendlyFireOfSupport({ friendlyFireDharma: "50", supportDharma: "0" }),
		).toBeNull();
	});
});

describe("AggregateFooter — the hatched friendly-fire segment", () => {
	const base = {
		supportCount: 3,
		counterCount: 1,
		supportDharma: "400.000000000000000000",
		counterDharma: "100.000000000000000000",
	};

	it("sits INSIDE the Support fill, anchored to its START, at its share", () => {
		const { container } = render(
			<AggregateFooter
				aggregate={{ ...base, friendlyFireDharma: "100.000000000000000000" }}
				postSide="YES"
			/>,
		);
		const fill = container.querySelector(
			'[data-testid="aggregate-split-fill"]',
		);
		const hatch = container.querySelector('[data-testid="split-ff-hatch"]');
		expect(hatch).not.toBeNull();
		expect(hatch?.parentElement).toBe(fill);
		expect((hatch as HTMLElement).style.width).toBe("25%");
		const cls = hatch?.getAttribute("class") ?? "";
		expect(cls).toContain("left-0");
		expect(cls).toContain("repeating-linear-gradient");
	});

	it("is absent without friendly fire — the bar is what it was", () => {
		for (const ff of [undefined, "0.000000000000000000"]) {
			const { container, unmount } = render(
				<AggregateFooter
					aggregate={{ ...base, friendlyFireDharma: ff }}
					postSide="YES"
				/>,
			);
			// Positive control: the fill itself is there.
			expect(
				container.querySelector('[data-testid="aggregate-split-fill"]'),
			).not.toBeNull();
			expect(
				container.querySelector('[data-testid="split-ff-hatch"]'),
			).toBeNull();
			unmount();
		}
	});
});

describe("the OPENED post and the phone thread wear the same hatch", () => {
	it("ReplySplitBar (post-focus) hatches its Support fill", () => {
		const { container } = render(
			<ReplySplitBar
				postSide="YES"
				aggregate={{
					supportCount: 3,
					counterCount: 1,
					supportDharma: "400",
					counterDharma: "100",
					friendlyFireDharma: "100",
				}}
			/>,
		);
		const hatch = container.querySelector('[data-testid="split-ff-hatch"]');
		expect((hatch as HTMLElement | null)?.style.width).toBe("25%");
	});

	it("PhoneSideTabs (phone thread) hatches its Support fill", () => {
		const { container } = render(
			<PhoneSideTabs
				options={[
					{ key: "support", label: "Support", trailing: "" },
					{ key: "counter", label: "Counter", trailing: "" },
				]}
				active="support"
				onSelect={() => undefined}
				panelIdFor={(key) => `panel-${key}`}
				split={{
					supportDharma: "400",
					counterDharma: "100",
					friendlyFireDharma: "100",
					postSide: "YES",
				}}
			/>,
		);
		const fill = container.querySelector('[data-testid="phone-split-fill"]');
		const hatch = container.querySelector('[data-testid="split-ff-hatch"]');
		expect(hatch?.parentElement).toBe(fill);
		expect((hatch as HTMLElement | null)?.style.width).toBe("25%");
	});
});

describe("FriendlyFireLegend — the key to the hatch on the opened post", () => {
	it("shows a hatched swatch and the figure when the post drew fire", () => {
		const { container } = render(
			<FriendlyFireLegend postSide="YES" friendlyFireDharma="50" />,
		);
		const legend = container.querySelector('[data-testid="ff-legend"]');
		expect(legend?.innerHTML).toContain("Friendly fire");
		expect(legend?.innerHTML).toContain("Đ 50");
		expect(
			legend?.querySelector('[data-testid="split-ff-hatch"]'),
		).not.toBeNull();
	});

	it("renders nothing without friendly fire", () => {
		for (const ff of [undefined, "0", "0.000000000000000000"]) {
			const { container, unmount } = render(
				<FriendlyFireLegend postSide="NO" friendlyFireDharma={ff} />,
			);
			expect(container.innerHTML).toBe("");
			unmount();
		}
	});
});
