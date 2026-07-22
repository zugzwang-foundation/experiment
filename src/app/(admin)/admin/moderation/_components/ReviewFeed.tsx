"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { moderateComment } from "@/server/admin/moderation/act";

// UI.6 S3(c) — the reactive review-feed affordances (client). Renders each live
// row and its per-comment Remove / Ban controls (single, explicit, per-comment —
// NO bulk / multi-select, plan §10). Each control posts ONE decision to
// `moderateComment` (Remove and Ban are independent axes — ADR-0020). Images are
// the short-TTL admin-gated signed URLs minted server-side by the reader; this
// component never sees a raw R2 key. Category scores render only where present
// (v1: none — D-3). The feed is polled-on-view (no websocket): the parent page
// is `force-dynamic`, and each action calls `router.refresh()` to re-read.

// The CLIENT view carries only the fields the affordances render — the author's
// internal user UUID + marketId/marketTitle are resolved server-side and are
// deliberately NOT shipped to the browser (least-exposure; the ban target is
// derived from `commentId` in the server action).
export interface ReviewFeedRowView {
	id: string;
	kind: "post" | "reply";
	parentSnippet: string | null;
	marketSlug: string;
	marketStatus: string;
	side: "YES" | "NO";
	body: string;
	imageUrl: string | null;
	/** Comment carries an image; true even when the short-TTL mint failed. */
	hasImage: boolean;
	authorPseudonym: string;
	authorDharma: string;
	authorBanned: boolean;
	priorFlagCount: number;
	createdAt: string;
	categoryScores: { name: string; score: number }[];
}

const ERROR_COPY: Record<string, string> = {
	admin_session_required:
		"Your admin session has expired — sign in again to continue.",
	comment_not_found: "That comment no longer exists.",
	validation_error: "That request was invalid.",
};
const FALLBACK_COPY = "Could not complete that action — please try again.";

function Row({ row }: { row: ReviewFeedRowView }): React.ReactElement {
	const router = useRouter();
	const [pending, setPending] = useState<null | "remove" | "ban">(null);
	const [note, setNote] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [removed, setRemoved] = useState(false);
	const [banned, setBanned] = useState(row.authorBanned);

	async function run(action: "remove" | "ban"): Promise<void> {
		const label =
			action === "remove" ? "Remove this comment?" : "Ban this author?";
		if (!window.confirm(label)) return;
		setPending(action);
		setError(null);
		setNote(null);
		try {
			const result = await moderateComment({ commentId: row.id, action });
			if (result.ok) {
				if (action === "remove") {
					setRemoved(true);
					setNote("Removed.");
				} else {
					setBanned(true);
					setNote("Author banned.");
				}
				router.refresh();
			} else {
				setError(ERROR_COPY[result.error.code] ?? FALLBACK_COPY);
			}
		} finally {
			setPending(null);
		}
	}

	return (
		<article className="rounded-lg border border-border bg-card p-5">
			<header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded-full border border-border bg-muted px-2 py-0.5 font-medium uppercase tracking-wide text-muted-foreground">
						{row.kind}
					</span>
					<span
						className={
							row.side === "YES"
								? "rounded-full border border-border bg-yes px-2 py-0.5 font-semibold text-no"
								: "rounded-full border border-border bg-no px-2 py-0.5 font-semibold text-yes"
						}
					>
						{row.side}
					</span>
					<span className="text-muted-foreground">
						{row.marketSlug} · {row.marketStatus}
					</span>
				</div>
				<time
					dateTime={row.createdAt}
					className="font-mono text-xs text-muted-foreground"
				>
					{row.createdAt.replace("T", " ").replace(".000Z", "Z")}
				</time>
			</header>

			{row.kind === "reply" && row.parentSnippet ? (
				<p className="mb-2 border-l-2 border-border pl-3 text-xs italic text-muted-foreground">
					↳ {row.parentSnippet}
				</p>
			) : null}

			<p className="whitespace-pre-wrap break-words text-sm">{row.body}</p>

			{row.imageUrl ? (
				// biome-ignore lint/performance/noImgElement: admin-only moderation review of a short-TTL signed URL; next/image would proxy/cache the moderated object.
				<img
					src={row.imageUrl}
					alt="Attached comment media (moderation review)"
					className="mt-3 max-h-80 rounded-md border border-border"
				/>
			) : row.hasImage ? (
				// Image present but its short-TTL URL failed to mint — surface it as
				// unavailable (never let image content read as text-only).
				<div className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
					<span aria-hidden className="font-mono">
						[!]
					</span>
					Image present but unavailable — refresh to retry.
				</div>
			) : null}

			{row.categoryScores.length > 0 ? (
				<div className="mt-3 flex flex-wrap gap-1.5">
					{row.categoryScores.map((c) => (
						<span
							key={c.name}
							className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground"
						>
							{c.name} {c.score.toFixed(3)}
						</span>
					))}
				</div>
			) : null}

			<footer className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
				<span className="text-muted-foreground">
					{row.authorPseudonym} · Đ{row.authorDharma} · {row.priorFlagCount}{" "}
					prior flag{row.priorFlagCount === 1 ? "" : "s"}
				</span>
				{banned ? (
					<span className="rounded-full bg-destructive px-2 py-0.5 font-semibold text-background">
						BANNED
					</span>
				) : null}
				<div className="ml-auto flex items-center gap-2">
					<button
						type="button"
						disabled={pending !== null || removed}
						onClick={() => run("remove")}
						className="rounded-md border border-border px-3 py-1.5 font-medium hover:bg-muted disabled:opacity-40"
					>
						{pending === "remove" ? "Removing…" : "Remove"}
					</button>
					<button
						type="button"
						disabled={pending !== null || banned}
						onClick={() => run("ban")}
						className="rounded-md border border-destructive/40 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
					>
						{pending === "ban" ? "Banning…" : "Ban author"}
					</button>
				</div>
				{note ? <span className="text-muted-foreground">{note}</span> : null}
				{error ? <span className="text-destructive">{error}</span> : null}
			</footer>
		</article>
	);
}

export function ReviewFeed({
	rows,
}: {
	rows: ReviewFeedRowView[];
}): React.ReactElement {
	if (rows.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
				No live content to review.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-4">
			{rows.map((row) => (
				<Row key={row.id} row={row} />
			))}
		</div>
	);
}
