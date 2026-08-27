# R2-MEMO — What changed, in one page

**Branch:** `Ritam_2_S4` · **Commit:** `4e22141` · **Landed:** 2026-08-27
**Size:** 5 files, +500 / −2 · **Tests:** 8 new, all passing

---

## 1 · The problem, in one line

> The server handed out a **differently-named link to the same picture on every render**, so
> every browser treated it as a new image and re-downloaded it.

A presigned URL carries a timestamp inside its signature. Ask for one twice, get two different
strings pointing at the same unchanged object. Browsers cache by URL — so two names meant two
downloads.

`/m/[slug]` re-renders every 15 s (`POLL_INTERVAL_MS_DEBATE_VIEW`). That is **240 fresh links
per image per hour, per open tab** — and 240 re-downloads to match.

---

## 2 · Before / After

| | **Before** | **After** |
|---|---|---|
| URL for an unchanged image | New one every render | **Held ~50 min** |
| Links minted per image / hour | **240** | ~1.2 |
| Browser behaviour | Re-download every 15 s | Serves from its own cache |
| Storage reads billed | One per render, per viewer | One per hold window |
| Admin moderation images (60 s links) | New one every render | Held **50 s** — safely inside their life |
| Memory used by the mechanism | n/a | Bounded at 2048 entries, self-evicting |
| Guard against the failure mode | none | 8 tests, 3 of them positive controls |

**What did NOT change:** link validity (a security setting), the 15-second refresh, bucket access
control, dependencies (none added), and already-uploaded images.

---

## 3 · What was actually built

| File | Lines | What it does |
|---|---|---|
| `src/server/storage/read-url-memo.ts` | **new**, 141 | The hold — bounded, self-evicting, TTL-derived |
| `src/server/storage/sign-read.ts` | +26 | Participant images route through the hold |
| `src/server/discovery/media.ts` | +18 | Market images route through the hold |
| `tests/unit/storage/read-url-memo.test.ts` | **new**, 173 | 8 tests — 3 are positive controls |
| `docs/logs/R2-MEMO.md` | **new**, 144 | Full session log |

---

## 4 · The three decisions that make it safe

### 4.1 The hold is a **calculation**, never a second constant

⚠ **SUPERSEDED BY ADR-0042 — corrected here rather than in an appendix (O-5). The formula below
IS the C-1 defect; the one that shipped subtracts the caller's cache window first.**

```
hold = max(0, floor((ttl − downstream) × 5/6))
```

| Link type | TTL | downstream | Held for | Σ | Margin |
|---|---|---|---|---|---|
| Render images (3 call sites) | 7200 s | 3900 s | 2750 s | 6650 | 550 s |
| **Admin moderation feed** | **60 s** | **30 s** | **25 s** | **55** | **5 s** |
| OpenAI moderation hop | 60 s | — | **not memoised** | — | — |

⚠ **Why this matters more than it looks.** A hardcoded *"hold for 50 minutes"* would be correct
for the first row and **catastrophic** for the second — it would serve a link that died
49 minutes earlier, and admin moderation images would silently stop loading. Deriving the hold
from each link's own lifetime makes that mistake **unrepresentable**: a shorter TTL
automatically gets a shorter hold, and there is no second number for a later edit to forget.

### 4.2 The memo key carries **bucket + object + TTL + downstream**

| Component | Why it must be in the key |
|---|---|
| **TTL** | `signRead` serves *both* the 60 s moderation path and the 3600 s render path. Keyed on the object alone, a page could be handed the 60-second link and break a minute later. |
| **Bucket** | The participant `uploads` arm and the admin `market-media` arm are deliberately separate (plan §1e). Identically-named objects in each must never answer for one another. |
| **Object** | Obvious — but see §4.3 for why it is *tested* rather than assumed. |

### 4.3 The tests prove the cache **discriminates**, not merely that it exists

The headline claim — *"the same picture returns the same link"* — would **also pass** against a
broken memo that returned **one link for every picture**. That would show one participant's
image on another participant's argument.

So every "same" assertion is paired with its refutation:

| Test | Proves |
|---|---|
| Same object → same URL, signer runs **once** | The hold works |
| **Different images → different URLs** | ✅ control — no cross-contamination |
| **Same key, different TTL → never shared** | ✅ control — the moderation hazard |
| **Same key, different bucket → never shared** | ✅ control — the §1e separation |
| Hold expires *strictly* before the URL, at every TTL | The safety invariant, asserted directly |
| A throwing mint is **not** held; next call retries | One R2 blip ≠ 50 min of a missing image |

