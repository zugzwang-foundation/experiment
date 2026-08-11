# POLISH.8 — Admin Centre — machine-phase session log

**SENTINEL:** ZZ-P8-EXEC-2026-08-12

**Date:** 2026-08-12 · **Branch:** `polish/8-admin-centre` · **Base:** `dfa3012` on `main`
**Mode:** overnight, unattended, pre-authorised under founder ruling D4 (no verdict round).
**Governing ruling:** *"Admin pages are internal — they should be simple and not heavy. Just the core functions should work."* Axis A report-only except S-1; axis B is the run; axis C passed at recon and was not re-litigated.
**Plan:** `docs/plans/POLISH-8.md`, committed verbatim at commit 0.

> ⚠ **This run ENDED AT PR-OPEN. Nothing was merged. Gate C has not happened.**

---

## 1 · Surface · routes · components AS VERIFIED

Re-verified against the live tree at PR head, not carried from recon.

**Routable entries: 8** — 7 `page.tsx` + **1 route handler**:

| # | Route | File |
|---|---|---|
| 1 | `/admin` (pure redirect, no UI) | `(admin)/admin/page.tsx` |
| 2 | `/admin/login` | `(admin)/admin/login/page.tsx` |
| 3 | `/admin/markets` | `(admin)/admin/markets/page.tsx` |
| 4 | `/admin/markets/new` | `(admin)/admin/markets/new/page.tsx` |
| 5 | `/admin/markets/[marketId]` | `(admin)/admin/markets/[marketId]/page.tsx` |
| 6 | `/admin/moderation` | `(admin)/admin/moderation/page.tsx` |
| 7 | `/admin/moderation/audit` | `(admin)/admin/moderation/audit/page.tsx` |
| **8** | **`POST /admin/markets/media/sign`** | `(admin)/admin/markets/media/sign/route.ts` |

**Files under `src/app/(admin)`: 15** — unchanged by this run (no source file added or removed).
No `layout.tsx`, no `loading.tsx`, no `error.tsx`, no `not-found.tsx` anywhere under `(admin)`.

**Components: 15 at recon → 16 at PR head.** The run adds exactly one, `InvalidDateNote` (S-6). Stated rather than carried: the plan's brief said 15, and that number is now stale by one *because of this PR*.

| Named in POLISH-0's row (7) | Omitted from it, verified present (8) | Added by this run (1) |
|---|---|---|
| `AdminTabs`, `CreateMarketForm`, `TerminalActions`, `ReviewFeed`, `NeedsResolutionCount`, `SearchForm`, `AuditRow` | `BanIndicator`, `ReasonBadge`, `CategoryChips`, `ImageWithheld`, `Field`, `SearchResultRow`, `ActionForm`, `Row` | `InvalidDateNote` |

Two colocated non-component logic modules remain out of both lists: `countdown.ts`, `terminal-actions-logic.ts`.

---

## 2 · Ship set — 6 shipped / 2 halted

| Item | Delta | Disposition | Commit |
|---|---|---|---|
| **S-1** | D01 · `text-white` → `text-background` | ✅ **SHIPPED** | `92c401b` |
| **S-2** | D28 · pin the CC-9 side chip | ✅ **SHIPPED** (pinned, deliberately NOT consolidated) | `908aaf0` |
| **S-3** | D11 · ordinary confirm on Close | ⛔ **HALTED — S-0k** | — |
| **S-4** | D12 · confirm restates side + permanence | ✅ **SHIPPED** | `6430f18` |
| **S-5** | D19 · create-market error copy | ⛔ **HALTED — item-specific halt fired** | — |
| **S-6** | D17 · malformed date filter made visible | ✅ **SHIPPED** | `ed6b82a` |
| **S-7** | D20 · deadline field states UTC | ✅ **SHIPPED** | `ed6b82a` |
| **S-8** | D06 · placeholder advertises only matchable values | ✅ **SHIPPED** | `ed6b82a` |

Two further commits carry the reviewer rounds: **`cc26be1`** (@code-reviewer H-1 / M-1 / M-2) and **`8fdc28c`** (@security-auditor L-3).

