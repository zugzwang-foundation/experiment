// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-2 · RF-11 — PLACE Đ BET waits for an image that is still uploading.
 *
 * The request body carries an upload id only once the attach reaches
 * `attached`. Before RF-11 a press during `attaching` published the post
 * WITHOUT the image its author was looking at (MIRROR-1 CARRIED #5; measured
 * in a real browser at MIRROR-2's baseline: PLACE enabled while the PUT was in
 * flight). Now the submit is disabled for exactly that window, in both layouts,
 * and re-enables when the attach lands or fails.
 *
 * The sign request is held open by the test, so `attaching` is a state the test
 * sits in, not a race it hopes to catch.
 */

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: () => undefined,
		push: () => undefined,
		replace: () => undefined,
		back: () => undefined,
		forward: () => undefined,
		prefetch: () => undefined,
	}),
}));

const flag = vi.hoisted(() => ({ imageAttach: true as boolean | undefined }));
vi.mock("@/lib/posthog/use-flag", () => ({
	useFlag: (_name: string, fallback: boolean) => flag.imageAttach ?? fallback,
}));

import { BetComposer } from "@/components/debate/composer/BetComposer";
import type { MirrorContext } from "@/components/debate/composer/MirrorComposer";

import { composerProps, TITLE } from "./_harness";

const MIRROR: MirrorContext = {
	author: { pseudonym: "OliveBeaver000", pfpUrl: null },
	pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
};
const UPLOAD_ID = "0190c0de-0000-7000-8000-0000000000rb";

const urlStatics = URL as unknown as {
	createObjectURL?: (blob: Blob) => string;
	revokeObjectURL?: (url: string) => void;
};

let signGate: { release: (res: Response) => void } | null = null;
let placed: string[] = [];
let putBodies: unknown[] = [];

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

beforeEach(() => {
	signGate = null;
	placed = [];
	putBodies = [];
	flag.imageAttach = true;
	vi.stubGlobal(
		"fetch",
		vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/uploads/sign") {
				// Held until the test releases it with the answer it wants.
				return new Promise<Response>((resolve) => {
					signGate = { release: resolve };
				});
			}
			if (url.startsWith("https://r2.example.invalid/put/")) {
				putBodies.push(init?.body);
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url === "/api/bets/place") {
				placed.push(String(init?.body));
				return Promise.resolve(
					json(200, { ok: true, data: { commentId: "cmt-rf11" } }),
				);
			}
			return Promise.resolve(json(200, {}));
		}),
	);
	urlStatics.createObjectURL = () => "blob:rf11/preview";
	urlStatics.revokeObjectURL = () => undefined;
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
});

