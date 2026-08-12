import { formatPricePercent } from "./format";

/**
 * V29/V30 — the Discovery-scoped size presets. `hero` (22px bar, 12px labels)
 * and `card` (16px, 10.5px) are the `.barrow.f` / `.barrow.m` rows of
 * surface_discovery_v1_0.html (`:99-111`): LABEL — BAR — LABEL on one flex row,
 * gap 9px, no text inside the bar.
 *
 * `detail` is NOT in this map because it is structurally different (bar above,
 * labels below). ⚠ It was a NAMED TRANSITIONAL preset, pinned BYTE-IDENTICAL to
 * the render that shipped before this preset existed so `/m/[slug]` had a zero
 * pixel delta (OD-2). POLISH.3 has now RECONCILED it: the bar and labels carry
 * d5's 14px / 10px (surface_d5_v1_0.html:507-508), deliberately breaking that
 * pin, which was transitional by construction (PD-3-01 / D5).
 *
 * ⚠ ONLY THE NUMBERS WERE OPEN. d5's bar is structurally a one-row `.barrow`
 * (`:505`, labels flanking the bar); this ships the two-row form still. That
 * divergence is recorded and NOT actioned (D-J) — adopting it would move
 * `detail` into `ROW` below and delete the early return, which is what keeps
 * `hero` and `card` unreachable from this change.
 */
const ROW = {
	hero: { bar: "h-[22px]", label: "text-[12px]" },
	card: { bar: "h-[16px]", label: "text-[10.5px]" },
} as const;

/**
 * The market price bar (DEBATE.4 §5 / D1) — Yes%/No% from `getPrices`, pole-
 * coded: the YES proportion is the black (`--color-yes`) segment, the remainder
 * the white (`--color-no`) segment, delineated by a hairline so the bar shape
 * reads on the dark ground (the black YES segment ≡ ground collision is
 * accepted — adjacency + the track edge carry it, values-log v0_3 §1 item 8).
 * The percent is paired with literal text (AGENTS.md
 * §8 — never colour alone). `null` pricing (an unpooled market) → a quiet stub.
 *
 * `size` is REQUIRED and has no default: a missing required argument is a
 * compile error, a defaulted one is a silent wrong render (CLAUDE.md §8 O-1,
 * structural beats procedural).
 *
 * ⚠ The mockup's `.bar{border:1px solid var(--ink)}`, `.bar{background:
 * var(--n0)}` and `.fill{background:var(--ink)}` are DELIBERATELY NOT PORTED BY
 * NAME. The mockups are LIGHT-theme (`--ink:#0A0A0A`, `--n0:#FFFFFF`); this
 * build is inverted (`--color-ink:#fafafa`, `--color-n0:#212121`). The fill is
 * the YES side and the track is the NO side, so porting either by token name
 * would invert the pole — the identical defect C0's guard exists to prevent.
 * The two segments stay `bg-yes` / `bg-no` and the edge stays `--hairline`.
 */
export function PriceBar({
	pricing,
	size,
}: {
	pricing: { yes: string; no: string } | null;
	size: "hero" | "card" | "detail";
}) {
	if (!pricing) {
		return <p className="text-xs text-muted-foreground">Pricing unavailable</p>;
	}
	// PCT.ROUND: YES canonical, NO derived as 100 − YES — the pair always sums
	// to exactly 100 (SPEC.1 §10.8). The bar geometry below is unchanged.
	const yesPct = formatPricePercent(pricing, "YES");
	const noPct = formatPricePercent(pricing, "NO");

	// The market-detail render. Structurally as it shipped at V29/V30 — no
	// `data-size`, no reordering — but NO LONGER byte-identical to the
	// pre-preset render: POLISH.3 applied d5's 14px bar / 10px labels here
	// (PD-3-01 / D5), breaking OD-2's pin deliberately.
	if (size === "detail") {
		return (
			<div className="flex flex-col gap-1">
				<div
					className="flex h-[14px] w-full overflow-hidden rounded-full [border:var(--hairline)]"
					role="img"
					aria-label={`YES ${yesPct}, NO ${noPct}`}
				>
					{/* Width is a data-driven length (the price proportion) — a string
					    percentage, not float math (CLAUDE.md §2). */}
					<div className="h-full bg-yes" style={{ width: yesPct }} />
					<div className="h-full flex-1 bg-no" />
				</div>
				<div className="flex justify-between font-mono text-[10px] text-muted-foreground">
					<span>YES {yesPct}</span>
					<span>NO {noPct}</span>
				</div>
			</div>
		);
	}

	const s = ROW[size];
	// `.blab` — 700, .05em, nowrap, `--ink`. `--ink` here is a text-EMPHASIS
	// token, not a side encoding: both labels carry it, so copying it by name is
	// the correct index-wise port (AGENTS.md §8).
	const label = `${s.label} font-bold tracking-[0.05em] whitespace-nowrap text-ink`;
	return (
		<div data-size={size} className="flex items-center gap-[9px]">
			<span className={label}>YES {yesPct}</span>
			<div
				className={`${s.bar} flex flex-1 overflow-hidden rounded-[var(--r)] [border:var(--hairline)]`}
				role="img"
				aria-label={`YES ${yesPct}, NO ${noPct}`}
			>
				<div className="h-full bg-yes" style={{ width: yesPct }} />
				<div className="h-full flex-1 bg-no" />
			</div>
			<span className={label}>NO {noPct}</span>
		</div>
	);
}
