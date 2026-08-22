// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// POSREV-1 — `PositionsTable` now owns the inline sell, which calls `useRouter`
// for its post-sale `refresh()`. Nothing here submits; the stub only has to exist.
vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { ArgumentList } from "@/components/profile/ArgumentList";
import { PositionsTable } from "@/components/profile/PositionsTable";
import type { ProfileArgumentItem } from "@/server/profile/arguments";
import type { ProfilePositionsPayload } from "@/server/profile/owner-view";
import type { ProfilePositionRow } from "@/server/profile/positions";
import type { ProfileUser } from "@/server/profile/resolve";

/**
 * POSREV-1 S2 — **THE Đ SPACING AND THE STACKED SUPPORT/COUNTER LABELS.**
 *
 * Two small renders that were each wrong for a stated reason, so each is pinned
 * against the reason rather than against the pixels.
 *
 * **RF-4 · one density.** The Current cell's P/L delta printed `(+Đ1)` while the
 * figure it qualifies printed `Đ 151` — the same glyph on two densities two
 * characters apart. Both spellings were faithfully carried from a mockup whose
 * two figures sit in different regions; inside one cell the split has nothing
 * to justify it. ⚠ THE SIGN IS NOT PART OF THIS: `Đ 0` unsigned was already
 * correct and stays, so a test that only checked "a space exists" would pass on
 * a build that had also started printing `+Đ 0`. Both are asserted.
 *
 * **RF-2(a) · stack the label over its figure.** The two ends of the split bar
 * were horizontal pairs, so with the bar between them the two Đ figures sat at
 * different distances from their own labels AND from the bar.
 *
 * ⚠⚠ THE STACKING IS ASSERTED ON MARKUP, NEVER ON `textContent` (CLAUDE.md §8
 * O-7). A column and a row flatten to the SAME string, so a `textContent` read
 * cannot see the thing this row changes and would pass on the layout it was
 * written to reject. The assertions are the flex direction and the CHILD ORDER.
 *
 * Fixtures are inline plain objects on the shipped DTOs — no server code runs,
 * no DB, and no market content is invented (CLAUDE.md §3).
 */

afterEach(cleanup);

const M1 = "0190c0de-aaaa-7000-8000-000000000001";
const C1 = "0190c0de-ffff-7000-8000-000000000044";

const USER: ProfileUser = {
	id: "0190c0de-1111-7000-8000-0000000000f1",
	pseudonym: "RedFox001",
	banned: false,
	pfpUrl: "/pfp-placeholder.svg",
};

const dp18 = (v: string): string => {
	const [int, frac = ""] = v.split(".");
	return `${int}.${frac.padEnd(18, "0")}`;
};

function row(over: Partial<ProfilePositionRow> = {}): ProfilePositionRow {
	return {
		marketId: M1,
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		marketStatus: "Open",
		statusLabel: "Open",
		settled: false,
		side: "YES",
		quantity: dp18("10"),
		staked: dp18("150"),
		current: dp18("151"),
		argument: {
			removed: false,
			commentId: C1,
			title: "Opener argument alpha",
			isReply: false,
			postOrdinal: 1,
			marketSlug: "fixture-alpha",
			repliedToTitle: null,
		},
		lots: [],
		...over,
	};
}

function payload(r: ProfilePositionRow): ProfilePositionsPayload {
	return { owner: false, rows: [r] };
}

function post(
	supportDharma: string,
	counterDharma: string,
): ProfileArgumentItem {
	return {
		removed: false,
		kind: "post",
		id: C1,
		side: "YES",
		marketSlug: "fixture-alpha",
		marketTitle: "Market fixture-alpha",
		ordinal: 1,
		title: "A profile post",
		teaser: "Neutral fixture teaser.",
		body: "A profile post\n\nNeutral fixture body.",
		marker: "none",
		authorStake: dp18("20"),
		authorStakeOriginal: dp18("20"),
		// ⚠ `authorSold`, NOT `sold` — the POST variant's spelling. The reply
		// variant is the one that carries `sold`, and a cast to
		// `ProfileArgumentItem` hid the difference until `tsc` refused the
		// insufficient overlap. Written WITHOUT a cast for exactly that reason
		// (AGENTS.md §4): the annotation is what makes the union check the shape.
		authorSold: false,
		priceAtBet: dp18("0.5"),
		createdAt: "2026-07-01T00:00:00.000Z",
		aggregate: {
			supportCount: 3,
			counterCount: 1,
			supportDharma,
			counterDharma,
		},
	};
}

describe("POSREV-1 RF-4 — every Đ on this surface carries its space", () => {
	it("renders the P/L delta as `+Đ <n>`, not `+Đ<n>`", () => {
		render(<PositionsTable payload={payload(row())} />);
		const pl = screen.getByTestId(`tile-pl-${M1}`);
		// staked 150 → current 151 ⇒ +1. The parenthesis and the sign are the
		// cell's, the space is RF-4's.
		expect(pl.textContent).toBe("(+Đ 1)");
	});

	it("renders a LOSS the same way, with U+2212 and a space", () => {
		render(<PositionsTable payload={payload(row({ current: dp18("138") }))} />);
		const pl = screen.getByTestId(`tile-pl-${M1}`);
		// ⚠ U+2212 MINUS, not the ASCII hyphen — byte-carried by the formatter.
		expect(pl.textContent).toBe("(−Đ 12)");
	});

	it("leaves ZERO unsigned — the sign logic is untouched by RF-4", () => {
		// ⛔ THE CONTROL FOR THE TWO ABOVE. RF-4 changed the SPACE and nothing
		// else; a build that "fixed the formatting" by signing everything would
		// pass both tests above and fail here. `Đ 0`, never `+Đ 0`.
		render(<PositionsTable payload={payload(row({ current: dp18("150") }))} />);
		const pl = screen.getByTestId(`tile-pl-${M1}`);
		expect(pl.textContent).toBe("(Đ 0)");
	});

	it("no Đ anywhere in the positions panel is followed by a digit", () => {
		// The sweep, so a THIRD site cannot reintroduce the tight form unnoticed.
		// ⚠ POSITIVE CONTROL for the regex itself is immediately below.
		const { container } = render(<PositionsTable payload={payload(row())} />);
		expect(container.textContent ?? "").not.toMatch(/Đ[0-9]/);
	});

	it("the sweep's regex DOES fire on the tight form (control)", () => {
		// ⛔ A NEGATIVE ASSERTION WITH NO CONTROL IS A DETECTOR THAT MAY NOT
		// EXIST. This runs the SAME pattern over a string that contains exactly
		// what the sweep forbids, and requires it to match.
		expect("Đ 151 (+Đ1)").toMatch(/Đ[0-9]/);
	});
});

