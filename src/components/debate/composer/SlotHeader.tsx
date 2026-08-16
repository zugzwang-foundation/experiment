"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { ThumbGlyph } from "@/components/ui/thumb-glyph";
import { cn } from "@/lib/utils";
import { formatDharma, formatPricePercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import { COMPOSER_COPY, c3OppositeSide, formatMultiplier } from "./copy";
import { isEntryDisabled } from "./gating";

/**
 * UI.A3 slice 2 — the market-view slot header, rebuilt to the ratified
 * geometry (values-log §1 item 6 / R-5/R-6 — log values over mockup px):
 * band padding 8px 14px · the entry button outline-sm 13px `7px 14px`
 * minHeight 34 ·
 * price cluster 19px (word 600 / percent 800), thumb 16px, 5px gap. d5
 * order: entry · To-win readout · price cluster · position/Sell readout.
 *
 * HTML-FINISH · MARKET DETAIL row 20 — THE ENTRY READS `Buy`. It read
 * `Đ BET`, which POLISH.3 PR 2 filed BUCKET D (mockup superseded) on canon W2.8
 * grounds. The founder ruling of 2026-08-16 reverses that strike, and `Buy` is
 * the MOCKUP'S OWN string (`d5:1052`, `:1221`, uppercased there by `.tradebtn`)
 * — byte-carried, never authored. The `aria-label` moves with it, so the
 * accessible name and the visible label still agree (WCAG 2.5.3).
 *
 * ⚠ `Sell` WAS NOT RELABELLED, and that asymmetry is the mockup's, not an
 * oversight — POLISH.3 PR 2's bucket-D row records it in terms.
 *
 * ⚠⚠ TWO STRINGS THIS TASK CANNOT REACH STILL SAY `Đ BET`:
 * `COMPOSER_COPY.header` ("Place your Đ BET") and `.submit` ("PLACE Đ BET") in
 * `composer/copy.ts`, which is allow-list-EXCLUDED. So the colhead now reads
 * `Buy` and opens a composer that still says `Đ BET` — a real, user-visible
 * inconsistency, REPORTED rather than silently absorbed, and fixable in one
 * commit whose fence includes `composer/copy.ts`.
 *
 * The entry is LIVE for everyone (C1's disabled era ends here):
 * signed-out opens the auth-gate slot variant; the F-3 predicate disables
 * the opposite pole for a holder (RESULTING side ≠ held side — tooltip +
 * aria carry the C3 batch string); a non-Open market renders the W2.8
 * disabled treatment (INV-4). The W2.10-C `Sell ↗` affordance is a
 * LINK-shaped element rendered NON-INTERACTIVE until A5 (F-4 — its Profile
 * click-through wires there), beside the Đb-only `Your position` readout.
 */

export function SlotHeader({
	side,
	pricing,
	unitToWin,
	viewer,
	marketOpen,
	suspended,
	composerOpen,
	onToggleEntry,
	ownPseudonym,
	slug,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	unitToWin: { yes: string; no: string } | null;
	viewer: ViewerMarketContext | null;
	marketOpen: boolean;
	/** P2 terminal (Track A / banned): all entry controls disabled for the session render. */
	suspended: boolean;
	composerOpen: boolean;
	onToggleEntry: () => void;
	/** W2.10-C — the viewer's own pseudonym (null = signed-out → no link). */
	ownPseudonym: string | null;
	/** The market slug — the `/u/<own>?market=<slug>` preselect (OQ-5 B). */
	slug: string;
}) {
	const pct = pricing ? formatPricePercent(pricing, side) : "—";
	const unit = unitToWin ? unitToWin[side === "YES" ? "yes" : "no"] : null;
	const heldSide = viewer?.position?.side ?? null;
	const oppositeHeld = isEntryDisabled({ resultingSide: side, heldSide });
	const entryDisabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: side })
			: null;

	return (
		<div className="flex items-center justify-between gap-2 rounded-(--r) px-3.5 py-2 shadow-(--elev-1) [border:var(--hairline)]">
			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					size="sm"
					disabled={entryDisabled}
					aria-disabled={entryDisabled}
					aria-expanded={composerOpen}
					aria-label={c3 ?? `Buy ${side}`}
					title={c3 ?? undefined}
					onClick={onToggleEntry}
					// ⚠ `uppercase tracking-[0.06em]` — d5's `.tradebtn`/`.sellbtn`
					// (`d5:559`) are `text-transform:uppercase;letter-spacing:.06em`, and
					// the mockup renders `BUY` / `SELL`. CASE AND TRACKING ONLY: the
					// button's 13px / `7px 14px` / 34px geometry is the values-log §1
					// item 6 ruling and is deliberately NOT replaced by d5's 10px.
					className="h-auto min-h-[34px] px-3.5 py-[7px] text-[13px] tracking-[0.06em] uppercase"
				>
					Buy
				</Button>
				{unit !== null && (
					/* ⚠ `.poslab` (`d5:556`) — `font-weight:800;letter-spacing:.12em;
					   text-transform:uppercase`. The market arm read `To win` in
					   sentence case while the POST arm's `PositionStrip` — the same band,
					   one arm over — already rendered `TO WIN` uppercase from the same
					   mockup rule. The recipe is byte-carried from that shipped component
					   rather than re-derived, so the two arms cannot drift again. */
					<span className="hidden items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase lg:flex">
						<span>{COMPOSER_COPY.toWinLabel}</span>
						<span className="font-mono text-xs tracking-normal text-ink normal-case">
							Đ 1 <span aria-hidden="true">→</span> Đ {formatMultiplier(unit)}
						</span>
					</span>
				)}
			</div>

			<span className="flex items-center gap-[5px] text-[19px] font-semibold text-ink">
				{side === "YES" ? "Yes" : "No"}
				<ThumbGlyph side={side} />
				<b className="font-extrabold">{pct}</b>
			</span>

			<span className="flex items-center gap-2 text-xs">
				{viewer?.position && viewer.position.side === side ? (
					<>
						{/* `.poslab` again — same rule, same recipe as `TO WIN` above. */}
						<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
							<span>{COMPOSER_COPY.yourPositionLabel}</span>
							{/* Đb-ONLY until the Đa staked-basis SPEC.1 line lands (OQ-1 HELD). */}
							<span className="font-mono text-xs tracking-normal text-ink normal-case">
								Đ {formatDharma(viewer.position.currentValue)}
							</span>
						</span>
						{/* W2.10-C (activated at A5, F-4): the click-through to the
						    viewer's own profile, market-filter preselected (OQ-5 B).
						    Signed-out (`ownPseudonym === null`) → non-interactive. */}
						{/* HTML-FINISH · MARKET DETAIL row 21 — `Sell ↗` takes BUTTON
						    SHAPE and KEEPS ITS NAVIGATION.
						    ⛔⛔ IT STAYS AN ANCHOR. A `<button>` here would look identical
						    and silently drop the W2.10-C click-through to the viewer's own
						    profile with this market preselected (OQ-5 B) — which is the
						    whole point of the control. d5 itself navigates
						    (`:1909-1911` → `nav('profile')`), so a non-navigating button
						    would be a regression dressed as a port, and plan H3-d makes
						    exactly that a HALT rather than an acceptable simplification.
						    ⇒ `buttonVariants` supplies the SHAPE; `Link` keeps the
						    behaviour. The signed-out arm keeps the same shape and stays
						    non-interactive, so the affordance does not appear and
						    disappear between session states. */}
						{ownPseudonym !== null ? (
							<Link
								data-testid="w210c-sell-link"
								href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
								className={cn(
									buttonVariants({ variant: "outline", size: "xs" }),
									// `.sellbtn` (`d5:559`) — uppercase, `.06em`.
									"tracking-[0.06em] uppercase",
								)}
							>
								{COMPOSER_COPY.sell} ↗
							</Link>
						) : (
							<span
								aria-disabled="true"
								className={cn(
									buttonVariants({ variant: "outline", size: "xs" }),
									"cursor-default tracking-[0.06em] opacity-(--state-disabled-opacity) uppercase select-none",
								)}
							>
								{COMPOSER_COPY.sell} ↗
							</span>
						)}
					</>
				) : (
					/* `NO ACTIVE POSITION` — d5 renders it through `.poslab` too
					   (`d5:1223`, the empty-position slot), so it carries the same
					   uppercase overline treatment as the two labels above. */
					<span className="text-[10px] font-bold tracking-[0.1em] text-n4 uppercase">
						{COMPOSER_COPY.noPosition}
					</span>
				)}
			</span>
		</div>
	);
}
