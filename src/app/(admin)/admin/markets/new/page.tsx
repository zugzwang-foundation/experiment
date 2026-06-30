import { requireAdminPage } from "@/server/admin/page-guards";

import { CreateMarketForm } from "./create-market-form";

// ENGINE.15 S3 — R-15.1 create form. MEDIA.1: the form now sets the market-media
// pool at create, which mandates out-of-band signed-PUT (browser → R2 direct).
// The D-15.e zero-client-JS posture is intentionally broken here — SPEC-mandated
// (SPEC.1 §15 / K3), not optional — so the page is a thin Server Component shell
// (admin gate + initial error param) wrapping the `CreateMarketForm` client
// island. The service + state machine remain the real gate.
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
