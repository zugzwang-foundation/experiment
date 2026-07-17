"use client";

import type { ReplyAggregate, Side } from "../types";
import { c3OppositeSide, formatDharmaGrouped } from "./copy";
import { deriveReplySide, isEntryDisabled } from "./gating";
import { computeSplitBar } from "./split-bar";

/**
 * UI.A3 slice 3 — the focused post's designed split bar (canon §6:
 * `SUPPORT Đ 3,800 ─ Đ 10,000 STAKED ─ Đ 6,200 COUNTER`) carrying the
 * Support/Counter TRIGGER pills (v0.9: pole-coded by the RESULTING bet side
 * — Support inherits the post's side, Counter the opposite; never a column
 * label — SG-8). A trigger whose resulting side ≠ the viewer's held side
 * renders DISABLED (F-3; tooltip + aria carry the C3 batch string). Triggers
 * toggle-to-close (v0.10). Renders on the removed variant too — the
 * aggregate survives and replying to a removed argument is legal (§6 edge).
 */
export function ReplySplitBar({
	postSide,
	aggregate,
	heldSide,
	marketOpen,
	suspended,
	activeRelation,
	onToggleRelation,
}: {
	postSide: Side;
	aggregate: ReplyAggregate;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	activeRelation: "support" | "counter" | null;
	onToggleRelation: (relation: "support" | "counter") => void;
}) {
	const { totalDharma, supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	return (
		<div className="flex items-center gap-3 text-xs">
			<span className="flex items-center gap-1.5">
				<TriggerPill
					relation="support"
					postSide={postSide}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
					active={activeRelation === "support"}
					onToggle={onToggleRelation}
				/>
				<span className="text-n5">
					Đ {formatDharmaGrouped(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				<span
					className="h-1.5 w-full overflow-hidden rounded-(--r-dot) bg-no"
					aria-hidden="true"
				>
					<span className="block h-full bg-yes" style={{ width: supportPct }} />
				</span>
				<span className="text-n5">
					<b className="text-sm text-ink">
						Đ {formatDharmaGrouped(totalDharma)}
					</b>{" "}
					staked
				</span>
			</span>
			<span className="flex items-center gap-1.5">
				<span className="text-n5">
					Đ {formatDharmaGrouped(aggregate.counterDharma)}
				</span>
				<TriggerPill
					relation="counter"
					postSide={postSide}
					heldSide={heldSide}
					marketOpen={marketOpen}
					suspended={suspended}
					active={activeRelation === "counter"}
					onToggle={onToggleRelation}
				/>
			</span>
		</div>
	);
}

/** One Support/Counter trigger — pole fill/text/border NEVER change with state
 * (values-log §3: glow-only hover/pressed; disabled = opacity, no pointer). */
function TriggerPill({
	relation,
	postSide,
	heldSide,
	marketOpen,
	suspended,
	active,
	onToggle,
}: {
	relation: "support" | "counter";
	postSide: Side;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	active: boolean;
	onToggle: (relation: "support" | "counter") => void;
}) {
	const resultingSide = deriveReplySide({ parentSide: postSide, relation });
	const oppositeHeld = isEntryDisabled({ resultingSide, heldSide });
	const disabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: resultingSide })
			: null;
	const pole =
		resultingSide === "YES"
			? // Black-pill exception: 0.5px n2 edge (values-log §1 item 8).
				"bg-yes text-no border-[0.5px] border-n2"
			: "bg-no text-yes [border:var(--hairline)]";
	return (
		<button
			type="button"
			disabled={disabled}
			aria-disabled={disabled}
			aria-expanded={active}
			aria-label={
				c3 ??
				`${relation === "support" ? "Support" : "Counter"} — bet ${resultingSide}`
			}
			title={c3 ?? undefined}
			onClick={() => onToggle(relation)}
			className={`rounded-(--r-chip) px-3 py-1 text-xs font-bold transition-all hover:shadow-(--state-hover-glow-pole) focus-visible:shadow-(--state-focus-ring) active:shadow-(--state-pressed-glow-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) ${pole}`}
		>
			{relation === "support" ? "Support" : "Counter"}
		</button>
	);
}
