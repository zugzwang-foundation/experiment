# Bitcoin · Will BTC ever go below $60,000 by 5th November?

**MKT-BTC-01** · `/m/bitcoin-price-50k` · **v2.2** · 2026-09-08  
**Subject** Bitcoin below USD 60,000 · barrier · 15 September – 5 November 2026  
**Supersedes** `MKT-BTC-01_market-spec_v2_1.md (v2.1, 2026-09-08)`

---

## 1 · The question

Will Bitcoin trade below USD 60,000 at any point between 15th September 2026 and 5th November 2026, as measured by the published daily low of Bitcoin (BTC) on CoinMarketCap?

## 2 · How it resolves

Resolves YES if the daily low published by CoinMarketCap for Bitcoin (BTC) is below USD 60,000 on any date from 15 September to 5 November 2026 inclusive.

Resolves NO in every other case.

## 3 · The rules

SOURCE. Exhaustive source set: CoinMarketCap only — its published historical daily record for Bitcoin (BTC), the Low field.

CRITERION. "Below USD 60,000" means strictly less than USD 60,000.00, read to two decimal places. A published low of exactly USD 60,000.00 does not qualify. "Daily low" means the Low field of CoinMarketCap's published daily record for a UTC calendar date. The window is the 52 UTC calendar dates from 15 September 2026 to 5 November 2026 inclusive.

DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:45:00Z. The window opens at 2026-09-15T00:00:00Z. UTC is the binding clock throughout.

TRIGGER. Latching. The first published daily low below USD 60,000 resolves this market YES irreversibly. A later recovery above USD 60,000 does not un-trigger it, and no subsequent observation changes the outcome. On multiple qualifying dates, the earliest binds.

EDGE CASES. (a) UTC is binding; dates are UTC calendar dates. (b) A published low of exactly USD 60,000.00 resolves NO. (c) The 5 November daily low is binding as published; the final fifteen minutes of that date fall after the settlement instant, and this over-inclusion is accepted in advance.

VOID. This market voids only if CoinMarketCap permanently ceases publishing Bitcoin historical daily data before resolution and no archive of the window is retrievable. Ambiguity, a temporary outage, a methodology change, a data revision, an unwelcome outcome, low participation, and Bitcoin approaching but not crossing the level are not void conditions.

EVIDENCE. At resolution the operator records and publishes the source URL, the full daily-low series for all 52 dates in the window, the qualifying date and value if any, an independent archive capture taken at resolution time, and the criterion clause satisfied.

DISCLOSURE. No operator intervention. The Foundation takes no action directed at CoinMarketCap or at any venue constituent to its Bitcoin price, and has no relationship with any of them. Neither the Zugzwang Foundation nor the operator holds Bitcoin or any cryptocurrency position.

## 4 · The facts

| | |
|---|---|
| Opens | 15 September 2026 |
| Trading closes | `2026-11-05T23:45:00Z` |
| Settles | `2026-11-05T23:45:00Z` — with all other markets |
| Resolver | CoinMarketCap |
| Resolution | CoinMarketCap |
| Flavour | Sentiment |

Display block: **RESOLUTION** CoinMarketCap · **RESOLVER** CoinMarketCap → `https://coinmarketcap.com/currencies/bitcoin/historical-data/` · **CLOSES ON** 5 Nov 2026 / 23:45Z · **FLAVOUR** Sentiment

## 5 · Operator entry

**Slug**

```
bitcoin-price-50k
```

**Title** — 57 characters

```
Bitcoin · Will BTC ever go below $60,000 by 5th November?
```

**Deadline** — typed digits are read as UTC verbatim. No trailing `Z`.

```
2026-11-05T23:45
```
