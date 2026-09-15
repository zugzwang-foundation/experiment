import Link from "next/link";

import { AdminShell } from "@/app/(admin)/admin/_components/AdminShell";
import { PageHeader } from "@/app/(admin)/admin/_components/PageHeader";
import { ModerationSubnav } from "@/app/(admin)/admin/moderation/_components/ModerationSubnav";
import {
	ReviewFeed,
	type ReviewFeedRowView,
} from "@/app/(admin)/admin/moderation/_components/ReviewFeed";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadReviewFeed } from "@/server/admin/moderation/review-feed";
import { requireAdminPage } from "@/server/admin/page-guards";

// UI.6 S3 — the Moderation tab's live review feed (F-ADMIN-4 partial). Server
// Component, fresh-on-view (polled-on-view, no websocket; dynamic by default,
// no `'use cache'`), Layer-2 admin auth re-validated at entry
// (requireAdminPage) BEFORE the reader — mirroring the audit page (an outer
// `(admin)` layout would loop the in-group login). The reader returns every
// LIVE row (Track-C) minus the removed set; the 200-cap truncation surfaces a
// visible indicator + a "load older" cursor link (pagination is not a filter
// — the operator always reaches older rows, D-4).
//
// ADMIN-UI — presentation only. `parseBefore`, the reader call and the explicit
// least-exposure projection are unchanged. Added: a "back to newest" link when
// a cursor is in effect (a plain link to this route, no new read).
//
// S-4 Phase B — `instant = false`: `requireAdminPage` (`cookies()`) plus this
// page's own `searchParams` cursor are read unwrapped; either errors the
// `cacheComponents` prerender build otherwise. Deferred, not restructured —
// admin is outside S-4's scope (CLAUDE.md §1).

// µs-precision UTC cursor: `YYYY-MM-DDTHH:MM:SS.ffffffZ` (6 fractional digits).
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURSOR_UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse the `?before=<µs-timestamp>__<uuid>` keyset cursor; a malformed value is
 * IGNORED (degrade to the first page) so a hand-edited URL cannot 500 the page
 * via a `22007` (syntax) / `22P02` (bad uuid) / `22008` (out-of-range field)
 * cast error at the `::timestamptz`/`::uuid` boundary. The regexes check SHAPE;
 * a calendar round-trip then rejects in-shape-but-impossible instants (month 13,
 * day 32, hour 25 …) that a regex cannot catch. The µs-precision timestamp stays
 * a STRING — never round-tripped through a JS `Date` for the value itself (that
 * would truncate to ms and reopen the completeness hole the reader guards
 * against); the Date round-trip below validates only the second-precision head.
 */
function parseBefore(
	raw: string | undefined,
): { createdAt: string; id: string } | undefined {
	if (!raw) return undefined;
	const sep = raw.lastIndexOf("__");
	if (sep < 0) return undefined;
	const createdAt = raw.slice(0, sep);
	const id = raw.slice(sep + 2);
	if (!CURSOR_TS_RE.test(createdAt) || !CURSOR_UUID_RE.test(id)) {
		return undefined;
	}
	// Shape passed; now reject an impossible calendar instant. An out-of-range
	// field either yields Invalid Date or rolls over (2026-13-01 → 2027-01-01),
	// so the reformatted second-precision head won't match. The µs tail is 6
	// regex-validated digits (every value 000000–999999 is a valid µs).
	const head = createdAt.slice(0, 19);
	const asDate = new Date(`${head}Z`);
	if (
		Number.isNaN(asDate.getTime()) ||
		asDate.toISOString().slice(0, 19) !== head
	) {
		return undefined;
	}
	return { createdAt, id };
}

export const instant = false;

export default async function ModerationPage(props: {
	searchParams: Promise<{ before?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const before = parseBefore((await props.searchParams).before);
	const feed = await loadReviewFeed(before ? { before } : {});

	// Explicit projection (NOT a spread) — the server DTO's authorUserId /
	// marketId / marketTitle stay server-side; only rendered fields cross to the
	// client (least-exposure).
	const rows: ReviewFeedRowView[] = feed.rows.map((r) => ({
		id: r.id,
		kind: r.kind,
		parent: r.parent,
		marketSlug: r.marketSlug,
		marketStatus: r.marketStatus,
		side: r.side,
		body: r.body,
		imageUrl: r.imageUrl,
		hasImage: r.hasImage,
		authorPseudonym: r.authorPseudonym,
		authorDharma: r.authorDharma,
		authorBanned: r.authorBanned,
		priorFlagCount: r.priorFlagCount,
		createdAt: r.createdAt.toISOString(),
		categoryScores: r.categoryScores,
	}));

	const olderHref = feed.nextCursor
		? `/admin/moderation?before=${encodeURIComponent(
				`${feed.nextCursor.createdAt}__${feed.nextCursor.id}`,
			)}`
		: null;

	return (
		<AdminShell active="moderation">
			<PageHeader
				title="Moderation"
				description="Every live post and reply, newest first — no filter, no ranking (ADR-0021). Remove hides content; Ban removes the author's voice (their prior content stays). Reactive actions only; neither touches a position or a balance."
			/>

			<ModerationSubnav active="feed" />

			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<p className="text-n5 text-xs">
					Showing {rows.length} row{rows.length === 1 ? "" : "s"}
					{feed.truncated
						? ` (capped at ${feed.cap} newest — older rows exist below)`
						: ""}
					.
				</p>
				{before ? (
					<Link
						href="/admin/moderation"
						className="rounded-(--r-chip) text-n5 text-xs underline underline-offset-2 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
					>
						Back to newest
					</Link>
				) : null}
			</div>

			<ReviewFeed rows={rows} />

			{olderHref ? (
				<div className="mt-6 text-center">
					<Link
						href={olderHref}
						className={cn(buttonVariants({ size: "lg" }), "px-4")}
					>
						Load older →
					</Link>
				</div>
			) : null}
		</AdminShell>
	);
}
