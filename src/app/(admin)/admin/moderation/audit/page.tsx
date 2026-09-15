import { Search, ShieldAlert, UserX } from "lucide-react";
import Link from "next/link";

import { AdminShell } from "@/app/(admin)/admin/_components/AdminShell";
import { PageHeader } from "@/app/(admin)/admin/_components/PageHeader";
import { ModerationSubnav } from "@/app/(admin)/admin/moderation/_components/ModerationSubnav";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
	type LoadModerationAuditFeedOptions,
	loadModerationAuditFeed,
	searchAuditLog,
} from "@/server/admin/moderation/audit-feed";
import type {
	AuditLogRowView,
	BlockedReason,
	CategoryScore,
	ModerationAuditRowView,
	ModVerdict,
} from "@/server/admin/moderation/audit-view";
import { requireAdminPage } from "@/server/admin/page-guards";

import {
	ACTION_TYPE_PLACEHOLDER,
	InvalidDateNote,
	invalidDateFields,
	parseFilters,
	type SearchParams,
	searchRan,
} from "./search-surface";

// UI.6 slice A + S4 — F-ADMIN-5 read-only moderation audit viewer (ADR-0021),
// now nested under the Moderation tab with a searchParams-driven search form
// over BOTH `admin_events` and `mod_actions` (A3). Server Component, ZERO client
// JS, Layer-2 admin auth RE-VALIDATED at render entry (`requireAdminPage`)
// before ANY data read (an outer `(admin)` layout would loop the in-group
// login). READ-ONLY: no action/handler; the search form is a GET form. Blocked
// images are withheld (hasBlockedImage boolean) — never rendered, no r2 key.
//
// ADMIN-UI — presentation only. The gate, both reads, the `searchRan` branch,
// the six GET field names and every row field rendered are unchanged; the
// search form now reports which filters are active. No image element exists
// anywhere under this directory (the audit leak guard scans all of it).
//
// S-4 Phase B — `instant = false` (below): `requireAdminPage` (`cookies()`)
// plus this page's own `searchParams` search form are read unwrapped; either
// errors the `cacheComponents` prerender build otherwise. Deferred, not
// restructured — admin is outside S-4's scope (CLAUDE.md §1).

const ROW_LIMIT: NonNullable<LoadModerationAuditFeedOptions["limit"]> = 200;

const REASON_META: Record<
	BlockedReason,
	{ label: string; tone: "severe" | "blocked" }
> = {
	track_a_autoban: { label: "Track A · auto-ban", tone: "severe" },
	track_b_blocked: { label: "Track B · blocked", tone: "blocked" },
	sexual_minors_text_blocked: {
		label: "Sexual/minors (text) · blocked → ban-review",
		tone: "severe",
	},
};

const VERDICT_LABEL: Record<ModVerdict, string> = {
	track_a: "track_a",
	track_b: "track_b",
};

