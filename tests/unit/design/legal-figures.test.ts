import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { LegalFigure } from "@/components/legal/LegalFigure";
import { splitLegalSections } from "@/lib/legal-sections";

/**
 * LEGAL-REAL — the `/legal` margin figures and the lossless section split.
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

		// Low contrast, through the token layer. `text-n2` is #404040 against the
		// page's #181818 ground — two steps up from the ground, four below the
		// body's `text-n6`.
		expect(cls).toContain("text-n2");

		// The opposite side is the mirror, so one class list cannot drift.
		const right = LegalFigure({ name: "envelope-open", side: "right" });
		expect(String((right as WalkedElement).props.className)).toContain(
			"left-full",
		);
	});

	it("legal-figures::line-art-only-no-fills-no-literal-colour", () => {
		// Read as SOURCE, because a fill could arrive on any one of seventeen
		// registry entries and the element walk above only reaches the wrapper.
		const source = readFileSync(
			join(ROOT, "src/components/legal/LegalFigure.tsx"),
			"utf-8",
		);
		// `fill="none"` on the svg is the only fill declaration permitted.
		expect(source.match(/fill=/g) ?? []).toHaveLength(1);
		expect(source).toContain('fill="none"');
		// Colour arrives as `currentColor`, never as a literal. (The repo-wide
		// hex scan covers this file too — this row states the intent locally.)
		expect(source).toContain('stroke="currentColor"');
		// ⚠ COMMENTS STRIPPED FIRST, exactly as `no-raw-hex-view-layer.test.ts`
		// does it. That file's docblock explains why: prose citing a contract
		// value ("`text-n2` is #404040 against #181818") is documentation, not a
		// smuggled colour, and a scan that cannot tell them apart pushes authors
		// toward comments that omit the number they are explaining.
		const code = source
			.replace(/\/\*[\s\S]*?\*\//g, "")
			.replace(/^\s*\/\/.*$/gm, "");
		expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
	});
});
