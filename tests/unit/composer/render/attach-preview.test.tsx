// @vitest-environment jsdom

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ImageAttach,
	type ImageAttachState,
} from "@/components/debate/composer/ImageAttach";

/**
 * POLISH-4-PREVIEW · THE LOCAL PREVIEW AND ITS OBJECT-URL LIFECYCLE.
 *
 * ⛔ WHY THIS SUITE IS WORTH ITS WEIGHT. The R2 object is immutable from first
 * write (ADR-0028 primitive 1) and the comment carrying it is append-only
 * (INV-4), so a mis-picked image is permanent and public. The preview is the
 * last confirmable step before that. Two things can silently break it and
 * neither raises anything at runtime: the preview quietly becoming gated on the
 * upload round trip (so it appears only after the PUT — i.e. after the moment it
 * existed for), and a revoke path going missing (a leaked `blob:` pins the whole
 * file in memory for the tab's life). Both are asserted here.
 *
 * ⚠ jsdom IMPLEMENTS NEITHER OBJECT-URL METHOD — measured, not assumed:
 * `typeof URL.createObjectURL === "undefined"` in this repo's jsdom. So these
 * stubs are not a convenience, they are the only way the component runs at all
 * under test. Their being stubs is also what makes the leak assertions possible:
 * a spy COUNTS revocations, where a source grep can only locate the token.
 *
 * ⚠ THE HARNESS IS STATEFUL ON PURPOSE, and an earlier draft that was not is why
 * this note exists. `ImageAttach` is a CONTROLLED component: it mints the
 * preview, but the phase that justifies keeping one belongs to the composer. A
 * harness that pins the phase at `none` while firing a pick models a parent that
 * does not exist — the real `BetComposer.onPickImage` sets
 * `{ phase: "attaching" }` SYNCHRONOUSLY as its first act, before any await
 * (`BetComposer.tsx:246`). `Harness` reproduces exactly that, so these tests
 * exercise the real contract rather than one invented for them.
 *
 * `O-7` — assertions read the DOM tree and the `class` attribute, never
 * `textContent` as a proxy for markup. No jest-dom in this repo (AGENTS.md §9),
 * so plain DOM only.
 */

/** Distinct per call, so "which URL was revoked" is answerable, not just "one was". */
let minted: string[] = [];
let createSpy: ReturnType<typeof vi.fn>;
let revokeSpy: ReturnType<typeof vi.fn>;

/**
 * The two methods jsdom omits, added to the REAL `URL` rather than swapped in
 * over it.
 *
 * ⚠ `vi.stubGlobal("URL", { ...URL, … })` looks equivalent and is not: static
 * class methods are NON-ENUMERABLE, so the spread copies none of them and the
 * global `URL` becomes a plain object with no CONSTRUCTOR. Nothing here calls
 * `new URL(...)` today, so that version passed — it would have broken the first
 * test that did, with a failure pointing nowhere near the preview. Adding the
 * two missing properties and deleting them after leaves everything else intact.
 *
 * The cast is the trust boundary AGENTS.md §4 allows: these properties are
 * absent from the DOM typings precisely because jsdom does not implement them.
 */
const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

beforeEach(() => {
	minted = [];
	createSpy = vi.fn(() => {
		const url = `blob:mock/${minted.length}`;
		minted.push(url);
		return url;
	});
	revokeSpy = vi.fn();
	urlStatics.createObjectURL = createSpy as unknown as (blob: Blob) => string;
	urlStatics.revokeObjectURL = revokeSpy as unknown as (url: string) => void;
});

afterEach(() => {
	cleanup();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
});

type Advance = (next: ImageAttachState) => void;

/**
 * The composer's half of the contract, reduced to what this component can see:
 * a pick advances to `attaching` synchronously; Remove returns to `none`. Tests
 * drive the later transitions (`attached` / `error`) through `expose`, standing
 * in for the sign→PUT round trip resolving.
 */
