# Staging markets — snapshot

> **Why this file exists.** The eight markets below were authored by hand and
> exist NOWHERE but the staging database. Everything else in the LOTS-1 lane is
> reversible; losing these is not. `pnpm staging:reset` truncates `markets`, so a
> rebuild without this file destroys the copy that took the longest to make and
> the shortest to lose. This is the artifact that makes a future rebuild
> survivable — it is a RECORD, not a seeder, and nothing reads it at runtime.

**Captured:** `2026-08-31T15:00:57.549Z` (read-only) · **Source:** `aws-1-ap-south-1.pooler.supabase.com` / `postgres`
**Machine-fidelity copy:** [`staging-markets-snapshot.json`](./staging-markets-snapshot.json) — every column, verbatim.

| rows | count |
|---|---|
| `markets` | **8** |
| `pools` | **8** |
| `market_media` | **16** |

⚠ **The reserves are NOT all `10000` any more.** The LOTS-1 S6 record reads
`10000.000000000000000000` across all eight because that was the seeded state the
moment after the wipe. Pools may have since moved under real bets. The seeded
value is the number to restore; the CURRENT value is the number below, and the
two are recorded separately so a restore is never mistaken for a rollback.

**Seeded reserves (the restore target):** `yes_reserves = no_reserves = 10000.000000000000000000` for all eight.

---

## 1. `mumbai-bmc-pink-october-disclosure`

**Mumbai · Will BMC report 10,000 Pink October breast cancer tests?**

| field | value |
|---|---|
| `id` | `01a01181-bb3c-7443-bc4d-35938c65bde9` |
| `slug` | `mumbai-bmc-pink-october-disclosure` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:10.942Z` |
| `pools.yes_reserves` (current) | `10400.000000000000000003` |
| `pools.no_reserves` (current) | `9615.384615384615384619` |
| `pools.id` | `01a01181-e624-7891-a15b-6b17cfb3b9be` |

**Resolution text (`markets.description`), verbatim:**

```text
Will BMC publicly disclose on X by 5 November 2026 that at least 10,000 women were screened for breast cancer in BMC public health facilities in Mumbai during Pink October 2026 (1–31 October)? Resolves YES if @mybmc posts, within the observation window, a figure of 10,000 or more women screened for breast cancer at BMC public health facilities in Mumbai during 1–31 October 2026. Resolves NO in every other case — including if BMC posts nothing, posts a lower figure, posts only from another handle, or discloses the number anywhere other than X.

Resolution type. Resolves on a numeric disclosure published by BMC on X, not on screening volume. If BMC screens the women but posts no figure, this resolves NO. Silence resolves NO, never Void.

Source. Only posts from @mybmc can resolve this market. A qualifying post must, within the window, state a figure of 10,000 or more women screened for breast cancer at BMC public health facilities in Greater Mumbai during 1-31 October 2026. BMC must assert the figure itself; a relayed or inferred figure does not qualify, and a repost without comment does not qualify. The figure may appear in text or in a legible image. No other account qualifies, including BMC's own health handles @mybmchealth and @mybmcHealthDept, other BMC accounts on X, BMC accounts on other platforms, and state or national accounts. Nor does any disclosure off X: press releases, portal.mcgm.gov.in, media, RTI.

Numeric. A specific integer (12,348), a range bounded at or above 10,000 (12,000-15,000), or a comparative bounded at or above 10,000 (more than 10,000 qualifies, more than 8,000 does not). Not numeric: thousands, record numbers, targets met.

Scope. A figure combining breast with cervical, women with men, BMC with non-BMC facilities, or October with a longer period qualifies only if the qualifying component is separately stated by @mybmc within the window. Targets and projections do not qualify; the figure must report completed screening. A third-party dispute over BMC's methodology does not change the outcome.

Deadline. 5 November 2026, 23:45 UTC (05:15 IST, 6 November). The window opens 1 October 2026, 00:00 IST (30 September, 18:30 UTC). UTC is the binding clock. Only posts timestamped at or before the deadline count, whenever the operator resolves. No extensions.

Trigger. Latching. The first qualifying post at or above 10,000 resolves YES irreversibly. Where qualifying posts conflict, the highest figure binds.

Deletion. If a qualifying post is deleted or the handle suspended before the deadline, an independent archive capture timestamped within the window is admissible; a screenshot is not. Without one, this resolves NO.

