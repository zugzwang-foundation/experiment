import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The faces the export renders with — Geist 400 / 500 / 700 and Geist Mono
 * 400, the same families `src/app/layout.tsx` loads through `next/font/google`.
 * Vendored as static TTF instances (SIL OFL 1.1, `fonts/OFL.txt`) because
 * Satori reads TrueType/OpenType only — the woff2 `next/font` self-hosts is
 * not a format it can parse — and because a request-time fetch from Google
 * Fonts would make a deterministic export depend on a third party being up.
 *
 * Read with `fs` from `process.cwd()` and traced into the route's bundle via
 * `outputFileTracingIncludes` in `next.config.ts` (the `/api/health` and
 * `/m/[slug]/export` pattern). Memoised: the files never change at runtime.
 */
export type ExportFont = {
	name: "Geist" | "Geist Mono";
	weight: 400 | 500 | 700;
	style: "normal";
	data: ArrayBuffer;
};

const FONT_FILES: ReadonlyArray<{
	file: string;
	name: ExportFont["name"];
	weight: ExportFont["weight"];
}> = [
	{ file: "Geist-Regular.ttf", name: "Geist", weight: 400 },
	{ file: "Geist-Medium.ttf", name: "Geist", weight: 500 },
	{ file: "Geist-Bold.ttf", name: "Geist", weight: 700 },
	{ file: "GeistMono-Regular.ttf", name: "Geist Mono", weight: 400 },
];

const FONTS_DIR = join(
	process.cwd(),
	"src",
	"server",
	"debate-export",
	"image",
	"fonts",
);

let cached: Promise<ExportFont[]> | null = null;

export function loadExportFonts(): Promise<ExportFont[]> {
	if (cached === null) {
		cached = Promise.all(
			FONT_FILES.map(async ({ file, name, weight }) => {
				const buf = await readFile(join(FONTS_DIR, file));
				const data = buf.buffer.slice(
					buf.byteOffset,
					buf.byteOffset + buf.byteLength,
				);
				return { name, weight, style: "normal" as const, data };
			}),
		).catch((e) => {
			cached = null;
			throw e;
		});
	}
	return cached;
}
