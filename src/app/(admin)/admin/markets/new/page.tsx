import Link from "next/link";
import { redirect } from "next/navigation";

import {
	Banner,
	buttonClass,
	cardClass,
	FormField,
	inputClass,
	Shell,
	textareaClass,
} from "@/components/internal-ui";
import { createMarketAction } from "@/server/admin/markets/create";
import { requireAdminPage } from "@/server/admin/page-guards";

// ENGINE.15 S3 — R-15.1 create form. Server Component, ZERO client JS (D-15.e).
// The inline wrapper calls the wire action and surfaces the result via a
// redirect param (the R-15.6 / D-15.e pattern); the service + state machine
// remain the real gate. UI.6 polish: STYLE + form copy only — the `submit`
// action and field names are unchanged.

// UI.6 admin-fixes (Problem 3) — map the create action's typed error codes to
// specific, operator-actionable messages. The slug rule lives in the service
// (`SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, length 3–80) and is unchanged.
const ERROR_MESSAGES: Record<string, string> = {
	slug_invalid:
		"Slug is invalid. Use lowercase kebab-case: a–z, 0–9 and single hyphens between words, 3–80 characters (no spaces, uppercase, underscores, or leading/trailing/double hyphens). Example: will-eth-flip-btc-2026",
	slug_taken:
		"That slug is already in use by another market. Pick a different one.",
	validation_error:
		"One or more fields are invalid — check the title, resolution criterion, and deadline.",
};

function errorMessage(code: string): string {
	return ERROR_MESSAGES[code] ?? `Error: ${code}`;
}

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
		<Shell title="New market" maxWidth="max-w-2xl">
			<nav className="mb-6 text-sm">
				<Link
					href="/admin/markets"
					className="text-muted-foreground underline-offset-2 hover:underline"
				>
					← Markets
				</Link>
			</nav>

			{error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}

			<form action={submit} className={`${cardClass} space-y-5 p-6`}>
				<FormField
					label="Slug"
					htmlFor="slug"
					helper={
						<>
							Lowercase kebab-case: a–z, 0–9 and single hyphens. 3–80
							characters. Example:{" "}
							<code className="rounded bg-muted px-1 py-0.5 font-mono">
								will-eth-flip-btc-2026
							</code>
						</>
					}
				>
					<input id="slug" name="slug" required className={inputClass} />
				</FormField>

				<FormField label="Title (question)" htmlFor="title">
					<input id="title" name="title" required className={inputClass} />
				</FormField>

				<FormField label="Resolution criterion" htmlFor="description">
					<textarea
						id="description"
						name="description"
						required
						className={textareaClass}
					/>
				</FormField>

				<FormField
					label="Resolution deadline"
					htmlFor="resolutionDeadline"
					helper="Interpreted as UTC."
				>
					<input
						id="resolutionDeadline"
						type="datetime-local"
						name="resolutionDeadline"
						required
						className={inputClass}
					/>
				</FormField>

				<button type="submit" className={buttonClass}>
					Create market
				</button>
			</form>
		</Shell>
	);
}
