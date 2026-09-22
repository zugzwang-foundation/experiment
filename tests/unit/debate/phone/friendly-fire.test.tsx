// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
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
 * FF-1 CLOSE-1 (R-A12 / R-A15): the switch sits INSIDE the sheet composer's
 * header row with the helper line beneath it, and below 640px no gloss mounts
 * on the switch label or the tag — the same render at/above 640px is the
 * positive control (in jsdom the phone tree is always mounted; the tier is
 * whatever `matchMedia` answers, stubbed per query as `info-tip.test.tsx` does).
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useParams: () => ({ slug: "bitcoin-price-50k" }),
}));

stubElementScroll();

const ORIGINAL_MATCH_MEDIA = window.matchMedia;

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
	window.matchMedia = ORIGINAL_MATCH_MEDIA;
});

const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const TIER_QUERY = "not all and (min-width: 640px)";

function mockMatchMedia(pointerFine: boolean, phone: boolean): void {
	window.matchMedia = ((query: string) => ({
		matches:
			query === POINTER_QUERY
				? pointerFine
				: query === TIER_QUERY
					? phone
					: false,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

const SWITCH_GLOSS_YES =
	"Friendly fire: a Support reply that backs the side but contests this argument. The bet itself is unchanged — your stake still backs YES.";
const TAG_GLOSS =
	"Friendly fire: this reply backs the side but contests the argument above.";

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

describe("phone friendly-fire — CLOSE-1: the switch in the header row, no gloss below 640px", () => {
	it("phone-ff::the-switch-sits-INSIDE-the-sheet-composer's-header-row-with-the-helper-beneath", () => {
		mount(fixturePost(), null);
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-support"));
		const sheet = screen.getByTestId("phone-sheet");
		const header = sheet.querySelector('[data-testid="composer-header"]');
		const sw = sheet.querySelector('[data-testid="ff-switch"]');
		expect(header).not.toBeNull();
		expect(sw).not.toBeNull();
		expect(header?.contains(sw), "switch inside the header row").toBe(true);
		const close = header?.querySelector('button[aria-label="Close"]');
		expect(close).not.toBeNull();
		expect(
			(sw as Element).compareDocumentPosition(close as Element) &
				Node.DOCUMENT_POSITION_FOLLOWING,
			"the switch precedes the close control",
		).toBeTruthy();
		const helper = sheet.querySelector('[data-testid="ff-helper"]');
		expect(helper).not.toBeNull();
		expect(header?.contains(helper)).toBe(false);
		expect(helper?.previousElementSibling).toBe(header);
		expect(helper?.innerHTML).toContain(
			"Contest this argument without leaving your side. Your stake still backs YES.",
		);
	});

	it("phone-ff::below-640px-NO-gloss-mounts-on-the-switch-label-or-the-tag (positive control: the same render at-or-above 640px mounts both)", async () => {
		mockMatchMedia(false, true);
		mount(fixturePost(), null);
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-support"));
		const sheet = screen.getByTestId("phone-sheet");
		const label = sheet.querySelector(
			'[data-testid="ff-switch-label"]',
		) as Element;
		expect(label).not.toBeNull();
		expect(label.innerHTML).toContain("Friendly fire");
		expect(label.getAttribute("aria-describedby")).toBeNull();
		fireEvent.click(label);
		await new Promise((r) => setTimeout(r, 0));
		expect(document.body.textContent).not.toContain(SWITCH_GLOSS_YES);
		expect(
			document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
		).toBe(0);
		cleanup();

		mockMatchMedia(false, true);
		mount(fixturePost(), "p1");
		const tag = screen
			.getByTestId("phone-pane-support")
			.querySelector('[data-testid="ff-tag"]') as Element;
		expect(tag).not.toBeNull();
		expect(tag.getAttribute("aria-describedby")).toBeNull();
		fireEvent.click(tag);
		await new Promise((r) => setTimeout(r, 0));
		expect(document.body.textContent).not.toContain(TAG_GLOSS);
		expect(
			document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
		).toBe(0);
		cleanup();

		// POSITIVE CONTROL — the same two renders with the tier answering
		// "at/above 640px": both glosses are wired, so the emptiness above is the
		// gate and not a harness that cannot see a gloss.
		mockMatchMedia(false, false);
		mount(fixturePost(), null);
		fireEvent.click(
			within(screen.getByTestId("phone-pane-YES")).getByTestId(
				"card-trigger-support",
			),
		);
		const wideLabel = screen
			.getByTestId("phone-sheet")
			.querySelector('[data-testid="ff-switch-label"]') as Element;
		expect(wideLabel.getAttribute("aria-describedby")).toBeTruthy();
		fireEvent.click(wideLabel);
		await waitFor(() => {
			const id = wideLabel.getAttribute("aria-describedby") ?? "";
			expect(document.getElementById(id)?.textContent).toBe(SWITCH_GLOSS_YES);
		});
		cleanup();
		mockMatchMedia(false, false);
		mount(fixturePost(), "p1");
		const wideTag = screen
			.getByTestId("phone-pane-support")
			.querySelector('[data-testid="ff-tag"]') as Element;
		expect(wideTag.getAttribute("aria-describedby")).toBeTruthy();
	});
});
