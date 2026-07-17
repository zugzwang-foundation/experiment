import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	composeWireBody,
	extendedMaxChars,
	isArgumentSubmittable,
	TITLE_MAX_CHARS,
} from "@/components/debate/composer/payload";
import { COMMENT_MAX_LENGTH } from "@/server/config/limits";

// UI.A3 §5.6 tests-first — the composer payload module (plan §3.2 "Body
// composition", ratified OQ-6 + the two F-5 pins). PURE / DB-INDEPENDENT: REDs
// NOW on the unresolvable greenfield import (`src/components/debate/composer/
// payload.ts` does not exist until execute) and GREENs when it lands.
//
// Plan-§1 invariant rows asserted here:
//   - 2.1 INV-1 (bet ↔ comment atomicity) — the UI-side gate half: an empty /
//     whitespace-only argument title makes the submit gate FALSE, so the
//     composer never fires a comment-free buy at the server's
//     `comment_requires_bet` frontstop (row 1's named test assertion).
//   - F-5 (i): NO trailing "\n\n" when the extended text is empty/whitespace.
//   - F-5 (ii): the title is newline-free (protects the `deriveTitleTeaser`
//     round-trip — plan Ratification F-5 ground, load-debate-view.ts:349-355).
//
// PINNED PUBLIC-API CONTRACT (the implementer matches these names exactly):
//   TITLE_MAX_CHARS: 125            // DELIBERATELY LITERAL — mirrors the
//                                   // UNEXPORTED server bound `slice(0, 125)`
//                                   // in deriveTitleTeaser (a private fn of
//                                   // load-debate-view.ts); the drift pin
//                                   // below breaks if the server bound moves
//   composeWireBody(args: { title: string; extended: string }): string
//     — wire body = trimmedTitle + "\n\n" + extended when extended.trim() is
//       non-empty; trimmedTitle ALONE otherwise (F-5 i). THROWS on: a title
//       containing "\n" or "\r" (F-5 ii); an empty/whitespace-only title
//       (INV-1 gate belt); trimmed title length > TITLE_MAX_CHARS; total
//       composed length > COMMENT_MAX_LENGTH (live import, never a literal).
//   isArgumentSubmittable(title: string): boolean
//     — false for empty/whitespace-only, newline-containing, or trimmed
//       length > TITLE_MAX_CHARS; true otherwise.
//   extendedMaxChars(titleLength: number): number
//     — COMMENT_MAX_LENGTH − titleLength − 2 (the "\n\n" separator budget).
//
// COMMENT_MAX_LENGTH is read LIVE from @/server/config/limits so a HARDEN
// tuning pass can't stale these tests. Argument text reuses plain fixture
// prose (no market questions / resolution criteria are invented — §3 refusal).

const TITLE = "The base rate argument.";
const EXTENDED_P1 = "The extended argument, first paragraph.";
const EXTENDED_P2 = "The extended argument, second paragraph.";

describe("payload — constants + server drift pin", () => {
	it("payload::title-max-chars-pinned-125", () => {
		// Deliberately literal: 125 mirrors deriveTitleTeaser's slice(0, 125)
		// (an unexported server literal — no import path exists).
		expect(TITLE_MAX_CHARS).toBe(125);
	});

	it("payload::drift-pin-server-slice-0-125-still-on-disk", () => {
		// File-text guard: if the server-side title bound ever moves off
		// `slice(0, 125)`, this breaks and TITLE_MAX_CHARS must be reconciled.
		const source = readFileSync(
			join(process.cwd(), "src/server/debate-view/load-debate-view.ts"),
			"utf8",
		);
		expect(source).toContain("slice(0, 125)");
	});
});

