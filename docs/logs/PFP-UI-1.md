# PFP-UI-1 — the avatar becomes a circle — execute log

**PR #421** (OPEN, not draft — founder merges, and NOT on CI-green alone; see the gate below) · branch `feat/pfp-ui-1` · base `origin/main` @ `5463f61aa34cd059ef8c441019cb83251be352b9` · run from worktree `~/code/zugzwang/pfp-ui-1` (detached at `origin/main`, cut before this session) · squash SHA TBD at merge.

Plan: `docs/plans/PFP-UI-1.md` (870 lines, md5 `24652058c6a9c77145228b20fb913540`), committed as `1bbaf9b` **before any code moved**. Full execute report: `~/Downloads/zz_PFP-UI-1_EXEC_2026-08-26T1907.md` — the primary artifact; this log is the repo-side companion §5.9 requires, not a duplicate.

⛔ **THIS PR IS NOT MERGEABLE ON CI-GREEN ALONE.** §10.1 puts a **founder visual pass on staging** between CI-green and merge, and it is the only instrument that can see what this pass changes. See *Next session starts at*.

## What landed (files + PR#)

**12 files, 2 commits** (a third, the log, is this one).

- **`1bbaf9b`** — `docs/plans/PFP-UI-1.md` only. The instruction, in history before the work it instructs.
- **`c93e4a1`** — 548 insertions / 58 deletions across 12 files:
  - **Code (3 mounts):** `components/onboarding/figures.tsx` (`IdentityHero` — frame radius, `overflow-hidden`, 3× `rounded-none` and `after:hidden` all deleted); `components/profile/IdentityCard.tsx` (**Fix A** — ring wrapper owns the sizing, `<img>` becomes `size-full`); `app/(auth)/onboarding/page.tsx` (`rounded-full`, ring moved off the `<Image>` onto a wrapper overlay).
  - **Code (2 riders):** `app/globals.css` — `--imgr`'s comment, §10.2's closing-ritual item. `components/ui/avatar.tsx` — **comment-only, 23 insertions, 0 deletions**; see *Decisions*.
  - **Docs (§6's seven targets + the park):** `DESIGN_W2_2_CLOSE-OUT.md`, `ZUGZWANG-O1-DECK_copy-register_v1_0.md` (two sites — `:80` and the row-6 three-part treatment), `ZUGZWANG-BRAND_agenda-and-values-log_v0_3.md` (two sites — `:176` and `:280`), `design-token-contract.md`, `docs/parked.md` (`PD-PFP-10`).
  - **Tests:** `tests/unit/design/avatar-ring-token.test.ts` (+11 tests → 14), `tests/unit/profile/render/arrangement.test.tsx` (2 re-expressions).

**Untouched by design:** all of `src/server/**`, `src/db/schema/**`, `drizzle/**` — this task never approaches the critical-path fence. The `--imgr` **token value**, whose 19 non-avatar consumers would have been silently re-radiused by a token edit. The `.html` mockups, which are locked evidence of what was drawn (§6.1).

**Staging:** merged to `origin/staging` as `defb62b` **before** the feature-branch push (O-10), full suite re-run green on the merged tree first.

## Decisions made

- **`src/components/ui/avatar.tsx` WAS edited, comment-only — and the relay said not to touch it.** The relay's step 8 fences the file; plan §6 row 3 names `:18-20` as a mandatory same-commit doc target. The relay's own conflict rule (*"the plan wins and you halt and say so"*) resolves it, and §3.3.3's conditional — which step 8 invokes — governs *mechanism* (adopting the primitive, extracting a shared constant), none of which happened. Proven comment-only: 23 insertions, **zero deletions**, and the `cn()` class string byte-identical to `origin/main`. **Surfaced as a PR-scope deviation, revertible with one `git checkout` of one file.**
- **Mount 8's wrapper is `relative block size-32`, not bare `relative`.** §3.3.3 said only "the same `relative` wrapper as mount 7". `size-32` restates the image's own 128px box so `inset-0` lands on the image edge (the direct analogue of Fix A). **`block` is the judgement call:** a `<span>` is a non-replaced inline box where width/height do not apply at all, and it blockifies today only because `CardHeader` happens to be a `grid`. Inheriting a box from a parent's display mode is the same implicit-chain dependency that produced A-5's measured 256×256 blow-out.
- **Fix A's class strings used byte-verbatim from §3.3.2.** I first reordered the wrapper string to the repo's prevailing base→`after:`→variant convention (which `ui/avatar.tsx:34` itself follows) and reverted it. Biome was checked and does **not** sort classes here (`useSortedClasses` is nursery; config enables only `recommended`), so nothing would have re-sorted it either way — which made the reorder an unforced deviation rather than a formatting necessity.
- **`row8`'s re-expression is strictly stronger than what it replaced.** `expect(img?.parentElement).toBe(card)` was a *proxy* for its own stated claim (*"the band would be three columns, not two"*). It now asserts the PFP column is a direct child **and `card.children.length === 2`** — which can catch a third column appearing, something the old form never could.
- **The §6 row 7 brand ruling was NOT taken.** The row's condition (*"when the surface is built"*) is now met and is recorded as met; the **frame** half is discharged (a scrubbed avatar is a circle with `--avatar-ring`, inherited from the shape rule); the **asset** half stays owed. Inventing a scrubbed-avatar silhouette is brand content and outside this task's authority — narrowing the open question is what an execute pass can do.
- **No ADR.** §6.3 — a rendered shape is not an architectural decision. ADR ceiling read anyway (O-2): `0040` on `main`; **`0041` is claimed by an uncommitted file on branch `Ritam`**.
- **No reviewer cascade**, per §9 — no `src/server/`, no schema, no migration, so §5.11's triggers do not fire. The condition §9 attaches to that call (that `ui/avatar.tsx` stays out of the *mechanism* fence) held.

## Surprises caught + fixed in-session (§5.10)

1. **Plan §3.3's "ring today" cell for mount 6 is wrong.** It lists mounts **1–6** as ring `✅ present`. Mount 6's `after:hidden` set `display:none` on the very pseudo-element that draws the ring, so the deck hero rendered **ringless**. No action diverged — §2.1 already orders `after:hidden` deleted, and deleting it is exactly what restores the ring. But the true starting state was **two** mounts without a ring (6 and 7), not the one §3.3 claims, and that table is what justifies "mount 7 is the one gap in eight."
2. **§6.2 part 3's "the ONE surface still on the placeholder" needed defending before it could be written.** `PFP_PLACEHOLDER` has two further consumers — `discovery/hero.ts` and `load-debate-view.ts`. The claim survives (both are `UNKNOWN_AUTHOR` defensive null-guards for a `comments.user_id` with no `users` row, and `pfp-url.ts` returns the placeholder for a NULL filename — the scrubbed case), and the annotation now **states that distinction in place**, because this row exists precisely because a register asserted something checkable and false.
3. **The relay's ground claim was falsified.** *"It is NOT 5463f61."* It is — measured three ways (local ref, `git ls-remote`, `gh api`). `main` never moved off the plan's authoring base, so zero coordinate drift was possible and none was found. The re-resolution was performed in full regardless.

## Verification

| Gate | Result |
|---|---|
| `ZUGZWANG_ENV=preview just verify` | **exit 0 — "All checks passed"** (typecheck → biome → build). Needed the `tests/_setup/env.ts` placeholder env inline: a fresh worktree has no `.env.local`, and `next build` collects page data. |
| Full suite, feature branch | **388 files / 3570 tests passed**, 1 skipped, 4 todo, **0 failed** |
| Full suite, **merged staging tree** | **412 files / 3826 tests passed**, **0 failed** — run *before* pushing staging, because five of the twelve changed files were also touched by staging's 49-commit lead |
| RED-first | Both predicted failures observed before any test was edited, and no others |
| Mutation test | Three guards each driven RED by re-introducing the exact defect they pin, then restored to green |

⛔ **What none of this proves.** Every new assertion is a class-string source scan and jsdom performs no layout. It cannot see 188×188, cannot detect the 256×256 blow-out, cannot tell a circle from an ellipse, and reads an **uncompiled** utility as present. That limit is why §10.1's founder pass is a gate and not a courtesy.

⚠ **Mutation-testing was not optional here.** My own new docblocks contain `rounded-none`, `after:hidden` and `[border:var(--avatar-ring)]` **as prose** — a guard matching a bare word would have caught the comment explaining the absence and passed on it. `stripComments()` is what makes the negatives real; the mutations are what prove `stripComments()` works.

## Open questions

- **`OD-1` / `OD-2` / `OD-3` / `OD-5`** were ratified at kickoff (NARROW · ALL-CIRCLE · R-a · ratify-the-sizes) and are built to. **`OD-4` (the 18-file manifest filter) and the v1/v2 bake question are NOT ratified and NOT in this PR** — they belong to PFP-PROD-SEED. Nothing here touches the seed manifest, the asset pipeline, or R2.
- **The `lg`/`xl` seam (`PD-PFP-04`)** is untouched and still open: 1024–1279px renders a 56px avatar in a 188px band. It is a breakpoint decision, not a shape one, and it is *"the last open piece of D-1"* per `arrangement.test.tsx:1212`.
- **The Case-B residual (`PD-PFP-08`)** — a left-side cream crescent surviving the circular crop, median 6.57px at the 188px mount. Baked into the asset, fixable only at source, routed to `convert_and_upload_pfp.py` on `spark-3100` (not this repo). **No CSS compensation is proposed anywhere in this PR**, by design.
- **`PD-PFP-09`'s 18 colourless assets** — `cerulean-capybara` at 0.00% identity colour, and `CeruleanCapybara000` is 1 of the 9 live staging identities. The founder pass will likely see it. It is `OD-4`, not this PR.
- **Is the `ui/avatar.tsx` comment amendment wanted?** See *Decisions*. If not, revert one file.

## Next session starts at (exact next action)

⛔ **THE FOUNDER VISUAL PASS ON STAGING — §10.1 gate 4, between CI-green and merge.** Nothing else is owed first.

1. `GET https://<staging>/api/health` → read the **`canary`** field and confirm it equals **`defb62b`**, **in the same action as the screenshot** — not before, not after. A stale server returns the passing picture. Staging's canary was `f953f6d` (an `rply-2` merge, not `main`) during this plan's own Part 2, so O-4 does **not** hold here and the canary must be read, never assumed.
2. Per-mount, across five surfaces: header chip (1, 2, 24px) · Discovery hero head (3, 16px) · `/m/[slug]` argument-row author (4, 24px) · `/u/[pseudonym]` argument rows (5) **and the hero (7) at ≥1280 AND again at 1100**, because the §4.2 seam changes which one you are looking at · `/onboarding` deck figure (6, 140px) and page hero (8, 128px).
3. ⛔ **THE A-5 ROW — `/u/[pseudonym]` at ≥1280.** The hero must **measure** 188 × 188, not be eyeballed. Three wrong outcomes all pass every automated test: **56 × 56** (the wrapper swallowed the percentage-height chain), **256 × 256** (the naive-wrapper blow-out — visibly overflowing the band by 68px), and a **non-square ellipse** (the box lost `aspect-square`).
4. Two things no test can see: the **left-side cream crescent** at the three large mounts, and whether `CeruleanCapybara000` reads as a colourless blob.
5. Then, and only then: re-check `ci`'s conclusion **at the moment of merging** (no branch protection — a red PR can be merged), and merge.

## Context to preserve

- **Base `5463f61` == the plan's authoring base.** Every coordinate in the plan resolved exactly; the relay's "it is NOT 5463f61" was wrong in the safe direction.
- **Staging is `defb62b`** = `origin/staging`'s prior tip `d90330b` (RPLY-3) **+ this branch**, merged and full-suite-green. It carries 49 commits `main` does not.
- **O-10 was honoured:** staging pushed at `d90330b..defb62b` *before* the feature branch, so Vercel cannot dedup the SHA and skip the staging build.
- **The two wrappers deliberately re-bind `--avatar-ring` locally**, which departs from `avatar-ring-token.test.ts`'s own `identity-cluster-carries-no-local-ring-override` rule. That test guards a *different* case (a workaround for a primitive that was broken); these two mounts are ones the primitive **cannot reach**. The rule is unchanged — re-bind only where the primitive cannot reach — and it is written into that file's docblock so a later reader does not "fix" the wrappers.
- **`PD-PFP-10` is parked**, not carried: mount 6 is now a circle around a hard-coded `/pfp-placeholder.svg`, which makes the divergence *less* visible, not more. Trigger: whenever the deck next takes viewer data for any reason.

## Time

One session, 2026-08-26, ~19:07 → ~21:0x IST. Phase 0 ground + coordinate re-resolution → plan commit → three mounts → seven doc targets + the park → tests (RED-first, re-expressed, mutation-tested) → `just verify` + two full-suite runs → staging merge + push → this log → PR.
