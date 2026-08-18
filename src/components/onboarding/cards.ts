/**
 * The ratified onboarding-deck card set — SPEC.1 §21.9, and the copy register
 * `docs/design/ZUGZWANG-O1-DECK_copy-register_v1_0.md`.
 *
 * ⛔ THESE STRINGS WERE COPIED OUT OF THE REGISTER, NOT RETYPED, and
 * `tests/unit/onboarding/copy-drift.test.ts` asserts them back against it
 * byte-for-byte on every run. The register's own §1 explains why that matters:
 * the copy carries U+2019 `’`, U+2014 `—` and U+00B7 `·`, none of which an
 * ASCII keyboard produces, and a substituted ASCII apostrophe is a defect that
 * review does not catch at any font size a human reads a diff at. If you are
 * editing a string here, you are editing the wrong file — amend the register
 * and let the guard carry the change across.
 *
 * ⚠ TWO CARDS ARE INVARIANT TRIPWIRES, and the register records them as such.
 * The soulbound card's "It can't be bought, sold, gifted, or moved to another
 * account" is INV-2 in plain language, and the single-side card is INV-3 the
 * same way. Both are literally true of the product today. If either invariant
 * is ever weakened the card becomes a lie, so a proposal to change INV-2 or
 * INV-3 is a proposal to change this file.
 *
 * ⚠ ONE ARRAY, ONE FILTER — never two arrays. The re-show is the first-login
 * set minus one card, and two hand-maintained arrays drift the first time a
 * word changes in only one of them.
 */

export type OnboardingFigure =
	| "brand"
	| "identity"
	| "goal"
	| "voice"
	| "soulbound"
	| "side"
	| "reply";

export type OnboardingCard = {
	/** Also the React key — the seven figures are distinct by construction. */
	readonly figure: OnboardingFigure;
	readonly eyebrow: string;
	readonly title: string;
	readonly sub: string;
};

/**
 * The register's own identifier for the card the re-show drops. Named rather
 * than inlined so the omission rule reads as a rule at its one use site.
 */
export const RESHOW_OMITTED_EYEBROW = "WELCOME";

/** The token Card 2's ratified title carries in place of the viewer's name. */
export const PSEUDONYM_TOKEN = "{pseudonym}";

/**
 * Order is normative (register §2). Eyebrow scheme: `ZUGZWANG` ×1 ·
 * `WELCOME` ×1 · `THE GOAL` ×1 · `THE RULES` ×4.
 */
export const ONBOARDING_CARDS: readonly OnboardingCard[] = [
	{
		figure: "brand",
		eyebrow: "ZUGZWANG",
		title: "Knowledge first",
		sub: `True knowledge is manipulated and bound by money,
which makes humanity take wrong decisions without a rational debate.
The fate of humanity should depend on true knowledge and not money.

Zugzwang is a prediction market that runs like a social network for debate.

The prediction market gathers knowledge through incentive;
the debate allows human society to fight manipulation;
the social network spreads the truth freely.`,
	},
	{
		figure: "identity",
		eyebrow: "WELCOME",
		title: "You’re {pseudonym}",
		sub: "This pseudonym is your identity for the length of the experiment. The experiment has 8 markets with unique flavours and defined resolutions. The experiment runs from 15th September 2026 to 5th November 2026. Dharma is your betting instrument for raising arguments in any of the 8 markets.",
	},
	{
		figure: "goal",
		eyebrow: "THE GOAL",
		title: "Knowledge, at scale, beats capital.",
		sub: "True knowledge (K) brings informed people together (n), and the crowd that understands the truth can outweigh the money (C) betting on a false outcome. That’s the whole bet: K · n > C.",
	},
	{
		figure: "voice",
		eyebrow: "THE RULES",
		title: "No stake, no voice",
		sub: "Every argument here is a bet. To post or reply, you back your view with Dharma — so every voice in the debate has real skin in the game. Speaking is staking.",
	},
	{
		figure: "soulbound",
		eyebrow: "THE RULES",
		title: "Soulbound reputation",
		sub: "Your Dharma is your reputation, and it’s yours alone. It can’t be bought, sold, gifted, or moved to another account. Everyone here starts with exactly the same amount — what separates you is what you do with it.",
	},
	{
		figure: "side",
		eyebrow: "THE RULES",
		title: "Single-side binding",
		sub: "You can hold a position on only one side of a market at a time, and your side locks to your words the moment you post. To switch, sell your whole position first, then re-enter — you can’t argue both sides at once.",
	},
	{
		figure: "reply",
		eyebrow: "THE RULES",
		title: "Support / Counter",
		sub: "Replying is betting, too. Reply with Support to stake on a post’s side, or Counter to back the other side. Every reply is an argument with Dharma behind it — that’s how the debate moves.",
	},
];

/**
 * The About / RULES re-show: the first-login set minus the WELCOME card
 * (register §3, SPEC.1 §21.9).
 *
 * The reason it is dropped is not length. A pseudonym reveal and an
 * experiment-window announcement are FIRST-LOGIN facts; on a voluntary
 * re-visit they are noise, and WELCOME is the one card whose content is not
 * reference material. Dropping it also happens to remove the only card with a
 * viewer dependency, which is what makes the re-show safe to mount for a
 * SIGNED-OUT visitor on `/sign-in` — it has nothing to interpolate.
 */
export function reshowCards(): readonly OnboardingCard[] {
	return ONBOARDING_CARDS.filter(
		(card) => card.eyebrow !== RESHOW_OMITTED_EYEBROW,
	);
}

/**
 * Card 2's title interpolated for the viewer.
 *
 * ⚠ THE NULL BRANCH IS NOT DEFENSIVE PADDING. `pseudonym` is typed
 * `string | null` and a mid-signup viewer can carry null — unreachable in
 * practice, because the ADR-0004 session hook refuses a session until it is
 * non-NULL and this gate only runs for a viewer with a session. But the type
 * admits it, and the failure mode if the component assumed otherwise is the
 * literal string "You’re null" rendered as a welcome. Dropping the name is the
 * graceful half of that trade.
 */
export function cardTitle(
	card: OnboardingCard,
	pseudonym: string | null,
): string {
	if (!card.title.includes(PSEUDONYM_TOKEN)) return card.title;
	return card.title.replace(PSEUDONYM_TOKEN, pseudonym ?? "").trimEnd();
}
