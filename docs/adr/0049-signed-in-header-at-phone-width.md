# ADR-0049 — The signed-in header at phone width: the Đ cluster drops, the chip becomes an avatar

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-08 |
| **Deciders** | Hrishikesh |
| **Tracker task** | MOBILE-1 (continuation; ad hoc, no tracker row) |
| **Frame documents** | ADR-0048, ADR-0045 (both partially superseded elsewhere), `tests/unit/shell/global-header-mobile-reflow.test.ts` |
| **Supersedes** | ⚠ **No ADR.** The position reversed here — that five header components "must stay visible at EVERY width" — was ratified at MOBILE-1 Phase A and recorded **only in a test guard's docblock and in plan documents**, never at ADR level. That is itself worth noting: a load-bearing visibility rule lived for a week in a place no ADR reader would find. |
| **Superseded-by** | — |

⚠ **ADR number read live at `origin/main` after `git fetch`** — `ls docs/adr/` ceiling is `0048-phone-responsive-auth-surfaces-and-the-focus-mode-row.md`; `0049` is next free. Not counted, not taken from project knowledge. **Re-read against the merged head before this PR lands, and say in the PR body that it was** — `ADR-NNNN` is filename-allocated so a concurrent mint produces an add/add conflict rather than a silent union, but this task has already paid for one collision.

---

## Context and Problem Statement

MOBILE-1 Phase A measured the `(public)` header at 375px and reported 394px of overflow reduced to zero. That measurement was taken **signed out**, as were all of Phase A's — signing in was not possible on the rig. Signed out, `DharmaCluster` returns `null` (no `spendable`) and `IdentityCluster` renders a compact JOIN button.

Signed in, both render substantially wider content and neither carries any responsive treatment. The result, latent since Phase A and surfaced by an operator screenshot on 2026-09-07: **the header overflows on every route for every signed-in phone user.** It was proven not to be Job A's by measuring the identical defect on a still-live pre-Job-A deployment — identical to 0.01px in every field.

Phase A also ruled, deliberately, that five components — `HeaderNav`, `RulesControl`, `BrandCluster`, `DharmaCluster`, `IdentityCluster` — stay visible at every width, with two guards enforcing it. **The fix therefore cannot hide; it must narrow, and narrowing means choosing what a signed-in phone user stops seeing.** That is a product decision, and it is the decision this ADR records.

This ADR does **not** decide: anything about `/admin/*`; any change above 640px except as §Residual states; any visual, brand or colour change; the implementation shape beyond the constraints in §Guards.

## Decision Drivers

1. **The information is relocated, not removed.** Tapping the avatar reaches the profile, where the balance, portfolio and pseudonym all render. This is the same argument that justified hiding the Discovery hero below 640px at Phase A — a founder-accepted principle, reused rather than invented.
2. **The measured budget is comfortable, not marginal.** Signed out the header has 10.75px of slack at 375px. After this change the signed-in right zone is the avatar alone.
3. **A second defect is fixed as a side effect** — see §The brand mark.
4. **Four green measurements in this task were structurally incapable of seeing the failure they were taken to rule out; Phase A's header sign-off was one.** This ADR carries verification requirements rather than leaving them to a plan.

## Decision Outcome

**Below `--breakpoint-mobile` (640px), on the signed-in `(public)` header:**

- **`DharmaCluster` is not rendered.** The portfolio and balance figures are reachable on the viewer's own profile.
- **`IdentityCluster` reduces to the avatar alone.** The pseudonym text is not rendered; the avatar remains the link to the profile.
- **`HeaderNav` (back, home), `RulesControl`, and `BrandCluster`'s mark are unchanged** and stay visible.

**Ratified by Hrishikesh on an informed basis.** The objection was put to him and accepted: a signed-in phone user browsing markets will not know their stakeable balance without navigating away from the market they are reading.

### The measured budget

| | width |
|---|---|
| back + home + RULES (left zone min-content, **measured, viewer-independent**) | 157.13 |
| gap | 18 |
| brand mark | 48 |
| gap | 18 |
| avatar alone (`data-[size=sm]:size-6`, carries `shrink-0`) | 24 |
| **total** | **265** in a **327px** content box |

⇒ ~62px of slack at 375px, against the 10.75px the header has signed-out today. If the chip wrapper survives carrying only the avatar, the right zone is 44px rather than 24px and the slack is ~42px. Either is comfortable.

### ⚠ The signed-in magnitudes are CONSTRUCTED, not measured

**No signed-in observation of this header exists.** Every signed-in figure on record was produced by injecting the two subtrees' verbatim source class strings into the live header. The 2026-09-08 recon attempted three paths and closed all three:

