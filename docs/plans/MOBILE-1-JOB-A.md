# MOBILE-1 · Job A — the (auth) header pass and the focus-mode row

> **Status:** reviewed — all seven open questions ruled 2026-09-07 (see Rulings). Phase 2 **not started**.
> **Date:** 2026-09-07
> **Author:** Hrishikesh + Claude Code (Phase 1 tab)
> **Critical-path?** **no** — no auth logic, no `src/server/`, no schema, no migration. ⚠ But it edits the shell header that **every** route mounts, and it **inverts a shipped test guard**. Full plan-then-execute ritual by instruction, not by §1 trigger.
> **Plan PR / commit:** branch `feat/mobile-1-job-a`, cut off `origin/main` `b80afbc`. This plan is **commit 1**; items 1 + 3 + guard + docblock are **commit 2**. One PR.

---

## Tracker context

No tracker row. MOBILE-1 is ad hoc, owned by this pod directly (ADR-0045 header;
ADR-0048 header: *"MOBILE-1 (continuation; ad hoc, no tracker row)"*).

**Frame document:** `docs/adr/0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md`,
accepted 2026-09-07, merged as PR #495 (`origin/main` `b80afbc`).

**Declared dependencies and their status at plan time:**

| Dependency | Status |
|---|---|
| ADR-0048 ratified and on `main` | ✅ `b80afbc`, verified by `git show origin/main:docs/adr/0048-*.md` |
| ADR-0045 partially superseded, `Superseded-by` link written | ✅ `0045:11` names ADR-0048 and the four superseded sites |
| MOBILE-1 Phase A shipped (`--breakpoint-mobile`, the `mobileResponsive` convention) | ✅ PR #486 `4133338`, live |
| ADR-0048's **same-commit SPEC.2 update** | ⛔ **UNPAID.** The A1 ruling deferred it to **PR #493, which has not merged.** SPEC.2 §0 still reads ceiling `0039` against a live `0048`. ⇒ **Open item OI-2. This job does not write into SPEC.2** (OQ-7). |
| `design-language.md` §1 item 7 redraft | ⛔ **NOT DONE.** `:44`, `:110`, `:258` all still state *"Desktop-only… no responsive variants this phase."* Founder-ruling surface. ⇒ **Open item OI-3. Raised, not absorbed** (OQ-7). |
| `docs/parked.md` MOBILE-1 Block D row | ⚠ Its trigger fires on this job, and item 3 **deepens** it. The row is **updated in commit 2** to record that (OQ-5, OQ-7). |

**Proceeding is justified.** None of the three outstanding items blocks the code:
two are documentation debts belonging to ADR-0048 rather than to Job A, and the
third is a guard-coverage backlog this job records rather than discharges. All
three are surfaced, not absorbed (§5.4).

### ⚠ Two corrections to ADR-0048, recorded here rather than carried

Both are founder-acknowledged authoring errors, **not** staleness — the source
tree has not moved since the RECON base (`git diff --stat 84d5756..HEAD` touches
only two ADR files).

1. **ADR-0048 `:61` cites `(auth)/layout.tsx:189` as the edit site. It is `:167`.**
   `:189` is `{children}` inside `<PageContainer preset="auth">`, identical at
   `84d5756`. Fenced by symbol per O-8: **the `<GlobalHeader>` mount in
   `src/app/(auth)/layout.tsx`**; `:167` is evidence, not the fence.
   ⇒ **The ADR on `main` carries the bad citation and needs its own patch record.
   That is a separate job, not this one** (**OI-1**). ADR bodies are immutable;
   a patch record is the sanctioned repair (§5.12).
2. **ADR-0048's same-commit SPEC.2 obligation is unpaid** — see the table above.

---

## Approach

Two of ADR-0048's four measured items, both additive `max-mobile:` work under the
existing 640px tier. **Item 1** passes `mobileResponsive` at the `(auth)` layout's
`<GlobalHeader>` mount, which is one line and reaches `/sign-in`, `/sign-in/otp`
and `/onboarding` together. **Item 3** turns `PostFocusHeader`'s image-plus-text
row into a column below 640px, following the `max-mobile:flex-col` pattern
`DebateView.tsx:1040/:1235` and `MarketHeader.tsx:290` already carry, and releases
the image arms' **width** — not their shrink — per `MarketMediaPanel.tsx:128`'s
precedent. The one shipped assertion item 1 contradicts is **inverted, never
deleted**, and the false doctrine its file records is rewritten in the same
commit. Everything measurable is verified on a production build against the
staging database; the one case that cannot be measured ships as a **construction
argument, not measured**, and says so in those words.

---

## 1. Thesis invariants touched

| Invariant | Touched? | How the plan preserves it | Test assertion |
|---|---|---|---|
| 2.1 Bet ↔ comment atomicity | **no** | No write path. Both changes are CSS class strings on presentational components; no server module, no transaction, no DTO. | n/a |
| 2.2 Dharma non-transferable | **no** | `DharmaCluster` is read-only and this job does not open it. `(auth)` passes no `spendable`, so it renders `null` there before and after. | n/a |
| 2.3 Side frozen at comment-time | **no** | `PostFocusHeader` reads `post.sideAtPostTime` and renders it; the change is layout axis only. No side is computed, stored or re-read. | n/a |
| 2.4 Resolutions append-only | **no** | No resolution surface touched. | n/a |

**Not a critical-path task**, so the per-invariant failure-mode paragraph does not
apply. ⚠ The one property this job *can* break is not an invariant but a **guard
polarity** — see §5 F-4 and §7.

