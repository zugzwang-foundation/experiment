# POLISH.7a — Auth surfaces — session log (machine phase)

**Stratum:** POLISH.7a, the **first** POLISH surface run under `POLISH-SURFACE-TEMPLATE.md`.
**State:** built + gated + reviewed; **PR open, HALTED at the merge gate.** Gate C is a web diff-read before merge, on every machine-phase PR, without exception.
**Class:** a single gated pass per `POLISH-TRACKER.md:20` — but the **reviewer cascade ran anyway**, and it caught a CRITICAL. See §5.
**Ground:** branch `fix/polish-7a-auth` off `origin/main` @ `903b2a1` (#319).

---

## 1 · Surface · routes · components — AS VERIFIED at step 0, not as listed

**Routes — three, and that is the complete set.** `/sign-in` · `/sign-in/otp` · `/onboarding`. `find src/app/(auth) -type f` returned exactly four files at recon: those three pages plus `layout.tsx`. No `loading.tsx`, no `error.tsx` (until this PR), no `not-found.tsx`, no route handler, no colocated component.

| File | Owner |
|---|---|
| `sign-in/page.tsx` · `sign-in/otp/page.tsx` · `onboarding/page.tsx` | **.7a** |
| `_components/AuthAlert.tsx` · `error.tsx` | **.7a** — both minted this PR |
| `(auth)/layout.tsx` · `GlobalHeader` + cluster · `PageContainer` · `src/app/layout.tsx` | **.1** |
| `debate/composer/AuthGateSlot.tsx` | **.4** — untouched, `text-n4` label at `:49` included |

⚠ **`POLISH-0.md`'s `.7a` row had NO Components cell** — the only inspectable surface row without one, so template §2's *"a component list is not the route"* check had nothing to check against. Written in at S-01.

**Cross-surface primitives consumed: NONE.** `SideBadge`, `MarketThumb`, `--border-hero`, `--ring-active`, `REPLYHEAD_TIER` — absent from `(auth)/**` and from every shell component the layout mounts. PRIMITIVES-2 PR-B has zero blast radius here.

---

## 2 · Step 0 findings — 19 claims swept

**16 TRUE · 2 FALSE · 1 UNVERIFIABLE.** Full evidence in the recon artifact (sentinel `ZZ-7A-RECON-2026-08-11`).

**FALSE (both class S against the method document):**
- **C7 — `UI-A7.md` "Ruling 4" does not exist.** Three ratified rulings (`:13-17`). The substance is verbatim at `:157`, §6 · WI-1. ⚠ The relay made §4's tier-4 value-demotion conditional on ruling 4. It was **not** voided — three committed documents state the rule and template F2/H13 restate it. No token-value delta was filed from either mockup.
- **C15 — the register's error code was wrong.** `otp_rate_limited`, not `rate_limited`; all six `rate_limited` sites in `src/` are POLISH.4's composer.

**UNVERIFIABLE:** X1's first document — a task-sequence doc listing AUTH-ERROR-COPY under *"Do NOT schedule during Phase C"* — **is not on `main`**. Six `git grep` hits, none a task-sequence document. Most likely the external tracker.

**Six further class-S findings beyond the 19,** all corrected at S-01: no Components cell · a missing tier-2 source (`DESIGN_W2_1_CLOSE-OUT.md`) · a missing tier-4 source (`DESIGN_W2_11_state-kit_mockup-v0_1.html`, which governs every error state) · the first-login mockup listed without §6.1's disqualification · `SPEC.1.md:817`'s named obligation absent · three carry-forwards from `PRIMITIVES-1.md:341-342` absent.

---

## 3 · Machine PR — 7 shipped · 5 halted · 6 superseded · 3 data-blocked

⚠ **The plan predicted 8 shipped. It is 7. D19 shipped and was REVERTED** after `@code-reviewer` returned a CRITICAL — §5.

| Commit | What |
|---|---|
| `aa89353` | the ratified plan, verbatim (md5 `0dffe285…`, 361 L, `diff` empty) |
| `1fdba6a` | the raw-hex guard's reach, RED-first on three axes |
| `6032ea3` | D01 · D03 · D07 · D12 · D14 · D21 |
| `6635201` | D20 — the `(auth)` error boundary |
| ~~`5a11b38`~~ | ~~D19~~ — **REVERTED at `1a41b0f`** |
| `0a8d762` | class-S corrections (S-01 · S-08 · S-09 · S-10 · S-11a) |
| `2d006ca` | ten `docs/parked.md` rows |
| `1a41b0f` | **Revert D19**, with the measurement that condemned it |
| `3158f59` | the `@code-reviewer` round |
| `c62b3d2` | the `@security-auditor` round |

**Shipped (7):** D01 · D03 · D07 · D12 · D14 · D20 · D21.
**Halted and routed (5):** D02 → `AUTH-GOOGLE-MARK` · D10 + D11 → `AUTH-OTP-FIDELITY` · D16 → `AUTH-ONBOARDING-GATE` · **D19 → back to web, undecided**.
**Superseded (6):** D04 · D05 · D08 · D09 · D13 · D15. **Data-blocked (3):** D06 · D17 · D18.

**Seam contract (UI-A7 §3)** re-asserted at PR HEAD, and independently re-verified by `@security-auditor` — including the containment question D03's restructure actually raised: the hidden `turnstileToken` anchor is now a **sibling of the flex row and a direct child of the form**, so `new FormData(event.currentTarget)` still enumerates it. `onboarding/page.tsx` is **byte-identical to `origin/main`** (blob `e82ebb1` both ends).

---

## 4 · Halts fired

| Halt | Fired by | Disposition |
|---|---|---|
| **H6** | C7 — no ruling 4 | substance at `:157`; citation corrected; demotion **applied**, not voided |
| **H6** | `AUTH-CONSENT-LINE` — one occurrence tree-wide, no definition | **STRUCK at R-D**, four grounds, docket row landed |
| **H2** | D10 · D11 · D16 | routed to two dated tasks |
| **H4** (contested) | D19 | R-A resolved it *toward* building — and building it was wrong. §5 |
| **P8** | **S-11(b) — the anchor does not exist** | **NOT APPLIED.** §8 |
| **H15** | the guard's five new lines | discharged RED-first; the last two only after `@code-reviewer` M-4 |
| **⛔ P6 / K1** | D19's repair needs >1 node | **fired at review, not at write.** §5 |

---

## 5 · Reviewers — the cascade earned its place

`POLISH-TRACKER.md:20` calls `.7a` a single gated pass. The plan ran the full cascade anyway, on two PR-specific grounds (D19 touched the root layout; this is the sign-in path). **That decision is the reason this PR is not shipping a live regression.**

### `@code-reviewer` — 1 CRITICAL · 2 HIGH · 6 MEDIUM · 7 LOW

**C-1 · CRITICAL · `src/app/layout.tsx` — D19 un-sticks the global header on every page taller than the viewport.** Giving `<body>` a definite height makes the route-group wrapper a flex item in a definite-height column; its explicit `min-height:100%` suppresses the flex automatic minimum size, so flex-shrink **clamps** it to viewport height while content overflows. `position:sticky` is bounded by that wrapper, so `GlobalHeader` stops sticking after one viewport.

**Confirmed against the running app, not accepted on reasoning** — `/sign-in` at 1440×900 with 2000px appended inside `<main>`, toggling only that declaration:

| scrollY | 0 | 400 | 900 | 1400 | 2000 |
|---|---|---|---|---|---|
| **before** (`min-h-full`) | 0 | 0 | 0 | 0 | 0 |
| **after** (`h-full`, as shipped) | 0 | 0 | **−62** | **−562** | **−578** |

Affects `/`, `/m/[slug]`, `/u/[pseudonym]`, `/bookmarks` and `/onboarding` — which `(auth)/layout.tsx:38-42` states is *designed* to be tall. Regresses ADR-0023 Patch 2026-08-03 / POLISH-1b B3. **Disposition: REVERTED at `1a41b0f`; D19 routed back to web** with the measured alternative attached (wrapper `min-h-dvh`: card top 386 on a short page, header top 0 at scrollY 1400 on a tall one — one node, and P3-forbidden).

**H-1 · HIGH · a real regression I introduced.** `origin/main` had **two** `<AuthError>` call sites and the component hardcoded `mt-3`, so both emitted it. D21 gave one site `className="mt-3"` and the other nothing — a silent 12px loss. **Fixed**, and the pins moved to where the class is emitted; non-vacuity proven by re-introducing the exact defect.

**H-2 · HIGH · tautology deleted.** `expect(SIGN_IN_BASELINE.replace("mt-3 ","")).toBe(OTP_BASELINE)` compared two constants defined from each other — and its *name* was the sentence a reader would take as the zero-delta receipt.

**MEDIUM:** M-1 non-override consequence documented · **M-2 `AuthAlert` moved to `_components/` with alias imports** (measured ruling: parent-traversing relative imports in `src/app/` were exactly the two this diff introduced) · M-3 the boundary's coverage limit named · **M-4 the two extension guard lines got their missing RED-first discharge** · M-5 the Components cell was stale at PR head *inside the PR that made it stale* · M-6 a second tautology replaced with a real reachability control.

**LOW:** L-1 three different numbers for one measurement · L-2 the `AuthError` name echo — **ruled keep** · L-3 the ported margins ride on `CardHeader`'s `gap-1`, so 12px reads as 16px and `2px/14px` as `6px/18px` — **Gate C territory** · L-4 `existsSync` over `toThrow()` · L-5 the guard's named-file shape is procedural where structural was available (**O-1**) · L-6 neither copy delta has a test pin · L-7 the S-11(b) halt.

### `@security-auditor` — 0 CRITICAL · 0 HIGH · 3 MEDIUM · 5 LOW

**The central assertion holds and this PR does not weaken it.** Verified by **blob hash**, not by an empty diff: `session-gate.ts`, `api/auth/[...all]/route.ts`, `onboarding/page.tsx`, `tos-accept.ts` all identical to base. Three attack constructions attempted and each recorded as failing — including one I did not know: **`tosAcceptedAt` is not in `user.additionalFields` at all**, so Better Auth's adapter has no path to persist it from request input.

**MEDIUM-1 · `identity_pool_exhausted` renders verbatim to an anonymous visitor.** Traced hop by hop. SPEC.1 §16.4 scopes pool depth as admin-only; this publishes its terminal state, giving an attacker draining the pool a progress oracle. **Pre-existing on `main`** — the same string reached the same region through the deleted component. Folded into `AUTH-ERROR-COPY`, whose enumeration I had left at three codes.

**MEDIUM-2 · participant emails egress to Sentry in the URL query string at 100% trace sampling.** `sendDefaultPii:false` governs IP and cookies, **not the URL**. SPEC.1 §16.3 `H2` lists `email` among the erasure fields, and a DB scrub cannot reach Sentry's store. **Not what `AUTH-HARDEN` item (2) covered** — that was scoped to the server-side Resend capture. PostHog verified clean.

**MEDIUM-3 · the siteverify fetch is ordered ahead of both limiters,** so a spoofed leftmost-XFF amplifies into a third-party call, and a throttled project secret degrades fail-closed into a full sign-in outage.

**LOW:** L-1 the Google arm discards its `{data,error}` tuple, so a real OAuth rejection renders nothing · L-2 the two Turnstile token sites are structurally asymmetric, which is what endangers ADR-0033:25's parity rule · L-3 no error boundary in the tree reports to Sentry (**tree-wide, not `.7a`'s**) · L-4 a missing secret reads as `turnstile_failed` (**O-3**) · L-5 `users.name`/`image` are client-writable — no render path today, but the 2026-11-06 dataset releases the row.

