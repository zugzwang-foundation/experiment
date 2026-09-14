// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PostCard } from "@/components/debate/PostCard";
import type {
	DebatePost,
	ReplyAggregate,
	ReplyGroups,
	Side,
} from "@/components/debate/types";

/**
 * MOBILE-2m · ADR-0051 A9 D-1 / D-2 — THE COMPOSITION HALF OF ROUND NINE, on
 * the one surface where a source scan is structurally blind.
 *
 * ⛔⛔ WHY A RENDER AND NOT ANOTHER SCAN. Every token this round adds to the
 * card arrives through `cn(…)`, which is `clsx` followed by **`twMerge`** — a
 * function whose entire job is to DELETE classes it judges redundant. A source
 * scan reads the arguments; only a render reads what survived. Two things here
 * are invisible to a scan and both are silent when they break:
 *
 *   · the unboxing tokens and the desktop ones they override are *both* meant to
 *     reach the DOM (ADR-0045: override, never replace). If twMerge ever
 *     collapsed `rounded-(--r)` into the phone `rounded-none`, the 1440 card
 *     would lose its corner and nothing on the phone tier would look different.
 *   · the split bar's channel is a RUNTIME branch on `computeSplitBar`'s
 *     `hasStake`. A scan can prove the conditional is authored; only a render
 *     can prove it resolves the right way on each side of Đ 0.
 *
 * ⚠ WHAT IT STILL CANNOT CLAIM. jsdom performs no layout and resolves no media
 * query or Tailwind utility, so nothing here proves the card reaches the screen
 * edge, the groove is visible, or the 60dvh cap bites. Those are browser
 * measurements and belong to the round's own run. This file proves the right
 * class strings reach the right ELEMENTS after composition.
 *
 * ⛔ NO PHONE-VARIANT LITERAL APPEARS IN THIS FILE. Tailwind v4's source
 * detection scans `tests/`, so a class-shaped literal here becomes a real
 * emitted utility in the production stylesheet (AGENTS.md §8). The prefix is
 * ASSEMBLED AT RUNTIME, exactly as `profile-mobile-reflow.test.ts` does and says
 * why. The UNPREFIXED literals (`min-h-0`, `flex-1`, `overflow-hidden`,
 * `p-3`, `max-h-full`) are safe by the other argument: each is already authored
 * in `src/`.
 *
 * No jest-dom in this repo (AGENTS.md §9) — plain DOM assertions only.
 */

afterEach(cleanup);

const V = "max-mobile";
const S = ":";
const phone = (utility: string) => V + S + utility;
/**
 * ⛔⛔ THE SUFFIX HAS TO BE ASSEMBLED TOO, AND THIS ROUND LEARNED IT THE HARD WAY.
 * `phone()` above keeps the `max-mobile:` PREFIX out of the file — but Tailwind's
 * scanner reads `tests/` for ordinary candidates as well, so `phone(HALF)`
 * still leaves a bare `w-1​/2!` here and emits it into the production stylesheet.
 * Measured with `@tailwindcss/oxide`'s own Scanner and found by `@code-reviewer`:
 * this round's three new suffixes were all being emitted UNPREFIXED with no
 * `src/` origin at all.
 * ⚠ The standing justification for the bare literals this file already keeps —
 * `p-3`, `flex-1`, `text-sm` — is that each is ALREADY authored in `src/`. That is
 * a property of ANOTHER file, which can change without touching this one, so
 * anything this round introduced is assembled rather than trusted.
 * `phone-split-bar.test.ts` minted exactly that rule two rounds ago.
 */
const CHANNEL = "bg-" + "(--surface-inset)";
const HALF = "w-1" + "/" + "2" + "!";
/**
 * MOBILE-2o - A11 D-1's edge and A11 D-3's dim, assembled for the same reason
 * everything above is: `tests/` is a Tailwind source root, so a class-shaped
 * literal here is emitted into the production stylesheet. `DESKTOP_DIM` is the
 * unprefixed token that must SURVIVE beside the phone one, and it is already
 * authored in `src/`.
 */
const HAIRLINE = "[border:var(--hairline)]";
const DIM = "disabled:opacity-" + "4" + "0";
const DESKTOP_DIM = "disabled:opacity-(--state-disabled-opacity)";

