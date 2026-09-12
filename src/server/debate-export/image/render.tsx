import "server-only";

import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { PostExportProps } from "./compose";
import { loadExportFonts } from "./fonts";
import { fetchImageDataUri } from "./images";
import { loadExportLogo } from "./logo";
import { MarketPostExport } from "./MarketPostExport";
import { PALETTE } from "./palette";

/**
 * Resolve every remote image in the props to a data URI (or `null`) BEFORE
 * rendering, in parallel, each on its own deadline — see `images.ts`. The
 * composition then paints from bytes it already holds, so the image is either
 * complete or shows the page's own placeholder; it is never half-loaded.
 */
export async function resolveExportImages(
	props: PostExportProps,
	fetchImpl: typeof fetch = fetch,
): Promise<PostExportProps> {
	const [pfpUrl, postImageUrl, thumbUrl] = await Promise.all([
		fetchImageDataUri(props.post.pfpUrl, fetchImpl),
		fetchImageDataUri(props.post.imageUrl, fetchImpl),
		fetchImageDataUri(props.market.thumbUrl, fetchImpl),
	]);
	// The mark is local and static, so a failure here is a broken deploy rather
	// than a flaky third party — but it degrades the same way the images do,
	// because a missing logo must never cost the reader the whole export.
	const logoUrl = await loadExportLogo().catch(() => null);
	return {
		...props,
		logoUrl,
		post: { ...props.post, pfpUrl, imageUrl: postImageUrl },
		market: { ...props.market, thumbUrl },
	};
}

/**
 * ⚠ THE THREE ENCODER SETTINGS ARE LOAD-BEARING, NOT TASTE. This composition
 * is small mono text and hairline rules on a near-black ground — the worst
 * case for JPEG, and the case where the default settings look broken rather
 * than merely lossy.
 *
 * `chromaSubsampling: "4:4:4"` is the one that matters most: JPEG's default
 * `4:2:0` throws away three quarters of the colour resolution, which is
 * invisible on a photograph and very visible as coloured fringing on the
 * `Đ` figures, the YES/NO chips and the attachment. Quality 92 keeps the
 * ringing around glyph edges under the threshold where it reads as blur.
 * `mozjpeg` buys back most of the bytes those two cost.
 */
const JPEG_QUALITY = 92;

/**
 * Rasterise the composition and hand back a JPEG `Response` — `next/og`
 * (Satori + resvg, bundled with Next) for the raster, `sharp` for the encode.
 * Server-side on purpose: the output is independent of the viewer's viewport,
 * browser, font cache and the R2 buckets' CORS posture, which is what
 * "deterministic" has to mean for an artifact people will share.
 *
 * ⚠ TWO ENCODES, AND THE FIRST ONE IS NOT A WASTE. `ImageResponse` emits PNG
 * and has no format option, so the JPEG cannot come from the rasteriser — the
 * PNG is the intermediate, decoded once by `sharp` and re-encoded. The cost is
 * one in-memory round trip on a route that already fetches three remote images
 * on a 4s deadline apiece; the alternative is a second rasteriser.
 *
 * `flatten` first: JPEG carries no alpha channel, so any transparency the
 * raster holds would encode as BLACK rather than as the page's ground. The
 * composition's root is opaque `PALETTE.ground` today, which makes this a
 * guard rather than a fix — and the reason it is here is that the day the
 * root stops being opaque, the failure is a black-cornered image nobody
 * looks at again, not an error.
 */
export async function renderPostExportJpeg(
	props: PostExportProps,
	filename: string,
): Promise<Response> {
	const fonts = await loadExportFonts();
	const raster = await new ImageResponse(<MarketPostExport {...props} />, {
		width: props.width,
		height: props.height,
		fonts,
	}).arrayBuffer();
	const jpeg = await sharp(Buffer.from(raster))
		.flatten({ background: PALETTE.ground })
		.jpeg({
			quality: JPEG_QUALITY,
			chromaSubsampling: "4:4:4",
			mozjpeg: true,
		})
		.toBuffer();
	return new Response(new Uint8Array(jpeg), {
		headers: {
			"Content-Type": "image/jpeg",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(jpeg.byteLength),
			"Cache-Control": "no-store",
		},
	});
}
