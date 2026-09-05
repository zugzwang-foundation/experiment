import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import {
	CACHE_BOUNDARY_CEILINGS,
	CACHE_BOUNDARY_DIRECTIVE_COUNT,
	RENDER_TTL_SECONDS,
	SHIPPED_HOLD_BUDGET,
} from "@/server/storage/read-url-memo";

/**
 * R2-MEMO · cache-boundary parity — every `"use cache"` has a declared ceiling.
 *
 * WHY THIS IS A SOURCE SCAN AND NOT A BEHAVIOURAL TEST. `"use cache"` only
 * caches inside the Next runtime, and `cacheLife()` throws outright under a
 * bare `vitest run` ("only available with the `cacheComponents` config"). No
 * test in this repo can put a value through a real cached boundary and observe
 * what comes back; `cached-view-contract.test.ts` reached the same wall and
 * says so in its own header. Static is the only option, so the job here is to
 * make static say something worth knowing.
 *
 * WHAT IT IS FOR. C-1 shipped green because a URL's lifetime and the cache that
 * outlives it were related by nothing a test could read. `holdWindowMs` knew
 * about `ttl`; it could not know that its caller sat inside a boundary serving
 * for another hour. This file is the missing edge: it asserts that the set of
 * cache boundaries ON DISK is exactly the set with a declared ceiling in
 * `CACHE_BOUNDARY_CEILINGS`, so a fifth boundary cannot appear without someone
 * stating how long it serves — and `read-url-hold-budget.test.ts` then re-runs
 * the arithmetic against whatever they stated.
 *
 * Concretely: CHART-1 added `discovery/cached-series.ts` while this PR was in
 * review. Had this test existed, that merge would have turned it RED, which is
 * exactly the moment someone should have looked at the hold.
 *
 * ⚠ THE STRIPPER IS NOT OPTIONAL, AND THE FILES THAT MAKE IT NOT OPTIONAL ARE
 * NAMED BELOW RATHER THAN GUESSED AT. Two modules discuss the directive in
 * their own docblocks, in double quotes, without using it: `discovery/media.ts`
 * and this module's subject, `storage/read-url-memo.ts`. Scanned raw, the tree
 * reports five boundaries against three declared — so the stripper is load
 * bearing and its removal is RED, which the control below asserts by removing
 * it rather than by claiming it.
 *
 * ⚠ An earlier draft of this header named `sign-read.ts` as the trap, because
 * it carries the sentence "⛔ NOT `'use cache'`". That was wrong in a way worth
 * recording: that sentence uses SINGLE quotes and the scanner matches double,
 * so it was never a false positive and the assertion built on it could not
 * fail. A negative control that names the wrong hazard is indistinguishable
 * from one that works, which is the same shape as the defect this whole file
 * exists to catch.
 */

const ROOT = process.cwd();
const SERVER_DIR = join(ROOT, "src", "server");

/**
 * Strip comments so a scan matches CODE, never prose about code.
 *
 * Approximate by design, and identical in shape to the stripper in
 * `tests/server/debate-view/cached-view-contract.test.ts` — whole-line `//`,
 * trailing `//` not preceded by `:` (so `https://` survives), and block
 * comments. Copied rather than shared because that is this repo's settled
 * convention: eleven source-scan suites each carry their own, each with its own
 * control. The control is what makes the copy safe.
 */
function codeOnly(source: string): string {
	return source
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/^\s*\/\/.*$/gm, "")
		.replace(/([^:])\/\/.*$/gm, "$1");
}

/** Every `.ts` under `src/server/`, repo-relative and POSIX-separated. */
function serverSources(): string[] {
	return readdirSync(SERVER_DIR, { recursive: true, encoding: "utf8" })
		.filter((p) => p.endsWith(".ts"))
		.map((p) => relative(ROOT, join(SERVER_DIR, p)).split(sep).join("/"))
		.sort();
}

const readCode = (rel: string) =>
	codeOnly(readFileSync(join(ROOT, rel), "utf8"));

/** Files whose CODE — not whose comments — carries the directive. */
function boundariesOnDisk(): string[] {
	return serverSources().filter((rel) => /"use cache"/.test(readCode(rel)));
}

