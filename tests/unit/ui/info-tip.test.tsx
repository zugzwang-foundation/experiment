// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { InfoTip } from "@/components/ui/info-tip";

/**
 * INFO-1 — `InfoTip` is the one info affordance that opens on both pointer
 * hover and touch tap. `usePointerFine` branches on
 * `(hover: hover) and (pointer: fine)`, read via `window.matchMedia`, which
 * jsdom does not implement — every test here stubs it explicitly, so the
 * branch under test is the one actually driving the assertion below it.
 *
 * ⚠ RADIX PORTALS TO `document.body` (Tooltip.Portal / Popover.Portal), so
 * content is NOT inside `render()`'s container — every content query goes
 * through `document.body`, per the O1-DECK render-test precedent.
 *
 * ⚠ V-3 (a control that does not exercise the failing syntax is not a
 * control): every "opens" assertion here checks the CONTENT actually renders
 * with its text, not that `pointerFine` merely took a branch — a media-query
 * stub proves nothing about whether Radix actually shows anything.
 *
 * ⛔ No jest-dom (AGENTS.md §9) — plain DOM assertions only.
 */

const ORIGINAL_MATCH_MEDIA = window.matchMedia;

afterEach(() => {
	cleanup();
	// jsdom has no native `matchMedia` (it's `undefined` here, not a stub) —
	// restore that exact absence, not just "some function", so a later test
	// in this file that relies on the real jsdom default isn't handed a
	// leftover mock from an earlier one.
	window.matchMedia = ORIGINAL_MATCH_MEDIA;
});

/**
 * ⛔⛔ THE STUB ANSWERS PER QUERY, AND IT HAS TO — A BLANKET ANSWER IS NOT A
 * CONTROL, IT IS A SECOND VARIABLE.
 *
 * `InfoTip` now asks `window.matchMedia` TWO unrelated questions: the pointer
 * question `(hover: hover) and (pointer: fine)`, and — through
 * `useIsPhoneTier` — the viewport question `not all and (min-width: 640px)`.
 * A stub that returns the same `matches` for every string answers both, so
 * `mockMatchMedia(true)` used to mean "a fine pointer" and silently also meant
 * "a phone", which is a device that does not exist and is the one combination
 * that suppresses the component entirely. Every row below then asserted the
 * pointer branch against a render the tier gate had already emptied.
 *
 * ⚠ This is the V-3 shape (a control that does not exercise the failing
 * syntax), arriving from the harness rather than from the code: the assertion
 * was real, the branch under it was not the branch it named.
 *
 * `phone` defaults to `false` — at and above 640px, which is where jsdom's
 * notional viewport sits and where every pre-existing row was written.
 */
const POINTER_QUERY = "(hover: hover) and (pointer: fine)";
const TIER_QUERY = "not all and (min-width: 640px)";