Void. None. Silence resolves NO and the source can only fail closed.

Evidence. The operator publishes the source URL, post timestamp, the figure verbatim, an archive capture, and the clause satisfied.

Operator intervention. None. The Foundation takes no action directed at the resolver of this market.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-bb3c-7443-bc4d-35938c65bde9/01a01181-bb3c-7443-bc4d-3ac9c9c837d7.png` | `01a01181-c018-7b35-b469-cc609d33045b` |
| 1 | no | `m/01a01181-bb3c-7443-bc4d-35938c65bde9/01a02370-fead-73de-87ae-ac7c023511f8.webp` | `01a02370-ff6d-7be5-9060-c64be711012b` |

---

## 2. `oktoberfest-munich-beer-volume`

**Oktoberfest · Will the 7.5M litre beer record be broken in 2026?**

| field | value |
|---|---|
| `id` | `01a01181-c07c-765a-9664-c065540c173d` |
| `slug` | `oktoberfest-munich-beer-volume` |
| `status` | `Open` |
| `resolution_deadline` | `2026-10-04T21:59:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:12.152Z` |
| `pools.yes_reserves` (current) | `10010.000000000000000000` |
| `pools.no_reserves` (current) | `9990.009990009990009991` |
| `pools.id` | `01a01181-e755-74f0-bafa-983e44792a10` |

**Resolution text (`markets.description`), verbatim:**

```text
Will oktoberfest.de's preliminary final report for Oktoberfest 2026 state a total beer figure above 7.5 million litres for the official 16-day festival, 19 September to 4 October 2026? Resolves YES if that report states a figure above 7.5 million litres, observed within the window below. At the 0.1 million granularity the report uses, the lowest qualifying figure is 7.6 million litres. Resolves NO in every other case — including 7.5 million or lower, a non-numeric statement, a partial-festival figure, or no qualifying report.

Resolution type. Resolves on the beer figure printed in one named annual report, not on how much beer is drunk. That report publishes every year without fail, so the uncertainty is the number, not the publication. Silence resolves NO, never Void.

Source. Only the preliminary final report for Oktoberfest 2026, published by the Landeshauptstadt München (City of Munich) on oktoberfest.de in the Oktoberfest News section of that site's magazine index, can resolve this market. Either the German or the English edition qualifies, and whichever publishes a qualifying figure first binds. No other source qualifies, including the @oktoberfest Instagram account, the official Oktoberfest Facebook page, any X account, the City of Munich's own press releases and PDFs on muenchen.de and stadt.muenchen.de including its English Preliminary Final Report, any report by Süddeutsche Zeitung, BR, Münchner Merkur, Bild, Reuters, AP, dpa or any other outlet, the mid-term report (Halbzeitbilanz) published around the festival's midpoint, and the Stadtrat Schlussbericht published in 2027.

Numeric. A number above 7.5 million litres qualifies: 7.6 million does, 7.5 million does not. A range qualifies only on its stated lower bound: between 7.6 and 8.0 million litres qualifies, between 7.4 and 7.9 million litres does not. A comparative qualifies only if its bound is above 7.5 million litres: more than 7.5 million litres qualifies, more than 7 million litres does not. Non-numeric statements never qualify: record-breaking, more than last year, millions of litres.

Units. The record is 7.5 million litres = 7.5 million Maß = 75,000 hectolitres. Liters and litres are the same unit. A German decimal comma reads as a decimal point, so 7,6 Mio. Liter means 7.6 million litres.

Scope. The figure must cover the full official 16 days, 19 September to 4 October 2026. A figure scoped to one tent, one brewery, or the Oide Wiesn alone does not qualify. Where a breakdown is published alongside a festival-wide total, the festival-wide total binds. A dispute over how the figure was estimated does not change the outcome; the published figure stands.

Window. The observation window opens at the close of the festival on 4 October 2026 and ends 5 November 2026 at 23:45 UTC. UTC is the binding clock. Only a publication observed at or before that instant counts, whenever the operator resolves.

Trigger. Latching. The first qualifying figure above 7.5 million litres resolves YES irreversibly. A report stating a figure at or below the threshold does not close this market, and a later qualifying figure inside the window still resolves YES. Where two figures published inside the window conflict, the highest binds.