describe("composeWireBody — composition law + F-5 pins", () => {
	it("payload::title-only-has-no-trailing-separator (F-5 i)", () => {
		// Empty extended → the TRIMMED title ALONE, byte-exact; never a
		// trailing "\n\n" (which would corrupt the deriveTitleTeaser split).
		const composed = composeWireBody({
			title: `  ${TITLE}  `,
			extended: "",
		});
		expect(composed).toBe(TITLE);
		expect(composed.endsWith("\n\n")).toBe(false);
		expect(composed.includes("\n")).toBe(false);
	});

	it("payload::whitespace-only-extended-is-empty (F-5 i)", () => {
		const composed = composeWireBody({ title: TITLE, extended: "   " });
		expect(composed).toBe(TITLE);
		expect(composed.endsWith("\n\n")).toBe(false);
	});

	it("payload::joins-title-and-extended-with-one-blank-line", () => {
		expect(composeWireBody({ title: TITLE, extended: EXTENDED_P1 })).toBe(
			`${TITLE}\n\n${EXTENDED_P1}`,
		);
	});

	it("payload::uses-the-trimmed-title-when-joining", () => {
		expect(
			composeWireBody({ title: `  ${TITLE}  `, extended: EXTENDED_P1 }),
		).toBe(`${TITLE}\n\n${EXTENDED_P1}`);
	});

	it("payload::throws-on-a-newline-bearing-title (F-5 ii)", () => {
		expect(() =>
			composeWireBody({ title: "line one\nline two", extended: "" }),
		).toThrow();
		expect(() =>
			composeWireBody({ title: "carriage\rreturn", extended: "" }),
		).toThrow();
	});

	it("payload::throws-on-an-empty-title (INV-1 gate belt)", () => {
		expect(() => composeWireBody({ title: "", extended: "" })).toThrow();
		expect(() =>
			composeWireBody({ title: "   ", extended: EXTENDED_P1 }),
		).toThrow();
	});

	it("payload::throws-on-a-title-over-TITLE_MAX_CHARS", () => {
		expect(() =>
			composeWireBody({
				title: "a".repeat(TITLE_MAX_CHARS + 1),
				extended: "",
			}),
		).toThrow();
		// Boundary: EXACTLY at the bound → no throw.
		expect(() =>
			composeWireBody({ title: "a".repeat(TITLE_MAX_CHARS), extended: "" }),
		).not.toThrow();
	});

	it("payload::throws-when-composed-length-exceeds-COMMENT_MAX_LENGTH", () => {
		// title 1 char + "\n\n" + extended (COMMENT_MAX_LENGTH − 2 chars)
		// → total COMMENT_MAX_LENGTH + 1 → rejected.
		expect(() =>
			composeWireBody({
				title: "T",
				extended: "a".repeat(COMMENT_MAX_LENGTH - 2),
			}),
		).toThrow();
	});

	it("payload::composed-length-exactly-COMMENT_MAX_LENGTH-passes", () => {
		// title 1 + separator 2 + extended (COMMENT_MAX_LENGTH − 3)
		// → total EXACTLY COMMENT_MAX_LENGTH → allowed (boundary inclusive).
		const composed = composeWireBody({
			title: "T",
			extended: "a".repeat(COMMENT_MAX_LENGTH - 3),
		});
		expect(composed.length).toBe(COMMENT_MAX_LENGTH);
	});

	it("payload::round-trips-through-the-deriveTitleTeaser-derivation", () => {
		// Mirror of deriveTitleTeaser (load-debate-view.ts:349-355) inline:
		// title = first line sliced to 125; teaser = paragraphs[1] of the
		// /\n\s*\n/ split. The composed body must land the composer's two
		// fields back on the card render exactly.
		const body = composeWireBody({
			title: TITLE,
			extended: `${EXTENDED_P1}\n\n${EXTENDED_P2}`,
		});
		const firstLine = body.split("\n", 1)[0] ?? "";
		expect(firstLine.slice(0, 125)).toBe(TITLE);
		const paragraphs = body.split(/\n\s*\n/);
		expect(paragraphs[1]).toBe(EXTENDED_P1);
	});

	it("payload::title-only-round-trip-derives-an-empty-teaser", () => {
		const body = composeWireBody({ title: TITLE, extended: "" });
		const firstLine = body.split("\n", 1)[0] ?? "";
		expect(firstLine.slice(0, 125)).toBe(TITLE);
		const paragraphs = body.split(/\n\s*\n/);
		expect((paragraphs[1] ?? "").trim()).toBe("");
	});
});

describe("isArgumentSubmittable — the INV-1 submit gate", () => {
	it("payload::submit-gate-false-on-empty-or-whitespace-title (INV-1)", () => {
		// Plan §1 row 1's named assertion: empty/whitespace title → submit-gate
		// FALSE — the composer never fires a comment-free buy.
		expect(isArgumentSubmittable("")).toBe(false);
		expect(isArgumentSubmittable("   ")).toBe(false);
		expect(isArgumentSubmittable("\t")).toBe(false);
	});

	it("payload::submit-gate-false-on-a-newline-bearing-title (F-5 ii)", () => {
		expect(isArgumentSubmittable("line one\nline two")).toBe(false);
		expect(isArgumentSubmittable("carriage\rreturn")).toBe(false);
	});

	it("payload::submit-gate-false-on-an-overlong-title", () => {
		expect(isArgumentSubmittable("a".repeat(TITLE_MAX_CHARS + 1))).toBe(false);
		// TRIMMED length governs: padding does not rescue an overlong title.
		expect(
			isArgumentSubmittable(`  ${"a".repeat(TITLE_MAX_CHARS + 1)}  `),
		).toBe(false);
	});

	it("payload::submit-gate-true-on-a-plain-title", () => {
		expect(isArgumentSubmittable(TITLE)).toBe(true);
		expect(isArgumentSubmittable("a".repeat(TITLE_MAX_CHARS))).toBe(true);
		expect(isArgumentSubmittable(`  ${TITLE}  `)).toBe(true);
	});
});

describe("extendedMaxChars — the two-field counter budget (OQ-6)", () => {
	it("payload::extended-budget-with-no-title", () => {
		expect(extendedMaxChars(0)).toBe(COMMENT_MAX_LENGTH - 2);
	});

	it("payload::extended-budget-with-a-full-title", () => {
		expect(extendedMaxChars(125)).toBe(COMMENT_MAX_LENGTH - 127);
	});
});
