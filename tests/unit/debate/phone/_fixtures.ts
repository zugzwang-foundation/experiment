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
	/**
	 * ⚠ PER-POST BY DEFAULT, and that is a discrimination property rather than
	 * decoration. With one pseudonym on every post, an assertion on the composer's
	 * reply header (`Support <author>'s argument`) proves only that the composer
	 * opened against SOME post whose author is that name — a parent mix-up between
	 * two same-author posts would be invisible. Deriving it from the id makes the
	 * header name WHICH post.
	 * ⛔ Still not invented content: the shapes are the identity-pool's own
	 * (`<Colour><Animal><NNN>`), the same family the shipped fixtures use.
	 */
	pseudonym?: string;
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
		author: {
			pseudonym:
				over.pseudonym ?? `AmberFinch${String(over.ordinal).padStart(3, "0")}`,
			pfpUrl: "/pfp-placeholder.svg",
		},
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
 * ⚠⚠ THE REASON THIS COMMENT FIRST GAVE WAS FALSE, and it is corrected rather
 * than deleted because the wrong premise is the interesting part. It said vitest
 * "shares a jsdom instance across the files in a worker", which would make the
 * idempotence guard load-bearing. `vitest.config.ts:33-34` sets `isolate: true`
 * and `pool: "forks"`, so every test file gets its OWN process and its own
 * jsdom, and the stub cannot cross — measured with a probe file run alongside
 * all three callers, which read `Element.prototype.scrollTo typeof: undefined`.
 * ⇒ The `if` is cheap belt, not a race guard. What IS load-bearing is the
 * assignment itself: jsdom defines `window.scrollTo` but ships NO own descriptor
 * for `scrollTo` on `Element.prototype` or `HTMLElement.prototype`, so the
 * branch is genuinely taken and the track's tab-to-pane sync would throw on
 * mount without it. A future reader deciding whether to delete this would have
 * reasoned from the wrong half.
 */
export function stubElementScroll(): void {
	if (typeof Element.prototype.scrollTo !== "function") {
		Element.prototype.scrollTo = () => undefined;
	}
}
