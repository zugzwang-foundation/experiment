"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * HTML-FINISH · MARKET DETAIL rows 18 + 19 — the vertical scroller rail: d5's
 * `.pscroll` for posts (`:887`) and `.rps` for replies (`:917`), which are the
 * same control at two mount points. Up button · progress track · down button,
 * stacked.
 *
 * ⛔ ROW 29 IS EXPRESSLY NOT A REGRESSION OF THE PAGED LIST. The rail replaces
 * the horizontal prev/next STRIP, not the paging MODEL: one card at a time,
 * client-side, exactly as `PostScroller`/`ReplyScroller` already worked. Row 29
 * is kickoff-ruled to no separate code precisely because it IS this rail.
 *
 * ⛔ TOPOLOGY ONLY — d5's rail is `position:absolute;top:50%;
 * transform:translateY(-50%)` with `right:2px` / `left:2px`, a `92px` track,
 * `5px` wide, `gap:9px`. NONE of those lengths is carried. What is carried is
 * the SHAPE: a vertical stack, buttons at both ends, a proportional fill
 * between them. The rail sits in normal flow beside the card rather than
 * absolutely over the slot, so it needs no offsets at all and cannot overlap
 * the content at a viewport the mockup never declared.
 *
 * ⚠ THE FILL IS `w-[3px] rounded-[1px] bg-ink` — BYTE-CARRIED from
 * `shell/RadioSlot.tsx`'s shipped vertical-bar primitive, which is already on
 * `main`. Nothing new is minted for it.
 *
 * ⚠ THE TRACK/FILL PAIR IS PORTED INDEX-WISE, NOT BY TOKEN NAME. d5 is
 * light-theme, where its `--n2` track is a LIGHT grey under a dark `--ink`
 * fill; this build's ramp is inverted, so the same NAMES here give a dark track
 * under a bright fill — which is the correct reading of the mockup's intent
 * (low-contrast track, high-contrast fill) rather than a coincidence. This is
 * the same index-wise reasoning AGENTS.md §8 applies to `.blab`'s `--ink`.
 *
 * ⚠⚠ THE POSITION READOUT SURVIVES AS `sr-only`, AND THAT IS NOT DECORATION.
 * The strip this replaces rendered a visible `1 / 3` with `aria-live="polite"`,
 * so a screen-reader user heard their position change on every page. d5's rail
 * is a PURELY VISUAL fill and announces nothing — porting it literally would
 * silently delete that announcement, turning a fidelity row into an
 * accessibility regression. The count is kept, still `aria-live`, and only its
 * visual form is replaced by the fill.
 */
export function ScrollRail({
	index,
	total,
	noun,
	onPrev,
	onNext,
}: {
	/** 0-based position of the visible card. */
	index: number;
	total: number;
	/** "post" | "reply" — the byte-carried button labels this rail announces. */
	noun: string;
	onPrev: () => void;
	onNext: () => void;
}) {
	const atStart = index === 0;
	const atEnd = index === total - 1;
	// `.psfill`'s height is the read-through proportion. A single-item scroller
	// has no travel, so it reads full rather than empty.
	const fill = total <= 1 ? "100%" : `${((index + 1) / total) * 100}%`;

	return (
		<div
			data-testid="scroll-rail"
			className="flex shrink-0 flex-col items-center gap-2 self-stretch"
		>
			<button
				type="button"
				onClick={onPrev}
				disabled={atStart}
				aria-label={`Previous ${noun}`}
				className="shrink-0 text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) [&_svg]:size-3.5"
			>
				<ChevronUp />
			</button>

			{/* `.psload` / `.psfill` — the track and its proportional fill. Decorative:
			    the `sr-only` readout below is the accessible channel. */}
			<span
				data-testid="scroll-rail-track"
				aria-hidden="true"
				className="w-[3px] flex-1 overflow-hidden rounded-[1px] bg-n2"
			>
				<span
					data-testid="scroll-rail-fill"
					className="block w-[3px] rounded-[1px] bg-ink"
					style={{ height: fill }}
				/>
			</span>

			<button
				type="button"
				onClick={onNext}
				disabled={atEnd}
				aria-label={`Next ${noun}`}
				className="shrink-0 text-n4 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity) [&_svg]:size-3.5"
			>
				<ChevronDown />
			</button>

			<span className="sr-only" aria-live="polite">
				{index + 1} / {total}
			</span>
		</div>
	);
}
