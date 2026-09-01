# ZUGZWANG · WARLI-MOUNT — EXECUTION BRIEF v1.0

**Written:** 2026-08-31 · **Author:** web Claude (orchestrator)
**Ratified by:** Hrishikesh, 2026-08-31 — rulings **O(a) · P(a) · Q(a) · R(a) · S(a)**
**Source of every fact below:** `zz_WARLI-MOUNT-RECON_2026-08-31T1612.md`
(601 lines, md5 `53d87064b525f4fa279a065116cc7974`), measured at `origin/main` = `2d40a68`.

> **Committed verbatim per CLAUDE.md §5.1.** This is the web-authored, operator-ratified
> brief exactly as relayed; the execute surface added nothing to it. What execution
> measured, changed, and found wrong is recorded in `docs/logs/WARLI-MOUNT.md`, never
> by editing this file.

**This is a plan, and it is the plan the ritual requires.** `src/app/(auth)/**` is a
named critical path. Plan-mode-then-execute is not waived — the plan was authored
from a 601-line read-only recon and ratified by the operator before this session
started. Execute it; do not re-plan it. If it is wrong, report and stop.

⛔ **Measure `origin/main` first.** If it is no longer `2d40a68`, re-check that the
`(auth)` layout, the guard at `art-layer-guards.test.ts:250`, and `page-container
.test.ts` site 8 still read as described. If anything moved, report and stop.

---

## 0 · WHAT THIS DOES, AND WHAT IT HONESTLY DOES NOT

Two slices, one branch, one PR, one Gate C.

**Slice 1** discharges `docs/parked.md` WARLI-3 **item 4**, whose conditional
trigger reads *"immediately before any task that mounts the artwork, for item 4
alone."* **Slice 2** mounts the layer on the `(auth)` layout.

⚠ **State the residual plainly in the PR body, because item 4's own listed remedies
do not reach it.** "A static shell, a cached fragment, or a module-level element
hoisted out of the render" all eliminate **build** cost. None of them reduces the
**82 KB of serialized markup** on the wire — that needs fewer elements, which means
changing the artwork, which is WARLI-3's composition pass and is **out of scope**.

| cost | before | after this task |
|---|---|---|
| ≈35 ms server CPU per render | per request | **eliminated** — built once at module scope |
| client rebuild of ~6,861 field elements at hydration | every request | **eliminated** — subtree not hydrated |
| ≈82 KB gzipped markup on the wire | per request | **unchanged. Named as residual.** |

---

## 1 · WALLS

```
⛔ NEVER change the artwork. No element removed, no geometry altered, no seed
   changed. Slice 1 changes WHEN the field is built, never WHAT it draws. A
   pixel-level change is WARLI-3's composition pass and is a different task.

⛔ NEVER edit an existing className string in `src/app/(auth)/layout.tsx`.
   `tests/unit/shell/page-container.test.ts` pins every PageContainer call site by
   EXACT className string; site 8 is this file, pinned as
   `"mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8"`. The mount ADDS a
   sibling node and touches nothing existing. Any reformat or re-wrap of the
   `<PageContainer>` call reddens it.

⛔ NEVER use `absolute` for the mount. Recipe #438 says `absolute inset-0`; the
   `(auth)` layout root is `<div className="flex min-h-dvh flex-col">` and
   contains ZERO `relative` — there is no positioned ancestor. Ruling P(a):
   recipe #433's `fixed` governs.

⛔ NEVER delete `art-layer-guards.test.ts`'s unmounted assertion. Both recipes
   say delete it; the operator ruled Q(a) — INVERT it. Deleting a guard because
   it now fails is the shape this project spent five register passes unlearning.

⛔ NEVER introduce a non-neutral hex. The system is TRUE-NEUTRAL for the whole
   experiment and a CI guard enforces an 11-token census with R=G=B. The layer
   currently uses `var(--color-ink)` / `var(--color-ground)` only.

⛔ NEVER touch PR #435, #437, #444 or #445. All four are open by ruling.
⛔ NEVER push `refs/heads/main` or `refs/heads/staging`. NEVER merge the PR.
⛔ NEVER skip the reviewer cascade. This is auth.
```

