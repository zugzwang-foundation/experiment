import Link from "next/link";

// UI.6 S0 — the two-tab Admin Control Centre nav (SPEC.1 §15): Moderation
// (default landing) | Markets. Admin-INTERNAL chrome built fresh, tokens-only —
// NOT a shared participant product component (the "no shared components" ban is
// on participant surfaces; admin chrome is fine — plan D-9). It is deliberately
// NOT a route-group layout: an `(admin)` layout would wrap — and thus loop —
// the in-group `/admin/login` page (page-guards.ts). Each admin page renders
// `<AdminTabs active=… />` itself, immediately below its own Layer-2 gate.
//
// Presentational Server Component: `active` is a prop, so no client JS.

type AdminTab = "moderation" | "markets";

const TABS: ReadonlyArray<{ id: AdminTab; label: string; href: string }> = [
	{ id: "moderation", label: "Moderation", href: "/admin/moderation" },
	{ id: "markets", label: "Markets", href: "/admin/markets" },
];

export function AdminTabs({
	active,
}: {
	active: AdminTab;
}): React.ReactElement {
	return (
		<nav
			aria-label="Admin Control Centre"
			className="mb-6 flex items-center gap-1 border-b border-border"
		>
			{TABS.map((tab) => {
				const isActive = tab.id === active;
				return (
					<Link
						key={tab.id}
						href={tab.href}
						aria-current={isActive ? "page" : undefined}
						className={
							isActive
								? "-mb-px border-b-2 border-foreground px-4 py-2 text-sm font-semibold text-foreground"
								: "-mb-px border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
						}
					>
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