- **PR #509's Vercel preview** is alive and genuinely serves the code, but its `BETTER_AUTH_URL` is `https://staging.zugzwangworld.com` and `BETTER_AUTH_TRUSTED_ORIGINS` is unset on preview (`src/server/auth/index.ts:323–333`, and the `*.vercel.app` wildcard was rejected at plan review). ⛔ **And the harder blocker is Turnstile, which fires *before* the origin check** — measured: the OTP endpoint returns `turnstile_required` for both a preview origin and `evil.example.com`, so the two are indistinguishable there. **The OTP path is closed everywhere, not only on preview.**
- `list_connected_browsers` → `[]`.

**The figures this ADR uses:** header min-content **≈ 656–658px**, right-zone min-content **`R` ≈ 367–369px**. Stated as constructed.

⚠ **Their derivation matters, because a prior report gave two figures that disagree with each other.** It reported min-content 585px *and* a collapse threshold at ~608px. Under the measured model in §The brand mark those imply right zones 71px apart. Its own 608px agrees with the operator's visual read (~57% of viewport) to within 2px; its 585px agrees with neither. **The ~73px it flagged as unaccounted for is that internal inconsistency, not a missing element.** Which of the two is wrong is **NOT ESTABLISHED** and requires a signed-in render.

## The brand mark — a second defect, now measured, fixed here as a side effect

**Measured on the live build, signed out, with no injection**, by narrowing the frame:

| frame | mark width | document overflow |
|---:|---:|---:|
| 375 | 48.00 | 0 |
| 340 | 23.75 | 0 |
| 320 | 3.75 | 0 |
| **316 → 292** | **0.00** | **0** |
| 280 | 0.00 | 12 |

⛔ **From 292px to 364.25px the document reports zero overflow while the mark is partially or wholly annihilated.** No scrollbar, no error, the `<a>` and its `aria-label` still present and still measurable. The only evidence is that the logo is gone.

**The proximate cause, isolated by a live probe:** the mark computes `flex-shrink: 1`, `min-width: auto`, `width: 48px` — **no `shrink-0`**, unlike every other control in both side zones. Setting `flex-shrink: 0` on the live node restored it to 48.00px and converted the deficit into honest overflow (`header.scrollWidth` 300 → 340).

⇒ **The brand mark is the header's shock absorber.** The layout buys the absence of a scrollbar by spending the logo, silently and continuously. That is why the defect has no symptom.

**A model fitting every measured point exactly:**

```
mark(W) = clamp(0, 48, (W − 84) − L − R)
  84 = px-6 padding (48) + two 18px gaps (36)     [measured]
  L  = 157.133px, left-zone min-content            [measured, viewer-independent]
  R  = right-zone min-content                      [the only viewer-dependent term]
```

**Consequence of this ADR's change:** with `R` = 24px (or 44px), the mark renders a full 48px for all `W ≥ 313–333px`. **Annihilation is eliminated across the entire band where this change applies.**

## ⚠ Residual — and an open question for the founder

`max-mobile:` applies below 640px only. At exactly 640px the desktop render returns with the full signed-in right zone, so using the constructed `R ≈ 367`:

```
W = 640  →  mark ≈ 31.9px   (shrunk, not gone)
W ≈ 658  →  mark = 48px     (full)
```

⇒ **Roughly 640–658px the mark still renders shrunken.** This sits inside ADR-0048's already-ratified 641–860px accepted gap, so it is not new — but the *root cause is untouched*: the mark still has `flex-shrink: 1` inside `1fr auto 1fr` with side tracks that freeze at min-content, so **any future growth of the right zone above 640px re-opens this silently, with no overflow symptom.**

**RULED — leave the mark unpinned. Zero diff.** The alternative was one `shrink-0` token converting silent annihilation into honest overflow at every width; its cost is that the 640–658px band would then overflow horizontally rather than shrink the logo. The founder chose the shrunken logo over the scrollbar. The band sits inside ADR-0048's already-ratified 641–860px accepted gap, so this is not new territory.

⛔ **OI-A — the root cause survives, and it is the failure mode with no tell.** The mark keeps `flex-shrink: 1` inside `1fr auto 1fr` with side tracks that freeze at min-content. **If the right zone ever grows above 640px, annihilation returns silently — no scrollbar, no error, the `<a>` and its `aria-label` still present and still measurable.** Any future header work that adds to the right zone must re-measure the mark's computed width, because nothing else will report it. Carried as a named open item rather than a line in a consequences table, because a sentence in prose is not a mechanism.

## Guards — two constraints that point at the same place, and a hole between them

