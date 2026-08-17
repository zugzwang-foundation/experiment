# Act V — The Audit
*n196–226 · 3 – 16 July 2026*

Everything exists now. Engine, arguments, ranking, moderation, a way to deploy it.

Nothing has been checked by anyone whose job was checking.

Act V is five days in July, and the shape is unmistakable from the log alone. Eighteen commits between the third and the seventh, no gaps — the densest stretch in the entire history apart from the engine itself. Fix, then a written record of the fix. Fix, then record. Nine times, in strict alternation.

Every subsystem gets touched exactly once. Moderation, bets, the ledger, sign-in, storage, alarms. Not one of them deeply — all of them, once, in a sweep.

Underneath is a second numbering that never makes it into the subject lines, running past thirty findings, each discharged and named. Somebody made a list of everything wrong, then went through it.

The interesting thing about a week like this is what it says about the fortnight before it. This is a project that built at speed, knew it had built at speed, and scheduled the reckoning rather than hoping. It is also a project whose plans ran to nine hundred lines and four rounds of amendment before a single step was carried out — and the audit still found thirty things. Thoroughness upstream does not buy you a clean week downstream. It buys you a shorter list.

Then, when it's done, the log stops for a week. Nothing at all from the seventh to the fourteenth. That silence is the loudest thing in this act.

---

---

### There Is No Second Upload
`AUDIT-FIX-A1 — moderated bytes are the rendered bytes` · 3 July 2026 · week 11

Here is the hole. You upload a picture. It gets checked, it passes, it goes live. Then you upload a different picture to the same address — and the thing that was checked and the thing people see are no longer the same picture.

The obvious fix is to check again. Watch for changes, re-scan, compare.

They didn't. They made the second upload impossible.

The permission slip your browser gets now says *this address must be empty*. The first upload works. Every one after it is refused by the storage itself, before anything of ours is involved. And that instruction is part of what's signed, so it cannot be quietly edited out on the way.

There is no window to close, because there is no second upload for a window to sit between.

They do record a fingerprint of the bytes that were checked — and wrote down, in capitals, that it is **not** a security control. It is evidence. A fingerprint you check afterwards tells you that you were robbed. It does not stop the robbery.

---

### The First One Closes
`chore(docs): log session — AUDIT-FIX-A1 close-out` · 3 July 2026 · week 11

The first of the audit fixes is recorded as finished. Nothing else is in it.

---

### Confirmed Before It Counts
`fix(observability): AUDIT-FIX-B1 — finish SCAFFOLD.5 (A5, A6, A7, A17, A18-DSN)` · 4 July 2026 · week 11

The monitoring stratum, finished weeks after it was started. Failures inside the betting path are now captured where they happen rather than at the top of the stack, and the outside services get the same treatment at their boundaries. The piece worth keeping is the drain that empties a queue of alarms: it sends, waits for confirmation the send landed, and only then marks the item dealt with. Marking first would lose exactly the alarms that mattered.

---

### Debt Written Down
`chore(docs): parked — next SYNC sweep owes A1+B1 spec/ADR-index/footer reconciliation` · 4 July 2026 · week 11

A note recording that the next reconciliation already owes four corrections. The commit names the targets in its subject and says nothing more.

---

### Emptying Is Not Editing
`fix(dharma): AUDIT-FIX-B2 — ledger total order (A2 seq) + TRUNCATE guard (A20)` · 4 July 2026 · week 11

Two holes in a table meant to be permanent. The first: entries could arrive in the same instant with nothing to order them by, so a counter that always increases was added. The second is better. The table refused edits and refused deletions — but a command that empties a table wholesale is neither of those, and nothing was stopping it. That is now rejected at the storage layer, alongside the refusals that were already there.

---

### A Receipt That Survives
`fix(bets): AUDIT-FIX-B3 — oversell 400 (A3) + guarded release (A4) + durable idempotency receipts (A9)` · 5 July 2026 · week 11

