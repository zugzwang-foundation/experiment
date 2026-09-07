// LIQ-1-RESTORE Part C — the reset's CONTENT-MARKET refusal.
// NEVER import this from src/**.
//
// ═══════════════════════════════════════════════════════════════════════════
// WHAT THIS GUARDS, AND WHY THE RESET NEEDED ONE AT ALL
//
// `markets` is in TRUNCATE_SET (`_lib/guards.ts`), so `pnpm staging:reset` —
// and therefore `pnpm staging:rebuild`, whose first step it is — empties it.
// For the fifteen `sp-m*` fixtures that is the entire point: they are literal
// rows in `fixtures.ts` and the generator rebuilds them in a minute.
//
// The eight CONTENT markets are not that. Their questions, criteria and
// settlement dates are the founder's (CLAUDE.md §3 makes inventing them a
// refusal trigger), they were authored directly against staging, and on
// 2026-09-07 a reset removed all eight. They were recoverable only because
// somebody had thought to commit `docs/data/staging-markets-snapshot.json`
// first. That is a near miss, not a control.
//
// So the reset now REFUSES when it finds a market it did not put there, and
// says which. The operator who genuinely means to drop them says so.
//
// ── WHY A PREFIX ALLOWLIST AND NOT A CONTENT DENYLIST ──────────────────────
// The predicate asks "is this one of MINE?", not "is this one of the eight?".
// A denylist naming the eight slugs would pass silently the day a ninth
// market is authored — the exact failure again, on content that has no
// snapshot yet because nobody has written one. An allowlist fails the other
// way: a new fixture family with an unrecognised prefix stops the reset until
// somebody looks. Refusing to destroy is the cheap error.
//
// ⚠ `volume-fixture-` MATCHES NOTHING TODAY — measured 2026-09-07,
// `git grep volume-fixture` returns zero. It is kept because the LIQ-1-RESTORE
// kickoff names it as a fixture family, and an allowlist entry that matches
// nothing costs nothing while a missing one costs a refused reset. Recorded as
// unmatched rather than quietly dropped, so a reader is not left believing
// this file has seen such a slug.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Slug prefixes the reset owns. Everything else is somebody's content.
 *
 * `sp-m` is the STAGING-PARITY fixture family (`sp-m1-draft` … `sp-m16-fill`,
 * `tests/staging/fixtures.ts`) — the `LIKE 'sp-m%'` of the kickoff's predicate.
 */
export const FIXTURE_SLUG_PREFIXES: readonly string[] = [
	"sp-m",
	"volume-fixture-",
];

/**
 * The acknowledgement that lets the reset take content markets with it.
 *
 * A TOKEN, not a boolean, for the reason every other guard in this directory
 * uses one: `=1` and `=true` arrive by accident — a stale export, a copied
 * shell line, a CI matrix var — and a value nobody types by mistake does not.
 * `--include-content-markets` in the kickoff is spelled this way because the
 * reset is a Vitest runner and a flag has no way in.
 */
export const CONTENT_MARKET_OVERRIDE_ENV =
	"ZUGZWANG_STAGING_INCLUDE_CONTENT_MARKETS";
export const CONTENT_MARKET_OVERRIDE_VALUE = "include-content-markets";

/** True when `slug` belongs to a fixture family the reset created. */
export function isFixtureSlug(slug: string): boolean {
	return FIXTURE_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix));
}

/** The slugs in `slugs` that no fixture family claims, in input order. */
export function contentMarketSlugs(
	slugs: readonly string[],
): readonly string[] {
	return slugs.filter((slug) => !isFixtureSlug(slug));
}

export type ContentMarketVerdict =
	| {
			readonly ok: true;
			readonly overridden: boolean;
			readonly found: readonly string[];
	  }
	| {
			readonly ok: false;
			readonly reason: string;
			readonly found: readonly string[];
	  };

/**
 * Decide whether a reset may proceed given the market slugs it is about to
 * destroy.
 *
 * Pure: takes the slug list and the override value rather than reading a
 * database or `process.env`, so the whole decision is unit-testable with a
 * mocked `markets` table and no global mutation — the `resolveStagingTarget`
 * shape this directory already uses.
 *
 * FAILS CLOSED: an override set to anything other than the exact token is not
 * an override. A typo'd acknowledgement must refuse, not proceed.
 */
export function assessContentMarkets(args: {
	readonly slugs: readonly string[];
	readonly override: string | undefined;
}): ContentMarketVerdict {
	const found = contentMarketSlugs(args.slugs);
	if (found.length === 0) {
		return { ok: true, overridden: false, found };
	}
	if (args.override === CONTENT_MARKET_OVERRIDE_VALUE) {
		return { ok: true, overridden: true, found };
	}
	return {
		ok: false,
		found,
		reason:
			`REFUSED — the reset would destroy ${found.length} market(s) it did not create:\n` +
			found.map((slug) => `  · ${slug}`).join("\n") +
			"\n\nThese are CONTENT markets. Their copy is founder-authored and the " +
			"repository is not their source — a reset removed the last eight on " +
			"2026-09-07 and they were only recoverable because " +
			"docs/data/staging-markets-snapshot.json had been committed first.\n\n" +
			"If you mean to drop them, say so:\n" +
			`  ${CONTENT_MARKET_OVERRIDE_ENV}=${CONTENT_MARKET_OVERRIDE_VALUE} pnpm staging:reset\n\n` +
			"To put them back afterwards:\n" +
			"  pnpm exec tsx scripts/seed-content-markets.ts --env staging --create\n" +
			"  pnpm exec tsx scripts/seed-content-markets.ts --env staging --open --price 0.1 --tank 100000",
	};
}
