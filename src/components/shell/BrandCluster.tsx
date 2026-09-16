"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CountdownDigits } from "./CountdownDigits";
import { formatCountdown } from "./countdown-format";
import { Wordmark } from "./Wordmark";

/**
 * The centre brand cluster (values-log §3 item 5, superseding the mockup's
 * wordmark + `45d : 06h : 15m` format — R-2/R-3): the 48×48 mark, a 10px
 * gap, then the 2×8 chessboard — row 1 `Z U G Z W A N G` (Geist 13/800,
 * always 8 cells), now rendered from the shared `Wordmark` component so the
 * onboarding deck's first card cannot drift from it (O1-DECK-R2 §4; the
 * `header` scale is those same values, unchanged), row 2 the digits-only
 * countdown (row cell count per the
 * ratified OQ-8 rule — 9 cells until days < 100, ~Jul 29; centre-aligned
 * lockup, transient width mismatch accepted and screenshotted for review).
 * Fills alternate n0/ink in chessboard parity, top-left dark, text inverts
 * per cell; outer hairline, no internal borders. The whole cluster is ONE
 * link target → `/`. The #FAFAFA cells are ratified header-only CHROME
 * (R-4) — they carry no side meaning and bind no pole token (WI-1 law).
 *
 * Client boundary (leg-2 a11y ruling): the link carries the RULED
 * remaining-time label — `Zugzwang — home. ${D} days ${H} hours ${M}
 * minutes until market freeze.` — with values from the SAME formatter as
 * the visible digits, updating silently with the minute tick (a ticking
 * attribute cannot live on server markup, so this component owns the one
 * timer and hands the display string to the presentational cell row). The
 * grid itself stays aria-hidden; NO aria-live anywhere. The RSC-seeded
 * `initialDisplay` keeps server and client markup identical (no hydration
 * mismatch); the post-mount tick recomputes immediately, then every second
 * — the string (and so the re-render) changes only at minute boundaries.
 *
 * ⛔⛔ BELOW 640 THIS COMPONENT RETURNS TWO ROOTS, AND THE SECOND IS THE PHONE
 * BRAND BLOCK (ADR-0051 A13 D-2). It is a SIBLING of the brand link rather than
 * a child of it, deliberately: the cluster's link target is the mark and its
 * label already carries the remaining time in words, so putting this inside
 * would give one link two visual subjects and no new information.
 *
 * ⚠ IT IS WORDMARK-OVER-DIGITS NOW, AND THIS PARAGRAPH SAID `digits only, no
 * wordmark` UNTIL IT WAS. A13 D-2 dropped the wordmark at the phone tier on the
 * reading that it was the header's biggest reflow cost; it is not. The row is
 * EIGHT cells wide either way — `Wordmark` is eight letters and the countdown
 * is eight characters at 13px each — so row 1 costs ZERO horizontal space, and
 * 37px of block in a 60px band costs no vertical either. Measured on the built
 * tree at 320/375/430 in both auth arms: band 62 unchanged, block 37×106, every
 * flex item's x and width byte-identical to the digits-only row.
 *
 * ⚠ THE `phone-countdown` TESTID IS NARROWER THAN THE NODE AND IS KEPT ANYWAY.
 * It names row 2 and the node is now both rows. Renaming it would churn three
 * guard files for a string, and a testid's job is to be a stable handle rather
 * than a description; `ResolverCards` carries the same mismatch for the same
 * reason. Read it as "the phone brand block".
 *
 * ⛔ THE GATE HERE IS THE MOUNT, NOT A `cn()`. Every class on that span is
 * unconditional because the span itself only exists inside the
 * `mobileResponsive ?` ternary below — a mount that says nothing renders no
 * node at all, which `phone-a13::a-mount-that-says-nothing-gets-NO-countdown-at-all`
 * asserts. Wrapping the string in `mobileResponsive && …` inside that ternary
 * would be provably dead, so the prop chain is honoured one level up instead.
 *
 * ⛔ IT REUSES THIS COMPONENT'S TICK AND ADDS NO SECOND INTERVAL, WHICH IS THE
 * WHOLE REASON IT LIVES HERE RATHER THAN IN `GlobalHeader`. The tick is
 * `useState` + one `setInterval` in THIS function; a phone mount anywhere else
 * would need its own copy of both, and two intervals against one `targetMs`
 * drift apart the moment either is throttled. `GlobalHeader` is a server
 * component and cannot hold the state, so the choice is between this shape and
 * a second timer — A13 D-2 rules out the second timer.
 * ⇒ The consequence, stated because it is the probe this round reports: a tick
 * re-renders THIS component and its subtree — the link (whose `aria-label` must
 * move), the hidden desktop block and both digit rows — and NOTHING else in the
 * header. Every sibling control is a separate island under a server parent that
 * does not re-render, so their render count across the tick is zero.
 *
 * ⚠ THE WRAPPER CARRIES THE GATE; THE DIGITS CARRY NONE. `hidden` +
 * `max-mobile:flex` is the `GitHubIconControl` shape — two DISPLAYS at two
 * tiers, never `hidden` beside an unprefixed `flex`, which is the pair
 * `phone-round-ten-header.test.tsx` was written around and which twMerge cannot
 * arbitrate. The mount itself is gated on `mobileResponsive` as well, so a third
 * mount that says nothing inherits the header it has today.
 */
