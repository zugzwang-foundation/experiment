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

/**
 * FF-1 / ADR-0058 / D-51 R5 — the friendly-fire switch register, VERBATIM from
 * the ruling (`design-language.md` §3.1 "Friendly-fire switch"; the brief's
 * RF-8). The helper line names the side being BOUGHT, which for a Support reply
 * is the parent's side. Nothing here is authored at execute.
 *
 * `gloss` — FF-1 CLOSE-1 R-A15 (2026-09-22): the switch label's hover gloss,
 * verbatim from that ruling, side-parameterised like `helper`. It mounts only
 * at and above 640px, by `InfoTip`'s own tier gate; below it the helper line
 * is the meaning. The TAG's (static) gloss is `FRIENDLY_FIRE_TAG_GLOSS` in
 * `lib/copy/glossary.ts`, beside the Flipped / Exited glosses it mirrors.
 */
export const FRIENDLY_FIRE_COPY = {
	label: "Friendly fire",
	helper: (side: "YES" | "NO") =>
		`Contest this argument without leaving your side. Your stake still backs ${side}.`,
	gloss: (side: "YES" | "NO") =>
		`Friendly fire: a Support reply that backs the side but contests this argument. The bet itself is unchanged — your stake still backs ${side}.`,
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

/**
 * D-52 R1 — the own-post disabled tooltip + aria text, verbatim from the
 * ruling. It fills the slot C3 fills and wins over it: nobody replies to their
 * own post on either side, so both triggers are foreclosed whatever is held.
 */
export const OWN_POST_COPY = "You can't reply to your own post.";

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

/**
 * MIRROR-1 — the Mirror composer's NEW strings, verbatim from the founder-ratified
 * register (`docs/design/composer-mirror.md`, 2026-09-23). Every other string the
 * Mirror draws is an existing constant above, reused — `Your argument — required`
 * becomes the title's placeholder, the relation header and `PLACE Đ BET` are
 * `COMPOSER_COPY`'s, and today's notices and strips are unchanged.
 */
export const MIRROR_COPY = {
	/** RF-3 — the author row's last field: this card is not posted yet. */
	draft: "Draft",
	/** RF-5 — the detail toggle's three labels. */
	addDetail: "Add detail",
	editDetail: "Edit detail",
	showImage: "Show image",
	/**
	 * RF-6 — the empty frame's invitation and its caption. The caption is the one
	 * word `Optional` since MIRROR-2 (it read `Optional · shown whole · any
	 * orientation`); how a picture is fitted is shown by the frame once one is in.
	 */
	addImage: "Add an image",
	addImageCaption: "Optional",
	/** RF-6 — the attached image's replace control. */
	replace: "Replace",
	/** RF-6 — the detail view's placeholder. */
	detailPlaceholder: "Add evidence, sources, reasoning",
	/** RF-7 — the stake bar's limit labels (`Min Đ {floor}` / `Max Đ {cap}`). */
	minLabel: "Min",
	maxLabel: "Max",
	/** RF-4 — the title counter, shown only in the last ten characters. */
	left: (n: number) => `${n} left`,
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
