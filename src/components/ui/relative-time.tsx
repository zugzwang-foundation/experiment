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
 * ⚠⚠ **THERE IS DELIBERATELY NO `"use client"` HERE, AND THE RULING IT SERVES
 * IS THE REASON.** The rule this leaf exists for is that a card must not become
 * a client component: marking `discovery/HeroPanels.tsx` or
 * `profile/ArgumentList.tsx` — both server components, measured — would convert
 * a whole server-rendered card tree per surface for one text node. Putting the
 * directive HERE instead of on the card satisfies that. Putting it NOWHERE
 * satisfies it too, and costs less:
 *
 * · On Discovery and Profile this renders as a **Server Component**. The routes
 *   are dynamic (`force-dynamic` on `(public)/page.tsx`; the profile page reads
 *   `headers()` and records itself "UNCACHED / dynamic v1"), so the server
 *   clock IS the reader's load time to within transit, and **no client
 *   JavaScript ships at all** for a string that never changes after load.
 * · On market detail it compiles into the client graph anyway, because
 *   `DebateView` is `"use client"` and everything under it is client-by-import
 *   — exactly as `debate/badges.tsx` already is, which the same three surfaces
 *   share the same way.
 *
 * ⇒ The directive would buy nothing on the two surfaces where it would cost
 * something. If a future `cacheComponents` retrofit ever caches these routes,
 * this leaf becomes the thing to revisit — and the revisit is `"use client"`
 * plus a mount-time re-read, not a timer.
 *
 * ⚠ `suppressHydrationWarning` IS LOAD-BEARING, AND ONLY ON MARKET DETAIL.
 * There the leaf renders twice — once during SSR on the server clock, once
 * during hydration on the reader's — and two clocks a second apart can land on
 * opposite sides of a bucket edge (59 s vs 61 s). That is a text mismatch React
 * would otherwise report, on correct output. It suppresses the warning only;
 * it renders no attribute and changes nothing about what the reader sees.
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
