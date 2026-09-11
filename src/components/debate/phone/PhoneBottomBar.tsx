"use client";

import Link from "next/link";

import { ThumbGlyph } from "@/components/ui/thumb-glyph";

import {
	COMPOSER_COPY,
	c3OppositeSide,
	STATE_COPY,
	SUSPENDED_COPY,
} from "../composer/copy";
import { isEntryDisabled } from "../composer/gating";
import { formatDharma } from "../format";
import type { DebateMarketHeader, Side, ViewerMarketContext } from "../types";

/**
 * RF-5 / RF-9 — the fixed entry bar, and the only control on either phone arm
 * that starts a bet.
 *
 * ⛔⛔ IT OPENS A COMPOSER; IT NEVER PLACES A BET. That distinction is the whole
 * thesis at the UI: no stake without an argument. This component renders labels
 * and calls `onEntry`, and what `onEntry` mounts is `BetComposer` or
 * `AuthGateSlot` and nothing else — pinned as a source fact by guards 3 and 4,
 * because "the bar only opens a sheet" is exactly the sort of promise a later
 * convenience ("just place the minimum from here") breaks without looking like
 * it broke anything.
 *
 * ⛔ ONE COMPONENT FOR BOTH ARMS, AND THE REASON IS THE GATE RATHER THAN THE
 * LAYOUT. The feed arm shows one action (`Bet YES`) and the thread arm two
 * (`SUPPORT` / `COUNTER`), which on its own would not justify sharing anything.
 * What justifies it is that EVERY action needs the same three refusals applied
 * to its OWN resulting side, and a second copy of that logic is how one arm
 * quietly stops refusing. So an action carries the side it would bet, and the
 * gate is applied per action rather than per bar.
 *
 * ⛔ EVERY REFUSAL IS SHOWN WITH ITS REASON, IN THE LIVE STRING. A disabled
 * control that does not say why reads as a broken page:
 *   · the viewer holds the OPPOSITE side → `isEntryDisabled` (the F-3 gate, the
 *     same pure function the desktop slot header uses) + `c3OppositeSide`, the
 *     verbatim canon sentence. The server's `opposite_side_held` 400 stays
 *     authoritative; this is the display-grade bound.
 *   · the market is not `Open` → NO BUTTON AT ALL, plus the live status copy.
 *     A settled market is read-locked (design-language §1.8), and a disabled
 *     button on one still says "you could bet here", which is not true and will
 *     not become true.
 *   · the account was suspended during this session → no button,
 *     `SUSPENDED_COPY`.
 *
 * ⚠ ON THE THREAD ARM EXACTLY ONE ACTION IS ALWAYS BLOCKED FOR A VIEWER WHO
 * HOLDS A POSITION, and that is not a bug to smooth over: Support and Counter
 * resolve to opposite sides, so holding either one refuses the other. The notice
 * names which and why.
 *
 * ⚠ `env(safe-area-inset-bottom)` IS ON THE BAR, NOT ON THE PAGE. The bar is the
 * thing that would otherwise sit under a home indicator; padding the page would
 * move the content and leave the bar exactly where it was.
 *
 * ⚠ THE POSITION READOUT SAYS `Your position`, NOT `You hold`. The stills carry
 * the second and marked it a guess (`?G-3`); the first is the shipped canon §6
 * string (`COMPOSER_COPY.yourPositionLabel`) the desktop position strip already
 * renders, and it links where the desktop's links (`/u/<own>?market=<slug>`,
 * W2.10-C) — so the two surfaces cannot drift into two vocabularies for one fact.
 */
export type PhoneBarAction = {
	key: string;
	label: string;
	/** The side this action would BET — not the side of anything on screen. */
	side: Side;
	filled: boolean;
	glyph: boolean;
};

export function PhoneBottomBar({
	market,
	actions,
	viewer,
	ownPseudonym,
	suspended,
	onEntry,
}: {
	market: DebateMarketHeader;
	actions: PhoneBarAction[];
	viewer: ViewerMarketContext | null;
	ownPseudonym: string | null;
	suspended: boolean;
	onEntry: (key: string) => void;
}) {
	const heldSide = viewer?.position?.side ?? null;
	const marketOpen = market.status === "Open";
	const held = viewer?.position ?? null;
	const gated = actions.map((action) => ({
		action,
		blocked: isEntryDisabled({ resultingSide: action.side, heldSide }),
	}));
	const firstBlocked = gated.find((row) => row.blocked);

	const notice = !marketOpen
		? market.status === "Frozen"
			? STATE_COPY.frozen.lead
			: market.status === "Resolving"
				? STATE_COPY.resolving.title
				: STATE_COPY.marketClosed.title
		: suspended
			? SUSPENDED_COPY.banned.title
			: firstBlocked !== undefined && heldSide !== null
				? c3OppositeSide({
						held: heldSide,
						resulting: firstBlocked.action.side,
					})
				: null;

	const entryHidden = !marketOpen || suspended;

	return (
		<div
			data-testid="phone-bottom-bar"
			className="fixed inset-x-0 bottom-0 z-50 bg-ground pb-[env(safe-area-inset-bottom)] [border-top:var(--hairline)]"
		>
			{held !== null ? (
				<PositionReadout
					side={held.side}
					value={held.currentValue}
					ownPseudonym={ownPseudonym}
					slug={market.slug}
				/>
			) : null}
			{notice !== null ? (
				<p
					data-testid="phone-bar-notice"
					className="px-3 pt-2 text-[11px] leading-[1.4] text-n5"
				>
					{notice}
				</p>
			) : null}
			{entryHidden ? null : (
				<div className="flex gap-2 px-3 py-2.5">
					{gated.map(({ action, blocked }) => (
						<button
							key={action.key}
							type="button"
							data-testid={`phone-bar-${action.key}`}
							disabled={blocked}
							onClick={() => onEntry(action.key)}
							className={`flex h-[46px] flex-1 items-center justify-center gap-[7px] rounded-(--r) text-sm font-extrabold tracking-[0.06em] uppercase transition-all disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) ${
								action.filled
									? "bg-ink text-ground"
									: "text-ink [border:var(--hairline)]"
							}`}
						>
							<span>{action.label}</span>
							{action.glyph ? (
								<ThumbGlyph side={action.side} size={17} />
							) : null}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * ⚠ SIGNED OUT THERE IS NOBODY TO LINK TO, so the readout keeps the same words
 * and the same figure without a click-through — `PositionStrip`'s own rule
 * (RPLY-1 · R4b), reproduced rather than re-decided.
 */
function PositionReadout({
	side,
	value,
	ownPseudonym,
	slug,
}: {
	side: Side;
	value: string;
	ownPseudonym: string | null;
	slug: string;
}) {
	const inner = (
		<>
			<span className="text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				{COMPOSER_COPY.yourPositionLabel}
			</span>
			<span className="text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				{side}
			</span>
			<span className="font-mono text-xs text-ink">
				Đ {formatDharma(value)}
			</span>
		</>
	);
	return (
		<div
			data-testid="phone-bar-position"
			className="flex items-center gap-2 px-3 pt-2"
		>
			{ownPseudonym === null ? (
				inner
			) : (
				<Link
					href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
					className="flex items-center gap-2 hover:text-ink"
				>
					{inner}
				</Link>
			)}
		</div>
	);
}