function Harness({
	expose,
	acceptPicks = true,
}: {
	expose: (advance: Advance) => void;
	acceptPicks?: boolean;
}) {
	const [state, setState] = useState<ImageAttachState>({ phase: "none" });
	useEffect(() => {
		expose(setState);
	}, [expose]);
	return (
		<ImageAttach
			state={state}
			disabled={false}
			onPick={(file) => {
				// `acceptPicks: false` is the real composer's `if (inFlight) return`
				// (`BetComposer.tsx:242-244`) — a parent that DROPS the pick without
				// moving the phase at all.
				if (!acceptPicks) return;
				setState({ phase: "attaching", name: file.name });
			}}
			onRemove={() => setState({ phase: "none" })}
		/>
	);
}

function mount(opts: { acceptPicks?: boolean } = {}) {
	let advance: Advance = () => {};
	const { container, unmount } = render(
		<Harness
			acceptPicks={opts.acceptPicks ?? true}
			expose={(a) => {
				advance = a;
			}}
		/>,
	);
	return {
		container,
		unmount,
		advance: (next: ImageAttachState) => act(() => advance(next)),
	};
}

function pick(container: HTMLElement, name = "chart.png", type = "image/png") {
	const input = container.querySelector('input[type="file"]');
	if (input === null) throw new Error("no file input");
	fireEvent.change(input, {
		target: { files: [new File(["bytes"], name, { type })] },
	});
}

/** The rendered preview image, or null while the slot is the empty box. */
function previewImg(): HTMLImageElement | null {
	return document.querySelector("fieldset img");
}

describe("ImageAttach — the preview draws on SELECT, not on upload", () => {
	it("preview::renders-the-picked-image-immediately-on-select", () => {
		// The whole point: no await, no advance to `attached`, no network. At this
		// instant the composer is still in `attaching` — the PUT has not resolved.
		const { container } = mount();
		expect(previewImg()).toBeNull();

		pick(container);

		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(previewImg()?.getAttribute("src")).toBe(minted[0]);
	});

	it("preview::persists-unchanged-from-attaching-through-attached", () => {
		// `attaching` is the window between select and the PUT resolving. A preview
		// keyed off `attached` would vanish here — the gated-on-upload defect, which
		// reads as a flicker rather than as a bug. Same URL throughout, no churn.
		const { container, advance } = mount();
		pick(container);
		expect(previewImg()?.getAttribute("src")).toBe(minted[0]);

		advance({ phase: "attached", uploadId: "u1", name: "chart.png" });

		expect(previewImg()?.getAttribute("src")).toBe(minted[0]);
		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(revokeSpy).not.toHaveBeenCalled();
	});

	it("preview::is-shown-whole-and-lands-inside-the-4-5-slot-box", () => {
		// The caption this slot ships — canon §6, "Shown whole · any orientation" —
		// forecloses a crop, so the fit must be `object-contain`. And the 4:5 box is
		// the slot itself (d5 `.imgprev`), pinned in every phase by
		// `attach-phases.test.tsx`; the image must land INSIDE it, not replace it.
		const { container } = mount();
		pick(container);

		const cls = previewImg()?.getAttribute("class") ?? "";
		expect(cls).toMatch(/(?:^|\s)object-contain(?:\s|$)/);
		expect(cls).toMatch(/aspect-\[4\/5\]/);
	});

	it("preview::is-decorative-and-adds-no-accessible-name", () => {
		// The filename line beside it is the accessible content. An `alt` here would
		// duplicate that AND trip `attach-phases.test.tsx`'s `queryByText("Image")`
		// null-check in the attached phase.
		const { container } = mount();
		pick(container);

		expect(previewImg()?.getAttribute("alt")).toBe("");
		expect(previewImg()?.getAttribute("aria-hidden")).toBe("true");
	});

	it("preview::an-unreadable-file-falls-back-to-the-empty-box", () => {
		// Requirement 7 — no crash, and no broken-image glyph. `MarketThumb`'s
		// `onError` fallback, same shape.
		const { container } = mount();
		pick(container, "not-really.png");
		const img = previewImg();
		expect(img).not.toBeNull();

		fireEvent.error(img as HTMLImageElement);

		expect(previewImg()).toBeNull();
		// The empty 4:5 box is back — the slot never collapses.
		expect(screen.getByLabelText("Attach an image").innerHTML).toMatch(
			/aspect-\[4\/5\]/,
		);
		// And the URL it had minted was released rather than stranded.
		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
	});
});

