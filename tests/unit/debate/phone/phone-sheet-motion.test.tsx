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
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

/**
 * MOBILE-2c G2 — the animated close (R-4), and the three ways it fails quietly.
 *
 * ⛔⛔ THE CLOSE IS DEFERRED, NOT HELD. `PhoneSheet` returns `null` on `!open`
 * and `PhoneDebateView` stops rendering the composer element as well, so there
 * are two synchronous unmount paths and neither leaves a window to animate in.
 * `ComposerSlot` solves the same problem by keeping the outgoing element mounted
 * for its exit duration; that was rejected here because it would keep
 * `BetComposer` alive after the reader has dismissed it, on the surface that
 * takes money — the exact state the `busy` rule exists to prevent. So every door
 * sets a leaving phase, the panel slides, and `onClose()` fires at the end.
 *
 * ⚠ jsdom HAS NO `matchMedia`, so `beginClose`'s reduced-motion read is FALSE
 * here by default and the close is therefore genuinely ANIMATED in these tests.
 * That is why every row uses fake timers and advances 200ms; the reduced-motion
 * row stubs `matchMedia` to take the other branch, and carries the unstubbed
 * case as its own control.
 *
 * ⚠ THE OVERLAP WITH `busy-interlock.test.tsx` IS DELIBERATE AND NARROW. That
 * file asserts the deferral as a property of each DOOR (Escape, backdrop, ×);
 * this file asserts it as a property of the MOTION — the phase attribute, the
 * pointer-events posture while leaving, and the two duration numbers agreeing.
 * A mutation to the deferral reddens both, which is the correct amount of
 * redundancy for a money-adjacent path.
 */
const ROOT = process.cwd();
const SHEET = "src/components/debate/phone/PhoneSheet.tsx";
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** The close window the JS defers by, read out of the source it is declared in. */
function closeMsConstant(): number {
	const m = /const CLOSE_MS = (\d+)/.exec(read(SHEET));
	if (!m?.[1]) {
		throw new Error(`${SHEET}: no \`const CLOSE_MS = <n>\` declaration.`);
	}
	return Number(m[1]);
}

function mount(onClose = vi.fn(), busy = false) {
	render(
		<PhoneSheet open title="Fixture sheet" busy={busy} onClose={onClose}>
			<button type="button">inside</button>
		</PhoneSheet>,
	);
	return onClose;
}

/**
 * A `matchMedia` that answers the reduced-motion query with `answer` and every
 * other query with `false`.
 *
 * ⚠ `matches` IS A GETTER, following `desktop-neutrality.test.tsx`'s own reason:
 * `beginClose` calls `matchMedia` fresh on every push, so a captured boolean
 * would freeze whichever object happened to be constructed first.
 */
function stubReducedMotion(answer: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({
		media: query,
		get matches() {
			return query === "(prefers-reduced-motion: reduce)" ? answer : false;
		},
		addEventListener: () => undefined,
		removeEventListener: () => undefined,
		addListener: () => undefined,
		removeListener: () => undefined,
		onchange: null,
		dispatchEvent: () => false,
	}));
}

