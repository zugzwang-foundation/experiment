// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { PhoneDebateView } from "@/components/debate/phone/PhoneDebateView";

import { modelWith, post, reply, stubElementScroll, VIEWER } from "./_fixtures";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * MOBILE-2 guards 12 and 14 — Support inherits the parent's side, Counter
 * opposes it, and the thread's two tabs are the model's own partition.
 *
 * ⛔⛔ THIS IS INV-3 AT THE UI, AND THE WRONG ANSWER IS SILENT. A reply whose
 * relation and side disagree does not error: it places a real bet on the wrong
 * pole, with an argument attached to it, and the comment is side-bound at post
 * time so nothing later can move it. `deriveReplySide` owns the rule; what these
 * rows prove is that the phone tier ASKS it rather than guessing.
 *
 * ⚠ THE ASSERTION IS THE COMPOSER'S OWN `aria-label`, which is
 * `${COMPOSER_COPY.header} — ${side}` and is therefore the REAL side the real
 * component received. Asserting on a prop passed to a mock would prove only that
 * the test's mock was called.
 *
 * ⛔⛔ AND THE CHAIN IS TWO HOPS, ONLY ONE OF WHICH LIVES HERE. This file proves
 * *derivation → label*. What proves *label → WIRE* is
 * `tests/unit/composer/render/side-identity.test.tsx`
 * (`side-identity::a-YES-composer-shows-YES-and-submits-YES` and its NO twin),
 * which is the seam's real owner. Measured: mutating `BetComposer`'s
 * `side: props.side` into `buildPlaceRequest` while leaving the label on
 * `props.side` keeps every row in THIS file green and reds exactly those two.
 * ⇒ The soundness of the rows below depends on a file they do not name, so they
 * name it. A reader who deletes `side-identity.test.tsx` as redundant would
 * leave this surface asserting a string and nothing else.
 *
 * ⚠ The fixture gives each post its OWN pseudonym (`_fixtures.ts`), so the reply
 * header names WHICH post the composer opened against and not merely that it
 * opened against one.
 */
const YES_POST = post({ id: "p1", ordinal: 1, side: "YES" });
const NO_POST = post({ id: "p2", ordinal: 2, side: "NO" });

function mountFeed() {
	return render(
		<PhoneDebateView
			model={modelWith([YES_POST, NO_POST])}
			viewer={VIEWER}
			initialPostId={null}
			ownPseudonym={null}
			details={null}
		/>,
	);
}

function composerSection(): HTMLElement {
	const sheet = screen.getByTestId("phone-sheet");
	const section = sheet.querySelector("section[aria-label]");
	if (section === null) {
		throw new Error("no composer section inside the sheet");
	}
	return section as HTMLElement;
}

describe("phone reply — the relation decides the side (guard 12)", () => {
	it("phone-reply::Support-on-a-YES-post-composes-YES", () => {
		mountFeed();
		// The card's trigger pills are `AggregateFooter`'s own, selected by ITS
		// testid (`card-trigger-<relation>`) rather than by text or by a class —
		// the phone tier reuses that component, so reaching for its published
		// handle is the whole point of reusing it (OVN-V5).
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-support"));
		expect(composerSection().getAttribute("aria-label")).toBe(
			`${COMPOSER_COPY.header} — YES`,
		);
		expect(screen.getByTestId("phone-sheet").textContent).toContain(
			`Support ${YES_POST.removed ? "" : YES_POST.author.pseudonym}'s argument`,
		);
	});

	it("phone-reply::Counter-on-a-YES-post-composes-NO", () => {
		mountFeed();
		const yesPane = screen.getByTestId("phone-pane-YES");
		fireEvent.click(within(yesPane).getByTestId("card-trigger-counter"));
		expect(composerSection().getAttribute("aria-label")).toBe(
			`${COMPOSER_COPY.header} — NO`,
		);
		expect(screen.getByTestId("phone-sheet").textContent).toContain(
			`Counter ${YES_POST.removed ? "" : YES_POST.author.pseudonym}'s argument`,
		);
	});
});

describe("phone thread — the partition is the model's (guard 14)", () => {
	/**
	 * ⚠ THE FIXTURE IS BUILT ON A **NO** POST DELIBERATELY. On a YES post,
	 * "Support" and "the YES side" coincide, so a build that partitioned by
	 * `reply.side === "YES"` would pass. A NO parent separates the two: its
	 * Support replies are NO and its Counter replies are YES, so only a build
	 * reading the relation groups gets both counts right.
	 */
	const SUPPORTER = reply({
		id: "r1",
		side: "NO",
		pseudonym: "IndigoArmadillo000",
	});
	const SUPPORTER_2 = reply({
		id: "r3",
		side: "NO",
		pseudonym: "TealPangolin000",
	});
	const OPPONENT = reply({
		id: "r2",
		side: "YES",
		pseudonym: "RoseChinchilla000",
	});
	const PARENT = post({
		id: "p9",
		ordinal: 9,
		side: "NO",
		replies: { support: [SUPPORTER, SUPPORTER_2], counter: [OPPONENT] },
	});

	function mountThread() {
		return render(
			<PhoneDebateView
				model={modelWith([PARENT])}
				viewer={VIEWER}
				initialPostId="p9"
				ownPseudonym={null}
				details={null}
			/>,
		);
	}

	it("phone-thread::a-same-side-reply-counts-under-Support-and-the-opposite-under-Counter", () => {
		mountThread();
		expect(screen.getByTestId("phone-debate-view").dataset.arm).toBe("thread");
		expect(screen.getByTestId("phone-tab-support").textContent).toBe(
			"Support2",
		);
		expect(screen.getByTestId("phone-tab-counter").textContent).toBe(
			"Counter1",
		);
		// The panes carry the right occupants, which is the half a count alone
		// cannot prove — two replies in the wrong panes give the same two counts.
		expect(screen.getByTestId("phone-pane-support").textContent).toContain(
			"IndigoArmadillo000",
		);
		expect(screen.getByTestId("phone-pane-counter").textContent).toContain(
			"RoseChinchilla000",
		);
		expect(screen.getByTestId("phone-pane-support").textContent).not.toContain(
			"RoseChinchilla000",
		);
	});

	it("phone-thread::the-bar-composes-the-parents-side-for-Support-and-the-opposite-for-Counter", () => {
		mountThread();
		fireEvent.click(screen.getByTestId("phone-bar-support"));
		expect(composerSection().getAttribute("aria-label")).toBe(
			`${COMPOSER_COPY.header} — NO`,
		);
		cleanup();
		mountThread();
		fireEvent.click(screen.getByTestId("phone-bar-counter"));
		expect(composerSection().getAttribute("aria-label")).toBe(
			`${COMPOSER_COPY.header} — YES`,
		);
	});
});
