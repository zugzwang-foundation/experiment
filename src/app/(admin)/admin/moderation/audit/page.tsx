import Link from "next/link";
import {
	type LoadModerationAuditFeedOptions,
	loadModerationAuditFeed,
} from "@/server/admin/moderation/audit-feed";
import type {
	BlockedReason,
	CategoryScore,
	ModerationAuditRowView,
	ModVerdict,
} from "@/server/admin/moderation/audit-view";
import { requireAdminPage } from "@/server/admin/page-guards";

// UI.6 slice A — F-ADMIN-5 read-only moderation audit viewer (ADR-0021). Server
// Component, ZERO client JS. Layer-2 admin auth is RE-VALIDATED at render entry
// (`requireAdminPage`) co-located with the data read — mirroring the ENGINE.15
// admin pages (an outer `(admin)` layout would loop the in-group login). This
// surface is READ-ONLY: no action/form/handler of any kind. The only
// interactivity is read navigation to a market's admin detail page.
//
// Styling uses the REAL shadcn semantic tokens (background / card / border /
// muted / destructive) — NOT the placeholder brand tokens (`--color-yes/no`),
// which stay frozen until DESIGN.7 (AGENTS.md §8). Blocked rows carry no
// `side`, so side-binding does not apply here.
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

export default async function ModerationAuditPage(): Promise<React.ReactElement> {
	await requireAdminPage();

	const rows = await loadModerationAuditFeed({ limit: ROW_LIMIT });

	return (
		<main className="min-h-dvh bg-background text-foreground">
			<div className="mx-auto max-w-5xl px-6 py-10">
				<nav className="mb-6 text-sm">
					<Link
						href="/admin/markets"
						className="text-muted-foreground underline-offset-2 hover:underline"
					>
						← Admin
					</Link>
				</nav>

				<header className="mb-6">
					<h1 className="text-2xl font-semibold tracking-tight">
						Moderation · Blocked submissions
					</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Read-only audit of gate-blocked submissions (Track A auto-ban, Track
						B block, and the text-only sexual/minors carve-out). Reactive admin
						actions are out of scope here. Per ADR-0021.
					</p>
				</header>

				<div
					role="note"
					className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground"
				>
					<strong className="font-semibold">Admin-only.</strong> This page shows
					rejected content for moderation review. It is never exposed to
					participants, and blocked images are withheld — never rendered.
				</div>

				{rows.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
						<p className="text-sm text-muted-foreground">
							No blocked submissions recorded yet.
						</p>
					</div>
				) : (
					<>
						<p className="mb-4 text-xs text-muted-foreground">
							Showing the {rows.length} most recent blocked submission
							{rows.length === 1 ? "" : "s"}
							{rows.length === ROW_LIMIT ? ` (capped at ${ROW_LIMIT})` : ""}.
						</p>
						<div className="flex flex-col gap-4">
							{rows.map((row) => (
								<AuditRow key={row.id} row={row} />
							))}
						</div>
					</>
				)}
			</div>
		</main>
	);
}
