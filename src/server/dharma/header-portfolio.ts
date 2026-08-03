// SPDX-License-Identifier: AGPL-3.0-or-later

import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import type { DbClient } from "@/db";
import { payoutEvents, pools, positions } from "@/db/schema";
import { computeSell } from "@/server/cpmm/calculate";
import { CpmmDecimal, toFixed18 } from "@/server/cpmm/decimal";
import { safeCaptureException } from "@/server/observability/safe-capture";

/**
 * The header Đ PORTFOLIO figure: Σ Đb over the viewer's OPEN holdings, or
 * `null` when the read fails. Display-grade — no write, no engine contact, no
 * transaction. The SPEC.1 §23 Positions-value quantity (`:1596`) on the §10.8
 * basis, rendered in the global header beside Balance.
 *
 * Đb IS EXECUTION VALUE, NOT MARK-TO-MARKET. `computeSell(quantity).proceeds`
 * against the live pool — impact-inclusive per cpmm §6.3. SPEC.1 §10.8 (`:588`)
 * rejects mark-to-market as a display basis outright, so `quantity × price` is
 * the wrong number here and everywhere. `computeSell` is IMPORTED, never
 * re-implemented: it is the single Đb authority and the reason the FI-2 identity
 * below is achievable at all.
 *
 * FI-2 — ONE HOLDING, ONE VALUE (SPEC.1 §23 `:1592`). The figure this returns
 * and the §23 Positions-value tile are the SAME quantity, so the only acceptable
 * relation between them is byte-identity. That is achieved by SAME-SOURCE
 * DERIVATION, not by extraction: the three statements below mirror
 * `loadProfilePositions` statements 1 · 2 · 4 (`profile/positions.ts:139–146`,
 * `:163–171`, `:189–196`) in table, columns and predicate, and the in-memory
 * `quantity > 0` filter mirrors `:151–155`. `positions.ts` is READ-ONLY here —
 * web ruled diff-and-test over refactor (`UI-A6.md:174`), the same treatment
 * `bookmarks/figures.ts` shipped under. DO NOT invent a different source, and
 * do not "optimise" a predicate: the identity is locked by
 * `tests/integration/header-portfolio.integration.test.ts`, and if that test
 * cannot pass, this read is wrong.
 *
 * THE POOLS READ TAKES THE FULL HELD-MARKET LIST — including markets already
 * settled, whose pool rows are then discarded in memory. Narrowing it to the
 * unsettled ids is tempting and wrong twice over: it is a predicate divergence
 * from the `positions.ts` mirror, and if EVERY held market is settled the
 * narrowed list is empty, making `inArray(x, [])` reachable. The discarded rows
 * cost nothing — they ride a statement that issues either way.
 *
 * SETTLED IS ROW EXISTENCE, NOT A NON-ZERO AMOUNT. A market with ≥1
 * `payout_events` row for this user is settled and is EXCLUDED: its value has
 * already landed in the ledger, and therefore in Balance, so counting it here
 * would double-count it against the other stat. `resolution/settle.ts:126–137`
 * writes a zero-amount leg per bet, so amount-nonzero would misclassify a real
 * settlement. Settlement never zeroes `positions`: the resolution write path —
 * `resolution/{settle,void,correct}.ts` — appends `resolution_events`,
 * `payout_events` and the ledger chain and flips `markets`, but only ever READS
 * `positions` (`.from(positions)`, never an insert or update), and
 * `positions/persist.ts:66` is that table's sole writer in the whole tree. That
 * is exactly why a `quantity > 0` test alone would `computeSell` against a
 * resolved pool and report a phantom figure.
 *
 * DELIBERATELY SEPARATE FROM `header-balance.ts`, AND NEVER FUSED WITH IT. The
 * two reads are awaited concurrently in `src/app/(public)/layout.tsx` — the
 * `Promise.all` lives there, in the route layer, not in a server-side
 * orchestrating module. They are not merged because `header-balance.ts` pins a
 * BALANCE-FIRST / CURSOR-SECOND statement order as a correctness constraint
 * (MEDIUM-1, `3b7db8d`): reversing it turns a one-credit understatement into a
 * `DAILY_CREDIT_DHARMA` OVERSTATEMENT — a header promising capacity the composer
 * will reject. A single interleaved read would put that ordering at the mercy of
 * whoever next tidies the statements, and the breakage would be silent. Keep
 * them apart.
 *
 * `null` MEANS FAILURE, NEVER EMPTINESS. A viewer holding no open positions has
 * a true, renderable figure — Đ 0 — and gets the canonical zero. `null` is
 * reserved for the catch below, and the cluster treats the two differently: a
 * failed Portfolio degrades to Balance-only rather than blanking the working
 * half. The cluster's own render gate is Balance's null, not this one's.
 */
