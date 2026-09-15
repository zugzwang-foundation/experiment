"use client";

import Link from "next/link";

import { formatDharma, formatPricePercent } from "../format";
import type { Side, ViewerMarketContext } from "../types";
import { COMPOSER_COPY, formatMultiplier } from "./copy";

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
	composingSide = null,
	pricing,
	unitToWin,
	viewer,
	ownPseudonym,
	slug,
}: {
	side: Side;
	/**
	 * RPLY-2 · R2 — the other half of CS12 that was never built on this strip
	 * (see the block below). Set by the caller ONLY on the column hosting an
	 * open composer, to the bet's own resulting side; `null` (the default)
	 * everywhere else, which collapses `displaySide` below to `side` and
	 * leaves this component's rendering identical to before this prop existed.
	 *
	 * ⛔ MEASURED, NOT PORTED FROM `SlotHeader`. `SlotHeader` derives its
	 * label, percent, TO WIN *and* its position readout from ONE `side` prop
	 * (the caller passes it `headerSide = openSide ?? side`), so its position
	 * readout mirrors too — `viewer.position.side === side` compares the
	 * viewer's REAL holding against the MIRRORED pole while a composer is
	 * open, which prints a falsehood on the market arm (a real finding,
	 * reported rather than fixed here — `SlotHeader` is this task's read-only
	 * reference, not its subject). This component deliberately does NOT
	 * repeat that: `composingSide` drives ONLY the label/percent/TO-WIN
	 * below; `side` — the column's own true pole — is what the position
	 * readout (`held`) keeps comparing against, unconditionally.
	 *
	 * ⚠ THE GOVERNING RULE IS `design-canon.md` §2's **composer-open
	 * exception** (the Reply surface entry), which is where the founder's
	 * ruling now lives: "when a composer opens, the headers must be the same
	 * as the side bet being taken." Canon carries the same split this
	 * component implements — the hosting column's label, percent and TO-WIN
	 * follow the side being bet; the position readout is excluded from the
	 * mirroring because it is a fact about the viewer's holding on that
	 * specific pole, and mirroring it prints a falsehood.
	 * ⚠ This block used to read as a DIVERGENCE from canon, and did so
	 * correctly: canon then said only "Columns are FIXED poles … Column header
	 * = the side price pill only", and a component contradicting a
	 * prescriptive document has to say so. RPLY-CLOSE amended canon, so the
	 * divergence is discharged and the two clauses that recorded it are gone.
	 * The ruling itself is kept verbatim above — canon is its source now,
	 * not the document it departs from.
	 */
	composingSide?: Side | null;
	pricing: { yes: string; no: string } | null;
	unitToWin: { yes: string; no: string } | null;
	viewer: ViewerMarketContext | null;
	/** W2.10-C — the viewer's own pseudonym (null = signed-out → no link). */
	ownPseudonym: string | null;
	/** The market slug — the `/u/<own>?market=<slug>` preselect (OQ-5 B). */
	slug: string;
	/**
	 * ⚠⚠ RPLY-1 · R4b — `showControls` IS GONE FROM THIS COMPONENT, AND THE
	 * SUPERSEDED RULING IS RECORDED RATHER THAN DELETED (O-4). It read: "FALSE ON
	 * THE COLUMN THAT IS HOSTING A COMPOSER. Founder ruling: the mirrored header
	 * keeps the composing side's label, percent, odds and position readout, and
	 * loses its Buy and its Sell."
	 *
	 * ⛔ THAT RULING IS `SlotHeader`'S, AND IT STILL HOLDS THERE. It was carried
	 * across to this strip by name, but the two components are not the same
	 * shape: this one's own docblock says it in terms — "the market grammar MINUS
	 * action buttons … NO Đ BET / Sell buttons on the debate surface." There was
	 * no Buy and no Sell here to suppress. The founder's R4b wording is exactly
	 * that observation: "both headers should be same … there are no buy/sell
	 * buttons anyway."
	 *
	 * ⇒ MEASURED BEFORE REMOVING (OVN-O4). Across signed-out · signed-in with no
	 * position · holding YES · holding NO, each with and without a pseudonym, and
	 * in all three composer states, the flag changed exactly ONE thing: whether
	 * the held column's position readout was a `<Link>` or plain text. A
	 * click-through to the viewer's own profile is not a Buy and not a Sell, so
	 * suppressing it was the ruling being applied past its subject — and opening
	 * a composer silently took an affordance away from a header that was not
	 * hosting anything the reader was interacting with.
	 *
	 * ⛔ REMOVED RATHER THAN LEFT DEFAULTING TRUE. After R1 the hosting column is
	 * the pole OPPOSITE the bet, and F-3 only permits opening a relation whose
	 * resulting side IS the held side — so the held column can no longer BE the
	 * hosting column and the flag had become unreachable. Leaving it would have
	 * meant the founder's ruling holding by an arithmetic coincidence with a
	 * different slice, which is precisely the kind of guarantee that evaporates
	 * the next time someone changes the column rule.
	 *
	 * ⚠⚠ RPLY-2 · R2 — CS12'S OTHER CLAUSE ARRIVES HERE NOW, AND THIS RULING IS
	 * UNCHANGED BY IT. R4b's finding was about the SECOND clause only ("loses
	 * its Buy and its Sell") — correctly retired above, since this strip never
	 * had either. The FIRST clause ("keeps the composing side's label, percent,
	 * odds") was never implemented on this strip at all until `composingSide`
	 * above. Both are true at once: nothing here had a control to lose, and
	 * nothing here ever mirrored a label either — until the founder's separate
	 * observation that a YES composer hosted in the NO column left that
	 * column's strip reading "No" beside what the reader had just bet YES on.
	 */
}) {
	const displaySide = composingSide ?? side;
	const pct = pricing ? formatPricePercent(pricing, displaySide) : "—";
	const unit = unitToWin
		? unitToWin[displaySide === "YES" ? "yes" : "no"]
		: null;
	// ⛔ NOT `displaySide`. The position readout is a fact about the VIEWER'S
	// OWN holding on THIS column's true pole — mirroring it would print a
	// falsehood the moment the viewer holds a position on the pole this
	// column is temporarily labelled with instead of the one it actually is.
	const held = viewer?.position && viewer.position.side === side;
	return (
		<div className="flex min-h-12 items-center justify-between gap-2 rounded-(--r) px-3.5 py-1.5 shadow-(--elev-1) [border:var(--hairline)]">
			<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				<span>To win</span>
				<span className="font-mono text-xs tracking-normal text-ink normal-case">
					Đ 1 <span aria-hidden="true">→</span> Đ{" "}
					{unit !== null ? formatMultiplier(unit) : "—"}
				</span>
			</span>

			<span className="flex items-center gap-[5px] text-[19px] font-semibold text-ink">
				{displaySide === "YES" ? "Yes" : "No"}
				<PriceThumb side={displaySide} />
				<b className="font-extrabold">{pct}</b>
			</span>

			{/* W2.10-C click-through target — activated at A5 (F-4): the held
			    readout links to the viewer's own profile, market-filter
			    preselected (OQ-5 B). Signed-out → non-interactive. */}
			<span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-n5 uppercase">
				{held && viewer?.position ? (
					/* ⚠ RPLY-1 · R4b — the ONLY remaining condition is whether we know
					   who the viewer is. Signed out there is nobody to link to, so the
					   plain-text variant below carries the same words and the same
					   figure without a click-through. Opening a composer no longer
					   enters this decision at all — see the prop block above. */
					ownPseudonym !== null ? (
						<Link
							data-testid="w210c-sell-link"
							href={`/u/${encodeURIComponent(ownPseudonym)}?market=${encodeURIComponent(slug)}`}
							// POLL-IDLE 1b — no prefetch: every DebatePoll refresh invalidates the
							// prefetch cache and re-prefetches every visible link (Next 16.3.2
							// `pingVisibleLinks`), so this link cost a request per tick, per viewer.
							prefetch={false}
							className="flex items-center gap-1 hover:text-ink"
						>
							<span>Your position</span>
							<span className="font-mono text-xs tracking-normal text-ink normal-case">
								Đ {formatDharma(viewer.position.currentValue)}
							</span>
						</Link>
					) : (
						<>
							<span>Your position</span>
							<span className="font-mono text-xs tracking-normal text-ink normal-case">
								Đ {formatDharma(viewer.position.currentValue)}
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
