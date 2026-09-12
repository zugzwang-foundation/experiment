import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
	fetchImageDataUri,
	IMAGE_FETCH_TIMEOUT_MS,
	toPngDataUri,
} from "@/server/debate-export/image/images";

/**
 * POST-IMAGE-EXPORT — the image pre-fetch. Every branch here exists because
 * its failure mode is a blank or a thrown render rather than an error: a
 * WebP that Satori cannot decode, a slow object that would hold the response,
 * a 404 page served with an HTML type. Each must become `null` (the
 * placeholder) or a PNG, never anything in between.
 */
async function webpBytes(): Promise<Buffer> {
	return sharp({
		create: { width: 8, height: 4, channels: 4, background: "#ff0000ff" },
	})
		.webp()
		.toBuffer();
}

function responseOf(body: Buffer | string, type: string, ok = true): Response {
	return new Response(typeof body === "string" ? body : new Uint8Array(body), {
		status: ok ? 200 : 404,
		headers: { "content-type": type },
	});
}

async function decoded(dataUri: string) {
	const b64 = dataUri.replace(/^data:image\/png;base64,/, "");
	return sharp(Buffer.from(b64, "base64")).metadata();
}

describe("fetchImageDataUri", () => {
	it("transcodes a WebP object to a PNG data URI", async () => {
		const fetchImpl = vi.fn(async () =>
			responseOf(await webpBytes(), "image/webp"),
		);
		const out = await fetchImageDataUri("https://r2.example/a.webp", fetchImpl);
		expect(out).toMatch(/^data:image\/png;base64,/);
		const meta = await decoded(out as string);
		expect(meta.format).toBe("png");
		expect(meta.width).toBe(8);
		expect(meta.height).toBe(4);
	});

	it("returns null for a relative URL — the initials disc is the fallback", async () => {
		const fetchImpl = vi.fn();
		expect(
			await fetchImageDataUri("/pfp-placeholder.svg", fetchImpl),
		).toBeNull();
		expect(await fetchImageDataUri(null, fetchImpl)).toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("returns null on a non-2xx, a non-image type, or an empty body", async () => {
		expect(
			await fetchImageDataUri("https://x/a.png", async () =>
				responseOf("nope", "text/html", false),
			),
		).toBeNull();
		expect(
			await fetchImageDataUri("https://x/a.png", async () =>
				responseOf("<html>404</html>", "text/html"),
			),
		).toBeNull();
		expect(
			await fetchImageDataUri("https://x/a.png", async () =>
				responseOf(Buffer.alloc(0), "image/png"),
			),
		).toBeNull();
	});

	it("returns null when the bytes are not decodable", async () => {
		expect(
			await fetchImageDataUri("https://x/a.png", async () =>
				responseOf(Buffer.from("not an image"), "image/png"),
			),
		).toBeNull();
		expect(await toPngDataUri(Buffer.from("garbage"))).toBeNull();
	});

	it("aborts a fetch that outlives the deadline and returns null", async () => {
		vi.useFakeTimers();
		try {
			const fetchImpl = vi.fn(
				(_url: string | URL | Request, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener("abort", () =>
							reject(new Error("aborted")),
						);
					}),
			);
			const pending = fetchImageDataUri("https://x/slow.png", fetchImpl);
			await vi.advanceTimersByTimeAsync(IMAGE_FETCH_TIMEOUT_MS + 1);
			expect(await pending).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});
