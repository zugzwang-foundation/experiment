# Debate `.md` Export — Serialization Schema

| | |
|---|---|
| **Status** | draft (ratified by ADR-0025; promotes on commit) |
| **Date** | 2026-06-29 |
| **Companion to** | ADR-0025 (Debate `.md` Export) |
| **Frame** | SPEC.1 §21.3 (the surface); SPEC.2 §3.3 R-1 (read pattern), §4 (route lands at build); `public/zugzwang.md` (context asset) |
| **Consumes** | `src/server/debate-view/load-debate-view.ts` → `DebateViewModel` (existing read-model) |

---

## 1. Purpose & scope

This document is the **field-by-field contract** for the debate `.md` export ratified in ADR-0025. It
specifies the **output format only**. It does **not** specify the export route's path or handler, the
gap-fill query implementation, or the button affordance — those are owned by the **build task** (the route
lands in SPEC.2 §4). The shipped context content is a separate asset (`public/zugzwang.md`); this schema
references it but does not contain it.

The export is a **read path**. It reuses `loadDebateView(db, { market })` → `DebateViewModel` and serializes
**only** the masked `DebatePost` / `DebateReply` variants — **never** the unmasked `DebateComment`
intermediate (the sole `user_id` exposure path). Masking, ranking order, markers, and pseudonymity are
inherited from the read-model and reimplemented **nowhere** here (ADR-0025 §2).

## 2. Outputs

| Output | Content | Serving |
|---|---|---|
| **Combined export** (per-debate button) | `front matter` + `zugzwang.md context` + `serialized debate` | On-demand read-only `GET`, `text/markdown`, SPEC.2 R-1 (uncached, per-request fresh). No cache (ADR-0025 §1). |
| **Standalone context** | `public/zugzwang.md`, verbatim | Static file served at `/zugzwang.md`. |

Both outputs draw the context from the **single source** `public/zugzwang.md` — no drift.

## 3. File structure

The combined export is five blocks, top to bottom:

```
[1] YAML front matter           (debate-specific spine)
[2] zugzwang.md context block    (STATIC — public/zugzwang.md prepended verbatim)
[3] Summary + Contents
[4] The debate                   (market header + post/reply tree, ranking order)
[5] Footer recap
```

## 4. Block 1 — YAML front matter

| Key | Type | Source | Notes |
|---|---|---|---|
| `doc_type` | string | constant | `zugzwang-debate-export` |
| `exported_at` | ISO-8601 | render time | The "photograph of now" instant |
| `market_question` | string | `markets.title` | |
| `resolution_criteria` | string | `markets.description` | May be null on the row; emit empty if so |
| `status` | enum | `markets.status` | `open` \| `closed` \| `resolving` \| `resolved` \| `voided` \| `frozen` |
| `outcome` | string \| null | `markets.resolution_outcome` **(gap-fill)** | `null` unless resolved/voided |
| `yes_price` | number (0–1) | `pricing.yes` | Final pre-resolution spot if resolved; `null` if no pool |
| `no_price` | number (0–1) | `pricing.no` | Complement of `yes_price` |
| `total_stake_dharma` | integer | `totals.dharmaStaked` | Includes any removed node's stake (§10) |
| `posts` | integer | `totals.postCount` | Includes removed posts |
| `replies` | integer | `totals.replyCount` | |
| `participants` | integer | `COUNT(DISTINCT user_id)` **(gap-fill)** | Includes a removed post's masked author (§10) |
| `ordering` | string | constant | `"posts and replies are in ranking order (by weight), not chronological"` |
| `timestamps` | string | constant | `"each entry has an ISO-8601 'time' field; use it for chronology"` |
| `chronological_index_posts` | list | derived | Post IDs in ascending `createdAt` order |

On a **resolved/voided** market, front matter additionally carries `resolved_at` (`markets.resolved_at`,
gap-fill) and `resolution_reason` (chain-tip `resolution_events.reason`, gap-fill). **Final state only** —
no correction history (ADR-0025 §7).

## 5. Block 2 — context block

