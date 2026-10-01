import { Gavel, type LucideIcon, ShieldAlert, Sprout } from "lucide-react";
import Link from "next/link";

import { isSeedToolsEnabled } from "@/server/seed/gate";

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

export type AdminTab = "moderation" | "markets" | "seed";

type TabDef = {
	id: AdminTab;
	label: string;
	href: string;
	icon: LucideIcon;
};

const TABS: ReadonlyArray<TabDef> = [
	{
		id: "moderation",
		label: "Moderation",
		href: "/admin/moderation",
		icon: ShieldAlert,
	},
	{ id: "markets", label: "Markets", href: "/admin/markets", icon: Gavel },
];

// SEED-STAGING-1 — rendered only where the tool exists. On production the
// page 404s; showing a link to it there would advertise a door that is shut.
const SEED_TAB: TabDef = {
	id: "seed",
	label: "Seed activity",
	href: "/admin/seed",
	icon: Sprout,
};

export function AdminTabs({
	active,
}: {
	active: AdminTab;
}): React.ReactElement {
	const tabs = isSeedToolsEnabled() ? [...TABS, SEED_TAB] : TABS;
	return (
		<nav aria-label="Admin Control Centre" className="flex items-end gap-1">
			{tabs.map((tab) => {
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
