# Staging markets — snapshot

> **Why this file exists.** The eight markets below were authored by hand and
> exist NOWHERE but the staging database. Everything else in the LOTS-1 lane is
> reversible; losing these is not. `pnpm staging:reset` truncates `markets`, so a
> rebuild without this file destroys the copy that took the longest to make and
> the shortest to lose. This is the artifact that makes a future rebuild
> survivable — it is a RECORD, not a seeder, and nothing reads it at runtime.

**Captured:** `2026-08-21T17:03:01.320Z` (read-only) · **Source:** `aws-1-ap-south-1.pooler.supabase.com` / `postgres`
**Machine-fidelity copy:** [`staging-markets-snapshot.json`](./staging-markets-snapshot.json) — every column, verbatim.

| rows | count |
|---|---|
| `markets` | **8** |
| `pools` | **8** |
| `market_media` | **16** |

⚠ **The reserves are NOT all `10000` any more.** The LOTS-1 S6 record reads
`10000.000000000000000000` across all eight because that was the seeded state the
moment after the wipe. Four pools have since moved under real bets. The seeded
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
| `pools.yes_reserves` (current) | `10000.000000000000000000` |
| `pools.no_reserves` (current) | `10000.000000000000000000` |
| `pools.id` | `01a01181-e624-7891-a15b-6b17cfb3b9be` |

**Resolution text (`markets.description`), verbatim:**

```text
Will BMC publicly disclose on X by 5 November 2026 that at least 10,000 women were screened for breast cancer in BMC public health facilities in Mumbai during Pink October 2026 (1–31 October)?

Resolves YES if @mybmc posts, within the window, a figure of 10,000 or more women screened for breast cancer at BMC facilities in Greater Mumbai during 1–31 October 2026. BMC must state the figure itself, in text or a legible image.

Resolves NO in every other case — silence, a lower figure, a target or projection, a non-numeric claim, a relayed figure, a repost without comment, any other account, or any surface other than X. This resolves on the disclosure, not the screening: if BMC screens the women and posts no figure, it resolves NO.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-bb3c-7443-bc4d-35938c65bde9/01a01181-bb3c-7443-bc4d-3ac9c9c837d7.png` | `01a01181-c018-7b35-b469-cc609d33045b` |
| 1 | no | `m/01a01181-bb3c-7443-bc4d-35938c65bde9/01a02370-fead-73de-87ae-ac7c023511f8.webp` | `01a02370-ff6d-7be5-9060-c64be711012b` |

---

## 2. `oktoberfest-munich-beer-volume`

**Oktoberfest · Will the 7.5M litre beer record be broken?**

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
| `pools.yes_reserves` (current) | `10000.000000000000000000` |
| `pools.no_reserves` (current) | `10000.000000000000000000` |
| `pools.id` | `01a01181-e755-74f0-bafa-983e44792a10` |

**Resolution text (`markets.description`), verbatim:**

```text
Will oktoberfest.de's preliminary final report for Oktoberfest 2026 state a total beer figure above 7.5 million litres for the official 16-day festival, 19 September to 4 October 2026?

Resolves YES if that report states a figure above 7.5 million litres. It prints to 0.1 million granularity, so the lowest qualifying figure is 7.6 million. The record itself, 7.5 million, does not qualify.

Resolves NO in every other case — 7.5 million or lower, a non-numeric statement, a figure scoped to one tent, one brewery or the Oide Wiesn alone, any other publisher including the mid-term Halbzeitbilanz and all media, or no qualifying report. This resolves on the printed figure, not on how much beer is drunk.

Trading closes 4 October 2026, 23:59 Munich time. Settlement 5 November.
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
| `pools.yes_reserves` (current) | `10000.000000000000000000` |
| `pools.no_reserves` (current) | `10000.000000000000000000` |
| `pools.id` | `01a01181-e8a4-7dfa-b90f-0e92e9235e61` |

**Resolution text (`markets.description`), verbatim:**

```text
Will FIDE respond publicly on X by 5 November 2026 to Zugzwang's published proposal to abolish rapid and blitz tiebreaks from the World Chess Championship match?

Resolves YES if @FIDE_chess publishes a post, within the window, containing the word Zugzwang, or linking to, quote-posting or reproducing any post in the Zugzwang thread. There is no test of substance — a refusal or a dismissal resolves YES exactly as agreement would.

Resolves NO in every other case — silence, a repost without comment, any other account including FIDE officials and every national federation, or any surface other than X. Publication of the 2026 Match Regulations does not resolve this market, whatever it says. If the thread's root post is removed by anyone, this resolves NO.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a01181-c54b-71b9-a77f-d922fe9fa1ec.png` | `01a01181-c9f0-7e99-90f2-a3ad88d9d9c1` |
| 1 | no | `m/01a01181-c54b-71b9-a77f-d6e11d373a69/01a02370-fead-73de-87ae-9a4dd08b48db.webp` | `01a02370-ff2a-704d-8b66-c2f82dfab2b3` |

