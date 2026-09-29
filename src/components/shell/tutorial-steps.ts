/**
 * Content for the header-triggered product tutorial (`TutorialControl.tsx`).
 * A plain data module — no React, no server data — same separation
 * `onboarding/cards.ts` keeps for the RULES deck: content lives here, the
 * engine that plays it lives beside it.
 *
 * Each step names a CSS selector for the real control it explains. Most
 * reuse `data-testid`s the app already carries; a handful use
 * `data-tutorial="..."` attributes added specifically for this tour, on
 * controls that had no stable locator (see `TutorialGesture` targets: the
 * market question, the odds readout, the Buy button, and the RULES
 * button).
 *
 * Manual-trigger only: nothing here auto-shows, and nothing writes a
 * "seen" marker. The tour always starts at step 0 when opened.
 */

export type TutorialGesture = "tap" | "point-hold" | "swipe";

export type TutorialStep = {
	id: string;
	/** Groups steps for the chapter title card and the progress dots. */
	chapter: string;
	/** CSS selector for the control this step explains. */
	selector: string;
	/** The hint text. Plain product voice — matches `src/lib/copy/glossary.ts`. */
	text: string;
	/** Which scribble the pointer draws: a tap circle, an underline, or a swipe. */
	gesture: TutorialGesture;
	/**
	 * When set, the engine reads this step's target element's `href` while
	 * it's on screen and drives the actual page transition itself when the
	 * viewer clicks Next — "market" navigates there immediately (Discovery
	 * -> a market page), "profile" is banked and spent later, the moment
	 * the tour reaches the first step of the "Your profile" chapter. Real
	 * navigation, not a simulated screen: the same `next/navigation` router
	 * the rest of the app uses.
	 */
	captureHrefFor?: "market" | "profile";
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
	// ---- Get oriented ----
	{
		id: "rules-button",
		chapter: "Get oriented",
		selector: '[data-tutorial="rules-button"]',
		text: "The full rules, any time — this reopens them without losing your place.",
		gesture: "tap",
	},
	{
		id: "dharma-cluster",
		chapter: "Get oriented",
		selector: '[data-testid="dharma-cluster"]',
		text: "Balance is what you can spend today. Portfolio is what your open bets are worth right now.",
		gesture: "point-hold",
	},
	{
		id: "identity-chip",
		chapter: "Get oriented",
		selector: '[data-testid="identity-chip-link"]',
		text: "That's you. This tour will bring you to your profile later — Next keeps going for now.",
		gesture: "tap",
		captureHrefFor: "profile",
	},
	// ---- Find a market ----
	{
		id: "hero-panels",
		chapter: "Find a market",
		selector: '[data-testid="hero-panels"]',
		text: "The featured market, with its live price chart — how the crowd's guess has moved over time.",
		gesture: "point-hold",
	},
	{
		id: "market-card",
		chapter: "Find a market",
		selector: '[data-testid="market-card"]',
		text: "Each card is a market. The bar shows the current YES/NO split, and the line under it is how much Dharma is staked so far. Next opens its debate.",
		gesture: "tap",
		captureHrefFor: "market",
	},
	// ---- Read the market ----
	{
		id: "market-question",
		chapter: "Read the market",
		selector: '[data-tutorial="market-question"]',
		text: "This is the question being predicted — everything below it is people arguing and betting on how it resolves.",
		gesture: "point-hold",
	},
	{
		id: "resolver-cards",
		chapter: "Read the market",
		selector: '[data-testid="resolver-cards"]',
		text: "Who resolves this market, and when. Read this before betting on anything time-sensitive.",
		gesture: "point-hold",
	},
	{
		id: "column-scroll",
		chapter: "Read the market",
		selector: '[data-testid="column-scroll"]',
		text: "YES arguments on one side, NO on the other. Each side scrolls through its own arguments one at a time.",
		gesture: "swipe",
	},
	// ---- Two ways to bet ----
	{
		id: "market-odds",
		chapter: "Two ways to bet",
		selector: '[data-tutorial="market-odds"]',
		text: "The current price — roughly how likely the crowd thinks this side is, right now.",
		gesture: "point-hold",
	},
	{
		id: "buy-button",
		chapter: "Two ways to bet",
		selector: '[data-tutorial="buy-button"]',
		text: "Bet YES or Bet NO starts a brand new argument — you write your own case for a side and back it with a bet.",
		gesture: "tap",
	},
	{
		id: "support-counter",
		chapter: "Two ways to bet",
		selector: '[data-testid="card-trigger-support"]',
		text: "Support and Counter, right beside each other on a post: Support backs that argument's side, Counter bets the opposite. Every bet here comes with your own written argument.",
		gesture: "tap",
	},
	{
		id: "aggregate-footer",
		chapter: "Two ways to bet",
		selector: '[data-testid="aggregate-footer"]',
		text: "How much is staked backing this argument versus against it — computed from real bets, never a plain vote.",
		gesture: "point-hold",
	},
	// ---- Place the bet ----
	{
		id: "composer-argument",
		chapter: "Place the bet",
		selector: '[data-testid="mirror-title"]',
		text: "Your argument — required. No bet here goes through without one.",
		gesture: "point-hold",
	},
	{
		id: "composer-stake",
		chapter: "Place the bet",
		selector: '[data-testid="mirror-stake-bar"]',
		text: "Your stake. Đ 10 minimum to start a new argument, Đ 50 to reply to one, up to Đ 250 per bet.",
		gesture: "point-hold",
	},
	{
		id: "composer-to-win",
		chapter: "Place the bet",
		selector: '[data-testid="mirror-to-win"]',
		text: "What you'd collect if this side wins — it updates live as you type your stake.",
		gesture: "point-hold",
	},
	{
		id: "composer-submit",
		chapter: "Place the bet",
		selector: '[data-testid="mirror-submit"]',
		text: "This is the button that places it. We won't press it for you — try it with a small amount whenever you're ready.",
		gesture: "tap",
	},
	// ---- Your profile ----
	{
		id: "identity-card",
		chapter: "Your profile",
		selector: '[data-testid="identity-card"]',
		text: "Your public profile — the pseudonym and identity everyone sees you argue and bet under.",
		gesture: "point-hold",
	},
	{
		id: "profile-tiles",
		chapter: "Your profile",
		selector: '[data-testid="profile-tiles"]',
		text: "Your scoreboard: everything you've argued, and what it's worth.",
		gesture: "point-hold",
	},
	{
		id: "positions-table",
		chapter: "Your profile",
		selector: '[data-testid="positions-panel"]',
		text: "Every market you've bet on, open or closed, in one place.",
		gesture: "point-hold",
	},
	{
		id: "position-sell",
		chapter: "Your profile",
		selector:
			'[data-testid^="tile-sell-"]:not([data-testid^="tile-sell-amount-"])',
		text: "Sell — exit a position early. It's the one action here that needs no argument.",
		gesture: "tap",
	},
] as const;

/** Ordered, de-duplicated chapter names, for the title card and progress dots. */
export const TUTORIAL_CHAPTERS: readonly string[] = Array.from(
	new Set(TUTORIAL_STEPS.map((s) => s.chapter)),
);

export function chapterNumberFor(stepIndex: number): number {
	return TUTORIAL_CHAPTERS.indexOf(TUTORIAL_STEPS[stepIndex].chapter) + 1;
}

export function isFirstStepOfChapter(stepIndex: number): boolean {
	return (
		stepIndex === 0 ||
		TUTORIAL_STEPS[stepIndex].chapter !== TUTORIAL_STEPS[stepIndex - 1].chapter
	);
}
