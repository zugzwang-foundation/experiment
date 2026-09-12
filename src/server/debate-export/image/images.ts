import "server-only";

import sharp from "sharp";

/**
 * Pre-fetch every remote image the export paints and hand Satori a PNG data
 * URI.
 *
 * Satori will fetch an `<img src>` itself, but it does so with no timeout and
 * no control over what a failure looks like — a slow or dead R2 object could
 * hold the whole render or leave a blank box. Fetching here bounds each image
 * with its own deadline and turns failure into `null`, which the composition
 * renders as the SAME placeholder the page draws when it has no attachment.
 * The export never ships a half-loaded image: it either has the bytes or it
 * has the placeholder.
 *
 * ⚠ EVERY IMAGE IS TRANSCODED TO PNG, AND THAT IS NOT OPTIONAL. Satori decodes
 * PNG, JPEG, GIF and SVG only, and every avatar (`pfp-url.ts` accepts `.webp`
 * alone) and every `market_media` object on staging is WebP — so without this
 * step the two images the export most needs would be the two it could never
 * draw, and Satori's failure mode is a thrown `TypeError` deep in its size
 * parser rather than a missing image. `sharp` (already Next's own image
 * dependency and already on `pnpm.onlyBuiltDependencies`, now declared) does
 * the decode; `rotate()` applies EXIF orientation so a phone upload does not
 * come out sideways; the bound on the long edge keeps the PNG Satori receives
 * proportionate to the box it will occupy, since the composition never paints
 * an image wider than ~1100 device pixels.
 *
 * ⚠ Relative URLs (the PFP placeholder `/pfp-placeholder.svg`) resolve to
 * `null` deliberately: the page's own fallback for a missing avatar is the
 * initials disc, and reproducing that is cheaper and more deterministic than
 * having the server fetch a static asset from itself.
 */
export const IMAGE_FETCH_TIMEOUT_MS = 4000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_EDGE_PX = 1200;

export async function fetchImageDataUri(
	url: string | null,
	fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
	if (url === null || !/^https?:\/\//.test(url)) {
		return null;
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
	try {
		const res = await fetchImpl(url, { signal: controller.signal });
		if (!res.ok) {
			return null;
		}
		const type = res.headers.get("content-type") ?? "";
		if (!type.startsWith("image/")) {
			return null;
		}
		const bytes = await res.arrayBuffer();
		if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
			return null;
		}
		return await toPngDataUri(Buffer.from(bytes));
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/** Decode any format sharp reads, bound the long edge, re-encode as PNG. */
export async function toPngDataUri(input: Buffer): Promise<string | null> {
	try {
		const png = await sharp(input)
			.rotate()
			.resize({
				width: MAX_EDGE_PX,
				height: MAX_EDGE_PX,
				fit: "inside",
				withoutEnlargement: true,
			})
			.png()
			.toBuffer();
		return `data:image/png;base64,${png.toString("base64")}`;
	} catch {
		return null;
	}
}
