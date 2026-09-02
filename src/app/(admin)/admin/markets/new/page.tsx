import { requireAdminPage } from "@/server/admin/page-guards";

import { CreateMarketForm } from "./create-market-form";

// ENGINE.15 S3 — R-15.1 create form. MEDIA.1: the form now sets the market-media
// pool at create, which mandates out-of-band signed-PUT (browser → R2 direct).
// The D-15.e zero-client-JS posture is intentionally broken here — SPEC-mandated
// (SPEC.1 §15 / K3), not optional — so the page is a thin Server Component shell
// (admin gate + initial error param) wrapping the `CreateMarketForm` client
// island. The service + state machine remain the real gate.
//
// S-4 Phase B — `instant = false`: this page never carried a `dynamic`
// export (implicit dynamism via `requireAdminPage`'s `cookies()` read and
// this page's own unwrapped `searchParams` — same shape as `/admin/login`).
// Under `cacheComponents` that errors the prerender build. Deferred, not
// restructured — admin is outside S-4's scope (CLAUDE.md §1).
export const instant = false;

export default async function NewMarketPage(props: {
	searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const { error } = await props.searchParams;

	return (
		<main>
			<h1>New market</h1>
			<CreateMarketForm initialError={error} />
		</main>
	);
}
