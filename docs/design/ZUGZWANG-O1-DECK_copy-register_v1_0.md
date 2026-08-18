# ZUGZWANG · O1-DECK — Copy Register v1.0

| | |
|---|---|
| **Doc** | `ZUGZWANG-O1-DECK_copy-register_v1_0.md` · web-authored · founder-ratified 2026-08-18 |
| **Status** | **RATIFIED.** This is the string source of record for the onboarding deck |
| **Supersedes** | The provisional six-card copy in `docs/design/mockups/DESIGN_W2_2_onboarding-deck_mockup-v0_1.html` (`var CARDS`, lines 231–243, md5 `420c5e800a3dbe3de57662f0d8f6c102`), self-labelled *"provisional copy"* |
| **Consumers** | The O1 build (component strings) · SPEC.1 §21.6 amendment · `DESIGN-copy-register-consolidated.md` |

> **Precedence.** SPEC.1 / SPEC.2 > ADR > this document. Where a card asserts a
> product fact, the spec wins and this file is amended — never the reverse.

---

## §1 · Why the bytes matter

Every string below carries characters that an ASCII keyboard does not produce:

| Character | Codepoint | Appears in |
|---|---|---|
| `’` right single quotation mark | U+2019 | `You’re`, `That’s`, `it’s`, `can’t`, `post’s`, `that’s` |
| `—` em dash | U+2014 | Cards 4, 5, 7 |
| `·` middle dot | U+00B7 | `K · n > C` |
| `Đ` D with stroke | U+0110 | *(no longer in any card — see §5)* |

**The build copies these bytes.** It does not re-type them. An ASCII apostrophe
in shipped copy is a defect, and it is invisible in review.

---

## §2 · The seven cards — first login

Order is normative. Eyebrow scheme: `ZUGZWANG` ×1 · `WELCOME` ×1 · `THE GOAL` ×1 · `THE RULES` ×4.

### Card 1 · `ZUGZWANG` · Knowledge first

**Figure:** the brand mark — `/brand/zugzwang-mark.svg`, rendered at hero size in the `.cfig` band. Component reuse from `BrandCluster`; no new asset.

**Title:**
```
Knowledge first
```

**Subtext** — three blocks, real line breaks, not one paragraph:
```
True knowledge is manipulated and bound by money,
which makes humanity take wrong decisions without a rational debate.
The fate of humanity should depend on true knowledge and not money.

Zugzwang is a prediction market that runs like a social network for debate.

The prediction market gathers knowledge through incentive;
the debate allows human society to fight manipulation;
the social network spreads the truth freely.
```

> ⚠ **~72 words against the other cards' 39–44.** This is a layout consequence,
> not a copy defect. The modal is sized to the tallest card so that advancing
> 1 → 2 does not jump. Do not cut copy to fit a box.

> ⚠ **The subtext of this card is a multi-block structure.** The mockup renders
> subtext as a single text node (`.csub`). Real line breaks here are an explicit
> departure from that shape and must be built deliberately.

---

### Card 2 · `WELCOME` · You’re {pseudonym}

**Figure:** the viewer's live PFP avatar as a centred hero (`.idhero`), rounded-square at `--imgr`. Matches `.navav`. No decorative illustration.

> ⚠ **BUILD ANNOTATION — O1-DECK, 2026-08-18.** *Appended, never a rewrite: the
> note above is ratified and stands exactly as written. This records what the
> build found, beneath it.*
>
> **There is no live PFP anywhere in this product.** Every surface renders one
> static asset, `/pfp-placeholder.svg` — `server/debate-view/resolve-authors.ts`,
> `server/profile/resolve.ts`, `server/discovery/hero.ts`,
> `components/shell/IdentityCluster.tsx` and `(auth)/onboarding/page.tsx` each
> hard-code it — and `users.pfp_filename`, though populated at signup, is
> deliberately never read by any renderer. `resolve-authors.ts` says so in its
> own words: the `pfp_filename → URL` builder is deferred to SCAFFOLD.15 / the
> R2 `pfp` bucket, so "every author renders the placeholder".
>
> **Card 2 therefore ships the shared placeholder plus the pseudonym-initial
> fallback, exactly as `IdentityCluster` renders it** — founder ruling **D-5**,
> 2026-08-18. Three things that ruling forecloses, each of which was reachable
> from the finding: the figure is **not dropped** (the `.idhero` slot stays
> filled, so the card's anatomy still matches every other card's); it is **not a
> new `FIG`** (inventing artwork for the identity card would put a second visual
> language beside the ported SVGs); and it is **not a deck-local avatar fetch**.
> When the real PFP lands it lands in the `resolve*.ts` resolvers that already
> own the placeholder constant, and this card inherits it the same way every
> other surface will — a deck-local fetch would have created a second PFP path
> for that migration to unpick.
>
> Recorded here rather than only in the plan because this note is what a future
> reader checks the card against, and a figure note that outlives its own
> falsification is how a register stops being a source of record.

