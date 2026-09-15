import { Gavel, type LucideIcon, ShieldAlert } from "lucide-react";
import Link from "next/link";

// UI.6 S0 — the two-tab Admin Control Centre nav (SPEC.1 §15): Moderation
// (default landing) | Markets. Admin-INTERNAL chrome built fresh, tokens-only —
// NOT a shared participant product component (the "no shared components" ban is
// on participant surfaces; admin chrome is fine — plan D-9). It is deliberately
// NOT a route-group layout: an `(admin)` layout would wrap — and thus loop —
// the in-group `/admin/login` page (page-guards.ts). Each admin page renders
// the nav itself (since ADMIN-UI, through `<AdminShell>`), immediately below
// its own Layer-2 gate.
//
// Presentational Server Component: `active` is a prop, so no client JS.

type AdminTab = "moderation" | "markets";

const TABS: ReadonlyArray<{
	id: AdminTab;
	label: string;
	href: string;
	icon: LucideIcon;
}> = [
	{
		id: "moderation",
		label: "Moderation",
		href: "/admin/moderation",
		icon: ShieldAlert,
	},
	{ id: "markets", label: "Markets", href: "/admin/markets", icon: Gavel },
];

export function AdminTabs({
	active,
}: {
	active: AdminTab;
}): React.ReactElement {
	return (
		<nav aria-label="Admin Control Centre" className="flex items-end gap-1">
			{TABS.map((tab) => {
				const isActive = tab.id === active;
				const Icon = tab.icon;
				return (
					<Link
						key={tab.id}
						href={tab.href}
						aria-current={isActive ? "page" : undefined}
						className={
							isActive
								? "-mb-px inline-flex items-center gap-2 rounded-t-(--r-chip) border-ink border-b-2 px-3 pt-1 pb-2.5 font-semibold text-ink text-sm outline-none focus-visible:shadow-(--state-focus-ring)"
								: "-mb-px inline-flex items-center gap-2 rounded-t-(--r-chip) border-transparent border-b-2 px-3 pt-1 pb-2.5 font-medium text-n5 text-sm outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
						}
					>
						<Icon aria-hidden className="size-4" />
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
