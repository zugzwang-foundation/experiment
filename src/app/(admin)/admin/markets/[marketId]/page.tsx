import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminShell } from "@/app/(admin)/admin/_components/AdminShell";
import {
	formatUtcMinute,
	relativeSpan,
} from "@/app/(admin)/admin/_components/format";
import { MarketStatusBadge } from "@/app/(admin)/admin/_components/MarketStatusBadge";
import { Notice } from "@/app/(admin)/admin/_components/Notice";
import { PageHeader } from "@/app/(admin)/admin/_components/PageHeader";
import { TerminalActions } from "@/app/(admin)/admin/markets/_components/TerminalActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/db";
import { markets, pools } from "@/db/schema";
import { cn } from "@/lib/utils";
import { seedPoolAction } from "@/server/admin/markets/seed";
import { requireAdminPage, requireUuidParam } from "@/server/admin/page-guards";

// UI.6 S2 — market admin detail. The Close / Resolve / Void / Correct terminal
// actions are now surfaced through the <TerminalActions> client island: each
// gated action arms only on a typed market-question confirm (D-2), and every
// ActionResult error renders as human copy client-side — the plain-HTML forms
// and their raw `?error=<code>` redirect surface are REPLACED, with no ungated
// parallel path left (R-5). The Draft "Seed" affordance (F-ADMIN-2) keeps its
// inline server-action + `?ok=`/`?error=` redirect surface (the only remaining
// producer of those params here, plus the create form's `?ok=created`).
//
// ADMIN-UI — presentation only. The two reads, `runSeed`, its redirect and the
// seed form's three named fields are unchanged. The seed form gains an
// acknowledgement checkbox that carries NO `name`, so it is never serialised
// into the FormData `seedPoolAction` reads — it is native `required` friction
// ahead of an irreversible Draft → Open, nothing more. The `?ok=` / `?error=`
// values are mapped to operator copy; an unmapped value still shows its code.
//
// S-4 Phase B — `instant = false`: `requireAdminPage` (`cookies()`) plus this
// page's own `params`/`searchParams` are all read unwrapped; any one of them
// errors the `cacheComponents` prerender build otherwise. Deferred, not
// restructured — admin is outside S-4's scope (CLAUDE.md §1).
export const instant = false;

const OK_COPY: Record<string, string> = {
	created: "Market created as a Draft. Seed the pool below to open it.",
	seeded: "Pool seeded — the market is now Open.",
};

const SEED_ERROR_COPY: Record<string, string> = {
	seed_invalid:
		"The opening price or tank was rejected. Opening YES price must be strictly between 0 and 1 (0.10 is 10%), tank must be a positive number, both with at most 18 decimal places — nothing is rounded. A valid-looking pair can still leave one reserve empty: raise the tank or move the price away from 0 or 1.",
	validation_error: "Both the opening YES price and the tank are required.",
	market_not_draft:
		"This market is no longer a Draft — it may already have been opened.",
	market_frozen:
		"The conclusion freeze is set — no market can be opened. Recovery is BREAK_GLASS.md only.",
	admin_session_required:
		"Your admin session has expired — sign in again to continue.",
	lifecycle_serialization_exhausted: "The system is busy — please retry.",
	error_internal: "Something went wrong — please try again.",
};

/** The linear happy path; Voided / Frozen are shown as off-path terminals. */
const LIFECYCLE = ["Draft", "Open", "Closed", "Resolving", "Resolved"];

function LifecycleStrip({ status }: { status: string }): React.ReactElement {
	const current = LIFECYCLE.indexOf(status);
	return (
		<ol
			aria-label="Market lifecycle"
			className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs"
		>
			{LIFECYCLE.map((step, i) => {
				const isCurrent = i === current;
				const reached = current >= 0 && i <= current;
				return (
					<li key={step} className="flex items-center gap-1.5">
						<span
							aria-current={isCurrent ? "step" : undefined}
							className={cn(
								"inline-flex h-6 items-center rounded-(--r-chip) border px-2",
								isCurrent
									? "border-n6 bg-n1 font-semibold text-ink"
									: reached
										? "border-n2 text-n6"
										: "border-n2 border-dashed text-n4",
							)}
						>
							{step}
						</span>
						{i < LIFECYCLE.length - 1 ? (
							<span aria-hidden className="text-n3">
								→
							</span>
						) : null}
					</li>
				);
			})}
			{current < 0 ? (
				<li className="ml-2 flex items-center gap-1.5 text-n5">
					<span aria-hidden className="text-n3">
						·
					</span>
					off-path terminal:
					<MarketStatusBadge status={status} />
				</li>
			) : null}
		</ol>
	);
}