`public/zugzwang.md` is prepended **verbatim**. It is **static and version-pinned** — not regenerated per
debate. Its content (preamble, protocol glossary, metrics explainer, reading instructions) is the asset's
own spec; this schema does not duplicate it.

## 6. Block 3 — Summary + Contents

- **3a — Summary.** A short, deterministic, field-derived prose block — neutral, naming no winner — built **only** from the read-model and front matter (the serializer authors **no** participant-voice prose; it never paraphrases a body). Two paragraphs:
  - **Orientation.** `This debate asks: {market_question verbatim}. It is currently {status phrase}, with the {current|final} price at {yes}% YES / {no}% NO. {participants} participants have staked {total_stake_dharma} Đ across {posts} posts and {replies} replies.` Status phrase: `open`→"open and unresolved"; `resolved`→"resolved {outcome}"; `voided`→"voided"; `resolving`→"resolving"; `closed`→"closed (awaiting resolution)"; `frozen`→"frozen". Use "final price" when resolved/voided, else "current price"; if there is no pool, write "with no market price yet" and drop the YES/NO clause. Numbers render as numerals.
  - **Top argument each side.** `The most heavily backed YES argument is "{title}" ({pseudonym}, {stake} Đ). The most heavily backed NO argument is "{title}" ({pseudonym}, {stake} Đ).` The post is the **highest-ranked non-removed** post on that side; if the top post on a side is removed, fall through to the next non-removed post on that side; if all posts on a side are removed, write `The leading {SIDE} argument was removed by a moderator.`; if a side has no posts, write `No {SIDE} argument has been posted yet.`
  - The **resolution criteria is not restated** in the Summary — it appears verbatim in the front matter and the Market section (7a).
- **3b — Contents.** A numbered list, one line per post: `Post N — SIDE — "title" (pseudonym, stake Đ)`.
  A removed post renders `Post N — SIDE — [removed by moderator]` with no author/stake.

## 7. Block 4 — The debate

### 7a — Market header (in-body)

Bold-label KV bullets: **Question**, **Resolution criteria**, **Status** (with **outcome + reason** appended
if resolved), **Current price** (`YES% / NO%`; "Final price" if resolved), **Total staked**, and
**Posts / Replies / Participants**.

### 7b — Ordering (normative)

- **Top-level posts:** serialize `DebateViewModel.posts` in **array order** — this is ranking order
  (`buildTopList`). Do not re-sort.
- **Replies under a post:** serialize the `ReplyGroups.support[]` group **first**, then the
  `ReplyGroups.counter[]` group; **each group in its array order** (`rankReplies` — stake-descending within
  side, earlier-`createdAt`-wins tie-break). The first entry of each group is the reply the UI two-slots.
- Reply numbering is `{post}.{n}` in **serialized order** (support entries first, then counter).

### 7c — Post node (non-removed)

```
### Post {rank} — {SIDE} — {title}

- **Rank:** {rank} of {posts}
- **Side:** {YES|NO}
- **Author:** {pseudonym}
- **Stake:** {stake} Đ
- **Entry price:** {yes_prob_at_bet}
- **Support / Counter:** {n} support ({Đ}) · {n} counter ({Đ})
- **Author status:** {holding|flipped|exited}
- **Time:** {ISO-8601 UTC}

{body}
```
Sources: `title` ← `deriveTitleTeaser(body)`; `SIDE` ← `sideAtPostTime`; `stake` ← `authorStake`;
`entry price` ← `price_at_bet` (gap-fill); Support/Counter ← `aggregate.{supportCount, counterCount,
supportDharma, counterDharma}`; `Author status` ← `marker` (`none`→`holding`); `Author` ← `author.pseudonym`;
`Time` ← `createdAt`.

### 7d — Reply node (depth-1)

