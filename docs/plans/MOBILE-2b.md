# MOBILE-2b — use the phone tier of `/m/[slug]` like its user, find everything wrong, fix it

**Task:** MOBILE-2b · **Branch:** `feat/mobile-2-market-detail` (continued; local branch `mobile-2b`)
**Base tip:** `e49f27f5eed4986ffc9c614279a71f556578e5dd` · **`origin/main`:** `8d63ebc06f34a9b9549a6aa6a9dc4d8db7bb5e76`, unmoved
**Doctrine:** `docs/overnight-run.md` v1.2 · **Brief:** `zz_MOBILE-2b_overnight-brief_2026-09-12.md`
**QA log (the evidence for everything below):** `~/Downloads/zz_MOBILE-2b_qa_2026-09-11T2254.md`

---

## 0 · What changed about how this was found

MOBILE-2 built the phone tier from stills and verified it by measurement. It never used it, because it
could not: the local database held zero markets and the preview cannot be signed into.

This run can. An isolated local database (`zugzwang_qa`, on the same local Postgres, so the suite's own
database is untouched) was migrated, then populated by the repository's **own** engine-driven fixture
generator in its documented local proving mode — 10 participants, 15 markets, 56 bets, 56 comments, 24
positions, resolutions, payouts, moderation removals and a real image through the shipped R2 chain. Three
vendor stubs outside the repo (S3, Upstash REST, OpenAI moderations) let that engine run offline, and not
one product file was changed to make it work: every one of those SDKs already reads its base URL from the
environment. A session cookie signed with a secret the harness invented for itself makes the browser a
signed-in participant, verified by `GET /api/auth/get-session` with two negative controls.

The result is that **a real Đ25 bet was placed from a phone-sized WebKit browser through the real
handler**, and the defects below are things that happened, not things inferred from source.

---

## 1 · THE DEFECT REGISTER, in severity order

Full reproductions, measurements and controls are in the QA log. This is the build list.

| # | sev | what | root cause | slice |
|---|:--:|---|---|:--:|
| **D-1** | **P0** | **Tapping `NO` does nothing — half the debate is unreachable** | the write path and the read path share one setter; a smooth scroll is progressive, so the observer sees the old pane one frame in and scrolls back. `PhoneFeedTrack.tsx:93-96` vs `:108-151` | S1 |
| D-11 | P1 | the two sides share one scroll position; the short side is padded out by 728px of blank ground | the panes never scroll — the document does. `PhoneFeedTrack.tsx:157,175` + the `100vh` chain | S2 |
| D-3 | P1 | `100vh` / `96vh` where the repo already ruled `dvh` | `(public)/layout.tsx:206`, `PhoneSheet.tsx:218` | S2 |
| D-2 | P1 | the argument fields are 14px, so iOS zooms the page and never zooms back | `BetComposer` textareas | S2 |
| D-4 | P1 | 55 tap targets under 44×44, one of them 3×3 | tabs 34, strip 34, card triggers 26, download 32, pseudonyms 22, sheet `×` 15×20, back 24 | S2 |
| D-5 | P1 | the active YES tab is the colour of the page behind it | `bg-yes` == `--color-ground` == `#181818` | S2 |
| D-6 | P1 | the one axe `serious`: 3.07:1 on the strip's thumb fallback | `text-n4` on `bg-n1` at 8.5px | S2 |
| D-7 | P1 | portals leave the tier gate and carry desktop sizing (RI-5, O-m) | `dialogs.tsx` `max-w-[720px]`, `90vh`, `60vh` | S2 |
| D-8 | P1 | Back leaves a sheet floating over the wrong screen | no `popstate` handling under `phone/` | S2 |
| D-10 | P2 | 252 timer callbacks a minute for a tree the reader cannot see (RI-3, O-l) | `ScrollRail` + `DebatePoll` run while `display:none` | S3 |
| RI-4 | P2 | the poll can refresh under an open composer (O-n) | `DebatePoll` cannot see the phone sheet | S3 |
| RI-8 | P2 | a placed argument is not brought to the reader | no phone equivalent of the desktop's jump-and-flash | S3 |
| RI-9 | P2 | no pressed state, no `touch-action: manipulation` | — | S3 |
| D-12 | P2 | `pb-[140px]` is a magic number for a 47–113px bar | `PhoneDebateView.tsx:275,332` | S3 |
| D-9 | P2 | the bar's safe-area docblock claims what the padding does not do | no `viewport-fit=cover`; the inset resolves to 0 | S3, comment only |

**Reported, deliberately NOT fixed** — each with its reason in the QA log: **D-13** (the desktop tree
overflows 754 vs 640 at exactly 640px — fixing it moves a desktop pixel, which B1 forbids); **D-14** (the
first-login deck is `w-[513px]`/`94vh` — shell lane); the four header controls at 34px (shell lane).

---

## 2 · SLICES, with exit conditions

| # | slice | exit condition |
|---|---|---|
| **S1** | **D-1.** Separate the track's write path from its read path. | Tapping `NO` moves `aria-selected` and `scrollLeft` to 390 on **M1 (WebKit) and M2**, at `reducedMotion: no-preference`. Full suite green. |
| **S2** | The P1 layer: `dvh`, 16px inputs, tap targets, tab contrast, the axe serious, portals, `popstate`, the shared scroll position. | overflow 0 on M1–M6 · inputs ≥16px with the composer OPEN · axe serious/critical 0 · tap misses under 44 reduced to the shell-lane residue · B1 = 0. |
| **S3** | Feel: pause the hidden tree's timers, suspend the poll under a phone sheet, bring a placed argument into view, pressed states and `touch-action`. | timers at phone width ≈ 0/min · poll paused while a sheet is open · desktop neutrality tests green. |
| **S4** | Guards for every fixed defect, each verified by reversal. | every new guard reds against the pre-fix tree, with the assertion message recorded. |
| **S5** | Full suite · cascade · docs · push · preview. | suite green, PR #517 updated and DRAFT, preview serves the final tip. |

