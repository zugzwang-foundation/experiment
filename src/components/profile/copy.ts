/**
 * UI-A5 Profile surface copy — the OQ-7 web-authored FINAL strings, embedded
 * verbatim in ONE module (CLAUDE.md §3: CC never invents product copy; this is
 * the web-supplied batch carried in the execute kickoff). Render tests key
 * `data-testid`, never these strings. Existing strings reused as shipped (the
 * SellModule sell hint, the debate-view removed-stub constant) are NOT
 * re-authored here.
 */
export const PROFILE_COPY = {
	chip: {
		owner: "Viewing as owner",
		visitor: "Public view",
	},
	// ⚠ POLISH.5 Gate C S-1 — a THIRD founder-authored member beyond NEW-1's
	// two, ratified 2026-08-15. It is filter-scoped and deliberately NOT
	// owner/visitor split: the owner/visitor pair above differ only by their
	// CTA, and this state has none. ⛔ Reusing `positionsOwner` here would
	// render "No positions yet" to someone whose positions the filter is
	// hiding — a lying empty state that every test would pass.
	// ⚠⚠ POSREV-1 RF-14 — THE EMPTY STATES ARE PER-TAB AND AWARE OF EACH OTHER.
	// The shipped copy told someone who had traded and fully exited that they had
	// never traded, because there was only ever ONE empty message for a surface
	// that now has two tabs. `openEmpty` and `closedEmpty` are founder-supplied
	// verbatim in the POSREV-1 kickoff — carriage, never authoring (CLAUDE.md §3);
	// `positionsOwner` is REUSED unchanged for "both tabs empty", which is what
	// the kickoff specifies byte-for-byte.
	//
	// ⚠ `positionsFiltered` IS NOW UNREACHABLE AND IS DELIBERATELY KEPT. The
	// market options are built FROM the rows, so every option has at least one
	// row, and every row lands in exactly one tab — so at least one tab is always
	// non-empty and the three cases above cover the space. It is web-authored
	// ratified copy, and what POSREV-1 removed is a RENDER, not a string: the same
	// posture `PROFILE_COPY.chip` has carried since PROFILE REFINEMENT R5.
	empty: {
		positionsOwner: "No positions yet. Stake a side to open your record.",
		positionsVisitor: "No positions yet.",
		argumentsOwner: "No arguments yet — every bet carries one.",
		argumentsVisitor: "No arguments yet.",
		positionsFiltered: "No positions match this filter.",
		openEmpty:
			"No open arguments. Your closed arguments are in the Closed tab.",
		closedEmpty: "No closed arguments yet.",
	},
	graph: {
		empty: "Nothing to plot yet.",
	},
	// Item 9 (P5-D12) — the two members arrive TOGETHER. `load` is TRIMMED at
	// its sentence boundary (was "Couldn't load this profile. Retry.") because
	// the retry promise moves out of the body and onto a real control; `action`
	// is CREATED, and its value is a byte-copy of the shipped, ratified
	// `m/[slug]/error.tsx` label. Both are carriage, never authoring
	// (CLAUDE.md §3).
	error: {
		load: "Couldn't load this profile.",
		action: "Try again",
	},
} as const;

export const GRAPH_COPY = {
	legend: {
		networth: "Net worth",
		freedharma: "Free Dharma",
	},
	aria: {
		expand: "Expand Dharma graph",
		close: "Close graph",
		// Gate C OQ-7 batch additions (verbatim): the graph-overlay control names.
		filterMarket: "Filter by market",
		overlay: "Dharma graph",
	},
	filter: {
		cumulative: "Cumulative",
	},
} as const;
