// @vitest-environment jsdom

import {
	cleanup,
	createEvent,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BetComposer } from "@/components/debate/composer/BetComposer";
import {
	ImageAttach,
	type ImageAttachState,
} from "@/components/debate/composer/ImageAttach";

import { composerProps, stubWireFetch } from "./_harness";

/**
 * DND-1 — A FILE DROPPED ON THE IMAGE SLOT ATTACHES, AND A FILE DROPPED
 * ANYWHERE ELSE DOES NOTHING.
 *
 * ⛔ THE DEFECT THIS FILE IS MINTED FROM IS NOT "THE BOX IGNORES A DROP".
 * `grep -rn "onDrop\|dataTransfer" src/` returned ZERO before this task, so
 * the browser's own default handled every drop: it NAVIGATES THE TAB TO THE
 * FILE. Mandatory commentary (INV-1) means the composer always holds a typed
 * argument when that happens, so the cost of a near-miss was never zero — it
 * was the whole post. That is why case 5 below exists and why it is the half
 * with no visible affordance: the panel handler is the feature, the document
 * guard is the thing that stops a miss being expensive.
 *
 * ⚠ CASE 3 IS THE CONTROL AND IS NOT OPTIONAL. Both mechanisms work by
 * calling `preventDefault` on a drag, and the cheapest wrong implementation of
 * either is to call it unconditionally — which would also swallow a TEXT drag
 * into the argument textarea one grid track over. A suite that only asserted
 * the file arms would pass on that build. The `types` gate is what makes these
 * gates rather than blankets, and case 3 is the only thing that reads it.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 * `createEvent` rather than `fireEvent` wherever the assertion is about
 * `defaultPrevented`: `fireEvent`'s return value collapses "not cancelled" and
 * "not cancelable" into one boolean, and the second would be a broken harness
 * reported as a passing guard (`O-13`).
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

/**
 * jsdom implements NEITHER object-URL method, so a drop that mints a preview
 * throws before it reaches `onPick` — the component cannot run here without
 * these. Same shape and same reasoning as `attach-preview.test.tsx`, including
 * why the two properties are added to the real `URL` rather than a spread copy
 * swapped in over it: static class methods are non-enumerable, so the spread
 * would leave the global without a constructor.
 */
const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

beforeEach(() => {
	urlStatics.createObjectURL = (() => "blob:mock/0") as unknown as (
		blob: Blob,
	) => string;
	urlStatics.revokeObjectURL = (() => {}) as unknown as (url: string) => void;
});