describe("the scanner itself", () => {
	/**
	 * ⛔ POSITIVE CONTROL. Without this, every assertion below could be
	 * satisfied by a scanner that finds nothing at all and an empty registry —
	 * two bugs agreeing. This proves the scan reaches real files and really
	 * matches the directive in them.
	 */
	it("finds the real boundaries, not merely a number", () => {
		const found = boundariesOnDisk();

		expect(found.length).toBeGreaterThan(0);
		expect(found).toContain("src/server/debate-view/cached-view.ts");
		expect(readCode("src/server/debate-view/cached-view.ts")).toContain(
			'"use cache"',
		);
	});

	it("reads enough of the tree to be meaningful", () => {
		// A stripper bug that returned "" for every file would make the parity
		// assertion pass vacuously. Pin that the corpus is real.
		const sources = serverSources();
		expect(sources.length).toBeGreaterThan(50);
		expect(sources).toContain("src/server/storage/read-url-memo.ts");
	});

	/**
	 * ⛔ THE NEGATIVE CONTROL, ON THE FILES THAT ACTUALLY TRIP IT. Two modules
	 * write `"use cache"` in a docblock, in double quotes, while using nothing —
	 * so a raw scan counts them as boundaries and reports the opposite of the
	 * truth. This asserts the mechanism by exercising it: strip nothing, and the
	 * boundary set grows past what is declared.
	 */
	it("does not mistake a comment ABOUT the directive for the directive", () => {
		const DISCUSSES_BUT_DOES_NOT_USE = [
			"src/server/discovery/media.ts",
			"src/server/storage/read-url-memo.ts",
		];

		for (const rel of DISCUSSES_BUT_DOES_NOT_USE) {
			const raw = readFileSync(join(ROOT, rel), "utf8");
			expect(raw, `${rel} raw`).toContain('"use cache"');
			expect(codeOnly(raw), `${rel} stripped`).not.toContain('"use cache"');
			expect(boundariesOnDisk()).not.toContain(rel);
		}

		// And the mechanism itself: without stripping, the scan over-reports.
		const rawBoundaries = serverSources().filter((rel) =>
			/"use cache"/.test(readFileSync(join(ROOT, rel), "utf8")),
		);
		expect(rawBoundaries.length).toBeGreaterThan(boundariesOnDisk().length);
	});

	it("keeps code when it strips comments", () => {
		const sample = [
			'// "use cache" — a comment that must not count',
			'const real = "use cache";',
			'/* "use cache" in a block, also not code */',
			'const url = "https://example.com/x";',
		].join("\n");

		const stripped = codeOnly(sample);
		expect(stripped).toContain('const real = "use cache";');
		expect(stripped).toContain("https://example.com/x");
		expect(stripped.match(/"use cache"/g)).toHaveLength(1);
	});
});

describe("parity — boundaries on disk vs declared ceilings", () => {
	it("every cache boundary has a declared downstream ceiling", () => {
		// The RED that CHART-1 would have produced. An extra file here means
		// someone wrapped something in `"use cache"` without saying how long it
		// serves, which is exactly how C-1 became invisible.
		expect(boundariesOnDisk()).toEqual(
			Object.keys(CACHE_BOUNDARY_CEILINGS).sort(),
		);
	});

	it("declares no ceiling for a boundary that no longer exists", () => {
		// The other direction. A stale entry is not harmless: it lets the budget
		// table reason about a serve window nothing imposes any more, which
		// makes the hold look tighter than it needs to be and invites someone
		// to loosen it for the wrong reason.
		for (const declared of Object.keys(CACHE_BOUNDARY_CEILINGS)) {
			expect(boundariesOnDisk()).toContain(declared);
		}
	});

	it("pins the DIRECTIVE count, not just the file count", () => {
		// ⚠ `discovery/list.ts` already carries TWO cached functions, so the
		// file-keyed registry above cannot see a third added beside them — it
		// would declare no ceiling of its own and change nothing. A boundary
		// added to a file already listed re-opens C-1 just as well as one in a
		// new file, and is considerably easier to miss.
		const total = serverSources().reduce(
			(n, rel) => n + (readCode(rel).match(/"use cache"/g)?.length ?? 0),
			0,
		);

		expect(total).toBe(CACHE_BOUNDARY_DIRECTIVE_COUNT);
		// The count must be at least the number of distinct files, or the two
		// guards disagree about what they are counting.
		expect(total).toBeGreaterThanOrEqual(
			Object.keys(CACHE_BOUNDARY_CEILINGS).length,
		);
	});

	it("gives every ceiling a positive, finite value", () => {
		for (const [file, seconds] of Object.entries(CACHE_BOUNDARY_CEILINGS)) {
			expect(Number.isFinite(seconds), file).toBe(true);
			expect(seconds, file).toBeGreaterThan(0);
		}
	});
});

