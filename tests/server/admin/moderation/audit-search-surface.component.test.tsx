// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

/**
 * POLISH.8 S-6 (D17) + S-8 (D06) — the two honesty defects on the F-ADMIN-5
 * audit search surface. Both are about the form telling the operator the truth
 * about what it did; neither changes the query.
 *
 * S-6 · A malformed `from`/`to` is DROPPED by `parseFilters` (deliberately —
 * the query must not throw on a hand-edited URL). The operator then received
 * results UNFILTERED by a date they believed they had applied, with nothing on
 * screen saying so. `invalidDateFields` names the dropped fields and
 * `InvalidDateNote` renders them.
 *
 * GC-1 · and the note must not assert breadth it does not have. When the
 * dropped date was the ONLY filter, no search runs at all and the page falls
 * back to the gate-block feed — so the note branches on `searchRan`. The three
 * cases below cover that; case 3 is the fire path and was the one that was RED.
 *
 * S-8 · The action-type placeholder advertised `market.resolved`, an
 * EVENT_TYPES value that lives only in the `events` table. NEITHER side of the
 * `mod_actions` ∪ `admin_events` union can ever match it, so the form was
 * advertising a query that provably returns nothing.
 *
 * GC-5 · these symbols now live in the colocated `search-surface.tsx`, not on
 * `page.tsx`. That module's ONLY import is a TYPE, so this file needs NO mocks
 * at all — the two server-dependency mocks it previously carried are gone
 * rather than left as dead scaffolding.
 */

import {
	ACTION_TYPE_PLACEHOLDER,
	InvalidDateNote,
	invalidDateFields,
	parseFilters,
	searchRan,
} from "@/app/(admin)/admin/moderation/audit/search-surface";
import { modReasonEnum } from "@/db/schema/audit";
import { EVENT_TYPES } from "@/server/events/schemas";

afterEach(() => {
	cleanup();
});

