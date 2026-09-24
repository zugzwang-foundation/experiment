# Mirror composer — MIRROR-1, founder-ratified 2026-09-23

Amended MIRROR-2, founder-ratified 2026-09-24

## CORE IDEA

The bet composer is redrawn to look like the card it will become: your own card
header on top, your title where the card's title sits, a 16:9 media frame, and a
stake bar at the bottom. It fills the slot it already opens in (the opposite slot;
the hosting-column-header rule is unchanged). Presentation only: the same fields,
limits, validation, submitted data and image upload/screening flow as today. One
composer everywhere it opens above the phone tier — focus view and replies page,
post and reply variants.

## RF-1 · Shell

Fills the host slot below the column header. n0 (#212121) surface, 1px n2 (#404040)
border, 10px radius, 16px padding, 14px between rows. Rows, top to bottom:
[statement row — replies only] · author row · title row · media frame · stake bar.
The stake bar is pinned to the bottom; the media frame takes the height left over.

## RF-2 · Statement row (replies only)

`Support <author>'s argument` / `Counter <author>'s argument` (existing strings),
16px/600, left-aligned. Close `×` at the right end. Leave an empty named slot
immediately before `×` — FF-1's friendly-fire switch lands there later. Build nothing
in it.

## RF-3 · Author row

Viewer's avatar (28px circle) · pseudonym (16px/500) · hairline · side chip
`YES @ 10%` (the card's own chip component, live price of the side being bet) ·
hairline · `Đ {amount}` (mono 14px, updates live with the amount input) · hairline ·
`Draft` (14px, n5). Posts: `×` at the right end. Replies: no `×` here (it is in RF-2).
Reuse the card header's avatar, name and chip components; do not restyle them.

## RF-4 · Title

Required; placeholder `Your argument — required`. A borderless field with a 1px n3
underline in a block that is always 54px tall. The text — and the placeholder — take
the largest size from 28px down to 13px, in 0.5px steps (line height = size × 1.25),
at which they fit the block in at most two lines, vertically centred in it
(padding-top = (53 − lines × line height) / 2). A short title sits on one big line;
as the line fills, the size eases down; past one line the text flows into two; a
normal 125-character title lands near 16px, all-caps titles lower. Size changes ease
over 150ms (instant under prefers-reduced-motion). maxLength 125 (existing rule). No
counter, except in the last 10 characters: `{n} left` (11px, n5), right-aligned just
below the underline, absolutely positioned. The composer opens with the cursor in
the title.
⚠ The block's height never changes while typing.
⚠ Measure with the transition off (or on a hidden clone): a transitioned font-size
  reads its old value mid-measure.

## RF-5 · Detail toggle

Right of the title, 14px gap: 118px wide, exactly the title block's height, 1px n2
border, 8px radius, 14px n6 label with icon. Labels:
  `Add detail` (plus icon)   — detail empty, image view showing
  `Edit detail` (pencil icon) — detail has text, image view showing
  `Show image` (image icon)  — detail view showing; pressed style (n1 fill,
                               n3 border, ink text), aria-pressed="true"
It toggles the media frame between the image view and the detail view.

## RF-6 · Media frame

An exact 16:9 frame: width = min(available width, available height × 16/9), centred,
top-aligned; minimum height 160px — below that the composer body scrolls and the
stake bar stays pinned. Ground (#181818) fill, 1px n2 border, 8px radius, clipped.
· Image attached: shown whole (object-fit: contain; letterbox = ground). Top-right
  overlay: `Replace` (refresh icon) and a × button (aria-label `Remove image`), 28px
  chips, rgba(24,24,24,.9) fill, 1px n2 border, 6px radius. No filename.
· No image: dashed 1px n3 border; centred image-plus icon, `Add an image` (14px/500,
  n6), `Optional` (12px, n5). The whole frame opens today's file picker.
· Upload / screening / rejected states: today's logic and wording, centred in the frame.
· Detail view: today's detail textarea fills the same frame (no layout jump):
  14px / 21px, n6, 14px 16px padding, placeholder `Add evidence, sources, reasoning`,
  counter bottom-right `{n} / {limit} · optional` from the existing limit constant.
  Focus shows no ring, outline or glow: the frame's border lifts from n2 to n3 and
  the caret marks the place.
· Switching slides the outgoing view out and the incoming one in (translateX ±36px +
  fade, 260ms ease); instant under prefers-reduced-motion.
· Buttons in the composer show a focus ring for keyboard focus only (:focus-visible),
  never after a mouse click.
⚠ Toggling is a VIEW change only. The image stays attached and keeps screening while
  hidden; the submitted data carries image and detail whichever view is showing.

## RF-7 · Stake bar

56px tall (min-height; taller only if a validation notice needs it), 1px n2 border,
8px radius, pinned to the bottom. Four groups — AMOUNT, TO WIN, limits, submit — with
equal space between every pair, including before the submit; hairlines centred in
their gaps.
· AMOUNT (11px caps, n5) over today's amount input: a small Đ (15px, n5), then the
  value (mono 22px/600), 1px n3 underline.
· TO WIN over today's to-win value, styled like AMOUNT: small Đ (15px, n5), then the
  number (mono 22px/600); no underline.
· Limits stacked: `Min Đ {floor}` over `Max Đ {cap}` (12px, n5; values n6/500) from
  the existing constants (post floor on posts, reply floor on replies, BET_MAX_STAKE).
· Submit `PLACE Đ BET` (170 × 44, 15px/700, letter-spacing .08em), wearing the pole of
  the side being bet: YES = #181818 fill, 1px #fafafa edge and text; NO = #fafafa
  fill, #181818 text.
No balance line. No second line on the button. Today's validation messages keep
their logic; while one is active it replaces the Min/Max text in place. The
disabled-submit rule and any confirm step are unchanged, except RF-11. Narrow slots:
submit shrinks first (floor 140px), then TO WIN; below that the submit takes its own
line (as built).

## RF-8 · Where it applies

Every A1 mount point above the phone tier, as one component. If the phone tier
renders the same component, keep today's layout under the phone tier and log it.

## RF-10 · Photos go up without hidden data

Every attached image except GIF is re-saved in the browser before upload — through
the existing resize step, now run for every image, at its own size when already
small — so it carries no hidden metadata (location, camera, date). If the re-save
fails or times out, the image is refused with today's attach error; it is never
uploaded as-is. GIFs upload unchanged. No new check and no new step for the author.
⚠ Keep each type's current output format — a PNG stays a PNG, so transparency survives.
⚠ The re-save happens before the upload is signed, so the bytes screened are the
  bytes served.

## RF-11 · PLACE waits for the image

While an attached image is still uploading, PLACE Đ BET is disabled (the frame already
shows the upload state). It re-enables when the image is attached, or when the attach
fails (the image is dropped with today's error). Server checks unchanged.

## RF-12 · A pick cannot race a submit

While a bet is being submitted, a picked or dropped image is ignored, so the frame can
never show an image other than the one being published. Fix it where the file enters —
the shared file input and drop handlers — so both layouts get it.
⚠ The phone's MARKUP stays byte-identical (RF-8 baseline); only its behaviour gains
  RF-11 and RF-12. If an RF-8 scenario captures the uploading state, its markup may
  change by the disabled attribute only — update that line deliberately and log it.
