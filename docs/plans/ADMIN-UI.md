# ADMIN-UI — operator console redesign (plan)

> UI-only. Uncommitted. Zero edits under src/server, src/db, drizzle, src/lib.
> Every server action, its arguments, form field names and every page read stay
> byte-for-byte identical. Prose here deliberately names no utility classes
> (Tailwind scans docs/).

## 0. Contracts that must not move (measured before editing)

- Server actions called, and their inputs: createMarketAction(FormData: slug,
  title, description, resolutionDeadline, marketId, media, mediaVideoUrl);
  seedPoolAction(FormData: marketId, openingPriceYes, tank) via the inline
  runSeed wrapper and its ok/error redirect; close/resolve/void/correct via
  terminalActionFields; moderateComment({commentId, action});
  submitAdminLogin(FormData: password).
- Reads: loadAdminMarketsOverview; the detail page's markets + pools select;
  loadReviewFeed with the parsed cursor; loadModerationAuditFeed /
  searchAuditLog selected by searchRan. requireAdminPage stays the first call in
  every page body, before any read (audit-feed-leak positional probe).
- Tests pinning DOM: every data-testid in TerminalActions; the close action is
  one-click (no confirm step can be added to Close); the resolve/correct side
  control stays a native select; the permanence note carries no side-pole
  class; the deadline input stays wrapped by a label reading "Resolution
  deadline" and "UTC", the slug label does not mention UTC; the review feed side
  chip keeps its exact pole classes (YES chip on the YES pole with NO-pole text
  and vice versa), one article per row, the removed-parent placeholder string
  and the reply arrow appear only in the parent block; the InvalidDateNote copy
  and role/testid; ACTION_TYPE_PLACEHOLDER.
- Structural guards: no raw hex; money through formatDharma; no fixed-position
  layer anywhere in src/app (sticky-header guard); no PageContainer call site
  (page-container guard); no img element and no signer token anywhere under the
  audit route directory; no percent formatting; no new client import of
  src/server beyond the existing "use server" actions.
- Refusals: no market copy invented (placeholders are format hints only); no new
  read of comments.body; no role/users logic for admin.

## 1. Shared admin chrome (new, admin-only, presentational)

`src/app/(admin)/admin/_components/`:
- AdminShell — page frame: ground background, a compact top bar (product mark
  and "Admin Control Centre" label), the existing AdminTabs, a width-bounded
  content column. Server component.
- AdminTabs — same export/props; restyled as a dense tab bar with Lucide icons
  and a visible focus ring.
- PageHeader — title, optional description, optional right-side actions slot,
  optional back link.
- MarketStatusBadge — monochrome status pill per lifecycle state; emphasis
  ladder only (fill / outline / dashed / dim), never the side poles.
- Notice — flash banner for ok / error query params, role status / alert.
- format.ts — pure UTC date formatting and a relative-span label (no floats on
  money; dates only).

## 2. Screen by screen

### Login
Today: unstyled h1, raw "Error: <code>", bare input. → Centred card on the
ground, product mark, labelled password Input, full-width submit, error mapped
to operator copy (invalid password / transient conflict / fallback that still
shows the code), autofocus on the field. Action, name and redirect unchanged.

### Markets list
Today: flat text tallies, underlined slug links, ISO timestamps, no status
emphasis, no filtering. → PageHeader with a New market button; the
needs-resolution / freeze tiles restyled; status tallies become filter chips
(links carrying a status query param; filtering is done in the page over the
same rows — no new read); dense table: status badge, slug + title stacked,
deadline as UTC plus relative ("in 3d" / "overdue"), an attention column that
flags Closed (needs resolution) and Open-past-deadline (close due); empty state
per filter; row links keyboard-reachable.

### New market
Today: unstyled paragraphs, every uploaded file labelled "(default)", raw error
codes, no previews. → Sectioned form (Question · Resolution · Media · Video),
shadcn Input/Textarea, neutral format hints only, local object-URL thumbnails
for uploaded images with a clear "Default" radio, upload progress state, remove
nothing server-side, mapped error copy for the wire codes (slug_invalid,
slug_taken, media_required, default_media_required, deadline_*, video_url_invalid,
market_id_conflict, validation_error with field messages, admin_session_required,
fallback shows code), explicit note that creation makes a Draft. Field names,
manifest shape, upload flow and submit unchanged.

### Market detail
Today: slug as h1, grey dl, bare seed form, raw error codes. → Back link,
header with title, slug, status badge, public-page link for non-Draft markets;
a lifecycle strip (Draft → Open → Closed → Resolving → Resolved, with Voided /
Frozen branches) derived from status only; facts panel (criterion with preserved
line breaks, deadline UTC + relative, outcome, reserves as raw strings — no
price derivation, which would be float math); seed form restyled with price and
tank hints and a required "opening is irreversible" acknowledgement checkbox
that carries NO name (so the FormData is unchanged); seed result/error mapped to
copy; empty state when no terminal action applies.

### TerminalActions
Today: stacked grey cards, identical styling for reversible and irreversible.
→ Cards in a responsive grid; Close styled as the reversible action with a
one-line explanation (still one-click); Resolve / Void / Correct styled as
irreversible with the permanence note prominent, the question to type shown in a
copyable mono block, a live match indicator, destructive-tone submit, working
state, aria-live results. Every testid, aria-label, field and handler unchanged.

### NeedsResolutionCount
Today: one card with two numbers. → Two stat tiles; the count tile gains an
"action needed" emphasis when non-zero; countdown tile unchanged in behaviour.

### Moderation review feed
Today: window.confirm for Remove/Ban, low hierarchy. → Dense row cards: meta
line (kind, side chip unchanged, market, status, UTC time), parent block, body,
image, author line with Dharma and prior flags, banned badge; Remove and Ban
become an inline two-step confirm (arm → Confirm/Cancel, Escape cancels, focus
lands on Cancel), per-row result notices; removed rows visibly marked. Same
moderateComment calls.

### Moderation page / audit page
Today: long prose headers, unstyled sub-navigation. → PageHeader + a
sub-navigation pair (Live feed · Audit log), counts line, load-older control;
audit search form on shadcn Input, clearer empty states, row cards tightened.
No img element, no signer, gate order untouched, InvalidDateNote copy
untouched.

## 3. Out of scope / proposals (need server or data changes)
Recorded in the run report, not built.
