# POLISH.3 · RUN TRACKER — PR 1 (FRAME) and PR 2 (CARDS)
 
**Authored 2026-08-12 IST at Gate C read 2 on PR #327.** Ground `origin/main` @ `a56943b`; branch `polish/3-commit-0` @ `4289cba`.
**Scope:** the two machine runs only. Step 0, the recon and the twelve rulings are closed and are not restated.
 
⚠ **This is a sequencer, not a spec.** SPEC.1 / SPEC.2 > ADR > `docs/plans/POLISH-3.md` > this file. Where it disagrees with the live repo, the repo wins (O-2).
 
---
 
## ▶ WHERE WE ARE
 
```
Step 0 ✅ → recon ✅ → twelve rulings ✅ → PR-1 plan ✅ → commit-0 doc PR ◀ YOU ARE HERE
                                                              │
                                    ┌─────────────────────────┘
                                    ▼
                          PR 1 FRAME → PR 2 CARDS → close-out
```
 
**Phase A, step A1 — merge #327.** Everything upstream of it is done and verified.
 
---
 
## §1 · Cost — measured, not estimated
 
| Unit | Founder-serial touches | Basis |
|---|---|---|
| **This chat** (PR-1 plan + commit-0 pack + two Gate C reads) | **≈ 12** — ten CC relays, four uploads, five ratification points | counted |
| POLISH.8, whole run | 8–10 | `POLISH-TRACKER.md` §6 |
| **POLISH.3 remaining, PR 1 + PR 2 + close-out** | **≈ 30 steps across 4–5 chats · 25–40 touches** | §5 |
 
⚠ **This chat overran POLISH.8's whole-run figure by itself.** The overrun is almost entirely **one-time discovery**, and naming it is what makes the forecast for PR 2 different:
 
| One-time finding | Cost | Recurs? |
|---|---|---|
| §6 forbade the doc writes §7/§12 mandate | 2 relays + a template amendment | **No** — fixed on `main` |
| Two of eight allow-list test paths were phantoms | 1 relay | No — the census pattern is now established |
| A third `DebateColumn` call site | folded | No |
| The `SCHEDULED` state lived in 3 files / 9 units | 2 relays | No — swept |
| The ADDITIONS apply convention was undefined | 1 relay | **No** — ruled and written into the file |
| Five Gate C findings, four of them web's | 2 relays | ⚠ **Partly** — see §6 |
 
**PR 2's plan should cost 4–5 relays, not ten.** If it trends past six, that is a signal to stop and ask what is being rediscovered.
 
---
 
## §2 · PHASE A — the commit-0 doc PR · **3 steps**
 
| # | Step | Who | Status |
|---|---|---|---|
| **A1** | Merge PR #327 | founder | ▶ **NEXT** — Gate C read 2 PASSED |
| **A2** | Advance `staging` to `main` (O-4) | CC relay | after A1 |
| **A3** | PK refresh — `POLISH-0` · `POLISH-register` · `POLISH-register-ADDITIONS` · `POLISH-TRACKER` · `parked` · `POLISH-SURFACE-TEMPLATE` · **new `docs/plans/POLISH-3.md`** | CC stages → founder drags | after A1 |
 
⚠ **A3 is not optional.** PR 1's execute chat reads governance from PK. A stale `POLISH-0.md` there still says six rulings are `SCHEDULED`.
 
---
 
## §3 · PHASE B — PR 1 · FRAME · **9 steps**
 
**Allow-list: eight files.** Six items. Five commits, none red, **none ultracode**.
 
| # | Step | Who | Notes |
|---|---|---|---|
| **B1** | Fresh execute chat, kickoff against `docs/plans/POLISH-3.md` on `main` | web + CC | ⚠ **Launch from a worktree at `origin/main`** — agent definitions load from the session's working directory |
| **B2** | Execute **C1** — `DebateColumn.tsx:58-66` + orphaned `Button` import | CC | Smallest, isolated, zero test movement |
| **B3** | Execute **C2** — `PriceBar.tsx:64,:73` + recaptured `DETAIL_BASELINE` | CC | ⚠ **V-1: capture AFTER the change.** Authoring the literal first inverts the proof |
| **B4** | Execute **C3** — greenfield guard, then `error.tsx` at `preset="debate"` | CC | ⚠ `GREENFIELD` populated **before** the file exists, or H15 fires accidentally |
| **B5** | Execute **C4** — Đ site 1 + pluralisation + `market-header.test.tsx` RED-first | CC | ⚠ C-1: read the fixture value off `price-chart.test.tsx`, assert the **space**, not the number |
| **B6** | Execute **C5** — dev-box removal (`PD-3-09`) | CC | ⚠ C-4: must leave `market-header.test.tsx` green |
| **B7** | `@code-reviewer` then `@security-auditor`, **sequentially**, each leaving a falsifiable repo-checkable receipt | CC | ⚠ No mechanism proves a subagent ran |
| **B8** | **Gate C** — diff as an uploaded file, web reads, remediation | founder + web | Expect **1–2 rounds**. `.7a` took 2, `.8` took 4, this pack took 2 |
| **B9** | Merge · staging advance · PK refresh · PR-1 log committed | founder + CC | ⚠ Every counted claim re-verified at PR head **before** the log is committed |
 
