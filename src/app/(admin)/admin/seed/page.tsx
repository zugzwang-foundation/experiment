import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { AdminShell } from "@/app/(admin)/admin/_components/AdminShell";
import { Notice } from "@/app/(admin)/admin/_components/Notice";
import { PageHeader } from "@/app/(admin)/admin/_components/PageHeader";
import { requireAdminPage } from "@/server/admin/page-guards";
import { isSeedToolsEnabled } from "@/server/seed/gate";

import { SeedUploader } from "./seed-uploader";

// SEED-STAGING-1 — /admin/seed, staging only.
//
// The environment check runs BEFORE the admin gate, so on production this URL
// is an ordinary 404 to everyone, signed in or not. The page itself only hosts
// the uploader; every write happens in /admin/seed/run, which re-checks the
// environment and the admin session on each request.

export const instant = false;

// Never indexed (as /admin/login). On production the page is a 404 anyway;
// on staging an unauthenticated crawler is redirected to login, so this only
// keeps the URL itself out of search results.
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default async function SeedActivityPage(): Promise<React.ReactElement> {
	// Keeps the page out of the build-time prerender — measured: without it the
	// build listed /admin/seed as `○ Static`, so the page's answer was fixed
	// when the image was built. With it the page renders per request, and
	// `isSeedToolsEnabled()` reads the task's environment by computed key
	// (gate.ts explains why the literal `process.env.X` form would not).
	await connection();
	if (!isSeedToolsEnabled()) notFound();
	await requireAdminPage();

	return (
		<AdminShell active="seed">
			<div className="mx-auto max-w-5xl">
				<PageHeader
					title="Seed activity"
					description="Upload a CSV or Excel sheet of arguments. Each row is posted as one argument with its bet, by a test participant with an automatically assigned pseudonym."
				/>
				<Notice tone="info" title="Staging only" className="mb-6">
					Seeded activity is real staging data and cannot be removed one batch
					at a time. Only a full staging reset clears it. Try a small sheet
					first. Re-uploading the same sheet never posts a row twice.
				</Notice>
				<Notice
					tone="info"
					title="Labels are the same person across sheets"
					className="mb-6"
				>
					A label (for example u1) reaches the same participant in every upload,
					along with their remaining Dharma. The preview checks each label's
					stakes against a new participant's 1000 Dharma, so a later sheet that
					reuses a label who has already spent can pass the preview and then
					stop that market mid-run. Use new labels for a new sheet.
				</Notice>
				<SeedUploader />
			</div>
		</AdminShell>
	);
}
