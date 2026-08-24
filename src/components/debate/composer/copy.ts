import { BET_MAX_STAKE } from "@/server/config/limits";
import { formatDharma } from "../format";

/**
 * UI.A3 slice 2 — the composer copy surface (SG-6). Every string here is
 * either (a) canon §6 / d5 / W2.11-kit VERBATIM (curly apostrophes preserved),
 * (b) the operator-ratified embedded copy batch C1/C2/C3 (web-authored
 * 2026-07-17, applied verbatim), or (c) an AUTHORED-AT-EXECUTE surface the
 * design set does not carry — FOUR exist, each marked at its site and
 * registered in docs/logs/UI-A3.md for the Gate C web read: `rateLimited`
 * (no P4 429 string) · `marketClosed` (the kit's race strip covers
 * `market_resolving` only) · `transient` (a composition of two kit-verbatim
 * fragments) · the image attach-failure strip's no-heading convention.
 * Numeric fragments resolve at render from limits.ts constants / viewer
 * fields, never hardcoded literals (Đ figures grouped per "Max Đ 10,000 per
 * bet"). CC never invents argument-adjacent copy.
 */

/**
 * `To win Đ 1 → Đ 2.63x` — the unit-to-win multiplier: truncate the shares
 * string to 2 fractional digits (pure string ops, no rounding, no floats)
 * and append `x`.
 */
export function formatMultiplier(value: string): string {
	const [intPart = "0", fracPart = ""] = value.split(".");
	const frac = fracPart.slice(0, 2).replace(/0+$/, "");
	return frac === "" ? `${intPart}x` : `${intPart}.${frac}x`;
}

/** Canon §6 — the composer + slot-header register (verbatim). */
export const COMPOSER_COPY = {
	header: "Place your Đ BET",
	argumentLabel: "Your argument — required",
	optionalSuffix: " · optional",
	submit: "PLACE Đ BET",
	amountLabel: "Amount",
	toWinLabel: "To win",
	yourPositionLabel: "Your position",
	noPosition: "No active position",
	sell: "Sell",
	close: "×",
} as const;

/** W2.10-D — the over-cap strip (ruling 2: "Max Đ N per bet"). */
export function overCapStrip(): string {
	return `Max Đ ${formatDharma(BET_MAX_STAKE)} per bet`;
}

/** d5 auth-gate slot variant (verbatim). */
export const AUTH_GATE_COPY = {
	heading: (side: "YES" | "NO") => `Sign in to bet ${side}`,
	body: "Reading is public. Placing a bet needs an account — every bet carries an argument, staked in Dharma.",
	signUp: "Sign up",
	signIn: "Sign in",
	micro: "No stake, no voice.",
} as const;

/**
 * C1 — the F-2 protective landing (embedded batch, verbatim; the dedicated
 * P3 state for `error_idempotency_key_reused`).
 */
export const C1_PROTECTIVE_LANDING = {
	title: "Your earlier submission may have completed.",
	body: "Refreshing to show the latest — check your position before placing again. Your argument is preserved.",
} as const;

/**
 * C2 — floor-above-balance disabled composer (embedded batch, verbatim;
 * {floor} = the surface's BET_MIN_STAKE_*, {spendable} = viewer.spendableToday).
 */
export function c2Sentence(args: { floor: string; spendable: string }): string {
	return `Đ ${formatDharma(args.spendable)} spendable today — below the Đ ${formatDharma(args.floor)} minimum.`;
}

/**
 * C3 — the F-3 opposite-side disabled tooltip + aria text (embedded batch,
 * verbatim; sides render CAPS).
 */
export function c3OppositeSide(args: {
	held: "YES" | "NO";
	resulting: "YES" | "NO";
}): string {
	return `You hold ${args.held}. Exit your position to bet ${args.resulting}.`;
}

/** W2.11 kit strips (verbatim, incl. curly apostrophes) + the two authored strings. */
export const STATE_COPY = {
	trackB: {
		title: "This argument can’t be posted as written",
		body: "Please revise it to meet our community standards and try again.",
	},
	gateDown: {
		title: "We couldn’t check your argument just now",
		body: "Try again in a few seconds.",
	},
	waitInFlight: "Still checking your last submission — one moment.",
	resolving: {
		title: "This market is now resolving",
		body: "No further bets can be placed.",
	},
	/** AUTHORED at execute (no kit string for Closed) — flagged for Gate C. */
	marketClosed: {
		title: "This market is closed.",
		body: "No further bets can be placed.",
	},
	generic: {
		title: "We couldn’t place that bet",
		body: "Your position may have changed. Refresh and try again.",
	},
	/** Kit-fragment composition (generic heading + gate-down body) — flagged. */
	transient: {
		title: "We couldn’t place that bet",
		body: "Try again in a few seconds.",
	},
	frozen: {
		lead: "The experiment has concluded.",
		body: "Markets are frozen and read-only. Thank you for taking part.",
	},
} as const;

/** AUTHORED at execute (the P4 429 banner has no design-set string) — flagged for Gate C. */
export function rateLimitedBanner(secondsLeft: number): string {
	return `Too many requests. Try again in ${secondsLeft}s.`;
}

/**
 * The EMPTY image slot's contents — the thesis figure that now fills the 4:5
 * box, replacing a box that held nothing.
 *
 * ⛔ PROVENANCE PER STRING, because these do not share one. Two are carried,
 * one is new, and lumping them under a single claim is the `V-3` shape this
 * file's own docblock exists to prevent:
 *   · `eyebrow` + `headline` — **O1 deck register VERBATIM**, Card 3
 *     (`docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md:131,137`), already
 *     shipped at `src/components/onboarding/cards.ts:93-94`. A participant has
 *     read both during onboarding; the composer repeats the thesis rather than
 *     restating it in new words.
 *   · `action` — **AUTHORED AT EXECUTE. Not in canon.** Registered here for the
 *     Gate C web read, alongside the four already named at the top of this file.
 *
 * ⚠ `action` IS AN INSTRUCTION, NOT A CAPTION, and the distinction is why it is
 * separated from the two above rather than treated as a third line of the same
 * block. The canon §6 caption `Shown whole · any orientation` is deleted, so
 * this is the ONLY text telling a participant the box is clickable. It carries
 * the affordance alone — which is also why it is Title Case while the two lines
 * above it are a sentence: it reads as a control's label, not as more prose.
 */
export const EMPTY_SLOT_COPY = {
	eyebrow: "THE GOAL",
	headline: "Knowledge, at scale, beats capital.",
	/**
	 * The SAME sentence, broken for the 4:5 column. SVG does not wrap text, so
	 * the break has to be authored — but a break is TYPOGRAPHY, not copy, and
	 * writing the halves as their own strings is how a canon sentence quietly
	 * becomes two non-canon ones. `headline` above stays the single source of
	 * truth and `empty-slot-figure.test.tsx` pins `headlineLines.join(" ")`
	 * against it, so any edit to one that is not made to the other reddens.
	 * The break falls at the sentence's own clause boundary, not mid-phrase.
	 */
	headlineLines: ["Knowledge, at scale,", "beats capital."],
	action: "Add Image",
} as const;

/** W2.11 P2 modal contents (verbatim). */
export const SUSPENDED_COPY = {
	trackA: {
		title: "Account suspended",
		body: "This submission broke our standards and your account has been suspended. You can still view markets, but can no longer post, reply, or trade. This decision is final.",
		action: "OK",
	},
	banned: {
		title: "Account suspended",
		body: "Your account has been suspended. You can view markets but can no longer post, reply, or trade. This decision is final.",
		action: "OK",
	},
} as const;