const EMPTY_REPLIES: ReplyGroups = { support: [], counter: [], twoSlot: [] };

/** Asymmetric on purpose — a 50/50 split hides a swapped fill. */
const STAKED: ReplyAggregate = {
	supportCount: 2,
	counterCount: 1,
	supportDharma: "1000.000000000000000000",
	counterDharma: "2000.000000000000000000",
};

/**
 * ⛔ THE Đ 0 / Đ 0 STATE, WHICH IS THE ONE A9 D-2 NAMES. `computeSplitBar`
 * returns `supportPct: "0%"` for this AND for "everything staked is Counter",
 * and its own docblock says those are opposite facts — so a footer keying on the
 * percentage alone paints a solid counter-pole bar for a post nobody has replied
 * to. On a YES post that pole is `--color-no` #fafafa: a white wire standing in
 * for a bar with nothing in it.
 */
const UNSTAKED: ReplyAggregate = {
	supportCount: 0,
	counterCount: 0,
	supportDharma: "0.000000000000000000",
	counterDharma: "0.000000000000000000",
};

const FIXTURE_IMAGE = "https://example.invalid/post-attachment.png";

/** Neutral fixture prose — no invented market content (CLAUDE.md §3). */
function presentPost(over?: {
	side?: Side;
	aggregate?: ReplyAggregate;
	imageUrl?: string | null;
}): DebatePost {
	return {
		removed: false,
		id: "0199a0c0-0000-7000-8000-00000000d901",
		ordinal: 1,
		sideAtPostTime: over?.side ?? "YES",
		createdAt: "2026-07-30T00:00:00.000Z",
		title: "Fixture argument title.",
		teaser: "Fixture teaser.",
		body: "Fixture argument title.\n\nFixture teaser.",
		imageUrl: over?.imageUrl ?? null,
		marker: "none",
		badge: null,
		author: { pseudonym: "fixture-author", pfpUrl: "" },
		authorStake: "10.000000000000000000",
		authorStakeOriginal: "10.000000000000000000",
		authorSold: false,
		entryPrice: "0.500000000000000000",
		aggregate: over?.aggregate ?? STAKED,
		replies: EMPTY_REPLIES,
	};
}

const noop = () => {};
const noopReply = () => {};

function renderCard(opts?: {
	unboxed?: boolean;
	post?: DebatePost;
	/**
	 * MOBILE-2o - the viewer's held side, which is the ONLY input that makes a
	 * trigger render refused. `isEntryDisabled` disables the trigger whose
	 * RESULTING side is not the held one, so a held YES disables Counter on a YES
	 * post and Support on a NO post - both of which resolve to the white pole.
	 * Holding NO is what produces a refused BLACK pill.
	 */
	heldSide?: Side | null;
}): HTMLElement {
	const { container } = render(
		<PostCard
			post={opts?.post ?? presentPost()}
			unboxed={opts?.unboxed ?? false}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
			onReplyToPost={noopReply}
			heldSide={opts?.heldSide ?? null}
			marketOpen
			suspended={false}
		/>,
	);
	return container;
}

/**
 * The class TOKENS of the first element matching `selector`.
 *
 * ⛔ TOKENS, NEVER A SUBSTRING. `toContain` on the raw class string matches
 * `rounded-none` inside `rounded-none-whatever` and — worse here — matches the
 * phone token inside its own unprefixed peer. Splitting on whitespace makes
 * every assertion below an equality on a whole class name.
 */
