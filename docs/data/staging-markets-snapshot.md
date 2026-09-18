# Staging markets — snapshot

> **Why this file exists.** The markets below were authored by hand and
> exist NOWHERE but the staging database. Everything else in the LOTS-1 lane is
> reversible; losing these is not. `pnpm staging:reset` truncates `markets`, so a
> rebuild without this file destroys the copy that took the longest to make and
> the shortest to lose. This is the artifact that makes a future rebuild
> survivable.
>
> ⚠ **This `.md` is a RECORD and nothing reads it. Its JSON sibling is NOT** —
> `tests/staging/content-markets.ts:45` loads `staging-markets-snapshot.json` at
> runtime and hands its values to `createMarket` / `openMarket` unchanged. That
> became true at LIQ-1-RESTORE (2026-09-07), after this file first said otherwise.
> Edit the JSON and you have edited the seeder's source of truth.

**Captured:** `2026-09-18T09:59:09.212Z` (read-only) · **Source:** `aws-1-ap-south-1.pooler.supabase.com` / `postgres`
**Machine-fidelity copy:** [`staging-markets-snapshot.json`](./staging-markets-snapshot.json) — every column, verbatim.

| rows | count |
|---|---|
| `markets` | **6** |
| `pools` | **6** |
| `market_media` | **12** |

⚠ **MKT-ROSTER-1 (2026-09-18, D-49) removed two markets from the roster** —
`mumbai-bmc-pink-october-disclosure` and `oktoberfest-munich-beer-volume`. This
capture is the six that remain. The two removed markets' copy survives in
`docs/markets/MKT-MUM-01.md` and `docs/markets/MKT-OKT-01.md`, which the ruling
leaves untouched; nothing else anywhere retains them.

⚠ **The reserves below are CURRENT, not seeded.** Pools move under every bet, so a
restore must never read them. The seeded value is the number to restore, the
current value is the number below, and the two are recorded separately so a
restore is never mistaken for a rollback.

**Seeded reserves (the restore target), measured from each market's own**
**`market.opened` payload, 2026-09-18:** `openingPriceYes = 0.1`,
`yes_reserves = 90000.000000000000000000`, `no_reserves = 10000.000000000000000000`,
tank `100000` — identical on all six, and identical on production's six.
⇒ one `--price 0.1 --tank 100000` restores the whole slate.

⚠ **BLOCK-1 (2026-08-31) renamed YCP-01's (`yc-paper-club-response`) artifact
noun "paper" → "pitch" too broadly — BLOCK-2 (2026-08-31) repaired it to the
actual founder-ruled scope** (only "submitting its research paper to" →
"submitting its pitch to"; "The paper being selected…" restored to "paper").
The text below is CURRENT (post-repair).

---

## 1. `chess-fide-tiebreak-response`

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
| `created_at` | `2026-09-07T20:19:18.412Z` |
| `pools.yes_reserves` (current) | `374534.883294403978371636` |
| `pools.no_reserves` (current) | `42465.116705596021471870` |
| `pools.id` | `01a07d86-8db5-7b07-9a51-c12315a5e53c` |

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
| 0 | **yes** | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a01181-c54b-71b9-a77f-d922fe9fa1ec.png` | `01a07d86-734d-7623-9566-7afc86612059` |
| 1 | no | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a02370-fead-73de-87ae-9a4dd08b48db.webp` | `01a07d86-734d-7bd4-9118-e4d83c5c49ee` |

---

## 2. `bitcoin-price-50k`

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
| `created_at` | `2026-09-07T20:19:18.505Z` |
| `pools.yes_reserves` (current) | `374369.168257923831749677` |
| `pools.no_reserves` (current) | `42630.831742076168353121` |
| `pools.id` | `01a07d86-8e35-7981-96f4-ceeca222bbb9` |

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
| 0 | **yes** | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a01181-ca40-725f-895c-28376ec9d2fe.png` | `01a07d86-73f4-7018-98cf-59e79fe51314` |
| 1 | no | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a02370-fead-73de-87ae-944e9e7b5515.webp` | `01a07d86-73f5-74fc-bb67-12460fab6757` |

