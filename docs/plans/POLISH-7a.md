# POLISH.7a — Auth surfaces · THE COMMITTED PLAN

> **Doc:** `docs/plans/POLISH-7a.md` · **web-authored, CC-committed VERBATIM.**
> **Status:** v1.0 · ratified 2026-08-11 IST.
> **Governed by:** `POLISH-0.md` (method) · `POLISH-SURFACE-TEMPLATE.md` (runbook). Neither is restated here and neither is overridden. If this file and `POLISH-0.md` disagree, `POLISH-0.md` wins and this file is the defect.
> **Recon ground:** `origin/main` @ `903b2a1516d3e1266b8a74942b7ba0fc59ee6e58` (#319). Every `file:line` below is the recon's, measured at that SHA.
> **⚠ THIS PLAN OUTRANKS ANY RELAY.** Where a relay disagrees with this file, CC **HALTS and quotes** — it does not follow the relay and repair at review. That rule fired at PRIMITIVES-2 PR-B and the missing item was load-bearing.
> **⚠ Every counted claim in this file is measured at the recon SHA and is re-verified at PR HEAD before the log is committed.**

---

## §1 · Scope, in one paragraph

`.7a` inspects the **card content** of `/sign-in`, `/sign-in/otp` and `/onboarding` against tier-4 `DESIGN_W2_1_auth-modal_mockup-v0_3.html`, tier-4 `DESIGN_W2_11_state-kit_mockup-v0_1.html`, tier-3 `docs/plans/UI-A7.md`, tier-2 `design-canon.md` §7 item 9 + `DESIGN_W2_1_CLOSE-OUT.md`, and tier-1 SPEC.1 §13 · ADR-0004 · ADR-0033 · ADR-0023 (both patch records). The shell — `(auth)/layout.tsx`, `GlobalHeader` and cluster, `PageContainer` — is **POLISH.1's** and is not inspected here. `src/components/debate/composer/AuthGateSlot.tsx` is **POLISH.4's** and is not touched, including its `text-n4` micro-label at `:49`.

**Twenty-one deltas were classified at recon. Eight build. Thirteen hold.** Twelve class-S corrections to the method corpus and ten `parked.md` rows land in the same PR, per `POLISH-SURFACE-TEMPLATE.md` §2 (*"A FALSE finding here is a real deliverable. File it and correct `POLISH-0.md` in the same PR"*) and §12's same-commit rule for routing destinations.

---

## §2 · The rulings — RATIFIED 2026-08-11

Seven rulings were taken at ratification. Each is binding on this run and on the documents it names.

| # | Ruling | Effect |
|---|---|---|
| **R-A** | **`.7a` OWNS D19.** `docs/logs/POLISH-1b.md:92,94,136` assigns the `my-auto` centring defect to `.7a` by name three times and directs an upstream-only fix. `POLISH-0.md:150` places the upstream file in POLISH.1. **The log wins on specificity**: it names this surface, the defect and the fix shape; the inventory names only a file. `.7a` takes it, **and pays for the boundary crossing with the §8.2 per-consumer zero-delta proof in §7 below.** `POLISH-0.md`'s new `.7a` Components cell names `src/app/layout.tsx` as in-scope-by-ruling with this reason |
| **R-B** | **D16 routes OUT to `AUTH-ONBOARDING-GATE`, dated pre-go-live.** `SPEC.1:777` requires Continue disabled until the checkbox is ticked and `:805` spec-locks it. `UI-A7.md:76` ratified no new client boundary on that page. Tier 1 wins on precedence — tier 3 was void on this point from the day `:805` landed — but the fix needs client state around the acceptance form, which is **H2** on a submit path. ⚠ **Not unsafe today**: `required` blocks submission and `acceptTosAction` re-checks server-side, so acceptance evidence is sound. It is a fidelity gap, dated, not an emergency |
| **R-C** | **`(auth)/error.tsx` YES · `(auth)/loading.tsx` NO.** An uncaught throw on first login currently escalates to `global-error.tsx`, the whole-document boundary — a real gap, cheaply closed. A route-group `loading.tsx` would blanket the two client pages that render instantly; that is POLISH.2's own reasoning at `page.tsx:28-30`. If a loading state is later wanted for `/onboarding`'s DB read it belongs in-page as `<Suspense>`, which is a different task. The omission is recorded with the precedent cited |
| **R-D** | **`AUTH-CONSENT-LINE` is STRUCK**, with four grounds recorded: the page-level footer was withdrawn 2026-08-02 (B4 void, `SPEC.1` v1.0.26 `:1498`); `/terms` and `/privacy` do not exist so links would be dead (`docs/logs/UI-A7.md:15`); `tests/unit/shell/not-found.test.tsx:108–167` would go RED on a page-level footer; and `SPEC.1:807–817` replaced implicit acceptance with the explicit checkbox, calling it *"the stronger answer to the acceptance-evidence question."* It had exactly one occurrence tree-wide and no definition — a phantom, closed rather than defined |
| **R-E** | **`LEGAL.1` is the canonical name** for the ToS/Privacy bodies. `HARDEN.6` and `HARDEN.7` are annotated as aliases. ⚠ **It is a GO-LIVE GATE, not a polish item** — it carries the acceptance-gate text SPEC.1 requires evidence for, the version label (D17), **and the AGPL §13 source offer relocated into the ToS body at B4's void.** Its own chat, alongside MOD-REPORT-PATH |
| **R-F** | **D10 + D11 route to `AUTH-OTP-FIDELITY`, CO-EXECUTED with `AUTH-ERROR-COPY`** on the same file. Three separate critical-path rituals on `otp/page.tsx` is three times the ceremony for one diff. ⚠ The cooldown is not cosmetic in a second way: without it, a user mashing Resend hits `otp_rate_limited` — a raw code rendered to a user, which is `PD-0-15` itself. The two defects are one user experience. `AUTH-ERROR-COPY` keeps its name (tier-1-named at `ADR-0033:29`); the co-execution is noted in both rows |
| **R-G** | **The batch lever is PULLED for `.5` · `.6` · `.8`.** `.7a` cost four founder-serial touches against `POLISH-TRACKER.md:149`'s budget of two. Recon and classification for those three surfaces are drafted concurrently and ratified in ONE session. **Execute stays SERIAL — one machine-phase PR open at a time — and Gate C never batches.** Not applicable to `.3` or `.4`, which take the full ritual and still need SPEC.CHART and MOD-REPORT-PATH resolved first. ⚠ Recorded at the `.7a` CLOSE-OUT as a `POLISH-TRACKER.md` §5/§6 amendment, **not in this PR** |

### §2.1 · Three recommendations revised at ratification — build LESS, prove MORE

Recorded because a later reader will otherwise find rows that were recommended for build and shipped held, and assume they were dropped (`POLISH-SURFACE-TEMPLATE.md` §4.2 **S2**).

1. **D02 (the Google mark) was recommended for build and is now HELD.** A coloured Google mark violates DESIGN.B1's ratified TRUE-NEUTRAL system and is CI-guarded by `tokens-monochrome.test.ts`. A monochrome or custom "G" is a *modified* Google mark, which Google's sign-in brand guidelines address and which cannot be adjudicated from inside this run. The intersection of a ratified internal constraint and an unverified external one is not a machine-pass call. New row: **`AUTH-GOOGLE-MARK`**.
2. **D08 (the OTP headline) was recommended for build and is now HELD as `superseded`, ground S3.** The mockup's head is *"Enter the code sent to **`<address>`**"* — a static echo. D09 records that tier-3 `UI-A7.md:98` pins an **editable** email field above the code input. The address is therefore already on screen as a control; echoing it in the headline duplicates it, and *"Enter the code sent to"* without the address is broken English. §4.2 **S3**: *"A supersession removes the only thing that made a mockup value resolvable → do not port it. There is nothing to port."*
3. **The `no-raw-hex-view-layer` reach fix was recommended as an opportunistic docket row and is now IN THIS PR.** This PR *edits all three of the files the guard cannot read* and *adds new ones beside them*. Landing edits into a known blind spot, having just documented the blind spot, is the N8 failure committed deliberately. It is one line, PRIMITIVES-1 C4(b) set the precedent, and **H15**'s RED-first obligation is discharged in §5.

**Build set: 10 → 8.** For a first machine run whose stated job is calibration, that is the correct direction.

---

## §3 · The ratified delta table

| ID | What | Class | Verdict | Ground |
|---|---|---|---|---|
| **P7a-D01** | Card title → "Continue to Zugzwang" | V | **BUILD** | §4.2 B2. Tier 4 `auth-modal:313`; higher tiers silent |
| **P7a-D02** | Google `.gmark` circular mark absent | V | **HOLD** → `AUTH-GOOGLE-MARK` | §2.1 (1) |
| **P7a-D03** | Email entry stacked; mockup is a flex row | V | **BUILD** | §4.2 B1. Tier 4 `:154`, `:318`. Non-token layout, §6 fair game |
| **P7a-D04** | Submit copy "Send code" → "Continue" | V | **HOLD** → `AUTH-TURNSTILE-WIRE` | §4.2 **S2**. The mockup's "Continue" advanced to a Turnstile pane that does not exist; the built control sends immediately. Porting the label would make it lie. New ground stated |
| **P7a-D05** | `.mfoot` Terms · Privacy line absent | — | **SUPERSEDED** | Four sources agree the absence is correct. Closes with **R-D** |
| **P7a-D06** | Turnstile pane unbuilt | — | **DATA-BLOCKED** | Duplicate-of-known → `PD-0-14` |
| **P7a-D07** | `.otp-icon` ✉ ring absent | V | **BUILD** | §4.2 B2. Tier 4 `:361`, CSS `:208` |
| **P7a-D08** | OTP head copy | — | **SUPERSEDED** | §2.1 (2), ground **S3** |
| **P7a-D09** | Static address echo vs editable field | — | **SUPERSEDED** | Tier 3 `UI-A7.md:98` beats tier 4 |
| **P7a-D10** | Single field vs 6-box segmented input | V | **HALT → R-F** | `UI-A7.md:99` pins the single-field binding byte-for-byte. **H2** |
| **P7a-D11** | Resend has no cooldown | F | **HALT → R-F** | Gates how often `sendVerificationOtp` fires against the server's own limiters. **H2** |
| **P7a-D12** | Phishing line not verbatim | V | **BUILD** | §4.2 B1. Tier 4 `:371`. One string |
| **P7a-D13** | "Secured by Cloudflare Turnstile" absent | — | **SUPERSEDED** → lands with `AUTH-TURNSTILE-WIRE` | `docs/logs/UI-A7.md:15`. Restoring it before Turnstile is wired would be a false claim to the user |
| **P7a-D14** | Back link placement + copy | V | **BUILD — POSITION ONLY** | Tier 4 `:360`, CSS `:170–174`. **Copy stays "Back to sign in"** — porting "‹ Back" degrades the accessible name A11Y.0 would then re-fix. §4.2 B3, flagged at Gate C |
| **P7a-D15** | Inline message vs bordered callout | — | **SUPERSEDED** | Tier 3 `UI-A7.md:136` maps it to the W2.11 callout treatment |
| **P7a-D16** | Continue not disabled until ticked | **F** | **HALT → R-B** | Tier-1 spec-locked `SPEC.1:777`/`:805`, assigned here by `:817`. **H2** |
| **P7a-D17** | Version footer lacks the version label | V | **DATA-BLOCKED** → `LEGAL.1` | Unjudgeable until real versions exist |
| **P7a-D18** | ToS/Privacy bodies are lorem ipsum | — | **DATA-BLOCKED** → `LEGAL.1` | Pre-recorded, `POLISH-0.md:174` |
| **P7a-D19** | Cards top-align at 92px, not centred | **F** | **BUILD — R-A**, under §7's proof | Tier 3 `docs/logs/POLISH-1b.md:92` (measured: card top at 92px, not 484px) |
| **P7a-D20** | No `error.tsx` on `(auth)` | **R** | **BUILD — R-C**, `error.tsx` only | Tier 2 W2.11 kit · `POLISH-0.md:450` §7 criterion 4 |
| **P7a-D21** | `role="alert"` callout hand-duplicated | V | **BUILD — conditional, see §4** | Tier 2 W2.11 — one state, one primitive. The `PD-0-10` root cause |

**8 BUILD · 6 SUPERSEDED · 3 DATA-BLOCKED · 4 HALT-AND-ROUTE.**

### §3.1 · Deliberately not in the table

Named so a later reader sees they were considered, not missed: every modal-chrome element (`.overlay`, `.modal`, `.mclose`, Esc, backdrop-dismiss — `auth-modal:307–309`), superseded by `POLISH-0.md:99` / `UI-A7.md` ruling 1 · the `pane-ok` success pane (`:376–382`), same supersession · **every value in either mockup** (`UI-A7.md:157` WI-1 + template **F2**/**F3**/**H13**) · everything in `DESIGN_W2_1_first-login-journey_mockup-v0_1.html`, which depicts `.7b`'s deck per `UI-A7.md` §6.1 · all responsive and viewport findings (`POLISH-0.md:454` **G1**, desktop 1440 only).

---

## §4 · Execution notes, per built row

**Read before writing any of them.** Every row below is presentation. **No file under `src/server/**`, no handler, no submit path, no argument-required gate, no migration, no event type, no ADR and no SPEC edit is touched by this PR — hard floor F4, §6, H7.**

### D01 · Card title
`src/app/(auth)/sign-in/page.tsx:88` → `"Continue to Zugzwang"`, matching tier-4 `auth-modal:313`. Check `tests/unit/auth/sign-in-render.test.tsx` for any assertion pinning the current string; the recon reports its DRIVER cases assert presence, not treatment — **re-verify at PR head rather than trusting that.**

### D03 · Email entry as a flex row
`src/app/(auth)/sign-in/page.tsx:113–129`. Baseline tier-4 `:154` — `.emailrow{display:flex;gap:9px}`.
- Input takes the remaining width; the submit button is intrinsic and does not shrink.
- The gap is a **hardcoded layout value**, explicitly fair game under §6. `9px` ports as a literal; it is not a colour token and **F2/H13 do not apply.**
- ⚠ The container is `PageContainer preset="auth"` = `mx-auto w-full max-w-md px-4 py-8` (`PageContainer.tsx:39`). Confirm the row fits at that width with the built `"Send code"` / `"Sending…"` labels before shipping. If it does not, **HALT and report** rather than shortening the label — that would silently absorb D04, which is held.

### D07 · The OTP icon
`src/app/(auth)/sign-in/otp/page.tsx:119–122`. Baseline tier-4 `:361`, CSS `:208`.
- Read `:208` for **geometry only** — size, radius, ring width. **Do not port a single token name or colour value from it** (WI-1 / **F2** / **H13**). The mockup is pre-BRIDGE light-theme against an inverted dark ramp.
- Colours resolve against the live contract: `--color-n*` neutrals and `--hairline` for the ring.
- Use the repo's existing icon source (Lucide, per the ratified icon set). `aria-hidden` — it is decorative and the title beside it carries the meaning.

### D12 · The phishing-safety line
`src/app/(auth)/sign-in/otp/page.tsx:185,189–190` → the tier-4 wording at `auth-modal:371` **verbatim**. The build's own comment already calls it design-source copy, so this is a transcription defect, not a design change.

### D14 · Back link position
`src/app/(auth)/sign-in/otp/page.tsx:176–181`. Baseline tier-4 `:360`, CSS `:170–174`.
- **Position only. The copy stays `"Back to sign in"`.**
- The mockup's `.backlink` sits at the top-left **of the OTP pane**, and the pane corresponds to the built `Card` — so it moves to the **top-left inside the Card, above `CardTitle`**, not above the Card in the page container. That mapping is a §4.2 **B3** call: ship the defensible option, log it, **request a ruling at Gate C.**
- It stays a `next/link` `Link`. Its accessible name does not change.
- ⚠ This reorders the DOM. Check `tests/unit/auth/otp-render.test.tsx` for any order-dependent assertion at PR head.

### D21 · The duplicated alert callout — CONDITIONAL
`sign-in/page.tsx:147` and `otp/page.tsx:152` carry an **identical** class string (`rounded-(--r) bg-n1 px-3 py-2 text-sm text-ink [border:var(--hairline)]`), one as a file-local component, one inline.

**Step 1 — check first, in this order, and report which branch was taken:**
1. Does the W2.11 state kit's locked P1–P7 primitive set already carry an alert/error primitive under `src/components/ui/`? **If yes → ADOPT it.** That is the `PD-0-10` lesson: adopt, never patch.
2. If no → mint the component **locally under `src/app/(auth)/`**, colocated. ⚠ **Never as a new `src/components/ui/` primitive** — that is §4.2 **C2**, requiring a preset defaulting to today's render and a zero-delta proof across consumers that do not yet exist. A new shared primitive is not in this PR's edit boundary.

**Step 2 —** whichever branch, both call sites end up on one implementation and the rendered output is **byte-identical** to today's on both pages. Prove it (§8.2 byte-identical, not visually identical) — a first draft once emitted the same classes in a different order and passed by eye.

### D20 · `src/app/(auth)/error.tsx` — R-C
- A Next.js error boundary **must** be a client component. `"use client"` here is a framework requirement, not new logic, and does not engage `UI-A7.md:76`'s no-new-client-boundary ruling, which is scoped to `/onboarding`'s card.
- Baseline: tier-4 `DESIGN_W2_11_state-kit_mockup-v0_1.html` (the third tier-4 source S-04 adds to the row) and the established family — read `src/app/global-error.tsx` and `src/app/(public)/not-found.tsx` and match them. Template §11: *"do the states feel like one family."*
- Must accept and render the standard `{ error, reset }` props and expose the `reset` affordance.
- No error message, stack, digest or cause is rendered to the user.
- ⚠ **No new `loading.tsx`** — R-C. Record the omission in the log with POLISH.2's `page.tsx:28-30` precedent cited.
- ⚠ Adding a file to `src/app/(auth)/` only increases `tests/unit/shell/not-found.test.tsx:136–138`'s alive-check count, which is a `>=` assertion. Confirm rather than assume.

### D19 · The centring fix — R-A · ⚠ HIGHEST BLAST RADIUS IN THIS PR
**The defect:** the Cards declare `my-auto` (`sign-in/page.tsx:86`, `otp/page.tsx:118`); the `(auth)` wrapper's `min-h-full` (`layout.tsx:36`) has no definite basis because `<body>` is `min-h-full` with used height `auto` (`src/app/layout.tsx:31`), so `margin-block: auto` resolves to zero. Measured at 92px instead of 484px (`docs/logs/POLISH-1b.md:92`).

**CC determines the minimal upstream change. It is not specified here, because specifying CSS I have not read is how a plausible mechanism gets accepted without verifying the artifact (§9.2).** These constraints are binding and a violation of any one is a **HALT**:

| | Constraint |
|---|---|
| **K1** | **Exactly ONE node changes.** If the repair needs two, HALT and report — that is the two-fix degradation `POLISH-1b.md:94` warns about and it means the flex chain has already been broken somewhere |
| **K2** | **No `flex-1` is removed anywhere**, and **no flex node is flattened to a block context.** `POLISH-1b.md:94` pins `flex-1` on `<main>` by name in a test precisely because deleting it is invisible today and silently defeats this repair forever |
| **K3** | The change is **upstream-only** — at or above the `(auth)` wrapper. The `my-auto` declarations on the two Cards are **not touched** |
| **K4** | Every existing test is green **before** the commit, on the uncommitted tree |
| **K5** | The §7 per-consumer proof holds for **every** route family, with no exception granted |

**Report in the log:** the node changed, its before and after value, the mechanism in one sentence, and the measured card-top position before and after on both `/sign-in` and `/sign-in/otp`.

⚠ **Its own commit**, after the presentation commits and before the doc commits. A regression must bisect to it in one step.

---

## §5 · The guard reach fix — `no-raw-hex-view-layer.test.ts`

**The finding.** The guard's docstring (`:5–6`) claims *"the participant view layer."* Its input set (`:20`, `:26–36`) is `src/components` + `src/app/(public)` + four named files, of which the only `(auth)` entry is `layout.tsx` — **POLISH.1's**. All three of `.7a`'s route files are outside it. `UI-A7.md:213` made this guard an exit criterion for the skin and `docs/logs/UI-A7.md:28` reported it discharged with *"zero raw hex."* **The guard could not read the three files the skin changed.** The green run was true and blind — **N8 / V-6** exactly.

**The fix.** Add the three route files to `SCAN_FILES`, each with a comment saying why, exactly as PRIMITIVES-1 C4(b) did for `src/app/layout.tsx` (`:30–35`).

**⚠ H15 — a new guard line must be RED first. Discharge it on RULE-1's three axes and state each mutation with its RED count. Never claim a mutation; run it.**

| Axis | Mutation | Expected |
|---|---|---|
| **①** member ADDED | Insert a raw hex into `src/app/(auth)/sign-in/page.tsx` — a file now **inside** the set | **RED**, n failures stated |
| **②** member REMOVED | Delete one of the three new `SCAN_FILES` entries and re-run the alive check at `:69–71` | Behaviour stated with its count |
| **③** ⚠ **a member the census never looks at** | Insert a raw hex into `src/app/(auth)/onboarding/page.tsx` — the file the docstring's *"participant view layer"* claim covered and the input set did **not** — **BEFORE** enrolling it | **GREEN** before enrolment, **RED** after. This is the only axis that tests REACH. ①/② test membership |

**Capture every RED before any fix is written and paste the counts into the commit body.** Revert each mutation immediately.

**⚠ H14 applies in the opposite direction from usual.** We are narrowing a blind spot, not widening an allowlist. But **if enrolment reveals an actual raw hex in any of the three files, HALT and report — do not remove it silently.** The recon read all three and found none; re-verify at PR head, because a counted inventory goes stale inside one PR.

**Do not touch `tokens-monochrome.test.ts`.** Its stated reach and actual input set agree — it is a definition guard over `globals.css`, not a usage guard, and **H8 cannot fire on a usage-only pass.**

---

## §6 · Documentation corrections — twelve class-S rows

**Prescriptive text. Apply VERBATIM. HALT and quote if any anchor does not match byte-for-byte at PR head** — the anchors below were read from a mirror at `35d041d`, and the live files are at `903b2a1`.

### S-01 · `POLISH-0.md` — the `.7a` row gains a Components cell and five corrections

Replace the whole `### POLISH.7a · Auth surfaces` block with the following. Every other cell not shown below is preserved unchanged from the live file.

- **Insert a new `Components` row** immediately after `Surface`, reading:

  > | **Components** | `sign-in/page.tsx` (+ its file-local `AuthError`) · `sign-in/otp/page.tsx` · `onboarding/page.tsx`. ⚠ **`(auth)/layout.tsx`, `GlobalHeader` and cluster, `PageContainer` and `src/app/layout.tsx` are POLISH.1's** (`:150`) and are not inspected here — **with ONE exception ratified at POLISH.7a R-A: `src/app/layout.tsx` is in scope for `P7a-D19` only**, because `docs/logs/POLISH-1b.md:92,94,136` assigns that defect to this surface by name and directs an upstream-only fix. `src/components/debate/composer/AuthGateSlot.tsx` is **POLISH.4's** (`:217`) |

- **`Tier 4`** — append `· `DESIGN_W2_11_state-kit_mockup-v0_1.html` (card spec + the four state treatments — `UI-A7.md:132`, `:231`)`, and annotate the first-login mockup: `⚠ `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` depicts the post-session 6-card DECK — **POLISH.7b's artifact** — and its cards are literal `PLACEHOLDER` strings. `UI-A7.md` §6.1 rules the onboarding card defaults to the auth-card visual language. **File no delta from it.**`
- **`Tier 3`** — replace `Ruling 4:` with `§6 · WI-1 (`UI-A7.md:157`):`. **`UI-A7.md` has three rulings; there is no ruling 4.** The substance is unchanged and remains binding.
- **`Tier 2`** — append `· `DESIGN_W2_1_CLOSE-OUT.md` — the CD close-out is a tier-2 source (`:73`) and is the origin of *"one picker behind all triggers"* (`:55`), *"R1 silent identity"* (`:59`) and the OTP lock (`:60`); `design-canon.md:126` carries neither of the first two`. And annotate: `⚠ **The F-AUTH-4 override cited here LAPSED 2026-08-04** — `SPEC.1.md:807–817`: the sync was never performed, the footer was withdrawn 2026-08-02 removing the override's mechanism, and §13 F-AUTH-4 stands unamended. **Tier 1 wins.** `/onboarding`'s baseline is the inline-scrollable acceptance screen with an explicit checkbox. `design-canon.md:126` still carries the override unannotated — design-lane, not POLISH's.`
- **`Tier 1`** — append `⚠ `SPEC.1.md:817` assigns F-AUTH-4's build-conformance verification to THIS SURFACE by name. Discharged at `P7a-D16` → `AUTH-ONBOARDING-GATE`.`
- **`Pre-recorded`** — correct `rate_limited` to `otp_rate_limited` (S-11), and append: `· **Three carry-forwards route here from `PRIMITIVES-1.md:341–342`** and the row did not carry them: **D4 `my-auto` (upstream-only)** → `P7a-D19`, ratified in scope at R-A · **AUTH-CONSENT-LINE** → **STRUCK at R-D**, four grounds in `docs/plans/POLISH-7a.md` §2 · **D2b container normalisation is `.2`/`.3`/`.5`/`.6`, NOT `.7a`** (`PageContainer.tsx:21–23`). **AGPL `I6` (`PRIMITIVES-1.md:345`) is its own row and is NOT this surface's.**`

### S-08 · `POLISH-0.md:72` — ADR-0023 carries TWO patch records

Replace `ADR-0023 carries one` with `ADR-0023 carries **two** — 2026-07-17 (the `(auth)` header mount) and 2026-08-03 (header scroll behaviour = sticky, POLISH.1b / D3), both indexed at `0023-participant-shell-topology.md:12`. ⚠ **A reader told there is one may stop after the first.**`

### S-09 · `POLISH-register.md:35` — POLISH.1's header is stale twice

Replace `*Not yet inspected. Gates: B4 · B8 · B10.*` with:

> *Machine phase **RUN** at #288 · #289 · #290; the founder pass has not. Gates: **B4 VOID** (withdrawn, not deferred — SPEC.1 v1.0.26 `:1498`) · **B8 STRUCK** from `.1` (SPEC-blocked on the unwritten §21.7 rider) · **B10 CLOSED** (`acc2e03`, #283). See `POLISH-TRACKER.md:19` and `:40–42`.*

### S-10 · `POLISH-register.md:179` — the SPEC.CHART citation

`POLISH-0.md:158` → `POLISH-0.md:203`. At `903b2a1`, `:158` is POLISH.1's `Cross-surface` cell.

### S-11 · `rate_limited` → `otp_rate_limited`

Two sites: `POLISH-0.md:174` and `POLISH-register.md:178`'s **title**. ⚠ **`PD-0-15`'s ID is NOT renumbered and NOT reused** (§12: never renumbered, never reused). Append to its Root-cause cell:

> ⚠ **Code corrected 2026-08-11 at POLISH.7a.** The auth string is **`otp_rate_limited`** (`src/server/auth/index.ts:154,164`). `rate_limited` occurs at six sites in `src/`, **all under `src/components/debate/composer/**` — POLISH.4's surface.** The three codes a real user reaches (`turnstile_required`, `turnstile_failed`, `otp_rate_limited`) are produced **inside `src/server/auth/**`**, which is hard floor **F4** — this is why the row routes out rather than shipping as a copy fix. There is **no `code → copy` mapping anywhere on the auth path**; `docs/logs/UI-A7.md:13` records that branching on the error code was deliberately NOT built and filed as an open Gate-C question that has no recorded outcome on `main`.

### S-12 · Rows into `docs/parked.md`

Ten, in §7 below. `POLISH-0.md:496`'s standing rule and `POLISH-SURFACE-TEMPLATE.md:365` both require the row in the **same commit** as the document naming the destination.

### Recorded, NOT fixed in this PR — with the reason

| # | Finding | Why not here |
|---|---|---|
| **X5** | `ADR-0023:203–205` still states *"Zero edits to existing auth files"* unqualified, while `UI-A7.md:17` ruling 3 superseded it in a code comment and `e887c02` edited all three pages | An ADR edit is ⛔ **H7**. Route to the doc sweep. Both sides quoted in `docs/logs/POLISH-7a.md` |
| **X6** | `docs/logs/UI-A7.md:3,6` and `docs/logs/AUTH-OTP-DELIVERY.md:3` are frozen at a merge gate both PRs passed; neither carries the squash-merge SHA CLAUDE.md §5.9 makes canonical | Amending another task's log is out of this surface's edit boundary. Doc sweep |
| — | `design-canon.md:126` carries the lapsed F-AUTH-4 override unannotated | Design-lane, web-authored. Recorded in the close-out |

---

## §7 · Proof obligations — non-negotiable

### §7.1 · D19's per-consumer zero-delta proof — the price of R-A

`src/app/layout.tsx` is the root layout. Changing it touches **every route in the product.** §8.2: *"Changing a shared primitive requires proving each existing call site is unaffected. Enumerate every one — never claim it."*

**Enumerate and prove, one row each. A claim without a stated measurement does not discharge a row.**

| # | Route family | What must be proved |
|---|---|---|
| 1 | `/` Discovery | No geometry change. Carousel and grid unmoved |
| 2 | `/m/[slug]` | No geometry change, both arms — market view and post-focus |
| 3 | `/u/[pseudonym]` | No geometry change, both DTO arms |
| 4 | `/bookmarks` | No geometry change |
| 5 | `/admin/*` | No geometry change. ⚠ **`(admin)` has no `layout.tsx` by design and no shell** — it mounts the root layout directly, so it is a real consumer and not an exempt one |
| 6 | `not-found.tsx` · `(public)/not-found.tsx` · `global-error.tsx` | No geometry change. `global-error.tsx` replaces the root layout entirely and must still render |
| 7 | `(auth)` × 3 | **The intended change, and only it** — Cards centre, measured |

**Plus, green on the uncommitted tree before the commit:** `tests/unit/shell/page-container.test.ts` (nine named sites, including its dedicated site-8 `(auth)` union case at `:196–226`) · `tests/unit/shell/sticky-header.test.ts` · `tests/unit/shell/not-found.test.tsx`. **Any red is ⛔ H9 — do not stack a commit on red.**

### §7.2 · Standing proof discipline for this run

- **⚠ Run `just verify` on the UNCOMMITTED tree, before each commit.** A green run *after* a commit is weaker evidence: Lefthook formats staged files at pre-commit and has already silently repaired the class of defect the post-commit run would catch.
- **⚠ H12 — check for a second `vitest` runner with `pgrep -f 'node.*vitest'` before any suite run.** `ps | grep` matches its own command string. Concurrent runs truncate each other's fixtures into a false RED.
- **⚠ Every counted claim is re-verified at PR HEAD**, not at the moment it was written. Four went stale inside their own PR at PRIMITIVES-2.
- **⚠ The session log's own diffstat is structurally exempt** — it counts a tree in which the log does not yet exist. Measure at PR head and amend, **or declare the exclusion in the line itself.** Diligence cannot close it.
- **⚠ A coordinate cited in a commit body or a PR body cannot be corrected later.** Symbol-anchor or SHA-qualify every one. Only the log can carry a repair.
- **Never `git add -A`.** It once replaced a 195-line log with 47 lines of pasted relay text and no gate saw it.
- **After any merge lands mid-session, re-verify the working branch still exists remotely before pushing.**

---

## §8 · The `parked.md` rows — ten, authored here

Conform each to `docs/parked.md`'s live row template. **⚠ If conforming would change any row's meaning, HALT and quote both the template and the row.**

| Row | Carries | State / date |
|---|---|---|
| **AUTH-TURNSTILE-WIRE** | `PD-0-14` · `P7a-D04` (the "Continue" label, whose ground returns when the pane exists) · `P7a-D06` · `P7a-D13` (the "Secured by Cloudflare Turnstile" line, which must not be restored before the widget is real). ⚠ `ADR-0033:25` binds it: the Resend action must carry the same Turnstile token the initial sign-in request sends — parity holds today at `otp/page.tsx:103` / `sign-in/page.tsx:125`, both `"placeholder-token"` | **2026-09-05**, beside `RATE-GUARD-PUBLIC` — same genus, sizeable together |
| **AUTH-ERROR-COPY** | `PD-0-15`, title corrected to `otp_rate_limited`. Tier-1-named at `ADR-0033:29`. ⚠ **Co-executed with `AUTH-OTP-FIDELITY`** — same file, one ritual | **Pre-go-live** |
| **AUTH-OTP-FIDELITY** | `P7a-D10` (6-box segmented input; `UI-A7.md:99` pins the single-field binding byte-for-byte) · `P7a-D11` (resend cooldown). Both **H2**. ⚠ Without a cooldown, mashing Resend produces `otp_rate_limited` raw on screen — which is `AUTH-ERROR-COPY`'s own defect. **One user experience, one task** | **Pre-go-live**, R-F |
| **AUTH-ONBOARDING-GATE** | `P7a-D16`. ⚠ **Tier-1 spec-locked** — `SPEC.1:777` requires Continue disabled until ticked, `:805` forbids relaxing it without an ADR, `:817` assigns verification to `.7a`. Needs a client boundary around the acceptance form on a page tier 3 ratified as pure RSC. **Not unsafe today**: `required` blocks submission and `acceptTosAction` re-checks server-side | **Pre-go-live**, R-B |
| **AUTH-GOOGLE-MARK** | `P7a-D02`. Sits at the intersection of DESIGN.B1's ratified TRUE-NEUTRAL system (CI-guarded) and Google's sign-in brand guidelines, which cannot be adjudicated from inside a machine pass. Three options: official coloured mark (violates B1) · monochrome/custom G (a modified Google mark) · text only (today) | **Founder decision**, undated, §2.1 (1) |
| **AUTH-FIRST-LOGIN** | The A7 ledger row. ⚠ `AUTH-OTP-DELIVERY` **OBS-3**: the defect may no longer reproduce — a fresh signup landed cleanly on `/onboarding` with a pseudonym assigned. **Re-verify before scoping** | **Trigger: re-verify at kickoff** |
| **AUTH-HARDEN** | Spoofable XFF IP (`src/server/auth/index.ts:104-110`) · Sentry `beforeSend` scrubber · ⚠ **and the OTP-sender flush gap**: `email-otp.ts` calls `Sentry.captureException` raw with no flush and no `waitUntil`, while the repo has `safeCaptureException`/`safeFlush` with nine sites routed through it. `ADR-0033` Decision 2 designates that capture as the **SOLE mitigation** for a deliberate HTTP-200-on-failure design · ⚠ and Sentry delivery is **unverified, not unwired** — no positive control has been fired on staging. ⚠ **`src/server/auth/**` is a CLAUDE.md §1 CRITICAL PATH — full ritual, its own chat** | **Pre-go-live** |
| **AUTH-CONSENT-LINE** | **STRUCK.** Four grounds, R-D. Row exists so the `PRIMITIVES-1.md:342` reference resolves to a closed decision rather than a phantom | **CLOSED on landing** |
| **LEGAL.1** | The ToS and Privacy bodies (`P7a-D18`) · the version label (`P7a-D17`) · ⚠ **the AGPL §13 source offer, relocated into the ToS body at B4's void** (`SPEC.1` v1.0.26 `:1498`) · **`HARDEN.6` and `HARDEN.7` are aliases of this row.** `public/legal/tos.txt:4` and `privacy.txt:4` name HARDEN.7 with a *"mid-July 2026"* date now four weeks past | ⚠ **GO-LIVE GATE. Its own chat**, R-E |
| **NO-RAW-HEX-REACH** | ✅ **CLOSED at POLISH.7a** — the three `(auth)` route files enrolled in `no-raw-hex-view-layer.test.ts`'s `SCAN_FILES`, RED-first on RULE-1's three axes (§5). Row exists to record that `UI-A7.md:213`'s exit criterion and `docs/logs/UI-A7.md:28`'s *"zero raw hex"* receipt were **blind** at the time they were written | **CLOSED on landing** |

---

## §9 · The run

### §9.1 · Setup
Fresh session, own worktree at `origin/main`. Branch **`fix/polish-7a-auth`** — ⚠ **HALT and quote if CLAUDE.md pins a different convention.** ⛔ **H11: verify `git branch --show-current` agrees after checkout.** A colliding `checkout -b` is a no-op that silently leaves HEAD on `main`. ⚠ **Agent definitions load from the session's working directory at launch and are not hot-reloaded** — launch from a worktree at `origin/main` or a reviewer dies at 0 tool_uses on a stale pin.

### §9.2 · Commit sequence — one concern per commit, so a regression bisects in one step

| # | Commit | Contents |
|---|---|---|
| **1** | `docs(polish): commit the ratified POLISH.7a plan` | This file, **verbatim**, at `docs/plans/POLISH-7a.md`. Nothing else. ⚠ If any sentence in it looks wrong, **HALT and quote it** — do not normalise. That instruction caught two errors in one paragraph at PRIMITIVES-2 PR-B |
| **2** | `test(design): enrol POLISH.7a's routes in the raw-hex guard` | §5. **RED counts for all three RULE-1 axes in the commit body** |
| **3** | `fix(auth): POLISH.7a presentation deltas` | D01 · D03 · D07 · D12 · D14 · D21 |
| **4** | `feat(auth): (auth) error boundary` | D20 |
| **5** | `fix(shell): repair the (auth) centring collapse (P7a-D19)` | D19 alone. §7.1's proof table in the commit body |
| **6** | `docs(polish): POLISH.7a class-S corrections` | §6 S-01 · S-08 · S-09 · S-10 · S-11 |
| **7** | `docs(parked): POLISH.7a routing destinations` | §8's ten rows |
| **8** | `docs(logs): POLISH.7a session log` | `docs/logs/POLISH-7a.md`, §9.4 |

### §9.3 · Reviewers — the cascade runs, sequentially

`POLISH-TRACKER.md:20` calls `.7a` a single gated pass and `POLISH-SURFACE-TEMPLATE.md:242` reserves the full cascade for `.3` and `.4`. **The cascade runs here anyway, on two grounds that are specific to this PR and not to the surface's ritual class:** D19 changes the **root layout**, whose blast radius is every route in the product; and the surface is the **sign-in path**, which `POLISH-0.md` §1 names in its lane-discipline clause. Reviewer time is CC-side and costs nothing on the binding founder-serial axis.

| Reviewer | Scope | Note |
|---|---|---|
| `@code-reviewer` | The whole diff | Mandatory |
| `@security-auditor` | The three route files + `error.tsx` | Confirm **no auth logic, no submit path, no handler, no `src/server/**`** is touched, and that `error.tsx` leaks no message, stack, digest or cause |
| `@db-migration-reviewer` | — | **WAIVED — no DDL, no migration, no schema touch.** State the waiver and its reason; do not omit the row |

**⚠ Every reviewer answers as separately-stated points, never a bare PASS. ⛔ H10: a required reviewer returning a bare PASS twice is a halt.** Every finding is reported **individually**, at the severity the reviewer assigned it, with `file:line` and a disposition — **never *"a CRITICAL plus two HIGHs."*** A PR was once cleared containing two unaddressed HIGHs because of exactly that phrasing.

### §9.4 · The session log

`docs/logs/POLISH-7a.md`, per `POLISH-SURFACE-TEMPLATE.md` §12:

```
Surface · routes · components (as VERIFIED at step 0, not as listed)
Step 0 findings: n TRUE · n FALSE · n UNVERIFIABLE — each with evidence
Machine PR: #n — 8 shipped, 4 halted, 6 superseded, 3 data-blocked
Halts routed to: AUTH-ONBOARDING-GATE · AUTH-OTP-FIDELITY · AUTH-TURNSTILE-WIRE · AUTH-GOOGLE-MARK
Register: PD-7a-nn, allocated from the LIVE high-water mark
Exit bar: item by item — PASS / row / data-blocked with a named reason
Emitted to the tracker: ONE batched row
Carried forward: each with a NAMED OWNER
⚠ Lesson for the next relay: what the machine read missed
```

**⚠ The last line is mandatory.** With the founder pass batched, it is the only surviving carrier of the feedback loop. The recon's own candidate is a good one and should be carried forward: *a row that names its sources correctly can still be read as exhaustive, and on this surface that reading would have missed the only tier-1 obligation on the table.*

**⚠ Register IDs.** Allocate `PD-7a-nn` from the **live** high-water mark read off `POLISH-register.md` at PR head. Never renumbered, never reused. Every row names its baseline — tier plus document. `class` takes exactly one letter, unbolded, or `—` for a non-defect row. **Never append a row below a blank line** — three rows once sat outside a table body, invisible to every parser, with a stale footer count that agreed with the broken parse.

---

## §10 · The halt set

Base set **H1–H17** from `POLISH-SURFACE-TEMPLATE.md` §5 inherited in full. **A halt stops that delta and reports; it does not stop the run unless marked ⛔.**

### Per-surface slot

| # | Halt |
|---|---|
| **P1** | ⛔ Any change under `src/server/auth/**`. CLAUDE.md §1 critical path — **F4**, and its own task with the full ritual |
| **P2** | ⛔ Any change to a submit path, a handler, or the argument-required gate on any auth route |
| **P3** | Any change to `(auth)/layout.tsx`, `GlobalHeader`, the shell cluster, or `PageContainer` — **POLISH.1's** (**H4**). ⚠ `src/app/layout.tsx` is the **single** ratified exception, for `P7a-D19` only, under §7.1's proof |
| **P4** | Any change to `src/components/debate/composer/AuthGateSlot.tsx`, including tidying the `text-n4` micro-label at `:49` — **POLISH.4's** |
| **P5** | Any new component under `src/components/ui/` — **§4.2 C2**, out of this PR's edit boundary |
| **P6** | ⛔ D19's fix requires more than ONE node (**K1**), or removes a `flex-1`, or flattens a flex node (**K2**) |
| **P7** | Enrolling the three route files in the raw-hex guard reveals an **actual** raw hex — **H14**. Report it; never remove it silently to make the suite green |
| **P8** | A `.7a` document anchor in §6 does not match byte-for-byte at PR head |
| **P9** | Any **third** contradiction between two committed documents beyond X5 and X6 — quote **BOTH** verbatim, resolve **NEITHER**. Six have surfaced in this phase already |

---

## §11 · Exit bar

`POLISH-0.md` §7, eight criteria. **This PR closes the MACHINE HALF ONLY.**

| # | Criterion | Disposition |
|---|---|---|
| **1** | Parity by eye at 1440 | ⏳ **THE FOUNDER'S.** Joins the batched comprehensive visual pass. **A surface is not closed on its build half** |
| **2** | Invariant obligations | ✅ Discharged by absence — recon **C12**, tree-walked from the routes |
| **3** | Every affordance functional end-to-end | Verified per route in the log |
| **4** | All states per the P1–P7 kit | `error.tsx` lands (R-C); `loading.tsx` recorded as a deliberate omission with POLISH.2's precedent |
| **5** | Cross-surface criteria | ✅ Discharged by absence — recon **C13**, all six structurally absent |
| **6** | Token usage, not value | Enforced by `tokens-monochrome` (definitions) **and now, for the first time, by `no-raw-hex-view-layer` reaching these files** (§5) |
| **7** | Pole binding on both poles | **Vacuous by absence** — no side-keyed element exists on this surface. `side-pole-binding.test.ts` scans all four `(auth)` files and matches nothing. ⚠ **State it as vacuous, never as a green pass**; the guard's own docstring says a green run is not completeness |
| **8** | G1 desktop-only | No responsive finding filed; any that arises takes `superseded` |

**Closing status: `closed (a11y-deferred)` per R16**, once the founder pass has run. Until then `.7a`'s machine half is complete and the surface is **open**, exactly as POLISH.2 stands.

---

*Web-authored 2026-08-11 IST at the POLISH.7a ratification. Ground `origin/main` @ `903b2a1`. Committed verbatim by CC as commit 1 of `fix/polish-7a-auth`. Recon evidence: `~/Downloads/POLISH-7a-recon.md`, sentinel `ZZ-7A-RECON-2026-08-11`.*
