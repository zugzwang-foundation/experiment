import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InfoTip } from "@/components/ui/info-tip";
import { GLOSSARY } from "@/lib/copy/glossary";

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
 * ⛔⛔ MOBILE-1 · Phase B — THE JOIN CTA IS HIDDEN ON PHONES AND ON
 * TOUCH-PRIMARY DEVICES, AND THE HIDE IS **UNGATED BY `mobileResponsive`** ON
 * PURPOSE. Everything else in this header's subtree gates its breakpoint
 * classes on that prop, because a REFLOW class must not reach `(auth)` —
 * ADR-0045 leaves auth/join surfaces "gated, not made responsive," and
 * `tests/unit/shell/global-header-mobile-reflow.test.ts` enforces it.
 *
 * This class is not a reflow. It IS that gate, and ADR-0045 names this surface
 * as the "global JOIN, mounted via `GlobalHeader` on every route." Threading
 * the prop here would leave the JOIN button visible at phone width on
 * `/sign-in` and `/sign-in/otp` — the very pages Phase B swaps for "Sign-up
 * only works on a computer right now.", and where a device-blocked visitor is
 * redirected. A button offering the thing the page beneath it just refused.
 * ⇒ The two rules do not conflict; they govern different kinds of class. The
 * guard row named above was INVERTED rather than deleted to record exactly
 * that, and it reddens on a third token or on any `mobileResponsive` here.
 *
 * ⛔ ONLY THE SIGNED-OUT BRANCH. The identity chip below carries neither token:
 * a participant who signed up on a computer and opens the site on their phone
 * keeps their own identity link. Phase B blocks NEW sign-in attempts and
 * touches no existing session (plan §3 "Scope", §6).
 *
 * ⚠ TWO CONDITIONS, INDEPENDENT, BOTH REQUIRED. `max-mobile:` is the 640px
 * phone-width rule; `touch-primary:` is width-independent and is the ONLY layer
 * a default-mode iPad ever meets, because that device sends a User-Agent
 * byte-identical to a real Mac and the server-side gate therefore cannot see it
 * at all (`src/server/auth/device-class.ts`). Neither is cosmetic decoration on
 * top of the other. And neither is enforcement: the server gate is
 * (plan §4, ADR-0045).
 */
export type HeaderViewer = {
	pseudonym: string | null;
	/** The viewer's PFP URL, already resolved by `pfpUrl` in the layout. */
	pfpUrl: string;
};

export function IdentityCluster({ viewer }: { viewer: HeaderViewer | null }) {
	if (!viewer) {
		return (
			<Link
				href="/sign-in"
				className="flex h-[34px] shrink-0 items-center rounded-(--r) bg-ink px-5 text-xs font-bold tracking-[0.12em] text-ground uppercase outline-none select-none [transition:all_var(--dur-hover)] max-mobile:hidden touch-primary:hidden hover:bg-n7 active:bg-n6 focus-visible:shadow-(--state-focus-ring)"
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
				<span className="max-w-40 truncate text-xs font-semibold text-ink">
					{viewer.pseudonym}
				</span>
			</InfoTip>
		</Link>
	);
}
