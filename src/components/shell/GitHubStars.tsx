import { Star } from "lucide-react";

import { GITHUB_REPO_URL } from "@/server/github/star-count";

/**
 * The header's GitHub control (GH-STAR) — a link to the repo carrying its live
 * star count. Left zone, after Radio, in the same utility-control idiom as
 * Back · Home · Radio · RULES, so the destination reads as part of the chrome
 * rather than as an ad. Server component, zero client JS.
 *
 * ⛔ THE COUNT SLOT EXISTS OR IT DOES NOT — it is never a placeholder. `0` is a
 * real value and renders as `0`; a failed read renders the label alone, with no
 * count node in the DOM at all. The branch is `stars === null`, never `!stars`:
 * `0` is falsy, so a truthiness check reports a read failure on the exact count
 * this repo has today, and would have shipped looking correct.
 *
 * This is why `VisitorCounter`'s P5 dash is deliberately NOT copied here. That
 * counter has a loading state and a fallback that must occupy the same width, so
 * a dash is the honest glyph. This control has neither: it resolves on the
 * server before first paint, and an absent count is better read as "no number
 * offered" than as an em-dash a viewer has to interpret. `data-state` carries
 * the distinction for anything that needs to tell them apart.
 *
 * ⛔ THIS COMPONENT IS SYNC AND TAKES `stars` AS A PROP. IT DOES NOT FETCH.
 * There was an async wrapper here that called `readStarCount()` itself, and it
 * was removed rather than kept beside this one, because leaving it would leave a
 * loaded gun: mounting it in the header again silently re-breaks
 * `tests/unit/shell/dharma-cluster.test.tsx` and every future header render
 * test.
 *
 * The reason is a property of the test harness, not of RSC. React's client
 * renderer refuses an async function component outright — *"`<GitHubStars>` is
 * an async Client Component"* — and this repo has no RSC test harness, so an
 * async child anywhere in the header's tree makes the WHOLE header unrenderable
 * in jsdom. Not the child: the header. The one test that renders `GlobalHeader`
 * produced `<body><div /></body>` and lost three assertions about nodes on the
 * far side of the header from this one.
 *
 * ⇒ The await belongs in the layouts, which are already async and already do
 * exactly this for `portfolio` and `spendable`. The count still resolves on the
 * server before first paint, so nothing about the render is deferred — only the
 * place the promise is awaited moved, and it moved to where this header already
 * keeps its other server-fetched values.
 */

/**
 * `RadioSlot`'s box — 34px register, `px-3`, `gap-2`, hairline, `--btn-fill` —
 * carrying `RulesControl`'s interactive states, because Radio is a disabled slot
 * and this is a live link. Type register is RULES' (12px / .1em / `text-ink`,
 * founder-ruled at OD-1): `text-ink` is this repo's enabled-control colour and a
 * link is an enabled control. Colour is `currentColor` throughout — no literal.
 *
 * ⚠ `shrink-0` is load-bearing, not habit. Every left-zone control carries it,
 * which makes the zone a hard-overflow budget rather than a compression budget:
 * the header's `1fr auto 1fr` grid keeps the brand cluster centred only while
 * neither side zone exceeds its track, and nothing here will quietly squeeze to
 * stay inside. See `GlobalHeader`'s deviation register for the measurement.
 */
const GITHUB_TAB =
	"inline-flex h-[34px] shrink-0 items-center gap-2 rounded-(--r) bg-(--btn-fill) px-3 text-[12px] leading-[1.2] font-bold tracking-[0.1em] text-ink uppercase outline-none select-none [border:var(--hairline)] [transition:all_var(--dur-hover)] hover:[border:1px_solid_var(--ring)] active:bg-(--state-pressed-fill) focus-visible:shadow-(--state-focus-ring) [&_svg]:size-[15px]";

/** The aria-label's figure: exact, grouped, never abbreviated. */
const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

const COMPACT_FORMAT = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumFractionDigits: 1,
});

