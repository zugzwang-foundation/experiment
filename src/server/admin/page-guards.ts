import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { validateAdminSession } from "@/server/auth/admin/validate";

// ENGINE.15 S5 security remediation — page-level Layer-2 admin guards. The
// participant-facing `proxy.ts` Layer 1 is presence-only (UX, bypassable per the
// CVE-2025-29927 posture); admin Server-Component pages must RE-VALIDATE the
// session at render entry — co-located with the data read, NOT in an outer
// `(admin)` group layout (which would loop the in-group `/admin/login` page).
// Mirrors the per-action `requireAdminSession` / `validateAdminSession` boundary.

/**
 * Redirect to `/admin/login` unless a valid admin session exists. Call at the
 * TOP of every admin Server-Component page EXCEPT `/admin/login` itself, before
 * any data read.
 */
export async function requireAdminPage(): Promise<void> {
	const session = await validateAdminSession(await cookies());
	if (!session) redirect("/admin/login");
}

/**
 * Validate a UUID route param (e.g. `[marketId]`) BEFORE any DB query, so a
 * malformed segment yields a clean 404 instead of a Postgres `22P02` 500.
 * Returns the validated value; `notFound()` (throws) on a non-UUID.
 */
export function requireUuidParam(raw: string): string {
	if (!z.string().uuid().safeParse(raw).success) notFound();
	return raw;
}