describe("S-6 · a dropped date predicate is visible (D17)", () => {
	it("names an unparseable From", () => {
		expect(invalidDateFields({ from: "junk" })).toEqual(["From"]);
	});

	it("names an unparseable To", () => {
		expect(invalidDateFields({ to: "not-a-date" })).toEqual(["To"]);
	});

	it("names BOTH when both are unparseable", () => {
		expect(invalidDateFields({ from: "junk", to: "junk" })).toEqual([
			"From",
			"To",
		]);
	});

	it("POSITIVE CONTROL — a VALID date is not named", () => {
		// Without this, a predicate that returned every supplied field would pass
		// every assertion above.
		expect(invalidDateFields({ from: "2026-08-12", to: "2026-08-13" })).toEqual(
			[],
		);
	});

	it("names nothing when no date was supplied at all", () => {
		expect(invalidDateFields({})).toEqual([]);
		expect(invalidDateFields({ from: "", to: "" })).toEqual([]);
	});

	it("RENDERS the note when a date was dropped", () => {
		// `searchRan` is now explicit: this is the search-DID-run shape, where the
		// "unfiltered by it" wording is the true one. The fallback shape is case 3
		// below. (Before GC-1 the note had one wording for both, which is the
		// defect.)
		const sp = { from: "junk", actionType: "content_removed" };
		render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		const note = screen.getByTestId("invalid-date-note");
		expect(note.getAttribute("role")).toBe("note");
		expect(note.textContent).toContain("From");
		// The operator must be told the results are NOT filtered by it.
		expect(note.textContent).toContain("unfiltered");
	});

	// ── GC-1 · the three cases, and case 3 is the fire path ──────────────────
	//
	// `searchRan` is the page's own "did any predicate survive" decision, exported
	// so these assertions run against the SHIPPED expression rather than a
	// re-typed lookalike (V-1) — and so it cannot drift from the query the way
	// M-2's re-derivation could have.

	it("case 1 · invalid date WITH another filter — search RUNS, no fallback claim", () => {
		const sp = { from: "junk", actionType: "content_removed" };
		expect(searchRan(sp)).toBe(true);
		render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		const note = screen.getByTestId("invalid-date-note");
		expect(note.textContent).toContain("From");
		// The search DID run, so the note must not claim a fallback happened.
		expect(note.textContent).not.toContain("blocked-submissions");
		expect(note.textContent).not.toContain("No search ran");
	});

	it("case 3 · ⚠ invalid date ALONE — search does NOT run, note states the fallback", () => {
		// THE FIRE PATH. `?from=junk` with nothing else: parseFilters returns {},
		// `searching` is false, and the page renders loadModerationAuditFeed —
		// the gate-block feed, which by construction contains NO content_removed
		// and NO user_banned rows. A note that says only "the rows below are
		// unfiltered by it" asserts breadth it does not have: the operator reads
		// "you are seeing everything" while looking at a set that structurally
		// excludes what they searched for.
		const sp = { from: "junk" };
		expect(searchRan(sp)).toBe(false);
		render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		const note = screen.getByTestId("invalid-date-note");
		expect(note.textContent).toContain("From");
		expect(note.textContent).toContain("No search ran");
		expect(note.textContent).toContain("blocked-submissions");
		// And it must NOT still be asserting the old breadth.
		expect(note.textContent).not.toContain(
			"the rows below are unfiltered by it",
		);
	});

	it("R3-4 · reads correctly when BOTH dates are invalid — plural, and still true", () => {
		// `?from=junk&to=junk` is a TESTED case ("names BOTH when both are
		// unparseable"), and the fallback copy said "it was the ONLY FILTER
		// supplied" over two supplied filters. Copy-only fix; the three
		// load-bearing claims must survive verbatim.
		const sp = { from: "junk", to: "junk" };
		expect(invalidDateFields(sp)).toEqual(["From", "To"]);
		expect(searchRan(sp)).toBe(false);
		render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		const note = screen.getByTestId("invalid-date-note");

		// PLURAL, and no singular residue anywhere in the sentence.
		expect(note.textContent).toContain("From and To");
		expect(note.textContent).toContain("the only filters supplied");
		expect(note.textContent).not.toContain("the only filter supplied");
		expect(note.textContent).not.toContain("That value");

		// ⚠ THE THREE LOAD-BEARING CLAIMS — unweakened.
		expect(note.textContent).toContain("No search ran");
		expect(note.textContent).toContain("blocked-submissions feed");
		expect(note.textContent).toContain(
			"content removals and user bans are never in it",
		);
	});

	it("R3-4 · the SINGULAR case keeps singular copy", () => {
		// The positive control for the plural fix: a one-field drop must NOT
		// acquire plural copy. Without this, "always plural" would pass above.
		const sp = { from: "junk" };
		render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		const note = screen.getByTestId("invalid-date-note");
		expect(note.textContent).toContain("the only filter supplied");
		expect(note.textContent).not.toContain("the only filters supplied");
		expect(note.textContent).toContain("That value");
		expect(note.textContent).toContain("No search ran");
	});

	it("POSITIVE CONTROL — renders NOTHING when every date parsed", () => {
		// A note that always rendered would satisfy the assertion above.
		const sp = { from: "2026-08-12" };
		const { container } = render(
			<InvalidDateNote
				fields={invalidDateFields(sp)}
				searchRan={searchRan(sp)}
			/>,
		);
		expect(screen.queryByTestId("invalid-date-note")).toBeNull();
		expect(container.textContent).toBe("");
	});
});

describe("S-8 · the action-type placeholder only advertises matchable values (D06)", () => {
	/** Every EVENT_TYPES value the string contains. */
	const eventTypesIn = (s: string): string[] =>
		EVENT_TYPES.filter((t) => s.includes(t));

	it("scans a non-empty EVENT_TYPES inventory (N1)", () => {
		expect(EVENT_TYPES.length).toBeGreaterThan(0);
	});

	it("contains NO EVENT_TYPES value", () => {
		expect(eventTypesIn(ACTION_TYPE_PLACEHOLDER)).toEqual([]);
	});

	it("POSITIVE CONTROL — the same probe DOES match a planted EVENT_TYPES value", () => {
		// Without this the assertion above passes vacuously on any string,
		// including an empty one or a renamed constant (V-2 / N3).
		expect(
			eventTypesIn(`${ACTION_TYPE_PLACEHOLDER} · market.resolved`),
		).toEqual(["market.resolved"]);
	});

	it("advertises only real mod_actions.reason members", () => {
		const reasons: readonly string[] = modReasonEnum.enumValues;
		const advertised = ACTION_TYPE_PLACEHOLDER.split("·").map((s) => s.trim());
		expect(advertised.length).toBeGreaterThan(0);
		for (const token of advertised) {
			expect(reasons).toContain(token);
		}
	});
});

