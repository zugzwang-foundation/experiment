# FEED-1 — the author sees the post they just made

**Branch** `feat/feed-1` · **Base** `06d417823de78ac6470525178219c82f6d8d6d12` (`origin/staging`)
**Mode** autonomous overnight; no operator gate at any point.
**PR target** `staging`, left unmerged.

---

## 0 · GROUND, AND THE PREMISE THAT MOVED

⚠ **The base is NOT the one this task was written against.** The kickoff names `origin/staging`
without a SHA and says a correction is expected. I cut at `17f666b`; **two commits landed on
`staging` during recon**, one of them `+63` lines in `BetComposer.tsx` — the file this task
rewrites. With zero edits on disk I re-based onto `06d4178` rather than build a guaranteed
conflict.

**Verified the overlap is textual, not semantic:**

```
git diff 17f666b 06d4178 -- src/components/debate/composer/BetComposer.tsx \
  | grep "router.refresh\|onClose\|OUTCOME"     →  (empty)
```

CS11 touched the title field, the composer's height and the `×` placement. **The success path
this task replaces is untouched.**

⚠ `staging` will keep moving tonight. The PR will need `staging` merged into it before it can
squash. Flagged; I am walled off from pushing `staging` and will not.

### Ground verification (each with its positive control)

> ⚠ **FENCED BY SYMBOL, NOT BY LINE (O-8).** This table cited `DebateView.tsx:408` / `:671` and
> `BetComposer.tsx:338-344` when it was written, and every one of those numbers was stale
> before the branch was three commits old — the widening moved them, and moving
> `marketColumnBody` below its inputs moved them again. A fence that names a line goes stale
> from the very edit it guards. Line numbers below are demoted to evidence; the symbols are the
> fence.

| Claim | Command | Result | Positive control |
|---|---|---|---|
| `ComposerSlot.tsx` exists here | `ls src/components/debate/composer/` | present, 266 lines | 19 sibling files listed |
| It is a strict 2-state machine | read in full | `open: boolean`, `state: "open"\|"closed"`, one ternary | — |
| Two call sites, no third | `grep -rn ComposerSlot src --include='*.tsx'` | both inside `DebateView`'s `marketColumnBody` and its post-arm `DebateColumn` map | same grep returns `DebateColumn` hits for a term known present |
| Success path | `BetComposer`'s `submit()`, the `outcome.kind === "success"` branch | `OUTCOME success` → `router.refresh()` → `onClose()` | — |
| Poll suspends on composer-open | `DebateView`'s `<DebatePoll>` mount | `composerOpen={openSide !== null \|\| openReply !== null}` | — |
| …and it reads `openSide`, **not** occupancy | same line | ⚠ **differs from the freeze** — see §2 RF-4 | — |

---

## 1 · A1 BASELINE — MEASURED, NOT ASSUMED

**Layer:** runtime `router.refresh()` invocations across the **real** `DebateView` tree,
driven through a **real** submit (jsdom + stubbed wire).
**Not** a call-site count — a grep finds **17** `router.refresh()` call sites in `src/`, **7**
of them on this surface, and none of them tells you that the poll fires a second one from a
different file on a path the composer never touches.
**Conversion:** `/m/[slug]/page.tsx` calls `loadDebateView` exactly once per render ⇒ one
refresh = one `loadDebateView` + the layout re-execution that rides every refresh (12–14 round
trips per tick, F-DEBATE-4). Refresh count is the multiplicand.

> **MEASURED: 2 refreshes per successful bet.**
> 1. the composer's own `router.refresh()`;
> 2. the poll's **resume** refresh, fired the instant `openSide` clears and `DebatePoll` stops
>    being suspended (`wasSuspended` → immediate refresh).

**PREDICTED POST-BUILD VALUE: 2.** FEED-1 moves *when* refresh #2 fires (dismissal instead of
success) and must not change *how many* there are. A third is a finding, not a cost.

Guard: `tests/unit/debate/render/posted-refresh-budget.test.tsx`.

**Ceiling:** counts, never content. jsdom runs no server; that `loadDebateView` produces a
*correct* post is a browser claim (§7).

---

## 2 · THE DESIGN

### RF-1 · ComposerSlot gains a third state

`open: boolean` → `slot: "scroller" | "composer" | "confirmed"`. New `confirmation: ReactNode`
prop beside `composer`. `data-state` gains `"confirmed"`.

