import { cn } from "@/lib/utils";

import { computeSplitBar, displaySplitTotal } from "./composer/split-bar";
import { formatDharma } from "./format";
import type { ReplyAggregate, Side } from "./types";

/**
 * The read-time Support/Counter aggregate footer (design-language §3.1 / D12),
 * rendered as the market-view SPLIT BAR (`d5:1099-1102 (.barrow.f2)`; plan §6
 * row T3, Tier B-3). A READ-ONLY aggregate over a post's reply-bets — there is
 * NO vote control (no up/down, no friendly-fire); Support/Counter are computed,
 * never cast (INV / design-language §4.3).
 *
 * ⛔ THE MOCKUP'S TRIGGERS ARE DELIBERATELY ABSENT. `d5:1100`/`:1102`'s
 * `.rbtn2` Support/Counter pills are bucket D: `POLISH-3.md` R1 removed those
 * controls from `PostCard` on THESIS grounds — "entering post-focus to argue
 * means reading the post first, and mandatory commentary is meant to make
 * argument deliberate, not reflexive". The pills are the same controls in a
 * different container, so re-adding them here would undo PR 2's own R1 work
 * inside PR 2. This is the VISUAL half only.
 *
 * ⛔⛔ THE POLES ARE KEYED TO THE POST'S SIDE, AND THAT IS THE WHOLE POINT.
 * Support inherits the post's side; Counter takes the opposite. So the pole a
 * given share is painted in DEPENDS ON THE POST, and a bar with FIXED poles
 * renders the NO-side share in the YES pole on every NO post.
 *
 * ⚠ `tests/unit/design/side-pole-binding.test.ts` CANNOT CATCH THAT. Its own
 * docstring names the case as "Route 3 — a FIXED pole colour on a PER-SIDE
 * element ... no side value appears in the expression at all", records that
 * "V17's Support/Counter split bar lived in exactly this hole for the length of
 * this PR", and notes the file "stayed green throughout". The live inversion at
 * `composer/ReplySplitBar.tsx:64,67` (`RR-3`) is the same defect still shipped.
 * ⇒ The side value is resolved to a pole token AT the call site below, which is
 * the shape that cannot invert silently, and the control is the render guard
 * `tests/unit/debate/render/aggregate-footer.test.tsx` (four assertions: two
 * poles × two post sides).
 *
 * ⚠ Ruling A — structure is copied from the mockup, tokens are NOT. `.bar`'s
 * `border:1px solid var(--ink)` and `.fill`'s `background:var(--ink)` are
 * LIGHT-theme values; ported by name they would render both poles near-white.
 * The poles are `--color-yes`/`--color-no` via `bg-yes`/`bg-no`.
 *
 * ⚠ The split math is REUSED, not re-implemented: `computeSplitBar` /
 * `displaySplitTotal` are the ratified exact-decimal (never JS float, CLAUDE.md
 * §2) implementations already backing the focused-post bar, so the two bars
 * cannot disagree about one market. A second copy here would be
 * `PLURAL-NOUN-DUP`'s genus. Read-only reuse — no `composer/**` file is
 * written (§10).
 */
export function AggregateFooter({
	aggregate,
	postSide,
}: {
	aggregate: ReplyAggregate;
	/** The post's frozen side (INV-3) — the bar's pole basis, never a relation. */
	postSide: Side;
}) {
	const { supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	// DROUND R2: the DISPLAYED total sums the DISPLAYED parts, so Support /
	// Total / Counter are always arithmetically consistent on screen (§10.8).
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
	// Support resolves to the post's own side; Counter to the opposite.
	const supportPole = postSide === "YES" ? "bg-yes" : "bg-no";
	const counterPole = postSide === "YES" ? "bg-no" : "bg-yes";

	return (
		<div
			data-testid="aggregate-footer"
			className="flex items-start gap-2 text-xs text-muted-foreground"
		>
			<span className="shrink-0">
				Support ({aggregate.supportCount}) : Đ{" "}
				{formatDharma(aggregate.supportDharma)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				{/* Decorative: the figures either side carry the meaning, and colour
				    is never the only channel (§8 a11y). */}
				<span
					data-testid="aggregate-split-track"
					aria-hidden="true"
					className={cn(
						"h-1.5 w-full overflow-hidden rounded-(--r-dot)",
						counterPole,
					)}
				>
					<span
						data-testid="aggregate-split-fill"
						className={cn("block h-full", supportPole)}
						style={{ width: supportPct }}
					/>
				</span>
				<span>
					<b className="text-sm text-ink">Đ {formatDharma(displayedTotal)}</b>{" "}
					staked
				</span>
			</span>
			<span className="shrink-0">
				Counter ({aggregate.counterCount}) : Đ{" "}
				{formatDharma(aggregate.counterDharma)}
			</span>
		</div>
	);
}
