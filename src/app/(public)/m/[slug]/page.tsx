import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

/**
 * Participant market surface (SHELL/UI.0 scaffold). RSC; resolves the market by
 * its public slug and renders a MINIMAL placeholder — title + status + a pointer
 * forward. This is explicitly NOT the DEBATE.4 debate view (two-column /
 * ranking / markers / Support–Counter aggregates); only the addressable
 * scaffold and the slug→404 contract land here.
 *
 * URL contract: a slug param, never a raw UUID (ADR-0016 §6 —
 * id::raw-uuid-not-in-participant-urls). An unknown OR `Draft` slug →
 * `notFound()` (OQ-2; Drafts stay admin-only).
 */
export default async function MarketPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const market = await getMarketBySlug(db, slug);
	if (market === null) {
		notFound();
	}

	return (
		<div className="mx-auto max-w-3xl px-6 py-10">
			<div className="flex items-start justify-between gap-4">
				<h1 className="text-2xl font-semibold tracking-tight">
					{market.title}
				</h1>
				<Badge variant="outline">{market.status}</Badge>
			</div>
			{market.description ? (
				<p className="mt-4 text-sm text-muted-foreground">
					{market.description}
				</p>
			) : null}
			<p className="mt-8 text-sm text-muted-foreground">
				The debate view arrives in DEBATE.4.
			</p>
		</div>
	);
}