describe("POSREV-1 RF-2(a) — Support/Counter stack over their figures", () => {
	/**
	 * The two ends carry their OWN testids rather than being picked out by class.
	 * ⚠ A CLASS SELECTOR WAS TRIED FIRST AND WAS WRONG: `:scope > span.flex-col`
	 * matched THREE nodes, because the middle group — the bar over its staked
	 * total — is a column too and always was. Selecting the thing under test by a
	 * styling class means the selector changes meaning whenever a neighbour is
	 * restyled, which is how a guard silently starts testing something else.
	 */
	function ends(): Element[] {
		render(
			<ArgumentList
				items={[post(dp18("300"), dp18("100"))]}
				owner={false}
				author={USER}
			/>,
		);
		return [
			screen.getByTestId(`argument-split-support-${C1}`),
			screen.getByTestId(`argument-split-counter-${C1}`),
		];
	}

	it("renders each end as a COLUMN, not a row", () => {
		// ⚠ MARKUP, NOT TEXT (O-7): a row and a column flatten identically, so a
		// `textContent` read cannot see the property this row changes.
		for (const e of ends()) {
			expect(e.className.split(/\s+/)).toContain("flex-col");
		}
	});

	it("puts the LABEL first in both ends, so the two mirror each other", () => {
		// ⛔ THE COUNTER END USED TO RENDER FIGURE-FIRST. That was the horizontal
		// layout's mirroring; stacked, mirroring means both labels on the TOP
		// line. Reading the first child of each end is what catches a half-applied
		// change — the exact failure mode of turning one end into a column and
		// leaving the other's source order alone.
		expect(ends().map((e) => e.firstElementChild?.textContent)).toEqual([
			"Support",
			"Counter",
		]);
	});

	it("keeps each figure with its own label", () => {
		expect(
			ends().map((e) => [...e.children].map((c) => c.textContent)),
		).toEqual([
			["Support", "Đ 300"],
			["Counter", "Đ 100"],
		]);
	});
});

describe("POSREV-1 RF-2(b)+(c) — the bar leaves the poles and empties honestly", () => {
	function renderBar(support: string, counter: string) {
		return render(
			<ArgumentList
				items={[post(support, counter)]}
				owner={false}
				author={USER}
			/>,
		);
	}

	it("the track is NEUTRAL, never the NO pole", () => {
		// ⛔ ASSERTED BY TOKEN NAME, because "it looks grey" and "it is not the NO
		// pole" are different claims and only the second one is the rule. `bg-no`
		// IS #fafafa — it encodes the bet SIDE under INV-3, and Support/Counter is
		// a different relation entirely.
		renderBar(dp18("300"), dp18("100"));
		const track = screen.getByTestId(`argument-split-track-${C1}`);
		expect(track.className.split(/\s+/)).toContain("bg-n2");
		expect(track.className).not.toContain("bg-no");
		expect(track.className).not.toContain("bg-ink");
	});

	it("the fill is NEUTRAL, never the YES pole", () => {
		renderBar(dp18("300"), dp18("100"));
		const fill = screen.getByTestId(`argument-split-fill-${C1}`);
		expect(fill.className.split(/\s+/)).toContain("bg-n6");
		expect(fill.className).not.toContain("bg-yes");
		// …and it still carries the proportion, so the palette change did not
		// quietly take the bar's meaning with it.
		expect(fill.getAttribute("style")).toContain("75%");
	});

	it("at Đ 0 / Đ 0 there is NO FILL AT ALL — nothing is not everything", () => {
		// ⚠⚠ THE DEFECT, EXACTLY. The old track WAS the Counter pole, so a bar with
		// nothing in it painted entirely in Counter's colour and read as 100%
		// Counter. The fix is structural rather than chromatic: at zero the fill
		// span is not rendered, so there is nothing to misread.
		renderBar(dp18("0"), dp18("0"));
		expect(screen.getByTestId(`argument-split-track-${C1}`)).toBeTruthy();
		expect(screen.queryByTestId(`argument-split-fill-${C1}`)).toBeNull();
	});

	it("CONTROL — at Đ 0 Support / Đ 100 Counter the fill EXISTS at zero width", () => {
		// ⛔⛔ THE ROW THAT MAKES THE ONE ABOVE MEAN ANYTHING. Both states have
		// `supportPct === "0%"`, and they are OPPOSITE facts: "nothing has been
		// staked" versus "everything staked is Counter". A guard that only checked
		// the zero-zero case would pass on a build that had simply stopped
		// rendering the fill whenever it was empty — losing the second state's
		// meaning to fix the first. Here the fill is PRESENT, at width zero.
		renderBar(dp18("0"), dp18("100"));
		const fill = screen.getByTestId(`argument-split-fill-${C1}`);
		expect(fill.getAttribute("style")).toContain("0%");
	});
});
