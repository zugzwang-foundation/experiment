import { redirect } from "next/navigation";

import { requireAdminPage } from "@/server/admin/page-guards";

// UI.6 S0 — the `/admin` index. Per SPEC.1 §15 the Admin Control Centre lands
// on the Moderation tab by default, and `/admin` itself renders no content: it
// gates then redirects. Layer-2 admin auth is re-validated at entry
// (requireAdminPage → /admin/login when absent) BEFORE the redirect, so an
// unauthenticated hit bounces to login, never to a Centre tab. Zero client JS.
//
// S-4 Phase B — `instant = false`: `requireAdminPage` reads `cookies()`
// unwrapped at the top of every admin page it guards (page-guards.ts), which
// errors the `cacheComponents` prerender build the same way an unwrapped
// `(public)` session read did. Deferred, not restructured — admin surfaces
// are outside S-4's scope entirely (CLAUDE.md §1); this is the minimum
// change that keeps the build green.
//
// ⚠ KNOWN GAP, ACCEPTED (S-4 Phase B, tech-lead ruling): THIS PAGE'S ENTIRE
// JOB IS A REDIRECT, and neither branch now produces a clean HTTP 307 —
// `cacheComponents` streams the response (`x-nextjs-postponed: 1`) even
// though the build labels this route plain Dynamic, so by the time either
// `redirect()` fires a `200` has already gone out; Next falls back to a
// `<meta http-equiv="refresh">` + client nav. Real browsers still land
// correctly; a non-JS client sees a ~1s-delayed meta-refresh instead of an
// instant 307. Same gap as `bookmarks/page.tsx`; closes with the S-4 Phase
// C/D hoist. `requireAdminPage`'s OWN redirect (`page-guards.ts` →
// `/admin/login`) carries the identical gap on every admin page it guards.
export const instant = false;

export default async function AdminIndexPage(): Promise<never> {
	await requireAdminPage();
	redirect("/admin/moderation");
}
