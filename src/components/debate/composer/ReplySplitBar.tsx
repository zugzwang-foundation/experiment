"use client";

import { formatDharma } from "../format";
import type { ReplyAggregate, Side } from "../types";
import { c3OppositeSide } from "./copy";
import { deriveReplySide, isEntryDisabled } from "./gating";
import { computeSplitBar, displaySplitTotal } from "./split-bar";

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
	const { supportPct } = computeSplitBar({
		supportDharma: aggregate.supportDharma,
		counterDharma: aggregate.counterDharma,
	});
	// DROUND R2: the DISPLAYED total sums the DISPLAYED parts, so Support / Total
	// / Counter are always arithmetically consistent on screen (SPEC.1 §10.8).
	const displayedTotal = displaySplitTotal(
		aggregate.supportDharma,
		aggregate.counterDharma,
	);
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
					Đ {formatDharma(aggregate.supportDharma)}
				</span>
			</span>
			<span className="flex min-w-0 flex-1 flex-col items-center gap-1">
				{/* RR-3 — THE POLES NAME THE SIDE, NEVER THE RELATION.
				    The fill is the SUPPORT share and the track is the counter
				    remainder, and both resolve to a SIDE: Support inherits the post's
				    side, Counter opposes it — `deriveReplySide`'s rule, the same one
				    `TriggerPill (→ the pole const)` applies below: this component's own
				    correct sibling, and this row's positive control.
				    Both were FIXED (`bg-no` track over a `bg-yes` fill), so on every NO
				    post the NO-side share was painted in the YES pole — a lie about
				    which side an argument backs.

				    ⛔ THE MOCKUP DOES **NOT** VINDICATE THIS BAR, AND AN EARLIER DRAFT OF
				    THIS COMMENT CLAIMED IT DID. Measured in `surface_d5_v1_0.html`:
				    `:1247`/`:1249` are the Support/Counter BUTTONS (`.rbtn2 n` / `.rbtn2
				    y`), and the bar between them at `:1248` carries NO side class at all.
				    `.barrow .bar` is a fixed `--n0` and `.bar .fill` a fixed `--ink`
				    (`:510-512`); `.bar .fill.right` exists at `:513` and is NEVER
				    applied; and the JS at `:1591-1592` sets only the two buttons'
				    classNames while `:1596` sets only the fill's WIDTH. The annotated
				    post is `side:'no'` with `sPct:69`, so d5 paints a NO post's SUPPORT
				    share in the YES pole.
				    ⇒ d5's BAR is itself a Route-3 instance. The mockup demonstrates the
				    rule at its TRIGGERS and fails to apply it at its BAR; this build
				    applies it in both places. So C13 is a DELIBERATE DIVERGENCE from the
				    artifact on the design-language rule (`design-language.md` §1
				    "Binding resolved" — and AGENTS.md §8's "the poles name the SIDE
				    (YES/NO), never the Support/Counter relation"), NOT a return to
				    it — recorded because §3 ratifies "mimic the mockup", and a later
				    fidelity pass reading `d5:1248` without this note would revert
				    the fix.
				    ⚠ BOTH POINTERS WERE WRONG UNTIL @code-reviewer RE-MEASURED THEM,
				    and they are named here so the wrong pair is not restored:
				    `design-language.md:268` is a CHANGELOG entry, not the rule (the
				    locked binding is §1, `:62`; `:269` merely records the axis
				    correction), and CLAUDE.md §8 is O-space — the poles sentence is
				    AGENTS.md §8. A note whose pointers do not resolve leaves the
				    reader with `d5:1248` alone, which is the revert this paragraph
				    exists to prevent. Cited by SYMBOL now, per O-8.

				    ⚠ Written as `postSide === "YES"` rather than as a
				    `deriveReplySide(...)` call, and THE FENCE IS THE REASON. §10 permits
				    exactly one `composer/**` exception, symbol-fenced to these two
				    spans, and any work resolving outside them is `H-COMPOSER`, a HALT —
				    so a hoisted `const` above the return was not available.
				    ⚠ Guard visibility alone does NOT select this form, and saying so
				    would mislead: `SIDE_COMPARISON` matches an IDENTIFIER before the
				    comparison, so a hoisted const would ALSO be visible while a bare
				    call expression would not. Both facts hold; only the fence decides.
				    (Inlining the ternary is also the shape of both ruled precedents —
				    `HeroPanels` entry 7 and `AggregateFooter` entry 9.)

				    ⛔ THE HAIRLINE IS LOAD-BEARING, AND THE FIRST DRAFT OF THIS FIX
				    OMITTED IT. Side-keying the track means it takes `bg-yes` #181818 on
				    a NO post, against a `bg-card` → `--color-n0` #212121 surface — about
				    1.10:1, i.e. GONE. The fill would then have no visible extent to be a
				    proportion OF. ⇒ Correcting the pole without adding the edge would
				    have traded an INVERSION for an ERASURE, on exactly the post side
				    this row exists to fix.
				    Both sibling bars already carry it — `HeroPanels` (this genus's ruled
				    precedent) and `AggregateFooter` — and so does the mockup, whose
				    `.barrow .bar` is an OUTLINE (`d5:510`, `border:1px solid var(--ink)`
				    over an `--n0` ground). This component's own `TriggerPill` carries the
				    same idea as its "black-pill exception" 0.5px n2 edge: the sibling
				    that is this row's positive control for the POLE rule is also its
				    positive control for the EDGE rule.
				    ⛔ NOT `--border-strong` — `emphasis-ladder-tokens.test.ts` pins that
				    token at zero consumers. */}
				<span
					className={`h-1.5 w-full overflow-hidden rounded-(--r-dot) [border:var(--hairline)] ${postSide === "YES" ? "bg-no" : "bg-yes"}`}
					aria-hidden="true"
				>
					<span
						className={`block h-full ${postSide === "YES" ? "bg-yes" : "bg-no"}`}
						style={{ width: supportPct }}
					/>
				</span>
				<span className="text-n5">
					<b className="text-sm text-ink">Đ {formatDharma(displayedTotal)}</b>{" "}
					staked
				</span>
			</span>
			<span className="flex items-center gap-1.5">
				<span className="text-n5">
					Đ {formatDharma(aggregate.counterDharma)}
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
