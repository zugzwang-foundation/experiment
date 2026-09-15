import "server-only";

import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/server/auth";

/**
 * S-4 Phase D — the per-request session read, deduped.
 *
 * THE DEFECT THIS CLOSES. `(public)/layout.tsx` reads the session, and then
 * `m/[slug]/page.tsx`, `u/[pseudonym]/page.tsx` and `bookmarks/page.tsx` each
 * read it AGAIN — layouts cannot pass data to pages, so every one of those
 * three surfaces asks the database "who is this?" twice per render. On
 * `/m/[slug]` that doubles again in effect, because `DebatePoll` re-invokes the
 * layout as well as the page every `POLL_INTERVAL_MS_DEBATE_VIEW` (30 s) for
 * every open tab whose reader is active.
 *
 * React's `cache()` memoizes for the lifetime of ONE request, so the layout's
 * call and the page's call return the same resolved promise and only one
 * lookup reaches Postgres. Nothing is shared BETWEEN requests — this is
 * request-scoped deduplication, not a cache, and it must never become one:
 * a session is the most viewer-scoped value in the system.
 *
 * ⛔ WHY IT LIVES HERE AND NOT IN `src/server/auth/`. S-3 owns that tree and is
 * live in it on the same schedule; a diff there is a collision, and the S-4
 * work pack rules the lower stratum wins. So the dedupe wraps at the CALL
 * SITES, inside `(public)/`, and `src/server/auth/**` takes ZERO diff. This
 * file IMPORTS `auth`; it does not modify it.
 *
 * The `_lib` folder name is load-bearing: an underscore prefix makes it a
 * Next.js private folder, so it is excluded from routing and cannot become a
 * `/_lib` URL.
 *
 * ⛔ SCOPE — RSC RENDER PATH ONLY. Route handlers and Server Actions
 * (`quote/route.ts`, `bets/endpoint.ts`, `bookmarks/add.ts`, `uploads/sign`,
 * `onboarding/complete`, `auth/logout`) keep their own direct
 * `auth.api.getSession` calls: each is one-shot per request, so there is no
 * second read to dedupe, and several sit outside this task's fence. Adding
 * them here would be churn with no measured benefit.
 * `(auth)/layout.tsx` is likewise untouched — that route group has no
 * page-level second read.
 */
export const getRequestSession = cache(async () => {
	return auth.api.getSession({ headers: await headers() });
});