**Commit boundaries may move** where two slices have no shippable intermediate state; the order of work
does not.

---

## 3 · THE DESKTOP-TREE EDITS I INTEND TO MAKE, and why each is inside the scoped exception

ADR-0051 D-2 (amended today) permits a logic edit outside `phone/` only when it fixes a phone defect, is
render- and behaviour-neutral at ≥640px, is covered by a test that fails if the desktop path changes, and
is listed individually. Tokens that are additive `max-mobile:` are *not* logic edits and are the ordinary
ADR-0045 convention; they are listed anyway, because B1 is a pixel claim and the reader deserves the set.

| file | kind | why it is neutral ≥640 |
|---|---|---|
| `src/app/(public)/layout.tsx` | additive token on `<main>` | a `max-mobile:` min-height override; the unprefixed `100vh` value is untouched, so ≥640 computes exactly as before |
| `src/components/composer/BetComposer.tsx` | additive tokens + DOM attributes | `max-mobile:text-[16px]`; `enterkeyhint` is a DOM attribute with no rendered geometry |
| `src/components/debate/PostCard.tsx`, `ArgProfile.tsx` | additive tokens | `max-mobile:` min-heights on the Support/Counter triggers and the identity links |
| `src/components/debate/dialogs.tsx` | additive tokens | phone-width sizing on shared dialog content |
| `src/components/debate/ScrollRail.tsx` | **logic** | RI-3: the interval's *start* is gated on the same media query the tier uses, evaluated in an effect (never during render) and re-evaluated on change. Neutral ≥640 because the query is false there. Neutrality test: the desktop path still starts the interval. |
| `src/components/debate/DebatePoll.tsx` | **logic** | RI-4: one additional read of a shared store. Neutral ≥640 because the phone flag is only ever set by the phone tree, which does not render there. Neutrality test: desktop pause behaviour unchanged. |

---

## 4 · AMBIGUITIES RESOLVED, with the alternative rejected

| # | ambiguity | chose | rejected | why |
|--:|---|---|---|---|
| A-1 | the worktree command in the brief refuses — last night's worktree still holds the branch and its session is alive | a new worktree on a **new local branch** at the same tip, pushed later by explicit refspec | `git worktree remove ~/code/zugzwang/mobile-2` to free the branch | that tree belongs to a process that is still running. Freeing a branch by deleting somebody else's checkout is not a thing to do unattended, and the refspec push costs nothing. |
| A-2 | the local database is shared with the test suite | a **separate** database `zugzwang_qa` | seeding content into `postgres` | last night's E-13: a suite test that reads `markets` unfiltered reddens when another process seeds rows. Isolation removes the whole class. |
| A-3 | the eight founder content markets collide with the generator's fixture owner | ship **without** them; walk the generator's `sp-m2-active` (34 comments) | running the content seeder first and the generator second | the generator is the one that produces *replies, positions, moderation and an image* — the things a phone walk needs. The content markets add founder copy and nothing structural. Their absence costs the walk nothing and their presence would have cost the generator 43 of its 56 comments. |
| A-4 | D-1's fix: suppress the observer during a programmatic scroll, or drop smooth scrolling | **suppress the observer while a programmatic scroll is in flight** | making the scroll instant for everyone | the smooth slide is the tier's one piece of motion and the canon has a value for it. Removing motion to fix a race is fixing the symptom. |
| A-5 | D-3's `100vh`: edit the value, or add a token | an **additive `max-mobile:`** override | changing `100vh` → `100dvh` outright | `<main>` is every `(public)` route's height source at every width. Changing the base value is a desktop change and B1 forbids it. |
| A-6 | D-9 safe area: mint `viewport-fit=cover` so the padding works, or correct the claim | **correct the claim** | minting the viewport export | without `cover` the browser insets the viewport itself, so today's layout is the *safe* one. Adding `cover` pushes every `(public)` surface under the home indicator — a cross-lane layout change, from a task whose remit is one route. |
| A-7 | D-13, the 640px desktop overflow | report, do not fix | fixing it | 640 is the desktop tree. B1 is a wall. |

---

## 5 · BASELINES (measured before any change, on the local production build)

| id | what | layer | value at `e49f27f5` |
|---|---|---|---|
| B4/B6 | the suite | `pnpm vitest run`, local PG, quiet tree | **486 files / 4968 tests, green, 227 s** |
| B7 | tap-target misses, M6 signed in, feed arm | every interactive element's box | **55** |
| B8 | axe, M1–M6 + B639/B640/L | `@axe-core/playwright`, wcag2a/2aa/21a/21aa | **0 critical / 1 serious (`color-contrast`) / 0 moderate** |
| B10 | timer callbacks per minute at phone width | `setInterval`/`setTimeout`/rAF wrapped, 20 s window | **252/min** (4 intervals: 2×15000ms, 2×250ms) |
| — | horizontal overflow | `documentElement.scrollWidth` vs `innerWidth`, M1–M6 | **0 offenders, doc == window** |
| — | the tier gate | which root has a box | phone at 639, desktop at 640 — exactly one each side |
| — | composer inputs | `getComputedStyle` with the sheet OPEN | title **14px**, body **14px**, amount 20px; `enterkeyhint` null on all three |

**Predicted after:** tap misses ≤ 12 (the shell-lane residue), axe serious 0, inputs ≥16px, timers ≈ 0/min
at phone width, B1 unchanged at 0 differing pixels.
