// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDharma } from "@/components/debate/format";
import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

/**
 * The signed-in Đ cluster — the locked W2.4/.5/.14 anatomy (mockup v0_2
 * `:268–281`, CSS `:123–130`): one bordered box, one `Đ` glyph, a hairline
 * separator, then TWO column-stats, `Portfolio` then `Balance`. Renamed from
 * `BalanceCluster` at HEADER-PORTFOLIO — a component rendering two stats could
 * not keep a one-stat name (R10). It discharges the UI.A1 OQ-2 deferral in
 * full; `IdentityCluster.tsx:13–15` had been documenting the missing half ever
 * since A1.
 *
 * PORTFOLIO FIRST, then BALANCE. That order is the ratified two-stat shape, not
 * a layout preference.
 *
 * PORTFOLIO IS Σ Đb OVER OPEN HOLDINGS — the §23 Positions-value quantity on
 * the §10.8 basis, byte-identical to that tile for the same viewer against the
 * same pool state (FI-2: one holding never shows two different current values).
 * The derivation lives in `server/dharma/header-portfolio.ts`; nothing is
 * computed here.
 *
 * LABEL IS `Balance`, VALUE IS SPENDABLE-TODAY. Not a divergence from the
 * design lock — it IS the lock: the W2.4/.5/.14 close-out defines the cluster
 * as "Portfolio (open-position value) + Balance (spendable)". `Balance` is the
 * label; *spendable* is its ratified gloss. There is no verbal collision with
 * the profile tile, which reads `Wallet value` and renders the RAW ledger
 * figure — a deliberately different quantity (SPEC.1 §21.8).
 *
 * LABEL TEXT IS THE COPY REGISTER; `uppercase` IS ITS RENDERING — the mockup's
 * `.lab` carries `text-transform:uppercase` over DOM text `Portfolio`, and the
 * repo is unanimous on that split (`RadioSlot.tsx:29`,
 * `PositionStrip.tsx:44,61`, `SellModule.tsx:263,278`).
 *
 * THE RENDER GATE IS BALANCE'S NULL, NOT PORTFOLIO'S. `spendable === null` means
 * no `dharma_ledger` row — pre-grant or mid-signup — and the whole cluster
 * disappears, because an absent figure reads as "not yet" while a zero reads as
 * "you are broke". A null `portfolio` is a different fact: the READ failed, so
 * the cluster degrades to Balance-only. Chrome degrades; it never removes a
 * working figure or fails a page. And a `portfolio` of zero RENDERS — `Đ 0` is
 * true and informative, never blank and never `—` (R9).
 *
 * `formatDharma` is the single shared display formatter for every Đ value shown
 * to a user (SPEC.1 §10.8); the ledger keeps full precision. It rounds to 0 dp
 * AND GROUPS the integer part in threes with a literal ASCII comma, so this
 * cluster renders `Đ 2,480` — the mockup's figure, now the built one.
 *
 * SUPERSEDED, recorded so it cannot be mistaken for governing: this comment
 * previously read "UNGROUPED per R4 … the mockup's `Đ 2,480` is tier-4
 * illustrative; digit grouping is one product-wide ruling routed to POLISH,
 * not settled here." PRIMITIVES-1 IS that POLISH ruling, and it settled the
 * question the other way — §10.8 at 1.0.29 groups every Đ value rendered to a
 * user, product-wide. The §23 Positions-value tile this cluster was matched
 * against groups too, so the two still agree; what changed is what they agree
 * ON. Grouping is a property of the shared formatter, never a per-surface
 * choice (D2), so nothing here selects it and nothing here may opt out.
 *
 * ⛔ AND BELOW 640px THIS CLUSTER IS NOT RENDERED AT ALL (ADR-0049). That
 * reverses MOBILE-1 Phase A, which ruled this component visible at EVERY width;
 * the reversal is the founder's, taken on an informed basis, and the cost is
 * stated rather than softened — a signed-in phone user browsing markets does not
 * see their stakeable balance without navigating away. What makes it acceptable
 * is that the information is RELOCATED, not removed: the identity chip beside
 * this one still links to the viewer's own profile, where balance and portfolio
 * both render. The same relocation argument hid the Discovery hero at Phase A.
 *
 * ⚠ THE HIDE LIVES HERE, ON THIS COMPONENT'S OWN ROOT, AND NOT IN THE HEADER.
 * A wrapper `<div className="max-mobile:hidden">` in `GlobalHeader` would push
 * this node down one level, and `tests/unit/shell/dharma-cluster.test.tsx`'s T4
 * guard walks the right zone's DIRECT children — a wrapper makes every index in
 * that guard resolve to `-1`. `VisitorCounter` ships this same own-root shape for
 * this same reason. It is gated on `mobileResponsive` like every other reflow
 * class in this subtree, so the gate stays the prop chain rather than the file
 * boundary (AGENTS.md §8).
 *
 * SEMANTIC TIER, NOT RAW PRIMITIVE (POLISH-1a V9). `bg-(--btn-fill)` and
 * `text-muted-foreground` resolve to the SAME literals as the `bg-ground` /
 * `text-n5` they replace — the change is which tier the cluster binds, matching
 * the two siblings it sits beside (`IdentityCluster`'s chip already binds
 * `--btn-fill`; `VisitorCounter`'s label already binds `muted-foreground`).
 * Do not "simplify" these back to the primitives.
 */