Three gaps in the betting path, one mattering far more than the others. Whether an action had already been carried out was remembered in a cache — fast, and gone the instant anything restarted. So a crash at the wrong moment could let a retry run the whole thing a second time. The answer is a row written inside the same piece of work as the action itself. If the row exists the action happened, and the database refuses the duplicate outright.

---

### Flagged With No Reason
`fix(moderation): AUDIT-FIX-A21 — verdict-mapper fail-open belt` · 5 July 2026 · week 11

The content check could return a refusal naming no reason the code recognised. That case now fails closed.

---

### Nothing Beyond That
`chore(docs): log session — AUDIT-FIX-A21 close-out` · 5 July 2026 · week 11

That fix is recorded as finished. The commit carries nothing beyond the fact of it.

---

### A Comment Left For Later
`chore(events): log session — AUDIT-FIX-B5 close-out + A30 PII key-name future-work guard comment` · 6 July 2026 · week 11

Closed, with one addition: a comment left in the code warning whoever next touches a payload key not to put anything personal into it.

---

### Promised But Never Emitted
`fix(auth): AUDIT-FIX-A22 — signup/sign-in event completeness (§8.8) + §3.5 spec-vs-built reconciliation` · 6 July 2026 · week 11

The audit asked whether every flow records what it did, and found that signing up and signing in did not. Records the specification had described for months were never actually written by the code. Two things came of it: the missing ones are now emitted, and the specification was corrected where it described a path that had never been built. The document had been wrong for exactly as long as the code had.

---

### Two Parked And One Fixed
`chore(auth): log session — AUDIT-FIX-A22 close-out + FU-1/FU-2 parked` · 6 July 2026 · week 11

Closed, with two follow-ups parked under names rather than absorbed, and one correction to a document that described a directory nobody had built.

---

### Already In The Air
`docs(specs): AUDIT-FIX-B7 — A26 freeze accepted-window ruling (§20.2 insert)` · 6 July 2026 · week 11

A question nobody had answered: at the instant the experiment closes, what happens to a bet already halfway through being placed? The ruling is that it completes. The window is bounded by how long a single request can live — seconds — and deliberately given no named number, because naming one invites somebody to tune it. It landed as a ruling record and an insertion into the specification, with no code changed at all.

---

### A Date That Had Moved
`chore(docs): log session — AUDIT-FIX-B7-A26 close-out + dataset-release.md freeze-code drift fix` · 6 July 2026 · week 11

Closed, and while closing, a fix to a document about the public dataset that had drifted out of step with the code it described.

---

### Is Blank Space An Argument
`fix(bets): AUDIT-FIX-B7a — Upstash transport bounding (A14) + whitespace comment semantics (A24)` · 6 July 2026 · week 11

Two unrelated things in one fix. The cache client had no bound on how long it would wait or how often it would retry, so it was given both. The other is a question the code had never been asked: if somebody submits an argument made entirely of spaces, is that an argument? It is not. The check that measures length now trims first, so whitespace cannot pass for content.

---

### The Docket Grows
`chore(bets): log session — AUDIT-FIX-B7a close-out + parked.md sweep extensions` · 6 July 2026 · week 11

Closed, with the parked list gaining new rows and one correction to a description of how the tests are laid out.

---

### Two Routes Answering Differently
`fix(storage): AUDIT-FIX-B7b — A29 §4.4 envelope on the two sign routes + A31 positions index` · 7 July 2026 · week 11

Two addresses that hand out permission to upload had each improvised their own error shape. They now answer like everything else. An index the settlement path had been reading without arrives in the same commit.

---

### A Header You Can Fake
`chore(storage): log session — AUDIT-FIX-B7b close-out + parked.md XFF entry` · 7 July 2026 · week 11

Closed, adding one row to the parked list: the value used to identify where a request came from can be set by whoever sends it.

---

### The Count Was Wrong
`chore(docs): log session — AUDIT-INV-A12 close-out (A12 = G3) + parked.md XFF site-count fix` · 7 July 2026 · week 11