function tokensOf(root: HTMLElement, selector: string): string[] {
	const el = root.querySelector(selector);
	if (el === null) {
		throw new Error(`no element matching ${selector} in the rendered card`);
	}
	return (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
}

const cardTokens = (root: HTMLElement) => tokensOf(root, '[data-slot="card"]');
const footerTokens = (root: HTMLElement) =>
	tokensOf(root, '[data-testid="aggregate-footer"]');
const trackTokens = (root: HTMLElement) =>
	tokensOf(root, '[data-testid="aggregate-split-track"]');
/** MOBILE-2n · R-2 — the Đ 0 state moved from the track to the fill (A10 D-2). */
const fillTokens = (root: HTMLElement) =>
	tokensOf(root, '[data-testid="aggregate-split-fill"]');

/** The three tokens `UNBOXED_CARD` ships — named here, read there. */
const UNBOX = [
	phone("[border:none]"),
	phone("rounded-none"),
	phone("shadow-none"),
];

describe("MOBILE-2m · R-1 / A9 D-1 — the unboxed card, after composition", () => {
	it("phone-card::the-feed-card-reaches-the-DOM-without-its-box", () => {
		const tokens = cardTokens(renderCard({ unboxed: true }));
		for (const token of UNBOX) {
			expect(tokens, `${token} did not survive cn()/twMerge`).toContain(token);
		}
	});

	it("phone-card::and-a-mount-that-says-nothing-keeps-it", () => {
		// The `= false` default, observed rather than read. Every desktop mount,
		// the parent-post sheet and any future third mount are safe by omission.
		const tokens = cardTokens(renderCard());
		for (const token of UNBOX) {
			expect(
				tokens,
				`${token} reached a mount that never asked for it`,
			).not.toContain(token);
		}
	});

	it("phone-card::the-DESKTOP-declarations-SURVIVE-the-unboxing", () => {
		// ⛔⛔ THE twMerge ROW, AND THE ONE THIS FILE EXISTS FOR. `cn` is clsx +
		// twMerge, and twMerge's job is to drop what it judges redundant. It keeps
		// both here only because the two rules carry DIFFERENT MODIFIERS — the
		// phone tokens are variant-prefixed and the base ones are not. That is a
		// property of tailwind-merge's grouping, not of this code, so it is a thing
		// to OBSERVE rather than to assume: a merge that collapsed them would take
		// the corner, the edge and the elevation off the 1440 card, and no phone
		// measurement in this round would ever see it.
		const tokens = cardTokens(renderCard({ unboxed: true }));
		expect(tokens, "the 1440 corner").toContain("rounded-(--r)");
		expect(tokens, "the 1440 edge").toContain("[border:var(--hairline)]");
		expect(tokens, "the 1440 elevation").toContain("shadow-(--elev-1)");
	});

	it("phone-card::and-so-does-every-LINK-IN-THE-IMAGE-HEIGHT-CHAIN", () => {
		// ⛔⛔ THE 9:16-PORTRAIT-AT-360 CASE, ASSERTED AS A CHAIN RATHER THAN AS A
		// PIXEL. jsdom cannot measure the cap, so what is checkable is that R-1 cut
		// no link in the chain the cap hangs from. `PostCard.tsx`'s own docblocks
		// name every one: `Card` is `flex-1 min-h-0` so the card FILLS its column;
		// the `.argimg` cell takes a share of that; `CommentImage`'s button passes
		// it down with `h-full`; and the `<img>`'s `max-h-full` is a PERCENTAGE
		// that resolves to `none` the moment any ancestor above it loses its
		// definite height — at which point the image silently reverts to intrinsic
		// size, which is exactly the defect the cell was introduced to fix.
		// ⚠ THE PHONE CAP DOES NOT DEPEND ON THAT CHAIN, and saying so is the
		// point of testing both: `max-h-[60dvh]` is a DEFINITE length, so below 640
		// the portrait is bounded even where `max-h-full` resolves to `none` (the
		// feed pane is a column of content-sized cards inside a scroller —
		// `CommentImage.tsx` records the measurement). The chain is what bounds it
		// at 1440; the cap is what bounds it at 360. This round must break neither.
		const root = renderCard({
			unboxed: true,
			post: presentPost({ imageUrl: FIXTURE_IMAGE }),
		});

		const card = cardTokens(root);
		expect(card, "the card fills its column").toContain("flex-1");
		expect(card, "…and may shrink inside it").toContain("min-h-0");
		expect(card, "the inset that becomes the tier's only padding").toContain(
			"p-3",
		);
		// ⚠ The band's `-mx-3` bleed is clipped at exactly the card's edge, which
		// is the extent wanted — so the clip is part of R-1's mechanism, not
		// incidental.
		expect(
			card,
			"the card's own clip — A10 D-3 removed the bleed that used to rely on it, and the clip is still what keeps a full-bleed card's content inside its edges",
		).toContain("overflow-hidden");

		const img = root.querySelector("img[alt='Argument attachment']");
		expect(img, "the attachment renders").not.toBeNull();
		const button = img?.parentElement as HTMLElement;
		const cell = button.parentElement as HTMLElement;

		const cellTokens = (cell.getAttribute("class") ?? "").split(/\s+/);
		expect(
			cellTokens,
			"the cell is the flex item with a definite height",
		).toContain("flex-1");
		expect(cellTokens).toContain("min-h-0");

		const buttonTokens = (button.getAttribute("class") ?? "").split(/\s+/);
		expect(buttonTokens, "the button passes the cell's height down").toContain(
			"h-full",
		);

		const imgTokens = (img?.getAttribute("class") ?? "").split(/\s+/);
		expect(imgTokens, "the desktop bound").toContain("max-h-full");
		expect(
			imgTokens.some((t) => t.startsWith(phone("max-h-["))),
			"the phone cap is gone from the `fill` arm. `max-h-full` is a " +
				"percentage and resolves to `none` on this tier, so without a definite " +
				"length a 9:16 portrait renders at its intrinsic height and pushes the " +
				"argument and the footer a whole screen down.",
		).toBe(true);
	});

	it("phone-card::the-REMOVED-branch-unboxes-too", () => {
		// A removed post is still a post in the feed. An unboxed column with a
		// boxed tombstone in it is the stray box A9 D-1 names as the thing to
		// avoid — and the removed branch is a separate `<Card>`, so it is a
		// genuinely separate place to forget.
		const removed: DebatePost = {
			removed: true,
			id: "0199a0c0-0000-7000-8000-00000000d902",
			ordinal: 2,
			sideAtPostTime: "NO",
			createdAt: "2026-07-30T00:00:00.000Z",
			aggregate: STAKED,
			replies: EMPTY_REPLIES,
		};
		const tokens = cardTokens(renderCard({ unboxed: true, post: removed }));
		for (const token of UNBOX) {
			expect(tokens, `the removed branch kept its box: ${token}`).toContain(
				token,
			);
		}
	});
});

describe("MOBILE-2m · R-1 / A9 D-1 — the footer is a band on an unboxed card", () => {
	it("phone-card::the-rows-own-alignment-is-untouched-by-the-band", () => {
		// ⛔⛔ THIS ROW IS HERE BECAUSE R-1 BROKE THE TWO GUARDS THAT USED TO CARRY
		// IT, AND IT IS NAMED AS AN ADDITION RATHER THAN SLIPPED IN.
		// `split-bar-parity.test.ts` and `aggregate-footer-alignment.test.ts` both
		// locate this element with `data-testid="aggregate-footer"\s+className="`
		// — and R-1 rewrote that `className` from a literal into a `cn(…)`, so both
		// anchors stopped matching and both went RED at `03fd9213`. Their property
		// still HOLDS (the base string is unchanged); only their regex broke, and
		// repairing them belongs to the implementation commit, not here.
		// ⇒ Until then this is the only live cover for it, and it is asserted on
		// the RENDERED node — which is the stronger instrument anyway, because a
		// className rewrite is exactly the kind of edit that drops a base token by
		// accident. `AggregateFooter`'s own comment records that `items-center`
		// lands ~2px off: it centres the COLUMNS while the track stays its column's
		// first child.
		const tokens = footerTokens(renderCard({ unboxed: true }));
		expect(tokens).toContain("items-start");
		expect(tokens).toContain("gap-2");
		expect(tokens).not.toContain("items-center");
	});
});

describe("MOBILE-2o · A11 D-2 — the channel is the ZERO state; the remainder is a POLE", () => {
	it("phone-split-channel::the-channel-appears-ONLY-at-Đ-0-and-the-pole-takes-the-rest", () => {
		// ⛔⛔ REVERSED FROM A10 D-2, AND THE PARAGRAPH IT REPLACES IS THE RECORD OF
		// WHAT IS REVERSED. A10 made the channel UNCONDITIONAL and ruled that "the
		// Counter share IS the exposed channel"; this row asserted the same token
		// survived BOTH aggregates. A11 D-2 restores the side rule to both halves of
		// the bar: Support's share is drawn in Support's colour and the remainder is
		// COUNTER'S OWN POLE, so the channel can only be the Đ 0 / Đ 0 state.
		// ⚠ MEASURED BEFORE CHANGING IT, on the ground build at 390: every track on
		// the feed computed `rgb(42, 42, 42)` — a Đ 230 / Đ 50 post and a Đ 0 / Đ 0
		// post were the same grey, and a NO post whose replies are all Counter (a
		// 100% BLACK bar under the side rule) rendered as an empty grey trough.
		// ⛔ BOTH HALVES, because either alone passes on a bug: presence-only is
		// satisfied by A10's unconditional channel, and absence-only by a component
		// that lost the token altogether.
		expect(
			trackTokens(
				renderCard({
					unboxed: true,
					post: presentPost({ aggregate: UNSTAKED }),
				}),
			),
			"nothing is staked and the track is not the channel, so Đ 0 / Đ 0 is " +
				"being drawn as a pole.",
		).toContain(phone(CHANNEL));
		expect(
			trackTokens(
				renderCard({ unboxed: true, post: presentPost({ aggregate: STAKED }) }),
			),
			"the channel survived into a staked bar, so the Counter share is a " +
				"groove again and grey means two different things.",
		).not.toContain(phone(CHANNEL));
	});

	it("phone-split-channel::the-FILL-is-the-SHARE-and-carries-no-width-override", () => {
		// ⛔⛔ A10 D-2's HALF-WIDTH AT ZERO IS WITHDRAWN. It filled half the track so
		// an empty bar had presence; under the side rule that reads as an even
		// contest between Đ 0 and Đ 0 — two poles at 50/50 on a post nobody has
		// replied to. A11 D-2 gives the zero state to the CHANNEL and leaves the
		// fill to the share alone, so presentation and stake cannot disagree.
		// ⚠ `computeSplitBar` already returns "0%" here, so the inline width paints
		// nothing; the override was the only thing making it 50%.
		for (const aggregate of [UNSTAKED, STAKED]) {
			expect(
				fillTokens(
					renderCard({ unboxed: true, post: presentPost({ aggregate }) }),
				),
				"a width override is authored on the fill, so the bar's proportion is " +
					"a presentation fact rather than the share.",
			).not.toContain(phone(HALF));
		}
	});

	it("phone-split-channel::both-halves-of-a-staked-bar-are-POLES-and-they-are-side-bound", () => {
		// ⛔⛔ THE WHOLE OF F-2, AND IT IS A FOUR-WAY CHECK BECAUSE A TWO-WAY ONE
		// PASSES ON A SWAPPED PAIR. black = YES / white = NO holds on BOTH halves:
		// the fill is the post's own side, the track is the opposite. A component
		// that bound the fill to the RELATION rather than to the SIDE would render
		// Support black on every post and pass any check that only looked at one
		// side. (`side-pole-binding.test.ts` calls this its "Route 3" blind spot.)
		for (const [side, fill, rest] of [
			["YES", "bg-yes", "bg-no"],
			["NO", "bg-no", "bg-yes"],
		] as const) {
			const root = renderCard({
				unboxed: true,
				post: presentPost({ side, aggregate: STAKED }),
			});
			expect(
				fillTokens(root),
				`Support's share on a ${side} post is not the ${side} pole`,
			).toContain(fill);
			expect(
				trackTokens(root),
				`the remainder on a ${side} post is not Counter's pole`,
			).toContain(rest);
		}
	});
});

describe("MOBILE-2o · A11 D-1 / D-3 — the black side gets an edge; the refused side is dimmed", () => {
	const triggerTokens = (root: HTMLElement, rel: "support" | "counter") =>
		tokensOf(root, `[data-testid="card-trigger-${rel}"]`);

	it("phone-trigger::the-BLACK-side-declares-the-hairline-and-the-white-side-does-not", () => {
		// ⛔ A11 D-1 rules the edge on the black side only. `--color-yes` #181818 on
		// the band's #2a2a2a carries no contrast of its own, so the edge is what says
		// a control is there; a white fill needs no such help and keeps the
		// `border-white/25` it already had.
		// ⚠ WHAT THIS DOES **NOT** PROVE, and the distinction matters: the painted
		// edge was already 1px #404040 before this token existed, because Chrome
		// resolves a `0.5px` border to a USED width of 1px at every device scale
		// factor (measured at 1, 2 and 3). This row holds the DECLARATION, which is
		// the part that can be read, reasoned about and kept.
		// ⚠ THE BLACK SIDE IS NOT A FIXED TRIGGER. Support is black on a YES post and
		// Counter is black on a NO post, so both are read here — a guard that checked
		// one relation would pass on a pole bound to the relation instead of the side.
		const yes = renderCard({
			unboxed: true,
			post: presentPost({ side: "YES" }),
		});
		expect(
			triggerTokens(yes, "support"),
			"Support is the black side on a YES post",
		).toContain(phone(HAIRLINE));
		expect(
			triggerTokens(yes, "counter"),
			"the white side took the black side's edge",
		).not.toContain(phone(HAIRLINE));

		const no = renderCard({ unboxed: true, post: presentPost({ side: "NO" }) });
		expect(
			triggerTokens(no, "counter"),
			"Counter is the black side on a NO post",
		).toContain(phone(HAIRLINE));
		expect(
			triggerTokens(no, "support"),
			"the white side took the black side's edge",
		).not.toContain(phone(HAIRLINE));
	});

	it("phone-trigger::a-refused-trigger-is-DIMMED-in-its-own-colour-never-given-a-grey-fill", () => {
		// ⛔⛔ A11 D-3. The refused side renders at 40% below 640 — and it still
		// renders in its OWN pole, which is the half that would break silently: a
		// `disabled:bg-…` anywhere in this chain would satisfy "it looks different"
		// and destroy the one thing the colour carries.
		// ⚠ HOLDING YES REFUSES THE WHITE SIDE AND HOLDING NO REFUSES THE BLACK ONE,
		// so both poles are exercised. The desktop token stays beside the phone one:
		// ADR-0045's first rule, at the one site this round touches.
		for (const [held, side, rel, pole] of [
			["YES", "YES", "counter", "bg-no"],
			["YES", "NO", "support", "bg-no"],
			["NO", "YES", "support", "bg-yes"],
			["NO", "NO", "counter", "bg-yes"],
		] as const) {
			const root = renderCard({
				unboxed: true,
				heldSide: held,
				post: presentPost({ side }),
			});
			const t = triggerTokens(root, rel);
			expect(
				t,
				`${rel} on a ${side} post is not refused while holding ${held}`,
			).toContain(phone(DIM));
			expect(
				t,
				"the desktop disabled opacity was REPLACED rather than overridden, " +
					"which silently re-dims the 1440 control.",
			).toContain(DESKTOP_DIM);
			expect(t, `the refused side lost its ${pole} pole`).toContain(pole);
			expect(
				t.filter((x) => /^(max-mobile:)?(disabled:)?bg-n\d$/.test(x)),
				"the refused side carries a neutral-ramp ground, which is the grey " +
					"fill A11 D-3 exists to forbid.",
			).toEqual([]);
		}
	});

	it("phone-trigger::an-allowed-trigger-is-NOT-dimmed", () => {
		// CONTROL on the row above: every assertion there is about a token that is
		// present on the element in EVERY state, because `disabled:` is a modifier
		// and jsdom resolves no cascade. What distinguishes the two states is the
		// `disabled` attribute, so that is what is read here.
		const root = renderCard({
			unboxed: true,
			heldSide: "YES",
			post: presentPost({ side: "YES" }),
		});
		const support = root.querySelector('[data-testid="card-trigger-support"]');
		const counter = root.querySelector('[data-testid="card-trigger-counter"]');
		expect(
			support?.hasAttribute("disabled"),
			"holding YES refused the trigger that BETS YES, which is the rule " +
				"inverted rather than applied.",
		).toBe(false);
		expect(counter?.hasAttribute("disabled")).toBe(true);
	});
});

// ⚠ RETITLED AT MOBILE-2o, NOT REPURPOSED. A10 D-2's two behavioural rows moved
// to the A11 describe above, which reverses them; what is left here are the three
// CONTROLS that were always true either way — the superseded A9 groove is absent,
// a boxed card never takes the channel, and the track keeps its thickness and its
// edge. Leaving the old title on a block that no longer holds the ruling it names
// is how a reader ends up reconciling two describes that claim the same decision.
describe("MOBILE-2o · A11 D-2 — the track's standing controls, either side of Đ 0", () => {
	it("phone-split-channel::the-OLD-groove-token-is-gone-in-both-states", () => {
		// ⛔⛔ THE OPPOSITE CONTROL, AND WITHOUT IT THE ROW ABOVE IS SATISFIED BY A
		// GROOVE THAT NEVER LEAVES. The counter share IS the track's own ground, so
		// a channel that stayed once stake existed would paint over the counter
		// pole and leave the bar showing one side of a two-sided fact — a bar that
		// is always 40% Support and never 60% Counter. A9 D-2 names the Đ 0 state
		// and only that state, which is the same boundary.
		// ⚠ `bg-n0` WAS A9 D-2's groove and is now the CARD's own ground, so a
		// track that still carried it would be invisible rather than recessed.
		// Asserted in both states because the token was conditional and a leftover
		// would only show in one of them.
		for (const aggregate of [UNSTAKED, STAKED]) {
			expect(
				trackTokens(
					renderCard({ unboxed: true, post: presentPost({ aggregate }) }),
				),
				"the superseded A9 groove is still authored beside A10's channel, " +
					"and which one paints is then decided by emission order.",
			).not.toContain(phone("bg-n0"));
		}
		// CONTROL — the track still carries its counter pole unconditionally, which
		// is what the channel is drawn OVER below 640 and what the desktop still
		// paints. (`aggregate-footer.test.tsx` owns the four-way pole binding; this
		// is the one row that keeps THIS file's negatives from passing on an empty
		// class string.)
		expect(
			trackTokens(
				renderCard({ unboxed: true, post: presentPost({ aggregate: STAKED }) }),
			),
			"a YES post's track is the NO pole",
		).toContain("bg-no");
	});

	it("phone-split-channel::a-BOXED-card-never-takes-the-channel", () => {
		// ⚠ THE CHANNEL IS GATED ON `band`, and that is not belt-and-braces: a
		// groove reads as a groove only when the surface around it is the card's
		// own. Inside the parent-post sheet's boxed card it would be a third
		// rectangle in a stack of two, and the sheet is the mount A10 D-3 leaves
		// alone.
		for (const aggregate of [UNSTAKED, STAKED]) {
			expect(
				trackTokens(renderCard({ post: presentPost({ aggregate }) })),
			).not.toContain(phone(CHANNEL));
		}
	});

	it("phone-split-channel::the-track-keeps-its-thickness-and-its-edge-either-way", () => {
		// CONTROL on the two rows above: they are `toContain` / `not.toContain` on
		// one token, and both would pass on a track that had lost every other class
		// it carries. Pin the thickness and the hairline in the same render.
		for (const aggregate of [UNSTAKED, STAKED]) {
			const tokens = trackTokens(
				renderCard({ unboxed: true, post: presentPost({ aggregate }) }),
			);
			expect(tokens, "the phone thickness").toContain(phone("h-[14px]"));
			expect(tokens, "the ruled ends").toContain(phone("rounded-full"));
			// ⚠ THE DESKTOP THICKNESS IS CHECKED FOR PRESENCE, NEVER FOR ITS VALUE.
			// `split-bar-parity.test.ts` and `aggregate-footer-alignment.test.ts` own
			// that number and RE-DERIVE it from `PriceBar.tsx`'s `detail.bar` —
			// precisely because a copied literal drifts silently the next time the
			// market bar is re-sized, which has happened once already (BLOCK-3 §2).
			// What belongs here is only ADR-0045's first rule: the phone token is an
			// ADDITIVE override, so an unprefixed height must still be declared
			// beside it.
			expect(
				tokens.some((t) => /^h-\[\d/.test(t)),
				"the phone token REPLACED the desktop thickness instead of " +
					"overriding it, which silently re-sizes the 1440 bar.",
			).toBe(true);
			// The edge is load-bearing: on a NO post the track is `bg-yes` #181818
			// on a #212121 card, ~1.10:1, and without it the track disappears.
			expect(tokens).toContain("[border:var(--hairline)]");
		}
	});
});