---

## 2. Data model changes

**None** — presentational change. No schema, no migration, no `drizzle/`, no
`src/db/`. Migration head stays `0026_lots_no_delete`.

## 3. API surface

**None** — no route handler, no Server Action, no read model. `src/server/**` is
not opened. ⚠ `@code-reviewer` is invoked anyway, by ruling (OQ-6b) — see §7.

---

## 4. UI / user flow

### Item 1 — `(auth)` opts into the phone tier

**Edit site, fenced by symbol (O-8):** the `<GlobalHeader …/>` mount in
`src/app/(auth)/layout.tsx`. Evidence only: `:167`. (See the correction above.)

```diff
- <GlobalHeader viewer={viewer} stars={stars} />
+ <GlobalHeader viewer={viewer} stars={stars} mobileResponsive />
```

**What this switches on, in full.** The prop threads three static hops, and
enumerating them is the point — ADR-0048 names only the first group:

| Site | Class | Effect on `/sign-in`, `/sign-in/otp`, `/onboarding` below 640px |
|---|---|---|
| `GlobalHeader.tsx:207` | `max-mobile:hidden` | Radio + GitHub-stars wrapper drops |
| `GlobalHeader.tsx:233` | `max-mobile:hidden` | register divider drops |
| `BrandCluster.tsx:88` | `max-mobile:hidden` | wordmark + countdown text block drops (the 48px mark stays, linked) |
| `VisitorCounter.tsx:100` | `max-mobile:hidden` | visitor counter drops |
| `OnboardingDeck.tsx:220` | `max-mobile:max-w-[calc(100vw-24px)]`, `max-mobile:p-4` | **the RULES re-show deck reflows on auth routes** |
| `OnboardingDeck.tsx:258` | `max-mobile:pr-6` | same — the close-button clearance |

✅ **FOUNDER-RATIFIED, not a side effect.** Hrishikesh ruled 2026-09-07 that the
deck reflowing on the three auth routes **is accepted and intended**. It reaches
`(auth)` through `GlobalHeader.tsx:212 → RulesControl → OnboardingDeck`, and no
test reddens, because `header-mobile::OnboardingDeck-carries-NO-ungated-breakpoint-class`
is an **absence** scan (`docs/parked.md:100-107` says so in terms). Recorded here
as a ratified consequence so a later reader does not re-open it as an oversight.

**What stays visible at every width, unchanged:** `HeaderNav`, `RulesControl`,
`BrandCluster`'s mark, `DharmaCluster`, `IdentityCluster` — including the **JOIN
CTA**, which is now correct rather than merely untouched: ADR-0048's whole point
is that a phone participant may join. `IdentityCluster.tsx` still carries **zero**
responsive tokens and this job adds none.

**Construction support, independent of measurement.** `(auth)` passes no
`portfolio` and no `spendable`; `DharmaCluster.tsx:74` returns `null` when
`spendable === null`, so that cluster renders nothing on all three auth routes
while `(public)` renders it. ⚠ **This is not a general subset claim** —
`IdentityCluster` genuinely *differs* between `/sign-in` (JOIN CTA) and
`/onboarding` (pseudonym + avatar). Corroboration for one cluster, not a
substitute for §7's measurement.

**Zero desktop regression is structural, not measured:** every class involved is
`max-mobile:`-prefixed and therefore inert at ≥640px. This job adds **no
unprefixed class anywhere**, which §7 asserts directly.

### Item 3 — the focus-mode row becomes a column

**Edit site, fenced by symbol:** the `.hleft` row inside `<Card>` in
`src/components/debate/PostFocusHeader.tsx` — the `<div>` whose className is
`"flex min-h-0 flex-1 gap-4"`, and the two image arms inside it. Evidence:
`:136`, `:158`, `:162`. ✅ All three verified correct at HEAD.

**Certain — ships regardless of measurement:**

```diff
- <div className="flex min-h-0 flex-1 gap-4">
+ <div className="flex min-h-0 flex-1 gap-4 max-mobile:flex-col">
```