Void. None. If Oktoberfest 2026 is cancelled, curtailed or closed for any period, this market resolves on whatever qualifying figure is published, and if none is published it resolves NO.

Betting and settlement. Betting closes on 4 October 2026 at 23:59 Munich time, when the festival ends — before the figure is published, so nobody trades on the answer. The market settles on 5 November 2026 together with every other Zugzwang market.

Evidence. The operator publishes the source URL, the publication date observed, the figure verbatim, an independent archive capture, and the clause satisfied.

Operator intervention. None. The Foundation takes no action directed at the resolver of this market.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-c07c-765a-9664-c065540c173d/01a01181-c07c-765a-9664-c51443d18741.png` | `01a01181-c4f5-7db7-a789-2a737b3c80d8` |
| 1 | no | `m/01a01181-c07c-765a-9664-c065540c173d/01a02370-fead-73de-87ae-aa1b2628b887.webp` | `01a02370-ff61-70c3-a2b7-1406b9896158` |

---

## 3. `chess-fide-tiebreak-response`

**Chess · Will FIDE answer Zugzwang's tiebreak proposal?**

| field | value |
|---|---|
| `id` | `01a01181-c54b-71b9-a77f-d6e11d373a69` |
| `slug` | `chess-fide-tiebreak-response` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:13.427Z` |
| `pools.yes_reserves` (current) | `9781.108346915877093135` |
| `pools.no_reserves` (current) | `10223.790234521982946587` |
| `pools.id` | `01a01181-e8a4-7dfa-b90f-0e92e9235e61` |

**Resolution text (`markets.description`), verbatim:**

```text
Will FIDE respond publicly on X by 5 November 2026 to Zugzwang's published proposal to abolish rapid and blitz tiebreaks from the World Chess Championship match? Resolves YES if @FIDE_chess publishes a post on X, within the observation window, that names Zugzwang or links, quotes or reproduces any post in the Zugzwang thread. A reply, a repost, a quote-post and a standalone post all qualify. Resolves NO in every other case — including if FIDE posts nothing, responds only from another account, responds anywhere other than X, or writes about tiebreaks without referring to Zugzwang.

Resolution type. Resolves on whether FIDE publicly acknowledges the proposal, not on whether it agrees and not on whether the rule changes. A refusal, a dismissal, or a statement that it will not be considered all resolve YES. Silence resolves NO, never Void.

The stimulus. A thread of ten consecutive Zugzwang posts, one card each. Engagement with any of the ten qualifies. The root post is the anchor: its permalink is published here and its timestamp opens the window. The thread is committed in full in the public campaign spec before open; it will not be revised, extended or reordered, and no post will be removed by the Foundation.

Source. Only posts from @FIDE_chess on X can resolve this market. No other account qualifies, including @FideWomen, @FideOnlineArena, the unrelated @FideChess, every FIDE official in any capacity including the President, Interim President and CEO, and FIDE on Instagram, Facebook, TikTok, YouTube, LinkedIn and Twitch. Nor the European Chess Union, World Chess, or any national federation. Nor any surface off X: fide.com news, Council decisions, General Assembly minutes, handbook.fide.com, rcc.fide.com, press conferences, broadcasts, interviews and media reports.

Regulations. Publication of the 2026 Match Regulations, or any FIDE Handbook amendment, does not resolve this market — whatever it says and wherever it appears. Only a post referring to Zugzwang resolves it.

Naming. A qualifying post must contain the word Zugzwang, or link to, quote-post or reproduce a post in the thread. There is no test of substance and no test of which post was engaged. A repost without comment does not qualify; a quote-post carrying @FIDE_chess's own text does. Any language qualifies. One qualifying post resolves this market and the first binds.

Window. Opens at the root post's timestamp, ends 5 November 2026 at 23:45 UTC. UTC is the binding clock. Only posts timestamped at or before that instant count, whenever the operator resolves. No extensions.

Trigger. Latching. The first qualifying post resolves YES irreversibly. If FIDE later deletes it, this market stays YES.

Deletion. If a qualifying post is deleted or @FIDE_chess suspended, an independent archive capture timestamped within the window is admissible; a screenshot is not. If the root post is removed, by anyone for any reason, this resolves NO. If other posts are removed, the market stands.

Void. None. Silence resolves NO, and removal of the root post resolves NO rather than voiding.

Evidence. The operator publishes the source URL, the post timestamp, the text verbatim, an independent archive capture, and the clause satisfied.

Operator intervention. Declared. The Zugzwang Foundation published the ten-post thread this market resolves on. Beyond it the Foundation takes no action directed at FIDE, its officials, the Council or any federation: no further posts, no eleventh post, no direct contact, no intermediaries. No post will be removed. An archive capture covering all ten was taken at publication.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a01181-c54b-71b9-a77f-d922fe9fa1ec.png` | `01a01181-c9f0-7e99-90f2-a3ad88d9d9c1` |
| 1 | no | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a02370-fead-73de-87ae-9a4dd08b48db.webp` | `01a02370-ff2a-704d-8b66-c2f82dfab2b3` |

---

## 4. `bitcoin-price-50k`

**Bitcoin · Will BTC ever go below $60,000 by 5th November?**

| field | value |
|---|---|
| `id` | `01a01181-ca40-725f-895c-270b2190c3ee` |
| `slug` | `bitcoin-price-50k` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:14.902Z` |
| `pools.yes_reserves` (current) | `9990.009990009990009991` |
| `pools.no_reserves` (current) | `10010.000000000000000000` |
| `pools.id` | `01a01181-ea2a-79be-a601-ebf85610a1ef` |

