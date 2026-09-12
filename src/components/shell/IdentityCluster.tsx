import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

/**
 * Right-zone identity affordance. Signed-out → the JOIN entry (mockup v0_2,
 * the W2.1 nav flip): ink-fill/ground-text inverse button on the 34px
 * register; hover/pressed step down the ramp (n7/n6 — the states table has
 * no inverse-button row, noted at the log). Signed-in → the identity chip,
 * which LINKS to the viewer's own profile (`/u/[pseudonym]`, activated at
 * UI.A5 — the A4 follow-up #2; a null pseudonym keeps a non-linked chip).
 * Avatar = the viewer's own PFP, composed server-side in the layout and passed
 * down as a plain string (PFP-1) + the mockup's 1-char fallback. A viewer with
 * no assigned PFP gets the placeholder from the same builder, so this component
 * never decides what a missing avatar looks like. The Đ cluster
 * (Portfolio/Balance) SHIPPED and stands beside this chip in the signed-in
 * right zone — Balance at #283, Σ open-position value at #286 — and both
 * figures render through the single shared display formatter, rounded and
 * grouped (SPEC.1 §21.8, §10.8). The OQ-2 deferral this comment used to
 * claim lapsed at #283.
 *
 * Signed-in/out selection is server-side in the layouts (plan §4.2) — this
 * component just renders the given viewer.
 *
 * ⛔ BELOW 640px THE SIGNED-IN CHIP REDUCES TO THE AVATAR ALONE (ADR-0049). The
 * pseudonym text is not rendered; the avatar stays, and it stays because it is
 * the LINK to the profile where the hidden pseudonym — and the balance and
 * portfolio the Đ cluster stops showing — all render. Hiding the avatar would
 * remove the affordance the whole ruling rests on, so the hide is on the
 * pseudonym `<span>` and on nothing else. This reverses MOBILE-1 Phase A's
 * never-hidden ruling for this component; ADR-0049 is the record.
 *
 * ⛔⛔ THE SIGNED-OUT JOIN BRANCH TAKES ZERO DIFF, AND THAT IS A RULE RATHER THAN
 * AN OMISSION. ADR-0048's whole point is that a phone participant may join, so
 * the CTA renders at every width on every route. This file once carried a blanket
 * ban on ANY responsive token precisely to keep that true; the ban is now an
 * allowlist of exactly one token, and `header-mobile::IdentityCluster-reduces-to-
 * the-avatar-below-640-and-the-JOIN-CTA-never-hides` asserts the JOIN branch's
 * cleanliness EXPLICITLY, because the old shape held it only as a side effect.
 *
 * ⚠ THE PSEUDONYM'S `InfoTip` GOES WITH THE TEXT, DELIBERATELY. Hiding the
 * trigger removes the `pseudonym` glossary tip on phones — accepted under the
 * same relocation argument. `asChild` is `Slot`-merged and adds no DOM node, so
 * the class lands on the span and nothing else moves. `max-w-40 truncate` is
 * untouched: it handles a long pseudonym above 640px, and below 640px the span
 * is `display:none`, so truncation is moot rather than removed.
 */
export type HeaderViewer = {
	pseudonym: string | null;
	/** The viewer's PFP URL, already resolved by `pfpUrl` in the layout. */
	pfpUrl: string;
};

export function IdentityCluster({
	viewer,
	mobileResponsive = false,
}: {
	viewer: HeaderViewer | null;
	/**
	 * ADR-0049 — when true, the signed-in chip's pseudonym text is not rendered
	 * below 640px and the chip reduces to its avatar. Threaded from the layout
	 * through `GlobalHeader`; it defaults `false` so a mount that does not pass it
	 * inherits the DESKTOP render rather than an accidental reflow (AGENTS.md §8).
	 * It never reaches the signed-out JOIN branch, which renders at every width.
	 */
	mobileResponsive?: boolean;
}) {
	if (!viewer) {
		return (
			<Link
				href="/sign-in"
				className="flex h-[34px] shrink-0 items-center rounded-(--r) bg-ink px-5 text-xs font-bold tracking-[0.12em] text-ground uppercase outline-none select-none [transition:all_var(--dur-hover)] hover:bg-n7 active:bg-n6 focus-visible:shadow-(--state-focus-ring)"
			>
				JOIN
			</Link>
		);
	}

	const chipClass =
		"flex h-[34px] shrink-0 items-center gap-2 rounded-full bg-(--btn-fill) pr-3 pl-1.5 [border:var(--hairline)]";

	// Post-onboarding pseudonym is NOT NULL; the chip links to the viewer's own
	// profile (`/u/[pseudonym]`, activated at UI.A5 — the A4 follow-up #2). A
	// null pseudonym (edge) keeps the non-linked chip (no profile URL exists).
	if (viewer.pseudonym === null) {
		return (
			<span className={`${chipClass} select-none`}>
				<Avatar size="sm">
					<AvatarImage src={viewer.pfpUrl} alt="" />
					<AvatarFallback>{""}</AvatarFallback>
				</Avatar>
			</span>
		);
	}

	return (
		<Link
			data-testid="identity-chip-link"
			href={`/u/${encodeURIComponent(viewer.pseudonym)}`}
			className={`${chipClass} outline-none [transition:all_var(--dur-hover)] hover:bg-n1 focus-visible:shadow-(--state-focus-ring)`}
		>
			<Avatar size="sm">
				<AvatarImage src={viewer.pfpUrl} alt="" />
				<AvatarFallback>{viewer.pseudonym.charAt(0)}</AvatarFallback>
			</Avatar>
			<InfoTip content={GLOSSARY.pseudonym} asChild>
				<span
					className={cn(
						"max-w-40 truncate text-xs font-semibold text-ink",
						mobileResponsive && "max-mobile:hidden",
					)}
				>
					{viewer.pseudonym}
				</span>
			</InfoTip>
		</Link>
	);
}
