# Zugzwang — Design Token Contract (named slots · monochrome values)

> **Doc:** `docs/design/design-token-contract.md`
> **Status:** v0.2-draft · authored at DC.1 · **slot names freeze on operator ratification**; committed at DC.3
> **Authorship:** web Claude (orchestrator) · ratified by operator · committed by Claude Code
> **Grounding:** `src/app/globals.css` (the built system, SHELL/UI.0 mint PR #161 — **full custom-property census recon-verified verbatim, 2026-07-02**) · `design-language.md` v0.5 §2 (vocabulary) · the brand-handover research (DTCG three-tier shape) · `tests/unit/design/tokens-monochrome.test.ts` (the CI pin, read in full)
>
> **What this is.** The frozen list of semantic slot names the entire UI binds to, each holding its current monochrome value. Branding (DESIGN.B1 → B3) is a **pure value-swap onto these fixed names** — re-fill the buckets, never repaint a screen. **After ratification: no rename, no removal; additions only by contract amendment (operator-ratified, version-bumped), and always *before* a Claude Design session, never inside one.**
>
> **What this is NOT.** Not the brand package (that is B1/B3's `DESIGN.md` + `tokens.json` + value-filled `globals.css`, authored *against* this contract). Not a code change — DC commits docs only; `globals.css` is already the built truth this contract records.

---

## §1 — Architecture: three tiers, one direction

Per the brand-handover research (industry-consensus DTCG shape):

```
component tokens  →  semantic tokens  →  primitive tokens
      (§4)               (§3)                (§2)
```

- **Primitives** hold raw values (a grey, a px, a family). Named by scale position, never by use.
- **Semantics** hold intent (side, surface, border, focus ring). They alias primitives.
- **Component tokens** hold per-component knobs. They alias semantics or primitives.
- **References point right only** — a component token never invents a literal; a semantic never skips to a hex that isn't a primitive. *(Known flattening in the built CSS: the shadcn `:root`/`.dark` values are written as literals rather than `var()` chains onto the ramp. Acceptable — the swap edits values at named slots either way. New tokens must use `var()` aliases.)*

**The five blocks of `globals.css`** (the complete custom-property census):

| Block (lines) | Role | In-contract tier |
|---|---|---|
| `@theme inline` (7–48) | **alias plumbing** — maps shadcn vars into Tailwind (`--color-background: var(--background)` …), the derived radius scale, `--font-heading` | plumbing (names recorded §2.4/§3.3; values are pure `var()`/`calc()` derivations) |
| `:root` (50–83) | shadcn semantic ramp — light values | §3.2 |
| `.dark` (85–117) | shadcn semantic ramp — dark values | §3.2 (status: unstyled scaffold, see §3.4) |
| `@theme` (126–147) | **the design-token mint** — n-ramp, side poles, fonts | §2.1 / §2.3 / §3.1 |
| `:root` (155–159) | raw structural props — hairline, image knobs | §3.5 / §4 |

**Enforcement.** `tests/unit/design/tokens-monochrome.test.ts` pins the mint in CI. Exact mechanics (load-bearing for B3 — see §5):
- **Exact-string pins**: `toContain("--token: value;")` for all 11 design tokens — any value or whitespace change breaks it.
- **Chroma census**: a regex asserts **exactly 11** file-wide matches of `--color-(n[0-7]|ink|yes|no)` and chroma `0` on each — minting a new token *matching that name pattern* (e.g. an `n8`) breaks the count; tokens outside the pattern (an accent) are **invisible** to it.
- **Name ban**: `--color-brand` anywhere fails. **The accent must never be named `--color-brand`.**
- **Comment couplings**: the strings `NOT Support (design-language §1.3/§2.1)` (must stay), `do not consume` and `DESIGN.7 back-app…` (must never reappear) are pinned — renumbering design-language §1.3/§2.1, or careless CSS comments, break CI. *(design-language v0.5 preserved the numbering — safe.)*
This test is the *monochrome-era* guard: **at B3 it is amended in the same commit as the value swap** to pin the branded values instead. It is never deleted — it becomes the brand-drift guard.

---

## §2 — Tier 1 · Primitives

### §2.1 Neutral ramp — LANDED (frozen names, monochrome values)

9 true-neutral steps, OKLCH chroma 0 (SHELL/UI.0 mint, `@theme` block). The ramp is the working palette **and** the slice the accent later repaints (design-language §1.4/§1.5 — *which* steps is a B-track decision).

| Slot (CSS) | Contract name | Value (current) | Swap status |
|---|---|---|---|
| `--color-n0` | `primitive.neutral.0` | `oklch(1 0 0)` | retune-only if brand requires; names never change |
| `--color-n1` | `primitive.neutral.1` | `oklch(0.971 0 0)` | 〃 |
| `--color-n2` | `primitive.neutral.2` | `oklch(0.922 0 0)` | 〃 |
| `--color-n3` | `primitive.neutral.3` | `oklch(0.871 0 0)` | 〃 |
| `--color-n4` | `primitive.neutral.4` | `oklch(0.708 0 0)` | 〃 |
| `--color-n5` | `primitive.neutral.5` | `oklch(0.556 0 0)` | 〃 |
| `--color-n6` | `primitive.neutral.6` | `oklch(0.371 0 0)` | 〃 |
| `--color-n7` | `primitive.neutral.7` | `oklch(0.205 0 0)` | 〃 |
| `--color-ink` | `primitive.neutral.ink` | `oklch(0.145 0 0)` | 〃 |

*(A ramp retune at B3 must edit the CI pin's exact-string expectations in the same commit — §1/§5. Any new ramp step must NOT match the `n[0-7]` pattern unless the chroma-census count is amended too.)*

### §2.2 Accent family — RESERVED (frozen names, **no values until B1/B3**)

Deliberately absent from the built CSS today. The names are frozen **here** so B3 mints values onto known slots instead of inventing names mid-session. Per the research: one accent + a hover/active tint + an on-accent foreground.

| Slot (CSS, minted at B3) | Contract name | Value | Notes |
|---|---|---|---|
| `--color-accent-500` | `primitive.accent.500` | *(B1 decides · B3 mints)* | the one brand accent |
| `--color-accent-600` | `primitive.accent.600` | *(B1/B3)* | hover/active tint |
| `--color-on-accent` | `primitive.accent.on` | *(B1/B3)* | foreground on accent (WCAG AA vs 500) |

*Constraints: never named `--color-brand` (CI ban, §1). Accent discipline (research → every B-track brief): accent on ≤10% of any screen; never on the side poles. These names sit outside the chroma-census pattern, so the mint itself does not trip the count — the census stays 11.*

### §2.3 Typography primitives — names frozen, values are **build placeholders**

| Slot (CSS) | Contract name | Value (current) | Swap status |
|---|---|---|---|
| `--font-sans` | `primitive.font.sans` | `var(--font-geist-sans)` | **placeholder** — the family is an open CD/B1 decision (design-language §2.2: one neutral sans, blank). Geist is the scaffold default standing in, not a ratified choice. |
| `--font-mono` | `primitive.font.mono` | `var(--font-geist-mono)` | **placeholder** — mono-numeric treatment itself is a CD decision. |

Type **scale/weights** (`type.scale.*`, `type.weight.*`) remain *named-in-vocabulary, unminted-in-CSS* (design-language §2.2) — carried by Tailwind utilities in the built surfaces. Promotion to CSS custom properties = contract amendment (DESIGN.SPEC-era, if ever); until then they are **not** contract slots.

### §2.4 Shape primitives + derived radius scale

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--radius` | `primitive.radius.base` | `0.625rem` | shadcn base; small-or-zero constraint (§1.9) governs any retune |
| `--radius-sm … --radius-xl` | `primitive.radius.sm…xl` | `calc()` derivations of `--radius` (`@theme inline`) | **derived, not independent** — retuning the base moves the whole scale; never assign literals to the derived slots |

Spacing (`space.*`), elevation, and motion stay vocabulary-only (design-language §2.3) — same amendment rule as type scale.

---

## §3 — Tier 2 · Semantics

### §3.1 Side poles — LOCKED (never rebranded)

The thesis-load-bearing pair. **B3 must not touch these** (design-language §1.5: *repaint the designated greys; leave the black/white side coding untouched*).

| Slot (CSS) | Contract name | Value | Alias intent |
|---|---|---|---|
| `--color-yes` | `semantic.side.yes` | `oklch(0.145 0 0)` — black, **locked** | ≡ `primitive.neutral.ink` |
| `--color-no` | `semantic.side.no` | `oklch(1 0 0)` — white, **locked** | ≡ `primitive.neutral.0` |

**Considered and rejected as slots:** on-side foregrounds (`side.yes.foreground` / `side.no.foreground`). Because the poles are locked monochrome forever, text-on-side resolves through the neutral ramp (on-yes = `neutral.0`, on-no = `neutral.ink`) and never needs a swap. Recorded so the question isn't reopened at B3.

### §3.2 shadcn semantic ramp — pinned verbatim (light `:root` · dark `.dark`)

The component-consumed layer. Every value below is the live file, verbatim. **Ramp column**: `= nX/ink` marks an exact match to a §2.1 step; **off-ramp** marks an achromatic grey that is *not* a ramp step (stock shadcn defaults left in place at the mint); **⚠ CHROMATIC** marks the two colour values (dispositions in §3.4).

| Slot (CSS) | Contract name | `:root` (light) | Ramp | `.dark` | Ramp (dark) | B3 behaviour |
|---|---|---|---|---|---|---|
| `--background` | `semantic.surface.base` | `oklch(1 0 0)` | = n0 | `oklch(0.145 0 0)` | = ink | stays neutral |
| `--foreground` | `semantic.text.base` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--card` | `semantic.surface.card` | `oklch(1 0 0)` | = n0 | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--card-foreground` | `semantic.text.card` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--popover` | `semantic.surface.popover` | `oklch(1 0 0)` | = n0 | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--popover-foreground` | `semantic.text.popover` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--primary` | `semantic.action.primary` | `oklch(0.205 0 0)` | = n7 | `oklch(0.922 0 0)` | = n2 | **re-aliases → `primitive.accent.500`** |
| `--primary-foreground` | `semantic.action.primary-foreground` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.205 0 0)` | = n7 | **re-aliases → `primitive.accent.on`** |
| `--secondary` | `semantic.action.secondary` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--secondary-foreground` | `semantic.action.secondary-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--muted` | `semantic.surface.muted` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--muted-foreground` | `semantic.text.muted` | `oklch(0.556 0 0)` | = n5 | `oklch(0.708 0 0)` | = n4 | stays neutral |
| `--accent` | `semantic.action.accent` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | **re-aliases → accent family** |
| `--accent-foreground` | `semantic.action.accent-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | **re-aliases → `primitive.accent.on`** |
| `--destructive` | `semantic.status.destructive` | `oklch(0.577 0.245 27.325)` | **⚠ CHROMATIC (red)** | `oklch(0.704 0.191 22.216)` | **⚠ CHROMATIC (red)** | disposition §3.4 |
| `--border` | `semantic.border.base` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 10%)` | alpha-white | stays neutral |
| `--input` | `semantic.border.input` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 15%)` | alpha-white | stays neutral |
| `--ring` | `semantic.focus.ring` | `oklch(0.708 0 0)` | = n4 | `oklch(0.556 0 0)` | = n5 | **re-aliases → `primitive.accent.500`** |
| `--chart-1` | `semantic.chart.1` | `oklch(0.87 0 0)` | off-ramp (≈n3) | `oklch(0.87 0 0)` | off-ramp | B-track call (neutral vs tint) |
| `--chart-2` | `semantic.chart.2` | `oklch(0.556 0 0)` | = n5 | `oklch(0.556 0 0)` | = n5 | 〃 |
| `--chart-3` | `semantic.chart.3` | `oklch(0.439 0 0)` | off-ramp | `oklch(0.439 0 0)` | off-ramp | 〃 |
| `--chart-4` | `semantic.chart.4` | `oklch(0.371 0 0)` | = n6 | `oklch(0.371 0 0)` | = n6 | 〃 |
| `--chart-5` | `semantic.chart.5` | `oklch(0.269 0 0)` | off-ramp | `oklch(0.269 0 0)` | off-ramp | 〃 |
| `--sidebar` | `semantic.sidebar.base` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.205 0 0)` | = n7 | stays neutral |
| `--sidebar-foreground` | `semantic.sidebar.foreground` | `oklch(0.145 0 0)` | = ink | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-primary` | `semantic.sidebar.primary` | `oklch(0.205 0 0)` | = n7 | `oklch(0.488 0.243 264.376)` | **⚠ CHROMATIC (blue)** | disposition §3.4 |
| `--sidebar-primary-foreground` | `semantic.sidebar.primary-foreground` | `oklch(0.985 0 0)` | off-ramp | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-accent` | `semantic.sidebar.accent` | `oklch(0.97 0 0)` | off-ramp (≈n1) | `oklch(0.269 0 0)` | off-ramp | stays neutral |
| `--sidebar-accent-foreground` | `semantic.sidebar.accent-foreground` | `oklch(0.205 0 0)` | = n7 | `oklch(0.985 0 0)` | off-ramp | stays neutral |
| `--sidebar-border` | `semantic.sidebar.border` | `oklch(0.922 0 0)` | = n2 | `oklch(1 0 0 / 10%)` | alpha-white | stays neutral |
| `--sidebar-ring` | `semantic.sidebar.ring` | `oklch(0.708 0 0)` | = n4 | `oklch(0.556 0 0)` | = n5 | stays neutral |

### §3.3 Semantic type slot

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--font-heading` | `semantic.type.heading` | `var(--font-sans)` (`@theme inline`) | the display/heading alias — one-sans rule (§1.9) makes it ≡ body today; B1 may re-point it if the brand adopts a second family (a §7 "may revisit" decision, not a default) |

