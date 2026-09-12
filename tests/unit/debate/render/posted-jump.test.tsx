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
 * FEED-2 — THE AUTHOR'S POST IS WHERE THE BET WAS.
 *
 * Placing a bet points the column on **that bet's own side** at the card the
 * author just wrote, in its true ranked position, with no chrome and nothing to
 * dismiss. This file replaces `posted-confirmation.test.tsx`, whose subject —
 * a panel that had to be dismissed — was ruled the wrong shape and deleted.
 *
 * ⚠⚠ THE INSTRUMENT IS PER-COLUMN, and it has to be, because the whole defect
 * being fixed was a SIDE error. `[data-debate-column="YES"|"NO"]` scopes every
 * assertion to one pole, so "the right card" and "the right side" are one
 * question. A surface-wide `getByText` would pass with the card on either pole.
 *
 * ⛔ THE CEILING: jsdom performs no layout and `router.refresh` is a spy. These
 * prove which card each column is SHOWING and when it moves — never that a real
 * server produced it or that it was drawn correctly.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

const { refreshMock, routerMock } = vi.hoisted(() => {
	const refresh = vi.fn();
	return {
		refreshMock: refresh,
		routerMock: {
			refresh,
			push: () => undefined,
			replace: () => undefined,
			back: () => undefined,
			forward: () => undefined,
			prefetch: () => undefined,
		},
	};
});

vi.mock("next/navigation", () => ({
	// POST-IMAGE-EXPORT — `DownloadPostImage` reads the market slug from the
	// route; a mock without `useParams` throws at the first post card render.
	useParams: () => ({ slug: "bitcoin-price-50k" }),
	useRouter: () => routerMock,
	usePathname: () => "/m/bitcoin-price-50k",
	useSearchParams: () => new URLSearchParams(),
}));

import { COMPOSER_COPY } from "@/components/debate/composer/copy";
import { DebateView } from "@/components/debate/DebateView";
import type { DebateViewModel } from "@/components/debate/types";
import { POLL_INTERVAL_MS_DEBATE_VIEW } from "@/server/config/limits";

import { stubWireFetch, TITLE, VIEWER } from "../../composer/render/_harness";
import {
	baseModel,
	MODEL_TITLE,
	modelUnchanged,
	modelWithPost,
	modelWithPosts,
	modelWithReply,
	newPost,
	newRemovedPostCarryingBody,
	newReply,
	placeOk,
	WITHHELD_SENTINEL,
} from "./_posted-fixtures";

const POSTED_ID = "cmt-just-posted";
const REPLY_ID = "cmt-just-replied";
/** A YES parent, so a Support reply on it is itself YES (`deriveReplySide`). */
const PARENT_ID = "cmt-p1";

const ADVANCE_MS = POLL_INTERVAL_MS_DEBATE_VIEW;
/**
 * ⛔ SMALL STEPS, EACH IN ITS OWN `act()`. One big jump SILENTLY UNDER-COUNTS:
 * the advance timer re-arms through React and `act()` flushes effects only at
 * its end, so three cadences of jump produce one advance. Recorded at length in
 * `auto-advance.test.tsx`, where it cost two false REDs.
 */
const STEP_MS = ADVANCE_MS / 60;
function advance(ms: number) {
	const steps = Math.round(ms / STEP_MS);
	for (let i = 0; i < steps; i++) {
		act(() => {
			vi.advanceTimersByTime(STEP_MS);
		});
	}
}

beforeEach(() => {
	vi.useFakeTimers();
	refreshMock.mockReset();
	refreshMock.mockImplementation(() => undefined);
	window.scrollTo = () => undefined;
	Object.defineProperty(document, "hidden", {
		configurable: true,
		get: () => false,
	});
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(document, "hidden");
	history.replaceState(null, "", "/");
});

function view(model: DebateViewModel, initialPostId: string | null = null) {
	return (
		<DebateView
			model={model}
			viewer={VIEWER}
			initialPostId={initialPostId}
			ownPseudonym={null}
		/>
	);
}

/** The card one pole is currently showing, by its title. */
function cardOn(side: "YES" | "NO"): string | null {
	return (
		document.querySelector(`[data-debate-column="${side}"] h3`)?.textContent ??
		null
	);
}

