# UI-A7 — Auth skin (Option A: pages hosting the W2.1 card)

- **Plan path:** `docs/plans/UI-A7.md`
- **Status:** `v1.0` · ratified 2026-07-21 · committed
- **Ground:** HEAD `9423eef` · Claude Opus 4.8 (`claude-opus-4-8`) · effort `max`
- **Ceilings (unmoved — a presentation skin moves none):** migration head `0024` · `EVENT_TYPES` 24 · ADR max `0032` · SPEC.1 `1.0.18` · SPEC.2 `1.0.19`
- **Class:** CLAUDE.md §1 **critical path (auth)** → gated plan→execute + named-reviewer cascade. **NEVER `ultracode`** on this slot.

> **Self-contained by design.** A fresh execute chat with none of the recon/plan-chat context must be able to build the skin from this file alone. Every path, line anchor, binding, and constant needed is inlined below. Anchors are as of `9423eef`; re-read each file at execute time (§5.5) — line numbers may drift, the bindings won't.

---

## 0 · Ratified rulings (verbatim — record of the plan-chat decisions)

1. **PAGE↔MODAL = Option A.** Skin the three existing auth routes as **full PAGES** whose content is the **W2.1 auth card**, centered in the existing `(auth)/layout.tsx` flex wrapper on the branded page ground. **Reproduce CARD CONTENT ONLY** — **no** dimmed backdrop, **no** ×/Esc/backdrop-dismiss chrome. That chrome is the mockup's *modal* shell and is **out of scope**.
2. **NO SPEC/ADR amendment.** Auth presentation is build discretion — SPEC.1 §13 is presentation-neutral ("screen", never "page"/"modal"); ADR-0004 pins the **session model** (400-day cookie cap), not pixels. Next-free ADR **0033** is recorded here and **stays unused** for A7.
3. **"A7 law" supersession.** The comment in `(auth)/layout.tsx` — *"edits none of them (A7 law — zero edits to existing auth files)"* (written at UI.A1, PR #232) — is **SUPERSEDED by Option A**. The true invariant is **ZERO AUTH-LOGIC EDITS, not zero file edits.** The execute PR **PATCHES that stale comment same-commit** to state the true invariant: *A7 skins the auth pages (presentation-only); auth logic / flows / gate stay untouched.*

---

## 1 · Objective & exit criteria

### Objective
Give the three participant auth surfaces — `/sign-in`, `/sign-in/otp`, `/onboarding` — their branded W2.1-card presentation, on the branded page ground, **changing presentation JSX only**. No auth logic, no auth flows, no session/onboarding gate touched. The functional-unstyled scaffolds (built at PR #38 / #45, zero classNames today) become the shipped, branded auth screens.

### Exit criteria — TWO distinct gates

**A. PLAN exit (this artifact — what "plan done" means):**
- [ ] Full `UI-A7.md` draft pasted back to the web chat for review.
- [ ] Web review sign-off received.
- [ ] Operator (Hrishikesh) ratifies.
- [ ] Plan committed via the house chore-branch pattern (§7); squash-merge SHA on `main` reported.
- [ ] `/clear` → fresh execute chat, which reads the committed plan via `@docs/plans/UI-A7.md`.

**B. SLOT / EXECUTE exit (what "the skin is done" means — for the execute chat, not this plan):**
- [ ] `(auth)/layout.tsx` seam landed — horizontal-center + max-width + vertical-padding on the branded ground; short surfaces (sign-in, otp) center vertically, onboarding top-aligns + scrolls (§2 Vertical 0).
- [ ] All three surfaces render the **W2.1 card content** (no modal chrome / dismiss).
- [ ] Branded tokens applied via the existing primitives (`ui/card`, `ui/button`, `ui/input`, `ui/separator`, `ui/avatar`).
- [ ] Target states styled per W2.11 (§5): invalid-OTP · rate-limited · identity-pool-exhausted (503) · generic error.
- [ ] **Seam contract (§3) verbatim-preserved** — every listed binding intact (proven by the `preserved-inputs`-style render tests, §9).
- [ ] **Gate provably intact (§4)** — `@security-auditor` confirms "no session before `tos_accepted_at`" still holds; the full existing auth suite passes **unchanged**.
- [ ] Stale "A7 law" comment patched same-commit (ruling 3).
- [ ] `ZUGZWANG_ENV=preview just verify` green **and** full local suite green (`pnpm vitest run` against local PG `:54322`), incl. `pnpm test:invariants` + `pnpm test:integration`.
- [ ] Reviewer cascade clean: `@code-reviewer` → `@security-auditor` (auth routes, §7).
- [ ] Gate C (web diff-read) on the execute PR before merge.
- [ ] **Operator visual-fidelity check** — all three surfaces vs the W2.1 card, on the **Vercel PREVIEW deploy, BEFORE merge** (folded into Gate C, §7). No automated test asserts appearance; the visual match is the skin's acceptance criterion.
- [ ] Squash-merged; green on `staging`.

---

## 2 · Per-surface build order (foundation-first; each surface is one vertical)

Each surface is one vertical of four steps: **component-swap → tokens applied → states → integration/render test**. Build in this order — **layout seam before the three bodies** (the bodies center *into* the seam; building them first would style against an unbranded ground).

### Vertical 0 — `src/app/(auth)/layout.tsx` (the centering + ground seam) — FIRST
- **Kind:** Server component (unchanged). 34 L. Already carries `GlobalHeader` + `<div className="flex min-h-full flex-col">` / `<main className="flex-1">` (added UI.A1).
- **Change:** the shared `<main>` seam applies **HORIZONTAL centering + max-width + vertical padding ONLY** on the branded page ground (e.g. an `mx-auto max-w-…` card slot with `px-…`/`py-…` under the existing header). **It does NOT force vertical centering** — vertical placement is per-surface (below), because onboarding is tall. Keep the `auth.api.getSession` read + `GlobalHeader` exactly as-is (that is a read, not auth logic — do not alter).
- **Per-surface vertical placement (NOT the shared seam's job):** short surfaces (**sign-in, otp**) center vertically within their slot; **onboarding TOP-aligns and scrolls** — its content (identity + re-id alert + ToS/Privacy scroll + acceptance) is tall, and vertical-centering would push the top above the fold. The shared seam must not impose `place-items-center`/`items-center` that would vertical-center onboarding.
- **Illustrative only** — every utility above is a non-binding "e.g."; the execute chat picks the exact classes.
- **Same-commit:** patch the stale "A7 law" comment (ruling 3).
- **Do NOT:** change the `getSession` call, the `viewer` shape, or the `GlobalHeader` mount.

### Vertical 1 — `src/app/(auth)/sign-in/page.tsx` (F-AUTH-1 Google + F-AUTH-2 email-OTP)
- **Kind:** `"use client"`. 117 L. Two `<form>`s (Google, email-OTP). Zero classNames today.
- **Swap:** `<main>/<section>/<h1>/<h2>/<button>/<input>` → `Card`/`CardHeader`/`CardTitle`/`CardContent` + `Button` + `Input`. **Divider between the Google and email paths: reproduce the mockup's ACTUAL treatment — an "or"-divider** (the word "or" centered, flanked by two 1px hairline rules; the mockup's `.ordiv` — `gap:12px`, `::before`/`::after` rules). **The rules use the CURRENT branded separation treatment** — semantic `--hairline` (or a live neutral per token contract v0.4) — **NOT the mockup's raw `var(--n2)`** (a pre-BRIDGE monochrome-era ref; WI-1 token discipline — see §6). A bare `Separator` alone is **insufficient** (plain rule, no "or" label) — see §6. Preserve every binding in §3.1.
- **States:** `googleError` / `emailError` slots → W2.11 error treatment (§5). Loading labels stay ("Redirecting…", "Sending…").

### Vertical 2 — `src/app/(auth)/sign-in/otp/page.tsx` (F-AUTH-2 code entry)
- **Kind:** `"use client"`. 115 L. `OtpForm` inside a `<Suspense>` default export. Zero classNames today.
- **Swap:** `OtpForm`'s `<main>/<h1>/<p>/<label>/<input>/<button>` → `Card` + `Input` + `Button`. Preserve every binding in §3.2 — **especially the `<Suspense>` boundary** in the default export (build-time hard requirement, `useSearchParams`).
- **States:** `error` slot → W2.11 invalid-OTP treatment (§5); loading label stays ("Verifying…").

### Vertical 3 — `src/app/(auth)/onboarding/page.tsx` (F-AUTH-3 identity reveal + F-AUTH-4 ToS gate)
- **Kind:** **Server async** component. 136 L. Reads the `onboarding_ref` cookie, verifies, DB-reads the user, redirects. Has a few inline `style={{}}` blocks (re-id alert border, scroll regions).
- **Swap:** the 5 `<section>`s + inline `style={{}}` → `Card`/`CardHeader`/`CardContent` + `Avatar` (or keep `<Image>` — see §3.3) + tokens. Preserve every binding in §3.3.
- **Card stays RSC** (presentational) — **no new client boundary** (ruling / kickoff §3).
- **States:** onboarding needs the **fewest** new states (its failure modes are server-side redirects, not inline states) — see §5.

---

## 3 · SEAM CONTRACT — the verbatim-preserve list (the swap MUST NOT alter these)

The skin swaps presentation containers and applies tokens. The following bindings are **logic** and are preserved byte-for-byte. If a swap would change any of these, stop — it is out of scope.

### 3.1 `sign-in/page.tsx`
- Handlers `handleGoogle` and `handleEmailOtp` (bodies unchanged), incl. the SDK calls:
  - `authClient.signIn.social({ provider: "google", callbackURL: "/" })`
  - `authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }, { headers: { "x-turnstile-token": turnstileToken } })` — the second positional arg is `FetchOptions` **directly** (not wrapped in `{ fetchOptions }`); the header rides the wire as `x-turnstile-token`.
  - `router.push(\`/sign-in/otp?email=${encodeURIComponent(email)}\`)` on success.
- `onSubmit={handleGoogle}` / `onSubmit={handleEmailOtp}` on the two `<form>`s.
- `disabled={googleLoading}` / `disabled={emailLoading}` on the submit buttons.
- `<input type="email" name="email" required />` — the `name="email"` binding.
- **The hidden `<input type="hidden" name="turnstileToken" value="placeholder-token" />` — the Turnstile anchor. MUST SURVIVE** (future Cloudflare Turnstile widget mounts here; `handleEmailOtp` reads `formData.get("turnstileToken")`).
- The state hooks (`emailLoading/emailError/googleLoading/googleError`) and their `{ …Error ? <p>…</p> : null }` render slots (restyle the slot, keep the binding).

### 3.2 `sign-in/otp/page.tsx`
- `OtpForm`'s `handleSubmit` (unchanged), incl. `authClient.signIn.emailOtp({ email, otp })`, the `ONBOARDING_REQUIRED` branch (`sdkError?.message === "ONBOARDING_REQUIRED"` → `router.push("/onboarding")`), and `router.push("/")` on success.
- `useSearchParams()` read of `?email=` and the `email` `value`/`onChange` controlled binding.
- `<input … name="otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required />` — **preserve `pattern="[0-9]{6}"`, `maxLength={6}`, `inputMode="numeric"`, `name="otp"`.**
- `disabled={loading}`; the `error` render slot.
- **The `export default function OtpPage` `<Suspense fallback={null}><OtpForm /></Suspense>` boundary — build-time hard requirement (`next build` fails `Missing Suspense boundary with useSearchParams` without it; `tsc`/`vitest` do NOT catch it). Do not remove or hoist it.**

### 3.3 `onboarding/page.tsx`
- All server logic above the `return`: `cookies()` read of `onboarding_ref`; `verifyOnboardingRef(ref)`; `db.query.users.findFirst({ where: eq(users.id, verified.userId), columns: { pseudonym, pfpFilename, tosAcceptedAt } })`; the three redirects (`redirect("/sign-in")` on missing/invalid ref or missing user; `redirect("/")` when `tosAcceptedAt` set); `readLegalDoc` reads. **Untouched.**
- The inline server action `submitTosAcceptance` (`"use server"` → `acceptTosAction(formData)`) — **unchanged**.
- `<form action={submitTosAcceptance}>` — preserve the `action` binding.
- `<input type="checkbox" name="accepted" value="true" required />` — **preserve `name="accepted"`, `value="true"`, `required`.**
- The Continue `<button type="submit">` and the Cancel `<a href="/">` (may restyle to `Button`/`Button variant="ghost"`/link, but the Cancel destination `/` and the submit semantics stay).
- **The re-id warning renders `REID_WARNING_TEXT` verbatim** (imported from `@/server/auth/tos-versions`) inside a `role="alert"` region — keep the role and the verbatim text.
- **The source-hash footer** — `ToS {TOS_VERSION_HASH} · Privacy {PRIVACY_VERSION_HASH}` (`"placeholder-tos-v0"` / `"placeholder-privacy-v0"` today) — preserve the two constants and the footer.
- PFP: today `<Image src="/pfp-placeholder.svg" alt={user.pseudonym} width={128} height={128} />`. May wrap in `Avatar`, but keep `alt={user.pseudonym}` and the placeholder src (R2 URL builder is SCAFFOLD.15, not A7).
- The ToS/Privacy bodies stay in scrollable regions (restyle the container tokens; keep the `<pre style={{ whiteSpace: "pre-wrap" }}>{tosBody}</pre>` content binding).

---

## 4 · GATE-INTACT ASSERTION (the security spine)

**Claim the execute PR must prove:** the skin edits only presentation JSX; the server-side onboarding gate chain is **untouched**, so *no session issues before `tos_accepted_at` is set* still holds.

The gate chain (all server-side, none in page presentation):
1. `src/server/auth/session-gate.ts` — `databaseHooks.session.create.before` throws `APIError("FORBIDDEN", { message: "ONBOARDING_REQUIRED" })` when `users.pseudonym` **or** `users.tos_accepted_at` is NULL. **The session is never issued pre-onboarding.**
2. `src/app/api/auth/[...all]/route.ts` — intercepts the 403, lifts the signed `onboardingRef` into an HttpOnly `onboarding_ref` cookie (`Path=/onboarding`, `Max-Age=600`); OAuth-callback path → 302 (null body), SDK path → 403 JSON.
3. `src/app/(auth)/onboarding/page.tsx` — re-verifies the cookie server-side; redirects `/sign-in` (bad/missing ref) or `/` (already accepted).
4. `src/server/auth/tos-accept.ts` (via `acceptTosAction`) — `UPDATE users SET tos_accepted_at = now()` + clears the cookie + redirects `/`; the *next* request's create-path gate then permits issuance.

**Assertion for the execute cascade:** because the skin touches none of the four files above (only presentation JSX in the pages), the gate is intact by construction. **`@security-auditor` explicitly verifies** "no session before `tos_accepted_at`" post-skin, and confirms the seam contract (§3) preserved the `name="accepted"` / `action={submitTosAcceptance}` / `ONBOARDING_REQUIRED` bindings. The **regression spine**: the full existing auth suite passes **unchanged** (§9).

---

## 5 · STATE-STYLING MAP (vs W2.11 state-kit)

Card spec + states source: `docs/design/mockups/DESIGN_W2_11_state-kit_mockup-v0_1.html`. The **error codes/messages already flow through** the existing handlers — this is **presentation-only**: give each variant its W2.11 treatment; add no new logic, no new error paths.

| State | Surface(s) | Flows through today | W2.11 treatment to apply |
|---|---|---|---|
| **invalid-OTP** | `otp` | `setError("otp_invalid")` / SDK error `<p>` slot | inline field-error / error callout treatment |
| **rate-limited** | `sign-in`, `otp` | SDK error message → the generic `<p>` slot | error callout ("too many attempts" copy is operator's; the skin only frames it) |
| **identity-pool-exhausted (503)** | surfaces at **`otp`** (email path) / OAuth callback — pool consumed at `user.create.before`, i.e. at OTP-verify / callback, not on the `sign-in` form | SDK error message → `<p>` slot | the W2.11 **"No identities available"** block treatment |
| **generic error** | all three | existing `<p>{message}</p>` slots | the W2.11 **"Something went wrong"** block treatment |
| **loading** | `sign-in`, `otp` | existing button label swaps | keep labels; apply `disabled` + branded button loading affordance |

- **Onboarding needs the fewest new states** — its failure modes are server-side **redirects** (`/sign-in`, `/`), not inline states; the only inline affordance is the native `required` checkbox. Do not invent inline error states for it.
- Do **not** map `Session expired` / `Account suspended` blocks here — those belong to other surfaces (session/moderation), not A7's three screens.

---

## 6 · Card spec source & primitives to reuse

- **Card spec:** `docs/design/mockups/DESIGN_W2_1_auth-modal_mockup-v0_3.html` — cite **the `v0_3` file** (ignore its stale inner `<title>`/header "v0.2" label — filename is authoritative). Reproduce **card content only** (picker + Turnstile anchor + OTP; identity + ToS for onboarding). Its dimmed backdrop + ×/Esc/backdrop-dismiss are **modal chrome — out of scope** (ruling 1).
- **Branded primitives (all token-driven, already on disk):**
  - `src/components/ui/card.tsx` → `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter` (uses `bg-card`, `rounded-(--r)`, `shadow-(--elev-1)`, `[border:var(--hairline)]`).
  - `src/components/ui/button.tsx` → `Button` (variants: `default`=primary one-button system, `ghost`, `link`, `secondary`, `destructive`; sizes `default/sm/lg/…`). Use `default` for Continue/Send/Verify; `ghost`/`link` for Cancel.
  - `src/components/ui/input.tsx` → `Input`.
  - `src/components/ui/separator.tsx` → `Separator` — a **plain hairline rule** primitive. **Do NOT hardcode it as the sign-in divider:** the W2.1 mockup's Google↔email divider is an **"or"-divider** (word "or" flanked by two 1px hairline rules — `.ordiv`, `gap:12px`, `::before`/`::after` on `var(--n2)`), **not** a plain rule. Reproduce that (two rules + centered "or"); `Separator` is the right primitive only if you build the two flanking rules from it, else compose the "or"-divider directly. `Separator` still fits anywhere a plain rule is actually wanted.
  - `src/components/ui/avatar.tsx` → `Avatar` (optional wrapper for the onboarding PFP).
- **No new tokens.** Use the branded `@theme`/`:root` token system already in `src/app/globals.css`. Do not introduce raw hex (guarded by `tests/unit/design/no-raw-hex-view-layer.test.ts` + `tokens-monochrome.test.ts`).
- **WI-1 · cross-BRIDGE token discipline (mockup is layout, not values).** The `v0_3` mockup is a **STRUCTURE/LAYOUT reference, not a value source.** It predates BRIDGE (monochrome era, locked 06-18). **ALL colors/tokens resolve against the LIVE branded token contract v0.4** (`globals.css`, post-BRIDGE dark values). The contract bans copying token refs across eras by name or lightness (§2.1); the ramp is **INVERTED** vs the mockup's era and current slots are `--color-nX`. **Never copy the mockup's token names verbatim** (e.g. `.ordiv`'s `var(--n2)`) — use the semantic treatments (`--hairline` for separation rules, `--color-*` neutrals for text/surfaces). Guards (`no-raw-hex`, `tokens-monochrome`) do **NOT** catch a wrong/undefined `var()` — only the operator visual check does.

### 6.1 · Onboarding card design source
The `/onboarding` card is **skinning, not invented design**: apply the **W2.1 auth-card visual language** (the `Card` + tokens + established card treatment, same as §6) to the **existing onboarding content** — identity reveal + re-id alert + ToS/Privacy + acceptance (§3.3). Do not design a new onboarding layout.
- **Permitted visual reference:** `docs/design/mockups/DESIGN_W2_1_first-login-journey_mockup-v0_1.html` may be consulted as a *still*. **What it actually depicts (opened & confirmed):** the **post-auth-success, first-login-only, not-skippable 6-card onboarding DECK** — card 1 = identity reveal ("You're umber-falcon-31" + Dharma grant), cards 2–5 = 4 rule *placeholders* (e.g. "Soulbound reputation"), card 6 = Goal — rendered in the shared overlay/modal shell; **the deck cards are explicit placeholders (design deferred to branding).** It does **NOT** depict the pre-session `/onboarding` **ToS-acceptance gate (F-AUTH-4)** or a standalone identity/PFP reveal card matching our onboarding page.
- **Ruling:** *match it if it materially depicts our identity/ToS screens; else default to the auth-card language.* It does **not** materially depict our `/onboarding` gate → **default the onboarding card to the auth-card visual language.** (The deck itself is O1's post-session build — §8.)

---

## 7 · EXECUTE-CHAT RITUAL (the fresh chat's operating contract)

- **Fresh chat** (`/clear` first) reads this committed plan via `@docs/plans/UI-A7.md`; none of the recon/plan-chat context is assumed — this file is the source.
- **Plan→execute**, gated (critical path). **NEVER `ultracode`** on this slot (CLAUDE.md §6 — auth is one of the four critical paths that keep the gated cascade).
- **`ultrathink`** first word of the execute coding prompt.
- **Tests-first** (§5.6 / §9): `@test-writer` writes the failing per-surface render/wiring tests at Phase 2 start, against §9 below, passing `@docs/plans/UI-A7.md`.
- **Reviewer cascade (auth routes), sequential, directed scope, one DB-touching reviewer at a time:**
  1. `@code-reviewer` — presentation diff under `src/app/(auth)/**` vs §2/§3 + stack patterns.
  2. `@security-auditor` — the §4 gate-intact assertion (no session before `tos_accepted_at`), seam-contract preservation, no refusal-trigger crossings.
  - (No `@db-migration-reviewer` — A7 touches no schema/migration. Record this omission as a deliberate waiver in the PR + log.)
- **Pre-PR self-audit (§5.10)** in-session, item-by-item against §2/§3/§4/§5: PASS / FAIL (fix in-session) / SURPRISE (→ `claude-progress.md` + surface). Server-audit line: assert each seam-contract binding survived and the gate chain is untouched.
- **Verify gate:** `ZUGZWANG_ENV=preview just verify` **and** the full local suite `pnpm vitest run` against local PG `:54322` (run `pnpm vitest` **directly**, not via `just` — so `DATABASE_URL` defaults to `:54322`, not the cloud DB in `.env.local`); includes `pnpm test:invariants` + `pnpm test:integration`. `docker ps` before assuming the stack is up (it usually already is; `supabase start` would fail — no `config.toml`).
- **Gate C** — web diff-read of the execute PR **before merge**, **plus the operator visual-fidelity check**: the operator eyeballs all three skinned surfaces against the W2.1 card on the **Vercel PREVIEW deploy before merge** (§1.B). No automated test asserts appearance — the visual match is the acceptance criterion. Merge only after **both** the diff-read and the visual check pass.
- **Git:** house `feat/` branch; **squash-merge only; PR required; SSH-signed (ED25519)**; author `Zugzwang/world <zugzwangworld@proton.me>` (git username `Chrollo`); **no `Co-authored-by` trailer**. Multi-line commit body via `/tmp/commit-msg.txt` → `git commit -F`.
- **Same-commit** in the execute PR: the layout "A7 law" comment patch (ruling 3).
- **Session log** at `docs/logs/UI-A7.md` before `/clear` (§5.9).
- **Closing ritual:** ask whether CLAUDE.md / AGENTS.md / tracker change as a result (expected: no doc-contract change — presentation slot; the AGENTS.md sync lag in §8 is explicitly not A7's job).

---

## 8 · NOT-DOING (explicit scope fence)

- **Auth logic / flows / gate** — handlers, SDK call shapes, the session-create gate, the `onboarding_ref` cookie chain, `tos-accept`. Presentation JSX only.
- **Admin auth** — `/admin/login` and the admin session path (ADR-0010). Separate trust path; not participant auth.
- **The POST-SESSION first-entry BUILD** — the not-skippable 6-card first-login **deck** (coach marks, deck integration, NEXT-only flow) depicted in `DESIGN_W2_1_first-login-journey_mockup-v0_1.html` + `DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` — is **O1's** build, not A7. **This is NOT a ban on consulting those W2.1/W2.2 stills for the onboarding *card's* look** — §6.1 explicitly permits the first-login still as a visual reference. A7 skins the **pre-session `/onboarding` ToS-acceptance page only**; it does not build the deck or the post-session first-entry flow.
- **Modal chrome / dismiss** — dimmed backdrop, ×, Esc, backdrop-click dismiss (Option A reproduces card content only).
- **The AGENTS.md `0023`/`0031`/`1.0.17` sync lag** — descriptive doc lag, reconciled at the next SYNC sweep, **not A7's job**.
- **A8 / MEDIA.2**, **tracker v18**, **BOOKMARK-ADD-WIRE**, and any **parked threads** (`docs/parked.md`).
- **Turnstile widget wiring** and **R2 PFP URL builder** — the anchors (hidden input, placeholder src) stay; the wiring is DESIGN.* / SCAFFOLD.15, not A7.
- **No SPEC/ADR amendment** (ruling 2).

---

## 9 · TEST PLAN

**Harness (installed, with precedent):** `@testing-library/react` 16.3.2 + `jsdom` 29.1.1 under Vitest 3. Model render tests on `tests/unit/composer/render/preserved-inputs.test.tsx` + `_harness.tsx` (the exact "presentation preserved the inputs" pattern); model server-page wiring on `tests/server/discovery/page-wiring.test.ts`. Render `.test.tsx` files declare `// @vitest-environment jsdom` per-file (matching the composer render precedent — the default env in `vitest.config.ts` is node).

**One test per surface (renders + state variants) + the gate-intact assertions:**

1. **`sign-in` render test** (`.test.tsx`, jsdom) — asserts the skinned markup **preserves the seam contract (§3.1)**: both `<form>` `onSubmit` handlers wired, `name="email"` present, **the hidden `name="turnstileToken"` input present**, buttons carry `disabled` bindings; and that `googleError`/`emailError` render the W2.11 error treatment (§5) when set.
2. **`otp` render test** (`.test.tsx`, jsdom) — asserts seam contract (§3.2): `name="otp"` with `pattern="[0-9]{6}"`/`maxLength={6}`/`inputMode="numeric"`, controlled `email` binding, **the `<Suspense>` boundary present in the default export**, `disabled={loading}`; and invalid-OTP renders the W2.11 treatment.
3. **`onboarding` wiring + structure test** — async server component: assert (a) **redirect branches unchanged** (missing/invalid `onboarding_ref` → `/sign-in`; `tosAcceptedAt` set → `/`) modeled on the page-wiring precedent; (b) the returned tree preserves `<form action={submitTosAcceptance}>`, `name="accepted"`, Continue, Cancel `<a href="/">`, the **verbatim `REID_WARNING_TEXT`** in a `role="alert"`, and the `TOS_VERSION_HASH`/`PRIVACY_VERSION_HASH` footer. (No RTL mount of the DB/cookie path — assert structure of the presentational output; @test-writer picks the lightest faithful mechanism.) **Extracting a presentational child purely for testability is OUT of scope** (it exceeds the skin) — do not refactor the page for a hard RTL mount; **the gate-intact regression spine passing UNCHANGED is the presentation-only proof.**

**Gate-intact regression spine (must pass UNCHANGED — the security proof of §4):**
- `tests/server/auth/**` (session-gate, email-otp, onboarding-ref, tos, `_probe-*`).
- `tests/integration/onboarded-login-session.integration.test.ts`, `signup-create-path.integration.test.ts`, `email-otp-send.integration.test.ts`, `precommit-moderate.integration.test.ts`.
- The 10 invariant specs (`pnpm test:invariants`) — INV-3 side-bind + the gate class unaffected.
- Design guards: `tests/unit/design/no-raw-hex-view-layer.test.ts` + `tokens-monochrome.test.ts` must stay green (no raw hex introduced by the skin).

If any regression-spine test needs an edit to pass, **stop** — that means the skin touched logic (out of scope). The regression spine passing unchanged **is** the presentation-only proof.

---

## Appendix A — File inventory (anchors @ `9423eef`)

**Skinned (presentation JSX only):**
- `src/app/(auth)/layout.tsx` (server, 34 L) — centering/ground seam + "A7 law" comment patch.
- `src/app/(auth)/sign-in/page.tsx` (client, 117 L).
- `src/app/(auth)/sign-in/otp/page.tsx` (client, 115 L).
- `src/app/(auth)/onboarding/page.tsx` (server async, 136 L).

**Untouched — the gate chain (read-only reference):**
- `src/server/auth/session-gate.ts` · `src/app/api/auth/[...all]/route.ts` · `src/server/auth/tos-accept.ts` · `src/server/auth/onboarding-ref.ts` · `src/server/auth/tos-versions.ts` · `src/server/auth/index.ts` · `src/lib/auth-client.ts`.

**Primitives:** `src/components/ui/{card,button,input,separator,avatar}.tsx`.
**Design sources:** `docs/design/mockups/DESIGN_W2_1_auth-modal_mockup-v0_3.html` · `docs/design/mockups/DESIGN_W2_11_state-kit_mockup-v0_1.html`.

## Appendix B — Greenfield confirmation
A7 is greenfield on the three page files: last touched at PR #38 (scaffold-3 auth wiring) and #45 (Better Auth 415 fix); zero classNames across all three. `layout.tsx`'s only prior edit is the UI.A1 header add (PR #232) — the shell, not a page skin. No prior skin commits exist on these routes.
