import Decimal from "decimal.js";

import type { Side } from "./types";

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
 * Round a NUMERIC(38,18) Đ value to whole Dharma — 0 decimal places,
 * ROUND_HALF_UP (round half AWAY FROM ZERO, so gains and losses round
 * symmetrically), never a signed zero. Exact decimal arithmetic, never a JS
 * float (CLAUDE.md §2). A non-finite / malformed value degrades to
 * `formatDharmaExact` rather than throwing — a bad value must not crash a
 * render. e.g. `"9.5" → "10"`, `"20.6666…" → "21"`, `"-0.00…01" → "0"`.
 *
 * DISPLAYED-SPACE ARITHMETIC ONLY — **NEVER RENDERED.** This is the UNGROUPED
 * rounding primitive, and it exists for exactly one reason: the SPEC.1 §10.8
 * displayed-space aggregate identities must ADD BEFORE THEY GROUP. The §23 Net
 * P/L tile and the reply split bar's staked total each sum values that are
 * already rounded to what the eye sees, and a grouped operand cannot be read
 * back — `new Decimal("1,234")` throws and `Number("1,234")` is `NaN`. So the
 * sum is taken here, ungrouped, and grouping happens once at the render.
 *
 * To RENDER a Đ value, call `formatDharma` (below) — the only formatter that
 * may. That this primitive never reaches JSX is guarded, not merely conventional:
 * `tests/unit/design/no-raw-dharma-render.test.ts` fails on a `{round0Dharma(…)}`
 * JSX child.
 */
