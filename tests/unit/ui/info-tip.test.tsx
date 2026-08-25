// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
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

function mockMatchMedia(matches: boolean): void {
	window.matchMedia = ((query: string) => ({
		matches,
		media: query,
		onchange: null,
		addEventListener: () => {},
		removeEventListener: () => {},
		addListener: () => {},
		removeListener: () => {},
		dispatchEvent: () => false,
	})) as typeof window.matchMedia;
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

	it("positive control: mocked matchMedia actually drives a different branch each way", () => {
		// V-3 guard on this file's own mock: prove the two mock calls really
		// produce different `matches` values before trusting the open/close
		// tests above to have exercised different code paths.
		mockMatchMedia(true);
		expect(window.matchMedia("(hover: hover)").matches).toBe(true);
		mockMatchMedia(false);
		expect(window.matchMedia("(hover: hover)").matches).toBe(false);
	});
});
