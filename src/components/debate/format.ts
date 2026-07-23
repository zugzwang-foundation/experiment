import Decimal from "decimal.js";

/**
 * Display-only formatters for the debate view. All inputs are canonical
 * server-computed values (NUMERIC(38,18) decimal strings / probabilities) —
 * these functions only SHAPE them for rendering and never do decimal float
 * arithmetic on money or prices (CLAUDE.md §2). Pure; client-safe.
 */

/**
 * The display-rounding decimal.js clone (DROUND / SPEC.1 §10.8). A DEDICATED
 * clone so the rounding mode is passed EXPLICITLY at each call site and never
 * inherited from a clone default (the composer's `ComposerDecimal` is
 * ROUND_HALF_EVEN — the wrong mode here). Precision 50 mirrors `CpmmDecimal`;
 * construction from a NUMERIC(38,18) string is exact.
 */
const DisplayDecimal = Decimal.clone({ precision: 50 });

/**
 * Round a NUMERIC(38,18) Đ value to whole Dharma for DISPLAY — 0 decimal
 * places, ROUND_HALF_UP (round half AWAY FROM ZERO, so gains and losses round
 * symmetrically), never a signed zero. This is the single shared formatter for
 * every Đ value rendered to a user (SPEC.1 §10.8); the ledger, engine, read
 * models, and DTOs keep full precision. Exact decimal arithmetic, never a JS
 * float (CLAUDE.md §2). A non-finite / malformed value degrades to
 * `formatDharmaExact` rather than throwing — a bad value must not crash a
 * render. e.g. `"9.5" → "10"`, `"20.6666…" → "21"`, `"-0.00…01" → "0"`.
 */
export function formatDharma(value: string): string {
	let parsed: Decimal;
	try {
		parsed = new DisplayDecimal(value);
	} catch {
		return formatDharmaExact(value);
	}
	if (!parsed.isFinite()) {
		return formatDharmaExact(value);
	}
	const rounded = parsed.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	// `isZero()` covers both +0 and −0 — the guard that forbids rendering "-0".
	return rounded.isZero() ? "0" : rounded.toFixed(0);
}

/**
 * Trim a NUMERIC(38,18) decimal string to a human Đ amount — pure string
 * trimming of trailing scale zeros, no `Number()` on the value. e.g.
 * `"150.000000000000000000" → "150"`, `"0.500000000000000000" → "0.5"`.
 *
 * EXACT (unrounded) variant: retained for the two non-render consumers that
 * must keep full precision — the ADR-0025 `.md` debate export and the sell
 * module's editable input seed (SPEC.1 §10.8 named exception). Every value
 * RENDERED to a user goes through `formatDharma` (below), which rounds.
 */
export function formatDharmaExact(value: string): string {
	if (!value.includes(".")) {
		return value;
	}
	const trimmed = value.replace(/\.?0+$/, "");
	return trimmed === "" || trimmed === "-" ? "0" : trimmed;
}

/**
 * The §23 Net P/L tile, preserved in DISPLAYED space (DROUND R2 / SPEC.1 §10.8).
 * The tile identity `netProfitLoss = wallet + positions − issuance` holds exactly
 * at full precision (server: `tiles.ts`), but rounding each tile independently
 * can break it on screen. So recover issuance in exact decimal space, then derive
 * the displayed P/L from the DISPLAYED (rounded) wallet and positions:
 *   displayed P/L = round0(round0(wallet) + round0(positions) − issuance)
 * keeping `displayed P/L = displayed Wallet + displayed Positions − issuance`
 * true on the tiles. Never a signed zero; exact decimal, never a JS float
 * (CLAUDE.md §2). Degrades to `formatDharma(netProfitLoss)` on a malformed operand.
 */
export function displayNetProfitLoss(
	walletValue: string,
	positionsValue: string,
	netProfitLoss: string,
): string {
	let displayed: Decimal;
	try {
		const wallet = new DisplayDecimal(walletValue);
		const positions = new DisplayDecimal(positionsValue);
		const netPL = new DisplayDecimal(netProfitLoss);
		if (!wallet.isFinite() || !positions.isFinite() || !netPL.isFinite()) {
			return formatDharma(netProfitLoss);
		}
		const issuance = wallet.plus(positions).minus(netPL);
		displayed = wallet
			.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
			.plus(positions.toDecimalPlaces(0, Decimal.ROUND_HALF_UP))
			.minus(issuance)
			.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	} catch {
		return formatDharma(netProfitLoss);
	}
	return displayed.isZero() ? "0" : displayed.toFixed(0);
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
