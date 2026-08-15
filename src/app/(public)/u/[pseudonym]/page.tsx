import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ArgumentList } from "@/components/profile/ArgumentList";
import { ProfileGraph } from "@/components/profile/graph/ProfileGraph";
import { IdentityCard } from "@/components/profile/IdentityCard";
import { PositionsTable } from "@/components/profile/PositionsTable";
import { PageContainer } from "@/components/shell/PageContainer";
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
		/* ⛔ THE CONTAINER TAG IS FROZEN — preset AND className. `tests/unit/shell/
		   page-container.test.ts` site 5 (`:79-82`) pins this call site's RESOLVED
		   class set to `mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6`
		   and asserts equality, and its `BOX_AXES` (`:40`) additionally forbids a
		   `max-w-*` on the className. So HTML-FINISH row 20 (the wide preset) is
		   HALTED: both routes to it cross a guard outside this task's write
		   allow-list. The two bands below therefore compose INSIDE the 3xl frame.
		   ⚠ The same pin blocks `flex-1` here, which is what recon §4.1 calls
		   "CHAIN ENDS HERE" — see the arena band's note. */
		<PageContainer preset="reading" className="flex flex-col gap-6">
			{/* HTML-FINISH row 1 — TWO BANDS OF TWO SIDE-BY-SIDE COLUMNS, replacing
			    five full-width sections stacked in one column. Canon §2 (Profile):
			    "Two bands. Top: identity card … + six account tiles … + the graph
			    slot. Bottom 'arena': Positions table … + the argument [list]".
			    The mockup's `.headzone` and `.arena` are both `grid-template-
			    columns:1fr 1fr` (`:189`, `:221-222`).
			    ⚠ `md:` IS THE BUILD'S BREAKPOINT, NOT THE MOCKUP'S. The mockup is a
			    fixed-desktop prototype and declares no breakpoint at all (recon
			    A.4), so it makes no responsive statement to diverge from. Below
			    `md` the two columns stack — the same posture `HeroPanels.tsx:82`
			    ships for Discovery's three-panel hero.
			    `gap-6` is the gap ALREADY on this container's className for the
			    same inter-section role; no new spacing value is introduced. */}
			<div data-testid="profile-headzone" className="grid gap-6 md:grid-cols-2">
				{/* HTML-FINISH row 8 — THE TILES MOVE INSIDE THE IDENTITY BLOCK, to
				    the right of the PFP and under the pseudonym row (mockup `:437`:
				    `.idcol` is `[.unamerow][.tiles]`). They are no longer a sibling
				    band, so `IdentityCard` renders them and this file no longer
				    mounts `ProfileTiles` directly. */}
				<IdentityCard user={profileUser} owner={owner} tiles={tiles} />
				<ProfileGraph series={graph} />
			</div>
			{/* The arena band. ⚠ NO `flex-1` — see the container note above: the
			    growth that would let these panels divide the viewport's leftover
			    height has to start at the container, and that node is pinned. The
			    band is content-height, so row 3's panel-scoped scroll has no slack
			    to divide. HALTED and reported, not approximated with a hand-derived
			    `calc()` — that would rebuild the exact cross-file height coupling
			    `discovery-height-chain.test.ts` exists to prevent. */}
			<div data-testid="profile-arena" className="grid gap-6 md:grid-cols-2">
				<PositionsTable
					payload={positionsPayload}
					initialMarketSlug={initialMarketSlug}
				/>
				{/* HTML-FINISH row 4 — the head cluster's identity. Every argument in
				    this list is authored by the profile user, so the avatar and
				    pseudonym come from the ALREADY-RESOLVED `profileUser` rather than
				    from a per-item field: `loadProfileArguments` is untouched and no
				    new read is issued. */}
				<ArgumentList
					items={argumentItems}
					owner={owner}
					author={profileUser}
				/>
			</div>
		</PageContainer>
	);
}