**B2–B6 are one overnight-capable run** if the operator wants it. C2 and C4 carry ordered proof obligations and cannot be parallelised, but they do not need a human between them.
 
---
 
## §4 · PHASE C — PR 2 · CARDS · **11 steps**
 
⚠ **PR 2 is the bigger half and needs its own full ritual** — plan-mode in one chat, web review, ratify, execute in a fresh chat.
 
| # | Step | Who |
|---|---|---|
| **C1** | Head verification — `main` will have moved **twice** since `a56943b` | CC relay |
| **C2** | CC plan-mode: PR 2's allow-list, boundary, commit shape, test-pin census | CC |
| **C3** | Web review · founder ratification | web + founder |
| **C4** | Plan committed (append to `docs/plans/POLISH-3.md` or a sibling) | CC |
| **C5** | Fresh execute chat | web + CC |
| **C6** | Execute | CC |
| **C7** | Two reviewer rounds, sequential | CC |
| **C8** | Gate C + remediation | founder + web |
| **C9** | Merge | founder |
| **C10** | Staging advance · PK refresh | CC + founder |
| **C11** | PR-2 log committed | CC |
 
### What PR 2 carries — enumerated so nothing is rediscovered as a gap
 
| Item | Row | Class |
|---|---|---|
| R1 sites 1–2 — `PostCard.tsx:111-119`, `:120-128` | `PD-0-02` | F |
| R4 — "Read more" at `PostCard.tsx:102-109` | `PD-0-01` | V |
| D2 sites 2–5 — `ReplyCard:55` · `ArgProfile:67` · `AggregateFooter:14`, `:19` | `PD-3-07` (**stays open after PR 1**) | V |
| D3 — the `Download` trigger, `BookmarkToggle.tsx:164-168` | `PD-3-15` | R |
| Chart overlay's missing accessible summary | `PD-3-04` | **F, tier 1** |
| R14 check 2's open half — pop-up image height | `PD-3-06` | R |
| `PostPopup` omissions ×3 | `PD-3-12` | V |
| `PostPopup` author's stake | `PD-3-13` | **F, tier 1** |
| `PostPopup` frozen `SideBadge` | `PD-3-14` | **F, tier 1** |
| *"Show all replies"* side-blind expansion | `PD-3-10` | **F, tier 1** |
| `PostPopup` geometry — 512→720px, 80→90vh, header row | `PD-0-03` | V |
| **RR-3** — live INV-3 pole inversion, `composer/ReplySplitBar.tsx:64,67` | `RR-3` | **F** |
 
**Four tier-1 class-F rows and a live INV-3 inversion. PR 2 is not a re-skin.**
 
### Constraints PR 2 inherits, already measured
 
- ⚠ **`PD-3-06` and `PD-0-03` must be dispositioned TOGETHER** — CD-A's 720px changes what *"whole"* means, so fixing the geometry first re-opens the clip row.
- ⚠ **`RR-3` sits in `src/components/debate/composer/**`**, which PR 1's belt ⛔ deny-lists. PR 2 needs an explicit named exception with its own ground.
- ⚠ **`D3` is a second named allow-list exception** by ruling.
- ✅ **D-F carries forward**: CD-A's `#989898`/`#FAFAFA` **are** `--color-n5` / `--color-ink`. Porting the literals reddens `no-raw-hex-view-layer.test.ts`.
- ⚠ **No test renders `PostPopup` at all.** Three F rows land there; PR 2's plan must author the guards.
- ⚠ **A per-pole render test asserts BOTH poles.** A YES-only test passes on an inverted NO panel — how the last live inversion survived a full PR.
- ⚠ **§4.2 S1 goes LIVE at PR 2.** Three shipped controls are removed. The ground is recorded once at `docs/plans/POLISH-3.md` §16: founder rulings, not mockup silence.
---
 
## §5 · PHASE D — CLOSE-OUT · **7 steps**
 
