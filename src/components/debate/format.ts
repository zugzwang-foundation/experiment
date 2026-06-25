/**
 * Display-only formatters for the debate view. All inputs are canonical
 * server-computed values (NUMERIC(38,18) decimal strings / probabilities) —
 * these functions only SHAPE them for rendering and never do decimal float
 * arithmetic on money or prices (CLAUDE.md §2). Pure; client-safe.
 */

/**
 * Trim a NUMERIC(38,18) decimal string to a human Đ amount — pure string
 * trimming of trailing scale zeros, no `Number()` on the value. e.g.
 * `"150.000000000000000000" → "150"`, `"0.500000000000000000" → "0.5"`.
 */
export function formatDharma(value: string): string {
	if (!value.includes(".")) {
		return value;
	}
	const trimmed = value.replace(/\.?0+$/, "");
	return trimmed === "" || trimmed === "-" ? "0" : trimmed;
}

/**
 * Render a spot price (a probability in [0,1] as a decimal string) as a whole
 * percent. Pure integer digit-extraction — never multiplies the price as a
 * float (CLAUDE.md §2); the canonical price is computed server-side by
 * `getPrices`. e.g. `"0.523…" → "52%"`, `"1.000…" → "100%"`.
 */
export function formatPercent(price: string): string {
	const [intPart = "0", fracPart = ""] = price.split(".");
	const intPct = intPart === "1" || Number(intPart) >= 1 ? 100 : 0;
	const firstTwo = `${fracPart}00`.slice(0, 2);
	const third = `${fracPart}000`.charAt(2);
	let pct = intPct + Number(firstTwo);
	if (Number(third) >= 5) {
		pct += 1;
	}
	return `${Math.min(pct, 100)}%`;
}
