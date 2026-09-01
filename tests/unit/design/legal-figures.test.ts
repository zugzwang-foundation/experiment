import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { LegalFigure } from "@/components/legal/LegalFigure";
import { splitLegalSections } from "@/lib/legal-sections";

/**
 * LEGAL-REAL — the `/legal` margin figures and the lossless section split.
 *
 * ⚠ AMENDED AT LEGAL-FIGURES-2. The figures were redrawn into the house
 * infographic language (`src/components/onboarding/figures.tsx`): filled mass,
 * near-ink contrast, type set inside the drawing, sized to the measured gutter.
 * Two rows below carried the *previous* task's mistaken constraints — one
 * asserted `exactly one fill=`, the other a wrapper-level `text-n2` — and both
 * are REWRITTEN in place rather than deleted, each with a note saying what it
 * used to hold and why that was wrong. A guard that encodes a wrong decision is
 * harder to dislodge than a comment, and deleting it quietly would leave the
 * next author with no record that the constraint was ever considered.
 *
 * ⛔ EVERY ASSERTION ABOUT DOCUMENT SHAPE READS `public/legal/*.txt` OFF DISK.
 * Not a fixture, not a snippet, not a count typed into this file. The real
 * documents landed here replacing placeholders, and they will be replaced again
 * when a revision is signed off — a suite pinned to a transcription would go
 * green against text the product no longer serves, which is the exact failure
 * the version-hash column exists to make impossible elsewhere. The one number
 * that IS hardcoded is the section count, because the founder specified it
 * (Terms 12, Privacy 5) and a silently vanishing section should be a red test
 * rather than a quietly shorter page.
 *
 * The figure assertions are element-level: the page is an async server
 * component, so it is called and its returned tree walked by component
 * reference — the same law `tests/server/auth/onboarding-page-wiring.test.ts`
 * follows. No jsdom, no DOM render.
 */

const ROOT = process.cwd();
const read = (name: "tos" | "privacy") =>
	readFileSync(join(ROOT, "public", "legal", `${name}.txt`), "utf-8");

type WalkedElement = ReactElement<Record<string, unknown>>;

function isElement(node: unknown): node is WalkedElement {
	return (
		typeof node === "object" &&
		node !== null &&
		"type" in node &&
		"props" in node
	);
}

function collectElements(root: unknown): WalkedElement[] {
	const out: WalkedElement[] = [];
	const visit = (node: unknown): void => {
		if (Array.isArray(node)) {
			for (const child of node) visit(child);
			return;
		}
		if (!isElement(node)) return;
		out.push(node);
		visit(node.props.children);
	};
	visit(root);
	return out;
}

