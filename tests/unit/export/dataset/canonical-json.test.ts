import { describe, expect, it } from "vitest";

import { canonicalJson, escapeField } from "@/server/export/dataset/csv";

/**
 * DATASET.2 — `canonicalJson`, the RFC 8785 (JCS) serializer.
 *
 * ## Why this file exists
 *
 * `@security-auditor` F-11 M-4: a vendored library **with its own test suite
 * and the RFC's published test vectors** was replaced by ~13 hand-written
 * lines, on the function that determines the bytes of a published,
 * checksummed, non-withdrawable artifact — and it had **no test at all**. The
 * only object-branch assertion anywhere in the repo was
 * `escapeField({ a: 1 })`, a SINGLE-KEY object, where sorting is a no-op.
 *
 * The replacement was not gratuitous: `canonicalize@3.0.0` is ESM-only, and
 * importing it broke `scripts/build-dataset.ts` — the one path that produces
 * the release artifact — while `tsc`, biome and the whole vitest suite stayed
 * green (F-11 H-1). But "the dependency had to go" is not "the replacement is
 * correct", and only one of those had been established.
 *
 * ## What is asserted, and why these cases
 *
 * The auditor differential-tested this implementation against
 * `canonicalize@3.0.0` over 21 adversarial classes and found **21/21
 * byte-identical**. A differential test cannot be kept (the whole point was to
 * drop the dependency), so the classes are pinned here as literals instead.
 *
 * ⚠ The number cases matter more than they look. The docblock in `csv.ts`
 * used to claim *"there are no floats"* — false: `mod_actions.categories`
 * ships the raw OpenAI `category_scores` map, which is the one float-bearing
 * shipped column, so RFC 8785 §3.2.2.3's number rules ARE reachable. The code
 * was right and the argument licensing it was wrong, which is precisely the
 * combination that leaves a path untested.
 */

