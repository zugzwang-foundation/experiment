/**
 * Content for the header-triggered product tutorial (`TutorialControl.tsx`).
 * A plain data module — no React, no server data — same separation
 * `onboarding/cards.ts` keeps for the RULES deck: content lives here, the
 * engine that plays it lives beside it.
 *
 * Each step names a CSS selector for the real control it explains. Most
 * reuse `data-testid`s the app already carries; a handful use
 * `data-tutorial="..."` attributes added specifically for this tour, on
 * controls that had no stable locator (the market question, the odds
 * readout, the Bet button, the RULES button).
 *
 * Manual-trigger only: nothing here auto-shows, and nothing writes a
 * "seen" marker. The tour always starts at step 0 when opened.
 */

export type TutorialGesture = "tap" | "point-hold";

export type TutorialStep = {
	id: string;
	/** Groups steps for the chapter title card and the progress dots. */
	chapter: string;
	/** CSS selector for the control this step explains and spotlights. */
	selector: string;
	/**
	 * A second control to spotlight ALONGSIDE `selector`, as one combined
	 * box — for Support/Counter, which are explained together and sit right
	 * next to each other, so highlighting only one understates the other.
	 */
	selectorSecondary?: string;
	/** The hint text. Plain product voice — matches `src/lib/copy/glossary.ts`. */
	text: string;
	/** Which scribble the pointer draws: a tap circle or an underline. */
	gesture: TutorialGesture;
	/**
	 * What Next does on top of just advancing:
	 *  - "navigate-now": read `selector`'s `href` and push there immediately
	 *    (Discovery -> a market page) — safe because it only opens a page.
	 *  - "bank-profile": read `selector`'s `href` and hold it for later,
	 *    spent automatically on entering "Your profile".
	 *  - "click": dispatch a real click on `clickSelector` (or `selector` if
	 *    unset; `selectorSecondary` as a fallback target if the first pick is
	 *    disabled) when leaving this step. Used for Buy and the Support/
	 *    Counter pair too, not just money-safe controls like the composer's
	 *    Close: `TutorialControl.tsx`'s `isClickable` checks `disabled` /
	 *    `aria-disabled` immediately before the click, so a control that
	 *    can't currently do anything (the viewer's own open position makes
	 *    one side unavailable) is left alone rather than clicked blind.
	 *    Position Sell is the one control still left as a real, viewer-only
	 *    tap — a sell is a one-step exit with no read-back to confirm before
	 *    acting, unlike a bet, which opens into the composer for review.
	 */
	advance?: "navigate-now" | "bank-profile" | "click";
	/** Only for `advance: "click"`, when the thing to click isn't `selector` itself. */
	clickSelector?: string;
	/**
	 * True on a step that was arrived at by a page navigation — the first
	 * step of "Read the market" (reached by `market-card`'s "navigate-now")
	 * and the first step of "Your profile" (reached by the banked
	 * "bank-profile" href). Pressing Back FROM one of these needs to reverse
	 * that navigation as well as move the step index — otherwise Back
	 * leaves the viewer on the wrong page entirely, pointing at a step
	 * whose target only exists on the page Next came from. See
	 * `TutorialControl.tsx`'s `back()` for how the reversal itself works.
	 */
	enteredViaNavigation?: boolean;
	/**
	 * A static illustrative screenshot, shown instead of the generic "Nothing
	 * here yet" message when this step's real target can't be found AND the
	 * step is one where that's expected for a perfectly normal reason — a
	 * brand-new account has no positions or arguments yet, not a target that
	 * merely hasn't loaded. Used only by the four "Your profile" steps, which
	 * are the one chapter guaranteed to be empty for every first-time viewer.
	 */
	referenceImage?: string;
	/**
	 * An additional selector that must ALSO resolve to something for this
	 * step to count as found. For a step whose `selector` is a container
	 * that renders even when empty (the positions panel keeps its own
	 * section and head, with "No positions yet" drawn inside, rather than
	 * disappearing) — checking only `selector` would highlight an empty
	 * panel as if it were real data to point at. `requiresSelector` names
	 * something that only exists once there's an actual row inside.
	 */
	requiresSelector?: string;
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
		advance: "bank-profile",
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
		advance: "navigate-now",
	},
	// ---- Read the market ----
	{
		id: "market-question",
		chapter: "Read the market",
		selector: '[data-tutorial="market-question"]',
		text: "This is the question being predicted — everything below it is people arguing and betting on how it resolves.",
		gesture: "point-hold",
		enteredViaNavigation: true,
	},
	{
		id: "resolver-cards",
		chapter: "Read the market",
		selector: '[data-testid="resolver-cards"]',
		text: "Who resolves this market, and when. Read this before betting on anything time-sensitive.",
		gesture: "point-hold",
	},
	{
		id: "column-yes",
		chapter: "Read the market",
		selector: '[data-debate-column="YES"] [data-testid="column-scroll"]',
		text: "The YES feed: every argument backing YES, one at a time.",
		gesture: "point-hold",
	},
	{
		id: "column-no",
		chapter: "Read the market",
		selector: '[data-debate-column="NO"] [data-testid="column-scroll"]',
		text: "The NO feed sits opposite: every argument backing NO, the same way.",
		gesture: "point-hold",
	},
	{
		id: "feed-scroll",
		chapter: "Read the market",
		// Paired with the feed's own card content, not just the rail widget —
		// a highlight on the arrows alone shows the control with no hint of
		// what it moves.
		selector: '[data-debate-column="YES"] [data-testid="scroll-rail"]',
		selectorSecondary:
			'[data-debate-column="YES"] [data-testid="column-scroll"]',
		text: "Use the up and down arrows beside a card to move through a feed. Next scrolls down one for you.",
		gesture: "point-hold",
		advance: "click",
		// Unscoped on purpose (see `clickSelector`'s docs in TutorialControl's
		// `next()`): there's no single shared container to resolve a fallback
		// within here, so every match is scanned for the first clickable one.
		clickSelector:
			'[data-debate-column="YES"] button[aria-label^="Next"], [data-debate-column="NO"] button[aria-label^="Next"]',
	},
	{
		id: "ai-mode",
		chapter: "Read the market",
		selector: '[data-tutorial="ai-mode"]',
		text: "AI mode downloads this whole debate as a Markdown file — every argument, in order, to hand to an AI or read offline.",
		gesture: "tap",
	},
	{
		id: "focus-toggle",
		chapter: "Read the market",
		selector: '[data-tutorial="focus-toggle"]',
		text: "Focus narrows the page to one argument at a time, useful once a thread gets long. The same button brings the full market back.",
		gesture: "tap",
	},
	{
		id: "post-share",
		chapter: "Read the market",
		selector: '[data-tutorial="post-share"]',
		text: "Share turns this argument into an image, ready to post elsewhere.",
		gesture: "tap",
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
		id: "buy-yes",
		chapter: "Two ways to bet",
		selector: '[data-debate-column="YES"] [data-tutorial="buy-button"]',
		text: "Bet YES starts a brand new argument — you write your own case for YES and back it with a bet.",
		gesture: "tap",
	},
	{
		id: "buy-no",
		chapter: "Two ways to bet",
		selector: '[data-debate-column="NO"] [data-tutorial="buy-button"]',
		text: "Bet NO does the same for the other side — your own case for NO, backed with a bet.",
		gesture: "tap",
		advance: "click",
		clickSelector: '[data-tutorial="buy-button"]',
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
		id: "composer-image",
		chapter: "Place the bet",
		selector: '[data-testid="mirror-media-host"]',
		text: "Optional: attach an image, or write more detail instead. Neither is required to place the bet.",
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
		advance: "click",
		clickSelector: 'button[aria-label="Close"]',
	},
	// ---- Support & Counter ----
	{
		id: "support-counter-pair",
		chapter: "Support & Counter",
		// Scoped to a SINGLE `aggregate-footer` that holds both pills — a bare
		// `[data-testid="card-trigger-support"]` and a bare "counter" one can
		// each resolve to a DIFFERENT post (or the column-header's own lifted
		// pair vs. a feed card's), so the two rects measured were sometimes
		// nowhere near each other and the "highlighted together" box came out
		// looking broken instead of like one pair. `:has()` keeps both queries
		// inside the one footer that actually carries the pair.
		selector:
			'[data-testid="aggregate-footer"]:has([data-testid="card-trigger-counter"]) [data-testid="card-trigger-support"]',
		selectorSecondary:
			'[data-testid="aggregate-footer"]:has([data-testid="card-trigger-support"]) [data-testid="card-trigger-counter"]',
		text: "Support and Counter, right beside each other on a post: Support backs that argument's side, Counter bets the opposite.",
		gesture: "tap",
		// Support first, Counter as the fallback — whichever one the viewer's
		// own open position actually leaves clickable (see the `advance`
		// docs above).
		advance: "click",
	},
	{
		id: "reply-target-post",
		chapter: "Support & Counter",
		selector: '[data-tutorial="post-focus-argument"]',
		text: "This is the argument you're now acting on — everything from here backs or counters THIS post specifically, not the market in general.",
		gesture: "point-hold",
		// The real Support/Counter click that reaches this step pushes a
		// `?post=` history entry (RPLY-1 R2) — a page navigation exactly like
		// the other two `enteredViaNavigation` steps, just triggered by a
		// click this component only dispatches rather than one it decided to
		// make itself.
		enteredViaNavigation: true,
	},
	{
		id: "reply-composer-ack",
		chapter: "Support & Counter",
		// The statement TEXT only, not the whole row — the row also carries
		// the friendly-fire switch, which has its own dedicated step right
		// after this one, and highlighting it here too just shows it twice.
		selector: '[data-testid="mirror-statement-text"]',
		text: "The same box as before, now aimed at that post: argument, image, stake, to win — everything from the last chapter still applies.",
		gesture: "point-hold",
	},
	{
		id: "friendly-fire",
		chapter: "Support & Counter",
		selector: '[data-testid="ff-switch-row"]',
		text: "Friendly fire: on a Support reply, this marks you as backing the side but contesting THIS specific argument for it — a stronger case exists, in your view.",
		gesture: "tap",
	},
	{
		id: "existing-replies",
		chapter: "Support & Counter",
		// `DebateView` renders a `[data-testid="arena"]` in BOTH its post-focus
		// arm and its plain-market arm — a bare selector matches whichever one
		// happens to be mounted, including the market arena if post-focus has
		// closed out from under this step. `body:has(post-focus-argument)`
		// scopes the match to only when post-focus is actually the one
		// rendered: the two arms are mutually exclusive, so `arena` existing
		// at all once that condition holds means it's the right one. Without
		// this, a stray match on the market arena reads as "found" to the
		// finder's look-ahead and traps Back on this exact step — minted
		// against a live report (see `TutorialControl.tsx`'s `marketHrefRef`
		// fix for the first way this showed up; this is the general fix for
		// every other way post-focus can close early).
		selector:
			'body:has([data-tutorial="post-focus-argument"]) [data-testid="arena"]',
		text: "Existing replies to this post show here the same way as the market itself — sorted by side, most-staked first.",
		gesture: "point-hold",
	},
	// ---- Your profile ----
	{
		id: "identity-card",
		chapter: "Your profile",
		selector: '[data-testid="identity-card"]',
		text: "Your public profile — the pseudonym and identity everyone sees you argue and bet under.",
		gesture: "point-hold",
		enteredViaNavigation: true,
		referenceImage: "/tutorial/profile-reference.png",
	},
	{
		id: "profile-tiles",
		chapter: "Your profile",
		selector: '[data-testid="profile-tiles"]',
		text: "Your scoreboard: everything you've argued, and what it's worth — like the example above, once you've placed a bet.",
		gesture: "point-hold",
		referenceImage: "/tutorial/profile-reference.png",
	},
	{
		id: "positions-table",
		chapter: "Your profile",
		selector: '[data-testid="positions-panel"]',
		// The panel itself always renders, even with zero positions — it
		// just draws "No positions yet" inside instead of disappearing — so
		// checking only `selector` would highlight that empty state as if
		// it were real data. A row only exists once there's a real position.
		requiresSelector: '[data-testid^="position-tile-"]',
		text: "Every market you've bet on, open or closed, in one place — like the positions listed above.",
		gesture: "point-hold",
		referenceImage: "/tutorial/profile-reference.png",
	},
	{
		id: "position-sell",
		chapter: "Your profile",
		selector:
			'[data-testid^="tile-sell-"]:not([data-testid^="tile-sell-amount-"])',
		text: "Sell — exit a position early, like the Sell button beside each row above. It's the one action here that needs no argument.",
		gesture: "tap",
		referenceImage: "/tutorial/profile-reference.png",
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