function utcStamp(date: Date): string {
	return date.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function ReasonBadge({
	reason,
}: {
	reason: BlockedReason;
}): React.ReactElement {
	const meta = REASON_META[reason];
	const tone =
		meta.tone === "severe"
			? "border-n6 bg-n1 font-semibold text-ink"
			: "border-n3 text-n6";
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-(--r-chip) border px-2 py-0.5 text-xs ${tone}`}
		>
			{meta.tone === "severe" ? (
				<ShieldAlert aria-hidden className="size-3.5" />
			) : null}
			{meta.label}
		</span>
	);
}

function BanIndicator({
	banned,
	bannedAt,
}: {
	banned: boolean;
	bannedAt: Date | null;
}): React.ReactElement {
	if (banned) {
		return (
			<span className="inline-flex items-center gap-1.5 rounded-(--r-chip) bg-n6 px-2 py-0.5 font-semibold text-ground text-xs">
				<UserX aria-hidden className="size-3" />
				BANNED
				{bannedAt ? (
					<span className="font-normal opacity-80">
						{bannedAt.toISOString().slice(0, 10)}
					</span>
				) : null}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 rounded-(--r-chip) border border-n2 px-2 py-0.5 font-medium text-n5 text-xs">
			<span aria-hidden>○</span>
			active
		</span>
	);
}

function CategoryChips({
	scores,
}: {
	scores: CategoryScore[];
}): React.ReactElement {
	if (scores.length === 0) {
		return <span className="text-n5 text-xs">no scores</span>;
	}
	return (
		<div className="flex flex-wrap gap-1.5">
			{scores.map((c) => (
				<span
					key={c.name}
					className="inline-flex items-center gap-1 rounded-(--r-chip) border border-n2 bg-n1 px-2 py-0.5 font-mono text-n5 text-xs"
				>
					<span className="text-ink">{c.name}</span>
					{c.score.toFixed(3)}
				</span>
			))}
		</div>
	);
}

function ImageWithheld(): React.ReactElement {
	return (
		<div
			role="img"
			aria-label="Blocked image withheld — never rendered"
			className="flex items-center gap-2 rounded-(--r) border border-n3 border-dashed bg-n1 px-3 py-2 text-n5 text-sm"
		>
			<span aria-hidden className="font-mono">
				[×]
			</span>
			Image withheld — blocked content is never rendered.
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="flex min-w-0 flex-col gap-1">
			<dt className="font-medium text-n5 text-xs uppercase tracking-wide">
				{label}
			</dt>
			<dd className="min-w-0 break-words text-n6 text-sm">{children}</dd>
		</div>
	);
}

function MarketLink({
	marketId,
	marketSlug,
}: {
	marketId: string | null;
	marketSlug: string | null;
}): React.ReactElement {
	if (!marketId) return <span className="text-n4">—</span>;
	return (
		<Link
			href={`/admin/markets/${marketId}`}
			className="rounded-(--r-chip) font-mono text-ink text-xs underline underline-offset-2 outline-none hover:no-underline focus-visible:shadow-(--state-focus-ring)"
		>
			{marketSlug ?? marketId}
		</Link>
	);
}

function AuditRow({
	row,
}: {
	row: ModerationAuditRowView;
}): React.ReactElement {
	return (
		<article className="rounded-(--r) border border-n2 bg-n0 shadow-(--elev-1)">
			<header className="flex flex-wrap items-center justify-between gap-3 border-n2 border-b px-4 py-2.5">
				<div className="flex flex-wrap items-center gap-2">
					<ReasonBadge reason={row.reason} />
					{row.verdict ? (
						<span className="rounded-(--r-chip) border border-n2 px-2 py-0.5 font-mono text-n5 text-xs">
							verdict: {VERDICT_LABEL[row.verdict]}
						</span>
					) : null}
				</div>
				<time
					dateTime={row.createdAt.toISOString()}
					className="font-mono text-n5 text-xs"
				>
					{utcStamp(row.createdAt)}
				</time>
			</header>

			<div className="flex flex-col gap-4 px-4 py-3">
				<dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<Field label="Market">
						<MarketLink marketId={row.marketId} marketSlug={row.marketSlug} />
						{row.marketTitle ? (
							<span className="mt-0.5 block text-n5 text-xs">
								{row.marketTitle}
							</span>
						) : null}
					</Field>

					<Field label="Author">
						<div className="flex flex-col items-start gap-1.5">
							<span>{row.authorPseudonym ?? "—"}</span>
							<BanIndicator
								banned={row.authorBanned}
								bannedAt={row.authorBannedAt}
							/>
						</div>
					</Field>

					<Field label="Actor">
						<span className="font-mono text-xs">{row.actorId}</span>
					</Field>
				</dl>

				<dl>
					<Field label="OpenAI categories">
						<CategoryChips scores={row.categoryScores} />
					</Field>
				</dl>

				{row.hasBlockedImage ? <ImageWithheld /> : null}

				<div className="flex flex-col gap-1.5">
					<span className="font-medium text-n5 text-xs uppercase tracking-wide">
						Rejected content · admin-only
					</span>
					{row.blockedText ? (
						<p className="whitespace-pre-wrap break-words rounded-(--r) border border-n2 bg-ground p-3 text-ink text-sm">
							{row.blockedText}
						</p>
					) : (
						<span className="text-n5 text-sm">
							(no text — image-only submission)
						</span>
					)}
				</div>
			</div>
		</article>
	);
}

const SOURCE_LABEL: Record<AuditLogRowView["source"], string> = {
	mod_action: "moderation",
	admin_event: "admin event",
};

const FILTER_LABEL: Record<keyof SearchParams, string> = {
	from: "From",
	to: "To",
	actionType: "Action type",
	marketId: "Market id",
	userId: "User id",
	pseudonym: "Pseudonym",
};

function SearchForm({
	sp,
	activeFilters,
}: {
	sp: SearchParams;
	activeFilters: string[];
}): React.ReactElement {
	const field = "flex flex-col gap-1.5 text-n5 text-xs";
	return (
		<form
			method="get"
			aria-label="Search the audit log"
			className="mb-4 rounded-(--r) border border-n2 bg-n0 p-4 shadow-(--elev-1)"
		>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<label htmlFor="audit-from" className={field}>
					From (UTC day)
					<Input
						id="audit-from"
						type="date"
						name="from"
						defaultValue={sp.from ?? ""}
						className="[color-scheme:dark]"
					/>
				</label>
				<label htmlFor="audit-to" className={field}>
					To (UTC day)
					<Input
						id="audit-to"
						type="date"
						name="to"
						defaultValue={sp.to ?? ""}
						className="[color-scheme:dark]"
					/>
				</label>
				<label htmlFor="audit-action-type" className={field}>
					Action type
					<Input
						id="audit-action-type"
						type="text"
						name="actionType"
						placeholder={`${ACTION_TYPE_PLACEHOLDER} …`}
						defaultValue={sp.actionType ?? ""}
						className="font-mono"
					/>
				</label>
				<label htmlFor="audit-market-id" className={field}>
					Market id
					<Input
						id="audit-market-id"
						type="text"
						name="marketId"
						defaultValue={sp.marketId ?? ""}
						className="font-mono"
					/>
				</label>
				<label htmlFor="audit-user-id" className={field}>
					User id
					<Input
						id="audit-user-id"
						type="text"
						name="userId"
						defaultValue={sp.userId ?? ""}
						className="font-mono"
					/>
				</label>
				<label htmlFor="audit-pseudonym" className={field}>
					Pseudonym
					<Input
						id="audit-pseudonym"
						type="text"
						name="pseudonym"
						defaultValue={sp.pseudonym ?? ""}
					/>
				</label>
			</div>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<button
					type="submit"
					className="inline-flex h-9 items-center gap-2 rounded-(--r) bg-ink px-4 font-medium text-ground text-sm outline-none hover:bg-n7 focus-visible:shadow-(--state-focus-ring)"
				>
					<Search aria-hidden className="size-4" />
					Search
				</button>
				<Link
					href="/admin/moderation/audit"
					className={cn(buttonVariants({ size: "lg" }), "px-4")}
				>
					Clear
				</Link>
				<span className="text-n5 text-xs">
					{activeFilters.length > 0
						? `Active: ${activeFilters.join(" · ")}`
						: "No filters — showing the blocked-submissions feed."}
				</span>
			</div>
		</form>
	);
}

function SearchResultRow({
	row,
}: {
	row: AuditLogRowView;
}): React.ReactElement {
	return (
		<article className="rounded-(--r) border border-n2 bg-n0 shadow-(--elev-1)">
			<header className="flex flex-wrap items-center justify-between gap-2 border-n2 border-b px-4 py-2.5">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded-(--r-chip) border border-n2 bg-n1 px-1.5 py-0.5 font-medium text-[11px] text-n5 uppercase leading-4 tracking-wide">
						{SOURCE_LABEL[row.source]}
					</span>
					<span className="font-mono text-ink">{row.actionType}</span>
				</div>
				<time
					dateTime={row.createdAt.toISOString()}
					className="font-mono text-n5 text-xs"
				>
					{utcStamp(row.createdAt)}
				</time>
			</header>
			<div className="flex flex-col gap-3 px-4 py-3">
				<dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<Field label="Market">
						<MarketLink marketId={row.marketId} marketSlug={row.marketSlug} />
					</Field>
					<Field label="Author">
						{row.authorPseudonym ? (
							<span>
								{row.authorPseudonym}
								{row.authorBanned ? (
									<span className="ml-1 font-semibold text-ink">· banned</span>
								) : null}
							</span>
						) : (
							<span className="text-n4">—</span>
						)}
					</Field>
					<Field label="Actor">
						<span className="font-mono text-xs">{row.actorId}</span>
					</Field>
				</dl>
				{row.categoryScores.length > 0 ? (
					<CategoryChips scores={row.categoryScores} />
				) : null}
				{row.hasBlockedImage ? <ImageWithheld /> : null}
				{row.blockedText ? (
					<p className="whitespace-pre-wrap break-words rounded-(--r) border border-n2 bg-ground p-3 text-ink text-sm">
						{row.blockedText}
					</p>
				) : null}
			</div>
		</article>
	);
}

function EmptyResult({ message }: { message: string }): React.ReactElement {
	return (
		<div className="rounded-(--r) border border-n2 border-dashed bg-n0 px-6 py-16 text-center">
			<p className="text-n5 text-sm">{message}</p>
		</div>
	);
}

export const instant = false;

export default async function ModerationAuditPage(props: {
	searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const sp = await props.searchParams;
	const filters = parseFilters(sp);
	const searching = searchRan(sp);

	// Search mode → the two-source union; default (no filters) → the unchanged
	// blocked-submissions feed (loadModerationAuditFeed).
	const searchRows = searching
		? await searchAuditLog({ limit: ROW_LIMIT, filters })
		: [];
	const blockedRows = searching
		? []
		: await loadModerationAuditFeed({ limit: ROW_LIMIT });

	// Labels of the predicates that SURVIVED parsing — read off `filters`, the
	// same object the query receives, so this line cannot claim a filter the
	// query dropped (a dropped date is named by InvalidDateNote instead).
	const activeFilters = Object.entries(FILTER_LABEL)
		.filter(([key]) => key in filters)
		.map(([, label]) => label);

	return (
		<AdminShell active="moderation">
			<PageHeader
				title="Moderation"
				description="Search across admin events and moderation actions (F-ADMIN-5). With no filters, the gate-blocked submissions feed is shown. Read-only. Per ADR-0021."
			/>

			<ModerationSubnav active="audit" />

			<div
				role="note"
				className="mb-4 flex items-start gap-2 rounded-(--r) border border-n4 bg-n1 px-4 py-3 text-ink text-sm"
			>
				<ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
				<p>
					<strong className="font-semibold">Admin-only.</strong> Rejected
					content is shown for review; it is never exposed to participants, and
					blocked images are withheld — never rendered.
				</p>
			</div>

			<SearchForm sp={sp} activeFilters={activeFilters} />

			<InvalidDateNote fields={invalidDateFields(sp)} searchRan={searching} />

			{/* admin_events has no writer yet — make its emptiness legible so an
			    absent admin-event row reads as "not emitted", never "no match". */}
			<p
				role="note"
				className="mb-4 rounded-(--r) border border-n2 bg-n0 px-3 py-2 text-n5 text-xs"
			>
				Admin-event rows are{" "}
				<strong className="font-semibold text-n6">not yet emitted</strong> (no{" "}
				<span className="font-mono">admin_events</span> writer exists), so
				results currently cover moderation actions only — an absent admin-event
				row means "not emitted here yet", not "no such admin action occurred".
			</p>

			{searching ? (
				searchRows.length === 0 ? (
					<EmptyResult message="No audit rows match those filters." />
				) : (
					<>
						<p className="mb-3 text-n5 text-xs">
							{searchRows.length} matching row
							{searchRows.length === 1 ? "" : "s"}
							{searchRows.length === ROW_LIMIT
								? ` (capped at ${ROW_LIMIT})`
								: ""}
							.
						</p>
						<div className="flex flex-col gap-3">
							{searchRows.map((row) => (
								<SearchResultRow key={`${row.source}:${row.id}`} row={row} />
							))}
						</div>
					</>
				)
			) : blockedRows.length === 0 ? (
				<EmptyResult message="No blocked submissions recorded yet." />
			) : (
				<>
					<p className="mb-3 text-n5 text-xs">
						Showing the {blockedRows.length} most recent blocked submission
						{blockedRows.length === 1 ? "" : "s"}
						{blockedRows.length === ROW_LIMIT
							? ` (capped at ${ROW_LIMIT})`
							: ""}
						.
					</p>
					<div className="flex flex-col gap-3">
						{blockedRows.map((row) => (
							<AuditRow key={row.id} row={row} />
						))}
					</div>
				</>
			)}
		</AdminShell>
	);
}