| # | Step |
|---|---|
| **D1** | Canon appends as ONE commit — R6 (retired) · R10 → **`C-PRICEBAR-1`** · R14 ×2. ⚠ Under the **`C-`** form, never as `Rn` |
| **D2** | The deferred doc batch — `POLISH-0.md:213` (the *"no `loading.tsx`/`error.tsx`"* claim, false once PR 1 merges) and `:554` (R6's *"will be re-argued"*, one dated sentence) |
| **D3** | Register hygiene — dispositions on every `PD-3-nn`; `superseded` rows cite their superseding `doc:line` |
| **D4** | Tracker sweep — three strata have closed since the last one (`.7a`, `.8`, `.3`) |
| **D5** | Close-out doc, including the **mandatory "what the machine read missed"** line |
| **D6** | PK refresh |
| **D7** | Merge · staging advance |
 
### Register additions proposed at this run, founder to rule at D5
 
| ID | Rule | Origin |
|---|---|---|
| **O-5** | *A durable amendment is applied at every site that states the superseded position, or it is not durable — an appendix reverses nothing a reader reaches first.* | GC-1/2/3: §18 reversed three operative sections without touching them |
| **V-9** | *An enumeration inherited from another artifact is a citation, not a proof.* | GC-5: the recon's six-line proof list was copied into a document that reads as freshly measured |
| **N-x** | *A cell hash travels with its normalisation stated* — raw content, no trailing newline | CC's `7df1546a` / `7f44cfd5` note |
 
### Also carried to D5
 
- **§13.2's lesson**: the recon named `not-found.test.tsx` as a pinning suite **without opening it**; it does not move, and the suite that does — `page-container.test.ts` — surfaced two rounds later from a different question.
- **Eight distinct table schemas** across the three governance files commit 0 writes into. A finding about the corpus, not about `.3`.
- **`D-J`**: d5's market-detail bar is structurally a one-row `.barrow`, not the two-row form shipped. Fenced out of PR 1 by `PD-3-01`'s *"only the numbers are open"*; recorded so it is not refiled as a fresh defect.
---
 
## §6 · What could still go wrong, ranked
 
| Risk | Basis | Mitigation |
|---|---|---|
| **Gate C on PR 1 takes 3+ rounds** | `.8` took four | B2–B6 are five small commits, each independently green — a finding is scoped to one |
| **PR 2's plan chat repeats PR 1's ten-relay shape** | this chat | §1's one-time table. If PR 2 passes six relays, stop and ask what is being rediscovered |
| **`main` advances between PR 1 and PR 2** | staging advance, other lanes | Every PR-2 measurement is re-taken at C1. Do not carry a coordinate across a merge |
| **RR-3's composer exception is under-scoped** | it is a deny-listed directory on a class-F INV-3 defect | PR 2's plan names the exception by file and by symbol, with its own ⛔ set |
| **Web authors another defect into a prescriptive pack** | GC-1…GC-5: four of five were web's | Gate C caught all five before merge. **The contract held: CC committed verbatim and reported rather than silently fixing** |
 
---
 
## §7 · ⚠ DEADLINE — a measurement is owed, and I am not asserting a slip
 
Today is **2026-08-13**. Go-live is **2026-09-15** — **33 days**.
 
**Closed:** `.1` · `.7a` · `.2` · `.8` · PERF-1 · STAGING-PARITY · SYNC-1 · PRIMITIVES-1/2 · SPEC.CHART.
**Open:** `.3` (≈30 steps, 4–5 chats) · **`.4` Composers — full ritual** · `.5` Profile · `.6` Bookmarks · REGISTER-APPLY · the comprehensive founder visual pass across **all** surfaces · HARDEN · TESTING · DP.2 · Resend DNS.
 
⚠ **`.3` is the first full-ritual two-PR surface, and it is measuring at roughly three times POLISH.8's whole-run cost.** `.4` is also full ritual and also carries `RR-3`.
 
**I cannot tell you whether 2026-09-15 holds without re-measuring `.4`/`.5`/`.6` against what `.3` actually cost.** That measurement is worth **one session** and it is worth taking **before** PR 1 starts, not after `.3` closes — because the lever it might pull is a scope decision, and scope decisions are cheapest before work begins, not after.
 
**Recommendation: take the measurement at A1**, in the same session as the merge. If it says `.4`–`.6` cannot fit, the options are, in order of preference: **(a)** downgrade `.4` from full ritual to a single gated pass on measured grounds · **(b)** route `.5`/`.6`'s V-class rows to the comprehensive founder pass and ship their F rows only · **(c)** move go-live. **The timeline is fixed and scope flexes against it** — but only if the flex is chosen deliberately and early.
 
---
 
*Authored by web Claude, 2026-08-12 IST. Sequencer only. Re-read at every close-out and kickoff; verify each prerequisite against the live repo before naming the next step.*
