import type { DebatePost } from "./types";

/**
 * RPLY-1 · R2 — the CLIENT half of the `?post=<N>` deep-link resolution, for
 * the `popstate` path only.
 *
 * ⚠⚠ WHY THIS EXISTS AT ALL, STATED PLAINLY, BECAUSE A SECOND RESOLVER IS
 * NORMALLY THE WRONG ANSWER. The server's resolver is
 * `src/server/debate-view/resolve-post-param.ts`: it imports `server-only` and
 * takes a `DbClient`, so a browser `popstate` listener cannot call it — not by
 * preference, but because the module throws on import outside a React Server
 * Component and there is no database on the client to hand it. A back button
 * that lands on `?post=7` therefore has to resolve that 7 somehow, and the only
 * two options are "ask the server again" (a round trip on every history step)
 * or "resolve it against the model the client already holds".
 *
 * ⛔⛔ WHAT MAKES THE SECOND OPTION EXACT RATHER THAN A BYPASS. `ordinal` is
 * assigned in `load-debate-view.ts` as the 1-based rank by `(created_at, id)`
 * ascending over ALL top-level comments, **removed INCLUDED** — the SAME domain
 * in the SAME order as the server resolver's query, which is why the two are
 * pinned against each other by the round-trip integration test. A removed post
 * keeps its slot and carries its ordinal on BOTH union variants. So
 * `posts.find(p => p.ordinal === n)` returns exactly the row the server's
 * `offset(n - 1).limit(1)` would return. This is not an approximation of the
 * server's answer; it is the same ranking read from the payload the server
 * already computed.
 *
 * ⛔ AND IT IS STRICTLY SAFER THAN THE SERVER'S, not merely equal. The server
 * resolves an id and the PAGE then re-checks the model and the removed flag.
 * Here the removed variant carries no body, no title and no author AT THE TYPE
 * LEVEL (SC-1), so a masked target cannot leak content even if this gate were
 * wrong — there is nothing on the object to leak.
 *
 * ⇒ THE THREE REFUSALS BELOW MIRROR THE COLD ARRIVAL PATH ONE FOR ONE:
 * malformed shape · no such ordinal · removed target. All three fall back
 * SILENTLY to the market arm, exactly as `page.tsx` does. The param can never
 * 404 and never throws — the zero-branch law.
 */

/**
 * ⛔⛔ BYTE-IDENTICAL TO THE SERVER'S `POST_PARAM_SHAPE`, AND THE DUPLICATION IS
 * DELIBERATE RATHER THAN LAZY. The server file is `server-only`, so this cannot
 * import it; hoisting the constant into a shared module would mean editing that
 * file, which RPLY-1 may not do. ⚠ A copy that can drift is worse than no copy,
 * so drift is made IMPOSSIBLE TO SHIP rather than merely discouraged:
 * `post-param-parity.test.ts` reads both source files and fails unless these two
 * literals match character for character. O-1 — structural beats procedural.
 */
const POST_PARAM_SHAPE = /^[1-9][0-9]{0,4}$/;

/**
 * The shape gate: a 1-based ordinal, no leading zero, capped at 5 digits.
 * Anything else is the zero-branch.
 */
export function parsePostOrdinal(raw: string | null): number | null {
	if (raw === null || !POST_PARAM_SHAPE.test(raw)) {
		return null;
	}
	// Bounded ≤ 99999 by the gate above — a count, not Dharma, so a plain
	// integer parse is correct here and decimal.js would be noise.
	return Number.parseInt(raw, 10);
}

/**
 * Read the `?post=` param out of a URL's search string the way the SERVER sees
 * it.
 *
 * ⛔⛔ `getAll`, NOT `get`, AND THAT IS A REAL DIVERGENCE IT CLOSES. Next hands
 * the page `searchParams.post` as `string | string[]`, and `page.tsx` refuses
 * anything that is not a `string` — so a REPEATED param (`?post=1&post=2`)
 * arrives as an array and renders the plain market view. `URLSearchParams.get`
 * would instead return the FIRST value and happily resolve it, so the same URL
 * would focus a post on a back-navigation that it refuses on a cold load. One
 * of the two would have been wrong and neither would have complained.
 */
export function readPostParam(search: string): string | null {
	const all = new URLSearchParams(search).getAll("post");
	return all.length === 1 ? (all[0] ?? null) : null;
}

/**
 * Resolve a raw `?post=` value to a focusable post id, or `null` for the market
 * arm. `null` is returned for every refusal — there is no error channel,
 * because there is no state a participant could be in where this failing is
 * something they did.
 */
export function resolvePostParamClient(
	posts: readonly DebatePost[],
	raw: string | null,
): string | null {
	const ordinal = parsePostOrdinal(raw);
	if (ordinal === null) {
		return null;
	}
	const target = posts.find((p) => p.ordinal === ordinal);
	if (target === undefined) {
		return null;
	}
	// ⛔ THE REMOVED GATE, and it is the half a naive listener would skip. The
	// cold path refuses a removed target (`page.tsx`: `if (target && !
	// target.removed)`), so a back-navigation that focused one would reach a
	// state the server declines to serve — a masking bypass by another door.
	if (target.removed) {
		return null;
	}
	return target.id;
}
