// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseParams } = vi.hoisted(() => ({ mockUseParams: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: mockUseParams }));

import {
	DownloadPostImage,
	postImageFilename,
	postImageHref,
} from "@/components/debate/DownloadPostImage";

/**
 * POST-IMAGE-EXPORT — the download mark as a WORKING control. Fetch → blob →
 * synthetic anchor, with the three properties the placeholder never had to
 * hold: it is disabled while the server renders (so a second click cannot
 * start a second render), it refuses to save anything that is not a non-empty
 * JPEG, and a failure is announced beside the mark and then RELEASES the
 * button. No jest-dom (AGENTS.md §9) — plain DOM.
 */
afterEach(cleanup);

/** Let the fetch → blob → state chain settle: undici reads a body off a macrotask. */
async function flush(): Promise<void> {
	await act(async () => {
		await new Promise((r) => setTimeout(r, 20));
	});
}

const SLUG = "test-market";
const HREF = postImageHref(SLUG, 3);

function jpegResponse(): Response {
	// A typed BYTE body, not a Blob: under the jsdom environment `Blob` is
	// jsdom's while `Response` is undici's, and undici stringifies a foreign
	// Blob to "[object Blob]" with a text/plain type — which is exactly the
	// non-JPEG the control must refuse, so it would fail the wrong test.
	return new Response(new Uint8Array([255, 216, 255, 224]), {
		status: 200,
		headers: { "content-type": "image/jpeg" },
	});
}

function button(container: HTMLElement): HTMLButtonElement {
	const b = container.querySelector<HTMLButtonElement>(
		'button[aria-label="Download post image"]',
	);
	if (b === null) throw new Error("no download button");
	return b;
}

