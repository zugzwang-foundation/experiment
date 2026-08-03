# HEADER-PORTFOLIO — session log

> **Date:** 2026-08-03 · one unattended overnight session, execute end-to-end (S1 → S4 → reviewer → PR).
> **Ground:** `origin/main` @ `07a1daa` · primary worktree `~/code/zugzwang/experiment` · branch `feat/header-portfolio`
> **Plan:** `docs/plans/HEADER-PORTFOLIO.md`, PR #284, merged `a86d614`, ratified 2026-08-02
> **Spec gate:** SPEC.1 **1.0.26 → 1.0.27** — §21.8 minted in this PR, the same-commit rider
> **Model:** `claude-opus-5[1m]`, effort `max`. Subagent pins verified `claude-opus-5` / `max` in this worktree before dispatch.

---

## A note on SHAs in this log

The merge is **squash-to-main**, so **no SHA below reaches `main`.** Every one is a branch-local working SHA. **The durable reference is the squash-merge SHA on `main`, recorded at close-out — not here.**

---

## What landed

**PR #TBD — `feat/header-portfolio`** (6 commits, all SSH-signed, author `Zugzwang/world`, no `Co-authored-by`):

| Working SHA | Slice | What |
|---|---|---|
| `cc3fe27` | **S1** | RED — T1–T7 across four test files, `@test-writer`-authored |
| `00012ad` | **S2** | `src/server/dharma/header-portfolio.ts` — the read module |
| `8026cf7` | **S3** | `DharmaCluster` (`git mv` from `BalanceCluster`) + `GlobalHeader` prop |
| `3178e91` | **S4** | the `Promise.all` wiring + SPEC.1 §21.8 rider + SHELL-COMPLETE §5.1 |
| *(next)* | **review** | `@code-reviewer` remediation — MEDIUM-1 test + LOW-7 date |
| *(last)* | **log** | this file |

**Portfolio** — Σ of the viewer's open-position execution values (Đb) — now renders as the first of two stats in the signed-in global-header Đ cluster, beside the shipped Balance. One number in the header bar. Not a tab, not a page, not a route.

Ceilings unmoved, as required: migration head `0024_bookmarks` · `EVENT_TYPES` 24 · next free ADR `0035`. Zero DDL, zero writes, zero new runtime dependency, zero read-model fields.

---

## Decisions made

**1. Label case — the plan gave two readings; the repo settled it.** §6.2's ASCII anatomy writes `<span>PORTFOLIO</span>`, but its prose says "the copy register's `Portfolio` · `Balance` is the label identity, **uppercase is its rendering**". `@test-writer` took the sketch literally and pinned uppercase DOM text. Reversed: the DOM text is title case with a Tailwind `uppercase` class, because the mockup's `.lab` does exactly that (`:271` + CSS `:128`) and the repo is unanimous across five shipped labels (`RadioSlot.tsx:29`, `PositionStrip.tsx:44,61`, `SellModule.tsx:263,278`). The ASCII block depicts *rendered* anatomy — its sibling line depicts `Đ {formatDharma(portfolio)}` rather than literal DOM text, which is the tell. **Both halves are now asserted** — the text and the class — since jsdom applies no Tailwind and the class is the only checkable form of the rendering half.

**2. §7.1's attributed RED ran against `BalanceCluster.tsx`, not `DharmaCluster.tsx`.** The procedure names the latter, but at S1 the component rename has not happened (that is S3). Injected into the file that plays the role at that moment — same scan set (`src/components`), same regex, same proof. Recorded rather than resolved silently.

**3. The §0 version bump was DERIVED, not taken from the plan.** The plan's literal (1.0.26 → 1.0.27) was correct, but B8's freeze-banner rider claims the same 1.0.27 and neither had landed, so the number was read off live §0 (1.0.26) and incremented. Same for the two line-number citations: `:1484` and the §21 close were both re-verified against the live file before editing.

**4. §21.7 left RESERVED.** §21.8 was minted instead, per the plan — B8's gate is written as "the SPEC.1 §21.7 rider" and occupying the number would contradict merged plan text.

**5. The missing-pool branch SKIPS where the mirror THROWS — and is now tested.** `positions.ts:416–426` throws on a held position with no pool row. This module skips that holding, because it runs in `(public)/layout.tsx` where a same-segment `error.tsx` cannot catch its own layout's throw: the escape lands on `global-error.tsx` and replaces every participant route. The reviewer confirmed the reasoning holds and flagged that nothing tested it (MEDIUM-1) — a case was added, then **probed by injecting a mirror-parity throw and confirming the test fails**, so it is a live guard rather than a passing assertion.

