# Oktoberfest · Will the 7.5M litre beer record be broken in 2026?

**MKT-OKT-01** · `/m/oktoberfest-munich-beer-volume` · **v2.2** · 2026-09-08  
**Subject** Oktoberfest 2026 total beer volume · Munich  
**Supersedes** `MKT-OKT-01_market-spec_v2_1.md (v2.1, 2026-09-08)`

---

## 1 · The question

Will oktoberfest.de's preliminary final report for Oktoberfest 2026 state a total beer figure above 7.5 million litres for the official 16-day festival, 19 September to 4 October 2026?

## 2 · How it resolves

Resolves YES if that report states a figure above 7.5 million litres, observed within the window below. At the 0.1 million granularity the report uses, the lowest qualifying figure is 7.6 million litres. Resolves NO in every other case — including 7.5 million or lower, a non-numeric statement, a partial-festival figure, or no qualifying report.

## 3 · The rules

Resolution type. Resolves on the beer figure printed in one named annual report, not on how much beer is drunk. That report publishes every year without fail, so the uncertainty is the number, not the publication.

Source. Only the preliminary final report for Oktoberfest 2026, published by the Landeshauptstadt München (City of Munich) on oktoberfest.de in the Oktoberfest News section of that site's magazine index, can resolve this market. Either the German or the English edition qualifies, and whichever publishes a qualifying figure first binds.

Numeric. A number above 7.5 million litres qualifies: 7.6 million does, 7.5 million does not. A range qualifies only on its stated lower bound: between 7.6 and 8.0 million litres qualifies, between 7.4 and 7.9 million litres does not. A comparative qualifies only if its bound is above 7.5 million litres: more than 7.5 million litres qualifies, more than 7 million litres does not. Non-numeric statements never qualify: record-breaking, more than last year, millions of litres.

Units. The record is 7.5 million litres = 7.5 million Maß = 75,000 hectolitres. Liters and litres are the same unit. A German decimal comma reads as a decimal point, so 7,6 Mio. Liter means 7.6 million litres.

Scope. The figure must cover the full official 16 days, 19 September to 4 October 2026. A figure scoped to one tent, one brewery, or the Oide Wiesn alone does not qualify. Where a breakdown is published alongside a festival-wide total, the festival-wide total binds. A dispute over how the figure was estimated does not change the outcome; the published figure stands.

Window. The observation window opens at the close of the festival on 4 October 2026 and ends 5 November 2026 at 23:45 UTC. UTC is the binding clock. Only a publication observed at or before that instant counts, whenever the operator resolves.

Trigger. Latching. The first qualifying figure above 7.5 million litres resolves YES irreversibly. A report stating a figure at or below the threshold does not close this market, and a later qualifying figure inside the window still resolves YES. Where two figures published inside the window conflict, the highest binds.

Evidence. The operator publishes the source URL, the publication date observed, the figure verbatim, an independent archive capture, and the clause satisfied.

Operator intervention. None. The Foundation takes no action directed at the resolver of this market.

## 4 · The facts

| | |
|---|---|
| Opens | 15 September 2026 |
| Trading closes | `2026-10-04T21:59:00Z` — 23:59 Munich, the festival's last day |
| Settles | `2026-11-05T23:45:00Z` — with all other markets |
| Resolver | Landeshauptstadt München (City of Munich), publishing as oktoberfest.de |
| Resolution | oktoberfest.de / report |
| Flavour | Consumption |

Display block: **RESOLUTION** oktoberfest.de / report · **RESOLVER** Oktoberfest / management → `https://www.oktoberfest.de/en` · **CLOSES ON** 4 Oct 2026 / 21:59Z · **FLAVOUR** Consumption

## 5 · Operator entry

**Slug**

```
oktoberfest-munich-beer-volume
```

**Title** — 64 characters

```
Oktoberfest · Will the 7.5M litre beer record be broken in 2026?
```

**Deadline** — typed digits are read as UTC verbatim. No trailing `Z`.

```
2026-10-04T21:59
```