let anchorClicks: string[];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
	mockUseParams.mockReturnValue({ slug: SLUG });
	anchorClicks = [];
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
	// jsdom has no object URLs; the anchor's `download` name is what we read.
	vi.stubGlobal("URL", {
		...URL,
		createObjectURL: () => "blob:test",
		revokeObjectURL: () => {},
	});
	vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
		this: HTMLAnchorElement,
	) {
		anchorClicks.push(this.download);
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("DownloadPostImage", () => {
	it("names the route and the file from the slug and ordinal", () => {
		expect(HREF).toBe("/m/test-market/export/image?post=3");
		expect(postImageFilename(SLUG, 3)).toBe("test-market-post-3.jpg");
		expect(postImageHref("a b", 1)).toBe("/m/a%20b/export/image?post=1");
	});

	it("REPLY-IMAGE-EXPORT — a reply's route and file carry its ordinal within the post", () => {
		expect(postImageHref(SLUG, 3, 2)).toBe(
			"/m/test-market/export/image?post=3&reply=2",
		);
		expect(postImageFilename(SLUG, 3, 2)).toBe(
			"test-market-post-3-reply-2.jpg",
		);
	});

	it("REPLY-IMAGE-EXPORT — a reply's mark fetches the reply route and names itself for a reply", async () => {
		fetchMock.mockResolvedValue(jpegResponse());
		const { container } = render(<DownloadPostImage ordinal={3} reply={2} />);
		const b = container.querySelector<HTMLButtonElement>(
			'button[aria-label="Download reply image"]',
		);
		if (b === null) throw new Error("no reply download button");
		await act(async () => {
			fireEvent.click(b);
		});
		await flush();
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"/m/test-market/export/image?post=3&reply=2",
		);
		expect(anchorClicks).toEqual(["test-market-post-3-reply-2.jpg"]);
	});

	it("is enabled under a route and fetches, then saves the JPEG under its name", async () => {
		let release: (r: Response) => void = () => {};
		fetchMock.mockReturnValue(
			new Promise<Response>((resolve) => {
				release = resolve;
			}),
		);
		const { container } = render(<DownloadPostImage ordinal={3} />);
		const b = button(container);
		expect(b.disabled).toBe(false);
		expect(b.getAttribute("href")).toBeNull();

		fireEvent.click(b);
		// Busy: disabled, announced, and a second click starts NOTHING.
		expect(b.disabled).toBe(true);
		expect(b.getAttribute("aria-busy")).toBe("true");
		// ⚠ AND IT SAYS SO IN WORDS, STILL — the label is `sr-only` now, not gone.
		// `aria-busy` is not announced on its own by most screen readers and a
		// spinner is invisible to all of them, so this live region is the only
		// thing that tells a non-sighted reader their click registered, which is
		// the moment they would otherwise click again. The assertion is on its
		// TEXT rather than on the node, because an empty live region announces
		// nothing and would still satisfy a presence check.
		const busyNode = container.querySelector(
			'[data-testid="download-post-image-busy"]',
		);
		expect(busyNode?.textContent).toBe("Preparing the image…");
		// ⚠ AND THE SIGHTED HALF IS ASSERTED SEPARATELY, because the two can fail
		// apart: the announcement can survive while the spinner is lost to a class
		// rename or an icon swap, and nothing else in this file would notice.
		// ⛔ THE CLASS IS WHAT IS PINNED, NOT THE MOTION. jsdom performs no layout
		// and runs no animation, so this proves the utility is ASKED FOR and can
		// never prove it TURNS — the keyframes were absent from this app's built
		// CSS until the component used it (see the art layer's note), and only a
		// read of the built stylesheet settles that. Recorded here so the next
		// person does not mistake a green test for a spinning icon.
		// ⛔⛔ AND THE CLASS NAME IS ASSEMBLED AT RUNTIME, WHICH IS NOT FUSSINESS.
		// Tailwind v4's source detection scans `tests/` as well as `src/`, so a
		// literal here would ITSELF emit the utility into the built stylesheet —
		// and the only check that can prove the icon really spins is a grep of
		// that stylesheet. Written plainly, this assertion would manufacture the
		// evidence for its own subject. AGENTS.md §8 carries the measured case.
		const SPIN = ["animate", "spin"].join("-");
		expect(b.querySelector("svg")?.getAttribute("class") ?? "").toContain(SPIN);
		fireEvent.click(b);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(HREF);
		expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ cache: "no-store" });

		await act(async () => {
			release(jpegResponse());
			await Promise.resolve();
		});
		await flush();

		expect(anchorClicks).toEqual(["test-market-post-3.jpg"]);
		expect(b.disabled).toBe(false);
		expect(b.getAttribute("aria-busy")).toBeNull();
		expect(
			container.querySelector('[data-testid="download-post-image-error"]'),
		).toBeNull();
		// ⚠ AND THE BUSY LABEL IS GONE. A progress message that outlives the work
		// is worse than none: it tells the reader to keep waiting for something
		// that already finished.
		expect(
			container.querySelector('[data-testid="download-post-image-busy"]'),
		).toBeNull();
	});

	it("announces a failed render and restores the button — saving nothing", async () => {
		fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
		const { container } = render(<DownloadPostImage ordinal={3} />);
		const b = button(container);
		await act(async () => {
			fireEvent.click(b);
		});
		await flush();
		const status = container.querySelector(
			'[data-testid="download-post-image-error"]',
		);
		expect(status).not.toBeNull();
		expect(status?.getAttribute("role")).toBe("status");
		expect(status?.getAttribute("aria-live")).toBe("polite");
		expect(anchorClicks).toEqual([]);
		expect(b.disabled).toBe(false);

		// The next attempt clears the line.
		fetchMock.mockResolvedValue(jpegResponse());
		await act(async () => {
			fireEvent.click(b);
		});
		await flush();
		expect(anchorClicks).toEqual(["test-market-post-3.jpg"]);
		expect(
			container.querySelector('[data-testid="download-post-image-error"]'),
		).toBeNull();
	});

	it("refuses a 200 that is not a non-empty JPEG — never a corrupt file", async () => {
		fetchMock.mockResolvedValue(
			new Response("<html>login</html>", {
				status: 200,
				headers: { "content-type": "text/html" },
			}),
		);
		const { container } = render(<DownloadPostImage ordinal={3} />);
		await act(async () => {
			fireEvent.click(button(container));
		});
		await flush();
		expect(anchorClicks).toEqual([]);
		expect(
			container.querySelector('[data-testid="download-post-image-error"]'),
		).not.toBeNull();

		// ⚠ A PNG IS NOW A REFUSAL, and this line is the whole reason this case
		// exists twice. The route emitted PNG before the format flip, so a stale
		// deployment answering an updated client is the realistic failure — and
		// without this assertion the control would happily save those bytes under
		// a `.jpg` name, producing the mislabelled file the type check is for.
		fetchMock.mockResolvedValue(
			new Response(new Uint8Array([137, 80, 78, 71]), {
				status: 200,
				headers: { "content-type": "image/png" },
			}),
		);
		await act(async () => {
			fireEvent.click(button(container));
		});
		await flush();
		expect(anchorClicks).toEqual([]);
	});

	it("is inert without a route slug, and never fetches", () => {
		mockUseParams.mockReturnValue(null);
		const { container } = render(<DownloadPostImage ordinal={3} />);
		const b = button(container);
		expect(b.disabled).toBe(true);
		expect(b.getAttribute("aria-disabled")).toBe("true");
		fireEvent.click(b);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
