import { Bookmark } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ProfileUser } from "@/server/profile/resolve";

import { PROFILE_COPY } from "./copy";

/**
 * The profile identity band (SPEC.1 §23) — PFP + pseudonym + the owner/visitor
 * view chip. A `Banned` label (D8) shows for a banned user (visible to ALL). A
 * scrubbed user (H2 — the pseudonym is a bracketed placeholder like
 * `[scrubbed_user_4729]`) renders the scrubbed marker + the shared placeholder
 * avatar; NO PII (the DTO carries only the pseudonym, banned flag, and the
 * placeholder PFP — no email/name/googleId ever reaches this surface).
 *
 * The dedicated scrubbed-user silhouette asset is UNDEFINED (a brand ruling is
 * owed — values-log §278); v1 reuses the shared `pfp-placeholder.svg` (the same
 * avatar every identity shows until the R2 PFP builder is wired). Surfaced for
 * Gate C.
 */
export function IdentityCard({
	user,
	owner,
}: {
	user: ProfileUser;
	owner: boolean;
}): React.JSX.Element {
	const scrubbed = user.pseudonym.startsWith("[");

	return (
		<Card
			data-testid="identity-card"
			className="flex flex-row items-center gap-4 p-4"
		>
			{/* A plain <img> (not the radix Avatar, which defers the img until load
			    and shows only its fallback under jsdom) — the PFP is a tiny static
			    SVG placeholder; next/image would rewrite its src and add no value.
			    A scrubbed user shows the same placeholder until the R2 PFP builder +
			    the owed scrubbed-silhouette asset land (surfaced for Gate C).
			    biome-ignore lint/performance/noImgElement: static SVG placeholder — next/image is not warranted */}
			<img
				src={user.pfpUrl}
				alt=""
				width={56}
				height={56}
				className="size-14 rounded-[var(--imgr)] bg-n1"
			/>
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span
						data-testid="identity-pseudonym"
						className="font-medium text-ink"
					>
						{user.pseudonym}
					</span>
					{/* PB-1 (item 17) — the headzone bookmark icon, OWNER-ONLY by the
					    founder ruling of 2026-07-31: it is navigation to the viewer's
					    OWN saved set, so a visitor never sees it. Before this, the
					    `/bookmarks` route was live, auth-gated and ORPHANED from the
					    navigation graph — zero href literals anywhere in `src/`.
					    ⛔ BOOKMARK ONLY. W2.13 R2 struck the download icon that sits
					    beside it in the tier-4 shell; building both would ship an
					    affordance a ratified design review already removed.
					    ⛔ It lands INSIDE this text block, not on the root `Card`: that
					    row has no `justify-between`, so a third child there would
					    left-pack against this block rather than float right.
					    Icon + `aria-label`, no visible text — `surface.test.tsx:303`
					    asserts the whole identity-card subtree contains no "@". */}
					{owner && (
						<Link
							href="/bookmarks"
							aria-label="Bookmarks"
							className="text-n5 outline-none hover:text-ink focus-visible:shadow-(--state-focus-ring)"
						>
							<Bookmark className="size-4" />
						</Link>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge data-testid="profile-chip" variant="secondary">
						{owner ? PROFILE_COPY.chip.owner : PROFILE_COPY.chip.visitor}
					</Badge>
					{user.banned && (
						<Badge data-testid="identity-banned" variant="destructive">
							Banned
						</Badge>
					)}
					{scrubbed && (
						<Badge data-testid="identity-scrubbed" variant="outline">
							Scrubbed
						</Badge>
					)}
				</div>
			</div>
		</Card>
	);
}
