import { FileText, MessageSquare } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// ADMIN-UI — the Moderation tab's two views (live review feed · audit log) as a
// segmented sub-navigation. Presentational Server Component; links only.
// ⚠ Lives OUTSIDE `moderation/audit/`, whose every file the audit leak guard
// scans — this module carries no data and has no business being in that set.

const VIEWS = [
	{
		id: "feed",
		label: "Live review feed",
		href: "/admin/moderation",
		icon: MessageSquare,
	},
	{
		id: "audit",
		label: "Audit log",
		href: "/admin/moderation/audit",
		icon: FileText,
	},
] as const;

export function ModerationSubnav({
	active,
}: {
	active: "feed" | "audit";
}): React.ReactElement {
	return (
		<nav
			aria-label="Moderation views"
			className="mb-6 inline-flex rounded-(--r) border border-n2 bg-n0 p-1"
		>
			{VIEWS.map((view) => {
				const isActive = view.id === active;
				const Icon = view.icon;
				return (
					<Link
						key={view.id}
						href={view.href}
						aria-current={isActive ? "page" : undefined}
						className={cn(
							"inline-flex h-8 items-center gap-2 rounded-[calc(var(--r)-2px)] px-3 text-sm outline-none focus-visible:shadow-(--state-focus-ring)",
							isActive
								? "bg-n2 font-semibold text-ink"
								: "font-medium text-n5 hover:text-ink",
						)}
					>
						<Icon aria-hidden className="size-4" />
						{view.label}
					</Link>
				);
			})}
		</nav>
	);
}