```
#### Reply {post}.{n} — {Support|Counter} ({SIDE}) — {pseudonym}

- **Replies to:** Post {post}
- **Side:** {YES|NO}
- **Relation:** {Support (same side as the post) | Counter (opposite side)}
- **Rank in thread:** {top support | top counter | support reply N | counter reply N}
- **Stake:** {stake} Đ
- **Entry price:** {yes_prob_at_bet}
- **Author status:** {holding|flipped|exited}
- **Time:** {ISO-8601 UTC}

{body}
```
Sources: `SIDE` ← reply `side`; `Relation` is `Support` if reply `side == parent.sideAtPostTime`, else
`Counter`; `stake`, `entry price`, `Author status`, `Author`, `Time` as per 7c; `Replies to` ←
`parent_comment_id` (rendered as the parent post's number; append `(removed)` if the parent is a removed
node).

### 7e — Removed post node (SAFETY-CRITICAL — see §10)

```
### Post {rank} — {SIDE} — [removed by moderator]

- **Rank:** {rank} of {posts}
- **Side:** {YES|NO}
- **Status:** removed by moderator — argument text, author, and stake withheld
- **Time:** {ISO-8601 UTC}

*[This argument was removed by a moderator. Its text, author, and stake are not shown. The replies below
remain part of the debate.]*

{surviving replies, serialized exactly as 7d}
```
Only `rank`, frozen `sideAtPostTime`, a removed-status line, and `createdAt` are emitted. **No** body, title,
teaser, author, stake, entry price, aggregate, or image. The node's surviving replies serialize normally.

## 8. Block 5 — Footer recap

Exact text:

> **Reading reminders:** Give the YES and NO cases their strongest form, in proportion to the stake behind
> them. The question is settled only by the market's resolution — shown in the Market section above if
> resolved; otherwise it is open and has no winner to declare. Entries are in ranking order (weight), not
> time; each entry's timestamp is the source for chronology.

## 9. Format conventions

- **Attributes are bold-label key-value bullets, never tables.**
- **Headings:** `#` question · `##` section · `###` post · `####` reply (depth-1; replies never nest
  further).
