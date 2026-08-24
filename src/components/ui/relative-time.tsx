import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

/**
 * **The relative timestamp leaf (TIME-1).** One plain text node saying how long
 * ago an argument was written, mounted at the end of the identity row on every
 * surface that renders a post or a reply.
 *
 * It marks itself `data-relative-time` — its OWN marker, never an override of
 * `data-slot` (`ui/loading-block.tsx` records the failure that minted that
 * rule). That marker is also what the placement guard selects on, because a
 * selector keyed on a styling class changes meaning the moment a neighbour is
 * restyled and does so silently.
 *
 * ⛔ **NO ABSOLUTE TIME REACHES THE DOM FROM HERE.** No `title`, no
 * `<time dateTime=…>`, no ISO string, no formatted calendar date, no tooltip.
 * The exact-instant-on-hover affordance was offered and ruled OUT by name, so
 * shipping it because it is semantic HTML and costs nothing would be shipping
 * an unratified feature. This renders a text node and an age, and nothing else.
 *
 * ⛔ **NOTHING MAKES IT TICK** — no timer, no interval, no
 * `requestAnimationFrame`, no subscription. A per-card ticker is N tickers on a
 * page with N cards, which is the cost this feature was scoped to avoid. Market
 * detail re-invokes its server read every `POLL_INTERVAL_MS_DEBATE_VIEW` and
 * re-renders this string for free; everywhere else the string is right at load
 * and stays as it was, which is accepted.
 *
 * ⚠⚠ **THERE IS DELIBERATELY NO `"use client"` HERE — BECAUSE THIS IS A SHARED
 * PRIMITIVE, NOT BECAUSE IT SAVES A BUNDLE.**
 *
 * ⛔ AN EARLIER VERSION OF THIS PARAGRAPH SAID THE OPPOSITE AND SAID IT AS A
 * MEASUREMENT. It claimed `discovery/HeroPanels.tsx` and
 * `profile/ArgumentList.tsx` were "both server components, measured", and that
 * omitting the directive meant "no client JavaScript ships at all" on those two
 * surfaces. **Both claims are false**, caught by `@code-reviewer` and confirmed
 * three ways: `HeroPanels` is imported only by `discovery/DiscoveryCarousel.tsx`
 * and `ArgumentList` only by `profile/ProfileArena.tsx`, and BOTH of those
 * carry `"use client"` on line 1 — so both cards are client-by-import and
 * always were, before this branch existed. The build agrees: `just now` and
 * `data-relative-time` appear in THREE client chunks, and one of them
 * (`0rzwuduj9u0-0.js`) carries `hero-reply-head` alongside them.
 *
 * What went wrong is worth keeping: the original "measurement" read each file's
 * OWN first line and never asked who imports it. A directive is a property of a
 * module's position in the graph, not of its text — O-2, and O-3, since the
 * conclusion was right for a stated reason that was not the real one.
 *
 * ⇒ **THE REAL REASON THE DIRECTIVE IS ABSENT.** A component in `ui/` with no
 * directive is a SHARED component: it compiles into whichever graph imports it.
 * That is the correct shape for a cross-surface presentational primitive, and
 * it is exactly why `debate/badges.tsx` — imported by client modules
 * (`PostCard`, `dialogs`, `SellModule`) and by shared ones (`HeroPanels`,
 * `ArgumentList`, `DebateColumn`) alike — carries none either. Pinning the
 * directive on would fix this leaf to the client graph for no gain today, and
 * would be actively wrong the day any host becomes a true Server Component.
 *
 * ⚠ IF `cacheComponents` IS EVER TURNED ON, this leaf is the thing to revisit,
 * and `"use client"` is NOT the remedy — a client component still runs its body
 * during the prerender pass, so the directive exempts nothing. The remedy is to
 * defer the clock read past prerender (a mount-time read) and/or put the
 * subtree behind Suspense. ⛔ Still never a timer. *(An earlier version of this
 * sentence named the directive as half the fix; it is not — `@code-reviewer`
 * M-2. Re-verify against the Next version in play before acting on it.)*
 *
 * ⚠ `suppressHydrationWarning` IS LOAD-BEARING ON EVERY SURFACE. The leaf
 * renders twice everywhere — once during SSR on the server clock, once during
 * hydration on the reader's — and two clocks a second apart can land on
 * opposite sides of a bucket edge (59 s vs 61 s). That is a text mismatch React
 * would otherwise report, on correct output. ⛔ THIS TOO ONCE READ "AND ONLY ON
 * MARKET DETAIL", which followed from the false premise above and would have
 * told the next reader that Discovery and Profile could safely drop it. They
 * cannot. It suppresses the warning only; it renders no attribute and changes
 * nothing about what the reader sees.
 */
export function RelativeTime({
	createdAt,
	className,
}: {
	/** The ISO instant the argument was written — `comments.created_at`, already
	 * on every read model that reaches a card. Never re-fetched, never widened. */
	createdAt: string;
	/**
	 * SIZE ONLY, and only where the row's siblings state one. The three
	 * identity rows this mounts on run at three different sizes — `text-xs`
	 * (`debate/ArgProfile`), `text-[9.5px]` (`discovery/HeroPanels`) and
	 * sibling-declared `text-xs` (`profile/ArgumentList`) — so a size baked in
	 * here would be wrong on two of the three. The TREATMENT is not a caller's
	 * to choose: `text-n5` below is `--muted-foreground` and `--text-meta`
	 * resolved (`globals.css:64`, `:189`), i.e. the token these rows' muted
	 * fields already carry, and one treatment across every card is the ruling.
	 */
	className?: string;
}) {
	return (
		<span
			data-relative-time=""
			className={cn("text-n5", className)}
			suppressHydrationWarning
		>
			{formatRelativeTime(Date.now(), Date.parse(createdAt))}
		</span>
	);
}
