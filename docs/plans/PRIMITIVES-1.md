# PRIMITIVES-1 — plan

**Task:** four cross-surface primitive cleanups POLISH.1 surfaced and did not absorb —
an avatar ring token bypass (C1), a formatter name collision (C2), product-wide Đ digit
grouping (C3), and three guard/comment corrections (C4) — plus the SPEC.1 §10.8 rider
that unblocks C3.

**Ritual:** FULL. Recon (done) → this plan → operator ratification → **fresh-chat
execute** → `@code-reviewer` → **Gate C web diff-read before merge**. NO
`@security-auditor`: display-grade formatting and a CSS token binding; no write path,
no engine contact, not a CLAUDE.md §1 critical path.

**Authorship:** plan and rider web-authored, operator-ratified, CC-committed.
**Ground:** `origin/main` = `origin/staging` = `1df95c0`. SPEC.1 **1.0.28 → 1.0.29**.
**Recon:** `~/Desktop/PRIMITIVES-1-recon.md`, read-only @ `1df95c0`, R1–R9 answered.

**Days to go-live at authoring: 42.**

---

## §1 · Exit criterion

| # | Criterion |
|---|---|
| 1 | Every Đ value rendered to a user groups its integer part with a literal ASCII comma |
| 2 | Exactly ONE display formatter for Đ values exists; no ungrouped display variant remains to be selected by mistake |
| 3 | The `.md` export path is **byte-unchanged** — golden fixture and all three serialize grouping assertions green without regeneration |
| 4 | The avatar ring is visible on the fallback path at all four `Avatar` render sites, bound to `--avatar-ring` |
| 5 | SPEC.1 §10.8 carries the grouping rule, landed in the SAME COMMIT as the code it governs |
| 6 | Every guard this task touches is PROVEN TO BITE by a named reversal — not asserted |
| 7 | `MONEY_IDS` covers every money identifier in the render census |
| 8 | No DDL, no migration, no event type, no ADR, no read-model or DTO change |

---

## §2 · Ground — verified at `1df95c0`, not inherited

