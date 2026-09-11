// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	AUTH_GATE_COPY,
	COMPOSER_COPY,
	c3OppositeSide,
	STATE_COPY,
} from "@/components/debate/composer/copy";
import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";

import {
	dialogName,
	modelWith,
	post,
	stubElementScroll,
	VIEWER,
	viewerHolding,
} from "./_fixtures";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const POSTS = [
	post({ id: "p1", ordinal: 1, side: "YES" }),
	post({ id: "p2", ordinal: 2, side: "NO" }),
];

function mount(over?: {
	viewer?: Parameters<typeof PhoneDebateView>[0]["viewer"];
	status?: "Open" | "Closed" | "Resolving" | "Resolved" | "Voided";
}) {
	return render(
		<PhoneDebateView
			model={modelWith(
				POSTS,
				over?.status === undefined ? undefined : { status: over.status },
			)}
			viewer={over?.viewer === undefined ? VIEWER : over.viewer}
			initialPostId={null}
			ownPseudonym={null}
			details={null}
		/>,
	);
}

/**
 * MOBILE-2 guards 9, 10, 11, 13 — the bottom bar is the phone tier's only door
 * to a stake, so every one of its states is pinned by behaviour rather than by
 * a class.
 *
 * ⚠ SELECTION IS BY `data-testid`, NEVER BY A STYLING CLASS (OVN-V5). A selector
 * keyed on presentation changes meaning whenever a neighbour is restyled, and
 * does so silently — this repo has a recorded instance of `:scope >
 * span.flex-col` matching three nodes where the author believed it matched two.
 */
describe("phone bar — the label follows the active tab (guard 9)", () => {
	it("phone-bar::tapping-the-NO-tab-flips-the-entry-label", () => {
		mount();
		expect(screen.getByTestId("phone-bar-entry").textContent).toContain(
			"Bet YES",
		);
		fireEvent.click(screen.getByTestId("phone-tab-NO"));
		expect(screen.getByTestId("phone-bar-entry").textContent).toContain(
			"Bet NO",
		);
		// POSITIVE CONTROL for the assertion's own sensitivity: the YES label is
		// genuinely GONE, not merely joined by a second one.
		expect(screen.getByTestId("phone-bar-entry").textContent).not.toContain(
			"Bet YES",
		);
	});

	it("phone-bar::the-sheet-the-NO-bar-opens-composes-NO", () => {
		// ⛔ THE LABEL IS NOT THE SIDE. The row above proves the bar RENAMES
		// itself when the pane changes; it says nothing about what the button
		// then OPENS. A build that pins `setSheet({kind:"post", side:"YES"})`
		// keeps every label correct and still hands a NO tapper a YES composer —
		// measured green against all sixteen render rows before this one existed.
		mount();
		fireEvent.click(screen.getByTestId("phone-tab-NO"));
		fireEvent.click(screen.getByTestId("phone-bar-entry"));
		const section = screen
			.getByTestId("phone-sheet")
			.querySelector("section[aria-label]");
		expect(section?.getAttribute("aria-label")).toBe(
			`${COMPOSER_COPY.header} — NO`,
		);
	});
});