### §3.4 Known off-system values — recorded + dispositioned (no code change in DC)

The mint's in-file comment ("the semantic ramp resolves to these same greys") is **approximately** true; the exact census above shows three deviations. Recorded here so they are governed, not rediscovered:

1. **`--destructive` is chromatic (red) in both modes** — the stock shadcn default, never de-chromed. The design language bans colour on designed surfaces; the locked v1.0/W2 mockups render error states monochrome (W2.11 state kit). Today the red only surfaces if a component uses the `destructive` variant. **Disposition: neutralize-or-ratify at B3** (recommended: retune to a ramp grey in the same swap commit, unless B1 deliberately adopts a status red). If any *pre-brand* build lands a destructive-variant control on a participant surface, neutralize then, as a one-line rider on that PR — not a DC change.
2. **`.dark --sidebar-primary` is chromatic (blue)** — stock shadcn, unconsumed (no dark-mode surface, no sidebar this phase). **Disposition: rides the `.dark` decision** (below); dies if `.dark` is descoped, retuned if kept.
3. **Off-ramp achromatic greys** (`0.985`, `0.97`, `0.87`, `0.439`, `0.269`, the `.dark` alpha-whites) — stock shadcn greys that are *not* n-ramp steps (some one-thousandth off: `0.97` vs n1 `0.971`, `0.87` vs n3 `0.871`). Achromatic, so no monochrome violation; the CI pin doesn't govern them. **Disposition: acceptable as-is this phase; optional snap-to-ramp at B3** (a values-only retune under this contract's names, zero component edits).