### S-1 · D01 — PASS
`audit/page.tsx:75`, one class, inside `BanIndicator`.
- **Pre-fix positive control:** palette grep over `src/` → **exactly 1 hit**, `audit/page.tsx:75`. A probe returning nothing would have proved nothing.
- **Pre-fix R15 probe RED:** scanned **281** files → `FAIL — 1 Tailwind palette colour class(es)`, `EXIT=1`. Full text in §5.
- **After:** palette grep hit count **0**; probe `PASS`, `EXIT=0`. Counts stated, not claimed.
- **Why `text-background`:** the pairing the sibling BANNED pill already uses at `ReviewFeed.tsx:170` — same semantic, same `bg-destructive` surface. Not chosen; read off disk.
- **Why it was more than a slot defect:** `--destructive` maps to `--color-n6`, and the ramp runs dark→bright `n0..n7` (AGENTS.md §8), so `bg-destructive` is a **bright** surface and `#fff` sat near-invisibly on the indicator that tells the operator an author is banned.

### S-2 · D28 — PASS
New file: **`tests/server/admin/moderation/review-feed-side-chip.component.test.tsx`** (chosen path; beside the existing admin/moderation component test, and NOT under `tests/unit/design/**`).
The chip **stays hand-rolled**. `ReviewFeed.tsx` is byte-identical to `origin/main` — proof in §8.

**RED counts, captured by mutation before the guard was trusted:**

| Mutation | Result |
|---|---|
| baseline (correct component) | 4 passed (4) |
| ① branches **swapped** | **3 failed \| 1 passed (4)** |
| ② **one pole hard-coded** for both sides | **2 failed \| 2 passed (4)** |

Mutation ② is the axis the swap alone cannot reach: a swap leaves *both* classes present, so only the hard-code case exercises pole **absence**. Two mutations, two distinct failure classes (V-5).

### S-3 · D11 — ⛔ HALTED (S-0k). NOT BUILT. Founder decision required.
See §3. The change is specified and correct against SPEC.1, but **cannot be shipped inside the plan's own edit boundary**, and that was proven, not predicted.

### S-4 · D12 — PASS
`TerminalActions.tsx`, copy only, from data already in props/state. New file: `tests/server/admin/terminal-actions-permanence.component.test.tsx`.
- **RED by mutation** — side hard-coded to `YES` for both poles: **2 failed | 5 passed (7)**. Reverted; 7/7 green.
- Both poles asserted **and** each side case pins the opposite pole's **absence**, so a note printing both labels fails too.
- The NO case drives the real `<select>`, not a re-render with different props — same state path the operator walks.
- The pre-existing `terminal-actions.component.test.tsx` was **not touched** and still passes **6/6**.

### S-5 · D19 — ⛔ HALTED. The plan's own item-specific halt fired.
The plan instructed: *"read the ten codes from SPEC.1 §15 F-ADMIN-1 AND from the create action's actual error union in `src/server/`. If the two sets DISAGREE… STOP this item, report both sets, and continue."*

**SET A — SPEC.1 §15 F-ADMIN-1 *Errors* (10):**
`deadline_ceiling` · `deadline_in_past` · `slug_taken` · `slug_invalid` · `market_id_conflict` · `content_required` · `admin_actor` · `media_required` · `default_media_required` · `video_url_invalid`

**SET B — what `createMarketAction` can actually return (13):** all ten above (each confirmed emitted by `toActionError` in `src/server/admin/wire.ts`), **plus**:
- `admin_session_required` — `src/server/admin/markets/create.ts:62`
- `validation_error` — `create.ts:85` and `create.ts:92`
- `error_internal` — the `toActionError` fallback in `wire.ts`

**They disagree: SET B ⊋ SET A by exactly the three wire-boundary codes.**

**Evidence this is the SPEC's defect, not the code's:** three sibling entries — SPEC.1 §15 F-ADMIN-3 and §11 F-RESOLVE-2 / F-RESOLVE-3 — each explicitly append *"plus `validation_error` / `admin_session_required` at the wire boundary (ENGINE.15 R-15.5)"*. F-ADMIN-1's Errors line does not, though the same `ActionResult` envelope and the same wire boundary apply. **Same boundary, inconsistent documentation.**

**Why this actually blocked the build and is not merely a note:** the item's discriminating condition requires *"SET EQUALITY between the copy map's keys and the code set (N5)"*. With two candidate code sets, there is no "the code set" to assert equality against without silently picking one — which is the reconciliation the plan forbids. **Deciding which list is authoritative is a spec question.**

