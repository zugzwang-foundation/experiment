import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// ADMIN-UI — the per-page heading block. Presentational Server Component.

export function PageHeader({
	title,
	description,
	back,
	meta,
	actions,
}: {
	title: React.ReactNode;
	description?: React.ReactNode;
	back?: { href: string; label: string };
	meta?: React.ReactNode;
	actions?: React.ReactNode;
}): React.ReactElement {
	return (
		<header className="mb-6">
			{back ? (
				<Link
					href={back.href}
					className="mb-3 inline-flex items-center gap-1.5 rounded-(--r-chip) text-n5 text-xs outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
				>
					<ArrowLeft aria-hidden className="size-3.5" />
					{back.label}
				</Link>
			) : null}
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="min-w-0 flex-1">
					<h1 className="font-semibold text-2xl text-ink tracking-tight">
						{title}
					</h1>
					{meta ? (
						<div className="mt-2 flex flex-wrap items-center gap-2 text-n5 text-xs">
							{meta}
						</div>
					) : null}
					{description ? (
						<p className="mt-2 max-w-3xl text-n5 text-sm">{description}</p>
					) : null}
				</div>
				{actions ? (
					<div className="flex shrink-0 flex-wrap items-center gap-2">
						{actions}
					</div>
				) : null}
			</div>
		</header>
	);
}
