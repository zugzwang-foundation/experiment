// Shared pieces for the write scripts: the signed-in session pool and
// idempotency keys.
//
// The pool is a JSON array of `{ userId, email, cookie }` minted by
// `tests/staging/mint-bet-sessions.staging.test.ts`. That runner writes real
// users into the staging database and refuses any other target, which is one
// of the reasons the write scripts are staging-only (see `target.js`).
// ⛔ The file holds live session cookies. It is gitignored; never commit it.

import { SharedArray } from "k6/data";

export function loadSessionPool() {
	const path = __ENV.SESSION_POOL_PATH;
	if (!path) {
		throw new Error(
			"REFUSED — SESSION_POOL_PATH is not set (mint it with tests/staging/mint-bet-sessions.staging.test.ts)",
		);
	}
	return new SharedArray("sessions", () => JSON.parse(open(path)));
}

/** Unique per request, within the `[A-Za-z0-9_-]{1,255}` the endpoint accepts. */
export function idempotencyKey(tag) {
	return `k6-${tag}-${Date.now()}-${__VU}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isSuccess(res) {
	return res.status === 200 || res.status === 201;
}