export async function getHeaderPortfolio(
	client: DbClient,
	userId: string,
): Promise<string | null> {
	try {
		// S1 — `positions.ts:139–146`, mirrored.
		const positionRows = await client
			.select({
				marketId: positions.marketId,
				side: positions.side,
				quantity: positions.quantity,
			})
			.from(positions)
			.where(eq(positions.userId, userId));

		// `positions.ts:147–155` — a fully-exited market keeps its row at zero, so
		// the held set is the FILTERED one. Handing `shares: "0"` to `computeSell`
		// would throw on its `requirePositive` guard.
		const heldByMarket = new Map<
			string,
			{ side: "YES" | "NO"; quantity: string }
		>();
		for (const p of positionRows) {
			if (new CpmmDecimal(p.quantity).greaterThan(0)) {
				heldByMarket.set(p.marketId, { side: p.side, quantity: p.quantity });
			}
		}
		// A CONTROL STEP, NOT A STATEMENT (`positions.ts:156–158`) — S2 and S3
		// never issue. Returns the canonical zero rather than `[]`: emptiness is a
		// fact worth rendering.
		if (heldByMarket.size === 0) {
			return toFixed18(new CpmmDecimal(0));
		}
		const marketIdList = [...heldByMarket.keys()];

		// S2 — `positions.ts:163–171`, mirrored. `amount` is selected for mirror
		// parity and is deliberately NOT the discriminant (see the docblock).
		const payoutRows = await client
			.select({ marketId: payoutEvents.marketId, amount: payoutEvents.amount })
			.from(payoutEvents)
			.where(
				and(
					eq(payoutEvents.userId, userId),
					inArray(payoutEvents.marketId, marketIdList),
				),
			);
		const settledMarkets = new Set(payoutRows.map((r) => r.marketId));

		// S3 — `positions.ts:189–196`, mirrored, over the FULL id list.
		const poolRows = await client
			.select({
				marketId: pools.marketId,
				yesReserves: pools.yesReserves,
				noReserves: pools.noReserves,
			})
			.from(pools)
			.where(inArray(pools.marketId, marketIdList));
		const poolByMarket = new Map(poolRows.map((p) => [p.marketId, p]));

		// In memory, zero further statements. Exact decimal arithmetic throughout —
		// never a JS float on a Đ value (CLAUDE.md §2).
		let sum = new CpmmDecimal(0);
		for (const marketId of marketIdList) {
			if (settledMarkets.has(marketId)) {
				continue;
			}
			const held = heldByMarket.get(marketId);
			const pool = poolByMarket.get(marketId);
			if (held === undefined || pool === undefined) {
				// UNREACHABLE BY CONSTRUCTION — a held position mints only inside the
				// pool-locked W-1 tx, so a held market always carries a pool row.
				//
				// IT THROWS, AND THE THROW IS THE POINT. Skipping the holding would
				// drop it from the Σ and return a perfectly ordinary-looking number —
				// a PLAUSIBLE WRONG FIGURE, which DROUND R1 ruled strictly worse than
				// an obviously-broken one. The catch below converts this to `null`, so
				// the cluster degrades to Balance-only: the viewer is told Portfolio
				// is unavailable rather than quietly believing an understated net
				// worth. Failing closed also restores parity with the mirror this read
				// follows — `positions.ts::reservesOf` (`:416–426`) throws on exactly
				// this condition.
				throw new Error(
					`getHeaderPortfolio: held position with no pool row (market ${marketId})`,
				);
			}
			sum = sum.plus(
				computeSell({
					reserves: { yes: pool.yesReserves, no: pool.noReserves },
					side: held.side === "YES" ? "yes" : "no",
					shares: held.quantity,
				}).proceeds,
			);
		}

		return toFixed18(sum);
	} catch (err) {
		// THE FAIL-SAFE (R8), and it is load-bearing for the same reason
		// `header-balance.ts:117–137` documents: this runs in
		// `(public)/layout.tsx`, so an unhandled throw takes down EVERY participant
		// route — all four pages plus the branded 404 — and lands on
		// `global-error.tsx`, because a same-segment `error.tsx` cannot catch its
		// own layout's throw. Trading the whole app for a chrome figure is never
		// right. SHELL-COMPLETE r5 Q4 ratifies this shape for layout-mounted
		// chrome: "any error returns `null`."
		//
		// Captured, not swallowed silently — `safeCaptureException` is itself
		// fail-open (SPEC.2 §17.5), so observing the failure cannot cause one.
		// NOT deduped or sampled: `DebatePoll` re-runs this layout every 15 s per
		// open `/m/[slug]` tab, so a deterministic DB failure emits at 4/min/tab —
		// the same amplification shape `header-balance.ts` records, and it belongs
		// to the same HARDEN pass, not to this slice.
		safeCaptureException(err, {
			tags: { kind: "header_portfolio_read_failed" },
		});
		return null;
	}
}