| | Assertion | Location | Effect |
|---|---|---|---|
| **G1** | `header-mobile::HeaderNav-RulesControl-BrandCluster-DharmaCluster-IdentityCluster-are-never-hidden` | `global-header-mobile-reflow.test.ts:936` | ⚠ **Conditional** |
| **G2** | `header-mobile::IdentityCluster.tsx-carries-no-responsive-token-at-all` | `…:1024` | **Reddens unconditionally** |
| **T4** | `orders-dharma-cluster-then-identity-then-divider-then-visitor` | `dharma-cluster.test.tsx:124` | **Constrains the shape** |

**G2 cannot be dodged** — reducing the chip must put a variant token or the prop into `IdentityCluster.tsx`. **Invert it, do not delete it** (the WARLI-MOUNT precedent ADR-0048:82 names). Its failure message still quotes the Phase B motive that ADR-0048 already reversed.

**⛔ G1 has a hole, and T4 pushes the implementation straight into it.** G1 reads **only `GlobalHeader.tsx`**. If the hide lands inside `DharmaCluster.tsx` on its own root, **G1 stays green while the component disappears** — the guard whose name promises *never hidden* would not see it. And T4 walks the right zone's **direct** children requiring `indexOf(cluster) >= 0`, so a wrapper `<div class="max-mobile:hidden">` makes the cluster a grandchild and reddens. **The two constraints point at the same shape.**

⇒ **This ADR requires that G1's `DharmaCluster` and `IdentityCluster` rows be inverted to assert the new position, whichever implementation shape Phase 1 chooses.** A guard must not remain green while the thing it names is hidden. Whether to close G1's file-scope hole generally is Phase 1's to propose and is not required here.

## O-5 — every site stating the superseded position

A durable amendment is applied at every site that states the superseded position. The recon enumerated them; **all are in scope for the implementing commit**, and the list is reproduced so none is dropped:

`global-header-mobile-reflow.test.ts` `:96`, `:100`, `:126–133`, `:961–964`, `:966–970`, `:997`, `:1045–1051` · `docs/plans/MOBILE-1-JOB-A.md:127–131` · `docs/plans/MOBILE-1.md:513`

⚠ **Two `src/` docblocks are measurably false and are corrected in the same commit:**

- `GlobalHeader.tsx:26` — *"equal side tracks keep the brand cluster absolutely centred."* **False below ~364px even signed out:** `1fr` is `minmax(auto, 1fr)`, the left track freezes at its 157.133px min-content, and all free space lands on the right — the mark measures **11.63px right of true centre at 375px**.
- `GlobalHeader.tsx:101–104` — three errors in one passage: 1440px figures presented without the width caveat that now matters; *"every control carries `shrink-0`"* is **false of the brand mark**; and the stated failure mode, hard overflow, is **not what happens** — the mark absorbs it silently instead.

⚠ ADR-0045 `:54` and `:63` state the Phase B CTA hide, already superseded by ADR-0048, which rules the corresponding PR *"leave it open; it will be deleted later."* Out of scope here; listed so the sweep is not re-derived.

## Verification requirements

1. **A document-level overflow check cannot see the mark defect** — it is zero across the entire 292–364px band. Assert the mark's own computed width.
2. **Verify utilities in the BUILT stylesheet after `just clean`, BY CLASS NAME, at `.next/static/chunks/*.css`.** Never `static/css/`, which does not exist here and whose glob does not expand under zsh, so grep never runs and the result is indistinguishable from a clean pass. ⚠ Tailwind v4 scans `docs/` **and `tests/`** — a guard asserting a class is present can emit that class itself, so assemble variant prefixes at runtime.
3. **The operator runs a real-phone check before merge.** ⚠ The written LAN-IP procedure in both MOBILE-1 plans **does not work**: `crypto.randomUUID` is secure-context-only and a LAN IP over plain HTTP is not one. Origin-dependent, not device-dependent.
4. **Desktop non-regression measured, not argued** — strip the tokens off the live nodes at ≥640px and assert byte-identity.

## Consequences

**Positive.** The header stops overflowing for every signed-in phone user on every route. Mark annihilation is eliminated below 640px. A visibility rule that lived only in a test docblock gets ADR-level standing.

**Negative.** A signed-in phone user does not see their stakeable balance while browsing — accepted, informed. The pseudonym is not visible in the header on phones. The 640–658px shrunken-mark band survives unless the founder rules to pin (§Residual). All signed-in magnitudes remain constructed.

**Neutral.** No new breakpoint, no new token beyond what already ships. Admin untouched.

---

*ADR-0049 ratifies dropping `DharmaCluster` and reducing `IdentityCluster` to the avatar below 640px on the signed-in `(public)` header, reverses Phase A's never-hidden ruling with the O-5 sweep above, records the brand-mark mechanism as measured, and rules the mark left unpinned with OI-A carrying the surviving root cause. Ratified by Hrishikesh on 2026-09-08.*
