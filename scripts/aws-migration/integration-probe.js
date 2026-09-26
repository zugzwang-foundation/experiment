// Runs INSIDE a one-off staging ECS task (app image, same task definition, so the
// staging secrets are injected). Exercises each outbound integration with the real
// staging credential and prints ONE LINE per integration: name, ok/FAIL, HTTP status
// or error code. Never prints a credential, a URL with a token, or a response body.
const t = (ms) => AbortSignal.timeout(ms);
const line = (n, r) => `${n}: ${r}`;
const out = [];
const run = async (name, fn) => {
	try {
		out.push(line(name, await fn()));
	} catch (e) {
		out.push(
			line(
				name,
				`FAIL(${e.cause?.code || e.code || e.name}: ${String(e.message).slice(0, 60)})`,
			),
		);
	}
};
(async () => {
	// Upstash Redis REST — PING with the bearer token
	await run("upstash", async () => {
		const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
			headers: {
				Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
			},
			signal: t(8000),
		});
		const j = await r.json().catch(() => ({}));
		return r.ok && j.result === "PONG" ? "ok(PONG)" : `FAIL(HTTP ${r.status})`;
	});
	// OpenAI — list models (authenticated, read-only)
	await run("openai", async () => {
		const r = await fetch("https://api.openai.com/v1/models", {
			headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
			signal: t(10000),
		});
		return r.ok ? `ok(${r.status})` : `FAIL(HTTP ${r.status})`;
	});
	// Cloudflare R2 — HeadBucket on the uploads bucket with the app's own SDK
	await run("r2", async () => {
		const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
		const c = new S3Client({
			region: "auto",
			endpoint: process.env.R2_ENDPOINT_UPLOADS,
			credentials: {
				accessKeyId: process.env.R2_ACCESS_KEY_ID_UPLOADS,
				secretAccessKey: process.env.R2_SECRET_ACCESS_KEY_UPLOADS,
			},
		});
		await c.send(
			new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_UPLOADS }),
		);
		return "ok(HeadBucket)";
	});
	// Sentry — the DSN's ingest host answers the envelope endpoint (405/400 = reachable)
	await run("sentry", async () => {
		const u = new URL(process.env.NEXT_PUBLIC_SENTRY_DSN);
		const r = await fetch(`https://${u.host}/api${u.pathname}/envelope/`, {
			method: "OPTIONS",
			signal: t(8000),
		});
		return r.status < 500
			? `ok(reachable ${r.status})`
			: `FAIL(HTTP ${r.status})`;
	});
	// Resend — authenticated read-only list
	await run("resend", async () => {
		const r = await fetch("https://api.resend.com/domains", {
			headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
			signal: t(8000),
		});
		if (r.ok) return `ok(${r.status})`;
		const j = await r.json().catch(() => ({}));
		// A sending-only key is VALID and is all the OTP sender needs; only an invalid key is a failure.
		return j.name === "restricted_api_key"
			? "ok(valid sending-only key)"
			: `FAIL(HTTP ${r.status} ${j.name || ""})`;
	});
	// RDS is measured by the app itself (/api/health db:ok uses the same URL + driver) and by the 21 tunnel checks.
	console.log("INTEGRATIONS " + out.join(" | "));
	process.exit(0);
})();
