import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// POLL-IDLE 1b — every `<Link>` in the debate tree opts out of prefetch.
//
// `DebatePoll`'s `router.refresh()` invalidates Next's segment cache, and
// next@16.3.2's `invalidateSegmentCacheEntries` → `pingVisibleLinks` then
// cancels and RE-SCHEDULES a prefetch for every visible link. On `/m/[slug]`
// that turned each poll tick into one extra request per visible link, per
// viewer. The debate tree renders only on `/m/[slug]`, so the opt-out is scoped
// to it; prefetch stays on everywhere else (header, Discovery, profile).
//
// A SOURCE SCAN, comments stripped, because the property is "no link in these
// files was written without the opt-out" — a render test would only see the
// links one fixture happens to mount.

const ROOT = process.cwd();
const DEBATE_DIR = join(ROOT, "src/components/debate");

function stripComments(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function debateSources(): string[] {
	return readdirSync(DEBATE_DIR, { recursive: true, withFileTypes: true })
		.filter((e) => e.isFile() && e.name.endsWith(".tsx"))
		.map((e) => join(e.parentPath, e.name));
}

describe("POLL-IDLE 1b — debate-tree links never prefetch", () => {
	const files = debateSources().map((file) => {
		const code = stripComments(readFileSync(file, "utf8"));
		return {
			file: relative(ROOT, file),
			links: (code.match(/<Link\b/g) ?? []).length,
			optOuts: (code.match(/\bprefetch=\{false\}/g) ?? []).length,
		};
	});

	it("positive control — the scan finds the links it is guarding", () => {
		const total = files.reduce((n, f) => n + f.links, 0);
		// ArgProfile · FocusMarketCard · PositionStrip · SlotHeader ·
		// PhoneBottomBar · PhoneTitleStrip · AuthGateSlot ×2 at POLL-IDLE.
		expect(total).toBeGreaterThanOrEqual(8);
	});

	it("every <Link> in src/components/debate carries prefetch={false}", () => {
		const offenders = files
			.filter((f) => f.links !== f.optOuts)
			.map(
				(f) => `${f.file}: ${f.links} <Link>, ${f.optOuts} prefetch={false}`,
			);
		expect(offenders).toEqual([]);
	});
});
