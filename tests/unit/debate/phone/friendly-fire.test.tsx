// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";
import type { DebatePost, DebateReply } from "@/components/debate/types";

import { modelWith, post, reply, stubElementScroll, VIEWER } from "./_fixtures";

/**
 * FF-1 / ADR-0058 — G14: the phone tier carries the SAME three elements as the
 * desktop (RF-9 / ADR-0051): the switch in the sheet's composer under Support
 * only, the tag on flagged reply rows in the thread pane, the meter beneath the
 * Support tab and nowhere else — and the phone post card carries nothing.
 *
 * ⚠ The composer inside the sheet is the SAME `BetComposer` the desktop mounts,
 * so the switch's own contract (copy, wire key, reset) is pinned once, in
 * `tests/unit/composer/render/friendly-fire-switch.test.tsx`; what this file
 * proves is that the phone HOST reaches it with the right relation, and that the
 * host's own two additions (the meter row, and nothing on the card) hold.
 * Markup assertions read `innerHTML`/attributes (O-7); the negatives have their
 * positive controls in the same file (OVN-V1).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const AGG_WITH_FF = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "100.000000000000000000",
	counterDharma: "50.000000000000000000",
	friendlyFireDharma: "25.000000000000000000",
};

function flagged(
	id: string,
	side: "YES" | "NO",
	pseudonym: string,
): DebateReply {
	return {
		...reply({ id, side, pseudonym }),
		friendlyFire: true,
	} as DebateReply;
}

/** A YES post with one plain Support, one friendly-fire Support, one Counter. */
function fixturePost(over?: Partial<DebatePost>): DebatePost {
	const plain = reply({
		id: "r-plain",
		side: "YES",
		pseudonym: "IndigoArmadillo000",
	});
	const ff = flagged("r-ff", "YES", "TealPangolin000");
	const counter = reply({
		id: "r-counter",
		side: "NO",
		pseudonym: "RoseChinchilla000",
	});
	return {
		...post({
			id: "p1",
			ordinal: 1,
			side: "YES",
			replies: { support: [plain, ff], counter: [counter] },
		}),
		aggregate: AGG_WITH_FF,
		...over,
	} as DebatePost;
}

function mount(p: DebatePost, initialPostId: string | null) {
	return render(
		<PhoneDebateView
			model={modelWith([p])}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
			details={null}
		/>,
	);
}

describe("phone friendly-fire — the composer in the sheet (G14 · switch)", () => {
	it("phone-ff::Support-opens-a-composer-with-the-switch-OFF", () => {
		mount(fixturePost(), null);
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-support"));
		const sheet = screen.getByTestId("phone-sheet");
		const sw = sheet.querySelector('[data-testid="ff-switch"]');
		expect(sw).not.toBeNull();
		expect(sw?.getAttribute("aria-checked")).toBe("false");
		expect(sheet.innerHTML).toContain(
			"Contest this argument without leaving your side. Your stake still backs YES.",
		);
	});

	it("phone-ff::Counter-opens-a-composer-WITHOUT-the-switch", () => {
		mount(fixturePost(), null);
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-counter"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(sheet.querySelector('[data-testid="ff-switch"]')).toBeNull();
		expect(sheet.innerHTML).not.toContain("Friendly fire");
	});
});

describe("phone friendly-fire — the thread pane (G14 · tag + meter)", () => {
	it("phone-ff::a-flagged-reply-wears-the-tag-in-the-Support-pane-and-a-plain-one-does-not", () => {
		mount(fixturePost(), "p1");
		const pane = screen.getByTestId("phone-pane-support");
		const tags = pane.querySelectorAll('[data-testid="ff-tag"]');
		expect(tags).toHaveLength(1);
		expect(tags[0]?.innerHTML).toContain("Friendly fire");
		// It sits on the FLAGGED row: the tag's card names that reply's author.
		const card = tags[0]?.closest("div");
		expect(card).not.toBeNull();
		// Counter pane: no tag anywhere.
		const counterPane = screen.getByTestId("phone-pane-counter");
		expect(counterPane.querySelector('[data-testid="ff-tag"]')).toBeNull();
	});

	it("phone-ff::the-meter-sits-beneath-the-Support-tab-with-both-figures-and-the-percent", () => {
		mount(fixturePost(), "p1");
		const row = screen.getByTestId("phone-ff-row");
		expect(row.innerHTML).toContain('data-testid="ff-meter-figure"');
		expect(row.innerHTML).toContain('data-testid="ff-meter"');
		expect(row.innerHTML).toContain("Đ 25");
		expect(row.innerHTML).toContain("Friendly fire · 25 % of Support Đ");
		expect(row.innerHTML).toContain("Đ 100");
		// The fill takes the post's pole (a YES post) — resolved in the
		// composer file, not in phone/.
		const fill = row.querySelector('[data-testid="ff-meter"] span[style]');
		expect(fill?.getAttribute("style")).toContain("width: 25%");
		expect(fill?.getAttribute("class")).toContain("bg-yes");
	});

	it("phone-ff::the-meter-is-absent-under-the-Counter-tab", () => {
		mount(fixturePost(), "p1");
		expect(screen.queryByTestId("phone-ff-row")).not.toBeNull();
		fireEvent.click(screen.getByRole("tab", { name: /Counter/ }));
		expect(screen.queryByTestId("phone-ff-row")).toBeNull();
		expect(document.body.querySelector('[data-testid="ff-meter"]')).toBeNull();
	});

	it("phone-ff::the-meter-is-absent-while-Support-Đ-is-zero (positive control above)", () => {
		mount(
			fixturePost({
				aggregate: {
					supportCount: 0,
					counterCount: 1,
					supportDharma: "0.000000000000000000",
					counterDharma: "50.000000000000000000",
					friendlyFireDharma: "0.000000000000000000",
				},
			}),
			"p1",
		);
		expect(screen.queryByTestId("phone-ff-row")).toBeNull();
		expect(document.body.innerHTML).not.toContain('data-testid="ff-meter"');
	});
});

describe("phone friendly-fire — the CARD is untouched (G14 · card)", () => {
	it("phone-ff::the-phone-post-card-carries-no-friendly-fire-element", () => {
		mount(fixturePost(), null);
		const yesPane = screen.getByTestId("phone-pane-YES");
		const html = yesPane.innerHTML;
		expect(html).not.toContain('data-testid="ff-');
		expect(html).not.toContain("Friendly fire");
		expect(html).not.toContain("friendly-fire");
		// POSITIVE CONTROL — the same model's thread pane DOES carry the strings.
		cleanup();
		mount(fixturePost(), "p1");
		expect(screen.getByTestId("phone-pane-support").innerHTML).toContain(
			'data-testid="ff-tag"',
		);
	});
});
