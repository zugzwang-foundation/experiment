# POLISH — Phase Tracker · ⛔ RETIRED 2026-08-18

> **This document is HISTORY. Do not read it for state and do not update it.**
>
> **Retired at SYNC-2** on a founder ruling that POLISH is a **rolling refinement lane, not
> a phase with a close**. A phase sequencer for a thing that is not a phase can only go
> stale again, and this one already had: four of its nine status rows were falsified by
> merges the repository itself contained, and it carried **zero** mentions of HTML-FINISH —
> the lane that moved more surfaces than any other.
>
> **Where its content went.** Surface state → the project tracker (operator-maintained and external to this repo; read its version off the tracker itself). Docket
> rows → `docs/parked.md`, where they already were. Method → `POLISH-0.md`. Runbook →
> `POLISH-SURFACE-TEMPLATE.md`. Defects → `POLISH-register.md`. **Nothing below is
> restated in any of them, and nothing below is current.**
>
> Kept rather than deleted because its gate ledger (B1–B12, C3) is the only record of how
> those gates were discharged, and because a deleted sequencer leaves its citations
> dangling. **A citation to this file is a citation to history.**

---

## §1 · Status map

**Verified state, not listed state.** A gate listed is not a gate closed.

| Surface | Machine phase | Founder pass | Gates | Ritual | Next action |
|---|---|---|---|---|---|
| **.1 Shell** | ✅ #288 · #289 · #290 | ❌ | **CLEAR** — B4 void · B8 struck · B10 closed | — | Joins the comprehensive pass |
| **.7a Auth** | ✅ **#320** `86a245f` | ❌ | **none** | single gated pass (⚠ the reviewer cascade ran anyway, and returned a CRITICAL) | **OPEN, not closed** — joins the comprehensive pass |
| **.2 Discovery** | ✅ #306 · #311 · #312 · #313 | ❌ | **CLEAR** — B2 closed #276 | — | Joins the comprehensive pass |
| **.3 Market Detail** | ⏳ **RUNNING** | ❌ | **CLEAR** — B1 · B2 · B3 · C3 **all closed** | **full ritual** | ▶ Plan committed at `docs/plans/POLISH-3.md`; **two PRs**, FRAME then CARDS. ⚠ **Inherited rows are ENUMERATED in `POLISH-register.md`'s POLISH.3 table and are not counted here** — this cell previously carried a count that had drifted one behind the register (§13.3). ✅ R13 RULED 2026-08-12 — the chart overlay is inspectable (SPEC.1 §9 F-DEBATE-5 + canon `C-CHART-1`) |
| **.4 Composers** | ❌ | ❌ | **CLEAR** — B1 closed | **full ritual** | ▶ after .3. Co-owns RR-3 |
| **.5 Profile** | ❌ | ❌ | **CLEAR** — B1 closed | single gated pass | ⚠ **REGISTER-APPLY first** |
| **.6 Bookmarks** | ❌ | ❌ | **CLEAR** — B1 closed | single gated pass | ▶ after .5 |
| **.8 Admin** | ✅ **#323** `f6d9775` | ❌ | **none** — was pullable forward | single gated pass (⚠ the reviewer cascade ran anyway, twice, and returned a HIGH each time) | **OPEN, not closed** — joins the comprehensive pass. No tier-4 baseline; §7 criterion 1 does not apply |
| **.7b Onboarding** | ❌ | ❌ | ⛔ **O1** | — | Blocked. Not a POLISH problem to solve |

**Eight of nine are gate-clear.** `POLISH-0.md`'s original gate line implied four blocked surfaces; three of those four blocks had already evaporated when it was written. Only `.7b` is blocked, and its blocker is O1.

**Four machine runs remain** — `.3 · .4 · .5 · .6`. `.1`, `.2`, `.7a` and now `.8` have had theirs and join the comprehensive founder pass directly. ⚠ **A machine phase does not close a surface**: `.8` is OPEN until the founder pass runs, exactly as the other three are.

### Gate ledger