function freezeLabel(display: string): string {
	const [days, hours, minutes] = display.split(":");
	return `Zugzwang — home. ${days} days ${hours} hours ${minutes} minutes until market freeze.`;
}

export function BrandCluster({
	targetMs,
	initialDisplay,
	mobileResponsive = false,
}: {
	targetMs: number;
	initialDisplay: string;
	/** MOBILE-1 Phase A — see `GlobalHeader`'s own prop docblock; threaded
	 * from there rather than inferred, so this component never has to know
	 * which route mounted it. */
	mobileResponsive?: boolean;
}) {
	const [display, setDisplay] = useState(initialDisplay);

	useEffect(() => {
		const tick = () => setDisplay(formatCountdown(Date.now(), targetMs));
		tick();
		const id = setInterval(tick, 1_000);
		return () => clearInterval(id);
	}, [targetMs]);

	return (
		<>
			<Link
				href="/"
				aria-label={freezeLabel(display)}
				className="flex items-center gap-2.5 outline-none focus-visible:shadow-(--state-focus-ring)"
			>
				{/* biome-ignore lint/performance/noImgElement: static 48px brand svg — next/image's optimizer refuses svg by default and buys nothing here. */}
				<img
					src="/brand/zugzwang-mark.svg"
					alt=""
					width={48}
					height={48}
					className="size-12"
				/>
				{/* MOBILE-1 Phase A — the mark alone carried the link and the brand
				    identity below 640px, on the reading that the wordmark + countdown
				    text was the header's single biggest reflow cost. Nothing was lost
				    to a11y either way: the outer `<Link>`'s `aria-label` above carries
				    the countdown in words, so hiding this block relocates the
				    information rather than removing it.
				    ⚠ THE READING WAS WRONG AND BOTH ROWS ARE BACK BELOW 640 — as a
				    separate mount outside this link, at the phone cell scale. It never
				    was a reflow cost: row 1 is eight letters over a row of eight
				    characters at one cell width, so it is exactly as wide as the
				    countdown alone and costs ZERO horizontal space.
				    ⛔ THIS BLOCK STILL HIDES, AND THE DISTINCTION IS THE CELL. What
				    goes below 640 is the 20px-cell lockup dimensioned against a 48px
				    mark; what renders there is the 13×17 one. Two scales of the same
				    rect, never one node moved between tiers — which is why the hide
				    below is still gated rather than deleted. */}
				<span
					aria-hidden="true"
					data-testid="brand-cluster-text"
					className={cn(
						"flex flex-col items-center",
						mobileResponsive && "max-mobile:hidden",
					)}
				>
					<Wordmark scale="header" />
					<CountdownDigits display={display} />
				</span>
			</Link>
			{/* ADR-0051 A13 D-2 — the phone's brand block. `aria-hidden` for the
			    same reason row 2 of the chessboard is: the brand link above carries
			    the remaining time in words and is the ONLY route by which it reaches
			    a screen reader, so a second spoken copy would read the freeze twice
			    with different phrasing. The wordmark is decorative here for the same
			    reason it is decorative up there — the link is already named.
			    ⚠ THE COLUMN TOKEN IS PREFIXED RATHER THAN BARE. Above 640 this span
			    is `display:none` and its direction is inert either way — but "inert
			    today" is a property of the sibling token that hides it, and AGENTS.md
			    §8 records that exact reasoning shipping a defect before. The tier says
			    what the direction is, the same way it says what the display is. */}
			{mobileResponsive ? (
				<span
					aria-hidden="true"
					data-testid="phone-countdown"
					className="hidden max-mobile:flex max-mobile:flex-col"
				>
					<Wordmark scale="phone" />
					<CountdownDigits display={display} scale="phone" />
				</span>
			) : null}
		</>
	);
}
