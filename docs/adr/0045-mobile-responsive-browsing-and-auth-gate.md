# ADR-0045 — Mobile-Responsive Read Surfaces, With Join/Login Hard-Gated on Mobile

| | |
|---|---|
| **Status** | accepted |
| **Date** | 2026-09-01 |
| **Deciders** | Hrishikesh |
| **Tracker task** | MOBILE-1 (ad hoc — not a SCALE-TRACKER or UI-LANE row; ownership assigned to this pod directly) |
| **Frame document** | `design-language §1.7` |
| **Supersedes** | — |
| **Superseded-by** | ADR-0048 (partial — the auth/join carve-out only: `:52`, `:113`, and the two gate layers at `:55`/`:64`) |

---

## Context and Problem Statement

The participant web app currently renders correctly only on desktop. This is not an oversight — `design-language §1.7` ("desktop-only... no responsive breakpoints") is a ratified constraint, explicitly consumed by ADR-0023's shell topology and independently referenced by the DEBATE.4 and DISCOVERY-COMPLETE build plans ("desktop fixed-width," "Desktop 1440 only"). No responsive infrastructure exists anywhere in the codebase: no Tailwind breakpoint override, no viewport/media-query hook, nothing.

Two requirements have since been raised that this ADR resolves together, because they interact:

1. **Mobile browsing must be usable.** Reported as "very ugly" on a phone — market feed, market detail, and debate views render as a squashed 1440px-wide desktop layout.
2. **Join/Login must not be available on mobile at all**, while browsing remains available. This is a **hard exclusion**, not a "not ready yet" soft nudge — genuinely excluding mobile participants from this experiment phase's identity system.

These pull in different directions if handled naively: making everything responsive (including auth) contradicts (2); gating mobile entirely (including browsing) contradicts (1); doing nothing leaves both requirements unmet. This ADR proposes: responsive treatment for **read-only surfaces only**, with Join/Login actively excluded on mobile rather than made responsive.

This ADR does **not** decide:

- Exact breakpoint pixel values / component-level responsive treatment (Phase 1 plan detail, once this ADR is accepted)
- Any visual/brand change — no colour, no accent (locked elsewhere; out of scope regardless)
- Responsive treatment of `/admin/*` — admin is desktop-operator-only by structural definition (ADR-0010), no participant overlap, not addressed here
- Whether this work gets a tracker row, or under what task ID (flagged above, owned by Hrishikesh)

## Decision Drivers

1. **ADR-0038's 100k-signup-by-freeze target is directly traded against by hard-excluding mobile.** If a meaningful share of traffic is mobile, this ADR knowingly suppresses some fraction of that target. Recorded here explicitly so ratification means ratifying the tradeoff, not overlooking it.
2. `design-language §1.7` is a ratified, cross-cutting constraint (ADR-0023) — amending it must be explicit and scoped, not a silent per-component departure.
3. Auth is a critical path (CLAUDE.md §1) — any change to the join/login surface requires the full `plan-then-execute.md` ritual (Plan mode → review → fresh-tab execute → `@code-reviewer` + `@security-auditor` → 24h soak → Gate C). Nothing here is exempt from that regardless of how small it looks.
4. No responsive infrastructure currently exists — this is greenfield work, not an extension of an existing pattern.
5. Zero desktop regression — any responsive change to read surfaces must not move desktop rendering. The project's existing discipline for this (POLISH-era "pixels do not move" pinning, V-1/V-2 verification register) applies.

## Considered Options

1. Make the entire app responsive, including join/login — no mobile gate
2. **Responsive read-only surfaces (market feed, `/m/[slug]`) + join/login hard-gated on mobile via both a client-side hide and a server-side reject** ← chosen
3. No responsive work anywhere; single "join from desktop" interstitial replaces the entire mobile experience, including browsing
4. Native/separate mobile client

## Decision Outcome

**Chosen: Option 2.**

- **Read surfaces amend `design-language §1.7`.** The homepage/market feed and `/m/[slug]` (market + debate view) gain a responsive breakpoint tier. Desktop rendering at 1440px is pinned unchanged. This is a scoped amendment — `§1.7` continues to apply as-is to auth/join surfaces (see below), so the constraint is narrowed, not repealed.
- **Join/Login is excluded on mobile via two independent layers ("Both"), not made responsive:**
  - **Client-side hide** — once the breakpoint system exists (driver 4), the three CTA surfaces are hidden below the mobile breakpoint: `IdentityCluster.tsx:30-35` (global JOIN, mounted via `GlobalHeader` on every route), `AuthGateSlot.tsx:42-47` (market-page composer "Sign up"/"Sign in"), and the destination pages `sign-in/page.tsx`, `sign-in/otp/page.tsx`. This layer is cosmetic/UX — it is not the enforcement mechanism, since it's trivially bypassed (desktop-site mode, resized viewport).
  - **Server-side reject** — the actual enforcement layer, at the auth entry point (`src/app/api/auth/[...all]/route.ts:22,97-98` and/or `src/server/auth/index.ts:330`). Rejects mobile-originating auth attempts independent of what the client rendered. Detection mechanism (user-agent check vs. other signal, and exactly where in the Better Auth request lifecycle it hooks — e.g., following the `databaseHooks.session.create.before` precedent from ADR-0004, or earlier at the route wrapper) is a **Phase 1 planning question**, not decided here. Note: UA-based detection is a UX/policy gate, not a security control — it is spoofable, and this ADR does not claim otherwise.
- **Hard exclusion confirmed**: intent is genuine exclusion of mobile participants from the identity system this phase, not a temporary soft gate to be lifted once the responsive join flow is "ready."

### Single-source-of-truth file map

