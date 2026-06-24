import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
	Banner,
	buttonClass,
	inputClass,
	labelClass,
	Shell,
	selectClass,
	textareaClass,
} from "@/components/internal-ui";
import { db } from "@/db";
import { markets, pools } from "@/db/schema";
import { closeMarketAction } from "@/server/admin/markets/close";
import { correctResolutionAction } from "@/server/admin/markets/correct";
import { resolveMarketAction } from "@/server/admin/markets/resolve";
import { seedPoolAction } from "@/server/admin/markets/seed";
import { voidMarketAction } from "@/server/admin/markets/void";
import { requireAdminPage, requireUuidParam } from "@/server/admin/page-guards";

// ENGINE.15 S3 — R-15.1 market detail + state-appropriate forms. Server
// Component, ZERO client JS (D-15.e). Each form binds an inline wrapper that
// calls the wire action and surfaces the result via a redirect param. Forms for
// non-applicable states are NOT rendered; the service + state machine remain
// the real gate (SPEC.1 §15.1 server-side enforcement posture). UI.6
// admin-fixes: legibility pass (STYLE-ONLY — the inline server actions, field
// names, and state conditionals are unchanged).
export const dynamic = "force-dynamic";

export default async function MarketDetailPage(props: {
	params: Promise<{ marketId: string }>;
	searchParams: Promise<{ ok?: string; error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();
	const marketId = requireUuidParam((await props.params).marketId);
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
		<Shell title={market.slug} maxWidth="max-w-2xl">
			<nav className="mb-6 text-sm">
				<Link
					href="/admin/markets"
					className="text-muted-foreground underline-offset-2 hover:underline"
				>
					← Markets
				</Link>
			</nav>

			{ok ? <Banner tone="ok">OK: {ok}</Banner> : null}
			{error ? <Banner tone="error">Error: {error}</Banner> : null}

			<dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-lg border border-border bg-card p-5 shadow-sm sm:grid-cols-[10rem_1fr]">
				<dt className="text-sm font-medium text-muted-foreground">Status</dt>
				<dd className="text-sm">
					<span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium">
						{market.status}
					</span>
				</dd>
				<dt className="text-sm font-medium text-muted-foreground">Title</dt>
				<dd className="text-sm">{market.title}</dd>
				<dt className="text-sm font-medium text-muted-foreground">
					Description
				</dt>
				<dd className="text-sm">{market.description ?? "—"}</dd>
				<dt className="text-sm font-medium text-muted-foreground">
					Resolution deadline
				</dt>
				<dd className="font-mono text-sm">
					{market.resolutionDeadline.toISOString()}
				</dd>
				<dt className="text-sm font-medium text-muted-foreground">Outcome</dt>
				<dd className="text-sm">{market.resolutionOutcome ?? "—"}</dd>
				{pool ? (
					<>
						<dt className="text-sm font-medium text-muted-foreground">
							Reserves
						</dt>
						<dd className="font-mono text-sm">
							YES {pool.yesReserves} / NO {pool.noReserves}
						</dd>
					</>
				) : null}
			</dl>

			<div className="mt-6 space-y-6">
				{market.status === "Draft" ? (
					<form
						action={runSeed}
						className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm"
					>
						<h2 className="text-lg font-semibold">Seed pool (open market)</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<div className="space-y-1.5">
							<label htmlFor="seedAmount" className={labelClass}>
								Seed amount
							</label>
							<input
								id="seedAmount"
								name="seedAmount"
								required
								className={inputClass}
							/>
						</div>
						<button type="submit" className={buttonClass}>
							Seed &amp; open
						</button>
					</form>
				) : null}

				{market.status === "Open" ? (
					<form
						action={runClose}
						className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm"
					>
						<h2 className="text-lg font-semibold">Close market</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<button type="submit" className={buttonClass}>
							Close
						</button>
					</form>
				) : null}

				{market.status === "Closed" || market.status === "Resolving" ? (
					<form
						action={runResolve}
						className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm"
					>
						<h2 className="text-lg font-semibold">
							{isResuming ? "Complete settlement" : "Resolve"}
						</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<div className="space-y-1.5">
							<label htmlFor="winningSide" className={labelClass}>
								Winning side
							</label>
							<select
								id="winningSide"
								name="winningSide"
								className={selectClass}
							>
								<option value="YES">YES</option>
								<option value="NO">NO</option>
							</select>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="resolve-reason" className={labelClass}>
								Reason
							</label>
							<textarea
								id="resolve-reason"
								name="reason"
								required
								className={textareaClass}
							/>
						</div>
						<button type="submit" className={buttonClass}>
							{isResuming ? "Complete settlement" : "Resolve"}
						</button>
					</form>
				) : null}

				{market.status === "Resolved" ? (
					<form
						action={runCorrect}
						className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm"
					>
						<h2 className="text-lg font-semibold">Correct resolution</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<div className="space-y-1.5">
							<label htmlFor="correctedSide" className={labelClass}>
								Corrected side
							</label>
							<select
								id="correctedSide"
								name="correctedSide"
								className={selectClass}
							>
								<option value="YES">YES</option>
								<option value="NO">NO</option>
							</select>
						</div>
						<div className="space-y-1.5">
							<label htmlFor="correct-reason" className={labelClass}>
								Reason
							</label>
							<textarea
								id="correct-reason"
								name="reason"
								required
								className={textareaClass}
							/>
						</div>
						<button type="submit" className={buttonClass}>
							Correct
						</button>
					</form>
				) : null}

				{market.status === "Open" || market.status === "Closed" ? (
					<form
						action={runVoid}
						className="space-y-4 rounded-lg border border-border bg-card p-5 shadow-sm"
					>
						<h2 className="text-lg font-semibold">Void market</h2>
						<input type="hidden" name="marketId" value={marketId} />
						<div className="space-y-1.5">
							<label htmlFor="void-reason" className={labelClass}>
								Reason
							</label>
							<textarea
								id="void-reason"
								name="reason"
								required
								className={textareaClass}
							/>
						</div>
						<button type="submit" className={buttonClass}>
							Void
						</button>
					</form>
				) : null}
			</div>
		</Shell>
	);
}
