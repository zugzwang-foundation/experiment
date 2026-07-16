import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Right-zone identity affordance. Signed-out → the JOIN entry (mockup v0_2,
 * the W2.1 nav flip): ink-fill/ground-text inverse button on the 34px
 * register; hover/pressed step down the ramp (n7/n6 — the states table has
 * no inverse-button row, noted at the log). Signed-in → the identity chip,
 * LINK-INERT until A5 (no Profile route exists): `aria-disabled`, the
 * plan's candidate microcopy `title="Profile — coming soon"` verbatim
 * (flagged for web review). Avatar = the D8 placeholder for every author
 * (`/pfp-placeholder.svg`) + the mockup's 1-char fallback. The Đ cluster
 * (Portfolio/Balance) is A2/A3 — ratified OQ-2 defers it; the chip stands
 * alone in the signed-in right zone.
 *
 * Signed-in/out selection is server-side in the layouts (plan §4.2) — this
 * component just renders the given viewer.
 */
export type HeaderViewer = {
	pseudonym: string | null;
};

export function IdentityCluster({ viewer }: { viewer: HeaderViewer | null }) {
	if (!viewer) {
		return (
			<Link
				href="/sign-in"
				className="flex h-[34px] shrink-0 items-center rounded-(--r) bg-ink px-5 text-xs font-bold tracking-[0.12em] text-ground uppercase transition-all outline-none select-none hover:bg-n7 active:bg-n6 focus-visible:shadow-(--state-focus-ring)"
			>
				JOIN
			</Link>
		);
	}

	return (
		<span
			aria-disabled="true"
			title="Profile — coming soon"
			className="flex h-[34px] shrink-0 items-center gap-2 rounded-full bg-(--btn-fill) pr-3 pl-1.5 select-none [border:var(--hairline)]"
		>
			<Avatar size="sm">
				<AvatarImage src="/pfp-placeholder.svg" alt="" />
				<AvatarFallback>{viewer.pseudonym?.charAt(0) ?? ""}</AvatarFallback>
			</Avatar>
			{/* Post-onboarding pseudonym is NOT NULL; if a null leaks the chip
			    renders nameless (the throwaway header's guard, plan §6). */}
			{viewer.pseudonym ? (
				<span className="max-w-40 truncate text-xs font-semibold text-ink">
					{viewer.pseudonym}
				</span>
			) : null}
		</span>
	);
}
