import { cn } from "@/lib/utils";

import { c3OppositeSide } from "./composer/copy";
import { deriveReplySide, isEntryDisabled } from "./composer/gating";
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
 * ✅ THE MOCKUP'S TRIGGERS ARE BACK (HTML-FINISH · MARKET DETAIL row 22), and
 * `R1` IS SUPERSEDED IN PLACE RATHER THAN DELETED (O-4). This block used to
 * read: "⛔ THE MOCKUP'S TRIGGERS ARE DELIBERATELY ABSENT … `POLISH-3.md` R1
 * removed those controls from `PostCard` on THESIS grounds — 'entering
 * post-focus to argue means reading the post first, and mandatory commentary is
 * meant to make argument deliberate, not reflexive'." The founder ruling of
 * 2026-08-16 reverses that strike.
 *
 * ⚠ AND THE THESIS GROUND IS HONOURED RATHER THAN OVERRIDDEN, which is the
 * shape of the reversal. A card pill does NOT open a composer on the card.
 * `onReply` enters that post's focus AND opens the relation there — so the
 * reader still lands on the argument before writing about it, exactly as R1
 * required, while the mockup's one-click affordance is restored. What R1
 * actually forbade was arguing WITHOUT reading; that is still forbidden.
 *
 * ⚠ THE PILLS ARE OPTIONAL. Without `triggers` this renders read-only, exactly
 * as it did before row 22 — so the component keeps working for any consumer
 * that has no viewer state to gate them with.
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
 * this PR", and notes the file "stayed green throughout". `RR-3` — the same
 * defect on `ReplySplitBar`'s own track and fill spans — was corrected at
 * POLISH.3 PR 2 C13; cited here as the worked example of the genus, not as a
 * live defect.
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
	triggers,
}: {
	aggregate: ReplyAggregate;
	/** The post's frozen side (INV-3) — the bar's pole basis, never a relation. */
	postSide: Side;
	/**
	 * HTML-FINISH · MARKET DETAIL row 22 — the `.rbtn2` Support/Counter trigger
	 * pills (`d5:1100`, `:1102`). OMIT to render the read-only footer.
	 *
	 * ⛔ THE VIEWER STATE IS REQUIRED TOGETHER WITH THE HANDLER, deliberately as
	 * one object: a trigger without its F-3 gate is a control that invites a bet
	 * the viewer cannot place. Making them separable would make that mistake
	 * expressible.
	 */
	triggers?: {
		heldSide: Side | null;
		marketOpen: boolean;
		suspended: boolean;
		onReply: (relation: "support" | "counter") => void;
	};
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
			<span className="flex shrink-0 flex-col items-start gap-1">
				{triggers ? (
					<TriggerPill relation="support" postSide={postSide} {...triggers} />
				) : null}
				<span>
					Support ({aggregate.supportCount}) : Đ{" "}
					{formatDharma(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				{/* Decorative: the figures either side carry the meaning, and colour
				    is never the only channel (§8 a11y). */}
				{/* ⚠ THE HAIRLINE IS LOAD-BEARING, NOT TRIM. `--color-yes` is #181818
				    and the card surface is `bg-card` → `--color-n0` #212121, so on a
				    NO post the track (the YES pole) sits at ~1.09:1 against its own
				    card and DISAPPEARS — leaving the fill no visible extent to be a
				    proportion of. The zero-reply case is the same defect from the
				    other side: `computeSplitBar` returns "0%", so a YES post would
				    render a solid full-width white bar reading as "100% Counter"
				    beside text saying Support (0) / Counter (0).
				    The mockup does not have this problem because `.bar` is an
				    OUTLINE — `d5:510` `border:1px solid var(--ink)` — and the port
				    dropped it. Ruling A forbids porting the VALUE, not the
				    STRUCTURE, so the border returns via the build's own token.
				    ⛔ NOT `--border-strong`: `emphasis-ladder-tokens.test.ts:216`
				    pins that token at zero consumers. */}
				<span
					data-testid="aggregate-split-track"
					aria-hidden="true"
					className={cn(
						"h-1.5 w-full overflow-hidden rounded-(--r-dot) [border:var(--hairline)]",
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
			<span className="flex shrink-0 flex-col items-end gap-1">
				{triggers ? (
					<TriggerPill relation="counter" postSide={postSide} {...triggers} />
				) : null}
				<span>
					Counter ({aggregate.counterCount}) : Đ{" "}
					{formatDharma(aggregate.counterDharma)}
				</span>
			</span>
		</div>
	);
}

/**
 * One Support/Counter trigger on the market-view card (row 22) — the `.rbtn2`
 * pills at `d5:1100` / `:1102`.
 *
 * ⛔⛔ POLE-KEYED BY THE RESULTING BET SIDE, NOT BY THE RELATION. Support
 * inherits the post's side, Counter takes the opposite, and the pole is resolved
 * from that RESULTING side at this call site — the shape
 * `side-pole-binding.test.ts` exists to require, because a fixed pole on a
 * per-side element is its documented "Route 3" blind spot. AGENTS.md §8: the
 * poles name the SIDE (YES/NO), never the Support/Counter relation.
 *
 * ⚠ THE SIDE DERIVATION IS SHARED, NOT RE-IMPLEMENTED — `deriveReplySide` and
 * `isEntryDisabled` are the same unit-pinned functions the focused-post bar
 * uses, so the two surfaces cannot disagree about which side a relation
 * produces. Only the CSS recipe below is a second copy, and it is a second copy
 * because `ReplySplitBar`'s own `TriggerPill` is file-private and that file is
 * allow-list-EXCLUDED for writing — exporting it would be the edit this task may
 * not make. ⚠ Unifying the two is a follow-up whose fence must include
 * `composer/ReplySplitBar.tsx`.
 *
 * ⚠ F-3 GATING IS NOT OPTIONAL. A trigger whose RESULTING side is not the
 * viewer's held side renders disabled, carrying the C3 batch string in both
 * `title` and `aria-label` — identical to the focused-post bar, so the same
 * refusal reads the same way wherever the viewer meets it.
 */
function TriggerPill({
	relation,
	postSide,
	heldSide,
	marketOpen,
	suspended,
	onReply,
}: {
	relation: "support" | "counter";
	postSide: Side;
	heldSide: Side | null;
	marketOpen: boolean;
	suspended: boolean;
	onReply: (relation: "support" | "counter") => void;
}) {
	const resultingSide = deriveReplySide({ parentSide: postSide, relation });
	const oppositeHeld = isEntryDisabled({ resultingSide, heldSide });
	const disabled = !marketOpen || suspended || oppositeHeld;
	const c3 =
		oppositeHeld && heldSide !== null
			? c3OppositeSide({ held: heldSide, resulting: resultingSide })
			: null;
	// Black-pill exception: 0.5px n2 edge (values-log §1 item 8) — `--color-yes`
	// is #181818 against a #212121 card, so the pole needs its own edge to have
	// any visible extent at all.
	const pole =
		resultingSide === "YES"
			? "bg-yes text-no border-[0.5px] border-n2"
			: "bg-no text-yes [border:var(--hairline)]";
	return (
		<button
			type="button"
			data-testid={`card-trigger-${relation}`}
			disabled={disabled}
			aria-disabled={disabled}
			aria-label={
				c3 ??
				`${relation === "support" ? "Support" : "Counter"} — bet ${resultingSide}`
			}
			title={c3 ?? undefined}
			onClick={() => onReply(relation)}
			className={cn(
				"rounded-(--r-chip) px-3 py-1 text-xs font-bold transition-all hover:shadow-(--state-hover-glow-pole) focus-visible:shadow-(--state-focus-ring) active:shadow-(--state-pressed-glow-pole) disabled:pointer-events-none disabled:opacity-(--state-disabled-opacity)",
				pole,
			)}
		>
			{relation === "support" ? "Support" : "Counter"}
		</button>
	);
}
