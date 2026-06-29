import { notFound } from "next/navigation";

import { db } from "@/db";
import { readContextBlock } from "@/server/debate-export/context";
import { loadExportMarketMeta } from "@/server/debate-export/market-meta";
import { serializeDebateExport } from "@/server/debate-export/serialize";
import { loadDebateView } from "@/server/debate-view/load-debate-view";
import { getMarketBySlug } from "@/server/markets/get-by-slug";

// GET /m/[slug]/export — the per-debate `.md` download (EXPORT.1 / ADR-0025).
//
// Read-only; public, signed-out OK (mirrors the debate-view page — `proxy.ts`
// gates `/admin/*` only). Node runtime (default; the context fs-read needs Node,
// not edge). The codebase's FIRST non-JSON route handler: `new Response(body,
// { headers })` with `text/markdown` + a `Content-Disposition: attachment`
// filename, vs `health/route.ts`'s `Response.json`.
//
// Uncached, per-request fresh (SPEC.2 §3.3 R-1 / ADR-0025 §1) — a cache is a
// window in which just-removed content could keep serving, so `force-dynamic` +
// `Cache-Control: no-store`. Every request re-runs `loadDebateView`, which
// re-reads the `content_removed` set, so masking is always current.
//
// Masking is INHERITED: it serializes only the masked `DebateViewModel` from
// `loadDebateView`, never the `DebateComment` intermediate — reimplemented
// nowhere here (debate-export.md §10).

export const dynamic = "force-dynamic";

export async function GET(
	_req: Request,
	ctx: { params: Promise<{ slug: string }> },
): Promise<Response> {
	const { slug } = await ctx.params;

	// Reuse the page's resolver — excludes `Draft`, so a Draft/unknown slug 404s
	// exactly as the debate-view page does.
	const market = await getMarketBySlug(db, slug);
	if (market === null) {
		notFound();
	}

	const [model, meta, context] = await Promise.all([
		loadDebateView(db, { market }),
		loadExportMarketMeta(db, market.id),
		readContextBlock(),
	]);

	const body = serializeDebateExport({
		model,
		meta,
		context,
		exportedAt: new Date().toISOString(),
	});

	return new Response(body, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Content-Disposition": `attachment; filename="${market.slug}.md"`,
			"Cache-Control": "no-store",
		},
	});
}
