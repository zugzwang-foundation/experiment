import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	RESOLUTION_BLOCKS,
	type ResolutionBlockSet,
} from "@/components/debate/resolution-block-data";
import {
	ALL_GLYPH_FILES,
	getResolutionBlockGlyphs,
} from "@/components/debate/resolution-block-glyphs";

import { decodePng, encodePngRgba } from "./_png";

/**
 * BLOCK-5b — the shipped glyph assets, asserted against the BYTES on disk.
 *
 * ⚠⚠ THESE READ THE REAL FILES, NOT A FIXTURE. The defect this whole task
 * exists to avoid — a plate that does not match `bg-n1` and renders as a
 * visible square inside the block's own frame — lives in the pixels, so a test
 * that mocked them would be certifying nothing. `tests/unit/debate/_png.ts`
 * decodes them with no new dependency.
 *
 * ⚠ ONE DEFINITION OF "INK", SHARED WITH THE PIPELINE. Ink is `alpha >= 128` —
 * half-opaque. The asset pipeline normalised optical size against exactly this
 * predicate, so the pipeline and this guard cannot disagree about what they are
 * measuring. A looser threshold would drag the faintest anti-aliased fringe
 * into the bounding box and report a height the pipeline never targeted.
 */

const ROOT = process.cwd();
const GLYPH_DIR = join(ROOT, "public/brand/blocks");

/** Half-opaque. The shared ink predicate — see the docblock above. */
const ALPHA_INK = 128;
/** The canvas every asset is normalised onto. */
const CANVAS = 512;
/** BLOCK-5a's measured house convention: ink height is 70% of the canvas. */
const INK_TARGET_PCT = 70;
/** ± tolerance on that, per the brief. */
const INK_TOLERANCE = 2;
/**
 * Chroma tolerance. The shipped marks are a flat `#FAFAFA`, so their measured
 * chroma is exactly 0; 2 is headroom for a future re-export, not slack that
 * makes the check weak — the synthetic control below fails at 239.
 */
const CHROMA_TOLERANCE = 2;

type Decoded = ReturnType<typeof decodePng>;

function readGlyph(name: string): Decoded {
	return decodePng(readFileSync(join(GLYPH_DIR, name)));
}

