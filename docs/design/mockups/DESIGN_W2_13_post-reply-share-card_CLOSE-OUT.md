# DESIGN.W2.13 — Post / Reply Share-Card Download · CLOSE-OUT

**Date:** 2026-06-29
**Lane:** Design (web Claude + operator; no Claude Code, no repo)
**Status:** LOCKED at mockup v0.1
**Deliverable:** `DESIGN.W2.13_post-reply-share-card_mockup-v0_1.html`

---

## 1. What this task became

The tracker row listed **three** download targets (profile-card JPEG, post-card JPEG, debate → `.md`).
This task delivered **one**: the **post AND reply card → downloadable, ready-to-post-on-X image**.

- The **profile-card JPEG** and (originally) the **post-card JPEG** were cut at kickoff.
- Mid-task the operator **revived** the post/reply card image as an **X-share image** (the §21.2 feature,
  un-cut and extended to reply cards). The profile-card JPEG **stays cut**.
- The **debate → `.md`** target is **split out into its own task** (see the separate kickoff).

Net: W2.13 = the post/reply share-card image. Trim the tracker row from three targets to one; the `.md`
becomes its own row.

---

## 2. Decisions (locked)

| Ref | Decision |
|---|---|
| **Format** | Client-side **image download** sized for X. **Download, not share** — X's share-intent can't pre-attach media, so the user posts the downloaded file manually. |
| **Frame** | Fixed **16:9 canvas** (target 1600×900), card centered with a uniform margin. **Why:** X shows 16:9 in full and crops anything taller — 16:9 guarantees the header % (top) and the tally/footer (bottom) are never clipped in the timeline. |
| **Refinement 1** | In the exported image, the live **bookmark + download icons** are replaced by a **"Zugzwang Verified" badge** = hourglass glyph + wordmark, top-right of the author row. (The live card keeps the download icon as the trigger.) |
| **Refinement 2** | The **"+" / show-more** affordance is **removed** in the export (static image shows the full argument). |
| **Refinement 3** | Reply footer **"Replied to <author>'s argument"** → **"Supported / Countered <author>'s argument"** (Supported for a Support reply, Countered for a Counter). Parent quote retained beneath it. |
| **Refinement 4** | Market header **%** shows the **current market price expressed on the post's side**: YES post → `Yes X%`; NO post → `No (100−X)%`. This is the *current* price, **not** the author's entry price. |
| **Entry pill** | The author's **entry price stays beside the name** as its own side-coloured chip (`YES @ 31%` / `NO @ 47%`), per side binding. |
| **Side binding** | YES / Support = **black**; NO / Counter = **white/outline**. (Unchanged invariant.) |
| **Badge treatment** | Hourglass + "Zugzwang Verified" inside a hairline pill. **Placeholder** — styling/lockup finalised at branding; the lockup may shorten to *logo + "Verified"* once the logo carries the wordmark. |
| **Source line** | A faint **`zugzwangworld.com`** in the bottom canvas margin — the pull-back-to-platform mechanism. **Placeholder**, brand owns the execution; the *space* is reserved now. |
| **Header glyph** | Surface SVG thumb (👍/👎-style) used for the header %, for monochrome consistency with the live pricetag (not emoji). |

---

## 3. R2 / R3 (rulings, final)

- **R2 — Profile surface (FINAL).** Remove the Profile **"Download profile card" icon** (the cut
  profile-JPEG affordance). **KEEP the bookmark icon** — it opens bookmarks, a real function.
  *(Operator initially said remove both; corrected 2026-06-29 to keep the bookmark.)*
- **R3 — profile-card JPEG is permanently CUT**, not deferred.

These are a small **delta to the locked Profile surface** (remove one icon, keep the other).

---

## 4. Spec divergences / extensions (to log — do not silently contradict spec)

1. **Reply-card image download EXTENDS §21.2.** §21.2 ("Download post → JPEG") is **post-only** as
   written; this task adds the image download to **reply cards** too.
2. **16:9 share-canvas composition** elaborates §21.2's "JPEG of the post card" into an X-dimensioned
   share image (header + card, centered on a fixed 16:9 frame).