**One finding I would not have reached alone, now in the file:** in production React already replaces a *server*-side error with a placeholder, so `error.tsx`'s non-render genuinely guards the **client** arm — where the real unsanitized `Error` does arrive. Anyone "improving" it will test a server throw, see a placeholder, and be wrong.

**`@db-migration-reviewer` — WAIVED**, and the waiver is stated rather than omitted: no schema, no migration, no `drizzle/` change. `git diff --name-only` over `src/db/` and `drizzle/` is empty.

---

## 6 · Exit bar — `POLISH-0.md` §7

| # | Item | State |
|---|---|---|
| 1 | Parity by eye at 1440 | ⏳ **THE FOUNDER'S.** The surface does not close on this PR |
| 2 | Invariant-visual obligations | ✅ PASS by absence — tree-walked, and re-verified by `@security-auditor` |
| 3 | Affordances functional end-to-end | ✅ PASS — seam intact, suite green, both client pages served and exercised in a browser |
| 4 | All states per P1–P7 | ✅ `error.tsx` lands. `loading.tsx` deliberately omitted (R-C), **pinned by a test** |
| 5 | Cross-surface criteria | ✅ PASS by absence, all six |
| 6 | Token usage, not value | ✅ PASS — and for the first time actually measured on these files |
| 7 | Pole binding | ✅ **VACUOUS, and stated as vacuous.** No side-keyed element exists here |
| 8 | G1 desktop-only | ✅ no responsive finding; all measurement at 1440 |

