// Shared presentational primitives for the internal operator surfaces — the
// admin console AND the participant auth screens. Promoted from the prior
// `(admin)/admin/_ui.tsx` so both route groups build on ONE system (no parallel
// styling). STYLE-ONLY: stable shadcn semantic tokens only (background / card /
// border / muted / primary / secondary / destructive / ring) — NO placeholder
// brand tokens (`--color-yes/no/brand` stay frozen until DESIGN.7, AGENTS.md
// §8). Internal-tooling grade, legible over decorative; DESIGN.7 owns the real
// brand skin.

// — form control class strings (shared so every control looks identical) —
export const inputClass =
	"w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export const textareaClass = `${inputClass} min-h-24 resize-y`;

export const selectClass = inputClass;

export const labelClass = "block text-sm font-medium text-foreground";

export const buttonClass =
	"inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export const buttonSecondaryClass =
	"inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

export const cardClass = "rounded-lg border border-border bg-card shadow-sm";

/** Full-page shell with a title header (used by the admin list/detail pages). */
export function Shell({
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
			<div className={`mx-auto w-full ${maxWidth} px-6 py-10`}>
				<header className="mb-6">
					<h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
					{subtitle ? (
						<p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
					) : null}
				</header>
				{children}
			</div>
		</main>
	);
}

/** Full-height vertically-centered single-column shell (login + sign-in). */
export function CenteredShell({
	children,
}: {
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<main className="grid min-h-dvh place-items-center bg-background px-6 py-10 text-foreground">
			<div className="w-full max-w-sm">{children}</div>
		</main>
	);
}

/** Inline status banner. */
export function Banner({
	tone,
	children,
}: {
	tone: "error" | "ok" | "info";
	children: React.ReactNode;
}): React.ReactElement {
	const cls =
		tone === "error"
			? "border-destructive/30 bg-destructive/5 text-destructive"
			: tone === "ok"
				? "border-border bg-muted text-foreground"
				: "border-border bg-muted/50 text-muted-foreground";
	return (
		<div
			role="status"
			className={`mb-5 rounded-md border px-4 py-3 text-sm ${cls}`}
		>
			{children}
		</div>
	);
}

/** A labelled form field: label + control slot + optional helper text. The
 * caller passes the actual control (input/select/textarea) as children so its
 * `name`/`id`/`required` stay under the caller's control. */
export function FormField({
	label,
	htmlFor,
	helper,
	children,
}: {
	label: string;
	htmlFor: string;
	helper?: React.ReactNode;
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<div className="space-y-1.5">
			<label htmlFor={htmlFor} className={labelClass}>
				{label}
			</label>
			{children}
			{helper ? (
				<p className="text-xs text-muted-foreground">{helper}</p>
			) : null}
		</div>
	);
}
