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
		/* HTML-FINISH row 20 — THE WIDTH. `wide` is minted additively in
		   `PageContainer.tsx`; the census and the byte-carry are recorded there.
		   The allow-list was extended by one path this round, so site 5's pin in
		   `tests/unit/shell/page-container.test.ts` moves WITH this change, in
		   the same commit, and records it as a deliberate move rather than
		   absorbing it into the `c5892bc` baseline that field is contracted to
		   hold verbatim. */
		<PageContainer preset="wide" className="flex flex-col gap-6">
			{/* HTML-FINISH row 1 — TWO BANDS OF TWO SIDE-BY-SIDE COLUMNS, replacing
			    five full-width sections stacked in one column. Canon §2 (Profile):
			    "Two bands. Top: identity card … + six account tiles … + the graph
			    slot. Bottom 'arena': Positions table … + the argument [list]".
			    The mockup's `.headzone` and `.arena` are both `grid-template-
			    columns:1fr 1fr` (`:189`, `:221-222`).
			    ⚠⚠ `lg:`, NOT `md:` — RULED FROM MEASUREMENT, NOT CHOSEN. The arena
			    is two columns ONLY where each half clears the positions table's
			    fixed-track requirement. Measured in a browser against real
			    compiled CSS, on the shipped table with real data:

			      fixed track (Position 64 + Staked 58 + arrow 31 + Current 61)
			                                                        = 214px
			      Argument column min-content                       = 115px
			      ⇒ a half that clears both needs a 329px table,
			        + 26px panel chrome (p-3 ×2 + hairline ×2)      = 355px
			      ⇒ two halves + the 24px gap + px-6 ×2             = 782px

			    At `md` (768) each half measured 356px and the Argument column
			    rendered at 117px against its own 115px min-content — pinned, with
			    nothing left to give, which is the eight-character symptom. `md`
			    therefore MEETS the track and never clears it. At `lg` (1024) the
			    same column gets ~244px.
			    ⛔ NO BREAKPOINT VALUE IS INVENTED: `lg` is a shipped token, already
			    used at `DiscoveryGrid.tsx:35`, `LoadingSkeleton.tsx:48` and
			    `SlotHeader.tsx:81`. Below it the two columns STACK — the posture
			    `HeroPanels.tsx:82` ships for Discovery's hero.
			    ⚠ The mockup contributes NOTHING here: it is a fixed-desktop
			    prototype and declares no breakpoint at all (recon A.4).
			    `gap-6` is the gap ALREADY on this container's className for the
			    same inter-section role; no new spacing value is introduced. */}
			<div data-testid="profile-headzone" className="grid gap-6 lg:grid-cols-2">
				{/* HTML-FINISH row 8 — THE TILES MOVE INSIDE THE IDENTITY BLOCK, to
				    the right of the PFP and under the pseudonym row (mockup `:437`:
				    `.idcol` is `[.unamerow][.tiles]`). They are no longer a sibling
				    band, so `IdentityCard` renders them and this file no longer
				    mounts `ProfileTiles` directly. */}
				<IdentityCard user={profileUser} owner={owner} tiles={tiles} />
				<ProfileGraph series={graph} />
			</div>
			{/* The arena band — `lg:` for the same measured reason as the headzone
			    above, and the two bands MUST share one breakpoint or the identity
			    band would go two-column while the arena below it was still
			    stacked. */}
			<div data-testid="profile-arena" className="grid gap-6 lg:grid-cols-2">
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
