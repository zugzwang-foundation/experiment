import "server-only";

import type { marketStatusEnum } from "@/db/schema/markets";

import { MarketTransitionError } from "./errors";

/**
 * The market lifecycle status, DERIVED from the built `market_status` pgEnum so
 * the machine's value set cannot drift from the DB (plan "Status union"). The
 * seven states of SPEC.1 §6.1:
 * Draft | Open | Closed | Resolving | Resolved | Voided | Frozen.
 */
export type MarketStatus = (typeof marketStatusEnum.enumValues)[number];

/** Why a status transition was rejected. Handlers map these to SPEC.1 §15 (ENGINE.7/9). */
export type TransitionRejection = "illegal_edge" | "deadline_not_reached";

/** A status-edge outcome: the new status on success, a typed reason on rejection. */
export type TransitionResult =
	| { ok: true; to: MarketStatus }
	| { ok: false; reason: TransitionRejection };

/** The B8 deadline-extension field-guard outcome (NOT a status edge). */
export type DeadlineCheckResult =
	| { ok: true }
	| { ok: false; reason: "deadline_extension" };

/**
 * The SPEC.1 §6.1 directed graph — the single source of truth for status
 * legality (plan F-7). `as const satisfies Record<MarketStatus, …>`
 * compile-guards exhaustive key coverage, so the enum and the graph cannot
 * silently diverge. The eight legal edges; `Frozen` is absorbing (terminal).
 */
const LEGAL_TRANSITIONS = {
	Draft: ["Open"],
	Open: ["Closed", "Voided"],
	Closed: ["Resolving", "Voided"],
	Resolving: ["Resolved"],
	Resolved: ["Frozen"],
	Voided: ["Frozen"],
	Frozen: [],
} as const satisfies Record<MarketStatus, readonly MarketStatus[]>;

/**
 * Pure §6.1 graph membership: is `from → to` a legal status edge? Total over the
 * `MarketStatus` domain. An unknown `from` (TS-impossible; reachable only from a
 * JS caller or a corrupt row) is the defensive `MarketTransitionError` (plan
 * §5) — never a silent `false`.
 */
export function canTransition(from: MarketStatus, to: MarketStatus): boolean {
	const edges: readonly MarketStatus[] | undefined = LEGAL_TRANSITIONS[from];
	if (edges === undefined) {
		throw new MarketTransitionError(`unknown market status: ${from}`);
	}
	return edges.includes(to);
}

/**
 * Discriminated wrapper over `canTransition` for handlers — the rejection reason
 * feeds the SPEC.1 §15 mapping (ENGINE.7/9). `.ok` equals `canTransition(from,
 * to)` over the entire typed domain (the totality test pins it). No clock
 * dimension here; the one clock-guarded edge is `closeOnDeadline`.
 */
export function transition(
	from: MarketStatus,
	to: MarketStatus,
): TransitionResult {
	if (canTransition(from, to)) {
		return { ok: true, to };
	}
	return { ok: false, reason: "illegal_edge" };
}

/**
 * The single clock-guarded edge, `Open → Closed` (§6.1 :210 — "deadline
 * reached", hard cutoff no grace). Pure over caller-supplied instants: it NEVER
 * reads a clock (`now` is an argument). Off-`Open` ⇒ `illegal_edge` (the guard
 * fires only from `Open`); `now < deadline` ⇒ `deadline_not_reached`;
 * `now ≥ deadline` (the `==` instant included) ⇒ `Closed`.
 */
export function closeOnDeadline({
	status,
	now,
	resolutionDeadline,
}: {
	status: MarketStatus;
	now: Date;
	resolutionDeadline: Date;
}): TransitionResult {
	if (status !== "Open") {
		return { ok: false, reason: "illegal_edge" };
	}
	if (now.getTime() < resolutionDeadline.getTime()) {
		return { ok: false, reason: "deadline_not_reached" };
	}
	return { ok: true, to: "Closed" };
}

/**
 * B8 field-guard (SPEC.1 §6.1 :233): a `resolution_deadline` change is legal
 * only if it does NOT extend. `proposed > current` ⇒ `deadline_extension`;
 * shrink or unchanged (`proposed ≤ current`) ⇒ ok. NOT a status transition —
 * its callers (market-edit / creation handlers) are later strata.
 */
export function assertDeadlineNotExtended({
	current,
	proposed,
}: {
	current: Date;
	proposed: Date;
}): DeadlineCheckResult {
	if (proposed.getTime() > current.getTime()) {
		return { ok: false, reason: "deadline_extension" };
	}
	return { ok: true };
}
