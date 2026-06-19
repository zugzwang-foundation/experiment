// UI.6 admin-fixes (Problem 2) — shared presentational primitives for the
// internal admin surfaces. A `_`-prefixed file is a Next.js private module, NOT
// a route. STYLE-ONLY: stable shadcn semantic tokens only (background / card /
// border / muted / primary / destructive); NO placeholder brand tokens
// (--color-yes/no/brand stay frozen until DESIGN.7 — AGENTS.md §8).

export const adminInputClass =
	"w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export const adminTextareaClass = `${adminInputClass} min-h-24 resize-y`;

export const adminSelectClass = adminInputClass;

export const adminButtonClass =
	"inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export const adminLabelClass = "block text-sm font-medium text-foreground";

/** Page wrapper: full-height background, centered column, title + optional subtitle. */
export function AdminShell({
	title,
	subtitle,
	maxWidth = "max-w-4xl",
	children,
}: {
	title: string;
	subtitle?: string;
	maxWidth?: string;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<main className="min-h-dvh bg-background text-foreground">
			<div className={`mx-auto ${maxWidth} px-6 py-10`}>
				<header className="mb-6">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{subtitle ? (
						<p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
					) : null}
				</header>
				{children}
			</div>
		</main>
	);
}

/** Inline status banner (success or error). */
export function Banner({
	tone,
	children,
}: {
	tone: "error" | "ok";
	children: React.ReactNode;
}): React.ReactElement {
	const cls =
		tone === "error"
			? "border-destructive/30 bg-destructive/5 text-destructive"
			: "border-border bg-muted text-foreground";
	return (
		<div
			role="status"
			className={`mb-5 rounded-md border px-4 py-3 text-sm ${cls}`}
		>
			{children}
		</div>
	);
}
