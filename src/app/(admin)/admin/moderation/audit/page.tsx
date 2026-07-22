import Link from "next/link";

import { AdminTabs } from "@/app/(admin)/admin/_components/AdminTabs";
import {
	type LoadModerationAuditFeedOptions,
	loadModerationAuditFeed,
	searchAuditLog,
} from "@/server/admin/moderation/audit-feed";
import type {
	AuditLogRowView,
	AuditSearchFilters,
	BlockedReason,
	CategoryScore,
	ModerationAuditRowView,
	ModVerdict,
} from "@/server/admin/moderation/audit-view";
import { requireAdminPage } from "@/server/admin/page-guards";

// UI.6 slice A + S4 — F-ADMIN-5 read-only moderation audit viewer (ADR-0021),
// now nested under the Moderation tab with a searchParams-driven search form
// over BOTH `admin_events` and `mod_actions` (A3). Server Component, ZERO client
// JS, Layer-2 admin auth RE-VALIDATED at render entry (`requireAdminPage`)
// before ANY data read (an outer `(admin)` layout would loop the in-group
// login). READ-ONLY: no action/handler; the search form is a GET form. Blocked
// images are withheld (hasBlockedImage boolean) — never rendered, no r2 key.
export const dynamic = "force-dynamic";

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

function ReasonBadge({
	reason,
}: {
	reason: BlockedReason;
}): React.ReactElement {
	const meta = REASON_META[reason];
	const tone =
		meta.tone === "severe"
			? "border-destructive/40 bg-destructive/10 text-destructive"
			: "border-border bg-muted text-foreground";
	return (
		<span
			className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone}`}
		>
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
			<span className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-white">
				<span aria-hidden>●</span>
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
		<span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
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
		return <span className="text-xs text-muted-foreground">no scores</span>;
	}
	return (
		<div className="flex flex-wrap gap-1.5">
			{scores.map((c) => (
				<span
					key={c.name}
					className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
				>
					<span className="text-foreground">{c.name}</span>
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
			className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
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
		<div className="flex flex-col gap-1">
			<dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
				{label}
			</dt>
			<dd className="text-sm">{children}</dd>
		</div>
	);
}

function AuditRow({
	row,
}: {
	row: ModerationAuditRowView;
}): React.ReactElement {
	return (
		<article className="rounded-lg border border-border bg-card p-5 shadow-sm">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
				<div className="flex flex-wrap items-center gap-2">
					<ReasonBadge reason={row.reason} />
					{row.verdict ? (
						<span className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
							verdict: {VERDICT_LABEL[row.verdict]}
						</span>
					) : null}
				</div>
				<time
					dateTime={row.createdAt.toISOString()}
					className="font-mono text-xs text-muted-foreground"
				>
					{row.createdAt.toISOString().replace("T", " ").replace(".000Z", "Z")}
				</time>
			</header>

			<dl className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
				<Field label="Market">
					{row.marketId ? (
						<Link
							href={`/admin/markets/${row.marketId}`}
							className="text-foreground underline underline-offset-2 hover:no-underline"
						>
							{row.marketSlug ?? row.marketId}
						</Link>
					) : (
						<span className="text-muted-foreground">—</span>
					)}
					{row.marketTitle ? (
						<span className="mt-0.5 block text-xs text-muted-foreground">
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

			<div className="flex flex-col gap-4">
				<Field label="OpenAI categories">
					<CategoryChips scores={row.categoryScores} />
				</Field>

				{row.hasBlockedImage ? <ImageWithheld /> : null}

				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Rejected content · admin-only
					</span>
					{row.blockedText ? (
						<p className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-sm">
							{row.blockedText}
						</p>
					) : (
						<span className="text-sm text-muted-foreground">
							(no text — image-only submission)
						</span>
					)}
				</div>
			</div>
		</article>
	);
}

// ── S4 search surface ────────────────────────────────────────────────────────

interface SearchParams {
	from?: string;
	to?: string;
	actionType?: string;
	marketId?: string;
	userId?: string;
	pseudonym?: string;
}

/** Build the AuditSearchFilters from raw search params (invalid dates dropped). */
function parseFilters(sp: SearchParams): AuditSearchFilters {
	const filters: AuditSearchFilters = {};
	const from = sp.from ? new Date(`${sp.from}T00:00:00.000Z`) : null;
	const to = sp.to ? new Date(`${sp.to}T23:59:59.999Z`) : null;
	if (from && !Number.isNaN(from.getTime())) filters.from = from;
	if (to && !Number.isNaN(to.getTime())) filters.to = to;
	const trim = (v: string | undefined) => {
		const t = v?.trim();
		return t && t.length > 0 ? t : undefined;
	};
	const actionType = trim(sp.actionType);
	const marketId = trim(sp.marketId);
	const userId = trim(sp.userId);
	const pseudonym = trim(sp.pseudonym);
	if (actionType) filters.actionType = actionType;
	if (marketId) filters.marketId = marketId;
	if (userId) filters.userId = userId;
	if (pseudonym) filters.pseudonym = pseudonym;
	return filters;
}

const SOURCE_LABEL: Record<AuditLogRowView["source"], string> = {
	mod_action: "moderation",
	admin_event: "admin event",
};

function SearchForm({ sp }: { sp: SearchParams }): React.ReactElement {
	const input =
		"rounded-md border border-border bg-background px-2 py-1 text-sm";
	return (
		<form
			method="get"
			className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-3"
		>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				From
				<input
					type="date"
					name="from"
					defaultValue={sp.from ?? ""}
					className={input}
				/>
			</label>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				To
				<input
					type="date"
					name="to"
					defaultValue={sp.to ?? ""}
					className={input}
				/>
			</label>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				Action type
				<input
					type="text"
					name="actionType"
					placeholder="content_removed · market.resolved …"
					defaultValue={sp.actionType ?? ""}
					className={input}
				/>
			</label>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				Market id
				<input
					type="text"
					name="marketId"
					defaultValue={sp.marketId ?? ""}
					className={input}
				/>
			</label>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				User id
				<input
					type="text"
					name="userId"
					defaultValue={sp.userId ?? ""}
					className={input}
				/>
			</label>
			<label className="flex flex-col gap-1 text-xs text-muted-foreground">
				Pseudonym
				<input
					type="text"
					name="pseudonym"
					defaultValue={sp.pseudonym ?? ""}
					className={input}
				/>
			</label>
			<div className="flex items-end gap-2 sm:col-span-3">
				<button
					type="submit"
					className="rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
				>
					Search
				</button>
				<Link
					href="/admin/moderation/audit"
					className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
				>
					Clear
				</Link>
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
		<article className="rounded-lg border border-border bg-card p-4">
			<header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium uppercase tracking-wide text-muted-foreground">
						{SOURCE_LABEL[row.source]}
					</span>
					<span className="font-mono text-foreground">{row.actionType}</span>
				</div>
				<time
					dateTime={row.createdAt.toISOString()}
					className="font-mono text-xs text-muted-foreground"
				>
					{row.createdAt.toISOString().replace("T", " ").replace(".000Z", "Z")}
				</time>
			</header>
			<dl className="grid grid-cols-1 gap-3 py-3 text-sm sm:grid-cols-3">
				<Field label="Market">
					{row.marketId ? (
						<Link
							href={`/admin/markets/${row.marketId}`}
							className="text-foreground underline underline-offset-2 hover:no-underline"
						>
							{row.marketSlug ?? row.marketId}
						</Link>
					) : (
						<span className="text-muted-foreground">—</span>
					)}
				</Field>
				<Field label="Author">
					{row.authorPseudonym ? (
						<span>
							{row.authorPseudonym}
							{row.authorBanned ? (
								<span className="ml-1 text-destructive">· banned</span>
							) : null}
						</span>
					) : (
						<span className="text-muted-foreground">—</span>
					)}
				</Field>
				<Field label="Actor">
					<span className="font-mono text-xs">{row.actorId}</span>
				</Field>
			</dl>
			{row.categoryScores.length > 0 ? (
				<CategoryChips scores={row.categoryScores} />
			) : null}
			{row.hasBlockedImage ? (
				<div className="mt-2">
					<ImageWithheld />
				</div>
			) : null}
			{row.blockedText ? (
				<p className="mt-2 whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 text-sm">
					{row.blockedText}
				</p>
			) : null}
		</article>
	);
}

export default async function ModerationAuditPage(props: {
	searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const sp = await props.searchParams;
	const filters = parseFilters(sp);
	const searching = Object.keys(filters).length > 0;

	// Search mode → the two-source union; default (no filters) → the unchanged
	// blocked-submissions feed (loadModerationAuditFeed).
	const searchRows = searching
		? await searchAuditLog({ limit: ROW_LIMIT, filters })
		: [];
	const blockedRows = searching
		? []
		: await loadModerationAuditFeed({ limit: ROW_LIMIT });

	return (
		<main className="min-h-dvh bg-background text-foreground">
			<div className="mx-auto max-w-5xl px-6 py-10">
				<AdminTabs active="moderation" />

				<header className="mb-6">
					<h1 className="text-2xl font-semibold tracking-tight">
						Moderation · Audit log
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Search across admin events and moderation actions (F-ADMIN-5). With
						no filters, the gate-blocked submissions feed is shown. Per
						ADR-0021.
					</p>
					<p className="mt-2 text-xs text-muted-foreground">
						<Link
							href="/admin/moderation"
							className="underline underline-offset-2 hover:no-underline"
						>
							← Live review feed
						</Link>
					</p>
				</header>

				<div
					role="note"
					className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground"
				>
					<strong className="font-semibold">Admin-only.</strong> Rejected
					content is shown for review; it is never exposed to participants, and
					blocked images are withheld — never rendered.
				</div>

				<SearchForm sp={sp} />

				{/* admin_events has no writer yet — make its emptiness legible so an
				    absent admin-event row reads as "not emitted", never "no match". */}
				<p
					role="note"
					className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
				>
					Admin-event rows are{" "}
					<strong className="font-semibold">not yet emitted</strong> (no{" "}
					<span className="font-mono">admin_events</span> writer exists), so
					results currently cover moderation actions only — an absent
					admin-event row means "not emitted here yet", not "no such admin
					action occurred".
				</p>

				{searching ? (
					searchRows.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
							<p className="text-sm text-muted-foreground">
								No audit rows match those filters.
							</p>
						</div>
					) : (
						<>
							<p className="mb-4 text-xs text-muted-foreground">
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
					<div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
						<p className="text-sm text-muted-foreground">
							No blocked submissions recorded yet.
						</p>
					</div>
				) : (
					<>
						<p className="mb-4 text-xs text-muted-foreground">
							Showing the {blockedRows.length} most recent blocked submission
							{blockedRows.length === 1 ? "" : "s"}
							{blockedRows.length === ROW_LIMIT
								? ` (capped at ${ROW_LIMIT})`
								: ""}
							.
						</p>
						<div className="flex flex-col gap-4">
							{blockedRows.map((row) => (
								<AuditRow key={row.id} row={row} />
							))}
						</div>
					</>
				)}
			</div>
		</main>
	);
}
