// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
 * S-8 · The action-type placeholder advertised `market.resolved`, an
 * EVENT_TYPES value that lives only in the `events` table. NEITHER side of the
 * `mod_actions` ∪ `admin_events` union can ever match it, so the form was
 * advertising a query that provably returns nothing.
 *
 * The page's two server dependencies are mocked so this file never opens a DB
 * connection; the exports under test are pure/presentational.
 */

vi.mock("@/server/admin/moderation/audit-feed", () => ({
	loadModerationAuditFeed: vi.fn(async () => []),
	searchAuditLog: vi.fn(async () => []),
}));
vi.mock("@/server/admin/page-guards", () => ({
	requireAdminPage: vi.fn(async () => undefined),
}));

import {
	ACTION_TYPE_PLACEHOLDER,
	InvalidDateNote,
	invalidDateFields,
} from "@/app/(admin)/admin/moderation/audit/page";
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
		render(<InvalidDateNote fields={invalidDateFields({ from: "junk" })} />);
		const note = screen.getByTestId("invalid-date-note");
		expect(note.getAttribute("role")).toBe("note");
		expect(note.textContent).toContain("From");
		// The operator must be told the results are NOT filtered by it.
		expect(note.textContent).toContain("unfiltered");
	});

	it("POSITIVE CONTROL — renders NOTHING when every date parsed", () => {
		// A note that always rendered would satisfy the assertion above.
		const { container } = render(
			<InvalidDateNote fields={invalidDateFields({ from: "2026-08-12" })} />,
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
