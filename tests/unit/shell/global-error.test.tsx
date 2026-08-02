// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * T2 (SHELL-COMPLETE §7) — the B10 `global-error` boundary.
 *
 * `global-error` REPLACES the root layout, so it inherits nothing and must
 * supply its own `<html>`/`<body>` and its own fonts. Risk 2 in the plan is the
 * silent one: `globals.css:154` reads `--font-sans: var(--font-geist-sans)` and
 * `--font-geist-sans` is defined nowhere in CSS — it is injected at runtime by
 * `geistSans.variable` on `<html>`. Drop that className and the page renders
 * correctly COLOURED but in Times New Roman. This test pins both variables onto
 * `<html>`.
 *
 * `next/font/google` is a build-time transform with no Node runtime, so it is
 * mocked to return identifiable variable names. That is exactly the surface
 * under test: the assertion is that the component APPLIES both fonts'
 * `.variable` to `<html>`, which is the regression risk 2 describes.
 *
 * Rendered with `renderToStaticMarkup` rather than Testing Library because the
 * component's root IS `<html>`; rendering that into a container `<div>` trips
 * React's DOM-nesting validation and tells us nothing extra.
 */

vi.mock("next/font/google", () => ({
	Geist: () => ({ variable: "--font-geist-sans" }),
	Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("T2 — global-error boundary", () => {
	it("renders-own-html-and-body-with-both-font-variables", async () => {
		const { default: GlobalError } = await import("@/app/global-error");

		const html = renderToStaticMarkup(
			<GlobalError error={new Error("boom")} reset={() => {}} />,
		);

		// Own document shell — it replaces the root layout.
		expect(html).toContain("<html");
		expect(html).toContain("<body");

		// The font trap (risk 2): BOTH variables on <html>, not just one.
		const htmlTag = html.slice(0, html.indexOf(">") + 1);
		expect(htmlTag).toContain("--font-geist-sans");
		expect(htmlTag).toContain("--font-geist-mono");

		// The §5 copy + the reset affordance.
		expect(html).toContain("Something broke.");
		expect(html).toContain(
			"An unexpected error stopped the page from loading.",
		);
		expect(html).toContain("Try again");
	});

	it("imports-nothing-server-bound", () => {
		const source = read("src/app/global-error.tsx");

		// The boundary of last resort: anything it imports that can fail defeats
		// it. No server modules, no db, no providers.
		expect(source).not.toMatch(/from\s+["']@\/server\//);
		expect(source).not.toMatch(/from\s+["']@\/db/);
		expect(source).not.toMatch(/["']server-only["']/);

		// The explicit stylesheet import (plan Q3) — one line that makes the
		// "does Next serve the root layout's CSS chunk here" question moot.
		expect(source).toContain('import "./globals.css"');

		// Next requires a Client Component here.
		expect(source).toContain('"use client"');
	});
});