| Gate | Subject | State |
|---|---|---|
| **B1** | BOOKMARK-ADD-WIRE | **CLOSED** — plan and log both on `main`; ADR-0033 was its execute gate |
| **B2** | PCT.ROUND | **CLOSED** — PR #276; `formatPricePercent` is the single percent path |
| **B3** | F-DEBATE-4 polling | **CLOSED** — plan + log on `main`, behaviour pinned at `tests/unit/debate/render/poll.test.tsx` |
| **B4** | UI.11 AGPL footer | ⚠ **VOID** — withdrawn, not deferred. SPEC.1 v1.0.26 `:1498`. The §13 obligation survives, relocated to the ToS body |
| **B8** | P4 freeze banner | ⚠ **STRUCK from `.1`** — SPEC-blocked on the unwritten §21.7 rider, and it renders only at freeze. Not inspectable in the window even if built |
| **B10** | 404 boundaries | **CLOSED** — `acc2e03` (#283) |
| **B11** | "Read more" | **NOT CLOSED** — zero occurrences repo-wide. `PD-0-01`. ✅ **No longer blocked on a ruling** — R4 RULED 2026-08-12, adopt. Scheduled to **POLISH.3 PR 2** for the `.3` site, then `.5` and `.6` |
| **B12** | `text-white` | **NOT CLOSED** — one site, `audit/page.tsx:75`. `.8`'s row |
| **C3** | CD-A pop-up close-out | **CLOSED** — `54b0b2a` (#278), five days before the document that called it uncommitted |

---

## §2 · Phase gates

**No ruling blocks the phase.** All nineteen are resolved in `POLISH-0.md` §0, and **zero are OPEN as of 2026-08-12** — R13, the last one, closed at `design-canon.md` §10 `C-CHART-1`. ⚠ **The per-state counts are deliberately NOT restated here.** This sentence previously carried *"eight ruled, nine scheduled … one open"* and had drifted from §0's table, while §0's own sentence had drifted differently again — two copies of one measurement, both wrong, disagreeing with each other and with the index. **§0's index is the count. This row points at it and does not re-derive it.**

| | Gate | Effect |
|---|---|---|
| **R13** | ✅ **RULED 2026-08-12 — no ruling in the index is OPEN.** `SPEC.CHART` is confirmed a phantom (absent repo-wide), but the chart's tier-1 baseline is **SPEC.1 §9 F-DEBATE-5** + eight §17 rows, and its presentational baseline is now **canon §10 `C-CHART-1`** | POLISH.3 inspects the overlay normally. `PD-0-16` reclassed **S → R** and closed. One new row minted for `.3` — `PD-3-04`, the overlay's missing accessible summary, a tier-1 conformance gap |
| **R4 · R10 · R14** | ✅ **ALL RULED 2026-08-12** at POLISH.3's kickoff | Dispositions taken; the full text is at `docs/plans/POLISH-3.md` §3 and the index states are in `POLISH-0.md` §0. **R4** → adopt "Read more" (`.3` PR 2 · `.5` · `.6`) · **R10** → `accepted-divergence`, canon `C-PRICEBAR-1`, founder-set P12 · **R14** → two rows, ✅ **minted as `PD-3-05` / `PD-3-06`** |
| **R11 · R12** | Scheduled to `.5` / `.6` | ⚠ R12's INV-3 arm already shipped; only cosmetic consolidation remains |
| **R7** | Scheduled to `.8` | One line |
| **R15** | Guard to mint, not a product ruling | Quality lane. B12 is its one live instance |

---

## §3 · Inherited work

Already owned. **An inspection that rediscovers one of these files `duplicate-of-known` and cites the ID. It does not open a second row.**

| Item | What | Owner |
|---|---|---|
| **RR-3** | ✅ **FIXED — no longer live.** ~~A LIVE INV-3 pole inversion at `composer/ReplySplitBar.tsx:64,67` on `/m/[slug]`~~. **Re-fenced by symbol (`O-8`):** the split-bar **track** span and its **fill** child in `ReplySplitBar.tsx` were the defect; the *correct* sibling pole the row cited is **`TriggerPill`'s `pole` const**, same file. ⛔ **BOTH original coordinates were stale, not one** — `:64,67` now lands inside the explanatory comment block, and `:118-122` was the sibling pole's old address; **the drift was introduced by the very commit that fixed the defect.** ⚠ **The `INV-3` label is SUPERSEDED** (`docs/plans/POLISH-3-PR-2.md`): INV-3 is a *storage* invariant and a Tailwind class cannot violate it — the rule broken is the design-language **axis correction** + `AGENTS.md` §8's *"the poles name the SIDE (YES/NO), never the Support/Counter relation"*. Class F stands; the ground changed | ✅ **`.3` TOOK IT — PR #339** (`54f3962`, commit `9f86076`, C13), attended, `@code-reviewer` + `@security-auditor`. Verified at head: both spans side-key on `postSide`. **`.4` RECORDED THE ADOPTION — `PD-4-01` / `PD-4-02`, POLISH.4 PR A**, closing all three sites that still asserted it open. ⛔ `.4` does not touch the symbols |
| **PD-2-32** | ⚠ **A PRODUCTION defect, not staging-only.** A minted R2 URL that later 404s has **no degradation path**. Three sites — `MarketCard:53`, `HeroPanels:64`, and the hero POST image, which handles null but has no `onError`. **One shared `MarketThumb` owning null · error · loaded** — never N patched `<img>`s, which is how the three-implementation problem happened | ✅ **CLOSED** — PRIMITIVES-2 PR-A, #317 (`143380b`). `MarketThumb.tsx` owns all three. ⚠ `onError` alone did not discharge it — §11 D2-P1's mount check did |
| **PD-2-33** | Market-thumb `alt` duplicates the adjacent title, and is what makes the failure *overflow*. ⚠ **Lands WITH PD-2-32** — fixing it alone hides the symptom | ✅ **OVERFLOW HALF CLOSED** — PRIMITIVES-2 PR-A, #317 (`143380b`), both thumbs `alt=""`. ⚠ **The a11y half (WCAG 1.1.1) stays OPEN at A11Y.0**, exception rowed at `OQ-6-ALT-EXCEPTION` |
| **PD-3-01** | `PriceBar`'s `detail` is a **named transitional preset**, pinned byte-identical so `/m/[slug]` had zero delta. d5 specifies 14px/10px. The seam exists; only the numbers are open | **`.3`** |
| **SideBadge presets** | ✅ **NOW OWNED — the rows exist.** ~~UNOWNED — no register row exists … a one-member union~~ was true until PRIMITIVES-2 PR-B (#318, `0ff2733`). **The SEAM landed**: `CHIP.detail` (10px) and `CHIP.profile` (8.5px) exist, the union is three-member, both are render-tested at both poles, and **zero call sites are wired by ruling D5** — a guard asserts it stays so. The `.6` routing error was corrected in `badges.tsx:18`; `DISCOVERY-COMPLETE.md` is a landed historical plan and was deliberately left alone, so **`PD-5-01` is the correction of record**. ⚠ Do **not** reuse `CHIP.profile` for d5's `.sm` sites — d5 carries contextual `border-radius:4px` overrides (`:882`, `:911`) a flattened preset cannot express | **`PD-3-03`** (`.3`) · **`PD-5-01`** (`.5`) — minted; adoption is theirs |
| **RR-4** | `PositionMarker` outline → filled on `/bookmarks` and `/u/[pseudonym]`. **Founder-ACCEPTED known delta** — the adoption that delivered the missing `aria-label` | **Do not re-file.** `.5` / `.6` inspect the consolidated state |
| **CC-9** | `(admin)/…/ReviewFeed.tsx:102-104` hand-rolls a side chip. Correct today, **excluded from the pole guard by directory**, and it is the chip the operator reads sides from while moderating. It can drift with nothing on disk going red | **`.8`** |
| **PD-0-01** | `<Plus /> Full` where CD-A ratified "Read more". Zero occurrences repo-wide, re-verified 2026-08-10 | **`.3` PR 2 · `.5` · `.6`** — R4 RULED 2026-08-12, adopt. ⚠ `.5`/`.6` are a **different remedy**: bare CSS clamps with no affordance at all, so an *addition*, not a rename |
| **C0 inventory** | The pole guard's `PERMITTED_FILES` is **deliberately brittle**. Each new pole site is a **decision** — add the file explicitly with a reason. **Never relax the predicate** | every surface |
| **CC-2** | `AGENTS.md` §3 still carries the superseded round-trip form. The reusable one is `1 + 12N`, machine-pinned | doc sweep |
| **CC-5** | Spec↔code drift on `price_at_bet` — `debate-export.md:177` and `SPEC.2.md:2721` both say the entry price is the market YES-probability; the engine stores the **bought side's** price. The shipped export is numerically correct; the prose is not. ⚠ **SPEC.2 is web-authored — CC must not draft it** | founder-authored doc sweep |
| **REGISTER-APPLY** | ✅ **PARTIALLY DISCHARGED — §A's six `PD-5-nn` rows are applied**, at POLISH.5/.6 commit 0 (2026-08-14), as `PD-5-03` … `PD-5-08`; ID-cell **struck, never deleted**, per `POLISH-register-ADDITIONS.md:90`. ~~11 rows in POLISH-register-ADDITIONS.md are unapplied, six of them PD-5-nn. POLISH.5's register table reads empty while carrying six rows.~~ ⛔ **Both halves of that second sentence were false BEFORE this commit, and the first is now false too.** ⚠ **Remainder — FIVE, enumerated not subtracted:** `SP-1` · `SP-2` · `SP-3` (§B) · `PD-1-nn` (§C) · `DRIFT-1` (§D). **Not one is a `PD-5-nn`.** ⚠ **Table state, MEASURED at head — POLISH.5's body carries EIGHT rows**, and it was never empty: `PD-5-01` already held `POLISH-register.md:162`, the six §A rows were never *in* it, and the eighth is **`PD-5-09`** — the `OD-8` first mint, allocated off the live high-water per `docs/plans/POLISH-5.md` §1.7 and **not** from §A. **Allocate real numbers from the live high-water mark and route per the file's own checklist** — still owed for the five. ✅ **Two were applied at POLISH.3's commit 0 (2026-08-12) as `PD-3-07` and `PD-3-08`**, so checklist item 4 has now run **twice** — POLISH.3, then POLISH.5. ⚠ **The "before `.5`" timing was wrong about WHEN** — two of §C's three rows were `.3`'s and `.3` ran first; the date beside is a floor for the remaining five, not a start. ⚠ **§C's surviving row is routed to POLISH.1, whose machine phase is already complete** (#288 · #289 · #290) — its only remaining venue is the comprehensive founder pass, and it needs a named owner there. ⚠ **This file joined commit 0's allow-list as its TENTH path, for this edit alone** — `O-5`: the commit that discharges `REGISTER-APPLY` must not leave the row that tracks it asserting the opposite | **before `.5`** |

---

## §4 · Beside the lane

Dated or triggered, none blocking a machine run.

| Row | When | Note |
|---|---|---|
| **PRIMITIVES-2** | ✅ **CLOSED 2026-08-11** — #317 (`143380b`) · #318 (`0ff2733`) | Scope in §5. ⚠ Carried `.7a`'s and every later surface's shared presets. **Seam only** — `SideBadge`'s `detail`/`profile` exist and are render-tested, **zero call sites wired** (D5); adoption is `PD-3-03` / `PD-5-01`. Item 5 reduced to seam-only by D8, a recorded departure; the other 12 micro-labels are `MICRO-LABEL-TIER`, routed to `.4` |
| **A11Y.0** | dated | **Scope: keyboard reachability · accessible names · visible focus.** WCAG 2.2 AA scoped past the experiment. Already has a backlog — `PD-2-06`, `PD-2-10`, `PD-2-33`, POLISH-1a's `title` reach. Surfaces close `closed (a11y-deferred)` until it lands |
| **SPEC.1 §21.7 rider** | **before 2026-11-05** | The sole thing gating the freeze banner. `SHELL-COMPLETE.md:73`: the rider is **small** — the copy is already ratified and shipped; it needs a second home, not new copy. Web-authored, no code |
| **R2-KEY-OPACITY** | **2026-09-05** | The R2 object key embeds `users.id`, emitted anonymously. §16.5 erasure defeat. Pre-existing |
| **RATE-GUARD-PUBLIC** | **2026-09-05** | No rate limit on anonymous RSC renders. Applies to `/`, `/m/[slug]`, `/u/[pseudonym]` and the `.md` export — size across all four |
| **STAGING-FIXTURE-DISCOVERY-SHAPE** | **2026-09-05** | ⚠ **Land PD-2-32 FIRST.** Fixing the fixture would **hide** the defect without fixing it. The set is md5-pinned — a change is a deliberate re-pin, never an edit |
| **O1-KICKOFF-INPUT** | → O1's kickoff | All eight markets open on 2026-09-15 with **zero posts**, so every hero frame renders both-sides-empty. ⚠ Any fix involving posts crosses market-content invention — the founder's, not a build choice. **Decided, not discovered, on the day** |
| **MOD-REPORT-PATH** | ✅ **RULED 2026-08-12 — closed** | **User-facing reporting is OUT OF SCOPE for the experiment phase.** Decision of record: `docs/adr/0021-reactive-moderation-no-held-queue.md` · Patch record 2026-08-12. ⚠ **`.3` IS NO LONGER BLOCKED BY IT** — the prerequisite is discharged, and `.3`/`.4` inherit a ratified absence, not a hole. An inspection that rediscovers the missing REPORT control files `duplicate-of-known` against the patch record and opens no row. Re-open on any one of: operator can no longer read daily volume · the phase extends past 2026-11-05 · one observed contextual-class miss → **HARDEN** |
| ~~**SPEC.CHART**~~ | ✅ **CLOSED 2026-08-12** | R13 ruled. Neither arm taken — **the record was corrected instead.** Tier 1 was SPEC.1 §9 all along; the presentational gap landed at canon §10 `C-CHART-1`. New docket: **CHART-NODE-RING** |
| **ADR-0006-DISCIPLINE** | opportunistic | Holds one known unpushed commit |
| **AUTH-TURNSTILE-WIRE** | **2026-09-05**, with RATE-GUARD-PUBLIC | ⚠ Opened by `.7a` (#320). The widget is unmounted; the server half is BUILT and fails closed. Carries `PD-0-14`, `PD-7a-16`, `PD-7a-10`, `PD-7a-14`. **`ADR-0033` §Constraints binds it** — resend↔sign-in token parity, and the two sites are structurally asymmetric so a one-sided wiring fails SILENTLY (the resend path 200s regardless) |
| **AUTH-ERROR-COPY** | **pre-go-live** | ⚠ Opened by `.7a`. Tier-1-named in `ADR-0033` §Scope. Raw codes render to anonymous visitors — `otp_rate_limited` (NOT `rate_limited`, which is POLISH.4's) and **`identity_pool_exhausted`, a pool-drain progress oracle**. ⚠ The three a user reaches are produced INSIDE `src/server/auth/**` — critical path. **Co-execute with AUTH-OTP-FIDELITY**: same file, one ritual |
| **AUTH-OTP-FIDELITY** | **pre-go-live** | ⚠ Opened by `.7a`. `PD-7a-07` (6-box entry) + `PD-7a-08` (resend cooldown). Without the cooldown, mashing Resend produces the raw code AUTH-ERROR-COPY exists to fix — **one user experience, one task** |
| **AUTH-ONBOARDING-GATE** | **pre-go-live** | ⚠ Opened by `.7a`. `PD-7a-09`. **Tier-1 SPEC-LOCKED** — SPEC.1 §13 F-AUTH-4 requires Continue disabled until the checkbox is ticked, and §13's UI/UX note forbids relaxing it without an ADR. **NOT unsafe today**: `required` blocks submission and `acceptTosAction` re-checks server-side |
| **AUTH-GOOGLE-MARK** | **founder decision, undated** | ⚠ Opened by `.7a`. `PD-7a-06`. Sits between DESIGN.B1's CI-guarded TRUE-NEUTRAL system and Google's sign-in branding guidelines. **Not go-live-gating** — text-only is a shipping state |
| **AUTH-HARDEN** | **pre-go-live** | ⚠ Opened by `.7a`. **Seven items**, and item (3) leads: the OTP sender's `Sentry.captureException` is UNFLUSHED while `ADR-0033` designates it the SOLE mitigation for a ratified HTTP-200-on-failure design. Also XFF spoofability, a `beforeSend` scrubber, **participant emails egressing to Sentry in the URL query string**, the siteverify fetch ordered ahead of both limiters, no boundary reporting to Sentry, and `users.name`/`image` client-writable. ⚠ **`src/server/auth/**` is a CLAUDE.md §1 CRITICAL PATH — its own chat, full ritual** |
| **LEGAL.1** | ⚠ **GO-LIVE GATE, before 2026-09-15** | ⚠ Opened by `.7a` (absorbing `HARDEN.6`/`HARDEN.7` as aliases — the same deliverable was named three ways). ToS and Privacy bodies are Lorem ipsum and are rendered IN FULL on the acceptance screen, so a participant accepts placeholder text on the screen whose purpose is recording that acceptance. Carries the version label and **the AGPL §13 source offer, which relocated INTO the ToS body when B4 voided the footer**. Its own chat |
| **AUTH-FIRST-LOGIN** | trigger: **re-verify at kickoff** | ⚠ Opened by `.7a`. An A7-ledger name carried since 2026-07-22 with **no definition anywhere on `main`**. First action is to establish whether a defect exists at all |
| **NO-RAW-HEX-REACH** | with **R15**, quality lane | ⚠ Opened by `.7a`. Reach CLOSED; **two residuals open** — the alive check is a floor not set equality (N5), and the structural `SCAN_DIRS` fix (O-1) would also cover `_components/`. One visit, three fixes |

> **Standing rule.** A routing destination named in a committed document gets a `docs/parked.md` row **in the same commit**. Six were named across this corpus with none — two of them load-bearing. A phantom prerequisite is worse than a deferred one.

---

## §5 · Sequence

```
POLISH-TEMPLATE ✅ ─▶ PRIMITIVES-2 ✅ ─▶ .7a ✅ ─▶ .8 ✅ ─▶ .3 PR 1 ✅ ─▶ .5 PR A ✅ ─▶ .5 PR B ─▶ .6 ─▶ .5 PR C ─▶ .3 PR 2 ─▶ .4
     (closed)          (closed 08-11)   (#320)   (#323)   (#328)      (#331)        ▲
                                                                                    NEXT — after DOC-1
                                                 plan PARALLEL · execute SERIAL
                                                          │
                                                          ▼
                                        ONE comprehensive founder visual pass
                                          (.1 · .2 · .7a · .8 join here)
                                                          │
                                                          ▼
                                         refinement PRs  ─▶  close-outs
```

⚠ **Live as of 2026-08-14.** `.5` PR A merged (#331). **DOC-1 is the doc-only commit before PR B branches.** `.6` is hard-blocked on PR B by three measured mechanisms (`POLISH-5.md` §0.3). **`.3 PR 2` gates nothing in `.5`/`.6`** (`D-4`) and files its own adoption record at its own close-out.

**Execute serial** means **one machine-phase PR open at a time** — so a regression bisects to a surface and Gate C never queues. Recon and classification for several surfaces may be drafted concurrently.

⚠ **`.8` RAN OUT OF ORDER AND THAT WAS RATIFIED.** It was pulled forward on 2026-08-12 because it was gate-free and `.3`'s kickoff was blocked on MOD-REPORT-PATH (since resolved at #322). `.3` IS NEXT — the heaviest surface in the set, full ritual, with SPEC.CHART now landed (#324/#325).

⚠ **R-G's batch lever is now spent for `.8`** — it ran standalone rather than batched with `.5`/`.6`, on the ground that a classification held across two full-ritual runs goes stale (a counted inventory went 9 → 13 inside one PR). The lever remains available for `.5` + `.6`.

*Why `.7a` ran first, recorded as the rationale for a decision already executed:* it was the cheapest surface, gate-free, and `.1`'s machine phase had already run. Shell-first was **discharged, not abandoned**. ⚠ **This is the record of a past ordering call, not a live instruction** — `.7a` closed at #320 and the sequencer above now points at `.3`.

### ⚠ PRIMITIVES-2's binding condition

> **The secondary text tier and the emphasis ladder land as NAMED PRESETS, not inline classes.**

This is not a style preference. **It is what makes deferring the founder's visual pass safe** — a later ruling becomes one line per preset instead of a six-surface sweep. **If they land inline, that safety property is gone and the batched pass must be revisited.** A ruling with no revert condition is a one-way door.

✅ **MET at PRIMITIVES-2 PR-B (#318, `0ff2733`), and proved by naming the line rather than asserting it.** Both held rulings are now a one-line edit in one named place:

| Held ruling | The line | What a ruling replaces |
|---|---|---|
| **PD-2-08** — the active carousel ring | `src/app/globals.css:178` | `--ring-active: 1.5px solid var(--color-n4);` |
| **OQ-2** — the replyhead text tier | `src/components/discovery/HeroPanels.tsx:52` | `"text-[9.5px] font-bold tracking-[0.12em] text-n4 uppercase";` |

⚠ **The mechanism is CSS custom properties for the ladder and a TS constant for the text tier, not one uniform "preset" host** — ladder rung 1 was already `--hairline`, so rungs 2 and 3 joined it there (D9) rather than splitting one ladder across two mechanisms. **The batched pass does NOT need revisiting**: the safety property the condition was written to secure holds. What was *not* delivered is the literal 14-site normalisation — reduced by D8, recorded as a departure in plan §4.2, and carried by `MICRO-LABEL-TIER` to `.4`.

PRIMITIVES-2's scope, from evidence already on `main`: `MarketThumb` (PD-2-32 + PD-2-33, landing together) · the `SideBadge` d5/Profile presets · ~~`ui/avatar.tsx`'s `mix-blend-darken` on its two unfixed consumers~~ (**struck at PRIMITIVES-2 D1 — already discharged at PRIMITIVES-1 D6 / `997f308`, PR #293, which removed the blend AT THE PRIMITIVE; `mix-blend` has zero occurrences in `src/` and `avatar-ring-token.test.ts:72,83` pins the absence**) · the secondary text tier and emphasis ladder **as presets**. Every preset defaults to today's render, proved not asserted.

---

## §6 · Cost, stated plainly

| Stage | Founder-serial sessions |
|---|---|
| PRIMITIVES-2 — plan ratify + Gate C | 2 |
| Six machine runs — 6 ratifications + 6 Gate C · ⚠ **ESTIMATE**, 2 per run; **one run is now measured at 8 against it** (below) | 12 |
| One comprehensive visual pass | 1, long |
| Refinement PRs | 3–6 |
| **Total** | **~18–21** |

⚠ **THE BUDGET NOW HAS ONE MEASURED RUN AGAINST IT, AND THE FIGURE IS FOUR TIMES THE ESTIMATE.**

⚠ **The measurement is stated HERE, in prose, and is deliberately NOT a row in the table above.** It is a measurement *against* the 12, not an addition *to* it — as a sibling row it read as one, and the column then summed to 26–29 while the Total still said ~18–21. `POLISH-SURFACE-TEMPLATE.md` §12 records the near-identical failure — *a stale count in the footer agreeing with a broken parse* — and here the two did not even agree. **The table keeps its five rows and its original Total; the number lives in the sentence.**

The row above budgets **2 founder-serial touches per machine run** (12 for six). **TWO RUNS ARE NOW MEASURED AGAINST IT AND BOTH EXCEEDED IT BY A LARGE MULTIPLE.**

**`.7a` — the cheapest surface in the set, gate-free, three routes, nothing under `src/server/**` — cost EIGHT.** Spent on: **recon** · **plan ratification** · **execute** · **a correction gate** (D19's exception had been granted on the wrong file) · **Gate C** · **Gate C remediation** (five blocking items) · **the close-out** · **a close-out remediation round**. ⚠ That is eight items and the enumeration formerly listed seven — corrected at the POLISH.8 close-out, `PD-8-26`. **Two of the eight were not in the estimate at all** — the correction gate and the remediation round — and both existed because the RECORD was wrong, not because the code was.

**`.8` — no tier-4 baseline, no shell, no gates, one hard invariant check — cost TEN.** Spent on: **kickoff + rulings** · **recon return and classification** · **plan + overnight execute relay** · **Gate C read 1** (four blocking items) · **read 2** · **read 3** · **read 4** · **the cross-chat guardrail check** · **staging advance** · **this close-out**.

⚠ **AND THE ATTRIBUTION MATTERS MORE THAN THE FIGURE. SIX of `.8`'s ten were caused by defects in the RELAYS, not by the code and not by the record:** the stop condition that forbade committing the plan it mandated · an edit boundary drawn around source files that forgot behaviour is pinned by tests · a ruling that traded a moderation safety control for a build fix without noticing · a spanning proof set blind to one field · a guard axis specified as a directory when the property was an import closure · a probe instructed to plant a token the guard does not scan, which would have passed vacuously.

⚠ **The bottleneck has MOVED.** `.7a`'s overrun was the record being wrong. `.8`'s was the instructions being wrong. **`.3` and `.4` are next, both full ritual and both heavier than either measured surface.** The lesson is in `POLISH-SURFACE-TEMPLATE.md` §13, minted at this close-out: **run the plan against its own stop conditions and its own edit boundary before shipping the relay.**

**This is a MEASUREMENT, not a forecast.** Whether the remaining four cost 2 each or 10 each is a founder ruling, not a CC one. The figures are stated; the re-forecast is left open.

**R-G's batch lever is PULLED for `.5` · `.6`** (POLISH.7a plan §2 R-G): their recon and classification are drafted concurrently and ratified in **one** session. ⚠ **`.8` is struck from that set — it ran STANDALONE at #323**, on the ground that a classification held across two full-ritual runs goes stale (a counted inventory went 9 → 13 inside one PR), and because it had been pulled forward specifically to use a slot `.3` could not. **Execute stays SERIAL — one machine-phase PR open at a time — and Gate C never batches.** Not applicable to `.3` or `.4`.

**The binding constraint is founder-serial capacity, not calendar** — `tracker_v20` §10 holds the project budget and this file does not restate it. Two levers, if it binds:

- **Batch ratification.** Several surfaces' classified delta tables in one session takes 6 rounds to 2. It is a paper gate; batching changes nothing about safety. **Gate C cannot batch** — each is a diff-read of a distinct PR.
- **`.8` Admin.** No tier-4 baseline by ratification, so it has no parity criterion; its bar is already token consistency + functional completeness + one invariant check. Pullable forward, or deferrable, at low cost either way.

---

## §7 · Close conditions

A surface closes when `POLISH-0.md` §7's exit bar holds — **not before, and not on "looks fine."**

Both phases must have run. **A surface is not closed on its build half.** POLISH.2 is the standing example: its machine phase is complete across four merged PRs and the surface is deliberately open, because criterion 1 — parity by eye at 1440 — is the founder's and has not run.

Surfaces close as **`closed (a11y-deferred)`** until A11Y.0 lands. The qualifier is honest rather than aspirational: four a11y findings already route to a workstream that until 2026-08-10 had no row.

At each close: **one batched summary row** into `tracker_v20`. Never row by row.

---

*Amended 2026-08-11 at the POLISH.7a close-out: §1 `.7a` machine phase ✅ at #320 `86a245f` (surface OPEN — the founder pass has not run) and `.3` promoted to RUN NEXT · §4 gains the nine docket rows `.7a` opened · §5 sequence advanced · **§6 carries the first MEASURED cost against the budget — eight founder-serial touches where two were estimated — with the re-forecast left to the founder.** Every `POLISH-0.md` pointer in this file and in `POLISH-register.md`/`parked.md` converted from line numbers to SECTION ANCHORS per **V-8**.*

*Authored by web Claude, 2026-08-10 IST, at the POLISH-TEMPLATE task. Ground `origin/main` @ `35d041d`; every gate and every carry-forward verified against the repo rather than against a document asserting it. Beside `tracker_v20.md`, which stays canonical for the project.*