| Fact | Value | Evidence |
|---|---|---|
| `origin/main` tip | `1df95c04f7688d7c35cb34c5e60e7472573f64fa` | recon SETUP |
| `origin/staging` | same SHA — in sync | recon SETUP |
| SPEC.1 version | **1.0.28** | `SPEC.1.md:15` |
| §10.8 extent | lines **586–597** | next heading §10.9 at `:598` |
| §10.8 on grouping | **SILENT** — the word "group" does not occur | R5d |
| §20 last row | `1.0.28` at `:1490` | R5e |
| Đ display sites | **33** (+2 vs DROUND's 33 baseline: `DharmaCluster.tsx:84`, `:93`) | R3 |
| Đ export sites | **9**, all in `serialize.ts` | R3 Table 2 |
| Public-dataset exporter | **DOES NOT EXIST** — §12.2 describes one, unbuilt | R3 |
| `.dark` applied anywhere in `src/**` | **NEVER** — `dark:after:mix-blend-lighten` is dead CSS | R1c |
| `Intl` / `toLocaleString` on a Đ value | **ZERO** — one call site total, `VisitorCounter.tsx:30`, pinned `"en-US"`, formats a count | R7 |
| Page-level footer under `src/app/**` | **NONE**. Two nested `<footer>` exist and are legitimate | R8a, R8c |
| Guards ever proven to bite | **1 of 3** — `no-raw-dharma-render` only, for the identifier `portfolio` only | R9a |

**Not required by this task, so not verified:** ADR ceiling, migration head, `EVENT_TYPES`.
This task mints none of them. If the execute chat finds it needs any, **HALT**.

---

## §3 · Ratified rulings — D1–D8, durable

These outlive the task. Future surfaces inherit them.

| # | Ruling |
|---|---|
| **D1** | **"Never in export" is narrowed to MACHINE-READABLE output.** The seed's premise — that `debate-export/**` feeds the Nov 6 public dataset — is **false on both counts**: this file is ADR-0025's per-debate human `.md` download (`route.ts:57`, `text/markdown`), and no public-dataset exporter exists on disk. The part of the export that IS machine-read — the YAML front matter, `serialize.ts:127` — **already renders ungrouped** via `formatDharmaExact` directly. Grouping follows the reader, not the file. **Consequence: the export path receives ZERO code changes in this task.** The grouped prose is correct as built and is now ratified as such so no future reader "fixes" it. Golden fixture stays byte-exact; `serialize.test.ts:645/647/660` stay green. |
| **D2** | **Grouping becomes a property of the single shared display formatter.** `format.ts :: formatDharma` rounds AND groups. **`composer/copy.ts:20 :: formatDharmaGrouped` is DELETED**, its 13 Đ call sites re-pointed to `formatDharma`. No ungrouped display variant survives. Opt-in was rejected: a convention that must be remembered at 33 sites will be broken at the 34th — which is exactly how PD-0-26 arose. The structural safety property: **`serialize.ts` never calls `formatDharma`** (every export site goes to `formatDharmaExact`), so grouping cannot leak into the export by construction rather than by discipline. |
| **D3** | **The composer's TO WIN share quantity IS a Đ value** and groups. A winning share pays exactly Đ 1 at resolution (`quote.ts:29`), so `Đ 2,480` is a Dharma amount a participant would receive, not a ratio. Distinct from the `Đ 1 → Đ 2.63` return-per-unit expression, which is an odds statement and stays exempt: **the §10.8 multiplier exemption covers ratios, never quantities.** Named explicitly in the rider so it is not re-opened. |
| **D4** | **A count must never be routed through the Đ display formatter.** `BetComposer.tsx:491` runs a character-limit count through it, acquiring both 0-dp rounding and grouping — a violation of §10.8's own scope sentence on its face. Re-pointed to a plain integer render. Not scope creep: D2's default would otherwise silently change a character counter's appearance. |
| **D5** | **The ratified token contract governs the avatar ring; the v1.0 output mockups do not.** The mockups specify `1.5px solid var(--ink)` but define `--ink:#0A0A0A` — near-black, authored against the **retired light palette**, whereas the shipped system sets `--color-ink:#fafafa`. Honouring them would draw a 1.5px near-WHITE ring. `mockups/README.md:8-15` calls those files *"built OUTPUT … reference, not pipeline inputs."* Governing value: **1px `#404040`** — `design-token-contract.md:209`, `values-log:178`. |
| **D6** | **The primitive binds `--avatar-ring` EXPLICITLY.** `avatar.tsx:20` drops `after:mix-blend-darken` and its dead `dark:after:mix-blend-lighten` sibling, and replaces `after:border after:border-border` with `after:[border:var(--avatar-ring)]`. Dropping the blend alone would fix the pixels and leave a ratified token with **zero consumers** — and an orphaned token gets deleted or drifts at the next branding pass. The binding also survives a `--border` re-point, which the recon flagged as the precondition splitting the two paths (`IdentityCluster.tsx:48-50`). Same pixels today, correct binding tomorrow. |
| **D7** | **`IdentityCard.tsx:40-46` is OUT OF SCOPE.** The fifth PFP site is a deliberate plain `<img>` — `rounded-[var(--imgr)]` 6px, `bg-n1`, no ring — which no fix inside `ui/avatar.tsx` reaches. Whether a 6px-radius square PFP takes a ring is a CD question, not a primitive binding. **Recorded as a POLISH.5 register row**, together with the values-log `:278` open item (*"scrubbed-avatar visual … one-line brand ruling owed"*). |
| **D8** | **The footer guard globs and judges BY POSITION, never by element name.** Banning `<footer>` outright is now demonstrably wrong: two legitimate nested `<footer>` elements exist today — `(auth)/onboarding/page.tsx:160` inside `<Card>`, `(admin)/…/ReviewFeed.tsx:164` inside `<article>` — and an element-name ban turns RED on both the moment it lands. The guard scans every layout and page under `src/app/**` and asserts no **page-level** footer. Its RED proof must inject a footer under a **novel component name in a PAGE file** — catching `SiteFooter` in a layout proves only what the retired three-file loop already proved (`SHELL-COMPLETE.md:200`, LOW-4). |

### §3.1 · Two test inversions — legitimate, and why

`market-card.test.tsx:65` (`"Đ 14260 staked"`) and `dharma-cluster.test.tsx:260-263`
(`not.toContain("2,480")`) both pin the PRE-RULING state and **both say so in their own
comments** — the latter reads *"grouping is class R, routed to POLISH."* They were
written as dockets, not as baselines.

The distinction from POLISH.1's doctored-baseline failure is precise and load-bearing:
**there, a test was edited to make code pass; here, the governing rule changes in the
same commit.** If the rider does not land in that commit, the inversion IS the failure
mode. This is the single strongest argument for the same-commit doctrine on this task.

`format.test.ts:69-78` is not an inversion — it tests a deleted function, and its
assertions MOVE onto `formatDharma`.

### §3.2 · Escalations raised at ratification, owned elsewhere

- **AGPL-3.0 §13 source offer (`I6`) does not exist in the product.** `SPEC.1:1134`
  names it a hard legal requirement, owner Hrishikesh, before launch. The footer that
  carried it was withdrawn 2026-08-02; its designated new home `public/legal/tos.txt`
  is still 22 lines of SCAFFOLD.3 Lorem ipsum. Same for the DPDPA grievance contact in
  `privacy.txt`. Severed from LEGAL.1 into its own row by operator ruling — the §16.5
  string is already written verbatim and needs no counsel. **Not this task.**
- **POLISH.5 rows** — D7's two deferrals.

## §4 · The SPEC.1 rider — VERBATIM, transcribe byte-exact

**Doctrine.** Web-authored, operator-ratified, CC-transcribed. Lands in the **SAME
COMMIT** as the grouping code (commit 3, §6) — never a separate docs PR. Precedent:
DROUND `5035183`, PCT-ROUND 1.0.24, §21.8 at 1.0.27.

**Standing instruction to the executor.** Transcribe **byte-exact**. Do NOT reconcile
against surrounding prose, do NOT adjust wording for consistency, do NOT renumber, do
NOT re-wrap. If any sentence appears to contradict adjacent spec text or the code you
are writing, **HALT and report the contradiction verbatim** — do not resolve it. Five
prose defects surfaced at HEADER-PORTFOLIO precisely because CC was forbidden to
reconcile.

### §4.1 · Edit 1 — version bump

`docs/specs/SPEC.1.md:15`, replace the version line:

    - **Version:** 1.0.29 (semver; bump major on invariant changes)

`:16` `- **Last updated:** 2026-08-04` is already correct. Leave it.

### §4.2 · Edit 2 — §10.8, the grouping rule

**Placement by CONTENT ANCHOR, not line number.** Insert as a new paragraph block
immediately AFTER the paragraph ending `…so one holding shows one displayed value
everywhere.` and its following blank line, and immediately BEFORE the paragraph
beginning `**Percentage display — the complement rule.**`

Insert verbatim, one blank line between each paragraph:

**Digit grouping — the thousands rule.** Every **Đ value rendered to a user** groups its integer part in threes — `Đ 14,260`, `Đ 1,234,567` — and the separator is the **literal ASCII comma `,` (U+002C), never derived from a locale**. `toLocaleString`, `Intl.NumberFormat`, and every other locale-sensitive numeric formatter are forbidden on a Đ value: Đ figures render in both server and client trees, and a locale-derived separator resolves differently in the two, producing a hydration mismatch and — under a `de-DE` runtime — rendering `1.234` for one thousand two hundred and thirty-four Dharma. Grouping applies to the **integer part alone**; a fractional part, where one survives, is never grouped. The 0-dp rule above means a *displayed* Đ value carries no fractional part at all, so on every participant surface the comma is unambiguous by construction; the fractional case arises only on the export path governed below.

**Grouping is a property of the single shared display formatter, not a choice made at a call site.** There is exactly one display formatter for Đ values; it rounds and groups together, and no ungrouped display variant exists to be selected by mistake. This is deliberate and structural. An opt-in convention is one a surface can forget, and the defect this rule closes was precisely that: the bet composers grouped while the header stats, the §23 Positions-value tile and the discovery staked totals did not, with the visitor counter grouping a page-hit count a few pixels away on the same bar. A rule that must be remembered at thirty render sites will be broken at the thirty-first. The FI-2 property stated above is what makes this safe — one formatter serves every surface, so one holding shows one displayed value everywhere, in one format.

**The export path — the two-layer rule.** Grouping is a **human-readability** treatment and follows the reader, not the file. Within the ADR-0025 `.md` debate export the **prose body groups**, because it is read by people, while the **machine-readable YAML front matter never groups** and its `total_stake_dharma` continues to render through the exact formatter, ungrouped and at full precision. The same quantity may therefore render `3,225` in the body and `3225` in the front matter of a single file: this is deliberate, and it mirrors exactly the two-layer split this section already ratifies for percentages, where the export's prose percentages take the complement rule while its front-matter `yes_price` / `no_price` stay exact. The Đ export exemption from the 0-dp rule is **unchanged** — prose Đ figures in the export retain full precision, so a grouped export figure may carry a fractional part (`1,234.56`), grouped on the integer side only. Any future machine-consumed artefact, the §12.2 public conclusion dataset among them, is front-matter-class and never groups: a grouped figure is not a number to a parser, and the record must stay reproducible against cpmm §10.4.

**Grouped values are terminal, in the strong sense.** The terminality stated above for rounded values extends to grouping with one added hazard: a grouped figure is not merely a string that should not be read back, it is a string that **cannot** be read back — `Number("1,234")` is `NaN`, so a parse that silently succeeds on an ungrouped value fails outright on a grouped one. The **named implementation exception stands and is reinforced**: the sell module's editable amount input seeds from the exact Đb string, **ungrouped and unrounded**, because the full-exit byte-identity check reads that field back; a grouped seed would break that check rather than merely under-sell. The displayed-space aggregate identities are unaffected — they are computed in rounded space and grouped only at the render.

**Scope, restated against this rule.** Odds multipliers, percentages, counts and timestamps are not Đ values and are not grouped. More strongly: **a count must never be routed through the Đ display formatter at all**, since doing so silently confers both 0-dp rounding and thousands grouping on a quantity this section expressly excludes — a character-limit counter, a post count, a participant count and a reply count each format as a plain integer through their own path. **One quantity is governed that a reader might not expect.** The bet composer's TO WIN preview renders a *share quantity* inside Dharma grammar (`Đ 2,480`), and it **is** a Đ value for the purposes of this section: a winning share pays exactly Đ 1 at resolution, so the figure is a Dharma amount a participant would actually receive, not a ratio. It is distinct from the return-per-unit expression (`Đ 1 → Đ 2.63`) exempted above, which is an odds statement — the exemption covers ratios, never quantities.

### §4.3 · Edit 3 — §20 change-log row

Append as a new row immediately after the `1.0.28` row (currently `:1490`), keeping the
existing table shape. **The full row text is delivered with the execute prompt** — it is
one table row and must not be re-wrapped or line-broken during transcription.

---

## §5 · Hard guardrails

- **View layer only.** No `src/server/**` change except none at all — see D1.
- **The export path is BYTE-UNCHANGED.** `serialize.ts` is not edited. The golden
  fixture `mumbai-metro.expected.md` is **NOT regenerated**. If any change would move a
  byte of it, **HALT** — that is D1 being violated.
- **No DDL, no migration, no event type, no ADR, no §16.1 constant, no §17 row.**
- **No read-model, DTO or schema change.**
- **decimal.js only** on a Đ value; never a JS float (CLAUDE.md §2).
- **Separator is a literal `","`** — `Intl` and `toLocaleString` are forbidden on Đ.
- **Every guard proven to bite by a named reversal** (§7). An asserted guard is not a
  guard.
- **`--imgr`-radius PFP sites are out of scope** (D7).
- **Touches no CLAUDE.md §1 critical path.** If the executor finds itself editing
  auth, the bet engine, the ledger, or moderation — **HALT**.
- Every NEW file opens with `// SPDX-License-Identifier: AGPL-3.0-or-later`. Logs exempt.

---

## §6 · Work — four commits, ordered

One PR, four separable commits. The order is not cosmetic: the rename runs first and
alone so the **compiler performs the audit**, and the behaviour diff stays readable.
Precedent: DROUND step 3b, the compiler-audit pattern.

### Commit 1 — `refactor: name the export Đ formatter for its layer`

C2. **Zero behaviour change. The diff should be boring.**

1. `serialize.ts:47` — rename `formatDharmaGrouped` → **`formatDharmaExportGrouped`**.
   Not aliased: DROUND tried an import alias and reversed it at the gate because a
   reader saw one name silently resolving to another (`5035183`).
2. Update its 8 call sites, all in `serialize.ts` (`:181 :199 :213 :247 :258 :262
   :308 :336`).
3. Update `serialize.test.ts:643-660`'s three assertions to the new name. **Values
   unchanged** — `3,225` / `1,234,567` / `1,234.56` stay exactly as pinned.
4. Amend the docblock `:39-46` to state the ratified two-layer rule: exact precision
   AND grouped, prose-body only, front matter never groups (SPEC.1 §10.8).

**Gate:** `tsc` clean, full suite green, golden fixture untouched. The `copy.ts`
function is NOT renamed — it is deleted in commit 3.

### Commit 2 — `fix: bind the avatar ring to its ratified token`

C1, D5, D6. One primitive edit reaching four sites.

1. `avatar.tsx:20` — remove `after:mix-blend-darken` and `dark:after:mix-blend-lighten`
   (dead: `.dark` is never applied, R1c). Replace `after:border after:border-border`
   with `after:[border:var(--avatar-ring)]`.
2. `IdentityCluster.tsx:51` — remove the now-redundant `avatarRing` local override, and
   the `:39-50` comment block explaining the workaround. Recon proved removal changes
   no pixel (R1e).
3. Test: assert the primitive carries `--avatar-ring` and carries **no** `mix-blend`
   class; assert `IdentityCluster` carries no local ring override.

**Gate:** the four render sites (`IdentityCluster:59 :73`, `HeroPanels:112`,
`ArgProfile:51`) resolve identically. `tokens-monochrome` and `no-raw-hex-view-layer`
stay green.

### Commit 3 — `feat: Đ digit grouping, product-wide` ⟵ THE RIDER RIDES HERE

C3, D2, D3, D4 **+ the §4 SPEC.1 edits in this same commit.** RED-then-GREEN.

1. **Tests first (RED).** `format.test.ts` — move `:69-78`'s grouping table onto
   `formatDharma`; add a `1,234,567` case, a `999 → "999"` boundary, a negative
   (`-1,234`), and an explicit **no-locale-call** assertion.
2. `format.ts:31` — `formatDharma` groups the integer part after rounding. Literal
   `","`. Regex `\B(?=(\d{3})+(?!\d))` — the shape already proven at both existing
   groupers. `formatDharmaExact` **untouched**.
3. **Delete `composer/copy.ts:20`.** Re-point its 13 Đ call sites to `formatDharma`
   (`copy.ts:54 :80×2 :83×2`, `ReplySplitBar:58 :70 :77`, `PositionStrip:71 :78`,
   `SlotHeader:136`, `SellModule:231`, `BetComposer:392`). Remove the five importing
   files' now-dead imports, including `BetComposer.tsx:23`'s `formatGrouped` alias.
4. **D4** — `BetComposer.tsx:491`: `formatGrouped(String(extendedMax))` → plain
   `extendedMax`. A count never touches the Đ formatter.
5. Invert the two docketed tests, each with a comment citing **SPEC.1 §10.9 (1.0.29)**:
   `market-card.test.tsx:65` → `"Đ 14,260 staked"`; `dharma-cluster.test.tsx:260-263`
   → `toContain("2,480")`.
6. `no-raw-dharma-render.test.ts` — add `supportReceived`, `counterReceived`,
   `displayedTotal`, `floor` to `MONEY_IDS` (R4c).
7. **The §4 SPEC.1 edits**, transcribed byte-exact.

**Gate:** `serialize.test.ts` and the golden fixture green **without regeneration** —
this is D1's proof. If either moves, HALT.

### Commit 4 — `test: widen three guards, each proven to bite`

C4 (a)(b)(c). Each carries a §7 reversal.

1. **C4(a)** `IdentityCluster.tsx:14-15` — the comment says the Đ cluster is deferred
   per OQ-2. Doubly false since #283 (Balance) and #286 (Portfolio). Rewrite to state
   what the cluster does and cite SPEC.1 §21.8.
2. **C4(b)** `no-raw-hex-view-layer.test.ts` — add `src/app/layout.tsx` to `SCAN_FILES`
   (R9c: the root layout hand-rolls the real `<html>`/`<body>` on every route, and the
   guard's own comment `:23-25` argues for exactly this enrolment).
3. **C4(c)** Replace `not-found.test.tsx:100-113`'s three-file loop with a glob over
   every `layout.tsx` and `page.tsx` under `src/app/**`, judging **position in the
   tree**, not element name (D8). The two legitimate nested `<footer>` elements —
   `(auth)/onboarding/page.tsx:160` inside `<Card>`, `(admin)/…/ReviewFeed.tsx:164`
   inside `<article>` — **must stay green**. If the new guard reddens on either, the
   guard is wrong, not the code.

**Gate:** full suite green; three RED proofs recorded in the log.

---

## §7 · RED proofs — the section POLISH.1 wrote

Four times in POLISH.1 a green gate was **blind**, each caught by a reviewer or a
diff-read, never by the gates: a ratified still validated intent while the code
half-applied the change; a z-index guard passed vacuously on empty input; a test
asserted a baseline doctored to make it pass; a `[]`-dep effect froze a probe.

**Recon found the same disease here: only ONE of three guards has ever been proven to
bite, and that only for a single identifier** (R9a). So every guard in this task carries
a named reversal, and **all three outcomes are recorded in the log** — the
HEADER-PORTFOLIO §7.1 pattern. Skipping the "passes before" step makes the RED
unattributed and proves nothing.

| # | Guard | Reversal | Must PASS before | Must FAIL after | Restore |
|---|---|---|---|---|---|
| **P1** | `no-raw-dharma-render` — `supportReceived` | Inject `{tiles.supportReceived}` raw in `ProfileTiles.tsx` | With OLD `MONEY_IDS` → **PASS** (proves the gap is real) | With the name added → **FAIL** on that line | md5 byte-identical |
| **P2** | same — `counterReceived` | as P1, `{tiles.counterReceived}` | **PASS** | **FAIL** | md5 |
| **P3** | same — `displayedTotal` | Inject `{displayedTotal}` in `ReplySplitBar.tsx` | **PASS** | **FAIL** | md5 |
| **P4** | `no-raw-hex-view-layer` — C4(b) | Insert a literal hex in `src/app/layout.tsx` | With OLD `SCAN_FILES` → **PASS** (the root layout is unscanned) | With it enrolled → **FAIL** | md5 |
| **P5** | footer guard — C4(c) **novel name** | Add `<Colophon/>` rendering a page-level footer in a `src/app/**` **page** file | Old three-file loop → **PASS** (it greps two literals in three layouts) | New guard → **FAIL** | md5 |
| **P6** | footer guard — C4(c) **false-positive check** | No injection. Run the new guard against the tree **as-is** | — | Must be **GREEN** with both nested `<footer>` present. A RED here means the guard bans legitimate markup — fix the guard | — |
| **P7** | grouping — the behaviour itself | Revert `formatDharma`'s grouping line only | Suite → **RED** at the `format.test.ts` table AND at `dharma-cluster` / `market-card` | — | restore |

**P6 has no injection and that is the point.** It is the only proof in the set that
tests the guard's *precision* rather than its *reach*, and it is the check the seed's
original "ban `<footer>`" formulation would have failed.

**Every probe file restored byte-identical, md5 before and after, `git diff -- src/`
empty.** Record all three outcomes per proof in the session log.

---

## §8 · Files

**Prod:** `src/components/ui/avatar.tsx` · `src/components/shell/IdentityCluster.tsx` ·
`src/components/debate/format.ts` · `src/components/debate/composer/copy.ts` (function
deleted) · `ReplySplitBar.tsx` · `PositionStrip.tsx` · `SlotHeader.tsx` ·
`SellModule.tsx` · `BetComposer.tsx` · `src/server/debate-export/serialize.ts` (rename +
docblock ONLY).

**Spec:** `docs/specs/SPEC.1.md` (§0, §10.8, §20 — commit 3).

**Tests:** `tests/unit/debate/format.test.ts` · `tests/unit/debate-export/serialize.test.ts`
(rename only) · `tests/unit/discovery/render/market-card.test.tsx` ·
`tests/unit/shell/dharma-cluster.test.tsx` · `tests/unit/design/no-raw-dharma-render.test.ts` ·
`tests/unit/design/no-raw-hex-view-layer.test.ts` · `tests/unit/shell/not-found.test.tsx` ·
new avatar-primitive test.

**NOT touched:** `mumbai-metro.expected.md` · `mumbai-metro.input.ts` ·
`src/components/profile/IdentityCard.tsx` · anything under `src/server/` except
serialize's rename · any migration, ADR, or read model.

---

## §9 · Out of scope

D2b container normalisation (POLISH .2/.3/.5/.6) · D4 `my-auto` (POLISH.7a,
upstream-only) · AUTH-CONSENT-LINE (POLISH.7a verification) · D-2 stronger-hairline
(parked by founder ruling) · B8 freeze banner (gated on the §21.7 rider body) ·
`title` reach → A11Y.0 · OQ-4/OQ-5 → HARDEN · G1 responsive · admin surfaces ·
**AGPL `I6`** (own row, severed from LEGAL.1) · **D7's two POLISH.5 rows**.

`title` on a disabled `<button>` and on role-less `<span>`s was accepted at POLISH-1a as
source-of-truth-correct with delivery routed to A11Y.0. **Do not re-litigate it here.**

---

## §10 · Concurrency

⚠ **ANYTHING RUNNING VITEST RUNS ALONE.** Two CC sessions against one local Postgres
shred each other's fixtures — `truncateTables` disables the Bucket-A guard set per call.
A 13-file diff "failing" 55 suites is a false red. Own `git worktree`, own database.

---

## §11 · Merge

Branch `feat/primitives-1`. Author and committer `Zugzwang/world
<zugzwangworld@proton.me>` — Chrollo is the git username only. SSH-signed, no
`Co-authored-by`, **squash-merge to main only**.

`@code-reviewer`. **NO `@security-auditor`.** **Gate C — web diff-read before merge — is
a HARD CONSTRAINT regardless of how small the PR looks.** Pagination: one diff per
message, alone, ≤600 lines, no preamble in the same turn.

Post-merge: advance staging per `deploy-pipeline.md` §2.5, then the operator verifies
grouping on staging — header Portfolio and Balance, the §23 Positions-value tile, a
discovery staked total, and one composer surface.