---

## 3. `math-erdos-contribution-response`

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
| `created_at` | `2026-09-07T20:19:18.674Z` |
| `pools.yes_reserves` (current) | `369396.935625441926243475` |
| `pools.no_reserves` (current) | `42603.064374558073840363` |
| `pools.id` | `01a07d86-8ede-747d-8924-22297e540f50` |

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
| 0 | **yes** | `m/01a01181-d035-714a-b735-5d282576d0a3/01a01181-d035-714a-b735-61bf2fd26c5d.png` | `01a07d86-7461-7595-afb6-f4f88b71f4c6` |
| 1 | no | `m/01a01181-d035-714a-b735-5d282576d0a3/01a02370-fead-73de-87ae-a78500f73a81.webp` | `01a07d86-7461-77a5-8a5a-ee5ad629f31d` |

---

## 4. `claude-bundle-response`

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
| `created_at` | `2026-09-07T20:19:18.784Z` |
| `pools.yes_reserves` (current) | `369068.959486833834134098` |
| `pools.no_reserves` (current) | `42931.040513166165861480` |
| `pools.id` | `01a07d86-8fc1-7b96-93da-4beccb39a16f` |

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
| 0 | **yes** | `m/01a01181-d508-7288-b996-36ec427a9d2f/01a01181-d508-7288-b996-38044d147135.png` | `01a07d86-74e7-794b-b3ac-d664c030b8dd` |
| 1 | no | `m/01a01181-d508-7288-b996-36ec427a9d2f/01a02370-fead-73de-87ae-9fdbf8e7fa25.webp` | `01a07d86-74e7-7c76-905a-50c439cca95c` |

---

## 5. `yc-paper-club-response`

**YCombinator · Will YC reply to Zugzwang's pitch by 5 Nov 2026?**

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
| `created_at` | `2026-09-07T20:19:18.920Z` |
| `pools.yes_reserves` (current) | `374514.416928275111913871` |
| `pools.no_reserves` (current) | `42485.583071724887931262` |
| `pools.id` | `01a07d86-903c-7ac5-95f8-3cb1781018e4` |

**Resolution text (`markets.description`), verbatim:**

```text
Will @ycombinator reply to or quote-post any post in the Zugzwang thread submitting its pitch to YC Paper Club, on X, between 15 September and 5 November 2026?

Resolves YES if a post by @ycombinator is a reply to any post in the Zugzwang Paper Club thread, or a quote-post of one. What the post says is never read: approval, rejection and dismissal all resolve YES identically.

Resolves NO in every other case, and this market is deliberately narrow. A standalone post naming Zugzwang resolves NO. A Paper Club recap or announcement naming Zugzwang resolves NO. The paper being selected, scheduled or presented resolves NO absent a qualifying post — the outcome the submission wants is not the criterion. So do likes, any other account, and silence.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-da63-738b-a3ea-8da89299bc53/01a01181-da63-738b-a3ea-9270f9f87ba9.png` | `01a07d86-754b-7f09-adb4-0b69b7f27db5` |
| 1 | no | `m/01a01181-da63-738b-a3ea-8da89299bc53/01a02370-fead-73de-87ae-b35295fac49b.webp` | `01a07d86-754b-773e-99d2-454a0bcbef0d` |

---

## 6. `github-zugzwang-repo-stars`

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
| `created_at` | `2026-09-07T20:19:19.017Z` |
| `pools.yes_reserves` (current) | `368697.447124170594807246` |
| `pools.no_reserves` (current) | `43302.552875829405333773` |
| `pools.id` | `01a07d86-90b5-7a6f-b577-1cf0be719206` |

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
| 0 | **yes** | `m/01a01181-df3a-747f-b154-e79a4a416b51/01a01181-df3a-747f-b154-eb03baee542f.png` | `01a07d86-75bd-7491-b502-fabc603ce183` |
| 1 | no | `m/01a01181-df3a-747f-b154-e79a4a416b51/01a02370-fead-73de-87ae-a04ecdbc9359.webp` | `01a07d86-75bd-79db-9090-3ee1fa2ef08b` |

---
