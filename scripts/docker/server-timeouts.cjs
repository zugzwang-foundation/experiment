// Preloaded by the runner image: `node --require ./server-timeouts.cjs server.js`.
//
// Next's standalone `server.js` reads KEEP_ALIVE_TIMEOUT and sets
// `server.keepAliveTimeout` — and nothing else. Node's `headersTimeout` stays at
// its 60 s default, which would then sit BELOW a 65 s keep-alive: a request
// whose headers arrive at the boundary is cut mid-parse. Node offers no env for
// it, so this wraps `http.createServer` once and sets it 5 s above keep-alive
// on every server the process creates. Without KEEP_ALIVE_TIMEOUT it does
// nothing at all, so a local `next start` is unchanged (AWS-MIGRATION-3).
"use strict";
const http = require("node:http");

const raw = process.env.KEEP_ALIVE_TIMEOUT;
const keepAliveTimeout =
	raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

// Ceiling: Node silently uses 1 ms for a timer above 2^31-1 ms (with only a
// TimeoutOverflowWarning), the opposite of the intent. 10 minutes is far above
// any load balancer idle timeout and far below the overflow.
const MAX_KEEP_ALIVE_MS = 600_000;
if (Number.isFinite(keepAliveTimeout) && keepAliveTimeout > 0) {
	// CLAMP rather than skip: Next's server.js applies KEEP_ALIVE_TIMEOUT on its
	// own, so skipping here would recreate the keep-alive > headers inversion
	// this file exists to prevent, silently.
	const effective = Math.min(keepAliveTimeout, MAX_KEEP_ALIVE_MS);
	if (effective !== keepAliveTimeout) {
		process.stderr.write(
			`server-timeouts: KEEP_ALIVE_TIMEOUT=${keepAliveTimeout} clamped to ${MAX_KEEP_ALIVE_MS}\n`,
		);
	}
	const HEADERS_MARGIN_MS = 5000;
	const createServer = http.createServer;
	http.createServer = function patchedCreateServer(...args) {
		const server = createServer.apply(this, args);
		server.keepAliveTimeout = effective;
		server.headersTimeout = effective + HEADERS_MARGIN_MS;
		return server;
	};
}