**Title** — `{pseudonym}` is interpolated from the viewer, never hard-coded:
```
You’re {pseudonym}
```

**Subtext:**
```
This pseudonym is your identity for the length of the experiment. The experiment has 8 markets with unique flavours and defined resolutions. The experiment runs from 15th September 2026 to 5th November 2026. Dharma is your betting instrument for raising arguments in any of the 8 markets.
```

> ⚠ **This card carries two hard dates and a market count.** `15th September 2026`,
> `5th November 2026`, and `8` appear twice. If the slate or the window ever
> changes, this card is a place the product starts lying. Prefer binding the
> count and the dates to the same constants the countdown and the market
> loader already use.

> ⚠ **This is the only card dropped from the re-show.** See §3.

---

### Card 3 · `THE GOAL` · Knowledge, at scale, beats capital.

**Figure:** `FIG.goal` — the existing inline SVG from the mockup.

**Title** — the terminal full stop is deliberate; it is a claim, not a label:
```
Knowledge, at scale, beats capital.
```

**Subtext:**
```
True knowledge (K) brings informed people together (n), and the crowd that understands the truth can outweigh the money (C) betting on a false outcome. That’s the whole bet: K · n > C.
```

---

### Card 4 · `THE RULES` · No stake, no voice

**Figure:** `FIG.voice`

**Title:**
```
No stake, no voice
```

**Subtext:**
```
Every argument here is a bet. To post or reply, you back your view with Dharma — so every voice in the debate has real skin in the game. Speaking is staking.
```

---

### Card 5 · `THE RULES` · Soulbound reputation

**Figure:** `FIG.soulbound`

**Title:**
```
Soulbound reputation
```

**Subtext:**
```
Your Dharma is your reputation, and it’s yours alone. It can’t be bought, sold, gifted, or moved to another account. Everyone here starts with exactly the same amount — what separates you is what you do with it.
```

> **Tripwire.** *"It can't be bought, sold, gifted, or moved to another account"*
> is INV-2 stated in plain language, and it is literally true of the product.
> If Dharma is ever made transferable, this card becomes a lie. Treat any
> proposal to change INV-2 as a change to this card.

---

### Card 6 · `THE RULES` · Single-side binding

**Figure:** `FIG.side` — Support/YES = black, Counter/NO = white, per INV-3.

**Title:**
```
Single-side binding
```

**Subtext:**
```
You can hold a position on only one side of a market at a time, and your side locks to your words the moment you post. To switch, sell your whole position first, then re-enter — you can’t argue both sides at once.
```

---

### Card 7 · `THE RULES` · Support / Counter

**Figure:** `FIG.reply` — Support/YES = black, Counter/NO = white.

**Title:**
```
Support / Counter
```

**Subtext:**
```
Replying is betting, too. Reply with Support to stake on a post’s side, or Counter to back the other side. Every reply is an argument with Dharma behind it — that’s how the debate moves.
```

---

## §3 · The re-show variant — six cards

Ruled 2026-08-18 (R1). The About/RULES re-show renders **cards 1, 3, 4, 5, 6, 7** — the first-login set **minus Card 2 (`WELCOME`)**.

**Rationale.** A pseudonym reveal and an experiment-window announcement are
first-login facts. On a voluntary re-visit they are noise, and Card 2 is the one
card whose content is not reference material. This matches
`DESIGN_W2_1_first-login-journey_mockup-v0_1.html:306–317`, which already builds
`FIRST = [IDENTITY] + RULES + [GOAL]` against `ABOUT = RULES + [GOAL]`.

