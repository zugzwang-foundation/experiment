# R2-MEMO — Session log

**Task:** Hold presigned read URLs instead of re-minting them every render.
**Branch:** `new-S4Ritam` (off current `main`, `193d95a`) · **State:** uncommitted

---

## The defect

`mintReadUrl` produces a fresh presigned URL on every call — the signature embeds a timestamp,
so the same object yields a **different URL** each render. `/m/[slug]` re-renders every 15 s, so
an unchanged image is served under a new URL **240 times an hour, per open tab**. Browsers key
their cache on the URL, so every one of those is a cache miss and a full re-download of bytes
the client already holds.

The signing itself is a local HMAC and costs nothing. **The cost is entirely the re-downloads
and the storage reads behind them.**

---

## What landed

| File | Change |
|---|---|
| `src/server/storage/read-url-memo.ts` | **new** — the hold, bounded and self-evicting |
| `src/server/storage/sign-read.ts` | routes through the memo, keyed `uploads:<key>:<ttl>` |
| `src/server/discovery/media.ts` | routes through the memo, keyed `market-media:<key>:<ttl>` |
| `tests/unit/storage/read-url-memo.test.ts` | **new** — 8 tests, 3 of them positive controls |

**The hold is a calculation, never a second constant.** `HOLD_FRACTION = 5/6` of the URL's own
TTL:

- `READ_URL_TTL_SECONDS` 3600 → held **3000 s** (50 min, 10 min margin)
- `READ_URL_TTL_SECONDS_MODERATION` 60 → held **50 s** (10 s margin)

A hardcoded "hold 50 minutes" would be right for the first and **catastrophic** for the second —
it would hand out a URL that expired 49 minutes earlier and admin moderation images would
silently stop loading. Deriving the hold from the TTL makes that class of mistake
unrepresentable.

**The memo key carries bucket + object + TTL**, and both extra components are load-bearing:

- **TTL** — `signRead` serves *both* the 60 s moderation path and the 3600 s render path. Keyed
  on the object alone, a render could be handed the 60-second URL and break a minute later.
- **Bucket** — plan §1e keeps the participant `uploads` arm and the admin `market-media` arm
  separate. Identically-named keys in the two buckets are different objects.

**Failure posture unchanged:** the `set` happens only after the await resolves, so a throwing
mint stores nothing and the next call retries. A cached failure would turn one transient R2 blip
into 50 minutes of a missing image.

---

## Step 4 — the number the tracker called "the number to watch"

> **There is no cap.** `listMarketComments` carries no `LIMIT` — verified.

So a market seeded with 500 image-bearing arguments builds **500 URLs every 15 seconds, per open
tab**. The tracker is right that this is a fact about **the seeding plan**, not a bug in this
task, and right that it may matter more than the task itself.

The memo's `MAX_ENTRIES = 2048` bound exists precisely because the read it serves is unbounded:
an uncapped comment list must not become uncapped memory. Overflow evicts (expired first, then
oldest) rather than failing — a miss just re-mints, which is what happened before this module
existed.

---

## Step 6 — NOT done, and the tracker understates its risk

The tracker frames "tell browsers the picture never changes" as low-risk, applying to new
uploads only. **On inspection it is a coordinated three-file change with an upload-breaking
failure mode.**

`mintPutUrl` signs a `PutObjectCommand`. Adding `CacheControl` makes that header **part of the
signature**, so every uploading client must then send it byte-identically. Two client sites
upload today:

- `src/components/debate/composer/image-attach.ts:111`
- `src/app/(admin)/admin/markets/new/create-market-form.tsx:73`

If either does not send a matching header, **its uploads fail with a signature mismatch** — and
they fail at the point a participant is trying to post an argument.

⇒ **Recommended as its own small task** with both client sites changed in the same commit and an
upload exercised end-to-end before merge. The payoff is real but strictly smaller than the hold
above, and it is not worth carrying that failure mode as a rider.

---

## Interaction with S-4 — not a smaller win, a defect

⚠ **This section was wrong when it was written, and wrong in the direction that let the change
look safe. Corrected in place rather than appended to, because an appendix reverses nothing a
reader reaches first (O-5).**

The tracker says this touches *"nothing S-4 is working on — separate files entirely."* Different
files, **yes**. Independent, **no**.

S-4 caches the market page's whole view model — **including the `imageUrl` fields these calls
produce**. It is **merged**, not an unmerged branch: it landed as #405/#423 and `cacheComponents`
is on. Three `'use cache'` boundaries wrap these call sites today, and CHART-1 has since added a
fourth.

**The claim this section used to make — that the cache "busts on any bet, after which the URLs
re-mint" — is the exact inverse of what happens.** A bust re-runs the cached block, which calls
`signRead` again, which now **hits the memo and returns the original URL**. The mint does not
happen. Cache-busting no longer refreshes the URL; the memo is precisely what stops it.

That inversion is what made the interaction look like a smaller win instead of what it is. The
premise `load-debate-view.ts` states for its 7200 s TTL — that the URL embedded in a cache entry
was *minted at generation time* — is the premise this module removes. A URL can now be up to
6000 s old **before** the entry carrying it is generated, and that entry is then served for up to
`cacheLife("minutes").expire` = 3600 s more. `6000 + 3600 = 9600 > 7200`: the last ~2400 s of the
serve window hands out an already-dead URL. Silent — the mint succeeded, so nothing throws, and
no test in the suite passes 7200 through the memo.

**Practical consequence:** on Discovery, the debate view and every other cached surface this is
**not a reduced benefit — it is a correctness regression**, and it re-opens the presigned-URL
silent-breakage class ADR-0041:126 recorded as closed. The admin feed and the moderation hop are
uncached and unaffected by *this* mechanism; the 60 s hop has its own separate margin question.
Read the invariant a fix has to satisfy as `hold + max_downstream_cache_age < signature_ttl`.

---

## Verification

| Check | Result |
|---|---|
| New unit tests | **8 passed** |
| Non-DB suites (storage + discovery) | **111 passed across 12 files** |
| Typecheck | clean |
| Biome | clean, repo-wide exit 0 |
| `next build` | green |
| DB-backed storage suites | **cannot run — `ECONNREFUSED`**, no local Postgres. Pre-existing and environmental. |

⚠ **One trap worth recording:** the first typecheck failed on
`.next/types/validator.ts` referencing `bookmarks/page.js`. That was a **stale build artifact**
from before `main`'s UNWIRE-1 deleted the bookmarks module — not a code error. `rm -rf .next`
cleared it. Anyone switching between pre- and post-UNWIRE-1 branches will hit this.

### Why the tests are shaped the way they are

The headline assertion — *"the same image returns the same URL"* — would **also pass** against a
broken memo that returned one URL for *every* image, which would serve one participant's image
in place of another's. So every "same" assertion is paired with a "different" one:

1. Different images → different URLs
2. Same key at different TTLs → never shared (the moderation hazard)
3. Same key in different buckets → never shared (the §1e separation)

The suite does not test that a cache exists. It tests that the cache **discriminates**.

---

## Not done / open

- **Step 6** (Cache-Control immutable) — scoped above, deliberately deferred
- **Step 0** (signing check) — not performed. The same unsigned-commit problem blocking S-4
  applies here; this commit will need signing before it can merge
- **Branch naming** — this sits on `new-S4Ritam`, which is off current `main` and clean, but the
  name suggests S-4 work. Worth renaming to something like `fix/r2-url-memo` before the PR
- **No PR, no review cascade** — `@code-reviewer` not run