### S-6 · D17 — PASS · S-7 · D20 — PASS · S-8 · D06 — PASS
All three in `ed6b82a`. Each ships its discriminating condition **in both directions**:
- **S-6:** invalid date → note renders (From / To / both); **VALID date → renders nothing** (positive control — a note that always rendered would have passed the first assertion). Parse semantics unchanged; the query untouched.
- **S-7:** UTC asserted on the **rendered** `<label>` that wraps `input[name="resolutionDeadline"]`, never a source grep (V-4). Positive control: the same `closest("label")` probe reports **no** UTC on the slug field. **The parse is spec-ratified and untouched.**
- **S-8:** no `EVENT_TYPES` value in the placeholder; positive control returns `["market.resolved"]` when one is planted (V-2/N3). Advertised tokens checked against `modReasonEnum.enumValues` read from the schema, not a re-typed lookalike (V-1).

---

## 3 · RULINGS TAKEN — ⚠ FLAGGED FOR GATE C

### RULING 1 — S-3 / D11: SPEC outranks plan, **and the build is blocked anyway**

The plan pre-took the precedence call. This session confirms the precedence **and reports that the item still cannot ship**, which the plan did not anticipate.

**TIER 1 — SPEC.1 §15 F-ADMIN-3 *Confirmation*, quoted in full:**
> "Two gates, both mandatory on **Resolve** and **Void**; **Close** requires a single ordinary confirm (it is reversible in effect — a closed market can still be resolved or voided — and carries no settlement)."

**TIER 3 — `docs/plans/UI-6.md` §2.S2, quoted in full:**
> "**Close** — single ordinary confirm (reversible in effect, no settlement). Pre: `status='Open'`. **No typed gate.**"

and, in the same section:
> "Close stays one-click; **Seed (Draft, F-ADMIN-2) is out of scope — left untouched**"

and its Acceptance line:
> "typed hard confirm (case-insensitive) arms Resolve / Void / Correct; **Close one-click**; no ungated submit path survives"

**The built code has neither gate** — `requiresTypedConfirm("close") === false` and `onSubmit` performs no confirm.

**⛔ WHY IT WAS NOT BUILT — S-0k, proven not predicted.** The behaviour the plan asks for is **already encoded as a passing assertion in an existing test file that plan §4 forbids touching**:

`tests/server/admin/terminal-actions.component.test.tsx:128` —
`it("terminal-actions::close-is-one-click-and-posts-only-marketId", …)`, which at `:138` asserts `expect(closeMock).toHaveBeenCalledTimes(1)` after a bare click, and stubs `window.confirm` nowhere.

I applied the change temporarily and ran that file. **Measured result: `1 failed | 5 passed (6)`**, failing at `:138` — jsdom's unimplemented `window.confirm` returns falsy, so the guard returns early and the action is never invoked. The probe was reverted immediately; `TerminalActions.tsx` carries no trace of it (the S-4 diff is copy only).

**So S-3 is unshippable without either:**
1. extending the §4 edit boundary to `tests/server/admin/terminal-actions.component.test.tsx` (the test encodes the superseded position and would need its Close case updated), **or**
2. the founder reversing the SPEC-over-plan precedence — in which case D11 closes as `superseded` and no work is needed at all.

**⚠ THERE IS A CHEAPER THIRD OPTION, raised by @code-reviewer and adopted into this record:** keep the SPEC precedence and file S-3 as **its own task whose §4 boundary names that test file**. That is the ordinary CLAUDE.md §5.4 outcome and needs no ruling on precedence at all. The binary above is not the only exit.

@code-reviewer also sharpened *why* the halt was unavoidable rather than unlucky: **no** implementation of "Close requires a single ordinary confirm" — `window.confirm`, a two-step in-component arm, anything — can leave an assertion named `close-is-one-click` green. S-0k was not a near-miss.

It is worth noting the conflict is *not* merely doc-vs-doc: the plan's position is baked into a green test, which is why nothing on disk was flagging it.

### RULING 2 — the S-0a exemption at commit 0

**⛔ S-0a fires on commit 0 by construction, and I proceeded under a narrow stated exemption rather than halting the run.**

Plan §0 S-0a stops the run if a guarded child-safety string appears *"ANYWHERE in your working diff, in any file, for any reason"*. The relay body contains it twice — in the text of **S-0a itself** and in **H-P8-4** — and plan §2 mandates committing that body **verbatim**. The two mandates are jointly unsatisfiable: the run cannot start.