**⚠ D19 leaves criterion 1 with a known defect:** `my-auto` still computes to zero and both Cards still top-align at 93.24px. The founder pass will see it. That is now a *known* open row rather than a surprise.

---

## 7 · Surprises caught + fixed in-session

**1 · The §7.1 proof was VACUOUS, and I caught it — then shipped the thing it was proving anyway.** The A/B sliced to the first 40 elements; the header cluster alone exceeds that, so the Card was never compared. It reported *"tops identical"* for `/sign-in`. It died because the two-build measurement said the card moved and the A/B said nothing did, and both could not be true. **But fixing the slice did not fix the proof** — the re-run still only measured pages shorter than the viewport, which is exactly where D19 is inert. I recorded that limit honestly in the commit body and then did not act on it. `@code-reviewer` did. **Naming a gap is not closing it.**

**2 · The `error.tsx` container assertion went RED on correct code** — it grepped the source for `PageContainer` and `max-w-`, and the component's own docstring names both while explaining why it uses neither. §8.1 **N4**. Re-cut to a render assertion.

**3 · The full suite went RED on my own harness.** `ZUGZWANG_ENV=preview`, which `next build` **requires**, leaked into vitest; `tests/_setup/env.ts:32` is `??=`, so a real value wins over the suite's own default and `precommit-moderate::reservation-key-shape-with-namespacing` expects the `prod` namespace. **The two gates need different values of the same variable and nothing on disk says so.**