// ── R2-6 part A · the searchRan EQUIVALENCE PROOF ───────────────────────────
//
// GC-1 replaced the page's inline read-branch selector. At b96a0c2 the page read:
//
//     const filters = parseFilters(sp);
//     const searching = Object.keys(filters).length > 0;
//
// and at head it reads `const searching = searchRan(sp)`. That expression selects
// between `searchAuditLog` and `loadModerationAuditFeed` — TWO DIFFERENT READ
// MODELS on the moderation audit surface. "Probably equivalent" is not the bar
// for a control-flow expression there, so it is pinned here against the OLD
// expression inlined as an ORACLE, across a spanning input set.
//
// `parseFilters` is byte-identical to its b96a0c2 form (GC-5 added only the
// `export` keyword) and is pure — no IO, no clock, no randomness — so the oracle
// is a faithful restatement of the pre-GC-1 semantics, not a lookalike.

/** The pre-GC-1 inline expression, verbatim. */
const oracle = (sp: Parameters<typeof searchRan>[0]): boolean =>
	Object.keys(parseFilters(sp)).length > 0;

const SPANNING: ReadonlyArray<{
	name: string;
	sp: Parameters<typeof searchRan>[0];
}> = [
	{ name: "no params", sp: {} },
	{ name: "valid from", sp: { from: "2026-08-12" } },
	{ name: "valid to", sp: { to: "2026-08-13" } },
	{ name: "invalid from", sp: { from: "junk" } },
	{ name: "invalid to", sp: { to: "not-a-date" } },
	{ name: "invalid from + valid to", sp: { from: "junk", to: "2026-08-13" } },
	{ name: "actionType only", sp: { actionType: "content_removed" } },
	{
		name: "marketId only",
		sp: { marketId: "00000000-0000-0000-0000-0000000000aa" },
	},
	{ name: "pseudonym only", sp: { pseudonym: "somebody" } },
	// @code-reviewer MEDIUM (read-2): `userId` was the ONE field with no
	// single-field row — it appeared only alongside five others, which
	// co-determined the outcome. The reviewer built a userId-BLIND selector
	// (`!!(from||to||actionType||marketId||pseudonym)`) and it passed all eleven
	// cases while every other wrong-extraction class was caught. This row is the
	// missing discriminator: oracle true, userId-blind selector false.
	{
		name: "userId only",
		sp: { userId: "00000000-0000-0000-0000-0000000000bb" },
	},
	{
		name: "every field valid",
		sp: {
			from: "2026-08-12",
			to: "2026-08-13",
			actionType: "content_removed",
			marketId: "00000000-0000-0000-0000-0000000000aa",
			userId: "00000000-0000-0000-0000-0000000000bb",
			pseudonym: "somebody",
		},
	},
	{
		name: "every field invalid or blank",
		sp: {
			from: "junk",
			to: "junk",
			actionType: "   ",
			marketId: "  ",
			userId: " ",
			pseudonym: "  ",
		},
	},
];

describe("R2-6 · searchRan is a PURE EXTRACTION of the pre-GC-1 selector", () => {
	it("spans both outcomes — the set is not vacuous (N1)", () => {
		// An input set that is all-true or all-false cannot detect an inverted or
		// constant extraction, however many rows it has.
		const outcomes = SPANNING.map((c) => oracle(c.sp));
		expect(outcomes).toContain(true);
		expect(outcomes).toContain(false);
	});

	it("⚠ contains an input a WRONG extraction would get wrong (V-7)", () => {
		// The obvious wrong extraction reads `sp` instead of parseFilters' OUTPUT.
		// `?from=junk` alone is the discriminating case: sp has one key, but the
		// parsed filter set is empty. Without a row like this the whole table
		// below could pass on a broken implementation.
		const naive = (sp: Parameters<typeof searchRan>[0]): boolean =>
			Object.keys(sp).length > 0;
		const discriminating = SPANNING.filter((c) => naive(c.sp) !== oracle(c.sp));
		expect(discriminating.map((c) => c.name)).toContain("invalid from");
		expect(discriminating.length).toBeGreaterThan(0);

		// A SECOND wrong-extraction class, from the read-2 review: a selector
		// blind to ONE field. Nothing in the set caught it until "userId only"
		// was added, so the property is pinned rather than left to the comment.
		const userIdBlind = (sp: Parameters<typeof searchRan>[0]): boolean => {
			const f = parseFilters(sp);
			return Boolean(
				f.from || f.to || f.actionType || f.marketId || f.pseudonym,
			);
		};
		expect(
			SPANNING.filter((c) => userIdBlind(c.sp) !== oracle(c.sp)).map(
				(c) => c.name,
			),
		).toContain("userId only");
	});

	for (const { name, sp } of SPANNING) {
		it(`agrees with the pre-GC-1 expression — ${name}`, () => {
			expect(searchRan(sp)).toBe(oracle(sp));
		});
	}
});
