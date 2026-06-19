# UI.6 slice A — Read-only Admin Moderation Audit Viewer (F-ADMIN-5 read surface)

**Branch:** `feat/ui6-admin-moderation-viewer` · **Governing model:** ADR-0021 (reactive
moderation, no held queue) · **Spec surfaces:** SPEC.1 §15 (F-ADMIN-4/5), SPEC.1 §14, SPEC.2 §10.
**Scope:** READ-ONLY. No write/action path of any kind. No schema change. No new migration.

## Phase-0 recon result (verified on disk)

- `main` head at start: `e61a733` (DEBATE.7 close-out, PR #143). Branch cut from it.
- Migration `drizzle/migrations/0016_mod_actions_reason.sql` present.
- `mod_actions` (`src/db/schema/audit.ts`) carries every required column: `reason` (enum
  `mod_reason`), `verdict` (nullable), `actor_id`, `target_user_id`, `target_market_id`,
  `image_r2_key`, `blocked_text`, `categories` (jsonb), `created_at`. Enum `mod_reason` =
  `track_a_autoban, track_b_blocked, sexual_minors_text_blocked, content_removed, user_banned`.
- `users.banned_at` present (`src/db/schema/auth.ts`); `users.pseudonym` (NOT NULL, public face).
- SPEC.1 + SPEC.2 both **v1.0.8**.
- Auth pattern mirrored: `requireAdminPage()` (`@/server/admin/page-guards`) — Layer-2
  `validateAdminSession(await cookies())` at the TOP of every admin Server Component, co-located
  with the data read, `export const dynamic = "force-dynamic"`. (Outer `(admin)` layout would loop
  the in-group `/admin/login`, so the guard is per-page.)
- Gate-block writer (`src/server/moderation/consequences.ts`): blocked rows always set
  `target_user_id` + `target_market_id`, never `target_comment_id`/`target_bet_id`; `actor_id =
  'system'`; `categories` = OpenAI score map (`Record<string, number>`); `blocked_text` = rejected
  body; `image_r2_key` nullable.

### Drift surfaced (kickoff ranks lowest per source-of-truth precedence; not blocking)

1. Kickoff says "locked design tokens"; globals.css (lines 119-131) + AGENTS.md §8 say the brand
   tokens (`--color-yes/no/brand`) are PLACEHOLDER until DESIGN.7. → Style with the **real shadcn
   semantic tokens** (`background/foreground/card/border/muted/destructive`), which are stable; do
   not consume placeholder brand tokens in this surface.
2. Side-binding ("Support/YES=black, Counter/NO=white") is **N/A** — blocked `mod_actions` rows
   carry no `side` column. Nothing to bind.
3. `frontend-design` skill not available in this session → its principles applied manually.

## What to build (read-only)

### `src/server/admin/moderation/audit-feed.ts` (`server-only`)
- `BLOCKED_REASONS = ['track_a_autoban','track_b_blocked','sexual_minors_text_blocked']` (the 3
  gate-block reasons; `content_removed`/`user_banned` reactive-admin rows are EXCLUDED).
- `loadModerationAuditFeed({ limit }): Promise<ModerationAuditRowView[]>` — Drizzle read:
  `mod_actions` LEFT JOIN `users` ON `target_user_id`, LEFT JOIN `markets` ON `target_market_id`,
  `WHERE reason IN BLOCKED_REASONS`, `ORDER BY created_at DESC`, `LIMIT`. Maps each row via
  `toAuditRowView`. Does **NOT** import the storage signer (`src/server/storage/sign-read.ts`).
- `toAuditRowView(raw): ModerationAuditRowView` — pure. View model deliberately carries
  `hasBlockedImage: boolean` and **never** `imageR2Key`/any URL field → a viewable URL is
  structurally impossible to produce downstream. Also: `authorBanned: boolean` from `banned_at`,
  `authorPseudonym`, market slug/title/id, `categoryScores` (sorted top categories), `blockedText`
  (admin-only), reason, verdict, createdAt, actorId.
- `topCategories(scores, n)` — pure helper, sorts the score map desc.

### `src/app/(admin)/admin/moderation/audit/page.tsx` (Server Component, ZERO client JS)
- `await requireAdminPage()` FIRST (before any read) → Layer-2 gate, unreachable by non-admins.
- `force-dynamic`. Calls `loadModerationAuditFeed`. Renders a clean internal audit surface:
  per-row card with reason/verdict badge + timestamp; market (links to `/admin/markets/[id]`);
  author pseudonym + clear BANNED/active indicator; actor; category score chips; `blocked_text`
  in an admin-only block; an image **placeholder** component when `hasBlockedImage` (never `<img>`,
  never a URL). Graceful empty state. Styled with real shadcn semantic tokens.
- NO action/form/button-to-handler. The only interactivity is read navigation to market detail.

## Safety rails
- Auth: Layer-2 server-side on the page's data path; mirrors existing admin pages exactly.
- Images: blocked image → placeholder only; no signed/viewable URL ever minted; CSAM never rendered.
- `blocked_text`: rendered only on this admin-gated page; never passed to a participant surface.

## RED-first test plan (failing before implement)
1. `tests/server/admin/moderation/audit-view.test.ts` (unit, pure mapper):
   (b) blocked-row view shape; (c) image row → `hasBlockedImage:true` and **no** url/key field on
   the VM; (e) `authorBanned` reflects `banned_at`; `blockedText` present in the admin VM;
   `topCategories` ordering.
2. `tests/server/admin/moderation/audit-page-auth.test.ts` (unit, invoke the page fn):
   (a) no/invalid admin session → `redirect('/admin/login')` and the feed loader is NEVER called
   (real `requireAdminPage`→`validateAdminSession` wired, only `next/headers`+`next/navigation`
   mocked); valid session → loader called.
3. `tests/server/admin/moderation/audit-feed-leak.test.ts` (unit, filesystem guard):
   (d) no file under `src/app` outside `(admin)` imports the audit-feed module; the module imports
   `server-only`; the page lives under the `(admin)` group; the audit-feed module does not import
   the storage signer.
4. `tests/integration/admin-moderation-audit-feed.integration.test.ts` (real Postgres):
   (b)+(e) loader filters to the 3 blocked reasons (excludes `content_removed`/`user_banned`),
   orders `created_at` desc, resolves ban-state + market via the joins.

## Ritual
RED-first → implement to green → `@code-reviewer` → `@security-auditor` (MANDATORY: auth gate,
safe blocked-content render, no participant data-leak) → pre-PR self-audit → `just verify` + new
tests + moderation suite → open PR (no merge) → push for Vercel preview.

## Out of scope (HARD BOUNDARY)
Any action handler (Remove/Ban/Approve/Discard/Block); the live reactive review feed (firehose);
any write path or mutation; any migration/schema change; new moderation logic; resolution surface;
participant/upload/bet UI.