**Resolution text (`markets.description`), verbatim:**

```text
Will Bitcoin trade below USD 60,000 at any point between 15th September 2026 and 5th November 2026, as measured by the published daily low of Bitcoin (BTC) on CoinMarketCap?

Resolves YES if the daily low published by CoinMarketCap for Bitcoin (BTC) is below USD 60,000 on any date from 15 September to 5 November 2026 inclusive. Resolves NO in every other case — including if Bitcoin trades below USD 60,000 only on a single exchange, only in a futures, perpetual, options or oracle price, only on another index, or only outside the window.

SOURCE. Exhaustive source set: CoinMarketCap only — its published historical daily record for Bitcoin (BTC), the Low field. No other publisher, index, aggregator or venue resolves this market.

Excluded by name — CoinGecko, CoinDesk (XBX), the CME CF Bitcoin Reference Rate and Real-Time Index, Kaiko, Bloomberg Galaxy and S&P Bitcoin indices; Binance, Coinbase, Kraken, Bitstamp, Gemini, itBit, LMAX Digital, OKX, Bybit and every other individual exchange. Excluded by surface — any wick or print on a single order book, perpetual-swap prices, futures prices, options-implied and oracle feeds, wrapped, synthetic or tokenised BTC, and CoinMarketCap's own live ticker where it differs from the published daily low.

CRITERION. "Below USD 60,000" means strictly less than USD 60,000.00, read to two decimal places. A published low of exactly USD 60,000.00 does not qualify. "Daily low" means the Low field of CoinMarketCap's published daily record for a UTC calendar date. The window is the 52 UTC calendar dates from 15 September 2026 to 5 November 2026 inclusive.

DEADLINE. Trading closes and settlement occurs at 2026-11-05T23:45:00Z. The window opens at 2026-09-15T00:00:00Z. UTC is the binding clock throughout.

TRIGGER. Latching. The first published daily low below USD 60,000 resolves this market YES irreversibly. A later recovery above USD 60,000 does not un-trigger it, and no subsequent observation changes the outcome. On multiple qualifying dates, the earliest binds.

EDGE CASES. (a) UTC is binding; dates are UTC calendar dates. (b) A published low of exactly USD 60,000.00 resolves NO. (c) The 5 November daily low is binding as published; the final fifteen minutes of that date fall after the settlement instant, and this over-inclusion is accepted in advance. (d) A price below USD 60,000 on any single exchange, in any derivative, or on any other index does not qualify, however widely reported. (e) If CoinMarketCap changes its methodology mid-window, the values it publishes under the changed methodology bind. (f) If a published value is later revised, the value published at the time of resolution binds. (g) A temporary outage is not a void condition; resolution proceeds from the series once available. (h) Only observations dated at or before the deadline count, regardless of when the operator resolves, subject to (c).

VOID. This market voids only if CoinMarketCap permanently ceases publishing Bitcoin historical daily data before resolution and no archive of the window is retrievable. Ambiguity, a temporary outage, a methodology change, a data revision, an unwelcome outcome, low participation, and Bitcoin approaching but not crossing the level are not void conditions.

EVIDENCE. At resolution the operator records and publishes the source URL, the full daily-low series for all 52 dates in the window, the qualifying date and value if any, an independent archive capture taken at resolution time, and the criterion clause satisfied.

DISCLOSURE. No operator intervention. The Foundation takes no action directed at CoinMarketCap or at any venue constituent to its Bitcoin price, and has no relationship with any of them. Neither the Zugzwang Foundation nor the operator holds Bitcoin or any cryptocurrency position.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a01181-ca40-725f-895c-28376ec9d2fe.png` | `01a01181-cfd1-7caf-b282-8c5fd865f0b2` |
| 1 | no | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a02370-fead-73de-87ae-944e9e7b5515.webp` | `01a02370-ff1e-7082-8d34-9c5a467606f1` |

---

## 5. `math-erdos-contribution-response`

**Math · Will 3 Erdős problems be solved by 5th November?**

| field | value |
|---|---|
| `id` | `01a01181-d035-714a-b735-5d282576d0a3` |
| `slug` | `math-erdos-contribution-response` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:16.212Z` |
| `pools.yes_reserves` (current) | `10060.000000000000000002` |
| `pools.no_reserves` (current) | `9940.357852882703777339` |
| `pools.id` | `01a01181-eb6a-74a6-8e72-b3355e8362ad` |