**Scope fences** — real, not this task: WARLI-3 items 1–3 (the moat, ring
thickness, asymmetric border) · reducing the element count · `/legal`, which sits
in `(public)` and does not receive the artwork · the pointer/`pointerleave`
behaviour, ruled S(a) leave as built.

---

## 2 · PHASE 0 · GROUND

```
git fetch origin --prune
git worktree add ~/code/zugzwang/warli-mount origin/main
cd ~/code/zugzwang/warli-mount
git switch -c feat/warli-mount
```

`feat/` is load-bearing — the Vercel Ignored Build Step permits `main`, `staging`,
`verify`, `fix/pool-transaction-mode` and `feat/*` only. Verify from the platform.

**A0.1** · Report `origin/main`'s SHA. One revision per `git rev-parse` call.

**A0.2 · IS THE `(auth)` LOCK RELEASED?** `docs/logs/WARLI-1.md:83` says check
before mounting. The auth PRs (#408, #410, #411, #412) reached `main` via
RECONCILE-1, so it is almost certainly clear — **verify rather than assume**.
Report any open PR, unmerged branch or live session touching `src/app/(auth)/**`.
If one exists, **stop and report**; a collision here costs a full cycle.

**A0.3 · BASELINE, before any edit.** Full suite: reporter totals and the complete
test-ID list. ⚠ **Read exit from the LOG, not from the harness** — a background
gate reported `exit code 0` over a failing suite two passes ago. Record
`ps aux | grep -c vitest` at start and end, and state whether the run was contended.

---

## 3 · SLICE 1 · THE FIELD — build once, hydrate never

The field is **86.0% of the drawing**, ~6,861 of 7,978 elements, and is a **pure
function of a fixed seed — it never changes**. `FieldLayer` is neither memoised nor
`React.memo`'d, and `WarliHero` is `"use client"`, so it is built on the server and
again in the browser at hydration.

**1a · MEASURE FIRST, and report before editing.** The three candidate techniques
buy different things and are not interchangeable:

| technique | kills server build | kills client rebuild | reduces wire bytes |
|---|---|---|---|
| module-level hoisted element | ✅ | ❌ | ❌ |
| non-hydrated subtree | ❌ | ✅ | ❌ |
| **both** | ✅ | ✅ | ❌ |

Report which of these `FieldLayer` currently admits given its props and closure —
if it closes over anything per-render, say what, and whether that thing is itself
constant. **If the field turns out NOT to be seed-pure, stop and report.** The
whole slice rests on that claim and it came from a docket row, not a measurement.

**1b · Implement build-elimination only.** Hoist the field's element tree to module
scope so it is constructed once per process, and keep that subtree out of
hydration. Choose the mechanism that the codebase already supports — report which
you chose and the one you rejected, with the reason.

⛔ **Byte-identical output is the acceptance test.** Render the layer before and
after, serialize both, and assert the markup is **identical**. If it differs by one
byte, the optimisation changed the drawing and it is wrong. Show the comparison.

**1c · Measure the win.** Server render time before and after, and whether the
field subtree is present in the hydration payload. Report both figures. If the
measured improvement is under 50%, say so — a change that does not pay is worth
reverting rather than shipping.

Full suite green before Slice 2.

---

## 4 · SLICE 2 · THE MOUNT

**2a · The mount, recipe #433, in `src/app/(auth)/layout.tsx`.** Add as a sibling
**inside the root `<div>`, immediately before `<GlobalHeader>`**:

```tsx
import { WarliHero } from "@/components/art/warli";

<div className="pointer-events-none fixed inset-0 -z-10 grid place-items-center">
  <WarliHero className="h-full w-full" />
</div>
```

Nothing else in that file changes. Assert afterwards that
`page-container.test.ts` site 8's pinned className string is byte-unchanged.

**2b · Invert the guard.** `tests/unit/art/art-layer-guards.test.ts`, the
`it("is mounted NOWHERE — nothing outside the art layer imports it")` block at
:311. Replace the assertion `expect(importers).toEqual([])` with one asserting the
**expected importer exists and is exactly `src/app/(auth)/layout.tsx`**. Rename the
describe/it text to match what is now true. **Prove it by revert-to-red in both
directions**: remove the mount → red; point the importer at a different file → red.
Report both assertion messages. A guard that stays green when the mount is removed
has never seen the defect.

⚠ The sibling `it()` at :251 — *imports nothing from outside its own directory* —
**must stay green.** Assert it did.

**2c · `AGENTS.md:92`** describes the layer as **"MOUNTED NOWHERE"**. Correct it in
the same commit. Descriptive doc, CC-authored: write it yourself, state where it
is now mounted, and say nothing about why.

**2d · Responsive, ruling R(a) — minimal and bounded.** The viewBox is 1440×1000
with ~220 units of empty margin either side, so `xMidYMid meet` shrinks the artwork
hard below 1440. Devcon traffic will be mobile.
· Report the rendered scale at 390 px, 768 px and 1440 px before any change.
· Apply the **smallest** fix that makes the artwork legible on a phone — cropping
  the empty margins is the likely answer, since they are empty.
· ⛔ **The desktop rendering at ≥1440 must be byte-identical to before.** Prove it.
· If the minimal fix would alter composition at any width, **stop, report, and
  ship without it.** Composition belongs to WARLI-3.

**2e · Hex census.** Run the TRUE-NEUTRAL census against the changed files and
paste the output. Any non-neutral hex fails regardless of intent.

---

## 5 · REVIEWERS — mandatory, effort max, in order

```
1. @code-reviewer — the mount, the guard inversion, the field hoist.
   FAILURE MODE: an optimisation that changes the drawing while every test that
   would notice asserts on structure the change preserved. Ask of Slice 1: what
   proves the output is byte-identical, and would that proof survive if it were not?

2. @test-writer — the inverted guard, and a case for the responsive change if 2d
   ships. Revert-to-red each, both directions.

3. @security-auditor — scoped to `src/app/(auth)/**` and the layer.
   This is auth AND it partially discharges the audit that stalled before reaching
   the legal/onboarding surface — `/onboarding` is one of the three routes this
   layout wraps. FAILURE MODE: a render-only change disturbing session handling,
   OTP submission, the Turnstile widget, or the acceptance-evidence write. Enumerate
   what shares these files; do not reassure.
```

Per F-11, a finding that is fixed gets **that reviewer re-run scoped to the fix**.

---

## 6 · PR

Push `feat/warli-mount`. Open against `main`. **LEAVE IT UNMERGED.** Body carries:
the before/after cost table with the 82 KB residual stated plainly; the recipe
chosen and the one rejected with its measured reason; the guard inversion with both
revert-to-red messages; the responsive figures at three widths; the hex census;
reviewer findings and dispositions. Report the preview URL and the SHA it serves —
that is what the founder opens.

⛔ Do not advance staging. That is the operator's, after Gate C and merge.

---

## 7 · VERIFICATION

1. Full suite green, delta stated against A0.3's baseline. **Exit read from the
   log.** Contention recorded at start and end.
2. Slice 1's byte-identical markup proof.
3. Slice 1's before/after server render figures.
4. Guard revert-to-red in both directions, with assertion messages.
5. `page-container.test.ts` site 8's className byte-unchanged.
6. Desktop rendering at ≥1440 byte-identical if 2d shipped.
7. Hex census output.
8. `just verify` clean, exit read from the log.
9. PR OPEN, UNMERGED, base `main`, CI green at the head SHA, equal to `headRefOid`.

## 8 · REPORTING

`~/Downloads/zz_WARLI-MOUNT_run_<UTC>.md`, incremental. Lead with the preview URL,
then anything in this brief that turned out wrong.

**Final chat reply ≤8 lines:** FILE / LINES / MD5 / PR (number, state, head SHA) /
PREVIEW (url, sha) / SLICE-1 (server ms before→after, markup identical Y/N) /
SUITE (total, delta, contended Y/N) / HEADLINE. LINES and MD5 measured last.

---

*End WARLI-MOUNT execution brief v1.0.*