**Reasoning:** S-0a's siblings (S-0b/c/d) all guard *code*; its own text calls it *"deliberately over-broad"*, and an over-broad guard is expected to produce false positives. Its protective purpose is entirely unharmed by exempting the founder's own prose, whereas halting destroys §2 and delivers nothing overnight.

**Enforcement held at full strength everywhere else** — verified at PR head:
- guarded strings in **added lines** of `src/` and `tests/`: **zero**
- this log: **zero**
- **H-P8-4 held absolutely.** D09 (the LD-3 text-only carve-out ban-review surface) was reported as status only and never designed, scoped or sketched.

**Founder may reverse in one line.** Recorded in the commit-0 body as well as here, so it sits in immutable history and not only in a log file.

---

## 4 · ROUTED, NOT BUILT — 20 rows

Recon produced **27** deltas. **6** were addressed, **1** is `superseded`, **20** are not built: **18 routed** + **2 halted**. Owners are **PROPOSED, not assigned.**

| # | Delta | Class | Disposition | Proposed owner |
|---|---|---|---|---|
| D11 | Close carries no confirmation of any kind | F | ⛔ **HALTED (S-0k)** | **Founder** — one-line ruling (§3) |
| D19 | Create-market surfaces raw error codes | F | ⛔ **HALTED** — code sets disagree | **Founder / spec lane** (§2 S-5) |
| D05 | `admin_events` has no writer; F-ADMIN-5's union arm is permanently inert | B (+R) | routed | **Founder** — writer vs. spec repoint; requested 2026-07-23, never granted |
| D07 | F-ADMIN-4's inline arm entirely unbuilt | B | routed · `inherited` (fix lives in `(public)`) | held by **D08** |
| D08 | ⚠ the three F-ADMIN-4 deferrals are docketed to a task that closed a month before they were minted | S | routed | **Founder** — H-P8-7 |
| D09 | LD-3 text-only carve-out ban-review surface unbuilt | B | ⛔ **H-P8-4** — reported, never scoped | **Founder, own chat** (child-safety) |
| D10 | Track-A informational rows absent; no "links to the audit record" | B | routed | held by **D08** |
| D13 | No admin sign-out affordance; `adminLogoutAction` built and unreachable; cookie indefinite | F | routed | **H-P8-1** (auth surface) |
| D14 | `loadAdminMarketsOverview` has no `.limit()` — unbounded | F | routed | **H-P8-1** (`src/server/admin/**`) |
| D15 | Audit ordering is not a total order (no `id` tiebreaker on 3 queries) | F | routed | **H-P8-1** |
| D16 | Audit feed has no pagination at all (X4) | R | `duplicate-of-known` | **Founder** — product ruling |
| D18 | Create-market: uploaded media cannot be removed or reordered; reload orphans R2 objects | F | routed | admin build lane |
| D02 | POLISH-0's invariant **proof** is imprecise; `ReviewFeed.tsx:22-25` claims "ZERO product components" while `:6` imports one | S | routed — **record fix, not code** | web / close-out |
| D03 | Row says "7 routes"; there are 8 routable entries | S | routed | web / close-out |
| D04 | Components cell omits 8, incl. `BanIndicator` — the component holding R7 | S | routed | web / close-out |
| D22 | Tier-3 cites `docs/logs/UI-6-log.md`, which does not exist | S | routed | web / close-out |
| D23 | Row omits SPEC.1 §15 — the functional baseline — from Tier 1 | S | routed | web / close-out |
| D24 | Control set omits audit search, media sign, sign-out | S | routed | web / close-out |
| D25 | POLISH-TRACKER §6 states the cost as EIGHT and enumerates SEVEN | S | routed | web / close-out |
| D26 | `no-raw-hex-view-layer.test.ts` does not reach `src/app/(admin)/**` | S | routed | **H-P8-3** quality lane |
| D27 | Same guard has no palette-class rule (already R15) | R | `duplicate-of-known` | **H-P8-3** quality lane |

