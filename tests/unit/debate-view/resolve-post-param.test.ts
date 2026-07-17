import { describe, expect, it } from "vitest";
import type { DbClient } from "@/db";
// UI.A2 §9 slice 4 tests-first (plan §3.4 + §6) — the deep-link `?post=`
// resolver's validation gate. GREENFIELD module:
// `@/server/debate-view/resolve-post-param` is not built until the writer
// lands it → this file is RED at COLLECTION (module not found).
//
// Pure matrix, NO DB. Contract under test: `post` is validated against
// /^[1-9][0-9]{0,4}$/ — on mismatch the resolver returns `null` WITHOUT
// touching the client (no query). The tripwire Proxy throws on ANY property
// access, so a query attempt on the invalid branch rejects the promise and
// fails the `resolves.toBeNull()` assertion loudly. Regex-VALID shapes prove
// the complement: the query IS attempted (the tripwire fires) — the gate
// never over-rejects a real ordinal (ADR-0016 D6: the ordinal, never a raw
// UUID, is the participant-facing address).
import { resolvePostParam } from "@/server/debate-view/resolve-post-param";

const TRIPWIRE_MESSAGE = "client must not be touched for an invalid post param";

/** A client whose EVERY property access throws — proves zero client contact. */
function tripwireClient(): DbClient {
	return new Proxy(
		{},
		{
			get() {
				throw new Error(TRIPWIRE_MESSAGE);
			},
		},
	) as unknown as DbClient;
}

// Syntactically-plausible market id. Never dereferenced on the invalid branch
// (the whole point); on the valid branch the tripwire throws before it matters.
const MARKET_ID = "01977c2e-0000-7000-8000-000000000000";

// The regex-reject matrix (plan §3.4 + §6 zero-branch law).
const INVALID_POST_PARAMS: ReadonlyArray<[post: string, why: string]> = [
	["abc", "non-numeric"],
	["0", "zero — ordinals are 1-based"],
	["-1", "negative"],
	["1e9", "exponent notation"],
	["1.5", "decimal"],
	["", "empty string"],
	[" 1", "leading whitespace"],
	["01", "leading zero"],
	["100000", "6 digits — regex caps at 5"],
	["1 ", "trailing whitespace"],
	["NaN", "NaN literal"],
];

describe("resolvePostParam — §3.4 validation gate (pure, no DB)", () => {
	for (const [post, why] of INVALID_POST_PARAMS) {
		it(`resolve-post-param::rejects-${JSON.stringify(post)}-(${why})-null-without-client-touch`, async () => {
			await expect(
				resolvePostParam(tripwireClient(), { marketId: MARKET_ID, post }),
			).resolves.toBeNull();
		});
	}

	// Regex-VALID shapes: the resolver proceeds to its ONE ordered query — with
	// the tripwire client that attempt THROWS the tripwire message, proving the
	// client is touched exactly when (and only when) the shape is valid.
	for (const post of ["1", "99999"]) {
		it(`resolve-post-param::valid-shape-${post}-attempts-the-query`, async () => {
			await expect(
				resolvePostParam(tripwireClient(), { marketId: MARKET_ID, post }),
			).rejects.toThrow(TRIPWIRE_MESSAGE);
		});
	}
});
