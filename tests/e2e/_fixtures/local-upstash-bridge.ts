// A local stand-in for the Upstash REST API, backed by a REAL local Redis
// instance (started via `redis-server`, not Docker). Exists because this
// app's idempotency-key check fails CLOSED when Redis is unreachable
// (ADR-0015, deliberately — it's what stops a double-charge on a retried
// request), which means the "point Redis at an unreachable address" trick
// (safe for rate-limiting, which fails open) silently breaks every
// SUCCESSFUL bet placement, not just protects the shared rate-limit budget.
//
// This is a thin, generic protocol translator — not a Redis reimplementation.
// @upstash/redis's client sends `POST <baseUrl>/` with body = a raw command
// array (e.g. ["SET","key","value","EX","60"]), or `POST <baseUrl>/pipeline`
// with body = an array of command arrays. Both are forwarded verbatim to
// real Redis via the standard `redis` client's low-level `sendCommand`,
// which executes whatever RESP command it's given — so this shim never
// needs command-specific logic; it just relays.
//
// Only ever talks to a REAL LOCAL Redis (127.0.0.1) — never staging/prod.

import { createServer } from "node:http";
import { createClient } from "redis";

const PORT = Number(process.env.LOCAL_UPSTASH_BRIDGE_PORT ?? 8079);
const REDIS_URL = process.env.LOCAL_REDIS_URL ?? "redis://127.0.0.1:6379";

async function main() {
	const client = createClient({ url: REDIS_URL });
	client.on("error", (err) =>
		console.error("[local-upstash-bridge] redis error:", err),
	);
	await client.connect();

	async function runCommand(
		command: unknown[],
	): Promise<{ result?: unknown; error?: string }> {
		try {
			const args = command.map((v) => String(v));
			const result = await client.sendCommand(args);
			return { result: normalize(result) };
		} catch (err) {
			return { error: err instanceof Error ? err.message : String(err) };
		}
	}

	function normalize(value: unknown): unknown {
		if (Buffer.isBuffer(value)) return value.toString("utf8");
		if (Array.isArray(value)) return value.map(normalize);
		return value;
	}

	const server = createServer((req, res) => {
		if (req.method === "GET") {
			// Playwright's webServer readiness probe expects a 2xx response.
			res.writeHead(200).end("ok");
			return;
		}
		if (req.method !== "POST") {
			res.writeHead(405).end();
			return;
		}
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});
		req.on("end", async () => {
			try {
				const parsed = JSON.parse(body || "[]");
				const isPipeline =
					req.url?.includes("pipeline") || req.url?.includes("multi-exec");
				res.setHeader("Content-Type", "application/json");
				if (isPipeline) {
					const commands = parsed as unknown[][];
					const results = await Promise.all(commands.map((c) => runCommand(c)));
					res.writeHead(200).end(JSON.stringify(results));
				} else {
					const result = await runCommand(parsed as unknown[]);
					res.writeHead(200).end(JSON.stringify(result));
				}
			} catch (err) {
				res.writeHead(500).end(
					JSON.stringify({
						error: err instanceof Error ? err.message : String(err),
					}),
				);
			}
		});
	});

	server.listen(PORT, "127.0.0.1", () => {
		console.log(
			`[local-upstash-bridge] listening on http://127.0.0.1:${PORT}, backed by ${REDIS_URL}`,
		);
	});

	process.on("SIGTERM", async () => {
		server.close();
		await client.quit();
		process.exit(0);
	});
}

main().catch((err) => {
	console.error("[local-upstash-bridge] fatal:", err);
	process.exit(1);
});