/**
 * That pole's POSITION — the `n` of `n / total`, and only the `n`.
 *
 * ⚠⚠ NOT THE WHOLE READOUT, and the first draft of the masking guard used the
 * whole string and red for the wrong reason. A REMOVED post KEEPS ITS SLOT in
 * the column (§6, thread integrity), so handing the view a masked post takes
 * that column from `1 / 3` to `1 / 4` **from the data alone**. The claim being
 * made is "the column did not MOVE", and that is the index.
 */
function positionOn(side: "YES" | "NO"): string {
	return readoutOn(side).split(" / ")[0] ?? "";
}

/** That pole's `n / total` readout — the only node reporting a column's position. */
function readoutOn(side: "YES" | "NO"): string {
	return (
		document
			.querySelector(
				`[data-debate-column="${side}"] [data-testid="scroll-rail"] [aria-live="polite"]`,
			)
			?.textContent?.replace(/\s+/g, " ") ?? ""
	);
}

/**
 * Submit through the open composer, asserting the bet ACTUALLY went to the wire.
 * ⚠ Without this a test whose expected post-state is "nothing visibly changed"
 * passes identically whether or not a bet was ever placed — the failure mode
 * that let FEED-1's wait-window guard run green with no submit at all.
 */
async function submitOpen(wire: ReturnType<typeof stubWireFetch>) {
	fireEvent.change(screen.getByLabelText<HTMLInputElement>("Argument title"), {
		target: { value: TITLE },
	});
	await act(async () => {
		fireEvent.click(screen.getByRole("button", { name: COMPOSER_COPY.submit }));
	});
	expect(
		wire.mock.calls.filter(([u]) => String(u).includes("/api/bets/place")),
		"the bet must actually have gone to the wire",
	).toHaveLength(1);
}

/** Open the market composer on YES — which opens it in the NO column — and submit. */
async function placeYesBet(wire: ReturnType<typeof stubWireFetch>) {
	fireEvent.click(screen.getByLabelText("Buy YES"));
	await submitOpen(wire);
}

/** Support on a YES parent ⇒ a YES reply, composed in the NO column. */
async function placeSupportReply(wire: ReturnType<typeof stubWireFetch>) {
	fireEvent.click(screen.getByLabelText("Support — bet YES"));
	await submitOpen(wire);
}

const postedPost = () =>
	newPost({ id: POSTED_ID, ordinal: 7, sideAtPostTime: "YES" });

describe("FEED-2 — the jump lands on the BET'S side", () => {
	it("posted::the-YES-column-shows-the-new-post-and-the-NO-column-never-does", async () => {
		// ⛔⛔ FOUNDER DEFECT #1, GUARDED. A composer opens in the column OPPOSITE
		// the side being bet, so FEED-1 put the author's own argument on the wrong
		// pole. The bet here is YES; the composer therefore sits in NO; the card
		// must appear on YES.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		expect(cardOn("YES")).not.toBe(MODEL_TITLE);

		rerender(view(modelWithPost(postedPost())));

		expect(cardOn("YES"), "the bet's own side shows the new card").toBe(
			MODEL_TITLE,
		);
		// ⛔ And the opposite pole — where the composer was — never shows it. A
		// build that jumped the composer's column would satisfy neither line.
		expect(
			cardOn("NO"),
			"the composer's column is not the bet's side",
		).not.toBe(MODEL_TITLE);
		// The card is the LAST in its column, so the jump is unambiguous: index 0
		// is where the column sits with no jump at all.
		const [n, total] = readoutOn("YES").split(" / ");
		expect(n).toBe(total);
		expect(Number(total)).toBeGreaterThan(1);
	});

	it("posted::the-composer-closes-immediately-and-nothing-is-held", async () => {
		// ⛔ The inverse of FEED-1's `the-slot-is-HELD-until-the-refresh-lands`.
		// That guard's subject is deleted; this is the property that replaced it.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		render(view(baseModel()));
		await placeYesBet(wire);

		expect(
			document.querySelector('[data-testid="composer-slot"]'),
			"the slot is gone the moment the 200 lands — no wait window",
		).toBeNull();
		expect(
			screen.queryByRole("button", { name: COMPOSER_COPY.submit }),
		).toBeNull();
		// And nothing anywhere offers a dismissal.
		expect(screen.queryByTestId("posted-confirmation")).toBeNull();
		expect(screen.queryByTestId("posted-dismiss")).toBeNull();
	});

	it("posted::a-REPLY-jumps-the-stack-on-the-REPLY'S-side", async () => {
		// ⚠ The brief said replies land "in the composer's own column". They do
		// not: `repliesForSide` places a reply by its OWN frozen side, and the
		// reply composer opens OPPOSITE the parent. A Support reply on a YES post
		// is YES-sided and belongs on YES, while its composer sat on NO. Treating
		// it as the composer's column would reproduce defect #1 one arm over.
		const wire = stubWireFetch([placeOk(REPLY_ID)]);
		const { rerender } = render(view(baseModel(), PARENT_ID));
		await placeSupportReply(wire);

		const reply = newReply({ id: REPLY_ID, side: "YES" });
		rerender(view(modelWithReply(PARENT_ID, reply), PARENT_ID));

		const yes = document.querySelector('[data-debate-column="YES"]');
		expect(yes?.innerHTML ?? "", "the reply's own side shows it").toContain(
			"CobaltLark733",
		);
		const no = document.querySelector('[data-debate-column="NO"]');
		expect(
			no?.innerHTML ?? "",
			"not the column its composer sat in",
		).not.toContain("CobaltLark733");
	});
});

