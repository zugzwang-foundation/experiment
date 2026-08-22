"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { parseWireResponse } from "@/components/debate/composer/envelope";
import {
	initialKeyState,
	reduceKey,
} from "@/components/debate/composer/idempotency";
import { buildSellRequest } from "@/components/debate/composer/requests";
import { formatDharma } from "@/components/debate/format";
import { Button } from "@/components/ui/button";
import type { ProfilePositionLot } from "@/server/profile/positions";

/**
 * LOTS-1 / ADR-0039 — the per-argument decomposition of a holding, and the
 * control that exits one argument.
 *
 * ⛔ **"Lot" appears nowhere a participant can read it (R1).** The word is the
 * schema's, not the product's. On screen these are *arguments*.
 *
 * Every figure here is a **cost**, never a value. `survivingBasis` is what is
 * still staked behind an argument; `originalBasis` is what was staked when it
 * was made. There is deliberately **no per-argument "worth now"** — SPEC.1 §23's
 * FI-2 forbids one holding showing two different current values, and the shares
 * are fungible in the pool, so only the position has a defensible mark. The
 * holding's Đb stays where it is, on the row above.
 *
 * **R6, precisely.** A partially-sold argument renders its REDUCED figure and no
 * tag; only an argument with nothing left carries `Sold`. The reduced number is
 * the signal, and a tag on a trimmed argument would say more than happened. When
 * a figure has moved, the original is shown struck through beside it, so the
 * reader can see both what was committed and what remains without arithmetic.
 */
export function LotBreakdown({
	marketId,
	lots,
	sellable,
}: {
	marketId: string;
	lots: ProfilePositionLot[];
	/**
	 * Owner arm, market Open, position held — the same predicate that gates the
	 * row's own Sell trigger. Visitors get the decomposition with no controls:
	 * the record is public (SPEC.1 §23's owner-vs-visitor payload law), the
	 * affordance is not.
	 */
	sellable: boolean;
}): React.JSX.Element | null {
	if (lots.length === 0) {
		return null;
	}
	return (
		<ul
			data-testid={`lot-breakdown-${marketId}`}
			className="flex flex-col gap-1 py-1"
		>
			{lots.map((lot) => (
				<LotRow
					key={lot.lotId}
					marketId={marketId}
					lot={lot}
					sellable={sellable}
				/>
			))}
		</ul>
	);
}

function LotRow({
	marketId,
	lot,
	sellable,
}: {
	marketId: string;
	lot: ProfilePositionLot;
	sellable: boolean;
}): React.JSX.Element {
	const reduced = !lot.sold && lot.survivingBasis !== lot.originalBasis;
	return (
		<li
			data-testid={`lot-${lot.lotId}`}
			className="flex items-center gap-2 text-xs"
		>
			{/* SC-1 — the removed variant carries NO title field, so there is nothing
			    here that COULD leak a removed body. The stub is structural. */}
			<span className="min-w-0 flex-1 truncate text-n6">
				{lot.argument.removed ? (
					<span className="text-n4 italic">[removed]</span>
				) : (
					lot.argument.title
				)}
			</span>

			<span
				data-testid={`lot-basis-${lot.lotId}`}
				className="shrink-0 font-mono tabular-nums text-ink"
			>
				Đ {formatDharma(lot.survivingBasis)}
			</span>

			{/* The original, struck, ONLY when the figure has actually moved — so an
			    untouched argument shows one number rather than the same number twice. */}
			{reduced && (
				<span
					data-testid={`lot-original-${lot.lotId}`}
					className="shrink-0 font-mono text-n4 line-through tabular-nums"
				>
					Đ {formatDharma(lot.originalBasis)}
				</span>
			)}

			{/* R6/R10 — Sold is per-ARGUMENT and renders ONLY at zero. It composes
			    with the position-level Exited/Flipped markers rather than replacing
			    them: an argument can be Sold while the holding is still held. */}
			{lot.sold && (
				<span
					data-testid={`lot-sold-${lot.lotId}`}
					className="shrink-0 rounded-[var(--r-chip)] bg-n1 px-1.5 py-0.5 font-bold text-[10px] text-n5 uppercase tracking-[0.08em]"
				>
					Sold
				</span>
			)}

			{sellable && !lot.sold && (
				<ExitArgumentButton
					marketId={marketId}
					lotId={lot.lotId}
					shares={lot.survivingShares}
				/>
			)}
		</li>
	);
}

/**
 * Exit ONE argument, entirely.
 *
 * ⚠ **Whole-argument only, and that is a correctness choice rather than a
 * scope cut.** The shipped `SellModule` is Đ-denominated: it seeds its input
 * from the position's `currentValue` and converts back to shares, and its
 * "sell all" path depends on `dharmaIn` being **byte-identical** to that seed
 * (`sell-convert.ts` returns the held quantity exactly in that case, and a
 * rounded seed turns a full exit into a division that strands dust). There is
 * no per-argument `currentValue` to seed from — FI-2 forbids minting one — so
 * reusing that module per argument would strand dust on **every** full exit.
 *
 * Posting the argument's exact surviving shares avoids the conversion entirely:
 * the request is share-denominated, hits the engine's by-law full-sale branch,
 * and lands on exactly zero. **Partial per-argument selling is deliberately not
 * offered here** — it needs a share-denominated input or a per-argument quote,
 * and inventing either tonight would be the kind of thing that looks fine until
 * someone's dust is stranded.
 */
function ExitArgumentButton({
	marketId,
	lotId,
	shares,
}: {
	marketId: string;
	lotId: string;
	shares: string;
}): React.JSX.Element {
	const router = useRouter();
	const [keyState, setKeyState] = useState(() => initialKeyState());
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	async function exit() {
		if (busy) {
			return;
		}
		setBusy(true);
		setFailed(false);
		// The §3.2 key law: this submission mints/reuses its key exactly as the
		// composer's does, so a retry after a dropped socket replays rather than
		// double-selling.
		const next = reduceKey(keyState, { type: "SUBMIT" });
		setKeyState(next);
		const { url, init } = buildSellRequest({
			body: { marketId, shares, lotId },
			idempotencyKey: next.key,
		});
		try {
			const res = await fetch(url, init);
			const outcome = await parseWireResponse(res);
			if (outcome.kind === "success") {
				setKeyState(reduceKey(next, { type: "OUTCOME", outcome: "success" }));
				router.refresh();
				return;
			}
			setKeyState(reduceKey(next, { type: "OUTCOME", outcome: "terminal" }));
			setFailed(true);
		} catch {
			setKeyState(reduceKey(next, { type: "OUTCOME", outcome: "transient" }));
			setFailed(true);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			data-testid={`lot-exit-${lotId}`}
			aria-label="Exit this argument"
			disabled={busy}
			onClick={exit}
			className="h-6 shrink-0 px-2 text-[10px]"
		>
			{busy ? "…" : failed ? "Retry" : "Exit"}
		</Button>
	);
}