**Resolution text (`markets.description`), verbatim:**

```text
Will Thomas Bloom, owner and maintainer of erdosproblems.com, publicly confirm on X that at least three distinct Erdős problems, open on 15 September 2026, have been solved, proved or disproved by 5 November 2026?

Resolves YES if posts published by @thomasfbloom on X, within the observation window, state of at least three distinct numbered Erdős problems that the problem is solved, proved or disproved. Each problem counts once. A problem must have been listed as open on erdosproblems.com at market open to count. Resolves NO in every other case - including fewer than three, posts reporting partial progress or reporting someone's claim without stating the problem is solved, and silence. A status change on erdosproblems.com itself does not resolve this market, and neither does a comment on its forum. Only a post by @thomasfbloom on X does.

Criterion. A qualifying post must identify an Erdős problem by its number and state that it is solved, proved or disproved. Both elements must appear in a post authored by @thomasfbloom. There is no test of importance, difficulty or significance.

Not qualifying. Partial progress, an improved bound, a promising approach. Reporting someone's claim without stating the problem is solved. A Lean formalisation with no statement of resolution. Commentary naming no numbered problem. A post about Zugzwang or this market resolves nothing by itself; if it also meets this criterion, it qualifies - content is read, never motive.

Distinct. Three posts about one problem count once. Three problems in one post count three. A thread counts as its component posts.

Open. A problem counts only if erdosproblems.com listed it as open at market open, established by an archive capture at open. Roughly twenty problems will change status on the site in this window; that alone resolves nothing.

Source. @thomasfbloom on X only. Excluded: the erdosproblems.com forum and every comment on it including his own, the site's proof-claim mechanism, the homepage and its OPEN to SOLVED log, problem pages and status badges, the blog, tags, prizes and lists, and thomasbloom.org. Excluded: his arXiv postings, Terence Tao's blog, the teorth/erdosproblems and formal-conjectures repositories, Quanta, and all media. Excluded: every other account on every platform. Excluded: email, direct message, talks, podcasts and interviews. A laboratory announcing a result does not resolve this market; only Bloom posting about it does.

Deadline. 5 November 2026, 23:45 UTC. The window opens at market open on 15 September 2026. UTC is the binding clock. Only posts timestamped at or before the deadline count, whenever the operator resolves. No extensions.

Trigger. Latching. The third distinct qualifying confirmation resolves YES irreversibly. Later deletion does not un-resolve it, and neither does a subsequent reversal by him.

Near miss. Fewer than three resolves NO. No partial credit.

Deletion. If a qualifying post is deleted or the account suspended, an independent archive capture timestamped within the window is admissible; a screenshot is not. Without one, it does not count.

Void. None. Silence resolves NO.

Evidence. For each of the three confirmations the operator publishes the source URL, post timestamp, the text verbatim, an archive capture, and the clause satisfied, plus the market-open capture establishing each problem was open.

Operator intervention. Declared. The Zugzwang Foundation published a ten-card deck announcing this market, on X, on <date> at <permalink>, archived at <archive URL>. Its text is committed in the public spec and will not be revised or removed. It asks the resolver for nothing. Beyond that one publication the Foundation takes no action directed at Thomas Bloom: no further posts or replies, no forum registration, no private contact, no intermediaries.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-d035-714a-b735-5d282576d0a3/01a01181-d035-714a-b735-61bf2fd26c5d.png` | `01a01181-d4ae-7674-9e88-e855992b0918` |
| 1 | no | `m/01a01181-d035-714a-b735-5d282576d0a3/01a02370-fead-73de-87ae-a78500f73a81.webp` | `01a02370-ff57-742e-8f10-177d6b556f53` |

