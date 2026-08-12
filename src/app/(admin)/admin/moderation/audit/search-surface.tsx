import type { AuditSearchFilters } from "@/server/admin/moderation/audit-view";

// POLISH.8 GC-5 — the F-ADMIN-5 search surface's pure/presentational half,
// colocated beside the route it serves.
//
// WHY IT IS ITS OWN MODULE, and not exports on `page.tsx`. These symbols lived
// on the page so the tests could assert against the SHIPPED values rather than
// a re-typed lookalike (V-1) — the machine phase's §4 edit boundary named no
// colocated module, so there was nowhere else to put them. `next build`
// accepted it, but only because Next 16's Turbopack validator checks pages with
// a SUBTYPE constraint (`extends AppPageConfig<…>`), under which excess exports
// pass by construction. The legacy webpack `next-types-plugin` still shipped in
// the same node_modules does an EXACT check (`checkFields<Diff<{…known…},
// TEntry>>`) that would REJECT them. That is a bundler property, not a
// contract, and it is not something to be 34 days from go-live on.
//
// This module is deliberately SERVER-DEPENDENCY-FREE: its only import is a
// TYPE, so nothing here drags `server-only` into a consumer. `page.tsx` keeps
// the data reads, the auth gate and the route config.

export interface SearchParams {
	from?: string;
	to?: string;
	actionType?: string;
	marketId?: string;
	userId?: string;
	pseudonym?: string;
}

/** Build the AuditSearchFilters from raw search params (invalid dates dropped). */
export function parseFilters(sp: SearchParams): AuditSearchFilters {
	const filters: AuditSearchFilters = {};
	const from = sp.from ? new Date(`${sp.from}T00:00:00.000Z`) : null;
	const to = sp.to ? new Date(`${sp.to}T23:59:59.999Z`) : null;
	if (from && !Number.isNaN(from.getTime())) filters.from = from;
	if (to && !Number.isNaN(to.getTime())) filters.to = to;
	const trim = (v: string | undefined) => {
		const t = v?.trim();
		return t && t.length > 0 ? t : undefined;
	};
	const actionType = trim(sp.actionType);
	const marketId = trim(sp.marketId);
	const userId = trim(sp.userId);
	const pseudonym = trim(sp.pseudonym);
	if (actionType) filters.actionType = actionType;
	if (marketId) filters.marketId = marketId;
	if (userId) filters.userId = userId;
	if (pseudonym) filters.pseudonym = pseudonym;
	return filters;
}

/**
 * POLISH.8 S-6 (delta D17) — the supplied-but-unparseable date fields, in form
 * order.
 *
 * `parseFilters` above DROPS a malformed `from`/`to` on purpose: the query must
 * not throw on a hand-edited URL. The cost of that choice was invisible — the
 * operator received results UNFILTERED by a date they believed they had
 * applied, with nothing on screen saying so. This names the dropped fields so
 * the drop is legible.
 *
 * Pure, and it never alters the query. Parse semantics are UNCHANGED — the
 * decision is taken from `parseFilters`' OUTPUT, not re-derived; see the body.
 */
export function invalidDateFields(sp: SearchParams): string[] {
	// Derived from `parseFilters`' OUTPUT, never from a re-run of its decision.
	// "supplied but produced no filter" IS "was dropped", definitionally — so the
	// note cannot drift out of step with the query if either suffix or guard is
	// ever changed. Re-deriving the Number.isNaN test here agreed today and would
	// have failed silently in the worst direction: the note going quiet while the
	// predicate was still being dropped, i.e. the pre-S-6 defect restored.
	// (@code-reviewer M-2.)
	const applied = parseFilters(sp);
	const fields: string[] = [];
	if (sp.from && !applied.from) fields.push("From");
	if (sp.to && !applied.to) fields.push("To");
	return fields;
}

/**
 * Whether ANY predicate survived parsing — i.e. whether the F-ADMIN-5 search
 * actually runs. Exported so the note and the page share ONE expression of this
 * decision rather than two that can drift (the M-2 discipline).
 */
export function searchRan(sp: SearchParams): boolean {
	return Object.keys(parseFilters(sp)).length > 0;
}

/**
 * Renders nothing when every supplied date parsed — absence is the default.
 *
 * GC-1 — the note must never assert breadth it does not have. When the dropped
 * date was the ONLY filter supplied, `searching` is false and the page does not
 * run the search at all: it falls back to `loadModerationAuditFeed`, the
 * gate-block feed, which by construction holds NO `content_removed` and NO
 * `user_banned` rows. Saying only "the rows below are unfiltered by it" there
 * reads as "you are seeing everything" while the operator looks at a set that
 * structurally excludes what they searched for. So the fallback is stated.
 */
export function InvalidDateNote({
	fields,
	searchRan,
}: {
	fields: string[];
	searchRan: boolean;
}): React.ReactElement | null {
	if (fields.length === 0) return null;
	return (
		<p
			role="note"
			data-testid="invalid-date-note"
			className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-foreground"
		>
			<strong className="font-semibold">
				{fields.join(" and ")} date ignored.
			</strong>{" "}
			That value could not be read as a date, so it was NOT applied
			{searchRan
				? " — the rows below are unfiltered by it."
				: ". No search ran — it was the only filter supplied. The rows below are the default blocked-submissions feed, not audit-search results: content removals and user bans are never in it."}
		</p>
	);
}

/**
 * POLISH.8 S-8 (delta D06) — action-type examples the operator can ACTUALLY
 * match today. These are `mod_actions.reason` members: the only POPULATED side
 * of the F-ADMIN-5 union.
 *
 * The prior copy advertised `market.resolved`, which is an `EVENT_TYPES` value
 * living only in the `events` table — so NEITHER side of this union could ever
 * match it, and the form was advertising a query that provably returns nothing.
 *
 * ⚠ Downstream of D05's unmade ruling. If a writer later lands for the empty
 * union arm, or the spec repoints F-ADMIN-5 at `events`, this string changes
 * again. Shipping the currently-true copy is the defensible option meanwhile —
 * it is consistent with the note rendered below the search form.
 */
export const ACTION_TYPE_PLACEHOLDER =
	"content_removed · user_banned · track_b_blocked";