3. **PNG vs JPEG — open.** §21.2 specifies JPEG; the card is text-heavy and PNG renders text sharper.
   Flagged for the build/spec (UI lane), not decided here.

## 5. Knock-ons (tracker accuracy — no action now)

- **§21.4 historical-showcase KEEPS its synergy.** Because the card image download lives again, the
  showcase still "inherits the card download for free." Not lost.
- **The post-image build is NOT obsolete.** What the kickoff pencilled as obsolete (the §21.2 post-JPEG
  build) is **back on** as the X-share build, now covering reply cards too. Re-point that tracker row to
  the share-card build instead of retiring it.

---

## 6. Edits to apply (the three consolidated docs)

### A. `DESIGN-copy-register-consolidated.md` — ADD a section

```
## Share-card download (W2.13) — exported image only

| Element | String / treatment |
|---|---|
| Verification badge | hourglass glyph + `Zugzwang Verified` (placeholder; brand finalises) — replaces the live bookmark + download icons in the export |
| Source line | `zugzwangworld.com` (faint, bottom canvas margin; placeholder) |
| Header % | side-aware: `Yes X%` (YES post) / `No (100−X)%` (NO post) — current price on the post's side |
| Reply footer | `Supported <author>'s argument` / `Countered <author>'s argument` (replaces `Replied to …` in the export) + parent quote retained |
| Show-more | `+` REMOVED in the export |
```

### B. `DESIGN-copy-register-consolidated.md` — EDIT the Profile row

In `## Profile` → `Identity`: **remove** the download icon + its `Download profile card` aria/title
string. **Keep** the bookmark icon (`Open bookmarks` / `Bookmarks`).

### C. `DESIGN-spec-changes-consolidated.md` — ADD entries

```
## W2.13 — post/reply share-card download
- Reply-card image download EXTENDS §21.2 (post-only as written → +reply).
- 16:9 share-canvas composition (header + card, fixed 1600×900) elaborates §21.2's "JPEG of post card".
- Format OPEN: §21.2 says JPEG; card is text-heavy, PNG sharper — decide at build.
- R2 (FINAL): Profile download icon removed; Profile bookmark icon kept.
- R3: profile-card JPEG permanently cut (affects §21.4 — but §21.4 synergy survives via the post/reply card download).
- UI.14 re-pointed: not obsolete — it is the X-share image build (post + reply cards).
- Download, not share (X intent can't pre-attach media); frozen-at-download ("photograph of now").
```

### D. `DESIGN-motion-consolidated.md` — NO CHANGE

Static image export — no motion. (Recorded for completeness.)

---

## 7. PK update table

| File | State | Action | Reason |
|---|---|---|---|
| `DESIGN.W2.13_post-reply-share-card_mockup-v0_1.html` | New | **Add** | Locked v0.1 share-card mockup |
| `DESIGN-copy-register-consolidated.md` | Existing | **Edit** | Add share-card strings; remove Profile download string (keep bookmark) — §6.A/B |
| `DESIGN-spec-changes-consolidated.md` | Existing | **Edit** | Add W2.13 spec-change entries — §6.C |
| `DESIGN-motion-consolidated.md` | Existing | **Verify** | No change (no motion) |
| `tracker_v14.html` | Existing | **Edit** | Trim W2.13 row 3 targets → 1 (share-card); split `.md` into its own row; re-point UI.14 to the X-share build |
| Profile locked surface | Existing | **Edit (delta)** | Remove download icon; keep bookmark icon (R2) |

## 8. Operator actions

1. Apply the **Profile-surface delta** (remove download icon, keep bookmark).
2. Apply the **copy-register + spec-changes edits** (§6).
3. **Drag** this close-out + the v0.1 mockup + the updated docs into PK.
4. **Trim/repoint** the tracker rows (§7).

---

*Carried into the separate `.md`-export task: §21.3 base spec; on-demand generation recommendation;
the three amendments vs §21.3; removal-masking as a hard line; the neutral/faithful preamble.*
