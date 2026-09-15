import { describe, expect, it } from "vitest";

import { framePath, isEngineCaller } from "../../staging/_lib/write-guard";

// ADR-0053 — the write guard's frame parser on BOTH platforms. CI runs Linux,
// so without these literal Windows frames the drive-letter branch would never
// execute anywhere a regression could be caught. Before the fix every Windows
// frame parsed to null and the guard refused every engine write as
// unattributable.

const BS = "\\";
const win = (...parts: string[]) => parts.join(BS);

describe("framePath", () => {
	it("parses POSIX frames (positive control for the original branch)", () => {
		expect(
			framePath("    at place (/repo/src/server/bets/place.ts:12:3)"),
		).toBe("/repo/src/server/bets/place.ts");
		expect(framePath("    at /repo/tests/staging/x.ts:1:1")).toBe(
			"/repo/tests/staging/x.ts",
		);
	});

	it("parses Windows backslash and forward-slash frames, normalised to /", () => {
		expect(
			framePath(
				`    at place (${win("C:", "repo", "src", "server", "bets", "place.ts")}:12:3)`,
			),
		).toBe("C:/repo/src/server/bets/place.ts");
		expect(framePath("    at C:/repo/tests/prod-seed/seed.ts:9:1")).toBe(
			"C:/repo/tests/prod-seed/seed.ts",
		);
	});

	it("still refuses to parse what it cannot read", () => {
		expect(framePath("    at <anonymous>")).toBeNull();
		expect(framePath("    at native")).toBeNull();
	});

	it("a Windows tests/ frame is never classified as engine", () => {
		const src = framePath(
			`    at f (${win("C:", "repo", "src", "server", "x.ts")}:1:1)`,
		);
		const tests = framePath(
			`    at f (${win("C:", "repo", "tests", "prod-seed", "x.ts")}:1:1)`,
		);
		expect(src !== null && isEngineCaller(src)).toBe(true);
		expect(tests !== null && isEngineCaller(tests)).toBe(false);
	});
});
