# POLISH.5 PR A — HALT RECORD

Two halts, both **RUN-STOP condition 1** (*"Any write outside §5's allow-list becomes necessary"*), both the same shape: **a ratified fence the plan did not census.** The first is RESOLVED and shipped; the second is LIVE.

| # | Raised at | Item | File needed | State |
|---|---|---|---|---|
| **H-1** | A1 | 2 | `tests/unit/debate/render/side-badge.test.tsx` | ✅ **RESOLVED** — §5 row 19, founder ruling 2026-08-14. Shipped in A1 (`697347d`) |
| **H-2** | A5 | — (blocks 3 · 4) | `tests/unit/bookmarks/render/side-encoding.test.tsx` | ⛔ **LIVE** — awaiting a ruling |

**Branch:** `polish/5-pr-a`. **Landed: A1 · A2 · A3 · A4** (items 2 · 5 · 6 · 15). **Blocked: A5 · A6 · A7** (items 3 · 4). **Not reached: A8** (item 17) — pinned LAST by §9 and deliberately not reordered.

---

## H-1 · RESOLVED — the `profile` preset census (item 2)

Item 2 wires `size="profile"`; `side-badge.test.tsx` is a source-scanning census that pinned, by set-equality, that **no call site wires it**. The guard fired **by design** — its own comment: *"If a later PR wires one, this reddens and the wiring becomes a DECISION — the same mechanism as `PERMITTED_FILES`."*

**Founder ruling 2026-08-14 — §5 row 19**, symbol-fenced to the three census assertions; `census-is-alive` and the four zero-delta render assertions untouched. `detail` **deliberately NOT unpinned** (R1) so POLISH.3 PR 2 hits the same wall and gets its own ruling. Names moved with their assertions (R2), ground carried in-file (R3), plan-file amendment routed to close-out (R4). **Shipped in A1.**

---

## H-2 · LIVE — the passthrough's TYPE reaches a struck file

### The condition

**A5 cannot land without adding two fields to one fixture literal in `tests/unit/bookmarks/render/side-encoding.test.tsx:64`** — a file §5 **STRUCK**:

> | `tests/unit/bookmarks/render/side-encoding.test.tsx` | `.6`'s. **It exists** and holds zero state-string assertions (§17) |

### Why it is unavoidable

`BookmarkItem` is defined **over** the profile union (`src/server/bookmarks/list.ts:43-53`):

```ts
export type BookmarkItem =
  | (Extract<ProfileArgumentItem, { removed: true }>  & { authorPseudonym: string })
  | (Extract<ProfileArgumentItem, { removed: false }> & { authorPseudonym: string;
                                                          staked: string; current: string });
```

`side-encoding.test.tsx:61-82` constructs a **full `BookmarkItem` object literal**. A5 adds two REQUIRED fields to the live-post variant, so that literal becomes incomplete. `tsc` fails ⇒ **A5's commit boundary lands RED (condition 6)** ⇒ A6 and A7, which consume the passthrough, are blocked behind it.

### Measured to exactly one file, one literal, two lines

With the three **allow-listed** fixtures updated (`surface.test.tsx` ×2 — row 14; `argument-list-side.test.tsx` ×1 — row 15), `pnpm tsc --noEmit` reports **ONE** remaining error:

```
tests/unit/bookmarks/render/side-encoding.test.tsx(64,2): error TS2322:
  Type '{ removed: false; kind: "post"; … }' is not assignable to type 'BookmarkItem'.
```

The whole fix, inserted after `marker,` in the `liveItem` factory:

```ts
  authorStake: "<18dp string>",
  priceAtBet:  "<18dp string>",
```

⛔ `removedItem` in the same file is the **removed** variant and is unaffected — SC-1 intact.

### Where the plan missed it

§8.2's zero-delta table has a row for exactly this change and it measured the **runtime** consumer only:

> | `arguments.ts` passthrough | `src/server/bookmarks/list.ts` | ✅ **Measured: `list.ts` imports `buildPostItem`/`buildReplyItem`, so it receives the fields automatically.** That is D23's *"one edit, not two"* working |

True, and it is why `.6` inherits the fields for free at runtime (§17 item 7). **But the TYPE propagates further than the call graph:** `.6`'s test *constructs* the DTO rather than receiving it, so a widened required-field set reaches a file the runtime analysis correctly cleared. ⇒ **The same `V-2` shape as H-1** — the plan verified the consumer it expected to move and not the one that only the type reaches.

### ⚠ How this differs from H-1 — stated because it may change the ruling, not to pre-empt it

H-1 **unpinned a ratified property** (`profile`'s zero call sites) with cross-surface consequences for POLISH.3 — a real decision, and R1 shows it deserved a careful one. H-2 decides nothing: it adds two fields to a fixture so it satisfies a DTO the founder has already ratified, unpins no assertion, and changes no `.6` behaviour. §8.2 and §17 already establish that `.6` receives these fields.

⛔ **I did not act on that difference.** The fence is the fence and the last halt was ruled correct; this is surfaced for the ruling, not resolved by it.

### The shape of a ruling

- **(a) §5 row 20** — `tests/unit/bookmarks/render/side-encoding.test.tsx`, **PR A**, A5. ⛔ Symbol-fenced to the `liveItem` factory's two added fields. ⛔ No assertion, no `removedItem`, nothing else. **Or**
- **(b) A standing carve-out** — "a fixture literal that must gain a field because a ratified DTO change widened its type is not a write within the meaning of §5" — which would also cover `.6`, POLISH.3 PR 2 and anything else downstream of a union edit. Broader, and worth considering precisely *because* this will recur on every future passthrough.

⚠ Whichever: **`.6`'s file is `tests/unit/bookmarks/**`, which §6's belt does NOT deny-list** — like `IdentityCard.tsx` before v2.3 and `side-badge.test.tsx` at H-1, it is excluded by the allow-list alone. That is now **three** for §6's *"the belt cannot see"* list.

### Resume cost

**Near zero.** The A5 diff is saved at `~/Downloads/POLISH-5-PRA-A5.patch` (84 lines) and re-applies cleanly on `polish/5-pr-a`. It is **pure addition — 18 added lines to `arguments.ts`, ZERO deletions**, so PR A's Gate C read is intact by construction: no query line at `:145`/`:181`/`:258`/`:267` moved, and no removed-variant block was touched.

---

## State

`polish/5-pr-a` = `origin/main` + the halt record + **A1 · A2 · A3 · A4**. Working tree clean; `pnpm tsc --noEmit` **0 errors**; `ZUGZWANG_ENV=preview just verify` **exit 0** at every landed boundary. `src/server/` is **untouched** in the landed set, so §14's `@code-reviewer` mandatory trigger (the `arguments.ts` passthrough) does not fire on it — the reviewer pass belongs with A5.