describe("FEED-2 — a post that is not there produces silence", () => {
	it("posted::a-MASKED-post-produces-no-jump-and-no-error", async () => {
		// ⛔⛔ MASKING MATTERS MORE HERE, NOT LESS: a comment removed between submit
		// and refresh must not be jumped to. `findPostedNode` is fail-closed
		// (`removed === false`), so it yields no side, no id, and nothing happens.
		// ⚠ SC-1's second obligation — the BODY's absence, not the row's.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		const before = positionOn("YES");

		rerender(
			view(
				modelWithPost(
					newRemovedPostCarryingBody({
						id: POSTED_ID,
						ordinal: 7,
						sideAtPostTime: "YES",
					}),
				),
			),
		);
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(positionOn("YES"), "the column did not move").toBe(before);
		expect(document.body.innerHTML).not.toContain(WITHHELD_SENTINEL);
		// ⛔ And no state was invented to say so. Silence is the fallback.
		expect(screen.queryByTestId("posted-confirmation")).toBeNull();
		expect(document.body.textContent ?? "").not.toMatch(/could not|not found/i);
	});

	it("posted::a-post-ABSENT-from-the-refreshed-model-produces-no-jump", async () => {
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		const before = readoutOn("YES");

		rerender(view(modelUnchanged()));
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(readoutOn("YES")).toBe(before);
		expect(cardOn("YES")).not.toBe(MODEL_TITLE);
	});
});

describe("FEED-2 — the reader moves it, not a clock", () => {
	it("posted::auto-advance-does-NOT-slide-the-posted-card-away", async () => {
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		rerender(view(modelWithPost(postedPost())));
		expect(cardOn("YES")).toBe(MODEL_TITLE);
		const held = readoutOn("YES");

		advance(ADVANCE_MS * 2);

		expect(cardOn("YES"), "two full cadences and it has not moved").toBe(
			MODEL_TITLE,
		);
		expect(readoutOn("YES")).toBe(held);
		// ⛔⛔ THE POSITIVE CONTROL, and without it this passes against a clock that
		// is not running at all: the OTHER column advanced on that same clock.
		expect(
			readoutOn("NO"),
			"the other column is NOT held — it kept running on the same clock",
		).not.toBe("1 / 3");
	});

	it("posted::the-reader's-first-action-releases-the-hold", async () => {
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		rerender(view(modelWithPost(postedPost())));
		const held = readoutOn("YES");

		// A click outside both columns — the surface's own release for a picked
		// column. No dismissal, no exit state: an ordinary click anywhere else.
		fireEvent.click(document.body);
		advance(ADVANCE_MS);

		expect(
			readoutOn("YES"),
			"released — the column resumed on the reader's own action",
		).not.toBe(held);
	});
});