Identical to `DebateView.tsx:1040`, `:1235` and `MarketHeader.tsx:290`. One
appended token, override-never-replace (ADR-0045's surviving convention).

#### The image arms — ruled: release the WIDTH, not the shrink (OQ-2)

ADR-0048 `:63` prescribes releasing `shrink-0`. **Overruled by measurement-first
reasoning, ratified 2026-09-07.** Once the row is a column:

- `shrink-0` becomes main-axis-**vertical**, and nothing above imposes a definite
  height below 640px — `DebateView.tsx:977` carries `max-mobile:h-auto
  max-mobile:overflow-visible`, and `HeadZone`'s post arm selects
  `BAND_CONTENT_SIZED`, which declares neither `basis-[24.2dvh]` nor
  `overflow-hidden`. The release is plausibly **inert**.
- `:162`'s width in column mode is decided by `self-stretch` + `w-auto`: the cross
  axis is now horizontal, `width:auto` permits the stretch, the box fills the
  column, and `aspect-[16/9]` derives the height from it.
- Phase A's own answer to the identical shape is `MarketMediaPanel.tsx:128` —
  `aspect-[16/9] w-1/3 shrink-0 self-start … max-mobile:w-full`. It releases the
  **width**.
- **`max-mobile:w-full` already ships in the built stylesheet; `max-mobile:shrink`
  would be a new token exposed to the stale-utility trap (F-1).** That is the
  decisive argument and it was ruled decisive.

**⛔ PHASE 2 DECISION RULE — bounded to two outcomes, no third:**

| R1 result on `:162` with `max-mobile:flex-col` alone | Ships |
|---|---|
| zero overflowing / escaping descendants | **`max-mobile:flex-col` alone.** No arm token. (§5.2 — ship the minimum.) |
| any overflow persists | **`max-mobile:flex-col` + `max-mobile:w-full` on `:162`.** |

`:158` receives **whatever `:162` receives**, by symmetry. ⚠ That is a token
chosen from a measurement of a **different element** — stated because it is a real
weakness, not smoothed over (self-critique #13).

#### ⚠ `:158`, the real-image arm — CONSTRUCTION ARGUMENT, NOT MEASURED

**Founder ruling (OQ-4a), 2026-09-07: DECLINED.** Hrishikesh will attach a real
image to a staging post **later, not before this merges**. No staging post carries
an attachment today, so this arm ships without measurement.

⛔ **The required wording, in this plan and in the PR body: "construction
argument, not measured." Never "verified." Never "expected to work."**

**The argument, stated so a later measurement has something to close (OI-4):**

`:158` is `<div className="shrink-0">` wrapping `CommentImage`, which renders
`block w-fit` around an `<img>` carrying `max-w-full max-h-[var(--imgmax)]`
(`CommentImage.tsx:72,104-105`). Its own docblock at `:97-98` records that
`max-w-full` *"resolves against a box that is itself sized by this image"* — which
is why the pair does not bound the image in **row** mode, where `shrink-0` leaves
the arm at max-content.

⚠ **In column mode the reasoning points the other way, and that is exactly when it
must not be upgraded to a verification.** `w-fit` is `width: fit-content`, which
clamps to the **available** width; in a column with `align-items: stretch` the
available width is the column, so the inner box would be bounded and `max-w-full`
would then bind against a definite parent. **That is a construction argument for
the fix working, built on the same mechanism the row-mode analysis says fails —
and neither reading has been observed on this surface.** Recorded both ways, with
no verdict.

**Closes when:** a staging post carries a real attachment and R1 is re-run against
`/m/<slug>?post=N` for that post. Until then, OI-4 stands open.

#### ✅ Presentation change — FOUNDER-RATIFIED

In column mode the placeholder stops being a 147px height-driven box beside the
text and becomes a **full-width ~16:9 banner above it** (~285×160px at 375). This
is what `MarketMediaPanel` already does on the market arm at phone width.
**Hrishikesh ratified this 2026-09-07.** Recorded as a decision, not as a side
effect of a fix.

---

## 5. Failure modes

| # | Failure | Detect | Recover |
|---|---|---|---|
| **F-1** | **Stale compiled stylesheet.** A `max-mobile:` utility present in source and in the DOM but absent from the built CSS reproduces the exact before-state, and the measurement is then ambiguous between *"my fix does not work"* and *"my CSS never built"* (AGENTS.md §9; Phase A hit this twice, Phase B reproduced it). | §7's two-part probe: static grep of **`.next/static/chunks/*.css`** for the **escaped class selector**, plus the in-page injection probe reading back `flexDirection`. ⚠ **Corrected at Phase 2 — this cell said `.next/static/css/*.css`, which does not exist in this build.** | `just clean` then rebuild. A hard reload and a dev-server restart do **not** clear it. |
| **F-2** | **Document-level probe reports green on item 3 by construction.** `Card`'s base `overflow-hidden` (`ui/card.tsx:16`) clips *inside* the card, so `documentElement.scrollWidth` stays exactly 0. | §7 R1 measures the **clipping ancestor** — `[data-slot="card"]` — and its descendants' `scrollWidth` vs `clientWidth`, never the document. | n/a — this is the design of the check, not a repair path. |
| **F-3** | **The measurement runs on an un-revealed page.** A CDP-driven tab is `document.hidden`, React 19's `$RC` reveal is rAF-gated, and every box reads `0×0` with no error. | Assert `document.querySelectorAll('div[hidden][id^="S:"]').length` before and after the hand-reveal; assert `stillHidden === 0`; assert a **non-zero box on the element being measured**. | Perform `$RC`'s DOM operation, matching the pending-marker **set** `{"$?", "$~"}` — `$~` alone is what silently revealed nothing at BLOCK-5a. |
| **F-4** | ⛔ **The inverted guard is inverted wrongly, in the passing direction.** A naive flip to `.toMatch(/\bmobileResponsive\b/)` on the `(auth)` tag **also passes on `mobileResponsive={false}`** — i.e. on a tree where item 1 has been reverted. | §7 asserts both halves: the token is present **and** the tag does not match `mobileResponsive=\{(false\|undefined)\}`. | Fix in-session before PR (§5.10 FAIL). |
| **F-5** | **`global-header-mobile-reflow.test.ts:983–990` swept with the rest.** It looks like a Phase A pin and is **D-4**: a signed-out visitor writing the completion marker would suppress their own first-login deck. | Run the file before and after and diff the **passing test-name list**, not the count. Exactly one name may change behaviour. | Restore; it is untouched by design. |
| **F-6** | **Desktop regression on `(auth)`.** A class added without a `max-mobile:` prefix reaches ≥640px. | §7 scans the diff for any added class token lacking the `max-mobile:` prefix; and re-measures `/sign-in` at 1440px against the pre-change render. | Revert the token. |
| **F-7** | **The item-3 "after" green is vacuous** — a post with a short title and no image satisfies "0 elements overflow" trivially. | §7 R4 pins **which staging post** was measured, by slug and `?post=` index, and requires the worst available (longest title, most footblock content). Recorded in the PR body. | Re-measure against a worse post. |
| **F-8** | ⚠ **The rotation test looks like a Job A failure and is not.** A 375×812 phone in **landscape is 812px wide** — above the 640px tier and inside ADR-0048's **ratified 641–860px accepted gap**. | Stated up front in the runbook handed to the operator, with the expected reading: portrait must be clean, landscape is the known gap. | Nothing to fix. Do not "repair" it — that is a new breakpoint and ADR-0048 mints none. |
| **F-9** | **`/onboarding` is unreachable to measure** — it needs a signed-in, not-yet-onboarded viewer, and a signed-out hit likely redirects. | Attempt it on the rig; record the outcome either way. | Fall back to the header element's own `scrollWidth` on the two reachable routes plus §4's construction support, and **say in the PR body that `/onboarding` was not directly measured.** Do not report three routes verified when two were. |
| **F-10** | ⚠ **`@code-reviewer` returns a clean pass on a scope it was not built for.** Its briefing is *"diff under `src/server/`"*; this diff touches none. An empty or clean return is **NOT ESTABLISHED** (O-13), not clearance. | Pass `@docs/plans/MOBILE-1-JOB-A.md` (§5.11 mandates it) and state in the invocation that the diff is UI + test + docs. Record what it was asked and what it answered. | Treat silence as silence. Do not report it as a review pass. |

---

## 6. Edge cases

- **Removed focused post.** `PostFocusHeader.tsx:146` gates **both** image arms on
  `!post.removed`, so the column has a single child and `max-mobile:flex-col` is
  effectively inert. Must still render correctly; `RemovedPlaceholder` + `SideBadge`
  only.
- **Focused post with no image.** The `:162` placeholder arm — the only arm any
  staging post exercises today. **This is what R1 measures.**
- **Focused post with a real image.** The `:158` arm. **Not measured — OI-4.**
- **Exactly 640px.** `--breakpoint-mobile: 640px`; `max-mobile:` is `<640`, so at
  640.0 the desktop rules apply. Nothing straddles.
- **641–860px.** Ratified accepted gap. At 641 the `(auth)` header returns to its
  ungated 754px min-content. **Not fixed here.**
- **Phone landscape.** See F-8 — lands in the gap.
- **`--breakpoint-mobile` vs `sm`.** Equal only at a 16px root font size
  (AGENTS.md §8). This job adds no `sm:` rule, so no hand-off exists to get wrong.
- **`/sign-in/otp` with a pending OTP.** Same header, different card; the card
  already reflows to 343px per ADR-0048.
- **Signed-in viewer on `(auth)`.** `/onboarding` renders `IdentityCluster` with an
  identity rather than the JOIN CTA — a different, likely narrower row.

---

## 7. Test plan

| Layer | Scenarios | Invariants asserted (§1) |
|---|---|---|
| **Unit — source scan** (`tests/unit/shell/global-header-mobile-reflow.test.ts`) | **Invert** `header-mobile::ONLY-the-public-layout-mount-passes-mobileResponsive` (`:396–430`); rename to state what it now asserts. **Two halves, both required (F-4):** `(auth)`'s `<GlobalHeader>` tag matches `\bmobileResponsive\b` **and** does not match `mobileResponsive=\{(false\|undefined)\}`. `(public)`'s half unchanged. **Inverted, never deleted** (WARLI-MOUNT precedent). | none — no invariant reachable |
| **Unit — source scan** (`tests/unit/design/debate-mobile-reflow.test.ts`) | Item 3's guard. **Ruled scope: `PostFocusHeader.tsx` ONLY** (OQ-5). Open that file by name and pin `max-mobile:flex-col` on the `.hleft` row, plus whatever the arms receive under the §4 decision rule. ⛔ **Do NOT open `MarketHeader.tsx`.** | none |
| **Unit — regression, unchanged** | `tests/unit/debate/render/comment-image.test.tsx`'s `comment-image::the-image-slot-does-not-grow-and-is-absent-when-there-is-none` uses `.toContain("shrink-0")` — a **substring** check that stays green under every §4 outcome. ⚠ Recorded because that is a green that proves nothing here, not one that clears the change. | none |
| **Unit — full suite** | `pnpm vitest run tests/unit/` before and after; diff the **passing test-name list**, not the count. Exactly one name may change behaviour (F-5). | none |
| **Integration** | **None** — no service-layer function, no DB write, no read model. | n/a |
| **E2E** | **None installed** (no Playwright, AGENTS.md §9). | n/a |
| **Subagent review** | `@code-reviewer`, **by ruling** (OQ-6b) — §5.11's table is a floor, not a ceiling. Pass `@docs/plans/MOBILE-1-JOB-A.md`. See F-10 for how to read its answer. | n/a |
| **Browser measurement** — *not a runner; the only layer that can see any of this* | The four ADR-0048 requirements, below. | n/a |

### Gate

`ZUGZWANG_ENV=preview just verify` (typecheck → biome → next build) plus
`pnpm vitest run tests/unit/`. **Not a critical-path task**, so `pnpm
test:invariants` / `test:integration` are not required by §5.7 — and are untouched
by a className diff. §5.10's pre-PR self-audit runs anyway, by instruction.

### Browser measurement — the rig (ruled Q3)

`just clean`, then a **production build against the staging database**, served
locally and reachable on the LAN.

```bash
just clean
doppler run --project zugzwang-experiment --config stg -- \
  env ZUGZWANG_ENV=preview pnpm next build
```

then the existing `.claude/launch.json` `zugzwang-prod-staging-db` configuration
(`next start -H 0.0.0.0`, port 3000).

⚠ **That config runs `next start` only — it does not build.** The build above is
mandatory and must follow `just clean` in the same sequence, or requirement 2 is
being measured against whatever `.next/` happened to survive. ⚠ `launch.json` is
**untracked and unproven** (O-6, declared at recon); if the build fails under the
`stg` Doppler config, that is the first thing to fix, before any measurement.

### R1 · Measure inside the card, never the document

For focus mode: locate the `[data-slot="card"]` ancestor of
`[data-testid="post-focus-foot"]`. Report, **before and after**:

- the card's `getBoundingClientRect()`;
- every descendant with `scrollWidth > clientWidth` — count and list;
- every descendant whose `right` exceeds the card's `right` (the *escaping* set;
  ADR-0048 measured two: the `Counter` button cut 24px, the `Exited` badge cut 33px).

**Pass = both sets empty after.** ⛔ `documentElement.scrollWidth` is recorded for
the record and is **not** a pass criterion for item 3. **R1's `:162` result also
drives the §4 decision rule.**

For item 1 the document-level figure **is** the right measure (the header escapes
no clipping ancestor): `documentElement.scrollWidth - clientWidth` at 375px on
`/sign-in`, `/sign-in/otp` and — if reachable (F-9) — `/onboarding`.

### R2 · Verify the utilities in the BUILT stylesheet, by class name

```bash
# static — the escaped selector, in the emitted CSS. Never `640px`, never `coarse`.
grep -o 'max-mobile\\:[a-zA-Z0-9\\.:_-]*' .next/static/chunks/*.css | sort -u
```

⛔ **`chunks/`, NOT `css/` — corrected at Phase 2, and the correction is worth
more than the path.** This command was written as `.next/static/css/*.css`, a
directory **Next 16 with Turbopack does not create**: the app stylesheet is
emitted alongside the JS chunks. So the documented command matched no files and
printed nothing — **and nothing is exactly what a clean pass looks like on a
grep.** ⚠ That is the **O-13** shape landing on the one check written to catch
the failure that shipped Phase A inert twice: an instruction that cannot answer,
read as the answer. Run it and confirm it returns a **non-empty** list; a silent
zero here means the path is wrong, not that the utility is absent.

⚠ **The repo already knew.** `scripts/chart-6-contact-sheet.tsx:87` carries the
identical warning — *"`.next/static/chunks/`, NOT `.next/static/css/`"* — logged
under **O-3** after the same lookup reported "run pnpm build first" on a tree
that had just been built. Neither `CLAUDE.md` nor `AGENTS.md` records the path,
so the knowledge sat in one script and this plan re-derived the bug.

```js
// runtime, at 375px — AGENTS.md §9's probe
const p = document.createElement("div");
p.className = "flex max-mobile:flex-col";
document.body.appendChild(p);
getComputedStyle(p).flexDirection;   // "column" = compiled · "row" = NOT compiled
```

⛔ **Honest statement of what this proves for THIS job: nothing.** After the OQ-2
ruling, **every** token this job can ship already exists in the built stylesheet —
`max-mobile:flex-col` via `DebateView`/`MarketHeader`, `max-mobile:w-full` via
`MarketMediaPanel`, and item 1 mints no utility at all. **The probe is incapable
of failing on this diff.** It is run because ADR-0048 requires it and because it is
nearly free, and it will be reported as **discharged by construction, zero
assurance** — never as *"R2 passed."*

### R3 · The rotation test — operator, real phone

`http://<mac-LAN-ip>:3000` over the same network (Mac firewall must permit inbound
3000). Portrait `/sign-in` and `/m/<slug>?post=N`, then rotate.

⛔ **Expected reading, stated in advance (F-8): portrait must be clean; landscape
will look wrong and that is the ratified 641–860px accepted gap, not a Job A
defect.** Do not repair it.

### R4 · Measure against content that exercises the failing path

- **Focus mode, not list view.** `/m/<slug>?post=N` — the param is an **index**;
  the exact slug and index are discovered on the rig and **recorded in the PR
  body**, not assumed.
- **The worst available post**, not the first (F-7): longest title, most footblock
  content. Recorded by slug + index.
- ⛔ **Re-take the BEFORE measurement on this rig.** ADR-0048's `+379px`, `754px`
  min-content, `8` overflowing and `2` escaping come from RECON's rig. The tree has
  not moved, so they should reproduce — but a before/after pair drawn from two
  different rigs is not a comparison. Reproduce them, and **report divergence
  rather than adopting RECON's numbers**.

### Standing browser-harness discipline (AGENTS.md §9), applied

- Pin the frame **in-page** — a same-origin iframe at `375px` with
  `position:fixed; max-width:none; min-width:0`, and **throw** unless
  `contentWindow.innerWidth === 375`. Not the OS window.
- `await document.fonts.ready`, confirm `document.fonts.status === "loaded"` and
  `fonts.check('12px Geist')` before reading any box.
- Inject `*,*::before,*::after{animation:none!important;transition:none!important}`.
- **Snapshot every `getComputedStyle` value to a string at the instant it is
  valid** — the declaration is live and re-resolves on each read.
- Complete the Suspense boundaries by hand (F-3), matching `{"$?", "$~"}`.

---

## 8. Out of scope

- **ADR-0048 item 2 — `PositionsTable` on `/u/[pseudonym]`.** A separate job. It
  needs a genuine narrow presentation, not a width tweak.
- **ADR-0048 item 4 — `/legal`.** Measured at 0px overflow, zero offenders.
- **The 641–860px band.** Ratified accepted gap. No new breakpoint is minted here.
- **Path (ii), deleting the `mobileResponsive` prop.** ADR-0048 `:84` rejects it for
  now: five files, ~8 assertions including three `= false` default pins.
- **⛔ `MarketHeader.tsx`.** Not opened, by ruling (OQ-5). The string-vs-file
  coincidence `docs/parked.md:91-98` records stays open; this job **records that it
  deepens** rather than discharging it.
- **The other 25 `SPEC.1 §21.9` citations** across `src/` and `tests/`. Reported as
  a separate job (OI-5); **not touched**.
- **⛔ `SPEC.2`.** Not written into, by ruling (OQ-7). It resolves if PR #493 merges
  and is recorded against ADR-0048 (OI-2), not against this job.
- **`design-language.md` §1.7 / §2.4 / §7.** Founder-ruling surface — raised
  (OI-3), not absorbed. ⚠ O-9 consequence: because §1.7 is **not** redrafted here,
  the rewritten docblock must **not** cite it as live doctrine.
- **ADR-0048's own patch record** for the `:189` citation (OI-1).
- **PR #487's disposition.** Founder ruled: leave open, delete later. ⚠ It is
  `MERGEABLE`, CI-green, and there is no branch protection — an accidental merge
  would silently kill mobile signup. Recorded, not acted on.
- **`global-header-mobile-reflow.test.ts:983–990`.** D-4, not a Phase A pin.
  **Untouched by design**, and named in the commit body so a later reader does not
  read its survival as an oversight.
- **The Discovery hero.** Stays hidden below 640px per the Phase A founder ruling.

---

## Rulings — all seven, received 2026-09-07

| # | Ruling | Effect on this plan |
|---|---|---|
| **OQ-1** | **APPROVED.** One branch `feat/mobile-1-job-a` off `origin/main`; plan as commit 1, code as commit 2, one PR. Nothing lands on the merged branch. | Header; branch cut at `b80afbc`; this file moved off `feat/adr-0048-phone-responsive-auth`. |
| **OQ-2** | **APPROVED, measurement decides.** `max-mobile:flex-col` certain. Release the **WIDTH**, not the shrink — follow `MarketMediaPanel.tsx:128`. Prefer `max-mobile:w-full` over `max-mobile:shrink`; the built-sheet argument is decisive. Measure R1 first, then pick. | §4 decision rule; §7 R1/R2. |
| **OQ-3** | **APPROVED.** Keep the doctrine, re-attribute to **ADR-0037 + the file's own assertions**, drop the dead `§`. The operative fact is that D-29 **removed** the ruling rather than relocating it. Report the other 25 sites; do not touch them. | Docblock rewrite; §8; OI-5. |
| **OQ-4** | **(a) DECLINED by the founder** — no staging image before merge; `:158` ships **"construction argument, not measured"**, in those words. **(b) signed-in focus view: measure before merge. (c) replies: recorded as unmeasured.** | §4 `:158`; §6; OI-4; §7 R4. |
| **OQ-5** | **OVERRULED.** Pin `PostFocusHeader` **only**. Do not open `MarketHeader.tsx` — *"the trigger authorises it" is how a two-item job becomes three.* Update the parked row to record that Job A **deepens** it instead. | §7 guard row; §8; parked.md rides in commit 2. |
| **OQ-6** | **(a) APPROVED** — all three sites inside the edited file (`:5–89`, `:425–428`, `:894–896`); report the four component prop docblocks, do not open them. **(b) OVERRULED — DO invoke `@code-reviewer`.** §5.11 is a floor, not a ceiling. | §7 subagent row; F-10; §8. |
| **OQ-7** | **APPROVED.** `parked.md` rides. `design-language` §1.7 — raise, do not absorb. **SPEC.2 — leave it**; resolves via PR #493, recorded against ADR-0048. | Tracker table; §8; OI-2, OI-3. |
| **Founder 1** | **RATIFIED** — the RULES deck reflowing on the three auth routes is accepted and intended. | §4 item 1, recorded as a decision. |
| **Founder 2** | **RATIFIED** — the focus-mode image becoming a full-width ~16:9 banner above the argument is accepted. | §4 item 3, recorded as a decision. |

## Open items carried out of this plan

Each is named so it can be closed by someone other than this job.

- **OI-1 · ADR-0048 needs a patch record** for the `(auth)/layout.tsx:189` →
  `:167` citation. ADR bodies are immutable; §5.12 sanctions the patch record.
  **Owner: separate job.**
- **OI-2 · ADR-0048's same-commit SPEC.2 update is unpaid.** Deferred by the A1
  ruling to **PR #493, unmerged**. SPEC.2 §0 still reads ceiling `0039`.
  **Closes when PR #493 merges.** This job writes nothing into SPEC.2.
- **OI-3 · `design-language.md` §1.7 / §2.4 / §7** still state *"Desktop-only… no
  responsive variants."* ADR-0048 `:134` says redraft, not ratify-as-written.
  **Founder-ruling surface.**
- **OI-4 · `PostFocusHeader.tsx:158` is unmeasured.** Closes when a staging post
  carries a real image attachment and R1 is re-run against
  `/m/<slug>?post=N` for it. Until then the arm ships on a **construction
  argument, not measured**.
- **OI-5 · 25 remaining `SPEC.1 §21.9` citations** across `src/` and `tests/` have
  no live target — D-29 removed the ruling rather than relocating it. **Separate
  job.**
- **OI-6 · `docs/parked.md`'s MOBILE-1 Block D coverage backlog** is deepened, not
  discharged: `PostFocusHeader.tsx` becomes a third file carrying
  `max-mobile:flex-col` guarded only by a string scan. Recorded in commit 2.

- **OI-7 · Five `src/` passages still state ADR-0045's superseded "gated, not
  made responsive" position.** ⚠ **This item exists because OQ-6a was ruled on a
  wrong inventory and has been RE-RULED** (2026-09-07, Phase 2). The original
  ruling deferred *"the four component prop docblocks"*; the real surface is
  **seven passages across four files, three of which are not prop docblocks** —
  so a later job discharging OQ-6a literally would have left three behind. The
  corrected inventory, measured at Phase 2 and **stated here so nobody re-derives
  it**:

  | # | Site | Kind | Status |
  |--:|---|---|---|
  | 1 | `src/components/onboarding/OnboardingDeck.tsx` — the inline `//` above the `cn()` call | inline comment | ✅ **FIXED in commit 2** |
  | 2 | `src/components/shell/GlobalHeader.tsx:32` (block `:29-35`) | **component** docblock | deferred |
  | 3 | `src/components/shell/GlobalHeader.tsx:181,183` (block `:178-187`) | prop docblock | deferred |
  | 4 | `src/components/shell/RulesControl.tsx:63` (block `:57-66`) | prop docblock | deferred |
  | 5 | `src/components/onboarding/OnboardingDeck.tsx:59` (block `:53-62`) | **component** docblock | deferred |
  | 6 | `src/components/onboarding/OnboardingDeck.tsx:107-108` (block `:101-112`) | prop docblock | deferred |
  | 7 | `BrandCluster.tsx:48-50` · `VisitorCounter.tsx:39-41` | pointer docblocks | **no edit owed** — they say only *"see `GlobalHeader`'s own prop docblock"*, so they state no position and self-correct once #3 lands |

  **Why #1 was fixed and the rest were not.** It sits **directly above the `cn()`
  call whose `max-mobile:` classes now reach `(auth)` by founder ruling, and it
  said they must not** — a false record at an operative site, immediately above
  changed behaviour. That is O-5's exact shape and the same defect ADR-0048 `:88`
  names one file over. The other five are docblocks describing the mechanism
  rather than gating it; they are false, but nothing reads them at the moment a
  class is applied.

  ⛔ **Every one of the five asserts something the tree now contradicts** —
  *"`(auth)/layout.tsx` passes nothing"*, *"renders BYTE-IDENTICAL to before this
  task"*, *"stays governed by §1.7 as originally written"*. **Do not repair them
  by deleting the `mobileResponsive` prop**: ADR-0048 `:84` weighs that (path
  (ii)) and rejects it, and the `= false` default still protects a future third
  mount. The repair is to restate which mounts opt in, not to remove the gate.
  ⚠ `AGENTS.md:375` stated the same superseded position and **was** fixed in
  commit 2 — no ruling covered it, and it loads in full every session.
  **Owner: separate job.**

## ADRs needed

**None.** ADR-0048 is the decision and it is ratified. Item 1 takes its prescribed
path (i); item 3 takes its prescribed pattern. **The one divergence from the ADR's
letter — releasing width rather than shrink — was ruled by the founder on this
plan's reasoning, so it needs no new ADR.** If it is to be written back to the ADR
at all, that is a *Patch record* scoping the consumer surface (§5.12), folded into
OI-1's pass rather than minted here.

---

## Self-critique (after Phase 1 self-review, re-run against the finalised plan)

Fifteen findings. Six survive the rulings as live risks; nine are recorded as
resolved and are **not deleted** — Phase 2 should see what was considered.

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | **high** | **The plan's central verification depends on a rig that has never been run.** `.claude/launch.json` is untracked, unproven, arrived unbidden (O-6). If `next build` fails under the `stg` Doppler config — plausible, given AGENTS.md's `BETTER_AUTH_URL`-fails-at-build-time gotcha — the whole §7 browser layer stalls, and the only fallback is a dev server, which is precisely the rig requirement 2 forbids. | **LIVE.** Sequenced first in §7 and named as the first thing to fix. Single point of failure; no second rig. Accepted, surfaced. |
| 2 | high → **resolved** | The item-3 "after" green is trivially satisfiable by a short post with no image — requirement 4 applied only to the *before* state, reappearing inside the check written to prevent it. | Addressed: F-7 + R4 pin the measured post by slug + index and require the worst available. |
| 3 | **high** | **R2 cannot fail on this diff, and after the OQ-2 ruling that is now certain rather than likely.** Every shippable token already exists in the built sheet. Reporting *"R2 passed"* would be an overstatement of the kind O-13 exists to catch. | **LIVE, and sharpened by the ruling.** §7 R2 states it in terms and reports the requirement as *discharged by construction, zero assurance*. The finding is the honesty, not a fix. |
| 4 | high → **medium** | The plan was not fully executable: OQ-2 left a decision point inside Phase 2. | Downgraded. The ruling bounded it to a **two-outcome decision rule** with named tokens (§4). A bounded rule in a plan is not a hole; an open choice would have been. |
| 5 | medium | **Not one of ADR-0048's measurements was re-taken.** `+379px`, `754px`, `8`, `2` are inherited from RECON. The tree has not moved, which makes them *likely* reproducible, not *verified* — O-2's shape one register over. | Addressed in R4: the before-state is re-taken on the same rig as the after-state, and divergence is reported rather than reconciled away. |
| 6 | **medium** | **The docblock rewrite is unguarded prose.** Nothing reddens if it drifts again — which is how it became a false record in the first place. This job fixes the instance, not the class. | **LIVE.** Accepted. A guard over a docblock's *content* is a larger idea than this job and probably a bad one. Named so it is not read as fixed. |
| 7 | medium → **resolved** | OQ-5's wider option was "while we're here" unless the parked trigger authorised it — and the trigger's plain reading covers `PostFocusHeader`, not `MarketHeader`. | Resolved by the OQ-5 overrule, on exactly that reasoning. The coincidence is recorded (OI-6), not fixed. |
| 8 | **medium** | **F-9 may take one of item 1's three routes out of the measurement**, leaving this plan claiming three routes fixed from two readings — the same generalisation ADR-0048 made from one, one iteration on. | **LIVE.** F-9's fallback measures the header element itself, and the PR body must name which routes were *directly* measured. |
| 9 | low → **resolved** | "Strict subset" overstated the evidence: `IdentityCluster` genuinely differs between `/sign-in` and `/onboarding`. | Corrected in §4 — the claim is now scoped to `DharmaCluster` and labelled construction support. |
| 10 | low → **resolved** | The plan formed a product opinion ("almost certainly wanted") about a founder-ruled surface. | Resolved: both consequences are now **founder-ratified decisions** recorded in §4, not executor inferences. |
| 11 | **high** | **`@code-reviewer` is being invoked outside its briefing.** Its description is *"diff under `src/server/`"*; this diff touches none. A clean return would be a pass on a scope it was not built for, and O-13 says an answer that could not have seen the thing is **NOT ESTABLISHED**, not corroboration. ⚠ The ruling to invoke it is right — the risk is in how its answer is read. | **LIVE.** F-10 states the reading rule: pass the plan, state the diff shape, and treat silence as silence. |
| 12 | **medium** | **The `:158` construction argument got *stronger* during finalisation** (`fit-content` clamps to available width), and that is exactly when the language is most likely to drift from *"not measured"* to *"expected to work."* The founder ruled the wording precisely because of this pressure. | **LIVE.** §4 records the argument **both ways with no verdict**, pins the required phrase, and OI-4 names what would close it. The PR body carries the same phrase. |
| 13 | **medium** | **`:158` receives a token chosen from a measurement of `:162`.** The decision rule is honest about the mechanism but the inference is still cross-element: the placeholder and a real image have different intrinsic-width behaviour, which is the whole reason `:158` is unmeasured. | **LIVE.** Stated in §4's decision rule rather than hidden inside it. If R1 clears `:162` with `flex-col` alone, `:158` ships bare — which is the *smaller* claim, so the rule fails safe. |
| 14 | low | **The plan is ~500 lines for a two-token change.** A plan nobody finishes reading is one whose §8 does not constrain Phase 2. | Accepted. The length is concentrated in §5 and §7, which is where this task's failure modes actually live; §8 is short and scannable by design. |
| 15 | **medium** | **The `parked.md` edit asserts something about a file this job deliberately does not open.** Writing *"`PostFocusHeader` becomes a third file carrying `max-mobile:flex-col`"* is a claim about the census at commit time, made without re-running it. | **LIVE, cheap mitigation:** re-run `docs/parked.md`'s own documented census command at commit time and cite the resulting count in the row. Never write the number from this plan. |

⚠ **Where this plan most likely falls apart at runtime:** finding 1 (the rig has
never been run) and finding 11 (a subagent answer read as clearance when it is
silence). Both are named rather than smoothed over, because a plan that reads as
fully settled when it is not is worse than one that says where it stops.

---

## References

- `CLAUDE.md` — §1 (critical paths — this is not one), §5.1/§5.3/§5.4/§5.7/§5.10/§5.11/§5.12/§5.13, §8 (O-2, O-4, O-5, O-6, O-8, O-9, O-13)
- `AGENTS.md` — §8 (the `--breakpoint-mobile` convention and its three rules), §9 (browser measurement — the Suspense reveal, the frame pin, the live `getComputedStyle` declaration, the stale-utility probe), §10 (squash-merge SHAs and the merged-branch trap)
- `docs/adr/0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md` — the frame. ⚠ Its `(auth)/layout.tsx:189` citation is wrong (OI-1)
- `docs/adr/0045-mobile-responsive-browsing-and-auth-gate.md` — partially superseded; the read-surface decision, the 640px token, override-never-replace and the ratified sign-in copy all survive
- `docs/adr/0037` — the onboarding-deck seen-marker cookie; the surviving home of the doctrine SPEC.1 §21.9 used to carry (OQ-3)
- `docs/parked.md:44-116` — MOBILE-1 Phase A, seven unguarded `max-mobile:` tokens; deepened by this job (OI-6)
- `docs/decisions/RECORD-v2.5-amendment.md` — D-29, the SPEC.1 2.0.0 rebaseline
- `docs/specs/SPEC.1.md` §0 — §17–§19 and §21–§23 intentionally absent
- Tracker entry: none — ad hoc, per ADR-0045 and ADR-0048 headers

---

*Plan template lives at `docs/plans/_template.md`.*