async function settle() {
	for (let i = 0; i < 25; i++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

const LAYOUTS = [
	{ name: "classic (phone)", mirror: undefined },
	{ name: "mirror (desktop)", mirror: MIRROR },
] as const;

function mount(mirror: MirrorContext | undefined) {
	const r = render(<BetComposer {...composerProps()} mirror={mirror} />);
	fireEvent.change(r.getByLabelText("Argument title"), {
		target: { value: TITLE },
	});
	return r;
}

function submitButton(r: ReturnType<typeof render>): HTMLButtonElement {
	const b = r.getByRole("button", { name: "PLACE Đ BET" });
	if (!(b instanceof HTMLButtonElement)) throw new Error("no submit");
	return b;
}

async function pick(r: ReturnType<typeof render>) {
	const input = r.container.querySelector('input[type="file"]');
	if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
	await act(async () => {
		fireEvent.change(input, {
			target: { files: [new File(["x"], "chart.png", { type: "image/png" })] },
		});
	});
	await settle();
}

describe("MIRROR-2 RF-11 — PLACE waits for the image, in both layouts", () => {
	for (const layout of LAYOUTS) {
		it(`rf11::${layout.name}::disabled-while-uploading-enabled-once-attached-and-the-image-is-sent`, async () => {
			const r = mount(layout.mirror);
			// Positive control: with a title typed, PLACE is enabled before any pick.
			expect(submitButton(r).disabled).toBe(false);
			await pick(r);
			// The sign is held: the composer is `attaching`.
			expect(signGate).not.toBeNull();
			expect(submitButton(r).disabled).toBe(true);
			// A press now does nothing.
			await act(async () => {
				fireEvent.click(submitButton(r));
			});
			expect(placed).toHaveLength(0);
			await act(async () => {
				signGate?.release(
					json(200, {
						ok: true,
						data: {
							uploadId: UPLOAD_ID,
							putUrl: "https://r2.example.invalid/put/rf11",
						},
					}),
				);
			});
			await settle();
			expect(submitButton(r).disabled).toBe(false);
			await act(async () => {
				fireEvent.click(submitButton(r));
			});
			await settle();
			expect(placed).toHaveLength(1);
			expect(JSON.parse(placed[0]).imageUploadsId).toBe(UPLOAD_ID);
		});

		it(`rf11::${layout.name}::re-enabled-when-the-attach-fails-and-the-image-is-dropped`, async () => {
			const r = mount(layout.mirror);
			await pick(r);
			expect(submitButton(r).disabled).toBe(true);
			await act(async () => {
				signGate?.release(
					json(400, {
						ok: false,
						error: {
							code: "error_image_mime_rejected",
							message: "unsupported image type",
						},
					}),
				);
			});
			await settle();
			// Today's error, and PLACE is back.
			expect(r.container.textContent).toContain("unsupported image type");
			expect(submitButton(r).disabled).toBe(false);
			await act(async () => {
				fireEvent.click(submitButton(r));
			});
			await settle();
			expect(placed).toHaveLength(1);
			expect(JSON.parse(placed[0])).not.toHaveProperty("imageUploadsId");
		});
	}
});

describe("MIRROR-2 RF-11 — only while the composer shows the upload", () => {
	for (const layout of LAYOUTS) {
		it(`rf11::${layout.name}::the-adr-0052-brake-landing-mid-upload-does-not-strand-place`, async () => {
			// With the brake applied the image view is gone; PLACE must not wait on
			// an upload nobody can see (`@security-auditor` L-2). Text-only is the
			// brake's own off state.
			const r = mount(layout.mirror);
			await pick(r);
			expect(submitButton(r).disabled).toBe(true);
			flag.imageAttach = false;
			r.rerender(<BetComposer {...composerProps()} mirror={layout.mirror} />);
			await settle();
			// Positive control: the image affordance really is gone.
			expect(r.container.querySelector('input[type="file"]')).toBeNull();
			expect(submitButton(r).disabled).toBe(false);
			await act(async () => {
				fireEvent.click(submitButton(r));
			});
			await settle();
			expect(placed).toHaveLength(1);
			// Still attaching when it went: no image rides the post.
			expect(JSON.parse(placed[0])).not.toHaveProperty("imageUploadsId");
		});
	}
});

describe("MIRROR-2 RF-10 — through the composer, what is uploaded is the re-save, never the picked file", () => {
	/**
	 * `image-attach.test.ts` owns the re-save's rules; this is the render-level
	 * half `@security-auditor` found missing — without it, a regression back to
	 * uploading the picked file would leave every render suite green. The jsdom
	 * pipeline's re-save (`tests/_setup/jsdom-image-pipeline.ts`) is a blob of
	 * the requested type whose text names it; the picked file is a different
	 * object with different bytes.
	 */
	for (const layout of LAYOUTS) {
		it(`rf10::${layout.name}::the-put-body-is-the-re-saved-blob`, async () => {
			const r = mount(layout.mirror);
			const input = r.container.querySelector('input[type="file"]');
			if (!(input instanceof HTMLInputElement))
				throw new Error("no file input");
			const picked = new File(["picked-bytes"], "photo.jpg", {
				type: "image/jpeg",
			});
			await act(async () => {
				fireEvent.change(input, { target: { files: [picked] } });
			});
			await settle();
			await act(async () => {
				signGate?.release(
					json(200, {
						ok: true,
						data: {
							uploadId: UPLOAD_ID,
							putUrl: "https://r2.example.invalid/put/rf10",
						},
					}),
				);
			});
			await settle();
			expect(putBodies).toHaveLength(1);
			const body = putBodies[0];
			expect(body).not.toBe(picked);
			expect(body).toBeInstanceOf(Blob);
			expect(await (body as Blob).text()).toBe("jsdom-resaved:image/jpeg");
		});
	}
});
