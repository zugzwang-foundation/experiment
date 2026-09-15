import { AdminTabs } from "@/app/(admin)/admin/_components/AdminTabs";

// ADMIN-UI — the admin console frame. Presentational Server Component.
//
// ⚠ DELIBERATELY NOT A ROUTE-GROUP LAYOUT, for AdminTabs' recorded reason: an
// `(admin)` layout would wrap — and thus loop — the in-group `/admin/login`
// page (page-guards.ts). Each gated page renders `<AdminShell>` itself, AFTER
// its own `requireAdminPage()`, so nothing here runs before the Layer-2 gate.
//
// ⚠ NOT `fixed`, NOT a PageContainer. The top bar is in flow (the sticky-header
// guard pins every document-level `fixed` layer in `src/app`), and the content
// column is bounded here rather than through the participant container
// primitive, whose call sites are pinned by `page-container.test.ts`.
//
// ⚠ `min-w-0` ON <main> IS LOAD-BEARING. The root layout's <body> is a flex
// column, and a flex item's min-width defaults to its min-content width — so
// the markets table's scroll track (and any unbreakable id or URL) widened the
// whole page past a phone viewport instead of scrolling inside its own box.
// Measured in a 390px headless render before this token existed.

export function AdminShell({
	active,
	children,
}: {
	active: "moderation" | "markets";
	children: React.ReactNode;
}): React.ReactElement {
	return (
		<main className="min-h-dvh w-full min-w-0 bg-ground text-ink">
			<div className="border-n2 border-b bg-n0">
				<div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-2 px-6 pt-3">
					<div className="flex items-center gap-2 pb-3">
						<span className="font-semibold text-ink text-sm tracking-tight">
							Zugzwang
						</span>
						<span aria-hidden className="text-n3">
							/
						</span>
						<span className="font-medium text-n5 text-xs uppercase tracking-wider">
							Admin Control Centre
						</span>
					</div>
					<AdminTabs active={active} />
				</div>
			</div>
			<div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
		</main>
	);
}