**Implementation shape:** one array, one filter. Not two arrays — two arrays
drift.

| Context | Cards | Count | Dismissible |
|---|---|---|---|
| **First login** | 1 · 2 · 3 · 4 · 5 · 6 · 7 | 7 | **NO** — no X, no Esc, no backdrop close. Forward-only to the last card |
| **RULES re-show** | 1 · 3 · 4 · 5 · 6 · 7 | 6 | **YES** — X and Esc available at any card (D2) |

**Both contexts** keep Back (disabled on card 1), Next, the dot rail, and the
step indicator. The final-step button reads `Enter Zugzwang` on first login.
The re-show's final-step label is unruled — see §6.

**The step index is derived, never hard-coded.** The mockup already does this
correctly (`N = CARDS.length`); the build inherits it. A literal `7` or `6`
anywhere in the stepper is a defect.

---

## §4 · Invariant coverage — stated, not implied

| Invariant | Card | Note |
|---|---|---|
| **INV-1** — mandatory commentary / reply-as-bet | 4 and 7 | Taught across two cards |
| **INV-2** — soulbound, non-transferable | 5 | |
| **INV-3** — side-bound at post time | 6 | |
| **INV-4** — resolutions append-only | **NONE** | |
| **Admin is not a participant** | **NONE** | |
| **The thesis (K · n > C)** | 1 and 3 | |

> ⚠ **INV-4 and admin-not-a-participant have no user-facing home anywhere in
> the product.** This is a founder ruling (D1, 2026-08-18), taken knowingly and
> recorded here so it is not rediscovered as a gap. SPEC.1 §21.6 makes the
> About surface *be* this deck, so declining to add the cards is declining to
> surface those two facts at all this phase.

---

## §5 · What changed from the mockup

| # | Change | Reason |
|---|---|---|
| 1 | **New Card 1** (`ZUGZWANG` / Knowledge first) | Founder commission. The deck previously opened on identity with no statement of what the product is |
| 2 | Deck goes **6 → 7 cards** | Consequence of 1 |
| 3 | **Đ figures removed** from the WELCOME card | The mockup asserted `Đ 1,000` and `about 10 Đ a day`. Both are ranged pending the **2026-09-01 number-tuning pass**, two weeks before go-live. Deleting them closes the risk outright — there is now **no tuning-pass-sensitive number in the deck** |
| 4 | *"You earn it by being right"* **struck** from the Soulbound card | **It was false for this phase.** Nothing resolves until 2026-11-06, so no Dharma is earned by being right during the live window. ADR-0018 Driver 3 is explicit: with no in-window resolution, reputation is *granted* equally, not earned. Replaced with the equal-start line |
| 5 | `Know more (K)` → `True knowledge (K)` | Founder edit; the `(K)` gloss restored so the equation's three variables are all defined before use |
| 6 | WELCOME card rewritten | Founder edit — experiment window, market count, and Dharma's role replace the grant/credit figures |
| 7 | Comma splice fixed in Card 1's closing triad | Three independent clauses; commas → semicolons |
| 8 | `8 market` → `8 markets`; double space removed in Card 4 | Mechanical |

**Not changed, and deliberately so:** the eyebrow scheme, the card anatomy
(figure band → eyebrow → title → subtext), the `FIG` illustrations, the
Support/YES-black / Counter/NO-white encoding, and the Back/Next shell.

---

## §6 · Open, and owned elsewhere

| Item | Owner |
|---|---|
| The re-show's final-step button label — `Enter Zugzwang` is wrong for a re-visit; `Done` or `Close` are the candidates | Plan-mode. `DESIGN_W2_1_first-login-journey_mockup-v0_1.html:384` already carries a `Done` variant |
| Whether the market count and the two dates on Card 2 bind to constants or ship as literals | Plan-mode |
| SPEC.1 §21.6 amendment — first-login gate, non-skippable, the dismissible re-show, the six/seven split | Web-authored, next |
| ADR-0037 — the persistence cookie | Web-authored, same commit as the code |
| RULES control placement in the header (R2 — centre, per mockup) | Plan-mode, measured before built |

---

*Ratified by Hrishikesh, 2026-08-18. Authored by web Claude across the O1-DECK
copy pass. Card strings are final; figures, layout and behaviour are the plan's.*
