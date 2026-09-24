// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * MIRROR-2 · RF-12 — a pick cannot race a submit.
 *
 * MIRROR-1's `@security-auditor` (L-1) reproduced this in jsdom and MIRROR-2
 * reproduced it again in a real browser at baseline: attach A → `Replace` opens
 * the native picker → PLACE goes in flight carrying A → the picker returns B.
 * The file input drew B over A (and revoked A's preview) although the composer
 * refused B, so after a transient failure the author, looking at B, retried and
 * published A. This file is that reproduction (the audit's own, from
 * `~/Downloads/zz_MIRROR-1_audit_repro/`) turned into a guard: every assertion
 * that used to record the defect now asserts the fixed behaviour. The refusal
 * lives in the shared file input, so the phone layout gets it too; the same
 * door also let a pick race a DROP's upload (S-1), which is closed with it.
 *
 * The checked-clean evidence from the same audit (Replace, a rejected Replace,
 * Remove, a drop mid-upload, the PLACE-time image error) is kept, so the fix is
 * shown not to have broken the paths around it. One of its cases changed
 * meaning under RF-11: a submit while an image is uploading is now REFUSED
 * (PLACE is disabled), not sent without the image.
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

import { BetComposer } from "@/components/debate/composer/BetComposer";
import type { MirrorContext } from "@/components/debate/composer/MirrorComposer";

import { composerProps, TITLE } from "./_harness";

const MIRROR: MirrorContext = {
	author: { pseudonym: "OliveBeaver000", pfpUrl: null },
	pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
};

const urlStatics = URL as unknown as {
	createObjectURL?: (b: Blob) => string;
	revokeObjectURL?: (u: string) => void;
};

type Held = { resolve: (r: Response) => void; reject: (e: unknown) => void };
let signs = 0;
let holdSign = false;
let heldSign: Held | null = null;
let placed: string[] = [];
let placeScript: Array<"hold" | "ok" | "image_oversize"> = [];
let heldPlace: Held | null = null;
let minted: string[] = [];
let revoked: string[] = [];

const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

beforeEach(() => {
	signs = 0;
	holdSign = false;
	heldSign = null;
	placed = [];
	placeScript = [];
	heldPlace = null;
	minted = [];
	revoked = [];
	vi.stubGlobal(
		"fetch",
		vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/uploads/sign") {
				signs += 1;
				const ok = json(200, {
					ok: true,
					data: {
						uploadId: `upload-${signs}`,
						putUrl: `https://r2.example.invalid/put/${signs}`,
					},
				});
				if (holdSign) {
					return new Promise<Response>((resolve, reject) => {
						heldSign = { resolve: () => resolve(ok), reject };
					});
				}
				return Promise.resolve(ok);
			}
			if (url.startsWith("https://r2.example.invalid/put/")) {
				return Promise.resolve(new Response(null, { status: 200 }));
			}
			if (url === "/api/bets/place") {
				placed.push(String(init?.body));
				const step = placeScript.shift() ?? "ok";
				if (step === "hold") {
					return new Promise<Response>((resolve, reject) => {
						heldPlace = { resolve, reject };
					});
				}
				if (step === "image_oversize") {
					return Promise.resolve(
						json(413, {
							ok: false,
							error: {
								code: "error_image_oversize",
								message: "RawErrorClass: 9000000 > 8388608",
							},
						}),
					);
				}
				return Promise.resolve(
					json(200, { ok: true, data: { commentId: "cmt-1" } }),
				);
			}
			return Promise.resolve(json(200, {}));
		}),
	);
	urlStatics.createObjectURL = (b: Blob) => {
		const u = `blob:preview/${(b as File).name}#${minted.length}`;
		minted.push(u);
		return u;
	};
	urlStatics.revokeObjectURL = (u: string) => {
		revoked.push(u);
	};
	vi.stubGlobal(
		"matchMedia",
		(q: string) =>
			({
				matches: false,
				media: q,
				addEventListener: () => undefined,
				removeEventListener: () => undefined,
			}) as unknown as MediaQueryList,
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	urlStatics.createObjectURL = undefined;
	urlStatics.revokeObjectURL = undefined;
});

async function settle() {
	for (let i = 0; i < 30; i++) {
		await act(async () => {
			await Promise.resolve();
		});
	}
}