**4 · H-1 — I introduced a 12px regression under a green byte-identity receipt.** The receipt was real and blind: a component rendered in isolation proves nothing about a call site.

---

## 8 · Open questions — all for Gate C

1. ⚠ **D19 needs a ruling.** Grant the P3 exception for the one-line `(auth)/layout.tsx` change (measured to work on both axes), re-assign D19 to POLISH.1, or leave the collapse open. **The defect is real and still live.**
2. ⚠ **S-11(b) — P8 halt, unresolved.** `PD-0-15` lives in the pre-recorded table, whose header at `POLISH-register.md:162` has eight columns and **no Root-cause cell** (the per-surface tables have one). Web picks a cell. **The paragraph is on disk nowhere** — the plan text is committed, but the correction it prescribes is not applied.
3. **The register rows are NOT allocated.** No `PD-7a-nn` exists; the `.7a` table is still the placeholder. §9.2's ratified commit sequence has no register-writing commit, and I did not add one. Web's call.
4. ⚠ **`POLISH-register.md:43` now says `.7a` is *"Not yet inspected"*, which this PR falsifies** — the same staleness S-09 just fixed for `.1`. Not in §6's enumerated list, so not edited.
5. **D14's placement is a §4.2 B3 call** — the back link moved inside the Card rather than above it, and `--hairline` is 1px where the mockup's ring is 1.5px. Both flagged, both want a ruling.
6. **`@security-auditor` LOW-5 has no home** — `users.name`/`image` client-writable, residual risk in the 2026-11-06 dataset. I did not mint a destination name for it.
7. **The recon artifact was overwritten.** `~/Downloads/POLISH-7a-recon.md` now holds a copy of the plan; the plan's own footer cites that path as evidence. Re-request before Gate C if the recon is needed.

---

## 9 · Next session starts at

**Gate C: web diff-read of the PR**, with `~/Downloads/POLISH-7a-gateC.diff`. Answer the seven open questions above — **D19 first**, because it is the only one where a defect is live on `main`-bound code either way. Then the operator visual check at 1440. Do **not** merge before both.

---

## 10 · Context to preserve

- **`ZUGZWANG_ENV` must differ between the two gates.** `next build` requires `preview`; the suite requires it **unset** (or `prod`). `tests/_setup/env.ts:32`'s `??=` means an exported value silently wins.
- **Local Postgres on `:54322` was already up.** The full suite needs it; `docker ps` first.
- **The full suite is ~30 min** and must not overlap a reviewer's vitest run (H12).
- **D19's alternative is measured and ready:** `(auth)/layout.tsx:36` `min-h-full` → `min-h-dvh`, body untouched. Short page: card top 386. Tall page: header top 0 at scrollY 1400.
- **`git diff` is not proof of identity** — `@security-auditor` compared blob hashes instead. Worth adopting.

---

## 11 · ⚠ Lesson for the next relay: what the machine read missed

**A proof that only exercises the case where the change is inert is not a proof, and naming that limit in the commit body does not discharge it.** §7.1 asked for a per-consumer zero-delta proof of a root-layout change. I built one, caught it being vacuous once, rebuilt it, enumerated nine routes, measured four properties per route — and every route was shorter than the viewport, which is precisely where `body{height:100%}` changes nothing. I wrote *"HONEST LIMITS: no long page was ever exercised"* into the commit body and shipped. The reviewer read that sentence and went and loaded a long page.

**The next relay should require the proof to include the case that would FAIL** — for a layout change, a page taller than the viewport; for a masking change, a removed row; for a guard, an offender. `POLISH-SURFACE-TEMPLATE.md` §8.1 has nine non-vacuity rules and every one of them is about the assertion. **None is about the fixture.** N1 says "assert the set is non-empty"; nothing says "assert the set contains an instance that would fail." That is the gap, and it is the same shape as N8 one level up.

Second, smaller: **a component rendered in isolation proves nothing about its call sites** (H-1). §8.2 says "enumerate every one — never claim it", and I enumerated them in a docstring instead of in assertions.

---

## 12 · Time

2026-08-11 IST — single session, no `/clear`. Recon → plan-commit → execute → cascade → revert → fix rounds → PR.
