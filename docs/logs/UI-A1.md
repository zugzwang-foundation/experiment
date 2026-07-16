# UI.A1 — session log (Phase 1 PLAN chat · plan authored → interview ratified → fold-ins applied → plan committed)

> 2026-07-16/17 · three rounds · CC on Fable 5 (`claude-fable-5`, effort max) · plan-mode session — rounds 1–2 NO COMMITS by design (kickoff deviation from plan-then-execute.md); round 3 (2026-07-17) executed the ratified plan commit after the final web review passed

## What landed

- `docs/plans/UI-A1.md` — the A1 foundation plan: v1 authored + self-critiqued (round 1), then **v2: all 8 interview answers folded as ratified + web fold-ins F1–F3 applied** (round 2; self-critique rows 9–13 appended, rows 1–8 preserved), then **COMMITTED (round 3, 2026-07-17)**: final web review PASSED → the two ratified header edits (Status → reviewed; Plan-PR line) → branch `docs/ui-a1-plan` off `c7ed71e` → **PR #231, squash `91436f9`** (`91436f93349516b7324b2d66abc042b0b9ecf1aa`) on `main`; CI green (`ci` 3m26s + Vercel); landed subject `docs(plans): UI.A1 — foundation plan (A1) (#231)`; F3 honored (plan file only staged); branch deleted local+remote (census back to 117).
- This log, same posture. **F3 staging law recorded in the plan:** at the plan commit, ONLY `docs/plans/UI-A1.md` is staged; this log (the tree's second uncommitted file) rides its own later PR or an explicit ruling.
- Round-1 ground re-verify: ALL GREEN — origin/main `c7ed71e` == PR #230 mergeCommit; tree clean; `stash@{0}` intact; branch census 117 exact; 4/4 subagents `claude-fable-5`/`max`. Hygiene both healthy (design guides v0.6-draft; SPEC.1 cite 1.0.15).

## Decisions made (operator-ratified 2026-07-16)

- **OQ-1 YES** — additive `src/app/(auth)/layout.tsx`; zero-edits-to-existing-auth-files stands as law; **ADR-0023 amendment rider lands in the SAME execute commit, rider text web-authored at the commit point** (CC never drafts it — execution blocks at slice 5 on the relay).
- **OQ-2 DEFER** — Đ Portfolio/Balance = A2/A3; A1 signed-in right zone = identity chip only.
- **OQ-3 RATIFIED** — RULES/Đ-info/Research/visitor omit · radio inert placeholder (OFF, aria-disabled, static); each a named deviation per design-handoff §4.
- **OQ-4 — placeholder arrived UNFILLED** (neither URLs nor "omit"); resolved by the ratified rule's zero-supplied branch → **SocialMenu OMITTED by default**, `dropdown-menu` install made conditional (no zero-consumer primitive); supply window open to Phase 2 kickoff; flagged for the final web pass.
- **OQ-5 YES** (primitive restyle in scope) · **OQ-6 YES** (2-line metadata fix, reused copy) · **OQ-7 YES** (`Buy` → `Đ BET` copy-only now; values-log §6 ruling-1 restructure at A2/A3).
- **OQ-8 RATIFIED (design ruling)** — row-2 cell count tracks the countdown string (9 today → 8 at days<100, ~Jul 29); row 1 stays 8; parity preserved; **one-line values-log append owed at that doc's next touch**. Implementation width note (180px vs 160px until ~Jul 29) recorded, screenshot at PR review.
- **F1** — §1 row 2.2 citation corrected to the on-disk `tests/server/dharma/non-transferable.test.ts` (filename verified) + absence-by-design.
- **F2** — countdown target resolved with no micro-OQ: SPEC.1 §6/§12/§15 pin `2026-11-05 23:59 UTC`; the countdown consumes the **built `FREEZE_INSTANT_UTC`** (`src/server/markets/create.ts:34`) via RSC import → epoch-millis prop to the client leaf (no duplicate constant, no `server-only` breach); §4.8 loading mechanism simplified to prop-seeded initial render.
- **F3** — second uncommitted file named (this log); staging law folded into the plan header + §9.

## Open questions

- None blocking. Residuals (plan §Open questions): OQ-4 URL supply window · ADR-0023 rider text (web-authored, relayed at execute slice 5) · OQ-8 values-log append at next touch.
- Standing (untouched): `stash@{0}` ruling · W2.11 state-ledger CSV locate · Bookmarks ADR before A6.

## Next session starts at

- **UI.A1 Phase 2 executes in a FRESH tab** from the committed plan (`docs/plans/UI-A1.md` @ `91436f9`), starting at plan §9 slice 1 (primitive restyles); the execute kickoff is web-authored off the #231 merge report. Slice 5 BLOCKS on the web-authored ADR-0023 rider text (not pre-drafted, per instruction). This log rides its own later PR (the A1 close-out).

## Context to preserve

- Ground: `main` @ `91436f9` (== #231, the committed plan; prior ground `c7ed71e` == #230). Fable-5 window active (through ~Jul 19; revert obligation stands).
- Load-bearing recon facts: `components/ui` consumers are **debate-only** (restyle blast radius contained); auth pages are bare unstyled HTML; `resolveAuthors` serves `/pfp-placeholder.svg` for everyone (D8); `public/brand/zugzwang-mark.svg` present (WI-12); values-log §3 supersedes the mockup on brand cluster/countdown (R-2/R-3), 34px register, one-button system (R-6), white-cells-as-chrome (R-4).
- Values-log §6 build ruling 1 (position strip, NO Đ BET/Sell buttons on the debate surface) pinned to A2/A3 in plan §4.4/§8 — do not lose it.
- Countdown: import `FREEZE_INSTANT_UTC` from `src/server/markets/create.ts` (read-only import, not an edit) — never mint a duplicate.
- `just verify` needs `ZUGZWANG_ENV=preview`; full `pnpm vitest run` is the pre-PR whole-suite gate; `just clean` before pushing branches lacking the new `(auth)/layout.tsx` route (stale `.next/types` trap).

## Time

- 2026-07-16/17, three rounds: (1) STEP 0 re-verify → full recon → push-back + 8 OQs → plan v1 + critique → STOP. (2) Ratified answers + F1–F3 returned → verification greps (test filename, freeze pins, `FREEZE_INSTANT_UTC`) → plan v2 fold-in (critique rows 9–13 appended) → complete file printed → STOP (no commits). (3) Final web review PASSED → two header edits → `docs/ui-a1-plan` → PR #231 → CI green → squash `91436f9` → post-merge verification (origin/main == squash SHA; tree = this log only; census 117) → this log updated → STOP.

---

# UI.A1 — session log · Phase 2 EXECUTE (fresh tab, 2026-07-17)

> Slices 1–4 leg (kickoff law: HARD STOP before slice 5 — blocks on the web-authored ADR-0023 rider). Branch `feat/ui-a1-foundation` off `91436f9`.

## Ground verify (all PASS)

| Check | Result |
|---|---|
| HEAD == 91436f9 on main, == origin/main | PASS |
| Plan @ HEAD, status "reviewed — final web review passed · operator-ratified 2026-07-17" | PASS |
| Tree: only `?? docs/logs/UI-A1.md` | PASS |
| stash@{0} EXTAUDIT-06 present, untouched | PASS |
| Session claude-fable-5 / max; 4/4 subagents claude-fable-5 / max | PASS |
| Full plan read before any edit | PASS |

## Slice 1 — primitives (commit b2c2410)

- `ui/button.tsx` one-button system (OQ-5): default/outline unified (btn-fill + hairline + ink; hover/pressed --state-* fills); ghost quiet (n5→ink; hover fill kept per values-log §3 "also" clause — the plan's parenthetical compresses it; flagged); base radius --r, focus --state-focus-ring, disabled --state-disabled-opacity. secondary/destructive/link untouched.
- `ui/card.tsx` --r + hairline + elev-1. `ui/dialog.tsx` overlay --overlay, content elev-3 + --r (content's stock ring-1 left — not in the plan's closed inventory).
- badge/avatar/separator/skeleton verify-only: no visible radius drift; unamended.
- Gates: ZUGZWANG_ENV=preview just verify GREEN · full pnpm vitest run GREEN (196 files/1319 tests; tokens-monochrome untouched/green).
- Screenshots (headless-Chrome CDP rig, local :54322 seed + dev :3100, dsf2): before-{market,dialog,post}.png @ main render; after1-{market,dialog,post}.png @ b2c2410. Computed-style probes: card 8px/#404040/elev-1; outline btn #181818+#404040, disabled 0.5; ghost #989898. Paths in scratchpad/shots (re-capture rig documented below if clobbered).
- Ops note: `just verify`'s next build clobbers the dev server's .next AND the vitest suite truncates the seed → reseed + dev-restart before every capture round (bit once; first after-capture was a 404 set, discarded).

## Slice 2 — debate sweep (commit 65d67e8)

- `badges.tsx` SideBadge hairline on BOTH poles (the YES-invisible-on-n0 fix; side-binding classes untouched — INV-3 visual obligation intact). `PriceBar.tsx` comment → dark-era wording incl. the accepted YES≡ground collision. `PostCard.tsx` + `DebateColumn.tsx` `Buy`→`Đ BET` (OQ-7; side kept in colhead aria-label, sign-in hint kept). Two doc comments naming "Buy" updated (orphans of the relabel).
- Gates: verify GREEN · full suite GREEN (196/1319).
- Shots: after2-{market,dialog,post}.png — YES chip edge + Đ BET visible in market + post views.

## Slice 3 — shell components, test-first (commit d78af0f)

- RED first: `tests/unit/shell/countdown-format.test.ts` written + run failing (module absent) BEFORE the implementation; then `countdown-format.ts` → 8/8 green. Matrix per plan §7: in-window 8-char · >99d 9-char · 100→99 flip boundary pinned to `2026-07-28T23:59Z` (the plan's "~Jul 29", derived not hand-set) · at/post-freeze clamps · UTC minute-boundary floors (floor semantics: the final minute reads `00:00:00` — never overstates) · <10d zero-pad · F2 pin (imported `FREEZE_INSTANT_UTC === Date.UTC(2026,10,5,23,59)`).
- Components: `GlobalHeader` (RSC; band 60px n0/border-y/elev-1; 1fr-auto-1fr; max-w-1440/px-6; imports the BUILT freeze pin read-only; seeds initial display server-side) · `BrandCluster`+`CountdownDigits` (48px mark; 2×8 chessboard; ONE `<Link>` target → `/`; row-2 cells track the string per OQ-8; prop-seeded hydration; 1s recompute = minute-granularity display; cells are R-4 chrome, zero pole tokens) · `HeaderNav` (Back default-disabled until mount, `history.length` heuristic accepted-known; Home `aria-current`; 34×34 values-log states: hover border→`--ring`, pressed fill, focus ring) · `RadioSlot` (inert OFF, static bars, `aria-disabled`, disabled dim) · `IdentityCluster` (JOIN inverse button / link-inert chip).
- SocialMenu NOT built; `ui/dropdown-menu` NOT installed (OQ-4 CLOSED = OMIT, kickoff ruling).
- `--bar-block`/60px is a values-log design register, not a repo token → component-local literals (`h-[60px]`, `size-[34px]`); zero `globals.css` need confirmed.
- Gates: verify GREEN (one biome organize-imports auto-fix absorbed pre-commit) · full suite GREEN (197 files / 1327 tests — +1 file/+8 tests).
- Render sanity: transient harness route (never staged, deleted pre-commit; tree grep-verified) → `after3-header-states.png` — signed-out / signed-in / null-pseudonym; chessboard parity correct (top-left dark, row 2 counter-phase); the OQ-8 transient 180px/160px lockup captured for the PR veto; Back renders disabled on the fresh tab (heuristic proof).

## Slice 4 — read-model: RECORDED NO-OP (per §9.4, no commit)

- No new read-model: session→header mapping stays in the layouts (deliberately thin — the lane's vertical-step resolution). No mapper extracted ⇒ `tests/unit/shell/header-view.test.ts` DROPPED per plan §7's own conditional ("no forced abstraction").

## HARD STOP — before slice 5 (kickoff law)

- Slice 5 BLOCKS on the web-authored ADR-0023 amendment rider (CC never drafts it). Nothing slice-5 was pre-committed: `(public)/layout.tsx` untouched, no `(auth)/layout.tsx` exists, root metadata untouched — grep-verified via `git diff main..HEAD --name-only`.
- Scope guards final sweep: zero `src/server/**` / auth-file / `globals.css` / `package.json` / migration diffs; `tokens-monochrome.test.ts` unamended + green ×3 suite runs; `stash@{0}` intact; tree = this log only.

## Flags for web review (carried to the stop report)

1. Identity-chip microcopy `title="Profile — coming soon"` — plan's candidate string used verbatim (per kickoff ruling), needs the web pass.
2. RadioSlot title — mockup-verbatim "Radio — depicts live music when ON (placeholder skin; built in W2.14)" describes the ON depiction the inert skin never shows; alternative needs ruled copy (none invented).
3. Ghost-button hover: plan §4.4 parenthetical ("n5 label rest → ink hover") vs values-log §3 "Hover: fill → #2A2A2A (quiet variant ALSO label n5 → ink)" — implemented the values-log reading (hover fill + label change; values are the cited authority).
4. Brand-cluster a11y: grid cells `aria-hidden`, link labelled `ZUGZWANG`; the countdown has no screen-reader surface (a remaining-time sentence needs ruled copy — not invented). aria-live deliberately NOT used (minute-tick noise).
5. Chessboard seam: per-row hairlines with a −1px collapse (reads as the single outer rect at 8/8 after ~Jul 29); the OQ-8 ruling's width silence resolved as centre-aligned lockup — screenshot `after3-header-states.png` for the cheap veto.
6. JOIN hover/pressed mapped to n7/n6 ramp steps (states table has no inverse-button row; era-proof, no pole token).
7. DebateColumn aria-label now `Đ BET ${side} — sign in to bet` (side preserved per plan; "sign in" hint retained from the original string).

## Next session starts at

- **Slice 5** — WAITING ON: the web-authored ADR-0023 amendment rider text (relayed). Then: `(public)/layout.tsx` header swap (+ delete the THROWAWAY comment, note the UI.13→A1 re-sequencing in the PR body) · root metadata (OQ-6: `title: "Zugzwang"`, description "The world's reputation market.") · additive `src/app/(auth)/layout.tsx` — ALL IN THE SAME COMMIT as the rider. Then slice 6 (states pass + `no-raw-hex-view-layer.test.ts`), slice 7 (full suite + M1–M5 + §5.10 self-audit + @code-reviewer + PR).
- Branch `feat/ui-a1-foundation` is LOCAL-ONLY (not pushed; CI is PR-gated anyway). Screenshot rig re-creation documented above if scratchpad is clobbered (seed script + CDP shot script, ~2 min).

## Time

- 2026-07-17, one leg: ground-verify → full plan read → recon reads → branch → screenshot rig (local seed + dev :3100 + headless-Chrome CDP) → slice 1 (before/after shots, computed-style probes) → slice 2 → slice 3 (RED→GREEN, harness render proof) → slice 4 no-op → stop report. Ops bites logged: `just verify` build clobbers dev `.next`; suite truncates the seed DB (reseed per capture round).

---

# Leg 2 (same tab, 2026-07-17) — web gate PASSED on slices 1–4; rider relayed; slices 5–7

## Slice 5a — (public) swap + metadata (commit 678c264)

- `(public)/layout.tsx`: throwaway header → `<GlobalHeader viewer={…}/>`; THROWAWAY comment deleted (UI.13→A1 re-sequence noted for the PR body); same getSession read, zero new providers. Root metadata (OQ-6): `title: "Zugzwang"` · description "The world's reputation market." Gates GREEN (197/1327).

## Slice 5b — ISOLATED (auth) mount + ADR-0023 rider (commit 846959c)

- Exactly two files: NEW additive `src/app/(auth)/layout.tsx` + the web-authored ADR-0023 Patch record applied VERBATIM (metadata-table row after Superseded-by + §Patch record appended after the closing italics). Zero edits to existing auth files (diff-verified). Gates GREEN (197/1327).
- Post-5b auth smoke (headless, clean profile = cleared cookies): `/sign-in` 200 + header + bare-HTML internals intact + JOIN signed-out; `/sign-in/otp` 200 + header; `/onboarding` → redirect to `/sign-in` (the pre-existing onboarding-ref gate, unbroken); **Continue-with-Google click → live redirect to `accounts.google.com/v3/signin/identifier` with the real client_id** (OAuth kickoff intact). Shots: smoke5b-{sign-in,otp,onboarding}.png. REMAINING MANUAL TAIL (operator): complete Google consent; live email→OTP→onboarding→accept→home round-trip (real mailbox + human required) — plan §5 also routes this through the staging rehearsal.

## Leg-2 rulings recorded

- Countdown a11y RULED: link aria-label = `Zugzwang — home. ${D} days ${H} hours ${M} minutes until market freeze.` from the SAME formatter; grid aria-hidden; NO aria-live; silent minute updates. Implementation note: a ticking attribute cannot live on server markup → BrandCluster flips to the client boundary and owns the single tick; CountdownDigits becomes the presentational cell row (plan §4.2's "(server)" annotation superseded by this ruling; GlobalHeader still seeds initial display server-side — hydration-safe).
- Ghost hover values-log-verbatim: stands as built. JOIN n7/n6: stands. Seam: stands. Chip + Radio titles: stand. Colhead aria side caps: already YES/NO.
- **Values-log NOT touched this task — TWO appends owed at its next touch: (1) the OQ-8 row-2 cell-count ruling line; (2) the JOIN-inverse-button hover/pressed (n7/n6) states line.**

## Slice 6 — rulings + guards (commit 5039abc)

- BrandCluster → client boundary; ruled ticking aria-label (live-probed: `Zugzwang — home. 112 days 02 hours 15 minutes until market freeze.` == visible digits `112:02:15`; grid aria-hidden; 0 aria-live regions). CountdownDigits → presentational (display prop). `[transition:all_var(--dur-hover)]` on HeaderNav buttons + JOIN (probe: 0.12s). NEW `no-raw-hex-view-layer.test.ts` (comments stripped; rgb()/rgba() allowed; aliveness assert >20 files) — green.
- Gates: verify GREEN (two biome format auto-fixes absorbed: BrandCluster import order, hex-guard line-joins) · full suite GREEN 198 files / 1329 tests (pre-format) + design/shell subset re-run post-format · slice 7 re-ran the FULL suite on the final tree: GREEN (1329).

## Slice 7 — checklist + audit (this section), reviewer + PR follow

- **M1** `/m/[slug]` signed-out: m1-market-signedout.png · m1-dialog.png (elev-3 + --overlay) · m1-post.png. Signed-in header state: proven via the slice-3 harness shots (after3-header-states.png — chip/JOIN/nameless); page content is auth-invariant at C1 (no viewer-dependent readout exists), so harness ≡ real signed-in render for the header; live signed-in walk = operator manual tail (needs real Google/OTP session).
- **M2** auth trio: m2-sign-in.png · m2-otp.png · m2-onboarding-redirect.png (redirects to /sign-in — pre-existing gate) + the 5b Google-redirect proof (accounts.google.com reached with real client_id).
- **M3** pole proof (computed, dark ground): YES badge #181818/#fafafa-text/1px #404040 · NO badge #fafafa/#181818-text/1px #404040 · price-bar YES segment #181818 anchored left. Shots carry it.
- **M4** states: m4-hover-home / m4-active-home / m4-focus-home / m4-hover-join / m4-active-join (CDP forcePseudoState) + Back disabled naturally in every shot; radio inert 0.5.
- **M5** `/` smoke: m5-root-smoke.png — NO header (ruled out per §4.1), legible on stock utilities; verify GREEN; full suite GREEN.
- **Variant grep proof (web ask):** Button importers = 6 debate files; Button variant usages repo-wide = ghost ×7, outline ×6, ZERO secondary/destructive/link. (The single `variant="secondary"` grep hit is the **Badge** variant in badges.tsx:43 (PositionMarker) — badges.tsx does not import Button.)

### §5.10 self-audit vs docs/plans/UI-A1.md (item → verdict)

| Plan item | Verdict |
|---|---|
| §0 SG1 zero edits to existing auth files; (auth)/layout additive-only | PASS (diff shows one NEW file; pages untouched) |
| §0 SG2 zero src/server/** edits; FREEZE import read-only | PASS |
| §0 zero globals.css edits; tokens pin unamended + green | PASS (green ×5 suite runs) |
| §0 zero new deps; dropdown-menu NOT installed | PASS (package.json/lockfile clean) |
| §4.2 header frame (60px band, 3-zone, 1440/24, border-y, elev-1, bg-n0) | PASS (probe + shots) |
| §4.2 Back/Home/Radio per values-log register + OQ-3 | PASS (M4 + disabled/inert probes) |
| §4.2 brand cluster R-2/R-3/OQ-8; single FREEZE pin (F2) | PASS (test-pinned; 9-cell shot) |
| §4.2 right zone OQ-2 (JOIN / chip only, ruled microcopy) | PASS |
| §4.2 ratified omissions (Social·Research·RULES·Đ-info·visitor) | PASS (absent) |
| §4.3 (public) swap (server, zero providers, getSession; THROWAWAY comment gone) | PASS |
| §4.3 root metadata OQ-6 exact strings | PASS |
| §4.3/§5.12 (auth) mount + rider SAME commit, nothing else | PASS (846959c = 2 files) |
| §4.4 closed sweep inventory (button/card/dialog/badges/PriceBar/relabels; verify-only rest) | PASS (+ leg-2 ghost-hover ruling) |
| §4.5 WI-1 pole law (slot semantics; chessboard chrome; zero vote affordances) | PASS (hex guard + probes; no thumb/arrow rendered) |
| §4.6 invariant-visual obligations (frozen SideBadge source; no vote affordance; read-only C1) | PASS (source untouched; triggers stay disabled) |
| §4.8 states enumeration + countdown v2 (prop-seeded, no mismatch) | PASS (live hydration probe) |
| §7 countdown tests (RED-first, boundary matrix) | PASS (8 specs) |
| §7 no-raw-hex guard | PASS (2 specs) |
| §7 "existing tests moved: NONE" | PASS |
| §8 out-of-scope absorbed | NONE absorbed — PASS |
| §9 slice order, independently green | PASS (b2c2410 → 65d67e8 → d78af0f → 678c264 → 846959c → 5039abc; slice 4 = recorded no-op) |

- **FAIL:** none. **SURPRISE:** one — BrandCluster's server→client boundary shift, forced by the ruled ticking label; web-ruled at leg 2, recorded above (plan §4.2 "(server)" annotation superseded).

## Slice 7 close — reviewer, absorb, PR (leg-2 end)

- **@code-reviewer verdict:** NO MERGE BLOCKERS; dimensions 1–6 (UI-only posture · WI-1 pole law · scope guards · stack patterns · correctness · ADR same-commit) all PASS. Findings: 2 MEDIUM (both on the new hex guard: alpha-hex regex blind spot; trailing-comment latent false positive) + 3 LOW (string-embedded `/*` masking vector — contrived, noted for the guard's next touch; card child-radius nominal drift under overflow-clip — surgical-rule leave; chip `aria-disabled`-on-span — plan-specified, self-resolves at A5). UNVERIFIED items (full gates, M-checklist) were the executor's own runs — done and recorded above.
- **Absorb (same-commit doctrine):** both MEDIUMs hardened into the guard's minting commit via pre-push amend — slice 6 `5039abc → 6732ce6`, re-signed (G), `ls-remote` empty at amend time; zero rewrites after push. Validated: 8 adversarial regex cases + the planted-literal mutation check (`bg-[#ff0000]` in RadioSlot.tsx → guard FAILS naming file+literal → reverted → green).
- **Final-gate trips (web addendum):** Trip A = biome FORMAT on the uncommitted absorb edit's long regex line (no slice-commit implicated; line-wrap fix). Trip B = 1/1336 vitest failure in a tail-truncated run (executor piping error — name lost); NOT the hex guard (deterministic; green standalone on the byte-identical tree pre-gate); full re-run with complete capture: 100% GREEN (log: scratchpad/suite-full.log). Zero hex was ever removed/reworded/relocated in code to satisfy a gate — branch diff's only hex = 4 comment lines (grep-proven).
- **PR #232** https://github.com/zugzwang-foundation/experiment/pull/232 — head `6732ce6`, base main, squash target, all 6 commits signed. PR-body footer: harness-default Claude attribution OMITTED (Foundation single-identity discipline; SYNC.10 squash-body-leak precedent) — recorded deviation.
- Final numbers: verify GREEN · suite GREEN 198 files / 1329 tests (full log retained) · tokens pin green/unamended · tree = this log only · stash@{0} intact.

## Closing ritual (CLAUDE.md §7)

- CLAUDE.md/AGENTS.md: **no per-task edits** — AGENTS §3 tree entries newly stale ((auth)/layout.tsx, src/components/shell/, tests/unit/shell/, the new design guard) belong to the next SYNC sweep per §7 ("reconcile periodically, not per-task; routine tasks touch only the logs").
- Workflow: the screenshot rig (local seed + CDP) is session-scratch, not process — nothing to codify.
- Tracker: A1 row completion is web-side (tracker_v17 external, operator-maintained).
- Owed follow-ups carried: values-log next touch = OQ-8 line + JOIN-inverse (n7/n6) line · hex-guard string-aware stripping (LOW) at next guard touch · operator manual auth tail (Google consent + live OTP round-trip) at/before staging rehearsal.

## Next session starts at

- **A1 close-out after merge:** operator merges PR #232 (squash) → post-merge proof per memory (diff reviewed-SHA vs origin/main EMPTY + guard-line grep on main) → this log rides its own chore PR (F3 law) → tracker/lane update web-side → then A2 (viewer-session context) plan tab. Fable-5 window: LIVE at close (Jul 17 IST vs ~Jul 19); the Opus re-pin obligation stands, NOT executed (post-window task).

## Time (leg 2)

- 2026-07-17: rider verify → 5a → 5b (+ headless auth smoke incl. live Google-redirect proof) → leg-2 rulings (BrandCluster client boundary + ruled label) → slice 6 → M1–M5 CDP battery + probes → @code-reviewer (fable-5/max) → MEDIUM absorb (amend, mutation-checked) → push → **PR #232** → this log. Bites: tail-piping ate the one-flake gate output (re-run with full capture — green); biome format on the absorb edit.

---

# Close-out leg (2026-07-17, same day) — merge landed, log PR, PK refresh

## Merge record

- **PR #232 squash-merged → `main` @ `096f9aa`** (canonical SHA; branch SHAs ephemeral). Post-merge tree-content proof: `git diff 6732ce6 origin/main` EMPTY (the squash landed exactly the reviewed tree) + hardened guard line grep-verified on main (`[0-9a-fA-F]{8}` form present at test line 26).
- Per-slice branch SHAs (for the record; superseded by 096f9aa): b2c2410 · 65d67e8 · d78af0f · 678c264 · 846959c · 6732ce6 (slice 6 post-amend; pre-amend 5039abc; slice 4 = recorded no-op).
- Trip A/B record, guard-hardening timeline, mutation check (planted `#ff0000` → guard FAILS naming file+literal → revert → 2/2 green), reviewer MEDIUMs (absorbed via the pre-push amend) + 3 LOWs, and the single SURPRISE (BrandCluster server→client, web-ruled ticking label) — all recorded in the leg-2 sections above.

## Fork-gate item 4 (Session B)

- Open PRs: exactly one — **#146** `fix(admin): audit-500 graceful degradation + admin legibility pass + slug helper` (`feat/ui6-admin-fixes`). Touches ZERO of `(public)/layout.tsx` / `src/components/shell/**` / header-nav components → **assertion PASSES; no Session-B block from this item**.
- FLAG (surfaced, not absorbed): #146 predates the A1/A7 zero-auth-edits law and touches `src/app/(auth)/sign-in/page.tsx` (+ admin pages, `src/components/internal-ui.tsx`). If it ever moves toward merge it needs re-review against the standing auth law + a rebase over the new `(auth)/layout.tsx` mount. Web's call; recorded here so it isn't lost.

## The six owed follow-ups (reconstructed from context; the web close-out doc ZUGZWANG-UI-A1_CLOSE-OUT.md is authoritative if it enumerates differently)

1. Values-log next touch: the OQ-8 row-2 cell-count ruling line.
2. Values-log next touch: the JOIN-inverse-button hover/pressed (n7/n6) states line.
3. Hex-guard string-aware stripping (reviewer LOW, contrived `/*`-in-string vector) at the guard's next touch.
4. Operator manual auth tail: complete Google consent + live email→OTP→onboarding→accept→home round-trip, at/before the staging rehearsal.
5. Fable-5 window close-out: re-pin the 4 subagents to `claude-opus-4-8` + reconcile CLAUDE.md §6's stale "Fable unavailable" text — due post-~Jul 19, **NOT executed** (in-window at merge, Jul 17).
6. AGENTS.md descriptive-tree reconciliation at the next SYNC sweep: `(auth)/layout.tsx` now EXISTS, `src/components/shell/` (6 components), `tests/unit/shell/`, the second design guard, and the resolved "UI.13" pointer.

## Next session starts at

- **This log's own PR** (`chore/ui-a1-log`, doc-only) merges → PK refresh staged to `~/Desktop/zz-pk-refresh-UI.A1/` (ADR-0023 patched + this log; expected PK census after operator drag = 90) → then the **A2 plan tab** (viewer-session context: Đ Portfolio/Balance reads, position strip re-scope per values-log §6 ruling 1) opens web-side off the UI-LANE row.

## Time (close-out leg)

- 2026-07-17: ground (096f9aa proof + guard grep) → fork-gate item-4 sweep (1 open PR, clean; #146 auth-touch flagged) → log finalized → log PR → PK refresh → report.