describe("ImageAttach — every minted object URL is released", () => {
	it("preview::replacing-the-file-revokes-the-outgoing-url", () => {
		// Two picks, one release, still mounted — the replace path. `setPreview`
		// releases the outgoing URL before adopting the next, so this holds however
		// the replacement is reached.
		const { container } = mount();
		pick(container, "first.png");
		pick(container, "second.png");

		expect(createSpy).toHaveBeenCalledTimes(2);
		expect(revokeSpy).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
		// The live one is the SECOND, and it is still live.
		expect(previewImg()?.getAttribute("src")).toBe(minted[1]);
		expect(revokeSpy).not.toHaveBeenCalledWith(minted[1]);
	});

	it("preview::clearing-via-remove-revokes", () => {
		// The real journey: pick → attached → press Remove. The Remove control only
		// exists in the attached phase, so this is the only way a user clears one.
		const { container, advance } = mount();
		pick(container);
		advance({ phase: "attached", uploadId: "u1", name: "chart.png" });
		expect(revokeSpy).not.toHaveBeenCalled();

		fireEvent.click(screen.getByLabelText("Remove image"));

		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
		expect(previewImg()).toBeNull();
	});

	it("preview::a-pick-the-composer-drops-does-not-strand-an-image", () => {
		// ⛔ THIS IS THE TEST THAT PINS THE CLEARING EFFECT AS AN INVARIANT rather
		// than a transition watcher, and the case is REACHABLE — not theoretical.
		// `BetComposer.onPickImage` returns EARLY when `inFlight`
		// (`BetComposer.tsx:242-244`), leaving the phase exactly where it was. The
		// pick control is disabled while in flight, but the native file dialog is
		// ASYNCHRONOUS: it can be opened before the composer goes in flight and
		// resolved after, so `onChange` fires into a parent that drops it.
		//
		// Keyed on `state.phase` alone the effect would never run here — no phase
		// CHANGED — and the slot would sit showing an image the composer never
		// accepted, one step before an append-only, immutable write. Revert the
		// deps in `ImageAttach.tsx` and this is the assertion that reddens.
		const { container } = mount({ acceptPicks: false });

		pick(container);

		expect(createSpy).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
		expect(previewImg()).toBeNull();
	});

	it("preview::a-failed-attach-revokes-and-shows-no-image", () => {
		// A preview left standing after a rejected attach would assert a success
		// that did not happen.
		const { container, advance } = mount();
		pick(container);

		advance({ phase: "error", message: "Too large." });

		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
		expect(previewImg()).toBeNull();
	});

	it("preview::unmount-revokes--which-is-also-the-successful-submit-path", () => {
		// On success `BetComposer` calls `props.onClose()`, and BOTH mount sites in
		// `DebateView` render it conditionally on the state that closes (post:
		// `openSide`; reply: `openReply`) — so a successful place unmounts this
		// component. Asserting unmount therefore asserts submit; they are one path,
		// which is why no separate submit-time hook exists to test.
		const { container, advance, unmount } = mount();
		pick(container);
		advance({ phase: "attached", uploadId: "u1", name: "chart.png" });
		expect(revokeSpy).not.toHaveBeenCalled();

		unmount();

		expect(revokeSpy).toHaveBeenCalledTimes(1);
		expect(revokeSpy).toHaveBeenCalledWith(minted[0]);
	});

	it("preview::no-url-outlives-the-component-across-a-pick-replace-unmount-run", () => {
		// The ledger check: everything minted was released, exactly once each. This
		// is the assertion that reddens if a future edit adds a fifth way to drop a
		// file and forgets its revoke.
		const { container, unmount } = mount();
		pick(container, "a.png");
		pick(container, "b.png");
		pick(container, "c.png");
		unmount();

		expect(minted).toHaveLength(3);
		expect(revokeSpy).toHaveBeenCalledTimes(3);
		expect(revokeSpy.mock.calls.map((c) => c[0]).sort()).toEqual(
			[...minted].sort(),
		);
	});
});