function mockMatchMedia(matches: boolean, phone = false): void {
	window.matchMedia = ((query: string) => ({
		matches: query === POINTER_QUERY ? matches : phone,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
}

/** Radix's `DismissableLayer` arms its outside-pointer listener inside a
 * `setTimeout(…, 0)` — a pointer event dispatched synchronously right after
 * open reaches no listener at all (AGENTS.md §9). */
function armDismissableLayer(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

const GLOSS = "Test gloss — the content under test";

describe("INFO-1 — InfoTip", () => {
	it("renders its child and exposes aria-describedby pointing at the content id", async () => {
		mockMatchMedia(false);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button");
		expect(trigger).not.toBeNull();
		const describedBy = trigger?.getAttribute("aria-describedby");
		expect(describedBy, "trigger carries aria-describedby").toBeTruthy();
		// Never aria-label — a description must not replace the accessible name.
		expect(trigger?.getAttribute("aria-label")).toBeNull();
	});

	it("touch path (pointer-fine: false): opens the Popover content on tap", async () => {
		mockMatchMedia(false);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;

		expect(document.body.textContent).not.toContain(GLOSS);
		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).toContain(GLOSS);
		});

		const content = Array.from(document.querySelectorAll("[id]")).find(
			(el) => el.textContent === GLOSS,
		);
		expect(content?.id).toBe(trigger.getAttribute("aria-describedby"));
	});

	it("touch path: opening the Popover does NOT move focus off the trigger", async () => {
		// Several wired call sites are ALREADY-interactive controls (a tab
		// button, a Support/Counter trigger) whose click both performs their
		// own action and opens this Popover. Radix's default auto-focus would
		// move focus onto the (unfocusable, plain-text) content on every such
		// tap — which is exactly what broke PositionsTable's keyboard row
		// stepping: focus left the table and neither its own key handler nor
		// the document-level fallback still owned the key.
		mockMatchMedia(false);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;
		trigger.focus();
		expect(document.activeElement).toBe(trigger);

		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).toContain(GLOSS);
		});
		expect(document.activeElement).toBe(trigger);
	});

	it("pointer path (pointer-fine: true): opens the Tooltip content on hover", async () => {
		mockMatchMedia(true);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;

		expect(document.body.textContent).not.toContain(GLOSS);
		fireEvent.pointerMove(trigger, { pointerType: "mouse" });
		fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
		fireEvent.mouseEnter(trigger);
		fireEvent.focus(trigger);
		await waitFor(
			() => {
				expect(document.body.textContent).toContain(GLOSS);
			},
			{ timeout: 2000 },
		);
	});

	it("closes on Escape (touch/Popover path)", async () => {
		mockMatchMedia(false);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;

		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).toContain(GLOSS);
		});

		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => {
			expect(document.body.textContent).not.toContain(GLOSS);
		});
	});

	it("touch path: a second click on the trigger (mouse pointerType) CLOSES it, not reopens it", async () => {
		// Regression guard for the `context.triggerRef` fix: `InfoTip` no
		// longer uses `Popover.Trigger` (it stamped invalid button semantics
		// onto non-button hosts — see the primitive's own docblock), and
		// Popover's own outside-interaction check reads `context.triggerRef`
		// to tell "the trigger was clicked again" apart from "somewhere else
		// was clicked". Left unpopulated, a second click reads as OUTSIDE: the
		// content dismisses on `pointerdown`, then this component's own
		// click-toggle re-opens it a moment later — closed-then-reopened
		// rather than closed, for any non-touch `pointerType` (mouse, pen —
		// touch itself is unaffected, since its own dismissal listener runs
		// after React's).
		mockMatchMedia(false);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;

		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).toContain(GLOSS);
		});
		await armDismissableLayer();

		fireEvent.pointerDown(trigger, { pointerType: "mouse" });
		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).not.toContain(GLOSS);
		});
	});

	it("closes on Escape (pointer/Tooltip path)", async () => {
		mockMatchMedia(true);
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;

		fireEvent.pointerMove(trigger, { pointerType: "mouse" });
		fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
		fireEvent.mouseEnter(trigger);
		fireEvent.focus(trigger);
		await waitFor(
			() => {
				expect(document.body.textContent).toContain(GLOSS);
			},
			{ timeout: 2000 },
		);

		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => {
			expect(document.body.textContent).not.toContain(GLOSS);
		});
	});

	it("no matchMedia at all (this repo's real jsdom default): renders on the touch branch without throwing", async () => {
		// The branch every OTHER render test in this repo actually exercises —
		// jsdom genuinely has no `matchMedia`, not a stub returning `false`.
		// @ts-expect-error — deleting a required global to restore jsdom's own default
		window.matchMedia = undefined;
		render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = document.querySelector("button") as HTMLButtonElement;
		fireEvent.click(trigger);
		await waitFor(() => {
			expect(document.body.textContent).toContain(GLOSS);
		});
	});

	/**
	 * DIAG-HEADER-BALANCE-HYDRATION — the shipped defect this pins.
	 *
	 * React Flight defers whatever element straddles its 3200-byte row boundary
	 * and hands it over as a `react.lazy` reference rather than an element
	 * (`info-tip.tsx`'s `isDeferredChild` docblock has the mechanism and the
	 * measurement). On the built app that fell to `DharmaCluster`'s Balance
	 * eyebrow: the server painted it inside the `<button>` fallback, then the
	 * `pointerFine` effect swapped in the Tooltip branch, where Radix's `Slot`
	 * returns `null` for a child it cannot clone — so the label appeared and
	 * then vanished, about a second in.
	 *
	 * ⛔ IT HAS TO BE A HYDRATION TEST, AND THAT IS THE WHOLE POINT. A static
	 * `render()` only ever sees the branch the server took, which PAINTS the
	 * child and looks correct; the deletion lives in the swap. Every existing
	 * test in this file passed throughout.
	 */
	function deferredChild(element: React.ReactElement): React.ReactNode {
		// React Flight's own wire shape for a deferred row, built by hand
		// because no test double ships it. The chunk carries settled
		// `status`/`value` because the row HAS arrived by the time the child is
		// read — which is what lets `use()` return it without suspending.
		const chunk = Promise.resolve(element) as Promise<React.ReactElement> & {
			status: string;
			value: React.ReactElement;
		};
		chunk.status = "fulfilled";
		chunk.value = element;
		return {
			$$typeof: Symbol.for("react.lazy"),
			_payload: chunk,
			_init: () => element,
		} as unknown as React.ReactNode;
	}

	it("a Flight-deferred child SURVIVES hydration on the pointer branch", async () => {
		mockMatchMedia(true);
		const tree = (
			<InfoTip content={GLOSS} asChild>
				{deferredChild(<span data-testid="eyebrow">Balance</span>)}
			</InfoTip>
		);

		// The premise: the server DOES paint it. That is why the defect read as
		// "it disappears" rather than "it never rendered".
		const html = renderToString(tree);
		expect(html).toContain('data-testid="eyebrow"');

		const container = document.createElement("div");
		container.innerHTML = html;
		document.body.appendChild(container);
		// React's act() flag. `@testing-library/react` sets it for its own
		// renders; this test drives `hydrateRoot` directly, so it sets it by
		// hand. Narrowed locally rather than via `declare global`, which would
		// add the symbol to every file in the project (AGENTS.md §4 — one `as`,
		// at a runtime boundary React owns).
		const actGlobal = globalThis as typeof globalThis & {
			IS_REACT_ACT_ENVIRONMENT?: boolean;
		};
		const previousActEnv = actGlobal.IS_REACT_ACT_ENVIRONMENT;
		actGlobal.IS_REACT_ACT_ENVIRONMENT = true;
		try {
			await act(async () => {
				hydrateRoot(container, tree);
			});
			// Let the `pointerFine` effect land and swap Popover for Tooltip.
			await act(async () => {
				await new Promise((r) => setTimeout(r, 0));
			});
		} finally {
			actGlobal.IS_REACT_ACT_ENVIRONMENT = previousActEnv;
			container.remove();
		}

		// THE ASSERTION THAT WOULD HAVE CAUGHT IT, and it is deliberately the
		// FIRST one after hydration so this test reds on the DELETION rather
		// than on any tidier proxy for it. Assert the CHILD, not the InfoTip:
		// the wrapper survived the whole time — it was the thing it was
		// wrapping that got deleted.
		expect(
			container.querySelector('[data-testid="eyebrow"]')?.textContent,
		).toBe("Balance");

		// Secondary, and only meaningful once the above holds: `asChild` did
		// not merely survive, it APPLIED — a deferred child that fell to the
		// `<button>` fallback would still be visible, and still wrong.
		expect(html).not.toContain("<button");
	});

	it("positive control: an UNRESOLVABLE non-element child degrades the same way on both branches", () => {
		// The `canSlot` half of the fix, and its own control. A plain string
		// can never be cloned, so both branches must fall to the SAME fallback
		// — the failure being guarded is the server rendering one thing and the
		// client rendering nothing.
		mockMatchMedia(false);
		const touch = renderToString(
			<InfoTip content={GLOSS} asChild>
				bare text
			</InfoTip>,
		);
		mockMatchMedia(true);
		const { container } = render(
			<InfoTip content={GLOSS} asChild>
				bare text
			</InfoTip>,
		);
		expect(touch).toContain("bare text");
		expect(container.textContent).toContain("bare text");
	});

	it("positive control: mocked matchMedia actually drives a different branch each way", () => {
		// V-3 guard on this file's own mock: prove the two mock calls really
		// produce different `matches` values before trusting the open/close
		// tests above to have exercised different code paths.
		// ⚠ ASKED WITH THE EXACT QUERY THE COMPONENT ASKS. This used to probe
		// `"(hover: hover)"` — a string no code under test ever passes — which was
		// harmless only while the stub answered every query identically. It does
		// not any more, and a control that exercises a query nobody uses is the
		// same V-3 defect one layer down from the one that made the stub
		// per-query in the first place.
		mockMatchMedia(true);
		expect(window.matchMedia(POINTER_QUERY).matches).toBe(true);
		mockMatchMedia(false);
		expect(window.matchMedia(POINTER_QUERY).matches).toBe(false);
	});

	it("positive control: the TIER answer is independent of the POINTER answer", () => {
		// ⛔ The whole point of the per-query stub. If these two moved together,
		// every row in this file that sets a pointer would silently also be setting
		// a viewport, and the tier gate below would be untestable.
		mockMatchMedia(true, false);
		expect(window.matchMedia(POINTER_QUERY).matches).toBe(true);
		expect(window.matchMedia(TIER_QUERY).matches).toBe(false);
		mockMatchMedia(true, true);
		expect(window.matchMedia(POINTER_QUERY).matches).toBe(true);
		expect(window.matchMedia(TIER_QUERY).matches).toBe(true);
	});

	it("info-tip::NOTHING-MOUNTS-BELOW-640px-on-either-branch", () => {
		// ⛔⛔ MOBILE-2e · R-M3. The defect this closes is not "a gloss on a phone
		// is unwanted": it is that the TOUCH branch merges an `onClick` toggle onto
		// its child, so one tap on a Support pill opened the reply sheet AND the
		// gloss — and with no hover to end it, the gloss then sat over the argument
		// field. Asserted on BOTH branches, because the tier gate is a viewport
		// question and the pointer question is orthogonal to it: a phone-width
		// window on a machine with a mouse must be just as empty.
		for (const pointerFine of [true, false]) {
			const { container, unmount } = render(
				<InfoTip content={GLOSS} asChild>
					<button type="button">Trigger</button>
				</InfoTip>,
			);
			unmount();
			void container;
			mockMatchMedia(pointerFine, true);
			const { container: phone } = render(
				<InfoTip content={GLOSS} asChild>
					<button type="button">Trigger</button>
				</InfoTip>,
			);
			const trigger = phone.querySelector("button");
			expect(
				trigger,
				`pointerFine=${pointerFine}: the child still renders`,
			).not.toBeNull();
			expect(trigger?.textContent).toBe("Trigger");
			// The child is handed through BARE: no describedby stamped on it, and
			// no popper layer anywhere in the document.
			expect(trigger?.getAttribute("aria-describedby")).toBeNull();
			expect(document.body.textContent).not.toContain(GLOSS);
			expect(
				document.querySelectorAll('[role="tooltip"]').length,
				"no tooltip content",
			).toBe(0);
			expect(
				document.querySelectorAll("[data-radix-popper-content-wrapper]").length,
				"no popper wrapper of any kind",
			).toBe(0);
			cleanup();
		}
	});

	it("positive control: the SAME render DOES mount above 640px", () => {
		// ⛔ Without this the row above passes against a component that renders
		// nothing anywhere — which is indistinguishable from a working gate.
		mockMatchMedia(true, false);
		const { container } = render(
			<InfoTip content={GLOSS} asChild>
				<button type="button">Trigger</button>
			</InfoTip>,
		);
		const trigger = container.querySelector("button");
		// ⛔⛔ THE NON-NULL ASSERTION FIRST, AND IT IS THE WHOLE POINT OF THIS ROW.
		// This read `expect(trigger?.getAttribute(…)).not.toBeNull()`, which with a
		// null `trigger` is `expect(undefined).not.toBeNull()` — a PASS. Measured:
		// making the desktop branch `return null` reds four other rows in this file
		// and left this one green, so the control whose entire job is anti-vacuity
		// was the one row that could not detect the emptiness.
		expect(
			trigger,
			"the desktop branch rendered nothing at all",
		).not.toBeNull();
		// The Tooltip branch hands Radix the child through `asChild`, which stamps
		// its own attributes on it — the observable difference from the bare
		// pass-through above.
		expect(trigger?.getAttribute("data-state")).not.toBeNull();
	});
});