export function DharmaCluster({
	portfolio,
	spendable,
	mobileResponsive = false,
}: {
	portfolio: string | null;
	spendable: string | null;
	/**
	 * ADR-0049 — when true, this cluster is not rendered below 640px. Threaded
	 * from the layout through `GlobalHeader`; it defaults `false` so a mount that
	 * does not pass it inherits the DESKTOP render rather than an accidental
	 * reflow (AGENTS.md §8). Both of today's mounts opt in, and the default is
	 * still what makes a future third mount safe by omission.
	 */
	mobileResponsive?: boolean;
}): React.JSX.Element | null {
	if (spendable === null) {
		return null;
	}

	return (
		<span
			data-testid="dharma-cluster"
			className={cn(
				"mr-3.5 flex h-11 shrink-0 items-center gap-[13px] rounded-(--r) bg-(--btn-fill) pr-3.5 pl-3 select-none [border:var(--hairline)]",
				mobileResponsive && "max-mobile:hidden",
			)}
		>
			<InfoTip content={GLOSSARY.dharma} asChild>
				<span className="text-[17px] font-bold text-ink">Đ</span>
			</InfoTip>
			{/* The mockup's `.sep` hairline — decorative, so no testid. It is NOT the
			    §21.1 register boundary: that is the `w-px` divider in `GlobalHeader`'s
			    right zone, a separate named untouchable. Do not conflate them. */}
			<span aria-hidden="true" className="h-[26px] w-px bg-n2" />
			{portfolio !== null ? (
				<span className="flex flex-col gap-1 leading-none">
					<InfoTip content={GLOSSARY.portfolio} asChild>
						<span className="text-[8.5px] font-bold tracking-[0.13em] text-muted-foreground uppercase">
							Portfolio
						</span>
					</InfoTip>
					<span className="text-[13px] font-bold text-ink tabular-nums">
						Đ {formatDharma(portfolio)}
					</span>
				</span>
			) : null}
			<span className="flex flex-col gap-1 leading-none">
				<InfoTip content={GLOSSARY.balance} asChild>
					<span className="text-[8.5px] font-bold tracking-[0.13em] text-muted-foreground uppercase">
						Balance
					</span>
				</InfoTip>
				<span className="text-[13px] font-bold text-ink tabular-nums">
					Đ {formatDharma(spendable)}
				</span>
			</span>
		</span>
	);
}
