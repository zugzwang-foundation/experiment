import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
	parsePostOrdinal,
	readPostParam,
} from "@/components/debate/post-param";

/**
 * RPLY-1 · R2 — THE `?post=` SHAPE GATE EXISTS TWICE, AND THIS IS WHAT STOPS
 * THE TWO COPIES DRIFTING.
 *
 * ⚠⚠ WHY THERE ARE TWO AT ALL. The server's gate lives in
 * `src/server/debate-view/resolve-post-param.ts`, which imports `server-only`
 * — a browser `popstate` listener cannot import it, and RPLY-1 may not edit
 * that file to hoist the constant into a shared module. So the client carries a
 * copy. ⛔ A copy that CAN drift is worse than no copy: the two paths would
 * accept different URLs, and the same link would behave one way on a cold load
 * and another on a back-navigation, with nothing anywhere going red.
 *
 * ⇒ Drift is made IMPOSSIBLE TO SHIP rather than merely discouraged. This reads
 * both source files and compares the literals character for character. O-1 —
 * structural beats procedural; a comment saying "keep these in sync" is the
 * thing that does not work.
 *
 * ⚠ THE FILE-READ ITSELF CARRIES A POSITIVE CONTROL. A regex that matched
 * nothing in either file would make the comparison `undefined === undefined`
 * and pass while proving nothing — the exact vacuity OVN-V1 exists for. Both
 * extractions are asserted DEFINED and asserted to be the expected literal
 * before they are compared to each other.
 */

const ROOT = process.cwd();
const SERVER = "src/server/debate-view/resolve-post-param.ts";
const CLIENT = "src/components/debate/post-param.ts";

/** The `POST_PARAM_SHAPE = /…/;` literal out of a file, as written. */
function shapeLiteral(rel: string): string | undefined {
	const src = readFileSync(join(ROOT, rel), "utf8");
	// ⚠ ANCHORED AT LINE START (`m` flag + `^`), so a commented-out declaration
	// placed ABOVE the real one cannot become the compared literal — an
	// unanchored `.exec` takes the FIRST match, and this guard is the only thing
	// standing between the two copies.
	return /^const POST_PARAM_SHAPE = (\/.*\/);$/m.exec(src)?.[1];
}

describe("R2 — the client and server `?post=` gates cannot drift apart", () => {
	it("post-param-parity::both-files-DECLARE-a-shape-gate", () => {
		// The positive control. Without it the comparison below could be two
		// `undefined`s agreeing with each other.
		expect(shapeLiteral(SERVER)).toBeDefined();
		expect(shapeLiteral(CLIENT)).toBeDefined();
	});

	it("post-param-parity::the-two-literals-are-BYTE-IDENTICAL", () => {
		expect(shapeLiteral(CLIENT)).toBe(shapeLiteral(SERVER));
		// …and pinned to the value itself, so BOTH being edited in the same wrong
		// way still reddens. Agreeing on the wrong gate is not parity.
		expect(shapeLiteral(SERVER)).toBe("/^[1-9][0-9]{0,4}$/");
	});
});

/**
 * The gate's BEHAVIOUR, so this file is not purely textual. A source scan
 * proves the two strings match; these prove the string means what the server's
 * docblock says it means — "a 1-based ordinal, no leading zero, capped at 5
 * digits", with everything else falling to the zero-branch.
 */
describe("R2 — the shape gate accepts exactly the server's domain", () => {
	for (const ok of ["1", "9", "10", "99999", "12345"]) {
		it(`post-param-parity::accepts-${ok}`, () => {
			expect(parsePostOrdinal(ok)).toBe(Number.parseInt(ok, 10));
		});
	}

	for (const bad of [
		"0", // not 1-based
		"01", // leading zero
		"100000", // 6 digits — past the cap
		"-1",
		"1.5",
		"1e3",
		" 1",
		"1 ",
		"abc",
		"",
		"١", // a non-ASCII digit: `\d` in JS is ASCII-only, and this pins that
	]) {
		it(`post-param-parity::refuses-${JSON.stringify(bad)}`, () => {
			expect(parsePostOrdinal(bad)).toBeNull();
		});
	}

	it("post-param-parity::refuses-null", () => {
		expect(parsePostOrdinal(null)).toBeNull();
	});
});

describe("R2 — a REPEATED param is refused, exactly as the server refuses it", () => {
	it("post-param-parity::one-value-reads-through", () => {
		// The positive control for the two refusals below.
		expect(readPostParam("?post=3")).toBe("3");
		expect(readPostParam("?post=3&other=x")).toBe("3");
	});

	it("post-param-parity::two-values-read-as-ABSENT", () => {
		// ⛔ Next hands the page `string | string[]`; `page.tsx` refuses anything
		// that is not a `string`, so `?post=1&post=2` renders the market view on a
		// cold load. `URLSearchParams.get` would have returned "1" and focused it.
		expect(readPostParam("?post=1&post=2")).toBeNull();
		expect(readPostParam("?post=1&post=1")).toBeNull();
	});

	it("post-param-parity::no-param-reads-as-absent", () => {
		expect(readPostParam("")).toBeNull();
		expect(readPostParam("?other=x")).toBeNull();
	});
});