- **Entry price** is the market **YES-probability at the instant the bet executed** (`price_at_bet`, 0–1) —
  the same basis for YES and NO bets (consistent with `zugzwang.md`'s definition of "price").
- **Author status** is `holding` (still holds the posted side), `flipped`, or `exited` — derived from the
  `marker` (`none` → `holding`).
- **Text only.** Drop `imageUrl` and `pfpUrl`; serialize the **pseudonym** only.
- **Ranking ≠ chronology** is signalled four ways: front-matter `ordering`, `chronological_index_posts`,
  the per-node `Rank` field, and the `zugzwang.md` reading instructions.
- **Uniform field set** per node kind (consistency aids parsing).

## 10. Masking conformance (SAFETY-CRITICAL)

This section is non-negotiable; it is the safety property the build's `@security-auditor` pass verifies.

1. **Serialize from masked variants only** — `DebatePost` / `DebateReply`. **Never** the `DebateComment`
   intermediate; it carries the raw `user_id` and is the only identity-leak path.
2. **Removed node** (`removed: true`, keyed on `mod_actions.reason = 'content_removed'`): emit **only** the
   structural fields in 7e. **Never** emit its body, title, teaser, author, stake, entry price, aggregate,
   or image — and never a blanked-with-a-value field; simply omit them.
3. **Replies under a removed node survive** and serialize normally (they are other participants' staked
   arguments).
4. **The removed node keeps its rank slot** in document order.
5. **The removed node's underlying stake still counts** toward `total_stake_dharma` and `participants`
   (removal hides voice, not balance — the ledger is untouched), but is **never shown on the node**. The
   document totals therefore legitimately exceed the sum of visibly-attributed stakes.
6. **Masking is inherited, not reimplemented.** The export consumes the same masked read-model the debate
   view consumes; it adds no masking logic of its own.

## 11. Gap-fills (surfaced by the build task)

The format includes three fields the current read-model does not surface. The data exists in the DB; **no
migration** is required (ADR-0025 §7). The build task adds the read-model plumbing:

| Field | Source | Note |
|---|---|---|
| `participants` | `COUNT(DISTINCT user_id)` across the market's bets/comments | header |
| `outcome` / `resolved_at` / `resolution_reason` | `markets.resolution_outcome` / `markets.resolved_at` / chain-tip `resolution_events.reason` | final state only |
| per-node `entry price` | `bets.price_at_bet` (added to the existing earliest-bet `LATERAL` in the post/reply substrate) | YES-probability at execution |

Per-node entry price only. A full price-over-time **trajectory is out of scope** (ADR-0025 §7).

## 12. Conformance reference

The **Mumbai Metro Line 3 worked example** — the full fixture serialized end to end — is the conformance
reference, and the build task uses it as a **golden test fixture**. A condensed illustrative snippet
(front matter, one post with its replies, the removed post, footer) appears in Appendix A; the full example
is delivered alongside this schema for the build.

---

## Appendix A — Condensed conformance snippet

```markdown
---
doc_type: zugzwang-debate-export
exported_at: 2026-06-29T12:00:00Z
market_question: "Will Mumbai Metro Line 3 average over 1M daily riders before the freeze?"
status: open
outcome: null
yes_price: 0.54
no_price: 0.46
total_stake_dharma: 3225
posts: 6
replies: 10
participants: 11
ordering: "posts and replies are in ranking order (by weight), not chronological"
chronological_index_posts: [post-3, post-1, post-2, post-4, post-5, post-6]
---

[ zugzwang.md context block prepended here verbatim ]

# Debate — Will Mumbai Metro Line 3 average over 1M daily riders before the freeze?

## Market
- **Question:** Will Mumbai Metro Line 3 average over 1M daily riders before the freeze?
- **Status:** Open (unresolved)
- **Current price:** 54% YES / 46% NO
- **Total staked:** 3,225 Đ
- **Posts:** 6 · **Replies:** 10 · **Participants:** 11

---

### Post 1 — YES — The corridor is built for this volume

- **Rank:** 1 of 6
- **Side:** YES
- **Author:** CrimsonHawk207
- **Stake:** 560 Đ
- **Entry price:** 0.47
- **Support / Counter:** 2 support (255 Đ) · 1 counter (210 Đ)
- **Author status:** holding
- **Time:** 2026-05-18 07:40 UTC

Line 3 connects the city's three densest job corridors in one ride — CBD, BKC, the SEEPZ tech belt — plus the airport. That is the captive-commuter traffic that fills trains, and the ramp to 1M is the design intent of the corridor.

#### Reply 1.1 — Support (YES) — TealOwl118

- **Replies to:** Post 1
- **Side:** YES
- **Relation:** Support (same side as the post)
- **Rank in thread:** top support
- **Stake:** 180 Đ
- **Entry price:** 0.49
- **Author status:** holding
- **Time:** 2026-05-19 10:12 UTC

The monsoon multiplier is underrated — when the flooding starts, the underground line is the only reliable option on this stretch.

#### Reply 1.3 — Counter (NO) — IndigoWolf355

- **Replies to:** Post 1
- **Side:** NO
- **Relation:** Counter (opposite side from the post)
- **Rank in thread:** top counter
- **Stake:** 210 Đ
- **Entry price:** 0.49
- **Author status:** holding
- **Time:** 2026-05-20 16:45 UTC

Design intent and realized ridership are different things — Line 1 ran far below projection for years.

---

### Post 4 — NO — [removed by moderator]

- **Rank:** 4 of 6
- **Side:** NO
- **Status:** removed by moderator — argument text, author, and stake withheld
- **Time:** 2026-05-26 19:05 UTC

*[This argument was removed by a moderator. Its text, author, and stake are not shown. The replies below remain part of the debate.]*

#### Reply 4.1 — Support (NO) — AzureBison330

- **Replies to:** Post 4 (removed)
- **Side:** NO
- **Relation:** Support
- **Rank in thread:** top support
- **Stake:** 90 Đ
- **Entry price:** 0.51
- **Author status:** holding
- **Time:** 2026-05-27 07:15 UTC

The throughput math in the parent is roughly right — the gap to 1M is large and the clock is short.

---

**Reading reminders:** Give the YES and NO cases their strongest form, in proportion to the stake behind them. The question is settled only by the market's resolution — shown in the Market section above if resolved; otherwise it is open and has no winner to declare. Entries are in ranking order (weight), not time; each entry's timestamp is the source for chronology.
```