---

## 6. `claude-bundle-response`

**Claude · Will Anthropic reply to Zugzwang's Bundle feature on X?**

| field | value |
|---|---|
| `id` | `01a01181-d508-7288-b996-36ec427a9d2f` |
| `slug` | `claude-bundle-response` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:17.432Z` |
| `pools.yes_reserves` (current) | `10089.809292614459396013` |
| `pools.no_reserves` (current) | `9910.990099009900990102` |
| `pools.id` | `01a01181-ecaa-7116-abe8-37a4d3d0e554` |

**Resolution text (`markets.description`), verbatim:**

```text
Will @AnthropicAI, @claudeai or @ClaudeDevs publicly reply to, repost, quote-post, or name the Zugzwang thread presenting the Bundle feature specification, between 15 September and 5 November 2026?

Resolves YES if a post published by one of those three accounts on X, within the observation window, is a reply to any post in the Zugzwang Bundle thread, or a repost of any post in it, or a quote-post of any post in it, or a standalone post that names Zugzwang or links to any post in it. What the post says is never read. Approval, rejection, dismissal, correction and a legal objection all resolve YES identically. Resolves NO in every other case - including likes, bookmarks, reposts without comment, posts from any other account including those of Anthropic staff, replies through private channels, Anthropic shipping a similar feature without posting, and silence.

Criterion. Reproducing a post in the thread as an image also qualifies. There is no test of substance, sentiment or seriousness.

The thread. Ten consecutive posts by the Zugzwang account, one deck card each, published at market open. The root post is the anchor and its permalink is <root permalink>. Engagement with any of the ten qualifies.

Not qualifying. A like or bookmark - X has shown likes only to their author since 12 June 2024, so a like is not observable by a stranger applying this criterion. A repost without comment. A post by any Anthropic employee, officer, contractor, adviser or investor, in personal or official capacity. Any other Anthropic account or surface, including anthropic.com, claude.com, the changelog, docs, support, status, and the GitHub organisations. Anthropic on any other platform. Claude itself - a conversation, artifact or API output discussing Zugzwang resolves nothing. Email, direct message, private legal notice, talks, podcasts and interviews.

Shipping. If Anthropic ships automatic chat grouping during the window, under any name, that alone resolves NO. Only a post from one of the three accounts resolves this market.

Deadline. 5 November 2026, 23:45 UTC. The window opens at market open on 15 September 2026. UTC is the binding clock. Only posts timestamped at or before the deadline count, whenever the operator resolves. No extensions.

Trigger. Latching. The first qualifying post resolves YES irreversibly. Later deletion, retraction or contradiction does not un-resolve it. Where two qualify, the earlier by UTC timestamp binds.

Deletion. If a qualifying post is deleted or an account suspended, an independent archive capture timestamped within the window is admissible; a screenshot is not. Without one, it does not count.

Void. None. Silence resolves NO.

Evidence. The operator publishes the source URL, the publishing account, the post timestamp local and UTC, the text verbatim, an independent archive capture, and which limb of the criterion is satisfied. On a NO, the operator publishes archive captures of all three timelines covering the window.