Closed, and the row added the day before is corrected — it had understated how many places in the code the problem actually appears.

---

### What A Cancelled Market Owes
`docs(specs): AUDIT-FIX-B8 — web-authored riders D1–D4 (cpmm.md → 2.0.0)` · 7 July 2026 · week 11

When a market is called off, what does each person get back? The rule is rewritten: stakes are refunded in proportion, anything already sold stands, and nothing is clawed back through negative entries. The pricing document moves to a major version to say so, because the answer changed rather than being clarified. The audit of the number is done against the ledger, not against whatever is left sitting in the pool.

---

### Deploy Work Signs Off
`chore(deploy): log session — DP.1 close-out` · 7 July 2026 · week 11

The deployment stratum is recorded as finished. Nothing else is inside the commit at all.

---

### Paying What Was Owed
`docs(sync): SYNC-SWEEP — pay the parked spec/doc reconciliation debt` · 7 July 2026 · week 11

The reconciliation the docket had been accumulating for a week: seven tasks against four targets, plus two strays that had never been filed anywhere.

---

### A Baseline For The Ceilings
`chore(docs): log session — SYNC-SWEEP close-out + v16 ceilings baseline` · 7 July 2026 · week 11

Closed, and the numbers that count things — how many decisions, how many tables — are written down as a baseline to measure the next drift against.

---

### Every Commit Accounted For
`docs(handover): EXTAUDIT-05 — backend handover deck (md + html + verifier)` · 14 July 2026 · week 12

The whole build written up for somebody outside to audit: a system map, a chronicle in fourteen chapters, an operations section. What makes it more than a document is the checking — two hundred and eighteen commits, each appearing exactly once in the chronicle, verified by machine in both directions. It also probed the live sites while being written, and recorded what it found: the two environments were three and twenty-six commits behind.

---

### Left In The List
`chore(docs): log session — EXTAUDIT-05 close-out + parked biome-warning row` · 14 July 2026 · week 12

Closed, with a single formatter warning left in the parked list rather than fixed in passing.

---

### The Dark One Arrives
`BRIDGE: branded dark token layer (values-log v0_3 §3)` · 15 July 2026 · week 12

The interface stops being a placeholder. A branded dark layer is swapped in wholesale — the values themselves, the checks pinning them in place, and the contract naming which slots exist and what may fill them, all in one commit. The commit body runs to three lines and none of them explains the choice. The reasoning lives in a design document it cites by version, and nowhere in the history itself.

---

### Tidying Before The Guest
`docs(canon): pre-EXTAUDIT-06 hygiene — REVIEW.md supersession + AGENTS/CLAUDE currency fixes` · 15 July 2026 · week 12

Housekeeping before an outsider reads the repository: one document marked superseded, and the standing files corrected where they had fallen out of date.

---

### It Refuses To Ship Wrong
`docs(handover): EXTAUDIT-06 reviewer-project kit + staging script` · 15 July 2026 · week 12

A package for an outside reviewer: seven documents pinned to an exact commit, and a script that assembles the sixty files they were promised. The script's useful property is that it will not finish if what it staged disagrees with the manifest saying what should be there. A checksum receipt comes out the other end. A handover that quietly ships the wrong set is worse than no handover.

---

### The Warning That Went Away
`docs(specs): retire the slippage warning` · 15 July 2026 · week 12

There used to be a warning when a bet would move the price a lot. It was removed — and the heading it lived under was kept, empty, with a note saying what used to be there. Nothing here is deleted quietly, including the things nobody will miss.

---

### A Fork Healed
`docs: heal design-guide fork v0.2→v0.6 + refresh CLAUDE/AGENTS citations` · 16 July 2026 · week 13

A design document that had split into two versions is merged back into one, and the standing files are updated to cite the version that now actually exists.

---

### The Light Sweep Ends
`chore(docs): log session — SYNC-LITE close-out` · 16 July 2026 · week 13

The smaller reconciliation is recorded as finished. The commit contains nothing at all but that record.

---
