# REPLY-IMAGE-EXPORT — plan

**Ask (Hrishikesh, 2026-09-15).** Replies get the same Download → JPEG export posts
have. In a reply's export, the left card's SUPPORT / Đ STAKED / COUNTER split row is
replaced, in the same space, by:

```
Replied as SUPPORT to -                    ← small grey; SUPPORT green / COUNTER red
“Title of the post this replies to”        ← bold white, never cut (two lines max)
```

Everything else identical to the post export. Sizing must not move any structure.

**Area.** Ordinary work (CLAUDE.md §1) — export surface + debate read model; none of the
seven critical areas. SC-1 (§5.14) FIRES: new reads of reply text and parent title.

---

## 1. Addressing a reply without a UUID

Posts are addressed `?post=<N>` (permanent creation-order ordinal). Replies carry no
ordinal, and ADR-0016 D6 forbids a raw UUID in a participant URL. So:

- `GET /m/[slug]/export/image?post=<N>&reply=<M>` — `M` is the reply's **1-based
  creation-order ordinal within post N**, `(created_at, id)` ascending, removed replies
  INCLUDED (append-only ⇒ permanent, same rule as the post ordinal).
- Shape gate identical to `POST_PARAM_SHAPE`. Missing `reply` ⇒ the existing post export,
  byte-for-byte unchanged.
- Filename `<slug>-post-<N>-reply-<M>.jpg`.

## 2. Read model — `src/server/debate-view/load-debate-view.ts`

- Add `ordinal: number` to BOTH `DebateReply` variants (computed once, here — the button
  and the route read the same number, so they cannot disagree).
- Add `title: string` to the NON-removed variant only, from the same private
  `deriveTitleTeaser` posts use (a reply's body is title + optional extended text, same
  composer). Lets the export carry a title and never the body (keeps the SC-1 posture
  `compose.ts` documents).

## 3. Export mapper — `src/server/debate-export/image/compose.ts`

- `composePostExport(model, postId, nowMs, thumbUrl, replyOrdinal?)`.
- With `replyOrdinal`: find the reply in `post.replies.support ∪ counter` by ordinal.
  Reply absent or removed ⇒ `null` (404). Author row / side chip / stake / age / image /
  quote come from the REPLY (reply has no badge, no reply count).
- New optional `repliedTo: { relation: "SUPPORT" | "COUNTER"; parentTitle: string } | null`.
  Relation = the list the read model placed the reply in (`support` / `counter`). Same
  result as reply side === parent side (that is the split `rankReplies` makes), and it
  cannot disagree with what the page shows.
- Split-row fields still composed for the post case; for the reply case `repliedTo` is set.

## 4. Composition — `MarketPostExport.tsx`

- `props.repliedTo !== null` ⇒ render a `RepliedToRow` INSTEAD of `<SplitRow>`; nothing
  else in the file branches.
- **No-move sizing:** `RepliedToRow` lays out the real `SplitRow` at `opacity: 0` (its
  height does not depend on its content) and draws the two lines over it, so the box —
  and with it the image cell and the right card — is identical by construction rather
  than by a copied number. *(Changed at build from "one shared height constant".)*
  - Line 1: `Replied as SUPPORT to -` — 15u grey; the relation WORD alone is `ACCENT.green`
    (Support) / `ACCENT.red` (Counter).
  - Line 2: `“parent title”` — bold, `PALETTE.ink` (white). Never cut: size fitted with the
    existing `AVG_ADVANCE`/`SAFETY` estimate — up to 24 on one line, shrinking to 14,
    then two lines at 14, so a full 125-character title fits in two lines of the same box.
    The clamp follows the size (1 line above 14, 2 at 14): only glyphs far wider than the
    estimate (CJK) can hit it, and they ellipsize instead of overflowing the card.
  - *(Revision 2, operator 2026-09-15 — replaced the first cut: green/red title, one line
    with ellipsis.)*

## 5. Client

- `DownloadPostImage` takes `{ ordinal, reply? }`; href/filename gain `&reply=M` /
  `-reply-M` only when `reply` is set.
- `ArgProfile.download` → `{ ordinal: number; reply?: number }`.
- `ReplyCard` / `ReplyPopup` gain `postOrdinal?: number | null`; the mark renders only when
  non-null. Mounts: `DebateView` (scroller + pop-up) and `phone/PhoneDebateView` (thread +
  pop-up), through `reply-download.ts` — `replyDownloadOrdinal` (null under a removed
  parent) and `parentOfReply`. ⚠ The POP-UP resolves its parent from the reply's own id,
  never from the post on screen: a back swipe can change that post while the pop-up stays
  open (review HIGH).

## 6. Route — `src/app/(public)/m/[slug]/export/image/route.ts`

- Read `reply`, gate it (the post ordinal's shape) BEFORE any read, pass to the mapper; filename from §1. Same cache/bypass
  path (the viewer-freshness bypass already keys on the viewer's latest comment, replies
  included).

## 7. Tests (regression guards, then green)

- `image-compose.test.ts`: reply export maps reply's author/side/stake; `repliedTo`
  relation both ways (YES parent + NO reply ⇒ COUNTER, etc.); removed reply ⇒ `null`;
  unknown ordinal ⇒ `null`; **SC-1: `JSON.stringify(props)` does not contain the reply's
  extended text, nor a removed parent's title** (body absence, not row absence).
- `image-route.test.ts`: `?post=N&reply=M` 200 + filename; malformed/absent reply 404;
  no `reply` ⇒ post export unchanged.
- `download-post-image.test.tsx`: reply href + filename.
- Read-model test: reply ordinals are creation-order, include removed, stable.

## 8. Verification (local)

`tsc`, `biome check`, the suites above, `next build` (Doppler `--preserve-env`,
`ZUGZWANG_ENV=preview`), then render a post export and a reply export of the same post
against staging data and compare: card edges, image cell and both baselines at the same
pixel rows.

## 9. Ruled (operator, 2026-09-15)

1. **Reply under a REMOVED post** — no download mark; route 404s (SC-1).
2. **Reply pop-up** — carries the mark too, like the post pop-up.
3. **Long parent titles** — superseded by revision 2 (§4): never cut, two lines max.

`ReplyPreview.tsx` is mounted nowhere, so it is not threaded (§5's third mount dropped).
