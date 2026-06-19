import Link from "next/link";
import { redirect } from "next/navigation";

import { createMarketAction } from "@/server/admin/markets/create";
import { requireAdminPage } from "@/server/admin/page-guards";
import {
	AdminShell,
	adminButtonClass,
	adminInputClass,
	adminLabelClass,
	adminTextareaClass,
	Banner,
} from "../../_ui";

// ENGINE.15 S3 — R-15.1 create form. Server Component, ZERO client JS (D-15.e).
// The inline wrapper calls the wire action and surfaces the result via a
// redirect param (the R-15.6 / D-15.e pattern); the service + state machine
// remain the real gate. UI.6 admin-fixes: legibility pass + slug helper/error
// (STYLE + form copy only — the `submit` action and field names are unchanged).

// UI.6 admin-fixes (Problem 3) — map the create action's typed error codes to
// specific, operator-actionable messages. The slug rule lives in the service
// (`SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/`, length 3–80) and is unchanged.
const ERROR_MESSAGES: Record<string, string> = {
	slug_invalid:
		"Slug is invalid. Use lowercase kebab-case: a–z, 0–9 and single hyphens between words, 3–80 characters (no spaces, uppercase, underscores, or leading/trailing/double hyphens). Example: will-eth-flip-btc-2026",
	slug_already_taken:
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
		<AdminShell title="New market" maxWidth="max-w-2xl">
			<nav className="mb-6 text-sm">
				<Link
					href="/admin/markets"
					className="text-muted-foreground underline-offset-2 hover:underline"
				>
					← Markets
				</Link>
			</nav>

			{error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}

			<form
				action={submit}
				className="space-y-5 rounded-lg border border-border bg-card p-6 shadow-sm"
			>
				<div className="space-y-1.5">
					<label htmlFor="slug" className={adminLabelClass}>
						Slug
					</label>
					<input id="slug" name="slug" required className={adminInputClass} />
					<p className="text-xs text-muted-foreground">
						Lowercase kebab-case: a–z, 0–9 and single hyphens. 3–80 characters.
						Example:{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono">
							will-eth-flip-btc-2026
						</code>
					</p>
				</div>

				<div className="space-y-1.5">
					<label htmlFor="title" className={adminLabelClass}>
						Title (question)
					</label>
					<input id="title" name="title" required className={adminInputClass} />
				</div>

				<div className="space-y-1.5">
					<label htmlFor="description" className={adminLabelClass}>
						Resolution criterion
					</label>
					<textarea
						id="description"
						name="description"
						required
						className={adminTextareaClass}
					/>
				</div>

				<div className="space-y-1.5">
					<label htmlFor="resolutionDeadline" className={adminLabelClass}>
						Resolution deadline
					</label>
					<input
						id="resolutionDeadline"
						type="datetime-local"
						name="resolutionDeadline"
						required
						className={adminInputClass}
					/>
					<p className="text-xs text-muted-foreground">Interpreted as UTC.</p>
				</div>

				<button type="submit" className={adminButtonClass}>
					Create market
				</button>
			</form>
		</AdminShell>
	);
}
