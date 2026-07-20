import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Right-zone identity affordance. Signed-out → the JOIN entry (mockup v0_2,
 * the W2.1 nav flip): ink-fill/ground-text inverse button on the 34px
 * register; hover/pressed step down the ramp (n7/n6 — the states table has
 * no inverse-button row, noted at the log). Signed-in → the identity chip,
 * which LINKS to the viewer's own profile (`/u/[pseudonym]`, activated at
 * UI.A5 — the A4 follow-up #2; a null pseudonym keeps a non-linked chip).
 * Avatar = the D8 placeholder for every author
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
					<AvatarImage src="/pfp-placeholder.svg" alt="" />
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
				<AvatarImage src="/pfp-placeholder.svg" alt="" />
				<AvatarFallback>{viewer.pseudonym.charAt(0)}</AvatarFallback>
			</Avatar>
			<span className="max-w-40 truncate text-xs font-semibold text-ink">
				{viewer.pseudonym}
			</span>
		</Link>
	);
}
