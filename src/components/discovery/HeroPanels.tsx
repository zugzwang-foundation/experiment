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
 * author pseudonym is NON-linked v1 (OQ-4 A — Profile is a later surface).
 * A null side renders the OQ-6 empty copy, never a placeholder post.
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
			className="grid gap-4 md:grid-cols-[1fr_1.2fr_1fr]"
		>
			<HeroPostPanel side="YES" post={topPosts.yes} slug={card.slug} />

			<div className="flex flex-col gap-3 rounded-[var(--r)] bg-n0 p-4 [border:var(--hairline)]">
				<div className="flex items-start gap-3">
					{card.imageUrl === null ? (
						<div
							aria-hidden="true"
							className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--imgr)] bg-n1 font-mono text-[10px] text-muted-foreground"
						>
							IMG
						</div>
					) : (
						// biome-ignore lint/performance/noImgElement: short-TTL presigned R2 GET URL, not a static asset — plain <img> per the CommentImage precedent.
						<img
							src={card.imageUrl}
							alt={card.title}
							className="h-16 w-16 shrink-0 rounded-[var(--imgr)] object-cover"
						/>
					)}
					<div className="flex min-w-0 flex-col gap-1">
						<h2 className="text-base font-medium leading-snug">{card.title}</h2>
						<StatLine totals={card.totals} />
					</div>
				</div>
				<div className="h-24">
					<PriceSparkline series={series} size="hero" />
				</div>
				<PriceBar pricing={card.pricing} />
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
				className="flex items-center justify-center rounded-[var(--r)] bg-n0 p-4 text-xs text-muted-foreground [border:var(--hairline)]"
			>
				{HERO_SIDE_EMPTY[side]}
			</div>
		);
	}

	return (
		<div
			data-testid="hero-post"
			data-side={side}
			className="flex flex-col gap-2 rounded-[var(--r)] bg-n0 p-4 [border:var(--hairline)]"
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<Avatar size="sm">
					<AvatarImage src={post.author.pfpUrl} alt="" />
					<AvatarFallback>
						{post.author.pseudonym.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				{/* NON-linked v1 (OQ-4 A) — plain text, no anchor ancestor. */}
				<span className="font-mono text-xs">{post.author.pseudonym}</span>
				<SideBadge side={post.side} />
				<span className="font-mono text-[11px] text-muted-foreground">
					Đ {formatDharma(post.authorStake)}
				</span>
			</div>
			<Link
				href={`/m/${slug}?post=${post.ordinal}`}
				className="flex flex-col gap-1"
			>
				<h3 className="text-sm font-medium leading-snug">{post.title}</h3>
				{post.teaser !== "" && (
					<p className="text-xs leading-snug text-muted-foreground">
						{post.teaser}
					</p>
				)}
			</Link>
		</div>
	);
}