**`.dark` block status.** Present in code (shadcn scaffold), **not a designed surface this phase** (design-language: desktop-only, one monochrome theme). Names are frozen with everything else; whether B3 swaps its values in parallel or the block is explicitly descoped is an **open operator call** — logged here, decided at B-track kickoff.

### §3.5 Structural semantics (raw custom properties)

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--hairline` | `semantic.border.hairline` | `1px solid var(--color-n2)` | the separation treatment (design-language §1.9). The 1px is locked; the grey may retune within the neutral ramp only. |

---

## §4 — Tier 3 · Component tokens

Grows additively as surfaces build. Rule: **every new component token aliases a semantic or primitive — never a literal.** Current census:

| Slot (CSS) | Contract name | Value (current) | Notes |
|---|---|---|---|
| `--imgmax` | `component.comment-media.max` | `160px` | tunable; consumed by the debate render (DEBATE.4) |
| `--imgr` | `component.comment-media.radius` | `6px` | **CD-DEFERRED placeholder** per the in-code comment — value open, name frozen |

---

## §5 — The B3 swap runbook (what "pure value-swap" means, exactly)

One commit, zero per-screen edits:

1. **Mint the accent primitives** (§2.2 names — never `--color-brand`, CI ban) with B1's ratified values into the `@theme` design-token block.
2. **Re-point the swap trio**: `--primary`/`--primary-foreground`, `--accent`/`--accent-foreground`, `--ring` from their grey literals to `var(--color-accent-*)` (both `:root` and, per the `.dark` decision, `.dark`).
3. **Disposition the §3.4 deviations**: `--destructive` neutralize-or-ratify; `.dark` blue per the `.dark` call; off-ramp greys optionally snapped to ramp.
4. **Retune (only if B1 requires)** neutral-ramp values and/or `--chart-*` — same names, new values.
5. **Fill the type placeholders**: `--font-sans`/`--font-mono` (and `--font-heading` if a second family is ratified) → the brand family (licensing verified *before* the CD session, per the research's threshold rule).
6. **Amend the CI pin in the same commit** — exact-string expectations for any retuned value; chroma-census count if the token-name pattern set changes; keep the `NOT Support (design-language §1.3/§2.1)` coupling intact; never reintroduce the banned strings. The test survives as the brand-drift guard.
7. **Do not touch**: `--color-yes`, `--color-no`, any slot *name*, `--hairline`'s 1px, the derived radius scale's `calc()` structure, any component markup.

Anything a B1 asset needs that has no slot here → contract amendment first (v0.x bump, operator-ratified), then the CD session.

---

## Appendix — DTCG `tokens.json` skeleton (B3 fills nulls; generated 1:1 from this contract)

```json
{
  "primitive": {
    "neutral": {
      "0":  { "$value": "oklch(1 0 0)",     "$type": "color" },
      "1":  { "$value": "oklch(0.971 0 0)", "$type": "color" },
      "2":  { "$value": "oklch(0.922 0 0)", "$type": "color" },
      "3":  { "$value": "oklch(0.871 0 0)", "$type": "color" },
      "4":  { "$value": "oklch(0.708 0 0)", "$type": "color" },
      "5":  { "$value": "oklch(0.556 0 0)", "$type": "color" },
      "6":  { "$value": "oklch(0.371 0 0)", "$type": "color" },
      "7":  { "$value": "oklch(0.205 0 0)", "$type": "color" },
      "ink":{ "$value": "oklch(0.145 0 0)", "$type": "color" }
    },
    "accent": {
      "500": { "$value": null, "$type": "color" },
      "600": { "$value": null, "$type": "color" },
      "on":  { "$value": null, "$type": "color" }
    },
    "font": {
      "sans": { "$value": "Geist Sans (placeholder)", "$type": "fontFamily" },
      "mono": { "$value": "Geist Mono (placeholder)", "$type": "fontFamily" }
    },
    "radius": { "base": { "$value": "0.625rem", "$type": "dimension" } }
  },
  "semantic": {
    "side": {
      "yes": { "$value": "{primitive.neutral.ink}", "$type": "color", "$description": "LOCKED — never rebranded" },
      "no":  { "$value": "{primitive.neutral.0}",   "$type": "color", "$description": "LOCKED — never rebranded" }
    },
    "surface": {
      "base":    { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "card":    { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "popover": { "$value": "{primitive.neutral.0}",   "$type": "color" },
      "muted":   { "$value": "oklch(0.97 0 0)",         "$type": "color", "$description": "off-ramp shadcn grey — §3.4.3" }
    },
    "text": {
      "base":  { "$value": "{primitive.neutral.ink}", "$type": "color" },
      "muted": { "$value": "{primitive.neutral.5}",   "$type": "color" }
    },
    "action": {
      "primary":            { "$value": "{primitive.neutral.7}", "$type": "color", "$description": "B3 → {primitive.accent.500}" },
      "primary-foreground": { "$value": "oklch(0.985 0 0)",      "$type": "color", "$description": "B3 → {primitive.accent.on}" },
      "accent":             { "$value": "oklch(0.97 0 0)",       "$type": "color", "$description": "B3 → accent family" }
    },
    "status": { "destructive": { "$value": "oklch(0.577 0.245 27.325)", "$type": "color", "$description": "⚠ chromatic — §3.4.1 disposition" } },
    "border": {
      "base":     { "$value": "{primitive.neutral.2}", "$type": "color" },
      "input":    { "$value": "{primitive.neutral.2}", "$type": "color" },
      "hairline": { "$value": "1px solid {primitive.neutral.2}", "$type": "border" }
    },
    "focus": { "ring": { "$value": "{primitive.neutral.4}", "$type": "color", "$description": "B3 → {primitive.accent.500}" } },
    "chart": { "$description": "chart.1–5 per §3.2; B-track call on tinting" },
    "sidebar": { "$description": "sidebar.* per §3.2; ⚠ .dark sidebar-primary chromatic — §3.4.2" },
    "type": { "heading": { "$value": "{primitive.font.sans}", "$type": "fontFamily" } }
  },
  "component": {
    "comment-media": {
      "max":    { "$value": "160px", "$type": "dimension" },
      "radius": { "$value": "6px",  "$type": "dimension", "$description": "CD-deferred placeholder" }
    }
  }
}
```

---

> **Changelog.**
> **v0.2-draft (2026-07-02, DC.1):** shadcn layer pinned **verbatim** from `globals.css` (`:root` + `.dark`, every slot, light+dark values, ramp-mapping annotations); full five-block census recorded incl. the `@theme inline` plumbing, `--font-heading`, and the derived radius scale; **§3.4 added** — the three off-system deviations (chromatic `--destructive`, chromatic `.dark --sidebar-primary`, off-ramp shadcn greys) recorded with dispositions, plus the `.dark` open call; §5 runbook rewritten against the CI pin's exact mechanics (exact-string pins, 11-count chroma census, `--color-brand` ban, comment-string couplings); appendix semantic layer filled. Source: CC micro-recon #2 verbatims, 2026-07-02.
> **v0.1-draft (2026-07-02, DC.1):** initial contract — built system recorded (n-ramp, side poles, fonts, radius, hairline, imgmax/imgr), accent family reserved, shadcn names mapped with values ⟂, B3 swap runbook + CI-pin amendment rule, on-side-foreground non-slot decision.

*End token contract v0.2-draft. Names freeze at operator ratification; values live. Next: ratify Parts 1+2 → Part 3 (canon + mockup index + CD fine-tune log) → DC.3 commits.*