describe("the render TTL the budget table reads", () => {
	/**
	 * `READ_URL_TTL_SECONDS` is declared module-locally in three readers rather
	 * than exported once (`limits.ts` refuses to export it — "pre-declaring an
	 * unused constant would invite drift"). The budget table therefore mirrors
	 * the value, and this is what stops the mirror from drifting: change any of
	 * the three and the table stops agreeing.
	 */
	const RENDER_READERS = [
		"src/server/debate-view/load-debate-view.ts",
		"src/server/discovery/hero.ts",
		"src/server/discovery/media.ts",
	];

	it.each(RENDER_READERS)("%s declares the mirrored render TTL", (rel) => {
		expect(readCode(rel)).toContain(
			`const READ_URL_TTL_SECONDS = ${RENDER_TTL_SECONDS};`,
		);
	});

	it("mirrors 7200, the value ADR-0041 D-6 ratified", () => {
		expect(RENDER_TTL_SECONDS).toBe(7200);
	});
});

describe("no call site reaches the memo without stating its downstream", () => {
	/**
	 * The structural half of the fix. `downstream` being a required parameter
	 * makes omission a type error — but a type error is only enforced where
	 * someone runs `tsc`, and this asserts the shape survives in the tree that
	 * ships. Two-argument `signRead(a, b)` is the pre-fix shape and must be
	 * gone entirely.
	 *
	 * ⚠ THE COUNT IS NOW FOUR, and the fourth is required for the same reason
	 * the third is. `cacheControl` decides whether a browser may reuse the image
	 * for a year, and the two answers in this tree are opposites: the render
	 * paths pass the directive, the ADMIN MODERATION FEED passes `null` because
	 * it signs a sixty-second URL and must not leave a reviewing admin's browser
	 * holding content that is under review. A default would have silently given
	 * that feed the year — which an earlier version of this change did. So the
	 * parameter is required, `null` is a statement rather than an omission, and
	 * a three-argument call is now as much a defect as a two-argument one was.
	 */
	it("every signRead / signReadMarketMedia call passes four arguments", () => {
		const offenders: string[] = [];

		for (const rel of serverSources()) {
			const code = readCode(rel);
			for (const m of code.matchAll(
				/\b(signRead|signReadMarketMedia)\(([^)]*)\)/g,
			)) {
				const args = m[2] ?? "";
				// Skip the declarations themselves (they carry type annotations).
				if (args.includes(":")) continue;
				if (args.trim() === "") continue;
				// ⚠ Drop empty parts before counting. Biome breaks a multi-argument
				// call across lines and adds a TRAILING COMMA, so a naive split
				// yields one too many and reports every correctly-fixed call site as
				// an offender — a false positive that would have been "fixed" by
				// deleting the assertion.
				//
				// ⚠ AND DROP COMMENT LINES. The admin feed's `null` carries an
				// explanatory comment above it, and a comma inside that prose would
				// otherwise be counted as an argument separator.
				const argc = args
					.split("\n")
					.map((line) => line.replace(/\/\/.*$/, ""))
					.join("\n")
					.split(",")
					.map((a) => a.trim())
					.filter((a) => a !== "").length;
				if (argc !== 4) {
					offenders.push(`${rel} → ${m[0]}`);
				}
			}
		}

		expect(offenders).toEqual([]);
	});

	/**
	 * ⛔ THE GUARD THAT CAN FAIL ON ITS OWN DEFECT CLASS. Counting arguments
	 * proves a call site said SOMETHING; it does not prove it said the right
	 * thing. Swapping `DOWNSTREAM_CACHED_MINUTES` for `DOWNSTREAM_NONE` at one
	 * render call site keeps the argument count at three, keeps every other
	 * assertion green, and re-opens C-1 in full — hold 6000 + downstream 3900
	 * against a 7200 s signature. Binding the IDENTIFIER each row declares is
	 * what closes that, the same way the TTL is already bound above.
	 */
	it.each(
		SHIPPED_HOLD_BUDGET,
	)("$site declares $downstreamIdentifier at its call site", ({
		site,
		downstreamIdentifier,
	}) => {
		const code = readCode(site);

		expect(code).toContain(downstreamIdentifier);
		// And it reaches the signer, rather than merely being imported.
		expect(code).toMatch(
			new RegExp(`sign(Read|ReadMarketMedia)\\([^)]*${downstreamIdentifier}`),
		);
	});

	it("the OpenAI moderation hop does not reach the memo at all", () => {
		// R2: there is no browser on that hop, so a held URL buys nothing and
		// spends a fail-closed CSAM gate's budget. Removing it beats tuning it.
		const precommit = readCode("src/server/moderation/precommit.ts");

		expect(precommit).toContain("signReadSingleUse(");
		expect(precommit).not.toMatch(/\bsignRead\(/);
	});
});
