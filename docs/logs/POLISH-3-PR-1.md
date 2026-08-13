# POLISH.3 PR-1 — session log

**Task:** PR 1 of POLISH.3 — FRAME. Six ratified items on `/m/[slug]`, inside an eight-file allow-list.
**Plan:** `docs/plans/POLISH-3.md` v1.1 + §18 (#327, `2326e84`) — §6 is the item table, §8 the allow-list.
**Ritual:** FULL and gated. **Not ultracode** — no commit met `CLAUDE.md` §6's four conditions; C2/C4 fail condition 4 outright as ordered proof obligations.
**Ground:** `origin/main` = `2326e84` at every commit boundary; ⛔ RUN-STOP #1 re-checked 16 times and never fired.
**Branch:** `polish/3-pr1-frame`, launched from a fresh worktree at `origin/main`.
**Gate C:** a web diff-read before merge, non-optional. **FOUR reads.** Reads 1–3 returned findings; read 4 PASSED.
**Merged:** PR #328, squash → **`af3a070`**, 2026-08-13. Signature `valid`, author preserved, squash body **1274 lines** — every commit body concatenated.
**Naming:** patterned on `docs/logs/PRIMITIVES-2-PR-A.md`, the repo's convention for a multi-PR task.

---

## 1 · What landed

**Sixteen commits.** Seven built the work; nine were remediation across four Gate C reads.

| # | SHA | Subject |
|---|---|---|
| C1 | `8b0edb2` | `refactor(debate)`: item 6 — remove DebateColumn's dead Đ BET control |
| C2 | `2519838` | `feat(debate)`: item 1 — PriceBar `detail` ships d5's 14px/10px |
| C3 | `9468c30` | `feat(debate)`: item 4 — /m/[slug] error boundary + greenfield guard |
| C4 | `181b0fc` | `fix(debate)`: items 2+3 — spaced Đ and pluralised counts |
| C5 | `bfb0b15` | `fix(debate)`: item 5 — remove the dev placeholder box |
| C6 | `3e012a9` | `fix(debate)`: @code-reviewer remediation (6 MEDIUM, 2 LOW) |
| C7 | `37fb25e` | `test(shell)`: @security-auditor hardening of the greenfield guard |
| R1 | `ef5db33` | `docs(shell)`: GC-1 — date the "nine sites" claim |
| R2 | `6ebca26` | `docs(discovery)`: GC-4 — correct the DETAIL_BASELINE provenance |
| R3 | `a116be0` | `test(debate)`: Q1 — behavioural guard for the error boundary |
| R4 | `b3d6c4d` | `docs(polish)`: §19 — Gate C read-1 rulings, PF-1…PF-7 |
| R5 | `c662632` | `docs(parked)`: GC-2 + Q3 — two docket rows |
| R6 | `3c39e38` | `test(polish)`: reviewer re-run remediation (2 HIGH, 3 MEDIUM, 3 LOW) |
| R7 | `4b19d47` | `test(debate)`: GC2-1 — the handler sweep obeyed PF-7's rule |
| R8 | `521d844` | `docs(polish)`: R7 addendum — PF-8 and PORTAL-SCOPED-ABSENCE |
| R9 | `db51cbc` | `docs(polish)`: §19 — restore the table terminator, reconcile the header |

**Ten files, measured at `af3a070`.** Eight source/test, two docs. `tests/unit/debate/render/price-chart.test.tsx` was on the allow-list and correctly did **not** move — its fixture is `postCount: 3, replyCount: 5`, plural under any correct rule.

**Six items, and the register IDs they consumed.** PR 1 minted nothing; all six came from commit 0.

| Item | Ruling | Register | State |
|---|---|---|---|
| 1 · `PriceBar` `detail` → 14px bar / 10px labels | D5 | `PD-3-01` | closed |
| 2 · Đ glyph → SPACED, `MarketHeader` only | D2 | `PD-3-07` | ⚠ **PARTIAL — STAYS OPEN** |
| 3 · `posts`/`replies` pluralised | ADDITIONS | `PD-3-08` | closed |
| 4 · `error.tsx` at `preset="debate"`, `loading.tsx` OMITTED | D4 | `PD-3-11` | closed |
| 5 · dev placeholder box REMOVED | OD-6 | `PD-3-09` | closed |
| 6 · `DebateColumn`'s dead `Đ BET` REMOVED | R1 | `PD-0-02` | shared; PR 2 closes sites 1–2 |

⚠ **`PD-3-07` IS CONSUMED PARTIAL AND REMAINS OPEN.** Only site 1 of 5 changed. `ReplyCard.tsx` · `ArgProfile.tsx` · `AggregateFooter.tsx` ×2 are PR 2's, are **not** guarded by anything today, and sit inside `src/components/debate/` — which the §10 deny-list does **not** cover, so the allow-list was their only fence. Between the two PRs `/m/[slug]` renders the spaced form in the header and the unspaced form in the cards; that is a **ratified consequence of the OD-1 split**, not a defect to file.

**Test counts at `af3a070`, as the runner reports them:** `market-error-boundary` 5 · `market-header` 3 · `page-container` 28.

---

## 2 · Decisions made

**The three ordered proof obligations ran in two directions, and naming which is the point.** C2 runs **artifact → proof** (edit the source, then capture the baseline from it). C3 and C4 run **proof → artifact** (write the guard RED, then build the thing). They are not one discipline pointed different ways: C2's proof is *derived from* the artifact and its risk is fabrication; C3's and C4's are *independent of* it and their risk is a guard that never went red.

**§19 was minted because the `PF-n` series was cited before it was defined.** Three commit bodies cited `PF-n` while `grep -c 'PF-[0-9]'` over the plan returned **zero** — the same shape as the bare `L-n` collision `CLAUDE.md` §8 exists to stop. §19 now carries **eight** rulings, PF-1…PF-8.

**Two requested IDs were refused, and the refusal is itself recorded.** `O-7` already exists at `docs/logs/STAGING-PARITY-A.md` as a staging re-seed gap while §8's committed O-space runs O-1…O-4 — minting it would have committed the very defect the ID was meant to name. `V-12` would skip V-9, V-10 and V-11. Both withdrawn by web on those grounds.

**Guard form is keyed to guard CLASS, not to surface** (PF-7, PF-8). COPY/PRESENCE guards take targeted queries; ABSENCE/LEAK guards take the whole rendered output — and `container` is not that, `baseElement` is.

**The structural assertion outranks the behavioural sweep.** `error` is never bound in the boundary, and **no binding implies no read** — everywhere, for every event, forever. One source-level assertion covers what seven behavioural probes could not.

---

## 3 · Surprises caught + fixed in-session

**S-1 · The plan predicted a RED that cannot occur.** §18 R-a and §9 C3 both predicted `callSite` throwing `no <PageContainer> found in …`. `callSite` is **not reachable from either set-equality direction**, and at `9468c30` the row that does call it did not yet exist. Recorded as **PF-5**; the observed failure is a set-membership message.

**S-2 · The plan's discriminating literal came from another surface.** §6 item 2 cites `Đ 14,260 staked` — Discovery's/`StatLine`'s fixture, a value `/m/[slug]` never renders. The value was re-derived from `price-chart.test.tsx`'s own fixture (`150`) and the assertion made about **the space**, not the number (§18 C-1).

**S-3 · Six stale comments, of which the plan's orphan list named one.** The enumeration is systematically blind to *sibling prose references*. The costliest said the `DETAIL_BASELINE` literal was "385 bytes captured at `aff76b3`" — which would have misdirected the exact audit V-1 exists to enable, a future reviewer finding a mismatch and reading it as tampering.

**S-4 · A false receipt shipped in a commit body AND in the file.** `2519838` claimed the literal was "pasted wholesale … never edited token-by-token to match". It was **edited in place, two tokens**. The bytes were always right; the description was not. `2519838`'s body stands unamended as the record; the file was corrected at R2. Root cause: the plan *prescribed* "paste as `DETAIL_BASELINE`" and I described my work in the plan's words rather than my own — **PF-6**: a receipt records the mechanism USED, never the mechanism prescribed.

**S-5 · PF-7 was violated in the file that minted PF-7, three hours after minting it.** The handler sweep was an absence assertion scoped to four element kinds while claiming "no handler on this surface".

---

## 4 · The four Gate C reads — and whose findings they were

⚠ **The split matters.** Two of the four reads found defects in **web's own rulings**, not in execution. Recording which is which is the point of this section.

**Read 1 — five findings.** GC-1 (a stale count in a docblock) and GC-4 (the false V-1 receipt) were **EXECUTION'S**. GC-2/Q1/Q3 were routing. ⚠ Read 1 also **read the false-receipt hunk and did not flag it** — it surfaced only when a later read asked the direct question "dumped to a file, or edited in place?", which no artifact answered.

**Read 2 — GC2-1, EXECUTION'S.** The handler sweep's targeted scope. But the fix exposed **PF-7 itself as WEB'S defect**: `container.innerHTML` had been ruled the sound form and named "container-wide" as though that were the whole rendered output. It is not — portals render outside it. **PF-8 corrects the scope; PF-7's rule stands.**

**Read 3 — two findings, both EXECUTION'S, and both were defects in my own corrections.** GC3-1: R8 deleted the §19 table's terminating blank line. GC3-2: §19's heading and intro contradicted the table they head.

**Read 4 — PASS.** Both deliverable md5s verified against what arrived.

⚠ **Web was wrong twice more, and said so.** It accepted the byte-identical dump as ordering evidence at read 1 — it never was; the capture **RUN** is the only ordering artifact. And it under-scoped R2's anchor by describing the paragraph instead of quoting it (§13.5), which would have corrected the wrong one of the docblock's two paragraphs.

---

## 5 · The mutation receipts that changed what ships

Every one of these was **GREEN — i.e. the guard missed a real leak — before the fix**.

| Probe | Before | After |
|---|---|---|
| `cause instanceof Error ? cause.message` (the idiomatic unwrap) | **GREEN — missed** | RED ×2 |
| `stack.split("\n").slice(1).join("\n")` (frames-only, drop the header) | **GREEN — missed** | RED ×2 |
| `onClick={() => { document.title = error.message }}` | **GREEN — 4/4 passed** | RED — `expected [ 'message' ] to deeply equal []` |
| `createPortal(<span>{error.message}</span>, document.body)` | **GREEN — the primary leak guard never saw it** | RED ×3 |
| `error,` bound with `void error;` — no read at all | — | RED — `expected 'errorreset' to be 'reset'` |

⚠ **The portal probe is the one that matters most.** The repo's `Dialog` portals **by default**, so a "Show details" modal built from components already on disk lands outside `container` **by construction** — the likeliest future leak was the invisible one.

⚠ **And the obvious fix for the handler gap was itself wrong.** A throwing getter inside a handler is caught by React, so Vitest reports an *unhandled error* while printing "4 passed" and warning it "might cause false positive tests". The sweep uses a **recording** fixture instead: reads are logged, never thrown, and the assertion is on the log.

---

## 6 · The three-surface count divergence at `521d844`

Recorded verbatim, because it is the sharpest statement of the §13.3 class this pack produced:

> **§19 CLAIMED seven, CONTAINED eight, DISPLAYED nine.**

The heading and intro said "seven rulings from Gate C read 1". The table body held eight rows, PF-1…PF-8. And because R8's insert consumed the blank line that terminated the table, GFM absorbed the following paragraph as a **ninth row split across three cells** — so the O-7 / V-12 ruling, the record of why two IDs were refused, rendered as table debris with an empty trailing cell.

Three different numbers for one table, none of them agreeing, in the section minted to stop citation defects. ⚠ **A render-check is not a read**: the markdown *source* looked correct in the diff — a table row, then a paragraph — and nothing in `just verify` or the suite renders markdown. It survived two commits and a Gate C read. Fixed at R9 and verified by rendering §19 through GitHub's own GFM renderer, before and after, on the pushed remote.

---

## 7 · Render census — the population for the docket row

Read-only, at `origin/main` before the merge. **379 markdown files** scanned (`docs/**/*.md` + root governance).

- **Raw count** (the literal definition — a non-pipe, non-blank line immediately after a table row): **29**.
- **Fence-aware, delimiter-confirmed** (outside any code fence, in a table with a real `|---|` delimiter row, next line a plain paragraph rather than a block element): **ZERO**.

All 29 raw hits are either code fences legitimately terminating a table, or `|`-leading lines **inside** fences that are not tables at all. The one prose-looking survivor, `docs/specs/cpmm.md:268`, follows `|Δp_yes| = |Δp_no|` — a wrapped absolute-value expression with **no delimiter row**, so GFM never forms a table.

**The §19 instance was the only one, and it never reached `main`** — created and fixed inside this PR. ⚠ The naive count would have reported 29 or 5; both are wrong, and reporting either would have been the same class of error this pack spent four reads on.

⚠ **This census is a DATED measurement with a NARROW definition, and it is already incomplete.** It was taken at `origin/main` **before** the merge, so it could not see `docs/plans/POLISH-3-RUN-TRACKER.md`, which joined the repo afterwards — and that file carries **two `---`-directly-under-a-list-item constructs**, where GFM reads the rule as a setext heading underline rather than a thematic break. That is a **sibling class the census did not look for**: it asked only "what follows a table row", not "what follows a list item or paragraph". **D4 owns both the re-measurement and the tracker's two instances**; nothing here re-runs it, and the tracker is committed verbatim by mandate.

---

## 8 · Open questions / carried, not fixed

**⚠ THE V-9 DOUBLE-BOOKING — resolve deliberately at D5, do not mint over one of them.**
Two different lessons are queued for the same number in the same file:
- `POLISH-3-RUN-TRACKER.md` §5 reserves **V-9** for *"an enumeration inherited from another artifact is a citation, not a proof."*
- §19 and **two** commit bodies (`b3d6c4d`, `6ebca26` — measured; the relay said three) say the next free V-number is **V-9** for *"a comment added in a diff is an unverified claim."*

⚠ I can verify only the second: `POLISH-3-RUN-TRACKER.md` is **not in the repo** and could not be read from here. Both are queued for `POLISH-0_data-manifest.md` §5, which is not on this PR's allow-list. **V-space's ceiling is V-8**; V-8's own text rules that a V-number is minted in that file *"or it is not minted."*

**`allow_rebase_merge` is `true`.** "Squash-merge only" — asserted as branch-protection-enforced in `AGENTS.md` §10/§11 and `CLAUDE.md` §5.13 — is **discipline, not enforcement**. What is genuinely enforced: PR required, `ci` as a required check (`strict: true`), `required_signatures`, `enforce_admins`, linear history, no force-push, `required_approving_review_count: 0`. Merge-commit is blocked in practice by linear history, so the reachable set is squash **or rebase** — and the receipts survive both.

**The `(auth)`-boundary follow-up now carries five obligations**, all outside this PR's allow-list:
1. `auth-error-boundary.test.tsx`'s single-line-`stack` and string-`cause` fixture defects — its leak guard is **strictly weaker** than the one this PR shipped.
2. No booby-trap / structural assertion there.
3. Its `container` scoping (`PORTAL-SCOPED-ABSENCE`).
4. `bookmarks/render/side-encoding.test.tsx:191` and `profile/render/argument-list-side.test.tsx:132` — **SC-1 masking guards**, container-scoped. ⚠ Both sit on a **compile-enforced** property (the removed union carries no body field), so fix them **for form**, and **before** any change that gives the removed variant a body — at which point the belt becomes the guard.
5. `discovery/render/carousel.test.tsx:332` — hygiene (Canon §3.10's `:has()` ban), same scoping.

**S-L4 · No `Sentry.captureException` in ANY of the five error boundaries** (`global-error`, `(auth)/error`, `bookmarks/error`, `u/[pseudonym]/error`, `m/[slug]/error`) while `instrumentation-client.ts` does init Sentry. A React boundary swallows the throw, so a client-side crash on `/m/[slug]` produces no client telemetry. **Not a regression from this PR** — the pre-existing escalation target captures nothing either, and server throws are still captured by the request-error hook.

**The unnumbered mint queue** (web's, at close-out): the pre-authored-receipt lesson → `CLAUDE.md` §8 at the next free O-number; the comment-as-unverified-claim lesson → V-space, subject to the double-booking above.

**`PD-3-07` stays OPEN** — PR 2's plan must carry the guards for D2 sites 2–5.

---

## 9 · Verification

`just verify` and the full suite ran **before every commit**, unpiped, exit code echoed. H12 checked before every suite run. Final suite at `db51cbc`: **326 files passed, 1 skipped; 2898 tests**. CI green on every push; final run **31701505151** on `db51cbc`.

⚠ **The suite degraded badly under sustained load** — 320s at C1, 3054s at R2 — then recovered to 185s at R3 when the machine idled. Not DB bloat (401 MB, near-zero dead tuples) and not leaked connections. A projection of "six more hours" made from the rising trend was **wrong**, and withdrawn.

⚠ **`ZUGZWANG_ENV=preview` belongs to `just verify` and must never share a shell with the test runner.** Sourcing the build-env prelude and running `pnpm vitest run` in the same shell reddens `precommit-moderate::reservation-key-shape-with-namespacing` — `preview:` where `prod:` is expected. **This happened twice**, the second time after it had already been written up.

---

## 10 · What the machine read missed

**The false V-1 receipt.** It shipped in `2519838`'s body, propagated into the shipped file at `3e012a9`, into the delivered run report, into the `commits.txt` deliverable, and into the PR description — **five locations across three channels**. `@code-reviewer` read the file and did not flag it. Gate C read 1 read the exact hunk and did not flag it. It surfaced only when a reader asked a **direct question no artifact answered**: "dumped to a file, or edited in place?"

**The lesson, unnumbered and awaiting its mint:** *a comment added in a diff is an unverified claim, and reviewers read added comments as findings-free.* Every guard in this PR asserts something about code. Nothing asserts anything about the prose that describes it — and the prose is what four reads spent most of their time correcting.

**And the sweep that found it found more than the relay's grep list.** The PR-description hit was outside everything the relay named; it turned up only because the sweep went past the handed list to the whole tree. Precedent held: POLISH-7a GC-7, where the handed list was worked instead of the tree and not one of fifteen corrections was still right.

---

## 11 · Next session starts at

**PR 2 — and it needs its own plan-mode ritual in a fresh chat.** ⛔ Do not start it from this session's context. A deadline measurement runs before it.

PR 2's scope, carried forward: R1 sites 1–2 (`PostCard.tsx`) · R4 (`PostCard.tsx` "Read more") · **D2 sites 2–5 with their guards** (`PD-3-07`) · D3 (`BookmarkToggle.tsx`) · `PD-3-04` (`MarketPriceChartOverlay.tsx`). ⚠ `PF-6` also routes the `docs/plans/POLISH-3.md` §5 G-4 wording fix to PR 2's plan-mode chat, where editing the plan is in scope.

*Time: 2026-08-13, ~02:24–18:15 IST across the execute run and four Gate C reads.*
