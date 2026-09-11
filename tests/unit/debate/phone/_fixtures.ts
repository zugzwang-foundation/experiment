import type {
	DebatePost,
	DebateReply,
	DebateViewModel,
	Side,
	ViewerMarketContext,
} from "@/components/debate/types";

import { mumbaiMetroModel as raw } from "../../../unit/debate-export/_fixtures/mumbai-metro.input";

/**
 * MOBILE-2 — fixtures for the phone tier's RENDER guards. Underscore-prefixed:
 * the vitest include glob is `tests/**\/*.{test,spec}.{ts,tsx}`, so this file is
 * never collected as a suite.
 *
 * ⛔ NO MARKET CONTENT IS INVENTED (CLAUDE.md §3). The model is the shipped
 * `mumbai-metro` export fixture with its slug corrected to one of BLOCK-1's
 * eight known markets — the same shadow `_posted-fixtures.ts` already performs,
 * and for the same reason: `ResolverCards` throws on an unknown slug, and
 * nothing in these suites is testing that throw.
 *
 * ⚠ THE ARGUMENT PROSE BELOW IS REUSED from the shipped composer suite's own
 * fixture strings (`payload.test.ts`), not authored here.
 */
const TITLE = "The base rate argument.";
const BODY = "The extended argument, first paragraph.";

export const PHONE_MODEL_BASE: DebateViewModel = {
	...raw,
	market: { ...raw.market, slug: "bitcoin-price-50k" },
};

export function post(over: {
	id: string;
	ordinal: number;
	side: Side;
	replies?: { support: DebateReply[]; counter: DebateReply[] };
}): DebatePost {
	return {
		removed: false,
		id: over.id,
		ordinal: over.ordinal,
		sideAtPostTime: over.side,
		createdAt: "2026-09-18T09:00:00.000Z",
		title: TITLE,
		teaser: "",
		body: BODY,
		imageUrl: null,
		marker: "none",
		badge: null,
		author: { pseudonym: "AmberFinch404", pfpUrl: "/pfp-placeholder.svg" },
		authorStake: "50.000000000000000000",
		authorStakeOriginal: "50.000000000000000000",
		authorSold: false,
		entryPrice: "0.470000000000000000",
		aggregate: {
			supportCount: over.replies?.support.length ?? 0,
			counterCount: over.replies?.counter.length ?? 0,
			supportDharma: "0.000000000000000000",
			counterDharma: "0.000000000000000000",
		},
		replies: {
			support: over.replies?.support ?? [],
			counter: over.replies?.counter ?? [],
			twoSlot: [],
		},
	};
}

export function reply(over: {
	id: string;
	side: Side;
	pseudonym: string;
}): DebateReply {
	return {
		removed: false,
		id: over.id,
		side: over.side,
		createdAt: "2026-09-18T10:00:00.000Z",
		body: BODY,
		marker: "none",
		author: { pseudonym: over.pseudonym, pfpUrl: "/pfp-placeholder.svg" },
		stake: "50.000000000000000000",
		stakeOriginal: "50.000000000000000000",
		sold: false,
		entryPrice: "0.470000000000000000",
		imageUrl: null,
	};
}

export function modelWith(
	posts: DebatePost[],
	over?: Partial<DebateViewModel["market"]>,
): DebateViewModel {
	return {
		...PHONE_MODEL_BASE,
		market: {
			...PHONE_MODEL_BASE.market,
			pricing: { yes: "0.100000000000000000", no: "0.900000000000000000" },
			...over,
		},
		posts,
	};
}

/** No held position; spendable comfortably above the post floor (10). */
export const VIEWER: ViewerMarketContext = {
	position: null,
	balance: "1000",
	spendableToday: "1000",
};

export function viewerHolding(side: Side): ViewerMarketContext {
	return {
		position: {
			side,
			quantity: "40.000000000000000000",
			currentValue: "52.000000000000000000",
		},
		balance: "1000",
		spendableToday: "1000",
	};
}

/**
 * jsdom implements no element scrolling at all — `Element.prototype.scrollTo` is
 * simply absent, so the track's tab→pane sync throws on mount. Stubbed rather
 * than guarded in the component: a `typeof track.scrollTo === "function"` test
 * in `src/` would be test-environment shape leaking into production code, and
 * the repo's precedent for exactly this is `auto-advance.test.tsx:71`.
 *
 * ⚠ Idempotent and prototype-level on purpose: vitest shares a jsdom instance
 * across the files in a worker, so a per-file assignment would either race or
 * clobber depending on collection order.
 */
export function stubElementScroll(): void {
	if (typeof Element.prototype.scrollTo !== "function") {
		Element.prototype.scrollTo = () => undefined;
	}
}
