import { deriveReplySide } from "@/components/debate/composer/gating";
import {
	computeSplitBar,
	displaySplitTotal,
} from "@/components/debate/composer/split-bar";
import {
	formatDharma,
	formatPercentUnpaired,
	formatPricePercent,
} from "@/components/debate/format";
import {
	getResolutionBlocks,
	isKnownMarketSlug,
} from "@/components/debate/resolution-block-data";
import { formatCountdown } from "@/components/shell/countdown-format";
import type { Badge } from "@/lib/ranking";
import { formatRelativeTime } from "@/lib/relative-time";
import type { DebateViewModel } from "@/server/debate-view/load-debate-view";
import type { PricePoint } from "@/server/discovery/price-series";
import { FREEZE_INSTANT_UTC } from "@/server/markets/create";
import type { Marker } from "@/server/positions/compute";

type Side = "YES" | "NO";

/**
 * Everything the PNG composition paints, already formatted for display.
 *
 * This is the SAME data the page renders — one `DebateViewModel`, one post —
 * mapped through the SAME formatters the cards use (`formatDharma`,
 * `formatPricePercent`, `computeSplitBar`, `formatRelativeTime`), so a figure
 * on the export cannot disagree with the figure on screen. The composition
 * itself (`MarketPostExport.tsx`) receives only strings and numbers: it never
 * touches the view model, so a change to the model's shape lands here, in one
 * pure function with a unit test, and not in the renderer.
 */
export type PostExportProps = {
	width: number;
	height: number;
	market: {
		slug: string;
		/**
		 * The market's TOPIC — `Math`, `YCombinator`, `Bitcoin` — lifted off the
		 * front of the title and rendered as its own chip beside the flavour
		 * (operator ruling, revision 5). `null` for a title that carries no
		 * topic prefix, which the fixture market is and which is what makes the
		 * split's negative branch a tested one rather than a hypothetical.
		 */
		category: string | null;
		/**
		 * The QUESTION alone — the title with its topic prefix removed. Every one
		 * of the eight live titles is `<Topic> · <question>`; a title without
		 * that shape passes through whole.
		 */
		title: string;
		/** The Discovery card's image — the `is_default` `market_media` row. */
		thumbUrl: string | null;
		yesPct: string;
		noPct: string;
		/** The YES share of the price bar, 0–100 — a display width, never money. */
		yesBarPct: number;
		/**
		 * The market's flavour — `Innovation`, `Pressure`, … — the single chip
		 * on the market card. Read from the ratified per-slug register, never
		 * invented, and `null` for a slug outside the eight.
		 */
		flavour: string | null;
		/**
		 * Everything staked on this market, through `formatDharma` — the middle
		 * of the YES / NO bar, answering for the market the question the post's
		 * own bar already answered for the post.
		 *
		 * ⚠ THE EXACT SUM, NOT A DISPLAYED-SPACE ONE. `displaySplitTotal` exists
		 * because the post's bar prints its two operands beside the total and the
		 * three must add up ON SCREEN (SPEC.1 §10.8). The market's bar prints
		 * PERCENTAGES on its flanks, not Đ figures, so there is no identity to
		 * preserve and the read model's own total is the honest number.
		 */
		staked: string;
	};
	post: {
		ordinal: number;
		pseudonym: string;
		initials: string;
		pfpUrl: string | null;
		side: Side;
		entryPct: string;
		marker: Marker;
		badge: Badge | null;
		stake: string;
		/** The struck-through original — only when it differs as rendered. */
		stakeOriginal: string | null;
		sold: boolean;
		replyCount: number;
		age: string;
		title: string;
		/**
		 * ⛔ THERE IS NO `body`, AND THE ABSENCE IS THE FEATURE.
		 *
		 * The post's argument text used to render under its title and was removed
		 * by operator ruling (revision 5): at export size it was three clamped
		 * lines of an argument nobody can finish reading, which is worse than no
		 * argument at all — it invites the reader to judge a case they have been
		 * shown a third of. The export says WHO staked WHAT, on WHICH side, with
		 * how the room answered; the argument itself is what the link is for.
		 *
		 * ⚠ IT IS DROPPED FROM THE PROPS RATHER THAN LEFT UNRENDERED, and that is
		 * an SC-1 decision (CLAUDE.md §5.14), not tidiness: a body that travels
		 * into a payload nothing paints is a body one careless `JSON.stringify`
		 * away from being published, and the masking check that would have to
		 * protect it lives three files back. `image-compose.test.ts` asserts the
		 * field's absence, so re-adding one reddens a test rather than quietly
		 * reintroducing the read.
		 */
		imageUrl: string | null;
		support: { side: Side; dharma: string };
		counter: { side: Side; dharma: string };
		splitTotal: string;
		/** Support's share of the split bar, 0–100 — a display width. */
		supportBarPct: number;
		/**
		 * Whether the post has any reply-bet stake at all.
		 *
		 * ⛔ CARRIED THROUGH RATHER THAN DERIVED FROM `supportBarPct`, because
		 * the two zeroes mean different things and only this one can tell them
		 * apart: `computeSplitBar` returns `0%` BOTH for "no reply-bets yet" and
		 * for "every reply-bet is a Counter". Rendered the same, an unargued post
		 * shows a bar filled end to end in the Counter side's colour — a picture
		 * that says the room rejected it, on a post nobody has answered. On the
		 * page the surrounding chrome disambiguates; in a shared image there is
		 * no chrome, which is why the flag has to travel.
		 */
		hasStake: boolean;
	};
	chart: { series: PricePoint[]; isOpen: boolean } | null;
	/**
	 * The Zugzwang mark as a data URI, or `null` when it could not be read.
	 *
	 * ⛔ FILLED BY THE RENDERER, NOT BY THIS MAPPER, and the asymmetry is
	 * deliberate rather than sloppy. This module is pure — it maps a view model
	 * to strings and touches no filesystem, which is what makes it unit-testable
	 * without a harness. The mark lives on disk, so `render.tsx` reads it in the
	 * same pass that inlines the avatar and the post image, and `composePostExport`
	 * emits `null` here exactly as it emits the RAW image URLs that pass get
	 * replaced. `null` degrades to the wordmark alone.
	 */
	logoUrl: string | null;
	/** When this JPEG was generated — `3 Sep 2026 · 01:14 UTC`. */
	generatedAt: string;
	/**
	 * `DD:HH:MM` to the conclusion freeze, from the SAME `formatCountdown` the
	 * global header ticks with and the SAME built `FREEZE_INSTANT_UTC` pin — so
	 * the number on a shared image and the number in the header cannot disagree
	 * about how much of the experiment is left.
	 */
	countdown: string;
};

