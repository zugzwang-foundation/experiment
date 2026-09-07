# ADR-0048 — Phone-responsive auth surfaces; the phone-only tier made explicit

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-07 |
| **Deciders** | Hrishikesh |
| **Tracker task** | MOBILE-1 (continuation; ad hoc, no tracker row) |
| **Frame documents** | ADR-0045 (partially superseded — see below), `docs/design/design-language.md` §1 item 7 |
| **Supersedes** | ADR-0045 **in part** — the auth/join carve-out only. See §Supersession scope. |
| **Superseded-by** | — |

⚠ **ADR number verified live at `origin/main` `84d5756`** — `ls docs/adr/` ceiling is `0047-asymmetric-open-and-signup-pegged-liquidity.md`; `0048` is the next free number, announced to the founder before writing per the ADR-number rule. Re-read immediately before commit; other lanes allocate from this sequence, and this task has already paid for one collision (`0041`).

---

## Context and Problem Statement

ADR-0045 ruled two things. The first — responsive treatment of the participant read surfaces — shipped as MOBILE-1 Phase A (PR #486, `4133338`) and is live. The second — that auth and join surfaces are **gated on mobile rather than made responsive**, as a deliberate and indefinite exclusion — is now reversed by founder ruling. Mobile participants are to be able to sign up and log in.

That reversal is not a scope addition on top of ADR-0045. It contradicts ADR-0045's Decision text at three sites, and Phase A's shipped architecture actively enforces the position being reversed: the `mobileResponsive` prop defaults to `false` precisely so that `(auth)` routes cannot accidentally reflow, and a test guard asserts `(auth)/layout.tsx` does not pass it. Reversing this therefore requires a superseding ADR, not an amendment.

Two measurement passes (RECON 1, RECON 2, both against `origin/main` `84d5756` measured on staging with `canary` confirmed byte-identical) established what is actually broken. The result is narrower than "make the site responsive" and includes one defect nobody had scoped.

This ADR does **not** decide:

- Any change to the Discovery hero's phone behaviour — it stays hidden below 640px per Hrishikesh's Phase A ruling, unchanged
- Anything about `/admin/*` — structurally separate per ADR-0010, desktop-operator-only, untouched
- Any visual, brand, or colour change
- The disposition of PR #487 beyond recording the founder's stated intent (§PR #487)

## Decision Drivers

1. **The ADR-0038 tension in ADR-0045 disappears.** ADR-0045's Decision Driver 1 recorded that hard-excluding mobile knowingly traded against the 100k-signup target. Reversing the exclusion removes that trade entirely. This is the strongest argument for the reversal and should be recorded as such.
2. **The measured scope is four items, three of them small.** Four of the five surveyed surfaces are fixed by one shared change; one component and one layout row need real work; `/legal` is already correct.
3. **A single `max-mobile:` tier is a phone escape hatch, not a responsive design** — and RECON 2 measured exactly where that bites (§The 641–860px band). The founder has ruled phone-only. This ADR states that explicitly rather than letting "responsive" imply more than ships.
4. **Four separate green measurements in this task have been structurally incapable of observing the failure they were taken to rule out.** Phase A's `/m/[slug]` sign-off is the fourth. That is a verification-design problem, and this ADR carries verification requirements rather than leaving them to the plan.

## Supersession scope — precisely which clauses fall

**Superseded (ADR-0045):**

| Site | Text superseded |
|---|---|
| `:52` | *"§1.7 continues to apply as-is to auth/join surfaces … the constraint is narrowed, not repealed."* |
| `:113` | Constraint table — *"auth/join surfaces remain governed by the original constraint (they are gated, not made responsive)."* |
| `:55`, `:64` | The client-side hide and server-side reject of Join/Login on mobile — the gate's two layers |

**Not superseded — ADR-0045 otherwise stands in full:** the read-surface responsive decision, the `--breakpoint-mobile: 640px` token, the override-never-replace discipline, the ratified sign-in copy string, and the Discovery hero ruling. Phase A shipped against those and they remain correct.

⚠ **The server-side gate never reached `main`.** `device-class.ts`, the `route.ts` wrapper and the `tos-accept.ts` entry gate exist only on the unmerged `feat/mobile-1-phase-b` branch. There is nothing on `main` to unwind — this ADR reverses a decision, not a deployed mechanism.

## Decision Outcome

**Phone-responsive auth surfaces, at the existing `--breakpoint-mobile: 640px` tier. Phone-only. No new breakpoint is minted.**

### The four scoped items, measured

| # | Surface | Defect, measured at 375×812 | Fix shape |
|---|---|---|---|
| **1** | `/sign-in`, `/sign-in/otp`, `/onboarding` | **+379px document overflow, 100% of it `GlobalHeader`.** The cards already reflow correctly to 343px. `GlobalHeader.tsx:195` is `max-w-[1440px]` grid with every control `shrink-0`; min-content measures **754px**, and it reaches `(auth)` ungated. | Pass `mobileResponsive` at `(auth)/layout.tsx:189`. **One line, all three routes.** |
| **2** | `/u/[pseudonym]` | `PositionsTable.tsx:839,859,864,868` — `w-full table-fixed` with **324px of fixed columns** (Position 96 · Current 124 · Sell 104) inside **317px**. **The Argument column measures 0px.** The `ARGUMENT` and `CURRENT` headers overprint at l=137; the argument body renders at width 0, present in the DOM and invisible. 104 of 317px goes to a Sell column that is empty for a signed-out viewer. | A genuine narrow presentation — card rows, or a phone column set that drops Sell/Current. Not a width tweak. |
| **3** | `/m/[slug]?post=N` (**focus mode**) | `PostFocusHeader.tsx:136` — `flex min-h-0 flex-1 gap-4`, **a row at every width, carrying no breakpoint variant at all.** `DebateView.tsx:1040`, `:1235` and `MarketHeader.tsx:290` are the same shape and did receive `max-mobile:flex-col` at Phase A; this row was missed. | `max-mobile:flex-col` on `:136`, plus releasing the image arms' `shrink-0` at `:158`/`:162` under the same variant. |
| **4** | `/legal` | **0px overflow, zero offenders.** Already correct. | None. |

⛔ **Item 3 is why "the page measured 0px" was true and useless.** The card is `overflow-hidden`, so the clipping happens *inside* it and **document overflow stays exactly 0px** while content is destroyed. Two elements escape the clip ancestor (`Counter` button cut 24px → the operator's *"Cou"*; `Exited` badge cut 33px) and eight have `scrollWidth > clientWidth`. The width budget: 285px row − 147px image − 16px gap = **122px** for everything else; the identity row alone wants 140px, the footblock 162px.

⚠ **And it degrades in the wrong direction.** Both image arms are `shrink-0`, so 100% of the deficit lands on the text stack. The placeholder's width derives from the row's **height** (`self-stretch` + `aspect-[16/9]`), and in focus mode the band is 473px tall — so it demands 147px of a 285px row *regardless of viewport width*. Narrowing the phone makes it proportionally worse. The text stack is not at fault: it carries `min-w-0`, shrinks correctly to 122px, and `ArgProfile` already carries Phase A's `max-mobile:shrink max-mobile:flex-wrap`. **This is a row that must become a column, not a missing `min-w-0`.**

### The 641–860px band — ratified as an accepted gap

**`max-mobile:` covers `<640px`. The desktop layout's measured floor is ~860px. Nothing covers the gap.** Measured on `/m/sp-m12-fill` (list view): **+113px document overflow at 641px**, +54px at 700px, and at 768px the arena clips by 95px. At 641px the header also returns to its ungated 754px min-content on top of that.

**Founder ruling: phones only. The 641–860px band is a known, accepted gap and is not fixed by this ADR.** Small tablets and split-screen desktop windows render incorrectly. This is recorded plainly so that "mobile-responsive" is not read as "responsive" — the ADR ratifies a phone tier, not a responsive design.

### Discovery hero — unchanged

Stays hidden below 640px, per Hrishikesh's Phase A ruling. Content relocation via `MarketCard` as whole-card `Link` to `/m/{slug}` stands. ⚠ Item 3 above means that relocation currently lands the visitor on a surface whose focus mode clips — fixing item 3 is what makes the hero ruling's justification true again.

### Phase A architecture — the unwind

**Path (i), minimal, chosen:** add `mobileResponsive` at `(auth)/layout.tsx:189`. Reddens exactly **one** assertion — `global-header-mobile-reflow.test.ts:396–430`, `header-mobile::ONLY-the-public-layout-mount-passes-mobileResponsive`, whose `:423-429` asserts `(auth)/layout.tsx` does not match `/\bmobileResponsive\b/` with a failure message quoting ADR-0045 verbatim. **Invert it, do not delete it** — the WARLI-MOUNT precedent, as Phase B did for the `IdentityCluster` row.

**Path (ii), deleting the prop entirely, is rejected for now.** It touches five files and reddens ~8 assertions including three `= false` default pins. Once auth is responsive the prop guards nothing, so (ii) is the correct end state — but it is cleanup, not this task, and the date does not favour it. Recorded so the omission is not read as an oversight.

⛔ **`global-header-mobile-reflow.test.ts:983–990` MUST NOT be unwound with the rest.** It asserts `(auth)/layout.tsx` contains no `OnboardingDeck` string, and its stated reason is **D-4** — a signed-out visitor writing the completion marker would suppress their own first-login deck later. It has nothing to do with responsiveness. Its sibling at `:971-977` *is* a Phase A pin. A bulk revert of that file breaks D-4 silently.

⚠ **The file's 89-line docblock (`:5–89`) becomes a false record**, not merely stale — `:23-34` and `:26-28` quote ADR-0045's *"gated, not made responsive"* as live doctrine. It must be rewritten in the same commit, per O-5.

## Consequences

### Positive

- ADR-0038's 100k-signup target is no longer traded against.
- The measured work is small: one line covers three routes; `/legal` needs nothing.
- Item 3 fixes a defect that existed before this reversal and was invisible to the check that cleared it.

### Negative

- **The 641–860px band stays broken**, by ruling. Accepted, not mitigated.
- `PositionsTable` needs a genuine narrow presentation, which is design work, not a width tweak.
- The Phase B branch's work — classifier, both server gates, four client hides, SPEC.1 riders — becomes dead. Recorded under §PR #487.

### Neutral

- No new breakpoint, no new container preset, no new frame. Everything reuses `--breakpoint-mobile`.

## ⚠ Not measured — stated rather than assumed

Three cases are unverified and each is plausibly worse than what was measured:

1. **A post with a real image attachment.** None exists on staging — every post renders the `POST IMAGE · 640:586` placeholder via `PostCard.tsx:264-266` / `PostFocusHeader.tsx:161-162`'s `else` branch. The real-image arm (`:158`) is `shrink-0` in the same non-stacking row, so it inherits the failure **by construction, not by measurement**. `CommentImage` is height-bounded and `w-fit`, so it may be *wider* than 147px and fail worse. **Owed: one attachment on a staging post, then re-measure.**
2. **Signed-in focus view.** The composer and owner-only controls add content to the same 122px stack. Very likely worse. Unmeasured.
3. **Posts with replies.** Every staging market has 0 replies; the reply-card path under a focused post is untested at any width.

## Verification requirements — carried here because four green signals have already failed

1. **Measure inside the card, not the document.** A `documentElement.scrollWidth` assertion reports green on item 3 by construction. Any guard for focus mode must assert against the clipping ancestor's box or the child elements' `scrollWidth`/`clientWidth`.
2. **Verify utilities in the BUILT stylesheet after `just clean`, by class name.** Never after a warm build, never by grepping `640px` or `coarse`. Phase A shipped inert through a restored Vercel build cache; Phase B reproduced it. `/api/health`'s `canary` is `VERCEL_GIT_COMMIT_SHA` — a label on the commit, never derived from the compiled tree — and structurally cannot detect this.
3. **The rotation test belongs in the Gate C checklist.** Open the surface on a real phone and turn it sideways. Five seconds; it caught the Phase B cache failure when nothing automated could.
4. **Measure against content that exercises the failing path.** Every failed measurement in this task shared this shape: an empty database, a document-level probe, a warm build, a list view instead of focus mode.

## PR #487 — recorded intent

Founder ruling: **leave it open; it will be deleted later.** Its diff does the opposite of this ADR — it hides the JOIN CTA and refuses mobile auth server-side.

⚠ **Recorded risk, not a re-litigation:** PR #487 is `MERGEABLE`, CI-green, and this repository has no branch protection (CLAUDE.md §5.13). Nothing mechanically prevents an accidental merge, which would silently kill mobile signup. Converting it to **draft** costs nothing, preserves every commit, and makes that impossible. Offered once; the founder's ruling stands either way.

## Spec impact

- **Same-commit SPEC.2 update required** — ADR-0045:128 mandates it on supersession, per SPEC.2 §0's versioning policy. SPEC.2 is **1.0.29** at `origin/main`.
- ⚠ **SPEC.2 §0's own preamble is 8 ADRs stale** — it reads *"ADRs 0003–0039 (37) folded … the on-disk ADR ceiling is `0039`"* against a live `0047`. Correct it in the same pass; the same line already says *"Read `ls docs/adr/`; never take a ceiling from this line."*
- ⛔ **SPEC.1 was rebaselined to 2.0.0** (2026-09-06, D-29). §17–§19 and §21–§23 are **intentionally absent**, numbering retained. **ADR-0045 and the guard docblocks cite `SPEC.1 §21.9` for the RULES re-show — that section no longer exists.** Re-anchor every §21.x citation before this ADR or any plan carries it forward.
- **`design-language.md` §1 item 7 still reads flat "desktop-only, no responsive variants"** at `:44`, with `:112` and `:260` stating the same position. The Block C amendment drafted for ADR-0045 never landed and is now stale twice over — it narrowed §1.7 to read surfaces only, which this ADR supersedes. **It must be redrafted against this ADR's scope, not ratified as written.**

## More Information

- RECON 1 (`zz_MOBILE-1-RECON_phase-recon_2026-09-07T1620.md`) — the five-surface survey and the Phase A unwind map
- RECON 2 (`zz_MOBILE-1-RECON2_phase-recon_2026-09-07T1647.md`) — ADR ceiling, focus-mode measurement, the 641–860px sweep
- ADR-0045 (partially superseded), ADR-0010 (admin separation), ADR-0038 (100k target)

---

*ADR-0048 supersedes ADR-0045's auth/join carve-out, ratifies phone-responsive auth surfaces at the existing 640px tier, scopes the work at four measured items, and records the 641–860px band as an accepted gap. Ratified by Hrishikesh on 2026-09-07.*
