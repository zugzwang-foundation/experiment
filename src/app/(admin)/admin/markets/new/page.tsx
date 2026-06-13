import { redirect } from "next/navigation";

import { createMarketAction } from "@/server/admin/markets/create";
import { requireAdminPage } from "@/server/admin/page-guards";

// ENGINE.15 S3 — R-15.1 create form. Server Component, ZERO client JS (D-15.e).
// The inline wrapper calls the wire action and surfaces the result via a
// redirect param (the R-15.6 / D-15.e pattern); the service + state machine
// remain the real gate.
export default async function NewMarketPage(props: {
	searchParams: Promise<{ error?: string }>;
}): Promise<React.ReactElement> {
	await requireAdminPage();

	const { error } = await props.searchParams;

	async function submit(formData: FormData): Promise<void> {
		"use server";
		const result = await createMarketAction(formData);
		if (result.ok) {
			redirect(`/admin/markets/${result.data.marketId}?ok=created`);
		}
		redirect(`/admin/markets/new?error=${result.error.code}`);
	}

	return (
		<main>
			<h1>New market</h1>
			{error ? <p>Error: {error}</p> : null}
			<form action={submit}>
				<p>
					<label>
						Slug <input name="slug" required />
					</label>
				</p>
				<p>
					<label>
						Title (question) <input name="title" required />
					</label>
				</p>
				<p>
					<label>
						Resolution criterion <textarea name="description" required />
					</label>
				</p>
				<p>
					<label>
						Resolution deadline{" "}
						<input type="datetime-local" name="resolutionDeadline" required />
					</label>
				</p>
				<button type="submit">Create</button>
			</form>
		</main>
	);
}