- `occupied = slot !== "scroller"` is derived once at the top, so **every existing internal
  read of `open` keeps working** — the diff is confined to the places that must tell composer
  from confirmed.
- **The exit-hold becomes content-agnostic in fact, not just in principle.** `held.current`
  currently latches `composer`; it must latch **whichever node was live**, or dismissing a
  confirmation would animate the *composer* out for 260ms. This is the one line in the hold
  that was genuinely binary.
- **Focus:** `moved` changes from `boolean` to `SlotState | null`, so the focus move re-runs
  once per *content swap* rather than once per open. Without it, swapping the composer out for
  the confirmation drops focus on `<body>`. `opener.current` is captured only when null, so
  dismissal still restores focus to the original BUY control.

#### ⛔ The transition: why the wrapper does NOT get a `data-[state=confirmed]:animate-in`

Measured, from the shipped stylesheet
(`node_modules/tw-animate-css/dist/tw-animate.css`): **every** `animate-in` variant compiles to
the same `animation-name: enter`. Switching the wrapper's `data-state` from `open` to
`confirmed` therefore leaves `animation-name` unchanged on an element that is not being
re-created — and **CSS restarts an animation only when the name changes or the element is
replaced**. The entrance would silently never play.

⇒ **The entrance lives on the confirmation node itself**, which is genuinely newly mounted, so
it fires on mount and cannot fail to restart. `data-state="confirmed"` matches no animation
variant on the wrapper and is a state marker. The exit is untouched: `confirmed → closed` hits
the existing `data-[state=closed]:animate-out` at the ratified 260 ms (design-canon §5:100,
*"inner content slides ±14px + fades over .26 s; the border never moves"*).

*Rejected:* `data-[state=confirmed]:animate-in …` on the wrapper. It reads correct, type-checks,
and never runs — which is precisely the defect class `ComposerSlot`'s own docblock was minted
over (*"the focus move was written, shipped, typechecked and never once ran"*).

### RF-2 · Success holds the slot

`BetComposer` success path becomes:

```
dispatchKey({ type: "OUTCOME", outcome: "success" });   // UNTOUCHED — first, as today
props.onPosted({ commentId });                          // the host refreshes and arms
```

`onPosted` is **required**, not optional — a missing required argument is a compile error and a
forgotten call site cannot ship (O-1: structural beats procedural).

`parseWireResponse` returns `data: unknown`, so `commentId` is read through a type guard in the
same `Record<string, unknown>` idiom the envelope parser already uses. **Unreadable ⇒ today's
exact behaviour** (`router.refresh(); props.onClose();`) — SG-5 posture: unknown input renders
a state, never a crash.

⛔ Nothing before the 200 changes: not the payload, not the key, not the in-flight guard, not
`fetch`. Only what happens after.

#### ⚠ A2 — HOW WE KNOW THE REFRESH LANDED. The brief's inference is REJECTED, on evidence.

The brief infers `useTransition`'s `isPending`. **I did not adopt it**, for a measured reason:
`router.refresh()` wraps its own dispatch in **its own** `React.startTransition`
(`node_modules/next/dist/client/components/app-router-instance.js`, the `refresh:` member of
the app-router instance, read at HEAD). An
outer `useTransition`'s pending flag is therefore tracking a *different* transition object than
the one carrying the RSC fetch, and whether it stays pending depends on React lane-scheduling
internals I cannot measure without a browser.

⇒ **The signal is the model itself.** `model` is a prop deserialized from the RSC payload; it
gets a new object identity exactly when a new payload is applied and at no other time. So:

```
refreshLanded = model !== posted.fromModel
```

This is strictly better than a proxy: it does not ask *"did the transition finish"*, it asks
*"is the new data here"*, which is the question. It is also directly testable — `PolledHost`
in `poll.test.tsx` already models a landed refresh as exactly this, a model swap.

⚠ **The signal is unambiguous only because the poll is suspended throughout** — nothing else
can change `model` while `openSide` is held. Stated because it is load-bearing.

⚠ **Residual inference, declared:** that a fresh RSC payload always yields a new `model`
object identity. Grounded (RSC payloads deserialize to new objects; `DebateView` is not
memoized) but not measurable here. → §7.

#### The wait window, and why the author is never stuck

