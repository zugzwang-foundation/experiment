import "server-only";

/**
 * The header's GitHub star count (GH-STAR). One unauthenticated GET against the
 * public repos endpoint, held for 15 minutes by the Next Data Cache.
 *
 * ⛔ `0` IS A VALUE, AND THE RETURN TYPE IS WHERE THAT IS ENFORCED. `number |
 * null` carries two different facts: `0` means GitHub answered and the repo has
 * no stars; `null` means the read did not land and the caller must render no
 * count at all. Every caller branches on `stars === null` — never `!stars`,
 * `stars ?` or `stars > 0`, each of which collapses the two and ships a header
 * claiming a failed read on the exact count this repo has today. That is why
 * this never coerces a missing count to `0` and never throws: a thrown error
 * would take the whole header down, and a coerced `0` would lie quietly.
 */

/** The repo the header links to. */
export const GITHUB_REPO_URL =
	"https://github.com/zugzwang-foundation/experiment";

const GITHUB_API_URL =
	"https://api.github.com/repos/zugzwang-foundation/experiment";

/** 15 minutes → 4 requests/hour against a 60/hour unauthenticated budget. */
export const STAR_COUNT_REVALIDATE_SECONDS = 900;

/** The header must never wait on GitHub longer than this. */
const STAR_COUNT_TIMEOUT_MS = 2000;

/**
 * Read the repo's stargazer count. Resolves to `null` on any failure — non-2xx,
 * timeout, network, malformed body — and never rejects.
 */
export async function readStarCount(): Promise<number | null> {
	try {
		/**
		 * ⛔ THIS CALL IS UNAUTHENTICATED BY DESIGN. That is a decision, not a
		 * shortcut taken because a token was inconvenient to plumb — and the
		 * decision runs the opposite way to intuition, so it is written out here
		 * rather than left to be rediscovered.
		 *
		 * The instinct, when a public GitHub endpoint starts returning 403, is to
		 * add a PAT: authenticated callers get 5,000 requests/hour instead of 60.
		 * On this call path that instinct makes the problem it is trying to solve.
		 *
		 * The mechanism is in Next's own fetch patch. At
		 * `node_modules/next/dist/server/lib/patch-fetch.js:363` Next reads the
		 * request headers and sets `hasUnCacheableHeader` if either `authorization`
		 * or `cookie` is present. That flag lands at `:383`, where `autoNoCache`
		 * becomes true for an uncacheable header on a segment whose revalidate is
		 * `0` — and both `(public)` pages export `dynamic = "force-dynamic"`
		 * (`page.tsx:18`, `m/[slug]/page.tsx:21`), which is exactly that segment.
		 * So an `Authorization` header here does not merely add credentials: it
		 * silently opts this fetch out of the Data Cache, and the
		 * `next.revalidate` below stops meaning anything.
		 *
		 * What follows is the part worth stopping on. Uncached, every render of
		 * every public page hits `api.github.com` — not four times an hour, but
		 * once per request. The unauthenticated limit is 60/hour PER IP, and a
		 * serverless region shares its IP across every instance, so the budget
		 * burns within minutes of any real traffic. From then on the read fails
		 * permanently, the header renders with no count forever, and nothing
		 * anywhere goes red: the failure path is a supported state, the component
		 * renders it correctly, and every test in this repo still passes. The
		 * whole regression is invisible from inside the repository.
		 *
		 * ⇒ Do not add a PAT to "fix" rate limiting. It causes it. If this call
		 * ever genuinely needs credentials, the cache has to be re-derived first —
		 * read `:349`–`:392` at the installed Next version and prove the Data
		 * Cache still holds, because the test at
		 * `tests/unit/shell/github-star-count.test.ts` pins the absence of that
		 * header precisely so the swap cannot be made by accident.
		 *
		 * The `next.revalidate` below is what keeps the plain GET cacheable:
		 * setting it explicitly falsifies the `!currentFetchRevalidate` term of
		 * `noFetchConfigAndForceDynamic` at `:349`, so `force-dynamic` does not
		 * drag this fetch to `revalidate: 0` at `:355`. Passing `signal` is safe —
		 * Next strips it on background revalidation by design.
		 */
		const res = await fetch(GITHUB_API_URL, {
			next: { revalidate: STAR_COUNT_REVALIDATE_SECONDS },
			signal: AbortSignal.timeout(STAR_COUNT_TIMEOUT_MS),
			headers: { accept: "application/vnd.github+json" },
		});

		if (!res.ok) {
			// 403 here is the rate limit; it is a normal outcome, not an incident.
			console.error(`github star count: HTTP ${res.status}`);
			return null;
		}

		// Third-party body — narrowed, never cast (AGENTS.md §4).
		const body: unknown = await res.json();
		if (
			typeof body === "object" &&
			body !== null &&
			"stargazers_count" in body
		) {
			const count = body.stargazers_count;
			if (typeof count === "number" && Number.isFinite(count)) {
				return count;
			}
		}
		return null;
	} catch (error) {
		// Abort, DNS, TLS, malformed JSON. All the same outcome to the caller.
		console.error("github star count: read failed", error);
		return null;
	}
}