describe("phone sheet — the close is deferred by the slide (G2)", () => {
	it("phone-sheet-motion::a-door-sets-the-leaving-phase-and-onClose-waits-for-it", () => {
		vi.useFakeTimers();
		try {
			const onClose = mount();
			expect(screen.getByTestId("phone-sheet").getAttribute("data-phase")).toBe(
				"open",
			);
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			// ⚠ ASSERTED BEFORE ADVANCING, which is what proves the deferral exists
			// rather than merely tolerating it. A build that calls `onClose` straight
			// through satisfies every "it eventually closed" assertion.
			expect(
				screen.getByTestId("phone-sheet").getAttribute("data-phase"),
				"the root must declare the leaving phase — it is what the panel's " +
					"slide-out and the backdrop's fade-out are selected by",
			).toBe("leaving");
			expect(
				onClose,
				"onClose fired synchronously: the panel is unmounted before it can " +
					"animate, so the slide is invisible and R-4 is decoration",
			).not.toHaveBeenCalled();
			act(() => {
				vi.advanceTimersByTime(closeMsConstant());
			});
			expect(onClose).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});

	it("phone-sheet-motion::a-leaving-sheet-stops-taking-pointer-input", () => {
		vi.useFakeTimers();
		try {
			mount();
			const root = () => screen.getByTestId("phone-sheet");
			// POSITIVE CONTROL FIRST — an open sheet is NOT pointer-events-none, so
			// the token below is a fact about the leaving phase and not a constant.
			expect((root().getAttribute("class") ?? "").split(/\s+/)).not.toContain(
				"pointer-events-none",
			);
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			expect(
				(root().getAttribute("class") ?? "").split(/\s+/),
				"a sheet that is sliding out must not intercept a second tap — the " +
					"backdrop is still painted for another 200ms",
			).toContain("pointer-events-none");
			act(() => {
				vi.advanceTimersByTime(closeMsConstant());
			});
		} finally {
			vi.useRealTimers();
		}
	});

	/**
	 * ⛔⛔ THE MECHANISM THAT REPLACES A COMMENT ASKING A READER TO KEEP TWO
	 * NUMBERS IN STEP. `CLOSE_MS` is read by JavaScript (it is how long `onClose`
	 * is deferred) and the same number is spelled again as `duration-[200ms]` on
	 * the panel's leaving branch, because Tailwind's scanner needs a LITERAL in
	 * the source to emit the utility at all — interpolating the constant produces
	 * a class that silently does not exist (AGENTS.md §9's stale-utility trap).
	 * So the number genuinely appears twice, and a close that animates for 200ms
	 * while unmounting after 260 is a flicker nobody would think to look for.
	 * `PhoneSheet`'s own docblock says this row is what pins them together.
	 */
	it("phone-sheet-motion::CLOSE_MS-and-the-leaving-duration-class-are-the-same-number", () => {
		const src = read(SHEET);
		const constant = closeMsConstant();
		// The LEAVING branch specifically, located by the animation it carries
		// rather than by a line or a character window (`O-8`): `animate-out` is
		// unique to the exit, and `slide-out-to-bottom-full` is on the panel's.
		const leaving = /animate-out slide-out-to-bottom-full[^"`]*/.exec(src);
		if (!leaving) {
			throw new Error(
				`${SHEET}: no \`animate-out slide-out-to-bottom-full\` branch — the ` +
					"panel's exit animation is gone or renamed.",
			);
		}
		const cls = /duration-\[(\d+)ms\]/.exec(leaving[0]);
		if (!cls?.[1]) {
			throw new Error(
				`${SHEET}: the panel's leaving branch declares no \`duration-[Nms]\`.`,
			);
		}
		expect(
			Number(cls[1]),
			`the panel slides for ${cls[1]}ms and the host is told after ` +
				`${constant}ms — the gap is a flicker at the end of every close`,
		).toBe(constant);
		// POSITIVE CONTROL — the OPEN branch really does declare a different
		// duration (260ms, canon `.26s`), so the equality above is a measured
		// agreement between two numbers rather than a regex that matches whatever
		// it finds first.
		const entering = /animate-in slide-in-from-bottom-full[^"`]*/.exec(src);
		const openMs = entering ? /duration-\[(\d+)ms\]/.exec(entering[0]) : null;
		expect(openMs?.[1]).toBeDefined();
		expect(Number(openMs?.[1]), "the open is the slower of the two").toBe(260);
		expect(Number(openMs?.[1])).not.toBe(constant);
	});

	/**
	 * ⛔ REDUCED MOTION IS HONOURED IN JS, NOT ONLY IN CSS, for the reason
	 * `ComposerSlot` gives: `motion-reduce:animate-none` suppresses the visual
	 * motion and LEAVES THE DELAY, so a reader who asked for no motion would get a
	 * sheet that sits there for 200ms doing nothing before closing. The CSS
	 * classes are present too and are not the mechanism this row is about.
	 */
	it("phone-sheet-motion::prefers-reduced-motion-closes-immediately-with-no-timer", () => {
		vi.useFakeTimers();
		try {
			stubReducedMotion(true);
			const onClose = mount();
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			expect(
				onClose,
				"a reader who asked for no motion must not be made to wait out an " +
					"animation that is not being played",
			).toHaveBeenCalledTimes(1);
			// ...and not twice once the window it never armed has elapsed.
			act(() => {
				vi.advanceTimersByTime(closeMsConstant() * 2);
			});
			expect(onClose).toHaveBeenCalledTimes(1);
			cleanup();

			// POSITIVE CONTROL — the SAME push against `matches: false` is NOT
			// synchronous. Without it this row passes against a component that
			// ignores the media query and closes immediately for everybody, which is
			// R-4 deleted rather than R-4 honoured.
			stubReducedMotion(false);
			const idle = mount();
			fireEvent.click(screen.getByTestId("phone-sheet-backdrop"));
			expect(idle).not.toHaveBeenCalled();
			act(() => {
				vi.advanceTimersByTime(closeMsConstant());
			});
			expect(idle).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
