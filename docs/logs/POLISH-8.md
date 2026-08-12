# POLISH.8 — Admin Centre — machine-phase session log

**SENTINEL:** ZZ-P8-EXEC-2026-08-12 · ZZ-P8-GCR-2026-08-12 · ZZ-P8-GC2-2026-08-12 · ZZ-P8-GC3-2026-08-12 · ZZ-P8-GC4-2026-08-12

**Date:** 2026-08-12 · **Branch:** `polish/8-admin-centre` · **Base:** `dfa3012` on `main`
**Mode:** overnight, unattended, pre-authorised under founder ruling D4 (no verdict round).
**Governing ruling:** *"Admin pages are internal — they should be simple and not heavy. Just the core functions should work."* Axis A report-only except S-1; axis B is the run; axis C passed at recon and was not re-litigated.
**Plan:** `docs/plans/POLISH-8.md`, committed verbatim at commit 0.

> ⚠ **NOTHING HAS BEEN MERGED. The founder merges after re-read.**
> **Gate C history:** the machine phase ended at PR-open with Gate C pending; **read-1** returned four blocking items + one structural fix (GC-1…GC-5, §2a); **read-2** returned six more (R2-1…R2-6, §2b). This line said *"Gate C has not happened"* through both reads — R2-3.

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

**Files under `src/app/(admin)`: 16** — ⚠ **CORRECTED at Gate C remediation.** The machine phase left this at 15 and said "unchanged by this run"; GC-5 then added one source file, `audit/search-surface.tsx`. Measured, not carried: `find "src/app/(admin)" -type f | wc -l` → **16**. Routable entries are still **8** — the new module is not a route.
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

