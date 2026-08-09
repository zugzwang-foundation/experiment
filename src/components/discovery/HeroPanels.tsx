import Link from "next/link";

import { SideBadge } from "@/components/debate/badges";
import { formatDharma } from "@/components/debate/format";
import { PriceBar } from "@/components/debate/PriceBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { HeroPost, HeroTopPosts } from "@/server/discovery/hero";
import type { DiscoveryCard } from "@/server/discovery/list";
import type { PricePoint } from "@/server/discovery/price-series";

import { PriceSparkline } from "./PriceSparkline";
import { StatLine } from "./StatLine";

/**
 * The OQ-6 per-side empty copy (web-authored, VERBATIM — never re-typed in
 * tests). Rendered whenever a side has no eligible hero post, for ANY reason
 * — the copy is identical whether the side has zero posts or masked ones, so
 * it can never hint hidden content exists (F-DISC-2 safety posture).
 */
export const HERO_SIDE_EMPTY = {
	YES: "No YES posts yet",
	NO: "No NO posts yet",
} as const;

/**
 * The design-language §3.2 hero: three panels — **top-YES post · market
 * (image + question · two-line graph · price bar · stat line) · top-NO
 * post** — consuming the Slice-3 lean `HeroTopPosts` DTO. A hero-post click
 * deep-links `/m/[slug]?post=N` (the built A2 ordinal link, OQ-4 A); the
 * author pseudonym links to their profile (`/u/[pseudonym]`, activated at
 * UI.A5 — the A4 follow-up #2). A null side renders the OQ-6 empty copy, never
 * a placeholder post.
 */
export function HeroPanels({
	card,
	series,
	topPosts,
}: {
	card: DiscoveryCard;
	series: PricePoint[];
	topPosts: HeroTopPosts;
}) {
	return (
		<div
			data-testid="hero-panels"
			className="grid gap-[14px] md:grid-cols-[1fr_1.9fr_1fr]"
		>
			<HeroPostPanel side="YES" post={topPosts.yes} slug={card.slug} />

			<div className="flex flex-col rounded-[var(--r)] bg-n0 px-4 pt-[14px] pb-3 [border:1px_solid_var(--color-n3)]">
				<div className="flex items-center gap-3">
					{card.imageUrl === null ? (
						<div
							aria-hidden="true"
							className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[8.5px] tracking-[0.16em] text-n4"
						>
							IMG
						</div>
					) : (
						// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 GET URL, not a static asset — plain <img> per the CommentImage precedent.
						<img
							src={card.imageUrl}
							alt={card.title}
							className="h-[54px] w-[54px] shrink-0 rounded-[var(--imgr)] object-cover"
						/>
					)}
					<div className="flex min-w-0 flex-col gap-1">
						<h2 className="truncate text-[16.5px] leading-[1.3] font-bold">
							{card.title}
						</h2>
						<StatLine totals={card.totals} size="hero" />
					</div>
				</div>
				<div className="mt-[11px] h-24 rounded-[var(--r)] [border:var(--hairline)]">
					<PriceSparkline series={series} size="hero" />
				</div>
				<div className="mt-[9px]">
					<PriceBar pricing={card.pricing} size="hero" />
				</div>
			</div>

			<HeroPostPanel side="NO" post={topPosts.no} slug={card.slug} />
		</div>
	);
}

/** One side's hero post panel — or the OQ-6 empty copy when none eligible. */
function HeroPostPanel({
	side,
	post,
	slug,
}: {
	side: "YES" | "NO";
	post: HeroPost | null;
	slug: string;
}) {
	if (post === null) {
		return (
			<div
				data-testid="hero-side-empty"
				data-side={side}
				className="flex items-center justify-center rounded-[var(--r)] bg-n0 p-4 text-xs text-muted-foreground [border:1px_solid_var(--color-n3)]"
			>
				{HERO_SIDE_EMPTY[side]}
			</div>
		);
	}

	return (
		// `relative` is load-bearing for V18's stretched link below.
		<div
			data-testid="hero-post"
			data-side={side}
			className="relative flex flex-col rounded-[var(--r)] bg-n0 px-3 pt-3 pb-[11px] [border:1px_solid_var(--color-n3)]"
		>
			<div className="flex flex-nowrap items-center gap-1.5 overflow-hidden text-[9.5px] whitespace-nowrap">
				<Avatar size="xs">
					<AvatarImage src={post.author.pfpUrl} alt="" />
					<AvatarFallback>
						{post.author.pseudonym.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{/* A4 follow-up #2 (UI.A5) — the author pseudonym links to their
				    profile. A SIBLING of the card-body deep-link below, NEVER nested
				    (nested <a> is invalid HTML). `relative z-10` lifts it above the
				    sibling's stretched ::after so it stays independently clickable —
				    the mockup's harness excludes `.pseud` from the body click the
				    same way (surface_discovery_v1_0.html:404). */}
				<Link
					data-testid={`hero-author-link-${side}`}
					href={`/u/${encodeURIComponent(post.author.pseudonym)}`}
					className="relative z-10 font-[650] hover:underline"
				>
					{post.author.pseudonym}
				</Link>
				<SideBadge side={post.side} size="hero" price={post.entryPrice} />
				<span className="font-mono text-n6">
					Đ {formatDharma(post.authorStake)}
				</span>
			</div>
			{/* V18 — the WHOLE panel is the post's click target, matching the
			    mockup's `.argbody[data-post]` handler. Implemented as a stretched
			    link (`after:inset-0` against the panel's `relative`) rather than by
			    wrapping the panel, because the author link above must remain a
			    separate target and anchors cannot nest. */}
			<Link
				href={`/m/${slug}?post=${post.ordinal}`}
				className="mt-2 flex flex-col gap-1 after:absolute after:inset-0"
			>
				<h3 className="line-clamp-2 text-sm leading-snug font-medium">
					{post.title}
				</h3>
				{post.teaser !== "" && (
					<p className="line-clamp-3 text-xs leading-snug text-muted-foreground">
						{post.teaser}
					</p>
				)}
			</Link>
		</div>
	);
}