function textOf(node: unknown): string {
	if (typeof node === "string") return node;
	if (typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(textOf).join("");
	if (isElement(node)) return textOf(node.props.children);
	return "";
}

describe("legal sections — the split is lossless", () => {
	it.each([
		"tos",
		"privacy",
	] as const)("legal-sections::%s-round-trips-byte-for-byte", (name) => {
		const source = read(name);
		// THE CONTRACT. Rejoining the chunks reproduces the file exactly — no
		// trimmed blank line, no normalised whitespace, no dropped trailer.
		expect(splitLegalSections(source).join("\n")).toBe(source);
	});

	it("legal-sections::section-counts-match-the-specified-documents", () => {
		// Chunk 0 is the preamble, so a 12-section document yields 13 chunks.
		expect(splitLegalSections(read("tos"))).toHaveLength(13);
		expect(splitLegalSections(read("privacy"))).toHaveLength(6);
	});

	it("legal-sections::every-section-chunk-opens-on-its-own-number", () => {
		for (const name of ["tos", "privacy"] as const) {
			const chunks = splitLegalSections(read(name)).slice(1);
			chunks.forEach((chunk, i) => {
				expect(chunk.startsWith(`${i + 1}. `), `${name} section ${i + 1}`).toBe(
					true,
				);
			});
		}
	});

	it("legal-sections::a-document-with-no-headings-is-returned-whole", () => {
		// The degenerate branch, exercised rather than assumed — a future document
		// that does not number its sections must still render, not vanish.
		expect(splitLegalSections("no headings here\n\nsecond para")).toEqual([
			"no headings here\n\nsecond para",
		]);
	});
});

describe("legal figures — one per section, in the margin, decorative", () => {
	it("legal-figures::one-figure-per-numbered-section-sides-alternating", async () => {
		const { default: LegalPage } = await import("@/app/(public)/legal/page");
		const figures = collectElements(await LegalPage()).filter(
			(e) => e.type === LegalFigure,
		);

		// 12 + 5. Derived from the files on disk, so a document losing a section
		// fails here as well as in the count row above.
		const expected =
			splitLegalSections(read("tos")).length -
			1 +
			(splitLegalSections(read("privacy")).length - 1);
		expect(figures).toHaveLength(expected);
		expect(figures).toHaveLength(17);

		// Alternating down the PAGE — Privacy §1 continues from Terms §12 rather
		// than restarting, so the seam does not stutter.
		expect(figures.map((f) => f.props.side)).toEqual(
			Array.from({ length: 17 }, (_, i) => (i % 2 === 0 ? "left" : "right")),
		);

		// The envelope is placed twice and drawn once — the registry earning its
		// keep, and the reason this page has one component instead of seventeen
		// inline SVG blocks.
		const names = figures.map((f) => f.props.name);
		expect(names.filter((n) => n === "envelope-open")).toHaveLength(2);
		expect(new Set(names).size).toBe(16);
	});

	it("legal-figures::the-page-renders-both-documents-whole-and-in-order", async () => {
		const { default: LegalPage } = await import("@/app/(public)/legal/page");
		const rendered = textOf(await LegalPage());

		// ⚠ ASSERTED CHUNK BY CHUNK, NOT AS ONE STRING, and the reason is a real
		// property of the markup rather than a convenience. Each section renders
		// in its own `<pre>`, and the newline that separated two sections in the
		// file is supplied by the BLOCK BOUNDARY between those elements — it is
		// not a character in either one. So the concatenated text is the file
		// less one `\n` per seam. Re-inserting that character would render a
		// second line break on top of the boundary's and double every gap.
		//
		// What must hold is that every chunk is present VERBATIM and in ORDER,
		// which is what this asserts. Losslessness of the split itself is the
		// round-trip row above; together they cover the whole document.
		for (const name of ["tos", "privacy"] as const) {
			let cursor = -1;
			for (const [i, chunk] of splitLegalSections(read(name)).entries()) {
				const at = rendered.indexOf(chunk);
				expect(
					at,
					`${name} chunk ${i} missing from the render`,
				).toBeGreaterThan(-1);
				expect(at, `${name} chunk ${i} out of order`).toBeGreaterThan(cursor);
				cursor = at;
			}
		}
	});

	it("legal-figures::every-placement-is-decorative-and-margin-bound", () => {
		const el = LegalFigure({ name: "envelope-open", side: "left" });
		const props = (el as WalkedElement).props;
		const cls = String(props.className ?? "");

		// Decoration, marked three ways: out of the a11y tree, out of the pointer
		// path, and out of the text column by the box model rather than by a
		// hand-tuned offset.
		expect(props["aria-hidden"]).toBe("true");
		expect(cls).toContain("pointer-events-none");
		expect(cls).toContain("absolute");
		expect(cls).toMatch(/right-full|left-full/);

		// Not below `md` — there is no margin at 320 or 390, and that width
		// already carries a horizontal-overflow defect this page must not feed.
		expect(cls).toContain("hidden");
		expect(cls).toContain("md:block");

		// ⚠ THE `text-n2` ASSERTION THAT SAT HERE IS GONE, at LEGAL-FIGURES-2. It
		// pinned a wrapper-level `currentColor` at low contrast; the house
		// language sets colour PER ELEMENT and near ink, so there is no single
		// class left to assert and the token guard moved to the row below, which
		// checks every fill and stroke value in the file.
		//
		// What replaces it here is the SIZE step, which is the wrapper's own
		// business: the figures are sized to the measured gutter (143/271/399px
		// at md/lg/xl) and step with it.
		const svgCls = String(
			((el as WalkedElement).props.children as WalkedElement)?.props
				?.className ?? "",
		);
		expect(svgCls).toContain("w-[110px]");
		expect(svgCls).toContain("lg:w-[200px]");
		expect(svgCls).toContain("xl:w-[290px]");
		// `font-sans` on the svg, not on each `<text>` — the house convention,
		// because `font-family` inherits through SVG.
		expect(svgCls).toContain("font-sans");

		// The opposite side is the mirror, so one class list cannot drift.
		const right = LegalFigure({ name: "envelope-open", side: "right" });
		expect(String((right as WalkedElement).props.className)).toContain(
			"left-full",
		);
	});

	it("legal-figures::every-colour-is-a-neutral-ramp-token", () => {
		// ⚠ REWRITTEN AT LEGAL-FIGURES-2, and the reason is worth keeping. This
		// row used to assert `exactly one fill=`, pinning the figures as
		// fill-less line art. That was never a requirement of this product — the
		// house infographic language in `src/components/onboarding/figures.tsx`
		// is built on FILLED mass, and the assertion had quietly promoted one
		// task's mistake into a guard that would have blocked the correction.
		// A test can hold a wrong decision in place more effectively than a
		// comment ever could, which is why it is rewritten here rather than
		// deleted: what it should have been guarding all along is that colour
		// arrives through the token layer, and that is what it guards now.
		const source = readFileSync(
			join(ROOT, "src/components/legal/LegalFigure.tsx"),
			"utf-8",
		);

		// ⚠ COMMENTS STRIPPED FIRST, exactly as `no-raw-hex-view-layer.test.ts`
		// does it. That file's docblock explains why: prose citing a contract
		// value is documentation, not a smuggled colour, and a scan that cannot
		// tell them apart pushes authors toward comments that omit the number
		// they are explaining.
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");

		// No literal colour, in any notation.
		expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
		expect(code).not.toMatch(/\brgba?\(/);
		expect(code).not.toMatch(/\bhsla?\(/);
		expect(code).not.toMatch(/\boklch\(/);

		// Every `fill=` / `stroke=` value is a design token or the literal
		// `none`. Fills are now REQUIRED rather than forbidden, so this counts
		// what they resolve to instead of how many there are.
		const values = [...code.matchAll(/(?:fill|stroke)="([^"]*)"/g)].map(
			(m) => m[1],
		);
		expect(values.length).toBeGreaterThan(20);
		for (const v of values) {
			expect(v, `non-token colour "${v}"`).toMatch(
				/^(none|var\(--color-(?:ink|ground|n[0-7])\))$/,
			);
		}
		// Filled mass is the house language — assert it is actually used, so
		// this file cannot drift back to outlines while still passing.
		expect(
			values.filter((v) => v === "var(--color-ink)").length,
		).toBeGreaterThan(8);

		// ⛔ THE POLE TOKENS ARE ABSENT, DELIBERATELY. `--color-yes` / `--color-no`
		// encode BET SIDE (INV-3) and mean nothing in a legal figure. The one
		// figure that could have used them — `paths-converging`, a market
		// resolving — does not, because `--color-yes` is #181818, exactly
		// `--color-ground`, so a YES panel filled with it would be invisible on
		// this page; the deck's own `SideFigure` hits that wall and renders YES
		// as filled ink. Moving this assertion is a decision, not an edit.
		expect(code).not.toContain("--color-yes");
		expect(code).not.toContain("--color-no");
		expect(code).not.toContain("--color-brand");
	});
});