/** 1200×700 at 2× — the 1200×630 social card plus the verification band. */
export const EXPORT_SCALE = 2;
export const EXPORT_WIDTH = 1200 * EXPORT_SCALE;
export const EXPORT_HEIGHT = 700 * EXPORT_SCALE;

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

/** `3 Sep 2026 · 01:14 UTC` — UTC, hand-formatted so no locale can move it. */
export function formatGeneratedAt(ms: number): string {
	const d = new Date(ms);
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mm = String(d.getUTCMinutes()).padStart(2, "0");
	return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

/**
 * The topic separator the eight live titles are written with — a MIDDLE DOT
 * (U+00B7) with a space either side, not a hyphen and not a bullet.
 */
const TITLE_SEPARATOR = " · ";

/**
 * `Math · Will 3 Erdős problems be solved by 5th November?` → its topic and
 * its question.
 *
 * ⛔ THE SPLIT LIVES HERE, NOT IN THE COMPOSITION, and that is the same rule
 * every other display string in this file follows: the renderer receives
 * finished strings and never parses one. A topic chip derived inside the JSX
 * would be a second place that knows what a title looks like, and the one that
 * nothing tests.
 *
 * ⚠ `indexOf`, SO ONLY THE FIRST SEPARATOR SPLITS. A question is free to
 * contain its own middle dot — `Bitcoin · Will BTC ever go below $60,000` is
 * one topic and one question however many dots follow, and splitting on the
 * last would hand the chip a sentence.
 *
 * ⚠ `at <= 0` COVERS TWO CASES WITH ONE COMPARISON: no separator at all
 * (`-1`), and a title that OPENS with one (`0`), which would otherwise mint an
 * empty chip. Both pass the title through untouched, which is the safe
 * direction — a missing chip loses a word, a wrong split loses the question.
 */
export function splitMarketTitle(title: string): {
	category: string | null;
	question: string;
} {
	const at = title.indexOf(TITLE_SEPARATOR);
	if (at <= 0) {
		return { category: null, question: title };
	}
	return {
		category: title.slice(0, at),
		question: title.slice(at + TITLE_SEPARATOR.length),
	};
}

function pctNumber(pct: string): number {
	const n = Number.parseInt(pct, 10);
	return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}

/**
 * Map one post of a debate view to the export's props, or `null` when the
 * post is absent or REMOVED. A removed post has no body, title, author or
 * image at the type level (`DebatePost`'s masked variant), and this function
 * never reaches for them: the `removed` check is the only branch, and the
 * caller turns `null` into a 404. SC-1 (CLAUDE.md §5.14) — the test asserts
 * the removed post's body is absent from the OUTPUT, not merely that the row
 * was skipped.
 */
export function composePostExport(
	model: DebateViewModel,
	postId: string,
	nowMs: number,
	/**
	 * The Discovery thumbnail (`getDefaultMarketMediaUrl`) — read by the route
	 * beside the view, because the view model carries only the SECONDARY image
	 * the debate page's media panel shows, and the export wants the card's.
	 */
	thumbUrl: string | null,
): PostExportProps | null {
	const post = model.posts.find((p) => p.id === postId);
	if (post === undefined || post.removed) {
		return null;
	}
	const { market, priceChart } = model;

	const yesPct = market.pricing
		? formatPricePercent(market.pricing, "YES")
		: "—";
	const noPct = market.pricing ? formatPricePercent(market.pricing, "NO") : "—";

	const { category, question } = splitMarketTitle(market.title);

	const blocks = isKnownMarketSlug(market.slug)
		? getResolutionBlocks(market.slug)
		: null;

	const { supportPct, hasStake } = computeSplitBar({
		supportDharma: post.aggregate.supportDharma,
		counterDharma: post.aggregate.counterDharma,
	});
	const stake = formatDharma(post.authorStake);
	const original = formatDharma(post.authorStakeOriginal);

	return {
		width: EXPORT_WIDTH,
		height: EXPORT_HEIGHT,
		market: {
			slug: market.slug,
			category,
			title: question,
			thumbUrl,
			yesPct,
			noPct,
			yesBarPct: market.pricing ? pctNumber(yesPct) : 50,
			flavour: blocks?.flavour.line1 ?? null,
			staked: formatDharma(market.totals.dharmaStaked),
		},
		post: {
			ordinal: post.ordinal,
			pseudonym: post.author.pseudonym,
			initials: post.author.pseudonym.slice(0, 2).toUpperCase(),
			pfpUrl: post.author.pfpUrl,
			side: post.sideAtPostTime,
			// pctround-allow: the post's ENTRY price — the same single historical
			// value `badges.tsx` prints on the side chip, already scoped to the side
			// bought (`bets.price_at_bet` = `pEff` for that side), so the paired
			// formatter would print `100 - x` for a NO author. A point in time, not
			// one half of a live pair.
			entryPct: formatPercentUnpaired(post.entryPrice),
			marker: post.marker,
			badge: post.badge,
			stake,
			stakeOriginal: !post.authorSold && original !== stake ? original : null,
			sold: post.authorSold,
			replyCount: post.aggregate.supportCount + post.aggregate.counterCount,
			age: formatRelativeTime(nowMs, Date.parse(post.createdAt)),
			title: post.title,
			imageUrl: post.imageUrl,
			support: {
				side: deriveReplySide({
					parentSide: post.sideAtPostTime,
					relation: "support",
				}),
				dharma: formatDharma(post.aggregate.supportDharma),
			},
			counter: {
				side: deriveReplySide({
					parentSide: post.sideAtPostTime,
					relation: "counter",
				}),
				dharma: formatDharma(post.aggregate.counterDharma),
			},
			splitTotal: formatDharma(
				displaySplitTotal(
					post.aggregate.supportDharma,
					post.aggregate.counterDharma,
				),
			),
			supportBarPct: pctNumber(supportPct),
			hasStake,
		},
		chart:
			priceChart === null
				? null
				: { series: priceChart.series, isOpen: market.status === "Open" },
		logoUrl: null,
		generatedAt: formatGeneratedAt(nowMs),
		countdown: formatCountdown(nowMs, FREEZE_INSTANT_UTC.getTime()),
	};
}

/** `<market-slug>-post-<ordinal>.jpg` — deterministic, one name per post. */
export function exportFilename(slug: string, ordinal: number): string {
	return `${slug}-post-${ordinal}.jpg`;
}
