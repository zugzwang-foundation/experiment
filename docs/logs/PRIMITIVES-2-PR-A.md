# PRIMITIVES-2 PR-A — session log

**Task:** PR-A of PRIMITIVES-2 — `MarketThumb`, the shared `null · error · loaded`
primitive behind Discovery's three image sites, plus D4's two `alt=""` changes.
**Plan:** `docs/plans/PRIMITIVES-2.md` (#316, `f51a9dd`) — §5 is PR-A's scope,
§3 D2/D3/D4 its rulings, §7 the halt set, §8 the proof discipline.
**Ritual:** FULL and gated. Not ultracode, not stacked on one.
**Ground:** `origin/main` = `f51a9dd` (PR #316 merged). Branch
`fix/primitives-2-market-thumb`.
**Gate C:** a web diff-read before merge, **non-optional**, still pending at
time of writing. Diff written to `~/Downloads/PR-A-primitives-2.diff`.

---

## 1 · What landed

Six commits on `fix/primitives-2-market-thumb`:

| # | SHA | Commit |
|---|---|---|
| 1 | `197b6b8` | `test(discovery): RED — a 404ing image has no degradation path` |
| 2 | `f1b9490` | `feat(discovery): MarketThumb owns null · error · loaded` |
| 3 | `5a19158` | `fix(discovery): three Discovery image sites adopt MarketThumb` |
| 4 | `6aa57a1` | `test(discovery): per-consumer zero-delta baselines` |
| 5 | `db3b72d` | `fix(discovery): address @code-reviewer findings on PR-A` |
| 6 | *this* | `chore(discovery): log session — PRIMITIVES-2 PR-A` |

**Files — six, where the plan's §5 named four.** Both extras are forced
completeness consequences of ratified rulings, not scope creep; both are
flagged in their commit bodies and in the PR body for Gate C.

| File | Why |
|---|---|
| `src/components/discovery/MarketThumb.tsx` | new — the primitive (§5) |
| `src/components/discovery/MarketCard.tsx` | adoption (§5) |
| `src/components/discovery/HeroPanels.tsx` | two adoptions (§5) |
| `tests/unit/discovery/render/market-thumb.test.tsx` | new — RED guard + §8.1 baselines (§5) |
| `tests/unit/discovery/render/market-card.test.tsx` | **5th** — D4 forced it |
| `tests/unit/discovery/reserves-server-only.test.ts` | **6th** — M2, client-graph inventory |

**The defect fixed.** A presigned R2 GET URL that 404s at the browser had no
degradation path at any of the three sites. Presigning is a local HMAC over a
key, so `getDefaultMarketMediaUrl` returns a well-formed URL for an object that
is not there (recon R10) — the server cannot see this, only the browser can.
Zero `onError` handlers existed anywhere under `src/` before this PR.

---

## 2 · Decisions made

**D2's split held; P2-H6 never fired.** Every site passes its full geometry via
`className` and its own placeholder via `fallback`. `MarketThumb` emits no
classes of its own, so the null and loaded renders are byte-identical *by
construction*, not by assertion. Nine render paths (3 variants × 3 states)
never came into being.

**`className`, `alt` and `fallback` are all REQUIRED** — §8 O-1, structural
beats procedural. A defaulted `className` renders an unstyled image; a defaulted
`fallback` is the primitive inventing a visual, which D3 forbids; a defaulted
`alt` lets the a11y decision be made by omission. Same call `PriceBar` made with
its required `size`.

**Failure is remembered BY URL, not by a boolean.** `DiscoveryCarousel.tsx:102`
re-renders `<HeroPanels>` in place with a different `card` every 10 s and passes
no `key`, so the `MarketThumb` instance survives the market change. A boolean
`errored` would latch — market A's missing object would blank market B's good
thumb for the rest of the session. Storing *which* `src` failed makes the
comparison false again the instant a new URL arrives: no effect, no `key`, no
reset dance. One slot rather than a `Set` is deliberate and documented (a
carousel lap re-requests a known-404 once; correct, and cheaper than remembering
every URL forever).

**Suppressions collapsed 3 → 1.** Exactly one `<img>` now exists under
`src/components/discovery/`, carrying the single `biome-ignore noImgElement`.

---

## 3 · Surprises caught + fixed in-session

**S-1 · The RED test's first shape asserted something no correct implementation
could satisfy.** Site 3's fixture gives BOTH hero panels the same post-image
URL, but `querySelector` returns only the YES panel's `<img>`. Firing `error` at
that one and then asserting whole-container equality against the null render can
never pass — the NO panel's image legitimately never failed. It was RED at
commit 1 for the *right* reason (nothing degraded at all) but would have stayed
RED forever after the fix.

Caught by running commit 3 and reading *which* assertion still failed rather
than assuming the fix was incomplete. Repaired by asserting `imgCount` per site
and firing `error` at **every** match — which converts site 3 from a YES-only
assertion into a **both-poles** one by construction, the exact defect class
D14 Q2 warns about. Commits 1 and 2 were then rebuilt (un-pushed, `reset --soft`)
so the captured RED in commit 1's body corresponds to the test actually
committed. A RED output that does not match its own test is a worse artifact
than no RED at all.

**S-2 · The §8.1 baselines were checked for vacuity, not assumed green.** A new
guard green on first run is the vacuous pass H15/P2-H7 names, and commit 4's
baselines were green on first run. They were deliberately perturbed — a
class-ORDER swap inside `CARD_THUMB_NULL` (`flex h-[52px]` → `h-[52px] flex`,
identical classes, different order) plus one byte in `POST_IMAGE_LOADED`
(`min-h-[40px]` → `min-h-[41px]`) — and turned **5 of 19** tests RED across both
consumers and both poles. Restored and md5-verified before committing. The
class-order case is the one §8.1 explicitly says a first draft once passed by
eye.

**S-3 · A perturbation that proved nothing was caught before it was believed.**
The first perturbation attempt used `perl -0pi -e` with mis-escaped `\Q…\E`
brackets; the substitutions silently did not apply and the suite stayed green.
Reported as "no diff" and redone in Python with `assert count == 1` anchors
before each replace. A perturbation that does not perturb reads exactly like a
guard that does not bite.

**S-4 · The M2 guard entry proved itself live on arrival.**
`reserves-server-only.test.ts` scans raw file text with a naive
`toContain("reserves")`. A first draft of a `MarketThumb` comment used the word
"**pre**serves" — which contains "reserves" — and the guard went RED the moment
`MarketThumb.tsx` was added to its list. Then the *explanatory comment about the
trap* contained the literal string too, and reddened it again. Reworded to
"keeps" with no meta-commentary. Annoying twice over, but it is a free positive
control: the new inventory entry is demonstrably not vacuous.

---

## 4 · Open questions

**OQ-A · M1 — the pre-hydration 404 window. The one thing Gate C must rule on.**
`onError` is a React *synthetic* handler; for `<img>` React attaches `error` via
`listenToNonDelegatedEvent`, bound at hydrate/commit time
(`react-dom-client.development.js:5274-5278`, verified in this repo, not taken
on the reviewer's word). `(public)/page.tsx:18` is `force-dynamic` and the
images ship in server-rendered HTML inside a Suspense boundary, so the browser
starts the R2 GET at parse time. The DOM `error` event fires exactly once — if
it lands before hydration it is lost, no re-render is scheduled, and the broken
`<img>` stays mounted with no placeholder. That is the exact symptom PR-A
exists to remove, on first paint.

All client-side paths (carousel advance, client navigation) ARE covered.

**Not fixed here, deliberately.** D2's ratified spec is literally
`onError fired → fallback`, and that is precisely what was built. Closing the
first-paint window needs a `ref` plus an `img.complete && img.naturalWidth === 0`
layout check — new mechanism beyond the ruling, with its own edge cases (SVG
sources report `naturalWidth === 0`). Extending a ratified design is the plan
author's call, not the execute surface's. Recorded as a KNOWN GAP in
`MarketThumb.tsx`'s docblock so it cannot be rediscovered as a surprise.

Dispositions for Gate C: **(a)** accept + docket; **(b)** reopen D2 and land the
hydration check in PR-A; **(c)** route to PERF-1, which already owns this render
path.

⚠ The reviewer's own mitigation — that PERF-1's ~35 s Discovery read makes the
content chunk arrive long after hydration — is true today but is *a performance
bug masking a correctness gap*. PERF-1 is a GO-LIVE BLOCKER; when it lands, this
window widens. It is not a fix.

**OQ-B · Two files beyond §5's four-file fence.** Both flagged, neither silent.
Gate C should confirm both are acceptable rather than discover them in the diff.

---

## 5 · Reviewer

`@code-reviewer` only — **no `@security-auditor`, no `@test-writer`**, matching
plan §3 D14 and the PRIMITIVES-1 precedent. Display-grade primitives and a
client-side `onError`: no write path, no engine contact, none of CLAUDE.md §1's
four critical paths.

Launched with `model: "opus"` from the primary tree; `.claude/agents/` was
verified byte-identical to `origin/main` first (`git diff origin/main -- .claude/`
empty, `model: claude-opus-5` / `effort: max`), which makes the primary tree
equivalent to a worktree at main for pin purposes. Instructed explicitly NOT to
run any test command — a full-suite run was in flight, and a concurrent runner
manufactures false REDs here.

**Returned: CRITICAL none · HIGH none · MEDIUM 2 · LOW 7.** Adopted M2, L1, L3,
L4, L6 in commit 5. Accepted-and-recorded M1 (§4 OQ-A), L2, L5. L7 (missing
session log) is this file.

---

## 6 · Verification

| Gate | Result |
|---|---|
| `ZUGZWANG_ENV=preview just verify` | **PASS** — "All checks passed" (exit 0) |
| `pnpm vitest run` full suite, run 1 (pre-review-fixes) | **317 passed / 1 skipped · 2807 passed / 1 skipped / 4 todo**, exit 0 |
| `pnpm vitest run` full suite, run 2 (post-review-fixes) | 316 passed / **1 failed** — see the flake note below |
| `pnpm vitest run` full suite, run 3 | **317 passed / 1 skipped · 2807 passed**, exit 0, zero FAILs |
| `tests/unit/design/side-pole-binding.test.ts` | **GREEN** — exit criterion 7 |
| `tests/unit/design/tokens-monochrome.test.ts` | **GREEN** — exit criterion 8 |
| `market-thumb.test.tsx` | 19 tests, all passing |

**The run-2 failure is a pre-existing shared-DB isolation flake, not a
regression — stated with its evidence rather than waved off.**
`tests/server/auth/pseudonym-assigned-event.test.ts:91`,
`user.pseudonym_assigned::happy-path-emits-one-event`, failed
`expected 2 to be 1` on `rows.length` — it asserts the `events` table holds
exactly one row and found two, the signature of a concurrently-written row from
another file in the same parallel run, not of a logic change. Evidence it is not
this diff: (a) the SAME test was green in run 1 on this same branch, where the
only difference is comments, one `Omit` member and one guard-list entry;
(b) green on re-run in isolation (2/2); (c) this PR touches no file under
`src/server/**`, no DB code and no auth code, and nothing in the diff is
reachable from that test's import graph. Run 2 also took 288 s against run 1's
172 s, consistent with heavier contention on the one local Postgres.

**Run 3 did not reproduce it** — 317 passed, zero FAILs, exit 0. So: 2 of 3 full
runs fully green, the third failing only that one unrelated auth assertion,
which is green in isolation. Confirmed flaky.

⚠ Not silently absorbed. A test that asserts a GLOBAL row count
(`rows.length === 1` over the whole `events` table) is order-dependent by
construction in a parallel runner sharing one Postgres, so it will recur. That
is a real pre-existing isolation weakness in that suite and wants its own docket
row — but it is not PR-A's, and PR-A should not be the PR that fixes it.

**Exit criteria 1–3, 6–9 met.** Criteria 4 and 5 are PR-B's (`SideBadge` presets,
the two held one-line values) and were deliberately not read this session — the
relay fenced V1/V2 out of PR-A.

⚠ Criterion 1 is met **on the post-hydration path**; see §4 OQ-A.

**P2-H3 CLEAR.** `HeroPanels`' `supportPole` / `counterPole` are byte-identical,
shifted `:274-275` → `:277-278` by the added import and comment only.
`PERMITTED_FILES` and the predicate are untouched, and `MarketThumb.tsx` carries
no side value or pole token, so it cannot enter that inventory.

**H16 CLEAR** on every named row — `badges.tsx`, `globals.css`, `parked.md`, the
register, **R2-KEY-OPACITY** (`src/server/discovery/media.ts`, the row the plan
flags as most likely to be absorbed and one import from this render path), RR-3 /
`ReplySplitBar.tsx`, CC-9 / `ReviewFeed.tsx`, and all of `src/server/**`.
**H7 CLEAR** — no DDL, migration, `EVENT_TYPES` value, ADR or SPEC edit. This
task mints no ADR; the ceiling stays 0036, next free 0037.

---

## 7 · Next session starts at

**Gate C — the web diff-read of PR-A**, carrying the OQ-A (M1) disposition.
Diff is at `~/Downloads/PR-A-primitives-2.diff` for operator upload; it travels
as an **uploaded file**, never pasted terminal output.

After PR-A merges: cut `chore/primitives-2-seam` from the NEW `main` — **serial,
never parallel** (D11) — and re-verify the branch does not already exist
remotely before pushing (§10; it has bitten twice). PR-B rebases on PR-A and
both touch `HeroPanels.tsx`, so expect a rebase.

**Context to preserve.** PR-B reads V1/V2 (the `tokens-monochrome` predicate and
the two tier-4 mockup numbers) which PR-A was fenced from; D9 is HALT-GATED on
that guard with D9-alt pre-ratified as the contingency. The `alt=""` treatment is
now uniform across all three Discovery image sites, so any future thumb consumer
inherits it. `MarketThumb` needs a `"use client"` of its own only if a **server**
component ever imports it — recorded in its docblock, not built for.