**RED counts, captured by mutation before the guard was trusted.** ⚠ **All three measured at `908aaf0`**, the commit that introduced the guard — labelled per GC-4, because the file has since gained a fourth assertion (@code-reviewer M-1's foreground-pole check, `cc26be1`):

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
- **RED by mutation** — side hard-coded to `YES` for both poles: **2 failed | 5 passed (7)**, ⚠ **measured at `6430f18`**, when the file held seven `it` blocks. Reverted.
- ⚠ **GREEN AT PR HEAD: 8 passed (8)** — measured, not recalled. The file gained an eighth block at `8fdc28c` (@security-auditor L-3's INV-3 pole-class assertion), *after* the RED above was captured. The machine phase wrote "7/7 green" and never re-measured it; that is the GC-4 defect.
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

## 2a · GATE C REMEDIATION — five items, all PASS

Founder read the machine-phase diff and returned four blocking items plus one structural fix. Plan §0 stop conditions stayed in force, with S-0a **amended** by the founder so it no longer fires on the verbatim plan text — RULING 2's exemption ratified as taken, and the judgment call removed rather than re-litigated. The edit boundary was extended by exactly two entries: one new colocated module under the audit route, and this log.

| Item | What | Outcome |
|---|---|---|
| **GC-1** | The S-6 note asserted breadth it does not have, in its own fire path | ✅ **PASS** — `013cf3b` |
| **GC-2** | A JSDoc describing the pre-M-2 implementation, + sweep | ✅ **PASS** — `d7b8402` |
| **GC-3** | The commit count was wrong — D25's exact genus | ✅ **PASS** — measured, §10 |
| **GC-4** | A counted claim never re-verified at PR head, + full re-audit | ✅ **PASS** — §7 |
| **GC-5** | Move the page exports into a colocated module | ✅ **PASS** — `7dcaa1a` |

### GC-1 — the one that mattered
@code-reviewer M-3 and @security-auditor L-1 converged on it; §7's one-line rule kept it report-only; the founder **overrode §7** for this item.

**The RED, captured before the fix** (ordered obligation — this is why ultracode is forbidden):

```
× case 1 · invalid date WITH another filter — search RUNS, no fallback claim
    → searchRan is not a function
× case 3 · ⚠ invalid date ALONE — search does NOT run, note states the fallback
    → searchRan is not a function
Test Files  1 failed (1)   |   Tests  2 failed | 11 passed (13)
```

and the **actual shipped note text on the fire path**, captured by a throwaway probe that was rendered and then deleted (never committed):

> `From date ignored. That value could not be read as a date, so it was NOT applied — the rows below are unfiltered by it.`

With `?from=junk` and nothing else, `searching` is false and the page never runs the search — it falls back to `loadModerationAuditFeed`, the gate-block feed, which by construction holds **no** `content_removed` and **no** `user_banned` rows. So that sentence tells an operator hunting a removal record that they are seeing everything, while they look at a set that structurally cannot contain it.

`searchRan(sp)` is now exported and is the **single** expression of that decision — the page uses it too, replacing its inline `Object.keys(filters).length > 0`. Two expressions of one decision is precisely the drift M-2 removed from `invalidDateFields`; GC-1 does not reintroduce it. The three cases are asserted, and **case 3 is the one that was RED** — a test covering only 1 and 2 measures where the defect cannot appear (V-7).

### GC-2 — the sweep result
**Contradictory: 1** (the named JSDoc — it claimed `invalidDateFields` "re-derives the same `Number.isNaN` decision" while the body four lines below took it from `parseFilters`' output; a reader trusting the JSDoc concludes M-2 never landed). **FIXED.**

**Incomplete: 2** — the `audit-search-surface` docblock (described S-6's note before GC-1's fallback branch) and the `review-feed-side-chip` docblock (described the assertion set before M-1's foreground check). Both are files this PR authored, so both were corrected rather than left to drift.

**Stale beyond those: none.** All 192 added comment lines were extracted from the diff and read against the code they describe. Specifically checked and found accurate: the S-4 docblock's SPEC quotation (it quotes SPEC.1, not the implementation, so H-1 does not stale it), the S-8 downstream-of-D05 warning, and every positive-control rationale.

### GC-5 — and the export that would have been left behind
The ruling named three symbols. **Four had to move**: `searchRan` was added to the page by GC-1 one commit earlier, and leaving it would have satisfied the proof's letter while defeating its point. Their two private dependencies travelled with them; `parseFilters` is now exported because the page still builds the query — the only signature change, and it is visibility, not shape.

Proof: `next build` green (`├ ƒ /admin/moderation/audit` still built); **zero** exports of those symbols remain on any `page.tsx` tree-wide (find + grep, count = 0); `audit/page.tsx` now exports exactly `dynamic` and its default component.

**Side benefit:** the test file's two server-dependency mocks became dead — the new module's only import is a type — and were **deleted** rather than left as scaffolding. That file now mocks nothing.

**Swept while there, not fixed:** `src/app/(public)/page.tsx:67` exports `DiscoveryContent`, a plain async component — the same latent hazard, pre-existing, and outside plan §4.

---

## 2b · GATE C READ-2 REMEDIATION — six items, all PASS

Read-1's remediation did not end Gate C. A second diff-read returned six more items — five of them defects in this log rather than in the code, which is itself the finding. Round label **R2-n**; GC-6…GC-9 are allocated to routed docket rows and must not collide.

| Item | What | Outcome |
|---|---|---|
| **R2-1** | §9 said "Four things" and enumerated six | ✅ **PASS** — count **deleted**, not corrected |
| **R2-2** | §7's category rows summed to 9 against a total of 10 | ✅ **PASS** — categories now partition, sum stated |
| **R2-3** | Five statements true at an earlier round, false at head | ✅ **PASS** — 5 named + **3 more found** by the prose sweep |
| **R2-4** | "Sessions: 2" beside a wall-clock describing one | ✅ **PASS** — one line per session |
| **R2-5** | A citation that reads as checkable and is not | ✅ **PASS** — counts inlined; all §-refs audited |
| **R2-6** | GC-1 replaced a control-flow expression | ✅ **PASS** — proven + cascade re-run |

### ⚠ R2-6 — the substantive one

**The founder was right about the description.** Log §6 justified skipping the cascade with *"confined to one string branch … no handler, no state and no data read"*, while §2a states GC-1 *"replaced its inline `Object.keys(filters).length > 0`"* — the expression choosing between `searchAuditLog` and `loadModerationAuditFeed`, **two different read models**. The skip rested on a description that did not match the change.

**PART A — VERDICT: (i) PURE EXTRACTION.** Semantically identical for every possible `sp`; no input on which the two disagree.

The old expression, verbatim at `b96a0c2` (`page.tsx:492-493`):

```ts
const filters = parseFilters(sp);
const searching = Object.keys(filters).length > 0;
```

`searchRan`'s current body, verbatim:

```ts
export function searchRan(sp: SearchParams): boolean {
	return Object.keys(parseFilters(sp)).length > 0;
}
```

`parseFilters` is byte-identical to its `b96a0c2` form — GC-5 added only the `export` keyword — and pure: no clock, no IO, no shared state, never writes `sp`. The only real difference is **cost**: `parseFilters` now runs three times per render instead of two. Pure, trivial, no behavioural consequence.

**Proven, not asserted.** The old expression is inlined as an ORACLE and pinned across a **12-row** spanning set, with two guards on the set itself: it spans both outcomes, and it *contains* an input a wrong extraction gets wrong — asserted, not hoped.

⚠ **RED captured by mutation before the claim was trusted** — `searchRan` made to read `sp` directly:

```
× case 3 · ⚠ invalid date ALONE — search does NOT run, note states the fallback
× agrees with the pre-GC-1 expression — invalid from
× agrees with the pre-GC-1 expression — invalid to
× agrees with the pre-GC-1 expression — every field invalid or blank
Test Files  1 failed (1)   |   Tests  4 failed | 22 passed (26)
```

GC-1's own fire path and the equivalence proof fail on the same mutation — the strongest available evidence that the set discriminates where it matters.

**PART B — @code-reviewer re-run, scoped to `b96a0c2..HEAD` on the audit surface. 0 CRITICAL · 1 HIGH · 2 MEDIUM · 4 LOW.**

Its verdict, quoted: **"SAME read model, for every input. Unhedged."** It did not take the claim from me — it extracted both `parseFilters` bodies programmatically (**sha256 identical, 818 bytes each side**) and ran a **differential fuzz of the shipped bytes against the extracted `b96a0c2` bytes over 220,442 inputs**: `VALUE DIVERGENCES: 0`, `THROW MISMATCHES: 0`, including repeated-key `string[]`, null-prototype and `__proto__`-bearing objects, getter-backed props, and an identical `Proxy`-recorded access order.

| Sev | Finding | Disposition |
|---|---|---|
| **HIGH** | `audit-feed-leak.test.ts:13,62-68` — **GC-5 narrowed the blocked-image leak rail without extending it.** `PAGE_FILE` is pinned to `audit/page.tsx`; GC-5 moved a JSX-rendering component out of it, so part of the render tree now lives where the guard never looks. **Nothing leaks today** (all four signer tokens, `<img`, `r2`, `imageR2Key`, `blockedText` absent from `search-surface.tsx`) — the defect is that the control got **weaker while reading green**. Same genus as §5.14 SC-1. | ✅ **FIXED at read-3 (`cb0a655`)** — founder extended the boundary by exactly that file. Was report-only at read-2 (outside the permitted set; S-0j does not fire on a HIGH). See §2c |
| **MEDIUM** | The spanning set had one hole — `userId` was the only field without a single-field row, and a **userId-blind** selector passed all 11 cases | ✅ **FIXED** (`097fd72`) — 12th row added, both wrong-extraction classes now pinned. RED on re-mutation: **1 failed \| 26 passed (27)** |
| **MEDIUM** | §6's cascade-skip rationale describes half of GC-1 | ✅ **FIXED** — §6 rewritten under R2-3 |
| **LOW** | The `searchRan` prop shadows the module function | Report only — cannot bite (TS2349, required prop, case 3 pins the false branch) |
| **LOW** | `searching` re-derives from `sp` rather than reading the computed `filters` — the pairing rests on purity, not structure | Report only — proven to hold |
| **LOW** | The oracle shares `parseFilters` with the implementation, so the proof is conditional on *"`parseFilters` unchanged since `b96a0c2`"* — a premise carried by a comment and no assertion | Report only |
| **LOW** | No **page-level** test exercises the `searching === true` arm. **Pre-existing at `b96a0c2`** | Report only — it is why the unit-level proof is load-bearing |

### R2-1 · every heading in this log that states a count, audited

| Heading | States | Enumerates | Verdict |
|---|---|---|---|
| §2 Ship set | 6 shipped / 2 halted | 8 rows: 6 + 2 | **CONFIRMED** |
| §2a Gate C read-1 | five items | 5 rows | **CONFIRMED** |
| §2b Gate C read-2 | six items | 6 rows | **CONFIRMED** |
| §4 ROUTED | *"20 rows"*, *"27 deltas"*, *"18 routed"* | **21 rows** | ⚠ **CORRECTED → 21 / 28 / 19** |
| §6 @code-reviewer | 0/1/4/7 = 12 | 12 rows | **CONFIRMED** |
| §6 @security-auditor | 0/0/0/5 + 3 SURPRISE = 8 | 8 rows | **CONFIRMED** |
| §7 GC-4 audit | *"twenty-two rows"* (in §9) | 22 rows at read-1 | **CONFIRMED**, now labelled *read-1's* |
| §9 LESSON | *"Four things"* | **6 items** | ⚠ **COUNT DELETED** (R2-1's ruling: do not correct it to six) |
| §10 Commits | 12 | 12 numbered rows | **CONFIRMED** |
| §1 Components | 16 | 7 + 8 + 1 = 16 | **CONFIRMED** |

### R2-3 · the prose sweep GC-2 could not have done

⚠ **GC-2 scoped itself to "all 192 added comment lines" — comments IN THE DIFF. The log's own prose was structurally outside the scan.** That is §9 item 2's lesson — an edit boundary drawn around one artifact class while the thing that mattered lived in another — recurring one document up.

**Eight statements found: the five the founder named, plus three more.**

| # | Where | Said | Disposition |
|---|---|---|---|
| 1 | header blockquote | "Gate C has not happened." | Rewritten with the two-read history |
| 2 | §10 | "the next and only founder touch" | Rewritten; read-3 pending |
| 3 | §6 cr M-3 | "REPORTED, NOT FIXED" | Labelled *at the cascade* — **SUPERSEDED BY GC-1** |
| 4 | §6 sa L-1 | "REPORTED, NOT FIXED" | Same |
| 5 | §6 CONVERGENCE | "Recommended as the first item of any follow-up" | Kept as written, outcome stated beside it |
| **6** | §6 heading + rationale | "the reviewer cascade was NOT re-run" | ⚠ **Found by the sweep.** Reversed at read-2; rationale rewritten (also @code-reviewer MEDIUM) |
| **7** | §7 GC-4 row | per-file counts "13" for `audit-search-surface` | ⚠ **Found by the sweep.** Now **27**; counts inlined (R2-5) |
| **8** | §3 RULING 2 | "Founder may reverse in one line" | ⚠ **Found by the sweep.** **RATIFIED** at read-2; no longer my call |

**Nothing further.** Every other statement in this log was re-read against head and holds.

### R2-5 · internal §-reference audit

Every `§N` reference this log makes, checked: **all RESOLVE.** §1 · §2 · §2a · §2b · §3 · §5 · §6 · §7 · §8 · §10 all exist as headings. §0, §4, §6, §7, §9 also appear as references to the **plan**, and §11 / §15 / §15.3 to **SPEC.1**, §5.4 / §5.14 to **CLAUDE.md** — external, and correct.

**One was BROKEN and is fixed:** GC-4's *"Test files at PR head, per file"* row cited **§7**, which carries no per-file counts. Counts are now **inlined on the row** rather than pointed at — a pointer between two tables in one document is a V-8 hazard for no benefit.

---

Also confirmed by the reviewer, against the loader rather than my comment: GC-1's fallback copy is **exhaustively true** — `mod_reason` has five members, `BLOCKED_REASONS` holds three, and the two outside it are exactly `content_removed` and `user_banned`. And **§5.14 SC-1 does not fire** on this diff: neither audit loader reads `comments` at all.

---

## 2c · GATE C READ-3 REMEDIATION — five items, all PASS

Read-3 was otherwise clear: every hunk classified, R2-6 Part A verified independently by web (`parseFilters` byte-identical, 20 lines each side once the added `export` is stripped). One blocker remained, and the founder recorded that it was **caused by the GC-5 ruling, not by execution** — so the edit boundary was extended by exactly one file, `tests/server/admin/moderation/audit-feed-leak.test.ts`.

| Item | What | Outcome |
|---|---|---|
| **R3-1** | HIGH — GC-5 narrowed the leak rail without extending it | ✅ **PASS** — `cb0a655` |
| **R3-2** | `searchAuditLog` had no gate-before-read assertion | ✅ **PASS** — `cb0a655` |
| **R3-3** | The positional binding was self-matchable | ✅ **PASS** — `cb0a655` |
| **R3-4** | The fallback copy said "the only filter" over two | ✅ **PASS** — `3dfdced` |
| **R3-5** | @security-auditor re-run, scoped to the leak rail | ✅ **PASS** — `bdc9c96` |

**Every fix is proven by mutation PRE-FIX and POST-FIX**, so each is shown to have EXTENDED reach rather than merely not broken anything (RULE-1 axis ③).

### R3-1 — the scanned set is now the route DIRECTORY, not a filename

| Probe | Result |
|---|---|
| PRE-FIX · `getSignedUrl` planted in `search-surface.tsx` | **6 passed (6) — GREEN. ⚠ That green IS the gap.** |
| POSITIVE CONTROL · same token planted in `page.tsx`, pre-fix | **RED** — the guard was alive; the blindness was specific to the moved file |
| POST-FIX · `getSignedUrl` planted in `search-surface.tsx` | **1 failed \| 5 passed (6)** |

O-1 applied: the set is derived from `AUDIT_ROUTE_DIR`, so the *next* file colocated with this route is scanned automatically. A named list is what let one file escape; adding a second name would have re-armed the same trap. Two N1 assertions guard the scan itself — it must contain `PAGE_FILE` **and** reach more than one file.

⚠ **The relay suggested planting `imageR2Key`. That string is not in `SIGNER_TOKENS`, so planting it would have proved nothing** — a probe matching nothing passes vacuously (V-2). A real token was used instead.

### R3-2 — gate-before-read now covers BOTH loaders

⚠ **My first mutation was wrong and the test was right.** `const _early = searchAuditLog;` above the gate left the suite GREEN — because it has no `(`, so the probe still found the real call below. Recorded because a green run there could have been read as a broken assertion; the defect was in my probe.

| Probe | Result |
|---|---|
| POST-FIX · a real `await searchAuditLog({...})` CALL above the gate | **1 failed \| 5 passed (6)** — *"expected 188 to be less than 138"* |
| PRE-FIX · the SAME mutation against the old guard | **6 passed (6) — GREEN.** The assertion is new reach, not a restatement |

### R3-3 — the positional binding is no longer self-matchable

⚠ **Re-measured first, as instructed, and the fix is NOT smaller than the finding.** GC-5 shrank `page.tsx`, but at head the gate call sits at **line 397 of 514 — 396 lines and 8 function declarations above it.** The self-match surface is large, not residual.

| Probe | Result |
|---|---|
| PRE-FIX · decoy helper returning `"requireAdminPage("` above the page fn, **and the real gate DELETED** | **6 passed (6) — GREEN WITH NO GATE.** The defect, demonstrated |
| POST-FIX · same decoy, same deleted gate | **1 failed \| 5 passed (6)** — *"expected -1 to be greater than or equal to 0"* |

### R3-4 — the fallback copy, plural-aware

`?from=junk&to=junk` is an **already-tested** case, and the copy said *"it was the only filter supplied"* over two of them. It shipped past a green suite because nothing asserted the rendered sentence for that shape.

RED, pre-fix: *"expected 'From and To date ignored. That value …' to contain 'the only filters supplied'"* — **1 failed | 28 passed (29)**.

Both directions asserted, because "always plural" would have passed the new test on its own: BOTH-invalid pins the plural strings and asserts the singular ones ABSENT; ONE-invalid does the reverse. ⚠ **The three load-bearing claims are unchanged in both arms** — *"No search ran"*, *"the default blocked-submissions feed"*, *"content removals and user bans are never in it"* — and both cases re-assert them, so a future copy edit cannot trade substance for grammar.

### R3-5 — @security-auditor, scoped

**0 CRITICAL · 0 HIGH · 5 MEDIUM · 6 LOW · 1 SURPRISE.** ⛔ S-0j did not fire.

Verdict, quoted: *"No blocked-image byte, signer token, raw r2 key, or blocked text reaches an unscanned render path in shipped code at `3dfdced`. **But the guard does not scan the render tree — it scans a directory, and those two sets are already different.**"*

It stated its own discriminator rather than just a rating: the read-2 HIGH was HIGH because shipped code *had already escaped* the control; nothing has escaped here, so every finding needs a future change by a trusted committer.

**ONE thing fixed, and it is a LOW under a report-only rule** — comment-only, in my own text, on a claim I wrote this round. The R3-3 docblock said the guard had **one** residual; the auditor demonstrated **three**: the string-literal decoy I stated, plus (2) `stripComments` anchors `//` at line start so a **trailing** comment survives it (GREEN at `gateAt=174` with the gate deleted), plus (3) the **slice key itself is decoy-able** — a string containing `export default async function` above the page re-widens the scope (GREEN at `gateAt=36`). **A control recorded with a misleading cause is itself a defect (O-3)**, and this round's whole subject is guards that read green while blind; shipping a docblock that overstates its own resistance would have been that defect, knowingly.

Also recorded there: **the body-scoping cost one case.** A module-scope `loadModerationAuditFeed(...)` above the gate was caught by the old whole-file probe and is not caught by the body-scoped one (verified OLD RED / NEW GREEN). Contrived, leaks nothing, worth less than the self-match fix it bought — stated so read-4 does not rediscover it as a regression.

All three residuals are bounded by an **independent behavioural control** the auditor verified: `audit-page-auth.test.ts` invokes the real page with a null session through the real `requireAdminPage`. A deleted gate goes RED there whatever the textual probe does. **This probe is a tripwire, not the gate.**

**Reported, not fixed** (MEDIUM/LOW are report-only; none is a live leak):

| ID | Sev | Finding |
|---|---|---|
| M-1 | MEDIUM | ⚠ **The scan axis is a DIRECTORY; the render tree is an IMPORT CLOSURE.** `page.tsx:3` already imports `AdminTabs` from outside `AUDIT_ROUTE_DIR`, so the unscanned set is non-empty at HEAD. Extracting `AuditRow` into `moderation/_components/` — the established convention, where `ReviewFeed` already lives — reproduces GC-5 one directory over, green. **Cannot be fixed by widening**: `moderation/` turns the suite RED on `ReviewFeed.tsx`, which is legitimately allowed to render images. Wants an import-closure walk — a separate task |
| M-2 | MEDIUM | `SIGNER_TOKENS` misses `mintReadUrl` (`storage/r2.ts`), the actual minter — `signRead` is a wrapper over it |
| M-3 | MEDIUM | The `<img` regex misses `<Image …>` and wrapper components. Chained with M-2, a complete green-guard leak path |
| M-4 | MEDIUM | Guard (d) scans `src/app` only; participant surfaces read through `src/server/**`. One-line fix available and verified non-breaking — not taken |
| M-5 | MEDIUM | The loader list is still hand-written; a call to a NEW loader above the gate leaves the probe green. SURPRISE-2 one level up |
| L-1…L-6 | LOW | The two extra residuals (in the docblock now) · textual order ≠ execution order · the module-scope case · `files.length > 1` pins a non-safety fact · guard (d)'s loop is vacuous-capable |
| S-1 | LOW | **No `robots.txt` anywhere**, while `login/page.tsx:8` comments that one exists. Mitigated to near-nil by the redirect. Separate task |

⛔ **D15 stays ROUTED** — this was the positional gate assertion, never SQL ordering. **@code-reviewer was not re-run** — it reviewed this surface at read-2. A decision.

---

## 2d · GATE C READ-4 CLOSE — two items, both PASS

Read-4 was otherwise clear. **The read-2 HIGH is DISCHARGED** — R3-1's pre-fix GREEN, the `page.tsx` positive control and the post-fix RED were verified independently by web. What remained were two MEDIUMs I had logged as *"report-only"* at read-3.

⚠ **That was a misreading of my own rule, and the founder caught it.** Plan §7 says MEDIUM and LOW are report-only **"unless the fix is one line AND inside the boundary."** Both of these were exactly that. The rule was **missed, not misapplied** — I read "MEDIUM → report" and stopped at the comma.

| Item | What | Outcome |
|---|---|---|
| **R4-1** | M-2 — `SIGNER_TOKENS` missed `mintReadUrl`, the actual minter | ✅ **PASS** — `3994b78` |
| **R4-2** | M-4 — guard (d) scanned `src/app`, not `src` | ✅ **PASS** — `3994b78` |

### R4-1 — and why this token and not the rest of the M-set

`mintReadUrl` (`src/server/storage/r2.ts`) is the real minter; `signRead` is a thin wrapper over it, so an import of `mintReadUrl` carried **none** of the four existing tokens.

⚠ **Chained with the still-open M-3** (`<Image …>` is invisible to the `<img` regex) **it was a COMPLETE green-guard leak path.** Adding this one token trips the *import* arm and **breaks the chain even with M-3 unfixed** — which is why it is worth taking alone rather than waiting for the closure task.

| Probe | Result |
|---|---|
| PRE-FIX · `mintReadUrl` planted in `search-surface.tsx` | **6 passed (6) — GREEN.** The gap |
| POST-FIX · same plant | **1 failed \| 5 passed (6)** |

A pre-fix RED would have meant the token was already covered and the fix a no-op. It was not — checked, because the relay required a halt in that case.

### R4-2 — the scan path

Guard (d) carries the file's most consequential claim: *blocked text never leaves the admin surface*. But participant surfaces do not import read models directly — they read through `src/server/**` — so a server module folding `blockedText` into a participant DTO was invisible, the importer set was empty for that whole subtree, and the loop asserted nothing.

**Re-verified non-breaking before touching it**, not taken on faith: every file under `src/` containing either substring is exactly one — `audit/page.tsx` — and it *is* under `/app/(admin)/`.

| Probe | Result |
|---|---|
| PRE-FIX · the import string planted in an EXISTING `src/server` file | **6 passed (6) — GREEN.** The whole subtree was outside the scan |
| POST-FIX · same plant | **1 failed \| 5 passed (6)** — *"expected '/Users/…/src/server/…' to contain '/app/(admin)/'"* |

### The delta, stated precisely — the boundary was "one line" each

**13 insertions / 2 deletions, one file.** Of those: **2 are functional** (the `"mintReadUrl"` entry; the path `${ROOT}src/app` → `${ROOT}src`), **1 is the variable rename the path change forces** (`appFiles` → `srcFiles` — leaving a name describing a scope it no longer has is the exact stale-name defect GC-2 filed), and **10 are explanatory comments**. Zero added logic, zero new assertions, zero exclusions. If the rename or the comments read as over-scope, both revert without touching the fixes.

### ROUTED, NOT FIXED — the new docket row

⚠ **LEAK-RAIL-CLOSURE** — dated pre-go-live, **owner: quality lane**. Carries **M-1** (the scan axis is a directory; the render tree is an import closure — and widening the directory again turns the suite RED on `ReviewFeed.tsx`, so the honest control is a transitive import-closure walk from the route entry), **M-3** (the `<img` regex misses `<Image …>` and wrapper components), **M-5** (the loader list is still hand-written), and **L-1…L-6** (the two extra gate-probe residuals, textual ≠ execution order, the module-scope case the body-scoping cost, `files.length > 1` pinning a non-safety fact, and guard (d)'s vacuous-capable loop).

**SURPRISE-1 routes separately:** there is **no `robots.txt` anywhere in the repo**, while `(admin)/admin/login/page.tsx:8` comments that one exists. Mitigated to near-nil by the redirect, but the comment asserts an absent control. Its own task, not the quality lane's.

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

Recorded in the commit-0 body as well as here, so it sits in immutable history and not only in a log file.

✅ **RATIFIED AT GATE C READ-2, and the judgment call removed rather than re-litigated.** The founder amended S-0a: it *"does NOT fire on the verbatim text of `docs/plans/POLISH-8.md`, which exists to state the prohibition. It fires on every other file without exception."* Read-1's *"Founder may reverse in one line"* is superseded — this stopped being my call. (R2-3 sweep item.)

---

## 4 · ROUTED, NOT BUILT — 21 rows, numbered

⚠ **CORRECTED at read-2, and the old figures were wrong three ways.** Recon produced **28** deltas, not 27 — `D01`–`D29` with no `D21` is **28** IDs, and that miscount propagated out of the recon artifact into this heading. Measured: **6 addressed** (D01 · D28 · D12 · D17 · D20 · D06) + **1 `superseded`** (D29) + **21 not built** = **28**. The 21 are **19 routed** + **2 halted**.

**The rows are numbered 1–21, so the total and the enumeration are the same artifact** — GC-3's fix for §10, applied here too. Owners are **PROPOSED, not assigned.**

| # | ID | Delta | Class | Disposition | Proposed owner |
|---|---|---|---|---|---|
| 1 | D11 | Close carries no confirmation of any kind | F | ⛔ **HALTED (S-0k)** | **Founder** — one-line ruling (§3) |
| 2 | D19 | Create-market surfaces raw error codes | F | ⛔ **HALTED** — code sets disagree | **Founder / spec lane** (§2 S-5) |
| 3 | D05 | `admin_events` has no writer; F-ADMIN-5's union arm is permanently inert | B (+R) | routed | **Founder** — writer vs. spec repoint; requested 2026-07-23, never granted |
| 4 | D07 | F-ADMIN-4's inline arm entirely unbuilt | B | routed · `inherited` (fix lives in `(public)`) | held by **D08** |
| 5 | D08 | ⚠ the three F-ADMIN-4 deferrals are docketed to a task that closed a month before they were minted | S | routed | **Founder** — H-P8-7 |
| 6 | D09 | LD-3 text-only carve-out ban-review surface unbuilt | B | ⛔ **H-P8-4** — reported, never scoped | **Founder, own chat** (child-safety) |
| 7 | D10 | Track-A informational rows absent; no "links to the audit record" | B | routed | held by **D08** |
| 8 | D13 | No admin sign-out affordance; `adminLogoutAction` built and unreachable; cookie indefinite | F | routed | **H-P8-1** (auth surface) |
| 9 | D14 | `loadAdminMarketsOverview` has no `.limit()` — unbounded | F | routed | **H-P8-1** (`src/server/admin/**`) |
| 10 | D15 | Audit ordering is not a total order (no `id` tiebreaker on 3 queries) | F | routed | **H-P8-1** |
| 11 | D16 | Audit feed has no pagination at all (X4) | R | `duplicate-of-known` | **Founder** — product ruling |
| 12 | D18 | Create-market: uploaded media cannot be removed or reordered; reload orphans R2 objects | F | routed | admin build lane |
| 13 | D02 | POLISH-0's invariant **proof** is imprecise; `ReviewFeed.tsx:22-25` claims "ZERO product components" while `:6` imports one | S | routed — **record fix, not code** | web / close-out |
| 14 | D03 | Row says "7 routes"; there are 8 routable entries | S | routed | web / close-out |
| 15 | D04 | Components cell omits 8, incl. `BanIndicator` — the component holding R7 | S | routed | web / close-out |
| 16 | D22 | Tier-3 cites `docs/logs/UI-6-log.md`, which does not exist | S | routed | web / close-out |
| 17 | D23 | Row omits SPEC.1 §15 — the functional baseline — from Tier 1 | S | routed | web / close-out |
| 18 | D24 | Control set omits audit search, media sign, sign-out | S | routed | web / close-out |
| 19 | D25 | POLISH-TRACKER §6 states the cost as EIGHT and enumerates SEVEN | S | routed | web / close-out |
| 20 | D26 | `no-raw-hex-view-layer.test.ts` does not reach `src/app/(admin)/**` | S | routed | **H-P8-3** quality lane |
| 21 | D27 | Same guard has no palette-class rule (already R15) | R | `duplicate-of-known` | **H-P8-3** quality lane |

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
| **M-3** | MEDIUM | With `?from=junk` and no other filter, `searching` is false → the page falls back to the **blocked-submissions feed**, a different read model. The note says *"unfiltered by it"* — true but materially incomplete. | `audit/page.tsx:306-307` | ⚠ **REPORTED, NOT FIXED at the cascade** — >1 line (plan §7) — **✅ SUPERSEDED BY GC-1 (`013cf3b`)**, founder overrode §7 for it |
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
| **L-1** | LOW | Same fallback-copy issue as @code-reviewer M-3, reached independently: the note reads as *"you are seeing more"* when the operator has in fact been silently narrowed to the gate-block feed, which by construction contains **no** `content_removed` and **no** `user_banned` rows. | ⚠ **REPORTED, NOT FIXED at the cascade** — **✅ SUPERSEDED BY GC-1 (`013cf3b`)**, same fix as M-3 |
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

It was **not fixed at the cascade** because plan §7 makes MEDIUM/LOW report-only unless the fix is one line, and this needed `searching` threaded into `InvalidDateNote` plus a new clause.

✅ **It WAS the first item of the follow-up.** The founder overrode §7 for it at Gate C read-1 and it landed as **GC-1 (`013cf3b`)**. The recommendation above is kept as written — it was the cascade's output — with its outcome stated beside it rather than edited into it (R2-3).

### Gate C read-1 — the reviewer cascade was not re-run · ⚠ **REVERSED AT READ-2**

At read-1 I wrote: *"GC-1's behaviour change is confined to one string branch inside a presentational component with no handler, no state and no data read"*, and skipped the cascade on that ground.

⚠ **That rationale described HALF of GC-1, and the founder caught it at read-2.** GC-1 also replaced `page.tsx:401` — the expression selecting between `searchAuditLog` and `loadModerationAuditFeed`, i.e. **two different read models** on this surface. §2a discloses that correctly (*"the page uses it too, replacing its inline `Object.keys(filters).length > 0`"*), so the fact was on the record and only the **rationale** understated it. @code-reviewer independently raised the same contradiction at read-2 (MEDIUM).

**The decision was defensible and the extraction is now PROVEN** (§2b) — but per **O-3, a correct call recorded with a misleading cause is itself a defect**, which is exactly why read-2 re-ran the cascade rather than accepting the conclusion. **@security-auditor was not re-run** — it audited this surface a round ago and GC-5 is a relocation; founder-ruled, recorded as a decision.

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
| Files changed vs base `dfa3012` | **11** (read-3 added `audit-feed-leak.test.ts`) |
| ↳ source files **modified** | **3** (`audit/page.tsx`, `TerminalActions.tsx`, `create-market-form.tsx`) |
| ↳ source files **added** | **1** (`audit/search-surface.tsx`, GC-5) |
| ↳ test files **added** | **4** |
| ↳ test files **modified** | **1** (`audit-feed-leak.test.ts`, R3-1/2/3/5) |
| ↳ doc files **added** | **2** (`docs/plans/POLISH-8.md`, `docs/logs/POLISH-8.md`) |
| Commits | **21** — measured, see §10 |
| Tailwind palette colour classes in `src/` | **0** (was 1) |
| Files under `src/app/(admin)` | **16** (+1: `audit/search-surface.tsx`, GC-5) |
| Routable entries under `(admin)` | **8** |
| Components under `(admin)` | **16** (15 + `InvalidDateNote`) |
| `src/server/**` files changed | **0** |
| `tests/unit/design/**` files changed | **0** |
| `docs/polish/**` files changed | **0** |
| Migrations / ADRs / SPECs changed | **0** |
| Guarded-string hits in added `src/` + `tests/` lines | **0** |

**Sum check — the categories PARTITION the total:** 3 source modified + 1 source added + 4 tests added + 1 test modified + 2 docs = **11**, equal to *Files changed vs base*. Every changed file lands in exactly one row. (Read-1 summed to 9 against 10; read-3 re-checked the partition after adding a file.)
⚠ Read-1's table had no *source added* row, so its categories summed to 9 against a total of 10 — **@code-reviewer M-4's exact defect, recurring in the table M-4 forced a re-measurement of** (R2-2).

### ⚠ GC-4 · every counted claim in this log, re-measured at PR head

Plan §6 required this and the machine phase did not fully do it. Each row is CONFIRMED (measured, matches) or CORRECTED (measured, differed).

| Claim | Where | Verdict |
|---|---|---|
| S-1 probe scanned **281** files, **1** offender, EXIT=1 | §2, §5 | **CONFIRMED** — pre-fix capture, correctly labelled as such |
| Palette classes in `src/` after S-1: **0** | §2, §7 | **CONFIRMED** — re-measured at PR head |
| S-2 mutation ①: **3 failed \| 1 passed (4)** | §2 | **CONFIRMED**, and now **labelled `908aaf0`** — the file has since gained a 4th assertion |
| S-2 mutation ②: **2 failed \| 2 passed (4)** | §2 | **CONFIRMED**, same label |
| S-2 baseline: **4 passed (4)** | §2 | **CONFIRMED** at PR head — still 4 |
| S-4 RED: **2 failed \| 5 passed (7)** | §2 | **CONFIRMED as a measurement**, now labelled `6430f18` |
| S-4 green: **"7/7"** | §2 | ⚠ **CORRECTED → 8 passed (8)** at PR head. The 8th block landed at `8fdc28c`, after the RED. **This is the GC-4 defect.** |
| Existing `terminal-actions.component.test.tsx`: **6/6** | §2 | **CONFIRMED** — untouched, still 6 |
| S-5 SET A **10** codes / SET B **13** | §2 | **CONFIRMED** — re-read from SPEC.1 §15 F-ADMIN-1 and `wire.ts` |
| Files changed: **9** | §7 | ⚠ **CORRECTED → 10** (GC-5 adds `search-surface.tsx`) |
| Commits: **8 / 9** | §7, §10 | ⚠ **CORRECTED → 12**, exhaustively enumerated in §10 |
| Files under `(admin)`: **15 (unchanged)** | §1, §7 | ⚠ **CORRECTED → 16**, and it *was* changed |
| Components: **16** | §1, §7 | **CONFIRMED** — enumerated by name at PR head; the move relocated `InvalidDateNote`, it did not add or remove one |
| Routable entries: **8** | §1, §7 | **CONFIRMED** — the new module is not a route |
| `src/server/**` changed: **0** | §7 | **CONFIRMED** |
| `tests/unit/design/**` changed: **0** | §7 | **CONFIRMED** |
| `docs/polish/**` changed: **0** | §7 | **CONFIRMED** |
| Migrations / ADRs / SPECs: **0** | §7 | **CONFIRMED** |
| `ReviewFeed.tsx` byte-identity: **0 diff lines** | §8 | **CONFIRMED** at PR head |
| Guarded-string hits: **0** | §7 | **CONFIRMED** — independently re-counted by @security-auditor too |
| Reviewer tallies (cr 0/1/4/7 · sa 0/0/0/5 + 3 SURPRISE) | §6 | **CONFIRMED** — 20 finding rows across both cascade tables, matching the reviewers' own headline counts |

**Rows added at Gate C read-4** — anything that round changed:

| Claim | Where | Verdict |
|---|---|---|
| M-2 / M-4 disposition: *"report-only"* | §2c | ⚠ **CORRECTED → FIXED at `3994b78`.** Plan §7 makes a one-line in-boundary MEDIUM a fix; I stopped reading at the comma |
| `SIGNER_TOKENS` membership | §2d | ⚠ **CORRECTED → 5 tokens** (was 4; `mintReadUrl` added) |
| Guard (d) scan root | §2d | ⚠ **CORRECTED → `src`** (was `src/app`), re-verified non-breaking: exactly one matching file, under `/app/(admin)/` |
| `audit-feed-leak.test.ts` | §2d | **CONFIRMED — 6 passed (6)** at read-4 head, two assertions strictly stronger |
| Files changed vs base | §7 | **CONFIRMED — still 11.** Read-4 changed one already-changed file plus this log |
| Commits | §10 | ⚠ **CORRECTED → 21** — re-measured at read-4 head |
| Sessions | §10 | ⚠ **CORRECTED → 5** |

**Rows added at Gate C read-3** — anything that round changed:

| Claim | Where | Verdict |
|---|---|---|
| §6's HIGH: *"REPORT ONLY — needs a boundary extension"* | §6 | ⚠ **CORRECTED → FIXED at `cb0a655`.** The founder extended the boundary by exactly that file |
| `audit-feed-leak.test.ts` | §2c | **CONFIRMED — 6 passed (6)** at read-3 head, with three assertions strictly stronger than before |
| `audit-search-surface.component.test.tsx` | §2c | ⚠ **CORRECTED → 29 passed** (was 27; R3-4 added the both-invalid case and its singular control) |
| Gate call position in `page.tsx` | §2c | **MEASURED — line 397 of 514; 396 lines and 8 function declarations above it.** GC-5 only partly cured L-4 |
| R3-3 residual count in the source docblock | §2c | ⚠ **CORRECTED → 3, was 1.** @security-auditor demonstrated all three |
| Files changed vs base | §7 | ⚠ **CORRECTED → 11** — read-3 added `audit-feed-leak.test.ts` to the changed set |
| Commits | §10 | ⚠ **CORRECTED → 19** — re-measured at read-3 head. ⚠ I first wrote **20** here and the numbered table caught it before push: 19 rows, 19 measured. **That is the numbered-table fix working as designed** (R2-1 / GC-3) — the seventh instance of the genus, and the first one caught by the mechanism instead of by a founder |
| Sessions | §10 | ⚠ **CORRECTED → 4** |

**Rows added at Gate C read-2** — anything that round changed:

| Claim | Where | Verdict |
|---|---|---|
| Recon delta total: **27** | §4 | ⚠ **CORRECTED → 28** — `D01`–`D29` has no `D21`, so the ID range is 28 |
| Routed-not-built: **20 rows / 18 routed** | §4 | ⚠ **CORRECTED → 21 rows / 19 routed**; rows now numbered 1–21 |
| §7 categories sum to the total | §7 | ⚠ **CORRECTED** — read-1 summed to 9 against 10; a *source added* row now closes the partition |
| §9 item count | §9 | ⚠ **CORRECTED by DELETION** — said four, enumerated six; §9 now states no count |
| `audit-search-surface.component.test.tsx` | §2b | ⚠ **CORRECTED → 27 passed** (was 13; R2-6 added the equivalence proof + the userId discriminator) |
| Sessions: **2** | §10 | ⚠ **CORRECTED → 3**, one wall-clock line each |
| Commits | §10 | ⚠ **CORRECTED → 15** — re-measured at read-2 head |
| `searchRan` ≡ the pre-GC-1 selector | §2b | **CONFIRMED** — PURE EXTRACTION; sha256-identical `parseFilters`, 220,442-input differential fuzz, 0 divergences |
| `search-surface.tsx` byte-identity after R2-6's two mutations | §2b | **CONFIRMED** — `git diff HEAD` empty after each revert; both R2-6 commits are test-only |
| Files changed vs base | §7 | **CONFIRMED — still 10.** Read-2 changed only an existing test file and this log |
| Test files at PR head, per file | *(inlined here — read-1 cited §7, which carries no per-file counts; R2-5)* | ⚠ **CORRECTED at read-2** — `terminal-actions-permanence` **8** · `create-market-form-utc-label` **3** · `review-feed-side-chip` **4** · `audit-search-surface` **27** (was 13; R2-6 added the equivalence proof) = **42** |

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

With the founder pass batched, this is the only surviving carrier of the feedback loop. Ordered by how much each cost.

⚠ **This header states no count, deliberately.** It read *"Four things"* and enumerated six — items 5 and 6, added at Gate C read-1, broke a sentence two lines above them without either round noticing. Read-2 ruled: **delete the count, do not correct it to six.** §9 is a list, not a measurement; a total that carries no information is pure liability and would break again the next time an item is added.

**1 · A plan can forbid its own execution, and both times it happened here the contradiction was invisible from the plan text alone.** Two of eight items hit a jointly-unsatisfiable pair — S-0a vs §2 at commit 0, and S-3 vs S-0k — and a third (S-5) hit the halt the plan itself anticipated. **That is a 3-in-8 rate on a plan that was carefully written.** The S-0a one is structural: §0 says "read before anything else", but §0 could not be satisfied by the very first action §2 mandates. **Next relay: run the stop conditions against the plan's own commit 0 before shipping the relay.** A one-line carve-out ("S-0a exempts the verbatim plan text") would have removed the whole judgment call.

**2 · The edit boundary was drawn around *source* files and forgot that behaviour is pinned by *tests*.** §4 listed "the new admin-side test file(s)" but no existing ones. Any behaviour change whose old behaviour is asserted somewhere is therefore unshippable by construction — and S-3's old behaviour was asserted, in a passing test, by name (`close-is-one-click`). **The boundary should name the existing tests that pin the behaviour each item changes**, or state that updating a test which encodes a superseded position is in scope. This is generalisable: it will recur on every "spec outranks plan" item.

**3 · The recon read the conflict as doc-vs-doc and missed that it was doc-vs-*green-test*.** My own POLISH.8 recon filed D11 citing SPEC.1 §15 against `docs/plans/UI-6.md` §2.S2, and quoted both. It never checked whether the built behaviour was *asserted* anywhere. Had it grepped the test suite for the disputed behaviour, D11 would have arrived carrying its own blocker and the plan would have scoped it differently. **Add to recon: for every delta whose fix changes behaviour, grep the suite for a test that pins the current behaviour, and report it on the row.** A delta with a green test defending it is a different, more expensive object than one without.

**4 · Two axis-A observations were correctly *not* filed, and the mechanism that stopped them is worth keeping.** Tier 3 killed the "Correct is surfaced though §15.3 says v1 doesn't" divergence (UI-6 plan R4 is a deliberate ratified reversal) and tier 1 killed the "three routes are unstyled" one (SPEC.1 §15.3 ratifies them as *"functional and unstyled"*). Both would have been filed as defects by a pass that skipped tier 3, which is exactly the POLISH.0 finding — **three of four apparent divergences were false, each resolving on a tier-3 document.** The read order is load-bearing; it earned its place again.

**5 · The arithmetic-vs-enumeration defect is the corpus's most persistent genus, and I reproduced it four more times while filing it.** This PR files **D25** against `POLISH-TRACKER` §6 for stating EIGHT and enumerating SEVEN. Then, in the document that reports it: §7 said "8 … 9 with this log"; §10 said "9" and enumerated eight; **§9's own header said "Four things" and enumerated six** — broken by items 5 and 6, which this very lesson added; **§4 said "20 rows" and enumerated 21**, its "27 deltas" itself wrong because `D01`–`D29` has no `D21`; and **§7's categories summed to 9 against a total of 10**. **Six instances, five of them inside this PR, three inside the section that reports the genus.** Every one was arithmetic — no item was ever missing.

The fix that would have caught all three instances is mechanical, not attentional: **never write a total you did not just measure, and never write a total beside an enumeration without counting the enumeration.** §10 now carries the enumeration as a numbered table, so the two cannot disagree silently — a list of 12 rows numbered 1–12 fails visibly if the total is wrong. **Next relay: require the count and the enumeration to be the same artifact.**

**6 · "Re-verified at PR head" was written, not done.** Plan §6 required it. The S-4 green count ("7/7") was true when written at `6430f18` and false at PR head, because `8fdc28c` added an eighth `it` block *after* the RED was captured — for a reviewer finding, i.e. exactly the mechanism most likely to move a count late. Nothing flagged it; the founder did. §7 now carries a **CONFIRMED / CORRECTED** row per counted claim, which is the only form of that instruction that can be checked. **Three of read-1's twenty-two rows came back CORRECTED** — file count, commit count, and files-under-`(admin)` — all three because GC-5 added a file *after* the numbers were written.

**7 · A guard is scoped to an ARTIFACT; the property it protects is scoped to a BEHAVIOUR. Wherever those two diverge, the guard reads green while blind — and this PR hit that shape five times.**

- `no-raw-hex-view-layer` is scoped to `SCAN_DIRS`; the property is *"no palette colour anywhere in the view layer"*. It could not see `(admin)` (**D26**).
- `side-pole-binding` is scoped by `ADMIN_EXCLUSION`; the property is *"poles encode side"*. It could not see the admin chip (**S-2 exists only because of that**).
- `audit-feed-leak` was scoped to `PAGE_FILE`; the property is *"nothing in this route's render tree mints a viewable URL"*. GC-5 moved a renderer one hop and it kept reading green (**R3-1**).
- **GC-2's own sweep** was scoped to *comments in the diff*; the property was *"nothing in this PR describes a superseded implementation"*. The log's prose was outside the scan, and five stale statements survived (**R2-3**).
- And the R3-3 docblock was scoped to *the residual I had thought of*; the property is *"the reader knows what this probe cannot catch"*. Two more residuals existed (**R3-5**).

**The trap is that widening the scope by one notch fixes the instance and not the class.** R3-1 replaced a filename with a directory — and @security-auditor immediately showed that the route's render tree is not its directory either: `page.tsx` already imports a component from a sibling folder, and the natural home for an extracted `AuditRow` is the very directory where `ReviewFeed.tsx` — which would fail this guard's own assertion — already lives. Widening again is *worse*: scoping to `moderation/` turns the suite RED on a file legitimately allowed to render images.

**Next relay: when a guard is written or repaired, state the PROPERTY first and the SCOPE second, then ask whether the scope can express the property at all.** If it cannot — as here, where the honest scope is the transitive import closure from the route entry — say so in the guard, and file the real control as its own task rather than shipping a narrower one that reads like closure. Three of the five above were found by a reviewer, not by the suite; none of them could have been found by running the tests.

**Smaller, still worth carrying — and my first justification for it was wrong.** Exporting `invalidDateFields` / `InvalidDateNote` / `ACTION_TYPE_PLACEHOLDER` from a `page.tsx` was the only way to assert against shipped symbols without adding a colocated file outside the boundary. `next build` accepts it — but **not** for the reason I originally wrote here. I cited `(admin)/admin/login/page.tsx`'s `submitAdminLogin` as precedent; @code-reviewer (L-5) and @security-auditor both established that is **not like-for-like** — `submitAdminLogin` carries an inline `"use server"` directive and is therefore a Server Action, an explicitly sanctioned pattern with its own rules. A plain module export is a different thing.

The real mechanism: Next 16's generated `.next/types/validator.ts` validates pages with a **subtype constraint** (`type __IsExpected<Specific extends AppPageConfig<…>>`), and `extends` is structural subtyping — excess properties pass by construction. **The legacy webpack `next-types-plugin` still shipped in the same `node_modules` does an EXACT check that would reject these**, via `checkFields<Diff<{…known…}, TEntry, ''>>()`. It does not run because this build is Turbopack. **So the tolerance is a Next-16-Turbopack property, not a stable contract** — a bundler change could break it. Carry that, not the precedent claim.

---

## 10 · Session count and wall-clock time

- **Sessions — one line each, so the count and the enumeration cannot disagree** (R2-4; read-1 said "2" beside a wall-clock describing one):

  | # | Session | Wall-clock |
  |---|---|---|
  | 1 | Machine phase — plan + ship set + reviewer cascade + PR-open | 2026-08-12, ~04:00–05:00 local, unattended |
  | 2 | Gate C read-1 remediation — GC-1…GC-5 | 2026-08-12, ~05:00–06:00 local, unattended |
  | 3 | Gate C read-2 remediation — R2-1…R2-6 | 2026-08-12, ~06:00–07:00 local, unattended |
  | 4 | Gate C read-3 remediation — R3-1…R3-5 | 2026-08-12, ~07:00–08:00 local, unattended |
  | 5 | Gate C read-4 close — R4-1…R4-2 | 2026-08-12, ~08:00–08:30 local, unattended |

  Recon was a separate prior session and is not counted here.
- **Founder-serial touches consumed:** **machine phase 0** (pre-authorised under D4, no verdict round) — but Gate C then cost **two reads**, and this line said *"the next and only founder touch"* through both (R2-3). Measured total for the surface so far: **recon · plan ratification · execute (0 serial) · Gate C read-1 · Gate C read-2** — with read-3 pending.
- **Commits: 21** — `git log --oneline dfa3012..HEAD | wc -l`, MEASURED not reasoned, re-measured at read-4, and cross-checked against the 21 numbered rows below. Exhaustive enumeration, one line per commit:

  | # | SHA | What |
  |---|---|---|
  | 1 | `8993c60` | plan, verbatim (commit 0) |
  | 2 | `92c401b` | S-1 / D01 |
  | 3 | `908aaf0` | S-2 / D28 |
  | 4 | `6430f18` | S-4 / D12 |
  | 5 | `ed6b82a` | S-6 / S-7 / S-8 |
  | 6 | `cc26be1` | @code-reviewer round (H-1, M-1, M-2) |
  | 7 | `8fdc28c` | @security-auditor round (L-3) |
  | 8 | `b96a0c2` | session log (machine phase) |
  | 9 | `013cf3b` | **GC-1** |
  | 10 | `d7b8402` | **GC-2** |
  | 11 | `7dcaa1a` | **GC-5** |
  | 12 | `c5c6620` | **GC-3 + GC-4** log corrections |
  | 13 | `c687842` | **R2-6 part A** — the `searchRan` equivalence proof |
  | 14 | `097fd72` | **R2-6 part B** — the userId discriminator @code-reviewer found missing |
  | 15 | `77e038d` | **R2-1 … R2-5** log corrections |
  | 16 | `cb0a655` | **R3-1 / R3-2 / R3-3** — the leak rail repaired |
  | 17 | `3dfdced` | **R3-4** — the plural fallback copy |
  | 18 | `bdc9c96` | **R3-5** — the docblock's understated residual |
  | 19 | `2b2fe58` | **read-3 log** |
  | 20 | `3994b78` | **R4-1 / R4-2** — the two one-line leak-rail fixes |
  | 21 | *this commit* | **read-4 log** |

  ⚠ **The machine phase stated this wrong twice, in the same document.** §7 said "8 … 9 with this log"; §10 said "9" and then enumerated eight. The measured figure at that point was **8**, and no commit was missing from the enumeration — the error was purely arithmetic. **That is D25's exact genus** (POLISH-TRACKER §6 states EIGHT and enumerates SEVEN), third instance in the corpus, and it survived a §7 table that @code-reviewer M-4 had *already* forced a re-measurement of. The lesson is in §9.
- **Full `just verify` runs:** 20 — one baseline, one per commit boundary, one re-run after a Biome format fix, one per reviewer round, and one per Gate C read-1 code item (GC-1, GC-2, GC-5), three at read-2, four at read-3, and two at read-4. All green at every commit boundary; **⛔ S-0g never fired.**
- **Full suite at PR head:** `pnpm vitest run` → **324 files passed | 1 skipped (325)**, **2887 tests passed | 1 skipped | 4 todo (2892)**, EXIT=0. Measured at read-4 head. (Machine phase 2868 → read-1 2871 → read-2 2885 → read-3 2887 → read-4 2887 — R4 added no test, only two assertions inside existing ones.)
- **Reviewer runs:** 3 agents total — @code-reviewer and @security-auditor at the machine phase (~12 and ~11 min), then a **scoped @code-reviewer re-run at read-2** (~10 min) for GC-1's control-flow change. Machine phase: 1 HIGH + 2 MEDIUM + 1 LOW fixed. Read-2: 1 MEDIUM fixed, 1 HIGH reported outside the boundary. @security-auditor was not re-run at read-2 — founder-ruled. **At read-3 it WAS re-run, scoped to the leak rail** (~9 min): 0 CRITICAL, 0 HIGH, 5 MEDIUM, 6 LOW, 1 SURPRISE; one LOW fixed as a truthfulness repair on my own docblock. @code-reviewer not re-run at read-3.

## 11 · CLOSE-OUT

**Surface · routes · components, as VERIFIED at step 0.** 8 routable entries — 7 pages + `POST /admin/markets/media/sign`, which no document listed. 16 files under `(admin)`. 16 components: 7 named in POLISH-0's row, 8 omitted from it (including `BanIndicator`, which holds the row's own pre-recorded delta), 1 added by this PR.

**Step 0 findings: 30 claims swept — 24 TRUE · 5 FALSE · 1 ABSENT.** No named source failed to exist; the three ⟐ tier-1 candidates (ADR-0010 / 0027 / 0028) all resolved with the right subject. **No class-S HALT on source existence.** The FALSE five and the one ABSENT baseline are `PD-8-21` … `PD-8-25`.

**Machine PR: #323 — 6 shipped · 2 halted · 1 superseded · 21 routed**, from an inventory of **28** (`P8-D01`–`P8-D29` with no `D21`). Merged `f6d9775`.

**Gate C: FOUR reads, and every one found something.** Read 1 — four blocking items, one of them an honesty regression this PR introduced. Read 2 — a control-flow extraction that the skip-the-cascade rationale had described incorrectly; proven PURE by byte-identity plus a 220,442-input differential fuzz. Read 3 — the leak-rail HIGH, discharged with a demonstrated pre-fix GREEN. Read 4 — two one-line fixes the plan's own rule required and the round had left. ⚠ **Three surfaces had already shipped a real defect through a green suite; this one shipped none, and four reads is why.**

**Halts routed to:** `ADMIN-CLOSE-CONFIRM` (`PD-8-08`) · `ADMIN-ERROR-COPY` (`PD-8-09`). Both halted on measurement, not on prediction.

**Register: `PD-8-01` … `PD-8-28`**, allocated from a live high-water mark of zero, against the 9-column POLISH.8 schema read at head.

**Exit bar — `POLISH-0.md` §7, item by item.**
1. **Parity** — **N/A by ratification (P9).** No tier-4 baseline exists; criterion 1 does not apply to this surface.
2. **Invariant-visual obligations** — **PASS, and this is the strongest thing `.8` delivers.** *Admin is not a participant* re-verified as a measurement on two arms with positive controls: structurally (no `role`, no `is_admin`, no `users` row, a separate auth tree) and by transitive import walk (105 modules, 2 reachable `src/components` files, both inert) against a 46-hit positive control under `(public)`.
3. **Every interactive affordance functional end-to-end** — **PASS with three recorded exceptions**: `PD-8-08` (Close confirm), `PD-8-09` (error copy), `PD-8-15` (sign-out). All routed with named owners and dates.
4. **All states rendered** — **N/A.** W2.11's kit governs participant surfaces; admin has no ratified state kit and design-language §7 defers its visual language to its own pass.
5. **Cross-surface criteria** — **N/A.** No participant primitive is consumed; that is the point of criterion 2.
6. **Token usage** — **PASS.** Zero raw hex under `(admin)`, measured directly since the guard does not reach here. The one Tailwind palette class in `src/` is fixed (`PD-8-01`) and the guard's two independent gaps are filed (`PD-8-27`, `PD-8-28`).
7. **Pole binding on both sides** — **PASS.** The one side-encoding site is pinned at both poles with opposite-pole absence, RED-proven on two mutation classes. The one new side-encoding string is asserted never to key a colour.
8. **Shell criteria** — **EXEMPT by ratification.** There is deliberately no `(admin)/layout.tsx`; otherwise eight checks read as failures.

**Closing status: `closed (a11y-deferred)` for the machine phase. THE SURFACE IS OPEN** — the founder pass has not run, exactly as for `.1`, `.2` and `.7a`.

**Emitted to the tracker:** one batched row.

**Carried forward, each with a NAMED OWNER:** `ADMIN-EVENTS-WRITER` · `ADMIN-INLINE-MODERATION-ACCEPTED` · `ADMIN-CLOSE-CONFIRM` · `ADMIN-ERROR-COPY` · `ADMIN-SIGNOUT` · `AUDIT-ORDER-TOTAL` · `LEAK-RAIL-CLOSURE` · `ADMIN-MEDIA-EDIT` · `ADMIN-NOINDEX` · `STAGING-AUTO-ADVANCE`, plus amendments to `NO-RAW-HEX-REACH`.

### ⚠ Lesson for the next relay: what the machine read missed

**The bottleneck moved from the record to the instructions, and that is the finding.** `.7a` cost eight because the record was wrong. `.8` cost **ten, and six were caused by defects in the relays** — a stop condition that forbade committing the plan it mandated · an edit boundary drawn around source that forgot behaviour is pinned by tests · a ruling that traded a moderation safety control for a build fix without noticing · a spanning proof set blind to one field · a guard axis specified as a directory when the property was an import closure · a probe told to plant a token the guard does not scan, which would have passed vacuously and which **CC caught**.

**Four things for `.3`'s relay to carry:**

1. **Run the plan against its own stop conditions and its own edit boundary before shipping it** (§13.1, §13.2). Two of `.8`'s eight items hit jointly-unsatisfiable pairs.
2. **At recon, for every delta whose fix changes behaviour, grep the suite for a test pinning the current behaviour** and report it on the row. `.8`'s recon read a conflict as doc-vs-doc when it was doc-vs-green-test, and the plan scoped it wrongly as a result.
3. **A structural fix can trade one safety property for another.** GC-5 closed a latent Turbopack build hazard and narrowed a blocked-image leak rail in the same edit — the same change partly cured one finding on that guard while creating a HIGH. **State what a structural change costs, not only what it buys.**
4. ⚠ **Tier 3 earned its place again, twice.** Two apparent divergences resolved FALSE on tier-3 documents — *Correct* being surfaced despite §15.3, and the three unstyled routes. **A pass that skipped step 3 would have filed both as defects**, which is precisely POLISH.0's finding that three of four apparent divergences were false and each resolved on a tier-3 document.

---

*POLISH.8 — machine phase (#323, `f6d9775`, merged 2026-08-12) + Gate C reads 1 through 4, then the close-out at #326. **The machine phase is closed; the SURFACE is open** until the comprehensive founder pass runs.*