---

## §7.1 — the SG8 attributed RED, all three outcomes

`MONEY_IDS` is an allow-list of **names**, not a detector of Đ-shaped values, so an identifier absent from the array never enters the `RAW_RENDER` alternation and its violation passes silently. Skipping step 2 would make the RED prove nothing.

| Step | State | Result |
|---|---|---|
| **2** | OLD `MONEY_IDS` (no `portfolio`) + a raw `{portfolio}` injected | **PASS** — 3/3 green. **The gap is real.** |
| **3** | `portfolio` added to `MONEY_IDS`, injection still present | **FAIL** — `src/components/shell/BalanceCluster.tsx → {portfolio}` |
| **4** | `portfolio` in `MONEY_IDS`, injection removed | **GREEN** — 3/3 |

The probe file was restored byte-identical: md5 `1e66a7967c0caa17a106520b9e9e10fb` before and after, `git diff -- src/` empty.

---

## Surprises caught + fixed in-session

**1. A latent bottom-up ordering bug in the SPEC.1 edit script — caught by its own assertion, before any write.** The script inserted the §20 change-log row at index 1476 and *then* edited the §21 preamble at index 1483, but the first insert shifts every later index by one, so the preamble edit would have silently targeted the wrong line and the `replace` would have been a no-op. The post-edit assertion (`assert "**Six are in scope for v1**" in lines[1483]`) fired, the script aborted before writing, and `git diff` confirmed SPEC.1 untouched. Re-run with a strict bottom-up order (1541 → 1483 → 1476 → 14). **This is the case for asserting the postcondition of every scripted edit, not just its precondition** — a precondition check alone would have passed and the corruption would have shipped.

**2. `@test-writer` inverted the label-case contract.** Decision 1 above. Caught by reading the plan's prose against the mockup and the repo's five precedents rather than accepting the ASCII sketch. Left unfixed it would have shipped `PORTFOLIO` as literal DOM text — screen-reader-hostile and off-house-style — with a green test pinning the wrong thing.

**3. SPEC.1 `Last updated` was not tracking the new change-log row** (reviewer LOW-7). `- **Last updated:** 2026-08-02` exactly matched the previously-newest row; the new row is dated 2026-08-03. Verified the convention against the live file (1.0.23→1.0.24 crossed a date and bumped; 1.0.24→1.0.25 shared one and did not) before touching it. Fixed in-session — a mechanical metadata field, not spec prose.

**4. A stale `BalanceCluster` reference in the design guard's `spendable` comment**, which went stale at the S3 rename. Fixed in the same slice that caused it.

---

## Open questions — for Gate C

**OQ-1 · The rider asserts a `Đ` info doorway that does not exist.** SPEC.1 §21.8 (`:1547`) reads "Signed-out state is unchanged — the audience sees the `Đ` info doorway, never a figure." No such element is in the shipped header: `GlobalHeader.tsx:26–28` records "Social/Research/RULES/Đ-info are **ratified omissions** (OQ-3/OQ-4 zero-supplied)". The signed-out right zone is JOIN → divider → visitor counter. **The rider is web-authored and landed verbatim; CC did not touch its prose.** Gate C decides: a one-clause correction, or an explicit ruling that the doorway is now mandated and gets its own task. *(reviewer MEDIUM-2)*

**OQ-2 · The §21 preamble is now self-contradictory.** The ratified `Five` → `Six` swap leaves "**Six are in scope for v1**; the sixth — the feature-guide page (§21.6) — is **deferred**". With §21.8 in the in-scope set, §21.6 is no longer "the sixth". The swap was applied exactly as instructed and the surrounding prose was **not** reworded — spec prose is web-owned. A one-clause fix ("the sixth" → "the feature-guide page") belongs to Gate C. *(reviewer LOW-6; first surfaced in the `3178e91` commit body)*

**OQ-3 · "Together they are the viewer's net worth as §10.8 defines it"** (`:1557`) is a gloss, not a rule. §10.8 net worth = free Dharma + Σ Đb; Balance is spendable-today = free Dharma + unclaimed `DAILY_CREDIT_DHARMA`. So on an unclaimed day the two stats sum to net worth **+ one daily credit**. The rider itself establishes the distinction three paragraphs earlier, so this is self-acknowledged — flagged for completeness. *(reviewer LOW-2)*

