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
| 6 | `9c39704` | `chore(discovery): log session — PRIMITIVES-2 PR-A` |
| 7 | `5fa19ab` | `fix(discovery): D2-P1 — MarketThumb catches a pre-hydration 404` |

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

**S-5 · D2-P1's first alive check was GREEN-IMPOSSIBLE — the same trap as S-1,
caught the same way.** The mount test's N1 alive check asserted
`toHaveLength(site.imgCount)` on the loaded render. But a *correct* component
has already swapped those images for the fallback by the time `render()`
returns, so the check measures the fix rather than the fixture and fails the
moment the fix works. It went RED for the right reason before the fix and RED
for the wrong reason after it.

Caught, again, by reading *which* assertion failed instead of assuming the fix
was wrong — the failure was `expected [] to have a length of 1`, an empty
container, which is the fix succeeding. Repaired by splitting the alive check
into its own DECODED-stub render that proves the fixture mounts `imgCount`
images, then asserting length 0 under the failed-decode stub. The RED pasted
into `5fa19ab` is from the corrected shape, re-captured with the fix stashed —
a RED that does not match its own committed test is worse than none.

**S-6 · The jsdom defaults are wrong in BOTH directions, and only one of them
is obvious.** The relay warned that `naturalWidth` is 0 for every image in
jsdom. Probing the environment showed the other half: `complete` is **false**
for every image too. That second default is the more dangerous one — it makes
the production check *inert* rather than always-true, so an unstubbed test
reports a confident green while exercising nothing. Both properties are stubbed,
and both discriminating axes carry a positive control.

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

**→ RESOLVED at commit `5fa19ab` by plan patch D2-P1** (operator-ratified after
review). Disposition (b) was taken: D2 was reopened and the mount-time check
landed in PR-A. It was originally left out on the reasoning that extending a
ratified design is the plan author's call, not the execute surface's — that
routing was right, and the ruling came back to build it.

⚠ **A CORRECTION THIS LOG MUST CARRY, because it was stated twice and it
mattered.** The paragraph originally here said *"PERF-1 is a GO-LIVE BLOCKER;
when it lands, this window widens."* **PERF-1 had already landed** —
`docs/parked.md:25` records it CLOSED 2026-08-10, the day before this session:
functions were in `iad1` against a Mumbai DB, ADR-0006's ratified `bom1` was
never applied, and fixing it took Discovery **35.07 s → 0.692 s p50**. That was
asserted from stale memory instead of being read off the live repo, which is
exactly the O-2 failure (*verify against the live repo — never against memory*).

It is not a cosmetic slip: the reviewer's mitigation for M1 was *"the slow read
means the chunk arrives after hydration."* With PERF-1 closed, a **faster**
response arrives EARLIER relative to hydration, so the lost-event window is
**wider**, not narrower. **The stale claim made M1 look less urgent than it is.**
The mitigation was already retired before it was offered.

**OQ-B · Two files beyond §5's four-file fence.** Both flagged, neither silent.
Gate C should confirm both are acceptable rather than discover them in the diff.

**OQ-C · The §11 plan patch is HELD, not committed.** The web-authored text
names `tests/unit/design/reserves-server-only.test.ts`. That path does not
exist; the guard is at `tests/unit/discovery/reserves-server-only.test.ts`
(`design/` holds `side-pole-binding`, `tokens-monochrome`, `avatar-ring-token`
and friends). Per the relay's *"if any sentence looks wrong, HALT and quote
it"*, and because `docs/plans/PRIMITIVES-2.md` is ratified web-owned text that
must not be normalized in-session, the patch is held for a one-word
ratification. Everything else in it was verified correct against this repo,
including the PERF-1 figures. **`docs/plans/PRIMITIVES-2.md` is untouched, so
the final diff carries 7 file headers, not the 8 the relay expected.**

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
| **Post-D2-P1** — `just verify` | **PASS** — "All checks passed" (exit 0) |
| **Post-D2-P1** — full suite ×3, sequential | **all three green: 317 passed / 1 skipped · 2817 passed / 1 skipped / 4 todo**, exit 0, zero FAILs in any run |
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

**Three further full runs after D2-P1 also did not reproduce it** — all three
green, zero FAILs in any of them. Final tally across the session: **6 full-suite
runs, 1 occurrence.** It remains a real latent isolation weakness (a global row
count in a parallel runner sharing one Postgres), not a regression, and not
PR-A's to fix.

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
