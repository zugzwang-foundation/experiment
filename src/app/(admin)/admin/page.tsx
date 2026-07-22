import { redirect } from "next/navigation";

import { requireAdminPage } from "@/server/admin/page-guards";

// UI.6 S0 — the `/admin` index. Per SPEC.1 §15 the Admin Control Centre lands
// on the Moderation tab by default, and `/admin` itself renders no content: it
// gates then redirects. Layer-2 admin auth is re-validated at entry
// (requireAdminPage → /admin/login when absent) BEFORE the redirect, so an
// unauthenticated hit bounces to login, never to a Centre tab. Zero client JS.
export const dynamic = "force-dynamic";

export default async function AdminIndexPage(): Promise<never> {
	await requireAdminPage();
	redirect("/admin/moderation");
}
