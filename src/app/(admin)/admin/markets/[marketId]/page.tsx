import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { markets, pools } from "@/db/schema";
import { closeMarketAction } from "@/server/admin/markets/close";
import { correctResolutionAction } from "@/server/admin/markets/correct";
import { resolveMarketAction } from "@/server/admin/markets/resolve";
import { seedPoolAction } from "@/server/admin/markets/seed";
import { voidMarketAction } from "@/server/admin/markets/void";

// ENGINE.15 S3 — R-15.1 market detail + state-appropriate forms. Server
// Component, ZERO client JS (D-15.e). Each form binds an inline wrapper that
// calls the wire action and surfaces the result via a redirect param. Forms for
// non-applicable states are NOT rendered; the service + state machine remain
// the real gate (SPEC.1 §15.1 server-side enforcement posture).
export const dynamic = "force-dynamic";

export default async function MarketDetailPage(props: {
	params: Promise<{ marketId: string }>;
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
	const { marketId } = await props.params;
	const { ok, error } = await props.searchParams;

	const [market] = await db
		.select()
		.from(markets)
		.where(eq(markets.id, marketId));
	if (!market) notFound();
	const [pool] = await db
		.select({ yesReserves: pools.yesReserves, noReserves: pools.noReserves })
		.from(pools)
		.where(eq(pools.marketId, marketId));

	// Inline wrappers close over `marketId` (a serializable string) and call the
	// module-scope `redirect` directly — never over a helper function (a Next
	// server-action closure must capture only serializable values).
	async function runSeed(formData: FormData): Promise<void> {
		"use server";
		const r = await seedPoolAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=seeded" : `error=${r.error.code}`}`,
		);
	}
	async function runClose(formData: FormData): Promise<void> {
		"use server";
		const r = await closeMarketAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=closed" : `error=${r.error.code}`}`,
		);
	}
	async function runResolve(formData: FormData): Promise<void> {
		"use server";
		const r = await resolveMarketAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=resolved" : `error=${r.error.code}`}`,
		);
	}
	async function runCorrect(formData: FormData): Promise<void> {
		"use server";
		const r = await correctResolutionAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=corrected" : `error=${r.error.code}`}`,
		);
	}
	async function runVoid(formData: FormData): Promise<void> {
		"use server";
		const r = await voidMarketAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=voided" : `error=${r.error.code}`}`,
		);
	}

	const isResuming = market.status === "Resolving";

	return (
		<main>
			<h1>{market.slug}</h1>
			{ok ? <p>OK: {ok}</p> : null}
			{error ? <p>Error: {error}</p> : null}
			<dl>
				<dt>status</dt>
				<dd>{market.status}</dd>
				<dt>title</dt>
				<dd>{market.title}</dd>
				<dt>description</dt>
				<dd>{market.description ?? "—"}</dd>
				<dt>resolution deadline</dt>
				<dd>{market.resolutionDeadline.toISOString()}</dd>
				<dt>outcome</dt>
				<dd>{market.resolutionOutcome ?? "—"}</dd>
				{pool ? (
					<>
						<dt>reserves</dt>
						<dd>
							YES {pool.yesReserves} / NO {pool.noReserves}
						</dd>
					</>
				) : null}
			</dl>

			{market.status === "Draft" ? (
				<form action={runSeed}>
					<h2>Seed pool (open market)</h2>
					<input type="hidden" name="marketId" value={marketId} />
					<label>
						Seed amount <input name="seedAmount" required />
					</label>
					<button type="submit">Seed &amp; open</button>
				</form>
			) : null}

			{market.status === "Open" ? (
				<form action={runClose}>
					<h2>Close market</h2>
					<input type="hidden" name="marketId" value={marketId} />
					<button type="submit">Close</button>
				</form>
			) : null}

			{market.status === "Closed" || market.status === "Resolving" ? (
				<form action={runResolve}>
					<h2>{isResuming ? "Complete settlement" : "Resolve"}</h2>
					<input type="hidden" name="marketId" value={marketId} />
					<label>
						Winning side
						<select name="winningSide">
							<option value="YES">YES</option>
							<option value="NO">NO</option>
						</select>
					</label>
					<label>
						Reason <textarea name="reason" required />
					</label>
					<button type="submit">
						{isResuming ? "Complete settlement" : "Resolve"}
					</button>
				</form>
			) : null}

			{market.status === "Resolved" ? (
				<form action={runCorrect}>
					<h2>Correct resolution</h2>
					<input type="hidden" name="marketId" value={marketId} />
					<label>
						Corrected side
						<select name="correctedSide">
							<option value="YES">YES</option>
							<option value="NO">NO</option>
						</select>
					</label>
					<label>
						Reason <textarea name="reason" required />
					</label>
					<button type="submit">Correct</button>
				</form>
			) : null}

			{market.status === "Open" || market.status === "Closed" ? (
				<form action={runVoid}>
					<h2>Void market</h2>
					<input type="hidden" name="marketId" value={marketId} />
					<label>
						Reason <textarea name="reason" required />
					</label>
					<button type="submit">Void</button>
				</form>
			) : null}
		</main>
	);
}
