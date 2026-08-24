// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * FEED-1 REVIEW — THE COMPOSER'S HALF OF THE HANDOFF, asserted at the composer.
 *
 * ⚠⚠ WHY THIS FILE EXISTS. `BetComposer`'s success path grew a new branch at
 * FEED-1 — `readCommentId(outcome.data)` — with FOUR rejection cases and one
 * accept case, and NOTHING in `tests/` referenced `onPosted` except the harness
 * default (`grep -rln onPosted tests/` → `_harness.tsx`, and nothing else). The
 * DebateView render suite drives the ACCEPT case through the whole surface and
 * so proves it is wired; it never once submits a payload the parser must
 * REJECT, so the degrade branch the source docblock argues for at length
 * ("SG-5 posture: unknown input renders a state, never a crash") had no guard
 * of any kind.
 *
 * ⛔ AND THE REJECT BRANCH IS THE ONE THAT MATTERS MOST, because it is the only
 * path in FEED-1 that runs AFTER a committed bet and produces no confirmation.
 * A build that threw here, or that called `onPosted({ commentId: "" })` and
 * left the host hunting for a comment that cannot exist, would hold the slot
 * open on a 200 with nothing coming — and every existing guard would stay
 * green, because every existing guard feeds it a well-formed receipt.
 *
 * ⚠ `router.refresh` is asserted here too, from the other side. The budget file
 * counts refreshes at the HOST and reads 1; that is consistent with the
 * composer refreshing and the host not, as well as with the truth. This pins
 * WHICH component fired it.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: refreshMock }),
}));

import { BetComposer } from "@/components/debate/composer/BetComposer";
import { COMPOSER_COPY, STATE_COPY } from "@/components/debate/composer/copy";

import { composerProps, stubWireFetch, TITLE, wireError } from "./_harness";

/** A §4.4 success envelope carrying an arbitrary `data` payload. */
function ok(data: unknown) {
	return { status: 200, body: { ok: true, data } };
}

/** The well-formed receipt, for the accept case and as the positive control. */
const RECEIPT = {
	betId: "bet-0001",
	commentId: "cmt-just-posted",
	side: "YES",
	sharesBought: "20.000000000000000000",
	newPrice: "0.560000000000000000",
	parentCommentId: null,
};

beforeEach(() => {
	refreshMock.mockReset();
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

async function typeAndSubmit() {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
}

/** Render the composer with spies on all three exits, submit, return the spies. */
async function submitWith(data: unknown) {
	const onPosted = vi.fn();
	const onClose = vi.fn();
	const onSuspended = vi.fn();
	stubWireFetch([ok(data)]);
	render(
		<BetComposer {...composerProps({ onPosted, onClose, onSuspended })} />,
	);
	await typeAndSubmit();
	return { onPosted, onClose, onSuspended };
}

describe("FEED-1 — the composer hands the receipt up", () => {
	it("composer-handoff::a-200-hands-the-host-the-commentId-and-does-NOT-close", async () => {
		// THE POSITIVE CONTROL for every rejection below. Without it, four tests
		// asserting "onPosted was NOT called" would pass identically against a
		// build in which `onPosted` is never called at all.
		const { onPosted, onClose } = await submitWith(RECEIPT);

		expect(onPosted).toHaveBeenCalledTimes(1);
		expect(onPosted).toHaveBeenCalledWith({ commentId: "cmt-just-posted" });
		// ⛔ The composer does NOT close itself any more — the host holds the slot.
		expect(onClose).not.toHaveBeenCalled();
		// ⛔ AND IT DOES NOT REFRESH. The refresh moved to the host, which is the
		// component that has to recognise the new model; a second one fired here
		// would be a second server read for one bet and the §1 budget would be 3.
		expect(refreshMock).not.toHaveBeenCalled();
	});

	it("composer-handoff::an-EMPTY-commentId-is-NOT-a-comment-id", async () => {
		// ⛔ The source rule, stated in `readCommentId`'s own docblock: `typeof id
		// === "string"` alone lets `""` through and sends the host looking for a
		// post that cannot exist. It would land on the fallback ANYWAY — but by
		// accident rather than by rule, and a fallback reached by accident is one
		// refactor away from a slot held open on a 200 with nothing coming.
		const { onPosted, onClose } = await submitWith({
			...RECEIPT,
			commentId: "",
		});

		expect(onPosted).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("composer-handoff::a-MISSING-commentId-degrades-to-the-pre-FEED-1-close", async () => {
		const { commentId: _dropped, ...withoutId } = RECEIPT;
		const { onPosted, onClose } = await submitWith(withoutId);

		expect(onPosted).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("composer-handoff::a-NON-STRING-commentId-degrades-the-same-way", async () => {
		const { onPosted, onClose } = await submitWith({
			...RECEIPT,
			commentId: 17,
		});

		expect(onPosted).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("composer-handoff::a-NON-OBJECT-data-degrades-the-same-way", async () => {
		// `parseWireResponse` deliberately leaves `data` as `unknown` — it
		// validates the ENVELOPE, and the payload inside it is still the wire.
		const { onPosted, onClose } = await submitWith("cmt-just-posted");

		expect(onPosted).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);
	});

	it("composer-handoff::a-NULL-data-degrades-the-same-way-and-never-throws", async () => {
		// `typeof null === "object"` — the one branch a hand-rolled guard forgets.
		const { onPosted, onClose, onSuspended } = await submitWith(null);

		expect(onPosted).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(refreshMock).toHaveBeenCalledTimes(1);
		// ⛔ AND IT IS NOT AN ERROR. The bet is COMMITTED — the 200 already said so
		// — so an unreadable payload must never surface as a failed bet.
		// ⚠ Asserted against the SHIPPED copy strings, not a paraphrase: a hand-typed
		// "try again" would be a `not.toContain` on a string the product may never
		// render, which is a negative assertion with nothing behind it.
		expect(onSuspended).not.toHaveBeenCalled();
		expect(document.body.textContent ?? "").not.toContain(
			STATE_COPY.generic.title,
		);
		expect(document.body.textContent ?? "").not.toContain(
			STATE_COPY.transient.body,
		);
	});

	it("composer-handoff::the-POSITIVE-CONTROL-a-real-failure-DOES-render-the-error", async () => {
		// ⛔⛔ WITHOUT THIS, THE THREE NEGATIVES ABOUT ERROR COPY ARE UNFALSIFIABLE.
		// `not.toContain(STATE_COPY.generic.title)` passes identically against a
		// composer that renders that string on a real failure and one that renders
		// it never. This is the only assertion in the file that proves the error
		// surface exists at all.
		stubWireFetch([{ status: 500, body: wireError("internal_error") }]);
		render(<BetComposer {...composerProps()} />);
		await typeAndSubmit();

		expect(document.body.textContent ?? "").toContain(STATE_COPY.generic.title);
	});
});
