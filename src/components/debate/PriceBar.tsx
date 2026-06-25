import { formatPercent } from "./format";

/**
 * The market price bar (DEBATE.4 §5 / D1) — Yes%/No% from `getPrices`, pole-
 * coded: the YES proportion is the black (`--color-yes`) segment, the remainder
 * the white (`--color-no`) segment, delineated by a hairline so the bar shape
 * reads on a white ground. The percent is paired with literal text (AGENTS.md
 * §8 — never colour alone). `null` pricing (an unpooled market) → a quiet stub.
 */
export function PriceBar({
	pricing,
}: {
	pricing: { yes: string; no: string } | null;
}) {
	if (!pricing) {
		return <p className="text-xs text-muted-foreground">Pricing unavailable</p>;
	}
	const yesPct = formatPercent(pricing.yes);
	const noPct = formatPercent(pricing.no);
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