---

## 5 · Deliberately not done

| Item | Why |
|---|---|
| **Cache-Control: immutable on uploads** (tracker Step 6) | Framed as low-risk; **is not**. Adding it makes the header part of the **upload signature**, so both client upload sites must send it byte-identically or **uploads fail while someone is posting an argument**. A coordinated 3-file change deserving its own task and an end-to-end upload test. |
| **Touching the profile-picture path** | PFPs use a **public base URL with no signing at all** — verified. The memo only wraps `mintReadUrl`, which PFPs never call, so this is safe *structurally*, not just by discipline. |
| **Capping images per page** | Out of scope — and it is a product decision. See §6. |

---

## 6 · The finding worth more than the task

> **Nothing caps how many images a page loads.** `listMarketComments` carries no `LIMIT` —
> verified on current code.

A market seeded with **500 image-bearing arguments** therefore builds **500 links every
15 seconds, per open tab**.

That is a fact about **the seeding plan**, not a defect in this task — but it is the reason the
memo is bounded at `MAX_ENTRIES = 2048` with eviction. **An unbounded read must not become
unbounded memory.** Overflow evicts (expired entries first, then oldest) rather than failing: a
miss simply re-mints, which is exactly what happened before this module existed.

---

## 7 · Interaction with S-4

⚠ **This section read "the marginal win is smaller than headline." That was the inverse of the
truth and it is what let C-1 look like a question of degree. Corrected in place (O-5).**

S-4 caches the market page's whole view model — **including these image URLs** — and it is
merged, not pending. Within one cache entry the URL was already stable, so the browser-cache win
on those surfaces was **already delivered by S-4**. What the memo adds there is stability ACROSS
invalidations: those blocks key on pool reserves, so every bet busts every reader's entry, and
without the hold one bet costs every open tab a full re-download of an unchanged image.

It also meant a bust no longer re-minted the URL — the memo returned the held one — which is how
a URL could reach 9900 s of age against a 7200 s signature. That is C-1, and ADR-0042 is the fix.

---

## 8 · Verification

| Check | Result |
|---|---|
| New memo tests | **8 / 8 passing** |
| Full unit suite | **2,245 passing** across 175 files |
| Typecheck | clean |
| Biome | clean, repo-wide exit 0 |
| `next build` | green (with S-4's Cache Components active) |
| Pre-existing failures | 2 in `foreclosure.test.ts` — **confirmed identical on clean `main`** by stashing this work and re-running |
| DB-backed storage suites | could not run — `ECONNREFUSED`, no local Postgres. Environmental. |

---

## 9 · Status

⚠ **This section named the wrong blocker, and every clause of the sentence that
named it was false. Corrected in place (O-5).**

- ✅ Committed, opened as **PR #424** (branch `Ritam_2_S4`), merged up to current
  `main` — zero conflicts
- ✅ **The commits ARE signed.** They were signed with a second contributor's SSH
  key, which GitHub has registered for **authentication** and not for
  **signing** — so GitHub reports `unknown_key` and shows *Unverified*, while
  the signature itself is cryptographically good. Two different remedies: the
  GitHub badge needs that key re-added as a Signing Key; a local `%G?` of `G`
  needs it in `~/.ssh/allowed_signers`. Neither is a merge blocker — a
  squash-merge is signed by GitHub's own key regardless.
- ⛔ **There is no branch protection on this repository, on any branch**, so
  nothing "will refuse it at merge." CLAUDE.md §5.13 carries the measurement and
  its date. Asserting a control that does not exist is **O-13**, and doing it
  while claiming to name the one blocker is how a real blocker goes unlooked-for.
- ⛔ **The actual blocker was C-1** — the hold composed with the `'use cache'`
  boundaries the render paths sit inside, so a URL could be served up to
  `6000 + 3900 = 9900 s` after minting against a 7200 s signature — counting the
  cache's `expire` AND the client router's `stale` window, per ADR-0042 D-3.
  Found by the
  pre-merge cascade, not by this document. Fixed in this same PR: the hold is
  now budgeted against the caller's declared downstream window
  (`hold + downstream < ttl`, ADR-0042), and `read-url-hold-budget.test.ts`
  asserts it row by row.
- ✅ Review cascade run — `@code-reviewer` then `@security-auditor`