function fileInput(c: HTMLElement): HTMLInputElement {
	const el = c.querySelector('input[type="file"]');
	if (!(el instanceof HTMLInputElement)) throw new Error("no file input");
	return el;
}

async function pick(c: HTMLElement, name: string, type = "image/png") {
	await act(async () => {
		fireEvent.change(fileInput(c), {
			target: { files: [new File(["x"], name, { type })] },
		});
	});
	await settle();
}

const mirrorPreview = (c: HTMLElement) =>
	c.querySelector('[data-mirror-view="image"] img')?.getAttribute("src") ??
	null;
const body = (i: number) => JSON.parse(placed[i]) as Record<string, unknown>;

function mount(mirror: boolean) {
	const r = render(
		<BetComposer {...composerProps()} mirror={mirror ? MIRROR : undefined} />,
	);
	fireEvent.change(r.getByLabelText("Argument title"), {
		target: { value: TITLE },
	});
	return r;
}

function submit(r: ReturnType<typeof render>): HTMLButtonElement {
	const b = r.getByRole("button", { name: "PLACE Đ BET" });
	if (!(b instanceof HTMLButtonElement)) throw new Error("no submit");
	return b;
}

describe("MIRROR-2 RF-12 — a file that arrives mid-submit is ignored at the input", () => {
	it("rf12::mirror::replace-resolving-into-a-submit-is-ignored-and-the-retry-publishes-what-the-frame-shows", async () => {
		const r = mount(true);
		const { container, getByRole } = r;
		await pick(container, "a.png");
		expect(signs).toBe(1);
		expect(mirrorPreview(container)).toBe(minted[0]);

		// Replace opens the native picker (jsdom: `input.click()` opens nothing —
		// the dialog is "open" from here on).
		fireEvent.click(getByRole("button", { name: "Replace" }));

		// While the picker is open the composer goes in flight; the request is held.
		placeScript = ["hold", "ok"];
		await act(async () => {
			fireEvent.click(submit(r));
		});
		expect(placed).toHaveLength(1);
		expect(body(0).imageUploadsId).toBe("upload-1");

		// The picker, opened before in-flight, resolves now — with B.
		await pick(container, "b.png");
		// FIXED: B is neither drawn nor signed, and A's preview is untouched.
		expect(minted).toHaveLength(1);
		expect(mirrorPreview(container)).toBe(minted[0]);
		expect(revoked).not.toContain(minted[0]);
		expect(signs).toBe(1);

		// The held request fails transiently; the composer stays open, key held.
		await act(async () => {
			heldPlace?.reject(new TypeError("network down"));
		});
		await settle();
		expect(mirrorPreview(container)).toBe(minted[0]); // still A on screen

		// The retry publishes A — which is exactly what the frame shows.
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(placed).toHaveLength(2);
		expect(body(1).imageUploadsId).toBe("upload-1");
		expect(minted[0]).toContain("a.png");
	});

	it("rf12::classic::a-pick-that-lands-mid-submit-is-neither-drawn-nor-signed", async () => {
		// The phone layout has no `Replace`, but the same input: a picker opened
		// in the empty state and resolved in flight must not draw its file either.
		const r = mount(false);
		placeScript = ["hold"];
		await act(async () => {
			fireEvent.click(submit(r));
		});
		expect(placed).toHaveLength(1);
		await pick(r.container, "late.png");
		expect(minted).toEqual([]);
		expect(signs).toBe(0);
		expect(body(0)).not.toHaveProperty("imageUploadsId");
	});

	for (const mirror of [false, true]) {
		it(`rf12::${mirror ? "mirror" : "classic"}::a-pick-that-lands-during-a-drops-upload-is-ignored`, async () => {
			// S-1: the picker is open, a file is DROPPED and starts uploading, and
			// then the picker returns. Before RF-12 that started a second upload
			// racing the first while the frame showed the second.
			holdSign = true;
			const { container } = mount(mirror);
			const target = container.querySelector("fieldset");
			if (!(target instanceof HTMLElement)) throw new Error("no fieldset");
			const dropped = new File(["d"], "dropped.png", { type: "image/png" });
			const dt = { types: ["Files"], files: [dropped], dropEffect: "" };
			await act(async () => {
				fireEvent.dragOver(target, { dataTransfer: dt });
				fireEvent.drop(target, { dataTransfer: dt });
			});
			await settle();
			expect(minted).toHaveLength(1);
			expect(signs).toBe(1);
			await pick(container, "picked.png");
			expect(minted).toHaveLength(1);
			expect(signs).toBe(1);
			expect(revoked).not.toContain(minted[0]);
		});
	}
});