/** Bounding box of `alpha >= ALPHA_INK`, or null when nothing is opaque enough. */
function inkBox(png: Decoded) {
	let x0 = png.width;
	let y0 = png.height;
	let x1 = -1;
	let y1 = -1;
	for (let y = 0; y < png.height; y++) {
		for (let x = 0; x < png.width; x++) {
			if ((png.data[(y * png.width + x) * 4 + 3] ?? 0) >= ALPHA_INK) {
				if (x < x0) x0 = x;
				if (x > x1) x1 = x;
				if (y < y0) y0 = y;
				if (y > y1) y1 = y;
			}
		}
	}
	return x1 < 0 ? null : { x0, y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/**
 * The largest `max(R,G,B) - min(R,G,B)` over pixels with any meaningful alpha.
 *
 * ⛔ THIS IS THE FUNCTION UNDER TEST IN THE POSITIVE CONTROL. It is applied
 * unchanged to the shipped assets and to the synthetic chromatic fixture, which
 * is the only thing that makes "all 10 are achromatic" mean anything.
 */
function maxChroma(png: Decoded, alphaMin = 8): number {
	let worst = 0;
	for (let i = 0; i < png.data.length; i += 4) {
		if ((png.data[i + 3] ?? 0) < alphaMin) continue;
		const r = png.data[i] ?? 0;
		const g = png.data[i + 1] ?? 0;
		const b = png.data[i + 2] ?? 0;
		const chroma = Math.max(r, g, b) - Math.min(r, g, b);
		if (chroma > worst) worst = chroma;
	}
	return worst;
}

/**
 * Mean alpha over a corner patch.
 *
 * ⚠⚠ A PATCH, NEVER `px[0,0]`. BLOCK-5b's own recon measured a single source
 * file's four corners differing by up to three levels, so one pixel is not a
 * stable identity for anything. Every pixel-identity assertion in this file
 * reads a patch.
 */
function cornerAlphaMax(png: Decoded, size = 48): number {
	let worst = 0;
	const corners = [
		[0, 0],
		[png.width - size, 0],
		[0, png.height - size],
		[png.width - size, png.height - size],
	] as const;
	for (const [cx, cy] of corners) {
		for (let y = cy; y < cy + size; y++) {
			for (let x = cx; x < cx + size; x++) {
				const a = png.data[(y * png.width + x) * 4 + 3] ?? 0;
				if (a > worst) worst = a;
			}
		}
	}
	return worst;
}

describe("BLOCK-5b · G-a — the ten assets exist and carry real alpha", () => {
	it("ships exactly ten distinct glyph files", () => {
		// The inventory is DERIVED from the maps, never re-typed here: the maps
		// are the source of truth for what must ship, so a map edit that adds an
		// asset cannot leave this list behind.
		expect(ALL_GLYPH_FILES).toHaveLength(10);
		expect(new Set(ALL_GLYPH_FILES).size).toBe(10);
	});

	it.each([
		...ALL_GLYPH_FILES,
	])("%s exists, is non-empty, is 512x512 RGBA, and has fully-transparent pixels", (name) => {
		const stat = statSync(join(GLYPH_DIR, name));
		expect(stat.size).toBeGreaterThan(0);

		const png = readGlyph(name);
		expect(png.width).toBe(CANVAS);
		expect(png.height).toBe(CANVAS);
		// Colour type 6 = RGBA. Asserted rather than assumed: a greyscale
		// re-export would make the achromatic guard below vacuous (see _png.ts).
		expect(png.colourType).toBe(6);

		let fullyTransparent = 0;
		let fullyOpaque = 0;
		for (let i = 3; i < png.data.length; i += 4) {
			const a = png.data[i] ?? 0;
			if (a === 0) fullyTransparent++;
			else if (a === 255) fullyOpaque++;
		}
		// At least one fully-transparent pixel — the plate is genuinely gone.
		expect(fullyTransparent).toBeGreaterThan(0);
		// And the mark is genuinely there, not an empty canvas.
		expect(fullyOpaque).toBeGreaterThan(0);
	});

	it.each([
		...ALL_GLYPH_FILES,
	])("%s has no surviving plate — every corner patch is fully transparent", (name) => {
		// ⛔ THE ORIGINAL DEFECT, STATED AS AN ASSERTION. The sources shipped an
		// opaque plate measured at #232323-#2E2E2E against the #2A2A2A the span
		// paints. If a future re-export bakes a plate back in, the corners stop
		// being transparent and this reddens before anyone has to look at it.
		expect(cornerAlphaMax(readGlyph(name))).toBe(0);
	});
});

describe("BLOCK-5b · G-b — all ten are achromatic", () => {
	it.each([...ALL_GLYPH_FILES])("%s is achromatic (R == G == B)", (name) => {
		expect(maxChroma(readGlyph(name))).toBeLessThanOrEqual(CHROMA_TOLERANCE);
	});

	it("POSITIVE CONTROL — the same check FAILS on a synthetic chromatic fixture", () => {
		// ⛔⛔ WITHOUT THIS THE GUARD ABOVE PROVES NOTHING. Ten files that are
		// already monochrome pass an achromatic check whether or not that check can
		// see colour at all — a decoder bug, a wrong channel offset, or an alpha
		// filter that skips every pixel would all read as ten green ticks.
		//
		// ⚠ SYNTHETIC AND IN-REPO, DELIBERATELY. An earlier draft of this task
		// proposed pointing the control at a coloured file in ~/Downloads. That is
		// two defects at once: it is not the artifact under test, and a control
		// that lives outside the repository can vanish between runs and take its
		// evidence with it. This fixture is minted here, from bytes written on the
		// line above the assertion, and cannot drift.
		const size = 8;
		const rgba = new Uint8Array(size * size * 4);
		for (let i = 0; i < rgba.length; i += 4) {
			// #FBA70C — a gold measured off a Discovery-set thumbnail, used here as a
			// realistic chromatic value rather than a cartoon one. Chroma =
			// 0xFB - 0x0C = 239.
			rgba[i] = 0xfb;
			rgba[i + 1] = 0xa7;
			rgba[i + 2] = 0x0c;
			rgba[i + 3] = 255;
		}
		const control = decodePng(encodePngRgba(size, size, rgba));

		// The round trip is itself part of the control: if the codec mangled
		// channels, this would not be the colour we wrote.
		expect(control.width).toBe(size);
		expect(control.data[0]).toBe(0xfb);
		expect(control.data[1]).toBe(0xa7);
		expect(control.data[2]).toBe(0x0c);

		// THE POINT: the same function, applied to colour, reports colour — far
		// above the tolerance the ten shipped assets clear.
		expect(maxChroma(control)).toBe(239);
		expect(maxChroma(control)).toBeGreaterThan(CHROMA_TOLERANCE);
	});

	it("POSITIVE CONTROL — a synthetic ACHROMATIC fixture passes the same check", () => {
		// The other half of the control pair: proves the check is not simply
		// returning a large number for everything.
		const size = 8;
		const rgba = new Uint8Array(size * size * 4);
		for (let i = 0; i < rgba.length; i += 4) {
			rgba[i] = 0xfa;
			rgba[i + 1] = 0xfa;
			rgba[i + 2] = 0xfa;
			rgba[i + 3] = 255;
		}
		expect(maxChroma(decodePng(encodePngRgba(size, size, rgba)))).toBe(0);
	});
});

describe("BLOCK-5b · G-e — optical size is normalised to 70% by HEIGHT", () => {
	it.each([
		...ALL_GLYPH_FILES,
	])("%s has ink height 70% ± 2 of the canvas", (name) => {
		const box = inkBox(readGlyph(name));
		expect(box).not.toBeNull();
		if (box === null) return;
		const pct = (box.height / CANVAS) * 100;
		expect(pct).toBeGreaterThanOrEqual(INK_TARGET_PCT - INK_TOLERANCE);
		expect(pct).toBeLessThanOrEqual(INK_TARGET_PCT + INK_TOLERANCE);
	});

	it("normalises by HEIGHT, not width — widths are expected to VARY", () => {
		// ⚠⚠ THIS IS THE ASSERTION THAT KEEPS THE CONVENTION HONEST. Heights agree
		// to within a rounding pixel BECAUSE they were normalised; widths must NOT,
		// because a mark's width is a property of the mark. If widths ever
		// converged too, someone has started normalising by the wrong dimension (or
		// by area), which is what makes an hourglass tower over a megaphone.
		const boxes = ALL_GLYPH_FILES.map((n) => inkBox(readGlyph(n))).filter(
			(b): b is NonNullable<typeof b> => b !== null,
		);
		expect(boxes).toHaveLength(10);

		const heights = boxes.map((b) => b.height);
		expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(2);

		const widths = boxes.map((b) => b.width);
		expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(100);
	});

	it("keeps every mark inside the canvas — nothing is clipped by the square", () => {
		// §1c pads to square rather than centre-cropping, so no mark may touch an
		// edge. ⚠ RE-MEASURED AT MKT-ROSTER-1: the tight one used to be a glyph
		// belonging to a removed market (504px wide of 512); with it gone
		// `sentiment` is the widest at 476px of 512, clearing each edge by 18px.
		// Still the reason this is asserted rather than assumed — the margin got
		// bigger, not infinite.
		for (const name of ALL_GLYPH_FILES) {
			const box = inkBox(readGlyph(name));
			expect(box).not.toBeNull();
			if (box === null) continue;
			expect(box.x0).toBeGreaterThan(0);
			expect(box.y0).toBeGreaterThan(0);
			expect(box.x0 + box.width).toBeLessThan(CANVAS);
			expect(box.y0 + box.height).toBeLessThan(CANVAS);
		}
	});
});

describe("BLOCK-5b · G-c — both maps are exhaustive", () => {
	const slugs = Object.keys(
		RESOLUTION_BLOCKS,
	) as (keyof typeof RESOLUTION_BLOCKS)[];

	it("covers all six known market slugs", () => {
		expect(slugs).toHaveLength(6);
	});

	it.each(
		slugs,
	)("%s resolves all four block glyphs to a shipped file", (slug) => {
		const blocks: ResolutionBlockSet = RESOLUTION_BLOCKS[slug];
		const glyphs = getResolutionBlockGlyphs(slug, blocks.flavour.line1);
		for (const key of [
			"resolution",
			"resolver",
			"closes",
			"flavour",
		] as const) {
			const path = glyphs[key];
			expect(path.startsWith("/brand/blocks/")).toBe(true);
			const file = path.slice("/brand/blocks/".length);
			expect(ALL_GLYPH_FILES).toContain(file);
			expect(statSync(join(GLYPH_DIR, file)).size).toBeGreaterThan(0);
		}
	});

	it("gives RESOLUTION and RESOLVER the same asset on every market", () => {
		// ⚠⚠ D-50 — THE ASSERTION IS UNCHANGED AND THE REASON UNDER IT IS NOT.
		// This comment read "after BLOCK-4 their values coincide", which was a
		// claim about the TEXT and is now false: `yc-w27-acceptance` reads
		// "YC decision" against "Y Combinator". One asset still serves both,
		// because a written decision and the institution issuing it are the same
		// SOURCE even when they are not the same words.
		// One map consulted twice is what keeps them from drifting apart silently.
		for (const slug of slugs) {
			const g = getResolutionBlockGlyphs(
				slug,
				RESOLUTION_BLOCKS[slug].flavour.line1,
			);
			expect(g.resolution).toBe(g.resolver);
		}
	});

	it("gives CLOSES the same asset on every market", () => {
		const closes = slugs.map(
			(s) =>
				getResolutionBlockGlyphs(s, RESOLUTION_BLOCKS[s].flavour.line1).closes,
		);
		expect(new Set(closes).size).toBe(1);
		expect(closes[0]).toBe("/brand/blocks/closes-on.png");
	});

	it("keys FLAVOUR on the flavour STRING, so a shared flavour shares its asset", () => {
		// ⚠ The taxonomy maps 1:1 to six markets TODAY. This asserts the
		// MECHANISM rather than that coincidence: two calls with the same flavour
		// string return the same asset even for different slugs, so a seventh
		// market reusing a flavour needs no second entry anywhere.
		// ⛔ "Petition" is deliberately NEITHER market's own flavour (bitcoin is
		// Sentiment, github is Callout), so a lookup that secretly keyed off the
		// SLUG would return two different assets here and fail.
		const a = getResolutionBlockGlyphs("bitcoin-price-50k", "Petition");
		const b = getResolutionBlockGlyphs(
			"github-zugzwang-repo-stars",
			"Petition",
		);
		expect(a.flavour).toBe(b.flavour);
		expect(a.flavour).toBe("/brand/blocks/petition.png");
	});

	it("throws on an unknown slug rather than falling back to no glyph", () => {
		// ⛔ NO SILENT FALLBACK. A missing entry rendering the empty span again
		// would be indistinguishable from the pre-BLOCK-5b state, so it must be
		// loud. `ResolverCards` catches this, captures once, and degrades one row.
		expect(() =>
			getResolutionBlockGlyphs("not-one-of-the-six", "Petition"),
		).toThrow(/no resolution-block glyph/);
	});

	it("YCP-01 took petition.png and must NOT fall back to the X wordmark", () => {
		// ⛔⛔ D-50 — this market is no longer settled on X, so `response-on-x.png`
		// would now point at the wrong instrument entirely. The asset is REUSED
		// rather than minted (no new image was in scope), and `petition.png` is a
		// signed document — very nearly a picture of "YC's written decision to the
		// applicant". Pinned because the cheapest regression is a map entry copied
		// forward from before the ruling.
		const g = getResolutionBlockGlyphs("yc-w27-acceptance", "Showcase");
		expect(g.resolution).toBe("/brand/blocks/petition.png");
		expect(g.resolver).toBe("/brand/blocks/petition.png");
		expect(g.resolution).not.toBe("/brand/blocks/response-on-x.png");
		// ⚠⚠ THREE DISTINCT ASSETS ACROSS FOUR BLOCKS IS THE CEILING FOR EVERY
		// MARKET, NOT A PROPERTY OF THIS ONE — RESOLUTION and RESOLVER are one
		// map consulted twice, so they always share. An earlier draft of this
		// guard asserted FOUR and went red on its first run; four is unreachable
		// by construction and the assertion was the thing that was wrong.
		// ⛔ THE ARGUMENT AGAINST `showcase.png` SURVIVES THE CORRECTED NUMBER,
		// which is the only reason it is worth stating: this market's own FLAVOUR
		// is Showcase, so taking `showcase.png` for the source too would collapse
		// the set to TWO and paint three of the four blocks with one mark.
		// `petition.png` holds it at the three-asset ceiling.
		expect(new Set(Object.values(g)).size).toBe(3);
		// And the ceiling is the general rule, asserted so the claim above is not
		// just a comment: no market reaches four.
		for (const slug of slugs) {
			const all = getResolutionBlockGlyphs(
				slug,
				RESOLUTION_BLOCKS[slug].flavour.line1,
			);
			expect(all.resolution).toBe(all.resolver);
			expect(new Set(Object.values(all)).size).toBeLessThanOrEqual(3);
		}
	});

	it("response-on-x.png now serves THREE markets, not four", () => {
		// ⛔ D-50 — the count is asserted rather than described, because the glyph
		// file's docblock states it in prose and prose goes stale silently. YCP
		// left this set; CHE, MAT and CLA remain.
		const onX = slugs.filter(
			(slug) =>
				getResolutionBlockGlyphs(slug, RESOLUTION_BLOCKS[slug].flavour.line1)
					.resolution === "/brand/blocks/response-on-x.png",
		);
		expect(onX.sort()).toEqual([
			"chess-fide-tiebreak-response",
			"claude-bundle-response",
			"math-erdos-solved-on-zugzwang",
		]);
	});

	it("every flavour string in the data file has a glyph", () => {
		// Cross-check from the OTHER direction: the data file is the source of the
		// flavour strings, so this catches a flavour added there and forgotten
		// here. (`tsc` already catches it via `Record<FlavourName, string>`; this
		// is the runtime restatement, and it is the one that names the value.)
		for (const slug of slugs) {
			const flavour = RESOLUTION_BLOCKS[slug].flavour.line1;
			expect(() => getResolutionBlockGlyphs(slug, flavour)).not.toThrow();
		}
	});
});

describe("BLOCK-5b · G-g — BLOCK-4's geometry must not move", () => {
	// ⚠ SOURCE SCANS, because jsdom performs no layout — the same reason
	// `tests/unit/design/*-height-chain.test.ts` are source scans. The rendered
	// numbers (block 54.00px, both headzone gaps 20px) are measured in a real
	// browser at BLOCK-5b's close; these pin the classes that produce them so an
	// edit reddens here first.
	const resolverCards = readFileSync(
		join(ROOT, "src/components/debate/ResolverCards.tsx"),
		"utf8",
	);
	const marketHeader = readFileSync(
		join(ROOT, "src/components/debate/MarketHeader.tsx"),
		"utf8",
	);
	const headZone = readFileSync(
		join(ROOT, "src/components/debate/HeadZone.tsx"),
		"utf8",
	);

	it("keeps the row's 54px floor and four-column grid", () => {
		expect(resolverCards).toContain(
			'className="grid min-h-[54px] grid-cols-4 gap-2"',
		);
	});

	it("keeps the glyph span at 36px, square, hidden below sm", () => {
		// G-h lives here too: `hidden ... sm:block` is what keeps the glyph off
		// mobile, and the image inside a display:none parent is never laid out.
		expect(resolverCards).toContain("hidden aspect-square w-[36px] shrink-0");
		expect(resolverCards).toContain("sm:block");
	});

	it("keeps BOTH headzone gaps at gap-5 (20px)", () => {
		expect(marketHeader).toContain(
			'className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto"',
		);
		// ⚠ READ OFF THE NAMED CONSTANT SINCE UI-OVERNIGHT entry 3. The band is no
		// longer one literal on the element: the post arm is content-sized
		// (`BAND_CONTENT_SIZED`) because a fixed fraction was clipping its reply
		// bar, so the class string moved to a pair of consts and the element takes
		// whichever applies. ⛔ BOTH ARE CHECKED — `gap-5` is BLOCK-4 geometry and
		// must survive on either arm, and asserting only the one that still carries
		// `basis-` would leave the new band free to drop it.
		// ⛔ WHOLE-STRING EQUALITY, WITH MOBILE-1's TWO TOKENS APPENDED — AND
		// THAT MATTERS MORE THAN IT LOOKS. This assertion was briefly loosened to
		// token containment when MOBILE-1 Phase A appended `max-mobile:basis-auto
		// max-mobile:overflow-visible`, under a describe block titled "BLOCK-4's
		// geometry must not move." Class ORDER is immaterial to the cascade, so
		// nothing was lost there; what was lost is every ADDITIONAL token. Under
		// containment a later `lg:basis-full`, a second `overflow-*`, a stray
		// height or a `!` override all pass — and each of those does move the
		// geometry this block exists to pin.
		//
		// The equality-preserving answer was already in the same PR:
		// `tests/unit/shell/page-container.test.ts`'s `now` string met identical
		// pressure on an identical equality pin and kept equality by appending
		// the two new tokens with a comment saying why. And `:433` below kept its
		// whole-string match on the post arm, reasoning that a guard not under
		// pressure should not be loosened alongside one that is — which concedes
		// the loosening here was pressure, not judgement.
		//
		// ⚠ SO THE MAINTENANCE COST IS REAL AND IS THE POINT: a future additive
		// change reddens this line and must be re-approved here. That is the
		// guard working. "BLOCK-4's geometry must not move" is a claim about the
		// WHOLE string; asserting a subset of it asserts something else.
		const declared = /const BAND_DECLARED =\s*"([^"]*)"/.exec(headZone);
		if (!declared) {
			throw new Error(
				"HeadZone.tsx: BAND_DECLARED is not a single string literal any more.",
			);
		}
		expect(
			declared[1],
			"HeadZone.tsx: BAND_DECLARED changed. This is BLOCK-4 geometry pinned " +
				"by whole-string equality — if the change is genuinely additive and " +
				"inert at >=640px, append the new token here and say why, exactly as " +
				"MOBILE-1's two `max-mobile:` tokens once were. Do not " +
				"relax this to token containment: that admits every additional " +
				"token, including the ones that do move the geometry.",
		).toBe(
			// ⚠ RE-PINNED AT THE HEADER-FIT CHANGE, NOT LOOSENED. The band lost
			// `basis-[24.2dvh]`, its `overflow-*` and MOBILE-1's two `max-mobile:`
			// releases together, because a content-sized band has nothing to clip
			// and nothing to release (`HeadZone.tsx`). `gap-5` — the BLOCK-4
			// geometry this test exists for — is unchanged, and this is still a
			// whole-string match.
			"flex min-h-0 shrink-0 flex-col gap-5 lg:flex-row",
		);
		// ⛔ UNCHANGED AND DELIBERATELY STILL A WHOLE-STRING MATCH. MOBILE-1 did
		// not touch the post arm — it declares neither `basis-` nor
		// `overflow-hidden`, so the mobile release would be inert on it — and a
		// guard that is not under pressure should not be loosened alongside one
		// that is.
		expect(headZone).toContain(
			'"flex min-h-0 shrink-0 flex-col gap-5 lg:flex-row lg:items-start"',
		);
	});

	it("G-f — clips the image to the span's radius via overflow-hidden", () => {
		// ⚠ THE CLIP IS ON THE SPAN, NOT THE IMAGE. The span is border-box with a
		// 1px hairline and a 6px radius, so its padding box has a 5px inner radius;
		// a matching `rounded-` on the child would need `calc(6px - 1px)` and would
		// disagree again the moment the border or `--imgr` moves. Verified against
		// the paint at close, not only here.
		expect(resolverCards).toContain(
			"overflow-hidden rounded-[var(--imgr)] bg-n1 [border:var(--hairline)]",
		);
	});

	it("keeps bg-n1 on the span, which the transparent asset composites onto", () => {
		// ⛔ `bg-n1` IS LOAD-BEARING NOW. The asset carries no plate of its own, so
		// removing this renders the mark on whatever sits behind the block.
		expect(resolverCards).toMatch(/rounded-\[var\(--imgr\)\] bg-n1/);
	});
});
