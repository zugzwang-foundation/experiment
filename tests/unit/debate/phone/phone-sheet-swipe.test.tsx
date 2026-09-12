// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhoneSheet } from "@/components/debate/phone/PhoneSheet";

import { stubElementScroll } from "./_fixtures";

stubElementScroll();

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/**
 * MOBILE-2c G3 — swipe-down-to-dismiss on the handle (R-4).
 *
 * ⛔⛔ THE HANDLE USED TO BE A DECORATION AND ITS DOCBLOCK SAID SO PROUDLY:
 * "there is no drag gesture behind it … inventing a drag-to-dismiss to justify
 * it would be a gesture handler written for a decoration." That was correct
 * while the backdrop was reachable and wrong once it was not — the shape a
 * reader reads as "this is a sheet" is also the first thing they reach for, and
 * on this surface it was the only affordance that looked like a way out.
 *
 * ⛔⛔ `timeStamp` CANNOT BE SET THROUGH `fireEvent`, AND THE FAILURE IS A FALSE
 * PASS RATHER THAN AN ERROR. `Event.timeStamp` is readonly and
 * `@testing-library/dom`'s `createEvent` passes the init straight to the
 * constructor, so the value is silently discarded and the real wall clock
 * arrives instead. Measured in this jsdom: three `fireEvent.pointer*` calls
 * issued back to back reported `1789208475402 / 403 / 403` — ONE millisecond
 * apart. `onHandleUp` computes `velocity = travelled / max(1, elapsed)`, so a
 * "slow 30px drag" written the obvious way is a 30 px/ms FLICK, sixty times over
 * the close threshold, and the row asserting that it does not close would fail
 * for the right reason while the row asserting a fast flick DOES close would
 * pass for the wrong one.
 * ⇒ Every event here is constructed by hand with `timeStamp` forced through
 * `Object.defineProperty`, and `harness-is-honest` below proves the value
 * arrives before any row depends on it.
 */
const ROOT = process.cwd();
const SHEET = "src/components/debate/phone/PhoneSheet.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** ADR-0050 A2 / R-4. Pinned as literals so a silent threshold change reddens. */
const SWIPE_CLOSE_PX = 80;
const SWIPE_CLOSE_VELOCITY = 0.5;
/** The deferral window — the same one `phone-sheet-motion.test.tsx` pins. */
const CLOSE_MS = 200;

const POINTER_ID = 7;
const T0 = 10_000;

type PointerCtor = new (type: string, init: Record<string, unknown>) => Event;

/**
 * A pointer event carrying the `clientY` and the `timeStamp` this test states.
 *
 * ⛔ IT THROWS RATHER THAN DEGRADING. If `PointerEvent` were absent, TL's own
 * fallback is a bare `Event` — which carries NO `clientY`, so every drag becomes
 * a 0px drag, every "under threshold does not close" row passes vacuously, and
 * nothing anywhere reports that the gesture was never performed.
 */
function pointer(type: string, clientY: number, timeStamp: number): Event {
	const Ctor = (window as unknown as { PointerEvent?: PointerCtor })
		.PointerEvent;
	if (typeof Ctor !== "function") {
		throw new Error(
			"jsdom has no PointerEvent: a bare Event carries no clientY, so every " +
				"drag below would silently be a zero-pixel drag.",
		);
	}
	const event = new Ctor(type, {
		bubbles: true,
		cancelable: true,
		clientY,
		pointerId: POINTER_ID,
	});
	Object.defineProperty(event, "timeStamp", {
		value: timeStamp,
		configurable: true,
	});
	return event;
}

function mount(busy = false, onClose = vi.fn()) {
	render(
		<PhoneSheet open title="Fixture sheet" busy={busy} onClose={onClose}>
			<button type="button">inside</button>
		</PhoneSheet>,
	);
	return onClose;
}

const handle = () => screen.getByTestId("phone-sheet-handle");
const panelTransform = () =>
	(screen.getByTestId("phone-sheet-panel") as HTMLElement).style.transform;

/** `translateY(Npx)` → N. `null` when no transform is applied. */
function translateY(): number | null {
	const m = /translateY\((-?[\d.]+)px\)/.exec(panelTransform());
	return m?.[1] === undefined ? null : Number(m[1]);
}

/** A whole gesture: down at `from`, one move to `to`, up there, `ms` later. */
function swipe(from: number, to: number, ms: number): void {
	fireEvent(handle(), pointer("pointerdown", from, T0));
	fireEvent(handle(), pointer("pointermove", to, T0 + ms));
	fireEvent(handle(), pointer("pointerup", to, T0 + ms));
}