describe("canonicalJson · key ordering (JCS §3.2.3)", () => {
	it("sorts object keys ascending by UTF-16 code unit", () => {
		expect(canonicalJson({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
	});

	it("sorts NESTED objects too, not only the root", () => {
		// A root-only sort passes the test above and still makes the archive's
		// bytes depend on where a nested object came from.
		expect(canonicalJson({ z: { d: 1, b: 2 }, a: 1 })).toBe(
			'{"a":1,"z":{"b":2,"d":1}}',
		);
	});

	it("orders by CODE UNIT, not by locale or by numeric value", () => {
		// `"10" < "9"` by code unit and `10 > 9` numerically. A `localeCompare`
		// or a numeric-aware comparator gives the other answer — and
		// `@code-reviewer` M-9 already caught `localeCompare` once in this
		// codebase, in `tar.ts`, for the same reason: it makes the published
		// checksum a property of the machine that built it.
		expect(canonicalJson({ "9": 1, "10": 2, "01": 3, "1": 4 })).toBe(
			'{"01":3,"1":4,"10":2,"9":1}',
		);
	});

	it("orders uppercase before lowercase (code unit, not case-insensitive)", () => {
		expect(canonicalJson({ a: 1, B: 2 })).toBe('{"B":2,"a":1}');
	});

	it("handles non-BMP keys by UTF-16 CODE UNIT — not by code point", () => {
		// ⚠ The distinction is the whole point of this case, and I got the
		// expectation wrong on the first pass, which is why it is spelled out.
		//
		//   U+1F600 😀  → surrogate pair, first code unit 0xD83D
		//   U+FFFF  ￿   → single code unit 0xFFFF
		//
		// By CODE POINT, 😀 (0x1F600) sorts AFTER ￿ (0xFFFF).
		// By CODE UNIT,  😀 (0xD83D…) sorts BEFORE ￿ (0xFFFF).
		//
		// RFC 8785 §3.2.3 mandates the code-unit order, which is what a bare
		// `.sort()` on JS strings gives — so the astral key comes first. An
		// implementation that "helpfully" sorted by code point would pass every
		// other test in this file and produce different published bytes.
		const out = canonicalJson({ "\u{1F600}": 1, "￿": 2, a: 3 });
		expect(out).toBe('{"a":3,"\u{1F600}":1,"￿":2}');
	});
});

describe("canonicalJson · arrays are DATA, never sorted", () => {
	it("preserves array order", () => {
		// Sorting an array would silently reorder `market.created.media[]`,
		// whose order IS `displayOrder`.
		expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
	});

	it("sorts objects INSIDE an array without reordering the array", () => {
		expect(
			canonicalJson([
				{ b: 1, a: 2 },
				{ d: 1, c: 2 },
			]),
		).toBe('[{"a":2,"b":1},{"c":2,"d":1}]');
	});

	it("handles nested arrays and empty containers", () => {
		expect(canonicalJson({ a: [[1, 2], []], b: {} })).toBe(
			'{"a":[[1,2],[]],"b":{}}',
		);
	});
});

describe("canonicalJson · the number path (JCS §3.2.2.3)", () => {
	// ⚠ Reachable in production via `mod_actions.categories` — the raw OpenAI
	// `category_scores` map. These are ECMAScript `Number::toString` outputs,
	// which is exactly what RFC 8785 mandates.
	it("serializes a realistic moderation score map", () => {
		expect(canonicalJson({ harassment: 0.91, "self-harm": 0.0001 })).toBe(
			'{"harassment":0.91,"self-harm":0.0001}',
		);
	});

	it("matches ECMAScript on the awkward values", () => {
		expect(canonicalJson(1 / 3)).toBe("0.3333333333333333");
		expect(canonicalJson(0.1 + 0.2)).toBe("0.30000000000000004");
		expect(canonicalJson(1e21)).toBe("1e+21");
		expect(canonicalJson(5e-324)).toBe("5e-324");
		expect(canonicalJson(2 ** 53)).toBe("9007199254740992");
	});

	it("normalizes -0 to 0, as JCS requires", () => {
		expect(canonicalJson(-0)).toBe("0");
	});

	it("leaves NUMERIC(38,18) strings untouched as strings", () => {
		// The money path never enters the number path at all — CLAUDE.md §2.
		// A `Number()` here would truncate an 18-decimal balance and the CSV
		// would still look completely normal.
		expect(canonicalJson({ amount: "25.000000000000000000" })).toBe(
			'{"amount":"25.000000000000000000"}',
		);
	});
});

describe("canonicalJson · strings, escaping, and the scalar leaves", () => {
	it("escapes keys and values that need it", () => {
		expect(canonicalJson({ 'a"b': "c\\d\ne" })).toBe('{"a\\"b":"c\\\\d\\ne"}');
	});

	it("passes scalars through JSON.stringify", () => {
		expect(canonicalJson(null)).toBe("null");
		expect(canonicalJson(true)).toBe("true");
		expect(canonicalJson("x")).toBe('"x"');
	});

	it("emits an object's null values rather than dropping them", () => {
		// A dropped null would change the column set a reader sees inside the
		// JSONB blob, which is data loss wearing a tidy-up.
		expect(canonicalJson({ b: null, a: 1 })).toBe('{"a":1,"b":null}');
	});
});

describe("canonicalJson · it is what escapeField actually uses", () => {
	it("escapeField routes objects through the canonical serializer", () => {
		// ⚠ The control that ties the unit tests above to the shipped bytes.
		// Without it, every assertion here could hold while `escapeField` still
		// called `JSON.stringify` — which is the regression that matters.
		expect(escapeField({ b: 1, a: 2 })).toBe('"{""a"":2,""b"":1}"');
	});

	it("is DETERMINISTIC across two structurally-identical inputs built differently", () => {
		// The property the archive's published `content_sha256` depends on:
		// two objects with the same data and different insertion order must
		// serialize to the same bytes. This is the assertion the build-script
		// determinism test CANNOT make, because it reads one fixture twice.
		const fromLiteral = { request_id: "r", flow_id: "f", ip: "1.2.3.4" };
		const built: Record<string, unknown> = {};
		built.ip = "1.2.3.4";
		built.flow_id = "f";
		built.request_id = "r";
		expect(canonicalJson(built)).toBe(canonicalJson(fromLiteral));
		expect(JSON.stringify(built)).not.toBe(JSON.stringify(fromLiteral));
	});
});
