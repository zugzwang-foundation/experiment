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
}): HTMLElement {
	const { container } = render(
		<PostCard
			post={opts?.post ?? presentPost()}
			unboxed={opts?.unboxed ?? false}
			onEnter={noop}
			onOpenPopup={noop}
			onOpenImage={noop}
			onReplyToPost={noopReply}
			heldSide={null}
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
		expect(card, "the clip the band's bleed relies on").toContain(
			"overflow-hidden",
		);

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

describe("MOBILE-2n · R-3 / A10 D-3 — the footer has no ground on any card", () => {
	it("phone-card::the-band-is-GONE-on-the-unboxed-card-and-was-never-on-the-boxed-one", () => {
		// ⛔⛔ INVERTED BY ADR-0051 A10 D-3. This row asserted the band ARRIVED
		// with the unboxing — `bg-n1` + `-mx-3` + `px-3`, gated on the prop — and
		// that a boxed card never took it. A10 D-3 removes the ground from both:
		// the row sits on the card's own ground and is separated from the content
		// above by the card's `gap-2.5` alone.
		// ⚠ THE RENDER IS STILL THE RIGHT INSTRUMENT. These tokens arrive through
		// `cn()`, i.e. `twMerge`, whose whole job is to DELETE classes it judges
		// redundant — a source scan reads the arguments, only a render reads what
		// survived. An absence asserted on the source would pass on a token that
		// was authored and merged away, which is a different fact.
		for (const [what, tokens] of [
			["the unboxed feed card", footerTokens(renderCard({ unboxed: true }))],
			["the boxed sheet card", footerTokens(renderCard())],
		] as [string, string[]][]) {
			expect(tokens, `${what}: the ground`).not.toContain(phone("bg-n1"));
			expect(tokens, `${what}: the bleed`).not.toContain(phone("-mx-3"));
			expect(tokens, `${what}: the put-back`).not.toContain(phone("px-3"));
			expect(tokens, `${what}: the band's height`).not.toContain(
				phone("py-2.5"),
			);
		}
	});

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

describe("MOBILE-2n · R-2 / A10 D-2 — the channel spans the track, and Đ 0 fills half", () => {
	it("phone-split-channel::the-track-takes-the-CHANNEL-whether-or-not-there-is-stake", () => {
		// ⛔⛔ INVERTED BY A10 D-2. A9 D-2 painted the groove ONLY at Đ 0 and the
		// row below asserted it DROPPED the moment stake existed, because the
		// counter share was the track's own ground. A10 D-2 rules that erasure:
		// the channel spans the full track and the Counter share IS the exposed
		// channel. So the same token must now survive BOTH aggregates.
		for (const aggregate of [UNSTAKED, STAKED]) {
			expect(
				trackTokens(
					renderCard({ unboxed: true, post: presentPost({ aggregate }) }),
				),
				"the channel does not span the track, so the Counter share is still " +
					"painting a pole on a bar A10 D-2 gives to the groove.",
			).toContain(phone("bg-(--surface-inset)"));
		}
	});

	it("phone-split-channel::and-the-FILL-is-an-even-split-at-Đ-0-and-the-share-otherwise", () => {
		// ⛔⛔ THE ZERO STATE MOVED FROM THE TRACK TO THE FILL, and this is the row
		// that holds it. At Đ 0 / Đ 0 `computeSplitBar` returns "0%", which the
		// inline width still carries — so without this token the bar is a channel
		// with nothing in it, and A10 D-2 wants an even split so the bar has
		// presence and the channel is visible on both sides of the midpoint.
		// ⚠ THE `!` IS NOT DECORATION. The width beside it is an INLINE style and
		// outranks every ordinary selector; a plain `max-mobile:w-1/2` would be
		// authored, compiled, present on the node and completely inert.
		const zero = fillTokens(
			renderCard({ unboxed: true, post: presentPost({ aggregate: UNSTAKED }) }),
		);
		expect(zero, "the even split at Đ 0").toContain(phone("w-1/2!"));
		// ⛔ THE OPPOSITE CONTROL — without it the row above is satisfied by an
		// even split that NEVER leaves, i.e. a bar that reads 50/50 at every real
		// stake. A10 D-2 names the Đ 0 / Đ 0 state and only that state.
		const staked = fillTokens(
			renderCard({ unboxed: true, post: presentPost({ aggregate: STAKED }) }),
		);
		expect(
			staked,
			"the even split survived into a staked bar, so every post now reads " +
				"50/50 whatever its replies say.",
		).not.toContain(phone("w-1/2!"));
		// CONTROL on the negative: the fill still carries its pole either way.
		expect(staked, "a YES post's fill is the YES pole").toContain("bg-yes");
	});

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
			).not.toContain(phone("bg-(--surface-inset)"));
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
