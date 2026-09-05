/**
 * Measure what a page actually costs a first-time visitor.
 *
 * WHY THIS EXISTS: the caching work is invisible to `tsc`, `biome` and `vitest`
 * — all three pass whether an image is 12 KB or 600 KB, and whether the same
 * picture is downloaded once or four times. The only way to know is to fetch
 * the page and add up what it pulls. This does that, against ANY origin, so the
 * same command measures localhost before a change and staging after it.
 *
 * It reports the three numbers that decide whether the page is fast:
 *   - total bytes, split into HTML / JS / CSS / images
 *   - how many of those bytes are DUPLICATE content (same ETag, different URL)
 *   - whether each asset carries a cache header that lets a browser reuse it
 *
 * USAGE
 *   pnpm tsx scripts/measure-page-weight.mts                      # localhost:3000
 *   pnpm tsx scripts/measure-page-weight.mts https://staging...   # any origin
 *
 * It only reads. It writes nothing and mutates nothing.
 */

const origin = process.argv[2] ?? "http://localhost:3000";

type Asset = {
	url: string;
	kind: "js" | "css" | "image" | "font" | "other";
	bytes: number;
	etag: string | null;
	cacheControl: string | null;
	status: number;
};

/** Undo the layers of escaping between an RSC payload and a real URL. */
function decodePayload(html: string): string {
	return html
		.replace(/\\u0026/g, "&")
		.replace(/&amp;/g, "&")
		.replace(/\\"/g, '"');
}

function classify(url: string, contentType: string | null): Asset["kind"] {
	const t = contentType ?? "";
	if (t.startsWith("image/")) return "image";
	if (t.startsWith("font/") || /\.(woff2?|ttf|otf)/.test(url)) return "font";
	if (t.includes("javascript") || url.endsWith(".js")) return "js";
	if (t.includes("css") || url.endsWith(".css")) return "css";
	return "other";
}

function kb(n: number): string {
	return `${(n / 1024).toFixed(1)} KB`;
}

async function main() {
	const pageRes = await fetch(origin, { redirect: "follow" });
	const html = await pageRes.text();
	const decoded = decodePayload(html);
	const htmlBytes = Buffer.byteLength(html);

	// Same-origin build assets, plus any absolute R2 media the page references.
	const rel = [
		...decoded.matchAll(/"(\/_next\/[^"]+?\.(?:js|css|woff2?))"/g),
	].map((m) => m[1]);
	const abs = [
		...decoded.matchAll(
			/https:\/\/[a-z0-9.-]+\.r2\.cloudflarestorage\.com\/[^\s"'<>]+/g,
		),
	].map((m) => m[0].replace(/\\+$/, ""));
	const urls = [...new Set([...rel.map((r) => origin + r), ...abs])];

	const assets: Asset[] = [];
	for (const url of urls) {
		try {
			const r = await fetch(url);
			const buf = await r.arrayBuffer();
			assets.push({
				url,
				kind: classify(url, r.headers.get("content-type")),
				bytes: Number(r.headers.get("content-length") ?? buf.byteLength),
				etag: r.headers.get("etag"),
				cacheControl: r.headers.get("cache-control"),
				status: r.status,
			});
		} catch {
			assets.push({
				url,
				kind: "other",
				bytes: 0,
				etag: null,
				cacheControl: null,
				status: 0,
			});
		}
	}

	const ok = assets.filter((a) => a.status >= 200 && a.status < 300);
	const failed = assets.filter((a) => a.status === 0 || a.status >= 400);
	const sum = (list: Asset[]) => list.reduce((a, x) => a + x.bytes, 0);
	const total = htmlBytes + sum(ok);

	console.log(`\n  ORIGIN: ${origin}   (HTTP ${pageRes.status})`);
	console.log(`  ${"=".repeat(58)}`);
	console.log(`  TOTAL FIRST-VISIT WEIGHT : ${kb(total)}`);
	console.log(`    html                   : ${kb(htmlBytes)}`);
	for (const kind of ["js", "css", "image", "font", "other"] as const) {
		const g = ok.filter((a) => a.kind === kind);
		if (g.length)
			console.log(
				`    ${kind.padEnd(23)}: ${kb(sum(g)).padStart(10)}  (${g.length} files)`,
			);
	}
	if (failed.length)
		console.log(`    ⚠ failed to fetch      : ${failed.length}`);

	// Duplicate content: the same bytes served under more than one URL. A browser
	// caches by URL, so every duplicate is a full re-download.
	const byTag: Record<string, Asset[]> = {};
	for (const a of ok) {
		if (!a.etag) continue;
		const group = byTag[a.etag] ?? [];
		group.push(a);
		byTag[a.etag] = group;
	}
	const dupes = Object.values(byTag).filter((g) => g.length > 1);
	const wasted = dupes.reduce((a, g) => a + g[0].bytes * (g.length - 1), 0);

	console.log(
		`\n  DUPLICATE CONTENT        : ${kb(wasted)}${total ? `  (${((wasted / total) * 100).toFixed(0)}% of the page)` : ""}`,
	);
	for (const g of dupes) {
		console.log(`    x${g.length}  ${kb(g[0].bytes)} each  ${g[0].kind}`);
	}
	if (!dupes.length) console.log("    none — every asset is distinct");

	// A missing cache header means the browser refetches on the next visit.
	const uncached = ok.filter(
		(a) => !a.cacheControl || /max-age=0|no-store/.test(a.cacheControl),
	);
	console.log(
		`\n  ASSETS A BROWSER CANNOT REUSE : ${uncached.length} / ${ok.length}`,
	);
	for (const a of uncached.slice(0, 8)) {
		console.log(
			`    ${kb(a.bytes).padStart(10)}  ${a.cacheControl ?? "(no cache-control)"}  ${a.url.split("/").pop()?.slice(0, 34)}`,
		);
	}

	// The biggest single things on the page are usually where the win is.
	console.log("\n  LARGEST ASSETS");
	for (const a of [...ok].sort((x, y) => y.bytes - x.bytes).slice(0, 6)) {
		console.log(
			`    ${kb(a.bytes).padStart(10)}  ${a.kind.padEnd(6)} ${a.url.split("/").pop()?.slice(0, 40)}`,
		);
	}
	console.log();
}

main().catch((e) => {
	console.error("  FAILED:", e.message);
	process.exit(1);
});
