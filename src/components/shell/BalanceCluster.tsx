// SPDX-License-Identifier: AGPL-3.0-or-later

import { formatDharma } from "@/components/debate/format";

/**
 * The signed-in Đ cluster (BALANCE — discharging the UI.A1 OQ-2 deferral, which
 * read "Đ Portfolio/Balance = A2/A3"; A2/A3 were composer tasks and A4
 * explicitly disclaimed it, so `IdentityCluster.tsx:13–15` has been documenting
 * its own missing half ever since).
 *
 * LABEL IS `Balance`, VALUE IS SPENDABLE-TODAY. Not a divergence from the
 * design lock — it IS the lock: the W2.4/.5/.14 close-out defines the cluster
 * as "Portfolio (open-position value) + Balance (spendable)". `Balance` is the
 * label; *spendable* is its ratified gloss. There is no verbal collision with
 * the profile tile, which reads `Wallet value`.
 *
 * THE PORTFOLIO SLOT RENDERS NOTHING — no placeholder, no dash. `Portfolio —`
 * with no value is worse than absence. Portfolio forked to HEADER-PORTFOLIO
 * (N+1 reads, the `loadProfilePositions` spine, FI-2 basis law).
 *
 * Renders nothing at all on `null` (no `dharma_ledger` row — pre-grant or
 * mid-signup), so the right zone collapses to exactly what it is today.
 *
 * `formatDharma` is the single shared 0-dp renderer for every Đ value shown to
 * a user (DROUND / SPEC.1 §10.8); the ledger keeps full precision.
 */
export function BalanceCluster({
	spendable,
}: {
	spendable: string | null;
}): React.JSX.Element | null {
	if (spendable === null) {
		return null;
	}

	return (
		<span
			data-testid="balance-cluster"
			className="mr-3 flex shrink-0 items-baseline gap-1.5 select-none"
		>
			<span className="font-semibold text-n5 text-xs">Đ</span>
			<span className="text-n5 text-xs">Balance</span>
			<span className="font-semibold text-ink text-xs tabular-nums">
				{formatDharma(spendable)}
			</span>
		</span>
	);
}
