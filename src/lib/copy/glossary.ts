/**
 * Zugzwang glossary — the one-line gloss for every Zugzwang-specific term a
 * participant meets in the UI.
 *
 * Every string here is founder-ratified and derived from a spec:
 *   SPEC.1 §2 (glossary) · SPEC.1 §6.1 (lifecycle) · SPEC.1 §10 (economy)
 *   RANKING.md §5.2 (badge vocabulary) · docs/…/zugzwang.md (reader voice)
 *
 * ⚠ Do not edit a string here without a founder ruling. These are shipped copy
 * for a public campaign, not developer-facing text.
 *
 * House pattern: `Term — gloss`, em dash, sentence case, no terminal period,
 * ≤ ~75 characters so it survives an unstyled render.
 */

export const GLOSSARY = {
	// — Dharma and the header cluster ————————————————————————
	dharma:
		"Đ — Dharma, the reputation you stake. Earned here, never transferable",
	portfolio: "Portfolio — Đ tied up in positions you still hold",
	balance: "Balance — Đ you can stake right now",

	// — Reply-as-bet ————————————————————————————————————————
	support: "Support — you agree, and bet the same side this author did",
	counter: "Counter — you disagree, and bet the opposite side",

	// — Sides and price ————————————————————————————————————
	side: "YES or NO — the two sides of this question. Every bet picks one",
	priceYes:
		"The market's current estimate that this resolves yes. Click to bet YES",
	priceNo:
		"The market's current estimate that this resolves no. Click to bet NO",

	// — Author follow-through (SPEC.1 §2, Flipped / Exited marker) ————
	flipped:
		"Flipped — this author now holds the opposite side to the one they argued",
	exited: "Exited — this author has sold out and holds no position here",
	sold: "Sold — this stake was sold; the author no longer holds it",

	// — Stake and position ————————————————————————————————
	stakedMarket:
		"staked — total Đ committed across every argument in this market",
	stakedOwn: "Staked — what you paid for the shares you still hold",
	currentValue: "Current — what those shares would return if you sold now",
	position: "Position — the side you hold here, and what it's worth now",
	toWin: "To win — what Đ 1 pays back if this side wins, at today's price",

	// — Profile position tabs (NOT the market lifecycle states below) ————
	tabOpen: "Open — markets where you still hold a position",
	tabClosed: "Closed — positions you've sold, and markets that resolved",

	// — Market lifecycle (SPEC.1 §6.1) ————————————————————
	lifecycleOpen: "Open — trading is live. You can bet and reply",
	lifecycleClosed:
		"Closed — trading has stopped. The outcome is not settled yet",
	lifecycleResolving: "Resolving — the outcome is being determined",
	lifecycleResolved: "Resolved — the outcome is settled and payouts are done",
	lifecycleVoided:
		"Voided — this market was cancelled and stakes were returned",
	lifecycleFrozen:
		"Frozen — the experiment has concluded. Everything is read-only",

	// — Lane-dominance badges (RANKING.md §5.2) ————————————
	laneMostDebated:
		"Most Debated — far more replies than any other argument here",
	laneHighestStakes:
		"Highest Stakes — more Đ committed than any other argument here",
	laneContested:
		"Contested — heavily argued and close to evenly split. Still live",

	// — Export ————————————————————————————————————————————
	downloadMd:
		"Download .md — this whole debate as a plain text file, yours to keep",
	downloadStub: "Download — per-argument export isn't available yet",

	// — Identity ——————————————————————————————————————————
	pseudonym: "Your permanent name — auto-assigned, not chosen, not editable",
} as const;

/**
 * Strings already shipped inline in the global header, moved here unchanged so
 * they are in one place and under test. VERBATIM — do not re-word.
 */
export const HEADER_GLOSSARY = {
	visitorCounter: "Total page views — not participants",
	radio: "Radio — not yet live",
	rules: "Rules — how it works",
	github: "Star the repo on GitHub",
} as const;
