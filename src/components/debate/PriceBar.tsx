import { formatPricePercent } from "./format";

/**
 * V29/V30 — the Discovery-scoped size presets. `hero` (22px bar, 12px labels)
 * and `card` (16px, 10.5px) are the `.barrow.f` / `.barrow.m` rows of
 * surface_discovery_v1_0.html (`:99-111`): LABEL — BAR — LABEL on one flex row,
 * gap 9px, no text inside the bar.
 *
 * `detail` is NOT in this map because it is structurally different (bar above,
 * labels below) and is pinned BYTE-IDENTICAL to the render that shipped before
 * this preset existed, so `/m/[slug]` has a zero pixel delta (OD-2). ⚠ It is a
 * NAMED TRANSITIONAL preset, not the ratified answer: d5 specifies a 14px bar /
 * 10px labels (surface_d5_v1_0.html:507-508). Reconciling it is POLISH.3's row,
 * not this task's — applying d5's numbers here would spend POLISH.3's decision
 * without POLISH.3's inspection.
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

	// The pinned pre-preset render. Byte-identical to what `/m/[slug]` shipped
	// before V29/V30 — no `data-size`, no reordering, no class change.
	if (size === "detail") {
		return (
			<div className="flex flex-col gap-1">
				<div
					className="flex h-1.5 w-full overflow-hidden rounded-full [border:var(--hairline)]"
					role="img"
					aria-label={`YES ${yesPct}, NO ${noPct}`}
				>
					{/* Width is a data-driven length (the price proportion) — a string
					    percentage, not float math (CLAUDE.md §2). */}
					<div className="h-full bg-yes" style={{ width: yesPct }} />
					<div className="h-full flex-1 bg-no" />
				</div>
				<div className="flex justify-between font-mono text-[11px] text-muted-foreground">
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