| Concern | Source-of-truth file |
|---|---|
| Responsive breakpoint definitions | `src/app/globals.css` (`@theme` block) — no `tailwind.config.*` exists (Tailwind v4 CSS-first); breakpoints are minted here or not at all |
| Client-side mobile CTA hide | `IdentityCluster.tsx`, `AuthGateSlot.tsx`, `sign-in/page.tsx`, `sign-in/otp/page.tsx` |
| Server-side mobile auth reject | `src/server/auth/index.ts`, `src/app/api/auth/[...all]/route.ts` |

## Consequences

### Positive

- Mobile browsing stops rendering broken for what is likely the majority of first-touch traffic.
- The Hard exclusion becomes real enforcement (server-side), not a cosmetic button-hide someone can bypass in five seconds.
- `§1.7` gets an explicit, auditable, scoped amendment instead of an undocumented per-component departure — future readers of ADR-0023 or the design-language doc won't hit a contradiction.

### Negative

- **Directly trades against ADR-0038's 100k-signup target.** Not mitigated by this ADR — accepted only if Hrishikesh rules on it knowingly (Driver 1).
- First responsive infrastructure in the codebase — non-trivial greenfield diff across read-surface components, its own test/verification burden, and a new convention future work must follow consistently.
- Two enforcement layers (client hide + server reject) means two places that must be kept in sync if new join/login entry points are added later. **Mitigated by:** the file map above being the enumerated, single source of truth for both.
- Server-side UA detection is not robust against a determined user (desktop-mode browsers, spoofed UA). **Accepted because:** the stated intent (Driver/Decision) is a policy exclusion, not a security boundary — same posture as other UX-layer gates in this codebase (ADR-0010 explicitly frames the admin-route proxy the same way: "UX-layer, not a security boundary").

### Neutral

- Admin surfaces (`/admin/*`) are untouched — no responsive work, no gate change, out of scope by structural separation (ADR-0010).

## Pros and Cons of the Options

### Option 2 — Responsive read surfaces + hard mobile auth gate (chosen)

**Pros**
- Meets both stated requirements without contradicting either.
- Server-side layer makes "Hard" actually enforced, not cosmetic.

**Cons**
- Two-layer gate is more surface area than a single mechanism.
- Requires the full critical-path ritual (auth touch) on top of a genuinely new responsive-design effort — larger than either half looks alone.

### Option 1 — Fully responsive, no gate

**Verdict:** Rejected. Directly contradicts the explicit Hard-exclusion requirement.

### Option 3 — No responsive work, single interstitial for all of mobile

**Verdict:** Rejected once browsing was confirmed in-scope — would leave mobile browsing exactly as broken as it is today, just without the buttons.

### Option 4 — Native/separate mobile client

**Verdict:** Rejected. SPEC.2 §4.7 already frames mobile/service-to-service clients as out of v1 scope; consistent with rejecting this here too.

## Flow & invariant constraints absorbed

| Source | Reference | Constraint |
|---|---|---|
| `design-language §1.7` (via ADR-0023) | desktop-only, no breakpoints | **shapes** — narrowed to exclude read-only participant surfaces; auth/join surfaces remain governed by the original constraint (they are gated, not made responsive) |
| ADR-0038 | 100k signup target | **shapes** — this ADR knowingly trades against it; not resolved, flagged for explicit founder sign-off |
| ADR-0004 | Better Auth `databaseHooks` session-gate pattern | **consumes** (candidate) — the server-side mobile reject likely follows this precedent; exact hook point is a Phase 1 question |
| SPEC.2 §4.7 | mobile/service-to-service clients out of v1 API scope | **consumes** — consistent framing; this ADR is the web-browser-specific instance of the same principle |
| CLAUDE.md §1 | critical-path list | **consumes** — auth touch triggers the full `plan-then-execute.md` ritual, no shortcuts |
| Tracker | ⚠ TBD | task ID / tracker row not yet assigned — see header |

## More Information

- `design-language §1.7` (referenced via ADR-0023's constraint table; not independently reviewed in full — recommend Hrishikesh or Claude Code confirm current wording before this ADR is finalized)
- ADR-0010 (admin proxy "UX-layer, not a security boundary" framing, precedent for the UA-check posture here)
- ADR-0004 (session-deferral hook pattern, candidate precedent for the server-side gate)

---

*ADR-0045 ratifies scoped responsive treatment of participant read surfaces plus a two-layer hard exclusion of Join/Login on mobile, including the accepted tradeoff against ADR-0038's signup target (Decision Driver 1). The decision body and constraints minted above are immutable; superseding requires a new ADR with a same-commit SPEC.2 update per the SPEC.2 §0 versioning policy.*

---

## Patch record — 2026-09-05 · the Status field is a status again (D-28 row 19)

**D-28 row 19 rules one cohesive formatting pass over all 44 ADR `Status` fields, and this file was the outlier.** Its Status read *"accepted — approved by Hrishikesh, 2026-09-01 (relayed; formal repo trail to follow at commit)"* — a sentence in a field the template defines as one of four words. **The approval is not withdrawn and the caveat is not dropped; both are moved here, which is where a qualification belongs.** The distinction is worth stating: a `Status` cell is read by anything scanning the ADR set for what is load-bearing, and a cell that has to be parsed rather than matched breaks every such scan silently. A patch record is read by a person, who is the only reader the caveat was ever for.

**The caveat, preserved verbatim in substance:** this ADR was **approved by Hrishikesh on 2026-09-01**, relayed rather than committed at the time, with the formal repository trail to follow at commit. That trail is this file's own history. ⚠ **The decision, its drivers and its outcome are untouched by this pass** — nothing here re-opens the mobile gate.
