/**
 * STUB MODERATION WORKER — mimics OpenAI's POST /v1/moderations for
 * write-path load testing only. See docs/runbooks/loadtest-moderation-stub.md
 * for the on/off procedure before this is ever pointed at from staging.
 *
 * Deployed standalone via Cloudflare Workers (`wrangler deploy`, this
 * directory). NOT part of the Next.js app or its build — nothing under
 * src/server/ imports or references this file. The app reaches it only when
 * a human has deliberately set OPENAI_BASE_URL on the Vercel staging
 * environment to this Worker's URL, which the openai npm package (v6.39.0)
 * already resolves from automatically — no application code change needed
 * for this to work.
 *
 * WHY IT EXISTS: every bet carries mandatory commentary, and every comment
 * triggers a real, metered OpenAI moderation call. Write-path load testing
 * at any real concurrency means real vendor spend on every request unless
 * something stands in for OpenAI during the test window. This is that
 * something — and only that. It does not change, weaken, or bypass the
 * app's own moderation logic, verdict mapping, or fail-closed posture; it
 * only changes where the HTTP call goes, deliberately, temporarily, and
 * loudly (every hit is logged).
 *
 * RESPONSE SHAPE matches OpenAI's real ModerationCreateResponse exactly, per
 * this repo's own test fixtures (tests/server/moderation/_probe-openai-omni-shape.test.ts
 * and openai-capture.test.ts) — the 13 category keys `moderate()`
 * (src/server/moderation/openai.ts) actually reads.
 *
 * DEFAULT: every request returns flagged:false (the "pass" path) — this is
 * what the overwhelming majority of write-load traffic needs, so a load run
 * isn't gated on constructing genuinely flaggable content.
 *
 * DELIBERATE-FLAG HOOK: if the request's text input contains one of the two
 * marker strings below, the response is flagged for that category instead —
 * so a write-load run can also exercise precommit.ts's track_a/track_b
 * verdict-mapping branches, not just the pass path, without ever needing
 * real flaggable content.
 */

const MARKER_TRACK_A = "__LOADTEST_FLAG_SEXUAL_MINORS__"; // sexual/minors → track_a
const MARKER_TRACK_B = "__LOADTEST_FLAG_HARASSMENT__"; // any other category → track_b

const ALL_CATEGORIES = [
	"harassment",
	"harassment/threatening",
	"hate",
	"hate/threatening",
	"illicit",
	"illicit/violent",
	"self-harm",
	"self-harm/instructions",
	"self-harm/intent",
	"sexual",
	"sexual/minors",
	"violence",
	"violence/graphic",
];

function categoriesAllFalse() {
	return Object.fromEntries(ALL_CATEGORIES.map((k) => [k, false]));
}

function scoresNearZero() {
	return Object.fromEntries(ALL_CATEGORIES.map((k) => [k, 0.01]));
}

function categoryAppliedInputTypesEmpty() {
	return Object.fromEntries(ALL_CATEGORIES.map((k) => [k, []]));
}

/** Extract every text segment from the request's `input` array, concatenated,
 * so the marker check works regardless of how many text/image_url items are
 * present. */
function extractText(input) {
	if (!Array.isArray(input)) return "";
	return input
		.filter((item) => item && item.type === "text")
		.map((item) => item.text ?? "")
		.join("\n");
}

function buildResult(text) {
	if (text.includes(MARKER_TRACK_A)) {
		const categories = categoriesAllFalse();
		const scores = scoresNearZero();
		categories["sexual"] = true;
		categories["sexual/minors"] = true;
		scores["sexual"] = 0.95;
		scores["sexual/minors"] = 0.95;
		return { flagged: true, categories, category_scores: scores };
	}
	if (text.includes(MARKER_TRACK_B)) {
		const categories = categoriesAllFalse();
		const scores = scoresNearZero();
		categories["harassment"] = true;
		scores["harassment"] = 0.9;
		return { flagged: true, categories, category_scores: scores };
	}
	return {
		flagged: false,
		categories: categoriesAllFalse(),
		category_scores: scoresNearZero(),
	};
}

export default {
	async fetch(request, env) {
		if (request.method !== "POST") {
			return new Response("method not allowed", { status: 405 });
		}

		const auth = request.headers.get("X-Loadtest-Auth");
		if (!auth || !env.LOADTEST_AUTH_TOKEN || auth !== env.LOADTEST_AUTH_TOKEN) {
			// Loud refusal, not a silent one — a stray/misconfigured caller must
			// see this fail, never see a fabricated "pass".
			console.log(`[stub-moderation] REFUSED unauthenticated request`);
			return new Response("unauthorized", { status: 401 });
		}

		let body;
		try {
			body = await request.json();
		} catch {
			return new Response("invalid json", { status: 400 });
		}

		const text = extractText(body?.input);
		const result = buildResult(text);

		// Every request logged — usage of this endpoint is never silent.
		// `wrangler tail` or the Cloudflare dashboard shows this live.
		console.log(
			`[stub-moderation] model=${body?.model ?? "unknown"} flagged=${result.flagged}` +
				(result.flagged
					? ` category=${Object.keys(result.categories).find((k) => result.categories[k])}`
					: ""),
		);

		const response = {
			id: `modr-stub-${crypto.randomUUID()}`,
			model: body?.model ?? "omni-moderation-stub",
			results: [
				{
					flagged: result.flagged,
					categories: result.categories,
					category_scores: result.category_scores,
					category_applied_input_types: categoryAppliedInputTypesEmpty(),
				},
			],
		};

		return new Response(JSON.stringify(response), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	},
};
