import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The Zugzwang mark, as a data URI Satori can draw.
 *
 * ⛔ READ FROM `public/brand/zugzwang-mark.svg` RATHER THAN RE-DRAWN HERE, and
 * the difference is the whole point. The mark is four polygons — it would be
 * easy to paste them into the composition as inline JSX, and then the site and
 * the export would carry two copies of the brand's own logo, free to drift the
 * first time anyone touches either. The band already re-expresses the
 * chessboard wordmark by hand, because that one is Tailwind classes Satori
 * cannot resolve; this one is a file, and a file can simply be read.
 *
 * ⚠ TRACED, like the fonts. `@vercel/nft` cannot see a `process.cwd()`-rooted
 * path, so `next.config.ts`'s `outputFileTracingIncludes` names this file under
 * the image route's key — the same mechanism `fonts.ts` and the `.md` export
 * already rely on. Forget the tracing entry and the route throws ENOENT in
 * production while working perfectly in dev.
 *
 * ⚠ BASE64 RATHER THAN A PERCENT-ENCODED `utf8` SVG URI. Both are legal and the
 * utf8 form is smaller, but it has to escape `#`, which every fill in this file
 * begins with — one missed escape truncates the URI at the first colour and
 * Satori draws nothing, silently. Base64 has no characters to get wrong.
 *
 * Memoised: the file never changes at runtime.
 */
let cached: string | null = null;

export async function loadExportLogo(): Promise<string> {
	if (cached !== null) {
		return cached;
	}
	const svg = await readFile(
		join(process.cwd(), "public/brand/zugzwang-mark.svg"),
	);
	cached = `data:image/svg+xml;base64,${svg.toString("base64")}`;
	return cached;
}