Between success and the model landing, the composer stays mounted showing **its own in-flight
state** — the correct thing to show, and not an approximation of anything.

⛔ The wall says every path out must terminate. The dismisser is armed **from the moment of
success**, not from the moment of confirmation — that is what covers the window before a model
arrives.

> ⚠⚠ **THIS PARAGRAPH WAS WRONG AS FIRST WRITTEN, AND IT IS CORRECTED HERE RATHER THAN IN AN
> APPENDIX (O-5).** It read: *"It does, **unconditionally**: a `pointerdown` or `wheel` outside
> the slot dismisses…"* — and `@code-reviewer` returned it as a **CRITICAL**, correctly.
> Activating a button from a keyboard dispatches `click` and **no `pointerdown`**; keyboard
> scrolling fires `scroll`, not `wheel`. So for a keyboard-only or switch-access reader that
> listener set was unreachable, and in the wait window **every other exit is independently
> dead** — the composer's `×` is `disabled={inFlight}`, its own ESC handler is guarded on the
> same flag, all five host navigations no-op on `composerBusy`, the identity retirement needs
> one of those five to move, and the fallback needs a payload that by hypothesis never came.
> Place a bet, lose the connection, and a keyboard reader was trapped.
> ⇒ **`Escape` is the modality-independent exit**, and it is the key that already closes the
> composer and every dialog on this surface. Guarded by
> `posted::ESCAPE-releases-the-author-in-the-WAIT-window-with-no-pointer-event`, which dispatches
> no pointer event at all — so it cannot pass on a pointer listener.

⚠ Arming it during the wait is safe *specifically because* `posted !== null` proves the request
already returned 200. `composerBusy` is still `true` in that window, but it is **stale** — the
composer simply never leaves `phase: "in_flight"` because it expected to be unmounted. So this
is not the mid-request unmount the security-audit MEDIUM forbids; that hazard needs an
*outstanding* request, and there is none.

*Rejected:* a `setTimeout` bound on the wait. A timer would be a second source of truth about
whether the refresh landed, and `ComposerSlot`'s own R6 docblock argues at length against
exactly that shape (*"IT IS NOT A SECOND TIMER"*).

### RF-3 · Confirmed renders the REAL post

`findPostedNode(model, selectedPost, commentId)` → `PresentPost | PresentReply | null`.

- market arm → `model.posts.find(p => p.id === commentId)`
- reply arm → `selectedPost.replies.support ∪ .counter` (a reply composer only exists inside a
  focused post, so its parent is `selectedPost`; no wider scan is possible or needed)
- **the return type admits only the PRESENT variant.** A `removed: true` match returns `null`.

⛔ Why not reconstruct from the receipt: `ordinal` is a read-time rank over *every* top-level
comment in the market; `badge` needs a full ranking pass; `entryPrice` is `pEff` while the
receipt carries `p1` (`newPrice`). Three fields that would be *wrong*, and **no jsdom test
could tell** — which is why the type, not a convention, forbids it.

