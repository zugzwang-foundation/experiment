import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { ProfileTiles } from "@/components/profile/ProfileTiles";
import { db } from "@/db";
import { auth } from "@/server/auth";
import { loadProfileArguments } from "@/server/profile/arguments";
import { loadProfileGraphSeries } from "@/server/profile/graph-series";
import { buildPositionsPayload } from "@/server/profile/owner-view";
import { loadProfilePositions } from "@/server/profile/positions";
import { resolveProfileUser } from "@/server/profile/resolve";
import { loadProfileTiles } from "@/server/profile/tiles";

/**
 * The participant profile surface (SPEC.1 §23 / F-PROF-1) — the permanent
 * public accountability page at `/u/[pseudonym]`, composed into the ADR-0023
 * `(public)/` shell. RSC: resolve the CURRENT `users.pseudonym` (D6 — a
 * pseudonym slug, never a raw UUID), `notFound()` on an unknown OR pre-scrub
 * name (the identity is retired; N-9). A scrubbed user resolves under the
 * placeholder pseudonym. Then assemble the read-time model — six tiles, the
 * Dharma graph, the cross-market positions table, the argument list (all
 * viewer-INDEPENDENT; masking is applied inside `loadProfileArguments` /
 * `loadProfilePositions` before any DTO crosses to the client) — and the
 * identity band's owner/visitor chip.
 *
 * Owner detection is `session.user.id === profileUser.id` — the owner deltas
 * are the identity chip + the owner-only Sell mount (F-PROF-3, via the
 * `buildPositionsPayload` owner arm). Public-read (not middleware-gated);
 * UNCACHED / dynamic v1 (§7 S1 — `cacheComponents` is absent; the retrofit
 * rides the named foundational follow-up). `params`/`searchParams` are Promises
 * (Next 16).
 */
export default async function ProfilePage({
	params,
	searchParams,
}: {
	params: Promise<{ pseudonym: string }>;
	searchParams: Promise<{ market?: string | string[] }>;
}) {
	const { pseudonym } = await params;
	// A malformed percent-encoding is an UNKNOWN pseudonym → 404 (never a 500):
	// `decodeURIComponent` throws URIError on `/u/%` or `/u/abc%2`, and the route
	// law is unknown → notFound (F-PROF-1).
	let decoded: string;
	try {
		decoded = decodeURIComponent(pseudonym);
	} catch {
		notFound();
	}
	const profileUser = await resolveProfileUser(db, decoded);
	if (profileUser === null) {
		notFound();
	}

	// The positions read is the tiles' `positionsValue` source (the FI-2
	// inheritance law — one holding, one value), so tiles follows it; the
	// remaining reads run in parallel with positions.
	const [positions, argumentItems, graph] = await Promise.all([
		loadProfilePositions(db, { userId: profileUser.id }),
		loadProfileArguments(db, { userId: profileUser.id }),
		loadProfileGraphSeries(db, { userId: profileUser.id }),
	]);
	const tiles = await loadProfileTiles(db, {
		userId: profileUser.id,
		positions,
	});

	const session = await auth.api.getSession({ headers: await headers() });
	const owner = session?.user?.id === profileUser.id;

	// F-PROF-3: the Sell affordance exists ONLY on the owner payload arm; the
	// visitor arm carries no `sellEligible` field (the DTO boundary).
	const positionsPayload = buildPositionsPayload(positions, owner);

	// OQ-5 B — the W2.10-C click-through preselects the positions market filter
	// via `?market=<slug>` (a slug, matched against the rows in PositionsTable;
	// an unknown/repeated value falls back to "all", never rendered raw).
	const { market } = await searchParams;
	const initialMarketSlug = typeof market === "string" ? market : undefined;

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
			<IdentityCard user={profileUser} owner={owner} />
			<ProfileTiles tiles={tiles} />
			<ProfileGraph series={graph} />
			<PositionsTable
				payload={positionsPayload}
				initialMarketSlug={initialMarketSlug}
			/>
			<ArgumentList items={argumentItems} owner={owner} />
		</main>
	);
}