/**
 * The on-screen count (GH-STAR-COMPACT, founder-ruled 2026-08-19, reversing the
 * grouped notation this control shipped with) — compact at or above 1,000,
 * exact below it. That threshold is GitHub's own, matched deliberately: this
 * control quotes a GitHub number, and a reader who clicks through has to find
 * the same shape on the other side of the link.
 *
 *   `0` → `0` · `847` → `847` · `1234` → `1.2k` · `54321` → `54.3k` ·
 *   `999999` → `1m`
 *
 * `Intl` rather than a hand-rolled divide-and-round: it already owns the locale,
 * the k/m/b thresholds and the fraction-digit rule, none of which are worth
 * reimplementing here. Lowercased HERE, at the formatter, because `Intl` emits
 * `K`/`M` and GitHub renders `k` — the view below says why CSS cannot be the
 * thing that does it.
 *
 * ⚠ IT ROUNDS, AND THE ROUNDING CROSSES MAGNITUDE BOUNDARIES. This is the part
 * that reads as a defect on sight: `999999` renders `1m`, so a repo one star
 * short of a million advertises a million, and `99999` renders `100k`. It is
 * half-expand at one fraction digit, so the turn sits at `.5` of the leading
 * unit — `1949` → `1.9k`, `1950` → `2k`. Correct and deliberate, not a
 * fraction-digit misconfig; `tests/unit/shell/github-stars.test.tsx` pins the
 * `1949`/`1950` pair so the boundary cannot drift in silence.
 *
 * ⚠ The task that ruled this stated the opposite mechanism — that `Intl`
 * TRUNCATES, and that `1999` renders `1.9k`. It renders `2k`. The claim is not
 * merely wrong on the pinned runtime (Node 24 / ICU 78, measured); it is
 * self-refuting against the ruling's own examples on ANY runtime, because the
 * only config that truncates is `roundingMode: "trunc"` and that turns `999999`
 * into `999.9k`, contradicting the ruled `1m`. The five ruled OUTPUTS are what
 * ship — they are exactly what this config produces — and the mechanism written
 * above is the measured one.
 */
function formatStarCount(stars: number): string {
	return COMPACT_FORMAT.format(stars).toLowerCase();
}

/**
 * The pure view. DOM text is `GitHub`; `uppercase` is its rendering, per the
 * repo's copy-register split. The count opts back out of the tab's type with
 * `normal-case tracking-normal` — letter-spacing on digits reads as a defect.
 *
 * ⛔ `normal-case` IS LOAD-BEARING NOW, AND NO `textContent` ASSERTION CAN GUARD
 * IT. It used to be housekeeping — digits carry no case, so the tab's
 * `uppercase` had nothing to act on. Compact notation hands it a suffix: drop
 * `normal-case` and the tab renders `1.2K`, undoing at the CSS layer the
 * lowercasing the formatter just did. `text-transform` never touches
 * `textContent`, so every assertion in this repo's jsdom harness would still
 * read `1.2k` and stay green while the header shipped the wrong glyph. That is
 * why the class is asserted as a CLASS, and why the lowercasing lives at the
 * formatter rather than in this class string.
 */
export function GitHubStarsView({ stars }: { stars: number | null }) {
	const label =
		stars === null
			? "Zugzwang on GitHub (opens in a new tab)"
			: `Zugzwang on GitHub — ${NUMBER_FORMAT.format(stars)} ${
					stars === 1 ? "star" : "stars"
				} (opens in a new tab)`;

	return (
		<a
			href={GITHUB_REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			data-testid="github-stars"
			data-state={stars === null ? "unavailable" : "value"}
			aria-label={label}
			title="Star the repo on GitHub"
			className={GITHUB_TAB}
		>
			<Star aria-hidden="true" />
			<span>GitHub</span>
			{stars === null ? null : (
				<span
					data-testid="github-stars-count"
					className="tracking-normal normal-case tabular-nums"
				>
					{formatStarCount(stars)}
				</span>
			)}
		</a>
	);
}
