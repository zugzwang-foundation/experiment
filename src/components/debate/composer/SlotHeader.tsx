"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatPercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import {
	COMPOSER_COPY,
	c3OppositeSide,
	formatDharmaGrouped,
	formatMultiplier,
} from "./copy";
import { isEntryDisabled } from "./gating";

/**
 * UI.A3 slice 2 — the market-view slot header, rebuilt to the ratified
 * geometry (values-log §1 item 6 / R-5/R-6 — log values over mockup px):
 * band padding 8px 14px · `Đ BET` outline-sm 13px `7px 14px` minHeight 34 ·
 * price cluster 19px (word 600 / percent 800), thumb 16px, 5px gap. d5
 * order: entry · To-win readout · price cluster · position/Sell readout.
 *
 * The `Đ BET` entry is LIVE for everyone (C1's disabled era ends here):
 * signed-out opens the auth-gate slot variant; the F-3 predicate disables
 * the opposite pole for a holder (RESULTING side ≠ held side — tooltip +
 * aria carry the C3 batch string); a non-Open market renders the W2.8
 * disabled treatment (INV-4). The W2.10-C `Sell ↗` affordance is a
 * LINK-shaped element rendered NON-INTERACTIVE until A5 (F-4 — its Profile
 * click-through wires there), beside the Đb-only `Your position` readout.
 */

/** The locked d5 thumb glyph (14×14 viewBox; slot-header size 16). */
const THUMB_PATH =
	"M1.6 6.4h2.1v5.4H1.6z M3.7 11.2V6.9l2.3-4.1c.9 0 1.5.7 1.3 1.6L6.9 6h3.5c.8 0 1.4.7 1.2 1.5l-.8 2.9c-.2.8-.8 1.4-1.6 1.4H3.7z";

/** Thumb-up stroked currentColor; thumb-down FILLED `--color-no`, rotated 180° (values-log §1 item 3). */
function ThumbGlyph({ side }: { side: Side }) {
	return (
		<svg
			viewBox="0 0 14 14"
			width="16"
			height="16"
			aria-hidden="true"
			className={side === "NO" ? "rotate-180" : undefined}
		>
			<path
				d={THUMB_PATH}
				{...(side === "YES"
					? {
							fill: "none",
							stroke: "currentColor",
							strokeWidth: 1.1,
							strokeLinejoin: "round" as const,
						}
					: { className: "fill-no", stroke: "none" })}
			/>
		</svg>
	);
}

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
	const pct = pricing
		? formatPercent(side === "YES" ? pricing.yes : pricing.no)
		: "—";
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
					aria-label={c3 ?? `Đ BET ${side}`}
					title={c3 ?? undefined}
					onClick={onToggleEntry}
					className="h-auto min-h-[34px] px-3.5 py-[7px] text-[13px]"
				>
					Đ BET
				</Button>
				{unit !== null && (
					<span className="hidden items-center gap-1 text-xs text-n5 lg:flex">
						<span>{COMPOSER_COPY.toWinLabel}</span>
						<span className="font-mono text-ink">
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
						<span className="flex items-center gap-1 text-n5">
							<span>{COMPOSER_COPY.yourPositionLabel}</span>
							{/* Đb-ONLY until the Đa staked-basis SPEC.1 line lands (OQ-1 HELD). */}
							<span className="font-mono text-ink">
								Đ {formatDharmaGrouped(viewer.position.currentValue)}
							</span>
						</span>
						{/* W2.10-C (activated at A5, F-4): the click-through to the
						    viewer's own profile, market-filter preselected (OQ-5 B).
						    Signed-out (`ownPseudonym === null`) → non-interactive. */}
						{ownPseudonym !== null ? (
							<Link
								data-testid="w210c-sell-link"
								href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
								className="text-n4 hover:text-ink"
							>
								{COMPOSER_COPY.sell} ↗
							</Link>
						) : (
							<span
								aria-disabled="true"
								className="cursor-default text-n4 select-none"
							>
								{COMPOSER_COPY.sell} ↗
							</span>
						)}
					</>
				) : (
					<span className="text-n4">{COMPOSER_COPY.noPosition}</span>
				)}
			</span>
		</div>
	);
}
