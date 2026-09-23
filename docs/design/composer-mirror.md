# Mirror composer — MIRROR-1, founder-ratified 2026-09-23

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

Required; placeholder `Your argument — required`. Borderless field with a 1px n3
underline. The block is always 54px tall (two lines at 16px): 16px, 22px line
height, weight 500, letter-spacing −0.01em, ink; wraps. maxLength 125 (existing rule).
Two-line guarantee: if the text would need a third line, the font steps down 0.5px
at a time (line height = size × 1.375), floor 13px, text top-aligned in the fixed
block. A normal 125-character title fits at 16px; all-caps titles step down.
No counter, except in the last 10 characters: `{n} left` (11px, n5), right-aligned
just below the underline, absolutely positioned.
⚠ The title row's height never changes while typing.

## RF-5 · Detail toggle

Right of the title, 14px gap: 118px wide, exactly the title block's height, 1px n2
border, 8px radius, 14px n6 label with icon. Labels:
  `Add detail` (plus icon)   — detail empty, image view showing
  `Edit detail` (pencil icon) — detail has text, image view showing
  `Show image` (image icon)  — detail view showing; pressed style (n1 fill,
                               n3 border, ink text), aria-pressed="true"
It toggles the media frame between the image view and the detail view.

## RF-6 · Media frame

An exact 16:9 frame: width = min(available width, available height × 16/9),
centred, top-aligned; minimum height 160px — below that the composer body scrolls
and the stake bar stays pinned. Ground (#181818) fill, 1px n2 border, 8px radius,
clipped.
· Image attached: shown whole (object-fit: contain; letterbox = ground). Top-right
  overlay: `Replace` (refresh icon) and a × button (aria-label `Remove image`) —
  28px chips, rgba(24,24,24,.9) fill, 1px n2 border, 6px radius. No filename.
· No image: dashed 1px n3 border; centred image-plus icon, `Add an image`
  (14px/500, n6), `Optional · shown whole · any orientation` (12px, n5). The whole
  frame opens today's file picker.
· Upload / screening / rejected states: today's logic and wording, rendered centred
  inside the frame.
· Detail view: today's detail textarea fills the same frame, so nothing jumps.
  14px / 21px, n6, 14px 16px padding, n3 border, placeholder
  `Add evidence, sources, reasoning`, counter bottom-right `{n} / {limit} · optional`
  from the existing limit constant.
· Switching slides the outgoing view out and the incoming view in with the
  composer's existing slide (translateX ±36px + fade, same duration and easing);
  instant under prefers-reduced-motion.
⚠ Toggling is a VIEW change only. The image stays attached and keeps screening while
  hidden; the submitted data carries image and detail whichever view is showing.

## RF-7 · Stake bar

56px tall, 1px n2 border, 8px radius, pinned to the bottom. Left to right:
`AMOUNT` (11px caps, n5) over today's amount input (Đ prefix n5; value mono
22px/600; 1px n3 underline) · hairline · `TO WIN` over today's to-win value (mono
20px/600) · hairline · limits stacked: `Min Đ {floor}` over `Max Đ {cap}` (12px, n5;
values n6/500) from the existing constants (post floor on posts, reply floor on
replies, BET_MAX_STAKE) · submit `PLACE Đ BET` (170 × 44, 15px/700, letter-spacing
.08em). The submit wears the pole of the side being bet: YES = #181818 fill, 1px
ink border, ink text; NO = ink fill, #181818 text.
No balance line. No second line on the button.
Today's validation messages keep their logic; while one is active it replaces the
Min/Max text in place. The disabled-submit rule and any confirm step are unchanged.
If the bar would overflow at A1's narrowest width, shrink the submit first (floor
140px), then the TO WIN column; log it.

## RF-8 · Where it applies

Every A1 mount point above the phone tier, as one component. If the phone tier
renders the same component, keep today's layout under the phone tier and log it.