Operator intervention. Declared. The Zugzwang Foundation authored the entire stimulus for this market: a ten-card deck published as a thread on X on <date> at <root permalink>, archived at <archive URL>; a 21-page feature specification, Bundle, document ZW-FS-001 v1.0, published at <website URL>; and an operational prototype at the same address. The deck text is committed in the public spec and will not be revised or removed. It asks Anthropic for nothing and both polarities of reply count equally. Beyond that one publication the Foundation takes no action directed at Anthropic or its people: no further posts, no replies, no tagging employees, no private contact, no intermediaries, no press outreach, and no legal or regulatory filing.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-d508-7288-b996-36ec427a9d2f/01a01181-d508-7288-b996-38044d147135.png` | `01a01181-d9d6-73a0-8f21-aee38ff1a161` |
| 1 | no | `m/01a01181-d508-7288-b996-36ec427a9d2f/01a02370-fead-73de-87ae-9fdbf8e7fa25.webp` | `01a02370-ff34-7689-ba7f-641de743b11a` |

---

## 7. `yc-paper-club-response`

**YCombinator · Will YC reply to Zugzwang's paper by 5 Nov 2026?**

| field | value |
|---|---|
| `id` | `01a01181-da63-738b-a3ea-8da89299bc53` |
| `slug` | `yc-paper-club-response` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:18.757Z` |
| `pools.yes_reserves` (current) | `10391.847662188968043673` |
| `pools.no_reserves` (current) | `9622.927822917654136330` |
| `pools.id` | `01a01181-ee0d-771d-bbc1-3d08b7bf753e` |

**Resolution text (`markets.description`), verbatim:**

```text
Will @ycombinator reply to or quote-post any post in the Zugzwang thread submitting its research paper to YC Paper Club, on X, between 15 September and 5 November 2026?

Resolves YES if a post by @ycombinator is a reply to any post in the Zugzwang Paper Club thread, or a quote-post of one. What the post says is never read: approval, rejection and dismissal all resolve YES identically.

Resolves NO in every other case, and this market is deliberately narrow. A standalone post naming Zugzwang resolves NO. A Paper Club recap or announcement naming Zugzwang resolves NO. The paper being selected, scheduled or presented resolves NO absent a qualifying post — the outcome the submission wants is not the criterion. So do likes, any other account, and silence.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-da63-738b-a3ea-8da89299bc53/01a01181-da63-738b-a3ea-9270f9f87ba9.png` | `01a01181-decc-7171-a75d-026fdcbdd589` |
| 1 | no | `m/01a01181-da63-738b-a3ea-8da89299bc53/01a02370-fead-73de-87ae-b35295fac49b.webp` | `01a02370-ff7e-7b86-bd37-db54a1f5361b` |

---

## 8. `github-zugzwang-repo-stars`

**GitHub · Will the Zugzwang repo reach 100,000 stars?**

| field | value |
|---|---|
| `id` | `01a01181-df3a-747f-b154-e79a4a416b51` |
| `slug` | `github-zugzwang-repo-stars` |
| `status` | `Open` |
| `resolution_deadline` | `2026-11-05T23:45:00.000Z` |
| `resolved_at` | `NULL` |
| `resolution_outcome` | `NULL` |
| `media_video_url` | `NULL` |
| `created_by` | `admin-singleton` |
| `created_at` | `2026-08-17T20:55:20.397Z` |
| `pools.yes_reserves` (current) | `10663.103455656465157032` |
| `pools.no_reserves` (current) | `9378.132774933635171730` |
| `pools.id` | `01a01181-ef57-7912-9040-8d9752270049` |

**Resolution text (`markets.description`), verbatim:**

```text
Will the Zugzwang repository reach 100,000 GitHub stars by 5 November 2026?

Declared: the Zugzwang Foundation owns this repository, is publicly campaigning for the YES outcome, and is also the sole resolver.

Resolves YES if the star count for zugzwang-foundation/experiment is observed at 100,000 or more at any point in the window, as published by GitHub on the repository page or its REST API, and preserved by an independent archive capture timestamped inside the window. A count that crosses and later falls back still resolves YES.

Resolves NO in every other case — no qualifying observation, stars on a fork or mirror, any other GitHub metric, third-party star trackers, or a reading with no independent capture. Anyone may produce an observation.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-df3a-747f-b154-e79a4a416b51/01a01181-df3a-747f-b154-eb03baee542f.png` | `01a01181-e515-7588-bf31-4105534f71d5` |
| 1 | no | `m/01a01181-df3a-747f-b154-e79a4a416b51/01a02370-fead-73de-87ae-a04ecdbc9359.webp` | `01a02370-ff4c-7adf-9129-28c1b401149f` |

---