function Fact({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="grid gap-1 border-n2 border-b py-3 last:border-b-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
			<dt className="font-medium text-n5 text-xs uppercase tracking-wide sm:pt-0.5">
				{label}
			</dt>
			<dd className="min-w-0 text-n6 text-sm">{children}</dd>
		</div>
	);
}

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

	// Seed (Draft → Open, F-ADMIN-2) — its inline wrapper + redirect surface are
	// left exactly as ENGINE.15 S3 shipped them.
	async function runSeed(formData: FormData): Promise<void> {
		"use server";
		const r = await seedPoolAction(formData);
		redirect(
			`/admin/markets/${marketId}?${r.ok ? "ok=seeded" : `error=${r.error.code}`}`,
		);
	}

	const nowMs = Date.now();
	const deadlineMs = market.resolutionDeadline.getTime();

	return (
		<AdminShell active="markets">
			<PageHeader
				back={{ href: "/admin/markets", label: "All markets" }}
				title={market.title}
				meta={
					<>
						<MarketStatusBadge status={market.status} />
						<span className="font-mono">{market.slug}</span>
						{market.status !== "Draft" ? (
							<Link
								href={`/m/${market.slug}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 rounded-(--r-chip) text-n5 underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:shadow-(--state-focus-ring)"
							>
								Participant page
								<ExternalLink aria-hidden className="size-3" />
								<span className="sr-only">(opens in a new tab)</span>
							</Link>
						) : null}
					</>
				}
			/>

			{ok ? (
				<Notice tone="success" className="mb-4">
					{OK_COPY[ok] ?? ok}
				</Notice>
			) : null}
			{error ? (
				<Notice tone="error" className="mb-4">
					{SEED_ERROR_COPY[error] ??
						"That action could not be completed — please try again."}
					<span className="mt-1 block font-mono text-n4 text-xs">
						code: {error}
					</span>
				</Notice>
			) : null}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<section
					aria-labelledby="market-facts"
					className="min-w-0 self-start rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)"
				>
					<h2 id="market-facts" className="mb-3 font-semibold text-ink text-sm">
						Market
					</h2>
					<div className="mb-4">
						<LifecycleStrip status={market.status} />
					</div>
					<dl>
						<Fact label="Status">{market.status}</Fact>
						<Fact label="Resolution criterion">
							<p className="whitespace-pre-wrap break-words">
								{market.description ?? "—"}
							</p>
						</Fact>
						<Fact label="Resolution deadline">
							<time
								dateTime={market.resolutionDeadline.toISOString()}
								className="font-mono text-xs"
							>
								{formatUtcMinute(market.resolutionDeadline)}
							</time>
							<span className="ml-2 text-n5 text-xs">
								{relativeSpan(deadlineMs, nowMs)}
							</span>
						</Fact>
						<Fact label="Outcome">{market.resolutionOutcome ?? "—"}</Fact>
						{pool ? (
							<Fact label="Reserves">
								<span className="font-mono text-xs">
									YES {pool.yesReserves} / NO {pool.noReserves}
								</span>
							</Fact>
						) : null}
						{market.mediaVideoUrl ? (
							<Fact label="Explainer video">
								<a
									href={market.mediaVideoUrl}
									target="_blank"
									rel="noreferrer"
									className="break-all text-n6 underline underline-offset-2 hover:text-ink"
								>
									{market.mediaVideoUrl}
								</a>
							</Fact>
						) : null}
						<Fact label="Market id">
							<span className="break-all font-mono text-xs">{market.id}</span>
						</Fact>
					</dl>
				</section>

				<div className="min-w-0">
					<h2 className="mb-3 font-semibold text-ink text-sm">Actions</h2>
					{market.status === "Draft" ? (
						<form
							action={runSeed}
							className="flex flex-col gap-4 rounded-(--r) border border-n2 bg-n0 p-5 shadow-(--elev-1)"
						>
							<div>
								<h3 className="font-semibold text-base text-ink">
									Seed pool (open market)
								</h3>
								<p className="mt-1 text-n5 text-sm">
									Seeding creates the pool and moves the market from Draft to
									Open. Participants can bet as soon as it lands.
								</p>
							</div>
							<input type="hidden" name="marketId" value={marketId} />
							<div className="grid gap-4 sm:grid-cols-2">
								<label
									htmlFor="seed-opening-price-yes"
									className="flex flex-col gap-1.5 text-sm"
								>
									<span className="font-medium text-ink">
										Opening YES price
									</span>
									<Input
										id="seed-opening-price-yes"
										name="openingPriceYes"
										required
										inputMode="decimal"
										autoComplete="off"
										className="font-mono"
									/>
									<span className="text-n5 text-xs">
										Strictly between 0 and 1 — 0.10 is 10%.
									</span>
								</label>
								<label
									htmlFor="seed-tank"
									className="flex flex-col gap-1.5 text-sm"
								>
									<span className="font-medium text-ink">Tank</span>
									<Input
										id="seed-tank"
										name="tank"
										required
										inputMode="decimal"
										autoComplete="off"
										className="font-mono"
									/>
									<span className="text-n5 text-xs">
										A positive number. At most 18 decimal places; never rounded.
									</span>
								</label>
							</div>
							<label className="flex items-start gap-2.5 rounded-(--r) border border-n2 bg-n1 px-3 py-2.5 text-n6 text-sm">
								<input
									type="checkbox"
									required
									className="mt-0.5 size-4 shrink-0 accent-(--color-n7)"
								/>
								<span>
									I have checked both values. Opening is irreversible — the
									market cannot return to Draft.
								</span>
							</label>
							<div>
								<Button type="submit" size="lg" className="px-4">
									Seed &amp; open
								</Button>
							</div>
						</form>
					) : (
						<>
							<TerminalActions
								marketId={marketId}
								title={market.title}
								status={market.status}
							/>
							{market.status === "Voided" || market.status === "Frozen" ? (
								<Notice tone="info">
									No actions are available for a {market.status} market.
								</Notice>
							) : null}
						</>
					)}
				</div>
			</div>
		</AdminShell>
	);
}