**Rendered through the card the column already uses** — `PostCard` for a post, `ReplyCard` for
a reply. *(Ambiguity #3: the brief says "the SAME PostCard the column uses". The market column
uses `PostCard`; the reply column uses `ReplyCard`. I read the rule as "the card the column
uses" and applied it per arm.)*

⛔ **Fallback:** post absent after the refresh landed ⇒ close the slot exactly as today. Never
hang, never a placeholder, never a guess. A masked (removed) match takes this path too — the
brief names masking explicitly.

### RF-4 · Freeze and poll — VERIFIED, and it needs NO new term

Because `openSide` / `openReply` are **held** through the confirmed state (they clear on
dismissal, not on success):

- `frozen` — already true via **both** `openSide !== null` **and** `slotOccupied`
  (`ComposerSlot` reports `mounted`, which stays true). ✅ The brief predicted this; it holds.
- `DebatePoll` — `composerOpen={openSide !== null || openReply !== null}`. ⚠ The brief expected
  occupancy here; **it reads `openSide` directly.** It still holds, for a different reason than
  the freeze does. Recorded because a future change that switches the poll to occupancy, or
  that clears `openSide` on success, breaks this silently.

⇒ **Zero production lines for RF-4. Guards only.**

> **SPEC NOTE — for the web lane, not for me to amend.** SPEC.1 §9 words the rule as *"any bet
> composer is open"* and carries a pinned acceptance row. **A confirmed slot is not literally a
> composer.** The founder ruling is that it suspends the poll too, and the build follows the
> ruling. The spec sentence and its acceptance row want widening to *"any bet composer or its
> confirmation"*. **Flagged, not authored.**

### RF-5 · Dismissal — every path terminates

⚠ **The table names the EVENT TYPES, because that turned out to be the whole question.** A path
is only an exit for the input modality that produces its event.

| Path | Event | Reaches |
|---|---|---|
| the `×` | `click` on `posted-dismiss` | pointer **and** keyboard (it is a `<button>`) |
| `Escape` | `keydown` | **every** modality — the only exit that does |
| a press outside the slot, not on a control | `pointerdown` | pointer / touch |
| a scroll outside the slot | `wheel` · `touchmove` | pointer / touch |
| the card's title | `enterPost` → the composer identity moves → `posted` retires | pointer and keyboard |
| any control that changes the arm | its own handler → identity moves → `posted` retires | pointer and keyboard |

**Three fences, each earning its place:**

1. **Inside `[data-testid="composer-slot"]` belongs to the slot.** Stops a press on the
   still-mounted composer, or on the card's own `Know more`, from dismissing.
2. **A press on a `button,a,input,textarea,label` belongs to that control** — d5's own rule and
   the same exclusion list `onDocClick` already uses. Without it, pressing `Buy` while confirmed
   dismissed on the `pointerdown` (releasing the arm, so the poll spent a refresh) and then
   re-opened a composer on the `click`: **one press, one round trip burned**, for a state change
   the control was going to make anyway through the identity retirement.
3. **Nothing dismisses while an overlay is open** (`popupPost || popupReply || lightboxUrl` —
   the same three flags `frozen` already reads). ⛔ This closed a real defect: the card inside
   the confirmation opens the image lightbox and the pop-ups, which render through a **portal**
   onto `document.body` and are therefore *outside* the slot. So opening your own just-posted
   image and closing it again dismissed the confirmation underneath — **the feature's own
   affordance destroying the state the feature exists to provide.**

*(Fences 2 and 3 were added after `@code-reviewer`; each is guarded, and each guard was verified
by reverting the fence and reading the red.)*

On dismiss: `posted` and `openSide`/`openReply` clear together ⇒ the slot exits at 260 ms, the
freeze releases, the poll resumes and fires its immediate refresh. All existing behaviour.

⚠⚠ **The stale-column option, logged and NOT built — and `@security-auditor` gave it a second,
better reason.** While confirmed, the poll is suspended, so the column is stale for that reader.
Correct for a short look, wrong for a long one. A bound without a timer exists — release the
poll (but not the freeze) once the confirmation has been on screen for one poll interval — but
it costs a round trip and would break the §1 budget. **Not built. Logged.**

> ⛔ **THE MODERATION ARGUMENT, WHICH IS THE ONE THAT MIGHT ACTUALLY DECIDE IT.** The auditor
> verified there is **no other reachable `router.refresh()` on `/m/[slug]`** while the arm is
> held — no interval, no visibility-resume, nothing. So a confirmation freezes that
> participant's view of **every** comment on the surface, not only their own, at the
> `loadDebateView` snapshot taken when the bet was placed. A `content_removed` action taken
> after that read never reaches that screen until they dismiss.
> ⚠ **It is NOT a masking bypass** — nothing renders that was not masked at read time, and the
> confirmation self-corrects the instant any payload does arrive, because `posted` stores a
> `commentId` and not a node. And an indefinite freeze was already reachable by leaving a
> composer open. **What changed is that it is now the DEFAULT post-bet state rather than an
> opt-in**, and it ends only on an explicit user action. Pre-FEED-1 a removal was masked within
> one poll interval (15 s) of a successful bet.
> ⇒ **Founder call, not a code fix.** Recorded here rather than in an appendix so whoever
> reconsiders the poll-release option reads both reasons at once (O-5).

### RF-6 · Copy

`Posted` — supplied verbatim by the kickoff. `×` — the existing `COMPOSER_COPY.close`.

⚠ **It is NOT in canon.** design-canon.md §6:122, quoted at head:

> **Composer (all bet composers):** header `Place your Đ BET` (reply variant: `Support
> <author>'s argument` / `Counter <author>'s argument`) · `Your argument — required` · counters
> `58 / 125`, `158 / 2,200 · optional` · `Image`, `Shown whole · any orientation` · `Amount Đ
> 50` · `To win Đ 126.6` · submit `PLACE Đ BET` · `Confirm bet · Đ 500`, `Cancel`, `×`.

⇒ It ships as a **separate** export, not inside `COMPOSER_COPY` — that block's docblock claims
*"Canon §6 … verbatim"* and adding a non-canon string to it would falsify the claim in place.
`copy.ts` already registers four authored-at-execute strings at their sites for the Gate C web
read; this is registered the same way, with better provenance (founder-supplied, not
CC-authored). **Canon is not edited.**

---

## 3 · FILE MAP — one reason per file

| File | Why |
|---|---|
| `src/components/debate/composer/ComposerSlot.tsx` | RF-1. The two-value gate widens; the hold becomes content-agnostic; focus re-runs per swap. |
| `src/components/debate/composer/PostedConfirmation.tsx` **(new)** | The confirmed state's chrome — `Posted`, the `×`, and the 260 ms entrance that the wrapper structurally cannot carry. |
| `src/components/debate/composer/copy.ts` | The one new string, in its own export with its own provenance. |
| `src/components/debate/composer/BetComposer.tsx` | RF-2. **Only** the four lines after a 200. |
| `src/components/debate/find-posted.ts` **(new)** | The receipt→model lookup, returning the PRESENT variant only. Separate so it is unit-testable without jsdom, and so the masking narrowing is one auditable place. |
| `src/components/debate/DebateView.tsx` | RF-2/3/5. Owns `posted`, the refresh, the lookup, the fallback and the dismisser — it already owns every other sub-view flag. |

**Not touched, deliberately:** `payload.ts`, `idempotency.ts`, `requests.ts`, `envelope.ts`,
`gating.ts`, anything under `src/server/`, `DebatePoll.tsx`, any read model, any ranking,
`profile/ArgumentBody.tsx`, `design-canon.md`, any SPEC, any ADR.

---

## 4 · SLICES

| # | Scope | Exit condition | Reviewer-bearing |
|---|---|---|---|
| **S1** | `ComposerSlot` → three states; both call sites pass `slot`/`confirmation`; no behaviour change yet | full suite green; `composer-slot.test.tsx` updated; new three-state + corpse-identity guards | no |
| **S2+S3** | success holds the slot · the model-identity handoff · the confirmation renders the real post · the fallback · both arms | full suite green; G1 G2 G5 G9; budget still **2** | **yes** — `@code-reviewer`, `@security-auditor` |
| **S4** | freeze + poll guards; the dismissers | full suite green; G3 G4 G8, each verified by revert | no |
| **S5** | full suite · reviewer cascade · fixes · PR | suite green, findings dispositioned, PR open against `staging` | **yes** — all three |

> ⚠ **S2 and S3 ship as ONE commit and here is why.** S2 alone holds the slot open waiting for
> a model that S3 is what reacts to: with no confirmation to swap in, the held composer never
> leaves the wait. There is no green intermediate, so shipping two commits would mean
> committing a tree that hangs. The **order** of the work is unchanged.

**Full suite at the end of every slice**, not the touched files. Measured cost: **154 s**
(388 files / 3519 tests, green at base).

---

## 5 · GUARDS — each with the wrong answer it must reject

| # | Guard | Rejects |
|---|---|---|
| G1 | confirmed renders the node whose id **is** the receipt's `commentId` | the wrong post; the first post in the list |
| G2 | post absent after the refresh landed ⇒ slot closes | hanging |
| G3 | `frozen` holds while confirmed | the carousel advancing under the card |
| G4 | the poll stays suspended while confirmed | a re-render underneath the card |
| G5 | the reply arm confirms its reply, identically | a market-only implementation |
| G6 | one successful bet costs exactly **2** refreshes | an added round trip |
| G7 | `data-state` reaches `confirmed`; the exit corpse is the **confirmation**, not the composer | the composer flashing back during dismissal |
| G8 | `×` dismisses · outside `pointerdown` dismisses · inside-slot `pointerdown` does **not** | a dismisser that fires on the slot's own controls — **paired with its positive control**, or the negative passes on a listener that was never armed |
| G9 | a **removed** match does not render and takes the fallback | a masked body reaching the screen |

**Every guard is verified by reverting its fix and reading the red**, with the assertion message
recorded in the run report. Selection is by `data-testid`, never by a styling class. Assertions
are on markup, child order and `aria-label` — never `textContent` alone (O-7).

---

## 6 · AMBIGUITY REGISTER (resolved at plan time; more may be added at execute)

| # | Ambiguity | Chose | Rejected | Why |
|---|---|---|---|---|
| 1 | how to know the refresh landed | model-identity change | `useTransition().isPending` | `router.refresh()` opens its **own** `startTransition`; the outer pending flag tracks a different transition. Measured in `next@16.2.4` source. |
| 2 | where the confirmed entrance lives | on the confirmation node | `data-[state=confirmed]:animate-in` on the wrapper | every `animate-in` compiles to `animation-name: enter`; unchanged name on an unchanged element ⇒ no restart, silently |
| 3 | "the SAME PostCard" for the reply arm | `ReplyCard` per arm | `PostCard` for both | the reply column uses `ReplyCard`; the rule is "the card the column uses" |
| 4 | a removed match | fallback-close | render the removed variant | the brief names masking in the fallback list; and the return type then admits no withheld content **by construction** |
| 5 | retiring a stale `posted` | one render-time adjustment keyed on composer identity | clearing at each of the **nine** `openSide`/`openReply` write sites | nine facts to keep in agreement is the shape this codebase argues against; a pure derivation is unsafe because re-opening the same arm would re-match |
| 6 | where the new string lives | its own export | inside `COMPOSER_COPY` | that block claims "Canon §6 … verbatim"; `Posted` is not in §6 |
| 7 | report filename stamp | UTC, per the brief | IST, per every other `zz_*` file | the brief is the more specific instruction; divergence logged |

---

## 7 · THE VERIFICATION CEILING — stated plainly

**No browser verification is possible in this run.** No preview (arbitrary branches are killed
by the Ignored Build Step; `verify` belongs to another session), no sign-in (walled), no
Playwright (not installed, not to be installed).

jsdom performs **no layout** and `router.refresh` is a **spy** — it proves the call was made,
never that a real server re-render produced a correct post and that `PostCard` drew it.

**A morning browser pass must check, specifically:**

1. A real bet on a real market **actually reaches the confirmed state** — i.e. the refreshed
   `model` really does arrive with a new object identity (§2 RF-2's one declared inference).
2. The confirmed card shows the **right** `ordinal`, `badge` and `entryPrice` — the three
   fields no jsdom test can adjudicate.
3. The confirmation's 260 ms entrance actually plays (kill animations *after* observing it —
   a hidden/CDP tab sits at the animation's start value).
4. The card **fills** the slot: `PostCard`'s image cell needs an unbroken `min-h-0 flex-1`
   chain above it, and jsdom cannot see a broken one.
5. Dismissing restores focus to the BUY control that opened the slot.
6. The column does **not** move while the confirmation is up, and resumes on dismissal.
7. The reply arm confirms in the composer's column (opposite the parent post) — visually
   correct, since slot ≠ side is the standing rule.
8. The wait window's duration on a real connection — the one number that decides whether the
   held composer reads as "submitting" or as "stuck". ⚠ **Related, and OWED rather than built:**
   `ErrorStrip` renders `null` for `phase: "in_flight"`, so the wait shows a greyed, motionless
   form with a disabled `×` and a disabled submit — visually indistinguishable from a hang.
   Before FEED-1 that window was invisible because the slot closed instantly; FEED-1 makes it
   the primary post-submit view. A progress affordance would need a **new string**, and RF-6
   says use the given strings and author none. **Flagged for the founder, not built.**
9. `Escape` dismisses in both the wait window and the confirmed state — the CRITICAL fix. jsdom
   proves the listener fires; only a browser proves nothing else swallows the key first.
10. Opening the image lightbox or a pop-up **from the confirmation's own card** and closing it
    again leaves the confirmation standing (fence 3 above).
11. Pressing `Buy` while a confirmation is up opens a composer **without** a wasted refresh in
    between (fence 2 above).
12. ⚠ While the arm is held, **both** column headers mirror `Buy YES` and there is no `Buy NO`
    on the surface — pre-existing §5 header-mirror behaviour (`openSide`-keyed) reaching a state
    it predates. Same class as the SPEC.1 §9 widening flagged in RF-4. **Not changed; flagged.**