export function round0Dharma(value: string): string {
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
 * Comma-group the INTEGER PART of an already-rounded Đ string, in threes, with
 * the LITERAL ASCII comma `,` (U+002C) — never `toLocaleString`, never
 * `Intl.NumberFormat` (SPEC.1 §10.8). Đ figures render in both the server and
 * the client tree, and a locale-derived separator resolves differently in the
 * two: a hydration mismatch, and `1.234` for one thousand two hundred and
 * thirty-four Dharma under a `de-DE` runtime.
 *
 * Sign preserved; a fractional part, where one survives, passes through
 * UNGROUPED (§10.8 groups the integer part alone). Anything that is not a
 * plain signed integer — i.e. the malformed value `round0Dharma` degraded to
 * `formatDharmaExact` — is returned UNTOUCHED: a bad value is not dressed up
 * in thousands separators.
 */
function groupInteger(digits: string): string {
	const neg = digits.startsWith("-");
	const body = neg ? digits.slice(1) : digits;
	const [int = "", frac] = body.split(".");
	if (!/^\d+$/.test(int)) {
		return digits;
	}
	const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return `${neg ? "-" : ""}${frac === undefined ? grouped : `${grouped}.${frac}`}`;
}

/**
 * The SINGLE shared display formatter for every Đ value rendered to a user
 * (SPEC.1 §10.8): it rounds to 0 dp AND groups in threes, together. e.g.
 * `"9.5" → "10"`, `"14260.000…" → "14,260"`, `"1234567" → "1,234,567"`.
 * The ledger, engine, read models and DTOs keep full precision.
 *
 * Grouping is a property of THIS FORMATTER, not a choice made at a call site,
 * and no ungrouped display variant exists to be selected by mistake — the
 * parallel `composer/copy.ts::formatDharmaGrouped` is deleted and its call
 * sites re-pointed here. An opt-in convention that must be remembered at thirty
 * render sites will be broken at the thirty-first, which is exactly how the
 * header stats, the §23 Positions-value tile and the discovery staked totals
 * came to render ungrouped beside composers that grouped.
 *
 * A grouped value is TERMINAL: it is not merely a string that should not be
 * read back but one that cannot be. Displayed-space arithmetic goes through
 * `round0Dharma`; the sell module's editable amount input keeps seeding from
 * the exact ungrouped Đb string (the §10.8 named exception, marked at its site
 * with the `dround-allow` comment token — spelled here WITHOUT its trailing
 * colon so this prose cannot be counted as a second allowlist marker by
 * `tests/unit/design/no-raw-dharma-render.test.ts`).
 */
export function formatDharma(value: string): string {
	return groupInteger(round0Dharma(value));
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
 *
 * The identity is computed UNGROUPED and grouped once at the end (SPEC.1 §10.8,
 * 1.0.29) — without that terminal `groupInteger` the §23 tile row would render
 * `Đ 14,260` / `Đ 3,225` / `Đ -1234` side by side, Wallet and Positions grouped
 * and Net P/L not.
 */
export function displayNetProfitLoss(
	walletValue: string,
	positionsValue: string,
	netProfitLoss: string,
): string {
	const displayed = netProfitLossDisplayed(
		walletValue,
		positionsValue,
		netProfitLoss,
	);
	if (displayed === null) {
		return formatDharma(netProfitLoss);
	}
	return groupInteger(displayed.isZero() ? "0" : displayed.toFixed(0));
}

/**
 * The §23 Net P/L identity in DISPLAYED space, as a DECIMAL — the shared core of
 * the two exported Net P/L formatters above and below, so the identity is
 * computed in exactly one place and the plain and signed renders can never
 * disagree about the figure. `null` ⇒ a malformed / non-finite operand; each
 * caller supplies its own degrade.
 */
function netProfitLossDisplayed(
	walletValue: string,
	positionsValue: string,
	netProfitLoss: string,
): Decimal | null {
	try {
		const wallet = new DisplayDecimal(walletValue);
		const positions = new DisplayDecimal(positionsValue);
		const netPL = new DisplayDecimal(netProfitLoss);
		if (!wallet.isFinite() || !positions.isFinite() || !netPL.isFinite()) {
			return null;
		}
		const issuance = wallet.plus(positions).minus(netPL);
		return wallet
			.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
			.plus(positions.toDecimalPlaces(0, Decimal.ROUND_HALF_UP))
			.minus(issuance)
			.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
	} catch {
		return null;
	}
}

/**
 * The SIGNED §23 Net P/L display — the SAME displayed-space figure as
 * `displayNetProfitLoss`, returned SPLIT into its sign and its unsigned
 * magnitude so a tile can render `<sign>Đ <magnitude>`: `+Đ 238` / `−Đ 30`
 * (canon §2's Net P/L tile; the mockup's own `pl()` emits the same two prefixes
 * at `surface_profile_v1_0.html:672`). Sign FIRST, then the glyph, then the
 * number — which is why this returns two parts instead of one string: the Đ
 * glyph stays in the view layer beside every other Đ on the surface, and this
 * module keeps emitting numbers only.
 *
 * ⛔ THE SIGN IS DERIVED FROM THE NUMERIC INPUTS, NEVER FROM THE OUTPUT STRING.
 * SPEC.1 §10.8: "Rounded values are terminal: a displayed figure is a string,
 * and is never read back into arithmetic, comparison, validation, clamping, or
 * CONDITIONAL RENDERING." So the branch is `Decimal.isNegative()` on the
 * displayed-space figure, taken BEFORE grouping — not `startsWith("-")` on what
 * `displayNetProfitLoss` printed.
 *
 * ⚠ ZERO CARRIES NO SIGN, and that is the same rule the plain variant already
 * holds: `isZero()` covers +0 and −0, so the tile reads `Đ 0`, never `+Đ 0` or
 * `−Đ 0`. The MINUS is U+2212 (`e2 88 92`), not the ASCII hyphen `groupInteger`
 * would have emitted — byte-carried from the mockup's `pl()`, which is also the
 * form the founder's mark writes.
 *
 * Degrades exactly as the plain variant does — `formatDharma(netProfitLoss)`,
 * unsigned — so a malformed value is not dressed in a sign it cannot support.
 */
/**
 * The PER-POSITION profit/loss, signed and split — `current − staked` for ONE
 * holding, for the positions table's Current cell: `(+Đ70)` / `(−Đ12)` beside
 * the figure it qualifies. The mockup's own `plShort()`
 * (`surface_profile_v1_0.html:674-678`) computes exactly this, and its
 * `.pnum .pl` span (`:300`) is where it lands.
 *
 * ⛔ COMPUTED IN DISPLAYED SPACE, AND THAT IS THE WHOLE REASON THIS EXISTS
 * RATHER THAN A SUBTRACTION AT THE CALL SITE. The row prints rounded `staked`
 * and rounded `current`; if the delta were taken in exact space it would
 * disagree with them on screen — `Đ 499 → Đ 448 (−Đ50)` where the eye can only
 * ever compute 51. So both operands are rounded to what is rendered FIRST and
 * subtracted after, which keeps `current − staked = delta` true for the three
 * figures actually on the page. Same discipline SPEC.1 §10.8 imposes on the §23
 * tile identity, and the same one `netProfitLossDisplayed` above follows.
 * ⛔ THE SIGN COMES FROM THE NUMERIC VALUE, NEVER FROM A PRINTED STRING —
 * §10.8: a displayed figure "is never read back into arithmetic, comparison,
 * validation, clamping, or CONDITIONAL RENDERING". So the branch is
 * `Decimal.isNegative()` on the displayed-space difference.
 *
 * ⚠ ZERO CARRIES NO SIGN — `isZero()` covers +0 and −0, so an unmoved position
 * reads `(Đ0)`, never `(+Đ0)`. The MINUS is U+2212 (`e2 88 92`), byte-carried
 * from the mockup's `plShort()`, never the ASCII hyphen `groupInteger` emits.
 * ⚠ THE CALLER SUPPLIES THE GLYPH AND THEREFORE THE SPACING — this returns the
 * parts and states neither, which is the one thing about this contract that has
 * not changed. What DID change is what the caller does with them: this docblock
 * used to record the mockup's two densities (`plShort` `+Đ70` at `:677` against
 * the Net P/L tile's `+Đ 238` at `:672`) as a deliberate split to be preserved.
 * POSREV-1 RF-4 ruled the profile's positions surface onto ONE density — a space
 * after every Đ — because the delta sits INSIDE the cell whose own figure is
 * spaced, so the split put the same glyph on two densities two characters apart.
 * The mockup's own reading is not overturned in general; a caller that wants the
 * tight form can still write it, because the parts arrive separate.
 *
 * Degrades to an EMPTY magnitude on a malformed operand rather than dressing a
 * bad value in a sign: the caller renders nothing at all in that case, which is
 * the honest render for "this delta could not be computed".
 */
export function displayPositionProfitLossSigned(
	staked: string,
	current: string,
): { sign: string; magnitude: string } {
	try {
		const st = new DisplayDecimal(staked);
		const cur = new DisplayDecimal(current);
		if (!st.isFinite() || !cur.isFinite()) {
			return { sign: "", magnitude: "" };
		}
		const delta = cur
			.toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
			.minus(st.toDecimalPlaces(0, Decimal.ROUND_HALF_UP));
		if (delta.isZero()) {
			return { sign: "", magnitude: "0" };
		}
		return {
			sign: delta.isNegative() ? "−" : "+",
			magnitude: groupInteger(delta.abs().toFixed(0)),
		};
	} catch {
		return { sign: "", magnitude: "" };
	}
}

export function displayNetProfitLossSigned(
	walletValue: string,
	positionsValue: string,
	netProfitLoss: string,
): { sign: string; magnitude: string } {
	const displayed = netProfitLossDisplayed(
		walletValue,
		positionsValue,
		netProfitLoss,
	);
	if (displayed === null) {
		return { sign: "", magnitude: formatDharma(netProfitLoss) };
	}
	if (displayed.isZero()) {
		return { sign: "", magnitude: "0" };
	}
	return {
		sign: displayed.isNegative() ? "−" : "+",
		magnitude: groupInteger(displayed.abs().toFixed(0)),
	};
}

/**
 * A spot price (a probability in [0,1] as a decimal string) as a whole percent
 * integer, 0..100, ROUND_HALF_UP on the third fractional digit. Pure integer
 * digit-extraction — never multiplies the price as a float (CLAUDE.md §2); the
 * canonical price is computed server-side by `getPrices`.
 *
 * The shared core of BOTH percent formatters below, so the paired rule and its
 * single-side escape hatch can never drift apart. The `Math.min` clamp is
 * unreachable on a valid price (reserves are `requirePositive`, so a price
 * cannot exceed 1) and is retained only as a defensive belt.
 */
function wholePercent(price: string): number {
	const [intPart = "0", fracPart = ""] = price.split(".");
	const intPct = intPart === "1" || Number(intPart) >= 1 ? 100 : 0;
	const firstTwo = `${fracPart}00`.slice(0, 2);
	const third = `${fracPart}000`.charAt(2);
	let pct = intPct + Number(firstTwo);
	if (Number(third) >= 5) {
		pct += 1;
	}
	return Math.min(pct, 100);
}

/**
 * Render ONE SIDE of a market's price pair as a whole percent — the single
 * formatter for every price-percent surface (PCT.ROUND / SPEC.1 §10.8).
 *
 * **YES is canonical; NO is DERIVED as `100 − YES`** and is never rounded
 * independently. Independent per-side ROUND_HALF_UP renders **101%** at any
 * exact `.xx5` tie: the two prices are complements, so their fractional
 * remainders are `r` and `1 − r`, which disagree only at `.xx5` — where half-up
 * rounds BOTH sides up at once. The pair can overshoot but never undershoot, so
 * the defect is one-sided and invisible to any test whose fixtures avoid ties.
 *
 * Deriving is also the only rule robust to the engine's actual guarantee, which
 * pins `|p_yes + p_no − 1| ≤ 1 ulp` rather than exact equality — charter line 5,
 * asserted at `tests/unit/cpmm/invariants.property.test.ts` ("prices sum to 1").
 * This function NEVER READS `pricing.no`, so engine slack cannot reach a render.
 * The asymmetry — NO absorbs the rounding error — is deliberate.
 *
 * It takes the whole `pricing` object rather than one price string so the rule
 * is enforced STRUCTURALLY: it is impossible to render a NO percent without the
 * YES price in hand. e.g. `{yes:"0.525…", no:"0.475…"}` → `"53%"` / `"47%"`.
 */
export function formatPricePercent(
	pricing: { yes: string; no: string },
	side: Side,
): string {
	const yes = wholePercent(pricing.yes);
	return `${side === "YES" ? yes : 100 - yes}%`;
}

/**
 * The single-side escape hatch — a whole percent for a surface that legitimately
 * renders ONE side alone, never one half of a pair (SPEC.1 §10.8). The only
 * sanctioned callers are the price chart's OPENING and CURRENT YES readouts,
 * which are two points in TIME rather than a pair.
 *
 * Deliberately awkward name: DROUND tried an import alias for this role and
 * REVERSED it at the gate, because a reader saw one name silently resolving to
 * another. A call site must announce that it is unpaired. Every call is
 * allowlisted by a `pctround-allow:` marker and the count is pinned by
 * `tests/unit/design/pct-round-render.test.ts` — using this to render a
 * market's two sides is exactly the bug the paired formatter exists to prevent.
 */
export function formatPercentUnpaired(price: string): string {
	return `${wholePercent(price)}%`;
}
