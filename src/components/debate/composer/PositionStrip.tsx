"use client";

import Link from "next/link";

import { formatPercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import { COMPOSER_COPY, formatDharmaGrouped, formatMultiplier } from "./copy";

/**
 * UI.A3 slice 4 — the post-view (reply page) column header: the ruling-1
 * position strip (values-log §6 ruling 1, operator-ruled a·a·a): the market
 * grammar MINUS action buttons — `TO WIN Đ1 → Đx` left (BOTH columns,
 * ALWAYS — market context, not position context) · price cluster centre ·
 * `YOUR POSITION Đ <b>` / `NO ACTIVE POSITION` right. NO Đ BET / Sell
 * buttons on the debate surface. The held-side readout keeps its W2.10-C
 * behaviour (click → Profile, where Sell lives) — rendered NON-INTERACTIVE
 * until A5 (F-4). Đb-ONLY until the Đa staked-basis ruling lands as its
 * SPEC.1 line (OQ-1 HELD — the `Đa → Đb` grammar activates then).
 * Geometry: cluster matched to market (values-log §1 item 9 — price 19px,
 * thumb 16, minHeight 48, padding 12px 14px).
 */
export function PositionStrip({
	side,
	pricing,
	unitToWin,
	viewer,
	ownPseudonym,
	slug,
}: {
	side: Side;
	pricing: { yes: string; no: string } | null;
	unitToWin: { yes: string; no: string } | null;
	viewer: ViewerMarketContext | null;
	/** W2.10-C — the viewer's own pseudonym (null = signed-out → no link). */
	ownPseudonym: string | null;
	/** The market slug — the `/u/<own>?market=<slug>` preselect (OQ-5 B). */
	slug: string;
}) {
	const pct = pricing
		? formatPercent(side === "YES" ? pricing.yes : pricing.no)
		: "—";
	const unit = unitToWin ? unitToWin[side === "YES" ? "yes" : "no"] : null;
	const held = viewer?.position && viewer.position.side === side;
	return (
		<div className="flex min-h-12 items-center justify-between gap-2 rounded-(--r) px-3.5 py-3 shadow-(--elev-1) [border:var(--hairline)]">
			<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				<span>To win</span>
				<span className="font-mono text-xs tracking-normal text-ink normal-case">
					Đ 1 <span aria-hidden="true">→</span> Đ{" "}
					{unit !== null ? formatMultiplier(unit) : "—"}
				</span>
			</span>

			<span className="flex items-center gap-[5px] text-[19px] font-semibold text-ink">
				{side === "YES" ? "Yes" : "No"}
				<PriceThumb side={side} />
				<b className="font-extrabold">{pct}</b>
			</span>

			{/* W2.10-C click-through target — activated at A5 (F-4): the held
			    readout links to the viewer's own profile, market-filter
			    preselected (OQ-5 B). Signed-out → non-interactive. */}
			<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				{held && viewer?.position ? (
					ownPseudonym !== null ? (
						<Link
							data-testid="w210c-sell-link"
							href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
							className="flex items-center gap-1 hover:text-ink"
						>
							<span>Your position</span>
							<span className="font-mono text-xs tracking-normal text-ink normal-case">
								Đ {formatDharmaGrouped(viewer.position.currentValue)}
							</span>
						</Link>
					) : (
						<>
							<span>Your position</span>
							<span className="font-mono text-xs tracking-normal text-ink normal-case">
								Đ {formatDharmaGrouped(viewer.position.currentValue)}
							</span>
						</>
					)
				) : (
					<span className="text-n4">{COMPOSER_COPY.noPosition}</span>
				)}
			</span>
		</div>
	);
}

/** The locked d5 thumb glyph — up stroked (YES), down FILLED --color-no (NO). */
function PriceThumb({ side }: { side: Side }) {
	return (
		<svg
			viewBox="0 0 14 14"
			width="16"
			height="16"
			aria-hidden="true"
			className={side === "NO" ? "rotate-180" : undefined}
		>
			<path
				d="M1.6 6.4h2.1v5.4H1.6z M3.7 11.2V6.9l2.3-4.1c.9 0 1.5.7 1.3 1.6L6.9 6h3.5c.8 0 1.4.7 1.2 1.5l-.8 2.9c-.2.8-.8 1.4-1.6 1.4H3.7z"
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
