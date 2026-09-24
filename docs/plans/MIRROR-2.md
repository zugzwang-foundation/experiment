# MIRROR-2 — composer refinements on PR #574, and photo hygiene

**Mode:** autonomous one-shot run (`docs/overnight-run.md` §2, §6). **Branch:** `feat/mirror-1` (PR #574),
head `03dac591` at start; `origin/main` `44573547` is already an ancestor (0 commits to merge).
**Register:** `docs/design/composer-mirror.md` — RF-4, RF-6, RF-7 replaced and RF-10…RF-12 appended
verbatim from the brief (S1); design-canon takes RF-9b (S1).
**Critical path?** No §1 area. Nothing under `src/server/`, no route handler, no server action, no
validation schema, no limit constant, no migration, no database write. The one non-presentation
surface is the client image-attach flow (`composer/image-attach.ts`, the file input and drop
handlers in `ImageAttach.tsx`, and one gating term in `BetComposer.tsx`), touched only for RF-10,
RF-11 and RF-12.

---

## 1 · The shape of the change

Three presentation refinements to the Mirror (desktop and tablet only — the phone keeps the
classic composer, RF-8), and three behaviour fixes to the image flow that both layouts share.

- **RF-4** — the title's type is chosen by a new rule: the largest size from 28px down to 13px
  (0.5px steps, line height × 1.25) at which the text, or the placeholder, fits the 54px block in
  at most two lines; it is centred vertically with `padding-top = (53 − lines × lh) / 2`, and size
  changes ease over 150ms. The composer opens with the cursor in the title.
- **RF-6** — the detail field loses its focus ring; the frame's edge lifts n2 → n3 instead. The empty
  frame's caption is `Optional`. Composer buttons ring for keyboard focus only.
- **RF-7** — the stake bar's groups spread across the free space with equal spacing; TO WIN reads
  like AMOUNT (a small n5 `Đ`, then the mono 22px/600 figure).
- **RF-10** — every image except a GIF is re-saved in the browser before it is signed, so it
  carries no hidden metadata; a re-save that fails or times out refuses the image. It is never
  uploaded as-is.
- **RF-11** — PLACE is disabled while an image is uploading.
- **RF-12** — a file that arrives while the composer is submitting is ignored at the input.

## 2 · Slices and exit conditions

Exit condition for EVERY slice: `pnpm tsc --noEmit` 0 · `biome check .` 0 · `pnpm vitest run`
(whole suite) green · `next build` green. A4 (`submit-baseline.test.tsx`) stays unedited and green;
RF-8 (`classic-layout-baseline.test.tsx`) stays 7/7.

| Slice | Content | Exit condition beyond the suite |
|---|---|---|
| P | this plan | committed before any code |
| S1 | register (RF-4/6/7 replaced verbatim, RF-10–12 appended, amendment line) + design-canon RF-9b (rule 5 + Composer entry; phone string list restored verbatim from `git show origin/main:docs/design/design-canon.md`, the canon as it stood before MIRROR-1) | before/after quoted in the run report |
| S2 | RF-4: `mirror-sizing.ts` rewritten to the new rule (pure); `TitleField` measures on a hidden clone, eases, starts focused | size-rule tests (placeholder 28, `Hello` 28, 125-char near 16 at the 1440 field, all-caps lower, floor 13); block 54; focus in the title |
| S3 | RF-6: detail field without ring, frame edge n2 → n3 on focus in the detail view; caption `Optional`; ×/Replace/Remove carry `outline-none`; the L6 programmatic focus passes `focusVisible: false` | render + source guards |
| S4 | RF-7: stake bar spacing + TO WIN treatment | render guards; real-browser gaps in S8 |
| S5 | RF-10: the re-save (`image-attach.ts`) + the jsdom image-pipeline shim for the component suites | `image-attach.test.ts` T3 section restated for RF-10; A4 unedited and green |
| S6 | RF-11: `submitDisabled` gains `image.phase === "attaching"` | both layouts, render tests |
| S7 | RF-12: the file input refuses while the drop handlers do; the MIRROR-1 audit repro becomes a guard asserting the FIXED behaviour | Replace race: the frame keeps A, the retry publishes A |
| S8 | real-browser harness (detached worktree, never committed): gaps, TO WIN, focus, title sizes, RF-10 end to end, RF-11, RF-12 | numbers in the report beside the baseline |
| S9 | `@code-reviewer` (whole diff) → `@security-auditor` (RF-10/11/12 + file input); fixes | declines logged; unreviewed-fix list kept |
| S10 | push `feat/mirror-1`; fast-forward `staging` only if `origin/staging` is an ancestor; staging-migrate, `/api/health` canary, PR CI | PR #574 unmerged |

Slices may merge into one commit where there is no shippable state between them (doctrine §2).

## 3 · File map

| File | Why |
|---|---|
| `docs/design/composer-mirror.md` | S1 — the brief's register text, verbatim |
| `docs/design/design-canon.md` | S1 — RF-9b (rule 5; Composer entry, phone list from git) |
| `src/components/debate/composer/mirror-sizing.ts` | S2 — the RF-4 rule as arithmetic over measured line counts |
| `src/components/debate/composer/MirrorComposer.tsx` | S2 title field · S3 detail focus + frame edge + button rings · S4 stake bar |
| `src/components/debate/composer/copy.ts` | S3 — `MIRROR_COPY.addImageCaption` → `Optional` (a Mirror-only string; no classic string changes) |
| `src/components/debate/composer/ImageAttach.tsx` | S3 — `outline-none` on the Mirror's Replace/Remove · S7 — the file input's refusal (both layouts) |
| `src/components/debate/composer/image-attach.ts` | S5 — RF-10 |
| `src/components/debate/composer/BetComposer.tsx` | S6 — RF-11's one gating term |
| `src/components/debate/composer/ComposerSlot.tsx` | *(added during the run, `b304ed63`)* — the desktop slot moves focus into itself on open, AFTER the composer's own focus, onto its first focusable control (the `×`); RF-4's "opens with the cursor in the title" needs the slot to honour an occupant's `[data-autofocus]` |
| `tests/unit/debate/render/mirror-host.test.tsx` | *(added during the run)* — RF-4's autofocus through the REAL host; a bare-composer test cannot see the slot's focus move |
| `tests/_setup/jsdom-image-pipeline.ts` (new) + `vitest.config.ts` | S5 — jsdom has no raster pipeline; the shim gives it a trivial one so a picked image can still attach in component tests (A4 cannot be edited) |
| `tests/unit/composer/mirror-sizing.test.ts` | S2 |
| `tests/unit/composer/render/mirror-composer.test.tsx`, `mirror-toggle.test.tsx` | S2–S4 |
| `tests/unit/composer/image-attach.test.ts` | S5 — the T3 fallback tests restated as RF-10 refusals |
| `tests/unit/composer/render/attach-preview.test.tsx` | S7 — the two replace tests pick twice DURING `attaching`, which RF-12's refusal now ignores; they advance to `attached` between picks (the realistic Replace path) |
| `tests/unit/composer/render/pick-race.test.tsx` (new) | S7 — the audit repro, asserting the fixed behaviour; plus RF-11 on both layouts |

NOT touched: `src/server/**`, `src/app/api/**`, `src/db/**`, `drizzle/**`, `limits.ts`, `payload.ts`,
`gating.ts`, `requests.ts`, `state-map.ts`, `idempotency.ts`, `envelope.ts`, every file under
`src/components/debate/phone/`, SPEC.1, SPEC.2, ADRs, `submit-baseline.test.tsx`. (`ComposerSlot.tsx`
was on this list at planning and is not any more — see the file map.)

## 4 · Baselines (measured before any change — numbers in the run report)

| Baseline | Layer |
|---|---|
| Full gate at `03dac591`: tsc 0 · biome 0 (20 warnings / 13 infos) · vitest 571 files, 5966 passed / 1 skipped / 4 todo · build 0 | the gate every slice is held to |
| Stake bar @1440 / @1280: every flex gap 12px, but the ink gap before the submit is 173.84 / 93.84px (limits column `flex-1`) | real browser, harness at the measured slot sizes |
| Title @1440: 16px at rest; 125-char all caps 13.5px; no autofocus (active element `BODY`) | real browser |
| Detail field focused: inset 2px ring; frame edge n3 at rest and focused | real browser |
| × after a MOUSE click: focused, `:focus-visible` false, no ring (the ruled outcome already holds in Chromium); by keyboard: ring + UA outline (positive control) | real browser, real CDP mouse events |
| RF-10: a 1200×800 GPS-tagged JPEG uploads its ORIGINAL bytes (sha = source, GPS IFD 4 tags); same for a PNG (eXIf + tEXt), a WebP, an AVIF, a corrupt JPEG, a forced encode failure and a hung decode (after 10.1s) | PUT body bytes, parsed |
| RF-11: PLACE enabled while the PUT is in flight | real browser |
| RF-12: the Replace race reproduced in a real browser — the frame shows B, the retry body carries A | real browser, intercepted file chooser |

## 5 · Guards

| Guard | Wrong answer it rejects |
|---|---|
| title size rule (pure) | a start below 28, a 1px step, no floor, line height ≠ ×1.25, a two-line fit taller than 53px, padding not centring |
| title render | the block leaving 54px; focus not in the title; the transition missing or not honouring reduced motion |
| detail focus | any ring/outline class on the detail field; the frame edge not lifting on focus |
| stake bar | a growing group (bunching); TO WIN without the small Đ |
| RF-10 | an original uploaded after any re-save failure; a GIF re-encoded; a PNG output that is not PNG; a sign before the re-save |
| RF-11 | PLACE enabled while `attaching` |
| RF-12 | a picked file drawn or signed while the composer is in flight |

Every guard is verified by reverting its fix and watching it red (OVN-V2); every negative carries a
positive control (OVN-V1). Mutations run against committed code only.

## 6 · Ambiguities — chosen, rejected, why

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | Three renders in `~/Downloads` (12:23 IST today) that the brief never names | O-6: declared. They illustrate RF-4, RF-6, RF-7; used as evidence only where the text is ambiguous | ignoring them; letting them override clear text | They are the founder-facing pictures of these exact rules |
| 2 | RF-7 "equal space between every pair … hairlines centred in their gaps" | the render's geometry: every drawn element (four groups, two hairlines) spaced equally (`justify-between` + `gap-3` as the floor) | three equal GROUP gaps with a hairline at the centre of the first two (the space before PLACE would be twice the hairline spaces) | The render measures 84/84/85/86/85 between every drawn element, and its caption calls that "equal spacing between every group". The brief's "four gaps" fits neither model (3 or 5); all five are measured and reported |
| 3 | RF-7 outer padding | today's `px-3` | the render's ~22px leading pad | The register is silent; the render's own "Now" row does not match the shipped padding either |
| 4 | RF-4 measurement | a hidden clone `textarea` (same element, classes, width; transition none) | the real field with the transition switched off | The brief allows either. The clone never touches the field being typed into — no caret, scroll or transition disturbance — and it can measure the placeholder, which a `scrollHeight` read of an empty field cannot |
| 5 | The title's focus ring once the composer opens focused | no ring on the title — the caret marks the place (RF-6's rule for the detail field) | keep the 2px ring | With autofocus the ring would show on every open without the author doing anything. Flagged for Gate C |
| 6 | Nothing fits two lines even at 13px | 13px, centred if the lines fit 53px, else top-aligned and the field scrolls | growing the block | RF-4 ⚠: the block never changes height |
| 7 | What eases | font-size, line-height and padding-top together, 150ms `ease` | font-size alone | Easing only the size would jump the centring |
| 8 | Buttons' keyboard ring | `outline-none` on the Mirror's ×, Replace and Remove, so keyboard focus shows the one shadow ring (the toggle, pick and submit already do) | leave the UA outline beside the ring | "a focus ring", singular; mouse clicks already show none in Chromium (measured) |
| 9 | The L6 programmatic focus (Safari clicks do not focus buttons) | `focus({ focusVisible: false })` | plain `focus()` | That focus only ever follows a pointer press; without the option WebKit would ring after a mouse click. NOT ESTABLISHED in WebKit here (Chromium-only harness) |
| 10 | RF-10 "keep each type's current output format — a PNG stays a PNG" | each file keeps the format it uploads as TODAY: a PNG ≤1600px stays PNG; a PNG over 1600px goes to lossless WebP as today; JPEG → JPEG 0.8; WebP → WebP 0.8 | every PNG → PNG (drops T3's WebP for large PNGs); every PNG → WebP (a small PNG would stop being a PNG) | Both halves of the sentence hold for every file; transparency survives in both formats |
| 11 | RF-10 and AVIF (not a GIF, so re-saved) | encode requested as AVIF; Chromium cannot encode it and returns its standard fallback, PNG (lossless, alpha kept); the real returned type is signed | WebP 0.8 (a format the register did not name, lossy); leaving AVIF untouched (the register excludes only GIF) | Closest to "keep the format" the platform allows. An animated AVIF, WebP or APNG now keeps one frame |
| 12 | RF-10 "refused with today's attach error" | decode/encode failure or timeout → `failed` (today's attach error: the retry line), no sign call; a re-save over the byte cap → today's `rejected`/`image too large` | a new message | "No new check": both are today's results for today's conditions |
| 13 | The size fallback (re-save not smaller → upload the original) | removed | kept | It uploads the original, which RF-10 forbids |
| 14 | A4 must stay unedited while jsdom cannot re-save | a jsdom image-pipeline shim in the test setup (decode → 1×1, encode → a small blob of the requested type); tests of the re-save stub their own pipeline | editing A4; a re-save that can be skipped | A skippable re-save is an upload-as-is path |
| 15 | RF-12 scope — "while a bet is being submitted" | the input refuses whenever the drop handlers already do: `disabled` (in flight, or C2) OR while an image is uploading | in flight only | The register's own goal — "the frame can never show an image other than the one being published" — is false under S-1 (a pick landing during a drop's upload) even with RF-11; the drop handler already used this condition, and one condition for every door is the existing rule |
| 16 | RF-11 and a stalled upload | PLACE stays disabled until the attach settles; no cancel control, no new network timeout | adding one (`@code-reviewer` M1 proposed a timeout) | The register gives neither, and a timeout needs a number: too short turns slow-but-working uploads — the phone tier's — into failures. CARRIED as a risk for a ruling |
| 17 | Where the slot's first focus lands | the occupant names it (`data-autofocus` on the Mirror's title; a disabled one is skipped) | the slot skips its move when focus is already inside | explicit, and the C2 state still lands on a working control |
| 18 | An eased step-down overflows the box for ~130ms (measured: the title jumped 23px and slid back) | hold the field at the top while the fitted text fits the box | snap on shrink and ease on grow (`@code-reviewer` M4) | RF-4's own words are "as the line fills, the size eases down"; holding keeps the ease and removes the jump |
| 19 | The Mirror buttons' outline | `focus-visible:outline-hidden` | `outline-none` (this run's first cut) | forced-colors mode drops box-shadows; a bare `outline-none` left no indicator there (`@code-reviewer` M3) |
| 20 | GIF pass-through by name | the GIF signature as well as the declared type; a declared GIF without it is re-saved as lossless PNG | the declared type alone | `File.type` comes from the extension: `photo.gif` holding a JPEG would upload its location data untouched |