describe("MIRROR-2 — the paths around the fix still behave (the audit's checked-clean cases)", () => {
	it("rf12::mirror::replace-when-idle-still-replaces-and-sends-only-the-new-id", async () => {
		// Positive control for the refusal above: outside a submit, Replace works.
		const r = mount(true);
		await pick(r.container, "a.png");
		fireEvent.click(r.getByRole("button", { name: "Replace" }));
		await pick(r.container, "b.png");
		expect(signs).toBe(2);
		expect(revoked).toContain(minted[0]);
		expect(mirrorPreview(r.container)).toBe(minted[1]);
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(body(0).imageUploadsId).toBe("upload-2");
	});

	it("rf12::mirror::replace-with-a-rejected-type-drops-the-stale-id-and-the-preview", async () => {
		const r = mount(true);
		await pick(r.container, "a.png");
		fireEvent.click(r.getByRole("button", { name: "Replace" }));
		await pick(r.container, "notes.txt", "text/plain");
		expect(signs).toBe(1); // local MIME validation refused it before any sign
		expect(mirrorPreview(r.container)).toBeNull();
		expect(revoked).toEqual(expect.arrayContaining([minted[0], minted[1]]));
		expect(r.getByRole("status").textContent).toContain(
			"unsupported image type",
		);
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(body(0)).not.toHaveProperty("imageUploadsId");
	});

	it("rf12::mirror::remove-drops-the-id", async () => {
		const r = mount(true);
		await pick(r.container, "a.png");
		fireEvent.click(r.getByRole("button", { name: "Remove image" }));
		await settle();
		expect(mirrorPreview(r.container)).toBeNull();
		expect(revoked).toContain(minted[0]);
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(body(0)).not.toHaveProperty("imageUploadsId");
	});

	it("rf11::mirror::a-submit-while-attaching-is-refused-then-carries-the-image", async () => {
		// The audit recorded "a submit mid-upload sends no image" as clean; RF-11
		// makes it stricter — PLACE is disabled until the image lands.
		holdSign = true;
		const r = mount(true);
		await pick(r.container, "a.png");
		expect(mirrorPreview(r.container)).toBe(minted[0]); // drawn while attaching
		expect(submit(r).disabled).toBe(true);
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(placed).toHaveLength(0);
		await act(async () => {
			heldSign?.resolve(new Response());
		});
		await settle();
		expect(submit(r).disabled).toBe(false);
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(placed).toHaveLength(1);
		expect(body(0).imageUploadsId).toBe("upload-1");
	});

	it("rf12::mirror::a-drop-while-attaching-is-refused", async () => {
		holdSign = true;
		const { container } = mount(true);
		await pick(container, "a.png");
		const fs = container.querySelector(
			'[data-testid="mirror-image-view"]',
		) as HTMLElement;
		const b = new File(["y"], "b.png", { type: "image/png" });
		const dt = { types: ["Files"], files: [b], dropEffect: "" };
		await act(async () => {
			fireEvent.dragOver(fs, { dataTransfer: dt });
			fireEvent.drop(fs, { dataTransfer: dt });
		});
		await settle();
		expect(minted).toHaveLength(1);
		expect(signs).toBe(1);
		expect(dt.dropEffect).toBe("none");
	});

	it("rf12::mirror::a-place-time-image-error-drops-the-id-and-the-preview", async () => {
		const r = mount(true);
		await pick(r.container, "a.png");
		placeScript = ["image_oversize", "ok"];
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(mirrorPreview(r.container)).toBeNull();
		expect(revoked).toContain(minted[0]);
		expect(r.container.textContent).not.toContain("RawErrorClass");
		// Edit to clear the p3_image lock, then resubmit.
		fireEvent.change(r.getByLabelText("Argument title"), {
			target: { value: `${TITLE} ` },
		});
		await act(async () => {
			fireEvent.click(submit(r));
		});
		await settle();
		expect(placed).toHaveLength(2);
		expect(body(1)).not.toHaveProperty("imageUploadsId");
	});
});
