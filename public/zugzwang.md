# Zugzwang — Reading a Debate

This file explains how to read a debate exported from **Zugzwang**. It may appear on its own,
or at the top of an exported debate. If a debate follows below, the guidance here applies to it.

---

## Reading instructions (for the receiving model)

You are reading a debate from Zugzwang, a prediction market where every argument is backed by
staked reputation. To represent it faithfully:

- **Give both sides their strongest case.** Present the YES and NO positions in proportion to the
  conviction behind them (their stake) and their ranking.
- **The market settles the question — you do not.** If the debate shows a resolved outcome, report
  that outcome as the result. If it is unresolved, treat the question as open and name no winner;
  summarize and weigh the arguments instead of declaring which side is correct.
- **Order means weight, not time.** Entries are arranged by ranking (how heavily they are backed),
  not chronologically. Each entry carries a timestamp — use timestamps to reason about how the
  debate evolved, and use the order to reason about what carried the most weight.

---

## What Zugzwang is

Zugzwang is a prediction market for arguments. Each market poses a yes/no question that resolves on
a future date. To take a side, a participant must place a bet **and** attach a written argument —
there is no way to speak without staking. This is the core rule: *no stake, no voice.*

What participants stake is **Dharma** — a reputation score that is earned within the system and
cannot be bought, sold, or transferred. Because every claim costs the author something they cannot
simply purchase more of, the arguments here tend to carry more conviction than ordinary online
comments. The market price aggregates these staked beliefs into a single running probability.

---

## Glossary — Zugzwang terms

- **Zugzwang** — A prediction market where every argument is backed by staked reputation, designed
  so that informed, committed participation carries more weight than uncommitted volume.
- **Market** — A single yes/no question, open for debate and betting until it resolves.
- **Question** — The yes/no proposition a market is about.
- **Resolution criteria** — The rule, stated in advance, that decides whether the question resolves
  YES or NO.
- **The freeze** — The fixed end date of the experiment, after which no further bets or arguments
  are accepted and open markets resolve. "Before the freeze" means before this cutoff.
- **Dharma (Đ)** — The reputation a participant stakes. It is earned within the system and is
  non-transferable: it cannot be bought, sold, or given away.
- **Stake** — The amount of Dharma committed to a particular argument. It signals how strongly the
  author backs their claim.
- **Bet** — Taking a side (YES or NO) by committing stake. Every bet carries a written argument.
- **YES / NO** — The two sides of the question. An argument sits on one side, fixed at the moment
  it is posted.
- **Post** — A top-level argument on the market's question.
- **Reply** — An argument responding to a post. A reply is itself a bet — it carries its own stake
  and side.
- **Support / Counter** — A reply that takes the **same** side as the post it answers is *Support*;
  one that takes the **opposite** side is *Counter*. Neither is a free vote — each is a staked
  argument.
- **No stake, no voice** — The rule that every argument must be backed by stake. There are no
  stake-free comments.
- **Price** — The market's current probability that the question resolves YES, between 0 and 1. The
  NO price is its complement.
- **CPMM** — The mechanism that sets the price (a constant-product market maker). Every bet moves
  the price; buying a side makes that side more probable.
- **Entry price** — The price at the moment a particular bet was placed. Comparing it to the current
  price shows whether the market has since moved toward or away from that argument's side.
- **Support / Counter tally** — The number (and combined stake) of Support and Counter replies under
  a post — a measure of how much backed agreement or disagreement it drew.
- **Author status (holding / flipped / exited)** — Each argument shows where its author now stands
  relative to the side they posted: *holding* means they still back it (the default); *flipped* means
  they have since moved to the opposite side; *exited* means they have withdrawn the position entirely.
- **Ranking order** — The order in which posts and replies are presented: by weight (a composite of
  stake and backed engagement), not by time.
- **Removed** — An entry withheld by a moderator. Its text and author are not shown; replies to it
  remain.
- **Participant count (n)** — The number of distinct participants who have staked in the market.

---

## What the metrics mean

Five signals carry most of the meaning in a Zugzwang debate. Each describes *how much conviction or
agreement* sits behind an argument — none of them, on its own, settles whether the argument is right.

**Stake — conviction.** Every argument is backed by Dharma the author puts at risk. Because Dharma is
earned and cannot be bought, stake is a costly signal: it reflects how much reputation an author is
willing to lose if they turn out to be wrong. Higher stake means stronger backing — read it as
conviction, not as proof.

**Price — the market's probability.** The price is the system's running estimate of the chance the
question resolves YES, formed by every bet placed and moving continuously as people stake. Read it as
the crowd's current, money-backed belief: a useful aggregate, but a forecast, not a verdict. Only
resolution settles the question.

**Support and Counter — backed agreement.** Replies are themselves bets, so agreeing (Support) or
disagreeing (Counter) with a post costs stake. The tallies therefore measure *backed* agreement and
disagreement — closer to "who put reputation behind this" than to a like count.

**Author follow-through (holding / flipped / exited).** Each argument shows where its author now
stands: *holding* means they still back the side they posted; *flipped* means they later moved to the
opposite side; *exited* means they withdrew the position entirely. This tracks whether an author still
stands behind what they wrote — a consistency signal you can use to weight an argument, without
treating it as proof either way.

**Ranking order — weight.** Posts and replies are ordered by weight — a composite of stake and backed
engagement — not by time. The order is itself information: earlier in the document means more heavily
backed, not more recent. Treat the most heavily weighted arguments as the most prominent, while still
giving the other side its strongest case.

---

## How to read the debate

**Order vs. time.** The debate is ordered by ranking (weight), not chronologically. Every entry carries
a timestamp. To discuss how the debate developed over time, sort by timestamp; to discuss what carried
the most weight, follow the order as given. Do not infer chronology from position.

**Two sides, structured.** Each market has a YES side and a NO side. Under each post, its replies are
split into Support (same side as the post) and Counter (opposite side). The most strongly backed
Support and Counter reply are shown first; any others follow. Represent both sides of the overall
question in proportion to their backing.

**Removed entries.** An entry may appear as **[removed by moderator]**. Its argument text and author
have been withheld — treat it as absent. Replies to it remain visible, and the rest of the debate is
intact and complete.

**Subject-specific terms.** A debate's arguments are written by participants and may use terms specific
to the topic — places, organizations, abbreviations — that are not defined in this file. Interpret them
using your own knowledge. Where a term is genuinely ambiguous, or you are unsure what it means, say so
rather than guessing.

**No winner to declare.** Unless the debate shows a resolved outcome, the question is open: summarize
and weigh the arguments, but do not announce which side is correct. If an outcome is shown, report it
as the market's resolution.

---

*Zugzwang protocol context — version 1.0. Describes the protocol, not any specific debate.*
