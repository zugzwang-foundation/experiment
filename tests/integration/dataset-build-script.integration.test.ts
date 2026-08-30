import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

/**
 * DATASET.2 — **the release entry point actually runs.**
 *
 * ## Why this file exists
 *
 * `scripts/build-dataset.ts` is the single code path that produces the
 * 2026-11-06 artifact, and until now **nothing executed it** — not CI, not the
 * `justfile`, not a test. `@security-auditor` H-1 found it broken on this
 * branch: the RFC 8785 fix imported `canonicalize@3.0.0`, whose `"exports"`
 * map has `"import"` and `"types"` conditions and **no `"require"`**, so
 * `tsx` — which loads this repo as CommonJS, there being no
 * `"type": "module"` — died at module resolution:
 *
 * ```
 * Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in
 *   node_modules/canonicalize/package.json
 * ```
 *
 * ⚠ **Every other gate was green while that was true**, and each for its own
 * reason: `tsc --noEmit` resolves the `"types"` condition, which exists; biome
 * does not resolve modules at all; and the whole vitest suite passes because
 * **Vite resolves the `"import"` condition**. So the four checks that guard
 * this repository agreed unanimously about a script none of them ran.
 *
 * That is the general shape worth naming: **a runtime nothing exercises is not
 * covered by tests that run under a different one.** The dependency is now
 * hand-rolled (`csv.ts` → `canonicalJson`) so there is nothing left to
 * mis-resolve — but the dependency was the instance, and this test is the
 * class.
 *
 * ## What it asserts
 *
 * The script is spawned exactly as an operator would spawn it, through the
 * package script, in a child process with its own module resolution. Anything
 * weaker — importing `buildDataset` and calling it — runs under Vitest's
 * resolver and reproduces precisely the blind spot this exists to close.
 */

const outDirs: string[] = [];

afterAll(() => {
	for (const d of outDirs) rmSync(d, { recursive: true, force: true });
});

describe("release entry point · `pnpm dataset:build:fixture`", () => {
	it("runs to completion in a real child process and writes the archive", () => {
		const out = mkdtempSync(join(tmpdir(), "ds2-build-"));
		outDirs.push(out);

		// ⚠ `execFileSync` THROWS on a non-zero exit, so the assertion is the
		// call itself. Capturing the code and checking it separately is the
		// project's own `; echo $?` trap — the trailing command owns the exit.
		const stdout = execFileSync(
			"pnpm",
			["dataset:build:fixture", `--out=${out}`],
			{ cwd: process.cwd(), encoding: "utf8", timeout: 120_000 },
		);

		// ⚠ Assert on the MANIFEST the script prints, not on its progress log.
		// My first version looked for `"wrote 16 CSVs + tarball + manifest"`
		// and failed: that line goes to **stderr**, while stdout carries the
		// manifest JSON. Keying a test on which stream a log line happens to
		// use makes it brittle against a change that alters nothing anyone
		// cares about — the artifact is the claim.
		expect(stdout).toContain('"license": "CC-BY-4.0"');

		// The files exist, not merely a happy log line.
		const files = readdirSync(out);
		expect(files).toContain("manifest.json");
		expect(files).toContain("users.csv");
		expect(files.filter((f) => f.endsWith(".csv")).length).toBe(16);

		const manifest = JSON.parse(
			readFileSync(join(out, "manifest.json"), "utf8"),
		) as {
			license: string;
			tables: { name: string; row_count: number }[];
			content_sha256: string;
		};
		expect(manifest.license).toBe("CC-BY-4.0");
		expect(manifest.tables.length).toBe(16);
		expect(manifest.content_sha256).toMatch(/^[0-9a-f]{64}$/);
	}, 180_000);

	it("is DETERMINISTIC — two runs produce the same content hash", () => {
		// The manifest publishes `content_sha256` and §19.1 permits rebuilding a
		// v2 "against the same source state", so a build that is not
		// reproducible cannot honour its own contract.
		//
		// ⚠ **This does NOT catch canonical JSON regressing to
		// `JSON.stringify`, and my first version of this comment claimed it
		// did** (`@security-auditor` F-11 M-2). Both runs read the same JS
		// fixture literal in the same order, so ANY deterministic serializer —
		// canonical, `JSON.stringify`, or a stub returning `""` — yields
		// identical bytes. What this can catch is nondeterminism WITHIN one
		// serializer, which is a different and narrower claim.
		//
		// The key-order property is genuinely held in two other places, and
		// the comment now points at them rather than overclaiming here:
		//   · `dataset-roundtrip.integration.test.ts` compares fixture-built
		//     bytes against DB-built bytes, and Postgres really does reorder
		//     jsonb keys — so a `JSON.stringify` regression goes red there;
		//   · `tests/unit/export/dataset/canonical-json.test.ts` pins the
		//     ordering directly, against literals.
		//
		// Writing "this would notice X" when it would not is the exact class
		// commit `676710c` was minted for, reintroduced in the commit set that
		// fixed it.
		const a = mkdtempSync(join(tmpdir(), "ds2-build-a-"));
		const b = mkdtempSync(join(tmpdir(), "ds2-build-b-"));
		outDirs.push(a, b);

		for (const dir of [a, b]) {
			execFileSync("pnpm", ["dataset:build:fixture", `--out=${dir}`], {
				cwd: process.cwd(),
				encoding: "utf8",
				timeout: 120_000,
			});
		}

		const hash = (dir: string) =>
			(
				JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as {
					content_sha256: string;
				}
			).content_sha256;

		expect(hash(a)).toBe(hash(b));
	}, 240_000);
});
