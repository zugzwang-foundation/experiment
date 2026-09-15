import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { FIELD_ASSET_HREF } from "@/components/art/warli/field-asset";
import {
	buildFieldSvg,
	FIELD_ASSET_DIR,
	FIELD_ASSET_MODULE,
	fieldAssetHref,
	fieldAssetModule,
} from "../../../scripts/warli-field-svg";

/**
 * WARLI-FIELD-ASSET — the committed field file is the component, byte for byte,
 * and its URL is the hash of its content.
 *
 * ⚠ THIS IS THE ONLY THING STOPPING A STALE PICTURE, AND NOW ALSO A STALE CACHE.
 * The hero no longer renders `<FieldLayer />`; it loads the file, which
 * `next.config.ts` serves `immutable` for a year. Every other art test renders
 * the component, so an edit to the field would go green everywhere else, ship
 * the old drawing, and — if the URL did not move — keep serving it from every
 * browser that ever cached it. If this reddens, run `pnpm art:field` and commit
 * all three outputs. Never hand-edit the file, its name, or `field-asset.ts`.
 */

const ROOT = process.cwd();
const fieldFiles = () =>
	readdirSync(join(ROOT, FIELD_ASSET_DIR)).filter((name) =>
		name.startsWith("warli-field"),
	);

describe("warli field asset", () => {
	it("publishes exactly one field file, and it is the one the hero points at", () => {
		// A stale hash left beside the live one would still be served — immutable,
		// forever — to anything holding its URL.
		expect(fieldFiles()).toEqual([FIELD_ASSET_HREF.replace("/art/", "")]);
		expect(FIELD_ASSET_HREF).toMatch(/^\/art\/warli-field\.[0-9a-f]{10}\.svg$/);
	});

	it("reads a real drawing with the page's two tokens resolved (positive control)", () => {
		// A parity check between two empty strings passes. Prove the file holds
		// the field, and that the colours came from globals.css rather than from
		// nowhere.
		const svg = readFileSync(join(ROOT, "public", FIELD_ASSET_HREF), "utf8");
		const css = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
		const ink = css.match(/--color-ink:\s*(#[0-9a-f]{6})\s*;/i)?.[1];
		const ground = css.match(/--color-ground:\s*(#[0-9a-f]{6})\s*;/i)?.[1];
		expect(ink).toBeDefined();
		expect(ground).toBeDefined();
		expect(svg).toContain("data-warli-field-layer");
		expect(svg).toContain("data-warli-motif");
		expect(svg).toContain(`svg{color:${ink}}`);
		expect(svg).toContain(`.warli-reserve{color:${ground}}`);
		expect(svg.length).toBeGreaterThan(100_000);
	});

	it("equals what the component renders today, under the hash of that content — regenerate with `pnpm art:field`", () => {
		// Compared by equality rather than `toBe` on the strings: a 680 KB diff in
		// the failure output helps nobody, and the remedy is the same either way.
		const svg = buildFieldSvg(ROOT);
		const href = fieldAssetHref(svg);
		expect(
			FIELD_ASSET_HREF,
			"field-asset.ts is stale — run `pnpm art:field`",
		).toBe(href);
		const committed = readFileSync(join(ROOT, "public", href), "utf8");
		expect(
			committed === svg,
			"the field SVG is stale — run `pnpm art:field`",
		).toBe(true);
		expect(readFileSync(join(ROOT, FIELD_ASSET_MODULE), "utf8")).toBe(
			fieldAssetModule(href),
		);
	});

	it("is the only thing next.config.ts caches immutably, by the hashed shape", () => {
		// The cache rule is what turns the hash into a saving; without it the file
		// is served `max-age=0` and revalidated on every visit. The header value is
		// checked by a real request at verification — this pins that the rule
		// exists and that its pattern accepts the live name and rejects an
		// unhashed one.
		const config = readFileSync(join(ROOT, "next.config.ts"), "utf8");
		expect(config).toContain(
			'source: "/art/:file(warli-field\\\\.[0-9a-f]{10}\\\\.svg)"',
		);
		expect(config).toContain("public, max-age=31536000, immutable");
		const shape = /^warli-field\.[0-9a-f]{10}\.svg$/;
		expect(FIELD_ASSET_HREF.replace("/art/", "")).toMatch(shape);
		expect("warli-field.svg").not.toMatch(shape);
	});
});