**OQ-4 · A Balance read FAILURE hides a working Portfolio.** `getHeaderBalance` returns `null` for both "no ledger row" and "read failed" — three indistinguishable nulls at `header-balance.ts:88`, `:107`, `:136` — and R9 makes Balance's null the cluster's gate. So a transient Balance failure blanks a Portfolio that read fine, which sits awkwardly beside the rider's "header chrome degrades, it never removes a working figure". **Unfixable in this PR: SG2 forbids touching `header-balance.ts`, and R9 ratifies the gate.** Docket for HARDEN — split absence from failure in `getHeaderBalance`. *(reviewer LOW-3)*

**OQ-5 · Plan §8 risk 2 overstates its guarantee.** It reads "Both from the same pool state in one request", but there is no shared transaction or snapshot between the layout read and the page read. On `/u/[pseudonym]` a bet committing during the render window makes the header Portfolio and the §23 tile differ by that bet's price impact. Cosmetic, self-healing, and **not a spec violation** — both §21.8 and plan §4.3 correctly hedge with "against the same pool state". Tracker note, no code change. *(reviewer LOW-1)*

**OQ-6 · The missing-pool skip is unobserved.** The branch takes no `safeCaptureException`, so if the structurally-impossible ever occurred the header would understate forever with no telemetry. Deliberately not added: the plan's R8 specifies exactly one capture, and an un-deduped emit in a path `DebatePoll` re-runs at 4/min/tab is the amplification the module docblock already defers to HARDEN. Mitigating fact — `/u/[pseudonym]` throws loudly on the same data, so it is not a total blind spot. Docket for HARDEN. *(reviewer LOW-4)*

---

## Next session starts at

**Gate C — the web diff-read of PR #TBD. Nothing else.** CC does not merge. Read the six open questions above first; OQ-1 and OQ-2 are the two that want a decision before merge, and both are one-clause spec corrections rather than code changes.

After merge: record the squash-merge SHA on `main` here, `git ls-remote` to check whether the branch auto-deleted, and confirm the tracker rows.

---

## Context to preserve

- **`@code-reviewer` verdict: R3 sourcing diff PASS byte-for-byte on all four mirrored spans; NO CRITICAL, NO HIGH.** All eight directed sub-checks (a)–(h) confirmed. The reviewer independently verified `settle.ts:126–137` and `void.ts:130` write one payout row **per bet** with a possibly-zero amount, which is why row *existence* — not amount — is the sound settled discriminant.
- **The FI-2 divergence analysis is the most valuable artefact of the review.** Of seven constructible divergence scenarios, exactly one is reachable in production (the snapshot race, OQ-5). The other six are all closed by DB constraints the reviewer verified against the live schema: `positions_one_held_side_idx` (partial UNIQUE on `(user_id, market_id) WHERE quantity > 0`, migration `0010`) kills the duplicate-row and both-sides cases; `positions_quantity_non_negative` kills negative quantities; the `onDelete: "restrict"` FK kills the missing-market case.
- **`@security-auditor` was deliberately NOT run** — the kickoff and plan §9 both waive it (display-grade read, no write, no engine contact, not a CLAUDE.md §1 critical path). This was a ratified waiver, not an omission.
- **R7 held structurally, not just by intention:** `header-balance.ts` has **zero** edits in this diff, the two reads live in separate modules, and the `Promise.all` is under `src/app/`, satisfying R6/SG2. The reviewer noted the `Promise.all` marginally widens the window between `getHeaderBalance`'s two statements — and that the consequence lands in the deliberately-chosen safe direction (one-credit **understatement**, never overstatement), so the MEDIUM-1/`3b7db8d` constraint is not weakened.
- **Test-quality audit:** the reviewer worked the space of wrong implementations that could still pass T1/T2/T3. Only three survive, and all three are immaterial: `floor18` vs `toFixed18` (identical output for 18-dp sums), a `Number()`-based quantity filter (immaterial at any representable Đ value), and the missing-pool behaviour — which is now covered. **No vacuous assertions found.**
- **Full suite before the reviewer: 292 files passed / 1 skipped, 2134 tests passed / 1 skipped / 4 todo, exit 0**, 157 s. Nothing running concurrently (`pgrep -f "node.*vitest"` clean before the run — the naive `ps | grep [v]itest` matches its own wrapper shell here and is not a reliable check).
- **`just verify` needs `ZUGZWANG_ENV=preview`** — env-only, not a regression.

---

## Time

~13:56 → ~14:45 IST, 2026-08-03. Roughly 50 minutes: S1 (incl. the `@test-writer` dispatch and the §7.1 probe) ~22 min, S2 ~5, S3 ~4, S4 ~8, full suite 2.6, `@code-reviewer` ~10 min, remediation + log ~8.
