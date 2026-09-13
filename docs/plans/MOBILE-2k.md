# MOBILE-2k — the feed's top pill and media containment (phone)

> Lane `feat/mobile-2-market-detail`. Ground tip **`f3345c81`** (MOBILE-2j's).
> Scope: `/m/[slug]` **below 640px only**. `/u/[pseudonym]` is untouched this round.
> Ruling: **ADR-0051 A7** (appended in the same round).

---

## 0 · Why these two things, together

They are the same defect seen twice, and MOBILE-2d caused both without touching either.

**The pill.** MOBILE-2d made the phone tier a bounded app shell — the tier root is
`h-[calc(100dvh-60px-2px)] overflow-hidden`, so the DOCUMENT no longer scrolls below
640px. A browser fires pull-to-refresh from an overscroll at the top of the *document*.
So the gesture every phone reader already knows stopped existing on the market page, and
nothing reported it, because a gesture that does nothing is indistinguishable from a page
with nothing new. A reader a screen deep also had no way back to the top and no way to
ask for fresh prices.

**The media.** `CommentImage`'s `fill` arm bounds height with `max-h-full`. That is a
*percentage*, and a percentage `max-height` resolves to `none` unless an ancestor has a
definite height — which is exactly what `PostCard`'s own `.argimg` docblock says. The
desktop grid supplies one (founder's 2026-08-17 parity ruling), so the bound has always
worked at 1440. The phone feed is content-sized cards inside a scroller and supplies
none, so `max-h-full` is inert and a portrait attachment renders at its **intrinsic**
height, bounded on width alone.

⇒ Both are cases of a bound that exists and does not bind. Neither errors.

---

## 1 · F-1 · The top pill

New leaf `src/components/debate/phone/PhoneTopPill.tsx`, mounted by
`PhoneDebateView` **only while `focused === null`** (the feed arm; not `?post=`).

| property | decision |
|---|---|
| label | `↑ Top`; `Refreshing…` while the refetch is in flight |
| box | 36px painted (`h-9`), pill (`rounded-full`), `bg-card` (`--color-n0`), `--hairline` border, `text-ink` at `text-[13px] leading-[1.2]`, **no** shadow / blur / colour |
| tap target | 44px via `after:-top-1 after:-bottom-1 after:inset-x-0` (36+4+4). **No** `after:pointer-events-none` |
| position | `absolute top-full left-1/2 mt-3 -translate-x-1/2` inside the **header block**, which gains `relative`. `top-full` = the block's own bottom edge, so "12px under the tabs" is structural — the block's height is set by how many lines the question wraps to |
| z-order | inherited: the header block is `z-30` and a flex item, therefore a stacking context → above the feed (`z-auto` sibling) and below `PhoneSheet` (`fixed z-50`). **No `z-*` token on the pill** — one would resolve inside its parent's context and say nothing about either relationship |
| show | region `scrollTop > 1 × clientHeight` **and** the reader moved **up** |
| hide | moved **down**; or `scrollTop < 0.5 × clientHeight`; or a sheet holds the lock |
| hysteresis | show at `> 1×`, hide at `< 0.5×` — the gap is the mechanism; one shared threshold flickers every frame on a momentum scroller |
| input | **one** `scroll` listener on the feed region, `{ passive: true }`, plus a `lastScrollTop` ref. **No** touch/pointer handler, **no** `preventDefault`, **no** new scroll container |
| motion | `PhoneSheet`'s tokens verbatim — enter `duration-[260ms] ease-out`, exit `duration-[200ms] ease-in`; travel `slide-in-from-top-[6px]` / `slide-out-to-top-[6px]` (6px settle down / 6px lift) |
| reduced motion | `motion-reduce:slide-in-from-top-0` / `motion-reduce:slide-out-to-top-0` → **fade only, no travel**; scroll becomes `behavior: "auto"` |

### The tap
1. refuse if `refreshing` **or** `busy` (composer in flight) **or** `locked` **or**
   `isPageScrollLocked()`;
2. already at top (`scrollTop <= 1`) → refetch, no scroll;
3. else `region.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" })` — the
   **region**, never `window` (the document does not scroll here; `phone-scroll-model`
   rejects `window.scrollTo` and `scrollIntoView`);
4. poll `scrollTop <= 1` on `requestAnimationFrame` for up to **1000ms** — not
   `scrollend`, whose Safari support is uneven and whose absence would mean a refresh
   that silently never fires;
5. on arrival **or** on the deadline, `router.refresh()` inside `startTransition` —
   **exactly once per tap**, latched by a ref rather than by `refreshing` (which React
   sets a tick later);
6. `isPending` is the settle signal: the label returns and the position floor takes the
   pill away, because the region is now at 0.

### What it must not disturb
`activeSide`, the composer instance, the `sheet` union, the four existing tap targets.
`composerBusy` is **reachable** (`BetComposer` → `onBusyChange` → `PhoneDebateView`), so
the money guard is a real flag and not the brief's fallback.

### Contract changes this requires
* `scroll-lock.ts` exports `isPageScrollLocked()` — a read of the existing refcount.
* `phone-gesture-wall.test.ts` `RATIFIED_LISTENERS` gains
  `region::scroll::evaluate::{passive:true}` — **a decision, recorded in ADR-0051 A7
  D-1**, and `SCROLL_BEARING` gains `scroll` so the passive option is enforced rather
  than merely written.

---

## 2 · F-2 · Media containment

`CommentImage`, **`fill` arm only** (the post/reply card attachment; the non-`fill` arm
is `PostFocusHeader`'s fixed side slot, which renders only in the desktop tree).

| token | why |
|---|---|
| `max-mobile:max-h-[60dvh]` | the first bound this arm has ever had below 640. `dvh` not `vh`: `vh` is the LARGE viewport, so `60vh` exceeds 60% of what a reader with a toolbar can see |
| `max-mobile:[border:none]` | arbitrary property overriding an arbitrary property — Tailwind orders a variant after its unprefixed peer within one utility kind. `border-none` sets `border-style`, whose position against a `border` shorthand is not a thing to assume |
| `max-mobile:rounded-(--r)` | the **card's** radius (8px), diverging from the ratified `--imgr` (6px) by founder ruling for this round. `--imgr` still governs everywhere else |
| `max-mobile:w-full` on the box | the box becomes the card's content width and the image is centred in it, rather than the box shrink-wrapping the image |

Unchanged: `object-fit: contain` (already), the transparent box (so the letterbox ground
is the card's own `bg-card`), no inset padding, desktop, and the composer's
attached-preview.

**No aspect-ratio reservation.** Measured: `DebatePost.imageUrl` is `string | null` and
nothing else; `load-debate-view.ts` mints it from `image_uploads`, which carries
`content_type` and `byte_size` and **no width or height**. An invented ratio is a layout
shift with extra steps, so the jump stays and is owed work with a name.

---

## 3 · Test plan

Guards, each to be **reverted once** to prove its red:

| # | guard | shape |
|--:|---|---|
| G1 | pill absent at load | render/hydrate; assert no `phone-top-pill` |
| G2 | pill absent while the lock is held | `locked` → returns `null` |
| G3 | exactly one `router.refresh()` per tap | count calls; arrival **and** deadline paths |
| G4 | no refresh while `busy` | tap with `busy` → zero calls |
| G5 | the scroll target is the REGION, not `window` | source: no `window.scrollTo` / `scrollIntoView` under `phone/`; behavioural: `scrollTo` called on the passed element |
| G6 | no touch/pointer handler in the pill | source scan + the closed listener allowlist |
| G7 | `max-mobile:max-h-[60dvh]` present on the `fill` arm and absent from the non-`fill` arm | render both arms, read the class |
| G8 | the `fill` arm carries `max-mobile:[border:none]` | render + class |
| G9 | the composer's attached preview is unchanged | class equality against the ground tip's string |
| G10 | the pill's 44px arithmetic is DERIVED from its tokens | `h-9` + `-top-1` + `-bottom-1` = 44, read off the class |
| G11 | the exit constant matches the exit class, and both match `PhoneSheet`'s | read both files |
| G12 | the pill mounts on the feed arm and not on the thread arm | render both |

⚠ jsdom performs no layout, so every geometric claim (the 12px gap, the 60% cap, the
centring, the computed border) is a **browser** measurement, not a unit test. The unit
layer pins the tokens and the behaviour; the browser pins the pixels.

---

## 4 · Walls

* **B1-p**: `/m/` and `/u/` at 1440 / 640 / 639 / 360 / 375 / 390 / 430, box census over
  every `[data-testid]` **and** every element by structural path, against a **same-build
  floor measured adjacent in time**. ⚠ A floor taken from two runs one minute apart is a
  *false* floor: the price chart's x-axis is the clock and relative-time labels change
  width, so the floor must span the same elapsed time as the comparison.
* **B2**: zero document overflow-x at 360/375/390/412/430/639/640/1440, both sides, with
  a portrait post visible.
* **B7**: the pill ≥44px, and the four pre-existing targets unmoved.