afterEach(() => {
	cleanup();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

const ATTACH_LABEL = "Attach an image";

function pngFile(name = "argument.png"): File {
	return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

/** A drag carrying files — what an image dragged off the desktop looks like. */
function fileDrag(file: File) {
	return { dataTransfer: { files: [file], types: ["Files"] } };
}

/** A drag carrying no files — selected text, a link, an in-page selection. */
const TEXT_DRAG = {
	dataTransfer: { files: [], types: ["text/plain"] },
};

/**
 * ⛔ jsdom SHIPS NO `DragEvent`, SO `relatedTarget` HAS TO BE INSTALLED BY HAND.
 * Measured, not assumed: `typeof DragEvent === "undefined"` here, so
 * `fireEvent.dragLeave(el, { relatedTarget })` silently constructs a plain
 * `Event` and drops the property — the handler then sees `undefined`, takes the
 * "left the panel" arm, and the crossing-a-child assertion fails against a
 * component that is behaving correctly. A harness limitation that reads exactly
 * like a defect, which is why it is spelled out rather than worked around.
 */
function dragLeaveTowards(panel: HTMLElement, towards: Node | null): Event {
	const event = createEvent.dragLeave(panel, fileDrag(pngFile()));
	Object.defineProperty(event, "relatedTarget", { value: towards });
	return event;
}

function renderAttach(
	state: ImageAttachState,
	opts?: { disabled?: boolean; onPick?: (file: File) => void },
) {
	render(
		<ImageAttach
			state={state}
			disabled={opts?.disabled ?? false}
			onPick={opts?.onPick ?? (() => {})}
			onRemove={() => {}}
		/>,
	);
	return screen.getByLabelText(ATTACH_LABEL);
}

describe("DND-1 · the panel accepts a dropped file", () => {
	it("attach-drop::a-dropped-image-reaches-onPick-as-the-same-file", () => {
		const onPick = vi.fn();
		const panel = renderAttach({ phase: "none" }, { onPick });
		const file = pngFile();

		const drop = createEvent.drop(panel, fileDrag(file));
		fireEvent(panel, drop);

		// The DEFAULT is what navigates the tab away; cancelling it is half the fix.
		expect(drop.defaultPrevented).toBe(true);
		expect(onPick).toHaveBeenCalledTimes(1);
		// The same File object, not a copy and not a name — everything downstream
		// (`validateImageFile`, the T3 downscale, the signed PUT) reads the bytes.
		expect(onPick.mock.calls[0]?.[0]).toBe(file);
	});

	it("attach-drop::the-first-of-several-dropped-files-is-the-one-attached", () => {
		const onPick = vi.fn();
		const panel = renderAttach({ phase: "none" }, { onPick });
		const first = pngFile("first.png");
		const second = pngFile("second.png");

		fireEvent(
			panel,
			createEvent.drop(panel, {
				dataTransfer: { files: [first, second], types: ["Files"] },
			}),
		);

		// One comment carries one image (SPEC.1 §8 F-COMMENT-3). Taking the first
		// is a choice; attaching two, or silently attaching the last, is not.
		expect(onPick).toHaveBeenCalledTimes(1);
		expect(onPick.mock.calls[0]?.[0]).toBe(first);
	});

	it("attach-drop::a-dragover-marks-the-panel-and-a-drop-clears-it", () => {
		const panel = renderAttach({ phase: "none" });

		const over = createEvent.dragOver(panel, fileDrag(pngFile()));
		fireEvent(panel, over);
		// ⛔ `preventDefault` ON `dragover` IS WHAT MAKES THE ELEMENT A DROP TARGET
		// AT ALL. Without it the `drop` handler above never fires in a real
		// browser, however correct it is — and jsdom dispatches it regardless, so
		// case 1 passes on a build that does nothing on the live site.
		expect(over.defaultPrevented).toBe(true);
		expect(panel.getAttribute("data-dragging")).toBe("true");

		fireEvent(panel, createEvent.drop(panel, fileDrag(pngFile())));
		expect(panel.getAttribute("data-dragging")).toBe(null);
	});

	it("attach-drop::leaving-the-panel-clears-the-mark-but-crossing-a-child-does-not", () => {
		const panel = renderAttach({ phase: "none" });
		fireEvent(panel, createEvent.dragOver(panel, fileDrag(pngFile())));
		expect(panel.getAttribute("data-dragging")).toBe("true");

		// A drag crossing from the panel onto its own child fires `dragleave` on
		// the panel. Clearing there is the flicker this test exists to forbid:
		// the mark would blink off every time the pointer passed over the artwork.
		const child = panel.firstElementChild;
		expect(child).not.toBe(null);
		fireEvent(panel, dragLeaveTowards(panel, child));
		expect(panel.getAttribute("data-dragging")).toBe("true");

		fireEvent(panel, dragLeaveTowards(panel, document.body));
		expect(panel.getAttribute("data-dragging")).toBe(null);
	});
});

describe("DND-1 · the panel refuses a drop it must not act on", () => {
	it("attach-drop::a-drop-is-ignored-while-the-composer-is-disabled", () => {
		const onPick = vi.fn();
		const panel = renderAttach({ phase: "none" }, { onPick, disabled: true });

		const drop = createEvent.drop(panel, fileDrag(pngFile()));
		fireEvent(panel, drop);

		expect(onPick).not.toHaveBeenCalled();
		// Still cancelled: a refused drop must not fall through to the browser and
		// navigate away. "Ignored" means nothing happens, not that the default runs.
		expect(drop.defaultPrevented).toBe(true);
	});

	it("attach-drop::a-drop-is-ignored-while-a-file-is-already-uploading", () => {
		const onPick = vi.fn();
		// `attaching` is the window the pick BUTTON is already disabled for
		// (`disabled || state.phase === "attaching"`). A drop that skipped it would
		// start a second sign+PUT round trip behind the first and race the
		// composer's own `uploadId`.
		const panel = renderAttach(
			{ phase: "attaching", name: "first.png" },
			{
				onPick,
			},
		);

		fireEvent(panel, createEvent.drop(panel, fileDrag(pngFile())));
		expect(onPick).not.toHaveBeenCalled();
	});

	it("attach-drop::a-text-drag-is-left-entirely-to-the-browser", () => {
		const onPick = vi.fn();
		const panel = renderAttach({ phase: "none" }, { onPick });

		const over = createEvent.dragOver(panel, TEXT_DRAG);
		fireEvent(panel, over);
		const drop = createEvent.drop(panel, TEXT_DRAG);
		fireEvent(panel, drop);

		expect(over.defaultPrevented).toBe(false);
		expect(drop.defaultPrevented).toBe(false);
		expect(onPick).not.toHaveBeenCalled();
		expect(panel.getAttribute("data-dragging")).toBe(null);
	});
});

describe("DND-1 · a miss costs the argument nothing", () => {
	function mountComposer() {
		stubWireFetch([]);
		return render(<BetComposer {...composerProps()} />);
	}

	it("attach-drop::a-file-dropped-outside-the-panel-never-reaches-the-browser", () => {
		mountComposer();

		const drop = createEvent.drop(document.body, fileDrag(pngFile()));
		fireEvent(document.body, drop);
		expect(drop.defaultPrevented).toBe(true);

		// `dragover` too: the pair is what suppresses the navigation, and
		// cancelling only `drop` leaves Chrome's own handling of the drag intact.
		const over = createEvent.dragOver(document.body, fileDrag(pngFile()));
		fireEvent(document.body, over);
		expect(over.defaultPrevented).toBe(true);
	});

	it("attach-drop::a-text-drag-outside-the-panel-is-not-swallowed", () => {
		mountComposer();

		const drop = createEvent.drop(document.body, TEXT_DRAG);
		fireEvent(document.body, drop);
		// Dragging selected text into the body — or into the argument textarea,
		// which this same document listener sits above — must behave natively.
		expect(drop.defaultPrevented).toBe(false);
	});

	it("attach-drop::the-document-listener-is-released-when-the-composer-closes", () => {
		const { unmount } = mountComposer();
		unmount();

		const drop = createEvent.drop(document.body, fileDrag(pngFile()));
		fireEvent(document.body, drop);
		// ⛔ THE NEGATIVE ARM IS THE POINT. Without it this suite passes on a
		// build that registers a global listener and never removes it — every
		// composer ever opened leaving one behind, changing the behaviour of
		// pages that hold nothing worth protecting.
		expect(drop.defaultPrevented).toBe(false);
	});
});