describe("FEED-2 — nothing new is held", () => {
	it("posted::the-poll-KEEPS-RUNNING-after-the-jump", async () => {
		// ⛔⛔ THE WALL. FEED-1's confirmation suspended the poll for as long as the
		// author left it up. Nothing here does. The positive control is the same
		// poll being genuinely suspended while the composer was open — without it,
		// "the poll ticks" would pass against a poll that never stopped for
		// anything and would prove nothing about the jump.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));

		fireEvent.click(screen.getByLabelText("Buy YES"));
		advance(ADVANCE_MS * 2);
		expect(
			refreshMock,
			"POSITIVE CONTROL: an OPEN composer really does suspend the poll",
		).toHaveBeenCalledTimes(0);

		await submitOpen(wire);
		rerender(view(modelWithPost(postedPost())));
		const afterJump = refreshMock.mock.calls.length;

		advance(ADVANCE_MS * 2);

		expect(
			refreshMock.mock.calls.length,
			"the poll ticks through the jump — nothing suspends it",
		).toBeGreaterThan(afterJump);
	});

	it("posted::leaving-a-post-and-COMING-BACK-does-not-re-take-the-column", async () => {
		// ⛔⛔ THE ONE PATH THAT MAKES THE PICK'S ONE-SHOT GUARD FALSIFIABLE, and I
		// had to go looking for it: the first control I wrote produced no red at
		// all, because releasing the pick changes NONE of that effect's
		// dependencies, so nothing re-runs and the guard has nothing to prevent.
		// A guard whose control cannot fire is not a guard, so either it earns a
		// real one or it should not be there.
		//
		// This is the real one, and it is an ordinary thing to do. `findPostedNode`
		// resolves a REPLY against the FOCUSED post — so leaving the post makes the
		// reply unfindable (`jumpSide` → null) and coming back makes it findable
		// again (`jumpSide` → its side). That is a genuine dependency change, and
		// without the id guard the effect fires a SECOND time and silently re-takes
		// a column the reader had already released.
		const wire = stubWireFetch([placeOk(REPLY_ID)]);
		const withReply = modelWithReply(
			PARENT_ID,
			newReply({ id: REPLY_ID, side: "YES" }),
		);
		const { rerender } = render(view(baseModel(), PARENT_ID));
		await placeSupportReply(wire);
		rerender(view(withReply, PARENT_ID));
		expect(positionOn("YES"), "the reply jump landed").toBe("3");

		// The reader releases the column and it resumes — the ordinary behaviour
		// this test then checks is not silently undone.
		fireEvent.click(document.body);
		advance(ADVANCE_MS);
		expect(positionOn("YES")).not.toBe("3");

		// Out of the post, and back into it.
		fireEvent.click(screen.getByLabelText("Back to the market"));
		const title = document.querySelector<HTMLElement>(
			'[data-debate-column="YES"] h3',
		)?.parentElement;
		expect(title, "a market card to re-enter through").not.toBeNull();
		fireEvent.click(title as HTMLElement);
		rerender(view(withReply, PARENT_ID));

		// ⚠ The instrument is the CAROUSEL, because a re-pick is invisible except
		// that it stops the column: if the effect fired again this column is
		// picked, and a picked column does not advance on its own.
		const before = positionOn("YES");
		advance(ADVANCE_MS);
		expect(
			positionOn("YES"),
			"the column was not silently re-taken — it still advances",
		).not.toBe(before);
	});

	it("posted::a-SECOND-payload-does-not-re-jump-a-card-the-reader-left", async () => {
		// ⛔ Both consumers of `posted` are one-shot, keyed on the comment id. Were
		// they keyed on the INDEX instead, a later payload that moved the card's
		// ranked position would yank the reader back to a post they had already
		// stepped past.
		const wire = stubWireFetch([placeOk(POSTED_ID)]);
		const { rerender } = render(view(baseModel()));
		await placeYesBet(wire);
		rerender(view(modelWithPost(postedPost())));
		expect(cardOn("YES")).toBe(MODEL_TITLE);

		// The reader steps away, then the poll delivers another payload — one in
		// which SOMEONE ELSE'S bet has landed above theirs, so their card's index
		// has MOVED.
		// ⛔⛔ THE MOVE IS THE POINT. Without it this test cannot tell an id-keyed
		// guard from an index-keyed one: with the index unchanged, both block. And
		// an index-keyed guard is the one that fails in life, because a card's
		// ranked position moves whenever a new bet lands above it — which is the
		// common case, not the exotic one. Measured: with the guard keyed on the
		// index this test goes red and every other one in the file stays green.
		fireEvent.click(document.body);
		advance(ADVANCE_MS);
		const movedTo = positionOn("YES");
		expect(movedTo).not.toBe("");
		rerender(
			view(
				modelWithPosts(
					newPost({
						id: "cmt-someone-else",
						ordinal: 8,
						sideAtPostTime: "YES",
					}),
					postedPost(),
				),
			),
		);
		act(() => {
			vi.advanceTimersByTime(400);
		});

		expect(
			positionOn("YES"),
			"a later payload must not yank the reader back to a card they left",
		).toBe(movedTo);
	});
});