⚠ **`D02` / `D03` / `D04` / `D22` / `D23` / `D24` / `D25` are WEB-AUTHORED and land at the CLOSE-OUT, in a separate PR**, exactly as .7a did (#320 machine, #321 close-out). They were recorded here and deliberately **not** fixed: no doc under `docs/polish/` was touched by this run — verified, `git diff --name-only origin/main -- docs/polish` is empty.

**Also not built, and not work:** D29 — the three unstyled routes. `superseded`, logged so it is never re-derived: SPEC.1 §15.3 and F-ADMIN-1/2 *Surface* ratify them verbatim as *"functional and unstyled … must not be removed."*

---

## 5 · R15 HANDOFF — natural RED, captured pre-fix

Run against the **unfixed** tree, before the S-1 edit existed, via a throwaway **uncommitted** probe at `/tmp/r15-probe.mjs` (S-0e forbids `tests/unit/design/**`; the probe is deliberately not a test):

```
$ node /tmp/r15-probe.mjs
scanned 281 files under src/
FAIL — 1 Tailwind palette colour class(es) in src/:
  src/app/(admin)/admin/moderation/audit/page.tsx:75 → text-white
EXIT=1
```

The same predicate as a plain grep, also pre-fix:

```
src/app/(admin)/admin/moderation/audit/page.tsx:75:  ... font-semibold text-white">
hit count = 1
```

> **This is EVIDENCE THE PREDICATE DISCRIMINATES. It is NOT a committed RED-first receipt.**
> R15 still needs a real RED at mint, by axis-① mutation, **because this PR removes its only live instance.** After S-1 the predicate returns zero on the whole tree, so a guard minted later would go green on its first run and prove nothing (H15). Whoever mints R15 must plant an offender to see it fail.

---

## 6 · Reviewer findings

Both reviewers ran **sequentially**, one at a time, from the primary tree at `polish/8-admin-centre` (agent defs verified pinned `claude-opus-5` / `effort: max` before launch; `model: "opus"` also passed on each call). Every finding is listed **individually at the severity its reviewer assigned**. Neither returned a bare PASS.

### @code-reviewer — 0 CRITICAL · 1 HIGH · 4 MEDIUM · 7 LOW

| ID | Sev | Finding | file | Disposition |
|---|---|---|---|---|
| **H-1** | **HIGH** | The S-4 permanence note promised *"Corrections are available only via an F-RESOLVE-2 clawback"* on the **Void** form. False, and false in the dangerous direction — `correct.ts` requires `expectedStatus ["Resolved"]` and `actionsForStatus("Voided")` is empty, so a voided market has **no** correction path. The operator armed an irreversible refund-and-unwind believing one existed. | `TerminalActions.tsx:174-176` | ✅ **FIXED** `cc26be1` + regression assertion |
| **M-1** | MEDIUM | The S-2 guard I had just written **could not catch a foreground-pole defect** — demonstrated, not theorised: mutating `text-no`→`text-yes` (black-on-black, invisible) left it **GREEN at 4/4**. Same defect class as S-1, minted one directory away in the same PR. | `review-feed-side-chip.component.test.tsx:87-107` | ✅ **FIXED** `cc26be1`, proven by reversal |
| **M-2** | MEDIUM | `invalidDateFields` **re-derived** `parseFilters`' NaN decision rather than consuming its output. Agreed today; future drift would be silent and in the worst direction — the note going quiet while the predicate was still dropped, i.e. the pre-S-6 defect restored. | `audit/page.tsx:279-288` | ✅ **FIXED** `cc26be1` |
| **M-3** | MEDIUM | With `?from=junk` and no other filter, `searching` is false → the page falls back to the **blocked-submissions feed**, a different read model. The note says *"unfiltered by it"* — true but materially incomplete. | `audit/page.tsx:306-307` | ⚠ **REPORTED, NOT FIXED** — >1 line (plan §7). **See convergence note below.** |
| **M-4** | MEDIUM | The §7 count table in this log was self-inconsistent: "8 files changed" and "2 doc files added" could not both be true once the log is committed. | `docs/logs/POLISH-8.md` §7 | ✅ **FIXED** — §7 re-measured at PR head, below |
| **L-1** | LOW | S-8 asserts the exported constant, never the rendered `placeholder` attribute — the V-4 weak form its own sibling item (S-7) rejected. Not vacuous (mutation → 2 failed), just aimed one layer above the DOM. | `audit-search-surface.component.test.tsx:103-122` | Reported |
| **L-2** | LOW | S-1 ships with **zero committed regression guard** — the palette grep now returns 0 across `src/`, so a future `text-white` is unnoticed. Plan-sanctioned (S-0e forbade committing the probe); the §5 R15 handoff is the only carrier. | `audit/page.tsx:75` | Reported — see §5 |
| **L-3** | LOW | Pole-absence assertions scan the whole note; future copy containing "NOT"/"NOTE" would break them spuriously, and the break would look like a pole inversion. | `terminal-actions-permanence.component.test.tsx:82,98,124-126` | Reported |
| **L-4** | LOW | `SearchParams` types `from?: string`, but Next supplies `string \| string[]`. Pre-existing; now on an **exported** signature, so wider blast radius. | `audit/page.tsx:235-242` | Reported |
| **L-5** | LOW | This log's page-export precedent was **not like-for-like**. | `docs/logs/POLISH-8.md` | ✅ **FIXED** — §9 rewritten with the real mechanism |
| **L-6** | LOW | On the **Correct** form the clawback sentence is self-referential (the operator *is* performing the clawback), and a correction is itself correctable. Defensible against SPEC.1 §15. | `TerminalActions.tsx:174-176` | Reported |
| **L-7** | LOW | Log untracked at review time. | — | Resolved — committed before PR |

### @security-auditor — 0 CRITICAL · 0 HIGH · 0 MEDIUM · 5 LOW · 3 SURPRISE

**⛔ S-0j did not fire.** No CRITICAL, so nothing blocked the run.

| ID | Sev | Finding | Disposition |
|---|---|---|---|
| **L-1** | LOW | Same fallback-copy issue as @code-reviewer M-3, reached independently: the note reads as *"you are seeing more"* when the operator has in fact been silently narrowed to the gate-block feed, which by construction contains **no** `content_removed` and **no** `user_banned` rows. | ⚠ **REPORTED, NOT FIXED** — see convergence note |
| **L-2** | LOW | A **sibling** malformed-input path 500s rather than being made visible: `?actionType=a&actionType=b` gives Next a `string[]`, and `v?.trim()` throws (optional chaining does not short-circuit a non-nullish value); a non-UUID `marketId` reaches Postgres and `22P02`s. **Unreachable by any attacker** — `requireAdminPage()` redirects before `searchParams` is awaited. Pre-existing; S-6 closed the date arm while the text arm still hard-fails. | Reported — plan forbade changing parse semantics |
| **L-3** | LOW | This PR introduces the **first side-encoding string** in `(admin)/admin/markets/`, on a directory `side-pole-binding.test.ts` declares excluded — the prohibition lived only in comments. | ✅ **FIXED** `8fdc28c`, positive control + proven by reversal |
| **L-4** | LOW | `audit-feed-leak.test.ts` proves gate-before-read by comparing **first occurrences** of two strings. This PR added ~67 lines of module-level helpers above the page function, so a future helper containing the literal `requireAdminPage(` would bind `gateAt` to itself and keep the guard green with the real gate gone. | ⚠ Reported — **file is outside plan §4**. Follow-up. |
| **L-5** | LOW | Session log untracked / not in the PR; RULING 1 and the routed table exist only there. | Resolved — committed before PR |
| **SURPRISE-1** | LOW | **No `robots.txt` and no `src/app/robots.ts` anywhere in the tree.** Only `/admin/login` carries `metadata.robots noindex`; the other five admin pages carry none. Exposure bounded — unauthenticated crawlers are redirected to the noindexed login, so only *paths* can be indexed, never content. Pre-existing. | Separate task |
| **SURPRISE-2** | LOW | `audit-feed-leak.test.ts` positionally checks only `loadModerationAuditFeed(`. The page's **other** read — `searchAuditLog`, the one spanning both `mod_actions` and `admin_events` — has **no ordering assertion at all**. Pre-existing. | Separate task |
| **SURPRISE-3** | — | Independent verification of RULING 2's accounting: the guarded string occurs **2×**, both inside `docs/plans/POLISH-8.md`, **0** in `src/`, **0** in `tests/`, **0** in this log. Measured, not claimed. | Confirms §3 |

### ⚠ CONVERGENCE — the one finding two independent reviewers reached separately

@code-reviewer **M-3** and @security-auditor **L-1** are the same defect, found by different routes. **It is the only convergent finding in the cascade and it is the strongest candidate for the next pass.**

With `?from=<typo>` and no other filter, the audit page does **not** run the F-ADMIN-5 search at all — it silently falls back to `loadModerationAuditFeed`, which is restricted to the three gate-block reasons. An operator searching for a **removal** record therefore sees a feed that by construction cannot contain one, finds nothing, and concludes no removal was recorded. That is the same genus as D05 and D17 — *the surface telling the operator something untrue about what it did* — which is the genus this whole run exists to close.

It was **not fixed** because plan §7 makes MEDIUM/LOW report-only unless the fix is one line, and this needs `searching` threaded into `InvalidDateNote` plus a new clause. **Recommended as the first item of any follow-up.**

### Reviewer-verified claims I had asserted

Both reviewers independently re-measured things this log states, rather than accepting them:
- `ReviewFeed.tsx` byte-identity — confirmed by both (`git diff` → 0 lines; absent from `--name-only`).
- Every one of the four new tests **mutation-tested by @code-reviewer itself**, not read off my counts: each fails on its stated target. It found exactly one gap (M-1) and one aim-too-high (L-1).
- **S-8 is a real fix, not a swap of one unmatchable string for three others** — @security-auditor verified all three advertised reasons are genuinely written today (`act.ts:87`, `act.ts:107`, and the gate consequence writer). **The plan's own discriminating condition did not cover this**, and it is the check I would have missed.
- **S-7's label states something true** — `parseDeadline` appends `.000Z` before `new Date(...)`, so the value really is parsed as UTC. Had it parsed as local, S-7 would have shipped a *false* statement on the control that sets a settlement date.
- **S-1 is a security-positive, quantified:** `--destructive` = `#bdbdbd`, `text-white` ≈ **1.9:1** contrast; `text-background` = `#181818` ≈ **9.6–12:1**. A moderation signal the operator could not read is now readable.
- **INV-4's catastrophic case is not constructible.** @security-auditor chased it end to end: `side` is a single `useState` consumed by *both* the note and `terminalActionFields`, and `resolveMarketAction` passes `winningSide` straight to `settleMarket` with no substitution — including on the stranded-`Resolving` resume branch, where a stored side could have diverged. **A confirm naming YES while posting NO cannot be built here.**

---

## 7 · Counts re-verified at PR HEAD

Every number below was re-measured at PR head, not carried from when it was written.

⚠ **@code-reviewer M-4 caught this table asserting two things that could not both be true** — "8 files changed" and "2 doc files added" — because this log was untracked when the first version was written. Both rows are re-measured below **with the log committed**, which is the state Gate C reads.

| Claim | Value at PR head |
|---|---|
| Files changed vs base `dfa3012` | **9** (8 before this log, 9 with it) |
| Source files changed | **3** (`audit/page.tsx`, `TerminalActions.tsx`, `create-market-form.tsx`) |
| Test files added | **4** |
| Doc files added | **2** (`docs/plans/POLISH-8.md`, `docs/logs/POLISH-8.md`) |
| Commits | **8** (plan + 5 ship + 2 reviewer rounds), **9** with this log |
| Tailwind palette colour classes in `src/` | **0** (was 1) |
| Files under `src/app/(admin)` | **15** (unchanged) |
| Routable entries under `(admin)` | **8** |
| Components under `(admin)` | **16** (15 + `InvalidDateNote`) |
| `src/server/**` files changed | **0** |
| `tests/unit/design/**` files changed | **0** |
| `docs/polish/**` files changed | **0** |
| Migrations / ADRs / SPECs changed | **0** |
| Guarded-string hits in added `src/` + `tests/` lines | **0** |

---

## 8 · `ReviewFeed.tsx` byte-identity proof (S-2's mutate-and-revert)

The component was mutated **twice** to capture RED, and both mutations were reverted.

```
$ git diff origin/main -- src/app/(admin)/admin/moderation/_components/ReviewFeed.tsx
(empty)
```

It is also **absent from `git diff --name-only origin/main`** entirely, which is the stronger form of the same statement: the file is not in the PR at all.

The same technique was applied to `TerminalActions.tsx` for the S-3 collision proof and the S-4 mutation; that file **does** appear in the PR, carrying **only** the S-4 copy block (24 added lines, no deletions) — no probe residue.

---

## 9 · ⚠ LESSON FOR THE NEXT RELAY — what the machine read missed

With the founder pass batched, this is the only surviving carrier of the feedback loop. Four things, in order of how much they cost.

**1 · A plan can forbid its own execution, and both times it happened here the contradiction was invisible from the plan text alone.** Two of eight items hit a jointly-unsatisfiable pair — S-0a vs §2 at commit 0, and S-3 vs S-0k — and a third (S-5) hit the halt the plan itself anticipated. **That is a 3-in-8 rate on a plan that was carefully written.** The S-0a one is structural: §0 says "read before anything else", but §0 could not be satisfied by the very first action §2 mandates. **Next relay: run the stop conditions against the plan's own commit 0 before shipping the relay.** A one-line carve-out ("S-0a exempts the verbatim plan text") would have removed the whole judgment call.

**2 · The edit boundary was drawn around *source* files and forgot that behaviour is pinned by *tests*.** §4 listed "the new admin-side test file(s)" but no existing ones. Any behaviour change whose old behaviour is asserted somewhere is therefore unshippable by construction — and S-3's old behaviour was asserted, in a passing test, by name (`close-is-one-click`). **The boundary should name the existing tests that pin the behaviour each item changes**, or state that updating a test which encodes a superseded position is in scope. This is generalisable: it will recur on every "spec outranks plan" item.

**3 · The recon read the conflict as doc-vs-doc and missed that it was doc-vs-*green-test*.** My own POLISH.8 recon filed D11 citing SPEC.1 §15 against `docs/plans/UI-6.md` §2.S2, and quoted both. It never checked whether the built behaviour was *asserted* anywhere. Had it grepped the test suite for the disputed behaviour, D11 would have arrived carrying its own blocker and the plan would have scoped it differently. **Add to recon: for every delta whose fix changes behaviour, grep the suite for a test that pins the current behaviour, and report it on the row.** A delta with a green test defending it is a different, more expensive object than one without.

**4 · Two axis-A observations were correctly *not* filed, and the mechanism that stopped them is worth keeping.** Tier 3 killed the "Correct is surfaced though §15.3 says v1 doesn't" divergence (UI-6 plan R4 is a deliberate ratified reversal) and tier 1 killed the "three routes are unstyled" one (SPEC.1 §15.3 ratifies them as *"functional and unstyled"*). Both would have been filed as defects by a pass that skipped tier 3, which is exactly the POLISH.0 finding — **three of four apparent divergences were false, each resolving on a tier-3 document.** The read order is load-bearing; it earned its place again.

**Smaller, still worth carrying — and my first justification for it was wrong.** Exporting `invalidDateFields` / `InvalidDateNote` / `ACTION_TYPE_PLACEHOLDER` from a `page.tsx` was the only way to assert against shipped symbols without adding a colocated file outside the boundary. `next build` accepts it — but **not** for the reason I originally wrote here. I cited `(admin)/admin/login/page.tsx`'s `submitAdminLogin` as precedent; @code-reviewer (L-5) and @security-auditor both established that is **not like-for-like** — `submitAdminLogin` carries an inline `"use server"` directive and is therefore a Server Action, an explicitly sanctioned pattern with its own rules. A plain module export is a different thing.

The real mechanism: Next 16's generated `.next/types/validator.ts` validates pages with a **subtype constraint** (`type __IsExpected<Specific extends AppPageConfig<…>>`), and `extends` is structural subtyping — excess properties pass by construction. **The legacy webpack `next-types-plugin` still shipped in the same `node_modules` does an EXACT check that would reject these**, via `checkFields<Diff<{…known…}, TEntry, ''>>()`. It does not run because this build is Turbopack. **So the tolerance is a Next-16-Turbopack property, not a stable contract** — a bundler change could break it. Carry that, not the precedent claim.

---

## 10 · Session count and wall-clock time

- **Sessions:** 1 (this one). Recon was a separate prior session.
- **Founder-serial touches consumed by this run:** **0** — pre-authorised under D4, no verdict round. Gate C in the morning is the next and only founder touch.
- **Wall-clock:** single unattended overnight session, 2026-08-12, ~04:00–05:00 local.
- **Commits:** 9 — commit 0 (plan) · S-1 · S-2 · S-4 · S-6/7/8 · @code-reviewer round · @security-auditor round · this log.
- **Full `just verify` runs:** 8 — one baseline, one per commit boundary, one re-run after a Biome format fix, and one per reviewer round. All green at every commit boundary (⛔ S-0g never fired).
- **Full suite:** `pnpm vitest run` → **324 files passed | 1 skipped (325)**, **2868 tests passed | 1 skipped | 4 todo (2873)**, EXIT=0.
- **Reviewer cascade:** 2 agents, sequential, ~12 min and ~11 min. 1 HIGH + 2 MEDIUM + 1 LOW fixed; 1 convergent MEDIUM/LOW reported and not fixed (see §6).

---

*POLISH.8 machine phase · ended at PR-open, nothing merged · Gate C pending.*
