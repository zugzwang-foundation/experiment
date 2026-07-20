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
	empty: {
		positionsOwner: "No positions yet. Stake a side to open your record.",
		positionsVisitor: "No positions yet.",
		argumentsOwner: "No arguments yet — every bet carries one.",
		argumentsVisitor: "No arguments yet.",
	},
	graph: {
		empty: "Nothing to plot yet.",
	},
	error: {
		load: "Couldn't load this profile. Retry.",
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
	},
	filter: {
		cumulative: "Cumulative",
	},
} as const;