describe("phone bar — signed out opens the gate, never the composer (guard 10)", () => {
	/**
	 * ⛔ THE WRONG ANSWER THIS REJECTS IS A SIGNED-OUT COMPOSER — a form that
	 * takes an argument and a stake from someone with no account and no Dharma,
	 * and discovers that at submit time.
	 */
	it("phone-bar::viewer-null-mounts-AuthGateSlot-and-not-BetComposer", () => {
		mount({ viewer: null });
		fireEvent.click(screen.getByTestId("phone-bar-entry"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(sheet.textContent).toContain(AUTH_GATE_COPY.heading("YES"));
		expect(sheet.textContent).toContain(AUTH_GATE_COPY.micro);
		// ⚠ AND THE SHEET IS NAMED BY WHAT IS INSIDE IT. Titling the signed-out
		// sheet `Place your Đ BET` announces an action the reader cannot take and
		// then shows them why not — two headings disagreeing about what the screen
		// is for, and the accessible name is the one a screen reader hears FIRST.
		expect(dialogName(sheet)).toBe(AUTH_GATE_COPY.heading("YES"));
		expect(dialogName(sheet)).not.toBe(COMPOSER_COPY.header);
		// The composer's own argument field is the thing that must NOT be here.
		expect(sheet.querySelector('[aria-label="Argument title"]')).toBeNull();
	});

	it("phone-bar::a-signed-in-viewer-gets-the-real-composer", () => {
		// POSITIVE CONTROL for the row above — the same tap on the same bar with a
		// viewer present DOES mount the composer, so "AuthGateSlot" is a fact
		// about being signed out rather than about the sheet never filling.
		mount();
		fireEvent.click(screen.getByTestId("phone-bar-entry"));
		const sheet = screen.getByTestId("phone-sheet");
		expect(dialogName(sheet)).toBe(COMPOSER_COPY.header);
		expect(
			sheet.querySelector("section[aria-label]")?.getAttribute("aria-label"),
		).toBe(`${COMPOSER_COPY.header} — YES`);
	});
});

describe("phone bar — the F-3 opposite-side gate (guard 11)", () => {
	/**
	 * The server's `opposite_side_held` 400 stays authoritative; this is the
	 * display-grade bound, and the point of it is that the refusal ARRIVES WITH
	 * ITS REASON rather than as a dead control.
	 */
	it("phone-bar::holding-NO-disables-the-YES-entry-and-says-why", () => {
		mount({ viewer: viewerHolding("NO") });
		const entry = screen.getByTestId("phone-bar-entry");
		expect(entry.hasAttribute("disabled")).toBe(true);
		expect(screen.getByTestId("phone-bar-notice").textContent).toBe(
			c3OppositeSide({ held: "NO", resulting: "YES" }),
		);
		// POSITIVE CONTROL — switching to the side they DO hold re-enables it, so
		// `disabled` above is the gate and not a bar that is always dead.
		fireEvent.click(screen.getByTestId("phone-tab-NO"));
		expect(screen.getByTestId("phone-bar-entry").hasAttribute("disabled")).toBe(
			false,
		);
		expect(screen.queryByTestId("phone-bar-notice")).toBeNull();
	});
});

describe("phone bar — a settled market is read-locked (guard 13)", () => {
	/**
	 * ⛔ NO BUTTON AT ALL, not a disabled one. A disabled control on a resolved
	 * market still says "you could bet here", which is not true and will not
	 * become true (design-language §1.8).
	 */
	/**
	 * ⚠⚠ THE STATE IS NAMED BY `LifecycleBadge`, AND THESE ROWS USED TO ASSERT
	 * `STATE_COPY` INSTEAD. That was wrong in a way the rows themselves could not
	 * show: `STATE_COPY` has no entry for `Resolved` or `Voided`, so both fell
	 * through to `marketClosed.title` and a participant whose position had just
	 * settled read "This market is closed." `@code-reviewer` caught it. The
	 * assertions now read the badge, which is the desktop's own owner for this
	 * fact and which carries the terminal `· read-only` wording per state.
	 */
	it("phone-bar::a-Closed-market-renders-the-state-and-no-entry-control", () => {
		mount({ status: "Closed" });
		expect(screen.queryByTestId("phone-bar-entry")).toBeNull();
		expect(screen.getByTestId("phone-bar-notice").textContent).toBe(
			"Closed · read-only",
		);
	});

	it("phone-bar::a-Resolving-market-reads-its-own-state", () => {
		mount({ status: "Resolving" });
		expect(screen.queryByTestId("phone-bar-entry")).toBeNull();
		expect(screen.getByTestId("phone-bar-notice").textContent).toBe(
			"Resolving · read-only",
		);
	});

	it("phone-bar::a-RESOLVED-market-does-not-read-as-merely-closed", () => {
		// ⛔ THE ROW THAT WOULD HAVE CAUGHT THE DEFECT. `Resolved` and `Voided`
		// have no `STATE_COPY` entry at all, so any build that routes lifecycle
		// through that register tells a settled participant their market is
		// "closed" — a different and less final thing than what happened.
		mount({ status: "Resolved" });
		expect(screen.queryByTestId("phone-bar-entry")).toBeNull();
		const notice = screen.getByTestId("phone-bar-notice").textContent ?? "";
		expect(notice).toBe("Resolved · read-only");
		expect(notice).not.toBe(STATE_COPY.marketClosed.title);
	});

	it("phone-bar::an-Open-market-DOES-render-the-entry-control", () => {
		// POSITIVE CONTROL for both rows above — the absence they assert is a
		// property of the lifecycle state, not of the bar.
		mount();
		expect(screen.queryByTestId("phone-bar-entry")).not.toBeNull();
		expect(screen.queryByTestId("phone-bar-notice")).toBeNull();
	});
});