describe("phone sheet — the handle is a gesture, and both of its arms are live (G3)", () => {
	it("phone-sheet-swipe::harness-is-honest-about-clientY-timeStamp-and-the-thresholds", () => {
		// ⚠ THE INSTRUMENT BEFORE THE MEASUREMENT. Every row below is a statement
		// about a distance and a duration; if the harness cannot deliver either,
		// the rows still run and still report.
		const probe = pointer("pointermove", 123, 45_678);
		expect((probe as PointerEvent).clientY, "clientY reaches the event").toBe(
			123,
		);
		expect(probe.timeStamp, "the forced timeStamp survives").toBe(45_678);
		// ...and the numbers this file asserts against are the ones the component
		// declares, so a threshold moved in `src/` reddens here rather than
		// silently re-scaling every row.
		const src = read(SHEET);
		expect(/const SWIPE_CLOSE_PX = (\d+)/.exec(src)?.[1]).toBe(
			String(SWIPE_CLOSE_PX),
		);
		expect(/const SWIPE_CLOSE_VELOCITY = ([\d.]+)/.exec(src)?.[1]).toBe(
			String(SWIPE_CLOSE_VELOCITY),
		);
	});

	it("phone-sheet-swipe::a-drag-past-the-distance-threshold-closes", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount();
			// 100px over a full second: 100 >= 80 on DISTANCE, and 0.1 px/ms is well
			// under the velocity arm — so this row isolates the distance arm.
			swipe(400, 500, 1000);
			expect(onClose).not.toHaveBeenCalled();
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS);
			});
			expect(
				onClose,
				"a 100px drag is past the 80px threshold and must dismiss the sheet",
			).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet-swipe::a-short-slow-drag-snaps-back-and-clears-the-transform", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount();
			// 30px over a full second: under 80px AND 0.03 px/ms, so under both arms.
			swipe(400, 430, 1000);
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS * 2);
			});
			expect(
				onClose,
				"a 30px drag at 0.03 px/ms is under both thresholds — closing on it " +
					"would dismiss the sheet whenever a thumb brushed the handle",
			).not.toHaveBeenCalled();
			expect(
				panelTransform(),
				"the inline drag offset must be cleared on release, or the panel " +
					"stays parked 30px down the screen for the rest of its life",
			).toBe("");
		} finally {
			vi.useRealTimers();
		}
	});

	/**
	 * ⛔ THE ROW THAT PROVES THE VELOCITY ARM EXISTS RATHER THAN BEING DECORATIVE.
	 * `PhoneSheet` states the reason it is there: without it a reader who flicks
	 * 40px in 60ms gets a snap-back, which reads as the sheet refusing. Nothing
	 * else in this file would notice its removal — the distance row passes on
	 * distance and the snap-back row passes harder.
	 */
	it("phone-sheet-swipe::a-fast-flick-shorter-than-the-distance-threshold-still-closes", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount();
			// 30px in 20ms = 1.5 px/ms: THREE TIMES the velocity threshold while
			// being well under the 80px distance one. Only the velocity arm can
			// close this.
			swipe(400, 430, 20);
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS);
			});
			expect(
				onClose,
				"30px in 20ms is 1.5 px/ms against a 0.5 threshold — a flick this " +
					"decisive must not snap back",
			).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet-swipe::an-upward-drag-never-lifts-the-panel-above-its-own-top-edge", () => {
		mount();
		fireEvent(handle(), pointer("pointerdown", 500, T0));
		// POSITIVE CONTROL FIRST, and it is load-bearing: `pointerdown` already
		// sets the offset to 0, so "never negative" is satisfied by a move handler
		// that does nothing at all. A downward move must move the panel.
		fireEvent(handle(), pointer("pointermove", 560, T0 + 40));
		expect(
			translateY(),
			"the panel must follow a downward finger, or the row below proves " +
				"nothing about clamping",
		).toBe(60);
		fireEvent(handle(), pointer("pointermove", 400, T0 + 80));
		const up = translateY();
		expect(up).not.toBeNull();
		expect(
			up,
			"an upward drag must clamp at 0 — there is nothing above the sheet to " +
				"reveal, and a sheet that can be dragged up can be dragged off screen",
		).toBe(0);
		fireEvent(handle(), pointer("pointerup", 400, T0 + 80));
	});

	/**
	 * ⛔⛔ BUSY SHUTS THE FOURTH DOOR — and the assertion that matters is the
	 * TRANSFORM, not the close. `beginClose` guards `busy` itself, so a sheet
	 * whose `onHandleDown` lost its busy check would still refuse to close; what
	 * it would do instead is let the panel follow the finger and then spring back,
	 * which tells a reader mid-request that the sheet is draggable and then
	 * refuses them. Both halves are asserted, and the transform is the one that
	 * fails when the check is removed.
	 */
	it("phone-sheet-swipe::while-busy-the-handle-neither-drags-nor-closes", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount(true);
			fireEvent(handle(), pointer("pointerdown", 400, T0));
			fireEvent(handle(), pointer("pointermove", 600, T0 + 400));
			expect(
				panelTransform(),
				"a busy sheet must not follow the finger: a panel that moves is a " +
					"panel that promises to dismiss, and this one cannot",
			).toBe("");
			fireEvent(handle(), pointer("pointerup", 600, T0 + 400));
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS * 2);
			});
			expect(
				onClose,
				"abandoning a composer mid-request and reopening it mints a fresh " +
					"idempotency key over a charge that may already have landed",
			).not.toHaveBeenCalled();
			cleanup();

			// POSITIVE CONTROL — the identical 200px gesture on an IDLE sheet drags
			// and closes. Without it the row above passes against a handle whose
			// pointer handlers were never wired.
			const idle = mount(false);
			fireEvent(handle(), pointer("pointerdown", 400, T0));
			fireEvent(handle(), pointer("pointermove", 600, T0 + 400));
			expect(translateY()).toBe(200);
			fireEvent(handle(), pointer("pointerup", 600, T0 + 400));
			act(() => {
				vi.advanceTimersByTime(CLOSE_MS);
			});
			expect(idle).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