---

## 4. `bitcoin-price-50k`

**Bitcoin · Will BTC ever go below $50,000 by 5 Nov 2026?**

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
| `pools.yes_reserves` (current) | `10000.000000000000000000` |
| `pools.no_reserves` (current) | `10000.000000000000000000` |
| `pools.id` | `01a01181-ea2a-79be-a601-ebf85610a1ef` |

**Resolution text (`markets.description`), verbatim:**

```text
Will Bitcoin trade below USD 50,000 at any point between 15 September and 5 November 2026, as measured by the published daily low of Bitcoin (BTC) on CoinMarketCap?

Resolves YES if the daily low published by CoinMarketCap is below USD 50,000 on any of the 52 UTC calendar dates in that window. Below means strictly less than USD 50,000.00 — a published low of exactly USD 50,000.00 does not qualify.

Resolves NO in every other case — a price below USD 50,000 that appears only on a single exchange, only in a futures, perpetual, options or oracle price, only on another index, or only outside the window. The first qualifying daily low resolves YES irreversibly; a later recovery does not un-trigger it.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a01181-ca40-725f-895c-28376ec9d2fe.png` | `01a01181-cfd1-7caf-b282-8c5fd865f0b2` |
| 1 | no | `m/01a01181-ca40-725f-895c-270b2190c3ee/01a02370-fead-73de-87ae-944e9e7b5515.webp` | `01a02370-ff1e-7082-8d34-9c5a467606f1` |

---

## 5. `math-erdos-contribution-response`

**Math · Will 3 Erdos problems be solved by 5th November 2026?**

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
| `pools.yes_reserves` (current) | `9980.039920159680638724` |
| `pools.no_reserves` (current) | `10020.000000000000000000` |
| `pools.id` | `01a01181-eb6a-74a6-8e72-b3355e8362ad` |

**Resolution text (`markets.description`), verbatim:**

```text
Will Thomas Bloom, owner and maintainer of erdosproblems.com, publicly confirm on X that at least three distinct Erdős problems, open on 15 September 2026, have been solved, proved or disproved by 5 November 2026?

Resolves YES if posts by @thomasfbloom on X identify at least three distinct Erdős problems by number and state of each that it is solved, proved or disproved. Each counts once, and each must have been listed as open on erdosproblems.com at market open.

Resolves NO in every other case — fewer than three, partial progress, an improved bound, reporting someone else's claim, or silence. A status change on the site itself, a comment on its forum, or any other account or surface resolves nothing; only Bloom posting on X does.

Deadline 5 November 2026, 23:45 UTC.
```

**`market_media` (2):**

| order | default | `r2_object_key` | `id` |
|---|---|---|---|
| 0 | **yes** | `m/01a01181-d035-714a-b735-5d282576d0a3/01a01181-d035-714a-b735-61bf2fd26c5d.png` | `01a01181-d4ae-7674-9e88-e855992b0918` |
| 1 | no | `m/01a01181-d035-714a-b735-5d282576d0a3/01a02370-fead-73de-87ae-a78500f73a81.webp` | `01a02370-ff57-742e-8f10-177d6b556f53` |

---

## 6. `claude-bundle-response`

**Claude · Will an official Claude account reply to Zugzwang by 5 Nov 2026?**

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
| `pools.yes_reserves` (current) | `9990.009990009990009991` |
| `pools.no_reserves` (current) | `10010.000000000000000000` |
| `pools.id` | `01a01181-ecaa-7116-abe8-37a4d3d0e554` |

**Resolution text (`markets.description`), verbatim:**

```text
Will @AnthropicAI, @claudeai or @ClaudeDevs publicly reply to, quote-post, or name the Zugzwang thread presenting the Bundle feature specification, between 15 September and 5 November 2026?

Resolves YES if a post by one of those three accounts is a reply to any post in the thread, a quote-post of one, or a standalone post naming Zugzwang. What the post says is never read: approval, rejection, dismissal and a legal objection all resolve YES identically.

Resolves NO in every other case — silence, likes, bookmarks, reposts without comment, any private channel, any other Anthropic account or surface, and any post by an Anthropic employee or officer in any capacity. If Anthropic ships automatic chat grouping without posting, that alone resolves NO.

Deadline 5 November 2026, 23:45 UTC.
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
| `pools.yes_reserves` (current) | `9852.216748768472906405` |
| `pools.no_reserves` (current) | `10150.000000000000000000` |
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
| `pools.yes_reserves` (current) | `9756.239052787191828629` |
| `pools.no_reserves` (current) | `10249.851347321353106872` |
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
