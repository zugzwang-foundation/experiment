"use client";

import { Flag, ImageOff, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { formatDharma } from "@/components/debate/format";
import { cn } from "@/lib/utils";
import { moderateComment } from "@/server/admin/moderation/act";

// UI.6 S3(c) — the reactive review-feed affordances (client). Renders each live
// row and its per-comment Remove / Ban controls (single, explicit, per-comment —
// NO bulk / multi-select, plan §10). Each control posts ONE decision to
// `moderateComment` (Remove and Ban are independent axes — ADR-0020). Images are
// the short-TTL admin-gated signed URLs minted server-side by the reader; this
// component never sees a raw R2 key. Category scores render only where present
// (v1: none — D-3). The feed is polled-on-view (no websocket): the parent page
// is `force-dynamic`, and each action calls `router.refresh()` to re-read.
//
// ADMIN-UI — the `window.confirm` step is replaced by an INLINE two-step
// confirm (arm → Confirm / Cancel; Escape cancels; focus lands on Cancel, the
// safe default). The call is unchanged: one `moderateComment({ commentId,
// action })` per confirmed decision. Presentation otherwise.
// ⚠ THE SIDE CHIP IS PINNED, NOT RESTYLED (review-feed-side-chip.component.test
// — founder ruling D28/CC-9 keeps it hand-rolled). Its two class strings are
// carried byte-for-byte; nothing else in this file may use a pole class.
// ⚠ The parent arrow and the removed-parent placeholder appear ONLY in the
// parent block — a post must render neither (review-feed.component.test).

// The CLIENT view carries only the fields the affordances render — the author's
// internal user UUID + marketId/marketTitle are resolved server-side and are
// deliberately NOT shipped to the browser (least-exposure; the ban target is
// derived from `commentId` in the server action).
// Admin-owned duplicate of the participant "Removed by moderator" copy — the
// admin surface shares ZERO product components with the participant tree (that
// fence is why this lane runs unattended), so the string is duplicated here, NOT
// imported from src/components/debate/placeholders.tsx.
const REMOVED_PARENT_PLACEHOLDER = "Removed by moderator";

export interface ReviewFeedRowView {
	id: string;
	kind: "post" | "reply";
	/**
	 * The reply's parent: `null` for a post, `{ removed: true }` for a
	 * content_removed parent (placeholder — no body), or the parent's snippet.
	 */
	parent: null | { removed: true } | { removed: false; snippet: string };
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

const CONFIRM_COPY: Record<"remove" | "ban", { prompt: string; cta: string }> =
	{
		remove: {
			prompt:
				"Remove this comment? It is hidden from participants. The author's bet and position are untouched.",
			cta: "Confirm remove",
		},
		ban: {
			prompt:
				"Ban this author? Their voice is removed from now on. Prior content stays visible; balances and positions are untouched.",
			cta: "Confirm ban",
		},
	};

const actionButton =
	"inline-flex h-8 items-center justify-center gap-1.5 rounded-(--r) px-3 font-medium text-xs outline-none transition-colors focus-visible:shadow-(--state-focus-ring) disabled:cursor-not-allowed disabled:opacity-40";

function Row({ row }: { row: ReviewFeedRowView }): React.ReactElement {
	const router = useRouter();
	const [pending, setPending] = useState<null | "remove" | "ban">(null);
	const [confirming, setConfirming] = useState<null | "remove" | "ban">(null);
	const [note, setNote] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [removed, setRemoved] = useState(false);
	const [banned, setBanned] = useState(row.authorBanned);
	const cancelRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (confirming) cancelRef.current?.focus();
	}, [confirming]);

	async function run(action: "remove" | "ban"): Promise<void> {
		setConfirming(null);
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
		<article
			aria-busy={pending !== null}
			className={cn(
				"rounded-(--r) border bg-n0 shadow-(--elev-1)",
				removed ? "border-n2 border-dashed" : "border-n2",
			)}
		>
			<header className="flex flex-wrap items-center justify-between gap-2 border-n2 border-b px-4 py-2.5">
				<div className="flex flex-wrap items-center gap-2 text-xs">
					<span className="rounded-(--r-chip) border border-n2 bg-n1 px-1.5 py-0.5 font-medium text-[11px] text-n5 uppercase leading-4 tracking-wide">
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
					<span className="font-mono text-n6">{row.marketSlug}</span>
					<span className="text-n4">·</span>
					<span className="text-n5">{row.marketStatus}</span>
				</div>
				<time dateTime={row.createdAt} className="font-mono text-n5 text-xs">
					{row.createdAt.replace("T", " ").replace(".000Z", "Z")}
				</time>
			</header>

			<div className="px-4 py-3">
				{row.parent === null ? null : row.parent.removed ? (
					<p className="mb-2.5 border-n3 border-l-2 pl-3 text-n5 text-xs italic">
						↳ <span className="font-medium">{REMOVED_PARENT_PLACEHOLDER}</span>
					</p>
				) : (
					<p className="mb-2.5 border-n2 border-l-2 pl-3 text-n5 text-xs italic">
						↳ {row.parent.snippet}
					</p>
				)}

				{removed ? (
					<p className="mb-1.5 font-medium text-[11px] text-n5 uppercase tracking-wide">
						Removed — hidden from participants
					</p>
				) : null}
				<p
					className={cn(
						"whitespace-pre-wrap break-words text-sm leading-6",
						removed ? "text-n4" : "text-ink",
					)}
				>
					{row.body}
				</p>

				{row.imageUrl ? (
					// biome-ignore lint/performance/noImgElement: admin-only moderation review of a short-TTL signed URL; next/image would proxy/cache the moderated object.
					<img
						src={row.imageUrl}
						alt="Attached comment media (moderation review)"
						className="mt-3 max-h-80 rounded-(--imgr) border border-n2"
					/>
				) : row.hasImage ? (
					// Image present but its short-TTL URL failed to mint — surface it as
					// unavailable (never let image content read as text-only).
					<div className="mt-3 flex items-center gap-2 rounded-(--r) border border-n4 border-dashed bg-n1 px-3 py-2 text-ink text-sm">
						<ImageOff aria-hidden className="size-4 shrink-0" />
						Image present but unavailable — refresh to retry.
					</div>
				) : null}

				{row.categoryScores.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-1.5">
						{row.categoryScores.map((c) => (
							<span
								key={c.name}
								className="rounded-(--r-chip) border border-n2 bg-n1 px-2 py-0.5 font-mono text-n5 text-xs"
							>
								{c.name} {c.score.toFixed(3)}
							</span>
						))}
					</div>
				) : null}
			</div>

			<footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-n2 border-t px-4 py-2.5 text-xs">
				<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-n5">
					<span className="font-medium text-n6">{row.authorPseudonym}</span>
					<span className="text-n4">·</span>
					<span className="tabular-nums">
						Đ{formatDharma(row.authorDharma)}
					</span>
					<span className="text-n4">·</span>
					<span
						className={cn(
							"inline-flex items-center gap-1",
							row.priorFlagCount > 0 && "font-semibold text-ink",
						)}
					>
						{row.priorFlagCount > 0 ? (
							<Flag aria-hidden className="size-3" />
						) : null}
						{row.priorFlagCount} prior flag
						{row.priorFlagCount === 1 ? "" : "s"}
					</span>
				</span>
				{banned ? (
					<span className="inline-flex items-center gap-1 rounded-(--r-chip) bg-n6 px-1.5 py-0.5 font-semibold text-[11px] text-ground uppercase leading-4 tracking-wide">
						<UserX aria-hidden className="size-3" />
						Banned
					</span>
				) : null}

				<div className="ml-auto flex flex-wrap items-center gap-2">
					{note ? (
						<span role="status" className="text-n6">
							{note}
						</span>
					) : null}
					{error ? (
						<span role="alert" className="font-semibold text-ink">
							{error}
						</span>
					) : null}
					{confirming ? null : (
						<>
							<button
								type="button"
								disabled={pending !== null || removed}
								onClick={() => setConfirming("remove")}
								className={cn(
									actionButton,
									"border border-n3 bg-(--btn-fill) text-ink hover:bg-(--state-hover-fill)",
								)}
							>
								{pending === "remove" ? "Removing…" : "Remove"}
							</button>
							<button
								type="button"
								disabled={pending !== null || banned}
								onClick={() => setConfirming("ban")}
								className={cn(
									actionButton,
									"border border-n5 bg-(--btn-fill) text-ink hover:bg-(--state-hover-fill)",
								)}
							>
								{pending === "ban" ? "Banning…" : "Ban author"}
							</button>
						</>
					)}
				</div>

				{confirming ? (
					<fieldset
						aria-label={CONFIRM_COPY[confirming].cta}
						onKeyDown={(e) => {
							if (e.key === "Escape") setConfirming(null);
						}}
						className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded-(--r) border border-n4 bg-n1 px-3 py-2"
					>
						<span className="min-w-0 flex-1 text-ink">
							{CONFIRM_COPY[confirming].prompt}
						</span>
						<button
							type="button"
							ref={cancelRef}
							onClick={() => setConfirming(null)}
							className={cn(
								actionButton,
								"border border-n3 bg-(--btn-fill) text-ink hover:bg-(--state-hover-fill)",
							)}
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => run(confirming)}
							className={cn(actionButton, "bg-ink text-ground hover:bg-n7")}
						>
							{CONFIRM_COPY[confirming].cta}
						</button>
					</fieldset>
				) : null}
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
			<div className="rounded-(--r) border border-n2 border-dashed bg-n0 px-6 py-16 text-center text-n5 text-sm">
				No live content to review.
			</div>
		);
	}
	return (
		<div className="flex flex-col gap-3">
			{rows.map((row) => (
				<Row key={row.id} row={row} />
			))}
		</div>
	);
}
